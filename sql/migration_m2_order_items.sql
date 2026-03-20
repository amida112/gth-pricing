-- Migration: Thêm list_price2 vào order_items (giá nguyên kiện cho m2 wood)
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS list_price2 DECIMAL(16, 2) DEFAULT NULL;
