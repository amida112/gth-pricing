# PHÂN TÍCH TOÀN DIỆN HỆ THỐNG GTH PRICING

> **Hướng dẫn đọc tài liệu:**
> - ✅ **RÀNG BUỘC** — Quy tắc đang được áp dụng trong code
> - ⚠️ **VALIDATION CÒN THIẾU** — Chưa có kiểm tra, cần bổ sung
> - 🔴 **LỖ HỔNG NGHIÊM TRỌNG** — Rủi ro cao về dữ liệu / tài chính / kho
> - 💡 **ĐỀ XUẤT** — Cải tiến UX hoặc nghiệp vụ nên triển khai

---

## TỔNG QUAN HỆ THỐNG

### Các Role & Quyền truy cập

| Role | Label | Màn hình được phép |
|------|-------|--------------------|
| `admin` | Quản trị viên | Tất cả 11 màn hình |
| `banhang` | Nhân viên bán hàng | dashboard · sales · customers · pricing |
| `kho` | Thủ kho | dashboard · warehouse · suppliers · containers |

### Quyền thao tác theo role

| Quyền | admin | banhang | kho |
|-------|-------|---------|-----|
| Sửa bảng giá (`ce`) | ✓ | ✗ | ✗ |
| Xem giá vốn (`seeCostPrice`) | ✓ | ✗ | ✗ |
| Tạo/sửa đơn hàng (`ceSales`) | ✓ | ✓ | ✗ |
| Quản lý kho (`ceWarehouse`) | ✓ | ✗ | ✓ |
| Thêm NCC (kho: chỉ thêm) | ✓ | ✗ | add-only |
| Thêm container (kho: chỉ thêm) | ✓ | ✗ | add-only |

---

---

# MÀNG HÌNH: ĐĂNG NHẬP

### Mục đích
Xác thực danh tính, phân quyền theo role, khởi tạo session.

### Luồng hoạt động
1. Nhập username → preview role hiển thị ngay bên dưới
2. Nhập password → ẩn ký tự
3. Click "Đăng nhập" hoặc Enter → validate → chuyển trang `pages[0]` của role

---

### ✅ RÀNG BUỘC ĐANG ÁP DỤNG

- Username và password không được rỗng
- Phải khớp dữ liệu trong `auth.js` mới đăng nhập được
- Nút bị disable trong thời gian xử lý (delay 300ms)
- Session lưu vào `localStorage['gth_user_session']`
- Có session hợp lệ → tự động vào dashboard, bỏ qua login

---

### ⚠️ VALIDATION CÒN THIẾU

> **[V-01] Không có nút Show/Hide password**
> Người dùng không thể kiểm tra mình đang nhập đúng chưa, đặc biệt trên mobile khi bàn phím ảo dễ nhầm.
> → **Cần thêm:** icon mắt toggle hiển thị/ẩn password.

> **[V-02] Không chặn brute-force thực sự**
> Delay 300ms chỉ là giả lập — không có giới hạn số lần thử sai. Có thể thử mãi.
> → **Cần thêm:** Khóa form sau 5 lần sai liên tiếp trong 10 phút.

---

### 🔴 LỖ HỔNG NGHIÊM TRỌNG

> **[BUG-01] Password hardcoded trong source code JavaScript**
> File `auth.js` chứa toàn bộ username + password dạng plaintext. Bất kỳ ai build hoặc inspect bundle JS đều đọc được.
> → **Phải sửa:** Chuyển authentication sang API backend (Supabase Auth hoặc Edge Function), không lưu credential trong frontend.

---

### 💡 ĐỀ XUẤT

> **[UX-01]** Thêm tính năng "Đổi mật khẩu" cho từng user — hiện tại muốn đổi phải sửa code.

> **[UX-02]** Hiển thị label role rõ hơn ở preview (VD: "Nhân viên bán hàng — Nguyễn Thị Mai") để không nhầm tài khoản khi nhiều người dùng chung máy.

---

---

# MÀNG HÌNH: TỔNG QUAN (Dashboard)

### Mục đích
Theo dõi KPI kinh doanh và tồn kho. Hiển thị khác nhau tùy role.

### Dữ liệu hiển thị theo role

| Metric / Biểu đồ | admin | banhang | kho |
|------------------|-------|---------|-----|
| Tổng tồn kho (m³) | ✓ | ✗ | ✓ |
| Doanh thu hôm nay (VNĐ) | ✓ | ✓ | ✗ |
| Số đơn chờ xuất hàng | ✓ | ✓ | ✗ |
| Top 5 loại gỗ bán chạy | ✓ | ✓ | ✓ |
| Biểu đồ donut phân bổ tồn kho | ✓ | ✗ | ✓ |
| Biểu đồ doanh thu 30 ngày | ✓ | ✓ | ✗ |
| Biểu đồ doanh thu 12 tháng | ✓ | ✓ | ✗ |

### Nguồn dữ liệu

| Metric | Nguồn Supabase |
|--------|----------------|
| Tồn kho | `wood_bundles.remaining_volume` WHERE `status ≠ 'Đã bán'` |
| Doanh thu hôm nay | `orders.total_amount` WHERE `payment_status='Đã thanh toán'` AND `payment_date >= 00:00 VN` |
| Chờ xuất | COUNT `orders` WHERE paid AND `export_status='Chưa xuất'` |
| Top 5 / Doanh thu | `order_items.volume` + `orders.total_amount` aggregated client-side |

---

### ✅ RÀNG BUỘC ĐANG ÁP DỤNG

- Timezone Vietnam (UTC+7) được xử lý đúng — dùng ISO filter `+07:00`
- Nút "Làm mới" gọi lại toàn bộ API
- Cảnh báo tồn kho thấp khi bất kỳ loại gỗ nào < 5 m³
- Biểu đồ Top 5 có thể lọc theo 7 / 30 / 90 ngày (client-side)
- Read-only — không có thao tác ghi nào

---

### ⚠️ VALIDATION CÒN THIẾU

