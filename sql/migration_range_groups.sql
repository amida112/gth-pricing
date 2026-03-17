-- ================================================================
-- Migration: Hỗ trợ nhóm khoảng (rangeGroups) cho thuộc tính
--            và lưu giá trị đo lường thực tế của kiện gỗ
--
-- Chạy script này trên Supabase SQL Editor một lần duy nhất.
-- ================================================================


-- ── 1. Bảng attributes ──────────────────────────────────────────

ALTER TABLE attributes
  ADD COLUMN IF NOT EXISTS range_groups JSONB DEFAULT NULL;

COMMENT ON COLUMN attributes.range_groups IS
  'Định nghĩa nhóm khoảng giá trị cho thuộc tính dạng phạm vi (ví dụ: chiều dài gỗ). '
  'Là mảng JSON gồm các object {label, min?, max?}, trong đó label phải trùng với một '
  'phần tử trong cột values (để dùng làm key bảng giá). '
  'Ví dụ: [{"label":"*-1.9m","max":1.9}, {"label":"*-2.5m","min":1.9,"max":2.5}, {"label":"2.8-*m","min":2.8}]. '
  'NULL = thuộc tính thông thường, không dùng nhóm khoảng.';


-- ── 2. Bảng wood_bundles ────────────────────────────────────────

ALTER TABLE wood_bundles
  ADD COLUMN IF NOT EXISTS raw_measurements JSONB DEFAULT NULL;

COMMENT ON COLUMN wood_bundles.raw_measurements IS
  'Giá trị đo lường thực tế của kiện gỗ, lưu riêng để hiển thị và báo cáo. '
  'Cấu trúc: {"<attr_id>": "<raw_value>", ...}. '
  'Ví dụ: {"length": "2.2-2.7"} — kiện có chiều dài thực 2.2–2.7m, '
  'nhưng được xếp vào nhóm giá "*-2.5m" trong cột attributes. '
  'NULL = không có giá trị đo riêng, hoặc giá trị đo khớp chính xác với nhãn nhóm.';


ALTER TABLE wood_bundles
  ADD COLUMN IF NOT EXISTS manual_group_assignment BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN wood_bundles.manual_group_assignment IS
  'TRUE nếu người dùng gán thủ công nhóm giá cho ít nhất một thuộc tính dạng khoảng, '
  'vì giá trị đo thực tế không tự động khớp với bất kỳ nhóm nào trong rangeGroups '
  '(ví dụ: chiều dài 1.6–2.6m không nằm trọn trong một nhóm). '
  'Dùng để lọc và kiểm tra lại phân loại chiều dài của các kiện cần review.';
