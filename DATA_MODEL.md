# DATA_MODEL.md — Cấu trúc dữ liệu GTH Pricing

Tài liệu mô tả **database schema**, **quan hệ giữa các bảng**, và **luồng dữ liệu** trong hệ thống.
Backend: **Supabase** (PostgreSQL) qua `@supabase/supabase-js`.

---

## 1. Danh sách bảng

### Nhóm: Sản phẩm & Cấu hình

| Bảng | Mô tả | Ghi chú |
|------|-------|---------|
| `wood_types` | Loại gỗ cứng (sồi, óc chó...) | Master data |
| `attributes` | Thuộc tính gỗ (thickness, quality...) | Master data |
| `wood_config` | Cấu hình bảng giá per-wood | JSONB phức tạp |
| `prices` | Bảng giá theo SKU key | Composite key: wood_id + sku_key |
| `change_log` | Lịch sử thay đổi giá | Audit trail |
| `product_catalog` | Danh mục sản phẩm cuối | Phân loại khách hàng |
| `preference_catalog` | Danh mục sở thích khách | Phân loại khách hàng |

### Nhóm: Kho & Kiện gỗ

| Bảng | Mô tả | Ghi chú |
|------|-------|---------|
| `wood_bundles` | Kiện gỗ thành phẩm | Bảng chính, nhiều JSONB |
| `unsorted_bundles` | Gỗ chưa xếp loại | Trước khi thành kiện |
| `packing_sessions` | Phiên xếp loại | Nhóm unsorted → bundle |
| `packing_leftovers` | Phế liệu xếp loại | Tracking waste |

### Nhóm: Nhập hàng

| Bảng | Mô tả | Ghi chú |
|------|-------|---------|
| `suppliers` | Nhà cung cấp | `configurable` flag |
| `supplier_wood_assignments` | NCC ↔ loại gỗ | N:N mapping |
| `shipments` | Lô hàng / chuyến tàu | Chứa nhiều container |
| `carriers` | Đơn vị vận tải | Dùng cho shipment |
| `containers` | Container nhập hàng | FK → shipment, supplier |
| `container_items` | Items trong container | FK → container |

### Nhóm: Gỗ nguyên liệu

| Bảng | Mô tả | Ghi chú |
|------|-------|---------|
| `raw_wood_types` | Loại gỗ nguyên liệu | Gỗ tròn/hộp |
| `raw_wood_formulas` | Công thức tính thể tích | Quy đổi đường kính + dài → m³ |
| `raw_wood_packing_list` | Packing list NCC | Khai báo nhà cung cấp, import CSV |
| `raw_wood_inspection` | Nghiệm thu thực tế | Kiểm đếm, đối chiếu packing list |
| `raw_wood_withdrawals` | Xuất kho gỗ NL | Loại: sale / sawing |
| `raw_wood_price_config` | Cấu hình giá gỗ NL | Theo loại + quy cách |
| `raw_wood_pricing` | Bảng giá gỗ NL | Quy tắc định giá |

### Nhóm: Sản xuất

| Bảng | Mô tả | Ghi chú |
|------|-------|---------|
| `sawing_batches` | Mẻ xẻ gỗ | Input: gỗ tròn/hộp |
| `sawing_items` | Chi tiết mẻ xẻ | Output: tấm gỗ xẻ |
| `sawing_daily_logs` | Log xẻ hàng ngày | Tracking |
| `sawing_round_inputs` | Đầu vào xẻ gỗ tròn | Tracking |
| `sawn_inspections` | Nghiệm thu gỗ xẻ | Container sawn → kiểm tra trước nhập kho |
| `kiln_batches` | Mẻ sấy | Input: gỗ xẻ tươi |
| `kiln_items` | Gỗ trong mẻ sấy | Volume tracking |
| `kiln_edit_log` | Lịch sử chỉnh sửa lò | Audit |
| `wood_conversion_rates` | Quy đổi kg ↔ m³ | Per wood type |
| `edging_batches` | Mẻ dong cạnh | Input: kiện gỗ |
| `edging_batch_inputs` | Kiện đầu vào dong cạnh | FK → edging_batches |
| `edging_leftovers` | Phế liệu dong cạnh | Tracking waste |
| `bundle_measurements` | Đo lường kiện (board detail) | Kích thước từng tấm |
| `measure_devices` | Thiết bị đo | Quản lý máy đo |
| `inventory_adjustments` | Điều chỉnh tồn kho | Yêu cầu → duyệt |

### Nhóm: Bán hàng

