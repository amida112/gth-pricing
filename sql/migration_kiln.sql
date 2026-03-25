-- ================================================================
-- Module: Quản lý Lò sấy v2 (Kiln Drying Management)
-- Ngày: 2026-03-25
-- ================================================================

-- ── 0. Drop bảng cũ (v1) ───────────────────────────────────────
-- Thứ tự drop: con trước, cha sau (do FK constraints)
DROP TABLE IF EXISTS packing_leftovers CASCADE;
DROP TABLE IF EXISTS unsorted_bundles CASCADE;
DROP TABLE IF EXISTS packing_sessions CASCADE;
DROP TABLE IF EXISTS kiln_items CASCADE;
DROP TABLE IF EXISTS kiln_batches CASCADE;
DROP TABLE IF EXISTS wood_conversion_rates CASCADE;

-- Drop functions & triggers cũ
DROP FUNCTION IF EXISTS fn_generate_kiln_batch_code() CASCADE;
DROP FUNCTION IF EXISTS fn_generate_kiln_item_code() CASCADE;
DROP FUNCTION IF EXISTS fn_generate_unsorted_code() CASCADE;
DROP FUNCTION IF EXISTS fn_generate_session_code() CASCADE;
DROP FUNCTION IF EXISTS fn_generate_leftover_code() CASCADE;

-- ── 1. Bảng quy đổi kg/m³ (gỗ xẻ) ─────────────────────────────
CREATE TABLE IF NOT EXISTS wood_conversion_rates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  rate           decimal NOT NULL CHECK (rate > 0),   -- kg/m³ (VD: 640)
  thickness_min  text,                                 -- VD: "3.5" → áp dụng khi dày ≥ 3.5cm
  notes          text,
  sort_order     integer DEFAULT 0,
  updated_at     timestamptz DEFAULT now()
);

ALTER TABLE wood_conversion_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wcr_all" ON wood_conversion_rates FOR ALL USING (true) WITH CHECK (true);

INSERT INTO wood_conversion_rates (name, rate, thickness_min, sort_order) VALUES
  ('Gõ',           1046, NULL,  1),
  ('Thông',         530, NULL,  2),
  ('Sồi',           770, NULL,  3),
  ('Tần bì',        680, NULL,  4),
  ('Tần bì dày',    740, '3.5', 5),
  ('Óc chó',        640, NULL,  6);

-- ── 2. Mẻ sấy ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kiln_batches (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_code          text NOT NULL,
  kiln_number         integer NOT NULL CHECK (kiln_number BETWEEN 1 AND 8),
  entry_date          date NOT NULL,
  expected_exit_date  date,
  actual_exit_date    date,
  status              text NOT NULL DEFAULT 'Đang sấy'
    CHECK (status IN ('Đang sấy','Đã tắt','Đang ra lò','Đã ra hết')),
  notes               text,
  created_at          timestamptz DEFAULT now()
);

-- 1 lò chỉ 1 mẻ active (chưa ra hết) tại 1 thời điểm
CREATE UNIQUE INDEX idx_kiln_one_active
  ON kiln_batches(kiln_number) WHERE status != 'Đã ra hết';

CREATE INDEX idx_kb_status ON kiln_batches(status);
CREATE INDEX idx_kb_kiln   ON kiln_batches(kiln_number);

ALTER TABLE kiln_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kb_all" ON kiln_batches FOR ALL USING (true) WITH CHECK (true);

