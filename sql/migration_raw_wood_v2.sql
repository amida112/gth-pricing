-- ================================================================
-- Migration: Gỗ nguyên liệu v2 + Lô hàng + Container mở rộng
-- Ngày: 2026-03-26
-- ================================================================
-- Tổng quan:
--   1. Dọn bảng cũ không dùng (raw_wood_lots, raw_wood_items, sawing_batches)
--   2. Mở rộng shipments     → Lô & Lịch hàng về
--   3. Mở rộng containers    → thêm cargo_type, giá vốn, is_standalone
--   4. Mở rộng container_items → thêm raw wood fields + inspection sawn
--   5. Tạo raw_wood_packing_list  (packing list NCC từng cây)
--   6. Tạo raw_wood_inspection    (nghiệm thu thực tế từng cây)
--   7. Tạo sawmill_batches        (theo dõi lô đưa gỗ nguyên liệu đi xẻ)
--   8. Cập nhật FK wood_bundles.sawing_batch_id → sawmill_batches
--
-- Ghi chú kiểu dữ liệu:
--   containers.id     = bigint (serial)  → FK dùng bigint
--   carriers.id       = bigint (serial)  → FK dùng bigint
--   container_items.id= bigint (serial)  → FK dùng bigint
--   Hầu hết tables còn lại              → uuid
--
-- Cách chạy: copy toàn bộ file, paste vào Supabase SQL Editor, Run.
-- ================================================================


-- ================================================================
-- PHẦN 1: DỌN BẢNG CŨ
-- Thứ tự: con trước cha; dùng CASCADE để tự dọn FK liên quan
-- ================================================================

-- 1A. raw_wood_items (con của raw_wood_lots, chưa có data)
DROP TABLE IF EXISTS raw_wood_items CASCADE;

-- 1B. raw_wood_lots (chưa có data; CASCADE dọn FK từ sawing_batches.source_lot_id)
DROP TABLE IF EXISTS raw_wood_lots CASCADE;

-- 1C. sawing_batches (cũ — CASCADE tự drop FK wood_bundles.sawing_batch_id)
--     Sẽ được thay bằng sawmill_batches ở Phần 7.
--     Sau khi DROP CASCADE: cột wood_bundles.sawing_batch_id vẫn còn nhưng không có FK.
DROP TABLE IF EXISTS sawing_batches CASCADE;

-- 1D. Dọn function cũ
-- Trigger đã bị xóa tự động bởi DROP TABLE CASCADE ở trên.
-- Function cần xóa riêng (không bị CASCADE xóa cùng table).
DROP FUNCTION IF EXISTS fn_generate_lot_code()   CASCADE;
DROP FUNCTION IF EXISTS fn_generate_batch_code() CASCADE;


-- ================================================================
-- PHẦN 2: MỞ RỘNG shipments  (Lô & Lịch hàng về)
-- ================================================================
-- Schema hiện có:
--   id uuid, shipment_code text, arrival_date date, port_name text,
--   yard_storage_deadline date, container_storage_deadline date,
--   empty_return_deadline date, carrier_name text, carrier_phone text,
--   status text, notes text, created_at timestamptz
--
-- Ánh xạ nghiệp vụ:
--   arrival_date               = ngày hàng về thực tế
--   yard_storage_deadline      = hạn lưu bãi
--   container_storage_deadline = hạn lưu cont
--   empty_return_deadline      = hạn trả cont rỗng
--   carrier_name / carrier_phone = giữ lại cho backward compat,
--                                  carrier_id mới thêm cho FK chuẩn
-- ================================================================

