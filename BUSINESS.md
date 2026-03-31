# BUSINESS.md — Nghiệp vụ GTH Pricing

Tài liệu mô tả **toàn bộ nghiệp vụ** của hệ thống quản lý gỗ cứng GTH.
Dùng để developer hoặc AI hiểu **tại sao** hệ thống hoạt động như vậy, từ đó implement/rebuild chính xác.

> **Quy tắc**: Mỗi nghiệp vụ bắt đầu bằng bài toán thực tế → giải pháp → ràng buộc → ví dụ cụ thể.

---

## 1. Tổng quan mô hình kinh doanh

### 1.1 Công ty làm gì
GTH kinh doanh gỗ cứng nhập khẩu (hardwood): Óc Chó, Sồi Đỏ, Sồi Trắng, Tần Bì, Dẻ Gai, v.v.
Mua từ NCC (nhà cung cấp) quốc tế → nhập container → nhập kho (kiện gỗ) → bán cho khách hàng (xưởng nội thất, xây dựng).

### 1.2 Luồng hàng chính
```
NCC (Supplier)
  → Shipment (lô hàng / chuyến tàu)
    → Container (cont nhập hàng)
      → Kho (wood_bundles — kiện gỗ)
        → Đơn hàng (orders — bán cho khách)
          → Thanh toán (payment_records)
```

### 1.3 Luồng gỗ nguyên liệu (raw wood)
```
NCC → Container (gỗ tròn/hộp)
  → Nghiệm thu (raw_wood_inspection)
    → Lô gỗ (raw_wood_lots)
      → Mẻ xẻ (sawing_batches)
        → Mẻ sấy (kiln_batches)
          → Xếp loại (packing_sessions)
            → Kiện gỗ thành phẩm (wood_bundles)
```

### 1.4 Các role trong hệ thống

| Role | Công việc chính | Trang mặc định |
|------|----------------|-----------------|
| superadmin | Toàn quyền + quản lý user | dashboard |
| admin | Quản lý giá, cấu hình, kho, bán hàng | dashboard |
| banhang | Tạo đơn hàng, quản lý khách hàng | sales |
| kho | Nhập kho, quản lý kiện gỗ, container | warehouse |
| ketoan | Đối soát thanh toán, xem đơn hàng (read-only) | reconciliation |
| viewer | Chỉ xem bảng giá (chưa đăng nhập) | pricing |

---

## 2. Định giá (Pricing) — Domain phức tạp nhất

### 2.1 Mô hình giá chuẩn

**Bài toán**: Mỗi loại gỗ có nhiều thuộc tính (dày, chất lượng, NCC, dài, rộng, dong cạnh). Giá phụ thuộc vào **tổ hợp** tất cả thuộc tính.

**Giải pháp**: Giá lưu dạng flat map, key là chuỗi composite:
```
"walnut||edging:Dong cạnh||quality:AB||thickness:2.5F" → { price: 18.5, updated: "2026-03-11" }
```

- Key tạo bởi hàm `bpk(woodId, attrs)`, attributes **luôn sort theo alphabet**
- Bảng giá hiển thị dạng ma trận 2D: trục dọc (row-attrs) × trục ngang (header-attrs)
- Admin chọn thuộc tính nào là header, thuộc tính nào là row trong `cfg[woodId].defaultHeader`

**3 chế độ định giá (pricing mode)**:

| Mode | Khi nào | Cách lưu giá |
|------|---------|-------------|
| **m³ (mặc định)** | Gỗ cứng tiêu chuẩn | `prices[bpk].price` = tr/m³ |
| **m²** | Gỗ mỏng / ván | `prices[bpk].price` = k/m² (lẻ kiện), `.price2` = k/m² (nguyên kiện) |
| **perBundle** | Gỗ thông / đặc biệt | `bundle.unitPrice` = tr/m³ trên từng kiện |

