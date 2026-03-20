-- Migration: Thêm cột unit_price vào bảng wood_bundles
-- Dùng cho loại gỗ định giá theo kiện (pricingMode = 'perBundle'), ví dụ: Thông nhập khẩu
-- Đơn vị: triệu VNĐ/m³ (ví dụ: 7 = 7 triệu/m³)
-- An toàn khi chạy lại nhiều lần (idempotent)

ALTER TABLE wood_bundles
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10,4) DEFAULT NULL;

COMMENT ON COLUMN wood_bundles.unit_price IS
  'Giá bán theo kiện (tr/m³), chỉ dùng cho loại gỗ có pricingMode = perBundle. '
  'NULL = dùng bảng giá SKU thông thường.';

CREATE INDEX IF NOT EXISTS idx_wood_bundles_unit_price
  ON wood_bundles(unit_price)
  WHERE unit_price IS NOT NULL;