> **[V-03] Biểu đồ không có tooltip khi hover**
> Người dùng không thể đọc giá trị chính xác trên biểu đồ bar/line — chỉ nhìn ước lượng bằng mắt.
> → **Cần thêm:** Tooltip hiện giá trị khi hover vào từng điểm/cột.

> **[V-04] Không có nút "Xem chi tiết" từ dashboard**
> Card "Chờ xuất: N đơn" không thể click để sang màn hình đơn hàng với filter sẵn.
> → **Cần thêm:** Link từ metric card → màn hình tương ứng với filter áp dụng.

---

### 💡 ĐỀ XUẤT

> **[UX-03]** Thêm so sánh % thay đổi so với hôm qua / tuần trước / tháng trước trên mỗi metric card (VD: "↑ 12% so với hôm qua").

> **[UX-04]** Auto-refresh dữ liệu mỗi 5 phút khi người dùng đang xem dashboard.

> **[UX-05]** Thêm filter ngày tùy chỉnh cho biểu đồ doanh thu.

---

---

# MÀNG HÌNH: BẢNG GIÁ (PgPrice)

### Mục đích
Quản lý giá bán theo tổ hợp thuộc tính (SKU matrix). Admin sửa được, banhang chỉ xem.

### Các tính năng hiện có
- Toggle "Gộp dày" — nhóm thickness liên tiếp có cùng giá
- Toggle "Gộp dài" — nhóm length range groups
- Toggle "Chỉ có giá" / "Chỉ tồn kho" — lọc hiển thị
- Badge đỏ: số SKU có hàng trong kho nhưng chưa định giá
- Ô highlight cam: SKU chưa có giá nhưng đang có bundle tồn kho
- Lịch sử thay đổi giá (local, tối đa 15 entries)

---

### ✅ RÀNG BUỘC ĐANG ÁP DỤNG

- Phải chọn loại gỗ trước khi xem matrix
- Khi sửa giá: bắt buộc nhập lý do (dialog `RDlg`)
- Giá phải là số hợp lệ ≥ 0
- Không cho nhập giá âm
- banhang không thể click vào ô giá
- Cập nhật UI tức thì (optimistic), gọi API async

---

### ⚠️ VALIDATION CÒN THIẾU

> **[V-05] Lịch sử thay đổi giá mất khi reload trang**
> Log chỉ lưu trong `state[]` local — không persist. Reload hoặc đóng tab là mất toàn bộ lịch sử.
> → **Cần sửa:** Load lịch sử từ bảng `change_log` trên Supabase khi mở trang.

> **[V-06] Không có bulk update**
> Phải sửa từng ô một — không thể chọn nhiều ô cùng lúc để set cùng giá.
> → **Nên thêm:** Ctrl+Click để chọn nhiều ô → bulk price update.

---

### 💡 ĐỀ XUẤT

> **[UX-06]** Highlight (blink effect) ô vừa được sửa giá để dễ nhận biết thay đổi.

> **[UX-07]** Thêm tab "Lịch sử hôm nay" và "Lịch sử 7 ngày" trong phần log.

> **[UX-08]** Export bảng giá ra CSV/Excel để gửi cho khách hàng.

---

---

# MÀNG HÌNH: LOẠI GỖ (PgWT)

### Mục đích
Quản lý danh mục loại gỗ — thêm/sửa/xóa/sắp xếp.

### Các trường dữ liệu

| Field | Kiểu | Bắt buộc | Ghi chú |
|-------|------|----------|---------|
| Tên VN | string | ✓ | VD: "Óc chó" |
| Tên EN | string | ✓ | Dùng để auto-gen ID |
| Icon | emoji | ✗ | Hiện trong sidebar/picker |
| Code | string | ✗ | VD: "WAL" — prefix trong bundle code |

---

### ✅ RÀNG BUỘC ĐANG ÁP DỤNG

- Tên VN và Tên EN không được rỗng
- ID tự động sinh từ tên EN, phải unique
- Xóa bị block nếu loại gỗ đã có config trong `cfg[woodId]`
- Sắp xếp lại được persist qua `updateWoodOrder(ids)`

---

### ⚠️ VALIDATION CÒN THIẾU

> **[V-07] Xóa loại gỗ không kiểm tra bundles và orders**
> Hiện tại chỉ block xóa khi có config. Nhưng nếu xóa config rồi xóa gỗ → các bundle và đơn hàng cũ có `wood_id` này sẽ bị orphaned.
> → **Cần thêm:** Block xóa nếu tồn tại bất kỳ bundle hoặc order_item nào tham chiếu `wood_id`.

> **[V-08] Đổi `code` không cảnh báo ảnh hưởng bundle code**
> `code` dùng làm prefix trong `bundleCode` (VD: "WAL-20260318-001"). Đổi code → bundle code cũ không thay đổi theo → không nhất quán.
> → **Cần thêm:** Cảnh báo khi sửa `code` nếu đã có bundle sử dụng code cũ.

---

### 🔴 LỖ HỔNG NGHIÊM TRỌNG

> **[BUG-02] Orphaned bundles khi xóa loại gỗ**
> Kịch bản: Admin xóa config → xóa loại gỗ → các bundle/order_items với `wood_id` này còn trong DB nhưng không còn liên kết được với tên gỗ → hiển thị sai trên đơn hàng và báo cáo.

---

### 💡 ĐỀ XUẤT

> **[UX-09]** Hiển thị số SKU và số bundle hiện có per loại gỗ ngay trong danh sách để biết mức độ phức tạp trước khi xóa.

---

---

# MÀNG HÌNH: THUỘC TÍNH (PgAT)

### Mục đích
Quản lý hệ thống thuộc tính SKU (độ dày, chất lượng, cạnh...) bao gồm định nghĩa values và nhóm range.

### Các trường dữ liệu

