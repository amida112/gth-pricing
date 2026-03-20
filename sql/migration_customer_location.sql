-- ================================================================
-- Migration: Bổ sung trường địa chỉ chi tiết và tọa độ xưởng khách
-- + phòng ban, chức vụ trong công ty
-- An toàn khi chạy lại nhiều lần (idempotent)
-- Chạy trong Supabase SQL Editor
-- ================================================================

-- 1. Địa chỉ chi tiết
ALTER TABLE customers ADD COLUMN IF NOT EXISTS commune       TEXT;   -- xã/phường/thị trấn
ALTER TABLE customers ADD COLUMN IF NOT EXISTS street_address TEXT;  -- số nhà, đường

-- 2. Tọa độ xưởng khách hàng (để vẽ bản đồ phân bố)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS workshop_lat  DOUBLE PRECISION;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS workshop_lng  DOUBLE PRECISION;

-- 3. Thông tin công ty chi tiết
ALTER TABLE customers ADD COLUMN IF NOT EXISTS department    TEXT;   -- phòng ban
ALTER TABLE customers ADD COLUMN IF NOT EXISTS position      TEXT;   -- chức vụ

-- 4. Index tọa độ (hữu ích khi query theo vùng địa lý)
CREATE INDEX IF NOT EXISTS idx_customers_province ON customers(address);
CREATE INDEX IF NOT EXISTS idx_customers_coords   ON customers(workshop_lat, workshop_lng)
  WHERE workshop_lat IS NOT NULL AND workshop_lng IS NOT NULL;