ALTER TABLE shipments
  -- Loại lô: gỗ xẻ NK hoặc gỗ nguyên liệu
  ADD COLUMN IF NOT EXISTS lot_type        text DEFAULT 'sawn'
    CHECK (lot_type IN ('sawn', 'raw')),

  -- NCC chính của lô (FK logic → suppliers.ncc_id)
  ADD COLUMN IF NOT EXISTS ncc_id          text,

  -- Ngày tàu dự kiến cập cảng (ETA)
  -- Phân biệt với arrival_date = ngày thực tế về
  ADD COLUMN IF NOT EXISTS eta             date,

  -- Đơn vị vận tải (FK → carriers, thay thế dần carrier_name/phone)
  -- carriers.id = bigint (serial), giống containers.id
  ADD COLUMN IF NOT EXISTS carrier_id      bigint
    REFERENCES carriers(id) ON DELETE SET NULL,

  -- Giá vốn cấp lô — chỉ admin nhập/xem
  -- Áp dụng cho tất cả container trong lô (trừ cont có override riêng)
  ADD COLUMN IF NOT EXISTS unit_cost_usd   decimal(14, 4),
  ADD COLUMN IF NOT EXISTS exchange_rate   decimal(10, 2);

COMMENT ON COLUMN shipments.lot_type
  IS 'sawn = gỗ xẻ nhập khẩu | raw = gỗ nguyên liệu (tròn/hộp)';
COMMENT ON COLUMN shipments.eta
  IS 'Estimated Time of Arrival — ngày dự kiến cập cảng';
COMMENT ON COLUMN shipments.arrival_date
  IS 'Ngày hàng về thực tế';
COMMENT ON COLUMN shipments.yard_storage_deadline
  IS 'Hạn lưu bãi (free demurrage)';
COMMENT ON COLUMN shipments.container_storage_deadline
  IS 'Hạn lưu cont';
COMMENT ON COLUMN shipments.unit_cost_usd
  IS 'Giá vốn USD/m³ cấp lô — admin only. Container có thể override.';

CREATE INDEX IF NOT EXISTS idx_shipments_lot_type  ON shipments(lot_type);
CREATE INDEX IF NOT EXISTS idx_shipments_ncc       ON shipments(ncc_id);
CREATE INDEX IF NOT EXISTS idx_shipments_carrier   ON shipments(carrier_id);


-- ================================================================
-- PHẦN 3: MỞ RỘNG containers
-- ================================================================
-- Schema hiện có:
--   id bigint (serial), container_code text, ncc_id text,
--   arrival_date date, total_volume decimal, status text,
--   notes text, shipment_id uuid → shipments(id)
--
-- Giữ nguyên: ncc_id (dùng cho is_standalone=true),
--             shipment_id (1 container thuộc 1 lô — đã có)
-- ================================================================

ALTER TABLE containers
  -- Loại hàng trong container
  ADD COLUMN IF NOT EXISTS cargo_type      text DEFAULT 'sawn'
    CHECK (cargo_type IN ('sawn', 'raw_round', 'raw_box')),

  -- Giá vốn override (nếu hợp đồng chia riêng từng cont trong lô)
  -- NULL = dùng giá của shipments.unit_cost_usd
  ADD COLUMN IF NOT EXISTS unit_cost_usd   decimal(14, 4),
  ADD COLUMN IF NOT EXISTS exchange_rate   decimal(10, 2),

  -- Hàng lẻ không theo lô/lịch hàng về
  -- true  = container lẻ, shipment_id có thể NULL
  -- false = thuộc lô (shipment_id bắt buộc)
  ADD COLUMN IF NOT EXISTS is_standalone   boolean DEFAULT false;

COMMENT ON COLUMN containers.cargo_type
  IS 'sawn=gỗ xẻ NK | raw_round=gỗ tròn | raw_box=gỗ hộp';
COMMENT ON COLUMN containers.ncc_id
  IS 'NCC của container lẻ (is_standalone=true). Cont theo lô dùng shipments.ncc_id.';
COMMENT ON COLUMN containers.unit_cost_usd
  IS 'Override giá vốn từ lô — admin only. NULL = kế thừa từ shipments.unit_cost_usd.';
COMMENT ON COLUMN containers.is_standalone
  IS 'true = hàng lẻ không theo lô & lịch hàng về';