| Bảng | Mô tả | Ghi chú |
|------|-------|---------|
| `customers` | Khách hàng | CRM cơ bản |
| `orders` | Đơn hàng | Header |
| `order_items` | Dòng sản phẩm trong đơn | FK → bundle |
| `order_services` | Dịch vụ trong đơn | Xẻ sấy, vận chuyển... |
| `payment_records` | Ghi chép thanh toán | Multi-payment |

### Nhóm: Đối soát thanh toán

| Bảng | Mô tả | Ghi chú |
|------|-------|---------|
| `bank_accounts` | Tài khoản ngân hàng công ty | BIN cho VietQR |
| `bank_transactions` | Giao dịch từ Sepay webhook | reference_code UNIQUE |
| `customer_credits` | Ghi có cho khách (dư tiền / hủy đơn) | Overpaid handling |

### Nhóm: Nhân sự & Lương

| Bảng | Mô tả | Ghi chú |
|------|-------|---------|
| `departments` | Phòng ban | Master data |
| `employees` | Nhân viên | Mã NV, thông tin cá nhân, lương |
| `allowance_types` | Loại phụ cấp | Master data |
| `employee_allowances` | Phụ cấp nhân viên | FK → employees, allowance_types |
| `employee_change_log` | Lịch sử thay đổi NV | Audit trail |
| `work_shifts` | Ca làm việc | Sáng/chiều/tối |
| `attendance` | Chấm công | Theo ngày, theo ca |
| `payroll_settings` | Cấu hình lương | Công chuẩn, hệ số |
| `bhxh_monthly` | BHXH hàng tháng | Theo dõi đóng BHXH |
| `salary_advances` | Tạm ứng lương | Trừ khi tính lương |
| `payroll` | Bảng lương | Header: tháng, trạng thái |
| `payroll_details` | Chi tiết lương | Từng NV trong bảng lương |
| `extra_work_types` | Loại công thêm | Master data |
| `extra_work_records` | Ghi nhận công thêm | Ngày, giờ, đơn giá |
| `employee_extra_work_assignments` | Phân công công thêm | NV ↔ loại công |
| `monthly_ot` | Tổng hợp OT tháng | Cho tính lương |
| `production_campaigns` | Đợt phép / campaign | Khoảng thời gian (VD: Tết) |
| `leave_requests` | Đơn nghỉ phép | FK → production_campaigns |

### Nhóm: Hoa hồng

| Bảng | Mô tả | Ghi chú |
|------|-------|---------|
| `commission_wood_rates` | Tỷ lệ HH theo loại gỗ | % per wood type |
| `commission_sku_overrides` | Override HH theo SKU | Tỷ lệ riêng cho SKU cụ thể |
| `commission_container_tiers` | Bậc thang HH container | Chênh lệch đ/m³ |
| `commission_settings` | Cấu hình HH chung | Settings |

### Nhóm: Hệ thống

| Bảng | Mô tả | Ghi chú |
|------|-------|---------|
| `users` | Tài khoản người dùng (động) | Bổ sung cho hardcoded |
| `permission_groups` | Nhóm quyền | Tên nhóm |
| `group_permissions` | Permission keys | FK → permission_groups |
| `audit_logs` | Nhật ký hệ thống | Module, action, user, timestamp |
| `credit_refunds` | Yêu cầu hoàn tiền | FK → customer_credits |
| `app_settings` | Cấu hình ứng dụng | Key-value JSONB |
| `settings` | Cấu hình (legacy) | Tương tự app_settings |

---

## 2. Chi tiết schema các bảng chính

### 2.1 `wood_types`

| Column | Type | Mô tả |
|--------|------|-------|
| `id` | text PK | ID loại gỗ (VD: "walnut") |
| `name` | text | Tên tiếng Việt |
| `name_en` | text | Tên tiếng Anh |
| `icon` | text | Emoji icon |
| `code` | text | Mã ngắn cho SKU (VD: "OC") |
| `desc` | text | Mô tả |
| `unit` | text | 'm3' hoặc 'm2' |
| `thickness_mode` | text | 'fixed' hoặc 'auto' |
| `pricing_mode` | text | null (default) hoặc 'perBundle' |
| `sort_order` | int | Thứ tự hiển thị |

### 2.2 `attributes`

| Column | Type | Mô tả |
|--------|------|-------|
| `id` | text PK | ID thuộc tính (VD: "thickness") |
| `name` | text | Tên hiển thị (VD: "Độ dày") |
| `groupable` | bool | Tự động sort theo số? |
| `values` | jsonb | Danh sách giá trị mặc định (template) |

### 2.3 `wood_config`

| Column | Type | Mô tả |
|--------|------|-------|
| `wood_id` | text PK | FK → wood_types |
| `config` | jsonb | Object cấu hình (xem BUSINESS.md mục 9.1) |

