import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { bpk } from "../utils";

// ── Tiện ích ──────────────────────────────────────────────────────────────────

function fmtMoney(n) { return (n || 0).toLocaleString('vi-VN'); }

// Input số có ngăn cách hàng nghìn (vi-VN: dấu chấm)
function NumInput({ value, onChange, style, placeholder, ...rest }) {
  const fmt = n => (n != null && n !== '' && Number(n) !== 0) ? Number(n).toLocaleString('vi-VN') : '';
  const [txt, setTxt] = React.useState(() => fmt(value));
  const focused = React.useRef(false);
  React.useEffect(() => { if (!focused.current) setTxt(fmt(value)); }, [value]);
  const commit = () => {
    focused.current = false;
    const n = parseFloat(String(txt).replace(/\./g, '').replace(/,/g, '')) || 0;
    setTxt(fmt(n));
    onChange(n);
  };
  return (
    <input {...rest} type="text" inputMode="numeric" placeholder={placeholder} value={txt}
      onFocus={() => { focused.current = true; }}
      onChange={e => setTxt(e.target.value)}
      onBlur={commit}
      style={style} />
  );
}

function soThanhChu(n) {
  if (!n || isNaN(n)) return '';
  const so = Math.round(n);
  if (so === 0) return 'Không đồng';
  const doc = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  function readGroup(x) {
    const h = Math.floor(x / 100), t = Math.floor((x % 100) / 10), u = x % 10;
    let s = '';
    if (h) s += doc[h] + ' trăm';
    if (t === 0 && u && h) s += ' lẻ ' + doc[u];
    else if (t === 1) s += ' mười' + (u === 5 ? ' lăm' : u ? ' ' + doc[u] : '');
    else if (t > 1) s += ' ' + doc[t] + ' mươi' + (u === 5 ? ' lăm' : u === 1 ? ' mốt' : u ? ' ' + doc[u] : '');
    else if (u && !h) s += doc[u];
    return s.trim();
  }
  const ty = Math.floor(so / 1e9), tr = Math.floor((so % 1e9) / 1e6), ng = Math.floor((so % 1e6) / 1e3), dv = so % 1e3;
  let r = '';
  if (ty) r += readGroup(ty) + ' tỷ ';
  if (tr) r += readGroup(tr) + ' triệu ';
  if (ng) r += readGroup(ng) + ' nghìn ';
  if (dv) r += readGroup(dv);
  r = r.trim();
  return r.charAt(0).toUpperCase() + r.slice(1) + ' đồng';
}

function calcTotals(items, services, shippingFee, applyTax, deposit, debt, vatRate = 0.08) {
  const itemsTotal = items.reduce((s, it) => s + (it.amount || 0), 0);
  const svcTotal = services.reduce((s, sv) => s + (parseFloat(sv.amount) || 0), 0);
  const subtotal = itemsTotal + svcTotal + (parseFloat(shippingFee) || 0);
  // VAT chỉ áp dụng trên hàng hóa (itemsTotal), không áp dụng dịch vụ và vận chuyển
  const taxAmount = applyTax ? Math.round(itemsTotal * vatRate) : 0;
  const total = subtotal + taxAmount;
  const toPay = total - (parseFloat(deposit) || 0) - (parseFloat(debt) || 0);
  return { subtotal, taxAmount, total, toPay, itemsTotal, svcTotal, vatRate };
}

// ── In đơn hàng ───────────────────────────────────────────────────────────────

