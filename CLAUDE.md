# CLAUDE.md

Hướng dẫn cho Claude Code khi làm việc với repo này. Ngôn ngữ phân tích và trao đổi: **tiếng Việt**.

## Commands

```bash
npm install       # Cài dependency
npm start         # Dev server tại http://localhost:3000
npm run build     # Build production
npx vitest        # Chạy unit tests (src/__tests__/)
```

---

## Quy trình làm việc

- **Phân tích và trao đổi bằng tiếng Việt** trong suốt quá trình làm việc.
- **Luôn gửi câu lệnh SQL đi kèm vào nhắc thực thi** khi cần update/migrate/thêm mới, chỉnh sửa, hay xóa tính năng.
- **Thay đổi DB (bảng, cột, trigger, function, RLS)** chạy trực tiếp trên project `tscddgjkelnmlitzcxyg` — hiện đang dùng làm production thật, chưa tách staging riêng. Mọi migration cần test kỹ trước khi chạy.
- **Sau khi sửa xong một module lớn**, brainstorm lại: nghiệp vụ có hợp lý không? Có điểm nào chưa tối ưu? Đề xuất cải tiến nếu có.
- **Trước khi implement module mới hoặc thay đổi lớn**: brainstorm, trao đổi, làm rõ nghiệp vụ và đề xuất phương án bằng lời trước. Đặc biệt khi thay đổi ảnh hưởng nhiều module.
- **Khi có tính năng mới, sửa tính năng cũ phức tạp, hoặc khối lượng công việc nhiều**:
  1. Luôn **đề xuất hướng xử lý nghiệp vụ hợp lý** — phân tích ưu/nhược, so sánh phương án.
  2. **Đề xuất thiết kế UI/UX** — mô tả layout, flow thao tác, trước khi code.
  3. **Trình bày phương án triển khai** — chia giai đoạn, ưu tiên, dependency giữa các phần.
  4. Luôn **xem xét dữ liệu cũ để migration** — kiểm tra DB có data cần chuyển đổi không, đề xuất SQL migration, verify sau khi chạy.
  5. Mỗi bước đều cần user xác nhận trước khi chuyển sang bước tiếp theo.
- **Luôn ưu tiên ngôn ngữ tự nhiên**: khi mô tả, trình bày, đề xuất nghiệp vụ, flow, phương án — dùng ngôn ngữ tự nhiên (tiếng Việt), tránh dùng thuật ngữ kỹ thuật trừ khi cần thiết. Mục tiêu: người không biết code cũng hiểu được.
- **Khi đọc code để implement tính năng**: ưu tiên đọc đúng file chứa module liên quan (xem bảng cấu trúc file bên dưới), không cần đọc toàn bộ codebase.
- Commit chỉ khi user yêu cầu. **Không tự ý commit + push** — luôn chờ xác nhận trước khi thực hiện.
- **Trước khi commit + push**, bắt buộc:
  1. Kiểm tra `git status` — đảm bảo không còn file source untracked hoặc modified chưa staged.
  2. Build local: `CI=true npx react-scripts build` — phải pass (giống môi trường Vercel).
  3. Chỉ push khi build thành công. Nếu fail → fix lỗi trước.

### Cập nhật tài liệu nghiệp vụ

Repo có 3 tầng tài liệu:
- **CLAUDE.md** (file này): Cấu trúc file, convention code, hướng dẫn sửa
- **BUSINESS.md**: Nghiệp vụ chi tiết — tại sao, rule gì, ảnh hưởng chéo, ví dụ thực tế
- **DATA_MODEL.md**: Schema DB, quan hệ bảng, luồng dữ liệu, mapping JS↔DB

**Sau khi hoàn thành implement một nghiệp vụ mới / cách xử lý mới / thêm bảng DB**, chủ động hỏi user:

> "Nghiệp vụ [X] đã xong. Anh muốn bổ sung vào tài liệu không? Tôi sẽ cập nhật:
> - BUSINESS.md: mô tả bài toán, giải pháp, ràng buộc, ví dụ
> - DATA_MODEL.md: schema bảng mới / cột mới, data flow
> - CLAUDE.md: file/function mới nếu cần"