**Ví dụ thực tế**:
- Óc Chó 2.5F / AB / Dong cạnh → 18.5 tr/m³
- Tần Bì 2F / Fas / Missouri → 12.8 tr/m³
- Gỗ thông kiện #PT-20260301-005 → 8.2 tr/m³ (giá riêng kiện)

### 2.2 Giá gốc (Cost Price)

**Bài toán**: Admin cần biết biên lợi nhuận giữa giá bán và giá nhập.

**Giải pháp**: Trường `costPrice` tùy chọn trong mỗi ô giá. Chỉ admin (`seeCostPrice`) mới thấy.

### 2.3 Chỉnh sửa giá — Batch edit + lý do

**Luồng chỉnh sửa**:
1. Admin bật chế độ chỉnh sửa trên bảng giá
2. Click ô → Dialog nhập giá mới + giá gốc + lý do
3. Tùy chọn "Áp dụng cho độ dày khác" → batch apply cùng giá cho nhiều thickness
4. Các thay đổi tích lũy trong `pendingChanges` (hiển thị nền vàng)
5. Click "Kết thúc" → nhập lý do chung cho cả batch → lưu tất cả
6. Mỗi thay đổi tạo bản ghi trong `change_log` để audit

**Ràng buộc**: Bắt buộc nhập lý do trước khi lưu thay đổi giá.

### 2.4 Nhóm giá NCC (attrPriceGroups)

**Bài toán**: Có 10 NCC nhưng chỉ cần 3 mức giá. Ví dụ Missouri giá riêng, ATLC giá riêng, 8 NCC còn lại giá chung.

**Giải pháp — `attrPriceGroups`**:
```javascript
cfg[woodId].attrPriceGroups = {
  supplier: {
    default: "Chung",                    // nhóm mặc định
    special: ["Missouri", "ATLC"]        // NCC có giá riêng
  }
}
```

- NCC trong `special` → có hàng/cột riêng trong bảng giá
- NCC không trong `special` → gom chung vào nhóm `default` ("Chung"), định giá một lần
- Bundle vẫn lưu NCC thực tế; khi tra giá, `resolvePriceAttrs()` map NCC → tên nhóm
- Cấu hình NCC: thêm tại PgNCC → bật `configurable = true` → xuất hiện làm chip supplier trong PgCFG

**Ví dụ**:
- Kiện óc chó từ Missouri → tra giá theo key `...||supplier:Missouri||...`
- Kiện óc chó từ Midwest → tra giá theo key `...||supplier:Chung||...`

**Migration khi thay đổi nhóm**:
- NCC chuyển từ default → special: copy giá từ key "Chung" sang key NCC
- NCC chuyển từ special → default: xóa key NCC riêng

### 2.5 Nhóm dài / nhóm rộng (rangeGroups)

**Bài toán**: Chiều dài/rộng thực tế là số liên tục (1.82m, 2.35m). Cần gom thành nhóm để định giá.

**Giải pháp — `rangeGroups`**:
```javascript
cfg[woodId].rangeGroups = {
  length: [
    { label: "1.6-1.9m", min: 1.3, max: 1.9 },
    { label: "1.9-2.5m", min: 1.9, max: 2.79 },
    { label: "2.8-4.9m", min: 2.79, max: 5 }
  ]
}
```

- Người nhập kho gõ chiều dài thực (`1.82`) → `resolveRangeGroup()` tự khớp vào nhóm `"1.6-1.9m"`
- Bundle lưu cả 2:
  - `attributes.length = "1.6-1.9m"` (nhóm — dùng tra giá)
  - `rawMeasurements.length = "1.82"` (thực tế — chỉ hiển thị)
- Khi thay đổi boundary nhóm → bundle có thể thành orphan → migrate UI hiện ra

### 2.6 Alias thuộc tính (attrAliases)

**Bài toán**: NCC ghi chất lượng là "A" nhưng bảng giá dùng "AB". Cần map tự động.

**Giải pháp**:
```javascript
cfg[woodId].attrAliases = {
  quality: { "AB": ["A", "B"] },      // "A" hoặc "B" → tra giá theo "AB"
  width: { "20-29": ["19-29"] }        // "19-29" → tra giá theo "20-29"
}
```