**Cấu trúc `config` JSONB:**
```jsonc
{
  "attrs": ["thickness", "quality", "supplier"],
  "attrValues": {
    "thickness": ["2F", "2.2F", "3F"],
    "quality": ["Fas", "1COM"]
  },
  "rangeGroups": {
    "length": [{ "label": "1.6-1.9m", "min": 1.3, "max": 1.9 }]
  },
  "attrPriceGroups": {
    "supplier": { "default": "Chung", "special": ["Missouri"] }
  },
  "attrAliases": {
    "quality": { "AB": ["A", "B"] }
  },
  "defaultHeader": ["quality"]
}
```

### 2.4 `prices`

| Column | Type | Mô tả |
|--------|------|-------|
| `wood_id` | text | FK → wood_types |
| `sku_key` | text | Composite key (output bpk, KHÔNG chứa woodId) |
| `price` | numeric | Giá bán (tr/m³ hoặc k/m²) |
| `price2` | numeric | Giá nguyên kiện (chỉ m² wood) |
| `cost_price` | numeric | Giá gốc (chỉ admin thấy) |
| `updated_date` | text | Ngày cập nhật |
| `updated_by` | text | Người cập nhật |

**PK**: `(wood_id, sku_key)`

**Lưu ý**: `sku_key` trong bảng prices KHÔNG chứa woodId prefix, chỉ chứa phần attrs.
Nhưng trong JS `prices` map, key là `woodId||sku_key` (bao gồm woodId).

### 2.5 `wood_bundles` — Bảng quan trọng nhất

| Column | Type | Default | Mô tả |
|--------|------|---------|-------|
| `id` | uuid PK | auto | |
| `bundle_code` | text UNIQUE | | Mã kiện (PREFIX-YYYYMMDD-NNN) |
| `wood_id` | text | | FK → wood_types |
| `container_id` | uuid | null | FK → containers |
| `sku_key` | text | | Composite SKU key đầy đủ (woodId||attrs) |
| `attributes` | jsonb | {} | Thuộc tính vật lý `{ thickness, quality, ... }` |
| `raw_measurements` | jsonb | {} | Số đo thực `{ length: "1.82", width: "125" }` |
| `manual_group_assignment` | bool | false | Nhóm gán thủ công? |
| `board_count` | int | 0 | Số tấm ban đầu |
| `remaining_boards` | int | = board_count | Số tấm còn lại (trừ ngay khi thêm vào đơn, cho phép âm) |
| `volume` | numeric | 0 | Thể tích ban đầu (m³/m²) |
| `remaining_volume` | numeric | 0 | Thể tích còn lại (trừ ngay khi thêm vào đơn, cho phép âm) |
| `status` | text | 'Kiện nguyên' | Trạng thái: Kiện nguyên / Kiện lẻ / Đã bán |
| `notes` | text | '' | Ghi chú bán hàng |
| `supplier_bundle_code` | text | '' | Mã kiện nhà cung cấp |
| `location` | text | '' | Vị trí kho |
| `qr_code` | text | = bundle_code | QR code |
| `images` | jsonb | [] | Mảng URL ảnh kiện |
| `item_list_images` | jsonb | [] | Mảng URL ảnh chi tiết |
| `unit_price` | numeric | null | Giá riêng kiện (chỉ perBundle) |
| `price_adjustment` | jsonb | null | Điều chỉnh giá `{ type, value, reason }` |
| `price_attrs_override` | jsonb | null | Override thuộc tính tra giá `{ attrId: value }` |
| `price_override_reason` | text | null | Lý do đổi mã tra giá |
| `volume_adjustment` | numeric | null | Điều chỉnh thể tích (kiện đóng) |
| `locked_by` | text | null | User đang lock kiện |
| `locked_at` | timestamptz | null | Thời điểm lock |
| `packing_session_id` | uuid | null | FK → packing_sessions |
| `created_at` | timestamptz | now() | |

### 2.6 `customers`

| Column | Type | Mô tả |
|--------|------|-------|
| `id` | uuid PK | |
| `name` | text | Tên khách hàng |
| `nickname` | text | Biệt danh |
| `salutation` | text | Danh xưng (Anh, Chị...) |
| `dob` | date | Ngày sinh |
| `phone1`, `phone2` | text | Số điện thoại |
| `company_name` | text | Tên công ty |
| `department` | text | Phòng ban |
| `position` | text | Chức vụ |
| `address` | text | Tỉnh/thành |
| `commune` | text | Quận/huyện |
| `street_address` | text | Địa chỉ chi tiết |
| `workshop_lat`, `workshop_lng` | numeric | Tọa độ xưởng |
| `products` | jsonb | Sản phẩm quan tâm |
| `preferences` | jsonb | Sở thích mua hàng |
| `product_description` | text | Mô tả sản phẩm |
| `debt_limit` | numeric | Hạn mức công nợ (VND) |
| `debt_days` | int | Số ngày nợ tối đa |
| `notes` | text | Ghi chú |