Viết **khi kiến thức còn nóng** — ngay sau khi code, không để sau. Ghi ưu tiên:
1. **Bài toán thực tế** gây ra yêu cầu (VD: "kiện 2F-D đủ đo cần giá riêng")
2. **Ví dụ cụ thể** từ dữ liệu thật (VD: "A2073D: 2F → tra giá 2.2F")
3. **Ảnh hưởng chéo** giữa các module (VD: "ảnh hưởng kho, bán hàng, rename chip")
4. **Ràng buộc** bằng ngôn ngữ tự nhiên (VD: "giá trị override phải tồn tại trong cfg.attrValues")

---

## Cấu trúc file

```
src/
├── App.js               # Root component — state toàn cục, routing, load data
├── auth.js              # User cứng + phân quyền (role, nhóm quyền, session)
├── api.js               # Barrel re-export từ api/index.js
├── utils.js             # Hàm tiện ích: bpk(), fmtDate/Money, THEME, resolveRangeGroup...
├── index.js             # Entry point React
├── useTableSort.js      # Hook sort bảng: toggleSort, sortIcon, applySort
│
├── api/                 # API modules (Supabase client)
│   ├── index.js         # Barrel — re-export tất cả module
│   ├── client.js        # Supabase client instance (URL, KEY)
│   ├── woodTypes.js     # CRUD loại gỗ
│   ├── attributes.js    # CRUD thuộc tính
│   ├── woodConfig.js    # Config bảng giá per-wood
│   ├── prices.js        # Giá, rename, migrate keys
│   ├── bundles.js       # Kiện gỗ (CRUD, lock/unlock)
│   ├── bundleMeasurements.js # Đo lường kiện (dong cạnh)
│   ├── containers.js    # Container nhập hàng
│   ├── shipments.js     # Lô hàng vận chuyển
│   ├── orders.js        # Đơn hàng bán
│   ├── customers.js     # Khách hàng
│   ├── suppliers.js     # Nhà cung cấp
│   ├── carriers.js      # Đơn vị vận tải
│   ├── catalog.js       # Catalog sản phẩm
│   ├── rawWood.js       # Gỗ nguyên liệu (tròn/hộp)
│   ├── rawWoodPricing.js # Định giá gỗ NL
│   ├── rawWoodSales.js  # Bán gỗ NL
│   ├── rawWoodWithdrawals.js # Xuất kho gỗ NL
│   ├── sawing.js        # Xẻ gỗ
│   ├── sawnInspection.js # Nghiệm thu gỗ xẻ
│   ├── kiln.js          # Lò sấy
│   ├── edging.js        # Dong cạnh
│   ├── conversionRates.js # Tỷ lệ quy đổi sấy
│   ├── inventoryAdjustment.js # Điều chỉnh tồn kho
│   ├── bankAccounts.js  # Tài khoản ngân hàng
│   ├── bankTransactions.js # Giao dịch + đối soát Sepay
│   ├── creditRefunds.js # Hoàn tiền tín dụng
│   ├── dashboard.js     # Dữ liệu dashboard
│   ├── settings.js      # Cài đặt hệ thống
│   ├── users.js         # Quản lý user động
│   ├── permissionGroups.js # Nhóm quyền chi tiết
│   ├── auditLogs.js     # Nhật ký hệ thống
│   ├── employees.js     # Nhân viên + phòng ban
│   ├── attendance.js    # Chấm công
│   ├── leaves.js        # Nghỉ phép
│   ├── payroll.js       # Bảng lương
│   ├── commission.js    # Hoa hồng bán hàng
│   └── extraWork.js     # Công thêm giờ
│
├── utils/               # Utility modules chuyên biệt
│   ├── attendance.js    # Tính công, ca làm việc
│   ├── auditHelper.js   # Helper ghi audit log
│   ├── commission.js    # Tính hoa hồng
│   └── packingListCsv.js # Export packing list CSV
│
├── components/
│   ├── AppHeader.js     # Thanh header (logo, user, logout, mobile menu)
│   ├── Dialog.js        # Reusable dialog: ESC, Enter, focus trap
│   ├── Login.js         # Màn hình đăng nhập (hỗ trợ user động từ DB)
│   ├── Matrix.js        # Bảng giá (Matrix, ECell, WoodPicker, RDlg, ConfirmDlg)
│   ├── Sidebar.js       # Menu điều hướng trái
│   ├── BoardDetailDialog.js  # Dialog chi tiết dong cạnh (board layout)
│   ├── InventoryAdjustment.js # Điều chỉnh tồn kho (duyệt, từ chối)
│   ├── MeasurementPicker.js   # Chọn/xem đo lường kiện (MeasurementTable, MeasurementList)
│   └── SawnInspectionTab.js   # Tab nghiệm thu gỗ xẻ trong container
│
├── pages/
│   │ # ── Giá & Cấu hình ──
│   ├── PgDashboard.js   # Tổng quan: KPI, doanh thu, tồn kho
│   ├── PgPrice.js       # Bảng giá gỗ (chọn gỗ, layout trục, Matrix)
│   ├── PgWT.js          # Quản lý loại gỗ (CRUD)
│   ├── PgAT.js          # Quản lý thuộc tính (quality, thickness...)
│   ├── PgCFG.js         # Cấu hình bảng giá per-wood
│   ├── PgSKU.js         # Xem tất cả SKU và giá (read-only)
│   │ # ── Kho & Sản xuất ──
│   ├── PgWarehouse.js   # Quản lý kho gỗ kiện (bundle)
│   ├── PgRawWood.js     # Gỗ nguyên liệu (tròn/hộp, packing list)
│   ├── PgSawing.js      # Xẻ gỗ (batch, input/output)
│   ├── PgKiln.js        # Lò sấy (batch, tỷ lệ quy đổi)
│   ├── PgEdging.js      # Dong cạnh (batch, đo lường)
│   │ # ── Bán hàng & Khách hàng ──
│   ├── PgSales.js       # Quản lý đơn hàng bán
│   ├── PgCustomers.js   # Quản lý khách hàng (CRM)
│   ├── PgReconciliation.js # Đối soát chuyển khoản (Sepay webhook)
│   │ # ── Nhập hàng & Vận chuyển ──
│   ├── PgNCC.js         # Nhà cung cấp
│   ├── PgContainer.js   # Container nhập hàng
│   ├── PgShipment.js    # Lô hàng vận chuyển (gom container)
│   ├── PgCarriers.js    # Đơn vị vận tải
│   │ # ── Nhân sự & Lương ──
│   ├── PgEmployees.js   # Quản lý nhân viên + phòng ban
│   ├── PgAttendance.js  # Chấm công (theo ca, tháng)
│   ├── PgPayroll.js     # Bảng lương (tính lương, tạm ứng)
│   ├── PgCommissionConfig.js # Cấu hình hoa hồng bán hàng
│   │ # ── Hệ thống ──
│   ├── PgUsers.js       # Quản lý user (superadmin)
│   ├── PgPermGroups.js  # Nhóm quyền chi tiết
│   ├── PgPermissions.js # Phân quyền user → nhóm quyền
│   └── PgAuditLog.js    # Nhật ký hệ thống (audit trail)
│
├── data/
│   ├── vnProvinces.js   # Danh sách tỉnh/thành phố
│   └── vnDistricts.js   # Danh sách quận/huyện
│
└── __tests__/utils/     # Unit tests cho utility functions
    ├── bpk.test.js, alias.test.js, autoGrp.test.js, ...
```