| Field | Kiểu | Bắt buộc | Ghi chú |
|-------|------|----------|---------|
| Tên | string | ✓ | VD: "Độ dày" |
| ID | string | ✓ (unique, auto-gen) | VD: "thickness" |
| Groupable | boolean | ✗ | Cho phép auto-sort giá trị dạng "2F", "2.5F" |
| Values | string[] | ✓ (≥1) | Danh sách giá trị |
| rangeGroups | array | ✗ | Chỉ khi groupable=false, dùng cho "length" |

**rangeGroup shape:** `{ label: "1.6-1.9m", min: 1.6, max: 1.9 }`

### Attribute đặc biệt: `supplier`
Values được sync tự động từ `suppliers.configurable=true` — không thể thêm/xóa thủ công, chỉ sắp xếp lại.

---

### ✅ RÀNG BUỘC ĐANG ÁP DỤNG

- Attribute phải có ít nhất 1 value
- ID phải unique
- Không thể xóa attribute đang được dùng trong bất kỳ config nào
- Không thể sửa values của attribute `supplier`
- Rename value → confirm dialog → migrate toàn bộ `prices`, `wood_bundles`, `change_log`

---

### ⚠️ VALIDATION CÒN THIẾU

> **[V-09] Xóa value không kiểm tra bundles**
> Hiện chỉ block xóa attribute nếu đang trong config — nhưng không block xóa từng value. Xóa value "BC" → các bundle có `attributes.quality = "BC"` vẫn còn trong DB nhưng value không còn định nghĩa.
> → **Cần thêm:** Kiểm tra và hiển thị số bundle đang dùng value trước khi cho xóa. Block nếu > 0.

> **[V-10] rangeGroup không kiểm tra overlap giữa các nhóm**
> Admin có thể tạo hai nhóm: `min:1.6 max:1.9` và `min:1.8 max:2.2` → vùng 1.8-1.9 bị overlap. Bundle sẽ được gán vào nhóm đầu tiên khớp → có thể gán sai.
> → **Cần thêm:** Validate không có overlap giữa các rangeGroup trong cùng attribute. Hiển thị visual timeline để kiểm tra.

> **[V-11] rangeGroup không kiểm tra gap**
> Có thể có khoảng trống giữa các nhóm (VD: nhóm kết thúc tại 1.9, nhóm tiếp bắt đầu tại 2.1 → raw "2.0" không khớp nhóm nào). Bundle sẽ bị flag "Gán thủ công".
> → **Nên thêm:** Hiển thị cảnh báo gap trong timeline rangeGroups.

---

### 🔴 LỖ HỔNG NGHIÊM TRỌNG

> **[BUG-03] Orphaned bundle attributes**
> Kịch bản: Xóa value "Dong cạnh" khỏi attribute "edging" → các bundle có `attributes.edging = "Dong cạnh"` vẫn tồn tại trong DB nhưng value này không còn trong định nghĩa → skuKey không khớp bảng giá → không tra được giá → bán không được.

---

### 💡 ĐỀ XUẤT

> **[UX-10]** Hiển thị badge "Đang dùng trong N bundle / M giá" kế mỗi value để người dùng biết impact trước khi xóa hoặc rename.

> **[UX-11]** Timeline trực quan cho rangeGroups: hiển thị các nhóm trên trục số để phát hiện gap và overlap ngay lập tức.

> **[UX-12]** Thêm cơ chế undo trong 30 giây sau khi rename value (vì migrate là không thể hoàn tác).

---

---

# MÀNG HÌNH: CẤU HÌNH (PgCFG)

### Mục đích
Thiết lập thuộc tính nào và giá trị nào được dùng cho từng loại gỗ; chọn layout mặc định của bảng giá.

### Config shape
```
cfg[woodId] = {
  attrs: ["thickness", "quality"],
  attrValues: {
    thickness: ["2F", "2.2F", "2.5F"],
    quality:   ["BC", "ABC", "AB"]
  },
  defaultHeader: ["quality"]   // max 2, hiển thị ngang trong matrix
}
```

---

### ✅ RÀNG BUỘC ĐANG ÁP DỤNG

- Mỗi attribute được bật phải chọn ít nhất 1 value — block save nếu không
- defaultHeader tối đa 2 attributes
- Lưu bằng cách xóa toàn bộ config cũ rồi insert mới (atomic per woodId)

---

### ⚠️ VALIDATION CÒN THIẾU

> **[V-12] Bỏ value khỏi config không cảnh báo ảnh hưởng bundle/giá**
> Bỏ "2F" khỏi config → value này biến mất khỏi bảng giá và không thể chọn khi tạo bundle mới. Nhưng các bundle cũ có "2F" và giá "2F" vẫn còn trong DB → tồn tại nhưng ẩn, không nhìn thấy, không quản lý được.
> → **Cần thêm:** Hiển thị "Value này đang được dùng trong N bundle. Bỏ khỏi config sẽ ẩn chúng khỏi bảng giá. Tiếp tục?"

> **[V-13] Không có preview kết quả trước khi lưu**
> Admin không thể biết matrix sẽ trông như thế nào sau khi lưu config mới — phải lưu xong rồi sang Bảng giá kiểm tra.
> → **Nên thêm:** Preview matrix mini ngay trên màn hình Config.

---

### 🔴 LỖ HỔNG NGHIÊM TRỌNG

> **[BUG-04] Config thay đổi làm ẩn bundle/giá cũ mà không có cảnh báo**
> Kịch bản: Có 10 bundle "2F" trong kho, tổng 50 m³. Admin bỏ "2F" khỏi config. Từ giờ:
> - Bảng giá không còn hiện giá "2F"
> - Kho không thể nhập bundle "2F" mới
> - 10 bundle cũ vẫn còn trong DB nhưng nhân viên không nhìn thấy
> - Thống kê tồn kho vẫn tính 50 m³ này
> → Dữ liệu tồn kho bị "ẩn" nhưng vẫn chiếm chỗ trong báo cáo.

---

### 💡 ĐỀ XUẤT

> **[UX-13]** Hiển thị số bundle per value ngay trong màn hình config để nhận thấy impact ngay khi bỏ tick.

> **[UX-14]** Thêm panel so sánh "Config cũ → Config mới" với danh sách thay đổi trước khi xác nhận lưu.

