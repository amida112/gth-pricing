# CLAUDE.md

Hướng dẫn cho Claude Code khi làm việc với repo này. Ngôn ngữ phân tích và trao đổi: **tiếng Việt**.

## Commands

```bash
npm install       # Cài dependency
npm start         # Dev server tại http://localhost:3000
npm run build     # Build production
```

Chưa có test suite.

---

## Quy trình làm việc

- **Phân tích và trao đổi bằng tiếng Việt** trong suốt quá trình làm việc.
- **Luôn gửi câu lệnh SQL đi kèm vào nhắc thực thi** khi cần update/migrate/thêm mới, chỉnh sửa, hay xóa tính năng.
- **Sau khi sửa xong một module lớn**, brainstorm lại: nghiệp vụ có hợp lý không? Có điểm nào chưa tối ưu? Đề xuất cải tiến nếu có.
- **Trước khi implement module mới hoặc thay đổi lớn**: brainstorm, trao đổi, làm rõ nghiệp vụ và đề xuất phương án bằng lời trước. Đặc biệt khi thay đổi ảnh hưởng nhiều module.
- **Khi có tính năng mới, sửa tính năng cũ phức tạp, hoặc khối lượng công việc nhiều**:
  1. Luôn **đề xuất hướng xử lý nghiệp vụ hợp lý** — phân tích ưu/nhược, so sánh phương án.
  2. **Đề xuất thiết kế UI/UX** — mô tả layout, flow thao tác, trước khi code.
  3. **Trình bày phương án triển khai** — chia giai đoạn, ưu tiên, dependency giữa các phần.
  4. Luôn **xem xét dữ liệu cũ để migration** — kiểm tra DB có data cần chuyển đổi không, đề xuất SQL migration, verify sau khi chạy.
  5. Mỗi bước đều cần user xác nhận trước khi chuyển sang bước tiếp theo.
- **Khi đọc code để implement tính năng**: ưu tiên đọc đúng file chứa module liên quan (xem bảng cấu trúc file bên dưới), không cần đọc toàn bộ codebase.
- Commit chỉ khi user yêu cầu.

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
├── auth.js              # Danh sách user, phân quyền theo role, session
├── api.js               # Tất cả API call đến Supabase backend
├── utils.js             # Hàm tiện ích: bpk(), initWT/AT/CFG, genPrices, THEME
├── index.js             # Entry point React
│
├── useTableSort.js      # Hook sort bảng: toggleSort, sortIcon, applySort
│
├── components/
│   ├── AppHeader.js     # Thanh header trên cùng (logo, tên user, logout)
│   ├── Dialog.js        # Reusable dialog: ESC, Enter, focus trap
│   ├── Login.js         # Màn hình đăng nhập
│   ├── Matrix.js        # Bảng giá (Matrix, ECell, WoodPicker, autoGrp)
│   └── Sidebar.js       # Menu điều hướng trái
│
├── pages/
│   ├── PgDashboard.js   # Tổng quan: doanh thu, tồn kho, đơn hàng gần đây
│   ├── PgPrice.js       # Bảng giá gỗ (chọn gỗ, layout trục, Matrix, log)
│   ├── PgWT.js          # Quản lý loại gỗ (CRUD)
│   ├── PgAT.js          # Quản lý thuộc tính gỗ (quality, thickness, ...)
│   ├── PgCFG.js         # Cấu hình bảng giá theo từng loại gỗ
│   ├── PgSKU.js         # Xem tất cả SKU và giá (read-only)
│   ├── PgSales.js       # Quản lý đơn hàng bán
│   ├── PgCustomers.js   # Quản lý khách hàng
│   ├── PgWarehouse.js   # Quản lý kho (bundle/kiện gỗ)
│   ├── PgReconciliation.js # Đối soát chuyển khoản (Sepay, match thủ công)
│   ├── PgNCC.js         # Quản lý nhà cung cấp
│   └── PgContainer.js   # Quản lý container nhập hàng
│
└── data/
    └── vnProvinces.js   # Danh sách tỉnh/thành phố Việt Nam