---

## Architecture

SPA React 18 (Create React App). Backend là **Supabase** (PostgreSQL + Realtime + Auth) qua `src/api/` sử dụng `@supabase/supabase-js`.

### Data model — Giá gỗ

Giá lưu dạng flat object, key là chuỗi composite do `bpk(woodId, attrs)` tạo ra:
```
"walnut||quality:Fas||thickness:2F"  →  { price: 18.5, updated: "2026-03-11" }
```
Các attribute trong key **luôn sort theo alphabet**. Format này dùng xuyên suốt cho lookup và update giá.

### State toàn cục (quản lý trong `App`)

| State | Kiểu | Mô tả |
|-------|------|-------|
| `wts` | array | Loại gỗ (id, name, nameEn, icon) |
| `ats` | array | Định nghĩa thuộc tính (id, name, values[], groupable) |
| `cfg` | object | Config bảng giá theo từng loại gỗ |
| `prices` | object | Flat price map keyed by `bpk()` |
| `logs` | array | Lịch sử thay đổi giá (local, không persist) |
| `suppliers` | array | Danh sách nhà cung cấp |
| `customers` | array | Danh sách khách hàng |
| `bundles` | array | Kiện gỗ trong kho |
| `allContainers` | array | Tất cả container nhập hàng |
| `carriers` | array | Đơn vị vận tải |
| `useAPI` | bool | API Supabase load thành công chưa |
| `user` | object | User đang đăng nhập `{ username, role, label, permissionGroupId }` |

