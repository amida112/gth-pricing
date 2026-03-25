-- ================================================================
-- Module: Gỗ tròn & Gỗ hộp (Raw Wood Management)
-- Ngày: 2026-03-25
-- ================================================================

-- 1. Danh mục loại gỗ tròn / hộp (độc lập với gỗ kiện)
CREATE TABLE IF NOT EXISTS raw_wood_types (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  wood_form    text NOT NULL CHECK (wood_form IN ('round', 'box')),
  icon         text,
  sort_order   integer DEFAULT 0,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX idx_rwt_form ON raw_wood_types(wood_form);

-- Seed: loại gỗ tròn
INSERT INTO raw_wood_types (name, wood_form, icon, sort_order) VALUES
  ('Tần bì tròn',   'round', '🪵', 1),
  ('Óc chó tròn',   'round', '🪵', 2),
  ('Thông tròn',    'round', '🪵', 3),
  ('Sồi đỏ tròn',   'round', '🪵', 4),
  ('Teak tròn',     'round', '🪵', 5),
  ('Beech tròn',    'round', '🪵', 6);

-- Seed: loại gỗ hộp
INSERT INTO raw_wood_types (name, wood_form, icon, sort_order) VALUES
  ('Gõ hộp',        'box',   '📦', 1);

ALTER TABLE raw_wood_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rwt_all" ON raw_wood_types FOR ALL USING (true) WITH CHECK (true);

-- 2. Lô gỗ thô (dùng chung tròn + hộp)
CREATE TABLE IF NOT EXISTS raw_wood_lots (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_code       text NOT NULL,
  wood_form      text NOT NULL CHECK (wood_form IN ('round', 'box')),
  container_id   bigint REFERENCES containers(id) ON DELETE SET NULL,
  shipment_id    uuid REFERENCES shipments(id) ON DELETE SET NULL,
  wood_type_id   uuid REFERENCES raw_wood_types(id) ON DELETE SET NULL,
  supplier_id    text,
  quality        text,
  total_pieces   integer DEFAULT 0,
  total_volume   decimal DEFAULT 0,
  disposition    text DEFAULT 'pending',
  customer_id    uuid,
  status         text DEFAULT 'Mới nhập',
  notes          text,
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX idx_rwl_form   ON raw_wood_lots(wood_form);
CREATE INDEX idx_rwl_status ON raw_wood_lots(status);
CREATE INDEX idx_rwl_wood   ON raw_wood_lots(wood_type_id);

-- 2. Chi tiết từng cây/thanh
CREATE TABLE IF NOT EXISTS raw_wood_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id              uuid NOT NULL REFERENCES raw_wood_lots(id) ON DELETE CASCADE,
  item_code           text,
  wood_type_id        uuid REFERENCES raw_wood_types(id) ON DELETE SET NULL,
  quality             text,
  length              decimal,
  diameter            decimal,
  circumference       decimal,
  width               decimal,
  thickness           decimal,
  volume              decimal,
  status              text DEFAULT 'Trong kho',
  sold_to_customer_id uuid,
  sold_order_id       uuid,
  sawing_batch_id     uuid,
  sawing_date         date,
  notes               text,
  created_at          timestamptz DEFAULT now()
);

CREATE INDEX idx_rwi_lot    ON raw_wood_items(lot_id);
CREATE INDEX idx_rwi_status ON raw_wood_items(status);

-- 3. Lô xẻ sấy
CREATE TABLE IF NOT EXISTS sawing_batches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_code      text NOT NULL,
  sawing_date     date,
  wood_id         text,
  source_lot_id   uuid REFERENCES raw_wood_lots(id) ON DELETE SET NULL,
  input_pieces    integer DEFAULT 0,
  input_volume    decimal DEFAULT 0,
  output_bundles  integer DEFAULT 0,
  output_volume   decimal DEFAULT 0,
  yield_rate      decimal,
  status          text DEFAULT 'Đang xẻ',
  notes           text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_sb_date ON sawing_batches(sawing_date);

-- 4. Liên kết kiện gỗ → lô xẻ (backward compatible)
ALTER TABLE wood_bundles
  ADD COLUMN IF NOT EXISTS sawing_batch_id uuid REFERENCES sawing_batches(id) ON DELETE SET NULL;

-- 5. Auto-generate lot_code (GT-YYYYMMDD-NNN / GH-YYYYMMDD-NNN)
CREATE OR REPLACE FUNCTION fn_generate_lot_code()
RETURNS TRIGGER AS $$
DECLARE
  prefix TEXT;
  date_str TEXT;
  next_num INTEGER;
BEGIN
  prefix := CASE NEW.wood_form WHEN 'round' THEN 'GT' ELSE 'GH' END;
  date_str := TO_CHAR(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYYMMDD');
  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(lot_code, '-', 3) AS INTEGER)
  ), 0) + 1
  INTO next_num
  FROM raw_wood_lots
  WHERE lot_code LIKE prefix || '-' || date_str || '-%';

  NEW.lot_code := prefix || '-' || date_str || '-' || LPAD(next_num::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lot_code ON raw_wood_lots;
CREATE TRIGGER trg_lot_code
  BEFORE INSERT ON raw_wood_lots
  FOR EACH ROW
  WHEN (NEW.lot_code IS NULL OR NEW.lot_code = '')
  EXECUTE FUNCTION fn_generate_lot_code();

-- 6. Auto-generate batch_code (XS-YYYYMMDD-NNN)
CREATE OR REPLACE FUNCTION fn_generate_batch_code()
RETURNS TRIGGER AS $$
DECLARE
  date_str TEXT;
  next_num INTEGER;
BEGIN
  date_str := TO_CHAR(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYYMMDD');
  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(batch_code, '-', 3) AS INTEGER)
  ), 0) + 1
  INTO next_num
  FROM sawing_batches
  WHERE batch_code LIKE 'XS-' || date_str || '-%';

  NEW.batch_code := 'XS-' || date_str || '-' || LPAD(next_num::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_batch_code ON sawing_batches;
CREATE TRIGGER trg_batch_code
  BEFORE INSERT ON sawing_batches
  FOR EACH ROW
  WHEN (NEW.batch_code IS NULL OR NEW.batch_code = '')
  EXECUTE FUNCTION fn_generate_batch_code();

-- 7. RLS
ALTER TABLE raw_wood_lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rwl_all" ON raw_wood_lots FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE raw_wood_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rwi_all" ON raw_wood_items FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE sawing_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sb_all" ON sawing_batches FOR ALL USING (true) WITH CHECK (true);
