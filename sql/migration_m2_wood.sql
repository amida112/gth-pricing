-- Migration: Thêm hỗ trợ loại gỗ đơn vị m² (Thông ốp)
-- Chạy trong Supabase SQL Editor

-- 1. Thêm cột unit vào wood_types (m3 = mặc định, m2 = gỗ ốp như Thông ốp)
ALTER TABLE wood_types ADD COLUMN IF NOT EXISTS unit VARCHAR(3) DEFAULT 'm3';

-- 2. Thêm cột price2 vào prices (giá thứ 2 dành cho m2 wood: giá nguyên kiện)
-- price  = giá lẻ kiện (cao hơn)
-- price2 = giá nguyên kiện (thấp hơn, tự động chọn khi bán nguyên kiện)
ALTER TABLE prices ADD COLUMN IF NOT EXISTS price2 DECIMAL(12, 4) DEFAULT NULL;
