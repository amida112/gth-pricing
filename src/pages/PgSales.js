import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { bpk, resolvePriceAttrs, resolveRangeGroup, isPerBundle, isM2Wood, calcSvcAmount, svcLabel, DEFAULT_XE_SAY_CONFIG } from "../utils";

// ── Tiện ích ──────────────────────────────────────────────────────────────────

function fmtMoney(n) { return (n || 0).toLocaleString('vi-VN'); }

// Thứ tự hiển thị cố định cho thuộc tính gỗ
const ATTR_DISPLAY_ORDER = ['thickness', 'quality', 'supplier', 'edging', 'length', 'width'];
const ATTR_RAW_UNIT = { length: 'm', width: 'mm' };

/** Trả về chuỗi thuộc tính đã lọc + sắp xếp theo thứ tự chuẩn, chỉ hiện attr được cấu hình */
function fmtItemAttrs(it, cfg, ats) {
  const attrs = it.attributes || {};
  const raw = it.rawMeasurements || {};
  const configured = cfg?.[it.woodId]?.attrs;
  return ATTR_DISPLAY_ORDER
    .filter(k => (!configured || configured.includes(k)) && attrs[k] != null && attrs[k] !== '')
    .map(k => {
      const label = ats.find(a => a.id === k)?.name || k;
      const val = attrs[k];
      const rawVal = raw[k];
      if (rawVal) return `${label}: ${rawVal}${ATTR_RAW_UNIT[k] || ''} (${val})`;
      return `${label}: ${val}`;
    })
    .join(' · ');
}

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