### 2.7 `orders`

| Column | Type | Mô tả |
|--------|------|-------|
| `id` | uuid PK | |
| `order_code` | text UNIQUE | Mã đơn hàng |
| `customer_id` | uuid | FK → customers |
| `payment_status` | text | Nháp / Chờ duyệt / Chưa TT / Đã TT / Đã hủy |
| `export_status` | text | Chưa xuất / Đã xuất |
| `apply_tax` | bool | Có tính VAT? |
| `deposit` | numeric | Đặt cọc |
| `shipping_fee` | numeric | Phí vận chuyển |
| `shipping_type` | text | Loại vận chuyển |
| `notes` | text | Ghi chú đơn |
| `sale_date` | timestamptz | Ngày bán hàng thực tế (sửa được). Dùng cho aging/lịch sử/đối chiếu. Mặc định now(). Xem BUSINESS.md 4.6c |
| `created_at` | timestamptz | Ngày dòng dữ liệu được tạo (audit, không sửa). Dùng sinh order_code |
| `created_by` | text | Người tạo |
| `cancelled_at` | timestamptz | |
| `cancelled_by` | text | |
| `cancel_reason` | text | |

### 2.8 `order_items`

| Column | Type | Mô tả |
|--------|------|-------|
| `id` | uuid PK | |
| `order_id` | uuid | FK → orders |
| `bundle_id` | uuid | FK → wood_bundles |
| `bundle_code` | text | Mã kiện (snapshot) |
| `supplier_bundle_code` | text | Mã NCC (snapshot) |
| `wood_id` | text | FK → wood_types |
| `sku_key` | text | SKU key (snapshot) |
| `attributes` | jsonb | Thuộc tính (snapshot) |
| `raw_measurements` | jsonb | Số đo thực (snapshot) |
| `board_count` | int | Số tấm bán |
| `volume` | numeric | Khối lượng bán |
| `unit` | text | 'm3' hoặc 'm2' |
| `unit_price` | numeric | Đơn giá (micro-units) |
| `list_price` | numeric | Giá bảng chuẩn (so sánh) |
| `list_price2` | numeric | Giá nguyên kiện (m² wood) |
| `amount` | numeric | Thành tiền |
| `notes` | text | Ghi chú dòng |
| `price_adjustment` | jsonb | Snapshot điều chỉnh giá |

### 2.9 `order_services`

| Column | Type | Mô tả |
|--------|------|-------|
| `id` | uuid PK | |
| `order_id` | uuid | FK → orders |
| `service_type` | text | xe_say / luoc_go / van_chuyen / other |
| `unit_price` | numeric | Đơn giá |
| `quantity` | numeric | Số lượng |
| `amount` | numeric | Thành tiền |
| `notes` | text | |

### 2.10 `payment_records`

| Column | Type | Mô tả |
|--------|------|-------|
| `id` | uuid PK | |
| `order_id` | uuid | FK → orders |
| `amount` | numeric | Số tiền thanh toán |
| `method` | text | Chuyển khoản / Tiền mặt / ... |
| `paid_at` | timestamptz | Ngày thanh toán |
| `note` | text | |
| `discount` | numeric | Chiết khấu |
| `discount_status` | text | auto / pending / approved |

### 2.11 `suppliers`

| Column | Type | Mô tả |
|--------|------|-------|
| `ncc_id` | text PK | Mã NCC |
| `name` | text | Tên NCC |
| `code` | text | Mã nội bộ |
| `description` | text | |
| `configurable` | bool | Hiện trong dropdown thuộc tính? |

### 2.12 `containers`

| Column | Type | Mô tả |
|--------|------|-------|
| `id` | uuid PK | |
| `container_code` | text | Mã container |
| `cargo_type` | text | sawn / raw_round / raw_box |
| `shipment_id` | uuid | FK → shipments (nullable) |
| `is_standalone` | bool | Không thuộc shipment? |
| `ncc_id` | text | FK → suppliers |
| `arrival_date` | date | Ngày về |
| `total_volume` | numeric | Tổng thể tích |
| `status` | text | Tạo mới → Đang VC → Đã về → Đã nhập kho |
| `weight_unit` | text | m3 / ton |
| `ton_to_m3_factor` | numeric | Hệ số quy đổi tấn → m³ |
| `raw_wood_type_id` | uuid | FK → raw_wood_types (cho raw) |
| `notes` | text | |

### 2.13 `app_settings`