Khi mount, `App` gọi `loadAllData()` từ API. Nếu fail → dùng data cứng từ `initWT/AT/CFG/genPrices` — app chạy offline được.

---

## Phân quyền (auth.js)

### Roles

| Role | Label | Mô tả |
|------|-------|-------|
| `superadmin` | Super Admin | Toàn quyền, quản lý user, không thể xóa |
| `admin` | Quản trị viên | Toàn quyền nghiệp vụ |
| `banhang` | Bán hàng | Đơn hàng, khách hàng, xem giá |
| `kho` | Thủ kho | Kho, sản xuất (xẻ/sấy/dong cạnh), NCC |
| `ketoan` | Kế toán | Đối soát, xem đơn hàng, nhân sự/lương |

### Quyền hạn (PERM_DEFS)

| Key | Label | admin | banhang | kho | ketoan |
|-----|-------|-------|---------|-----|--------|
| `ce` | Sửa giá | ✓ | ✗ | ✗ | ✗ |
| `seeCostPrice` | Xem giá gốc | ✓ | ✗ | ✗ | ✗ |
| `ceSales` | Quản lý đơn hàng | ✓ | ✓ | ✗ | ✗ |
| `ceWarehouse` | Quản lý kho | ✓ | ✗ | ✓ | ✗ |
| `cePayment` | Đối soát thanh toán | ✓ | ✗ | ✗ | ✓ |
| `viewSales` | Xem đơn hàng (chỉ đọc) | ✓ | — | — | ✓ |
| `addOnlyNCC` | NCC (chỉ thêm) | ✗ | ✗ | ✓ | ✗ |
| `addOnlyContainer` | Container (chỉ thêm) | ✗ | ✗ | ✓ | ✗ |
| `ceEmployees` | Quản lý nhân sự | ✓ | ✗ | ✗ | ✓ |

### Trang mặc định theo role

| Role | Trang mặc định | Trang được phép |
|------|---------------|-----------------|
| superadmin | dashboard | Tất cả + quản lý user |
| admin | dashboard | Tất cả |
| banhang | sales | sales, customers, pricing, dashboard |
| kho | warehouse | warehouse, raw_wood, sawing, kiln, edging, sales, suppliers, shipments, dashboard |
| ketoan | reconciliation | reconciliation, sales, customers, employees, attendance, payroll, dashboard |

### Hệ thống quyền mới (Nhóm quyền)

Ngoài role-based mặc định, hệ thống hỗ trợ **nhóm quyền chi tiết** (PgPermGroups + PgPermissions):
- Mỗi nhóm quyền gồm danh sách permission keys (VD: `sales.create`, `warehouse.edit`, `pricing.see_cost`)
- User được gán vào nhóm quyền → `derivePermsFromKeys()` tự động derive pages + flags
- Fallback về DEFAULT_ROLE_PERMS nếu user không có nhóm quyền

**Lưu ý**: Auth là local UI state + localStorage session. Password hash SHA-256, không có server-side auth.

---

## Nghiệp vụ từng màn hình

### PgDashboard — Tổng quan
- KPI cards: doanh thu, số đơn, m³ đã bán, tồn kho
- Biểu đồ doanh thu theo thời gian
- Cảnh báo tồn kho thấp
- Đơn hàng gần đây