---

---

# MÀNG HÌNH: SKU (PgSKU)

### Mục đích
Xem toàn bộ tổ hợp SKU của một loại gỗ kèm giá niêm yết. Read-only.

---

### ✅ RÀNG BUỘC ĐANG ÁP DỤNG

- Read-only — không có thao tác ghi
- Chỉ hiển thị SKU từ config đang active

---

### ⚠️ VALIDATION CÒN THIẾU

> **[V-14] Không hiển thị số bundle tồn kho per SKU**
> Màn hình SKU chỉ hiện giá — không biết SKU nào còn hàng, SKU nào hết.
> → **Nên thêm:** Cột "Số bundle / Tổng m³ còn lại" per SKU.

---

### 💡 ĐỀ XUẤT

> **[UX-15]** Thêm filter "SKU chưa có giá" và "SKU có hàng tồn".

> **[UX-16]** Nút export CSV để gửi bảng giá cho khách hàng.

---

---

# MÀNG HÌNH: NHÀ CUNG CẤP (PgNCC)

### Mục đích
Quản lý danh mục nhà cung cấp. Nếu `configurable=true`, NCC xuất hiện trong attribute "supplier" của bundle.

### Các trường dữ liệu

| Field | Kiểu | Bắt buộc | Ghi chú |
|-------|------|----------|---------|
| nccId | string | ✓ (unique) | Mã nội bộ |
| name | string | ✓ | Tên NCC |
| code | string | ✗ | Viết tắt |
| description | string | ✗ | Mô tả |
| configurable | boolean | ✗ | Nếu true → xuất hiện trong attr "supplier" |

---

### ✅ RÀNG BUỘC ĐANG ÁP DỤNG

- `nccId` phải unique
- `name` không được rỗng
- kho chỉ được thêm (add-only), không sửa/xóa
- Confirm dialog trước khi xóa

---

### ⚠️ VALIDATION CÒN THIẾU

> **[V-15] Xóa NCC không kiểm tra container và bundle tham chiếu**
> Xóa NCC → các container có `ncc_id` này và các bundle có `supplier = tên NCC` vẫn tồn tại nhưng không còn liên kết được → dữ liệu nhập hàng bị mồ côi.
> → **Cần thêm:** Block xóa nếu NCC còn đang được tham chiếu trong container hoặc bundle. Hiển thị "Đang dùng trong N container / M bundle".

> **[V-16] Tắt `configurable` không cảnh báo về bundles hiện tại**
> Nếu NCC "Khai Vy" đang `configurable=true` và đã có 50 bundle dùng làm supplier → tắt `configurable` → value "Khai Vy" biến mất khỏi attribute nhưng bundle cũ vẫn có giá trị đó.
> → **Cần thêm:** Cảnh báo "NCC này đang được dùng trong N bundle. Tắt configurable sẽ ẩn option này khỏi form tạo bundle mới."

---

### 🔴 LỖ HỔNG NGHIÊM TRỌNG

> **[BUG-05] Orphaned container/bundle khi xóa NCC**
> Xóa NCC → `container.ncc_id = null-ref` → không trace được nguồn gốc hàng. Đặc biệt nguy hiểm khi có tranh chấp chất lượng với nhà cung cấp.

---

### 💡 ĐỀ XUẤT

> **[UX-17]** Hiển thị cột "Số container" và "Số bundle" per NCC trong danh sách.

> **[UX-18]** Thêm search/filter cho danh sách NCC khi có nhiều nhà cung cấp.

---

---

# MÀNG HÌNH: CONTAINER (PgContainer)

### Mục đích
Theo dõi các lô hàng nhập theo container, bao gồm danh sách mặt hàng trong mỗi container.

### Các trường dữ liệu

**Container:**

| Field | Kiểu | Bắt buộc | Ghi chú |
|-------|------|----------|---------|
| containerCode | string | ✓ (unique) | Mã container |
| nccId | FK → NCC | ✗ | Nhà cung cấp |
| arrivalDate | date | ✗ | Ngày về Việt Nam |
| totalVolume | number m³ | ✗ | Tổng thể tích (auto từ items) |
| status | enum | ✓ | Tạo mới / Đang vận chuyển / Đã về / Đã nhập kho |
| notes | string | ✗ | |

**Container Item:**

| Field | Kiểu | Bắt buộc | Ghi chú |
|-------|------|----------|---------|
| woodId | FK | ✓ | Loại gỗ |
| thickness | string | ✗ | Độ dày |
| quality | string | ✗ | Chất lượng |
| volume | number m³ | ✓ (> 0) | |
| notes | string | ✗ | |

---

### ✅ RÀNG BUỘC ĐANG ÁP DỤNG

- `containerCode` phải unique
- Item phải có `woodId` và `volume > 0`
- kho: add-only hoặc full CRUD tùy permission `addOnlyContainer`
- Confirm dialog trước khi xóa

---

### ⚠️ VALIDATION CÒN THIẾU

> **[V-17] Xóa container không kiểm tra bundles tham chiếu**
> Các bundle được tạo từ container này có `container_id` trỏ về. Xóa container → `bundle.container_id` thành null-ref → mất truy xuất nguồn gốc lô hàng.
> → **Cần thêm:** Block xóa nếu đã có bundle nào tham chiếu container này.

> **[V-18] Không reconcile volume giữa container items và bundles đã nhập**
> Container "CONT-001" có items tổng 120 m³. Nhưng chỉ tạo được 100 m³ bundle → 20 m³ "mất tích" mà không ai biết.
> → **Nên thêm:** Hiển thị "Đã nhập kho: X m³ / Tổng container: Y m³" ngay trong màn hình container.

> **[V-19] Không nhắc nhở khi mark "Đã nhập kho" mà chưa tạo bundle**
> Admin mark container là "Đã nhập kho" mà quên tạo bundle → hàng về nhưng kho không có gì.
> → **Cần thêm:** Cảnh báo "Container này chưa có bundle nào được tạo. Bạn có chắc muốn mark là Đã nhập kho?"

