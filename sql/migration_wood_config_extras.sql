-- ================================================================
-- Migration: Lưu rangeGroups và attrPriceGroups per-wood vào wood_config
--
-- Thay đổi thiết kế: rangeGroups chuyển từ attributes sang wood_config
-- (mỗi loại gỗ có cấu hình nhóm khoảng riêng).
-- attrPriceGroups (nhóm giá NCC) cũng lưu per-wood per-attr.
--
-- Chạy script này trên Supabase SQL Editor một lần duy nhất.
-- ================================================================

ALTER TABLE wood_config
  ADD COLUMN IF NOT EXISTS range_groups JSONB DEFAULT NULL;

COMMENT ON COLUMN wood_config.range_groups IS
  'Định nghĩa nhóm khoảng đo lường cho thuộc tính này, theo loại gỗ cụ thể. '
  'Ví dụ: [{"label":"1.6-1.9m","min":1.6,"max":1.9}, ...]. '
  'NULL = thuộc tính không dùng nhóm khoảng.';

ALTER TABLE wood_config
  ADD COLUMN IF NOT EXISTS price_group_config JSONB DEFAULT NULL;

COMMENT ON COLUMN wood_config.price_group_config IS
  'Cấu hình nhóm giá cho thuộc tính này (attrPriceGroups). '
  'Ví dụ: {"default":"Chung","special":["Missouri","ATLC"]}. '
  'NULL = không gộp nhóm giá, mỗi giá trị là một hàng/cột riêng.';