Khi tra giá, `resolvePriceAttrs()` tự động chuyển alias → giá trị chính trước khi tạo price key.

### 2.7 Gộp dày tự động (autoGrp / thickness grouping)

**Bài toán**: Nhiều mức dày (2F, 2.2F, 2.5F) có giá giống nhau → gộp hiển thị cho gọn bảng.

**Giải pháp**: `autoGrp(woodId, cfg, prices)` so sánh "fingerprint giá" (tất cả giá ở mọi tổ hợp thuộc tính khác):
- 2F và 2.2F có giá giống nhau ở mọi chất lượng, NCC → gộp thành "2-2.2F"
- Toggle bật/tắt bởi `ugPersist` (persist across sessions)
- Khi chỉnh giá ô gộp → áp dụng cho tất cả thành viên

### 2.8 Điều chỉnh giá riêng kiện (priceAdjustment)

**Bài toán**: Kiện gỗ đặc biệt cần giá khác so với bảng giá chuẩn (VD: gỗ đẹp hơn trung bình → +5%, hoặc gỗ bị lỗi nhẹ → -2 tr/m³).

**Giải pháp — `bundle.priceAdjustment`**:
```javascript
priceAdjustment: {
  type: 'percent' | 'absolute',
  value: -10,                          // -10% hoặc -2.5 tr/m³
  reason: "Kiện xấu hơn trung bình"   // bắt buộc
}
```

- `percent`: `giá_cuối = giá_bảng × (1 + value/100)`
- `absolute`: `giá_cuối = giá_bảng + value`
- Giá bảng gốc vẫn hiển thị (gạch ngang), giá cuối hiển thị đậm
- **Không thay đổi SKU_KEY** — chỉ thay đổi giá cuối

### 2.9 Đổi mã tra giá (priceAttrsOverride)

**Bài toán**: Kiện A2073**D** thực tế là 2F nhưng "đủ đo" hơn kiện 2F thông thường (D = đủ đo). Cần định giá như hàng 2.2F trong bảng giá, nhưng vẫn ghi nhận kiện là 2F.

**Giải pháp — `bundle.priceAttrsOverride`**:
```javascript
priceAttrsOverride: { thickness: "2.2F" },    // chỉ chứa attr bị override
priceOverrideReason: "Kiện 2F-D đủ đo, định giá theo 2.2F"
```

- **Tách biệt** thuộc tính vật lý (`attributes.thickness = "2F"`) vs thuộc tính tra giá (`priceAttrsOverride.thickness = "2.2F"`)
- Khi tra giá: `lookupAttrs = { ...attributes, ...priceAttrsOverride }` → rồi mới gọi `bpk()`
- **Kết hợp được với `priceAdjustment`**: override SKU trước, rồi điều chỉnh % sau
- Danh sách kiện hiện badge "SKU≠" (tím) với tooltip chi tiết
- Giá trị override phải tồn tại trong `cfg.attrValues` của loại gỗ đó (validate qua UI dropdown)

**Ví dụ end-to-end**:
```
Kiện A2073D: Tần Bì xẻ, thuộc tính gốc (2F, A, 19-29)
→ priceAttrsOverride: { thickness: "2.2F" }
→ Tra giá: bpk("ash", { thickness: "2.2F", quality: "A", width: "19-29" })
→ Hiển thị: giá 2.2F thay vì giá 2F
→ Kho và bán hàng đều thấy badge "SKU≠" + tooltip lý do
```

**Ảnh hưởng chéo**:
- PgWarehouse: tra giá, hiển thị badge, UI chỉnh override
- PgSales BundlePicker: tra giá khi thêm vào đơn, hiện badge
- Rename chip (PgAT/PgCFG): migrate cả `priceAttrsOverride`

### 2.10 Chuỗi resolve giá đầy đủ