---

### 🔴 LỖ HỔNG NGHIÊM TRỌNG

> **[BUG-06] Mất truy xuất nguồn gốc hàng khi xóa container**
> Trong tranh chấp chất lượng hoặc kiểm toán, cần biết hàng từ container nào. Xóa container → mất thông tin này.

---

### 💡 ĐỀ XUẤT

> **[UX-19]** Thêm link "Xem bundles từ container này" → sang Thủ kho với filter container đã chọn.

> **[UX-20]** Panel reconciliation: so sánh volume items vs volume bundles đã nhập, hiển thị % hoàn thành.

> **[UX-21]** Timeline trạng thái container trực quan (Tạo mới → vận chuyển → về → nhập kho) với timestamp per bước.

---

---

# MÀNG HÌNH: THỦ KHO (PgWarehouse)

### Mục đích
Quản lý toàn bộ kiện hàng (bundles) trong kho — nhập mới, xem tồn, upload ảnh, toggle trạng thái.

### Bundle status lifecycle
```
[Nhập vào]
     ↓
 Kiện nguyên  ←──[toggle]──→  Chưa được bán
     ↓ (thanh toán đơn hàng deduct inventory)
  Kiện lẻ  ─────────────────────────→  Đã bán
```

### Các trường dữ liệu

| Field | Kiểu | Bắt buộc | Ghi chú |
|-------|------|----------|---------|
| woodId | FK | ✓ | Loại gỗ |
| attributes | { attrId: value } | ✓ | VD: `{ thickness: "2F", quality: "AB" }` |
| boardCount | number | ✓ (> 0) | Số tấm ban đầu |
| volume | number m³ | ✓ (> 0) | Thể tích ban đầu |
| containerId | FK | ✗ | Container nguồn gốc |
| supplierBundleCode | string | ✗ | Mã kiện của NCC |
| location | string | ✗ | Vị trí trong kho |
| rawMeasurements | { attrId: rawValue } | ✗ | Đo thực tế trước khi nhóm |
| notes | string | ✗ | |

---

### ✅ RÀNG BUỘC ĐANG ÁP DỤNG

- `boardCount > 0`, `volume > 0`
- `bundleCode` tự động sinh: `[CODE]-[YYYYMMDD]-[###]`
- `remainingBoards = boardCount` và `remainingVolume = volume` khi khởi tạo
- rawMeasurement → auto-resolve rangeGroup label; nếu không khớp → flag "Gán thủ công"
- Chỉ giảm tồn kho khi đơn hàng được mark "Đã thanh toán"
- Bundle không có giá → hiển thị badge cảnh báo

---

### ⚠️ VALIDATION CÒN THIẾU

> **[V-20] Xóa bundle không kiểm tra order_items tham chiếu**
> Nếu bundle đã được đưa vào đơn hàng (kể cả đơn nháp), xóa bundle → `order_items.bundle_id` thành null-ref. Nếu đơn chưa thanh toán, nhân viên vẫn thấy item nhưng không trace được bundle.
> → **Cần thêm:** Block xóa bundle nếu đang được tham chiếu trong bất kỳ order_item nào.

> **[V-21] Không có locking khi nhiều người xem cùng bundle**
> Hai nhân viên bán hàng cùng mở bundle "WAL-001", cùng thêm vào đơn hàng của mình. Cả hai đều thấy `remainingBoards = 10`. Cả hai đều confirm thanh toán → deduct 2 lần → `remainingBoards = -10`.
> → **Cần thêm:** Optimistic locking — thêm `version` field, deduct check version trước khi update.

> **[V-22] Import CSV không validate trùng supplierBundleCode**
> Import nhiều lần cùng file CSV → tạo bundle trùng `supplierBundleCode`. Không có unique constraint.
> → **Cần thêm:** Check trùng `supplierBundleCode` trong DB trước khi import.

---

### 🔴 LỖ HỔNG NGHIÊM TRỌNG

> **[BUG-07] Double-sell — tồn kho về âm**
> Đây là lỗ hổng nghiêm trọng nhất trong hệ thống. Khi 2+ người dùng đồng thời bán cùng bundle, không có cơ chế nào ngăn chặn. Hệ quả: `remainingBoards` âm, báo cáo tồn kho sai, hứa giao hàng mà không còn hàng.

> **[BUG-08] Xóa bundle không hoàn tác tồn kho**
> Nếu bundle đã bị deduct (đơn hàng đã thanh toán) rồi admin xóa bundle → kho vừa mất hàng (deduct) vừa mất record (xóa) → không biết hàng đi đâu.

---

### 💡 ĐỀ XUẤT

> **[UX-22]** Thêm link "Xem đơn hàng có bundle này" trong modal chi tiết.

> **[UX-23]** Thumbnail ảnh trong danh sách (không chỉ trong modal chi tiết).

> **[UX-24]** Khi tạo bundle mới, nếu chỉ có 1 container đang ở trạng thái "Đã về" → tự động điền `containerId`.

> **[UX-25]** Thêm nút "In QR hàng loạt" để in QR cho nhiều bundle cùng lúc.

---

---

# MÀNG HÌNH: ĐƠN HÀNG (PgSales)

### Mục đích
Tạo và quản lý toàn bộ chu trình đơn hàng: từ lập đơn → xác nhận thanh toán → xuất hàng → in hoá đơn.

### Trạng thái đơn hàng
```
Nháp  ─────────────────────────────────────────────────── (chưa confirm)
  ↓
Đơn hàng mới  ──────────────────────────────────────────  (đã confirm, chưa trả tiền)
  ↓
Đã thanh toán  ─[deduct inventory]──────────────────────  (đã trả, chờ giao)
  ↓
Đã xuất  ────────────────────────────────────────────────  (đã giao hàng)
```

### Tính toán tài chính
```
subtotal    = Σ(items[i].unitPrice × volume[i]) + Σ(services[j].amount)
taxAmount   = applyTax ? subtotal × 0.08 : 0
totalAmount = subtotal + taxAmount
remaining   = totalAmount - deposit
```