function printOrder({ order, customer, items, services, wts, ats, vatRate = 0.08, hideSupplierName = true, layout = 2, previewOnly = false }) {
  const wood = (id) => wts.find(w => w.id === id);
  const atLabel = (id) => ats.find(a => a.id === id)?.name || id;
  const atOrder = Object.fromEntries(ats.map((a, i) => [a.id, i]));
  const isSupplierAttr = (k) => {
    const lbl = atLabel(k).toLowerCase();
    return lbl.includes('nhà cung cấp') || lbl.includes('ncc') || k.toLowerCase().includes('supplier') || k.toLowerCase() === 'ncc';
  };
  const sortAttrs = (entries) => entries.sort(([a], [b]) => (atOrder[a] ?? 99) - (atOrder[b] ?? 99));
  const attrOf = (it) => sortAttrs(Object.entries(it.attributes||{}).filter(([k]) => !hideSupplierName || !isSupplierAttr(k))).map(([k,v]) => `${atLabel(k)}: ${v}`).join(' · ');
  const attrShort = (it) => sortAttrs(Object.entries(it.attributes||{}).filter(([k]) => !hideSupplierName || !isSupplierAttr(k))).map(([,v]) => v).join(', ');
  const bundleCell = (it) => `<div style="font-weight:700">${it.bundleCode||''}</div>${it.supplierBundleCode ? `<div style="font-size:10px;color:#888">${it.supplierBundleCode}</div>` : ''}`;

  const { taxAmount, toPay, itemsTotal, svcTotal } = calcTotals(items, services, order.shippingFee, order.applyTax, order.deposit, order.debt, vatRate);
  const totalBoards = items.reduce((s, it) => s + (parseInt(it.boardCount) || 0), 0);
  const totalVolume = items.reduce((s, it) => s + (parseFloat(it.volume) || 0), 0).toFixed(3);
  const svcs = services.filter(s => s.amount > 0);

  const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '';
  const payBg = order.paymentStatus === 'Đã thanh toán' ? '#e8f5e9' : '#fff3e0';
  const payColor = order.paymentStatus === 'Đã thanh toán' ? '#27ae60' : '#e67e22';
  const expBg = order.exportStatus === 'Đã xuất' ? '#e8f5e9' : '#f5f5f5';
  const expColor = order.exportStatus === 'Đã xuất' ? '#27ae60' : '#888';
  const statusBadges = `<span style="padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;white-space:nowrap;background:${payBg};color:${payColor}">${order.paymentStatus}</span>
      <span style="padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;white-space:nowrap;background:${expBg};color:${expColor}">${order.exportStatus}</span>`;

  const payRows = () => `${order.applyTax ? `<tr><td>Thuế VAT (${Math.round(vatRate*100)}%)</td><td style="text-align:right">${fmtMoney(taxAmount)}</td></tr>` : ''}
${order.deposit > 0 ? `<tr><td>Đặt cọc</td><td style="text-align:right">− ${fmtMoney(order.deposit)}</td></tr>` : ''}
${order.debt > 0 ? `<tr><td>Công nợ</td><td style="text-align:right">− ${fmtMoney(order.debt)}</td></tr>` : ''}`;

  const bangChu = `<div style="padding:8px 12px;background:#fff8f0;border:1px solid #f0c080;border-radius:4px;margin-bottom:12px"><span style="font-size:10px;color:#888">Bằng chữ: </span><em>${soThanhChu(toPay)}</em></div>`;

  const customerInfo = () => {
    const sal = customer?.salutation ? customer.salutation + ' ' : '';
    const name = customer?.name || order.customerName || '';
    const nickname = customer?.nickname?.trim() || (() => {
      const addr = customer?.address || order.customerAddress || '';
      return addr.includes(',') ? addr.split(',').map(p => p.trim()).filter(Boolean).pop() : addr;
    })();
    const phone = (customer?.phone1 || order.customerPhone || '').replace(/\D/g, '');
    const phoneSuffix = phone.length >= 3 ? phone.slice(-3) : phone;
    const parts = [sal + name, nickname, phoneSuffix].filter(Boolean);
    return `<div style="font-weight:700;font-size:13px">${parts.join(' · ')}</div>
    ${customer?.companyName ? `<div style="font-size:11px;color:#666;margin-top:2px">${customer.companyName}</div>` : ''}`;
  };

  const sharedFooter = (notes) => `${notes ? `<div style="padding:8px 12px;background:#f9f9f9;border:1px solid #ddd;border-radius:4px;font-size:11px;margin-bottom:14px"><strong>Ghi chú:</strong> ${notes}</div>` : ''}
<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:20px;page-break-inside:avoid">
  <div style="text-align:center"><div style="font-size:11px;color:#888;margin-bottom:40px">Khách hàng ký xác nhận</div><div style="border-top:1px solid #ccc;padding-top:4px;font-size:11px;color:#555">(Ký, ghi rõ họ tên)</div></div>
  <div style="text-align:center"><div style="font-size:11px;color:#888;margin-bottom:40px">Đại diện công ty</div><div style="border-top:1px solid #ccc;padding-top:4px;font-size:11px;color:#555">(Ký, đóng dấu)</div></div>
</div>
<div style="margin-top:18px;padding:10px 16px;background:#FFF5EE;border:2px solid #F26522;border-radius:8px;text-align:center;page-break-inside:avoid">
  <div style="font-family:Arial,sans-serif;font-size:14px;font-weight:900;color:#F26522;letter-spacing:0.04em;text-transform:uppercase">KHO GỖ NHẬP KHẨU ÂU – MỸ – PHI</div>
  <div style="font-family:Arial,sans-serif;font-size:11px;font-weight:700;color:#5A3E2B;margin-top:4px">ÓC CHÓ &bull; SỒI &bull; TẦN BÌ &bull; BEECH &bull; GỖ &bull; TEAK &bull; THÔNG &hellip;</div>
  <div style="font-size:10px;color:#888;margin-top:4px">KCN Quốc Oai, Hà Nội &nbsp;|&nbsp; DT419, Đại lộ Thăng Long &nbsp;|&nbsp; <strong style="color:#F26522">Hotline: 0924 35 88 99</strong></div>
</div>
<div style="margin-top:8px;font-size:9px;color:#bbb;text-align:center">In lúc ${new Date().toLocaleString('vi-VN')}</div>`;

  let html = '';

  // ════ LAYOUT A: Gọn tối đa ════
  if (layout === 1) {
    const th = (s='') => `<th style="background:#f5f0e8;padding:4px 5px;text-align:center;font-size:9px;text-transform:uppercase;border:1px solid #ddd;${s}">`
    const td = (s='') => `style="padding:4px 5px;border:1px solid #ddd;vertical-align:top;${s}"`;
    const prodRows = items.map((it, i) => {
      const bg = i%2 ? 'background:#fafafa' : '';
      return `<tr style="${bg}">
<td ${td('text-align:center;white-space:nowrap')}>${i+1}</td>
<td ${td('font-family:monospace')}>${bundleCell(it)}</td>
<td ${td()}><strong>${wood(it.woodId)?.name||it.woodId}</strong>${attrShort(it)?`<div style="font-size:9px;color:#888;margin-top:1px">${attrShort(it)}</div>`:''}${it.notes?`<div style="font-size:9px;color:#aaa">${it.notes}</div>`:''}</td>
<td ${td('text-align:center;white-space:nowrap')}>${it.boardCount}</td>
<td ${td('text-align:right;white-space:nowrap')}>${(it.volume||0).toFixed(3)}</td>
<td ${td('text-align:center;white-space:nowrap')}>${it.unit}</td>
<td ${td('text-align:right;white-space:nowrap')}>${fmtMoney(it.unitPrice)}</td>
<td ${td('text-align:right;white-space:nowrap')}><strong>${fmtMoney(it.amount)}</strong></td></tr>`;
    }).join('');
    const svcRows = svcs.map((s,i) => `<tr style="${i%2?'background:#fafafa':''}"><td colspan="7" ${td()}>${svcLabel(s)}</td><td ${td('text-align:right;white-space:nowrap')}>${fmtMoney(s.amount)}</td></tr>`).join('');

    html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title></title>
<style>@page{margin:0}body{font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;color:#222;margin:0;padding:12mm 12mm}.pay-row td{font-weight:800;background:#fff3e0}@media print{.no-print{display:none}}</style></head><body>
<div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:10px;padding-bottom:9px;border-bottom:3px solid #F26522">
  <img src="${window.location.origin}/logo-gth.png" style="height:50px;width:auto;object-fit:contain;flex-shrink:0" onerror="this.style.display='none'" alt="GTH"/>
  <div style="flex:1;min-width:0">
    <div style="font-size:9px;font-weight:700;color:#F26522;text-transform:uppercase;letter-spacing:0.06em">Kho gỗ nhập khẩu Âu – Mỹ – Phi</div>
    <div style="font-size:10px;color:#5A3E2B;margin-top:2px">KCN Quốc Oai, Hà Nội – (DT419)</div>
    <div style="font-size:9px;color:#888;margin-top:1px">Đại lộ Thăng Long rẽ phải 200m hướng Thạch Thất</div>
    <div style="font-size:9px;color:#F26522;margin-top:2px">📞 0924 35 88 99 &nbsp;·&nbsp; 🌐 www.gotinhhoa.com</div>
  </div>
  <div style="flex-shrink:0;text-align:right;border:2px solid #F26522;border-radius:6px;padding:6px 10px;background:#FFF5EE">
    <div style="font-size:8px;color:#F26522;font-weight:700;text-transform:uppercase;letter-spacing:0.08em">Đơn hàng</div>
    <div style="font-family:monospace;font-size:14px;font-weight:800;color:#2D2016;white-space:nowrap">${order.orderCode}</div>
    ${orderDate?`<div style="font-size:9px;color:#888;margin-top:2px">${orderDate}</div>`:''}
    <div style="margin-top:4px;display:flex;flex-direction:column;align-items:flex-end;gap:3px">${statusBadges}</div>
  </div>
</div>
<div style="padding:5px 10px;border:1px solid #ddd;border-radius:4px;margin-bottom:8px;font-size:11px">${customerInfo()}</div>
<table style="width:100%;border-collapse:collapse;margin-bottom:8px">
<thead><tr>
${th('width:1%')}#</th>${th()}Mã kiện</th>${th()}Loại gỗ &amp; Thuộc tính</th>
${th('white-space:nowrap')}Tấm</th>${th('white-space:nowrap')}KL (m³)</th>${th('white-space:nowrap')}ĐVT</th>
${th('white-space:nowrap')}Đơn giá</th>${th('white-space:nowrap')}Thành tiền</th>
</tr></thead><tbody>
${prodRows}
<tr style="background:#fdf6ec;font-weight:700"><td colspan="3" ${td('text-align:right')}>Tổng cộng</td>
<td ${td('text-align:center;white-space:nowrap')}>${totalBoards}</td><td ${td('text-align:right;white-space:nowrap')}>${totalVolume}</td>
<td ${td()}></td><td ${td()}></td><td ${td('text-align:right;white-space:nowrap')}>${fmtMoney(itemsTotal)}</td></tr>
${svcs.length?`<tr><td colspan="8" style="padding:3px 5px;border:1px solid #ddd;background:#f0f0f0;font-size:9px;font-weight:700;text-transform:uppercase;color:#666">Dịch vụ</td></tr>${svcRows}`:''}
</tbody></table>
<div style="display:flex;justify-content:flex-end;margin-bottom:10px">
  <div style="min-width:220px">
    <table style="width:100%;border-collapse:collapse;margin-bottom:6px"><tbody>
    ${payRows()}
    <tr class="pay-row"><td style="padding:5px 8px;border:1px solid #ddd;font-size:13px">Tổng thanh toán</td><td style="padding:5px 8px;border:1px solid #ddd;text-align:right;font-size:13px">${fmtMoney(toPay)}</td></tr>
    </tbody></table>
    ${bangChu}
  </div>
</div>
${sharedFooter(order.notes)}
</body></html>`;
  }

  // ════ LAYOUT B: Cân bằng ════
  else if (layout === 2) {
    const th = `background:#f5f0e8;padding:5px 8px;text-align:center;font-size:10px;text-transform:uppercase;border:1px solid #ddd`;
    const td = `padding:5px 8px;border:1px solid #ddd;vertical-align:top`;
    const prodRows = items.map((it,i) => `<tr${i%2?' style="background:#fafafa"':''}>
<td style="${td};text-align:center;white-space:nowrap;vertical-align:middle">${i+1}</td>
<td style="${td};font-family:monospace">${bundleCell(it)}</td>
<td style="${td}"><strong>${wood(it.woodId)?.name||it.woodId}</strong><div style="font-size:10px;color:#666;margin-top:2px">${attrOf(it)}</div>${it.notes?`<div style="font-size:10px;color:#aaa">${it.notes}</div>`:''}</td>
<td style="${td};text-align:center;white-space:nowrap">${it.boardCount}</td>
<td style="${td};text-align:right;white-space:nowrap">${(it.volume||0).toFixed(3)}</td>
<td style="${td};text-align:center;white-space:nowrap">${it.unit}</td>
<td style="${td};text-align:right;white-space:nowrap">${fmtMoney(it.unitPrice)}</td>
<td style="${td};text-align:right;white-space:nowrap"><strong>${fmtMoney(it.amount)}</strong></td></tr>`).join('');

    const svcSection = svcs.length ? `<h2 style="font-size:12px;font-weight:600;margin:10px 0 4px;color:#444">Dịch vụ</h2>
<table style="width:100%;border-collapse:collapse;margin-bottom:10px"><thead><tr>
<th style="${th};text-align:left">Mô tả dịch vụ</th><th style="${th};white-space:nowrap">Thành tiền</th>
</tr></thead><tbody>${svcs.map((s,i)=>`<tr${i%2?' style="background:#fafafa"':''}><td style="${td}">${svcLabel(s)}</td><td style="${td};text-align:right;white-space:nowrap">${fmtMoney(s.amount)}</td></tr>`).join('')}</tbody></table>` : '';

    html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title></title>
<style>@page{margin:0}body{font-family:'Helvetica Neue',Arial,sans-serif;font-size:12px;color:#222;margin:0;padding:14mm 13mm}.pay-row td{font-weight:800;background:#fff3e0}@media print{.no-print{display:none}}</style></head><body>
<div style="display:flex;align-items:flex-start;gap:16px;margin-bottom:14px;padding-bottom:12px;border-bottom:3px solid #F26522">
  <img src="${window.location.origin}/logo-gth.png" style="height:60px;width:auto;object-fit:contain;flex-shrink:0" onerror="this.style.display='none'" alt="GTH"/>
  <div style="flex:1;min-width:0;padding-top:2px">
    <div style="font-size:10px;font-weight:700;color:#F26522;text-transform:uppercase;letter-spacing:0.06em">Kho gỗ nhập khẩu Âu – Mỹ – Phi</div>
    <div style="font-size:11px;color:#5A3E2B;margin-top:4px">KCN Quốc Oai, Hà Nội – (DT419)</div>
    <div style="font-size:10px;color:#888;margin-top:1px">Đại lộ Thăng Long rẽ phải 200m hướng Thạch Thất</div>
    <div style="font-size:11px;font-weight:700;color:#F26522;margin-top:3px">📞 0924 35 88 99</div>
    <div style="font-size:10px;color:#888;margin-top:1px">🌐 www.gotinhhoa.com</div>
  </div>
  <div style="text-align:right;flex-shrink:0;min-width:150px">
    <div style="font-size:9px;color:#F26522;font-weight:700;text-transform:uppercase;letter-spacing:0.1em">Đơn hàng</div>
    <div style="font-family:monospace;font-size:17px;font-weight:800;color:#2D2016;white-space:nowrap">${order.orderCode}</div>
    ${orderDate?`<div style="font-size:10px;color:#888;margin-top:2px">${orderDate}</div>`:''}
    <div style="margin-top:6px;display:flex;flex-direction:column;align-items:flex-end;gap:4px">${statusBadges}</div>
  </div>
</div>
<div style="padding:7px 12px;border:1px solid #ddd;border-radius:4px;margin-bottom:10px">${customerInfo()}</div>
<h2 style="font-size:12px;font-weight:600;margin:10px 0 4px;color:#444">Sản phẩm</h2>
<table style="width:100%;border-collapse:collapse;margin-bottom:10px"><thead><tr>
<th style="${th};width:1%">#</th><th style="${th}">Mã kiện</th><th style="${th}">Loại gỗ &amp; Thuộc tính</th>
<th style="${th};white-space:nowrap">Tấm</th><th style="${th};white-space:nowrap">KL<br><span style="font-size:9px">(m³)</span></th>
<th style="${th};white-space:nowrap">ĐVT</th><th style="${th};white-space:nowrap">Đơn giá<br><span style="font-size:9px">(vnđ)</span></th>
<th style="${th};white-space:nowrap">Thành tiền<br><span style="font-size:9px">(vnđ)</span></th>
</tr></thead><tbody>
${prodRows}
<tr style="background:#fdf6ec;font-weight:700"><td colspan="3" style="${td};text-align:right">Tổng cộng</td>
<td style="${td};text-align:center;white-space:nowrap">${totalBoards}</td><td style="${td};text-align:right;white-space:nowrap">${totalVolume}</td>
<td style="${td}"></td><td style="${td}"></td><td style="${td};text-align:right;white-space:nowrap">${fmtMoney(itemsTotal)}</td></tr>
</tbody></table>
${svcSection}
<h2 style="font-size:12px;font-weight:600;margin:10px 0 4px;color:#444">Thanh toán</h2>
<div style="display:flex;justify-content:flex-end;margin-bottom:12px">
  <div style="min-width:260px">
    <table style="width:100%;border-collapse:collapse;margin-bottom:6px"><tbody>
    ${payRows()}
    <tr class="pay-row"><td style="${td};font-size:14px">Tổng thanh toán</td><td style="${td};text-align:right;font-size:14px">${fmtMoney(toPay)}</td></tr>
    </tbody></table>
    ${bangChu}
  </div>
</div>
${sharedFooter(order.notes)}
</body></html>`;
  }

  // ════ LAYOUT C: Invoice hiện đại ════
  else {
    const thC = `background:#2D2016;color:#fff;padding:5px 8px;text-align:center;font-size:10px;text-transform:uppercase;border:1px solid #2D2016`;
    const tdC = `padding:5px 8px;border:1px solid #e0d8cc;vertical-align:top`;
    const prodRows = items.map((it,i) => `<tr style="background:${i%2?'#fdf8f4':'#fff'}">
<td style="${tdC};text-align:center;white-space:nowrap;vertical-align:middle">${i+1}</td>
<td style="${tdC};font-family:monospace">${bundleCell(it)}</td>
<td style="${tdC}"><strong>${wood(it.woodId)?.name||it.woodId}</strong><div style="font-size:10px;color:#888;margin-top:2px">${attrOf(it)}</div>${it.notes?`<div style="font-size:10px;color:#aaa">${it.notes}</div>`:''}</td>
<td style="${tdC};text-align:center;white-space:nowrap">${it.boardCount}</td>
<td style="${tdC};text-align:right;white-space:nowrap">${(it.volume||0).toFixed(3)}</td>
<td style="${tdC};text-align:center;white-space:nowrap">${it.unit}</td>
<td style="${tdC};text-align:right;white-space:nowrap">${fmtMoney(it.unitPrice)}</td>
<td style="${tdC};text-align:right;white-space:nowrap"><strong>${fmtMoney(it.amount)}</strong></td></tr>`).join('');

    const svcRows = svcs.map((s,i) => `<tr style="background:${i%2?'#fdf8f4':'#fff'}"><td colspan="7" style="${tdC}">${svcLabel(s)}</td><td style="${tdC};text-align:right;white-space:nowrap">${fmtMoney(s.amount)}</td></tr>`).join('');

    html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title></title>
<style>@page{margin:0}body{font-family:'Helvetica Neue',Arial,sans-serif;font-size:12px;color:#222;margin:0;padding:14mm 13mm}@media print{.no-print{display:none}}</style></head><body>
<div style="display:flex;align-items:stretch;gap:14px;margin-bottom:14px;padding-bottom:0;border-bottom:3px solid #F26522">
  <div style="flex:1;display:flex;align-items:flex-start;gap:12px;padding-bottom:12px">
    <img src="${window.location.origin}/logo-gth.png" style="height:58px;width:auto;object-fit:contain;flex-shrink:0" onerror="this.style.display='none'" alt="GTH"/>
    <div style="padding-top:2px">
      <div style="font-size:10px;font-weight:700;color:#F26522;text-transform:uppercase;letter-spacing:0.06em">Kho gỗ nhập khẩu Âu – Mỹ – Phi</div>
      <div style="font-size:11px;color:#5A3E2B;margin-top:4px">KCN Quốc Oai, Hà Nội – (DT419)</div>
      <div style="font-size:10px;color:#888;margin-top:1px">Đại lộ Thăng Long rẽ phải 200m hướng Thạch Thất</div>
      <div style="font-size:11px;font-weight:700;color:#F26522;margin-top:3px">📞 0924 35 88 99</div>
      <div style="font-size:10px;color:#888;margin-top:1px">🌐 www.gotinhhoa.com</div>
    </div>
  </div>
  <div style="flex-shrink:0;border:2px solid #2D2016;border-radius:6px;padding:10px 14px;margin-bottom:12px;min-width:160px;background:#f9f6f2">
    <div style="font-size:10px;font-weight:700;color:#2D2016;text-transform:uppercase;letter-spacing:0.1em;border-bottom:1px solid #ddd;padding-bottom:5px;margin-bottom:6px">Đơn hàng</div>
    <div style="font-family:monospace;font-size:17px;font-weight:900;color:#F26522;white-space:nowrap">${order.orderCode}</div>
    ${orderDate?`<div style="font-size:10px;color:#888;margin-top:3px">🕐 ${orderDate}</div>`:''}
    <div style="margin-top:6px;display:flex;flex-direction:column;gap:3px">${statusBadges}</div>
  </div>
</div>
<div style="display:grid;grid-template-columns:1fr auto;gap:10px;margin-bottom:12px">
  <div style="padding:8px 12px;border:1px solid #e0d8cc;border-radius:4px;background:#fdfaf7">${customerInfo()}</div>
  ${order.notes?`<div style="padding:8px 12px;border:1px solid #f0c080;border-radius:4px;background:#fff8f0;font-size:11px;max-width:200px"><strong>Ghi chú:</strong><div style="color:#666;margin-top:2px">${order.notes}</div></div>`:''}
</div>
<table style="width:100%;border-collapse:collapse;margin-bottom:12px"><thead><tr>
<th style="${thC};width:1%">#</th><th style="${thC}">Mã kiện</th><th style="${thC}">Loại gỗ &amp; Thuộc tính</th>
<th style="${thC};white-space:nowrap">Tấm</th><th style="${thC};white-space:nowrap">KL<br><span style="font-size:9px">(m³)</span></th>
<th style="${thC};white-space:nowrap">ĐVT</th><th style="${thC};white-space:nowrap">Đơn giá<br><span style="font-size:9px">(vnđ)</span></th>
<th style="${thC};white-space:nowrap">Thành tiền<br><span style="font-size:9px">(vnđ)</span></th>
</tr></thead><tbody>
${prodRows}
<tr style="background:#f5ede0;font-weight:700"><td colspan="3" style="${tdC};text-align:right">Tổng cộng</td>
<td style="${tdC};text-align:center;white-space:nowrap">${totalBoards}</td><td style="${tdC};text-align:right;white-space:nowrap">${totalVolume}</td>
<td style="${tdC}"></td><td style="${tdC}"></td><td style="${tdC};text-align:right;white-space:nowrap">${fmtMoney(itemsTotal)}</td></tr>
${svcs.length?`<tr><td colspan="8" style="${tdC};background:#2D2016;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;padding:4px 8px">Dịch vụ</td></tr>${svcRows}`:''}
</tbody></table>
<div style="display:flex;justify-content:flex-end;margin-bottom:16px;page-break-inside:avoid">
  <div style="min-width:280px;border:2px solid #2D2016;border-radius:6px;overflow:hidden">
    <div style="background:#2D2016;color:#fff;padding:6px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">Thanh toán</div>
    <div style="padding:10px 12px;background:#fdfaf7">
      <table style="width:100%;border-collapse:collapse"><tbody>
      ${payRows().replace(/style="text-align:right"/g, 'style="text-align:right;padding:3px 0;font-size:11px"').replace(/<tr><td>/g,'<tr><td style="padding:3px 0;font-size:11px">')}
      <tr style="border-top:2px solid #2D2016">
        <td style="padding:6px 0 2px;font-weight:800;font-size:14px">Tổng thanh toán</td>
        <td style="text-align:right;padding:6px 0 2px;font-weight:800;font-size:14px;color:#F26522">${fmtMoney(toPay)}</td>
      </tr></tbody></table>
      <div style="margin-top:6px;font-size:10px;color:#888"><em>${soThanhChu(toPay)}</em></div>
    </div>
  </div>
</div>
${sharedFooter('')}
</body></html>`;
  }

  const w = window.open('', '_blank');
  if (!w) { alert('Trình duyệt đang chặn popup. Vui lòng cho phép popup cho trang này rồi thử lại.'); return; }
  w.document.write(html);
  w.document.close();
  if (!previewOnly) setTimeout(() => w.print(), 500);
}

// ── PrintModal ────────────────────────────────────────────────────────────────

function PrintModal({ onPrint, onClose, onPreview }) {
  const [layout, setLayout] = React.useState(2);
  const [hideSupplierName, setHideSupplierName] = React.useState(true);
  React.useEffect(() => { const h = e => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h); }, [onClose]);

  const Thumb = ({ id, active }) => {
    const b = (s) => ({ border: `0.5px solid ${active ? '#F26522' : '#ddd'}`, borderRadius: 1, background: s });
    if (id === 1) return (
      <div style={{ width: 50, height: 68, border: `1.5px solid ${active ? '#F26522' : '#ccc'}`, borderRadius: 3, background: '#fff', padding: 3, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ display: 'flex', gap: 2, height: 11 }}>
          <div style={{ width: 8, height: 8, background: '#F26522', borderRadius: 1, flexShrink: 0, alignSelf: 'center' }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, justifyContent: 'center' }}>
            <div style={{ height: 1.5, background: '#F26522', borderRadius: 1 }} /><div style={{ height: 1, background: '#ddd', borderRadius: 1 }} /><div style={{ height: 1, background: '#ddd', borderRadius: 1, width: '70%' }} />
          </div>
          <div style={{ width: 13, border: '1px solid #F26522', borderRadius: 1, padding: '1px 2px', display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
            <div style={{ height: 1.5, background: '#F26522', borderRadius: 1, width: '100%' }} /><div style={{ height: 2.5, background: '#333', borderRadius: 1, width: '90%' }} /><div style={{ height: 1.5, background: '#ccc', borderRadius: 1, width: '80%' }} />
          </div>
        </div>
        <div style={{ height: 1, background: '#F26522' }} />
        <div style={{ height: 4, background: '#f5f5f5', borderRadius: 1 }} />
        {[0,1,2,3,4,5].map(i => <div key={i} style={{ height: 4, background: i%2?'#fafafa':'#fff', ...b(), display: 'flex', gap: 1, padding: '0 1px', alignItems: 'center' }}>
          <div style={{ width: 2, height: 2, background: '#bbb', borderRadius: 1 }} /><div style={{ width: 7, height: 2, background: '#ddd', borderRadius: 1 }} /><div style={{ flex: 1, height: 2, background: '#eee', borderRadius: 1 }} /><div style={{ width: 6, height: 2, background: '#ddd', borderRadius: 1 }} />
        </div>)}
        <div style={{ height: 3, background: '#fdf6ec', border: '0.5px solid #ddd', borderRadius: 1 }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><div style={{ width: 16, height: 6, background: '#fff3e0', border: '0.5px solid #f0c080', borderRadius: 1 }} /></div>
        <div style={{ height: 4, background: '#FFF5EE', border: '1px solid #F26522', borderRadius: 2 }} />
      </div>
    );
    if (id === 2) return (
      <div style={{ width: 50, height: 68, border: `1.5px solid ${active ? '#F26522' : '#ccc'}`, borderRadius: 3, background: '#fff', padding: 3, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ display: 'flex', gap: 2, height: 13 }}>
          <div style={{ width: 9, height: 9, background: '#F26522', borderRadius: 1, flexShrink: 0, alignSelf: 'center' }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, justifyContent: 'center' }}>
            <div style={{ height: 1.5, background: '#F26522', borderRadius: 1 }} /><div style={{ height: 1.5, background: '#5A3E2B', borderRadius: 1, width: '80%' }} /><div style={{ height: 1, background: '#ccc', borderRadius: 1 }} /><div style={{ height: 1, background: '#ccc', borderRadius: 1, width: '60%' }} />
          </div>
          <div style={{ width: 14, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
            <div style={{ height: 1.5, background: '#F26522', borderRadius: 1, width: '70%' }} /><div style={{ height: 3, background: '#333', borderRadius: 1, width: '100%' }} /><div style={{ height: 1.5, background: '#bbb', borderRadius: 1, width: '80%' }} />
            <div style={{ height: 2.5, background: '#fff3e0', border: '0.5px solid #f0c080', borderRadius: 1, width: '90%' }} />
          </div>
        </div>
        <div style={{ height: 1, background: '#F26522' }} />
        <div style={{ height: 4, background: '#f5f5f5', border: '0.5px solid #ddd', borderRadius: 1 }} />
        {[0,1,2,3,4].map(i => <div key={i} style={{ height: 5, background: i%2?'#fafafa':'#fff', ...b(), display: 'flex', gap: 1, padding: '0 1px', alignItems: 'center' }}>
          <div style={{ width: 2, height: 3, background: '#bbb', borderRadius: 1 }} /><div style={{ width: 7, height: 3, background: '#ddd', borderRadius: 1 }} /><div style={{ flex: 1, height: 3, background: '#eee', borderRadius: 1 }} /><div style={{ width: 7, height: 3, background: '#ddd', borderRadius: 1 }} />
        </div>)}
        <div style={{ height: 3, background: '#fdf6ec', border: '0.5px solid #ddd', borderRadius: 1 }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><div style={{ width: 20, height: 8, background: '#fff3e0', border: '0.5px solid #f0c080', borderRadius: 1 }} /></div>
        <div style={{ height: 4, background: '#FFF5EE', border: '1px solid #F26522', borderRadius: 2 }} />
      </div>
    );
    return (
      <div style={{ width: 50, height: 68, border: `1.5px solid ${active ? '#F26522' : '#ccc'}`, borderRadius: 3, background: '#fff', padding: 3, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ display: 'flex', gap: 2, height: 13 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <div style={{ width: 8, height: 8, background: '#F26522', borderRadius: 1, flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <div style={{ height: 1.5, background: '#F26522', borderRadius: 1 }} /><div style={{ height: 1.5, background: '#5A3E2B', borderRadius: 1 }} /><div style={{ height: 1, background: '#ccc', borderRadius: 1, width: '80%' }} />
            </div>
          </div>
          <div style={{ width: 15, border: '1.5px solid #2D2016', borderRadius: 2, padding: '2px 2px', background: '#f9f6f2', display: 'flex', flexDirection: 'column', gap: 1 }}>
            <div style={{ height: 1.5, background: '#2D2016', borderRadius: 1 }} /><div style={{ height: 3, background: '#F26522', borderRadius: 1 }} /><div style={{ height: 1.5, background: '#ccc', borderRadius: 1 }} />
          </div>
        </div>
        <div style={{ height: 1, background: '#F26522' }} />
        <div style={{ height: 4, background: '#fdfaf7', border: '0.5px solid #e0d8cc', borderRadius: 1 }} />
        <div style={{ height: 4, background: '#2D2016', borderRadius: '1px 1px 0 0' }} />
        {[0,1,2,3,4].map(i => <div key={i} style={{ height: 5, background: i%2?'#fdf8f4':'#fff', border: '0.5px solid #e0d8cc', display: 'flex', gap: 1, padding: '0 1px', alignItems: 'center' }}>
          <div style={{ width: 2, height: 3, background: '#ccc', borderRadius: 1 }} /><div style={{ width: 7, height: 3, background: '#ddd', borderRadius: 1 }} /><div style={{ flex: 1, height: 3, background: '#eee', borderRadius: 1 }} /><div style={{ width: 7, height: 3, background: '#F26522', borderRadius: 1, opacity: 0.5 }} />
        </div>)}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: 22, border: '1.5px solid #2D2016', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: 3, background: '#2D2016' }} />
            <div style={{ height: 5, background: '#fdfaf7', padding: '1px 2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ width: 7, height: 1.5, background: '#555', borderRadius: 1 }} /><div style={{ width: 5, height: 2, background: '#F26522', borderRadius: 1 }} />
            </div>
          </div>
        </div>
        <div style={{ height: 4, background: '#FFF5EE', border: '1px solid #F26522', borderRadius: 2 }} />
      </div>
    );
  };

  const opts = [
    { id: 1, label: 'A — Gọn tối đa', tag: 'Nhỏ nhất', tagColor: '#27ae60', desc: 'Font 11px · Header 2 cột · Sản phẩm + Dịch vụ cùng bảng · SKU dạng giá trị ngắn' },
    { id: 2, label: 'B — Cân bằng', tag: 'Khuyến nghị', tagColor: '#2980b9', desc: 'Font 12px · Header 3 cột + nhãn "Đơn hàng" + ngày · Thuộc tính có nhãn' },
    { id: 3, label: 'C — Invoice hiện đại', tag: 'Sang trọng', tagColor: '#8e44ad', desc: 'Header có box đơn hàng · Bảng tiêu đề tối · Thanh toán dạng box riêng' },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--bgc)', borderRadius: 12, padding: 24, width: 560, maxWidth: '100%', border: '1px solid var(--bd)', boxShadow: '0 8px 40px rgba(0,0,0,0.3)' }}>
        <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--br)', marginBottom: 16 }}>🖨 Chọn mẫu in đơn hàng</div>
        {opts.map(opt => (
          <div key={opt.id} onClick={() => setLayout(opt.id)}
            style={{ display: 'flex', gap: 12, padding: '10px 12px', borderRadius: 8, border: `2px solid ${layout === opt.id ? 'var(--ac)' : 'var(--bd)'}`, marginBottom: 8, cursor: 'pointer', background: layout === opt.id ? 'var(--acbg)' : 'var(--bg)', transition: 'border-color 0.15s' }}>
            <Thumb id={opt.id} active={layout === opt.id} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                <input type="radio" name="printLayout" checked={layout === opt.id} onChange={() => setLayout(opt.id)} style={{ accentColor: 'var(--ac)', flexShrink: 0 }} />
                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--br)' }}>{opt.label}</span>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#fff', background: opt.tagColor, borderRadius: 10, padding: '1px 7px', whiteSpace: 'nowrap' }}>{opt.tag}</span>
              </div>
              <div style={{ fontSize: '0.71rem', color: 'var(--tm)', lineHeight: 1.5 }}>{opt.desc}</div>
            </div>
            <button onClick={e => { e.stopPropagation(); onPreview({ layout: opt.id, hideSupplierName }); }}
              style={{ alignSelf: 'center', flexShrink: 0, padding: '5px 10px', borderRadius: 6, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
              👁 Xem
            </button>
          </div>
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

// ── RecordPaymentModal ─────────────────────────────────────────────────────────

const DISCOUNT_AUTO_LIMIT = 200000; // < 200k: tự duyệt; >= 200k: cần admin duyệt

function RecordPaymentModal({ toPay, paymentRecords, onConfirm, onClose, saving }) {
  const submitRef = React.useRef(null);
  React.useEffect(() => { const h = e => { if (e.key === 'Escape') onClose(); if (e.key === 'Enter') submitRef.current?.(); }; document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h); }, [onClose]);
  const calcOutstandingLocal = (records) => records.reduce((rem, r) => {
    const dc = r.discountStatus === 'auto' || r.discountStatus === 'approved';
    return rem - (r.amount || 0) - (dc ? (r.discount || 0) : 0);
  }, toPay);

  const outstanding = Math.max(0, calcOutstandingLocal(paymentRecords || []));
  const [amount, setAmount] = React.useState(outstanding);
  const [method, setMethod] = React.useState('Chuyển khoản');
  const [note, setNote] = React.useState('');
  const [discount, setDiscount] = React.useState(0);
  const [discountNote, setDiscountNote] = React.useState('');
  const [showDiscount, setShowDiscount] = React.useState(false);

  const discountAmt = parseFloat(discount) || 0;
  const needsApproval = discountAmt >= DISCOUNT_AUTO_LIMIT;
  const newOutstanding = Math.max(0, outstanding - (parseFloat(amount) || 0) - (needsApproval ? 0 : discountAmt));
  // Nếu discount chờ duyệt, outstanding chưa tính discount → chưa "đủ"
  const willFullyPay = newOutstanding <= 0 && (parseFloat(amount) || 0) > 0;
  const pendingDiscountCase = needsApproval && discountAmt > 0; // có giảm giá cần duyệt

  const totalPaid = (paymentRecords || []).reduce((s, r) => {
    const dc = r.discountStatus === 'auto' || r.discountStatus === 'approved';
    return s + (r.amount || 0) + (dc ? (r.discount || 0) : 0);
  }, 0);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--bgc)', borderRadius: 12, padding: 24, width: 420, maxWidth: '100%', border: '1px solid var(--bd)', boxShadow: '0 8px 40px rgba(0,0,0,0.25)' }}>
        <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--br)', marginBottom: 16 }}>💰 Ghi thu tiền</div>

        {/* Tóm tắt số tiền */}
        <div style={{ background: 'var(--bgs)', border: '1px solid var(--bd)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.8rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: 'var(--ts)' }}>Tổng cần thanh toán</span>
            <span style={{ fontWeight: 700 }}>{fmtMoney(toPay)}</span>
          </div>
          {(paymentRecords || []).length > 0 && <>
            <div style={{ borderTop: '1px dashed var(--bd)', margin: '6px 0' }} />
            {(paymentRecords || []).map((r, i) => (
              <React.Fragment key={r.id || i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--tm)', fontSize: '0.74rem', marginBottom: 1 }}>
                  <span>{new Date(r.paidAt).toLocaleDateString('vi-VN')} · {r.method}</span>
                  <span style={{ color: 'var(--gn)', fontWeight: 600 }}>−{fmtMoney(r.amount)}</span>
                </div>
                {r.discount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--tm)', fontSize: '0.72rem', marginBottom: 1, paddingLeft: 8 }}>
                    <span style={{ fontStyle: 'italic' }}>Gia hàng{r.discountStatus === 'pending' ? ' ⏳chờ duyệt' : r.discountStatus === 'approved' ? ' ✓' : ''}</span>
                    <span style={{ color: r.discountStatus === 'pending' ? '#8e44ad' : 'var(--gn)', fontWeight: 600 }}>−{fmtMoney(r.discount)}</span>
                  </div>
                )}
              </React.Fragment>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ color: 'var(--ts)' }}>Đã xử lý</span>
              <span style={{ fontWeight: 700, color: 'var(--gn)' }}>−{fmtMoney(totalPaid)}</span>
            </div>
            <div style={{ borderTop: '1px dashed var(--bd)', margin: '6px 0' }} />
          </>}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, color: outstanding > 0 ? 'var(--ac)' : 'var(--gn)' }}>Còn lại phải thu</span>
            <span style={{ fontWeight: 800, fontSize: '1rem', color: outstanding > 0 ? 'var(--ac)' : 'var(--gn)' }}>{fmtMoney(outstanding)}</span>
          </div>
        </div>

        {outstanding <= 0 ? (
          <div style={{ padding: '12px', borderRadius: 8, background: 'rgba(50,79,39,0.08)', border: '1px solid var(--gn)', color: 'var(--gn)', fontWeight: 700, fontSize: '0.82rem', textAlign: 'center', marginBottom: 16 }}>✓ Đã thu đủ tiền</div>
        ) : <>
          {/* Số tiền thu */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--brl)', textTransform: 'uppercase', marginBottom: 5 }}>Số tiền thu lần này</div>
            <NumInput value={amount} onChange={setAmount}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '2px solid var(--ac)', fontSize: '0.9rem', fontWeight: 700, textAlign: 'right', outline: 'none', background: 'var(--bg)', boxSizing: 'border-box' }} />
          </div>

          {/* Phương thức */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--brl)', textTransform: 'uppercase', marginBottom: 5 }}>Phương thức</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['Chuyển khoản', 'Tiền mặt'].map(m => (
                <button key={m} onClick={() => setMethod(m)} style={{ flex: 1, padding: '8px', borderRadius: 7, border: `2px solid ${method === m ? 'var(--ac)' : 'var(--bd)'}`, background: method === m ? 'var(--acbg)' : 'transparent', color: method === m ? 'var(--ac)' : 'var(--ts)', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>{m}</button>
              ))}
            </div>
          </div>

          {/* Gia hàng */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: showDiscount ? 8 : 0 }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--brl)', textTransform: 'uppercase', flex: 1 }}>Gia hàng (giảm tiền lẻ)</div>
              <button onClick={() => { setShowDiscount(p => !p); if (showDiscount) { setDiscount(0); setDiscountNote(''); } }}
                style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: 5, border: '1px solid var(--bd)', background: showDiscount ? 'var(--acbg)' : 'transparent', color: showDiscount ? 'var(--ac)' : 'var(--ts)', cursor: 'pointer', fontWeight: 600 }}>
                {showDiscount ? '✕ Bỏ' : '+ Thêm'}
              </button>
            </div>
            {showDiscount && (
              <div style={{ background: needsApproval ? 'rgba(142,68,173,0.05)' : 'rgba(39,174,96,0.05)', border: `1px solid ${needsApproval ? 'rgba(142,68,173,0.3)' : 'rgba(39,174,96,0.3)'}`, borderRadius: 7, padding: '10px 12px' }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--tm)', marginBottom: 4 }}>Số tiền giảm</div>
                    <NumInput value={discount} onChange={setDiscount}
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: `1.5px solid ${needsApproval ? 'rgba(142,68,173,0.5)' : 'var(--bd)'}`, fontSize: '0.82rem', textAlign: 'right', outline: 'none', background: 'var(--bg)', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--tm)', marginBottom: 4 }}>Lý do</div>
                    <input value={discountNote} onChange={e => setDiscountNote(e.target.value)} placeholder="Làm tròn, tiền lẻ..." style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1.5px solid var(--bd)', fontSize: '0.8rem', outline: 'none', background: 'var(--bg)', boxSizing: 'border-box' }} />
                  </div>
                </div>
                {discountAmt > 0 && (
                  needsApproval ? (
                    <div style={{ fontSize: '0.72rem', color: '#8e44ad', fontWeight: 600 }}>
                      ⚠ Giảm ≥ 200.000đ — cần admin duyệt. Đơn sẽ chuyển trạng thái <strong>Còn nợ</strong> cho đến khi được duyệt.
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.72rem', color: 'var(--gn)', fontWeight: 600 }}>
                      ✓ Tự động duyệt (giảm &lt; 200.000đ)
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          {/* Ghi chú */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--brl)', textTransform: 'uppercase', marginBottom: 5 }}>Ghi chú (tùy chọn)</div>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="VD: Chuyển khoản MB Bank lúc 14:30..." style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1.5px solid var(--bd)', fontSize: '0.8rem', outline: 'none', background: 'var(--bg)', boxSizing: 'border-box' }} />
          </div>

          {/* Preview */}
          {(parseFloat(amount) || 0) > 0 && (
            <div style={{ padding: '8px 12px', borderRadius: 7, background: willFullyPay ? 'rgba(50,79,39,0.08)' : pendingDiscountCase ? 'rgba(142,68,173,0.06)' : 'rgba(242,101,34,0.06)', border: `1px solid ${willFullyPay ? 'var(--gn)' : pendingDiscountCase ? 'rgba(142,68,173,0.3)' : 'var(--bd)'}`, fontSize: '0.78rem', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--ts)' }}>Sau thu còn lại:</span>
              <strong style={{ color: willFullyPay ? 'var(--gn)' : pendingDiscountCase ? '#8e44ad' : 'var(--ac)', fontSize: '0.88rem' }}>
                {willFullyPay ? '✓ Đã thanh toán đủ' : pendingDiscountCase ? `${fmtMoney(outstanding - (parseFloat(amount)||0))} (chờ duyệt gia hàng)` : fmtMoney(newOutstanding)}
              </strong>
            </div>
          )}
        </>}

        {(submitRef.current = (parseFloat(amount) > 0 && !saving && outstanding > 0) ? () => onConfirm({ amount: parseFloat(amount)||0, method, note, discount: discountAmt, discountNote }) : null) && null}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 7, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>Hủy</button>
          {outstanding > 0 && (
            <button onClick={() => onConfirm({ amount: parseFloat(amount)||0, method, note, discount: discountAmt, discountNote })}
              disabled={!(parseFloat(amount) > 0) || saving}
              style={{ padding: '8px 20px', borderRadius: 7, border: 'none', background: !(parseFloat(amount)>0)||saving ? 'var(--bd)' : willFullyPay ? 'var(--gn)' : 'var(--ac)', color: !(parseFloat(amount)>0)||saving ? 'var(--tm)' : '#fff', cursor: !(parseFloat(amount)>0)||saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>
              {saving ? 'Đang lưu...' : willFullyPay ? '✓ Thu & Hoàn tất' : pendingDiscountCase ? '+ Ghi thu (gia hàng chờ duyệt)' : '+ Ghi thu tiền'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── BundleSelector ────────────────────────────────────────────────────────────

const BS_PAGE_SIZE = 15;

const STATUS_COLOR = { 'Kiện nguyên': '#16a34a', 'Chưa được bán': '#7c3aed', 'Kiện lẻ': '#ea580c' };

function BundleSelector({ wts, ats, prices, cfg, onConfirm, onClose }) {
  const [bundles, setBundles] = useState([]);
  useEffect(() => { const h = e => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h); }, [onClose]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(new Set());
  const [fWood, setFWood] = useState(() => wts.find(w => w.name === 'Thông')?.id || wts[0]?.id || '');
  const [fSearch, setFSearch] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fThickness, setFThickness] = useState('');
  const [fQuality, setFQuality] = useState('');
  const [fWidth, setFWidth] = useState('');
  const [fLength, setFLength] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    (async () => {
      try { const { fetchBundles } = await import('../api.js'); setBundles(await fetchBundles()); }
      catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  useEffect(() => { setPage(1); }, [fWood, fSearch, fStatus, fThickness, fQuality, fWidth, fLength]);

  const isFilteredPerBundle = !!(fWood && isPerBundle(fWood, wts));
  const showSupplierCol = !!(fWood && cfg[fWood]?.attrs?.includes('supplier'));
  const showWidthCol = isFilteredPerBundle || !!(fWood && cfg[fWood]?.attrs?.includes('width'));
  const hasFilters = !!(fSearch || fStatus || fThickness || fQuality || fWidth || fLength);

  const resetAttrFilters = () => { setFThickness(''); setFQuality(''); setFWidth(''); setFLength(''); };

  const filtered = useMemo(() => {
    const now = Date.now();
    let arr = bundles.filter(b => {
      if (b.status === 'Đã bán hết' || b.status === 'Đã bán' || b.status === 'Chưa được bán') return false;
      // V-21: loại bỏ bundle đang bị lock (trong vòng 10 phút)
      if (b.lockedBy) {
        const lockedAt = b.lockedAt ? new Date(b.lockedAt).getTime() : 0;
        if (now - lockedAt < 10 * 60 * 1000) return false;
      }
      return true;
    });
    if (fWood) arr = arr.filter(b => b.woodId === fWood);
    if (fStatus) arr = arr.filter(b => b.status === fStatus);
    if (fThickness) arr = arr.filter(b => {
      const t = b.attributes?.thickness;
      if (!t) return false;
      if (t === fThickness) return true;
      const rg = cfg[b.woodId]?.rangeGroups?.thickness;
      return rg?.length ? resolveRangeGroup(t, rg) === fThickness : false;
    });
    if (fQuality) arr = arr.filter(b => b.attributes?.quality === fQuality);
    if (fWidth) arr = arr.filter(b => {
      const w = b.attributes?.width;
      if (!w) return fWidth === '__none__';
      if (w === fWidth) return true;
      const rg = cfg[b.woodId]?.rangeGroups?.width;
      return rg?.length ? resolveRangeGroup(w, rg) === fWidth : false;
    });
    if (fLength) arr = arr.filter(b => {
      const l = b.attributes?.length;
      if (!l) return false;
      if (l === fLength) return true;
      const rg = cfg[b.woodId]?.rangeGroups?.length;
      return rg?.length ? resolveRangeGroup(l, rg) === fLength : false;
    });
    if (fSearch) { const s = fSearch.toLowerCase(); arr = arr.filter(b => b.bundleCode.toLowerCase().includes(s) || (b.supplierBundleCode || '').toLowerCase().includes(s) || Object.values(b.attributes||{}).some(v => String(v).toLowerCase().includes(s))); }
    arr = [...arr].sort((a, b) => {
      const dt = parseFloat(a.attributes?.thickness) - parseFloat(b.attributes?.thickness);
      if (dt !== 0) return dt;
      const dw = parseFloat(a.attributes?.width) - parseFloat(b.attributes?.width);
      if (dw !== 0) return dw;
      return parseFloat(a.attributes?.length) - parseFloat(b.attributes?.length);
    });
    return arr;
  }, [bundles, fWood, fSearch, fStatus, fThickness, fQuality, fWidth, fLength]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / BS_PAGE_SIZE));
  const pagedFiltered = filtered.slice((page - 1) * BS_PAGE_SIZE, page * BS_PAGE_SIZE);

  const toggle = (id) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleConfirm = () => {
    const selected = bundles.filter(b => sel.has(b.id)).map(b => {
      const m2 = isM2Wood(b.woodId, wts);
      const unit = m2 ? 'm2' : 'm3';
      let unitPrice, listPrice, listPrice2;
      if (isPerBundle(b.woodId, wts)) {
        unitPrice = b.unitPrice != null ? Math.round(b.unitPrice * 1000000) : null;
        listPrice = unitPrice;
      } else if (m2) {
        const priceObj = prices[bpk(b.woodId, resolvePriceAttrs(b.woodId, b.attributes, cfg))] || {};
        const leKien = priceObj.price != null ? Math.round(priceObj.price * 1000) : null;      // k/m²
        const nguyenKien = priceObj.price2 != null ? Math.round(priceObj.price2 * 1000) : null; // k/m²
        // Nguyên kiện (không thay đổi số tấm) → giá rẻ hơn (price2)
        const isWhole = b.remainingBoards >= b.boardCount;
        unitPrice = isWhole ? (nguyenKien ?? leKien) : (leKien ?? nguyenKien);
        listPrice = leKien;    // listPrice = giá lẻ (cao hơn, dùng cảnh báo)
        listPrice2 = nguyenKien; // listPrice2 = giá nguyên kiện
      } else {
        const priceObj = prices[bpk(b.woodId, resolvePriceAttrs(b.woodId, b.attributes, cfg))] || {};
        const basePrice = priceObj.price;
        listPrice = basePrice != null ? Math.round(basePrice * 1000000) : null; // giá bảng chuẩn
        if (basePrice != null && b.priceAdjustment) {
          const adj = b.priceAdjustment;
          const effPrice = adj.type === 'percent'
            ? basePrice * (1 + adj.value / 100)
            : basePrice + adj.value;
          unitPrice = Math.round(effPrice * 1000000);
        } else {
          unitPrice = listPrice;
        }
      }
      const vol = b.remainingVolume || 0;
      return { bundleId: b.id, bundleCode: b.bundleCode, supplierBundleCode: b.supplierBundleCode || '', woodId: b.woodId, skuKey: b.skuKey, attributes: { ...b.attributes }, rawMeasurements: b.rawMeasurements || {}, boardCount: b.remainingBoards, volume: vol, unit, unitPrice, listPrice, listPrice2, amount: unitPrice ? Math.round(unitPrice * vol) : 0, notes: '', priceAdjustment: b.priceAdjustment || null };
    });
    onConfirm(selected);
  };

  const ths = { padding: '6px 8px', background: 'var(--bgh)', color: 'var(--brl)', fontWeight: 700, fontSize: '0.6rem', textTransform: 'uppercase', borderBottom: '2px solid var(--bds)', whiteSpace: 'nowrap' };
  const tds = { padding: '6px 8px', borderBottom: '1px solid var(--bd)', fontSize: '0.76rem', whiteSpace: 'nowrap' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(45,32,22,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--bgc)', borderRadius: 14, width: 1160, maxWidth: '100%', maxHeight: '92vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--bd)', overflow: 'hidden' }}>
        {/* Row 1: title + close */}
        <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, fontWeight: 800, fontSize: '0.95rem', color: 'var(--br)' }}>📦 Chọn kiện gỗ</div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--bd)', background: 'transparent', cursor: 'pointer', color: 'var(--ts)' }}>✕</button>
        </div>
        {/* Row 2: WoodPicker */}
        <div style={{ padding: '7px 18px', borderBottom: '1px solid var(--bd)', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={() => { setFWood(''); resetAttrFilters(); }}
            style={{ padding: '4px 10px', borderRadius: 6, border: fWood === '' ? '2px solid var(--ac)' : '1.5px solid var(--bd)', background: fWood === '' ? 'var(--acbg)' : 'var(--bgc)', color: fWood === '' ? 'var(--ac)' : 'var(--ts)', cursor: 'pointer', fontWeight: fWood === '' ? 700 : 500, fontSize: '0.77rem', whiteSpace: 'nowrap' }}>
            Tất cả
          </button>
          {wts.map(w => (
            <button key={w.id} onClick={() => { setFWood(w.id); resetAttrFilters(); }}
              style={{ padding: '4px 10px', borderRadius: 6, border: fWood === w.id ? '2px solid var(--ac)' : '1.5px solid var(--bd)', background: fWood === w.id ? 'var(--acbg)' : 'var(--bgc)', color: fWood === w.id ? 'var(--ac)' : 'var(--ts)', cursor: 'pointer', fontWeight: fWood === w.id ? 700 : 500, fontSize: '0.77rem', whiteSpace: 'nowrap' }}>
              {w.icon} {w.name}
            </button>
          ))}
        </div>
        {/* Row 3: Filters */}
        <div style={{ padding: '7px 18px', borderBottom: '1px solid var(--bd)', display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={fSearch} onChange={e => { setFSearch(e.target.value); setPage(1); }} placeholder="🔍 Tìm mã kiện / mã NCC..."
            style={{ flex: 2, minWidth: 160, padding: '5px 10px', borderRadius: 6, border: '1.5px solid var(--bd)', fontSize: '0.76rem', outline: 'none' }} />
          <select value={fStatus} onChange={e => { setFStatus(e.target.value); setPage(1); }}
            style={{ flex: 1, minWidth: 120, padding: '5px 8px', borderRadius: 6, border: '1.5px solid var(--bd)', fontSize: '0.76rem', background: 'var(--bgc)', color: 'var(--tp)', outline: 'none' }}>
            <option value="">Tất cả tình trạng</option>
            {['Kiện nguyên', 'Kiện lẻ'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {(() => {
            const vals = fWood ? (cfg[fWood]?.attrValues?.thickness || []) : [];
            if (!vals.length) return null;
            return (
              <select value={fThickness} onChange={e => { setFThickness(e.target.value); setPage(1); }}
                style={{ flex: 1, minWidth: 100, padding: '5px 8px', borderRadius: 6, border: '1.5px solid ' + (fThickness ? 'var(--ac)' : 'var(--bd)'), fontSize: '0.76rem', background: fThickness ? 'var(--acbg)' : 'var(--bgc)', color: fThickness ? 'var(--ac)' : 'var(--tp)', fontWeight: fThickness ? 700 : 400, outline: 'none' }}>
                <option value="">Tất cả độ dày</option>
                {vals.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            );
          })()}
          {(() => {
            const vals = fWood ? (cfg[fWood]?.attrValues?.quality || []) : [];
            if (!vals.length) return null;
            return (
              <select value={fQuality} onChange={e => { setFQuality(e.target.value); setPage(1); }}
                style={{ flex: 1, minWidth: 110, padding: '5px 8px', borderRadius: 6, border: '1.5px solid ' + (fQuality ? 'var(--ac)' : 'var(--bd)'), fontSize: '0.76rem', background: fQuality ? 'var(--acbg)' : 'var(--bgc)', color: fQuality ? 'var(--ac)' : 'var(--tp)', fontWeight: fQuality ? 700 : 400, outline: 'none' }}>
                <option value="">Tất cả chất lượng</option>
                {vals.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            );
          })()}
          {(() => {
            const vals = fWood ? (cfg[fWood]?.attrValues?.width || []) : [];
            if (!vals.length) return null;
            return (
              <select value={fWidth} onChange={e => { setFWidth(e.target.value); setPage(1); }}
                style={{ flex: 1, minWidth: 110, padding: '5px 8px', borderRadius: 6, border: '1.5px solid ' + (fWidth ? 'var(--ac)' : 'var(--bd)'), fontSize: '0.76rem', background: fWidth ? 'var(--acbg)' : 'var(--bgc)', color: fWidth ? 'var(--ac)' : 'var(--tp)', fontWeight: fWidth ? 700 : 400, outline: 'none' }}>
                <option value="">Tất cả độ rộng</option>
                {vals.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            );
          })()}
          {(() => {
            const vals = fWood ? (cfg[fWood]?.attrValues?.length || []) : [];
            if (!vals.length) return null;
            return (
              <select value={fLength} onChange={e => { setFLength(e.target.value); setPage(1); }}
                style={{ flex: 1, minWidth: 120, padding: '5px 8px', borderRadius: 6, border: '1.5px solid ' + (fLength ? 'var(--ac)' : 'var(--bd)'), fontSize: '0.76rem', background: fLength ? 'var(--acbg)' : 'var(--bgc)', color: fLength ? 'var(--ac)' : 'var(--tp)', fontWeight: fLength ? 700 : 400, outline: 'none' }}>
                <option value="">Tất cả độ dài</option>
                {vals.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            );
          })()}
          {hasFilters && (
            <button onClick={() => { setFSearch(''); setFStatus(''); resetAttrFilters(); setPage(1); }}
              style={{ padding: '5px 11px', borderRadius: 6, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
              ✕ Xóa lọc
            </button>
          )}
        </div>
        {/* Table */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? <div style={{ padding: 30, textAlign: 'center', color: 'var(--tm)' }}>Đang tải...</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={ths}></th>
                {isFilteredPerBundle
                  ? ['Mã kiện', 'Chất lượng', 'Dày', ...(showWidthCol ? ['Rộng'] : []), 'Dài', 'Giá (tr/m³)', 'Tấm còn', 'KL còn (m³)', 'Trạng thái', 'Vị trí', 'Ghi chú'].map(h => <th key={h} style={ths}>{h}</th>)
                  : ['Mã kiện', 'Loại gỗ', 'Dày', ...(showWidthCol ? ['Rộng'] : []), 'Dài', 'Chất lượng', ...(showSupplierCol ? ['Nhà cung cấp'] : []), 'Tấm còn', 'Khối lượng', 'Giá', 'Trạng thái', 'Vị trí', 'Ghi chú'].map(h => <th key={h} style={ths}>{h}</th>)
                }
              </tr></thead>
              <tbody>
                {pagedFiltered.length === 0 ? <tr><td colSpan={13} style={{ padding: 20, textAlign: 'center', color: 'var(--tm)' }}>Không có kiện nào phù hợp</td></tr>
                  : pagedFiltered.map((b, i) => {
                    const w = wts.find(x => x.id === b.woodId);
                    const perBundleWood = isPerBundle(b.woodId, wts);
                    const m2Wood = isM2Wood(b.woodId, wts);
                    const priceObj = (!perBundleWood && !m2Wood) ? prices[bpk(b.woodId, resolvePriceAttrs(b.woodId, b.attributes, cfg))] : null;
                    const displayPrice = perBundleWood ? b.unitPrice : priceObj?.price;
                    const checked = sel.has(b.id);
                    const statusColor = STATUS_COLOR[b.status] || 'var(--tm)';
                    if (isFilteredPerBundle) {
                      return (
                        <tr key={b.id} onClick={() => toggle(b.id)} style={{ background: checked ? 'rgba(242,101,34,0.07)' : (i % 2 ? 'var(--bgs)' : '#fff'), cursor: 'pointer' }}>
                          <td style={{ ...tds, textAlign: 'center' }}><input type="checkbox" readOnly checked={checked} /></td>
                          <td style={tds}>
                            <div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--br)' }}>{b.supplierBundleCode || b.bundleCode}</div>
                            {b.supplierBundleCode && <div style={{ fontFamily: 'monospace', fontSize: '0.63rem', color: 'var(--tm)', marginTop: 1 }}>{b.bundleCode}</div>}
                          </td>
                          <td style={tds}>{b.attributes?.quality || '—'}</td>
                          <td style={{ ...tds, textAlign: 'right' }}>{b.attributes?.thickness || '—'}</td>
                          {showWidthCol && <td style={{ ...tds, textAlign: 'right' }}>
                            {b.attributes?.width ? (b.rawMeasurements?.width ? <div><div style={{ fontWeight: 700 }}>{b.rawMeasurements.width}mm</div><div style={{ fontSize: '0.63rem', color: 'var(--tm)' }}>{b.attributes.width}</div></div> : b.attributes.width) : '—'}
                          </td>}
                          <td style={{ ...tds, textAlign: 'right' }}>
                            {b.attributes?.length ? (b.rawMeasurements?.length ? <div><div style={{ fontWeight: 700 }}>{b.rawMeasurements.length}m</div><div style={{ fontSize: '0.63rem', color: 'var(--tm)' }}>{b.attributes.length}</div></div> : b.attributes.length) : '—'}
                          </td>
                          <td style={{ ...tds, textAlign: 'right', fontWeight: 700, color: displayPrice ? 'var(--br)' : 'var(--tm)' }}>{displayPrice ? displayPrice.toFixed(1) : '—'}</td>
                          <td style={{ ...tds, textAlign: 'right' }}>{b.remainingBoards}</td>
                          <td style={{ ...tds, textAlign: 'right', fontWeight: 700 }}>{(b.remainingVolume || 0).toFixed(3)}</td>
                          <td style={{ ...tds, color: statusColor, fontWeight: 600 }}>{b.status || '—'}</td>
                          <td style={tds}>{b.location || '—'}</td>
                          <td style={{ ...tds, width: '100%', color: 'var(--ts)', fontSize: '0.72rem' }}>{b.notes || '—'}</td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={b.id} onClick={() => toggle(b.id)} style={{ background: checked ? 'rgba(242,101,34,0.07)' : (i % 2 ? 'var(--bgs)' : '#fff'), cursor: 'pointer' }}>
                        <td style={{ ...tds, textAlign: 'center' }}><input type="checkbox" readOnly checked={checked} /></td>
                        <td style={tds}>
                          <div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--br)' }}>{b.supplierBundleCode || b.bundleCode}</div>
                          {b.supplierBundleCode && <div style={{ fontFamily: 'monospace', fontSize: '0.63rem', color: 'var(--tm)', marginTop: 1 }}>{b.bundleCode}</div>}
                        </td>
                        <td style={tds}>{w?.icon} {w?.name}</td>
                        <td style={{ ...tds, textAlign: 'right' }}>{b.attributes?.thickness || '—'}</td>
                        {showWidthCol && <td style={{ ...tds, textAlign: 'right' }}>
                          {b.attributes?.width ? (b.rawMeasurements?.width ? <div><div style={{ fontWeight: 700 }}>{b.rawMeasurements.width}mm</div><div style={{ fontSize: '0.63rem', color: 'var(--tm)' }}>{b.attributes.width}</div></div> : b.attributes.width) : '—'}
                        </td>}
                        <td style={tds}>
                          {b.attributes?.length ? (b.rawMeasurements?.length ? <div><div style={{ fontWeight: 700 }}>{b.rawMeasurements.length}m</div><div style={{ fontSize: '0.63rem', color: 'var(--tm)' }}>{b.attributes.length}</div></div> : b.attributes.length) : '—'}
                        </td>
                        <td style={tds}>{b.attributes?.quality || '—'}</td>
                        {showSupplierCol && <td style={tds}>{b.attributes?.supplier || '—'}</td>}
                        <td style={{ ...tds, textAlign: 'right' }}>{b.remainingBoards}</td>
                        <td style={{ ...tds, textAlign: 'right', fontWeight: 700 }}>{(b.remainingVolume || 0).toFixed(m2Wood ? 2 : 3)} {m2Wood ? 'm²' : 'm³'}</td>
                        <td style={{ ...tds, textAlign: 'right', color: 'var(--br)', fontWeight: 600 }}>
                          {m2Wood ? (() => {
                            const po = prices[bpk(b.woodId, resolvePriceAttrs(b.woodId, b.attributes, cfg))];
                            if (!po?.price) return <span style={{ color: 'var(--tm)' }}>—</span>;
                            return <>{po.price.toFixed(0)}{po.price2 != null && <span style={{ color: 'var(--tm)' }}>/{po.price2.toFixed(0)}</span>} <span style={{ fontSize: '0.6rem', color: 'var(--tm)' }}>k/m²</span></>;
                          })() : (() => {
                            const po = prices[bpk(b.woodId, resolvePriceAttrs(b.woodId, b.attributes, cfg))];
                            const base = po?.price;
                            const adj = b.priceAdjustment;
                            if (!base) return <span style={{ color: 'var(--tm)' }}>—</span>;
                            if (!adj) return <>{base.toFixed(2)}</>;
                            const eff = adj.type === 'percent' ? base * (1 + adj.value / 100) : base + adj.value;
                            const diff = eff - base;
                            return (
                              <div>
                                <div style={{ color: 'var(--br)', fontWeight: 700 }}>{eff.toFixed(2)}</div>
                                <div style={{ fontSize: '0.58rem', color: diff > 0 ? 'var(--gn)' : 'var(--dg)', fontWeight: 600 }}>
                                  {diff > 0 ? '+' : ''}{diff.toFixed(2)} · {adj.reason}
                                </div>
                                <div style={{ fontSize: '0.58rem', color: 'var(--tm)', textDecoration: 'line-through' }}>{base.toFixed(2)}</div>
                              </div>
                            );
                          })()}
                        </td>
                        <td style={{ ...tds, color: statusColor, fontWeight: 600 }}>{b.status || '—'}</td>
                        <td style={tds}>{b.location || '—'}</td>
                        <td style={{ ...tds, width: '100%', color: 'var(--ts)', fontSize: '0.72rem' }}>{b.notes || '—'}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
        </div>
        {/* Footer: pagination + actions */}
        <div style={{ padding: '10px 18px', borderTop: '1px solid var(--bd)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: '0.76rem', color: 'var(--tm)' }}>
            Đã chọn <strong style={{ color: 'var(--br)' }}>{sel.size}</strong> kiện
            {filtered.length > 0 && <span style={{ marginLeft: 8 }}>· {filtered.length} kết quả</span>}
          </div>
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid var(--bd)', background: 'transparent', cursor: page === 1 ? 'not-allowed' : 'pointer', color: 'var(--ts)', fontSize: '0.76rem' }}>‹</button>
              <span style={{ fontSize: '0.76rem', color: 'var(--tm)', minWidth: 80, textAlign: 'center' }}>Trang {page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid var(--bd)', background: 'transparent', cursor: page === totalPages ? 'not-allowed' : 'pointer', color: 'var(--ts)', fontSize: '0.76rem' }}>›</button>
            </div>
          )}
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

function CustomerSearchSelect({ customers, value, onChange, inpSt }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const inputRef = useRef(null);

  const selected = customers.find(c => c.id === value);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = useMemo(() => {
    const tokens = q.trim().toLowerCase().normalize('NFC').split(/\s+/).filter(Boolean);
    if (!tokens.length) return customers;
    return customers.filter(c => {
      const fields = [
        c.salutation || '',
        c.name,
        c.nickname || '',
        c.phone1 || '',
        c.phone2 || '',
      ].map(f => f.toLowerCase().normalize('NFC'));
      return tokens.every(tok => fields.some(f => f.includes(tok)));
    });
  }, [customers, q]);

  const handleSelect = (c) => { onChange(c.id); setOpen(false); setQ(''); };
  const handleClear = (e) => { e.stopPropagation(); onChange(null); setQ(''); };

  return (
    <div ref={ref} style={{ position: 'relative', marginBottom: 8 }}>
      <div onClick={() => setOpen(o => !o)} style={{ ...inpSt, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}>
        {selected
          ? <span style={{ fontWeight: 600 }}>{selected.salutation ? selected.salutation + ' ' : ''}{selected.name}{selected.nickname ? <span style={{ fontWeight: 400, color: 'var(--tm)', marginLeft: 6 }}>· {selected.nickname}</span> : ''}</span>
          : <span style={{ color: 'var(--tm)' }}>— Chọn khách hàng —</span>}
        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {selected && <span onMouseDown={handleClear} style={{ color: 'var(--tm)', fontSize: '0.8rem', lineHeight: 1, cursor: 'pointer' }}>✕</span>}
          <span style={{ color: 'var(--tm)', fontSize: '0.7rem' }}>{open ? '▲' : '▼'}</span>
        </span>
      </div>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999, background: 'var(--bgc)', border: '1.5px solid var(--ac)', borderRadius: 7, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
          <div style={{ padding: '8px 8px 4px' }}>
            <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
              placeholder="Tìm tên, địa chỉ, số điện thoại..."
              onKeyDown={e => { if (e.key === 'Escape') setOpen(false); if (e.key === 'Enter' && filtered.length === 1) handleSelect(filtered[0]); }}
              style={{ width: '100%', padding: '6px 8px', borderRadius: 5, border: '1px solid var(--bd)', fontSize: '0.78rem', outline: 'none', boxSizing: 'border-box', background: 'var(--bg)' }} />
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {filtered.length === 0
              ? <div style={{ padding: '10px 12px', fontSize: '0.76rem', color: 'var(--tm)' }}>Không tìm thấy</div>
              : filtered.map(c => (
                <div key={c.id} onMouseDown={() => handleSelect(c)}
                  style={{ padding: '8px 12px', cursor: 'pointer', borderTop: '1px solid var(--bds)', background: c.id === value ? 'var(--acbg)' : 'transparent' }}
                  onMouseEnter={e => e.currentTarget.style.background = c.id === value ? 'var(--acbg)' : 'var(--bgs)'}
                  onMouseLeave={e => e.currentTarget.style.background = c.id === value ? 'var(--acbg)' : 'transparent'}>
                  <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--br)' }}>
                    {c.salutation ? <span style={{ fontSize: '0.68rem', color: 'var(--ac)', marginRight: 4 }}>{c.salutation}</span> : ''}
                    {c.name}
                    {c.nickname && <span style={{ fontWeight: 400, color: 'var(--tm)', marginLeft: 6, fontSize: '0.74rem' }}>· {c.nickname}</span>}
                  </div>
                  {c.phone1 && <div style={{ fontSize: '0.7rem', color: 'var(--tm)', marginTop: 1 }}>{c.phone1}{c.phone2 ? ' · ' + c.phone2 : ''}</div>}
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

const DRAFT_KEY = 'gth_order_draft';

const INIT_ORDER = { customerId: null, applyTax: false, deposit: '', debt: '', notes: '' };

// ── Constants & helper cho dịch vụ ────────────────────────────────────────────

const SVC_DEF = {
  xe_say:     { icon: '🪚', name: 'Xẻ sấy' },
  luoc_go:    { icon: '🪵', name: 'Luộc gỗ' },
  van_chuyen: { icon: '🚛', name: 'Vận tải' },
  other:      { icon: '✏️', name: 'Khác' },
};

// ── Bảng giá Xẻ sấy tham khảo (modal) ────────────────────────────────────────

const XE_SAY_TABS = [
  { id: 'teak',  label: '🪵 Teak / Gõ' },
  { id: 'thong', label: '🌲 Thông' },
  { id: 'mem',   label: '🌳 Gỗ mềm' },
];

function XeSayGuide({ config, canEdit, onClose, onSave, onApply }) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal]   = useState(() => JSON.parse(JSON.stringify(config)));
  const [saving, setSaving] = useState(false);
  const [tab, setTab]       = useState('teak');

  // Calculator state
  const [teakChecks,  setTeakChecks]  = useState(new Set());
  const [thongRowId,  setThongRowId]  = useState(() => (config.thong?.rows || [])[0]?.id ?? 1);
  const [thongChecks, setThongChecks] = useState(new Set());
  const [memRowId,    setMemRowId]    = useState(() => (config.mem?.rows || [])[0]?.id ?? 1);
  const [memChecks,   setMemChecks]   = useState(new Set());

  const toggleCheck = (setter, id) => setter(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const computedPrice = useMemo(() => {
    if (tab === 'teak') {
      return (local.teak?.basePrice || 0) +
        (local.teak?.adjustments || []).filter(a => teakChecks.has(a.id)).reduce((s, a) => s + (a.delta || 0), 0);
    }
    const cat = local[tab];
    const row = (cat?.rows || []).find(r => r.id === (tab === 'thong' ? thongRowId : memRowId));
    const checks = tab === 'thong' ? thongChecks : memChecks;
    return (row?.price || 0) + (cat?.adjustments || []).filter(a => checks.has(a.id)).reduce((s, a) => s + (a.delta || 0), 0);
  }, [tab, local, teakChecks, thongRowId, thongChecks, memRowId, memChecks]);

  // Edit helpers
  const updTeak = (patch) => setLocal(p => ({ ...p, teak: { ...p.teak, ...patch } }));
  const updTeakAdj = (id, patch) => setLocal(p => ({ ...p, teak: { ...p.teak, adjustments: p.teak.adjustments.map(a => a.id === id ? { ...a, ...patch } : a) } }));
  const updCatRow = (cat, id, patch) => setLocal(p => ({ ...p, [cat]: { ...p[cat], rows: p[cat].rows.map(r => r.id === id ? { ...r, ...patch } : r) } }));
  const updCatAdj = (cat, id, patch) => setLocal(p => ({ ...p, [cat]: { ...p[cat], adjustments: p[cat].adjustments.map(a => a.id === id ? { ...a, ...patch } : a) } }));

  const save = async () => { setSaving(true); await onSave(local); setSaving(false); setEditing(false); };

  const numSt = { padding: '3px 7px', borderRadius: 5, border: '1.5px solid var(--bd)', fontSize: '0.76rem', textAlign: 'right', background: 'var(--bg)', color: 'var(--tp)', boxSizing: 'border-box' };
  const txtSt = { ...numSt, textAlign: 'left', width: '100%' };

  // ── Render adjustments row (used for all 3 tabs)
  const renderAdjs = (adjs, checks, setChecks, isPositive, updFn) => adjs.map(a => (
    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--bd)' }}>
      {!editing && (
        <input type="checkbox" checked={checks.has(a.id)} onChange={() => toggleCheck(setChecks, a.id)}
          style={{ accentColor: 'var(--ac)', width: 15, height: 15, cursor: 'pointer', flexShrink: 0 }} />
      )}
      <span style={{ flex: 1, fontSize: '0.78rem', color: 'var(--ts)' }}>
        {editing ? <input value={a.label} onChange={e => updFn(a.id, { label: e.target.value })} style={txtSt} /> : a.label}
      </span>
      <span style={{ fontWeight: 700, fontSize: '0.78rem', whiteSpace: 'nowrap', color: a.delta >= 0 ? 'var(--gn)' : 'var(--dg)', minWidth: 80, textAlign: 'right' }}>
        {editing
          ? <NumInput value={Math.abs(a.delta)} onChange={v => updFn(a.id, { delta: isPositive ? Math.abs(v) : -Math.abs(v) })} style={{ ...numSt, width: 80 }} />
          : `${a.delta > 0 ? '+' : ''}${a.delta.toLocaleString('vi-VN')}`}
      </span>
    </div>
  ));

  // ── Tab: Teak/Gõ
  const renderTeak = () => (
    <div>
      <div style={{ background: 'var(--bgs)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: '0.78rem', color: 'var(--ts)', lineHeight: 1.5 }}>
        {editing
          ? <textarea value={local.teak?.description || ''} onChange={e => updTeak({ description: e.target.value })}
              rows={2} style={{ ...txtSt, resize: 'vertical' }} />
          : local.teak?.description}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--bd)', marginBottom: 10 }}>
        <span style={{ fontSize: '0.78rem', color: 'var(--ts)' }}>Đơn giá cơ bản (gỗ tròn / hộp)</span>
        {editing
          ? <NumInput value={local.teak?.basePrice || 0} onChange={v => updTeak({ basePrice: v })} style={{ ...numSt, width: 110 }} />
          : <strong style={{ fontSize: '0.92rem', color: 'var(--br)', fontVariantNumeric: 'tabular-nums' }}>{(local.teak?.basePrice || 0).toLocaleString('vi-VN')} đ/m³</strong>}
      </div>
      <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--brl)', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.05em' }}>Điều chỉnh quy cách:</div>
      {renderAdjs(local.teak?.adjustments || [], teakChecks, setTeakChecks, true, (id, p) => updTeakAdj(id, p))}
    </div>
  );

  // ── Tab: Thông / Gỗ mềm (shared layout)
  const renderRowsCat = (catKey) => {
    const cat    = local[catKey] || {};
    const rows   = cat.rows || [];
    const adjs   = cat.adjustments || [];
    const rowId  = catKey === 'thong' ? thongRowId : memRowId;
    const setRow = catKey === 'thong' ? setThongRowId : setMemRowId;
    const checks = catKey === 'thong' ? thongChecks : memChecks;
    const setChk = catKey === 'thong' ? setThongChecks : setMemChecks;
    return (
      <div>
        <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--brl)', textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.05em' }}>Chọn quy cách (đ/m³):</div>
        <div style={{ marginBottom: 14 }}>
          {rows.map(r => (
            <div key={r.id} onClick={() => !editing && setRow(r.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 6, marginBottom: 4, cursor: editing ? 'default' : 'pointer',
                background: rowId === r.id && !editing ? 'var(--acbg)' : 'transparent',
                border: rowId === r.id && !editing ? '1.5px solid var(--ac)' : '1.5px solid transparent' }}>
              {!editing && (
                <input type="radio" readOnly checked={rowId === r.id} style={{ accentColor: 'var(--ac)', width: 14, height: 14, cursor: 'pointer', flexShrink: 0 }} />
              )}
              <span style={{ flex: 1, fontSize: '0.78rem', color: 'var(--ts)' }}>
                {editing ? <input value={r.spec} onChange={e => updCatRow(catKey, r.id, { spec: e.target.value })} style={txtSt} /> : r.spec}
              </span>
              <span style={{ fontWeight: 700, color: 'var(--br)', fontSize: '0.82rem', fontVariantNumeric: 'tabular-nums', minWidth: 90, textAlign: 'right' }}>
                {editing
                  ? <NumInput value={r.price} onChange={v => updCatRow(catKey, r.id, { price: v })} style={{ ...numSt, width: 90 }} />
                  : r.price.toLocaleString('vi-VN')}
              </span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--brl)', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.05em' }}>Điều chỉnh:</div>
        {renderAdjs(adjs, checks, setChk, false, (id, p) => updCatAdj(catKey, id, p))}
      </div>
    );
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: 'var(--bgc)', borderRadius: 12, border: '1.5px solid var(--bd)', width: 500, maxWidth: '96vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.22)' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1.5px solid var(--bd)' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--br)' }}>🪚 Bảng giá Xẻ sấy tham khảo</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--tm)', marginTop: 2 }}>Chọn loại gỗ, tích chọn quy cách → bấm "Dùng giá này"</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: 'var(--tm)', padding: '4px 8px' }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1.5px solid var(--bd)', background: 'var(--bgh)' }}>
          {XE_SAY_TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ flex: 1, padding: '9px 4px', border: 'none', borderBottom: tab === t.id ? '2.5px solid var(--ac)' : '2.5px solid transparent', background: 'transparent',
                color: tab === t.id ? 'var(--ac)' : 'var(--ts)', fontWeight: tab === t.id ? 800 : 500, fontSize: '0.78rem', cursor: 'pointer' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: '16px 18px' }}>
          {tab === 'teak'  && renderTeak()}
          {tab === 'thong' && renderRowsCat('thong')}
          {tab === 'mem'   && renderRowsCat('mem')}
        </div>

        {/* Result bar */}
        {!editing && (
          <div style={{ margin: '0 18px 16px', padding: '12px 16px', background: 'var(--acbg)', border: '1.5px solid var(--ac)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: '0.62rem', color: 'var(--ac)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Đơn giá ước tính</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--br)', fontVariantNumeric: 'tabular-nums' }}>{computedPrice.toLocaleString('vi-VN')} đ/m³</div>
            </div>
            {onApply && (
              <button onClick={() => onApply(computedPrice)}
                style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: 'var(--ac)', color: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                Dùng giá này ↩
              </button>
            )}
          </div>
        )}

        {/* Footer (admin) */}
        {canEdit && (
          <div style={{ padding: '10px 18px', borderTop: '1px solid var(--bd)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            {editing ? <>
              <button onClick={() => { setLocal(JSON.parse(JSON.stringify(config))); setEditing(false); }}
                style={{ padding: '6px 14px', borderRadius: 6, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontSize: '0.78rem' }}>Hủy</button>
              <button onClick={save} disabled={saving}
                style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: 'var(--ac)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem' }}>
                {saving ? 'Đang lưu…' : '💾 Lưu cấu hình'}
              </button>
            </> : (
              <button onClick={() => setEditing(true)}
                style={{ padding: '6px 14px', borderRadius: 6, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontSize: '0.78rem' }}>
                ✏️ Sửa cấu hình giá
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── ServiceRow: 1 dòng compact cho mỗi dịch vụ ────────────────────────────────

function ServiceRow({ s, idx, carriers, onUpdate, onRemove, onShowGuide }) {
  const sel = { padding: '3px 6px', borderRadius: 5, border: '1.5px solid var(--bd)', fontSize: '0.73rem', background: 'var(--bg)', color: 'var(--tp)', cursor: 'pointer', height: 26, boxSizing: 'border-box' };
  const inp = { ...sel, cursor: 'text' };
  const upd = (patch) => onUpdate(idx, { ...s, ...patch });

  const [showCarrierDd, setShowCarrierDd] = React.useState(false);
  const [carrierQ, setCarrierQ] = React.useState('');
  const carrierRef = React.useRef(null);

  React.useEffect(() => {
    if (!showCarrierDd) return;
    const handler = (e) => { if (carrierRef.current && !carrierRef.current.contains(e.target)) setShowCarrierDd(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showCarrierDd]);

  const sortedCarriers = [...carriers].sort((a,b) => (a.priority??1)-(b.priority??1)).filter(c => c.active !== false && c.serviceType !== 'chi_ha_cont');
  const filteredCarriers = carrierQ.trim() ? sortedCarriers.filter(c => c.name.toLowerCase().includes(carrierQ.toLowerCase())) : sortedCarriers;
  const selectedCarrier = carriers.find(c => c.id === s.carrierId);

  // amount display dùng chung
  const amtDisplay = (
    <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums', color: 'var(--br)', whiteSpace: 'nowrap', minWidth: 76, textAlign: 'right' }}>
      {(s.amount || 0).toLocaleString('vi-VN')}
    </span>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 0', borderBottom: '1px solid var(--bd)', flexWrap: 'wrap', minHeight: 36 }}>
      {/* Label */}
      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--brl)', whiteSpace: 'nowrap', minWidth: 84, flexShrink: 0 }}>
        {SVC_DEF[s.type]?.icon} {SVC_DEF[s.type]?.name || s.type}
      </span>

      {/* ── Xẻ sấy ── volume × unitPrice (tay) + nút hướng dẫn giá */}
      {s.type === 'xe_say' && <>
        <NumInput value={s.volume ?? 0} onChange={v => upd({ volume: v })} style={{ ...inp, width: 68, textAlign: 'right' }} placeholder="m³" />
        <span style={{ fontSize: '0.68rem', color: 'var(--tm)', whiteSpace: 'nowrap' }}>m³  ×</span>
        <NumInput value={s.unitPrice ?? 0} onChange={v => upd({ unitPrice: v })} style={{ ...inp, width: 90, textAlign: 'right' }} placeholder="đ/m³" />
        <span style={{ fontSize: '0.68rem', color: 'var(--tm)', whiteSpace: 'nowrap' }}>đ/m³</span>
        <button onClick={onShowGuide} title="Xem bảng giá tham khảo"
          style={{ padding: '1px 6px', borderRadius: 4, border: '1.5px solid var(--bd)', background: 'var(--bgs)', color: 'var(--ts)', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700, flexShrink: 0, height: 22 }}>?</button>
        {amtDisplay}
      </>}

      {/* ── Luộc gỗ ── volume × 1.000k cố định */}
      {s.type === 'luoc_go' && <>
        <NumInput value={s.volume ?? 0} onChange={v => upd({ volume: v })} style={{ ...inp, width: 68, textAlign: 'right' }} placeholder="m³" />
        <span style={{ fontSize: '0.68rem', color: 'var(--tm)', whiteSpace: 'nowrap' }}>m³ × 1.000.000</span>
        {amtDisplay}
      </>}

      {/* ── Vận tải ── carrier + amount */}
      {s.type === 'van_chuyen' && <>
        <div ref={carrierRef} style={{ position: 'relative', minWidth: 140 }}>
          <button onClick={() => { setShowCarrierDd(v => !v); setCarrierQ(''); }}
            style={{ ...sel, width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, paddingRight: 4 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: selectedCarrier ? 'var(--tp)' : 'var(--tm)' }}>
              {selectedCarrier ? selectedCarrier.name : '-- Đơn vị --'}
            </span>
            <span style={{ fontSize: '0.6rem', color: 'var(--tm)', flexShrink: 0 }}>▼</span>
          </button>
          {showCarrierDd && (
            <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 200, background: 'var(--bgc)', border: '1.5px solid var(--ac)', borderRadius: 7, boxShadow: '0 4px 16px rgba(0,0,0,0.13)', minWidth: 200, marginTop: 2 }}>
              <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--bd)' }}>
                <input autoFocus value={carrierQ} onChange={e => setCarrierQ(e.target.value)}
                  placeholder="Tìm đơn vị..." style={{ ...inp, width: '100%', cursor: 'text', height: 24, boxSizing: 'border-box' }} />
              </div>
              <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                <div onClick={() => { upd({ carrierId: '', carrierName: '' }); setShowCarrierDd(false); }}
                  style={{ padding: '5px 10px', fontSize: '0.73rem', color: 'var(--tm)', cursor: 'pointer', fontStyle: 'italic',
                    background: !s.carrierId ? 'var(--acbg)' : 'transparent' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bgs)'}
                  onMouseLeave={e => e.currentTarget.style.background = !s.carrierId ? 'var(--acbg)' : 'transparent'}>
                  -- Đơn vị --
                </div>
                {filteredCarriers.length === 0 ? (
                  <div style={{ padding: '8px 10px', fontSize: '0.73rem', color: 'var(--tm)', fontStyle: 'italic' }}>Không tìm thấy</div>
                ) : filteredCarriers.map(c => (
                  <div key={c.id} onClick={() => { upd({ carrierId: c.id, carrierName: c.name }); setShowCarrierDd(false); setCarrierQ(''); }}
                    style={{ padding: '5px 10px', fontSize: '0.73rem', color: 'var(--tp)', cursor: 'pointer',
                      background: s.carrierId === c.id ? 'var(--acbg)' : 'transparent', fontWeight: s.carrierId === c.id ? 700 : 400 }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bgs)'}
                    onMouseLeave={e => e.currentTarget.style.background = s.carrierId === c.id ? 'var(--acbg)' : 'transparent'}>
                    {c.name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <NumInput value={s.amount || 0} onChange={v => upd({ amount: v })} style={{ ...inp, width: 110, textAlign: 'right' }} placeholder="Thành tiền" />
        {amtDisplay}
      </>}

      {/* ── Dịch vụ khác ── */}
      {s.type === 'other' && <>
        <input value={s.description || ''} onChange={e => upd({ description: e.target.value })}
          placeholder="Mô tả dịch vụ…" style={{ ...inp, flex: 1, minWidth: 120 }} />
        <NumInput value={s.amount || 0} onChange={v => upd({ amount: v })} style={{ ...inp, width: 110, textAlign: 'right' }} />
        {amtDisplay}
      </>}

      <button onClick={() => onRemove(idx)} title="Xóa"
        style={{ width: 24, height: 24, borderRadius: 4, border: '1px solid var(--dg)', background: 'transparent', color: 'var(--dg)', cursor: 'pointer', flexShrink: 0, fontSize: '0.7rem', lineHeight: 1 }}>✕</button>
    </div>
  );
}

function OrderForm({ initial, initialItems, initialServices, customers, wts, ats, cfg, prices, ce, useAPI, notify, onDone, onNewCustomer, vatRate = 0.08, carriers = [], xeSayConfig = DEFAULT_XE_SAY_CONFIG, setXeSayConfig }) {
  const isNew = !initial?.id;
  // V-28: lưu draft thành order DB với status Nháp — không dùng localStorage
  const [fm, setFm] = useState(initial || INIT_ORDER);
  const [items, setItems] = useState(initialItems || []);
  const [services, setServices] = useState(() => {
    if (initialServices?.length) {
      return initialServices.map(s => s.type ? s : { ...s, type: 'other' });
    }
    // Backward compat: migrate shippingFee cũ → van_chuyen service
    if (initial?.shippingFee > 0) {
      return [{ type: 'van_chuyen', carrierId: initial.shippingCarrier || '', carrierName: initial.shippingCarrier || '', amount: initial.shippingFee }];
    }
    return [];
  });
  const [showBundleSel, setShowBundleSel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [confirmPayMethod, setConfirmPayMethod] = useState(null); // null | 'picking' | 'CK' | 'TM'
  // V-25: công nợ hiện tại của khách
  const [customerDebt, setCustomerDebt] = useState(0);
  // Customer credits (công nợ dương từ đơn hủy)
  const [customerCredits, setCustomerCredits] = useState([]);
  const [appliedCredits, setAppliedCredits] = useState([]); // [{creditId, amount, reason}]
  // V-21: theo dõi bundle đã lock để unlock khi rời form
  const lockedBundleIds = useRef(new Set());

  const [showXeSayGuide, setShowXeSayGuide] = useState(false); // false | rowIdx

  const f = (k) => (v) => setFm(p => ({ ...p, [k]: v }));
  const selCust = customers.find(c => c.id === fm.customerId);
  const totalM3 = items.reduce((s, it) => it.unit !== 'm2' ? s + (parseFloat(it.volume) || 0) : s, 0);

  const handleSaveXeSayConfig = async (newCfg) => {
    if (setXeSayConfig) setXeSayConfig(newCfg);
    if (useAPI) {
      const { saveXeSayConfig } = await import('../api.js');
      const r = await saveXeSayConfig(newCfg).catch(() => ({ error: 'Lỗi kết nối' }));
      if (r?.error) notify('Lỗi lưu cấu hình: ' + r.error, false);
      else notify('Đã lưu cấu hình giá xẻ sấy');
    } else notify('Đã lưu cấu hình giá xẻ sấy');
  };
  const { subtotal, taxAmount, total, toPay, itemsTotal, svcTotal } = calcTotals(items, services, 0, fm.applyTax, fm.deposit, fm.debt, vatRate);

  // V-25: tải công nợ + credits khi chọn khách hàng
  useEffect(() => {
    if (!fm.customerId || !useAPI) { setCustomerDebt(0); setCustomerCredits([]); return; }
    import('../api.js').then(api => {
      api.fetchCustomerUnpaidDebt(fm.customerId).then(d => setCustomerDebt(d)).catch(() => setCustomerDebt(0));
      api.fetchCustomerCredits(fm.customerId).then(c => setCustomerCredits(c || [])).catch(() => setCustomerCredits([]));
    });
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
  const addSvcOfType = (type) => {
    const vol = totalM3 || 0;
    const defaults = {
      xe_say:     { type, volume: vol, unitPrice: 0 },
      luoc_go:    { type, volume: vol },
      van_chuyen: { type, carrierId: '', carrierName: '', amount: 0 },
      other:      { type, description: '', amount: 0 },
    };
    const newSvc = defaults[type] || { type, description: '', amount: 0 };
    setServices(prev => [...prev, { ...newSvc, amount: calcSvcAmount(newSvc) }]);
  };
  const updateSvc = (idx, newSvc) => {
    setServices(prev => prev.map((s, i) => i === idx ? { ...newSvc, amount: calcSvcAmount(newSvc) } : s));
  };
  const removeSvc = (idx) => setServices(prev => prev.filter((_, i) => i !== idx));

  // V-27: mặt hàng nào có giá thấp hơn bảng giá
  const belowPriceItems = items.filter(it => {
    if (!it.listPrice || it.listPrice <= 0) return false;
    if (it.unit === 'm2') return it.unitPrice !== it.listPrice && it.unitPrice !== it.listPrice2;
    return it.unitPrice !== it.listPrice;
  });

  const handleSave = async (targetStatus, payMethod) => {
    if (!fm.customerId) return notify('Vui lòng chọn khách hàng', false);
    if (items.length === 0 && svcTotal === 0) return notify('Chưa có sản phẩm hoặc dịch vụ nào trong đơn', false);
    // V-27: nếu có mặt hàng giá thấp hơn bảng → chuyển sang Chờ duyệt
    const effectiveStatus = (targetStatus === 'Chưa thanh toán' && belowPriceItems.length > 0)
      ? 'Chờ duyệt' : targetStatus;
    setSaving(true);
    setConfirmPayMethod(null);
    try {
      const { createOrder, updateOrder, deductBundlesForOrder, recordPayment } = await import('../api.js');
      const orderData = { ...fm, subtotal, taxAmount, totalAmount: total, deposit: parseFloat(fm.deposit) || 0, debt: parseFloat(fm.debt) || 0, shippingFee: 0, targetStatus: effectiveStatus };
      const svcList = services.map(s => ({ ...s, amount: calcSvcAmount(s) })).filter(s => s.amount > 0 || (s.type === 'other' && s.description));
      const r = initial?.id ? await updateOrder(initial.id, orderData, items, svcList) : await createOrder(orderData, items, svcList);
      if (r.error) { notify('Lỗi: ' + r.error, false); setSaving(false); return; }
      if (effectiveStatus === 'Đã thanh toán') {
        await deductBundlesForOrder(items);
        // Ghi payment_record cho toàn bộ toPay
        const ordId = r.id || initial?.id;
        if (ordId && toPay > 0) await recordPayment(ordId, { amount: toPay, method: payMethod || 'Tiền mặt', note: 'Thanh toán khi tạo đơn' });
      }
      // Khấu trừ customer credits nếu đã áp dụng
      if (appliedCredits.length > 0) {
        const ordId = r.id || initial?.id;
        const { useCustomerCredit } = await import('../api.js');
        for (const ac of appliedCredits) {
          await useCustomerCredit(ac.creditId, ordId, ac.amount).catch(() => {});
        }
      }
      // V-21: unlock tất cả bundle sau khi lưu thành công
      const lockedIds = [...lockedBundleIds.current];
      if (lockedIds.length > 0) {
        lockedIds.forEach(id => import('../api.js').then(api => api.unlockBundle(id).catch(() => {})));
        lockedBundleIds.current.clear();
      }
      const msg = effectiveStatus === 'Nháp' ? 'Đã lưu nháp'
        : effectiveStatus === 'Chờ duyệt' ? `Đã tạo đơn ${r.orderCode} — chờ admin duyệt giá`
        : effectiveStatus === 'Đã thanh toán' ? `Đã tạo đơn & ghi thu ${fmtMoney(toPay)} (${payMethod || 'Tiền mặt'})`
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
      {showBundleSel && <BundleSelector wts={wts} ats={ats} prices={prices} cfg={cfg} onConfirm={addBundles} onClose={() => setShowBundleSel(false)} />}
      {showXeSayGuide !== false && <XeSayGuide config={xeSayConfig} canEdit={ce} onClose={() => setShowXeSayGuide(false)} onSave={handleSaveXeSayConfig}
        onApply={(price) => { updateSvc(showXeSayGuide, { ...services[showXeSayGuide], unitPrice: price }); setShowXeSayGuide(false); }} />}
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
                })}
                onPreview={({ layout, hideSupplierName }) => printOrder({
                  order: { ...fm, orderCode: initial?.orderCode || 'NHÁP', paymentStatus: 'Nháp', exportStatus: 'Chưa xuất', shippingFee: parseFloat(fm.shippingFee) || 0, shippingType: fm.shippingType, deposit: parseFloat(fm.deposit) || 0, debt: parseFloat(fm.debt) || 0, applyTax: fm.applyTax, notes: fm.notes, createdAt: new Date().toISOString() },
                  customer: customers.find(c => c.id === fm.customerId) || null,
                  items, services, wts, ats, vatRate, hideSupplierName, layout, previewOnly: true
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
          <CustomerSearchSelect customers={customers} value={fm.customerId} onChange={v => f('customerId')(v)} inpSt={inpSt} />
          <button onClick={onNewCustomer} style={{ fontSize: '0.72rem', color: 'var(--ac)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}>+ Khách mới</button>
          {selCust && (
            <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 6, background: 'var(--bgs)', border: '1px solid var(--bd)', fontSize: '0.76rem' }}>
              <div style={{ fontWeight: 700, color: 'var(--br)' }}>{selCust.salutation && <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--ac)', background: 'var(--acbg)', padding: '1px 5px', borderRadius: 3, marginRight: 5 }}>{selCust.salutation}</span>}{selCust.name}{selCust.nickname && <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--tm)', marginLeft: 6 }}>· {selCust.nickname}</span>}</div>
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
          {/* Công nợ dương (credit từ đơn hủy) */}
          {customerCredits.length > 0 && appliedCredits.length === 0 && (
            <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 6, background: 'rgba(50,79,39,0.06)', border: '1.5px solid rgba(50,79,39,0.3)', fontSize: '0.75rem' }}>
              <div style={{ fontWeight: 700, color: 'var(--gn)', marginBottom: 4 }}>💰 Khách có tiền thừa từ đơn hủy</div>
              {customerCredits.map(cr => (
                <div key={cr.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ flex: 1, color: 'var(--ts)' }}>{cr.reason} — còn <strong style={{ color: 'var(--gn)' }}>{fmtMoney(cr.remaining)}</strong></span>
                  <button onClick={() => {
                    const applyAmt = Math.min(cr.remaining, Math.max(0, toPay));
                    if (applyAmt <= 0) return;
                    setAppliedCredits(prev => [...prev, { creditId: cr.id, amount: applyAmt, reason: cr.reason }]);
                    const currentDeposit = parseFloat(fm.deposit) || 0;
                    f('deposit')(currentDeposit + applyAmt);
                    const currentNotes = fm.notes || '';
                    const creditNote = cr.reason;
                    f('notes')(currentNotes ? currentNotes + '\n' + creditNote : creditNote);
                  }} style={{ padding: '3px 10px', borderRadius: 5, border: 'none', background: 'var(--gn)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.68rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    Áp dụng
                  </button>
                </div>
              ))}
            </div>
          )}
          {appliedCredits.length > 0 && (
            <div style={{ marginTop: 6, padding: '6px 10px', borderRadius: 5, background: 'rgba(50,79,39,0.06)', border: '1px solid var(--gn)', fontSize: '0.72rem', color: 'var(--gn)' }}>
              ✓ Đã áp dụng công nợ dương: {appliedCredits.map(c => fmtMoney(c.amount)).join(' + ')} vào đặt cọc
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
                {['Mã kiện / NCC', 'Loại gỗ & Thuộc tính', 'Số tấm', 'KL', 'Đơn vị', 'Đơn giá (đ)', 'Thành tiền', ''].map(h => <th key={h} style={ths}>{h}</th>)}
              </tr></thead>
              <tbody>
                {items.map((it, idx) => {
                  const w = wts.find(x => x.id === it.woodId);
                  const m2 = it.unit === 'm2';
                  // m2: giá OK nếu match listPrice (lẻ) hoặc listPrice2 (nguyên kiện)
                  const priceChanged = m2
                    ? (it.listPrice && it.unitPrice !== it.listPrice && it.unitPrice !== it.listPrice2)
                    : (it.listPrice && it.unitPrice !== it.listPrice);
                  return (
                    <tr key={idx} style={{ background: idx % 2 ? 'var(--bgs)' : '#fff' }}>
                      <td style={{ padding: '5px 6px', borderBottom: '1px solid var(--bd)', whiteSpace: 'nowrap' }}>
                        <div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--br)' }}>{it.bundleCode}</div>
                        {it.supplierBundleCode && <div style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: 'var(--tm)' }}>{it.supplierBundleCode}</div>}
                      </td>
                      <td style={{ padding: '5px 6px', borderBottom: '1px solid var(--bd)' }}>
                        <div style={{ fontWeight: 700 }}>{w?.name}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--tm)' }}>{fmtItemAttrs(it, cfg, ats)}</div>
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
                        {m2 && it.listPrice && <div style={{ fontSize: '0.58rem', color: 'var(--tm)', whiteSpace: 'nowrap' }}>lẻ: {fmtMoney(it.listPrice)}{it.listPrice2 ? ` / NK: ${fmtMoney(it.listPrice2)}` : ''}</div>}
                        {!m2 && priceChanged && <div style={{ fontSize: '0.58rem', color: 'var(--ac)', whiteSpace: 'nowrap' }}>⚠ Bảng giá: {it.listPrice?.toFixed(1)}</div>}
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
            {items.length > 0 && (() => {
              const totalBoards = items.reduce((s, it) => s + (parseInt(it.boardCount) || 0), 0);
              const totalVolume = items.reduce((s, it) => s + (parseFloat(it.volume) || 0), 0).toFixed(3);
              return (
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 20, padding: '6px 12px', borderTop: '2px solid var(--bds)', background: 'var(--bgh)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--tm)', fontVariantNumeric: 'tabular-nums' }}><strong style={{ color: 'var(--br)' }}>{totalBoards}</strong> tấm &nbsp;·&nbsp; <strong style={{ color: 'var(--br)' }}>{totalVolume}</strong> m³</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--brl)', fontWeight: 700, textTransform: 'uppercase' }}>Tổng tiền hàng</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--br)', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(itemsTotal)}</span>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Dịch vụ */}
      <div style={{ background: 'var(--bgc)', borderRadius: 10, border: '1.5px solid var(--bd)', padding: '12px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: services.length ? 6 : 0 }}>
          {secTitle('Dịch vụ')}
          <select defaultValue="" onChange={e => { if (e.target.value) { addSvcOfType(e.target.value); e.target.value = ''; } }}
            style={{ padding: '4px 8px', borderRadius: 5, border: '1.5px solid var(--bd)', fontSize: '0.72rem', background: 'var(--bg)', color: 'var(--ts)', cursor: 'pointer' }}>
            <option value="">+ Thêm dịch vụ…</option>
            <option value="xe_say">🪚 Xẻ sấy</option>
            <option value="luoc_go">🪵 Luộc gỗ</option>
            <option value="van_chuyen">🚛 Vận tải</option>
            <option value="other">✏️ Dịch vụ khác</option>
          </select>
        </div>
        {services.map((s, idx) => (
          <ServiceRow key={idx} s={s} idx={idx} carriers={carriers} onUpdate={updateSvc} onRemove={removeSvc} onShowGuide={() => setShowXeSayGuide(idx)} />
        ))}
        {svcTotal > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--bd)', marginTop: 4 }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--brl)', fontWeight: 700, textTransform: 'uppercase', marginRight: 12 }}>Tổng dịch vụ</span>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--br)', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(svcTotal)}</span>
          </div>
        )}
      </div>

      {/* Thanh toán tổng kết */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div style={{ background: 'var(--bgc)', borderRadius: 10, border: '1.5px solid var(--bd)', padding: 16 }}>
          {secTitle('Thuế & Giảm trừ')}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
            <input type="checkbox" checked={fm.applyTax} onChange={e => f('applyTax')(e.target.checked)} style={{ accentColor: 'var(--ac)' }} />Áp dụng thuế VAT {Math.round(vatRate * 100)}% <span style={{ fontWeight: 400, fontSize: '0.72rem', color: 'var(--tm)' }}>(chỉ tính trên tiền hàng, không tính dịch vụ)</span>
          </label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1 }}><label style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--brl)', display: 'block', marginBottom: 3, textTransform: 'uppercase' }}>Đặt cọc (đ)</label><NumInput value={fm.deposit} onChange={n => f('deposit')(n)} style={inpSt} /></div>
            <div style={{ flex: 1 }}><label style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--brl)', display: 'block', marginBottom: 3, textTransform: 'uppercase' }}>Công nợ (đ)</label><NumInput value={fm.debt} onChange={n => f('debt')(n)} style={inpSt} /></div>
          </div>
        </div>
        <div style={{ background: 'var(--bgs)', borderRadius: 10, border: '1.5px solid var(--bds)', padding: 16 }}>
          {secTitle('Tổng kết')}
          {[items.length > 0 && ['Tiền hàng', itemsTotal], svcTotal > 0 && ['Tiền dịch vụ', svcTotal], 'sep', fm.applyTax && [`Thuế VAT ${Math.round(vatRate * 100)}% (tiền hàng)`, taxAmount], ['Tổng cộng', total], fm.deposit > 0 && ['Đặt cọc', -parseFloat(fm.deposit)], fm.debt > 0 && ['Công nợ', -parseFloat(fm.debt)]].filter(Boolean).map((row, i) => row === 'sep' ? (
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
        {confirmPayMethod === 'picking' ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: 'var(--bgc)', border: '1.5px solid var(--gn)', borderRadius: 8, padding: '6px 10px' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--ts)', whiteSpace: 'nowrap' }}>Thanh toán qua:</span>
            <button onClick={() => handleSave('Đã thanh toán', 'Chuyển khoản')} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#2980b9', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.76rem' }}>🏦 Chuyển khoản</button>
            <button onClick={() => handleSave('Đã thanh toán', 'Tiền mặt')} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: 'var(--gn)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.76rem' }}>💵 Tiền mặt</button>
            <button onClick={() => setConfirmPayMethod(null)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontSize: '0.74rem' }}>✕</button>
          </div>
        ) : (
          <button onClick={() => setConfirmPayMethod('picking')} disabled={saving || initial?.paymentStatus === 'Đã thanh toán'} style={{ padding: '9px 20px', borderRadius: 7, border: 'none', background: saving || initial?.paymentStatus === 'Đã thanh toán' ? 'var(--bd)' : 'var(--gn)', color: saving || initial?.paymentStatus === 'Đã thanh toán' ? 'var(--tm)' : '#fff', cursor: saving || initial?.paymentStatus === 'Đã thanh toán' ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.82rem' }}>
            {saving ? 'Đang lưu...' : '✓ Đã thanh toán'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── OrderDetail ───────────────────────────────────────────────────────────────

function OrderDetail({ orderId, wts, ats, cfg, onBack, onEdit, onOrderUpdated, onOrderDeleted, notify, ce, vatRate = 0.08, carriers = [] }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exportImgs, setExportImgs] = useState([]);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [showCancelDlg, setShowCancelDlg] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    (async () => {
      const { fetchOrderDetail } = await import('../api.js');
      const d = await fetchOrderDetail(orderId);
      setData(d); setLoading(false);
    })();
  }, [orderId]);

  const handleRecordPayment = async ({ amount, method, note, discount, discountNote }) => {
    setPaymentSaving(true);
    const { recordPayment } = await import('../api.js');
    const r = await recordPayment(orderId, { amount, method, note, discount, discountNote });
    setPaymentSaving(false);
    if (r.error) return notify('Lỗi: ' + r.error, false);
    const newRecord = { id: Date.now(), amount, method, discount: discount || 0, discountNote: discountNote || '', discountStatus: r.discountStatus || 'none', paidAt: new Date().toISOString(), note: note || '', paidBy: '' };
    setData(d => ({
      ...d,
      order: { ...d.order, paymentStatus: r.paymentStatus, status: r.paymentStatus === 'Đã thanh toán' ? 'Đã thanh toán' : d.order.status },
      paymentRecords: [...(d.paymentRecords || []), newRecord],
    }));
    onOrderUpdated?.({ id: orderId, paymentStatus: r.paymentStatus, status: r.paymentStatus });
    setShowPaymentModal(false);
    const discountMsg = discount > 0 ? (r.discountStatus === 'pending' ? ` · Gia hàng ${fmtMoney(discount)} chờ admin duyệt` : ` · Gia hàng ${fmtMoney(discount)} tự duyệt`) : '';
    notify(r.paymentStatus === 'Đã thanh toán' ? '✓ Đã thu đủ — đơn hoàn tất' : `Đã ghi thu ${fmtMoney(amount)}${discountMsg} (còn ${fmtMoney(r.outstanding)})`);
  };

  const handleApproveDiscount = async (recordId, approve) => {
    const { approvePaymentDiscount } = await import('../api.js');
    const r = await approvePaymentDiscount(recordId, approve);
    if (r.error) return notify('Lỗi: ' + r.error, false);
    setData(d => ({
      ...d,
      order: { ...d.order, paymentStatus: r.paymentStatus, status: r.paymentStatus === 'Đã thanh toán' ? 'Đã thanh toán' : d.order.status },
      paymentRecords: (d.paymentRecords || []).map(p => p.id === recordId ? { ...p, discountStatus: approve ? 'approved' : 'rejected' } : p),
    }));
    onOrderUpdated?.({ id: orderId, paymentStatus: r.paymentStatus });
    notify(approve ? `✓ Đã duyệt gia hàng${r.paymentStatus === 'Đã thanh toán' ? ' — đơn hoàn tất' : ''}` : 'Đã từ chối gia hàng');
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

  const handleCancelOrder = async () => {
    if (!cancelReason.trim()) return;
    setCancelling(true);
    try {
      const isDraft = data?.order?.paymentStatus === 'Nháp';
      if (isDraft) {
        const { deleteOrder } = await import('../api.js');
        const r = await deleteOrder(orderId);
        if (r.error) { notify('Lỗi: ' + r.error, false); setCancelling(false); return; }
        notify('Đã xóa đơn nháp');
        onOrderDeleted?.(orderId);
        onBack();
      } else {
        const { cancelOrder } = await import('../api.js');
        const r = await cancelOrder(orderId, cancelReason.trim(), 'admin');
        if (r.error) { notify('Lỗi: ' + r.error, false); setCancelling(false); return; }
        const msgs = [`Đã hủy đơn ${r.orderCode}`];
        if (r.bundlesRestored > 0) msgs.push(`hoàn ${r.bundlesRestored} kiện về kho`);
        if (r.creditAmount > 0) msgs.push(`ghi công nợ dương ${fmtMoney(r.creditAmount)}`);
        notify(msgs.join(' · '));
        setData(d => ({ ...d, order: { ...d.order, paymentStatus: 'Đã hủy', status: 'Đã hủy', cancelledAt: new Date().toISOString(), cancelledBy: 'admin', cancelReason: cancelReason.trim() } }));
        onOrderUpdated?.({ id: orderId, paymentStatus: 'Đã hủy', status: 'Đã hủy' });
      }
    } catch (e) { notify('Lỗi: ' + e.message, false); }
    setCancelling(false);
    setShowCancelDlg(false);
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--tm)' }}>Đang tải...</div>;
  if (!data?.order) return <div style={{ padding: 20, color: 'var(--dg)' }}>Không tìm thấy đơn hàng</div>;

  const { order, customer, items, services, paymentRecords = [] } = data;
  const { subtotal, taxAmount, total, toPay, itemsTotal, svcTotal } = calcTotals(items, services, order.shippingFee, order.applyTax, order.deposit, order.debt, vatRate);
  const totalPaid = paymentRecords.reduce((s, r) => {
    const dc = r.discountStatus === 'auto' || r.discountStatus === 'approved';
    return s + (r.amount || 0) + (dc ? (r.discount || 0) : 0);
  }, 0);
  const outstanding = Math.max(0, toPay - totalPaid);
  const pendingDiscounts = paymentRecords.filter(r => r.discountStatus === 'pending');
  const isCancelled = order.paymentStatus === 'Đã hủy';
  const canEdit = ce && !isCancelled && order.paymentStatus !== 'Đã thanh toán';
  const canCancel = ce && !isCancelled;

  const pmtBadgeStyle = (s) => {
    if (s === 'Đã thanh toán') return { background: 'rgba(50,79,39,0.1)', color: 'var(--gn)' };
    if (s === 'Nháp') return { background: 'rgba(168,155,142,0.15)', color: 'var(--tm)' };
    if (s === 'Chờ duyệt') return { background: 'rgba(255,152,0,0.15)', color: '#E65100', border: '1px solid #FFB74D' };
    if (s === 'Còn nợ') return { background: 'rgba(142,68,173,0.1)', color: '#8e44ad', border: '1px solid rgba(142,68,173,0.3)' };
    if (s === 'Đã hủy') return { background: 'rgba(168,155,142,0.15)', color: 'var(--tm)', textDecoration: 'line-through' };
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
            onPrint={({ layout, hideSupplierName }) => printOrder({ order, customer, items, services, wts, ats, vatRate, hideSupplierName, layout })}
            onPreview={({ layout, hideSupplierName }) => printOrder({ order, customer, items, services, wts, ats, vatRate, hideSupplierName, layout, previewOnly: true })} />
        )}
        {showPaymentModal && (
          <RecordPaymentModal toPay={toPay} paymentRecords={paymentRecords}
            saving={paymentSaving} onClose={() => setShowPaymentModal(false)}
            onConfirm={handleRecordPayment} />
        )}
        <button onClick={() => setShowPrintModal(true)} style={{ padding: '6px 14px', borderRadius: 6, border: '1.5px solid var(--bd)', background: 'var(--bgs)', color: 'var(--ts)', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 600 }}>🖨 In / PDF</button>
        {canEdit && <button onClick={() => onEdit(order, items, services)} style={{ padding: '6px 14px', borderRadius: 6, border: '1.5px solid var(--ac)', background: 'var(--acbg)', color: 'var(--ac)', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 700 }}>✏️ Sửa đơn</button>}
        {canCancel && <button onClick={() => { setShowCancelDlg(true); setCancelReason(''); }} style={{ padding: '6px 14px', borderRadius: 6, border: '1.5px solid var(--dg)', background: 'transparent', color: 'var(--dg)', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 600 }}>✕ Hủy đơn</button>}
      </div>

      {/* Cancel Order Dialog */}
      {showCancelDlg && (() => {
        const isDraft = order.paymentStatus === 'Nháp';
        const hasDeducted = order.paymentStatus === 'Đã thanh toán';
        const hasBundles = items.some(it => it.bundleId);
        const hasPayments = totalPaid > 0;
        // Tính credit tiền hàng (không dịch vụ)
        const cancelItemsTotal = items.reduce((s, it) => s + (it.amount || 0), 0);
        const cancelVatOnItems = order.applyTax ? Math.round(cancelItemsTotal * vatRate) : 0;
        const cancelTotalOrder = order.totalAmount || 0;
        const cancelToPay = cancelTotalOrder - (order.deposit || 0) - (order.debt || 0);
        const itemsWithVat = cancelItemsTotal + cancelVatOnItems;
        const creditEstimate = hasPayments && cancelToPay > 0 ? Math.min(totalPaid, Math.round(cancelToPay * itemsWithVat / cancelTotalOrder)) : 0;

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(45,32,22,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: 'var(--bgc)', borderRadius: 14, padding: 24, width: 500, maxWidth: '96vw', border: '1px solid var(--bd)', boxShadow: '0 8px 40px rgba(0,0,0,0.25)' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: '0.95rem', fontWeight: 800, color: 'var(--dg)' }}>
                {isDraft ? '🗑 Xóa đơn nháp' : '✕ Hủy đơn hàng'}
              </h3>
              <p style={{ margin: '0 0 14px', fontSize: '0.8rem', color: 'var(--ts)', lineHeight: 1.5 }}>
                {isDraft
                  ? <>Xóa đơn nháp <strong>{order.orderCode}</strong>? Thao tác này không thể hoàn tác.</>
                  : <>Hủy đơn <strong>{order.orderCode}</strong> — đơn sẽ chuyển sang trạng thái <strong style={{ color: 'var(--dg)' }}>Đã hủy</strong>.</>
                }
              </p>

              {/* Danh sách kiện sẽ hoàn */}
              {!isDraft && hasDeducted && hasBundles && (
                <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 7, background: 'rgba(50,79,39,0.06)', border: '1px solid rgba(50,79,39,0.2)', fontSize: '0.76rem' }}>
                  <div style={{ fontWeight: 700, color: 'var(--gn)', marginBottom: 4 }}>📦 Hoàn trả {items.filter(it => it.bundleId).length} kiện về kho</div>
                  {items.filter(it => it.bundleId).map((it, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, color: 'var(--ts)', padding: '2px 0' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, minWidth: 80 }}>{it.bundleCode}</span>
                      <span>+{it.boardCount} tấm · +{(it.volume || 0).toFixed(3)} {it.unit}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Credit tiền hàng */}
              {!isDraft && hasPayments && creditEstimate > 0 && (
                <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 7, background: 'rgba(242,101,34,0.06)', border: '1px solid rgba(242,101,34,0.2)', fontSize: '0.76rem' }}>
                  <div style={{ fontWeight: 700, color: 'var(--ac)', marginBottom: 2 }}>💰 Ghi công nợ dương (tiền hàng)</div>
                  <div style={{ color: 'var(--ts)' }}>
                    Đã thu: <strong>{fmtMoney(totalPaid)}</strong> — Ghi nhận <strong style={{ color: 'var(--ac)' }}>{fmtMoney(creditEstimate)}</strong> tiền hàng cho <strong>{customer?.name || order.customerName}</strong>
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--tm)', marginTop: 2 }}>Phần dịch vụ ({fmtMoney(totalPaid - creditEstimate)}) không hoàn lại</div>
                </div>
              )}

              {/* Lý do hủy */}
              {!isDraft && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--br)', display: 'block', marginBottom: 4 }}>Lý do hủy *</label>
                  <input type="text" value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="VD: Khách đổi ý, nhập sai đơn..."
                    onKeyDown={e => { if (e.key === 'Escape') setShowCancelDlg(false); if (e.key === 'Enter' && cancelReason.trim()) handleCancelOrder(); }}
                    autoFocus
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1.5px solid var(--bd)', background: 'var(--bg)', color: 'var(--tp)', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowCancelDlg(false)} disabled={cancelling} style={{ padding: '7px 18px', borderRadius: 7, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>Không hủy</button>
                <button onClick={() => { if (isDraft) { setCancelReason('Xóa nháp'); setTimeout(handleCancelOrder, 0); } else handleCancelOrder(); }}
                  disabled={cancelling || (!isDraft && !cancelReason.trim())}
                  style={{ padding: '7px 20px', borderRadius: 7, border: 'none', background: (cancelling || (!isDraft && !cancelReason.trim())) ? 'var(--bd)' : 'var(--dg)', color: (cancelling || (!isDraft && !cancelReason.trim())) ? 'var(--tm)' : '#fff', cursor: (cancelling || (!isDraft && !cancelReason.trim())) ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>
                  {cancelling ? 'Đang xử lý...' : isDraft ? '🗑 Xóa' : '✕ Xác nhận hủy'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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

      {/* Banner đã hủy */}
      {isCancelled && (
        <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: 'rgba(168,155,142,0.1)', border: '2px solid var(--tm)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>🚫</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--dg)' }}>Đơn đã hủy</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--ts)', marginTop: 2 }}>
              {order.cancelledBy && <span>Bởi <strong>{order.cancelledBy}</strong></span>}
              {order.cancelledAt && <span> lúc {new Date(order.cancelledAt).toLocaleString('vi-VN')}</span>}
              {order.cancelReason && <span> — Lý do: <em>{order.cancelReason}</em></span>}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--bgc)', border: '1px solid var(--bd)' }}>
          {sec('Khách hàng')}
          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--br)', marginBottom: 2 }}>{customer?.salutation && <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--ac)', background: 'var(--acbg)', padding: '1px 5px', borderRadius: 3, marginRight: 5 }}>{customer.salutation}</span>}{customer?.name || order.customerName}{customer?.nickname && <span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--tm)', marginLeft: 6 }}>· {customer.nickname}</span>}</div>
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
              {['Mã kiện / NCC', 'Loại gỗ & Thuộc tính', 'Số tấm', 'Khối lượng', 'Đơn giá', 'Thành tiền'].map(h => <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--brl)', fontWeight: 700, fontSize: '0.6rem', textTransform: 'uppercase', borderBottom: '2px solid var(--bds)', whiteSpace: 'nowrap' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {items.map((it, i) => {
                const w = wts.find(x => x.id === it.woodId);
                const m2 = it.unit === 'm2';
                const priceChanged = it.listPrice != null && it.listPrice > 0
                  && (m2 ? (it.unitPrice !== it.listPrice && it.unitPrice !== it.listPrice2) : it.unitPrice !== it.listPrice);
                const discountPct = priceChanged ? Math.round((1 - it.unitPrice / it.listPrice) * 100) : 0;
                return (
                  <tr key={i} style={{ background: priceChanged ? 'rgba(255,152,0,0.04)' : (i % 2 ? 'var(--bgs)' : '#fff') }}>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--bd)', whiteSpace: 'nowrap' }}>
                      <div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--br)' }}>{it.bundleCode}</div>
                      {it.supplierBundleCode && <div style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: 'var(--tm)' }}>{it.supplierBundleCode}</div>}
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--bd)' }}>
                      <div style={{ fontWeight: 600 }}>{w?.icon} {w?.name}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--tm)' }}>{fmtItemAttrs(it, cfg, ats)}</div>
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--bd)', textAlign: 'right' }}>{it.boardCount}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--bd)', textAlign: 'right' }}>{(it.volume||0).toFixed(m2 ? 2 : 3)} <span style={{ fontSize: '0.65rem', color: 'var(--tm)' }}>{it.unit}</span></td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--bd)', textAlign: 'right' }}>
                      <span style={{ color: priceChanged ? '#E65100' : 'inherit', fontWeight: priceChanged ? 700 : 500 }}>{fmtMoney(it.unitPrice)}</span>
                      {m2 && it.listPrice && <div style={{ fontSize: '0.6rem', color: 'var(--tm)', marginTop: 1 }}>lẻ: {fmtMoney(it.listPrice)}{it.listPrice2 ? ` / NK: ${fmtMoney(it.listPrice2)}` : ''}</div>}
                      {!m2 && priceChanged && (
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
          <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--br)', marginBottom: 8 }}>Dịch vụ</div>
          {services.filter(s => s.amount > 0).map((s, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', padding: '4px 0', borderBottom: '1px solid var(--bd)', alignItems: 'center' }}>
              <span style={{ color: 'var(--ts)' }}>
                {SVC_DEF[s.type]?.icon && <span style={{ marginRight: 5 }}>{SVC_DEF[s.type].icon}</span>}
                {svcLabel(s)}
              </span>
              <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', flexShrink: 0, marginLeft: 10 }}>{fmtMoney(s.amount)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 6, marginTop: 4 }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--brl)', fontWeight: 700, textTransform: 'uppercase', marginRight: 12 }}>Tổng dịch vụ</span>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--br)', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(svcTotal)}</span>
          </div>
        </div>
      )}

      {/* Lịch sử thu tiền */}
      {(paymentRecords.length > 0 || order.paymentStatus === 'Còn nợ') && (
        <div style={{ background: 'var(--bgc)', borderRadius: 8, border: '1px solid var(--bd)', marginBottom: 14, padding: '10px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--br)' }}>💰 Lịch sử thu tiền</div>
            {outstanding > 0 && ce && (
              <button onClick={() => setShowPaymentModal(true)} style={{ padding: '4px 10px', borderRadius: 5, border: '1.5px solid var(--ac)', background: 'var(--acbg)', color: 'var(--ac)', cursor: 'pointer', fontWeight: 700, fontSize: '0.72rem' }}>+ Ghi thu thêm</button>
            )}
          </div>

          {/* Banner gia hàng chờ duyệt */}
          {pendingDiscounts.length > 0 && (
            <div style={{ marginBottom: 8, padding: '8px 12px', borderRadius: 7, background: 'rgba(142,68,173,0.08)', border: '1.5px solid rgba(142,68,173,0.3)', fontSize: '0.76rem' }}>
              <div style={{ fontWeight: 700, color: '#8e44ad', marginBottom: 4 }}>⏳ {pendingDiscounts.length} khoản gia hàng chờ admin duyệt</div>
              {pendingDiscounts.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ flex: 1, color: 'var(--ts)' }}>
                    {new Date(r.paidAt).toLocaleDateString('vi-VN')} · Giảm <strong>{fmtMoney(r.discount)}</strong>
                    {r.discountNote ? ` — ${r.discountNote}` : ''}
                  </span>
                  {ce && <>
                    <button onClick={() => handleApproveDiscount(r.id, true)} style={{ padding: '3px 10px', borderRadius: 5, border: 'none', background: 'var(--gn)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.7rem' }}>✓ Duyệt</button>
                    <button onClick={() => handleApproveDiscount(r.id, false)} style={{ padding: '3px 10px', borderRadius: 5, border: '1px solid var(--dg)', background: 'transparent', color: 'var(--dg)', cursor: 'pointer', fontWeight: 600, fontSize: '0.7rem' }}>✕ Từ chối</button>
                  </>}
                </div>
              ))}
            </div>
          )}

          {paymentRecords.length === 0 ? (
            <div style={{ fontSize: '0.75rem', color: 'var(--tm)', fontStyle: 'italic' }}>Chưa có lần thu nào</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
              <thead><tr style={{ background: 'var(--bgh)' }}>
                {['Ngày thu', 'Phương thức', 'Số tiền thu', 'Gia hàng', 'Ghi chú'].map(h => <th key={h} style={{ padding: '5px 8px', textAlign: 'left', color: 'var(--brl)', fontWeight: 700, fontSize: '0.6rem', textTransform: 'uppercase', borderBottom: '1px solid var(--bds)' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {paymentRecords.map((r, i) => (
                  <tr key={r.id || i} style={{ background: i % 2 ? 'var(--bgs)' : '#fff' }}>
                    <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--bd)', whiteSpace: 'nowrap', color: 'var(--ts)' }}>{new Date(r.paidAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--bd)' }}>
                      <span style={{ padding: '1px 7px', borderRadius: 3, fontSize: '0.68rem', fontWeight: 700, background: r.method === 'Chuyển khoản' ? 'rgba(41,128,185,0.1)' : 'rgba(39,174,96,0.1)', color: r.method === 'Chuyển khoản' ? '#2980b9' : '#27ae60' }}>{r.method}</span>
                    </td>
                    <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--bd)', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--gn)' }}>{fmtMoney(r.amount)}</td>
                    <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--bd)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {r.discount > 0 ? (
                        <div>
                          <span style={{ fontWeight: 700, color: r.discountStatus === 'pending' ? '#8e44ad' : r.discountStatus === 'rejected' ? 'var(--tm)' : 'var(--gn)', textDecoration: r.discountStatus === 'rejected' ? 'line-through' : 'none' }}>{fmtMoney(r.discount)}</span>
                          <div style={{ fontSize: '0.62rem', color: r.discountStatus === 'pending' ? '#8e44ad' : r.discountStatus === 'approved' ? 'var(--gn)' : 'var(--tm)' }}>
                            {r.discountStatus === 'auto' ? '✓ Tự duyệt' : r.discountStatus === 'approved' ? '✓ Đã duyệt' : r.discountStatus === 'pending' ? '⏳ Chờ duyệt' : '✕ Từ chối'}
                          </div>
                        </div>
                      ) : <span style={{ color: 'var(--tm)' }}>—</span>}
                    </td>
                    <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--bd)', color: 'var(--tm)', fontSize: '0.72rem' }}>{r.note || (r.discountNote ? `Gia hàng: ${r.discountNote}` : '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 20, padding: '6px 8px', marginTop: 4, borderTop: '1px solid var(--bds)', fontSize: '0.8rem' }}>
            <div style={{ color: 'var(--ts)' }}>Đã xử lý: <strong style={{ color: 'var(--gn)' }}>{fmtMoney(totalPaid)}</strong></div>
            <div style={{ color: 'var(--ts)' }}>Còn lại: <strong style={{ color: outstanding > 0 ? 'var(--ac)' : 'var(--gn)' }}>{fmtMoney(outstanding)}</strong></div>
          </div>
        </div>
      )}

      {/* Vận chuyển */}
      {order.shippingType === 'Xe của khách' && (
        <div style={{ background: 'var(--bgc)', borderRadius: 8, border: '1px solid var(--bd)', marginBottom: 14, padding: '10px 14px', fontSize: '0.8rem', color: 'var(--ts)' }}>
          <div style={{ fontWeight: 700, color: 'var(--br)', marginBottom: 6 }}>🚛 Khách tự vận chuyển</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
            {order.driverName && <div><span style={{ color: 'var(--tm)' }}>Lái xe: </span>{order.driverName}</div>}
            {order.driverPhone && <div><span style={{ color: 'var(--tm)' }}>SĐT: </span>{order.driverPhone}</div>}
            {order.licensePlate && <div><span style={{ color: 'var(--tm)' }}>Biển số: </span>{order.licensePlate}</div>}
            {order.estimatedArrival && <div><span style={{ color: 'var(--tm)' }}>Dự kiến đến: </span>{new Date(order.estimatedArrival).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</div>}
            {order.deliveryAddress && <div style={{ gridColumn: '1 / -1' }}><span style={{ color: 'var(--tm)' }}>Địa chỉ nhận: </span>{order.deliveryAddress}</div>}
            {order.shippingNotes && <div style={{ gridColumn: '1 / -1' }}><span style={{ color: 'var(--tm)' }}>Ghi chú: </span>{order.shippingNotes}</div>}
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
          {isCancelled ? (
            <div style={{ padding: '10px 0', textAlign: 'center', color: 'var(--tm)', fontSize: '0.78rem', fontWeight: 600 }}>
              🚫 Đơn đã hủy
            </div>
          ) : pendingApproval ? (
            <div style={{ padding: '10px 0', textAlign: 'center', color: '#E65100', fontSize: '0.78rem', fontWeight: 600 }}>
              ⏳ Đang chờ duyệt giá — chưa thể cập nhật trạng thái
            </div>
          ) : (
          <>
          {order.paymentStatus !== 'Đã thanh toán' && ce && (
            <button onClick={() => setShowPaymentModal(true)} style={{ width: '100%', padding: '9px', borderRadius: 7, border: 'none', background: outstanding > 0 ? 'var(--ac)' : 'var(--gn)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', marginBottom: 8 }}>
              {outstanding > 0 ? `💰 Ghi thu tiền (còn ${fmtMoney(outstanding)})` : '✓ Xác nhận Đã thanh toán'}
            </button>
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

function OrderList({ orders, onView, onNew, onContinue, ce, defaultExportFilter = '' }) {
  const [fPayment, setFPayment] = useState('');
  const [fExport, setFExport] = useState(defaultExportFilter);
  const [fSearch, setFSearch] = useState('');
  const [sortField, setSortField] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let arr = [...orders];
    // Mặc định ẩn đơn hủy trừ khi filter chọn "Đã hủy"
    if (fPayment === 'Đã hủy') arr = arr.filter(o => o.paymentStatus === 'Đã hủy');
    else if (fPayment) arr = arr.filter(o => o.paymentStatus === fPayment);
    else arr = arr.filter(o => o.paymentStatus !== 'Đã hủy');
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
          <option>Nháp</option><option>Chờ duyệt</option><option>Chưa thanh toán</option><option>Còn nợ</option><option>Đã thanh toán</option><option>Đã hủy</option>
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
                const cancelled = o.paymentStatus === 'Đã hủy';
                const exported = o.exportStatus === 'Đã xuất';
                const pmtBg = paid ? 'rgba(50,79,39,0.1)' : cancelled ? 'rgba(168,155,142,0.12)' : o.paymentStatus === 'Chờ duyệt' ? 'rgba(255,152,0,0.15)' : o.paymentStatus === 'Còn nợ' ? 'rgba(142,68,173,0.1)' : (o.paymentStatus === 'Nháp' ? 'rgba(168,155,142,0.15)' : 'rgba(242,101,34,0.08)');
                const pmtColor = paid ? 'var(--gn)' : cancelled ? 'var(--tm)' : o.paymentStatus === 'Chờ duyệt' ? '#E65100' : o.paymentStatus === 'Còn nợ' ? '#8e44ad' : (o.paymentStatus === 'Nháp' ? 'var(--tm)' : 'var(--ac)');
                return (
                  <tr key={o.id} onClick={() => o.status === 'Nháp' ? onContinue?.(o.id) : onView(o.id)} style={{ background: i % 2 ? 'var(--bgs)' : '#fff', cursor: 'pointer', opacity: cancelled ? 0.55 : 1 }}>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--bd)', color: 'var(--tm)', fontSize: '0.74rem' }}>{new Date(o.createdAt).toLocaleDateString('vi-VN')}</td>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--bd)', fontFamily: 'monospace', fontWeight: 700, color: cancelled ? 'var(--tm)' : 'var(--br)', textDecoration: cancelled ? 'line-through' : 'none' }}>{o.orderCode}</td>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--bd)', fontWeight: 600 }}>{o.customerName}<div style={{ fontSize: '0.7rem', color: 'var(--tm)' }}>{o.customerPhone}</div></td>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--bd)', color: 'var(--ts)', fontSize: '0.76rem', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.customerAddress}</td>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--bd)' }}><span style={{ padding: '2px 7px', borderRadius: 4, fontSize: '0.68rem', fontWeight: 700, background: pmtBg, color: pmtColor, textDecoration: cancelled ? 'line-through' : 'none' }}>{o.paymentStatus}</span></td>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--bd)' }}><span style={{ padding: '2px 7px', borderRadius: 4, fontSize: '0.68rem', fontWeight: 700, background: exported ? 'rgba(50,79,39,0.1)' : 'rgba(168,155,142,0.1)', color: exported ? 'var(--gn)' : 'var(--tm)' }}>{o.exportStatus}</span></td>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--bd)', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', textDecoration: cancelled ? 'line-through' : 'none', color: cancelled ? 'var(--tm)' : 'inherit' }}>{fmtMoney(o.totalAmount)}</td>
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

export default function PgSales({ wts, ats, cfg, prices, customers, setCustomers, carriers = [], xeSayConfig = DEFAULT_XE_SAY_CONFIG, setXeSayConfig, ce, useAPI, notify, setPg }) {
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

  const handleOrderDeleted = (orderId) => {
    setOrders(prev => prev.filter(o => o.id !== orderId));
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
    <OrderDetail orderId={detailId} wts={wts} ats={ats} cfg={cfg} ce={ce} notify={notify} vatRate={vatRate} carriers={carriers}
      onBack={() => setView('list')}
      onOrderUpdated={handleOrderUpdated}
      onOrderDeleted={handleOrderDeleted}
      onEdit={(order, items, services) => { setEditData({ order, items, services }); setView('edit'); }} />
  );

  if (view === 'create') return (
    <OrderForm customers={customers} wts={wts} ats={ats} cfg={cfg} prices={prices} ce={ce} useAPI={useAPI} notify={notify} vatRate={vatRate} carriers={carriers} xeSayConfig={xeSayConfig} setXeSayConfig={setXeSayConfig}
      onDone={handleOrderDone} onNewCustomer={goNewCustomer} />
  );

  if (view === 'edit' && editData) return (
    <OrderForm initial={{ ...editData.order, id: editData.order.id }} initialItems={editData.items} initialServices={editData.services}
      customers={customers} wts={wts} ats={ats} cfg={cfg} prices={prices} ce={ce} useAPI={useAPI} notify={notify} vatRate={vatRate} carriers={carriers} xeSayConfig={xeSayConfig} setXeSayConfig={setXeSayConfig}
      onDone={handleOrderDone} onNewCustomer={goNewCustomer} />
  );

  return (
    <OrderList orders={orders} ce={ce} onContinue={openEditFromList}
      defaultExportFilter={!ce ? 'Chưa xuất' : ''}
      onView={(id) => { setDetailId(id); setView('detail'); }}
      onNew={() => setView('create')} />
  );
}
