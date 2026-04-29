-- Migration: Thêm cột sale_date cho đơn hàng (ngày bán hàng thực tế)
-- Mục đích: tách biệt "ngày tạo dòng" (created_at - audit) với "ngày bán hàng nghiệp vụ" (sale_date)
-- Ứng dụng: nhân viên nhập đuổi đơn hàng vào hệ thống có thể chọn ngày bán thực tế ≠ ngày nhập liệu
-- Chạy trên cả staging (tscddgjkelnmlitzcxyg) và production

-- 1. Thêm cột sale_date
ALTER TABLE orders ADD COLUMN IF NOT EXISTS sale_date TIMESTAMPTZ;

-- 2. Backfill: đơn cũ không phải nháp → sale_date = created_at
UPDATE orders SET sale_date = created_at
WHERE status != 'Nháp' AND sale_date IS NULL;

-- 3. Index cho sort/filter nhanh theo ngày bán
CREATE INDEX IF NOT EXISTS idx_orders_sale_date ON orders(sale_date DESC);

-- 4. Default cho đơn mới (nếu app không gửi sale_date thì dùng now())
ALTER TABLE orders ALTER COLUMN sale_date SET DEFAULT NOW();

-- Verify
-- SELECT
--   COUNT(*) FILTER (WHERE sale_date IS NOT NULL) as has_sale_date,
--   COUNT(*) FILTER (WHERE sale_date IS NULL) as null_sale_date,
--   COUNT(*) FILTER (WHERE status = 'Nháp') as drafts
-- FROM orders;
