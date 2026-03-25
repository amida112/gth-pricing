-- ================================================================
-- Module: Quản lý Lò sấy (Kiln Drying Management)
-- Ngày: 2026-03-25
-- ================================================================

-- 1. Bảng quy đổi kg/m³ (gỗ xẻ)
--    Tên gỗ đơn giản: Gõ, Thông, Sồi, Tần bì, Óc chó ...
--    thickness_min: nếu != null → chỉ áp dụng khi dày ≥ giá trị này (VD: Tần bì dày ≥ 3.5F)
CREATE TABLE IF NOT EXISTS wood_conversion_rates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  rate           decimal NOT NULL CHECK (rate > 0),   -- kg/m³ (VD: 1046)
  thickness_min  text,                                 -- VD: "3.5F" → áp dụng khi dày ≥ 3.5F
  notes          text,
  sort_order     integer DEFAULT 0,
  updated_at     timestamptz DEFAULT now()
);

ALTER TABLE wood_conversion_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wcr_all" ON wood_conversion_rates
  FOR ALL USING (true) WITH CHECK (true);

-- Seed bảng quy đổi mẫu (admin tự điều chỉnh)
INSERT INTO wood_conversion_rates (name, rate, thickness_min, sort_order) VALUES
  ('Gõ',           1046, NULL,   1),
  ('Thông',         530, NULL,   2),
  ('Sồi',           770, NULL,   3),
  ('Tần bì',        680, NULL,   4),
  ('Tần bì dày',    740, '3.5F', 5),
  ('Óc chó',        640, NULL,   6);

-- 2. Mẻ sấy (1 lò chỉ 1 mẻ "Đang sấy" tại 1 thời điểm)
CREATE TABLE IF NOT EXISTS kiln_batches (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_code          text NOT NULL,
  kiln_number         integer NOT NULL CHECK (kiln_number BETWEEN 1 AND 8),
  entry_date          date NOT NULL,
  expected_exit_date  date,
  actual_exit_date    date,
  status              text NOT NULL DEFAULT 'Đang sấy'
                        CHECK (status IN ('Đang sấy','Đã ra lò','Hoàn thành')),
  notes               text,
  created_at          timestamptz DEFAULT now()
);

-- Enforce: 1 lò chỉ có 1 mẻ "Đang sấy" tại 1 thời điểm
CREATE UNIQUE INDEX idx_kiln_one_active
  ON kiln_batches(kiln_number) WHERE status = 'Đang sấy';

CREATE INDEX idx_kb_status ON kiln_batches(status);
CREATE INDEX idx_kb_kiln   ON kiln_batches(kiln_number);

ALTER TABLE kiln_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kb_all" ON kiln_batches
  FOR ALL USING (true) WITH CHECK (true);

-- Auto-generate batch_code: LS-{lò}-{YYYYMMDD}-{NNN}
CREATE OR REPLACE FUNCTION fn_generate_kiln_batch_code()
RETURNS TRIGGER AS $$
DECLARE
  prefix TEXT;
  date_str TEXT;
  next_num INTEGER;
BEGIN
  prefix := 'LS-' || NEW.kiln_number;
  date_str := TO_CHAR(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYYMMDD');
  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(batch_code, '-', 4) AS INTEGER)
  ), 0) + 1
  INTO next_num
  FROM kiln_batches
  WHERE batch_code LIKE prefix || '-' || date_str || '-%';

  NEW.batch_code := prefix || '-' || date_str || '-' || LPAD(next_num::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_kiln_batch_code ON kiln_batches;
CREATE TRIGGER trg_kiln_batch_code
  BEFORE INSERT ON kiln_batches
  FOR EACH ROW
  WHEN (NEW.batch_code IS NULL OR NEW.batch_code = '')
  EXECUTE FUNCTION fn_generate_kiln_batch_code();

-- 3. Mục gỗ trong mẻ sấy
CREATE TABLE IF NOT EXISTS kiln_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id         uuid NOT NULL REFERENCES kiln_batches(id) ON DELETE CASCADE,
  item_code        text NOT NULL,
  wood_type_id     uuid REFERENCES raw_wood_types(id) ON DELETE SET NULL,
  thickness        text NOT NULL,
  owner_type       text NOT NULL DEFAULT 'company'
                     CHECK (owner_type IN ('company','customer')),
  owner_name       text,              -- tên khách nếu customer, null nếu company
  weight_kg        decimal NOT NULL DEFAULT 0,
  conversion_rate  decimal,           -- snapshot hệ số tại thời điểm nhập
  volume_m3        decimal DEFAULT 0, -- = weight_kg × conversion_rate

  -- Tracking sau ra lò
  status           text NOT NULL DEFAULT 'Trong lò'
                     CHECK (status IN (
                       'Trong lò',
                       'Đã ra lò',
                       'Đã đóng kiện',
                       'Bỏ lại - Chờ ghép',
                       'Bỏ lại - Loại'
                     )),
  volume_packed    decimal DEFAULT 0,  -- m³ đã đóng thành kiện
  volume_leftover  decimal DEFAULT 0,  -- m³ bỏ lại
  leftover_reason  text,               -- lý do bỏ lại chi tiết
  packing_date     date,               -- ngày đóng kiện
  packing_notes    text,               -- ghi chú đóng kiện

  notes            text,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX idx_ki_batch    ON kiln_items(batch_id);
CREATE INDEX idx_ki_status   ON kiln_items(status);
CREATE INDEX idx_ki_owner    ON kiln_items(owner_type);
CREATE INDEX idx_ki_leftover ON kiln_items(status)
  WHERE status = 'Bỏ lại - Chờ ghép';

ALTER TABLE kiln_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ki_all" ON kiln_items
  FOR ALL USING (true) WITH CHECK (true);

-- Auto-generate item_code: KD-{lò}-{YYYYMMDD}-{NNN}
CREATE OR REPLACE FUNCTION fn_generate_kiln_item_code()
RETURNS TRIGGER AS $$
DECLARE
  kiln_num INTEGER;
  prefix TEXT;
  date_str TEXT;
  next_num INTEGER;
BEGIN
  SELECT kiln_number INTO kiln_num
  FROM kiln_batches WHERE id = NEW.batch_id;

  prefix := 'KD-' || kiln_num;
  date_str := TO_CHAR(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYYMMDD');
  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(item_code, '-', 4) AS INTEGER)
  ), 0) + 1
  INTO next_num
  FROM kiln_items
  WHERE item_code LIKE prefix || '-' || date_str || '-%';

  NEW.item_code := prefix || '-' || date_str || '-' || LPAD(next_num::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_kiln_item_code ON kiln_items;
CREATE TRIGGER trg_kiln_item_code
  BEFORE INSERT ON kiln_items
  FOR EACH ROW
  WHEN (NEW.item_code IS NULL OR NEW.item_code = '')
  EXECUTE FUNCTION fn_generate_kiln_item_code();