```

---

## Architecture

SPA React 18 (Create React App). Backend là **Supabase** (PostgreSQL + Realtime + Auth) qua `src/api.js` sử dụng `@supabase/supabase-js`.

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
| `useAPI` | bool | API Supabase load thành công chưa |
| `user` | object | User đang đăng nhập `{ username, role, label }` |

Khi mount, `App` gọi `loadAllData()` từ API. Nếu fail → dùng data cứng từ `initWT/AT/CFG/genPrices` — app chạy offline được.

---

## Phân quyền (auth.js)

### Roles và quyền hạn

| Quyền | admin | banhang | kho | viewer (chưa login) |
|-------|-------|---------|-----|---------------------|
| Sửa giá (`ce`) | ✓ | ✗ | ✗ | ✗ |
| Xem giá gốc (`seeCostPrice`) | ✓ | ✗ | ✗ | ✗ |
| Quản lý đơn hàng (`ceSales`) | ✓ | ✓ | ✗ | ✗ |
| Quản lý kho (`ceWarehouse`) | ✓ | ✗ | ✓ | ✗ |
| NCC/Container chỉ thêm mới | ✗ | ✗ | ✓ | ✗ |

### Trang được phép truy cập

| Role | Trang mặc định | Trang được phép |
|------|---------------|-----------------|
| admin | dashboard | Tất cả |
| banhang | sales | sales, customers, pricing, dashboard |
| kho | warehouse | warehouse, suppliers, containers, dashboard |
| viewer | pricing | pricing |

**Lưu ý**: Auth là local UI state + localStorage session. Password hash SHA-256, không có server-side auth.

---

## Nghiệp vụ từng màn hình

### PgDashboard — Tổng quan
**Mục đích**: Cái nhìn nhanh về tình trạng kinh doanh.
- KPI cards: tổng doanh thu, số đơn, tổng m³ đã bán, tồn kho
- Biểu đồ doanh thu theo thời gian
- Cảnh báo tồn kho thấp (< 5 m³ một loại gỗ — `LOW_INVENTORY_THRESHOLD`)
- Đơn hàng gần đây
- Tất cả roles có thể xem; admin xem đầy đủ nhất

### PgPrice — Bảng giá
**Mục đích**: Xem và cập nhật bảng giá gỗ theo thuộc tính.
- Chọn loại gỗ → Matrix render bảng giá 2 trục (row-attrs vs header-attrs)
- User có thể kéo thuộc tính giữa trục dọc/ngang per-session
- `ug` (group thickness): gộp các hàng dày giống nhau để gọn bảng
- Admin: click cell → sửa giá → dialog `RDlg` yêu cầu nhập lý do → lưu
- Banhang/viewer: chỉ xem; banhang không thấy giá gốc

### PgWT — Loại gỗ
**Mục đích**: CRUD danh mục loại gỗ.
- Chỉ admin: thêm/sửa/xóa loại gỗ (tên VN, tên EN, icon)
- Khi xóa loại gỗ → cascade xóa toàn bộ giá liên quan

### PgAT — Thuộc tính gỗ
**Mục đích**: Quản lý định nghĩa các chiều thuộc tính toàn cục (quality, thickness, supplier, ...).
- Admin: thêm/sửa/xóa attribute; `groupable` = attribute dùng gộp hàng trong Matrix
- `ats[].values` chỉ là **template mặc định** — khi bật attribute cho loại gỗ lần đầu thì pre-fill từ đây, sau đó mỗi loại gỗ quản lý giá trị riêng trong PgCFG
- Khi **đổi tên giá trị** tại PgAT → `handleRenameAttrVal` migrate toàn bộ price keys + bundle attributes (tất cả loại gỗ)
- Attribute `supplier` đặc biệt: giá trị tự động đồng bộ từ danh sách NCC có `configurable = true`

### PgCFG — Cấu hình loại gỗ
**Mục đích**: Cấu hình đầy đủ cho từng loại gỗ — attribute nào dùng, giá trị nào có, nhóm dài thế nào, NCC nào định giá riêng.

**Model `cfg[woodId]`:**
```
{
  attrs: ["thickness","quality","length","supplier"],  // attr bật cho loại gỗ này
  attrValues: {                                        // ← NGUỒN DUY NHẤT cho chip values, riêng từng gỗ
    thickness: ["2F","3F","4F"],
    quality:   ["Fas","1COM"],
    length:    ["1.6-1.9m","1.9-2.5m","2.8-4.9m"],   // label nhóm dài
    supplier:  ["Missouri","ATLC","Midwest","Khác"],
  },
  rangeGroups: {                                       // chỉ tồn tại nếu bật, riêng từng gỗ
    length: [
      { label:"1.6-1.9m", min:1.3, max:1.9 },        // min/max là số mét thực tế
      { label:"1.9-2.5m", min:1.9, max:2.79 },
      { label:"2.8-4.9m", min:2.79, max:5 },
    ]
  },
  attrPriceGroups: {                                   // nhóm giá NCC, riêng từng gỗ
    supplier: { default:"Chung", special:["Missouri","ATLC"] }
  },
  defaultHeader: ["length"],                           // attr hiển thị ngang trong bảng giá
}
```

**Chip values per-wood** — mỗi loại gỗ thêm/sửa/xóa giá trị chip riêng trong PgCFG. Loại gỗ khác muốn cùng giá trị phải tạo lại. Khi đổi tên chip tại PgCFG → `handleRenameAttrValForWood` migrate giá + bundle chỉ của loại gỗ đó.

**Nhóm dài (rangeGroups)** — chỉ dùng cho attribute `length`. Khi bật:
- Người nhập kho gõ chiều dài thực (VD: `1.82`m) → hệ thống tự khớp vào nhóm `"1.9-2.5m"` qua `resolveRangeGroup()`
- Bundle lưu `attributes.length = "1.9-2.5m"` (nhóm, dùng tra bảng giá) + `rawMeasurements.length = "1.82"` (thực tế, chỉ hiển thị)
- Nhóm label hiển thị kèm số thực trong danh sách kho, BundlePicker, và bảng sản phẩm đơn hàng
- Migrate section xuất hiện **chỉ khi** có nhóm orphaned (label cũ còn trong kho nhưng đã bị xóa/đổi tên trong config)

**Nhóm giá NCC (attrPriceGroups)** — gộp nhiều NCC thành ít cột trong bảng giá:
- NCC trong `special` → mỗi NCC có **hàng/cột riêng** trong bảng giá
- NCC không trong `special` → gom chung vào nhóm `default` (VD: "Chung"), định giá một lần
- Bundle vẫn lưu NCC thực tế; bảng giá lookup dùng tên nhóm qua `getPriceGroupValues()`
- Cấu hình NCC: thêm tại PgNCC → bật `Cấu hình = Có` → xuất hiện làm chip supplier trong PgCFG

### PgSKU — Danh sách SKU
**Mục đích**: Xem toàn bộ SKU combinations và giá tương ứng (read-only).
- Liệt kê đầy đủ tất cả tổ hợp thuộc tính × loại gỗ
- Dùng để kiểm tra/export báo cáo

### PgSales — Đơn hàng bán
**Mục đích**: Tạo và quản lý đơn bán hàng.
- Banhang + admin: full CRUD đơn hàng
- Đơn hàng gồm: khách hàng, danh sách sản phẩm (bundle từ kho), dịch vụ, phí vận chuyển
- Tính tổng: subtotal → VAT 8% (chỉ trên hàng hóa, không trên dịch vụ/vận chuyển) → total
- Đọc số thành chữ tiếng Việt (`soThanhChu`) cho in hóa đơn
- `NumInput`: input số với format ngăn cách hàng nghìn (vi-VN dấu chấm)
- Trạng thái đơn: pending → confirmed → delivered → paid
- Deposit (đặt cọc) và debt (công nợ) tracking

### PgCustomers — Khách hàng
**Mục đích**: CRM đơn giản cho khách hàng.
- Banhang + admin: full CRUD
- Thông tin: tên, điện thoại, công ty, địa chỉ (tỉnh/huyện/xã chuẩn VN)
- Tọa độ xưởng: pick bằng bản đồ Leaflet (lazy load từ CDN)
- Hạn mức công nợ (`debtLimit`) và số ngày nợ (`debtDays`)
- Loại gỗ quan tâm (`interestedWoodTypes`) để phân loại khách

### PgWarehouse — Kho gỗ (Bundle)
**Mục đích**: Quản lý từng kiện gỗ trong kho.
- Thủ kho + admin: full CRUD kiện gỗ
- Mỗi bundle: loại gỗ, kích thước, chất lượng, thể tích (m³), trạng thái, ảnh
- Trạng thái bundle: `Kiện nguyên` → `Chưa được bán` → `Kiện lẻ` → `Đã bán`
- Liên kết với nhà cung cấp qua attribute `supplier`
- Upload ảnh kiện gỗ (preview local trước khi submit)
- Cảnh báo giá: so sánh giá kho với bảng giá hiện tại

### PgNCC — Nhà cung cấp
**Mục đích**: Danh mục nhà cung cấp gỗ.
- Admin: full CRUD; Thủ kho: chỉ thêm mới (`addOnly`)
- `configurable`: NCC này có hiển thị trong dropdown attribute khi nhập kho không
- Khi tắt `configurable` mà NCC đang gắn với bundle → cảnh báo

### PgContainer — Container nhập hàng
**Mục đích**: Theo dõi lô hàng nhập từ container.
- Admin: full CRUD; Thủ kho: chỉ thêm mới (`addOnly`)
- Trạng thái container: `Tạo mới` → `Đang vận chuyển` → `Đã về` → `Đã nhập kho`
- Mỗi container có danh sách items (loại gỗ, dày, chất lượng, thể tích)
- Lazy load items khi expand container row

---

## Key components (src/components/)

- **`Dialog`** — Reusable dialog/modal. ESC = close, Enter = OK (trừ textarea/noEnter), focus trap, auto-focus. Mọi dialog mới phải dùng component này.
- **`Matrix`** — Bảng giá 2D. Tách attrs thành row-attrs và header-attrs. Gộp hàng khi `ug` bật.
- **`ECell`** — Ô giá có thể sửa. Click để edit (chỉ admin), Enter/blur để commit.
- **`RDlg`** — Dialog xác nhận yêu cầu nhập lý do trước khi lưu thay đổi giá.
- **`autoGrp`** — Gộp các giá trị thickness liên tiếp có giá giống nhau.
- **`WoodPicker`** — Dropdown chọn loại gỗ, dùng ở Matrix và PgWarehouse.
- **`AppHeader`** — Header với logo, tên user, nút logout.
- **`Sidebar`** — Menu trái, filter theo `perms.pages`.

---

## API (src/api.js)

Sử dụng `@supabase/supabase-js` client kết nối trực tiếp Supabase (PostgreSQL):
- CRUD qua `sb.from('table').select/insert/update/delete`
- Price update: optimistic UI update trước khi API complete
- Realtime: dùng `supabase.channel().on('postgres_changes', ...)` cho cross-session sync
- Config: `SUPABASE_URL` và `SUPABASE_KEY` khai báo đầu file `src/api.js`

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

### 4. Bảng: Độ rộng cột
- Bảng giữ `width: 100%` (responsive).
- Cột hẹp (mã code, ngày, trạng thái, số, actions): `whiteSpace: 'nowrap'`.
- Chỉ 1–2 cột "chính" (tên, ghi chú, địa chỉ) được phép wrap — override `whiteSpace: 'normal'`.
- Số tiền luôn `textAlign: 'right'`.

### 5. Dialog (`src/components/Dialog.js`)
Mọi dialog/modal phải dùng component `<Dialog>`:
```jsx
<Dialog open={bool} onClose={fn} onOk={fn} title="..." width={460} noEnter={false}
  okLabel="Lưu" cancelLabel="Hủy" hideFooter={false}>
  {children}