| Column | Type | Mô tả |
|--------|------|-------|
| `key` | text PK | Tên setting |
| `value` | jsonb | Giá trị |

**Các key đang dùng**:
- `xe_say_config` — Cấu hình giá dịch vụ xẻ sấy
- `role_permissions` — Override quyền per-role (legacy, thay bằng permission_groups)
- `thickness_grouping` — Bật/tắt gộp dày system-wide
- `vat_rate` — Tỷ lệ VAT (mặc định 0.08)
- `price_note` — Ghi chú bảng giá (hiển thị cho bán hàng)
- `company_dispatch_info` — Thông tin xuất hàng công ty (in hóa đơn)
- `admin_password` — Password admin (hash SHA-256)

### 2.14 `bank_accounts`

| Column | Type | Mô tả |
|--------|------|-------|
| `id` | uuid PK | |
| `bank_name` | text NOT NULL | Tên ngân hàng ("VPBank") |
| `account_number` | text NOT NULL | Số tài khoản |
| `account_name` | text NOT NULL | Tên chủ tài khoản |
| `bin` | text NOT NULL | Mã BIN ngân hàng (VietQR) |
| `is_default` | bool | TK mặc định cho QR (unique constraint) |
| `active` | bool | |

### 2.15 `bank_transactions`

| Column | Type | Mô tả |
|--------|------|-------|
| `id` | uuid PK | |
| `reference_code` | text UNIQUE | Sepay referenceCode (chống trùng webhook) |
| `gateway` | text | Tên ngân hàng |
| `account_number` | text | Số TK nhận |
| `amount` | numeric NOT NULL | Số tiền GD |
| `content` | text | Nội dung CK gốc |
| `description` | text | Mô tả SMS đầy đủ |
| `transaction_date` | timestamptz | Thời điểm GD |
| `transfer_type` | text | 'in' / 'out' |
| `code` | text | Payment code (Sepay auto-detect) |
| `raw_data` | jsonb | Payload Sepay gốc |
| `parsed_order_code` | text | Mã đơn trích xuất ("DH-20260329-001") |
| `matched_order_id` | uuid FK | → orders.id |
| `payment_record_id` | uuid FK | → payment_records.id |
| `match_status` | text NOT NULL | pending/matched/partial/overpaid/unmatched/manual/ignored |
| `match_note` | text | Ghi chú đối soát |
| `matched_by` | text | 'auto' / username |
| `matched_at` | timestamptz | |

### 2.16 `customer_credits`

| Column | Type | Mô tả |
|--------|------|-------|
| `id` | uuid PK | |
| `customer_id` | uuid FK | → customers.id |
| `amount` | numeric NOT NULL | Số tiền ghi có |
| `source_type` | text NOT NULL | 'overpaid' / 'cancelled_order' / 'refund' |
| `source_order_id` | uuid FK | → orders.id |
| `source_transaction_id` | uuid FK | → bank_transactions.id |
| `used_order_id` | uuid FK | Đơn đã dùng credit |
| `used_amount` | numeric | Đã sử dụng bao nhiêu |
| `status` | text | 'available' / 'used' / 'refunded' |
| `note` | text | |

---

## 3. Quan hệ giữa các bảng (ERD text)

```
wood_types ─────┬── wood_config (1:1)
                ├── prices (1:N, composite PK: wood_id + sku_key)
                ├── wood_bundles (1:N)
                └── order_items (1:N, denormalized)

suppliers ──────┬── containers (1:N, via ncc_id)
                └── supplier_wood_assignments (1:N)

shipments ──────── containers (1:N)

containers ─────── wood_bundles (1:N, via container_id)

wood_bundles ───── order_items (1:N, via bundle_id)

customers ──────── orders (1:N)

orders ─────────┬── order_items (1:N)
                ├── order_services (1:N)
                ├── payment_records (1:N)
                └── bank_transactions (1:N, via matched_order_id)

bank_transactions ── payment_records (1:1, via payment_record_id)

customer_credits ───┬── customers (N:1)
                    ├── orders (N:1, source_order_id)
                    └── bank_transactions (N:1, source_transaction_id)

packing_sessions ── wood_bundles (1:N, via packing_session_id)

kiln_batches ───── kiln_items (1:N)

sawing_batches ──┬── sawing_items (1:N)
                 ├── sawing_daily_logs (1:N)
                 └── sawing_round_inputs (1:N)

edging_batches ──┬── edging_batch_inputs (1:N)
                 └── edging_leftovers (1:N)

wood_bundles ───── bundle_measurements (1:N)

raw_wood_types ──── containers (1:N, raw wood containers)

containers ──────── sawn_inspections (1:N)

permission_groups ── group_permissions (1:N)

users ──────────── permission_groups (N:1, via permission_group_id)

departments ────── employees (1:N)

employees ──────┬── attendance (1:N)
                ├── employee_allowances (1:N)
                ├── salary_advances (1:N)
                └── employee_change_log (1:N)

payroll ────────── payroll_details (1:N)

production_campaigns ── leave_requests (1:N)
```

