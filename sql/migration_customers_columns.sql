-- ================================================================
-- Migration: Bổ sung các cột còn thiếu trong bảng customers
-- An toàn khi chạy lại nhiều lần (idempotent)
-- Chạy trong Supabase SQL Editor
-- ================================================================

-- Thông tin cá nhân
ALTER TABLE customers ADD COLUMN IF NOT EXISTS salutation        TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS dob               DATE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone2            TEXT;

-- Thông tin công ty
ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_name      TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS department        TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS position          TEXT;

-- Địa chỉ
ALTER TABLE customers ADD COLUMN IF NOT EXISTS delivery_address  TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS commune           TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS street_address    TEXT;

-- Tọa độ xưởng
ALTER TABLE customers ADD COLUMN IF NOT EXISTS workshop_lat      DOUBLE PRECISION;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS workshop_lng      DOUBLE PRECISION;

-- Thương mại
ALTER TABLE customers ADD COLUMN IF NOT EXISTS interested_wood_types  TEXT[]  NOT NULL DEFAULT '{}';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS product_description    TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS debt_limit             NUMERIC(15,0) NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS debt_days              INTEGER NOT NULL DEFAULT 30;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes                  TEXT;

-- Index tọa độ
CREATE INDEX IF NOT EXISTS idx_customers_province ON customers(address);
CREATE INDEX IF NOT EXISTS idx_customers_coords ON customers(workshop_lat, workshop_lng)
  WHERE workshop_lat IS NOT NULL AND workshop_lng IS NOT NULL;