### Các trường dữ liệu — Order Item

| Field | Kiểu | Bắt buộc | Ghi chú |
|-------|------|----------|---------|
| bundleId | FK (optional) | ✗ | Nếu lấy từ kho |
| woodId | FK | ✓ | |
| attributes | object | ✓ | |
| boardCount | number | ✓ (> 0) | |
| volume | number m³ | ✓ (> 0) | |
| unit | enum m3/m2 | ✓ | |
| unitPrice | number VNĐ | ✓ (> 0) | Giá bán thực tế |
| listPrice | number VNĐ | ✗ | Giá niêm yết (để so sánh) |
| amount | number | ✓ (auto) | = unitPrice × volume |

---

### ✅ RÀNG BUỘC ĐANG ÁP DỤNG

- Phải chọn khách hàng trước khi tạo đơn
- Phải có ít nhất 1 item
- Block thanh toán nếu bundle không đủ `remainingBoards`
- Không thể xuất hàng trước khi đã thanh toán
- Auto-save draft vào localStorage mỗi 800ms
- Cảnh báo khi giá bán thấp hơn giá niêm yết (`listPrice`)
- Confirm dialog trước khi xóa đơn

---

### ⚠️ VALIDATION CÒN THIẾU

> **[V-23] Xóa đơn đã thanh toán không hoàn lại tồn kho**
> Khi admin xóa đơn hàng đã ở trạng thái "Đã thanh toán", hàm `deleteOrder()` chỉ xóa record order — không có logic hoàn trả `remainingBoards/remainingVolume` về bundle. Kết quả: kho bị trừ vĩnh viễn dù đơn không còn tồn tại.
> → **Cần thêm:** Trước khi xóa đơn đã thanh toán, hoàn trả inventory về các bundle liên quan + ghi log "Hoàn kho do hủy đơn [mã đơn]".

> **[V-24] Không có trạng thái "Đã hủy"**
> Hiện tại chỉ có xóa — không có hủy đơn với lý do. Không có audit trail cho đơn hàng bị hủy.
> → **Cần thêm:** Trạng thái "Đã hủy" với field `cancelReason` và `cancelledBy`. Hoàn kho tự động khi chuyển sang "Đã hủy" nếu đã thanh toán.

> **[V-25] Không kiểm tra hạn mức nợ khách hàng**
> `customer.debtLimit` và `customer.debtDays` chỉ lưu informational — không được kiểm tra khi tạo đơn mới với `debt > 0`.
> → **Nên thêm:** Cảnh báo (warning, không block) khi `debt` của đơn mới cộng với tổng nợ hiện tại của khách > `debtLimit`.

> **[V-26] VAT hardcoded 8%**
> Thuế suất 8% được hardcode trong code — nếu chính sách thuế thay đổi, phải sửa và redeploy app.
> → **Cần sửa:** Đưa vào bảng `system_config` với key `vat_rate`.

> **[V-27] Bán dưới giá niêm yết không cần approval**
> Nhân viên có thể tự giảm giá xuống 0 mà chỉ thấy cảnh báo màu vàng — không cần ai duyệt.
> → **Nên thêm:** Nếu giảm giá > X%, yêu cầu nhập mã duyệt từ admin hoặc gửi notification cho admin.

> **[V-28] Draft lưu localStorage — mất khi đổi máy**
> Nhân viên đang soạn đơn trên máy A, sang máy B là mất hết nháp.
> → **Nên thêm:** Lưu draft lên Supabase (status = 'Nháp') thay vì localStorage.

---

### 🔴 LỖ HỔNG NGHIÊM TRỌNG

> **[BUG-09] Xóa đơn đã thanh toán làm tồn kho sai vĩnh viễn**
> Kịch bản thực tế: Nhân viên lỡ tay xóa đơn đã thanh toán → hàng đã trừ khỏi kho nhưng đơn không còn → không ai biết kho tại sao giảm → không thể audit.

> **[BUG-10] Race condition double-sell**
> Hai nhân viên đồng thời tạo và thanh toán đơn cho cùng bundle → cả hai đều pass kiểm tra `remainingBoards` tại thời điểm họ check → cả hai đều deduct → tồn kho âm.

---

### 💡 ĐỀ XUẤT

> **[UX-26]** Thêm filter nhanh: "Hôm nay / Chờ xuất / Đã hoàn thành / Tất cả" ngay trên đầu danh sách.

> **[UX-27]** Search đơn theo mã đơn, tên khách hàng, ngày tạo.

> **[UX-28]** Nút "Nhân đôi đơn hàng" — copy đơn cũ thành nháp mới (tiện khi khách hay đặt lặp lại).

> **[UX-29]** Hiển thị tổng nợ hiện tại của khách hàng ngay trên form tạo đơn.

---

---

# MÀNG HÌNH: KHÁCH HÀNG (PgCustomers)

### Mục đích
Quản lý danh mục khách hàng — thêm/sửa/xóa, link tạo đơn hàng nhanh.

### Các trường dữ liệu

| Field | Kiểu | Bắt buộc | Ghi chú |
|-------|------|----------|---------|
| name | string | ✓ | Tên khách |
| phone1 | string | ✓ | Số điện thoại chính |
| address | string | ✓ | Địa chỉ |
| deliveryAddress | string | ✗ | Địa chỉ giao hàng (nếu khác) |
| phone2 | string | ✗ | SĐT phụ |
| companyName | string | ✗ | Công ty |
| interestedWoodTypes | string[] | ✗ | Loại gỗ quan tâm |
| debtLimit | number VNĐ | ✗ | Hạn mức nợ |
| debtDays | number | ✗ | Số ngày nợ tối đa |
| notes | string | ✗ | |

`customerCode` tự động sinh từ tên + địa chỉ + số điện thoại.

---

### ✅ RÀNG BUỘC ĐANG ÁP DỤNG

