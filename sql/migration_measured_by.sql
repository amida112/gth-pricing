-- Migration: Thêm cột measured_by vào wood_bundles
-- Mục đích: Lưu danh sách người đo kiện gỗ (tối đa 2 người)
-- Chạy trên staging: tscddgjkelnmlitzcxyg

ALTER TABLE wood_bundles ADD COLUMN IF NOT EXISTS measured_by TEXT[] DEFAULT '{}';

COMMENT ON COLUMN wood_bundles.measured_by IS 'Danh sách tên người đo kiện (tối đa 2), lấy từ nhân viên bộ phận xếp hàng';