---

## 4. Luồng dữ liệu (Data Flows)

### 4.1 Luồng tra giá bundle

```
INPUT: bundle object
  │
  ├── bundle.attributes              { thickness: "2F", quality: "A", width: "19-29" }
  ├── bundle.priceAttrsOverride      { thickness: "2.2F" }  (nullable)
  │
  ▼ MERGE
  lookupAttrs = { ...attributes, ...priceAttrsOverride }
                                     { thickness: "2.2F", quality: "A", width: "19-29" }
  │
  ▼ resolvePriceAttrs(woodId, lookupAttrs, cfg)
  │
  ├── 1. Filter configured attrs     Bỏ attrs không trong cfg[woodId].attrs
  ├── 2. resolveRangeGroup()         Số thực → label nhóm (VD: "1.82" → "1.6-1.9m")
  ├── 3. resolveAlias()              Alias → canonical (VD: "A" → "AB")
  └── 4. resolvePriceGroup()         NCC → nhóm giá (VD: "Midwest" → "Chung")
  │
  ▼ bpk(woodId, resolvedAttrs)
  priceKey = "ash||quality:A||thickness:2.2F||width:19-29"
  │
  ▼ prices[priceKey]
  basePrice = 13.5 (tr/m³)
  │
  ▼ apply priceAdjustment (nullable)
  │  type: 'percent', value: -10 → 13.5 × 0.9 = 12.15
  │  type: 'absolute', value: -2  → 13.5 - 2 = 11.5
  │
  ▼ OUTPUT: giá cuối cùng
```

### 4.2 Luồng tạo đơn hàng

```
1. Chọn customer
2. Mở BundlePicker
   ├── Load bundles (filter: status ≠ 'Đã bán', optional wood/attr filter)
   ├── Lock selected bundles (lockBundle)
   ├── Tra giá cho mỗi bundle (luồng 4.1)
   └── Return: [{bundleId, unitPrice, volume, amount, ...}]
3. Thêm services (xẻ sấy, vận chuyển...)
4. Nhập shipping, deposit
5. calcTotals():
   itemsTotal → svcTotal → subtotal → taxAmount → total → toPay
6. updateOrder() → UPDATE orders + DELETE/INSERT order_items + order_services
7. Nếu unitPrice < listPrice → paymentStatus = 'Chờ duyệt'
   (Kho đã trừ ngay khi thêm kiện vào danh sách — updateOrder không xử lý kho bundle)
```

### 4.3 Luồng rename chip

```
PgAT: rename "2F" → "2.2F" cho attribute "thickness"
  │
  ├── CLIENT (optimistic)
  │   ├── setP(): migrate price keys (tất cả wood)
  │   │   "walnut||thickness:2F||..." → "walnut||thickness:2.2F||..."
  │   ├── setBundles(): migrate attributes + skuKey + priceAttrsOverride
  │   │   attributes.thickness: "2F" → "2.2F"
  │   │   priceAttrsOverride.thickness: "2F" → "2.2F" (nếu có)
  │   └── setCfg(): migrate attrValues
  │       cfg[*].attrValues.thickness: [..., "2F", ...] → [..., "2.2F", ...]
  │
  └── SERVER (api.renameAttrValue)
      ├── 1. prices table: old sku_key → new sku_key (UPSERT + DELETE)
      ├── 2. wood_bundles: attributes + sku_key + price_attrs_override
      └── 3. change_log: sku_key migration
```

### 4.4 Luồng nhập kho từ container

```
1. Tạo container (PgContainer)
   ├── containerCode, cargoType, nccId, arrivalDate
   └── Thêm items (loại gỗ, dày, chất lượng, thể tích) hoặc CSV import
2. Cập nhật status: Tạo mới → Đang VC → Đã về
3. Nhập kho (PgWarehouse hoặc từ PgContainer)
   ├── Mỗi container item → 1 hoặc nhiều wood_bundles
   ├── Auto-gen bundleCode (PREFIX-YYYYMMDD-NNN)
   ├── Resolve attributes → rangeGroup/alias
   └── Link bundle.container_id → container.id
4. Container status → "Đã nhập kho"
```

### 4.5 Luồng đối soát chuyển khoản (Sepay webhook)