Khi cần tra giá cho 1 kiện gỗ, hệ thống đi qua các bước:
```
bundle.attributes                          ← thuộc tính vật lý
  → merge priceAttrsOverride (nếu có)      ← đổi mã tra giá
  → resolvePriceAttrs():
      1. Filter chỉ configured attrs       ← bỏ attr không dùng
      2. resolveRangeGroup()                ← số thực → nhóm label
      3. resolveAlias()                     ← alias → canonical
      4. resolvePriceGroup()                ← NCC → nhóm giá
  → bpk(woodId, resolvedAttrs)             ← tạo key
  → prices[key].price                      ← giá bảng
  → apply priceAdjustment (nếu có)         ← điều chỉnh +/-
  → GIÁ CUỐI CÙNG
```

---

## 3. Kho gỗ (Warehouse / Bundles)

### 3.1 Kiện gỗ là gì

Mỗi **kiện (bundle)** là một bó gỗ vật lý trong kho, có mã riêng, thuộc tính riêng, được theo dõi từ lúc nhập đến lúc bán.

**Mã kiện**: `PREFIX-YYYYMMDD-NNN` (VD: `OC-20260301-005`)
- PREFIX = mã loại gỗ (viết hoa, tối đa 6 ký tự)
- YYYYMMDD = ngày tạo
- NNN = số thứ tự trong ngày

### 3.2 Vòng đời kiện gỗ

```
Kiện nguyên  →  Chưa được bán (Hold)  →  Kiện lẻ  →  Đã bán
     ↕                 ↕                    ↕
   (nhập kho)      (admin hold)        (bán 1 phần)   (bán hết)
```

| Trạng thái | Ý nghĩa | Màu |
|------------|---------|-----|
| Kiện nguyên | Chưa bán tấm nào, đầy đủ | Xanh lá |
| Chưa được bán | Admin hold — tạm khóa không cho bán | Tím |
| Kiện lẻ | Đã bán một phần tấm | Cam |
| Đã bán | Hết hàng (remainingBoards = 0) | Nâu |

**Chuyển trạng thái**:
- Kiện nguyên/Kiện lẻ → Hold: Admin bấm "Hold" (khóa bán)
- Hold → Kiện nguyên/Kiện lẻ: Admin bấm "Bỏ hold" (tùy đã bán phần nào chưa)
- Khi tạo đơn hàng: hệ thống tự trừ tấm → chuyển sang Kiện lẻ hoặc Đã bán

### 3.3 Nhập kho

**Từ container**: Tạo container → thêm items → nhập kho tạo bundles
**Nhập trực tiếp**: Tạo bundle mới, gán thuộc tính, nhập số tấm + thể tích

**Thông tin kiện**:
- Loại gỗ, thuộc tính (thickness, quality, supplier, edging, width, length)
- Số tấm ban đầu (`boardCount`) + thể tích (`volume`)
- Mã kiện NCC (`supplierBundleCode`) — mã gốc của nhà cung cấp
- Vị trí kho (`location`)
- Ảnh kiện + ảnh chi tiết
- Ghi chú bán hàng (`notes`)

### 3.4 Soft lock khi bán

**Bài toán**: 2 nhân viên bán hàng cùng lúc chọn 1 kiện → bán trùng.

**Giải pháp**: `lockBundle(bundleId, lockedBy)` — khi nhân viên mở dialog chọn kiện, kiện bị lock. Nhân viên khác thấy kiện đang bị lock và không chọn được.

### 3.5 Cảnh báo giá kho

So sánh giá bán hiện tại của kiện với bảng giá chuẩn. Nếu lệch → cảnh báo.

---

## 4. Đơn hàng bán (Sales)

### 4.1 Luồng tạo đơn

```
Chọn khách hàng
  → Mở BundlePicker chọn kiện gỗ
    → Filter theo loại gỗ, thuộc tính, trạng thái
    → Tick chọn các kiện cần bán
    → Hệ thống tự tra giá cho từng kiện
  → Thêm dịch vụ (xẻ sấy, vận chuyển...)
  → Nhập phí ship, đặt cọc, công nợ
  → Lưu đơn hàng
```