CREATE INDEX IF NOT EXISTS idx_containers_cargo_type  ON containers(cargo_type);
CREATE INDEX IF NOT EXISTS idx_containers_standalone  ON containers(is_standalone)
  WHERE is_standalone = true;


-- ================================================================
-- PHẦN 4: MỞ RỘNG container_items
-- ================================================================
-- Schema hiện có:
--   id uuid, container_id bigint → containers(id),
--   wood_id text, thickness text, quality text,
--   volume decimal, notes text
--
-- wood_id: tiếp tục dùng cho item_type='sawn' (FK logic → wood_types.id)
-- Thêm raw_wood_type_id cho item_type='raw_round'|'raw_box'
-- Thêm piece_count (số cây/hộp/kiện khai báo theo NCC)
-- Thêm inspection fields cho sawn wood (nghiệm thu tại cấp nhóm)
-- ================================================================

ALTER TABLE container_items
  -- Loại hàng (sync với containers.cargo_type, cho phép khác nhau giữa các dòng)
  ADD COLUMN IF NOT EXISTS item_type              text DEFAULT 'sawn'
    CHECK (item_type IN ('sawn', 'raw_round', 'raw_box')),

  -- FK raw_wood_types — dùng khi item_type = 'raw_round' | 'raw_box'
  ADD COLUMN IF NOT EXISTS raw_wood_type_id       uuid
    REFERENCES raw_wood_types(id) ON DELETE SET NULL,

  -- Số lượng khai báo (cây/hộp cho raw; kiện/bó cho sawn)
  ADD COLUMN IF NOT EXISTS piece_count            integer,

  -- === Inspection cho Gỗ xẻ (sawn) ===
  -- Gỗ tròn/hộp dùng raw_wood_inspection (bảng riêng, chi tiết từng cây)
  -- Gỗ xẻ kiểm đếm tại cấp nhóm (cùng loại gỗ + dày + CL = 1 dòng)
  ADD COLUMN IF NOT EXISTS actual_volume          decimal(10, 4),
  ADD COLUMN IF NOT EXISTS actual_piece_count     integer,
  ADD COLUMN IF NOT EXISTS shortage_count         integer     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS damaged_count          integer     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inspection_status      text        DEFAULT 'pending'
    CHECK (inspection_status IN ('pending', 'done')),
  ADD COLUMN IF NOT EXISTS inspection_date        date,
  ADD COLUMN IF NOT EXISTS inspector              text;

COMMENT ON COLUMN container_items.item_type
  IS 'Loại hàng; thường sync với containers.cargo_type';
COMMENT ON COLUMN container_items.wood_id
  IS 'FK logic → wood_types.id | dùng khi item_type=sawn';
COMMENT ON COLUMN container_items.raw_wood_type_id
  IS 'FK → raw_wood_types.id | dùng khi item_type=raw_round|raw_box';
COMMENT ON COLUMN container_items.piece_count
  IS 'Số lượng khai báo theo NCC (cây / hộp / kiện)';
COMMENT ON COLUMN container_items.actual_piece_count
  IS 'Số thực đếm sau nghiệm thu (chỉ sawn; raw dùng bảng raw_wood_inspection)';
COMMENT ON COLUMN container_items.inspection_status
  IS 'pending=chưa nghiệm thu | done=đã hoàn thành';

CREATE INDEX IF NOT EXISTS idx_ci_item_type      ON container_items(item_type);
CREATE INDEX IF NOT EXISTS idx_ci_raw_wood_type  ON container_items(raw_wood_type_id);


-- ================================================================
-- PHẦN 5: raw_wood_packing_list  (Packing list NCC — từng cây/hộp)
-- ================================================================
-- Mỗi row = 1 cây (raw_round) hoặc 1 hộp (raw_box) theo danh sách NCC.
-- container_id nullable → cho phép hàng lẻ không qua container.
-- container_item_id nullable → có cont không có packing list chi tiết.
-- Không có trạng thái — đây là "nguồn gốc", trạng thái nằm ở inspection.
-- ================================================================