- `name`, `phone1`, `address` không được rỗng
- Confirm dialog trước khi xóa
- Link "Tạo đơn" → chuyển sang PgSales với khách hàng đã chọn sẵn

---

### ⚠️ VALIDATION CÒN THIẾU

> **[V-29] Xóa khách hàng không kiểm tra đơn hàng**
> Xóa khách hàng → các order có `customer_id` này vẫn còn trong DB nhưng mất liên kết → lịch sử đơn hàng không trace được về khách.
> → **Cần thêm:** Block xóa nếu khách đã có đơn hàng. Hoặc soft-delete (ẩn, không xóa hẳn).

> **[V-30] Không kiểm tra trùng số điện thoại**
> Có thể tạo 2 khách hàng khác nhau với cùng số điện thoại → data duplicate.
> → **Cần thêm:** Khi nhập `phone1`, check trùng trong DB và hiển thị cảnh báo "Số điện thoại này đã có trong hệ thống: [Tên khách hàng X]".

> **[V-31] debtLimit không được sử dụng thực tế**
> Field `debtLimit` và `debtDays` chỉ lưu thông tin — không có bất kỳ chỗ nào trong app check và cảnh báo khi vượt hạn mức.
> → **Cần kết nối:** Kiểm tra tổng nợ hiện tại vs `debtLimit` khi tạo đơn mới (xem [V-25]).

---

### 🔴 LỖ HỔNG NGHIÊM TRỌNG

> **[BUG-11] Orphaned orders khi xóa khách hàng**
> Xóa khách → orders mất `customer_id` → báo cáo doanh thu không biết đơn đó của ai → không kiểm toán được.

---

### 💡 ĐỀ XUẤT

> **[UX-30]** Tab "Lịch sử đơn hàng" trong chi tiết khách hàng — hiện tổng đơn, tổng giá trị, lần mua gần nhất.

> **[UX-31]** Badge "Nợ: X₫" hiển thị ngay trong danh sách nếu khách đang có nợ chưa trả.

> **[UX-32]** Filter khách theo loại gỗ quan tâm (`interestedWoodTypes`) để targeting khi có hàng mới về.

---

---

# PHÂN TÍCH TOÀN HỆ THỐNG

---

## TỔNG HỢP: VALIDATION CÒN THIẾU

| Mã | Màn hình | Vấn đề | Mức độ |
|----|----------|--------|--------|
| V-01 | Login | Không có Show/Hide password | 🟡 Trung bình |
| V-02 | Login | Không chặn brute-force thực sự | 🟠 Cao |
| V-03 | Dashboard | Biểu đồ không có tooltip | 🟡 Trung bình |
| V-04 | Dashboard | Không có link từ metric card | 🟡 Trung bình |
| V-05 | Bảng giá | Log giá mất khi reload | 🟠 Cao |
| V-06 | Bảng giá | Không có bulk price update | 🟢 Thấp |
| V-07 | Loại gỗ | Xóa gỗ không check bundles/orders | 🔴 Nghiêm trọng |
| V-08 | Loại gỗ | Đổi code không cảnh báo | 🟡 Trung bình |
| V-09 | Thuộc tính | Xóa value không check bundles | 🔴 Nghiêm trọng |
| V-10 | Thuộc tính | rangeGroup không check overlap | 🔴 Nghiêm trọng |
| V-11 | Thuộc tính | rangeGroup không check gap | 🟠 Cao |
| V-12 | Cấu hình | Bỏ value không cảnh báo bundles bị ẩn | 🔴 Nghiêm trọng |
| V-13 | Cấu hình | Không có preview matrix trước khi lưu | 🟡 Trung bình |
| V-14 | SKU | Không hiển thị tồn kho per SKU | 🟡 Trung bình |
| V-15 | Nhà cung cấp | Xóa NCC không check container/bundle | 🔴 Nghiêm trọng |
| V-16 | Nhà cung cấp | Tắt configurable không cảnh báo bundles | 🟠 Cao |
| V-17 | Container | Xóa container không check bundles | 🔴 Nghiêm trọng |
| V-18 | Container | Không reconcile volume | 🟠 Cao |
| V-19 | Container | Không cảnh báo khi mark kho mà chưa có bundle | 🟠 Cao |
| V-20 | Thủ kho | Xóa bundle không check order_items | 🔴 Nghiêm trọng |
| V-21 | Thủ kho | Không có locking → double-sell | 🔴 Nghiêm trọng |
| V-22 | Thủ kho | Import CSV trùng supplierBundleCode | 🟠 Cao |
| V-23 | Đơn hàng | Xóa đơn đã TT không hoàn kho | 🔴 Nghiêm trọng |
| V-24 | Đơn hàng | Không có trạng thái "Đã hủy" | 🔴 Nghiêm trọng |
| V-25 | Đơn hàng | debtLimit không enforce | 🟠 Cao |
| V-26 | Đơn hàng | VAT hardcoded 8% | 🟠 Cao |
| V-27 | Đơn hàng | Bán dưới giá không cần approval | 🟠 Cao |
| V-28 | Đơn hàng | Draft lưu localStorage mất khi đổi máy | 🟡 Trung bình |
| V-29 | Khách hàng | Xóa KH không check orders | 🔴 Nghiêm trọng |
| V-30 | Khách hàng | Không check trùng số điện thoại | 🟠 Cao |
| V-31 | Khách hàng | debtLimit không được dùng | 🟠 Cao |

---

## TỔNG HỢP: LỖ HỔNG NGHIÊM TRỌNG

