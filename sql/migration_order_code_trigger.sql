-- ================================================================
-- Tự động sinh order_code bằng DB trigger
-- Loại bỏ 1 round-trip SELECT khi tạo đơn hàng
-- Chạy trong Supabase SQL Editor
-- ================================================================

-- Function sinh mã đơn hàng (thread-safe vì chạy trong transaction)
CREATE OR REPLACE FUNCTION fn_generate_order_code()
RETURNS TRIGGER AS $$
DECLARE
  date_str TEXT;
  next_num INTEGER;
BEGIN
  -- Lấy ngày theo giờ Việt Nam (UTC+7)
  date_str := TO_CHAR(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYYMMDD');

  -- Đếm số đơn trong ngày + 1 (lock row để tránh race condition)
  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(order_code, '-', 3) AS INTEGER)
  ), 0) + 1
  INTO next_num
  FROM orders
  WHERE order_code LIKE 'DH-' || date_str || '-%';

  NEW.order_code := 'DH-' || date_str || '-' || LPAD(next_num::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: chỉ chạy khi order_code chưa được set (tạo mới)
DROP TRIGGER IF EXISTS trg_order_code ON orders;
CREATE TRIGGER trg_order_code
  BEFORE INSERT ON orders
  FOR EACH ROW
  WHEN (NEW.order_code IS NULL OR NEW.order_code = '')
  EXECUTE FUNCTION fn_generate_order_code();