CREATE TABLE IF NOT EXISTS raw_wood_packing_list (
  id                  uuid       PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Thuộc container nào (nullable = hàng lẻ không qua cont)
  container_id        bigint     REFERENCES containers(id)      ON DELETE CASCADE,

  -- Thuộc nhóm hàng hóa nào trong manifest (nullable)
  container_item_id   bigint     REFERENCES container_items(id) ON DELETE SET NULL,

  -- Mã cây/hộp theo NCC (nullable — có NCC không cung cấp mã)
  piece_code          text,

  -- === Gỗ tròn ===
  length_m            decimal(8,  3),   -- chiều dài (m)
  diameter_cm         decimal(6,  2),   -- đường kính (cm)
  circumference_cm    decimal(6,  2),   -- chu vi (cm) — thay thế diameter nếu đo vanh

  -- === Gỗ hộp ===
  width_cm            decimal(6,  2),   -- rộng (cm)
  thickness_cm        decimal(6,  2),   -- dày (cm)

  -- === Chung ===
  volume_m3           decimal(10, 5),   -- thể tích (m³), tính từ kích thước hoặc NCC cung cấp
  quality             text,

  sort_order          integer     DEFAULT 0,  -- giữ thứ tự gốc sau import
  notes               text,
  created_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rwpl_container       ON raw_wood_packing_list(container_id);
CREATE INDEX IF NOT EXISTS idx_rwpl_container_item  ON raw_wood_packing_list(container_item_id);

ALTER TABLE raw_wood_packing_list ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rwpl_all" ON raw_wood_packing_list
  FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE raw_wood_packing_list
  IS 'Packing list NCC — danh sách từng cây/hộp theo khai báo của nhà cung cấp';
COMMENT ON COLUMN raw_wood_packing_list.container_id
  IS 'NULL = hàng lẻ không qua container';
COMMENT ON COLUMN raw_wood_packing_list.piece_code
  IS 'Mã cây theo NCC — nullable (có NCC không đánh mã)';


-- ================================================================
-- PHẦN 6: raw_wood_inspection  (Nghiệm thu thực tế — từng cây/hộp)
-- ================================================================
-- Mỗi row = 1 cây/hộp đã kiểm đếm thực tế.
-- Liên kết với packing_list_id để so sánh NCC vs. thực tế.
-- Một số cây NCC không có trong list thực (is_missing=true trên packing_list).
-- Một số cây thực tế không có trong list NCC (packing_list_id NULL).
-- ================================================================

CREATE TABLE IF NOT EXISTS raw_wood_inspection (
  id                  uuid       PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Thuộc container nào (nullable = hàng lẻ)
  container_id        bigint     REFERENCES containers(id)           ON DELETE CASCADE,

  -- Nhóm hàng trong manifest
  container_item_id   bigint     REFERENCES container_items(id)      ON DELETE SET NULL,

  -- Cây tương ứng trong packing list NCC (nullable — cây không có trong list NCC)
  packing_list_id     uuid       REFERENCES raw_wood_packing_list(id) ON DELETE SET NULL,

  -- Mã cây (kế thừa từ NCC hoặc tự đặt khi nghiệm thu)
  piece_code          text,

  -- === Gỗ tròn ===
  length_m            decimal(8,  3),
  diameter_cm         decimal(6,  2),
  circumference_cm    decimal(6,  2),

  -- === Gỗ hộp ===
  width_cm            decimal(6,  2),
  thickness_cm        decimal(6,  2),

  -- === Chung ===
  volume_m3           decimal(10, 5),
  quality             text,

  -- === Cờ nghiệm thu ===
  -- Cây có trong list NCC nhưng thực tế không nhận được
  is_missing          boolean     DEFAULT false,
  -- Cây nhận được nhưng bị hư hỏng (vẫn có kích thước thực đo)
  is_damaged          boolean     DEFAULT false,
  -- Hàng lẻ không qua container (D1)
  is_standalone       boolean     DEFAULT false,

  -- === Trạng thái & liên kết ===
  status              text        DEFAULT 'available'
    CHECK (status IN ('available', 'sold', 'sawn')),

  -- Gắn khi đưa vào xẻ (FK deferred → sawmill_batches, thêm ở Phần 7)
  sawmill_batch_id    uuid,

  -- Gắn khi bán (FK logic → orders.id)
  sale_order_id       uuid,

  -- === Meta ===
  sort_order          integer     DEFAULT 0,
  notes               text,
  inspection_date     date,
  inspector           text,
  created_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rwi_container       ON raw_wood_inspection(container_id);
CREATE INDEX IF NOT EXISTS idx_rwi_status          ON raw_wood_inspection(status);
CREATE INDEX IF NOT EXISTS idx_rwi_packing_list    ON raw_wood_inspection(packing_list_id);
CREATE INDEX IF NOT EXISTS idx_rwi_sawmill_batch   ON raw_wood_inspection(sawmill_batch_id);
CREATE INDEX IF NOT EXISTS idx_rwi_sale_order      ON raw_wood_inspection(sale_order_id);
CREATE INDEX IF NOT EXISTS idx_rwi_standalone      ON raw_wood_inspection(is_standalone)
  WHERE is_standalone = true;

ALTER TABLE raw_wood_inspection ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rwi_all" ON raw_wood_inspection
  FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE raw_wood_inspection
  IS 'Nghiệm thu thực tế — danh sách từng cây/hộp đã kiểm đếm, đối chiếu với packing list NCC';
COMMENT ON COLUMN raw_wood_inspection.is_missing
  IS 'true = cây có trong packing list NCC nhưng thực tế không nhận được';
COMMENT ON COLUMN raw_wood_inspection.is_damaged
  IS 'true = cây nhận được nhưng hư hỏng';
COMMENT ON COLUMN raw_wood_inspection.is_standalone
  IS 'true = hàng lẻ không thuộc container (D1)';
COMMENT ON COLUMN raw_wood_inspection.status
  IS 'available=còn trong kho | sold=đã bán | sawn=đã đưa đi xẻ';


-- ================================================================
-- PHẦN 7: sawmill_batches  (Lô gỗ nguyên liệu đưa đi xẻ)
-- ================================================================
-- Thay thế sawing_batches cũ (đã DROP ở Phần 1).
-- Mục đích: ghi nhận theo tháng số lượng cây/khối gỗ đưa vào xẻ.
-- Bộ phận xẻ chọn các cây → tạo batch → raw_wood_inspection.status → 'sawn'.
-- Không theo dõi output (output do PgKiln quản lý).
-- ================================================================

CREATE TABLE IF NOT EXISTS sawmill_batches (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_code    text        NOT NULL,     -- Auto: XS-YYYYMMDD-NNN
  sent_date     date        NOT NULL DEFAULT CURRENT_DATE,
  piece_count   integer     DEFAULT 0,   -- tổng số cây đưa vào xẻ
  volume_m3     decimal(12, 4) DEFAULT 0,-- tổng m³
  notes         text,
  created_by    text,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_smb_sent_date ON sawmill_batches(sent_date);

ALTER TABLE sawmill_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "smb_all" ON sawmill_batches
  FOR ALL USING (true) WITH CHECK (true);

-- Auto-generate batch_code: XS-YYYYMMDD-NNN
-- Giữ prefix XS (Xẻ Sấy) giống format cũ
CREATE OR REPLACE FUNCTION fn_generate_sawmill_batch_code()
RETURNS TRIGGER AS $$
DECLARE
  date_str text;
  next_num integer;
BEGIN
  date_str := TO_CHAR(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYYMMDD');
  SELECT COALESCE(MAX(CAST(SPLIT_PART(batch_code, '-', 3) AS INTEGER)), 0) + 1
    INTO next_num
    FROM sawmill_batches
    WHERE batch_code LIKE 'XS-' || date_str || '-%';
  NEW.batch_code := 'XS-' || date_str || '-' || LPAD(next_num::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sawmill_batch_code ON sawmill_batches;
CREATE TRIGGER trg_sawmill_batch_code
  BEFORE INSERT ON sawmill_batches
  FOR EACH ROW WHEN (NEW.batch_code IS NULL OR NEW.batch_code = '')
  EXECUTE FUNCTION fn_generate_sawmill_batch_code();

COMMENT ON TABLE sawmill_batches
  IS 'Lô gỗ nguyên liệu đưa đi xẻ — ghi nhận theo tháng. Thay thế sawing_batches cũ.';

-- Thêm FK deferred từ raw_wood_inspection → sawmill_batches
-- (raw_wood_inspection tạo trước sawmill_batches nên dùng ADD CONSTRAINT)
ALTER TABLE raw_wood_inspection
  ADD CONSTRAINT fk_rwi_sawmill_batch
    FOREIGN KEY (sawmill_batch_id)
    REFERENCES sawmill_batches(id)
    ON DELETE SET NULL;


-- ================================================================
-- PHẦN 8: CẬP NHẬT wood_bundles.sawing_batch_id
-- ================================================================
-- sawing_batches đã DROP ở Phần 1 (CASCADE tự xóa FK constraint).
-- Cột sawing_batch_id vẫn còn trên wood_bundles nhưng không có FK.
-- Tái thiết lập FK trỏ sang sawmill_batches mới.
-- ================================================================

-- Xóa constraint cũ nếu còn sót (DROP CASCADE đôi khi giữ lại tên constraint)
ALTER TABLE wood_bundles
  DROP CONSTRAINT IF EXISTS wood_bundles_sawing_batch_id_fkey;

-- Tái thiết lập FK
ALTER TABLE wood_bundles
  ADD CONSTRAINT wood_bundles_sawing_batch_id_fkey
    FOREIGN KEY (sawing_batch_id)
    REFERENCES sawmill_batches(id)
    ON DELETE SET NULL;

COMMENT ON COLUMN wood_bundles.sawing_batch_id
  IS 'FK → sawmill_batches.id | Lô gỗ nguyên liệu đã xẻ ra kiện này (nếu biết nguồn gốc)';


-- ================================================================
-- KIỂM TRA NHANH (chạy tự động, không thay đổi data)
-- Kết quả trả về số cột mới — nếu = 0 là đã tồn tại, không phải lỗi
-- ================================================================

SELECT
  'shipments'       AS tbl,
  COUNT(*)          AS new_cols
FROM information_schema.columns
WHERE table_name = 'shipments'
  AND column_name IN ('lot_type','ncc_id','eta','carrier_id','unit_cost_usd','exchange_rate')

UNION ALL

SELECT
  'containers'      AS tbl,
  COUNT(*)          AS new_cols
FROM information_schema.columns
WHERE table_name = 'containers'
  AND column_name IN ('cargo_type','unit_cost_usd','exchange_rate','is_standalone')

UNION ALL

SELECT
  'container_items' AS tbl,
  COUNT(*)          AS new_cols
FROM information_schema.columns
WHERE table_name = 'container_items'
  AND column_name IN ('item_type','raw_wood_type_id','piece_count',
                      'actual_volume','actual_piece_count','shortage_count',
                      'damaged_count','inspection_status','inspection_date','inspector')

UNION ALL

SELECT 'raw_wood_packing_list' AS tbl, COUNT(*) AS new_cols
FROM information_schema.tables
WHERE table_name = 'raw_wood_packing_list'

UNION ALL

SELECT 'raw_wood_inspection'   AS tbl, COUNT(*) AS new_cols
FROM information_schema.tables
WHERE table_name = 'raw_wood_inspection'

UNION ALL

SELECT 'sawmill_batches'       AS tbl, COUNT(*) AS new_cols
FROM information_schema.tables
WHERE table_name = 'sawmill_batches';

-- ================================================================
-- KẾT THÚC MIGRATION
-- ================================================================