</Dialog>
```
- **ESC** → onClose (luôn bật).
- **Enter** → onOk (trừ textarea, trừ khi `noEnter=true`).
- **Focus trap**: Tab xoay vòng trong dialog.
- Dùng `noEnter` cho dialog có textarea, picker, hoặc Enter có nghĩa khác.
- Không đóng khi click backdrop.
- **Nút footer**: Dialog có prop `showFooter` để tự render nút Hủy + OK.
  - `showFooter={true}` — bật footer tự động (mặc định `false` để backward-compatible với dialog cũ tự render nút).
  - `okLabel` (mặc định 'OK') — text nút submit, tùy nghiệp vụ: 'Lưu', 'Xác nhận', 'Thêm', 'Đồng ý'...
  - `cancelLabel` (mặc định 'Hủy') — text nút đóng.
  - **Dialog mới** nên dùng `showFooter` thay vì tự render nút.
  - **Dialog cũ** đã tự render nút → giữ nguyên, không cần sửa.
- **Quy tắc bắt buộc**: mọi action dialog (tạo/sửa/xóa/xác nhận) phải có nút submit visible. Không được chỉ dựa vào Enter/ESC.

### 6. UI Feedback
- **Tooltip bắt buộc**: mọi element có `textOverflow: 'ellipsis'` phải có `title={fullText}`.
- **Hover row**: clickable `<tr>` thêm `data-clickable="true"` → CSS `tr[data-clickable]:hover { background: var(--hv) }`.
- **Button active**: global CSS `button:active:not(:disabled) { transform: scale(0.97) }`.
- **Transition**: clickable non-button (chip, sortable th) thêm `transition: 'all 0.12s'`.
- **Loading**: button async hiện "Đang lưu..." + `disabled={saving}`.

---

## Conventions — Hàm & Pattern

- `bpk(woodId, attrs)` — tạo price key, attrs **sort alpha**. Dùng nhất quán mọi nơi.
- `resolvePriceAttrs(cfg, woodId, ats)` — resolve attrs applicable cho loại gỗ, có xử lý attrPriceGroups (map NCC thực → tên nhóm).
- `resolveRangeGroup(rawValue, rangeGroups)` — map số thực đo sang label nhóm; gọi với `cfg[woodId].rangeGroups?.[atId]`.
- `getPriceGroupValues(cfg, woodId, atId)` — trả về danh sách giá trị hiển thị trong bảng giá sau khi gộp nhóm NCC.
- `handleRenameAttrVal` (App) — đổi tên chip toàn cục từ PgAT, migrate tất cả loại gỗ.
- `handleRenameAttrValForWood` (App) — đổi tên chip per-wood từ PgCFG, migrate chỉ loại gỗ đó.
- `NumInput` component — input số với format vi-VN, dùng ở PgSales và PgCustomers.
- Toast notification qua `notify(text, ok)` — truyền từ App xuống tất cả pages.
- Màu sắc trạng thái bundle nhất quán: xanh lá = Kiện nguyên, tím = Chưa được bán, cam = Kiện lẻ, nâu = Đã bán.
- Thứ tự hiển thị thuộc tính: `ATTR_DISPLAY_ORDER = ['thickness', 'quality', 'supplier', 'edging', 'width', 'length']`.