### PgPrice — Bảng giá
- Chọn loại gỗ → Matrix render bảng giá 2 trục (row-attrs vs header-attrs)
- Kéo thuộc tính giữa trục dọc/ngang per-session
- `ug` (group thickness): gộp hàng dày giống nhau
- Admin: click cell → sửa giá → `RDlg` nhập lý do → lưu
- Banhang/viewer: chỉ xem

### PgWT — Loại gỗ
- Admin: CRUD loại gỗ (tên VN, tên EN, icon, code, unit, pricing_mode)
- Xóa loại gỗ → cascade xóa giá liên quan

### PgAT — Thuộc tính gỗ
- Admin: CRUD attribute; `groupable` = dùng gộp hàng trong Matrix
- `ats[].values` = **template mặc định** — pre-fill khi bật attribute lần đầu cho loại gỗ
- Đổi tên giá trị → `handleRenameAttrVal` migrate toàn bộ price keys + bundle attributes
- Attribute `supplier`: giá trị đồng bộ từ NCC có `configurable = true`

### PgCFG — Cấu hình loại gỗ
Cấu hình per-wood: attribute nào dùng, giá trị chip, nhóm dài, nhóm giá NCC.

**Model `cfg[woodId]`:**
```
{
  attrs: ["thickness","quality","length","supplier"],
  attrValues: { thickness: ["2F","3F"], quality: ["Fas","1COM"], ... },
  rangeGroups: { length: [{ label:"1.6-1.9m", min:1.3, max:1.9 }, ...] },
  attrPriceGroups: { supplier: { default:"Chung", special:["Missouri","ATLC"] } },
  attrAliases: { thickness: { "2F": "2.2F" } },
  defaultHeader: ["length"],
}
```

**Nhóm dài (rangeGroups)** — dùng cho attribute continuous (length, width):
- Nhập số thực → `resolveRangeGroup()` khớp vào nhóm label
- Bundle lưu nhóm trong `attributes` + số thực trong `rawMeasurements`

**Nhóm giá NCC (attrPriceGroups)** — gộp NCC thành ít cột bảng giá:
- `special` → cột riêng; còn lại → gom vào `default`
- Lookup qua `getPriceGroupValues()`

### PgSKU — Danh sách SKU
- Xem toàn bộ tổ hợp thuộc tính × loại gỗ (read-only)

### PgWarehouse — Kho gỗ kiện
- CRUD kiện gỗ (bundle): loại gỗ, kích thước, chất lượng, thể tích m³, ảnh
- Trạng thái: `Kiện nguyên` → `Kiện lẻ` → `Đã bán` (kho trừ ngay khi thêm vào đơn)
- Upload ảnh, cảnh báo giá

### PgRawWood — Gỗ nguyên liệu
- Quản lý gỗ tròn/hộp nhập khẩu
- Packing list, inspection (nghiệm thu), bán gỗ NL

### PgSawing — Xẻ gỗ
- Batch xẻ: input gỗ NL → output kiện gỗ xẻ
- Liên kết với lò sấy

### PgKiln — Lò sấy
- Batch sấy: nhập kiện → sấy → xuất kiện
- Tỷ lệ quy đổi thể tích (conversion rates)

### PgEdging — Dong cạnh
- Batch dong cạnh: input kiện → đo lường board → output

### PgSales — Đơn hàng bán
- CRUD đơn hàng: khách hàng, sản phẩm (bundle), dịch vụ, vận chuyển
- Tính tổng: subtotal → VAT → total
- Trạng thái: pending → confirmed → delivered → paid
- Deposit (đặt cọc), debt (công nợ), payment records
- In hóa đơn (`soThanhChu` — đọc số thành chữ)

### PgCustomers — Khách hàng
- CRM: tên, ĐT, công ty, địa chỉ (tỉnh/huyện/xã chuẩn VN)
- Tọa độ xưởng (Leaflet map), hạn mức công nợ, loại gỗ quan tâm

### PgReconciliation — Đối soát
- Tự động match giao dịch ngân hàng (Sepay webhook) với đơn hàng
- Match thủ công, bỏ qua, hoàn tiền