```
Sepay POST webhook
  │
  ▼ Edge Function: sepay-webhook
  │
  ├── 1. Verify API Key header
  ├── 2. Chỉ xử lý transferType = "in"
  ├── 3. UPSERT bank_transactions (ON CONFLICT reference_code DO NOTHING)
  │      → Đã tồn tại → return 200 (idempotent)
  │
  ├── 4. Parse order code: regex /DH[- ]?(\d{8})[- ]?(\d{3})/i
  │      → Không match → match_status = 'unmatched'
  │
  ├── 5. Tìm order theo order_code
  │      → Không tìm thấy → match_status = 'unmatched'
  │
  ├── 6. Tính: toPay = total_amount - debt (KHÔNG trừ deposit)
  │      remaining = toPay - paid_amount
  │
  ├── 7a. amount ≈ remaining (±1000đ)
  │       → INSERT payment_records
  │       → UPDATE order: paid_amount, payment_status = 'Đã thanh toán'
  │       → Deduct bundles
  │       → match_status = 'matched'
  │
  ├── 7b. amount < remaining
  │       → INSERT payment_records
  │       → UPDATE order: paid_amount, payment_status = 'Còn nợ'
  │       → match_status = 'partial'
  │
  └── 7c. amount > remaining
          → INSERT payment_records (chỉ phần remaining)
          → UPDATE order: payment_status = 'Đã thanh toán'
          → INSERT customer_credits (phần dư)
          → match_status = 'overpaid'
```

### 4.5b Luồng phân bổ credit vào đơn nợ cũ

```
Kế toán thấy GD "Dư tiền" → bấm "Phân bổ"
  │
  ▼ Dialog: hiện danh sách đơn nợ cũ của khách (fetchCustomerDebtDetail)
  │
  ├── Chọn đơn nợ → bấm "Phân bổ"
  │
  ├── allocateCreditToOrder(creditId, orderId, amount):
  │     1. Trừ credit.remaining
  │     2. INSERT payment_records (method = 'Tín dụng')
  │     3. UPDATE order: paid_amount += amount, payment_status
  │     4. Nếu fullyPaid → deduct bundles
  │
  └── credit.remaining = 0 → status = 'used'
```

### 4.6 Luồng gỗ nguyên liệu đến kiện thành phẩm

```
Container (raw_round/raw_box)
  │
  ▼ Packing list NCC (raw_wood_packing_list)
  Danh sách khai báo nhà cung cấp (import CSV)
  │
  ▼ Nghiệm thu (raw_wood_inspection)
  Đo: số cùm, đường kính, chiều dài → tính thể tích thực
  Đối chiếu với packing list NCC
  │
  ├── Bán gỗ NL? → raw_wood_withdrawals (type: sale) → DONE
  │
  ▼ Mẻ xẻ (sawing_batches → sawing_items)
  raw_wood_withdrawals (type: sawing) → xuất kho cho mẻ xẻ
  Tracking: sawing_daily_logs, sawing_round_inputs
  │
  ▼ Mẻ sấy (kiln_batches → kiln_items)
  Tấm xẻ tươi → sấy khô
  Quy đổi: wood_conversion_rates (kg → m³ theo loại gỗ)
  │
  ▼ Dong cạnh [tùy chọn] (edging_batches → edging_batch_inputs)
  Cắt mép, đo lường (bundle_measurements)
  │
  ▼ Xếp loại (packing_sessions)
  Gỗ sấy khô → phân loại: chất lượng, dày, NCC → đóng kiện
  │
  ▼ Kiện thành phẩm (wood_bundles)
  bundle.packing_session_id → packing_sessions.id
```

### 4.7 Luồng nghiệm thu gỗ xẻ (sawn container)

```
Container (sawn) → Tab "Nghiệm thu" (SawnInspectionTab)
  │
  ├── Import packing list CSV hoặc nhập tay
  ├── Kiểm tra từng kiện: loại gỗ, dày, chất lượng, thể tích
  ├── Submit → sawn_inspections
  ├── Admin duyệt (approve)
  └── Nhập kho hàng loạt (batchImportToWarehouse)
      → Tạo wood_bundles, link container_id
```

### 4.8 Luồng tính lương

```
Chấm công (attendance) + Ca (work_shifts) + Cài đặt (payroll_settings)
  │
  ├── Tính công thực tế (theo ca sáng/chiều/tối)
  ├── Nghỉ phép (leave_requests → production_campaigns)
  ├── OT (monthly_ot, extra_work_records)
  │
  ▼ Tạo bảng lương (payroll → payroll_details)
  │
  Lương = (Cơ bản × công_thực/công_chuẩn) + Phụ cấp + OT - Tạm ứng - BHXH
  │
  ▼ Trạng thái: Nháp → Đã duyệt → Đã thanh toán
```

---

## 5. Mapping JS ↔ DB columns

### wood_bundles (file: `src/api/bundles.js`)