### 4.2 Tính giá trong đơn

Mỗi order item tra giá theo chuỗi resolve (mục 2.10):
- m³: `unitPrice` = tr/m³, `amount` = unitPrice × volume (triệu đồng)
- m²: `unitPrice` = k/m², `amount` = unitPrice × area (nghìn đồng). Nguyên kiện dùng `price2`, lẻ kiện dùng `price`.
- perBundle: `unitPrice` = `bundle.unitPrice` (gán sẵn trên kiện)

### 4.3 Tính tổng đơn hàng

```
itemsTotal  = Σ (item.amount)                    ← tổng hàng hóa
svcTotal    = Σ (service.amount)                  ← tổng dịch vụ
subtotal    = itemsTotal + svcTotal + shippingFee ← tổng trước thuế
taxAmount   = itemsTotal × vatRate                ← VAT 8% CHỈ trên hàng hóa
total       = subtotal + taxAmount                ← tổng sau thuế
toPay       = total - deposit - debt              ← còn phải trả
```

**Lưu ý quan trọng**: VAT chỉ tính trên `itemsTotal` (hàng hóa), **không tính** trên dịch vụ và phí vận chuyển.

### 4.4 Trạng thái đơn hàng

**Thanh toán**:
```
Nháp → Chờ duyệt → Chưa thanh toán → Đã thanh toán
                                    → Đã hủy
```

- **Nháp**: Đang soạn, chưa hoàn tất
- **Chờ duyệt**: Tự động khi có item có giá thấp hơn bảng giá → cần admin approve
- **Chưa thanh toán**: Đơn chính thức, chờ thu tiền
- **Đã thanh toán**: Đã thu đủ tiền
- **Đã hủy**: Hủy đơn → trả kiện về kho

**Xuất hàng** (độc lập với thanh toán):
```
Chưa xuất → Đã xuất
```

### 4.5 Thanh toán & chiết khấu

- Một đơn có thể có **nhiều lần thanh toán** (payment_records)
- Mỗi lần thanh toán: số tiền, phương thức (chuyển khoản/tiền mặt), ngày, ghi chú
- **Chiết khấu**:
  - < 200.000đ: tự động duyệt
  - ≥ 200.000đ: cần admin duyệt (`discountStatus: pending → approved`)
  - Chiết khấu chưa duyệt không tính vào tổng đã thanh toán

### 4.6 Đặt cọc & công nợ

- **Đặt cọc (deposit)**: Tiền khách đã trả trước, trừ vào tổng
- **Công nợ (debt)**: Số tiền cho nợ, trừ vào tổng "còn phải trả"
- Khách hàng có giới hạn: `debtLimit` (hạn mức nợ) + `debtDays` (số ngày nợ tối đa)

### 4.7 Hóa đơn / In

3 layout in: Compact (A), Balanced (B), Modern (C). Tất cả gồm:
- Thông tin công ty + khách hàng
- Bảng sản phẩm: mã kiện, loại gỗ, thuộc tính, số tấm, khối lượng, đơn giá, thành tiền
- Dịch vụ, VAT, đặt cọc, công nợ, tổng cộng
- Số tiền bằng chữ tiếng Việt (`soThanhChu`)
- Chữ ký bên mua và bên bán

---

## 4b. Đối soát chuyển khoản tự động (Sepay)

### 4b.1 Bài toán
Khách chuyển khoản → bán hàng phải mở app bank kiểm tra → quay lại hệ thống ghi thu → chậm, dễ sai sót. Cần tự động hóa: nhận giao dịch ngân hàng → tự match với đơn hàng → tạo payment.

### 4b.2 Luồng tự động
```
Khách scan QR (VietQR)
  → Chuyển khoản nội dung "DH-20260329-001"
  → Ngân hàng nhận tiền
  → Sepay detect giao dịch
  → POST webhook → Edge Function
  → Parse mã đơn từ nội dung CK (regex)
  → Tìm đơn hàng → tạo payment_record auto
  → Cập nhật order.payment_status
  → Realtime push → UI tức thì
```

