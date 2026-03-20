-- Thêm cột mã kiện nhà cung cấp vào bảng order_items
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS supplier_bundle_code TEXT;

-- Backfill: lấy supplier_bundle_code từ wood_bundles theo bundle_id
UPDATE order_items oi
SET supplier_bundle_code = wb.supplier_bundle_code
FROM wood_bundles wb
WHERE oi.bundle_id = wb.id
  AND wb.supplier_bundle_code IS NOT NULL
  AND wb.supplier_bundle_code <> ''
  AND (oi.supplier_bundle_code IS NULL OR oi.supplier_bundle_code = '');