| Mã | Mô tả | Hệ quả |
|----|-------|--------|
| BUG-01 | Password hardcoded trong JS | Lộ credential nếu bị decompile |
| BUG-02 | Orphaned bundles khi xóa loại gỗ | Dữ liệu kho không trace được |
| BUG-03 | Orphaned bundle attributes khi xóa value | Bundle không tra được giá → không bán được |
| BUG-04 | Config thay đổi ẩn bundle/giá cũ | Tồn kho ẩn nhưng vẫn chiếm báo cáo |
| BUG-05 | Orphaned container/bundle khi xóa NCC | Mất nguồn gốc hàng |
| BUG-06 | Mất truy xuất nguồn gốc khi xóa container | Không audit được lô hàng |
| BUG-07 | Double-sell → tồn kho âm | Hứa giao hàng nhưng không có |
| BUG-08 | Xóa bundle đã deduct không khôi phục kho | Kho sai vĩnh viễn |
| BUG-09 | Xóa đơn đã thanh toán không hoàn kho | Kho sai, không audit được |
| BUG-10 | Race condition double-sell | Hai nhân viên bán cùng bundle |
| BUG-11 | Orphaned orders khi xóa khách hàng | Doanh thu không audit được |

---

## ĐỀ XUẤT KIẾN TRÚC HỆ THỐNG

### 1. Soft Delete thay vì Hard Delete
Thêm `deleted_at` timestamp cho tất cả bảng quan trọng. Ẩn khỏi UI thay vì xóa hẳn. Giữ được audit trail và tránh cascade FK errors.

**Ưu tiên áp dụng cho:** `wood_types`, `attributes`, `suppliers`, `containers`, `wood_bundles`, `customers`, `orders`

### 2. Inventory Transaction Log
Thay vì dùng trường `remaining_volume` có thể bị corrupt, tạo bảng `inventory_transactions`:
```
{ bundle_id, type: 'import'|'sell'|'cancel'|'adjust',
  delta_boards, delta_volume, order_id, user_id, timestamp, note }
```
Tổng tồn kho = SUM(transactions). Không bao giờ mất lịch sử.

### 3. Optimistic Locking cho Bundles
Thêm `version INTEGER` vào `wood_bundles`. Khi deduct inventory:
```sql
UPDATE wood_bundles
   SET remaining_boards = remaining_boards - ?,
       remaining_volume = remaining_volume - ?,
       version = version + 1
 WHERE id = ? AND version = ?
```
Nếu version không khớp → báo lỗi "Hàng vừa được cập nhật bởi người khác. Hãy tải lại."

### 4. Order Status Machine rõ ràng

| Transition | Điều kiện | Hành động phụ |
|-----------|-----------|---------------|
| → Đã thanh toán | Tất cả bundle đủ hàng | Deduct inventory |
| → Đã xuất | Đã thanh toán | Upload ảnh bắt buộc |
| → Đã hủy (từ mọi trạng thái) | Có lý do hủy | Hoàn kho nếu đã TT |

### 5. System Config Table
```sql
CREATE TABLE system_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO system_config VALUES
  ('vat_rate',                '0.08'),
  ('low_inventory_threshold', '5'),
  ('max_discount_pct',        '15');
```

### 6. Cross-module Navigation
Thêm breadcrumb links:
- Bundle → Container → NCC
- Bundle → Đơn hàng có bundle này
- Khách hàng → Lịch sử đơn hàng
- Container → Danh sách bundles đã nhập

---

## BẢNG ƯU TIÊN TRIỂN KHAI

| Ưu tiên | Mã | Vấn đề | Màn hình | Effort |
|---------|----|--------|----------|--------|
| 🔴 P0 — Khẩn cấp | BUG-09, V-23 | Xóa đơn đã TT không hoàn kho | PgSales | Nhỏ |
| 🔴 P0 — Khẩn cấp | BUG-07, BUG-10, V-21 | Double-sell race condition | API + PgSales | Trung bình |
| 🔴 P0 — Khẩn cấp | V-20 | Xóa bundle không check orders | PgWarehouse | Nhỏ |
| 🔴 P0 — Khẩn cấp | V-24 | Thêm trạng thái "Đã hủy" + hoàn kho | PgSales | Trung bình |
| 🟠 P1 — Quan trọng | V-07, BUG-02 | Block xóa gỗ khi có bundles | PgWT | Nhỏ |
| 🟠 P1 — Quan trọng | V-09, BUG-03 | Block xóa value khi có bundles | PgAT | Nhỏ |
| 🟠 P1 — Quan trọng | V-10 | Validate rangeGroup overlap | PgAT | Nhỏ |
| 🟠 P1 — Quan trọng | V-12, BUG-04 | Cảnh báo khi bỏ value khỏi config | PgCFG | Nhỏ |
| 🟠 P1 — Quan trọng | V-15, BUG-05 | Block xóa NCC khi có bundles | PgNCC | Nhỏ |
| 🟠 P1 — Quan trọng | V-17, BUG-06 | Block xóa container khi có bundles | PgContainer | Nhỏ |
| 🟠 P1 — Quan trọng | V-29, BUG-11 | Block xóa khách hàng có orders | PgCustomers | Nhỏ |
| 🟡 P2 — Nên làm | V-26 | VAT config hóa (không hardcode) | PgSales | Nhỏ |
| 🟡 P2 — Nên làm | V-25, V-31 | debtLimit enforcement | PgSales | Trung bình |
| 🟡 P2 — Nên làm | V-27 | Approval cho bán dưới giá | PgSales | Trung bình |
| 🟡 P2 — Nên làm | V-05 | Lịch sử giá persist qua reload | PgPrice | Nhỏ |
| 🟡 P2 — Nên làm | V-28 | Draft lưu Supabase thay localStorage | PgSales | Trung bình |
| 🟡 P2 — Nên làm | BUG-01 | Password không hardcode trong JS | auth.js | Lớn |
| 🟢 P3 — Cải thiện | V-03 | Tooltip biểu đồ Dashboard | PgDashboard | Nhỏ |
| 🟢 P3 — Cải thiện | V-18 | Reconcile volume container vs bundle | PgContainer | Nhỏ |
| 🟢 P3 — Cải thiện | UX-30 | Lịch sử đơn hàng per khách | PgCustomers | Trung bình |
| 🟢 P3 — Cải thiện | UX-19 | Cross-module navigation | Toàn bộ | Trung bình |

---

*Tài liệu phân tích hệ thống GTH Pricing — Phiên bản 2.0 — 2026-03-18*