### 4b.3 QR Code chuyển khoản
- Chuẩn VietQR — tất cả app ngân hàng VN hỗ trợ
- URL: `https://img.vietqr.io/image/{BIN}-{ACCOUNT}-compact2.png?amount={X}&addInfo={orderCode}`
- Số tiền mặc định = `toPay - đã_thanh_toán`
- Nội dung CK = mã đơn hàng → **readonly, không cho sửa** (key duy nhất cho auto-match)
- Nếu đơn đã thanh toán 1 phần (tiền mặt) → QR tự cập nhật số tiền còn lại

### 4b.4 Parse mã đơn
Regex: `/DH[- ]?(\d{8})[- ]?(\d{3})/i`
- Nội dung CK bị ngân hàng chuẩn hóa: "DH-20260329-001" → "DH 20260329 001" hoặc "DH20260329001"
- Regex cover cả 3 dạng → normalize về `DH-YYYYMMDD-NNN`

### 4b.5 Đối soát số tiền
- `amount == còn_thiếu (±1000đ tolerance)` → **matched** → order "Đã thanh toán"
- `amount < còn_thiếu` → **partial** → order "Còn nợ"
- `amount > còn_thiếu` → **overpaid** → order "Đã thanh toán" + tạo customer_credit cho phần dư

### 4b.6 Xử lý overpaid — 2 hướng
1. **Ghi có cho đơn sau**: `customer_credit` status = 'available' → kế toán chọn credit khi tạo đơn mới
2. **Hoàn tiền**: kế toán bấm "Hoàn tiền" → credit status = 'refunded'

### 4b.7 Giao dịch unmatched
Không parse được mã đơn hoặc đơn không tồn tại → `match_status = 'unmatched'` → kế toán vào PgReconciliation match thủ công (chọn đơn từ danh sách).

### 4b.8 Tiền mặt + chuyển khoản song song
Ví dụ đơn 18.5tr: bán hàng ghi thu 5tr tiền mặt → QR tự cập nhật còn 13.5tr → khách chuyển 13.5tr → auto match.

### 4b.9 Trang PgReconciliation (Đối soát)
- **Tab Giao dịch**: Danh sách bank_transactions, filter trạng thái/ngày, match thủ công, bỏ qua
- **Tab Tổng hợp**: KPI cards (tổng GD, matched, unmatched, overpaid, tổng tiền)
- **Tab Cài đặt** (admin): CRUD tài khoản ngân hàng, webhook URL

### 4b.10 Sepay — ghi chú kỹ thuật
- Sepay tính phí theo **số giao dịch tiền VÀO/tháng**, không theo số kênh thông báo
- Bật cả Telegram + Webhook → vẫn tính 1 GD
- Webhook retry: tối đa 7 lần trong 5 giờ (Fibonacci intervals)
- Timeout: 5s kết nối, 8s response
- Response yêu cầu: `{ "success": true }` + HTTP 200

---

## 5. Khách hàng (Customers)

### 5.1 Thông tin khách hàng
- Tên, biệt danh, danh xưng (Anh/Chị/Chú/Cô/Ông/Bà)
- Điện thoại (2 số), công ty, phòng ban, chức vụ
- Địa chỉ: tỉnh/huyện/xã chuẩn Việt Nam
- Tọa độ xưởng: pick trên bản đồ Leaflet
- Loại gỗ quan tâm (`interestedWoodTypes`)
- Sản phẩm sản xuất, sở thích mua hàng

### 5.2 Quản lý công nợ
- `debtLimit`: hạn mức công nợ tối đa (VND)
- `debtDays`: số ngày nợ tối đa (mặc định 30)
- Hệ thống theo dõi công nợ tồn đọng qua `fetchCustomerUnpaidDebt()`

---