### PgNCC — Nhà cung cấp
- Admin: full CRUD; Thủ kho: chỉ thêm (`addOnly`)
- `configurable`: hiển thị trong dropdown attribute supplier

### PgContainer — Container nhập hàng
- Trạng thái: `Tạo mới` → `Đang vận chuyển` → `Đã về` → `Đã nhập kho`
- Items: loại gỗ, dày, chất lượng, thể tích
- Tab nghiệm thu gỗ xẻ (SawnInspectionTab)

### PgShipment — Lô hàng vận chuyển
- Gom nhiều container thành lô hàng
- Gán đơn vị vận tải (carrier)

### PgCarriers — Đơn vị vận tải
- CRUD đơn vị vận tải

### PgEmployees — Nhân viên
- Quản lý nhân viên + phòng ban
- Mã nhân viên tự tăng

### PgAttendance — Chấm công
- Chấm công theo ca, theo tháng
- Cài đặt ca làm việc, BHXH

### PgPayroll — Bảng lương
- Tính lương theo tháng, tạm ứng lương
- Duyệt bảng lương

### PgCommissionConfig — Hoa hồng
- Cấu hình tỷ lệ hoa hồng theo loại gỗ/SKU

### PgUsers — Quản lý User (superadmin only)
- CRUD user động (lưu DB), gán role/nhóm quyền

### PgPermGroups — Nhóm quyền
- Tạo/sửa nhóm quyền với danh sách permission keys chi tiết

### PgPermissions — Phân quyền
- Gán user vào nhóm quyền

### PgAuditLog — Nhật ký hệ thống
- Xem lịch sử thao tác (audit trail), filter theo module/user/thời gian

---

## Key components (src/components/)

- **`Dialog`** — Reusable dialog/modal. ESC = close, Enter = OK (trừ textarea/noEnter), focus trap. Mọi dialog mới phải dùng component này.
- **`Matrix`** — Bảng giá 2D. Exports: `WoodPicker`, `RDlg`, `ConfirmDlg`.
- **`BoardDetailDialog`** — Dialog chi tiết dong cạnh (board layout, packing list).
- **`InventoryAdjustment`** — Component điều chỉnh tồn kho (duyệt/từ chối).
- **`MeasurementPicker`** — Chọn và xem đo lường kiện. Exports: `MeasurementTable`, `MeasurementList`.
- **`SawnInspectionTab`** — Tab nghiệm thu gỗ xẻ, nhúng trong PgContainer.
- **`AppHeader`** — Header với logo, tên user, nút logout, mobile menu.
- **`Sidebar`** — Menu trái, filter theo `perms.pages`.

---

## API (src/api/)

Tổ chức thành **29 module** trong `src/api/`, barrel export qua `src/api/index.js` → re-export tại `src/api.js`.

- Client: `src/api/client.js` — `SUPABASE_URL` và `SUPABASE_KEY`
- CRUD qua `sb.from('table').select/insert/update/delete`
- Price update: optimistic UI update trước khi API complete
- Realtime: `supabase.channel().on('postgres_changes', ...)` cho cross-session sync
- File upload: `sb.storage` cho ảnh kiện gỗ

---

## UI Conventions

### 1. Realtime Update
- **Optimistic update**: cập nhật state local ngay khi user submit, rollback + toast lỗi nếu API fail.
- **Cross-session realtime** qua Supabase `postgres_changes` cho table quan trọng: `prices`, `orders`, `bundles`, `containers`.
- Table ít thay đổi (wood_types, attributes, wood_config, customers, suppliers) không cần realtime.

### 2. Font & Typography
- Font chính: **Inter** (global tại `index.html`).
- `font-variant-numeric: tabular-nums` global trên body — số đều chiều rộng.
- Không thêm `fontVariantNumeric` inline (đã có global).
- Monospace chỉ dùng cho mã code (bundleCode, orderCode, containerCode...).
- **Trang in** (PgSales): font body `Segoe UI, Arial`, monospace `Consolas, monospace`.
- Tiêu đề cột sản phẩm trang in: "Mô tả hàng hóa" — chỉ hiện giá trị attr trong SKU_KEY, thứ tự: thickness → quality → supplier → edging → width → length.

