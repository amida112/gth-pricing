-- ================================================================
-- Module: Lịch lô hàng (Shipments)
-- Ngày: 2026-03-25
-- ================================================================

-- 1. Bảng shipments
CREATE TABLE IF NOT EXISTS shipments (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_code              text NOT NULL,
  arrival_date               date,
  port_name                  text,
  yard_storage_deadline      date,
  container_storage_deadline date,
  empty_return_deadline      date,
  carrier_name               text,
  carrier_phone              text,
  status                     text DEFAULT 'Chờ cập cảng',
  notes                      text,
  created_at                 timestamptz DEFAULT now()
);

CREATE INDEX idx_shipments_arrival ON shipments(arrival_date);
CREATE INDEX idx_shipments_status  ON shipments(status);

-- 2. FK shipment_id trên containers (nullable, backward compatible)
ALTER TABLE containers
  ADD COLUMN IF NOT EXISTS shipment_id uuid REFERENCES shipments(id) ON DELETE SET NULL;

CREATE INDEX idx_containers_shipment ON containers(shipment_id);

-- 3. Auto-generate shipment_code (LH-YYYYMMDD-NNN)
CREATE OR REPLACE FUNCTION fn_generate_shipment_code()
RETURNS TRIGGER AS $$
DECLARE
  date_str TEXT;
  next_num INTEGER;
BEGIN
  date_str := TO_CHAR(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYYMMDD');
  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(shipment_code, '-', 3) AS INTEGER)
  ), 0) + 1
  INTO next_num
  FROM shipments
  WHERE shipment_code LIKE 'LH-' || date_str || '-%';

  NEW.shipment_code := 'LH-' || date_str || '-' || LPAD(next_num::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_shipment_code ON shipments;
CREATE TRIGGER trg_shipment_code
  BEFORE INSERT ON shipments
  FOR EACH ROW
  WHEN (NEW.shipment_code IS NULL OR NEW.shipment_code = '')
  EXECUTE FUNCTION fn_generate_shipment_code();

-- 4. RLS
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shipments_all" ON shipments FOR ALL USING (true) WITH CHECK (true);