## 6. Nhà cung cấp (Suppliers)

### 6.1 Thông tin NCC
- Mã NCC (`nccId`), tên, mã nội bộ, mô tả
- **`configurable`**: flag quan trọng — NCC có `configurable = true` mới xuất hiện trong dropdown thuộc tính supplier khi nhập kho và trong PgCFG

### 6.2 Gán loại gỗ cho NCC
- `supplier_wood_assignments`: NCC nào cung cấp loại gỗ nào
- Dùng để filter NCC phù hợp khi nhập kho

---

## 7. Container & Shipment

### 7.1 Shipment (lô hàng)
Một shipment = một chuyến tàu, chứa nhiều container.

### 7.2 Container
**Loại hàng** (`cargoType`):
- `sawn`: kiện gỗ xẻ → nhập thẳng vào kho
- `raw_round`: gỗ tròn → đi qua luồng nghiệm thu/xẻ/sấy
- `raw_box`: gỗ hộp → tương tự gỗ tròn

**Trạng thái container**:
```
Tạo mới → Đang vận chuyển → Đã về → Đã nhập kho
```

**Container items**: Mỗi container có danh sách items (loại gỗ, dày, chất lượng, thể tích). Hỗ trợ nhập CSV hàng loạt.

---

## 8. Gỗ nguyên liệu & Sản xuất

### 8.1 Luồng từ gỗ tròn/hộp đến kiện thành phẩm

```
Container (raw) → Nghiệm thu → Lô gỗ → Xẻ → Sấy → Xếp loại → Kiện thành phẩm
```

### 8.2 Nghiệm thu (raw_wood_inspection)
Kiểm tra gỗ nguyên liệu khi container về: số lượng, chất lượng, thể tích thực vs khai báo.

### 8.3 Mẻ xẻ (sawing_batches)
Gỗ tròn/hộp → xẻ thành tấm. Theo dõi:
- Đầu vào: gỗ tròn/hộp (kiln items linked)
- Đầu ra: tấm gỗ xẻ (sawing items)
- Log hàng ngày (sawing_daily_logs)

### 8.4 Mẻ sấy (kiln_batches)
Gỗ xẻ tươi → sấy khô. Theo dõi:
- Danh sách gỗ trong mẻ (kiln_items)
- Trạng thái sấy, thời gian
- Thể tích quy đổi (wood_conversion_rates: kg → m³)

### 8.5 Xếp loại (packing_sessions)
Gỗ sấy xong → phân loại theo chất lượng, dày → đóng kiện:
- Tạo phiên xếp loại
- Phân loại gỗ chưa xếp (unsorted_bundles) → kiện thành phẩm (wood_bundles)
- Phế liệu ghi nhận (packing_leftovers)

---

## 9. Cấu hình (Config)

### 9.1 Cấu hình per-wood (`cfg[woodId]`)

Mỗi loại gỗ có cấu hình riêng biệt:

```javascript
{
  attrs: ["thickness", "quality", "length", "supplier"],  // attrs bật cho gỗ này
  attrValues: {                                            // giá trị chip riêng
    thickness: ["2F", "2.2F", "3F"],
    quality: ["Fas", "1COM"],
    length: ["1.6-1.9m", "2.8-4.9m"],
    supplier: ["Missouri", "ATLC", "Khác"]
  },
  rangeGroups: { ... },          // nhóm dài/rộng (mục 2.5)
  attrPriceGroups: { ... },      // nhóm giá NCC (mục 2.4)
  attrAliases: { ... },          // alias (mục 2.6)
  defaultHeader: ["length"]      // attr hiển thị ngang trong bảng giá
}
```

### 9.2 Chip values: global vs per-wood

- `ats[].values` = template mặc định (global)
- `cfg[woodId].attrValues[atId]` = giá trị thực tế dùng cho loại gỗ (per-wood)
- Khi bật attribute cho loại gỗ lần đầu → copy từ global
- Sau đó mỗi loại gỗ quản lý riêng, có thể khác nhau