### 3. Bảng: Filter & Sort

**Hook `useTableSort`** (`src/useTableSort.js`) — dùng chung cho tất cả bảng cần sort:
```js
const { sortField, sortDir, toggleSort, sortIcon, applySort } = useTableSort('defaultField', 'asc');
```

**Inline filter trong thead** (dòng filter nằm **trên** dòng tiêu đề):
```jsx
<thead>
  <tr style={{ background: 'var(--bgs)' }}>
    <td style={{ padding: '5px 6px' }}>
      <select style={{ width: '100%', fontSize: '0.76rem', padding: '4px 8px', borderRadius: 4, border: '1px solid var(--bd)', outline: 'none' }}>
        <option value="">Tất cả</option>
      </select>
    </td>
    <td style={{ padding: '5px 6px' }} /> {/* Cột không cần filter → trống */}
  </tr>
  <tr>
    <th onClick={() => toggleSort('field')} style={{ cursor: 'pointer' }}>Tên cột{sortIcon('field')}</th>
  </tr>
</thead>
```

**Quy tắc:**
- WoodPicker luôn tách riêng phía trên bảng, KHÔNG gộp chung panel với filter.
- Dynamic columns (PgWarehouse, PgSales BundleSelector): filter ẩn/hiện theo cấu hình loại gỗ.
- Filter logic giữ riêng từng trang (quá khác nhau để gom).

### 4. Bảng: Độ rộng cột & STT
- Bảng giữ `width: 100%` (responsive).
- **Cột STT bắt buộc**: mọi bảng danh sách phải có cột STT đầu tiên — hiển thị số thứ tự dựa trên index sau khi filter+sort (`{i + 1}`), width cố định 36–40px, `textAlign: 'center'`, font-size nhỏ hơn (`0.68rem`), color mờ (`var(--tm)`).
- Cột hẹp (mã code, ngày, trạng thái, số, actions): `whiteSpace: 'nowrap'`.
- Chỉ 1–2 cột "chính" (tên, ghi chú, địa chỉ) được phép wrap — override `whiteSpace: 'normal'`.
- Số tiền luôn `textAlign: 'right'`.

### 4a. Bảng: Chống lệch tiêu đề — `<colgroup>` + `table-layout: fixed`

**Quy tắc bắt buộc cho mọi bảng danh sách mới**:

1. **Dùng `<colgroup>`** khai báo width cho từng cột — thay vì đặt `width` trên `<th>`:
```jsx
<table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
  <colgroup>
    <col style={{ width: 36 }} />        {/* STT */}
    <col style={{ width: 100 }} />       {/* Mã */}
    <col />                              {/* Tên — chiếm phần còn lại */}
    <col style={{ width: 90 }} />        {/* Ngày */}
    <col style={{ width: 70 }} />        {/* Actions */}
  </colgroup>
</table>
```

2. **`tableLayout: 'fixed'`** bắt buộc.
3. **Số cell phải khớp** giữa filter row, header row, data row — cùng số cột với `<colgroup>`.
4. **Expand row** dùng `colSpan` = tổng số cột. Nên dùng constant (`const COLS = 11`).
5. **Cột co giãn**: chỉ 1–2 cột chính KHÔNG set width → tự chia phần còn lại.

**Bảng cũ đã ổn định** → không cần refactor. Chỉ áp dụng khi tạo bảng mới hoặc sửa bảng đang bị lệch.

### 4b. Format ngày tháng & số tiền
**Hàm chung trong `src/utils.js`** — bắt buộc dùng, KHÔNG tự định nghĩa local:
- `fmtDate(d)` → `"04/04/2026"` (dd/mm/yyyy). Thêm `{ yearOff: true }` → `"04/04"` (dd/mm).
- `fmtDateTime(d)` → `"04/04/2026 14:30"` (dd/mm/yyyy HH:mm).
- `fmtMoney(v)` → `"1.500.000"` (dấu chấm ngăn cách hàng nghìn, locale vi-VN).
- `fmtMoneyShort(n)` → `"1,5 tỷ"` / `"15 tr"` / `"500.000 đ"` (rút gọn cho dashboard).
- **KHÔNG** dùng `toLocaleDateString('vi-VN')` trực tiếp.
- **KHÔNG** dùng `.slice(0, 10)` trên date string.
- **KHÔNG** định nghĩa `fmtDate`, `fmtMoney` local trong page — luôn import từ utils.