| JS field | DB column | Transform |
|----------|-----------|-----------|
| `id` | `id` | — |
| `bundleCode` | `bundle_code` | — |
| `woodId` | `wood_id` | — |
| `containerId` | `container_id` | — |
| `skuKey` | `sku_key` | — |
| `attributes` | `attributes` | JSONB, default {} |
| `boardCount` | `board_count` | default 0 |
| `remainingBoards` | `remaining_boards` | default = boardCount |
| `volume` | `volume` | parseFloat, default 0 |
| `remainingVolume` | `remaining_volume` | parseFloat, default 0 |
| `status` | `status` | default 'Kiện nguyên' |
| `notes` | `notes` | default '' |
| `supplierBundleCode` | `supplier_bundle_code` | default '' |
| `location` | `location` | default '' |
| `qrCode` | `qr_code` | default = bundleCode |
| `images` | `images` | JSONB array, default [] |
| `itemListImages` | `item_list_images` | JSONB array, default [] |
| `rawMeasurements` | `raw_measurements` | JSONB, default {} |
| `manualGroupAssignment` | `manual_group_assignment` | default false |
| `unitPrice` | `unit_price` | parseFloat, default null |
| `priceAdjustment` | `price_adjustment` | JSONB `{type,value,reason}`, default null |
| `priceAttrsOverride` | `price_attrs_override` | JSONB `{attrId:value}`, default null |
| `priceOverrideReason` | `price_override_reason` | default '' |
| `volumeAdjustment` | `volume_adjustment` | parseFloat, default null |
| `lockedBy` | `locked_by` | default null |
| `lockedAt` | `locked_at` | default null |
| `packingSessionId` | `packing_session_id` | default null |
| `createdAt` | `created_at` | — |

### orders (file: `src/api/orders.js`)

Chỉ liệt kê các field có transform/fallback đặc biệt — phần lớn còn lại là 1-1 (camelCase ↔ snake_case).

| JS field | DB column | Transform |
|----------|-----------|-----------|
| `saleDate` | `sale_date` | Fallback về `created_at` nếu null. Xem BUSINESS.md 4.6c |
| `createdAt` | `created_at` | Audit, không sửa |
| `salesBy` | `sales_by` | Fallback về `created_by` nếu null |
| `paymentStatus` | `payment_status` | Mặc định 'Chưa thanh toán' |
| `exportStatus` | `export_status` | Mặc định 'Chưa xuất' |
| `totalAmount` | `total_amount` | parseFloat |

---

## 6. Realtime subscriptions

Supabase Realtime được dùng cho các bảng thay đổi thường xuyên:

| Bảng | Events | Lý do |
|------|--------|-------|
| `prices` | INSERT, UPDATE, DELETE | Cross-session sync bảng giá |
| `orders` | INSERT, UPDATE | Cập nhật trạng thái đơn |
| `wood_bundles` | INSERT, UPDATE, DELETE | Sync kho real-time |
| `containers` | INSERT, UPDATE | Trạng thái container |

Bảng ít thay đổi (wood_types, attributes, wood_config, customers, suppliers) **không dùng** Realtime — reload khi cần.

---

## 7. JSONB field patterns

### Pattern 1: Flat attributes
```jsonc
// wood_bundles.attributes
{ "thickness": "2F", "quality": "Fas", "supplier": "Missouri", "length": "1.6-1.9m" }
```

### Pattern 2: Override (sparse)
```jsonc
// wood_bundles.price_attrs_override — chỉ chứa fields bị override
{ "thickness": "2.2F" }
// Merge: { ...attributes, ...price_attrs_override } khi tra giá
```

### Pattern 3: Adjustment
```jsonc
// wood_bundles.price_adjustment
{ "type": "percent", "value": -10, "reason": "Kiện xấu hơn" }
// Hoặc
{ "type": "absolute", "value": 2.5, "reason": "Kiện đẹp đặc biệt" }
```

### Pattern 4: Nested config
```jsonc
// wood_config.config — object phức tạp, nested nhiều tầng
{
  "attrs": [...],
  "attrValues": { "thickness": [...], "quality": [...] },
  "rangeGroups": { "length": [{ "label": "...", "min": N, "max": N }] },
  "attrPriceGroups": { "supplier": { "default": "...", "special": [...] } },
  "attrAliases": { "quality": { "AB": ["A"] } },
  "defaultHeader": [...]
}
```

### Pattern 5: App settings (key-value)
```jsonc
// app_settings — mỗi row là 1 setting
{ "key": "vat_rate", "value": 0.08 }
{ "key": "thickness_grouping", "value": true }
{ "key": "xe_say_config", "value": { /* complex nested */ } }
```