### 9.3 Rename chip — cascade migration

**Rename tại PgAT (toàn cục)**: `handleRenameAttrVal`
- Migrate TẤT CẢ loại gỗ: prices keys + bundle attributes + bundle priceAttrsOverride + change_log
- Migrate cfg.attrValues của mọi wood

**Rename tại PgCFG (per-wood)**: `handleRenameAttrValForWood`
- Migrate CHỈ loại gỗ đó: prices keys + bundle attributes + bundle priceAttrsOverride

### 9.4 Thickness mode

| Mode | Ý nghĩa |
|------|---------|
| `fixed` | Danh sách dày cố định, nhập kho phải chọn từ list |
| `auto` | Nhập dày bất kỳ, hệ thống tự tạo chip mới |

---

## 10. Dashboard

### 10.1 KPI cards
- Tổng doanh thu hôm nay
- Số đơn chờ xuất (đã thanh toán nhưng chưa xuất)
- Top 5 loại gỗ bán chạy (theo m³, 7/30/90 ngày)

### 10.2 Cảnh báo tồn kho
- Ngưỡng: < 5 m³ một loại gỗ → cảnh báo tồn kho thấp (`LOW_INVENTORY_THRESHOLD = 5`)

### 10.3 Biểu đồ
- Daily: 30 ngày gần nhất (doanh thu + khối lượng)
- Monthly: 12 tháng gần nhất

---

## 11. Dịch vụ kèm theo (Services)

### 11.1 Các loại dịch vụ trong đơn hàng
- **Xẻ sấy** (`xe_say`): Tính theo cấu hình `xeSayConfig` (loại gỗ × dày × chất lượng)
- **Luộc gỗ** (`luoc_go`): Giá cố định / m³
- **Vận chuyển** (`van_chuyen`): Giá theo tuyến
- **Khác** (`other`): Nhập tự do

### 11.2 Xe sấy config
Cấu hình riêng cho dịch vụ xẻ sấy: bảng giá theo loại gỗ, độ dày, điều chỉnh.

---

## Phụ lục A: Ràng buộc quan trọng

1. **Xóa loại gỗ**: Chặn nếu có bundles hoặc config. Phải xóa bundles + config trước.
2. **Xóa NCC**: Chặn nếu NCC đang `configurable` và có bundles gắn supplier đó.
3. **Xóa kiện**: Chặn nếu kiện đang trong đơn hàng (`order_items`).
4. **Xóa chip**: Cảnh báo số bundles đang dùng giá trị đó trước khi xóa.
5. **Giá trị override phải tồn tại**: `priceAttrsOverride` chỉ chọn được giá trị có trong `cfg.attrValues`.
6. **VAT chỉ trên hàng hóa**: Không tính trên dịch vụ, phí vận chuyển.
7. **Chiết khấu ≥ 200k cần duyệt**: Admin phải approve trước khi tính vào tổng thanh toán.
8. **Auth là client-side**: Password hash SHA-256, session lưu localStorage. Không có server-side auth.

## Phụ lục B: Thuật ngữ

| Thuật ngữ | Giải thích |
|-----------|-----------|
| SKU_KEY | Mã tổ hợp thuộc tính dùng tra giá (output của `bpk()`) |
| Chip | Một giá trị thuộc tính (VD: "2F" là chip của thickness) |
| Bundle | Kiện gỗ vật lý trong kho |
| NCC | Nhà cung cấp (supplier) |
| Orphan | Bundle/giá có giá trị không khớp cấu hình hiện tại |
| perBundle | Chế độ định giá riêng từng kiện (không dùng bảng giá chung) |
| rangeGroup | Nhóm giá trị liên tục (VD: 1.6-1.9m) |
| priceGroup | Nhóm NCC dùng chung 1 mức giá |
| Hold | Trạng thái tạm khóa kiện, không cho bán |
| Fingerprint | Chuỗi giá tại mọi tổ hợp khác, dùng so sánh khi gộp dày |