### 5. Dialog (`src/components/Dialog.js`)
Mọi dialog/modal phải dùng component `<Dialog>`:
```jsx
<Dialog open={bool} onClose={fn} onOk={fn} title="..." width={460} noEnter={false}
  okLabel="Lưu" cancelLabel="Hủy" showFooter={true}>
  {children}
</Dialog>
```
- **ESC** → onClose (luôn bật). **Enter** → onOk (trừ textarea, trừ khi `noEnter=true`).
- **Focus trap**: Tab xoay vòng trong dialog. Không đóng khi click backdrop.
- `showFooter={true}` — bật footer tự động (mặc định `false` cho backward-compatible).
- **Dialog mới** nên dùng `showFooter`. **Dialog cũ** tự render nút → giữ nguyên.
- **Quy tắc**: mọi action dialog phải có nút submit visible.

### 6. UI Feedback
- **Tooltip bắt buộc**: mọi element có `textOverflow: 'ellipsis'` phải có `title={fullText}`.
- **Hover row**: clickable `<tr>` thêm `data-clickable="true"` → CSS `tr[data-clickable]:hover { background: var(--hv) }`.
- **Button active**: global CSS `button:active:not(:disabled) { transform: scale(0.97) }`.
- **Transition**: clickable non-button (chip, sortable th) thêm `transition: 'all 0.12s'`.
- **Loading**: button async hiện "Đang lưu..." + `disabled={saving}`.

---

## Conventions — Hàm & Pattern

### Hàm tiện ích (src/utils.js)
- `bpk(woodId, attrs)` — tạo price key, attrs **sort alpha**. Dùng nhất quán mọi nơi.
- `resolvePriceAttrs(cfg, woodId, ats)` — resolve attrs applicable cho loại gỗ, xử lý attrPriceGroups.
- `resolveRangeGroup(rawValue, rangeGroups)` — map số thực → label nhóm.
- `getPriceGroupValues(cfg, woodId, atId)` — giá trị hiển thị bảng giá sau khi gộp nhóm NCC.
- `resolveAlias(cfg, woodId, atId, val)` — resolve alias cho attribute value.
- `normalizeThickness(val)` — chuẩn hóa giá trị thickness.
- `cart(arrays)` — cartesian product cho tổ hợp thuộc tính.
- `calcSvcAmount(svc, cfg)` / `svcLabel(svc)` — tính tiền + label dịch vụ.
- `getConfigIssues(cfg, woodId, ats)` — kiểm tra lỗi config.
- `THEME` — object CSS variables cho theme gỗ.
- `INV_STATUS` — trạng thái hàng hóa container (màu sắc, label).

### Pattern chung
- `handleRenameAttrVal` (App) — đổi tên chip toàn cục từ PgAT, migrate tất cả loại gỗ.
- `handleRenameAttrValForWood` (App) — đổi tên chip per-wood từ PgCFG, migrate chỉ loại gỗ đó.
- `NumInput` component — input số format vi-VN, định nghĩa local trong PgSales/PgCustomers.
- `soThanhChu` — đọc số thành chữ tiếng Việt, định nghĩa local trong PgSales.
- `ATTR_DISPLAY_ORDER` — thứ tự hiển thị attr, định nghĩa local trong PgSales.
- Toast notification qua `notify(text, ok)` — truyền từ App xuống tất cả pages.
- Audit logging qua `logAction()` từ `src/api/auditLogs.js`.
- Màu trạng thái bundle: xanh lá = Kiện nguyên, cam = Kiện lẻ, nâu = Đã bán.
- Tồn kho trừ ngay khi thêm kiện vào đơn (`deductBundle`), cộng ngay khi gỡ (`restoreBundle`). Lưu đơn không làm gì với kho.
- Chống bán trùng bằng Supabase realtime (App.js subscribe `wood_bundles`), không dùng status "Chưa được bán".