function printOrder({ order, customer, items, services, wts, ats, vatRate = 0.08, hideSupplierName = true, layout = 1 }) {
  const wood = (id) => wts.find(w => w.id === id);
  const atLabel = (id) => ats.find(a => a.id === id)?.name || id;
  const isSupplierAttr = (k) => {
    const lbl = atLabel(k).toLowerCase();
    return lbl.includes('nhà cung cấp') || lbl.includes('ncc') || k.toLowerCase().includes('supplier') || k.toLowerCase() === 'ncc';
  };
  const attrOf = (it) => Object.entries(it.attributes||{}).filter(([k]) => !hideSupplierName || !isSupplierAttr(k)).map(([k,v]) => `${atLabel(k)}: ${v}`).join(' · ');
  const bundleCell = (it) => `<div style="font-weight:700">${it.bundleCode||''}</div>${it.supplierBundleCode ? `<div style="font-size:10px;color:#888">${it.supplierBundleCode}</div>` : ''}`;
  const priceWarnOf = (it) => it.listPrice && it.unitPrice !== it.listPrice ? `<div class="warn">⚠ Bảng giá: ${fmtMoney(it.listPrice)}</div>` : '';

  const { subtotal, taxAmount, total, toPay, itemsTotal, svcTotal } = calcTotals(items, services, order.shippingFee, order.applyTax, order.deposit, order.debt, vatRate);
  const totalBoards = items.reduce((s, it) => s + (parseInt(it.boardCount) || 0), 0);
  const totalVolume = items.reduce((s, it) => s + (parseFloat(it.volume) || 0), 0).toFixed(3);

  // ── Phương án 1 (mặc định): 8 cột — 2 dòng cố định mỗi sản phẩm ─────────────
  const productHTML1 = `<h2>Sản phẩm</h2><table><thead><tr>
<th>#</th><th>Mã kiện / NCC</th><th>Tên gỗ</th><th>Số tấm</th><th>KL (m³)</th><th>ĐVT</th><th>Đơn giá<br><small>(vnđ)</small></th><th>Thành tiền (vnđ)</th>
</tr></thead><tbody>${items.map((it, i) => {
  const bg = i%2 ? ' class="row2"' : '';
  return `<tr${bg}>
<td class="center" rowspan="2" style="vertical-align:middle">${i+1}</td>
<td class="mono" rowspan="2">${bundleCell(it)}</td>
<td><strong>${wood(it.woodId)?.name||it.woodId}</strong></td>
<td class="center">${it.boardCount}</td><td class="right">${(it.volume||0).toFixed(3)}</td><td class="center">${it.unit}</td>
<td class="right">${fmtMoney(it.unitPrice)}${priceWarnOf(it)}</td>
<td class="right"><strong>${fmtMoney(it.amount)}</strong></td></tr>
<tr${bg}><td colspan="6" style="font-size:11px;color:#666;padding:3px 8px 7px;border-top:none">${attrOf(it)}${it.notes ? ' — <em>' + it.notes + '</em>' : ''}</td></tr>`;
}).join('')}
<tr class="total-row"><td colspan="3" style="text-align:right">Tổng cộng</td>
<td class="center"><strong>${totalBoards}</strong> tấm</td><td class="right"><strong>${totalVolume}</strong> m³</td><td></td><td></td>
<td class="right"><strong>${fmtMoney(itemsTotal)}</strong></td></tr>
</tbody></table>`;

  // ── Phương án 2: 8 cột — 1 dòng mỗi sản phẩm, thuộc tính xuống dòng tự do ───
  const productHTML2 = `<h2>Sản phẩm</h2><table><thead><tr>
<th>#</th><th>Mã kiện / NCC</th><th>Loại gỗ &amp; Thuộc tính</th><th>Số tấm</th><th>KL (m³)</th><th>ĐVT</th><th>Đơn giá<br><small>(vnđ)</small></th><th>Thành tiền (vnđ)</th>
</tr></thead><tbody>${items.map((it, i) => `<tr${i%2?' class="row2"':''}><td class="center">${i+1}</td>
<td class="mono">${bundleCell(it)}</td>
<td><strong>${wood(it.woodId)?.name||it.woodId}</strong><div style="font-size:11px;color:#666">${attrOf(it)}</div>${it.notes?`<div style="font-size:11px;color:#888">${it.notes}</div>`:''}</td>
<td class="center">${it.boardCount}</td><td class="right">${(it.volume||0).toFixed(3)}</td><td class="center">${it.unit}</td>
<td class="right">${fmtMoney(it.unitPrice)}${priceWarnOf(it)}</td>
<td class="right"><strong>${fmtMoney(it.amount)}</strong></td></tr>`).join('')}
<tr class="total-row"><td colspan="3" style="text-align:right">Tổng cộng</td>
<td class="center"><strong>${totalBoards}</strong> tấm</td><td class="right"><strong>${totalVolume}</strong> m³</td><td></td><td></td>
<td class="right"><strong>${fmtMoney(itemsTotal)}</strong></td></tr>
</tbody></table>`;

  const productHTML = layout === 2 ? productHTML2 : productHTML1;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Đơn hàng ${order.orderCode}</title>
<style>
body{font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#222;margin:0;padding:20px}
h2{font-size:13px;font-weight:600;margin:12px 0 4px;color:#444}
table{width:100%;border-collapse:collapse;margin-bottom:12px}
th{background:#f5f0e8;padding:6px 8px;text-align:center;font-size:11px;text-transform:uppercase;border:1px solid #ddd}
td{padding:6px 8px;border:1px solid #ddd;vertical-align:top}
.right{text-align:right}.center{text-align:center}.mono{font-family:monospace}.warn{color:#c0392b;font-size:11px}
.total-row td{font-weight:700;background:#fdf6ec}.pay-row td{font-weight:800;font-size:15px;background:#fff3e0}
.row2{background:#fafafa}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}
.box{padding:8px 12px;border:1px solid #ddd;border-radius:4px}.lbl{font-size:10px;color:#888;text-transform:uppercase}
@media print{body{padding:8px}.no-print{display:none}}
</style></head><body>

<!-- ═══ HEADER: Logo | Thông tin công ty | Mã đơn hàng ═══ -->
<div style="display:flex;align-items:flex-start;gap:16px;margin-bottom:16px;padding-bottom:14px;border-bottom:3px solid #F26522">

  <!-- Cột 1: Logo -->
  <img src="${window.location.origin}/logo-gth.png"
       style="height:64px;width:auto;object-fit:contain;flex-shrink:0"
       onerror="this.style.display='none'"
       alt="Gỗ Tinh Hoa" />

  <!-- Cột 2: Thông tin công ty -->
  <div style="flex:1;min-width:0;padding-top:2px">
    <div style="font-size:10px;font-weight:700;color:#F26522;text-transform:uppercase;letter-spacing:0.06em">Kho gỗ nhập khẩu Âu – Mỹ – Phi</div>
    <div style="font-size:11px;color:#5A3E2B;margin-top:4px">KCN Quốc Oai, Hà Nội &nbsp;·&nbsp; <span style="font-size:10px;color:#888">DT419, Đại lộ Thăng Long – rẽ phải 200m</span></div>
    <div style="font-size:11px;font-weight:700;color:#F26522;margin-top:3px">📞 0924 35 88 99</div>
  </div>

  <!-- Cột 3: Mã đơn hàng (cố định chiều rộng) -->
  <div style="text-align:right;flex-shrink:0;min-width:150px">
    <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px">Đơn hàng</div>
    <div class="mono" style="font-size:17px;font-weight:800;color:#2D2016;white-space:nowrap">${order.orderCode}</div>
    <div style="font-size:10px;color:#888;margin-top:3px">Ngày: ${new Date(order.createdAt).toLocaleDateString('vi-VN')}</div>
    <div style="margin-top:6px;display:flex;flex-direction:column;align-items:flex-end;gap:4px">
      <span style="padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;white-space:nowrap;background:${order.paymentStatus==='Đã thanh toán'?'#e8f5e9':'#fff3e0'};color:${order.paymentStatus==='Đã thanh toán'?'#27ae60':'#e67e22'}">${order.paymentStatus}</span>
      <span style="padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;white-space:nowrap;background:${order.exportStatus==='Đã xuất'?'#e8f5e9':'#f5f5f5'};color:${order.exportStatus==='Đã xuất'?'#27ae60':'#888'}">${order.exportStatus}</span>
    </div>
  </div>
</div>
<h2>Thông tin khách hàng</h2>
${(() => {
  const sal = customer?.salutation ? customer.salutation + ' ' : '';
  const name = customer?.name || order.customerName || '';
  const addr = customer?.address || order.customerAddress || '';
  const city = addr.includes(',') ? addr.split(',').map(p => p.trim()).filter(Boolean).pop() : addr;
  const phone = (customer?.phone1 || order.customerPhone || '').replace(/\D/g, '');
  const phoneSuffix = phone.length >= 3 ? phone.slice(-3) : phone;
  const parts = [sal + name, city, phoneSuffix].filter(Boolean);
  return `<div class="box" style="margin-bottom:8px"><div style="font-weight:700;font-size:13px">${parts.join(' · ')}</div>
  ${customer?.companyName ? `<div style="font-size:11px;color:#666;margin-top:2px">${customer.companyName}</div>` : ''}
  ${customer?.deliveryAddress ? `<div style="font-size:11px;color:#666;margin-top:2px">Nhận hàng: ${customer.deliveryAddress}</div>` : ''}
</div>`;
})()}
${productHTML}
${(() => { const svcs = services.filter(s=>s.amount>0); return svcs.length ? `<h2>Dịch vụ</h2><table><thead><tr><th>Mô tả dịch vụ</th><th class="right">Thành tiền</th></tr></thead><tbody>${svcs.map((s,i)=>`<tr${i%2?' class="row2"':''}><td>${s.description}</td><td class="right">${fmtMoney(s.amount)}</td></tr>`).join('')}<tr class="total-row"><td>Tổng dịch vụ</td><td class="right"><strong>${fmtMoney(svcTotal)}</strong></td></tr></tbody></table>` : ''; })()}
${order.shippingType?`<h2>Vận chuyển — ${order.shippingType}</h2><div class="grid2">
${order.shippingType==='Gọi xe cho khách'?`<div class="box"><div class="lbl">Đơn vị VC</div><div>${order.shippingCarrier||'—'}</div></div><div class="box"><div class="lbl">Phí vận chuyển</div><div style="font-weight:700">${fmtMoney(order.shippingFee)}</div></div>`:
`<div class="box"><div class="lbl">Lái xe</div><div>${order.driverName||'—'} ${order.driverPhone?'• '+order.driverPhone:''}</div>${order.licensePlate?`<div>Biển số: ${order.licensePlate}</div>`:''}</div>
<div class="box"><div class="lbl">Địa chỉ nhận & Giờ dự kiến</div><div>${order.deliveryAddress||'—'}</div>${order.estimatedArrival?`<div>${order.estimatedArrival}</div>`:''}</div>`}
</div>`:''}
<h2>Thanh toán</h2>
<table><tbody>
<tr><td>Tạm tính</td><td class="right">${fmtMoney(subtotal)}</td></tr>
${order.applyTax?`<tr><td>Thuế VAT (${Math.round(vatRate*100)}%) — hàng hóa</td><td class="right">${fmtMoney(taxAmount)}</td></tr>`:''}
<tr class="total-row"><td>Tổng cộng</td><td class="right">${fmtMoney(total)}</td></tr>
${order.deposit>0?`<tr><td>Đặt cọc</td><td class="right">- ${fmtMoney(order.deposit)}</td></tr>`:''}
${order.debt>0?`<tr><td>Công nợ</td><td class="right">- ${fmtMoney(order.debt)}</td></tr>`:''}
<tr class="pay-row"><td>Cần thanh toán</td><td class="right">${fmtMoney(toPay)}</td></tr>
</tbody></table>
<div style="padding:10px 14px;background:#fff8f0;border:1px solid #f0c080;border-radius:4px;margin-bottom:16px">
  <span style="font-size:11px;color:#888">Bằng chữ: </span><em>${soThanhChu(toPay)}</em>
</div>
${order.notes?`<div style="padding:8px 12px;background:#f9f9f9;border:1px solid #ddd;border-radius:4px;font-size:12px"><strong>Ghi chú:</strong> ${order.notes}</div>`:''}
<!-- ═══ FOOTER: Chữ ký + Banner quảng cáo ═══ -->
<div style="margin-top:28px;display:grid;grid-template-columns:1fr 1fr;gap:20px">
  <div style="text-align:center">
    <div style="font-size:11px;color:#888;margin-bottom:40px">Khách hàng ký xác nhận</div>
    <div style="border-top:1px solid #ccc;padding-top:4px;font-size:11px;color:#555">(Ký, ghi rõ họ tên)</div>
  </div>
  <div style="text-align:center">
    <div style="font-size:11px;color:#888;margin-bottom:40px">Đại diện công ty</div>
    <div style="border-top:1px solid #ccc;padding-top:4px;font-size:11px;color:#555">(Ký, đóng dấu)</div>
  </div>
</div>

<!-- Banner quảng cáo -->
<div style="margin-top:24px;padding:12px 18px;background:#FFF5EE;border:2px solid #F26522;border-radius:8px;text-align:center;page-break-inside:avoid">
  <div style="font-size:15px;font-weight:900;color:#F26522;letter-spacing:0.04em;text-transform:uppercase">
    KHO GỖ NHẬP KHẨU ÂU – MỸ – PHI
  </div>
  <div style="font-size:12px;font-weight:700;color:#5A3E2B;margin-top:5px;letter-spacing:0.03em">
    ÓC CHÓ &bull; SỒI &bull; TẦN BÌ &bull; BEECH &bull; GỖ &bull; TEAK &bull; THÔNG &hellip;
  </div>
  <div style="font-size:11px;color:#888;margin-top:6px">
    KCN Quốc Oai, Hà Nội &nbsp;|&nbsp; DT419, Đại lộ Thăng Long – rẽ phải 200m hướng Thạch Thất
    &nbsp;|&nbsp; <strong style="color:#F26522">Hotline: 0924 35 88 99</strong>
  </div>
</div>

<div style="margin-top:10px;font-size:9px;color:#bbb;text-align:center">
  In lúc ${new Date().toLocaleString('vi-VN')}
</div>
</body></html>`;
  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 500);
}

// ── PrintModal ────────────────────────────────────────────────────────────────

function PrintModal({ onPrint, onClose }) {
  const [layout, setLayout] = React.useState(1);
  const [hideSupplierName, setHideSupplierName] = React.useState(true);

  const opts = [
    { id: 1, label: 'Phương án 1: 2 dòng cố định', desc: 'Dòng 1: mã kiện + tên gỗ + số liệu — Dòng 2: thuộc tính riêng, không tràn dòng' },
    { id: 2, label: 'Phương án 2: 1 dòng tự do', desc: '8 cột — thuộc tính hiển thị cùng tên gỗ, cho xuống dòng tự do' },
  ];

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bgc)', borderRadius: 12, padding: 24, width: 480, maxWidth: '100%', border: '1px solid var(--bd)', boxShadow: '0 8px 40px rgba(0,0,0,0.3)' }}>
        <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--br)', marginBottom: 16 }}>🖨 Tùy chọn in đơn hàng</div>
        {opts.map(opt => (
          <label key={opt.id} onClick={() => setLayout(opt.id)} style={{ display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${layout === opt.id ? 'var(--ac)' : 'var(--bd)'}`, marginBottom: 8, cursor: 'pointer', background: layout === opt.id ? 'var(--acbg)' : 'var(--bg)' }}>
            <input type="radio" name="printLayout" checked={layout === opt.id} onChange={() => setLayout(opt.id)} style={{ marginTop: 3, accentColor: 'var(--ac)', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--br)' }}>{opt.label}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--tm)', marginTop: 2 }}>{opt.desc}</div>
            </div>
          </label>
        ))}
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10, padding: '8px 12px', borderRadius: 7, border: '1px solid var(--bd)', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--ts)' }}>
          <input type="checkbox" checked={!hideSupplierName} onChange={e => setHideSupplierName(!e.target.checked)} style={{ accentColor: 'var(--ac)' }} />
          Hiện tên nhà cung cấp trong thuộc tính
        </label>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 7, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>Hủy</button>
          <button onClick={() => { onPrint({ layout, hideSupplierName }); onClose(); }} style={{ padding: '8px 22px', borderRadius: 7, border: 'none', background: 'var(--ac)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>🖨 In / PDF</button>
        </div>
      </div>
    </div>
  );
}

// ── BundleSelector ────────────────────────────────────────────────────────────

function BundleSelector({ wts, ats, prices, onConfirm, onClose }) {
  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(new Set());
  const [fWood, setFWood] = useState('');
  const [fSearch, setFSearch] = useState('');

  useEffect(() => {
    (async () => {
      try { const { fetchBundles } = await import('../api.js'); setBundles(await fetchBundles()); }
      catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const now = Date.now();
    let arr = bundles.filter(b => {
      if (b.status === 'Đã bán hết' || b.status === 'Đã bán') return false;
      // V-21: loại bỏ bundle đang bị lock (trong vòng 10 phút)
      if (b.lockedBy) {
        const lockedAt = b.lockedAt ? new Date(b.lockedAt).getTime() : 0;
        if (now - lockedAt < 10 * 60 * 1000) return false;
      }
      return true;
    });
    if (fWood) arr = arr.filter(b => b.woodId === fWood);
    if (fSearch) { const s = fSearch.toLowerCase(); arr = arr.filter(b => b.bundleCode.toLowerCase().includes(s) || Object.values(b.attributes||{}).some(v => String(v).toLowerCase().includes(s))); }
    return arr;
  }, [bundles, fWood, fSearch]);

  const toggle = (id) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleConfirm = () => {
    const selected = bundles.filter(b => sel.has(b.id)).map(b => {
      const priceObj = prices[bpk(b.woodId, b.attributes)] || {};
      const fullPrice = priceObj.price != null ? Math.round(priceObj.price * 1000000) : null;
      return { bundleId: b.id, bundleCode: b.bundleCode, supplierBundleCode: b.supplierBundleCode || '', woodId: b.woodId, skuKey: b.skuKey, attributes: { ...b.attributes }, boardCount: b.remainingBoards, volume: b.remainingVolume, unit: 'm3', unitPrice: fullPrice, listPrice: fullPrice, amount: fullPrice ? Math.round(fullPrice * b.remainingVolume) : 0, notes: '' };
    });
    onConfirm(selected);
  };

  const ths = { padding: '6px 8px', background: 'var(--bgh)', color: 'var(--brl)', fontWeight: 700, fontSize: '0.6rem', textTransform: 'uppercase', borderBottom: '2px solid var(--bds)', whiteSpace: 'nowrap' };
  const tds = { padding: '6px 8px', borderBottom: '1px solid var(--bd)', fontSize: '0.76rem', whiteSpace: 'nowrap' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(45,32,22,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bgc)', borderRadius: 14, width: 900, maxWidth: '100%', maxHeight: '88vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--bd)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, fontWeight: 800, fontSize: '0.95rem', color: 'var(--br)' }}>📦 Chọn kiện gỗ</div>
          <input value={fSearch} onChange={e => setFSearch(e.target.value)} placeholder="🔍 Tìm mã kiện..." style={{ padding: '5px 10px', borderRadius: 6, border: '1.5px solid var(--bd)', fontSize: '0.76rem', outline: 'none', width: 180 }} />
          <select value={fWood} onChange={e => setFWood(e.target.value)} style={{ padding: '5px 8px', borderRadius: 6, border: '1.5px solid var(--bd)', fontSize: '0.76rem', outline: 'none', background: 'var(--bgc)' }}>
            <option value="">Tất cả loại gỗ</option>
            {wts.map(w => <option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
          </select>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--bd)', background: 'transparent', cursor: 'pointer', color: 'var(--ts)' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? <div style={{ padding: 30, textAlign: 'center', color: 'var(--tm)' }}>Đang tải...</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={ths}></th>
                {['Mã kiện / NCC', 'Loại gỗ', 'Độ dày', 'Chất lượng', 'Dài', 'Tấm còn', 'KL còn (m³)', 'Giá (tr/m³)', 'Vị trí'].map(h => <th key={h} style={ths}>{h}</th>)}
              </tr></thead>
              <tbody>
                {filtered.length === 0 ? <tr><td colSpan={10} style={{ padding: 20, textAlign: 'center', color: 'var(--tm)' }}>Không có kiện nào phù hợp</td></tr>
                  : filtered.map((b, i) => {
                    const w = wts.find(x => x.id === b.woodId);
                    const p = prices[bpk(b.woodId, b.attributes)]?.price;
                    const checked = sel.has(b.id);
                    return (
                      <tr key={b.id} onClick={() => toggle(b.id)} style={{ background: checked ? 'rgba(242,101,34,0.07)' : (i % 2 ? 'var(--bgs)' : '#fff'), cursor: 'pointer' }}>
                        <td style={{ ...tds, textAlign: 'center' }}><input type="checkbox" readOnly checked={checked} /></td>
                        <td style={{ ...tds, fontFamily: 'monospace' }}>
                          <div style={{ fontWeight: 700, color: 'var(--br)' }}>{b.bundleCode}</div>
                          {b.supplierBundleCode && <div style={{ fontSize: '0.68rem', color: 'var(--tm)' }}>{b.supplierBundleCode}</div>}
                        </td>
                        <td style={tds}>{w?.icon} {w?.name}</td>
                        <td style={tds}>{b.attributes?.thickness || '—'}</td>
                        <td style={tds}>{b.attributes?.quality || '—'}</td>
                        <td style={tds}>{b.attributes?.length || '—'}</td>
                        <td style={{ ...tds, textAlign: 'right' }}>{b.remainingBoards}</td>
                        <td style={{ ...tds, textAlign: 'right', fontWeight: 700 }}>{(b.remainingVolume || 0).toFixed(3)}</td>
                        <td style={{ ...tds, textAlign: 'right', color: p ? 'var(--br)' : 'var(--tm)' }}>{p ? p.toFixed(1) : '—'}</td>
                        <td style={tds}>{b.location || '—'}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--bd)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '0.76rem', color: 'var(--tm)' }}>Đã chọn <strong style={{ color: 'var(--br)' }}>{sel.size}</strong> kiện</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: 7, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem' }}>Hủy</button>
            <button onClick={handleConfirm} disabled={sel.size === 0} style={{ padding: '7px 18px', borderRadius: 7, border: 'none', background: sel.size ? 'var(--ac)' : 'var(--bd)', color: sel.size ? '#fff' : 'var(--tm)', cursor: sel.size ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: '0.78rem' }}>Thêm {sel.size > 0 ? sel.size + ' kiện' : ''} →</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── OrderForm ─────────────────────────────────────────────────────────────────

const DRAFT_KEY = 'gth_order_draft';

const INIT_ORDER = { customerId: null, applyTax: true, deposit: '', debt: '', shippingType: 'Gọi xe cho khách', shippingCarrier: '', shippingFee: '', driverName: '', driverPhone: '', deliveryAddress: '', licensePlate: '', estimatedArrival: '', shippingNotes: '', notes: '' };

function OrderForm({ initial, initialItems, initialServices, customers, wts, ats, prices, ce, useAPI, notify, onDone, onNewCustomer, vatRate = 0.08 }) {
  const isNew = !initial?.id;
  // V-28: lưu draft thành order DB với status Nháp — không dùng localStorage
  const [fm, setFm] = useState(initial || INIT_ORDER);
  const [items, setItems] = useState(initialItems || []);
  const [services, setServices] = useState(initialServices || [{ description: '', amount: '' }]);
  const [showBundleSel, setShowBundleSel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  // V-25: công nợ hiện tại của khách
  const [customerDebt, setCustomerDebt] = useState(0);
  // V-21: theo dõi bundle đã lock để unlock khi rời form
  const lockedBundleIds = useRef(new Set());

  const f = (k) => (v) => setFm(p => ({ ...p, [k]: v }));
  const selCust = customers.find(c => c.id === fm.customerId);
  const { subtotal, taxAmount, total, toPay, itemsTotal, svcTotal } = calcTotals(items, services, fm.shippingFee, fm.applyTax, fm.deposit, fm.debt, vatRate);

  // V-25: tải công nợ khi chọn khách hàng
  useEffect(() => {
    if (!fm.customerId || !useAPI) { setCustomerDebt(0); return; }
    import('../api.js').then(api => api.fetchCustomerUnpaidDebt(fm.customerId)
      .then(d => setCustomerDebt(d)).catch(() => setCustomerDebt(0)));
  }, [fm.customerId, useAPI]);

  // V-21: unlock tất cả bundle đã lock khi rời form
  useEffect(() => {
    return () => {
      const ids = [...lockedBundleIds.current];
      if (ids.length > 0) {
        import('../api.js').then(api => ids.forEach(id => api.unlockBundle(id).catch(() => {})));
      }
    };
  }, []); // eslint-disable-line

  const addBundles = (newItems) => {
    setItems(prev => {
      const existing = new Set(prev.map(i => i.bundleId).filter(Boolean));
      const toAdd = newItems.filter(ni => !existing.has(ni.bundleId));
      // V-21: lock bundles được thêm vào
      if (useAPI) {
        toAdd.forEach(ni => {
          if (ni.bundleId) {
            import('../api.js').then(api => api.lockBundle(ni.bundleId, 'form').catch(() => {}));
            lockedBundleIds.current.add(ni.bundleId);
          }
        });
      }
      return [...prev, ...toAdd];
    });
    setShowBundleSel(false);
  };

  const updateItem = (idx, key, val) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const updated = { ...it, [key]: val };
      if (key === 'boardCount' || key === 'volume' || key === 'unitPrice' || key === 'unit') {
        const qty = key === 'volume' ? parseFloat(val) || 0 : parseFloat(updated.volume) || 0;
        const up = key === 'unitPrice' ? parseFloat(val) || 0 : parseFloat(updated.unitPrice) || 0;
        updated.amount = updated.unit === 'm3' ? Math.round(up * qty) : Math.round(up * qty);
      }
      return updated;
    }));
  };

  const removeItem = (idx) => {
    const item = items[idx];
    // V-21: unlock bundle khi xóa khỏi form
    if (item.bundleId && useAPI) {
      import('../api.js').then(api => api.unlockBundle(item.bundleId).catch(() => {}));
      lockedBundleIds.current.delete(item.bundleId);
    }
    setItems(prev => prev.filter((_, i) => i !== idx));
  };
  const addService = () => setServices(prev => [...prev, { description: '', amount: '' }]);
  const updateSvc = (idx, key, val) => setServices(prev => prev.map((s, i) => i === idx ? { ...s, [key]: val } : s));
  const removeSvc = (idx) => setServices(prev => prev.filter((_, i) => i !== idx));

  // V-27: mặt hàng nào có giá thấp hơn bảng giá
  const belowPriceItems = items.filter(it => it.listPrice != null && it.listPrice > 0 && it.unitPrice !== it.listPrice);

  const handleSave = async (targetStatus) => {
    if (!fm.customerId) return notify('Vui lòng chọn khách hàng', false);
    if (items.length === 0) return notify('Chưa có sản phẩm nào trong đơn', false);
    // V-27: nếu có mặt hàng giá thấp hơn bảng → chuyển sang Chờ duyệt
    const effectiveStatus = (targetStatus === 'Chưa thanh toán' && belowPriceItems.length > 0)
      ? 'Chờ duyệt' : targetStatus;
    setSaving(true);
    try {
      const { createOrder, updateOrder, deductBundlesForOrder } = await import('../api.js');
      const orderData = { ...fm, subtotal, taxAmount, totalAmount: total, deposit: parseFloat(fm.deposit) || 0, debt: parseFloat(fm.debt) || 0, shippingFee: parseFloat(fm.shippingFee) || 0, targetStatus: effectiveStatus };
      const svcList = services.filter(s => s.description || parseFloat(s.amount) > 0).map(s => ({ ...s, amount: parseFloat(s.amount) || 0 }));
      const r = initial?.id ? await updateOrder(initial.id, orderData, items, svcList) : await createOrder(orderData, items, svcList);
      if (r.error) { notify('Lỗi: ' + r.error, false); setSaving(false); return; }
      if (effectiveStatus === 'Đã thanh toán') await deductBundlesForOrder(items);
      // V-21: unlock tất cả bundle sau khi lưu thành công
      const lockedIds = [...lockedBundleIds.current];
      if (lockedIds.length > 0) {
        lockedIds.forEach(id => import('../api.js').then(api => api.unlockBundle(id).catch(() => {})));
        lockedBundleIds.current.clear();
      }
      const msg = effectiveStatus === 'Nháp' ? 'Đã lưu nháp'
        : effectiveStatus === 'Chờ duyệt' ? `Đã tạo đơn ${r.orderCode} — chờ admin duyệt giá`
        : effectiveStatus === 'Đã thanh toán' ? 'Đã tạo đơn & xác nhận thanh toán'
        : `Đã tạo đơn ${r.orderCode}`;
      notify(initial?.id ? 'Đã cập nhật đơn hàng' : msg);
      onDone(r);
    } catch (e) { notify('Lỗi: ' + e.message, false); }
    setSaving(false);
  };

  const handleCancel = async () => {
    if (!isNew) { onDone(null); return; }
    if (fm.customerId || items.length > 0) {
      await handleSave('Nháp');
    } else {
      onDone(null);
    }
  };

  const inpSt = { padding: '7px 9px', borderRadius: 6, border: '1.5px solid var(--bd)', fontSize: '0.8rem', outline: 'none', background: 'var(--bg)', width: '100%', boxSizing: 'border-box' };
  const secTitle = (t) => <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--brl)', textTransform: 'uppercase', marginBottom: 10, marginTop: 4, letterSpacing: '0.06em' }}>{t}</div>;
  const ths = { padding: '6px 8px', background: 'var(--bgh)', color: 'var(--brl)', fontWeight: 700, fontSize: '0.6rem', textTransform: 'uppercase', borderBottom: '2px solid var(--bds)', whiteSpace: 'nowrap' };

  return (
    <div>
      {showBundleSel && <BundleSelector wts={wts} ats={ats} prices={prices} onConfirm={addBundles} onClose={() => setShowBundleSel(false)} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={() => onDone(null)} style={{ padding: '6px 12px', borderRadius: 6, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 600 }}>← Quay lại</button>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--br)' }}>{initial?.id ? '✏️ Sửa đơn hàng' : '🛒 Tạo đơn hàng mới'}</h2>
        {items.length > 0 && (
          <div style={{ marginLeft: 'auto' }}>
            {showPrintModal && (
              <PrintModal onClose={() => setShowPrintModal(false)}
                onPrint={({ layout, hideSupplierName }) => printOrder({
                  order: { ...fm, orderCode: initial?.orderCode || 'NHÁP', paymentStatus: 'Nháp', exportStatus: 'Chưa xuất', shippingFee: parseFloat(fm.shippingFee) || 0, shippingType: fm.shippingType, shippingCarrier: fm.shippingCarrier, shippingNotes: fm.shippingNotes, driverName: fm.driverName, driverPhone: fm.driverPhone, licensePlate: fm.licensePlate, deliveryAddress: fm.deliveryAddress, estimatedArrival: fm.estimatedArrival, deposit: parseFloat(fm.deposit) || 0, debt: parseFloat(fm.debt) || 0, applyTax: fm.applyTax, notes: fm.notes, createdAt: new Date().toISOString() },
                  customer: customers.find(c => c.id === fm.customerId) || null,
                  items, services, wts, ats, vatRate, hideSupplierName, layout
                })} />
            )}
            <button onClick={() => setShowPrintModal(true)} style={{ padding: '6px 14px', borderRadius: 6, border: '1.5px solid var(--bd)', background: 'var(--bgs)', color: 'var(--ts)', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 600 }}>🖨 In nháp / PDF</button>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Khách hàng */}
        <div style={{ background: 'var(--bgc)', borderRadius: 10, border: '1.5px solid var(--bd)', padding: 16 }}>
          {secTitle('Khách hàng *')}
          <select value={fm.customerId || ''} onChange={e => f('customerId')(parseInt(e.target.value) || null)}
            style={{ ...inpSt, marginBottom: 8 }}>
            <option value="">— Chọn khách hàng —</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.salutation ? c.salutation + ' ' : ''}{c.name} · {c.phone1}</option>)}
          </select>
          <button onClick={onNewCustomer} style={{ fontSize: '0.72rem', color: 'var(--ac)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}>+ Khách mới</button>
          {selCust && (
            <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 6, background: 'var(--bgs)', border: '1px solid var(--bd)', fontSize: '0.76rem' }}>
              <div style={{ fontWeight: 700, color: 'var(--br)' }}>{selCust.salutation && <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--ac)', background: 'var(--acbg)', padding: '1px 5px', borderRadius: 3, marginRight: 5 }}>{selCust.salutation}</span>}{selCust.name}</div>
              <div style={{ color: 'var(--ts)' }}>{selCust.address}</div>
              <div style={{ color: 'var(--tm)' }}>{selCust.phone1}</div>
            </div>
          )}
          {/* V-25: cảnh báo công nợ vượt hạn mức */}
          {selCust?.debtLimit > 0 && customerDebt + total > selCust.debtLimit && (
            <div style={{ marginTop: 6, padding: '6px 10px', borderRadius: 5, background: '#FFF3E0', border: '1px solid #FF9800', fontSize: '0.72rem', color: '#E65100' }}>
              ⚠ Công nợ hiện tại: <strong>{fmtMoney(customerDebt)}</strong> / Hạn mức: <strong>{fmtMoney(selCust.debtLimit)}</strong>
              {` — đơn này sẽ vượt hạn mức ${fmtMoney(customerDebt + total - selCust.debtLimit)}`}
            </div>
          )}
        </div>
        {/* Ghi chú */}
        <div style={{ background: 'var(--bgc)', borderRadius: 10, border: '1.5px solid var(--bd)', padding: 16 }}>
          {secTitle('Ghi chú đơn hàng')}
          <textarea value={fm.notes} onChange={e => f('notes')(e.target.value)} rows={4} placeholder="Ghi chú nội bộ..."
            style={{ ...inpSt, resize: 'vertical', fontFamily: 'inherit' }} />
        </div>
      </div>

      {/* Sản phẩm */}
      <div style={{ background: 'var(--bgc)', borderRadius: 10, border: '1.5px solid var(--bd)', padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          {secTitle('Sản phẩm')}
          <button onClick={() => setShowBundleSel(true)} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: 'var(--ac)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.74rem' }}>+ Thêm từ kho</button>
        </div>
        {items.length === 0 ? <div style={{ padding: '16px', textAlign: 'center', color: 'var(--tm)', fontSize: '0.8rem' }}>Chưa có sản phẩm. Bấm "+ Thêm từ kho" để chọn kiện gỗ.</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
              <thead><tr>
                {['Mã kiện / NCC', 'Loại gỗ & Thuộc tính', 'Số tấm', 'KL (m³)', 'ĐVT', 'Đơn giá (đ)', 'Thành tiền', ''].map(h => <th key={h} style={ths}>{h}</th>)}
              </tr></thead>
              <tbody>
                {items.map((it, idx) => {
                  const w = wts.find(x => x.id === it.woodId);
                  const priceChanged = it.listPrice && it.unitPrice !== it.listPrice;
                  // overBoards check removed — bundles list not in scope of OrderForm
                  return (
                    <tr key={idx} style={{ background: idx % 2 ? 'var(--bgs)' : '#fff' }}>
                      <td style={{ padding: '5px 6px', borderBottom: '1px solid var(--bd)', whiteSpace: 'nowrap' }}>
                        <div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--br)' }}>{it.bundleCode}</div>
                        {it.supplierBundleCode && <div style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: 'var(--tm)' }}>{it.supplierBundleCode}</div>}
                      </td>
                      <td style={{ padding: '5px 6px', borderBottom: '1px solid var(--bd)' }}>
                        <div style={{ fontWeight: 700 }}>{w?.name}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--tm)' }}>{Object.entries(it.attributes||{}).map(([k,v]) => `${ats.find(a=>a.id===k)?.name||k}: ${v}`).join(' · ')}</div>
                      </td>
                      <td style={{ padding: '5px 4px', borderBottom: '1px solid var(--bd)' }}>
                        <input type="number" min="0" value={it.boardCount} onChange={e => updateItem(idx, 'boardCount', e.target.value)} style={{ width: 60, padding: '4px 6px', borderRadius: 4, border: '1px solid var(--bd)', fontSize: '0.76rem', textAlign: 'right', outline: 'none' }} />
                      </td>
                      <td style={{ padding: '5px 4px', borderBottom: '1px solid var(--bd)' }}>
                        <input type="number" min="0" step="0.001" value={it.volume} onChange={e => updateItem(idx, 'volume', e.target.value)} style={{ width: 72, padding: '4px 6px', borderRadius: 4, border: '1px solid var(--bd)', fontSize: '0.76rem', textAlign: 'right', outline: 'none' }} />
                      </td>
                      <td style={{ padding: '5px 4px', borderBottom: '1px solid var(--bd)' }}>
                        <select value={it.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} style={{ padding: '4px 5px', borderRadius: 4, border: '1px solid var(--bd)', fontSize: '0.74rem', outline: 'none', background: 'var(--bgc)' }}>
                          <option>m3</option><option>m2</option>
                        </select>
                      </td>
                      <td style={{ padding: '5px 4px', borderBottom: '1px solid var(--bd)' }}>
                        <NumInput value={it.unitPrice ?? 0} onChange={n => updateItem(idx, 'unitPrice', n)} style={{ width: 100, padding: '4px 6px', borderRadius: 4, border: '1.5px solid ' + (priceChanged ? 'var(--ac)' : 'var(--bd)'), fontSize: '0.76rem', textAlign: 'right', outline: 'none', color: priceChanged ? 'var(--ac)' : 'inherit' }} />
                        {priceChanged && <div style={{ fontSize: '0.58rem', color: 'var(--ac)', whiteSpace: 'nowrap' }}>⚠ Bảng giá: {it.listPrice?.toFixed(1)}</div>}
                      </td>
                      <td style={{ padding: '5px 6px', borderBottom: '1px solid var(--bd)', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(it.amount)}</td>
                      <td style={{ padding: '5px 4px', borderBottom: '1px solid var(--bd)', textAlign: 'center' }}>
                        <button onClick={() => removeItem(idx)} style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid var(--dg)', background: 'transparent', color: 'var(--dg)', cursor: 'pointer', fontSize: '0.7rem' }}>✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {items.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 12px', borderTop: '2px solid var(--bds)', background: 'var(--bgh)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--brl)', fontWeight: 700, textTransform: 'uppercase', marginRight: 12 }}>Tổng tiền hàng</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--br)', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(itemsTotal)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dịch vụ */}
      <div style={{ background: 'var(--bgc)', borderRadius: 10, border: '1.5px solid var(--bd)', padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          {secTitle('Dịch vụ thêm')}
          <button onClick={addService} style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontSize: '0.72rem' }}>+ Thêm</button>
        </div>
        {services.map((s, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
            <input value={s.description} onChange={e => updateSvc(idx, 'description', e.target.value)} placeholder="Mô tả dịch vụ..." style={{ ...inpSt, flex: 1 }} />
            <NumInput value={s.amount} onChange={n => updateSvc(idx, 'amount', n)} placeholder="Thành tiền" style={{ ...inpSt, width: 130, textAlign: 'right' }} />
            <button onClick={() => removeSvc(idx)} style={{ width: 26, height: 26, borderRadius: 4, border: '1px solid var(--dg)', background: 'transparent', color: 'var(--dg)', cursor: 'pointer', flexShrink: 0 }}>✕</button>
          </div>
        ))}
        {svcTotal > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--bd)', marginTop: 4 }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--brl)', fontWeight: 700, textTransform: 'uppercase', marginRight: 12 }}>Tổng dịch vụ</span>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--br)', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(svcTotal)}</span>
          </div>
        )}
      </div>

      {/* Vận chuyển */}
      <div style={{ background: 'var(--bgc)', borderRadius: 10, border: '1.5px solid var(--bd)', padding: 16, marginBottom: 16 }}>
        {secTitle('Vận chuyển')}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {['Gọi xe cho khách', 'Xe của khách'].map(t => (
            <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', padding: '5px 12px', borderRadius: 6, border: fm.shippingType === t ? '1.5px solid var(--ac)' : '1.5px solid var(--bd)', background: fm.shippingType === t ? 'var(--acbg)' : 'var(--bgc)', fontSize: '0.78rem', fontWeight: fm.shippingType === t ? 700 : 500, color: fm.shippingType === t ? 'var(--ac)' : 'var(--ts)' }}>
              <input type="radio" name="shType" value={t} checked={fm.shippingType === t} onChange={() => f('shippingType')(t)} style={{ accentColor: 'var(--ac)' }} />{t}
            </label>
          ))}
        </div>
        {fm.shippingType === 'Gọi xe cho khách' ? (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}><label style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--brl)', display: 'block', marginBottom: 3, textTransform: 'uppercase' }}>Đơn vị vận chuyển</label><input value={fm.shippingCarrier} onChange={e => f('shippingCarrier')(e.target.value)} style={inpSt} /></div>
            <div style={{ flex: '1 1 150px' }}><label style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--brl)', display: 'block', marginBottom: 3, textTransform: 'uppercase' }}>Phí vận chuyển (đ)</label><NumInput value={fm.shippingFee} onChange={n => f('shippingFee')(n)} style={inpSt} /></div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[['Tên lái xe', 'driverName'], ['SĐT lái xe', 'driverPhone'], ['Biển số xe', 'licensePlate'], ['Giờ đến dự kiến', 'estimatedArrival']].map(([lb, k]) => (
              <div key={k} style={{ flex: '1 1 160px' }}><label style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--brl)', display: 'block', marginBottom: 3, textTransform: 'uppercase' }}>{lb}</label><input value={fm[k]} onChange={e => f(k)(e.target.value)} style={inpSt} /></div>
            ))}
            <div style={{ flex: '1 1 280px' }}><label style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--brl)', display: 'block', marginBottom: 3, textTransform: 'uppercase' }}>Địa chỉ nhận hàng</label><input value={fm.deliveryAddress} onChange={e => f('deliveryAddress')(e.target.value)} style={inpSt} /></div>
            <div style={{ flex: '1 1 280px' }}><label style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--brl)', display: 'block', marginBottom: 3, textTransform: 'uppercase' }}>Ghi chú vận chuyển</label><input value={fm.shippingNotes} onChange={e => f('shippingNotes')(e.target.value)} style={inpSt} /></div>
          </div>
        )}
      </div>

      {/* Thanh toán tổng kết */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div style={{ background: 'var(--bgc)', borderRadius: 10, border: '1.5px solid var(--bd)', padding: 16 }}>
          {secTitle('Thuế & Giảm trừ')}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
            <input type="checkbox" checked={fm.applyTax} onChange={e => f('applyTax')(e.target.checked)} style={{ accentColor: 'var(--ac)' }} />Áp dụng thuế VAT {Math.round(vatRate * 100)}% <span style={{ fontWeight: 400, fontSize: '0.72rem', color: 'var(--tm)' }}>(chỉ tính trên tiền hàng, không tính dịch vụ & vận chuyển)</span>
          </label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1 }}><label style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--brl)', display: 'block', marginBottom: 3, textTransform: 'uppercase' }}>Đặt cọc (đ)</label><NumInput value={fm.deposit} onChange={n => f('deposit')(n)} style={inpSt} /></div>
            <div style={{ flex: 1 }}><label style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--brl)', display: 'block', marginBottom: 3, textTransform: 'uppercase' }}>Công nợ (đ)</label><NumInput value={fm.debt} onChange={n => f('debt')(n)} style={inpSt} /></div>
          </div>
        </div>
        <div style={{ background: 'var(--bgs)', borderRadius: 10, border: '1.5px solid var(--bds)', padding: 16 }}>
          {secTitle('Tổng kết')}
          {[items.length > 0 && ['Tiền hàng', itemsTotal], svcTotal > 0 && ['Tiền dịch vụ', svcTotal], (parseFloat(fm.shippingFee) > 0) && ['Phí vận chuyển', parseFloat(fm.shippingFee)], 'sep', fm.applyTax && [`Thuế VAT ${Math.round(vatRate * 100)}% (tiền hàng)`, taxAmount], ['Tổng cộng', total], fm.deposit > 0 && ['Đặt cọc', -parseFloat(fm.deposit)], fm.debt > 0 && ['Công nợ', -parseFloat(fm.debt)]].filter(Boolean).map((row, i) => row === 'sep' ? (
            <div key="sep" style={{ borderTop: '1px dashed var(--bds)', margin: '4px 0' }} />
          ) : (
            <div key={row[0]} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--ts)' }}>{row[0]}</span>
              <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{row[1] < 0 ? `- ${fmtMoney(-row[1])}` : fmtMoney(row[1])}</span>
            </div>
          ))}
          <div style={{ borderTop: '2px solid var(--bds)', marginTop: 8, paddingTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--br)' }}>Cần thanh toán</span>
              <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--br)' }}>{fmtMoney(toPay)}</span>
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--tm)', fontStyle: 'italic', marginTop: 3 }}>{soThanhChu(toPay)}</div>
          </div>
        </div>
      </div>

      {/* V-27: cảnh báo giá thấp hơn bảng */}
      {belowPriceItems.length > 0 && (
        <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 7, background: '#FFF8E1', border: '1px solid #FFD54F', fontSize: '0.75rem', color: '#5D4037' }}>
          ⚠ <strong>{belowPriceItems.length} mặt hàng</strong> có giá thấp hơn bảng giá — đơn sẽ chuyển sang <strong>Chờ duyệt</strong> và cần admin xác nhận trước khi xử lý.
          <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: '2px 10px' }}>
            {belowPriceItems.map((it, i) => (
              <span key={i} style={{ fontSize: '0.68rem', color: '#795548' }}>
                {it.bundleCode}: <span style={{ color: 'var(--ac)', fontWeight: 700 }}>{fmtMoney(it.unitPrice)}</span> <span style={{ color: 'var(--tm)' }}>(bảng: {fmtMoney(it.listPrice)}, −{Math.round((1 - it.unitPrice / it.listPrice) * 100)}%)</span>
              </span>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button onClick={() => onDone(null)} disabled={saving} style={{ padding: '9px 16px', borderRadius: 7, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
          ← Hủy
        </button>
        {isNew && (
          <button onClick={() => handleSave('Nháp')} disabled={saving} style={{ padding: '9px 16px', borderRadius: 7, border: '1.5px solid var(--brl)', background: 'transparent', color: 'var(--brl)', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.82rem' }}>
            💾 Lưu nháp
          </button>
        )}
        {initial?.id && <button onClick={() => handleSave(initial.paymentStatus || 'Chưa thanh toán')} disabled={saving} style={{ padding: '9px 20px', borderRadius: 7, border: 'none', background: saving ? 'var(--bd)' : 'var(--brl)', color: saving ? 'var(--tm)' : '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.82rem' }}>Cập nhật đơn</button>}
        {(!initial?.id || initial.paymentStatus !== 'Đã thanh toán') && (
          <button onClick={() => handleSave('Chưa thanh toán')} disabled={saving} style={{ padding: '9px 20px', borderRadius: 7, border: 'none', background: saving ? 'var(--bd)' : 'var(--ac)', color: saving ? 'var(--tm)' : '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.82rem' }}>
            {saving ? 'Đang lưu...' : belowPriceItems.length > 0 ? '📋 Tạo đơn → Chờ duyệt' : '📋 Tạo đơn (Chưa TT)'}
          </button>
        )}
        <button onClick={() => handleSave('Đã thanh toán')} disabled={saving || initial?.paymentStatus === 'Đã thanh toán'} style={{ padding: '9px 20px', borderRadius: 7, border: 'none', background: saving || initial?.paymentStatus === 'Đã thanh toán' ? 'var(--bd)' : 'var(--gn)', color: saving || initial?.paymentStatus === 'Đã thanh toán' ? 'var(--tm)' : '#fff', cursor: saving || initial?.paymentStatus === 'Đã thanh toán' ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.82rem' }}>
          {saving ? 'Đang lưu...' : '✓ Đã thanh toán'}
        </button>
      </div>
    </div>
  );
}

// ── OrderDetail ───────────────────────────────────────────────────────────────

function OrderDetail({ orderId, wts, ats, onBack, onEdit, onOrderUpdated, notify, ce, vatRate = 0.08 }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exportImgs, setExportImgs] = useState([]);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    (async () => {
      const { fetchOrderDetail } = await import('../api.js');
      const d = await fetchOrderDetail(orderId);
      setData(d); setLoading(false);
    })();
  }, [orderId]);

  const handlePayment = async () => {
    if (!window.confirm('Xác nhận đã nhận thanh toán?')) return;
    const { updateOrderPayment } = await import('../api.js');
    const r = await updateOrderPayment(orderId);
    if (r.error) return notify('Lỗi: ' + r.error, false);
    setData(d => ({ ...d, order: { ...d.order, paymentStatus: 'Đã thanh toán', status: 'Đã thanh toán' } }));
    onOrderUpdated?.({ id: orderId, paymentStatus: 'Đã thanh toán', status: 'Đã thanh toán' });
    notify('Đã xác nhận thanh toán');
  };

  // V-27: duyệt giá inline
  const handleApprovePrice = async () => {
    if (!window.confirm('Duyệt tất cả giá và chuyển đơn sang "Chưa thanh toán"?')) return;
    const { approveOrderPrice } = await import('../api.js');
    const r = await approveOrderPrice(orderId);
    if (r.error) return notify('Lỗi: ' + r.error, false);
    setData(d => ({ ...d, order: { ...d.order, paymentStatus: 'Chưa thanh toán', status: 'Chưa thanh toán' } }));
    onOrderUpdated?.({ id: orderId, paymentStatus: 'Chưa thanh toán', status: 'Chưa thanh toán' });
    notify('Đã duyệt giá — đơn chuyển sang Chưa thanh toán');
  };

  const handleExport = async () => {
    const { updateOrderExport, uploadBundleImage } = await import('../api.js');
    let imgUrls = [];
    for (const img of exportImgs) {
      const r = await uploadBundleImage('export-' + orderId, img.file, 'export');
      if (r.url) imgUrls.push(r.url);
    }
    const r = await updateOrderExport(orderId, imgUrls);
    if (r.error) return notify('Lỗi: ' + r.error, false);
    setData(d => ({ ...d, order: { ...d.order, exportStatus: 'Đã xuất', status: 'Đã xuất', exportImages: imgUrls } }));
    onOrderUpdated?.({ id: orderId, exportStatus: 'Đã xuất', status: 'Đã xuất' });
    setExportImgs([]);
    notify('Đã xuất kho');
  };

  const handleExportFiles = (e) => {
    Array.from(e.target.files).forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => setExportImgs(p => [...p, { file, preview: ev.target.result }]);
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--tm)' }}>Đang tải...</div>;
  if (!data?.order) return <div style={{ padding: 20, color: 'var(--dg)' }}>Không tìm thấy đơn hàng</div>;

  const { order, customer, items, services } = data;
  const { subtotal, taxAmount, total, toPay, itemsTotal, svcTotal } = calcTotals(items, services, order.shippingFee, order.applyTax, order.deposit, order.debt, vatRate);
  const canEdit = ce && order.paymentStatus !== 'Đã thanh toán';

  const pmtBadgeStyle = (s) => {
    if (s === 'Đã thanh toán') return { background: 'rgba(50,79,39,0.1)', color: 'var(--gn)' };
    if (s === 'Nháp') return { background: 'rgba(168,155,142,0.15)', color: 'var(--tm)' };
    if (s === 'Chờ duyệt') return { background: 'rgba(255,152,0,0.15)', color: '#E65100', border: '1px solid #FFB74D' };
    return { background: 'rgba(242,101,34,0.1)', color: 'var(--ac)' };
  };
  const badge = (label, ok, isPayment) => {
    const st = isPayment ? pmtBadgeStyle(label) : (ok ? { background: 'rgba(50,79,39,0.1)', color: 'var(--gn)' } : { background: 'rgba(242,101,34,0.1)', color: 'var(--ac)' });
    return <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.68rem', fontWeight: 700, ...st }}>{label}</span>;
  };
  // V-27
  const pendingApproval = order.paymentStatus === 'Chờ duyệt';
  const belowPriceCount = items.filter(it => it.listPrice != null && it.listPrice > 0 && it.unitPrice !== it.listPrice).length;
  const sec = (t) => <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--tm)', textTransform: 'uppercase', marginBottom: 8, marginTop: 4, letterSpacing: '0.06em' }}>{t}</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ padding: '6px 12px', borderRadius: 6, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 600 }}>← Danh sách</button>
        <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '1rem', color: 'var(--br)' }}>{order.orderCode}</span>
        {badge(order.paymentStatus, order.paymentStatus === 'Đã thanh toán', true)}
        {badge(order.exportStatus, order.exportStatus === 'Đã xuất', false)}
        <div style={{ flex: 1 }} />
        {/* V-27: nút duyệt giá inline — chỉ admin, chỉ khi Chờ duyệt */}
        {pendingApproval && ce && (
          <button onClick={handleApprovePrice} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#FF9800', color: '#fff', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 700 }}>
            ✅ Duyệt giá ({belowPriceCount} mặt hàng)
          </button>
        )}
        {showPrintModal && (
          <PrintModal onClose={() => setShowPrintModal(false)}
            onPrint={({ layout, hideSupplierName }) => printOrder({ order, customer, items, services, wts, ats, vatRate, hideSupplierName, layout })} />
        )}
        <button onClick={() => setShowPrintModal(true)} style={{ padding: '6px 14px', borderRadius: 6, border: '1.5px solid var(--bd)', background: 'var(--bgs)', color: 'var(--ts)', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 600 }}>🖨 In / PDF</button>
        {canEdit && <button onClick={() => onEdit(order, items, services)} style={{ padding: '6px 14px', borderRadius: 6, border: '1.5px solid var(--ac)', background: 'var(--acbg)', color: 'var(--ac)', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 700 }}>✏️ Sửa đơn</button>}
      </div>

      {/* V-27: banner chờ duyệt */}
      {pendingApproval && (
        <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: '#FFF8E1', border: '2px solid #FF9800', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.1rem' }}>⏳</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#E65100' }}>Chờ duyệt giá</div>
            <div style={{ fontSize: '0.72rem', color: '#795548', marginTop: 2 }}>
              Đơn có {belowPriceCount} mặt hàng giá thấp hơn bảng — Admin cần duyệt để tiếp tục xử lý.
            </div>
          </div>
          {ce && (
            <button onClick={handleApprovePrice} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: '#FF9800', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
              ✅ Duyệt giá
            </button>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--bgc)', border: '1px solid var(--bd)' }}>
          {sec('Khách hàng')}
          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--br)', marginBottom: 2 }}>{customer?.salutation && <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--ac)', background: 'var(--acbg)', padding: '1px 5px', borderRadius: 3, marginRight: 5 }}>{customer.salutation}</span>}{customer?.name || order.customerName}</div>
          {customer?.companyName && <div style={{ fontSize: '0.76rem', color: 'var(--ts)' }}>{customer.companyName}</div>}
          <div style={{ fontSize: '0.76rem', color: 'var(--ts)' }}>{customer?.address || order.customerAddress}</div>
          <div style={{ fontSize: '0.76rem', color: 'var(--tm)' }}>{customer?.phone1 || order.customerPhone}</div>
        </div>
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--bgc)', border: '1px solid var(--bd)' }}>
          {sec('Thông tin đơn')}
          <div style={{ fontSize: '0.76rem', color: 'var(--ts)' }}>Ngày tạo: <strong>{new Date(order.createdAt).toLocaleString('vi-VN')}</strong></div>
          {order.paymentDate && <div style={{ fontSize: '0.76rem', color: 'var(--gn)' }}>Thanh toán: {new Date(order.paymentDate).toLocaleString('vi-VN')}</div>}
          {order.exportDate && <div style={{ fontSize: '0.76rem', color: 'var(--gn)' }}>Xuất kho: {new Date(order.exportDate).toLocaleString('vi-VN')}</div>}
          {order.notes && <div style={{ fontSize: '0.74rem', color: 'var(--tm)', marginTop: 4, fontStyle: 'italic' }}>{order.notes}</div>}
        </div>
      </div>

      {/* Items */}
      <div style={{ background: 'var(--bgc)', borderRadius: 10, border: '1px solid var(--bd)', marginBottom: 14, overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--bd)', fontWeight: 700, fontSize: '0.8rem', color: 'var(--br)' }}>Sản phẩm ({items.length})</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
            <thead><tr style={{ background: 'var(--bgh)' }}>
              {['Mã kiện / NCC', 'Loại gỗ & Thuộc tính', 'Số tấm', 'KL (m³)', 'ĐVT', 'Đơn giá', 'Thành tiền'].map(h => <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--brl)', fontWeight: 700, fontSize: '0.6rem', textTransform: 'uppercase', borderBottom: '2px solid var(--bds)', whiteSpace: 'nowrap' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {items.map((it, i) => {
                const w = wts.find(x => x.id === it.woodId);
                const priceChanged = it.listPrice != null && it.listPrice > 0 && it.unitPrice !== it.listPrice;
                const discountPct = priceChanged ? Math.round((1 - it.unitPrice / it.listPrice) * 100) : 0;
                return (
                  <tr key={i} style={{ background: priceChanged ? 'rgba(255,152,0,0.04)' : (i % 2 ? 'var(--bgs)' : '#fff') }}>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--bd)', whiteSpace: 'nowrap' }}>
                      <div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--br)' }}>{it.bundleCode}</div>
                      {it.supplierBundleCode && <div style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: 'var(--tm)' }}>{it.supplierBundleCode}</div>}
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--bd)' }}>
                      <div style={{ fontWeight: 600 }}>{w?.icon} {w?.name}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--tm)' }}>{Object.entries(it.attributes||{}).map(([k,v]) => `${ats.find(a=>a.id===k)?.name||k}: ${v}`).join(' · ')}</div>
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--bd)', textAlign: 'right' }}>{it.boardCount}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--bd)', textAlign: 'right' }}>{(it.volume||0).toFixed(3)}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--bd)' }}>{it.unit}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--bd)', textAlign: 'right' }}>
                      <span style={{ color: priceChanged ? '#E65100' : 'inherit', fontWeight: priceChanged ? 700 : 500 }}>{fmtMoney(it.unitPrice)}</span>
                      {priceChanged && (
                        <div style={{ fontSize: '0.6rem', color: '#795548', marginTop: 1 }}>
                          Bảng: {fmtMoney(it.listPrice)} <span style={{ color: '#E65100', fontWeight: 700 }}>−{discountPct}%</span>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--bd)', textAlign: 'right', fontWeight: 700 }}>{fmtMoney(it.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 12px', borderTop: '2px solid var(--bds)', background: 'var(--bgh)' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--brl)', fontWeight: 700, textTransform: 'uppercase', marginRight: 12 }}>Tổng tiền hàng</span>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--br)', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(itemsTotal)}</span>
          </div>
        </div>
      </div>

      {services.filter(s => s.amount > 0).length > 0 && (
        <div style={{ background: 'var(--bgc)', borderRadius: 8, border: '1px solid var(--bd)', marginBottom: 14, padding: '10px 14px' }}>
          <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--br)', marginBottom: 8 }}>Dịch vụ thêm</div>
          {services.filter(s => s.amount > 0).map((s, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', padding: '3px 0', borderBottom: '1px solid var(--bd)' }}><span>{s.description}</span><span style={{ fontWeight: 600 }}>{fmtMoney(s.amount)}</span></div>)}
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 6, marginTop: 4 }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--brl)', fontWeight: 700, textTransform: 'uppercase', marginRight: 12 }}>Tổng dịch vụ</span>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--br)', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(svcTotal)}</span>
          </div>
        </div>
      )}

      {/* Vận chuyển */}
      {order.shippingType && (
        <div style={{ background: 'var(--bgc)', borderRadius: 8, border: '1px solid var(--bd)', marginBottom: 14, padding: '10px 14px' }}>
          <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--br)', marginBottom: 10 }}>Vận chuyển — {order.shippingType}</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {order.shippingType === 'Gọi xe cho khách' ? (
              <>
                {order.shippingCarrier && <div style={{ flex: '1 1 160px' }}>{sec('Đơn vị VC')}<div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{order.shippingCarrier}</div></div>}
                {order.shippingFee > 0 && <div style={{ flex: '1 1 120px' }}>{sec('Phí vận chuyển')}<div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--br)' }}>{fmtMoney(order.shippingFee)}</div></div>}
              </>
            ) : (
              <>
                {(order.driverName || order.driverPhone) && (
                  <div style={{ flex: '1 1 160px' }}>
                    {sec('Lái xe')}
                    <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{order.driverName || '—'}</div>
                    {order.driverPhone && <div style={{ fontSize: '0.74rem', color: 'var(--tm)' }}>{order.driverPhone}</div>}
                    {order.licensePlate && <div style={{ fontSize: '0.74rem', color: 'var(--ts)' }}>🚗 {order.licensePlate}</div>}
                  </div>
                )}
                {order.deliveryAddress && <div style={{ flex: '1 1 200px' }}>{sec('Địa chỉ nhận')}<div style={{ fontSize: '0.8rem' }}>{order.deliveryAddress}</div></div>}
                {order.estimatedArrival && <div style={{ flex: '1 1 140px' }}>{sec('Giờ dự kiến')}<div style={{ fontSize: '0.8rem' }}>{order.estimatedArrival}</div></div>}
              </>
            )}
            {order.shippingNotes && <div style={{ flex: '1 1 100%' }}>{sec('Ghi chú VC')}<div style={{ fontSize: '0.78rem', color: 'var(--ts)', fontStyle: 'italic' }}>{order.shippingNotes}</div></div>}
          </div>
        </div>
      )}

      {/* Tổng kết + Hành động */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div style={{ background: 'var(--bgc)', borderRadius: 8, border: '1px solid var(--bd)', padding: '12px 16px' }}>
          {[items.length > 0 && ['Tiền hàng', itemsTotal], svcTotal > 0 && ['Tiền dịch vụ', svcTotal], order.shippingFee > 0 && ['Phí vận chuyển', order.shippingFee], 'sep', order.applyTax && [`Thuế VAT ${Math.round(vatRate * 100)}% (tiền hàng)`, taxAmount], ['Tổng cộng', total], order.deposit > 0 && ['Đặt cọc', -order.deposit], order.debt > 0 && ['Công nợ', -order.debt]].filter(Boolean).map((row) => row === 'sep' ? (
            <div key="sep" style={{ borderTop: '1px dashed var(--bds)', margin: '4px 0' }} />
          ) : (
            <div key={row[0]} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--ts)' }}>{row[0]}</span>
              <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{row[1] < 0 ? `- ${fmtMoney(-row[1])}` : fmtMoney(row[1])}</span>
            </div>
          ))}
          <div style={{ borderTop: '2px solid var(--bds)', marginTop: 8, paddingTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, color: 'var(--br)' }}>Cần thanh toán</span>
              <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--br)' }}>{fmtMoney(toPay)}</span>
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--tm)', fontStyle: 'italic', marginTop: 3 }}>{soThanhChu(toPay)}</div>
          </div>
        </div>
        <div style={{ background: 'var(--bgc)', borderRadius: 8, border: '1px solid var(--bd)', padding: '12px 16px' }}>
          {sec('Cập nhật trạng thái')}
          {pendingApproval ? (
            <div style={{ padding: '10px 0', textAlign: 'center', color: '#E65100', fontSize: '0.78rem', fontWeight: 600 }}>
              ⏳ Đang chờ duyệt giá — chưa thể cập nhật trạng thái
            </div>
          ) : (
          <>
          {order.paymentStatus !== 'Đã thanh toán' && ce && (
            <button onClick={handlePayment} style={{ width: '100%', padding: '9px', borderRadius: 7, border: 'none', background: 'var(--gn)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', marginBottom: 8 }}>✓ Xác nhận Đã thanh toán</button>
          )}
          {order.exportStatus !== 'Đã xuất' && ce && (
            <div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                {exportImgs.map((img, i) => <div key={i} style={{ position: 'relative' }}><img src={img.preview} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--bd)' }} /><button onClick={() => setExportImgs(p => p.filter((_, j) => j !== i))} style={{ position: 'absolute', top: -4, right: -4, width: 14, height: 14, borderRadius: '50%', border: 'none', background: 'var(--dg)', color: '#fff', cursor: 'pointer', fontSize: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button></div>)}
                <button onClick={() => imgRef.current?.click()} style={{ width: 48, height: 48, borderRadius: 4, border: '1.5px dashed var(--bd)', background: 'var(--bgs)', color: 'var(--tm)', cursor: 'pointer', fontSize: '1rem' }}>+</button>
              </div>
              <input ref={imgRef} type="file" multiple accept="image/*" onChange={handleExportFiles} style={{ display: 'none' }} />
              <button onClick={handleExport} style={{ width: '100%', padding: '9px', borderRadius: 7, border: 'none', background: 'var(--br)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>📦 Xác nhận Đã xuất kho</button>
            </div>
          )}
          {order.paymentStatus === 'Đã thanh toán' && order.exportStatus === 'Đã xuất' && (
            <div style={{ padding: 12, textAlign: 'center', color: 'var(--gn)', fontWeight: 700, fontSize: '0.82rem' }}>✓ Đơn hàng hoàn tất</div>
          )}
          </>
          )}
          {order.exportImages?.length > 0 && (
            <div style={{ marginTop: 8 }}><div style={{ fontSize: '0.62rem', color: 'var(--tm)', marginBottom: 4 }}>Ảnh xuất kho:</div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>{order.exportImages.map((url, i) => <a key={i} href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--bd)' }} /></a>)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── OrderList ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

function OrderList({ orders, onView, onNew, onContinue, ce }) {
  const [fPayment, setFPayment] = useState('');
  const [fExport, setFExport] = useState('');
  const [fSearch, setFSearch] = useState('');
  const [sortField, setSortField] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let arr = [...orders];
    if (fPayment) arr = arr.filter(o => o.paymentStatus === fPayment);
    if (fExport) arr = arr.filter(o => o.exportStatus === fExport);
    if (fSearch) { const s = fSearch.toLowerCase(); arr = arr.filter(o => o.orderCode.toLowerCase().includes(s) || o.customerName.toLowerCase().includes(s) || o.customerPhone.includes(s)); }
    arr.sort((a, b) => {
      let va = a[sortField], vb = b[sortField];
      if (va == null) va = ''; if (vb == null) vb = '';
      const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [orders, fPayment, fExport, fSearch, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const toggleSort = (f) => { setSortField(f); setSortDir(d => sortField === f ? (d === 'asc' ? 'desc' : 'asc') : 'desc'); setPage(1); };
  const si = (f) => sortField === f ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

  const ths = { padding: '8px 10px', textAlign: 'left', background: 'var(--bgh)', color: 'var(--brl)', fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase', borderBottom: '2px solid var(--bds)', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--br)' }}>🛒 Đơn hàng</h2>
        {ce && <button onClick={onNew} style={{ padding: '7px 16px', borderRadius: 7, background: 'var(--ac)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem' }}>+ Tạo đơn mới</button>}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10, padding: '10px 12px', borderRadius: 8, background: 'var(--bgc)', border: '1px solid var(--bd)', alignItems: 'center' }}>
        <input value={fSearch} onChange={e => { setFSearch(e.target.value); setPage(1); }} placeholder="🔍 Mã đơn, tên khách, SĐT..."
          style={{ flex: 2, minWidth: 180, padding: '6px 10px', borderRadius: 6, border: '1.5px solid var(--bd)', fontSize: '0.78rem', outline: 'none' }} />
        <select value={fPayment} onChange={e => { setFPayment(e.target.value); setPage(1); }} style={{ flex: 1, minWidth: 160, padding: '6px 9px', borderRadius: 6, border: '1.5px solid var(--bd)', fontSize: '0.78rem', background: 'var(--bgc)', outline: 'none' }}>
          <option value="">Tất cả thanh toán</option>
          <option>Nháp</option><option>Chờ duyệt</option><option>Chưa thanh toán</option><option>Đã thanh toán</option>
        </select>
        <select value={fExport} onChange={e => { setFExport(e.target.value); setPage(1); }} style={{ flex: 1, minWidth: 140, padding: '6px 9px', borderRadius: 6, border: '1.5px solid var(--bd)', fontSize: '0.78rem', background: 'var(--bgc)', outline: 'none' }}>
          <option value="">Tất cả xuất kho</option>
          <option>Chưa xuất</option><option>Đã xuất</option>
        </select>
        {(fPayment || fExport || fSearch) && <button onClick={() => { setFPayment(''); setFExport(''); setFSearch(''); setPage(1); }} style={{ padding: '6px 10px', borderRadius: 6, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 600 }}>✕ Xóa lọc</button>}
      </div>
      <div style={{ background: 'var(--bgc)', borderRadius: 10, border: '1px solid var(--bd)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead><tr>
              <th onClick={() => toggleSort('createdAt')} style={ths}>Ngày tạo{si('createdAt')}</th>
              <th onClick={() => toggleSort('orderCode')} style={ths}>Mã đơn{si('orderCode')}</th>
              <th onClick={() => toggleSort('customerName')} style={ths}>Khách hàng{si('customerName')}</th>
              <th style={{ ...ths, cursor: 'default' }}>Địa chỉ</th>
              <th onClick={() => toggleSort('paymentStatus')} style={ths}>Thanh toán{si('paymentStatus')}</th>
              <th onClick={() => toggleSort('exportStatus')} style={ths}>Xuất kho{si('exportStatus')}</th>
              <th onClick={() => toggleSort('totalAmount')} style={{ ...ths, textAlign: 'right' }}>Tổng tiền{si('totalAmount')}</th>
            </tr></thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 30, textAlign: 'center', color: 'var(--tm)' }}>{orders.length === 0 ? 'Chưa có đơn hàng nào.' : 'Không có kết quả.'}</td></tr>
              ) : paginated.map((o, i) => {
                const paid = o.paymentStatus === 'Đã thanh toán';
                const exported = o.exportStatus === 'Đã xuất';
                return (
                  <tr key={o.id} onClick={() => o.status === 'Nháp' ? onContinue?.(o.id) : onView(o.id)} style={{ background: i % 2 ? 'var(--bgs)' : '#fff', cursor: 'pointer' }}>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--bd)', color: 'var(--tm)', fontSize: '0.74rem' }}>{new Date(o.createdAt).toLocaleDateString('vi-VN')}</td>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--bd)', fontFamily: 'monospace', fontWeight: 700, color: 'var(--br)' }}>{o.orderCode}</td>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--bd)', fontWeight: 600 }}>{o.customerName}<div style={{ fontSize: '0.7rem', color: 'var(--tm)' }}>{o.customerPhone}</div></td>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--bd)', color: 'var(--ts)', fontSize: '0.76rem', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.customerAddress}</td>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--bd)' }}><span style={{ padding: '2px 7px', borderRadius: 4, fontSize: '0.68rem', fontWeight: 700, background: paid ? 'rgba(50,79,39,0.1)' : o.paymentStatus === 'Chờ duyệt' ? 'rgba(255,152,0,0.15)' : (o.paymentStatus === 'Nháp' ? 'rgba(168,155,142,0.15)' : 'rgba(242,101,34,0.08)'), color: paid ? 'var(--gn)' : o.paymentStatus === 'Chờ duyệt' ? '#E65100' : (o.paymentStatus === 'Nháp' ? 'var(--tm)' : 'var(--ac)') }}>{o.paymentStatus}</span></td>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--bd)' }}><span style={{ padding: '2px 7px', borderRadius: 4, fontSize: '0.68rem', fontWeight: 700, background: exported ? 'rgba(50,79,39,0.1)' : 'rgba(168,155,142,0.1)', color: exported ? 'var(--gn)' : 'var(--tm)' }}>{o.exportStatus}</span></td>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--bd)', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(o.totalAmount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: 10, borderTop: '1px solid var(--bd)' }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid var(--bd)', background: page === 1 ? 'var(--bgs)' : 'var(--bgc)', cursor: page === 1 ? 'not-allowed' : 'pointer', color: 'var(--ts)', fontSize: '0.78rem' }}>◀</button>
            <span style={{ fontSize: '0.78rem', color: 'var(--ts)' }}>{page} / {totalPages} — {filtered.length} đơn</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid var(--bd)', background: page === totalPages ? 'var(--bgs)' : 'var(--bgc)', cursor: page === totalPages ? 'not-allowed' : 'pointer', color: 'var(--ts)', fontSize: '0.78rem' }}>▶</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── PgSales main ──────────────────────────────────────────────────────────────

export default function PgSales({ wts, ats, cfg, prices, customers, setCustomers, ce, useAPI, notify, setPg }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // list | create | edit | detail
  const [detailId, setDetailId] = useState(null);
  const [editData, setEditData] = useState(null);
  // V-26: tỷ lệ VAT có thể cấu hình, mặc định 8%
  const [vatRate, setVatRate] = useState(0.08);

  useEffect(() => {
    if (!useAPI) { setLoading(false); return; }
    (async () => {
      try {
        const { fetchOrders, fetchVatRate } = await import('../api.js');
        const [ordersData, vr] = await Promise.all([fetchOrders(), fetchVatRate().catch(() => 0.08)]);
        setOrders(ordersData);
        setVatRate(vr);
      } catch (e) { notify('Lỗi tải đơn hàng: ' + e.message, false); }
      setLoading(false);
    })();
  }, [useAPI]); // eslint-disable-line

  const handleOrderDone = (result) => {
    if (result) {
      (async () => {
        const { fetchOrders } = await import('../api.js');
        const fresh = await fetchOrders().catch(() => null);
        if (fresh) setOrders(fresh);
      })();
    }
    setView('list'); setEditData(null);
  };

  const handleOrderUpdated = (patch) => {
    setOrders(prev => prev.map(o => o.id === patch.id ? { ...o, ...patch } : o));
  };

  const handleEdit = (order, items, services) => {
    setEditData({ order, items, services });
    setView('edit');
  };

  const openEditFromList = async (orderId) => {
    try {
      const { fetchOrderDetail } = await import('../api.js');
      const d = await fetchOrderDetail(orderId);
      if (d.order) { setEditData({ order: d.order, items: d.items, services: d.services }); setView('edit'); }
    } catch (e) { notify('Lỗi: ' + e.message, false); }
  };

  const goNewCustomer = () => setPg('customers');

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--tm)' }}>Đang tải đơn hàng...</div>;

  if (view === 'detail') return (
    <OrderDetail orderId={detailId} wts={wts} ats={ats} ce={ce} notify={notify} vatRate={vatRate}
      onBack={() => setView('list')}
      onOrderUpdated={handleOrderUpdated}
      onEdit={(order, items, services) => { setEditData({ order, items, services }); setView('edit'); }} />
  );

  if (view === 'create') return (
    <OrderForm customers={customers} wts={wts} ats={ats} prices={prices} ce={ce} useAPI={useAPI} notify={notify} vatRate={vatRate}
      onDone={handleOrderDone} onNewCustomer={goNewCustomer} />
  );

  if (view === 'edit' && editData) return (
    <OrderForm initial={{ ...editData.order, id: editData.order.id }} initialItems={editData.items} initialServices={editData.services}
      customers={customers} wts={wts} ats={ats} prices={prices} ce={ce} useAPI={useAPI} notify={notify} vatRate={vatRate}
      onDone={handleOrderDone} onNewCustomer={goNewCustomer} />
  );

  return (
    <OrderList orders={orders} ce={ce} onContinue={openEditFromList}
      onView={(id) => { setDetailId(id); setView('detail'); }}
      onNew={() => setView('create')} />
  );
}