-- Auto: LS-{lò}-{YYYYMMDD}-{NNN}
CREATE OR REPLACE FUNCTION fn_generate_kiln_batch_code()
RETURNS TRIGGER AS $$
DECLARE prefix TEXT; date_str TEXT; next_num INTEGER;
BEGIN
  prefix := 'LS-' || NEW.kiln_number;
  date_str := TO_CHAR(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYYMMDD');
  SELECT COALESCE(MAX(CAST(SPLIT_PART(batch_code, '-', 4) AS INTEGER)), 0) + 1
    INTO next_num FROM kiln_batches
    WHERE batch_code LIKE prefix || '-' || date_str || '-%';
  NEW.batch_code := prefix || '-' || date_str || '-' || LPAD(next_num::TEXT, 3, '0');
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_kiln_batch_code ON kiln_batches;
CREATE TRIGGER trg_kiln_batch_code BEFORE INSERT ON kiln_batches
  FOR EACH ROW WHEN (NEW.batch_code IS NULL OR NEW.batch_code = '')
  EXECUTE FUNCTION fn_generate_kiln_batch_code();

-- ── 3. Mã gỗ sấy (kiln items) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS kiln_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id        uuid NOT NULL REFERENCES kiln_batches(id) ON DELETE CASCADE,
  item_code       text NOT NULL,          -- Auto: GS-{lò}-{YYYYMMDD}-{NNN}
  wood_type_id    text,                   -- FK logic → wood_types (gỗ xẻ / wts)
  thickness_cm    decimal NOT NULL,       -- cm
  owner_type      text NOT NULL DEFAULT 'company'
    CHECK (owner_type IN ('company','customer')),
  owner_name      text,
  weight_kg       decimal NOT NULL DEFAULT 0,
  conversion_rate decimal,                -- snapshot kg/m³
  volume_m3       decimal DEFAULT 0,      -- = weight_kg / conversion_rate
  notes           text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_ki_batch ON kiln_items(batch_id);

ALTER TABLE kiln_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ki_all" ON kiln_items FOR ALL USING (true) WITH CHECK (true);

-- Auto: GS-{lò}-{YYYYMMDD}-{NNN}
CREATE OR REPLACE FUNCTION fn_generate_kiln_item_code()
RETURNS TRIGGER AS $$
DECLARE kiln_num INTEGER; prefix TEXT; date_str TEXT; next_num INTEGER;
BEGIN
  SELECT kiln_number INTO kiln_num FROM kiln_batches WHERE id = NEW.batch_id;
  prefix := 'GS-' || kiln_num;
  date_str := TO_CHAR(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYYMMDD');
  SELECT COALESCE(MAX(CAST(SPLIT_PART(item_code, '-', 4) AS INTEGER)), 0) + 1
    INTO next_num FROM kiln_items
    WHERE item_code LIKE prefix || '-' || date_str || '-%';
  NEW.item_code := prefix || '-' || date_str || '-' || LPAD(next_num::TEXT, 3, '0');
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_kiln_item_code ON kiln_items;
CREATE TRIGGER trg_kiln_item_code BEFORE INSERT ON kiln_items
  FOR EACH ROW WHEN (NEW.item_code IS NULL OR NEW.item_code = '')
  EXECUTE FUNCTION fn_generate_kiln_item_code();

-- ── 4. Kiện chưa xếp (tách từ mã gỗ sấy khi ra lò) ────────────
CREATE TABLE IF NOT EXISTS unsorted_bundles (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_code         text NOT NULL,      -- Auto: KCX-{lò}-{YYYYMMDD}-{NNN}
  kiln_item_id        uuid NOT NULL REFERENCES kiln_items(id) ON DELETE CASCADE,
  wood_type_id        text,               -- thừa hưởng từ kiln_item
  thickness_cm        decimal NOT NULL,
  owner_type          text DEFAULT 'company',
  owner_name          text,
  weight_kg           decimal NOT NULL DEFAULT 0,
  volume_m3           decimal DEFAULT 0,
  status              text NOT NULL DEFAULT 'Chưa xếp'
    CHECK (status IN ('Chưa xếp','Đã xếp')),
  packing_session_id  uuid,               -- FK → packing_sessions (set khi đã xếp)
  notes               text,
  created_at          timestamptz DEFAULT now()
);

CREATE INDEX idx_ub_kiln_item ON unsorted_bundles(kiln_item_id);
CREATE INDEX idx_ub_status    ON unsorted_bundles(status);
CREATE INDEX idx_ub_packing   ON unsorted_bundles(packing_session_id);

ALTER TABLE unsorted_bundles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ub_all" ON unsorted_bundles FOR ALL USING (true) WITH CHECK (true);

-- Auto: KCX-{lò}-{YYYYMMDD}-{NNN}
CREATE OR REPLACE FUNCTION fn_generate_unsorted_code()
RETURNS TRIGGER AS $$
DECLARE kiln_num INTEGER; prefix TEXT; date_str TEXT; next_num INTEGER;
BEGIN
  SELECT kb.kiln_number INTO kiln_num
    FROM kiln_items ki JOIN kiln_batches kb ON kb.id = ki.batch_id
    WHERE ki.id = NEW.kiln_item_id;
  prefix := 'KCX-' || COALESCE(kiln_num, 0);
  date_str := TO_CHAR(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYYMMDD');
  SELECT COALESCE(MAX(CAST(SPLIT_PART(bundle_code, '-', 4) AS INTEGER)), 0) + 1
    INTO next_num FROM unsorted_bundles
    WHERE bundle_code LIKE prefix || '-' || date_str || '-%';
  NEW.bundle_code := prefix || '-' || date_str || '-' || LPAD(next_num::TEXT, 3, '0');
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_unsorted_code ON unsorted_bundles;
CREATE TRIGGER trg_unsorted_code BEFORE INSERT ON unsorted_bundles
  FOR EACH ROW WHEN (NEW.bundle_code IS NULL OR NEW.bundle_code = '')
  EXECUTE FUNCTION fn_generate_unsorted_code();

-- ── 5. Mẻ xếp gỗ kiện ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS packing_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_code    text NOT NULL,          -- Auto: MX-{YYYYMMDD}-{NNN}
  packing_date    date NOT NULL,
  wood_type_id    text,                   -- constraint: tất cả input cùng loại
  thickness_cm    decimal,                -- constraint: tất cả input cùng dày
  total_input_kg  decimal DEFAULT 0,
  total_input_m3  decimal DEFAULT 0,
  status          text NOT NULL DEFAULT 'Đang xếp'
    CHECK (status IN ('Đang xếp','Hoàn thành')),
  notes           text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_ps_status ON packing_sessions(status);

ALTER TABLE packing_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_all" ON packing_sessions FOR ALL USING (true) WITH CHECK (true);

-- Auto: MX-{YYYYMMDD}-{NNN}
CREATE OR REPLACE FUNCTION fn_generate_session_code()
RETURNS TRIGGER AS $$
DECLARE date_str TEXT; next_num INTEGER;
BEGIN
  date_str := TO_CHAR(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYYMMDD');
  SELECT COALESCE(MAX(CAST(SPLIT_PART(session_code, '-', 3) AS INTEGER)), 0) + 1
    INTO next_num FROM packing_sessions
    WHERE session_code LIKE 'MX-' || date_str || '-%';
  NEW.session_code := 'MX-' || date_str || '-' || LPAD(next_num::TEXT, 3, '0');
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_session_code ON packing_sessions;
CREATE TRIGGER trg_session_code BEFORE INSERT ON packing_sessions
  FOR EACH ROW WHEN (NEW.session_code IS NULL OR NEW.session_code = '')
  EXECUTE FUNCTION fn_generate_session_code();

-- FK deferred: unsorted_bundles.packing_session_id → packing_sessions
ALTER TABLE unsorted_bundles
  ADD CONSTRAINT fk_ub_packing FOREIGN KEY (packing_session_id)
    REFERENCES packing_sessions(id) ON DELETE SET NULL;

-- ── 6. Kiện bỏ lại (có mã, đầu vào mẻ xếp sau) ────────────────
CREATE TABLE IF NOT EXISTS packing_leftovers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leftover_code       text NOT NULL,      -- Auto: KBL-{YYYYMMDD}-{NNN}
  source_session_id   uuid NOT NULL REFERENCES packing_sessions(id) ON DELETE CASCADE,
  wood_type_id        text,
  thickness_cm        decimal,
  quality             text,               -- Đã phân loại CL
  weight_kg           decimal DEFAULT 0,
  volume_m3           decimal DEFAULT 0,
  status              text NOT NULL DEFAULT 'Chưa xếp'
    CHECK (status IN ('Chưa xếp','Đã xếp')),
  used_in_session_id  uuid REFERENCES packing_sessions(id) ON DELETE SET NULL,
  notes               text,
  created_at          timestamptz DEFAULT now()
);

CREATE INDEX idx_pl_source  ON packing_leftovers(source_session_id);
CREATE INDEX idx_pl_status  ON packing_leftovers(status);
CREATE INDEX idx_pl_used_in ON packing_leftovers(used_in_session_id);

ALTER TABLE packing_leftovers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pl_all" ON packing_leftovers FOR ALL USING (true) WITH CHECK (true);

-- Auto: KBL-{YYYYMMDD}-{NNN}
CREATE OR REPLACE FUNCTION fn_generate_leftover_code()
RETURNS TRIGGER AS $$
DECLARE date_str TEXT; next_num INTEGER;
BEGIN
  date_str := TO_CHAR(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYYMMDD');
  SELECT COALESCE(MAX(CAST(SPLIT_PART(leftover_code, '-', 3) AS INTEGER)), 0) + 1
    INTO next_num FROM packing_leftovers
    WHERE leftover_code LIKE 'KBL-' || date_str || '-%';
  NEW.leftover_code := 'KBL-' || date_str || '-' || LPAD(next_num::TEXT, 3, '0');
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_leftover_code ON packing_leftovers;
CREATE TRIGGER trg_leftover_code BEFORE INSERT ON packing_leftovers
  FOR EACH ROW WHEN (NEW.leftover_code IS NULL OR NEW.leftover_code = '')
  EXECUTE FUNCTION fn_generate_leftover_code();

-- ── 7. Liên kết kiện gỗ hoàn chỉnh → mẻ xếp ───────────────────
ALTER TABLE wood_bundles
  ADD COLUMN IF NOT EXISTS packing_session_id uuid REFERENCES packing_sessions(id) ON DELETE SET NULL;

-- ── 8. Audit log chỉnh sửa gỗ sấy ─────────────────────────────
DROP TABLE IF EXISTS kiln_edit_log CASCADE;
CREATE TABLE IF NOT EXISTS kiln_edit_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kiln_item_id    uuid REFERENCES kiln_items(id) ON DELETE CASCADE,
  action          text NOT NULL,        -- 'add', 'edit', 'delete'
  changed_by      text,                 -- username
  old_values      jsonb,                -- snapshot trước khi sửa
  new_values      jsonb,                -- snapshot sau khi sửa
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_kel_item ON kiln_edit_log(kiln_item_id);
CREATE INDEX idx_kel_time ON kiln_edit_log(created_at);

ALTER TABLE kiln_edit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kel_all" ON kiln_edit_log FOR ALL USING (true) WITH CHECK (true);
