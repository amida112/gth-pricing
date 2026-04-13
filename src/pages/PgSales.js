import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { bpk, resolvePriceAttrs, resolveRangeGroup, isPerBundle, isM2Wood, calcSvcAmount, svcLabel, fmtDate, DEFAULT_XE_SAY_CONFIG } from "../utils";
import useTableSort from '../useTableSort';
import Dialog from '../components/Dialog';
import BoardDetailDialog from '../components/BoardDetailDialog';
import { resolveRawWoodPrice, resolveFormulaPrice } from '../api/rawWoodPricing';

// ── Tiện ích ──────────────────────────────────────────────────────────────────

function fmtMoney(n) { return (n || 0).toLocaleString('vi-VN'); }

// Thứ tự hiển thị cố định cho thuộc tính gỗ
const ATTR_DISPLAY_ORDER = ['thickness', 'quality', 'supplier', 'edging', 'width', 'length'];
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
  const toPay = total - (parseFloat(debt) || 0);
  return { subtotal, taxAmount, total, toPay, itemsTotal, svcTotal, vatRate };
}

// ── Copy QR as image (canvas 2x retina) ───────────────────────────────────────
async function copyQrAsImage(qrUrl, { title, amount, orderCode, bankName, accountNumber, accountName }) {
  const img = new Image(); img.crossOrigin = 'anonymous';
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = qrUrl; });
  const S = 2, W = 360, pad = 24, qrSize = 230;
  const headerH = 30, dividerY = pad + headerH + 6;
  const qrY = dividerY + 8;
  const bankY = qrY + qrSize + 14;
  const bankH = bankName ? 32 : 0;
  const boxY = bankY + bankH + 10, boxH = 58, boxR = 6, boxX = 30, boxW = W - 60;
  const noteY = boxY + boxH + 12;
  const H = noteY + 14 + pad;
  const c = document.createElement('canvas'); c.width = W * S; c.height = H * S;
  const ctx = c.getContext('2d');
  ctx.scale(S, S);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  // Title
  ctx.font = 'bold 15px Inter, Segoe UI, Arial, sans-serif';
  ctx.fillStyle = '#2D2016'; ctx.textAlign = 'center';
  ctx.fillText(title || 'QR Thanh toán', W / 2, pad + 16);
  // Divider
  ctx.strokeStyle = '#F26522'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(30, dividerY); ctx.lineTo(W - 30, dividerY); ctx.stroke();
  // QR
  ctx.drawImage(img, (W - qrSize) / 2, qrY, qrSize, qrSize);
  // Bank info (nhỏ, muted)
  if (bankName) {
    ctx.font = 'bold 13px Inter, Segoe UI, Arial, sans-serif';
    ctx.fillStyle = '#2D2016'; ctx.textAlign = 'center';
    ctx.fillText(bankName, W / 2, bankY + 12);
    if (accountNumber) {
      ctx.font = '11px Inter, Segoe UI, Arial, sans-serif'; ctx.fillStyle = '#888';
      ctx.fillText(`STK: ${accountNumber}` + (accountName ? ` · ${accountName}` : ''), W / 2, bankY + 26);
    }
  }
  // Info box (rounded rect, nền xám)
  ctx.fillStyle = '#faf8f5';
  ctx.beginPath();
  ctx.moveTo(boxX + boxR, boxY); ctx.lineTo(boxX + boxW - boxR, boxY); ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + boxR);
  ctx.lineTo(boxX + boxW, boxY + boxH - boxR); ctx.quadraticCurveTo(boxX + boxW, boxY + boxH, boxX + boxW - boxR, boxY + boxH);
  ctx.lineTo(boxX + boxR, boxY + boxH); ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - boxR);
  ctx.lineTo(boxX, boxY + boxR); ctx.quadraticCurveTo(boxX, boxY, boxX + boxR, boxY);
  ctx.fill();
  ctx.strokeStyle = '#e0d8cc'; ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(boxX + boxR, boxY); ctx.lineTo(boxX + boxW - boxR, boxY); ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + boxR);
  ctx.lineTo(boxX + boxW, boxY + boxH - boxR); ctx.quadraticCurveTo(boxX + boxW, boxY + boxH, boxX + boxW - boxR, boxY + boxH);
  ctx.lineTo(boxX + boxR, boxY + boxH); ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - boxR);
  ctx.lineTo(boxX, boxY + boxR); ctx.quadraticCurveTo(boxX, boxY, boxX + boxR, boxY);
  ctx.stroke();
  // Row 1: Số tiền
  let ry = boxY + 22;
  ctx.font = '11px Inter, Segoe UI, Arial, sans-serif'; ctx.fillStyle = '#a89b8e'; ctx.textAlign = 'left';
  ctx.fillText('Số tiền', boxX + 14, ry);
  ctx.font = 'bold 14px Inter, Segoe UI, Arial, sans-serif'; ctx.fillStyle = '#F26522'; ctx.textAlign = 'right';
  ctx.fillText(amount + 'đ', boxX + boxW - 14, ry);
  // Row 2: Nội dung CK
  ry += 24;
  ctx.font = '11px Inter, Segoe UI, Arial, sans-serif'; ctx.fillStyle = '#a89b8e'; ctx.textAlign = 'left';
  ctx.fillText('Nội dung CK', boxX + 14, ry);
  ctx.font = 'bold 13px Consolas, monospace'; ctx.fillStyle = '#2D2016'; ctx.textAlign = 'right';
  ctx.fillText(orderCode, boxX + boxW - 14, ry);
  // Note
  ctx.font = '10px Inter, Segoe UI, Arial, sans-serif'; ctx.fillStyle = '#7C5CBF'; ctx.textAlign = 'center';
  ctx.fillText('Không sửa nội dung để phần mềm tự đối soát chính xác', W / 2, noteY);
  try {
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
  } catch { return false; }
}

// ── In đơn hàng ───────────────────────────────────────────────────────────────

function buildOrderHtml({ order, customer, items, services, wts, ats, cfg, vatRate = 0.08, hideSupplierName = true, hidePrice = false, hideNotes = false, layout = 2, measurements = [] }) {
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
  // Mô tả hàng hóa cho trang in: chỉ giá trị SKU_KEY (attrs cấu hình trong PgCFG), thứ tự cố định
  const descValues = (it) => {
    const attrs = it.attributes || {};
    const configured = cfg?.[it.woodId]?.attrs || [];
    return ATTR_DISPLAY_ORDER
      .filter(k => configured.includes(k) && attrs[k] != null && attrs[k] !== '' && (!hideSupplierName ? true : !isSupplierAttr(k)))
      .map(k => attrs[k])
      .join(', ');
  };
  const bundleCell = (it) => {
    const t = it.itemType || 'bundle';
    if (t === 'raw_wood' || t === 'raw_wood_weight') return `<div style="font-weight:700">${it.rawWoodData?.pieceCode || it.rawWoodData?.containerCode || '—'}</div><div style="font-size:9px;color:#888">${t === 'raw_wood_weight' ? 'Cân' : 'NL'}</div>`;
    if (t === 'container') return `<div style="font-weight:700">${it.rawWoodData?.containerCode || '—'}</div><div style="font-size:9px;color:#888">Nguyên cont</div>`;
    return it.supplierBundleCode ? `<div style="font-weight:700">${it.supplierBundleCode}</div><div style="font-size:9px;color:#888">${it.bundleCode||''}</div>` : `<div style="font-weight:700">${it.bundleCode||''}</div>`;
  };
  const itemName = (it) => {
    const t = it.itemType || 'bundle';
    if (t === 'raw_wood') return it.rawWoodData?.woodTypeName || 'Gỗ NL';
    if (t === 'raw_wood_weight') return it.rawWoodData?.woodTypeName || 'Gỗ NL';
    if (t === 'container') return it.rawWoodData?.woodTypeName || 'Nguyên container';
    return wood(it.woodId)?.name || it.woodId;
  };
  const itemDesc = (it) => {
    const t = it.itemType || 'bundle';
    if (t === 'raw_wood') {
      const d = it.rawWoodData || {};
      const sizeStr = d.circumferenceCm ? `V${d.circumferenceCm}cm` : d.diameterCm ? `Ø${d.diameterCm}cm` : '';
      return [sizeStr, d.widthCm ? `${d.widthCm}×${d.thicknessCm||''}cm` : '', d.lengthM ? `${d.lengthM}m` : '', d.quality || ''].filter(Boolean).join(' · ');
    }
    if (t === 'raw_wood_weight') { const wkg = it.rawWoodData?.weightKg || 0; return `${it.rawWoodData?.pieceCount || it.boardCount || 0} cây · ${wkg >= 1000 ? (wkg / 1000).toFixed(3) + ' tấn' : wkg + 'kg'}`; }
    if (t === 'container') return '';
    return descValues(it);
  };

  const { taxAmount, toPay: _toPay, itemsTotal, svcTotal, total: grandTotal } = calcTotals(items, services, order.shippingFee, order.applyTax, order.deposit, order.debt, vatRate);
  // Trang in: "Còn phải thanh toán" = total - max(deposit, paidAmount) - debt
  const _dep = parseFloat(order.deposit) || 0;
  const _paid = parseFloat(order.paidAmount) || 0;
  const totalDeduct = _paid > 0 ? Math.max(_dep, _paid) : 0; // chỉ trừ khi đã nhận tiền
  const printToPay = grandTotal - totalDeduct - (parseFloat(order.debt) || 0);
  const hasDeductions = totalDeduct > 0 || order.debt > 0;
  const payLabel = hasDeductions ? 'Còn phải thanh toán' : 'Tổng thanh toán';
  const totalBoards = items.reduce((s, it) => s + (parseInt(it.boardCount) || 0), 0);
  const totalVolume = items.reduce((s, it) => s + (parseFloat(it.volume) || 0), 0).toFixed(4);
  const unitLabel = (u) => u === 'ton' ? 'Tấn' : u === 'm3' ? 'm³' : u === 'm2' ? 'm²' : u;
  const svcs = services.filter(s => s.amount > 0);

  const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  const payBg = order.paymentStatus === 'Đã thanh toán' ? '#e8f5e9' : order.paymentStatus === 'Đã đặt cọc' ? '#e3f2fd' : '#fff3e0';
  const payColor = order.paymentStatus === 'Đã thanh toán' ? '#27ae60' : order.paymentStatus === 'Đã đặt cọc' ? '#2980b9' : '#e67e22';
  const expBg = order.exportStatus === 'Đã xuất' ? '#e8f5e9' : '#f5f5f5';
  const expColor = order.exportStatus === 'Đã xuất' ? '#27ae60' : '#888';
  const statusBadges = `<span style="padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;white-space:nowrap;background:${payBg};color:${payColor}">${order.paymentStatus}</span>
      <span style="padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;white-space:nowrap;background:${expBg};color:${expColor}">${order.exportStatus}</span>`;

  const payRows = (tdSt = '') => {
    const t1 = tdSt ? `style="${tdSt}"` : '';
    const t2 = tdSt ? `style="text-align:right;${tdSt}"` : 'style="text-align:right"';
    const dep = parseFloat(order.deposit) || 0;
    const paid = parseFloat(order.paidAmount) || 0;
    let rows = '';
    if (order.applyTax) rows += `<tr><td ${t1}>Thuế VAT (${Math.round(vatRate*100)}%)</td><td ${t2}>${fmtMoney(taxAmount)}</td></tr>`;
    if (dep > 0 && paid >= dep) {
      // Có cọc và đã nhận đủ cọc
      rows += `<tr><td ${t1}>Đã đặt cọc</td><td ${t2}><strong>− ${fmtMoney(dep)}</strong></td></tr>`;
      if (paid > dep) rows += `<tr><td ${t1}>Đã thanh toán thêm</td><td ${t2}><strong>− ${fmtMoney(paid - dep)}</strong></td></tr>`;
    } else if (dep === 0 && paid > 0) {
      // Không cọc, thanh toán trực tiếp
      rows += `<tr><td ${t1}>Đã thanh toán</td><td ${t2}><strong>− ${fmtMoney(paid)}</strong></td></tr>`;
    }
    if (order.debt > 0) rows += `<tr><td ${t1}>Công nợ</td><td ${t2}>− ${fmtMoney(order.debt)}</td></tr>`;
    return rows;
  };

  const bangChu = `<div style="padding:8px 12px;background:#fff8f0;border:1px solid #f0c080;border-radius:4px;margin-bottom:12px"><span style="font-size:10px;color:#888">Bằng chữ: </span><em>${soThanhChu(Math.max(0, printToPay))}</em></div>`;

  const salesLabel = order.salesByLabel || order.salesBy || '';
  const customerInfo = () => {
    const isCompany = customer?.customerType === 'company';
    const sal = !isCompany && customer?.salutation ? customer.salutation + ' ' : '';
    const name = customer?.name || order.customerName || '';
    const nickname = customer?.nickname?.trim() || (() => {
      const addr = customer?.address || order.customerAddress || '';
      return addr.includes(',') ? addr.split(',').map(p => p.trim()).filter(Boolean).pop() : addr;
    })();
    const phone = (customer?.phone1 || order.customerPhone || '').replace(/\D/g, '');
    const phoneSuffix = phone.length >= 3 ? phone.slice(-3) : phone;
    const custCode = customer?.customerCode || '';
    const contactPhoneSuffix = (order.contactPhone || '').replace(/\D/g, '').slice(-3);
    const contactParts = [order.contactName, contactPhoneSuffix].filter(Boolean).join(' · ');
    const nameLine = isCompany ? `Công ty ${name}` : `${sal}${name}`;
    const parts = [nameLine, nickname, ...(isCompany ? [] : [phoneSuffix])].filter(Boolean);
    return `<div style="display:flex;justify-content:space-between;align-items:flex-start"><div><div style="font-weight:700;font-size:13px">${parts.join(' · ')}</div>
    ${contactParts ? `<div style="font-size:11px;color:#555;margin-top:2px">${isCompany ? 'Đại diện mua hàng' : 'Người mua'}: ${contactParts}</div>` : ''}
    ${!isCompany && customer?.companyName ? `<div style="font-size:11px;color:#666;margin-top:2px">${customer.companyName}</div>` : ''}</div>${salesLabel ? `<div style="text-align:right"><div style="font-weight:700;font-size:13px">${salesLabel}</div></div>` : ''}</div>`;
  };
  const customerLabel = (labelStyle) => `<div style="display:flex;justify-content:space-between;align-items:center;${labelStyle}"><span>Khách hàng</span>${salesLabel ? '<span>Nhân viên bán hàng</span>' : ''}</div>`;

  const driverSummary = `${order.licensePlate ? `<div style="font-size:10px;color:#555;margin-top:4px">Biển số: <strong>${order.licensePlate}</strong></div>` : ''}
<div style="font-size:10px;color:#555">${items.length} mục · ${totalVolume} m³</div>`;

  const signCol = `display:flex;flex-direction:column;align-items:center;text-align:center`;
  const signLine = `border-top:1px solid #ccc;padding-top:4px;font-size:11px;color:#555;width:100%`;
  const signTitle = `font-size:11px;font-weight:700;color:#333`;

  const sharedFooter = (notes) => `${notes ? `<div style="padding:8px 12px;background:#f9f9f9;border:1px solid #ddd;border-radius:4px;font-size:11px;margin-bottom:14px"><strong>Ghi chú:</strong> ${notes}</div>` : ''}
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:20px;page-break-inside:avoid;min-height:80px">
  <div style="${signCol}"><div style="${signTitle}">Người kiểm hàng</div><div style="flex:1;min-height:36px"></div><div style="${signLine}">(Ký, ghi rõ họ tên)</div></div>
  <div style="${signCol}"><div style="${signTitle}">Lái xe nhận hàng</div>${driverSummary}<div style="flex:1;min-height:36px"></div><div style="${signLine}">(Ký, ghi rõ họ tên)</div></div>
  <div style="${signCol}"><div style="${signTitle}">Khách hàng</div><div style="flex:1;min-height:36px"></div><div style="${signLine}">(Ký xác nhận)</div></div>
</div>
<div style="margin-top:18px;padding:10px 16px;background:#FFF5EE;border:2px solid #F26522;border-radius:8px;text-align:center;page-break-inside:avoid">
  <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:14px;font-weight:700;color:#F26522;letter-spacing:0.06em;text-transform:uppercase">KHO GỖ NHẬP KHẨU ÂU – MỸ – PHI</div>
  <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:700;color:#5A3E2B;margin-top:4px">ÓC CHÓ &bull; SỒI &bull; TẦN BÌ &bull; BEECH &bull; GỖ &bull; TEAK &bull; THÔNG &hellip;</div>
  <div style="font-size:10px;color:#888;margin-top:4px">KCN Quốc Oai, Hà Nội &nbsp;|&nbsp; DT419, Đại lộ Thăng Long &nbsp;|&nbsp; <strong style="color:#F26522">Hotline: 0924 35 88 99</strong></div>
</div>
<div style="margin-top:8px;font-size:9px;color:#bbb;text-align:center">In lúc ${new Date().toLocaleString('vi-VN')}</div>`;

  const th = `background:#f5f0e8;padding:5px 8px;text-align:center;font-size:10px;text-transform:uppercase;border:1px solid #ddd`;
  const td = `padding:5px 8px;border:1px solid #ddd;vertical-align:top`;
  const prodRows = items.map((it,i) => `<tr${i%2?' style="background:#fafafa"':''}>
<td style="${td};text-align:center;white-space:nowrap;vertical-align:middle">${i+1}</td>
<td style="${td};font-family:Consolas,monospace">${bundleCell(it)}</td>
<td style="${td}"><strong>${itemName(it)}</strong>${itemDesc(it)?`<div style="font-size:10px;color:#666;margin-top:2px">${itemDesc(it)}</div>`:''}${it.notes?`<div style="font-size:10px;color:#aaa">${it.notes}</div>`:''}</td>
<td style="${td};text-align:center;white-space:nowrap">${it.boardCount}</td>
<td style="${td};text-align:right;white-space:nowrap">${(it.volume||0).toFixed(4)}</td>
<td style="${td};text-align:center;white-space:nowrap">${unitLabel(it.unit)}</td>
${hidePrice ? '' : `<td style="${td};text-align:right;white-space:nowrap">${fmtMoney(it.unitPrice)}</td>
<td style="${td};text-align:right;white-space:nowrap"><strong>${fmtMoney(it.amount)}</strong></td>`}</tr>`).join('');
  const cols = hidePrice ? 6 : 8;

  const svcRows = svcs.length ? `<tr><td colspan="${cols}" style="${td};background:#f0f0f0;font-size:10px;font-weight:700;text-transform:uppercase;color:#666;padding:4px 8px">Dịch vụ</td></tr>${svcs.map((s,i)=>`<tr${i%2?' style="background:#fafafa"':''}><td colspan="${hidePrice ? 6 : 7}" style="${td}">${svcLabel(s)}</td>${hidePrice ? '' : `<td style="${td};text-align:right;white-space:nowrap"><strong>${fmtMoney(s.amount)}</strong></td>`}</tr>`).join('')}` : '';

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title></title>
<style>@page{margin:0}body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#222;margin:0;padding:14mm 13mm}.pay-row td{font-weight:800;background:#fff3e0}@media print{.no-print{display:none}}</style></head><body>
${hidePrice ? `<div style="text-align:center;margin-bottom:10px;padding:7px 0;background:#f5f5f5;border:1px solid #ddd;border-radius:4px;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.08em">Phiếu giao hàng</div>` : ''}
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
    <div style="font-size:9px;color:#F26522;font-weight:700;text-transform:uppercase;letter-spacing:0.1em">${hidePrice ? 'Phiếu giao hàng' : 'Đơn hàng'}</div>
    <div style="font-family:Consolas,monospace;font-size:17px;font-weight:800;color:#2D2016;white-space:nowrap">${order.orderCode}</div>
    ${orderDate?`<div style="font-size:11px;color:#555;font-weight:600;margin-top:2px">${orderDate}</div>`:''}
    ${hidePrice ? '' : `<div style="margin-top:6px;display:flex;align-items:center;justify-content:flex-end;gap:4px">${statusBadges}</div>`}
  </div>
</div>
<div style="padding:7px 12px;border:1px solid #ddd;border-radius:4px;margin-bottom:10px">${customerLabel('font-size:9px;font-weight:700;text-transform:uppercase;color:#888;margin-bottom:4px;letter-spacing:0.05em')}${customerInfo()}</div>
<h2 style="font-size:12px;font-weight:600;margin:10px 0 4px;color:#444">Sản phẩm</h2>
<table style="width:100%;border-collapse:collapse;margin-bottom:10px"><thead><tr>
<th style="${th};width:1%">#</th><th style="${th}">Mã kiện</th><th style="${th}">Mô tả hàng hóa</th>
<th style="${th};white-space:nowrap">Tấm</th><th style="${th};white-space:nowrap">KL<br><span style="font-size:9px">(m³)</span></th>
<th style="${th};white-space:nowrap">ĐVT</th>${hidePrice ? '' : `<th style="${th};white-space:nowrap">Đơn giá<br><span style="font-size:9px">(vnđ)</span></th>
<th style="${th};white-space:nowrap">Thành tiền<br><span style="font-size:9px">(vnđ)</span></th>`}
</tr></thead><tbody>
${prodRows}
<tr style="background:#fdf6ec;font-weight:700"><td colspan="3" style="${td};text-align:right">Tổng cộng</td>
<td style="${td};text-align:center;white-space:nowrap">${totalBoards}</td><td style="${td};text-align:right;white-space:nowrap">${totalVolume}</td>
<td style="${td}"></td>${hidePrice ? '' : `<td style="${td}"></td><td style="${td};text-align:right;white-space:nowrap">${fmtMoney(itemsTotal)}</td>`}</tr>
${svcRows}
</tbody></table>
${hidePrice ? '' : `<h2 style="font-size:12px;font-weight:600;margin:10px 0 4px;color:#444">Thanh toán</h2>
<div style="display:flex;justify-content:flex-end;margin-bottom:12px">
  <div style="min-width:260px">
    <table style="width:100%;border-collapse:collapse;margin-bottom:6px"><tbody>
    ${payRows(`${td};font-size:12px`)}
    <tr class="pay-row"><td style="${td};font-size:14px">${payLabel}</td><td style="${td};text-align:right;font-size:14px">${fmtMoney(printToPay)}</td></tr>
    </tbody></table>
    ${bangChu}
  </div>
</div>`}
${sharedFooter(hideNotes ? '' : order.notes)}
</body></html>`;

  // Trang chi tiết kiện lẻ (nếu có measurements)
  if (measurements.length > 0) {
    html += `<div style="page-break-before:always"></div>`;
    html += `<div style="font-family:'Segoe UI',Arial,sans-serif;font-size:11px;color:#222;padding:0">`;
    html += `<div style="text-align:center;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #27ae60">
      <div style="font-size:14px;font-weight:800;color:#27ae60;text-transform:uppercase;letter-spacing:0.08em">Chi tiết kiện lẻ</div>
      <div style="font-size:11px;color:#666;margin-top:4px">Đơn hàng: <strong>${order.orderCode}</strong></div>
    </div>`;
    measurements.forEach(m => {
      const boards = m.boards || [];
      // Group by length → columns of 10
      const groups = {};
      boards.forEach(b => {
        if (!groups[b.l]) groups[b.l] = [];
        groups[b.l].push(b.w);
      });
      const lengths = Object.keys(groups).sort((a, b) => a - b);
      lengths.forEach(l => groups[l].sort((a, b) => a - b));
      const columns = [];
      lengths.forEach(l => {
        const arr = groups[l];
        for (let i = 0; i < arr.length; i += 10) {
          columns.push({ length: l, values: arr.slice(i, i + 10) });
        }
      });
      const maxRows = columns.length > 0 ? Math.max(...columns.map(c => c.values.length)) : 0;

      html += `<div style="margin-bottom:16px;page-break-inside:avoid">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:#f0faf0;border:1px solid #c8e6c9;border-radius:6px 6px 0 0">
          <div><strong style="font-size:12px;color:#1C1209">${m.bundle_code}</strong>
            <span style="font-size:10px;color:#666;margin-left:8px">${m.wood_type || ''} · ${m.thickness || ''}F · ${m.quality || ''}</span></div>
          <div style="font-size:10px;color:#555"><strong>${m.board_count}</strong> tấm · <strong>${(m.volume || 0).toFixed(4)}</strong> m³</div>
        </div>`;

      if (columns.length > 0) {
        html += `<table style="width:100%;border-collapse:collapse;border:1px solid #ddd;border-top:none">`;
        // Header row — lengths
        html += `<tr><th style="background:#f5f0e8;padding:3px 4px;border:1px solid #ddd;font-size:9px;color:#7A3A10;font-weight:700">Dài</th>`;
        columns.forEach(c => { html += `<th style="background:#FEF0E8;padding:3px 4px;border:1px solid #ddd;font-size:10px;color:#C24E10;font-weight:700">${c.length}</th>`; });
        html += `</tr>`;
        // Width rows
        for (let r = 0; r < maxRows; r++) {
          html += `<tr>`;
          if (r === 0) html += `<th rowspan="${maxRows}" style="background:#f5f0e8;padding:3px 4px;border:1px solid #ddd;font-size:9px;color:#7A3A10;font-weight:700;vertical-align:middle">Rộng</th>`;
          columns.forEach(c => {
            html += `<td style="padding:2px 4px;border:1px solid #ddd;text-align:center;font-size:10px;${r%2?'background:#fafaf6':''}">${c.values[r] != null ? c.values[r] : ''}</td>`;
          });
          html += `</tr>`;
        }
        // Total row
        html += `<tr>`;
        html += `<th style="background:#FEF0E8;padding:3px 4px;border:1px solid #ddd;font-size:9px;font-weight:700;color:#C24E10">Tổng</th>`;
        columns.forEach(c => {
          const sumW = c.values.reduce((s, w) => s + Number(w || 0), 0);
          const total = c.length * sumW * (m.thickness || 0);
          html += `<th style="background:#FEF0E8;padding:3px 4px;border:1px solid #ddd;font-size:8px;font-weight:700;color:#C24E10">${sumW ? total.toFixed(0) : ''}</th>`;
        });
        html += `</tr></table>`;
      }
      html += `</div>`;
    });
    html += `<div style="font-size:9px;color:#bbb;text-align:center;margin-top:12px">In lúc ${new Date().toLocaleString('vi-VN')}</div>`;
    html += `</div>`;
  }

  return html;
}

function printOrder(params) {
  const { previewOnly, ...rest } = params;
  const html = buildOrderHtml(rest);
  const w = window.open('', '_blank');
  if (!w) { alert('Trình duyệt đang chặn popup. Vui lòng cho phép popup cho trang này rồi thử lại.'); return; }
  w.document.write(html);
  w.document.close();
  if (!previewOnly) setTimeout(() => w.print(), 500);
}

async function copyOrderAsImage(htmlString, notify) {
  // Pre-convert logo thành data URI (SVG foreignObject không load external img)
  let logoDataUri = '';
  try {
    const resp = await fetch(`${window.location.origin}/logo-gth.png`);
    const blob = await resp.blob();
    logoDataUri = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
  } catch (_) { /* logo không load được → bỏ qua */ }

  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:0;top:0;width:794px;background:#fff;z-index:-9999;opacity:0;pointer-events:none';

  // Lấy nội dung body, loại bỏ trang chi tiết kiện lẻ (page-break trở đi)
  const bodyMatch = htmlString.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  let bodyHtml = bodyMatch ? bodyMatch[1] : htmlString;
  // Cắt tại page-break (trang measurements)
  const pbIdx = bodyHtml.indexOf('page-break-before:always');
  if (pbIdx > -1) {
    const divIdx = bodyHtml.lastIndexOf('<div', pbIdx);
    if (divIdx > -1) bodyHtml = bodyHtml.substring(0, divIdx);
  }
  // Thay logo src bằng data URI
  if (logoDataUri) bodyHtml = bodyHtml.replace(/src="[^"]*logo-gth\.png"/, `src="${logoDataUri}"`);
  // Inline .pay-row td styles (SVG foreignObject không hỗ trợ <style> tag)
  bodyHtml = bodyHtml.replace(/class="pay-row"/g, '').replace(
    /(<tr[^>]*>)\s*(<td\s+style=")/g,
    (m, tr, tdStart) => tr.includes('pay-row') ? `${tr}${tdStart}` : m
  );
  // Đơn giản hơn: thêm inline style cho các td trong pay-row
  bodyHtml = bodyHtml.replace(
    /<tr class="pay-row">/g,
    '<tr>'
  ).replace(
    /class="pay-row"/g, ''
  );

  const content = document.createElement('div');
  // Dùng px thay mm (14mm≈53px, 13mm≈49px) — SVG foreignObject không hỗ trợ mm
  content.style.cssText = "font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#222;padding:53px 49px";
  content.innerHTML = bodyHtml;

  // Inline .pay-row styles: tìm tr cuối trong bảng thanh toán (font-weight:800, background:#fff3e0)
  const payRows = content.querySelectorAll('tr');
  payRows.forEach(tr => {
    const tds = tr.querySelectorAll('td');
    // Detect pay-row: row có "Còn phải thanh toán" hoặc "Tổng thanh toán"
    const text = tr.textContent || '';
    if (text.includes('Còn phải thanh toán') || text.includes('Tổng thanh toán')) {
      tds.forEach(td => { td.style.fontWeight = '800'; td.style.background = '#fff3e0'; });
    }
  });

  container.appendChild(content);
  document.body.appendChild(container);
  // Hiện container tạm để browser layout chính xác
  container.style.opacity = '1';
  try {
    // Chờ ảnh load xong
    const imgs = container.querySelectorAll('img');
    await Promise.all([...imgs].map(img => img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })));
    const { toBlob } = await import('html-to-image');
    const blob = await toBlob(container, { pixelRatio: 3, backgroundColor: '#fff' });
    if (!blob) throw new Error('toBlob returned null');
    await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
    if (notify) notify('Đã copy ảnh đơn hàng vào clipboard!', true);
    return true;
  } catch (e) {
    console.error('copyOrderAsImage failed:', e);
    if (notify) notify('Không thể copy ảnh. Vui lòng thử lại.', false);
    return false;
  } finally {
    document.body.removeChild(container);
  }
}

// ── PrintModal ────────────────────────────────────────────────────────────────

function PrintModal({ onPrint, onClose, onPreview, onCopyImage }) {
  const [hideSupplierName, setHideSupplierName] = React.useState(true);
  const [hidePrice, setHidePrice] = React.useState(false);
  const [showNotes, setShowNotes] = React.useState(false);
  const [copying, setCopying] = React.useState(false);
  const [copyResult, setCopyResult] = React.useState(null);

  const opts = { layout: 2, hideSupplierName, hidePrice, hideNotes: !showNotes };

  const handleCopy = async () => {
    setCopying(true); setCopyResult(null);
    const ok = await onCopyImage(opts);
    setCopying(false);
    setCopyResult(ok ? 'ok' : 'fail');
    if (ok) setTimeout(() => setCopyResult(null), 2000);
  };

  return (
    <Dialog open={true} onClose={onClose} title="In đơn hàng" width={400} zIndex={2000} noEnter>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', borderRadius: 7, border: '1px solid var(--bd)', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--ts)' }}>
            <input type="checkbox" checked={!hideSupplierName} onChange={e => setHideSupplierName(!e.target.checked)} style={{ accentColor: 'var(--ac)' }} />
            Hiện tên nhà cung cấp trong thuộc tính
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', borderRadius: 7, border: `1px solid ${hidePrice ? 'var(--ac)' : 'var(--bd)'}`, background: hidePrice ? 'var(--acbg)' : 'transparent', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--ts)' }}>
            <input type="checkbox" checked={hidePrice} onChange={e => setHidePrice(e.target.checked)} style={{ accentColor: 'var(--ac)' }} />
            Ẩn giá (phiếu giao hàng cho lái xe)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', borderRadius: 7, border: `1px solid ${showNotes ? 'var(--ac)' : 'var(--bd)'}`, background: showNotes ? 'var(--acbg)' : 'transparent', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--ts)' }}>
            <input type="checkbox" checked={showNotes} onChange={e => setShowNotes(e.target.checked)} style={{ accentColor: 'var(--ac)' }} />
            Hiện ghi chú trên trang in
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          <button onClick={() => { onPreview(opts); }} style={{ padding: '8px 18px', borderRadius: 7, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>Xem trước</button>
          {onCopyImage && <button onClick={handleCopy} disabled={copying} style={{ padding: '8px 18px', borderRadius: 7, border: '1.5px solid var(--bd)', background: copyResult === 'ok' ? '#e8f5e9' : 'transparent', color: copyResult === 'ok' ? '#27ae60' : 'var(--ts)', cursor: copying ? 'wait' : 'pointer', fontWeight: 600, fontSize: '0.8rem', transition: 'all 0.2s' }}>
            {copying ? 'Đang chụp...' : copyResult === 'ok' ? '✓ Đã copy!' : '📋 Copy ảnh'}
          </button>}
          <button onClick={() => { onPrint(opts); onClose(); }} style={{ padding: '8px 22px', borderRadius: 7, border: 'none', background: 'var(--ac)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>In / PDF</button>
        </div>
    </Dialog>
  );
}

// ── RecordPaymentModal ─────────────────────────────────────────────────────────

const DISCOUNT_AUTO_LIMIT = 200000; // < 200k: tự duyệt; >= 200k: cần admin duyệt

function RecordPaymentModal({ toPay, deposit = 0, paymentRecords, onConfirm, onClose, saving }) {
  const submitRef = React.useRef(null);
  const calcOutstandingLocal = (records) => records.reduce((rem, r) => {
    const dc = r.discountStatus === 'auto' || r.discountStatus === 'approved';
    return rem - (r.amount || 0) - (dc ? (r.discount || 0) : 0);
  }, toPay);

  const outstanding = Math.max(0, calcOutstandingLocal(paymentRecords || []));

  const totalPaid = (paymentRecords || []).reduce((s, r) => {
    const dc = r.discountStatus === 'auto' || r.discountStatus === 'approved';
    return s + (r.amount || 0) + (dc ? (r.discount || 0) : 0);
  }, 0);

  // Deposit chưa nhận: phần cọc cam kết nhưng chưa có trong payment_records
  const dep = parseFloat(deposit) || 0;
  const unreceivedDeposit = dep > 0 ? Math.max(0, dep - totalPaid) : 0;
  const depositReceived = dep > 0 && totalPaid >= dep;
  // Gợi ý thu = outstanding trừ phần cọc chưa nhận (vì cọc sẽ nhận riêng)
  const suggestedAmount = Math.max(0, outstanding - unreceivedDeposit);

  const [amount, setAmount] = React.useState(suggestedAmount);
  const [method, setMethod] = React.useState('Chuyển khoản');
  const [note, setNote] = React.useState('');
  const [discount, setDiscount] = React.useState(0);
  const [discountNote, setDiscountNote] = React.useState('');
  const [showDiscount, setShowDiscount] = React.useState(false);

  const discountAmt = parseFloat(discount) || 0;
  // Tổng gia hàng tích lũy: đã có + lần này → check ngưỡng duyệt
  const existingDiscount = (paymentRecords || []).reduce((s, r) => s + (r.discountStatus !== 'rejected' ? (r.discount || 0) : 0), 0);
  const totalDiscount = existingDiscount + discountAmt;
  const needsApproval = totalDiscount >= DISCOUNT_AUTO_LIMIT;
  const newOutstanding = Math.max(0, outstanding - (parseFloat(amount) || 0) - (needsApproval ? 0 : discountAmt));
  // Nếu discount chờ duyệt, outstanding chưa tính discount → chưa "đủ"
  const willFullyPay = newOutstanding <= 0 && ((parseFloat(amount) || 0) > 0 || discountAmt > 0);
  const pendingDiscountCase = needsApproval && discountAmt > 0; // có giảm giá cần duyệt

  return (
    <Dialog open={true} onClose={onClose} onOk={() => submitRef.current?.()} title="Ghi nhận thanh toán" width={480} zIndex={2000}>
        {/* Tóm tắt số tiền */}
        <div style={{ background: 'var(--bgs)', border: '1px solid var(--bd)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.8rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: 'var(--ts)' }}>Tổng cần thanh toán</span>
            <span style={{ fontWeight: 700 }}>{fmtMoney(toPay)}</span>
          </div>
          {dep > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ color: 'var(--ts)' }}>Đặt cọc {depositReceived ? <span style={{ color: 'var(--gn)', fontSize: '0.72rem' }}>✓ Đã nhận</span> : <span style={{ color: '#2980b9', fontSize: '0.72rem' }}>⏳ Chưa nhận</span>}</span>
              <span style={{ fontWeight: 600, color: depositReceived ? 'var(--gn)' : '#2980b9' }}>− {fmtMoney(dep)}</span>
            </div>
          )}
          {((paymentRecords || []).length > 0 || dep > 0) && <div style={{ borderTop: '1px dashed var(--bd)', margin: '6px 0' }} />}
          {(paymentRecords || []).length > 0 && <>
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
                {discountAmt > 0 && (<>
                  {existingDiscount > 0 && <div style={{ fontSize: '0.68rem', color: 'var(--tm)', marginBottom: 4 }}>Đã gia hàng trước: {fmtMoney(existingDiscount)} · Tổng tích lũy: <strong>{fmtMoney(totalDiscount)}</strong></div>}
                  {needsApproval ? (
                    <div style={{ fontSize: '0.72rem', color: '#8e44ad', fontWeight: 600 }}>
                      ⚠ Tổng gia hàng ≥ 200.000đ — cần admin duyệt.
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.72rem', color: 'var(--gn)', fontWeight: 600 }}>
                      ✓ Tự động duyệt (tổng &lt; 200.000đ)
                    </div>
                  )}
                </>)}
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

        {(submitRef.current = (((parseFloat(amount) > 0) || discountAmt > 0) && !saving && outstanding > 0) ? () => onConfirm({ amount: parseFloat(amount)||0, method, note, discount: discountAmt, discountNote }) : null) && null}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 7, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>Hủy</button>
          {outstanding > 0 && (
            <button onClick={() => onConfirm({ amount: parseFloat(amount)||0, method, note, discount: discountAmt, discountNote })}
              disabled={!((parseFloat(amount) > 0) || discountAmt > 0) || saving}
              style={{ padding: '8px 20px', borderRadius: 7, border: 'none', background: !((parseFloat(amount)>0)||discountAmt>0)||saving ? 'var(--bd)' : willFullyPay ? 'var(--gn)' : 'var(--ac)', color: !((parseFloat(amount)>0)||discountAmt>0)||saving ? 'var(--tm)' : '#fff', cursor: !((parseFloat(amount)>0)||discountAmt>0)||saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>
              {saving ? 'Đang lưu...' : willFullyPay ? '✓ Thu & Hoàn tất' : pendingDiscountCase ? '+ Ghi thu (gia hàng chờ duyệt)' : discountAmt > 0 && !(parseFloat(amount) > 0) ? '+ Gia hàng' : '+ Ghi thu tiền'}
            </button>
          )}
        </div>
    </Dialog>
  );
}

// ── BundleSelector ────────────────────────────────────────────────────────────

const BS_PAGE_SIZE = 15;

const STATUS_COLOR = { 'Kiện nguyên': '#16a34a', 'Chưa được bán': '#7c3aed', 'Kiện lẻ': '#ea580c' };

function BundleSelector({ wts, ats, prices, cfg, bundles: bundlesProp = [], onConfirm, onClose, existingBundleIds = [], inline = false }) {
  const [sel, setSel] = useState(new Set());
  const existingSet = useMemo(() => new Set(existingBundleIds), [existingBundleIds]);
  const [fWood, setFWood] = useState('');
  const [fSearch, setFSearch] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fThickness, setFThickness] = useState('');
  const [fQuality, setFQuality] = useState('');
  const [fWidth, setFWidth] = useState('');
  const [fLength, setFLength] = useState('');
  const [fEdging, setFEdging] = useState('');
  const [page, setPage] = useState(1);
  const loading = false; // Shared Pool: bundles từ App.js realtime, không cần loading

  useEffect(() => { setPage(1); }, [fWood, fSearch, fStatus, fThickness, fQuality, fWidth, fLength, fEdging]);

  const isFilteredPerBundle = !!(fWood && isPerBundle(fWood, wts));
  const showSupplierCol = !!(fWood && cfg[fWood]?.attrs?.includes('supplier'));
  const showWidthCol = isFilteredPerBundle || !!(fWood && cfg[fWood]?.attrs?.includes('width'));
  const showEdgingCol = !!(fWood && cfg[fWood]?.attrs?.includes('edging'));
  const hasFilters = !!(fSearch || fStatus || fThickness || fQuality || fWidth || fLength || fEdging);

  const resetAttrFilters = () => { setFThickness(''); setFQuality(''); setFWidth(''); setFLength(''); setFEdging(''); };

  const filtered = useMemo(() => {
    // Shared Pool: chỉ hiện kiện available (Kiện nguyên / Kiện lẻ)
    let arr = bundlesProp.filter(b => b.status === 'Kiện nguyên' || b.status === 'Kiện lẻ');
    if (fWood) arr = arr.filter(b => b.woodId === fWood);
    if (fStatus) arr = arr.filter(b => b.status === fStatus);
    if (fThickness) arr = arr.filter(b => b.attributes?.thickness === fThickness);
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
    if (fEdging) arr = arr.filter(b => b.attributes?.edging === fEdging);
    if (fSearch) { const s = fSearch.toLowerCase(); arr = arr.filter(b => b.bundleCode.toLowerCase().includes(s) || (b.supplierBundleCode || '').toLowerCase().includes(s) || Object.values(b.attributes||{}).some(v => String(v).toLowerCase().includes(s))); }
    arr = [...arr].sort((a, b) => {
      const dt = parseFloat(a.attributes?.thickness) - parseFloat(b.attributes?.thickness);
      if (dt !== 0) return dt;
      const dw = parseFloat(a.attributes?.width) - parseFloat(b.attributes?.width);
      if (dw !== 0) return dw;
      return parseFloat(a.attributes?.length) - parseFloat(b.attributes?.length);
    });
    return arr;
  }, [bundlesProp, fWood, fSearch, fStatus, fThickness, fQuality, fWidth, fLength, fEdging]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / BS_PAGE_SIZE));
  const pagedFiltered = filtered.slice((page - 1) * BS_PAGE_SIZE, page * BS_PAGE_SIZE);

  const toggle = (id) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleConfirmRef = useRef(null);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey && handleConfirmRef.current) handleConfirmRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleConfirm = () => {
    const selected = bundlesProp.filter(b => sel.has(b.id)).map(b => {
      const m2 = isM2Wood(b.woodId, wts);
      const unit = m2 ? 'm2' : 'm3';
      let unitPrice, listPrice, listPrice2;
      if (isPerBundle(b.woodId, wts)) {
        unitPrice = b.unitPrice != null ? Math.round(b.unitPrice * 1000000) : null;
        listPrice = unitPrice;
      } else if (m2) {
        const _lookupAttrs = { ...b.attributes, ...(b.priceAttrsOverride || {}) };
        const priceObj = prices[bpk(b.woodId, resolvePriceAttrs(b.woodId, _lookupAttrs, cfg))] || {};
        const leKien = priceObj.price != null ? Math.round(priceObj.price * 1000) : null;      // k/m²
        const nguyenKien = priceObj.price2 != null ? Math.round(priceObj.price2 * 1000) : null; // k/m²
        // Nguyên kiện (không thay đổi số tấm) → giá rẻ hơn (price2)
        const isWhole = b.remainingBoards >= b.boardCount;
        unitPrice = isWhole ? (nguyenKien ?? leKien) : (leKien ?? nguyenKien);
        listPrice = leKien;    // listPrice = giá lẻ (cao hơn, dùng cảnh báo)
        listPrice2 = nguyenKien; // listPrice2 = giá nguyên kiện
      } else {
        const _lookupAttrs2 = { ...b.attributes, ...(b.priceAttrsOverride || {}) };
        const priceObj = prices[bpk(b.woodId, resolvePriceAttrs(b.woodId, _lookupAttrs2, cfg))] || {};
        const basePrice = priceObj.price;
        const basePriceMil = basePrice != null ? Math.round(basePrice * 1000000) : null; // giá bảng chuẩn
        if (basePrice != null && b.priceAdjustment) {
          const adj = b.priceAdjustment;
          const effPrice = adj.type === 'percent'
            ? basePrice * (1 + adj.value / 100)
            : basePrice + adj.value;
          unitPrice = Math.round(effPrice * 1000000);
          listPrice = unitPrice; // Giá đã điều chỉnh trong kho → dùng làm giá chuẩn, không cảnh báo
        } else {
          unitPrice = basePriceMil;
          listPrice = basePriceMil;
        }
      }
      let vol = parseFloat((b.remainingVolume || 0).toFixed(4));
      // Bán nguyên kiện + có supplier_boards → dùng số tấm NCC cho packing list khách hàng
      const isWholeSale = b.remainingBoards >= b.boardCount;
      const displayBoards = (isWholeSale && b.supplierBoards != null) ? b.supplierBoards : b.remainingBoards;
      // Gỗ thông NK: tự tính volume = tấm × dày × rộng × dài / 10⁹
      if (b.woodId === 'pine') {
        const t = parseFloat(b.attributes?.thickness) || 0;
        const w = parseFloat(b.attributes?.width) || 0;
        const l = parseFloat(b.attributes?.length) || 0;
        if (t && w && l) vol = parseFloat((displayBoards * t * w * l / 1e9).toFixed(4));
      }
      return { bundleId: b.id, bundleCode: b.bundleCode, supplierBundleCode: b.supplierBundleCode || '', woodId: b.woodId, skuKey: b.skuKey, attributes: { ...b.attributes }, rawMeasurements: b.rawMeasurements || {}, boardCount: displayBoards, volume: vol, unit, unitPrice, listPrice, listPrice2, amount: unitPrice ? Math.round(unitPrice * vol) : 0, notes: '', priceAdjustment: b.priceAdjustment || null };
    });
    onConfirm(selected);
  };
  handleConfirmRef.current = sel.size > 0 ? handleConfirm : null;

  const ths = { padding: '6px 8px', background: 'var(--bgh)', color: 'var(--brl)', fontWeight: 700, fontSize: '0.6rem', textTransform: 'uppercase', borderBottom: '2px solid var(--bds)', whiteSpace: 'nowrap' };
  const tds = { padding: '6px 8px', borderBottom: '1px solid var(--bd)', fontSize: '0.76rem', whiteSpace: 'nowrap' };

  const content = (
    <>
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
        {/* Row 3: Clear filter button (only when filters active) */}
        {hasFilters && (
          <div style={{ padding: '4px 18px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center' }}>
            <button onClick={() => { setFSearch(''); setFStatus(''); setFEdging(''); resetAttrFilters(); setPage(1); }}
              style={{ padding: '3px 10px', borderRadius: 6, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
              ✕ Xóa lọc
            </button>
          </div>
        )}
        {/* Table */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? <div style={{ padding: 30, textAlign: 'center', color: 'var(--tm)' }}>Đang tải...</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                {/* Filter row */}
                {(() => {
                  const fltS = { fontSize: '0.76rem', padding: '4px 8px', width: '100%', borderRadius: 4, border: '1px solid var(--bd)', background: 'var(--bgc)', outline: 'none' };
                  const fltTd = { padding: '5px 6px' };
                  const thicknessVals = fWood ? (cfg[fWood]?.attrValues?.thickness || []) : [];
                  const qualityVals = fWood ? (cfg[fWood]?.attrValues?.quality || []) : [];
                  const widthVals = fWood ? (cfg[fWood]?.attrValues?.width || []) : [];
                  const lengthVals = fWood ? (cfg[fWood]?.attrValues?.length || []) : [];
                  const edgingVals = fWood ? (cfg[fWood]?.attrValues?.edging || []) : [];
                  if (isFilteredPerBundle) return (
                    <tr style={{ background: 'var(--bgs)' }}>
                      <td style={fltTd}></td>
                      <td style={fltTd}></td>{/* STT */}
                      {/* Mã kiện */}
                      <td style={fltTd}><input value={fSearch} onChange={e => { setFSearch(e.target.value); setPage(1); }} placeholder="Tìm mã..." autoFocus style={{ ...fltS }} /></td>
                      {/* Chất lượng */}
                      <td style={fltTd}>{qualityVals.length > 0 ? <select value={fQuality} onChange={e => { setFQuality(e.target.value); setPage(1); }} style={{ ...fltS, color: fQuality ? 'var(--ac)' : 'var(--tp)', fontWeight: fQuality ? 700 : 400 }}><option value="">Tất cả</option>{qualityVals.map(v => <option key={v} value={v}>{v}</option>)}</select> : null}</td>
                      {/* Dày */}
                      <td style={fltTd}>{thicknessVals.length > 0 ? <select value={fThickness} onChange={e => { setFThickness(e.target.value); setPage(1); }} style={{ ...fltS, color: fThickness ? 'var(--ac)' : 'var(--tp)', fontWeight: fThickness ? 700 : 400 }}><option value="">Tất cả</option>{thicknessVals.map(v => <option key={v} value={v}>{v}</option>)}</select> : null}</td>
                      {/* Rộng */}
                      {showWidthCol && <td style={fltTd}>{widthVals.length > 0 ? <select value={fWidth} onChange={e => { setFWidth(e.target.value); setPage(1); }} style={{ ...fltS, color: fWidth ? 'var(--ac)' : 'var(--tp)', fontWeight: fWidth ? 700 : 400 }}><option value="">Tất cả</option>{widthVals.map(v => <option key={v} value={v}>{v}</option>)}</select> : null}</td>}
                      {/* Dài */}
                      <td style={fltTd}>{lengthVals.length > 0 ? <select value={fLength} onChange={e => { setFLength(e.target.value); setPage(1); }} style={{ ...fltS, color: fLength ? 'var(--ac)' : 'var(--tp)', fontWeight: fLength ? 700 : 400 }}><option value="">Tất cả</option>{lengthVals.map(v => <option key={v} value={v}>{v}</option>)}</select> : null}</td>
                      {/* Dong cạnh */}
                      {showEdgingCol && <td style={fltTd}>{edgingVals.length > 0 ? <select value={fEdging} onChange={e => { setFEdging(e.target.value); setPage(1); }} style={{ ...fltS, color: fEdging ? 'var(--ac)' : 'var(--tp)', fontWeight: fEdging ? 700 : 400 }}><option value="">Tất cả</option>{edgingVals.map(v => <option key={v} value={v}>{v}</option>)}</select> : null}</td>}
                      <td style={fltTd}></td>{/* Giá */}
                      <td style={fltTd}></td>{/* Tấm còn */}
                      <td style={fltTd}></td>{/* KL còn */}
                      {/* Trạng thái */}
                      <td style={fltTd}><select value={fStatus} onChange={e => { setFStatus(e.target.value); setPage(1); }} style={{ ...fltS, color: fStatus ? 'var(--ac)' : 'var(--tp)', fontWeight: fStatus ? 700 : 400 }}><option value="">Tất cả</option>{['Kiện nguyên', 'Kiện lẻ'].map(s => <option key={s} value={s}>{s}</option>)}</select></td>
                      <td style={fltTd}></td>{/* Vị trí */}
                      <td style={fltTd}></td>{/* Ghi chú */}
                    </tr>
                  );
                  return (
                    <tr style={{ background: 'var(--bgs)' }}>
                      <td style={fltTd}></td>
                      <td style={fltTd}></td>{/* STT */}
                      {/* Mã kiện */}
                      <td style={fltTd}><input value={fSearch} onChange={e => { setFSearch(e.target.value); setPage(1); }} placeholder="Tìm mã..." autoFocus style={{ ...fltS }} /></td>
                      <td style={fltTd}></td>{/* Loại gỗ — filtered by WoodPicker above */}
                      {/* Dày */}
                      <td style={fltTd}>{thicknessVals.length > 0 ? <select value={fThickness} onChange={e => { setFThickness(e.target.value); setPage(1); }} style={{ ...fltS, color: fThickness ? 'var(--ac)' : 'var(--tp)', fontWeight: fThickness ? 700 : 400 }}><option value="">Tất cả</option>{thicknessVals.map(v => <option key={v} value={v}>{v}</option>)}</select> : null}</td>
                      {/* Rộng */}
                      {showWidthCol && <td style={fltTd}>{widthVals.length > 0 ? <select value={fWidth} onChange={e => { setFWidth(e.target.value); setPage(1); }} style={{ ...fltS, color: fWidth ? 'var(--ac)' : 'var(--tp)', fontWeight: fWidth ? 700 : 400 }}><option value="">Tất cả</option>{widthVals.map(v => <option key={v} value={v}>{v}</option>)}</select> : null}</td>}
                      {/* Dài */}
                      <td style={fltTd}>{lengthVals.length > 0 ? <select value={fLength} onChange={e => { setFLength(e.target.value); setPage(1); }} style={{ ...fltS, color: fLength ? 'var(--ac)' : 'var(--tp)', fontWeight: fLength ? 700 : 400 }}><option value="">Tất cả</option>{lengthVals.map(v => <option key={v} value={v}>{v}</option>)}</select> : null}</td>
                      {/* Dong cạnh */}
                      {showEdgingCol && <td style={fltTd}>{edgingVals.length > 0 ? <select value={fEdging} onChange={e => { setFEdging(e.target.value); setPage(1); }} style={{ ...fltS, color: fEdging ? 'var(--ac)' : 'var(--tp)', fontWeight: fEdging ? 700 : 400 }}><option value="">Tất cả</option>{edgingVals.map(v => <option key={v} value={v}>{v}</option>)}</select> : null}</td>}
                      {/* Chất lượng */}
                      <td style={fltTd}>{qualityVals.length > 0 ? <select value={fQuality} onChange={e => { setFQuality(e.target.value); setPage(1); }} style={{ ...fltS, color: fQuality ? 'var(--ac)' : 'var(--tp)', fontWeight: fQuality ? 700 : 400 }}><option value="">Tất cả</option>{qualityVals.map(v => <option key={v} value={v}>{v}</option>)}</select> : null}</td>
                      {showSupplierCol && <td style={fltTd}></td>}{/* Nhà cung cấp */}
                      <td style={fltTd}></td>{/* Tấm còn */}
                      <td style={fltTd}></td>{/* Khối lượng */}
                      <td style={fltTd}></td>{/* Giá */}
                      {/* Trạng thái */}
                      <td style={fltTd}><select value={fStatus} onChange={e => { setFStatus(e.target.value); setPage(1); }} style={{ ...fltS, color: fStatus ? 'var(--ac)' : 'var(--tp)', fontWeight: fStatus ? 700 : 400 }}><option value="">Tất cả</option>{['Kiện nguyên', 'Kiện lẻ'].map(s => <option key={s} value={s}>{s}</option>)}</select></td>
                      <td style={fltTd}></td>{/* Vị trí */}
                      <td style={fltTd}></td>{/* Ghi chú */}
                    </tr>
                  );
                })()}
                {/* Header row */}
                <tr>
                <th style={ths}></th>
                <th style={{ ...ths, textAlign: 'center' }}>#</th>
                {isFilteredPerBundle
                  ? ['Mã kiện', 'Chất lượng', 'Dày', ...(showWidthCol ? ['Rộng'] : []), 'Dài', ...(showEdgingCol ? ['Dong cạnh'] : []), 'Giá (tr/m³)', 'Tấm còn', 'KL còn (m³)', 'Trạng thái', 'Vị trí', 'Ghi chú'].map(h => <th key={h} style={ths}>{h}</th>)
                  : ['Mã kiện', 'Loại gỗ', 'Dày', ...(showWidthCol ? ['Rộng'] : []), 'Dài', ...(showEdgingCol ? ['Dong cạnh'] : []), 'Chất lượng', ...(showSupplierCol ? ['Nhà cung cấp'] : []), 'Tấm còn', 'KL còn', 'Giá', 'Trạng thái', 'Vị trí', 'Ghi chú'].map(h => <th key={h} style={ths}>{h}</th>)
                }
              </tr></thead>
              <tbody>
                {pagedFiltered.length === 0 ? <tr><td colSpan={20} style={{ padding: 20, textAlign: 'center', color: 'var(--tm)' }}>Không có kiện nào phù hợp</td></tr>
                  : pagedFiltered.map((b, i) => {
                    const w = wts.find(x => x.id === b.woodId);
                    const perBundleWood = isPerBundle(b.woodId, wts);
                    const m2Wood = isM2Wood(b.woodId, wts);
                    const priceObj = (!perBundleWood && !m2Wood) ? prices[bpk(b.woodId, resolvePriceAttrs(b.woodId, b.attributes, cfg))] : null;
                    const displayPrice = perBundleWood ? b.unitPrice : priceObj?.price;
                    const inOrder = existingSet.has(b.id);
                    const checked = inOrder || sel.has(b.id);
                    const statusColor = STATUS_COLOR[b.status] || 'var(--tm)';
                    if (isFilteredPerBundle) {
                      return (
                        <tr data-clickable="true" key={b.id} onClick={() => !inOrder && toggle(b.id)} style={{ background: inOrder ? 'rgba(142,68,173,0.06)' : checked ? 'rgba(242,101,34,0.07)' : (i % 2 ? 'var(--bgs)' : '#fff'), cursor: inOrder ? 'default' : 'pointer', opacity: inOrder ? 0.6 : 1 }}>
                          <td style={{ ...tds, textAlign: 'center' }}><input type="checkbox" readOnly checked={checked} disabled={inOrder} />{inOrder && <div style={{ fontSize: '0.5rem', color: '#8E44AD' }}>Đã chọn</div>}</td>
                          <td style={{ ...tds, textAlign: 'center', color: 'var(--tm)', fontSize: '0.68rem' }}>{(page - 1) * BS_PAGE_SIZE + i + 1}</td>
                          <td style={tds}>
                            <div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--br)' }}>{b.supplierBundleCode || b.bundleCode}</div>
                            {b.supplierBundleCode && <div style={{ fontFamily: 'monospace', fontSize: '0.63rem', color: 'var(--tm)', marginTop: 1 }}>{b.bundleCode}</div>}
                          </td>
                          <td style={{ ...tds, textAlign: 'center' }}>{b.attributes?.quality || '—'}</td>
                          <td style={{ ...tds, textAlign: 'right' }}>{b.attributes?.thickness || '—'}</td>
                          {showWidthCol && <td style={{ ...tds, textAlign: 'right' }}>
                            {b.attributes?.width ? (b.rawMeasurements?.width ? <div><div style={{ fontWeight: 700 }}>{b.rawMeasurements.width}mm</div><div style={{ fontSize: '0.63rem', color: 'var(--tm)' }}>{b.attributes.width}</div></div> : b.attributes.width) : '—'}
                          </td>}
                          <td style={{ ...tds, textAlign: 'right' }}>
                            {b.attributes?.length ? (b.rawMeasurements?.length ? <div><div style={{ fontWeight: 700 }}>{b.rawMeasurements.length}m</div><div style={{ fontSize: '0.63rem', color: 'var(--tm)' }}>{b.attributes.length}</div></div> : b.attributes.length) : '—'}
                          </td>
                          {showEdgingCol && <td style={tds}>{b.attributes?.edging || '—'}</td>}
                          <td style={{ ...tds, textAlign: 'right', fontWeight: 700, color: displayPrice ? 'var(--br)' : 'var(--tm)' }}>{displayPrice ? displayPrice.toFixed(1) : '—'}</td>
                          <td style={{ ...tds, textAlign: 'center' }}><div>{b.remainingBoards}</div>{b.remainingBoards < b.boardCount && <div style={{ fontSize: '0.63rem', color: 'var(--tm)' }}>/{b.boardCount}</div>}</td>
                          <td style={{ ...tds, textAlign: 'center', fontWeight: 700 }}><div>{(b.remainingVolume || 0).toFixed(4)}</div>{b.remainingBoards < b.boardCount && <div style={{ fontSize: '0.63rem', color: 'var(--tm)', fontWeight: 400 }}>/{(b.volume || 0).toFixed(4)}</div>}</td>
                          <td style={{ ...tds, color: statusColor, fontWeight: 600 }}>{b.status || '—'}</td>
                          <td style={tds}>{b.location || '—'}</td>
                          <td style={{ ...tds, width: '100%', color: 'var(--ts)', fontSize: '0.72rem' }}>{b.notes || '—'}</td>
                        </tr>
                      );
                    }
                    return (
                      <tr data-clickable="true" key={b.id} onClick={() => !inOrder && toggle(b.id)} style={{ background: inOrder ? 'rgba(142,68,173,0.06)' : checked ? 'rgba(242,101,34,0.07)' : (i % 2 ? 'var(--bgs)' : '#fff'), cursor: inOrder ? 'default' : 'pointer', opacity: inOrder ? 0.6 : 1 }}>
                        <td style={{ ...tds, textAlign: 'center' }}><input type="checkbox" readOnly checked={checked} disabled={inOrder} />{inOrder && <div style={{ fontSize: '0.5rem', color: '#8E44AD' }}>Đã chọn</div>}</td>
                        <td style={{ ...tds, textAlign: 'center', color: 'var(--tm)', fontSize: '0.68rem' }}>{(page - 1) * BS_PAGE_SIZE + i + 1}</td>
                        <td style={tds}>
                          <div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--br)' }}>
                            {b.supplierBundleCode || b.bundleCode}
                            {b.priceAttrsOverride && <span title={'Tra giá theo: ' + Object.entries(b.priceAttrsOverride).map(([k,v]) => `${k}=${v}`).join(', ') + (b.priceOverrideReason ? ' — ' + b.priceOverrideReason : '')} style={{ marginLeft: 4, padding: "1px 4px", borderRadius: 3, fontSize: "0.52rem", fontWeight: 800, background: "rgba(124,92,191,0.15)", color: "#7C5CBF", verticalAlign: "middle" }}>SKU≠</span>}
                          </div>
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
                        {showEdgingCol && <td style={tds}>{b.attributes?.edging || '—'}</td>}
                        <td style={{ ...tds, textAlign: 'center' }}>{b.attributes?.quality || '—'}</td>
                        {showSupplierCol && <td style={tds}>{b.attributes?.supplier || '—'}</td>}
                        <td style={{ ...tds, textAlign: 'center' }}><div>{b.remainingBoards}</div>{b.remainingBoards < b.boardCount && <div style={{ fontSize: '0.63rem', color: 'var(--tm)' }}>/{b.boardCount}</div>}</td>
                        <td style={{ ...tds, textAlign: 'center', fontWeight: 700 }}><div>{(b.remainingVolume || 0).toFixed(m2Wood ? 2 : 4)} {m2Wood ? 'm²' : 'm³'}</div>{b.remainingBoards < b.boardCount && <div style={{ fontSize: '0.63rem', color: 'var(--tm)', fontWeight: 400 }}>/{(b.volume || 0).toFixed(m2Wood ? 2 : 4)}</div>}</td>
                        <td style={{ ...tds, textAlign: 'right', color: 'var(--br)', fontWeight: 600 }}>
                          {m2Wood ? (() => {
                            const _la = { ...b.attributes, ...(b.priceAttrsOverride || {}) };
                            const po = prices[bpk(b.woodId, resolvePriceAttrs(b.woodId, _la, cfg))];
                            if (!po?.price) return <span style={{ color: 'var(--tm)' }}>—</span>;
                            return <>{po.price.toFixed(0)}{po.price2 != null && <span style={{ color: 'var(--tm)' }}>/{po.price2.toFixed(0)}</span>} <span style={{ fontSize: '0.6rem', color: 'var(--tm)' }}>k/m²</span></>;
                          })() : (() => {
                            const _la = { ...b.attributes, ...(b.priceAttrsOverride || {}) };
                            const po = prices[bpk(b.woodId, resolvePriceAttrs(b.woodId, _la, cfg))];
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
            {!inline && <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: 7, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem' }}>Hủy</button>}
            <button onClick={handleConfirm} disabled={sel.size === 0} style={{ padding: '7px 18px', borderRadius: 7, border: 'none', background: sel.size ? 'var(--ac)' : 'var(--bd)', color: sel.size ? '#fff' : 'var(--tm)', cursor: sel.size ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: '0.78rem' }}>Thêm {sel.size > 0 ? sel.size + ' kiện' : ''} →</button>
          </div>
        </div>
    </>
  );

  if (inline) return content;
  return <Dialog open={true} onClose={onClose} title="Chọn kiện gỗ" width={1160} zIndex={1100} noEnter maxHeight="92vh">{content}</Dialog>;
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
        c.companyName || '',
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
          ? <span style={{ fontWeight: 600 }}>{selected.customerType === 'company' ? 'Công ty ' : selected.salutation ? selected.salutation + ' ' : ''}{selected.name}{selected.nickname ? <span style={{ fontWeight: 400, color: 'var(--tm)', marginLeft: 6 }}>· {selected.nickname}</span> : ''}</span>
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
              placeholder="Tìm tên, SĐT, công ty..."
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
                    {c.customerType === 'company' ? <span style={{ fontSize: '0.68rem', color: '#2980b9', marginRight: 4 }}>Công ty</span> : c.salutation ? <span style={{ fontSize: '0.68rem', color: 'var(--ac)', marginRight: 4 }}>{c.salutation}</span> : ''}
                    {c.name}
                    {c.nickname && <span style={{ fontWeight: 400, color: 'var(--tm)', marginLeft: 6, fontSize: '0.74rem' }}>· {c.nickname}</span>}
                  </div>
                  {(c.phone1 || (c.customerType !== 'company' && c.companyName)) && <div style={{ fontSize: '0.7rem', color: 'var(--tm)', marginTop: 1 }}>{c.phone1}{c.phone2 ? ' · ' + c.phone2 : ''}{c.customerType !== 'company' && c.companyName ? (c.phone1 ? ' · ' : '') + c.companyName : ''}</div>}
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
            <span title={selectedCarrier ? selectedCarrier.name : '-- Đơn vị --'} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: selectedCarrier ? 'var(--tp)' : 'var(--tm)' }}>
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
        {['fixed', 'perM3'].map(m => {
          const active = (s.otherMode || 'fixed') === m;
          return <button key={m} onClick={() => upd({ otherMode: m })}
            style={{ padding: '3px 8px', borderRadius: 4, border: active ? '1.5px solid var(--ac)' : '1px solid var(--bd)', background: active ? 'var(--acbg)' : 'transparent', color: active ? 'var(--ac)' : 'var(--tm)', cursor: 'pointer', fontWeight: active ? 700 : 400, fontSize: '0.66rem', whiteSpace: 'nowrap', flexShrink: 0 }}>{m === 'fixed' ? 'Gói' : '×m³'}</button>;
        })}
        <input value={s.description || ''} onChange={e => upd({ description: e.target.value })}
          placeholder="Mô tả dịch vụ…" style={{ ...inp, flex: 1, minWidth: 120 }} />
        {(s.otherMode || 'fixed') === 'fixed' ? (
          <NumInput value={s.amount || 0} onChange={v => upd({ amount: v })} style={{ ...inp, width: 110, textAlign: 'right' }} />
        ) : (<>
          <NumInput value={s.volume ?? 0} onChange={v => upd({ volume: v })} style={{ ...inp, width: 60, textAlign: 'right' }} placeholder="m³" />
          <span style={{ fontSize: '0.68rem', color: 'var(--tm)' }}>×</span>
          <NumInput value={s.unitPrice ?? 0} onChange={v => upd({ unitPrice: v })} style={{ ...inp, width: 100, textAlign: 'right' }} placeholder="Đơn giá" />
        </>)}
        {amtDisplay}
      </>}

      <button onClick={() => onRemove(idx)} title="Xóa"
        style={{ width: 24, height: 24, borderRadius: 4, border: '1px solid var(--dg)', background: 'transparent', color: 'var(--dg)', cursor: 'pointer', flexShrink: 0, fontSize: '0.7rem', lineHeight: 1 }}>✕</button>
    </div>
  );
}

// ===== RawWoodSelector — chọn gỗ nguyên liệu bán lẻ =====
// Flow: Chọn loại gỗ → chọn cách bán (PL/Cân) → chọn container → chọn cây/nhập kg
function RawWoodSelectorDlg({ onConfirm, onClose, existingItems = [], inline = false }) {
  // Data
  const [pieces, setPieces] = useState([]);        // inspection available (for PL mode)
  const [weightConts, setWeightConts] = useState([]); // containers with remaining (for weight mode)
  const [pricingRules, setPricingRules] = useState([]);
  const [priceConfigs, setPriceConfigs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Step state
  const [selWoodTypeId, setSelWoodTypeId] = useState(null); // selected raw_wood_type
  const [saleMode, setSaleMode] = useState(null);           // 'pl' | 'weight'
  const [selContainerId, setSelContainerId] = useState(null);
  const [showPricing, setShowPricing] = useState(false);    // toggle bảng giá

  // PL mode state
  const [fQuality, setFQuality] = useState('');
  const [search, setSearch] = useState('');
  const [sel, setSel] = useState(new Set());
  const [piecePrice, setPiecePrice] = useState({});
  const [defaultPrice, setDefaultPrice] = useState('');
  // Existing items tracking
  const existingInspIds = useMemo(() => new Set(existingItems.filter(i => i.inspectionItemId).map(i => i.inspectionItemId)), [existingItems]);
  const existingContIds = useMemo(() => new Set(existingItems.filter(i => i.containerId || i.rawWoodData?.containerId).map(i => i.containerId || i.rawWoodData?.containerId)), [existingItems]);

  // Weight mode state
  const [wPieces, setWPieces] = useState('');
  const [wKg, setWKg] = useState('');
  const [wUnit, setWUnit] = useState('ton');
  const [wPrice, setWPrice] = useState('');

  useEffect(() => {
    (async () => {
      const api = await import('../api.js');
      const [p, rules, wc, cfgs] = await Promise.all([api.fetchAvailableRawWood(), api.fetchRawWoodPricing(), api.fetchContainersForWeightSale(), api.fetchRawWoodPriceConfigs()]);
      setPieces(p);
      setPricingRules(rules);
      setPriceConfigs(cfgs);
      setWeightConts(wc);
      setLoading(false);
    })();
  }, []);

  // Build wood type inventory from data
  const woodTypes = useMemo(() => {
    const map = {};
    // From inspection pieces (PL mode)
    pieces.forEach(p => {
      const id = p.rawWoodTypeId || `_cont_${p.containerId}`; // fallback key nếu container thiếu raw_wood_type_id
      if (!map[id]) map[id] = { id, name: '', icon: '', cargoType: '', plCount: 0, plConts: new Set(), weightConts: [] };
      map[id].plCount++;
      map[id].plConts.add(p.containerId);
      if (p.cargoType) map[id].cargoType = p.cargoType;
      if (!map[id].name && p.cargoType) map[id].name = p.cargoType === 'raw_round' ? 'Gỗ tròn (chưa phân loại)' : 'Gỗ hộp (chưa phân loại)';
    });
    // From weight containers
    weightConts.filter(c => c.remainingVolume > 0).forEach(c => {
      const id = c.rawWoodTypeId || `_cont_${c.id}`;
      if (!map[id]) map[id] = { id, name: '', icon: '', cargoType: '', plCount: 0, plConts: new Set(), weightConts: [] };
      if (c.cargo_type) map[id].cargoType = c.cargo_type;
      map[id].name = c.rawWoodTypeName || map[id].name;
      map[id].icon = c.rawWoodTypeIcon || map[id].icon;
      // Only add to weight if NOT already covered by PL for same container
      if (!map[id].plConts.has(c.id)) map[id].weightConts.push(c);
    });
    // Fill names from pieces
    pieces.forEach(p => { if (p.rawWoodTypeId && map[p.rawWoodTypeId]) { map[p.rawWoodTypeId].name = map[p.rawWoodTypeId].name || (p.cargoType === 'raw_round' ? 'Gỗ tròn' : 'Gỗ hộp'); } });
    return Object.values(map).filter(w => w.plCount > 0 || w.weightConts.length > 0);
  }, [pieces, weightConts]);

  // Auto-select mode when picking wood type
  const selectWoodType = (wt) => {
    setSelWoodTypeId(wt.id);
    setSelContainerId(null); setSel(new Set()); setPiecePrice({}); setWPieces(''); setWKg(''); setWPrice('');
    if (wt.plCount > 0 && wt.weightConts.length === 0) setSaleMode('pl');
    else if (wt.plCount === 0 && wt.weightConts.length > 0) setSaleMode('weight');
    else setSaleMode(null); // Both available — user picks
  };

  const selWt = woodTypes.find(w => w.id === selWoodTypeId);

  // Filtered pieces for PL mode
  const filtered = useMemo(() => {
    if (saleMode !== 'pl' || !selWoodTypeId) return [];
    let list = pieces.filter(p => p.rawWoodTypeId === selWoodTypeId);
    if (selContainerId) list = list.filter(p => String(p.containerId) === String(selContainerId));
    if (fQuality) list = list.filter(p => p.quality === fQuality);
    if (search) { const q = search.toLowerCase(); list = list.filter(p => (p.pieceCode || '').toLowerCase().includes(q)); }
    return list;
  }, [pieces, selWoodTypeId, selContainerId, fQuality, search, saleMode]);

  const plContainers = useMemo(() => {
    if (!selWoodTypeId) return [];
    const ids = [...new Set(pieces.filter(p => p.rawWoodTypeId === selWoodTypeId).map(p => p.containerId))];
    return ids.map(id => { const p = pieces.find(x => x.containerId === id); return { id, code: p?.containerCode || String(id), count: pieces.filter(x => x.containerId === id && x.rawWoodTypeId === selWoodTypeId).length }; });
  }, [pieces, selWoodTypeId]);

  const qualities = useMemo(() => [...new Set(filtered.map(p => p.quality).filter(Boolean))], [filtered]);
  const toggle = (id) => setSel(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleAll = () => { if (sel.size === filtered.length) setSel(new Set()); else setSel(new Set(filtered.map(p => p.id))); };

  const getPrice = (p) => {
    if (piecePrice[p.id] != null) return piecePrice[p.id];
    if (p.saleUnitPrice != null) return p.saleUnitPrice;
    const resolved = resolveRawWoodPrice({ ...p, rawWoodTypeId: p.rawWoodTypeId }, pricingRules, priceConfigs);
    if (resolved.price > 0) return resolved.price;
    return defaultPrice !== '' ? parseFloat(defaultPrice) || 0 : 0;
  };
  const getVol = (p) => p.weightUnit === 'ton' ? ((p.weightKg || 0) / 1000) : (p.volumeM3 || 0);
  const getUnit = (p) => p.weightUnit === 'ton' ? 'ton' : 'm3';
  const getUnitLabel = (p) => p.weightUnit === 'ton' ? 'tấn' : 'm³';

  const selPieces = filtered.filter(p => sel.has(p.id));
  const totalVol = selPieces.reduce((s, p) => s + getVol(p), 0);
  const totalAmount = selPieces.reduce((s, p) => s + getPrice(p) * getVol(p), 0);

  const handleConfirm = () => {
    onConfirm(selPieces.map(p => ({
      itemType: 'raw_wood', inspectionItemId: p.id,
      bundleId: null, bundleCode: p.pieceCode || '', supplierBundleCode: '',
      woodId: null, skuKey: '', attributes: {}, rawMeasurements: {},
      boardCount: 1, volume: parseFloat(getVol(p).toFixed(4)), unit: getUnit(p),
      unitPrice: Math.round(getPrice(p) * 1000000), listPrice: null, listPrice2: null,
      amount: Math.round(getPrice(p) * getVol(p) * 1000000), notes: '',
      refVolume: getVol(p), saleUnit: getUnit(p),
      rawWoodData: { pieceCode: p.pieceCode, lengthM: p.lengthM, diameterCm: p.diameterCm, circumferenceCm: p.circumferenceCm, widthCm: p.widthCm, thicknessCm: p.thicknessCm, volumeM3: p.volumeM3, weightKg: p.weightKg, quality: p.quality, containerCode: p.containerCode, cargoType: p.cargoType, containerId: p.containerId, woodTypeName: selWt?.name || '' },
    })));
  };

  // Weight mode
  const wCont = saleMode === 'weight' && selContainerId ? weightConts.find(c => String(c.id) === String(selContainerId)) : null;
  const wTonNum = parseFloat(wKg) || 0; // wKg giờ lưu đơn vị tấn
  const wPriceNum = parseFloat(wPrice) || 0;
  const wAmount = wTonNum * wPriceNum;

  const handleWeightConfirm = () => {
    if (!wCont || !wKg || !wPrice) return;
    const ton = wTonNum, kg = Math.round(ton * 1000 * 100) / 100, price = wPriceNum, pcs = parseInt(wPieces) || 0, vol = ton;
    onConfirm([{
      itemType: 'raw_wood_weight', inspectionItemId: null, bundleId: null, containerId: wCont.id,
      bundleCode: '', supplierBundleCode: '', woodId: null, skuKey: '', attributes: {}, rawMeasurements: {},
      boardCount: pcs, volume: vol, unit: wUnit, unitPrice: Math.round(price * 1000000),
      listPrice: null, listPrice2: null, amount: Math.round(vol * price * 1000000), notes: '',
      refVolume: vol, saleUnit: wUnit,
      withdrawalData: { containerId: wCont.id, pieceCount: pcs, weightKg: kg, unit: wUnit, unitPrice: price },
      rawWoodData: { containerCode: wCont.containerCode, cargoType: wCont.cargoType, containerId: wCont.id, woodTypeName: selWt?.name || wCont.rawWoodTypeName || '', pieceCount: pcs, weightKg: kg },
    }]);
  };

  const ths = { padding: '5px 7px', background: '#F5F0E8', color: '#8B7355', fontWeight: 700, fontSize: '9px', textTransform: 'uppercase', borderBottom: '2px solid #E8DFD4', textAlign: 'left', whiteSpace: 'nowrap' };
  const tds = { padding: '5px 7px', borderBottom: '1px solid #F0EBE3', whiteSpace: 'nowrap', fontSize: '12px' };

  const rwContent = (
    <>
      {loading ? <div style={{ padding: 30, textAlign: 'center', color: 'var(--tm)' }}>Đang tải...</div> : (<>

      {/* STEP 1: Wood type picker */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--brl)', textTransform: 'uppercase', marginBottom: 6 }}>Loại gỗ</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {woodTypes.length === 0 && <div style={{ fontSize: '0.76rem', color: 'var(--tm)', fontStyle: 'italic' }}>Không có gỗ nguyên liệu nào có tồn kho</div>}
          {woodTypes.map(wt => {
            const isSel = selWoodTypeId === wt.id;
            return (
              <button key={wt.id} onClick={() => selectWoodType(wt)}
                style={{ padding: '8px 14px', borderRadius: 7, border: `1.5px solid ${isSel ? 'var(--ac)' : 'var(--bd)'}`, background: isSel ? 'var(--acbg)' : 'var(--bgc)', color: isSel ? 'var(--ac)' : 'var(--ts)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s' }}>
                <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>{wt.icon} {wt.name}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                  {wt.plCount > 0 && <span style={{ padding: '1px 6px', borderRadius: 3, fontSize: '0.6rem', fontWeight: 700, background: 'rgba(39,174,96,0.1)', color: '#27ae60' }}>{wt.cargoType === 'raw_box' ? 'Hộp' : 'Tròn'} còn ({wt.plCount} {wt.cargoType === 'raw_box' ? 'hộp' : 'cây'})</span>}
                  {wt.weightConts.length > 0 && <span style={{ padding: '1px 6px', borderRadius: 3, fontSize: '0.6rem', fontWeight: 700, background: 'rgba(41,128,185,0.1)', color: '#2980b9' }}>Bán tấn ({wt.weightConts.length} cont)</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* STEP 2: Sale mode (if both available) */}
      {selWt && selWt.plCount > 0 && selWt.weightConts.length > 0 && (
        <div style={{ marginBottom: 10, display: 'flex', gap: 4 }}>
          {[{ k: 'pl', l: selWt?.cargoType === 'raw_box' ? 'Chọn từng hộp' : 'Chọn từng cây', c: '#27ae60' }, { k: 'weight', l: 'Bán theo tấn', c: '#2980b9' }].map(t => (
            <button key={t.k} onClick={() => { setSaleMode(t.k); setSelContainerId(null); setSel(new Set()); }}
              style={{ padding: '5px 14px', borderRadius: 5, border: `1.5px solid ${saleMode === t.k ? t.c : 'var(--bd)'}`, background: saleMode === t.k ? `${t.c}11` : 'transparent', color: saleMode === t.k ? t.c : 'var(--ts)', cursor: 'pointer', fontWeight: saleMode === t.k ? 700 : 500, fontSize: '0.76rem' }}>
              {t.l}
            </button>
          ))}
        </div>
      )}

      {/* STEP 3: Container picker */}
      {selWt && saleMode && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: '0.64rem', fontWeight: 700, color: 'var(--brl)', textTransform: 'uppercase', marginBottom: 4 }}>Container</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {saleMode === 'pl' && <>
              <button onClick={() => setSelContainerId(null)} style={{ padding: '4px 10px', borderRadius: 5, border: `1.5px solid ${!selContainerId ? 'var(--ac)' : 'var(--bd)'}`, background: !selContainerId ? 'var(--acbg)' : 'transparent', color: !selContainerId ? 'var(--ac)' : 'var(--ts)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: !selContainerId ? 700 : 500 }}>Tất cả</button>
              {plContainers.map(c => (
                <button key={c.id} onClick={() => setSelContainerId(String(c.id))} style={{ padding: '4px 10px', borderRadius: 5, border: `1.5px solid ${String(selContainerId) === String(c.id) ? 'var(--ac)' : 'var(--bd)'}`, background: String(selContainerId) === String(c.id) ? 'var(--acbg)' : 'transparent', color: String(selContainerId) === String(c.id) ? 'var(--ac)' : 'var(--ts)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: String(selContainerId) === String(c.id) ? 700 : 500 }}>
                  {c.code?.slice(-10)} ({c.count})
                </button>
              ))}
            </>}
            {saleMode === 'weight' && selWt.weightConts.map(c => {
              const isSel = String(selContainerId) === String(c.id);
              const uL = c.weightUnit === 'ton' ? 'tấn' : 'm³';
              // Tính đã chọn trong đơn hiện tại
              const inOrderItems = existingItems.filter(i => i.itemType === 'raw_wood_weight' && String(i.containerId || i.rawWoodData?.containerId) === String(c.id));
              const inOrderPcs = inOrderItems.reduce((s, i) => s + (i.boardCount || i.rawWoodData?.pieceCount || 0), 0);
              const inOrderTon = inOrderItems.reduce((s, i) => s + ((i.rawWoodData?.weightKg || 0) / 1000), 0);
              const effectiveRemaining = Math.max(0, c.remainingVolume - inOrderTon);
              const effectivePcs = c.remainingPieces != null ? Math.max(0, c.remainingPieces - inOrderPcs) : null;
              return (
                <button key={c.id} onClick={() => { setSelContainerId(String(c.id)); setWUnit(c.weightUnit === 'ton' ? 'ton' : 'm3'); setWPrice(c.saleUnitPrice ? String(c.saleUnitPrice) : ''); setWPieces(c.remainingPieces != null ? String(Math.max(0, c.remainingPieces - inOrderPcs)) : ''); }}
                  style={{ padding: '5px 10px', borderRadius: 5, border: `1.5px solid ${isSel ? '#2980b9' : 'var(--bd)'}`, background: isSel ? 'rgba(41,128,185,0.08)' : 'transparent', color: isSel ? '#2980b9' : 'var(--ts)', cursor: 'pointer', fontSize: '0.72rem', textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontFamily: 'monospace' }}>{c.containerCode}</div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--tm)' }}>còn {effectiveRemaining.toFixed(2)} {uL}{effectivePcs != null ? ` · ${effectivePcs} cây` : ''}</div>
                  {inOrderTon > 0 && <div style={{ fontSize: '0.56rem', color: '#8E44AD', fontWeight: 600 }}>Đã chọn: {inOrderPcs} cây · {inOrderTon.toFixed(2)} {uL}</div>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 4a: PL mode — piece table */}
      {saleMode === 'pl' && selWt && <>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
          <select value={fQuality} onChange={e => setFQuality(e.target.value)} style={{ padding: '4px 6px', borderRadius: 5, border: '1.5px solid var(--bd)', fontSize: '11px', outline: 'none' }}>
            <option value="">CL: Tất cả</option>
            {qualities.map(q => <option key={q} value={q}>{q}</option>)}
          </select>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm mã cây..." style={{ padding: '4px 6px', borderRadius: 5, border: '1.5px solid var(--bd)', fontSize: '11px', outline: 'none', width: 120 }} />
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: '10px', color: 'var(--tm)' }}>{filtered.length} cây</span>
            <span style={{ fontSize: '10px', color: '#2980b9', fontWeight: 600 }}>Giá:</span>
            <input type="number" step="0.1" value={defaultPrice} onChange={e => setDefaultPrice(e.target.value)} placeholder="tr/m³" style={{ width: 65, padding: '3px 6px', borderRadius: 4, border: '1.5px solid #2980b9', fontSize: '11px', textAlign: 'right', outline: 'none' }} />
            <button onClick={() => setShowPricing(p => !p)} style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid #8E44AD', background: showPricing ? 'rgba(142,68,173,0.1)' : 'transparent', color: '#8E44AD', cursor: 'pointer', fontSize: '0.64rem', fontWeight: 600 }}>💰 Bảng giá</button>
          </div>
        </div>
        <div style={{ maxHeight: 340, overflowY: 'auto', border: '1px solid var(--bd)', borderRadius: 7 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={{ ...ths, textAlign: 'center', width: 28 }}><input type="checkbox" checked={sel.size > 0 && sel.size === filtered.length} onChange={toggleAll} /></th>
              <th style={ths}>{selWt?.cargoType === 'raw_box' ? 'Mã hộp' : 'Mã cây'}</th>
              {selWt?.cargoType === 'raw_box' ? (<>
                <th style={{ ...ths, textAlign: 'right' }}>Dày×Rộng</th>
                <th style={{ ...ths, textAlign: 'right' }}>Dài (cm)</th>
              </>) : (<>
                <th style={{ ...ths, textAlign: 'right' }}>Dài (m)</th>
                <th style={{ ...ths, textAlign: 'right' }}>ĐK (cm)</th>
              </>)}
              <th style={{ ...ths, textAlign: 'right' }}>m³</th>
              <th style={ths}>CL</th>
              <th style={ths}>Container</th>
              <th style={{ ...ths, textAlign: 'right' }}>Giá</th>
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? <tr><td colSpan={8} style={{ padding: 16, textAlign: 'center', color: 'var(--tm)' }}>Không có cây nào</td></tr> :
              filtered.map(p => {
                const inOrder = existingInspIds.has(p.id);
                const checked = inOrder || sel.has(p.id);
                return (
                  <tr key={p.id} onClick={() => !inOrder && toggle(p.id)} data-clickable="true" style={{ background: inOrder ? 'rgba(142,68,173,0.06)' : checked ? 'rgba(41,128,185,0.06)' : undefined, cursor: inOrder ? 'default' : 'pointer', opacity: inOrder ? 0.6 : 1 }}>
                    <td style={{ ...tds, textAlign: 'center' }}><input type="checkbox" readOnly checked={checked} disabled={inOrder} />{inOrder && <div style={{ fontSize: '0.48rem', color: '#8E44AD' }}>Đã chọn</div>}</td>
                    <td style={{ ...tds, fontFamily: 'monospace', fontWeight: 700, color: '#2980b9' }}>{p.pieceCode || '—'}</td>
                    {selWt?.cargoType === 'raw_box' ? (<>
                      <td style={{ ...tds, textAlign: 'right' }}>{p.thicknessCm && p.widthCm ? `${p.thicknessCm}×${p.widthCm}` : '—'}</td>
                      <td style={{ ...tds, textAlign: 'right' }}>{p.lengthM != null ? Math.round(p.lengthM * 100) : '—'}</td>
                    </>) : (<>
                      <td style={{ ...tds, textAlign: 'right' }}>{p.lengthM ?? '—'}</td>
                      <td style={{ ...tds, textAlign: 'right' }}>{p.circumferenceCm ? `V${p.circumferenceCm}` : p.diameterCm ? `Ø${p.diameterCm}` : '—'}</td>
                    </>)}
                    <td style={{ ...tds, textAlign: 'right', fontWeight: 700, color: 'var(--br)' }}>{getVol(p).toFixed(4)}</td>
                    <td style={{ ...tds, fontWeight: 600, color: p.quality === 'Đẹp' || p.quality === 'A' ? '#27ae60' : p.quality === 'Xấu' || p.quality === 'C' ? '#C0392B' : '#E67E22' }}>{p.quality || '—'}</td>
                    <td style={tds}><span style={{ padding: '1px 5px', borderRadius: 3, fontSize: '9px', fontWeight: 600, background: 'rgba(142,68,173,0.1)', color: '#8E44AD' }}>{p.containerCode?.slice(-8) || '—'}</span></td>
                    <td style={{ ...tds, textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                      {(() => { const fp = getPrice(p); const hasFormula = piecePrice[p.id] == null && fp > 0; return (
                        <input type="number" step="0.1" value={piecePrice[p.id] ?? (fp > 0 ? fp : '')} onChange={e => setPiecePrice(prev => ({ ...prev, [p.id]: e.target.value === '' ? undefined : parseFloat(e.target.value) }))}
                          placeholder={defaultPrice || '—'} style={{ width: 65, padding: '2px 5px', borderRadius: 3, border: `1.5px solid ${hasFormula ? 'var(--gn)' : '#2980b9'}`, fontSize: '11px', textAlign: 'right', outline: 'none', color: hasFormula ? 'var(--gn)' : 'inherit', fontWeight: hasFormula ? 700 : 400 }} />
                      ); })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          <div style={{ fontSize: '11px', color: 'var(--tm)' }}>Đã chọn: <strong style={{ color: 'var(--br)' }}>{sel.size} cây</strong> · <strong style={{ color: 'var(--br)' }}>{totalVol.toFixed(4)} m³</strong> · <strong style={{ color: 'var(--br)' }}>{Math.round(totalAmount * 1000000).toLocaleString('vi-VN')}đ</strong></div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={onClose} style={{ padding: '6px 14px', borderRadius: 6, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontSize: '12px' }}>Hủy</button>
            <button onClick={handleConfirm} disabled={sel.size === 0}
              style={{ padding: '6px 18px', borderRadius: 6, border: 'none', background: sel.size > 0 ? '#2980b9' : 'var(--bd)', color: '#fff', cursor: sel.size > 0 ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: '12px' }}>
              Thêm {sel.size} cây
            </button>
          </div>
        </div>
      </>}

      {/* STEP 4b: Weight mode — input form */}
      {saleMode === 'weight' && wCont && (
        <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(41,128,185,0.04)', border: '1.5px solid rgba(41,128,185,0.2)' }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 10 }}>
            <div><label style={{ display: 'block', fontSize: '0.64rem', fontWeight: 700, color: 'var(--brl)', marginBottom: 3 }}>Số cây</label>
              <input type="number" min="0" step="1" value={wPieces} onChange={e => setWPieces(e.target.value)} placeholder="5" style={{ width: 70, padding: '6px 8px', borderRadius: 5, border: '1.5px solid var(--bd)', fontSize: '0.82rem', textAlign: 'right', outline: 'none' }} /></div>
            <div><label style={{ display: 'block', fontSize: '0.64rem', fontWeight: 700, color: 'var(--brl)', marginBottom: 3 }}>KL cân (tấn)</label>
              <input type="text" inputMode="decimal" value={wKg} onChange={e => { const v = e.target.value.replace(/[^0-9.]/g, ''); setWKg(v); }} onBlur={e => { const v = parseFloat(e.target.value) || 0; if (v) setWKg(v.toFixed(3)); }} placeholder="2.018" autoFocus style={{ width: 100, padding: '6px 8px', borderRadius: 5, border: '1.5px solid #2980b9', fontSize: '0.82rem', textAlign: 'right', outline: 'none', fontWeight: 700 }} /></div>
            <div><label style={{ display: 'block', fontSize: '0.64rem', fontWeight: 700, color: 'var(--brl)', marginBottom: 3 }}>ĐV</label>
              <select value={wUnit} onChange={e => setWUnit(e.target.value)} style={{ padding: '6px 8px', borderRadius: 5, border: '1.5px solid var(--bd)', fontSize: '0.76rem', outline: 'none' }}><option value="ton">Tấn</option><option value="m3">m³</option></select></div>
            <div><label style={{ display: 'block', fontSize: '0.64rem', fontWeight: 700, color: 'var(--brl)', marginBottom: 3 }}>Giá (tr/{wUnit === 'ton' ? 'tấn' : 'm³'})</label>
              <input type="number" min="0" step="0.1" value={wPrice} onChange={e => setWPrice(e.target.value)} placeholder="6.5" style={{ width: 80, padding: '6px 8px', borderRadius: 5, border: '1.5px solid #2980b9', fontSize: '0.82rem', textAlign: 'right', outline: 'none', fontWeight: 700 }} /></div>
            <button onClick={() => setShowPricing(p => !p)} style={{ padding: '5px 10px', borderRadius: 5, border: '1px solid #8E44AD', background: showPricing ? 'rgba(142,68,173,0.1)' : 'transparent', color: '#8E44AD', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 600 }}>💰 Bảng giá</button>
          </div>
          {wTonNum > 0 && wPriceNum > 0 && <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--br)', marginBottom: 6 }}>{wTonNum.toFixed(4)} {wUnit === 'ton' ? 'tấn' : 'm³'} × {wPriceNum} = {Math.round(wAmount * 1000000).toLocaleString('vi-VN')}đ</div>}
          {(() => {
            const inOrd = existingItems.filter(i => i.itemType === 'raw_wood_weight' && String(i.containerId || i.rawWoodData?.containerId) === String(wCont.id));
            const inOrdTon = inOrd.reduce((s, i) => s + ((i.rawWoodData?.weightKg || 0) / 1000), 0);
            const inOrdPcs = inOrd.reduce((s, i) => s + (i.boardCount || i.rawWoodData?.pieceCount || 0), 0);
            const effRem = Math.max(0, wCont.remainingVolume - inOrdTon);
            return <div style={{ fontSize: '0.68rem', color: 'var(--tm)' }}>
              Container còn: {effRem.toFixed(2)} {wCont.weightUnit === 'ton' ? 'tấn' : 'm³'}{wCont.remainingPieces != null ? ` · ${Math.max(0, wCont.remainingPieces - inOrdPcs)} cây` : ''}
              {inOrdTon > 0 && <span style={{ marginLeft: 6, color: '#8E44AD', fontWeight: 600 }}>(đã chọn {inOrdPcs} cây · {inOrdTon.toFixed(2)} trong đơn)</span>}
            </div>;
          })()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 10 }}>
            <button onClick={onClose} style={{ padding: '6px 14px', borderRadius: 6, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontSize: '12px' }}>Hủy</button>
            <button onClick={handleWeightConfirm} disabled={!wKg || !wPrice}
              style={{ padding: '6px 18px', borderRadius: 6, border: 'none', background: wKg && wPrice ? '#2980b9' : 'var(--bd)', color: '#fff', cursor: wKg && wPrice ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: '12px' }}>Thêm vào đơn</button>
          </div>
        </div>
      )}

      {/* Pricing reference panel */}
      {showPricing && (() => {
        const cfgs = priceConfigs.filter(c => !selWoodTypeId || c.rawWoodTypeId === selWoodTypeId);
        const rules = pricingRules.filter(r => !selWoodTypeId || r.rawWoodTypeId === selWoodTypeId);
        const hasAny = cfgs.length > 0 || rules.length > 0;
        return (
          <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 7, background: 'rgba(142,68,173,0.04)', border: '1px solid rgba(142,68,173,0.2)' }}>
            <div style={{ fontSize: '0.64rem', fontWeight: 700, color: '#8E44AD', textTransform: 'uppercase', marginBottom: 6 }}>Bảng giá bán lẻ</div>
            {!hasAny ? <div style={{ fontSize: '0.72rem', color: 'var(--tm)' }}>Chưa có bảng giá. Admin cấu hình tại Gỗ nguyên liệu → Bảng giá NL.</div> : (<>
              {/* Formula configs */}
              {cfgs.map(cfg => {
                const fLabel = cfg.formulaType === 'flat' ? `Giá cố định: ${cfg.basePrice} tr` :
                  cfg.formulaType === 'base_plus_measure' ? `${cfg.basePrice} + ${cfg.measureCoefficient} × ${cfg.measureVariable === 'diameter' ? 'ĐK' : 'Rộng'}(cm)` :
                  cfg.formulaType === 'quality_matrix' ? 'Giá theo chất lượng' :
                  cfg.formulaType === 'volume_tier' ? `Giá lẻ: ${cfg.basePrice} tr` : cfg.formulaType;
                // Build sample prices
                const samples = cfg.formulaType === 'flat' ? [] :
                  cfg.formulaType === 'base_plus_measure' || cfg.formulaType === 'quality_matrix' ?
                    [20, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 90, 100].filter(s => {
                      if (cfg.sizeTiers?.length) { const any = cfg.sizeTiers.some(t => (t.min == null || s >= t.min) && (t.max == null || s < t.max)); return any; }
                      return true;
                    }).map(size => {
                      const r = resolveFormulaPrice({ diameterCm: cfg.measureVariable === 'diameter' ? size : null, widthCm: cfg.measureVariable !== 'diameter' ? size : null, quality: null }, cfg);
                      return { size, price: r.price };
                    }).filter(s => s.price > 0) : [];
                return (
                  <div key={cfg.id} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--br)', marginBottom: 4 }}>{cfg.rawWoodTypeIcon} {cfg.rawWoodTypeName} <span style={{ fontSize: '0.64rem', color: 'var(--tm)', fontWeight: 500 }}>{fLabel}</span></div>
                    {/* Quality config */}
                    {cfg.qualityConfig && Object.keys(cfg.qualityConfig).length > 0 && (
                      <div style={{ fontSize: '0.68rem', color: 'var(--ts)', marginBottom: 4 }}>
                        {Object.entries(cfg.qualityConfig).map(([q, v]) => <span key={q} style={{ marginRight: 8 }}>{q}: {v.base != null ? `cơ sở ${v.base}` : ''}{v.surcharge ? ` +${v.surcharge}` : ''}</span>)}
                      </div>
                    )}
                    {samples.length > 0 && (
                      <table style={{ borderCollapse: 'collapse', fontSize: '0.7rem' }}>
                        <thead><tr><th style={{ ...ths, fontSize: '8px' }}>{cfg.measureVariable === 'diameter' ? 'ĐK(cm)' : 'Rộng(cm)'}</th><th style={{ ...ths, fontSize: '8px', textAlign: 'right' }}>Giá (tr)</th></tr></thead>
                        <tbody>{samples.map(s => <tr key={s.size}><td style={tds}>{s.size}cm</td><td style={{ ...tds, textAlign: 'right', fontWeight: 700, color: 'var(--br)' }}>{s.price.toFixed(1)}</td></tr>)}</tbody>
                      </table>
                    )}
                  </div>
                );
              })}
              {/* Legacy rules */}
              {rules.length > 0 && cfgs.length > 0 && <div style={{ fontSize: '0.62rem', color: 'var(--tm)', marginTop: 6, marginBottom: 4, textTransform: 'uppercase', fontWeight: 700 }}>Bảng giá cấp kính (legacy)</div>}
              {rules.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
                  <thead><tr><th style={{ ...ths, fontSize: '8px' }}>Loại gỗ</th><th style={{ ...ths, fontSize: '8px' }}>CL</th><th style={{ ...ths, fontSize: '8px', textAlign: 'right' }}>Kính/Rộng</th><th style={{ ...ths, fontSize: '8px', textAlign: 'right' }}>Giá</th></tr></thead>
                  <tbody>{rules.map((r, i) => <tr key={r.id} style={{ background: i % 2 ? 'var(--bgs)' : '#fff' }}><td style={tds}>{r.rawWoodTypeIcon} {r.rawWoodTypeName}</td><td style={tds}>{r.quality || '*'}</td><td style={{ ...tds, textAlign: 'right' }}>{r.sizeMin ?? '—'}–{r.sizeMax ?? '—'}</td><td style={{ ...tds, textAlign: 'right', fontWeight: 700, color: 'var(--br)' }}>{r.unitPrice}</td></tr>)}</tbody>
                </table>
              )}
            </>)}
          </div>
        );
      })()}

      </>)}
    </>
  );

  if (inline) return rwContent;
  return <Dialog open={true} onClose={onClose} title="🪵 Gỗ tròn/hộp bán lẻ" width={860} noEnter maxHeight="90vh">{rwContent}</Dialog>;
}

// ===== ContainerSelector — bán nguyên container =====
function ContainerSelectorDlg({ onConfirm, onClose, existingItems = [], inline = false }) {
  const [containers, setContainers] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [inspSummary, setInspSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [saleVol, setSaleVol] = useState('');
  const [unitPrice, setUnitPrice] = useState('');

  useEffect(() => {
    (async () => {
      const { fetchRawContainersForSale, fetchInspectionSummaryAll, fetchShipments } = await import('../api.js');
      const [c, summary, sh] = await Promise.all([fetchRawContainersForSale(), fetchInspectionSummaryAll(), fetchShipments()]);
      setContainers(c);
      setInspSummary(summary || {});
      setShipments(sh || []);
      // Auto-select: ưu tiên lô Thông tròn cập cảng sớm nhất, fallback lô nhiều cont nhất
      const raw = c.filter(x => x.cargo_type === 'raw_round' || x.cargo_type === 'raw_box');
      const retailShipmentIds = new Set((sh || []).filter(s => s.retailOnly).map(s => s.id));
      const existContSet = new Set(existingItems.filter(i => i.itemType === 'container' && i.containerId).map(i => i.containerId));
      const existPieceSet = new Set(existingItems.filter(i => (i.itemType === 'raw_wood' || i.itemType === 'raw_wood_weight') && (i.containerId || i.rawWoodData?.containerId)).map(i => i.containerId || i.rawWoodData?.containerId));
      const canSellCheck = (x) => {
        if (existContSet.has(x.id) || existPieceSet.has(x.id) || existPieceSet.has(String(x.id))) return false;
        const inv = (summary || {})[x.id];
        if (inv && (inv.sawn > 0 || inv.sold > 0 || inv.on_order > 0)) return false;
        if (x.status === 'Đã bán' || x.status === 'Đã hết' || x.status === 'Đang lên đơn') return false;
        const rv = x.remaining_volume ?? x.remainingVolume;
        const tv = x.total_volume ?? x.totalVolume;
        if (rv != null && tv != null && parseFloat(rv) < parseFloat(tv)) return false;
        return true;
      };
      // Tìm rawWoodTypeId "Thông tròn" từ containers (match chính xác tên)
      const pineRoundTypeId = raw.find(x => x.rawWoodTypeName === 'Thông tròn')?.raw_wood_type_id;
      const pineShipments = pineRoundTypeId ? (sh || [])
        .filter(s => s.rawWoodTypeId === pineRoundTypeId && !s.retailOnly)
        .filter(s => raw.some(x => x.shipment_id === s.id && canSellCheck(x)))
        .sort((a, b) => new Date(a.arrivalDate || a.eta || '9999') - new Date(b.arrivalDate || b.eta || '9999'))
        : [];
      if (pineShipments.length > 0) {
        setSelectedShipment(pineShipments[0].id);
      } else {
        const sIds = [...new Set(raw.map(x => x.shipment_id).filter(id => id && !retailShipmentIds.has(id)))];
        let bestId = null, bestCount = 0;
        for (const sid of sIds) {
          const cnt = raw.filter(x => x.shipment_id === sid && canSellCheck(x)).length;
          if (cnt > bestCount) { bestCount = cnt; bestId = sid; }
        }
        if (bestId) setSelectedShipment(bestId);
      }
      setLoading(false);
    })();
  }, []);

  // Containers đã có trong đơn hiện tại (nguyên cont hoặc bán lẻ)
  const existingContIds = useMemo(() => new Set(existingItems.filter(i => i.itemType === 'container' && i.containerId).map(i => i.containerId)), [existingItems]);
  const existingPieceContIds = useMemo(() => new Set(existingItems.filter(i => (i.itemType === 'raw_wood' || i.itemType === 'raw_wood_weight') && (i.containerId || i.rawWoodData?.containerId)).map(i => i.containerId || i.rawWoodData?.containerId)), [existingItems]);

  const canSell = (c) => {
    const cid = c.id;
    // Đã chọn nguyên cont trong đơn này
    if (existingContIds.has(cid)) return false;
    // Đã bán lẻ cây từ cont này trong đơn này
    if (existingPieceContIds.has(cid)) return false;
    if (existingPieceContIds.has(String(cid))) return false;
    const inv = inspSummary[c.id];
    if (inv && (inv.sawn > 0 || inv.sold > 0 || inv.on_order > 0)) return false;
    if (c.status === 'Đã bán' || c.status === 'Đã hết' || c.status === 'Đang lên đơn') return false;
    const remVol = c.remaining_volume ?? c.remainingVolume;
    const totVol = c.total_volume ?? c.totalVolume;
    if (remVol != null && totVol != null && parseFloat(remVol) < parseFloat(totVol)) return false;
    return true;
  };
  const getContNote = (c) => {
    if (existingContIds.has(c.id)) return 'Đã chọn nguyên cont trong đơn';
    if (existingPieceContIds.has(c.id) || existingPieceContIds.has(String(c.id))) return 'Đã bán lẻ trong đơn';
    const inv = inspSummary[c.id];
    if (inv?.on_order > 0) return `${inv.on_order} cây đang lên đơn khác`;
    if (c.status === 'Đang lên đơn') return 'Đang lên đơn khác';
    return '';
  };

  const selectedCont = containers.find(c => c.id === selectedId);
  const selectedUnit = selectedCont?.weight_unit === 'ton' ? 'tấn' : 'm³';
  const selectedUnitKey = selectedCont?.weight_unit === 'ton' ? 'ton' : 'm3';
  const nccVol = selectedCont ? parseFloat(selectedCont.total_volume) || 0 : 0;
  const vol = parseFloat(saleVol) || nccVol;
  const price = parseFloat(unitPrice) || 0;
  const totalAmount = vol * price;

  const handleSelect = (c) => {
    setSelectedId(c.id);
    setSaleVol(String(parseFloat(c.total_volume) || ''));
    setUnitPrice(c.saleUnitPrice != null ? String(c.saleUnitPrice) : '');
  };

  const handleConfirm = () => {
    if (!selectedCont || !price) return;
    const inv = inspSummary[selectedCont.id];
    const items = [{
      itemType: 'container',
      containerId: selectedCont.id,
      inspectionItemId: null, bundleId: null,
      bundleCode: selectedCont.container_code, supplierBundleCode: '',
      woodId: null, skuKey: '',
      attributes: {}, rawMeasurements: {},
      boardCount: inv?.total || selectedCont.remaining_pieces || selectedCont.itemsPieceCount || 0,
      volume: vol,
      unit: selectedUnitKey,
      unitPrice: Math.round(price * 1000000),
      listPrice: selectedCont.saleUnitPrice != null ? Math.round(selectedCont.saleUnitPrice * 1000000) : null, listPrice2: null,
      amount: Math.round(totalAmount * 1000000),
      notes: '',
      refVolume: nccVol,
      saleUnit: selectedUnitKey,
      rawWoodData: {
        containerCode: selectedCont.container_code, cargoType: selectedCont.cargo_type,
        containerId: selectedCont.id, nccId: selectedCont.ncc_id,
        pieceCount: inv?.total || selectedCont.remaining_pieces || selectedCont.itemsPieceCount || null,
        woodTypeName: selectedCont.rawWoodTypeName || (selectedCont.cargo_type === 'raw_round' ? 'Gỗ tròn' : 'Gỗ hộp'),
        totalVolume: nccVol, weightUnit: selectedCont.weight_unit,
      },
    }];
    onConfirm(items);
  };

  const ths = { padding: '5px 7px', background: '#F5F0E8', color: '#8B7355', fontWeight: 700, fontSize: '9px', textTransform: 'uppercase', borderBottom: '2px solid #E8DFD4', textAlign: 'left', whiteSpace: 'nowrap' };
  const tds = { padding: '6px 7px', borderBottom: '1px solid #F0EBE3', whiteSpace: 'nowrap', fontSize: '12px' };
  const rawConts = containers.filter(c => c.cargo_type === 'raw_round' || c.cargo_type === 'raw_box');

  // Lô hàng có ≥1 container raw + còn cont bán được
  const shipmentIds = new Set(rawConts.map(c => c.shipment_id).filter(Boolean));
  const availableShipments = shipments
    .filter(s => shipmentIds.has(s.id) && !s.retailOnly)
    .filter(s => rawConts.some(c => c.shipment_id === s.id && canSell(c)));

  // Build woodTypeMap từ containers
  const woodTypeMap = {};
  rawConts.forEach(c => {
    if (c.raw_wood_type_id && !woodTypeMap[c.raw_wood_type_id])
      woodTypeMap[c.raw_wood_type_id] = { name: c.rawWoodTypeName, icon: c.rawWoodTypeIcon };
  });

  // Group shipments by rawWoodTypeId + sort by arrivalDate
  const groupedShipments = (() => {
    const groups = {};
    for (const s of availableShipments) {
      const key = s.rawWoodTypeId || '_other';
      if (!groups[key]) {
        const wt = woodTypeMap[s.rawWoodTypeId];
        groups[key] = { id: key, name: wt?.name || 'Khác', icon: wt?.icon || '', shipments: [] };
      }
      groups[key].shipments.push(s);
    }
    for (const g of Object.values(groups)) {
      g.shipments.sort((a, b) => new Date(a.arrivalDate || a.eta || 0) - new Date(b.arrivalDate || b.eta || 0));
    }
    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
  })();

  // Filter containers theo lô đã chọn (bắt buộc chọn lô)
  const filteredConts = selectedShipment ? rawConts.filter(c => c.shipment_id === selectedShipment) : [];

  const contContent = (
    <>
      {loading ? <div style={{ padding: 30, textAlign: 'center', color: 'var(--tm)' }}>Đang tải...</div> : (
        <div>
          {/* Shipment picker grouped by wood type */}
          <div style={{ padding: '7px 0 10px' }}>
            {groupedShipments.map(group => (
              <div key={group.id} style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '2px 0 4px' }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--bd)' }} />
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--ts)', whiteSpace: 'nowrap' }}>{group.icon} {group.name}</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--bd)' }} />
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {group.shipments.map(s => {
                    const contsOfShipment = rawConts.filter(c => c.shipment_id === s.id);
                    const sellableCount = contsOfShipment.filter(c => canSell(c)).length;
                    const isActive = selectedShipment === s.id;
                    return (
                      <button key={s.id} onClick={() => { setSelectedShipment(isActive ? null : s.id); setSelectedId(null); setSaleVol(''); setUnitPrice(''); }}
                        style={{ padding: '4px 10px', borderRadius: 6, border: isActive ? '2px solid #8E44AD' : '1.5px solid var(--bd)', background: isActive ? 'rgba(142,68,173,0.08)' : 'var(--bgc)', color: isActive ? '#8E44AD' : 'var(--ts)', cursor: 'pointer', fontWeight: isActive ? 700 : 500, fontSize: '0.77rem', whiteSpace: 'nowrap' }}>
                        {s.name || s.shipmentCode}{(s.arrivalDate || s.eta) ? <span style={{ fontSize: '0.66rem', color: '#2980b9', fontWeight: 600, marginLeft: 4 }}>{new Date(s.arrivalDate || s.eta).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}</span> : ''} <span style={{ fontSize: '0.62rem', color: '#27ae60', fontWeight: 700 }}>({sellableCount}/{contsOfShipment.length})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {groupedShipments.length === 0 && <span style={{ fontSize: '0.76rem', color: 'var(--tm)', fontStyle: 'italic' }}>Không có lô hàng nào có container nguyên liệu bán được</span>}
          </div>
          <div style={{ overflowX: 'auto', border: '1px solid var(--bd)', borderRadius: 7, marginBottom: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={{ ...ths, textAlign: 'center', width: 30 }}></th>
                <th style={ths}>Mã container</th>
                <th style={ths}>Loại gỗ</th>
                <th style={ths}>Dạng</th>
                <th style={{ ...ths, textAlign: 'right' }}>Số cây</th>
                <th style={{ ...ths, textAlign: 'right' }}>KL NCC</th>
                <th style={ths}>ĐV</th>
                <th style={{ ...ths, textAlign: 'right' }}>Giá (tr)</th>
                <th style={ths}>Trạng thái</th>
                <th style={ths}>Ngày về</th>
                <th style={ths}>Ghi chú</th>
              </tr></thead>
              <tbody>
                {filteredConts.length === 0 ? (
                  <tr><td colSpan={11} style={{ padding: 20, textAlign: 'center', color: 'var(--tm)' }}>{selectedShipment ? 'Lô này không có container nào' : 'Chọn lô hàng phía trên'}</td></tr>
                ) : filteredConts.map((c, i) => {
                  const inv = inspSummary[c.id];
                  const sellable = canSell(c);
                  const isSelected = selectedId === c.id;
                  const unitLabel = c.weight_unit === 'ton' ? 'tấn' : 'm³';
                  return (
                    <tr key={c.id} onClick={() => sellable && handleSelect(c)} data-clickable={sellable ? 'true' : undefined}
                      style={{ background: isSelected ? 'rgba(142,68,173,0.07)' : i % 2 ? 'var(--bgs)' : '#fff', cursor: sellable ? 'pointer' : 'default', opacity: sellable ? 1 : 0.45 }}>
                      <td style={{ ...tds, textAlign: 'center' }}><input type="radio" readOnly checked={isSelected} disabled={!sellable} /></td>
                      <td style={{ ...tds, fontFamily: 'monospace', fontWeight: 700, color: isSelected ? '#8E44AD' : 'var(--br)' }}>{c.container_code}</td>
                      <td style={{ ...tds, fontWeight: 600 }}>{c.rawWoodTypeIcon || ''} {c.rawWoodTypeName || <span style={{ color: 'var(--tm)', fontStyle: 'italic' }}>—</span>}</td>
                      <td style={tds}>{c.cargo_type === 'raw_round' ? 'Tròn' : 'Hộp'}</td>
                      <td style={{ ...tds, textAlign: 'right', fontWeight: 600 }}>{inv?.total || c.remaining_pieces || c.itemsPieceCount || '—'}</td>
                      <td style={{ ...tds, textAlign: 'right', fontWeight: 700, color: 'var(--br)' }}>{parseFloat(c.total_volume || 0).toFixed(2)}</td>
                      <td style={tds}><span style={{ padding: '1px 5px', borderRadius: 3, fontSize: '9px', fontWeight: 700, background: c.weight_unit === 'ton' ? 'rgba(230,126,34,0.1)' : 'rgba(41,128,185,0.1)', color: c.weight_unit === 'ton' ? '#E67E22' : '#2980b9' }}>{unitLabel}</span></td>
                      <td style={{ ...tds, textAlign: 'right', fontWeight: 700, color: c.saleUnitPrice ? '#8E44AD' : 'var(--tm)' }}>{c.saleUnitPrice ? (c.saleUnitPrice % 1 === 0 ? c.saleUnitPrice.toFixed(1) : parseFloat(c.saleUnitPrice.toFixed(2)).toString()) : '—'}</td>
                      <td style={tds}><span style={{ padding: '2px 7px', borderRadius: 4, fontSize: '10px', fontWeight: 700, background: c.status === 'Đã về' ? 'rgba(39,174,96,0.1)' : c.status === 'Đang vận chuyển' ? 'rgba(243,156,18,0.1)' : 'rgba(41,128,185,0.1)', color: c.status === 'Đã về' ? '#27ae60' : c.status === 'Đang vận chuyển' ? '#F39C12' : '#2980b9' }}>{c.status}</span></td>
                      <td style={tds}>{c.arrival_date || '—'}</td>
                      <td style={{ ...tds, fontSize: '11px', color: 'var(--tm)' }}>
                        {(() => {
                          if (c.status === 'Đã bán') return <span style={{ color: '#C0392B', fontWeight: 600 }}>Đã bán nguyên cont</span>;
                          if (!sellable && inv && (inv.sawn > 0 || inv.sold > 0)) return <span style={{ color: '#C0392B' }}>⚠ {inv.sawn > 0 ? `${inv.sawn} xẻ` : ''}{inv.sold > 0 ? ` ${inv.sold} bán` : ''}</span>;
                          const note = getContNote(c);
                          if (note) return <span style={{ color: '#8E44AD', fontWeight: 600 }}>📋 {note}</span>;
                          if (!sellable) { const rv = parseFloat(c.remaining_volume ?? c.remainingVolume ?? c.total_volume); const tv = parseFloat(c.total_volume ?? c.totalVolume ?? 0); if (rv < tv) return <span style={{ color: '#C0392B' }}>⚠ Đã xuất lẻ ({(tv - rv).toFixed(2)})</span>; }
                          if (sellable && !inv) return <span style={{ color: '#2980b9' }}>KL NCC</span>;
                          return '';
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pricing section — hiện khi đã chọn container */}
          {selectedCont && (
            <div style={{ padding: '10px 14px', borderRadius: 7, background: 'rgba(142,68,173,0.04)', border: '1.5px solid rgba(142,68,173,0.2)', marginBottom: 10 }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#8E44AD', marginBottom: 8, textTransform: 'uppercase' }}>Định giá — {selectedCont.container_code}</div>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--tm)' }}>KL bán:</span>
                  <input type="number" step="0.01" value={saleVol} onChange={e => setSaleVol(e.target.value)}
                    style={{ width: 85, padding: '5px 8px', borderRadius: 5, border: '1.5px solid #E67E22', fontSize: '13px', textAlign: 'right', outline: 'none', fontWeight: 700, color: '#E67E22' }} />
                  <span style={{ fontSize: '12px', color: 'var(--tm)' }}>{selectedUnit}</span>
                  {vol !== nccVol && <span style={{ fontSize: '10px', color: 'var(--tm)' }}>(NCC: {nccVol})</span>}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--tm)' }}>Đơn giá:</span>
                  <input type="number" step="0.1" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} autoFocus placeholder="VD: 8.0"
                    style={{ width: 85, padding: '5px 8px', borderRadius: 5, border: '1.5px solid #8E44AD', fontSize: '13px', textAlign: 'right', outline: 'none', fontWeight: 700 }} />
                  <span style={{ fontSize: '12px', color: 'var(--tm)' }}>tr/{selectedUnit}</span>
                </div>
                {price > 0 && <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--br)' }}>= {Math.round(totalAmount * 1000000).toLocaleString('vi-VN')}đ</span>}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            {!inline && <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: 6, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontSize: '13px' }}>Hủy</button>}
            <button onClick={handleConfirm} disabled={!selectedId || !price}
              style={{ padding: '7px 20px', borderRadius: 6, border: 'none', background: selectedId && price ? '#8E44AD' : 'var(--bd)', color: '#fff', cursor: selectedId && price ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: '13px' }}>
              Thêm container vào đơn
            </button>
          </div>
        </div>
      )}
    </>
  );

  if (inline) return contContent;
  return <Dialog open={true} onClose={onClose} title="🚢 Bán nguyên container" width={820} noEnter maxHeight="90vh">{contContent}</Dialog>;
}

function OrderForm({ initial, initialItems, initialServices, customers, setCustomers, wts, ats, cfg, prices, bundles: bundlesProp = [], ce, user, useAPI, notify, onDone, onCreatedStay, onViewOrder, vatRate = 0.08, carriers = [], xeSayConfig = DEFAULT_XE_SAY_CONFIG, setXeSayConfig }) {
  const isNew = !initial?.id;
  // V-28: lưu draft thành order DB với status Nháp — không dùng localStorage
  const [fm, setFm] = useState(() => {
    const base = initial || INIT_ORDER;
    if (!base.salesBy && !base.id) return { ...base, salesBy: user?.username || '' };
    return base;
  });
  const [salesUsers, setSalesUsers] = useState([]);
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
  const [showRawWoodSel, setShowRawWoodSel] = useState(false);
  const [showContSel, setShowContSel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [confirmPayMethod, setConfirmPayMethod] = useState(null); // null | 'picking' | 'CK' | 'TM'
  // V-25: công nợ hiện tại của khách
  const [customerDebt, setCustomerDebt] = useState(0);
  const [debtDetail, setDebtDetail] = useState([]); // chi tiết từng đơn nợ
  // Customer credits (công nợ dương từ đơn hủy)
  const [customerCredits, setCustomerCredits] = useState([]);
  const [appliedCredits, setAppliedCredits] = useState([]); // [{creditId, amount, reason}]
  // V-21: theo dõi bundle đã lock để unlock khi rời form
  const lockedBundleIds = useRef(new Set());

  const [showXeSayGuide, setShowXeSayGuide] = useState(false); // false | rowIdx

  // Inline product picker tabs
  const [pickerTab, setPickerTab] = useState(null); // null | 'bundle' | 'rawwood' | 'container'

  // DS kiện lẻ vừa soạn
  const [measurements, setMeasurements] = useState([]);
  const [showMeasPanel, setShowMeasPanel] = useState(false);
  const [measSelectMode, setMeasSelectMode] = useState(false);
  const [measSelected, setMeasSelected] = useState(new Set());
  const [measDeleting, setMeasDeleting] = useState(false);
  const [measDetail, setMeasDetail] = useState(null); // measurement đang xem chi tiết
  const [assignedMeasurements, setAssignedMeasurements] = useState([]); // measurements đã gán vào đơn này (để in)

  // Load + realtime kiện lẻ (Shared Pool: fetch chỉ SELECT thuần, không side effect)
  const measRef = useRef([]); // track DS hiện tại để diff
  const assignedMeasRef = useRef([]); // track DS đã gán cho unmount cleanup
  useEffect(() => { assignedMeasRef.current = assignedMeasurements; }, [assignedMeasurements]);
  useEffect(() => {
    if (!useAPI) return;
    let channel;
    (async () => {
      try {
        const { fetchBundleMeasurements, subscribeBundleMeasurements } = await import('../api.js');
        const data = await fetchBundleMeasurements();
        setMeasurements(data);
        measRef.current = data;
        channel = subscribeBundleMeasurements(() => {
          fetchBundleMeasurements().then(newData => {
            const oldIds = new Set(measRef.current.map(m => m.id));
            const newIds = new Set(newData.map(m => m.id));
            const added = newData.filter(m => !oldIds.has(m.id));
            if (added.length > 0) notify(added.map(m => m.bundle_code).join(', ') + ' — kiện lẻ mới vừa gửi lên');
            const removed = measRef.current.filter(m => !newIds.has(m.id));
            if (removed.length > 0) notify(removed.map(m => m.bundle_code).join(', ') + ' — đã được gán bởi người khác');
            measRef.current = newData;
            setMeasurements(newData);
          }).catch(() => {});
        });
      } catch {}
    })();
    return () => { if (channel) channel.unsubscribe(); };
  }, [useAPI]); // eslint-disable-line

  const measCount = measurements.length;

  const handleAssignMeasurement = async (meas) => {
    // Check DB: kiện lẻ đã bị gán bởi người khác chưa?
    try {
      const { default: sb } = await import('../api/client.js');
      const { data: check } = await sb.from('bundle_measurements').select('status').eq('id', meas.id).single();
      if (check && check.status !== 'chờ gán') {
        notify('Kiện ' + meas.bundle_code + ' đã được gán bởi người khác', false);
        setMeasurements(prev => prev.filter(m => m.id !== meas.id));
        return;
      }
    } catch {}

    // Tìm bundle trong kho khớp bundle_code hoặc supplier_bundle_code
    let matchedBundle = null;
    const code = (meas.bundle_code || '').trim();
    try {
      const { fetchBundles } = await import('../api.js');
      const allBundles = await fetchBundles();
      const available = allBundles.filter(b => b.status !== 'Đã bán hết' && b.status !== 'Đã bán');
      matchedBundle = available.find(b => b.bundleCode === code)
        || available.find(b => b.supplierBundleCode === code)
        || available.find(b => b.bundleCode?.toLowerCase() === code.toLowerCase())
        || available.find(b => (b.supplierBundleCode || '').toLowerCase() === code.toLowerCase());
    } catch {}

    if (!matchedBundle) {
      notify('Không tìm thấy kiện ' + code + ' trong kho. Kiểm tra lại mã kiện.', false);
      return;
    }

    // Tạo item giống BundleSelector handleConfirm
    const b = matchedBundle;
    const m2 = isM2Wood(b.woodId, wts);
    const unit = m2 ? 'm2' : 'm3';
    let unitPrice, listPrice, listPrice2;
    if (isPerBundle(b.woodId, wts)) {
      unitPrice = b.unitPrice != null ? Math.round(b.unitPrice * 1000000) : null;
      listPrice = unitPrice;
    } else if (m2) {
      const _lookupAttrs = { ...b.attributes, ...(b.priceAttrsOverride || {}) };
      const priceObj = prices[bpk(b.woodId, resolvePriceAttrs(b.woodId, _lookupAttrs, cfg))] || {};
      const leKien = priceObj.price != null ? Math.round(priceObj.price * 1000) : null;
      const nguyenKien = priceObj.price2 != null ? Math.round(priceObj.price2 * 1000) : null;
      unitPrice = leKien ?? nguyenKien;
      listPrice = leKien;
      listPrice2 = nguyenKien;
    } else {
      const _lookupAttrs2 = { ...b.attributes, ...(b.priceAttrsOverride || {}) };
      const priceObj = prices[bpk(b.woodId, resolvePriceAttrs(b.woodId, _lookupAttrs2, cfg))] || {};
      const basePrice = priceObj.price;
      const basePriceMil = basePrice != null ? Math.round(basePrice * 1000000) : null;
      if (basePrice != null && b.priceAdjustment) {
        const adj = b.priceAdjustment;
        const effPrice = adj.type === 'percent' ? basePrice * (1 + adj.value / 100) : basePrice + adj.value;
        unitPrice = Math.round(effPrice * 1000000);
        listPrice = unitPrice; // Giá đã điều chỉnh → dùng làm giá chuẩn
      } else {
        unitPrice = basePriceMil;
        listPrice = basePriceMil;
      }
    }
    // Volume từ measurement (đo thực tế), không dùng volume bundle
    const vol = parseFloat((meas.volume || 0).toFixed(4));
    const boardCount = meas.board_count || 0;

    // Check trùng
    if (items.some(i => i.bundleId === b.id)) {
      notify('Kiện ' + b.bundleCode + ' đã có trong đơn', false);
      return;
    }

    const newItem = {
      bundleId: b.id, bundleCode: b.bundleCode, supplierBundleCode: b.supplierBundleCode || '',
      woodId: b.woodId, skuKey: b.skuKey, attributes: { ...b.attributes },
      rawMeasurements: b.rawMeasurements || {},
      boardCount, volume: vol, unit, unitPrice, listPrice, listPrice2,
      amount: unitPrice ? Math.round(unitPrice * vol) : 0,
      notes: '', priceAdjustment: b.priceAdjustment || null,
      measurementId: meas.id, // liên kết measurement
    };

    // Shared Pool: hold bundle → rời pool
    if (useAPI && b.id) {
      try {
        const { holdBundle } = await import('../api.js');
        await holdBundle(b.id);
        lockedBundleIds.current.add(b.id);
      } catch {}
    }

    setItems(prev => [...prev, newItem]);

    // Gán measurement
    if (useAPI) {
      try {
        const { assignMeasurementToOrder } = await import('../api.js');
        await assignMeasurementToOrder(meas.id, fm.id || null, b.id);
      } catch {}
    }

    // Lưu measurement đã gán (để in) + xóa khỏi DS chờ
    setAssignedMeasurements(prev => [...prev, meas]);
    setMeasurements(prev => prev.filter(m => m.id !== meas.id));
    notify('Đã gán kiện ' + code + ' (' + boardCount + ' tấm, ' + vol + ' m³)');
  };

  const handleDeleteMeasurements = async (ids) => {
    setMeasDeleting(true);
    try {
      const { softDeleteMeasurements } = await import('../api.js');
      await softDeleteMeasurements(ids);
      setMeasurements(prev => prev.filter(m => !ids.includes(m.id)));
      setMeasSelected(new Set());
      setMeasSelectMode(false);
      notify('Đã xóa ' + ids.length + ' kiện lẻ');
    } catch (e) { notify('Lỗi: ' + e.message, false); }
    setMeasDeleting(false);
  };

  // Dialog xác nhận rời trang
  const [showLeaveDlg, setShowLeaveDlg] = useState(false);
  const hasUnsaved = isNew && (fm.customerId || items.length > 0 || services.length > 0 || fm.notes);
  const tryLeave = () => { if (hasUnsaved) setShowLeaveDlg(true); else onDone(null); };

  // Cảnh báo trình duyệt khi reload/đóng tab có dữ liệu chưa lưu
  React.useEffect(() => {
    if (!hasUnsaved) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsaved]);

  // Dialog thêm khách hàng nhanh
  const [showNewCustDlg, setShowNewCustDlg] = useState(false);
  const [newCust, setNewCust] = useState({ salutation: '', name: '', phone1: '', nickname: '', companyName: '' });
  const [newCustSaving, setNewCustSaving] = useState(false);

  // Load danh sách nhân viên bán hàng cho dropdown salesBy
  useEffect(() => {
    (async () => {
      try {
        const { fetchUsers } = await import('../api.js');
        const users = await fetchUsers();
        setSalesUsers(users.filter(u => u.active && (u.role === 'banhang' || u.role === 'admin' || u.role === 'superadmin')));
      } catch {}
    })();
  }, []);

  // Quyền đổi salesBy: admin hoặc người tạo đơn
  const canChangeSalesBy = ce && (user?.role === 'admin' || user?.role === 'superadmin' || (isNew) || (fm.createdBy && fm.createdBy === user?.username));

  // QR Cọc + QR Thanh toán
  const [preOrderCode, setPreOrderCode] = useState(initial?.orderCode || '');
  const [showPayQR, setShowPayQR] = useState(false);
  const [payQRAccounts, setPayQRAccounts] = useState(null);
  const [showDepositQR, setShowDepositQR] = useState(false);
  const [depositQRUsed, setDepositQRUsed] = useState(false); // đã generate QR → cảnh báo khi hủy
  const [depositBankAccounts, setDepositBankAccounts] = useState(null);

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
    if (!fm.customerId || !useAPI) { setCustomerDebt(0); setDebtDetail([]); setCustomerCredits([]); return; }
    import('../api.js').then(api => {
      api.fetchCustomerUnpaidDebt(fm.customerId).then(d => setCustomerDebt(d)).catch(() => setCustomerDebt(0));
      api.fetchCustomerDebtDetail(fm.customerId).then(d => setDebtDetail(d || [])).catch(() => setDebtDetail([]));
      api.fetchCustomerCredits(fm.customerId).then(c => setCustomerCredits(c || [])).catch(() => setCustomerCredits([]));
    });
  }, [fm.customerId, useAPI]);

  // ── Realtime: customer_credits ──
  useEffect(() => {
    if (!fm.customerId || !useAPI) return;
    let channel;
    (async () => {
      try {
        const { subscribeCustomerCredits, fetchCustomerCredits, fetchCustomerUnpaidDebt, fetchCustomerDebtDetail } = await import('../api.js');
        const { debouncedCallback } = await import('../utils.js');
        const refresh = debouncedCallback(() => {
          fetchCustomerCredits(fm.customerId).then(c => setCustomerCredits(c || [])).catch(() => {});
          fetchCustomerUnpaidDebt(fm.customerId).then(d => setCustomerDebt(d)).catch(() => {});
          fetchCustomerDebtDetail(fm.customerId).then(d => setDebtDetail(d || [])).catch(() => {});
        }, 500);
        channel = subscribeCustomerCredits(refresh, fm.customerId);
      } catch {}
    })();
    return () => { if (channel) channel.unsubscribe(); };
  }, [fm.customerId, useAPI]);

  // Shared Pool: trả bundles + measurements chưa save về pool khi rời form
  const savedOrderRef = useRef(false);
  useEffect(() => {
    return () => {
      if (!savedOrderRef.current) {
        const ids = [...lockedBundleIds.current];
        if (ids.length > 0) {
          import('../api.js').then(api => ids.forEach(id => api.releaseHoldBundle(id).catch(() => {})));
        }
        const meass = assignedMeasRef.current;
        if (meass.length > 0) {
          import('../api.js').then(api =>
            meass.forEach(m => api.unlinkMeasurement(m.id).catch(() => {}))
          );
        }
      }
    };
  }, []); // eslint-disable-line

  // Lịch sử mua hàng của khách đã chọn
  const [custHistory, setCustHistory] = useState([]);
  const [historyDetailId, setHistoryDetailId] = useState(null);
  const [historyDetail, setHistoryDetail] = useState(null);
  useEffect(() => {
    if (!fm.customerId || !useAPI) { setCustHistory([]); return; }
    (async () => {
      try {
        const { fetchOrders } = await import('../api.js');
        const all = await fetchOrders();
        const hist = all.filter(o => o.customerId === fm.customerId && o.status !== 'Đã hủy').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setCustHistory(hist);
      } catch { setCustHistory([]); }
    })();
  }, [fm.customerId, useAPI]);

  // Fetch chi tiết đơn cho dialog xem nhanh
  useEffect(() => {
    if (!historyDetailId) { setHistoryDetail(null); return; }
    (async () => {
      try {
        const { fetchOrderDetail } = await import('../api.js');
        const d = await fetchOrderDetail(historyDetailId);
        setHistoryDetail(d);
      } catch { setHistoryDetail(null); }
    })();
  }, [historyDetailId]);

  const addBundles = (newItems) => {
    setItems(prev => {
      const existing = new Set(prev.map(i => i.bundleId).filter(Boolean));
      const toAdd = newItems.filter(ni => !existing.has(ni.bundleId));
      // Shared Pool: hold bundles ngay → rời pool → realtime thông báo tất cả tab
      if (useAPI) {
        toAdd.forEach(ni => {
          if (ni.bundleId) {
            import('../api.js').then(api => api.holdBundle(ni.bundleId).catch(() => {}));
            lockedBundleIds.current.add(ni.bundleId);
          }
        });
      }
      return [...prev, ...toAdd];
    });
    setShowBundleSel(false);
  };

  const addRawWoodItems = (newItems) => {
    setItems(prev => {
      const existingInsp = new Set(prev.filter(i => i.inspectionItemId).map(i => i.inspectionItemId));
      let result = [...prev];
      for (const ni of newItems) {
        // PL mode: skip duplicates
        if (ni.inspectionItemId && existingInsp.has(ni.inspectionItemId)) continue;
        // Weight mode: cộng dồn nếu cùng container
        if (ni.itemType === 'raw_wood_weight') {
          const contId = String(ni.containerId || ni.rawWoodData?.containerId);
          const existIdx = result.findIndex(i => i.itemType === 'raw_wood_weight' && String(i.containerId || i.rawWoodData?.containerId) === contId);
          if (existIdx >= 0) {
            const old = result[existIdx];
            const oldKg = old.rawWoodData?.weightKg || 0;
            const newKg = ni.rawWoodData?.weightKg || 0;
            const totalKg = oldKg + newKg;
            const oldPcs = old.boardCount || old.rawWoodData?.pieceCount || 0;
            const newPcs = ni.boardCount || ni.rawWoodData?.pieceCount || 0;
            const totalPcs = oldPcs + newPcs;
            const vol = totalKg / 1000;
            const price = ni.unitPrice; // dùng giá mới nhất
            result[existIdx] = {
              ...old,
              boardCount: totalPcs,
              volume: vol,
              unitPrice: price,
              amount: Math.round(vol * (price / 1000000) * 1000000),
              rawWoodData: { ...old.rawWoodData, pieceCount: totalPcs, weightKg: totalKg },
              withdrawalData: { ...ni.withdrawalData, pieceCount: totalPcs, weightKg: totalKg },
            };
            continue;
          }
        }
        result.push(ni);
      }
      return result;
    });
    setShowRawWoodSel(false);
  };

  const addContainerItems = (newItems) => {
    setItems(prev => {
      const existingCont = new Set(prev.filter(i => i.containerId).map(i => i.containerId));
      return [...prev, ...newItems.filter(ni => !existingCont.has(ni.containerId))];
    });
    setShowContSel(false);
  };

  const updateItem = (idx, key, val) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const updated = { ...it, [key]: val };
      // Gỗ thông NK: sửa số tấm → tự tính volume = tấm × dày × rộng × dài / 10⁹
      if (key === 'boardCount' && updated.woodId === 'pine') {
        const t = parseFloat(updated.attributes?.thickness) || 0;
        const w = parseFloat(updated.attributes?.width) || 0;
        const l = parseFloat(updated.attributes?.length) || 0;
        if (t && w && l) {
          updated.volume = parseFloat(((parseInt(val) || 0) * t * w * l / 1e9).toFixed(4));
        }
      }
      if (key === 'boardCount' || key === 'volume' || key === 'unitPrice' || key === 'unit') {
        const qty = key === 'volume' ? parseFloat(val) || 0 : parseFloat(updated.volume) || 0;
        const up = key === 'unitPrice' ? parseFloat(val) || 0 : parseFloat(updated.unitPrice) || 0;
        updated.amount = Math.round(up * qty);
      }
      return updated;
    }));
  };

  const removeItem = (idx) => {
    const item = items[idx];
    // Shared Pool: trả bundle về pool
    if (item.bundleId && useAPI) {
      import('../api.js').then(api => api.releaseHoldBundle(item.bundleId).catch(() => {}));
      lockedBundleIds.current.delete(item.bundleId);
    }
    // Nếu là kiện lẻ đã gán → trả về DS chờ gán
    if (item.measurementId) {
      const meas = assignedMeasurements.find(m => m.id === item.measurementId);
      if (meas) {
        setMeasurements(prev => [meas, ...prev]);
        setAssignedMeasurements(prev => prev.filter(m => m.id !== item.measurementId));
      }
      // Gỡ liên kết trên DB → status về 'chờ gán'
      if (useAPI) {
        import('../api.js').then(api => {
          api.unlinkMeasurement(item.measurementId).then(() => {
            // Nếu không tìm thấy trong local state (VD: sửa đơn đã lưu) → fetch lại từ DB
            if (!meas) {
              api.fetchBundleMeasurements().then(data => setMeasurements(data)).catch(() => {});
            }
          }).catch(() => {});
        });
      }
    }
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  // ── Drag reorder items ──
  const dragIdx = useRef(null);
  const dragOverIdx = useRef(null);
  const [dragOverState, setDragOverState] = useState(null);
  const onDragStart = (idx) => { dragIdx.current = idx; };
  const onDragEnter = (idx) => { dragOverIdx.current = idx; setDragOverState(idx); };
  const onDragEnd = () => {
    const from = dragIdx.current, to = dragOverIdx.current;
    if (from !== null && to !== null && from !== to) {
      setItems(prev => {
        const arr = [...prev];
        const [moved] = arr.splice(from, 1);
        arr.splice(to, 0, moved);
        return arr;
      });
    }
    dragIdx.current = null; dragOverIdx.current = null; setDragOverState(null);
  };

  const addSvcOfType = (type) => {
    const vol = totalM3 || 0;
    const defaults = {
      xe_say:     { type, volume: vol, unitPrice: 0 },
      luoc_go:    { type, volume: vol },
      van_chuyen: { type, carrierId: '', carrierName: '', amount: 0 },
      other:      { type, description: '', amount: 0, otherMode: 'fixed', volume: vol, unitPrice: 0 },
    };
    const newSvc = defaults[type] || { type, description: '', amount: 0 };
    setServices(prev => [...prev, { ...newSvc, amount: calcSvcAmount(newSvc) }]);
  };
  const updateSvc = (idx, newSvc) => {
    setServices(prev => prev.map((s, i) => i === idx ? { ...newSvc, amount: calcSvcAmount(newSvc) } : s));
  };
  const removeSvc = (idx) => setServices(prev => prev.filter((_, i) => i !== idx));

  // V-27: mặt hàng nào có giá khác bảng giá / giá định giá
  const CONT_PRICE_TOLERANCE = 100000; // container: chênh ≥ 100k mới cảnh báo
  const belowPriceItems = items.filter(it => {
    if (!it.listPrice || it.listPrice <= 0) return false;
    if (it.itemType === 'container') return Math.abs(it.unitPrice - it.listPrice) >= CONT_PRICE_TOLERANCE;
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
      const { createOrder, updateOrder, recordPayment } = await import('../api.js');
      const totalVol = items.reduce((s, it) => s + (parseFloat(it.volume) || 0), 0);
      const vcSvc = services.find(s => s.type === 'van_chuyen');
      const syncCarrier = { shippingCarrier: vcSvc ? (vcSvc.carrierName || '') : '' };
      const orderData = { ...fm, ...syncCarrier, subtotal, taxAmount, totalAmount: total, totalVolume: totalVol, deposit: parseFloat(fm.deposit) || 0, debt: parseFloat(fm.debt) || 0, shippingFee: 0, targetStatus: effectiveStatus, ...(preOrderCode && isNew ? { orderCode: preOrderCode } : {}), ...(isNew ? { createdBy: user?.username || '' } : { updatedBy: user?.username || '' }) };
      const svcList = services.map(s => ({ ...s, amount: calcSvcAmount(s) })).filter(s => s.amount > 0 || (s.type === 'other' && s.description));
      const r = initial?.id ? await updateOrder(initial.id, orderData, items, svcList) : await createOrder(orderData, items, svcList);
      if (r.error) { notify('Lỗi: ' + r.error, false); setSaving(false); return; }
      if (effectiveStatus === 'Đã thanh toán') {
        const ordId = r.id || initial?.id;
        if (ordId) {
          // recordPayment sẽ tính fullyPaid → deductBundlesForOrderId tự động
          await recordPayment(ordId, { amount: toPay > 0 ? toPay : 0, method: payMethod || 'Tiền mặt', note: 'Thanh toán khi tạo đơn' });
        }
      }
      // Khấu trừ customer credits nếu đã áp dụng
      if (appliedCredits.length > 0) {
        const ordId = r.id || initial?.id;
        const { useCustomerCredit } = await import('../api.js');
        for (const ac of appliedCredits) {
          await useCustomerCredit(ac.creditId, ordId, ac.amount).catch(() => {});
        }
      }
      // Shared Pool: bundle đã rời pool từ holdBundle, không cần unlock
      lockedBundleIds.current.clear();
      // Cập nhật order_id cho measurements đã gán
      savedOrderRef.current = true;
      const savedOrderId = r.id || initial?.id;
      if (savedOrderId && assignedMeasurements.length > 0) {
        const { assignMeasurementToOrder } = await import('../api.js');
        for (const m of assignedMeasurements) {
          await assignMeasurementToOrder(m.id, savedOrderId, null).catch(() => {});
        }
      }
      // Sync contact vào customer.contacts nếu công ty
      if (fm.contactName && selCust?.customerType === 'company') {
        try {
          const { updateCustomerContacts } = await import('../api.js');
          const rawName = fm.contactName.replace(/^(Anh|Chị|Ông|Bà|Cô|Chú)\s+/i, '').trim();
          const sal = fm._newContactSal || fm.contactName.replace(rawName, '').trim() || '';
          const existing = [...(selCust.contacts || [])];
          const idx = existing.findIndex(c => c.name === rawName || (c.salutation + ' ' + c.name).trim() === fm.contactName);
          const today = new Date().toISOString().slice(0, 10);
          if (idx >= 0) { existing[idx].lastUsed = today; existing[idx].phone = fm.contactPhone || existing[idx].phone; }
          else existing.push({ name: rawName, salutation: sal, phone: fm.contactPhone || '', lastUsed: today });
          await updateCustomerContacts(selCust.id, existing);
          // Update local customer data
          if (typeof setCustomers === 'function') setCustomers(prev => prev.map(c => c.id === selCust.id ? { ...c, contacts: existing } : c));
        } catch {}
      }
      const msg = effectiveStatus === 'Nháp' ? 'Đã lưu nháp'
        : effectiveStatus === 'Chờ duyệt' ? `Đã tạo đơn ${r.orderCode} — chờ admin duyệt giá`
        : effectiveStatus === 'Đã thanh toán' ? `Đã tạo đơn & ghi thu ${fmtMoney(toPay)} (${payMethod || 'Tiền mặt'})`
        : `Đã tạo đơn ${r.orderCode}`;
      notify(initial?.id ? 'Đã cập nhật đơn hàng' : msg);
      // Tạo mới + Chưa thanh toán → ở lại form (chuyển sang edit mode)
      if (isNew && effectiveStatus === 'Chưa thanh toán' && onCreatedStay) {
        onCreatedStay(r);
      } else {
        onDone(r);
      }
    } catch (e) { notify('Lỗi: ' + e.message, false); }
    setSaving(false);
  };

  const handleCancel = () => {
    if (!isNew) { onDone(null); return; }
    tryLeave();
  };

  const inpSt = { padding: '7px 9px', borderRadius: 6, border: '1.5px solid var(--bd)', fontSize: '0.8rem', outline: 'none', background: 'var(--bg)', width: '100%', boxSizing: 'border-box' };
  const secTitle = (t) => <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--brl)', textTransform: 'uppercase', marginBottom: 10, marginTop: 4, letterSpacing: '0.06em' }}>{t}</div>;
  const ths = { padding: '6px 8px', background: 'var(--bgh)', color: 'var(--brl)', fontWeight: 700, fontSize: '0.6rem', textTransform: 'uppercase', borderBottom: '2px solid var(--bds)', whiteSpace: 'nowrap' };

  return (
    <div>
      {showNewCustDlg && (
        <Dialog open={true} onClose={() => setShowNewCustDlg(false)} title="+ Thêm khách hàng" width={420} showFooter okLabel="Thêm"
          onOk={async () => {
            if (!newCust.name.trim()) return notify('Vui lòng nhập họ tên', false);
            if (!newCust.phone1.trim()) return notify('Vui lòng nhập SĐT', false);
            if (!newCust.nickname.trim()) return notify('Vui lòng nhập địa chỉ thường gọi', false);
            setNewCustSaving(true);
            try {
              const { addCustomer, fetchCustomers } = await import('../api.js');
              const r = await addCustomer({ ...newCust, address: newCust.nickname, createdBy: user?.username || '' });
              if (r.error) { notify('Lỗi: ' + r.error, false); setNewCustSaving(false); return; }
              const fresh = await fetchCustomers();
              if (typeof setCustomers === 'function') setCustomers(fresh);
              const added = fresh.find(c => c.customerCode === r.customerCode);
              if (added) f('customerId')(added.id);
              setShowNewCustDlg(false);
              notify('Đã thêm khách hàng');
            } catch (e) { notify('Lỗi: ' + e.message, false); }
            setNewCustSaving(false);
          }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
              {[['individual', '👤 Cá nhân'], ['company', '🏢 Công ty']].map(([t, label]) => {
                const active = (newCust.customerType || 'individual') === t;
                return <button key={t} onClick={() => setNewCust(p => ({ ...p, customerType: t, salutation: t === 'company' ? '' : p.salutation }))}
                  style={{ padding: '4px 12px', borderRadius: 5, border: active ? '1.5px solid var(--ac)' : '1px solid var(--bd)', background: active ? 'var(--acbg)' : 'transparent', color: active ? 'var(--ac)' : 'var(--tm)', cursor: 'pointer', fontWeight: active ? 700 : 400, fontSize: '0.74rem' }}>{label}</button>;
              })}
            </div>
            {(newCust.customerType || 'individual') === 'individual' ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ width: 100 }}>
                  <label style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--brl)', display: 'block', marginBottom: 3, textTransform: 'uppercase' }}>Xưng hô</label>
                  <select value={newCust.salutation} onChange={e => setNewCust(p => ({ ...p, salutation: e.target.value }))} style={{ ...inpSt, cursor: 'pointer' }}>
                    <option value="">—</option>
                    <option>Anh</option><option>Chị</option><option>Ông</option><option>Bà</option><option>Cô</option><option>Chú</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--brl)', display: 'block', marginBottom: 3, textTransform: 'uppercase' }}>Họ tên *</label>
                  <input value={newCust.name} onChange={e => setNewCust(p => ({ ...p, name: e.target.value }))} placeholder="Nguyễn Văn A" style={inpSt} autoFocus />
                </div>
              </div>
            ) : (
              <div>
                <label style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--brl)', display: 'block', marginBottom: 3, textTransform: 'uppercase' }}>Tên công ty *</label>
                <input value={newCust.name} onChange={e => setNewCust(p => ({ ...p, name: e.target.value, companyName: e.target.value }))} placeholder="Công ty TNHH ABC" style={inpSt} autoFocus />
              </div>
            )}
            <div>
              <label style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--brl)', display: 'block', marginBottom: 3, textTransform: 'uppercase' }}>Số điện thoại *</label>
              <input value={newCust.phone1} onChange={e => setNewCust(p => ({ ...p, phone1: e.target.value }))} placeholder="0912 345 678" style={inpSt} />
            </div>
            <div>
              <label style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--brl)', display: 'block', marginBottom: 3, textTransform: 'uppercase' }}>Địa chỉ thường gọi *</label>
              <input value={newCust.nickname} onChange={e => setNewCust(p => ({ ...p, nickname: e.target.value }))} placeholder="VD: Hưng Yên, Đông Anh..." style={inpSt} />
            </div>
            {(newCust.customerType || 'individual') === 'company' && (
              <div>
                <label style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--brl)', display: 'block', marginBottom: 3, textTransform: 'uppercase' }}>Mã số thuế</label>
                <input value={newCust.taxCode || ''} onChange={e => setNewCust(p => ({ ...p, taxCode: e.target.value }))} placeholder="0102241163" style={inpSt} />
              </div>
            )}
            {(newCust.customerType || 'individual') !== 'company' && (
              <div>
                <label style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--brl)', display: 'block', marginBottom: 3, textTransform: 'uppercase' }}>Tên công ty</label>
                <input value={newCust.companyName} onChange={e => setNewCust(p => ({ ...p, companyName: e.target.value }))} placeholder="Công ty TNHH..." style={inpSt} />
              </div>
            )}
          </div>
        </Dialog>
      )}
      {showLeaveDlg && (
        <Dialog open={true} onClose={() => setShowLeaveDlg(false)} title="Rời trang tạo đơn?" width={400}
          onOk={() => { setShowLeaveDlg(false); handleSave('Nháp'); }} showFooter okLabel="💾 Lưu nháp" cancelLabel="Ở lại">
          <div style={{ fontSize: '0.82rem', color: 'var(--ts)', marginBottom: 8 }}>
            Đơn hàng đang có dữ liệu chưa lưu. Bạn muốn lưu nháp hay rời đi?
          </div>
          {depositQRUsed && (
            <div style={{ padding: '6px 10px', borderRadius: 5, background: '#FFF3E0', border: '1px solid #FF9800', fontSize: '0.72rem', color: '#E65100', marginBottom: 8 }}>
              ⚠ Bạn đã gửi QR cọc cho khách. Nếu không lưu, thông tin đặt cọc sẽ bị mất và giao dịch không tự đối soát được.
            </div>
          )}
          {!depositQRUsed && (
            <button onClick={() => { setShowLeaveDlg(false); onDone(null); }}
              style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1.5px solid var(--dg)', background: 'transparent', color: 'var(--dg)', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem' }}>
              ✕ Rời đi không lưu
            </button>
          )}
        </Dialog>
      )}
      {showBundleSel && <BundleSelector wts={wts} ats={ats} prices={prices} cfg={cfg} bundles={bundlesProp} onConfirm={addBundles} onClose={() => setShowBundleSel(false)} existingBundleIds={items.filter(i => i.bundleId).map(i => i.bundleId)} />}
      {showRawWoodSel && <RawWoodSelectorDlg onConfirm={addRawWoodItems} onClose={() => setShowRawWoodSel(false)} existingItems={items} />}
      {showContSel && <ContainerSelectorDlg onConfirm={addContainerItems} onClose={() => setShowContSel(false)} existingItems={items} />}
      {showXeSayGuide !== false && <XeSayGuide config={xeSayConfig} canEdit={ce} onClose={() => setShowXeSayGuide(false)} onSave={handleSaveXeSayConfig}
        onApply={(price) => { updateSvc(showXeSayGuide, { ...services[showXeSayGuide], unitPrice: price }); setShowXeSayGuide(false); }} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={handleCancel} style={{ padding: '6px 12px', borderRadius: 6, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 600 }}>← Quay lại</button>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--br)' }}>{initial?.id ? '✏️ Sửa đơn hàng' : '🛒 Tạo đơn hàng mới'}</h2>
        {items.length > 0 && (
          <div style={{ marginLeft: 'auto' }}>
            {showPrintModal && (
              <PrintModal onClose={() => setShowPrintModal(false)}
                onPrint={({ layout, hideSupplierName, hidePrice, hideNotes }) => { const _sbl = salesUsers.find(u => u.username === fm.salesBy)?.label || fm.salesBy || ''; printOrder({
                  order: { ...fm, orderCode: initial?.orderCode || 'NHÁP', paymentStatus: 'Nháp', exportStatus: 'Chưa xuất', shippingFee: parseFloat(fm.shippingFee) || 0, shippingType: fm.shippingType, shippingCarrier: fm.shippingCarrier, shippingNotes: fm.shippingNotes, driverName: fm.driverName, driverPhone: fm.driverPhone, licensePlate: fm.licensePlate, deliveryAddress: fm.deliveryAddress, estimatedArrival: fm.estimatedArrival, deposit: parseFloat(fm.deposit) || 0, debt: parseFloat(fm.debt) || 0, applyTax: fm.applyTax, notes: fm.notes, createdAt: new Date().toISOString(), salesByLabel: _sbl },
                  customer: customers.find(c => c.id === fm.customerId) || null,
                  items, services, wts, ats, cfg, vatRate, hideSupplierName, hidePrice, hideNotes, layout, measurements: assignedMeasurements
                }); }}
                onPreview={({ layout, hideSupplierName, hidePrice, hideNotes }) => { const _sbl = salesUsers.find(u => u.username === fm.salesBy)?.label || fm.salesBy || ''; printOrder({
                  order: { ...fm, orderCode: initial?.orderCode || 'NHÁP', paymentStatus: 'Nháp', exportStatus: 'Chưa xuất', shippingFee: parseFloat(fm.shippingFee) || 0, shippingType: fm.shippingType, shippingCarrier: fm.shippingCarrier, shippingNotes: fm.shippingNotes, driverName: fm.driverName, driverPhone: fm.driverPhone, licensePlate: fm.licensePlate, deliveryAddress: fm.deliveryAddress, estimatedArrival: fm.estimatedArrival, deposit: parseFloat(fm.deposit) || 0, debt: parseFloat(fm.debt) || 0, applyTax: fm.applyTax, notes: fm.notes, createdAt: new Date().toISOString(), salesByLabel: _sbl },
                  customer: customers.find(c => c.id === fm.customerId) || null,
                  items, services, wts, ats, cfg, vatRate, hideSupplierName, hidePrice, hideNotes, layout, previewOnly: true, measurements: assignedMeasurements
                }); }}
                onCopyImage={({ layout, hideSupplierName, hidePrice, hideNotes }) => { const _sbl = salesUsers.find(u => u.username === fm.salesBy)?.label || fm.salesBy || ''; const html = buildOrderHtml({
                  order: { ...fm, orderCode: initial?.orderCode || 'NHÁP', paymentStatus: 'Nháp', exportStatus: 'Chưa xuất', shippingFee: parseFloat(fm.shippingFee) || 0, shippingType: fm.shippingType, shippingCarrier: fm.shippingCarrier, shippingNotes: fm.shippingNotes, driverName: fm.driverName, driverPhone: fm.driverPhone, licensePlate: fm.licensePlate, deliveryAddress: fm.deliveryAddress, estimatedArrival: fm.estimatedArrival, deposit: parseFloat(fm.deposit) || 0, debt: parseFloat(fm.debt) || 0, applyTax: fm.applyTax, notes: fm.notes, createdAt: new Date().toISOString(), salesByLabel: _sbl },
                  customer: customers.find(c => c.id === fm.customerId) || null,
                  items, services, wts, ats, cfg, vatRate, hideSupplierName, hidePrice, hideNotes, layout
                }); return copyOrderAsImage(html, notify); }} />
            )}
            <button onClick={() => setShowPrintModal(true)} style={{ padding: '6px 14px', borderRadius: 6, border: '1.5px solid var(--bd)', background: 'var(--bgs)', color: 'var(--ts)', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 600 }}>🖨 In nháp / PDF</button>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
        {/* Khách hàng */}
        <div style={{ background: 'var(--bgc)', borderRadius: 10, border: '1.5px solid var(--bd)', padding: 16 }}>
          {secTitle('Khách hàng *')}
          <CustomerSearchSelect customers={customers} value={fm.customerId} onChange={v => f('customerId')(v)} inpSt={inpSt} />
          <button onClick={() => { setShowNewCustDlg(true); setNewCust({ salutation: '', name: '', phone1: '', nickname: '', companyName: '' }); }} style={{ fontSize: '0.72rem', color: 'var(--ac)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}>+ Khách mới</button>
          {selCust && (
            <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 6, background: 'var(--bgs)', border: '1px solid var(--bd)', fontSize: '0.76rem' }}>
              <div style={{ fontWeight: 700, color: 'var(--br)' }}>
                {selCust.customerType === 'company' && <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#2980b9', background: 'rgba(41,128,185,0.1)', padding: '1px 5px', borderRadius: 3, marginRight: 5 }}>🏢 Công ty</span>}
                {selCust.salutation && selCust.customerType !== 'company' && <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--ac)', background: 'var(--acbg)', padding: '1px 5px', borderRadius: 3, marginRight: 5 }}>{selCust.salutation}</span>}
                {selCust.name}{selCust.nickname && <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--tm)', marginLeft: 6 }}>· {selCust.nickname}</span>}
                {selCust.customerCode && <span style={{ fontSize: '0.62rem', fontWeight: 500, color: 'var(--tm)', marginLeft: 6 }}>{selCust.customerCode}</span>}
              </div>
              {selCust.taxCode && <div style={{ fontSize: '0.68rem', color: 'var(--tm)' }}>MST: {selCust.taxCode}</div>}
              {selCust.companyName && selCust.customerType !== 'company' && <div style={{ color: 'var(--ts)', fontWeight: 600 }}>{selCust.companyName}</div>}
              <div style={{ color: 'var(--ts)' }}>{selCust.address}</div>
              <div style={{ color: 'var(--tm)' }}>{selCust.phone1}</div>
            </div>
          )}
          {selCust?.customerType === 'company' && (() => {
            const contacts = selCust.contacts || [];
            const sorted = [...contacts].sort((a, b) => (b.lastUsed || '').localeCompare(a.lastUsed || ''));
            const [addingContact, setAddingContact] = [fm._addingContact, (v) => setFm(p => ({ ...p, _addingContact: v }))];
            const selectContact = (c) => setFm(p => ({ ...p, contactName: (c.salutation ? c.salutation + ' ' : '') + c.name, contactPhone: c.phone || '' }));
            // Auto-select NV gần nhất khi chọn công ty lần đầu
            if (!fm.contactName && sorted.length > 0 && !fm._contactAutoSet) {
              setTimeout(() => { selectContact(sorted[0]); setFm(p => ({ ...p, _contactAutoSet: true })); }, 0);
            }
            return (
              <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 6, background: 'rgba(41,128,185,0.04)', border: '1px solid rgba(41,128,185,0.2)', fontSize: '0.76rem' }}>
                <div style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--brl)', textTransform: 'uppercase', marginBottom: 4 }}>Người mua hàng</div>
                {sorted.length > 0 && !addingContact && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                    {sorted.map((c, i) => {
                      const label = (c.salutation ? c.salutation + ' ' : '') + c.name;
                      const active = fm.contactName === label;
                      return <button key={i} type="button" onClick={() => selectContact(c)}
                        style={{ padding: '4px 10px', borderRadius: 5, border: active ? '1.5px solid #2980b9' : '1px solid var(--bd)', background: active ? 'rgba(41,128,185,0.1)' : 'transparent', color: active ? '#2980b9' : 'var(--ts)', cursor: 'pointer', fontWeight: active ? 700 : 400, fontSize: '0.74rem' }}>
                        {label}{c.phone ? ` · ${c.phone}` : ''}{i === 0 ? ' ★' : ''}
                      </button>;
                    })}
                    <button type="button" onClick={() => setAddingContact(true)}
                      style={{ padding: '4px 10px', borderRadius: 5, border: '1px dashed var(--ac)', background: 'transparent', color: 'var(--ac)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>+ Mới</button>
                  </div>
                )}
                {(addingContact || sorted.length === 0) && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <select value={fm._newContactSal || ''} onChange={e => setFm(p => ({ ...p, _newContactSal: e.target.value }))}
                      style={{ ...inpSt, width: 75, cursor: 'pointer' }}>
                      <option value="">—</option><option>Anh</option><option>Chị</option><option>Ông</option><option>Bà</option>
                    </select>
                    <input value={fm.contactName || ''} onChange={e => f('contactName')(e.target.value)} placeholder="Họ tên..." style={{ ...inpSt, flex: 1 }} />
                    <input value={fm.contactPhone || ''} onChange={e => f('contactPhone')(e.target.value)} placeholder="SĐT..." style={{ ...inpSt, width: 120 }} />
                    {sorted.length > 0 && <button type="button" onClick={() => setAddingContact(false)}
                      style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid var(--bd)', background: 'transparent', color: 'var(--tm)', cursor: 'pointer', fontSize: '0.68rem' }}>✕</button>}
                  </div>
                )}
              </div>
            );
          })()}
          {/* V-25: cảnh báo công nợ cũ */}
          {debtDetail.length > 0 && (
            <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 8, background: '#FFF8E1', border: '1.5px solid #FFD54F', fontSize: '0.75rem', color: '#5D4037' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: '1rem' }}>⚠</span>
                <div>
                  <strong>Khách đang có công nợ:</strong>{' '}
                  <span style={{ fontFamily: 'Consolas,monospace', fontWeight: 800, color: '#E65100' }}>{fmtMoney(customerDebt)}</span>
                  <span style={{ fontSize: '0.68rem', color: '#795548', marginLeft: 6 }}>
                    từ {debtDetail.length} đơn · phát sinh {debtDetail[0]?.daysSince || 0} ngày
                  </span>
                </div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
                <thead><tr style={{ background: 'rgba(255,213,79,0.3)' }}>
                  {['Đơn hàng', 'Ngày', 'Tổng đơn', 'Đã trả', 'Còn nợ', 'Thời gian'].map(h => (
                    <th key={h} style={{ padding: '4px 6px', textAlign: h === 'Còn nợ' || h === 'Tổng đơn' || h === 'Đã trả' ? 'right' : 'left', fontWeight: 700, fontSize: '0.6rem', textTransform: 'uppercase', color: '#795548', borderBottom: '1px solid #FFD54F' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>{debtDetail.map(d => (
                  <tr key={d.orderId}>
                    <td style={{ padding: '3px 6px', fontFamily: 'Consolas,monospace', fontWeight: 700, color: '#5D4037' }}>{d.orderCode}</td>
                    <td style={{ padding: '3px 6px', whiteSpace: 'nowrap' }}>{fmtDate(d.createdAt)}</td>
                    <td style={{ padding: '3px 6px', textAlign: 'right' }}>{fmtMoney(d.totalAmount)}</td>
                    <td style={{ padding: '3px 6px', textAlign: 'right', color: 'var(--gn)' }}>{d.totalPaid > 0 ? fmtMoney(d.totalPaid) : '—'}</td>
                    <td style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 700, color: d.daysSince > (selCust?.debtDays || 30) ? '#c0392b' : '#8e44ad' }}>{fmtMoney(d.outstanding)}</td>
                    <td style={{ padding: '3px 6px', whiteSpace: 'nowrap' }}>
                      {d.daysSince > (selCust?.debtDays || 30)
                        ? <span style={{ padding: '1px 5px', borderRadius: 3, background: 'rgba(192,57,43,0.1)', color: '#c0392b', fontWeight: 700, fontSize: '0.6rem' }}>{d.daysSince} ngày</span>
                        : <span style={{ padding: '1px 5px', borderRadius: 3, background: 'rgba(142,68,173,0.1)', color: '#8e44ad', fontWeight: 700, fontSize: '0.6rem' }}>{d.daysSince} ngày</span>}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
              {total > 0 && (
                <div style={{ marginTop: 6, padding: '6px 8px', background: 'rgba(255,213,79,0.2)', borderRadius: 5, display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                  <span style={{ fontWeight: 700 }}>Tổng nợ sau đơn này</span>
                  <span style={{ fontFamily: 'Consolas,monospace', fontWeight: 800, color: '#c0392b' }}>{fmtMoney(customerDebt + total)}</span>
                </div>
              )}
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
        {/* Lịch sử mua */}
        <div style={{ background: 'var(--bgc)', borderRadius: 10, border: '1.5px solid var(--bd)', padding: '12px 14px' }}>
          {secTitle(`Lịch sử mua${custHistory.length > 0 ? ` (${custHistory.length} đơn · ${fmtMoney(custHistory.reduce((s, o) => s + (o.totalAmount || 0), 0))})` : ''}`)}
          {!fm.customerId ? (
            <div style={{ fontSize: '0.72rem', color: 'var(--tm)', fontStyle: 'italic' }}>Chọn khách hàng</div>
          ) : custHistory.length === 0 ? (
            <div style={{ fontSize: '0.72rem', color: 'var(--tm)', fontStyle: 'italic' }}>Chưa có đơn nào</div>
          ) : (<>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.66rem' }}>
              <thead><tr>
                <th style={{ padding: '1px 3px', textAlign: 'left', fontSize: '0.54rem', color: 'var(--tm)', fontWeight: 600, borderBottom: '1px solid var(--bd)' }}>Ngày</th>
                <th style={{ padding: '1px 3px', textAlign: 'left', fontSize: '0.54rem', color: 'var(--tm)', fontWeight: 600, borderBottom: '1px solid var(--bd)' }}>NV</th>
                <th style={{ padding: '1px 3px', textAlign: 'center', fontSize: '0.54rem', color: 'var(--tm)', fontWeight: 600, borderBottom: '1px solid var(--bd)' }}>TT</th>
                <th style={{ padding: '1px 3px', textAlign: 'right', fontSize: '0.54rem', color: 'var(--tm)', fontWeight: 600, borderBottom: '1px solid var(--bd)' }}>KL</th>
                <th style={{ padding: '1px 3px', textAlign: 'right', fontSize: '0.54rem', color: 'var(--tm)', fontWeight: 600, borderBottom: '1px solid var(--bd)' }}>Thành tiền</th>
                <th style={{ padding: '1px 3px', borderBottom: '1px solid var(--bd)' }}></th>
              </tr></thead>
              <tbody>
                {custHistory.slice(0, 3).map((o, i) => (
                  <tr key={o.id} style={{ background: i % 2 ? 'var(--bgs)' : '#fff' }}>
                    <td style={{ padding: '2px 3px', borderBottom: '1px solid var(--bd)', color: 'var(--tm)', whiteSpace: 'nowrap' }}>{new Date(o.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}</td>
                    <td style={{ padding: '2px 3px', borderBottom: '1px solid var(--bd)', color: 'var(--ts)', whiteSpace: 'nowrap', maxWidth: 46, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.6rem' }} title={o.salesBy || ''}>{o.salesBy || '—'}</td>
                    <td style={{ padding: '2px 3px', borderBottom: '1px solid var(--bd)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <span style={{ padding: '0 4px', borderRadius: 3, fontSize: '0.54rem', fontWeight: 700, background: o.paymentStatus === 'Đã thanh toán' ? 'rgba(50,79,39,0.1)' : o.paymentStatus === 'Đã đặt cọc' ? 'rgba(41,128,185,0.1)' : 'rgba(242,101,34,0.08)', color: o.paymentStatus === 'Đã thanh toán' ? 'var(--gn)' : o.paymentStatus === 'Đã đặt cọc' ? '#2980b9' : 'var(--ac)' }}>{o.paymentStatus === 'Đã thanh toán' ? 'Đã TT' : o.paymentStatus === 'Đã đặt cọc' ? 'Cọc' : o.paymentStatus === 'Còn nợ' ? 'Nợ' : 'Chưa'}</span>
                    </td>
                    <td style={{ padding: '2px 3px', borderBottom: '1px solid var(--bd)', textAlign: 'right', fontWeight: 600, color: 'var(--ts)', whiteSpace: 'nowrap' }}>{o.totalVolume > 0 ? o.totalVolume.toFixed(4) : '—'}</td>
                    <td style={{ padding: '2px 3px', borderBottom: '1px solid var(--bd)', textAlign: 'right', fontWeight: 700, color: 'var(--br)', whiteSpace: 'nowrap' }}>{fmtMoney(o.totalAmount)}</td>
                    <td style={{ padding: '2px 3px', borderBottom: '1px solid var(--bd)', whiteSpace: 'nowrap' }}>
                      <span onClick={() => setHistoryDetailId(o.id)} style={{ color: 'var(--ac)', fontSize: '0.56rem', cursor: 'pointer', fontWeight: 600 }}>Chi tiết</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {custHistory.length > 3 && (
              <div style={{ textAlign: 'right', marginTop: 3 }}>
                <span onClick={() => { if (window.confirm('Lưu đơn nháp trước khi xem lịch sử khách hàng?')) { handleSave('Nháp').then(() => {}); } }}
                  style={{ fontSize: '0.64rem', color: 'var(--ac)', cursor: 'pointer', fontWeight: 600 }}>Xem thêm {custHistory.length - 3} đơn ↗</span>
              </div>
            )}
          </>)}
        </div>
        {/* NV bán + Ghi chú */}
        <div style={{ background: 'var(--bgc)', borderRadius: 10, border: '1.5px solid var(--bd)', padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            {secTitle('Nhân viên bán')}
            {canChangeSalesBy ? (
              <select value={fm.salesBy || ''} onChange={e => f('salesBy')(e.target.value)} style={{ ...inpSt, cursor: 'pointer', fontSize: '0.74rem' }}>
                <option value="">—</option>
                {salesUsers.map(u => <option key={u.username} value={u.username}>{u.label || u.username}</option>)}
              </select>
            ) : (
              <div style={{ ...inpSt, background: 'var(--bgs)', color: 'var(--ts)', fontSize: '0.74rem' }}>{salesUsers.find(u => u.username === fm.salesBy)?.label || fm.salesBy || '—'}</div>
            )}
          </div>
          <div style={{ flex: 1 }}>
            {secTitle('Ghi chú')}
            <textarea value={fm.notes} onChange={e => f('notes')(e.target.value)} rows={2} placeholder="Ghi chú..."
              style={{ ...inpSt, resize: 'vertical', fontFamily: 'inherit', fontSize: '0.74rem' }} />
          </div>
        </div>
      </div>

      {/* Sản phẩm */}
      <div style={{ background: 'var(--bgc)', borderRadius: 10, border: '1.5px solid var(--bd)', padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          {secTitle('Sản phẩm')}
          <div style={{ display: 'flex', gap: 4 }}>
            {[['bundle', '📦 Kiện gỗ', 'var(--ac)'], ['rawwood', '🪵 Gỗ NL', '#2980b9'], ['container', '🚢 Nguyên cont', '#8E44AD'], ['measurement', '📐 Kiện lẻ soạn', '#27ae60']].map(([key, label, color]) => {
              const active = pickerTab === key;
              return <button key={key} onClick={() => { setPickerTab(active ? null : key); if (key === 'measurement') setShowMeasPanel(!active); else setShowMeasPanel(false); }}
                style={{ padding: '5px 12px', borderRadius: 6, border: active ? `2px solid ${color}` : `1.5px solid var(--bd)`, background: active ? `${color}11` : 'transparent', color: active ? color : 'var(--ts)', cursor: 'pointer', fontWeight: active ? 700 : 500, fontSize: '0.74rem', position: 'relative' }}>
                {label}
                {key === 'measurement' && measCount > 0 && <span style={{ position: 'absolute', top: -6, right: -6, background: '#e74c3c', color: '#fff', fontSize: '0.58rem', fontWeight: 800, borderRadius: 10, minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{measCount}</span>}
              </button>;
            })}
          </div>
        </div>
        {items.length === 0 ? <div style={{ padding: '16px', textAlign: 'center', color: 'var(--tm)', fontSize: '0.8rem' }}>Chưa có sản phẩm. Chọn kiện gỗ, gỗ nguyên liệu, hoặc nguyên container.</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
              <thead><tr>
                {['#', 'Mã', 'Loại gỗ & Thông tin', 'SL', 'KL', 'ĐV', 'Đơn giá (đ)', 'Thành tiền', ''].map(h => <th key={h} style={ths}>{h}</th>)}
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
                    <tr key={idx} onDragEnter={() => onDragEnter(idx)} onDragOver={e => e.preventDefault()} style={{ background: idx % 2 ? 'var(--bgs)' : '#fff', opacity: dragOverState === idx ? 0.5 : 1, borderTop: dragOverState === idx ? '2px solid var(--ac)' : 'none' }}>
                      <td draggable onDragStart={() => onDragStart(idx)} onDragEnd={onDragEnd} style={{ padding: '2px 4px', borderBottom: '1px solid var(--bd)', cursor: 'grab', textAlign: 'center', userSelect: 'none', width: 28 }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--br)', lineHeight: 1 }}>{idx + 1}</div>
                        <div style={{ fontSize: '0.6rem', color: 'var(--tm)', lineHeight: 1 }}>⠿</div>
                      </td>
                      <td style={{ padding: '5px 6px', borderBottom: '1px solid var(--bd)', whiteSpace: 'nowrap' }}>
                        {it.itemType === 'raw_wood' || it.itemType === 'raw_wood_weight' ? (
                          <><div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2980b9', fontSize: '0.78rem' }}>{it.rawWoodData?.pieceCode || it.rawWoodData?.containerCode || '—'}</div><div style={{ fontSize: '0.58rem', color: 'var(--tm)' }}><span style={{ padding: '1px 5px', borderRadius: 3, background: 'rgba(41,128,185,0.1)', color: '#2980b9', fontWeight: 700, fontSize: '0.56rem' }}>{it.itemType === 'raw_wood_weight' ? 'CÂN' : 'NL'}</span> {it.rawWoodData?.containerCode || ''}</div></>
                        ) : it.itemType === 'container' ? (
                          <><div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#8E44AD', fontSize: '0.78rem' }}>{it.rawWoodData?.containerCode || '—'}</div><div style={{ fontSize: '0.58rem' }}><span style={{ padding: '1px 5px', borderRadius: 3, background: 'rgba(142,68,173,0.1)', color: '#8E44AD', fontWeight: 700, fontSize: '0.56rem' }}>CONT</span></div></>
                        ) : (
                          it.supplierBundleCode
                            ? <><div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--br)' }}>{it.supplierBundleCode}</div><div style={{ fontFamily: 'monospace', fontSize: '0.62rem', color: 'var(--tm)' }}>{it.bundleCode}</div></>
                            : <div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--br)' }}>{it.bundleCode}</div>
                        )}
                      </td>
                      <td style={{ padding: '5px 6px', borderBottom: '1px solid var(--bd)' }}>
                        {it.itemType === 'raw_wood' || it.itemType === 'raw_wood_weight' ? (
                          <><div style={{ fontWeight: 700 }}>{it.rawWoodData?.woodTypeName || w?.name || '—'}</div><div style={{ fontSize: '0.68rem', color: 'var(--tm)' }}>{it.itemType === 'raw_wood_weight' ? (() => { const wkg = it.rawWoodData?.weightKg || 0; return `${it.rawWoodData?.pieceCount || it.boardCount || 0} cây · ${wkg >= 1000 ? (wkg / 1000).toFixed(3) + ' tấn' : wkg + 'kg'}`; })() : ''}{it.itemType === 'raw_wood' ? (it.rawWoodData?.circumferenceCm ? `V${it.rawWoodData.circumferenceCm}cm` : it.rawWoodData?.diameterCm ? `Ø${it.rawWoodData.diameterCm}cm` : '') + (it.rawWoodData?.widthCm ? `${it.rawWoodData.widthCm}×${it.rawWoodData?.thicknessCm || ''}cm` : '') + (it.rawWoodData?.lengthM ? ` × ${it.rawWoodData.lengthM}m` : '') + (it.rawWoodData?.quality ? ` · ${it.rawWoodData.quality}` : '') : ''}{it.refVolume != null && it.volume != it.refVolume ? ` (ref: ${it.refVolume})` : ''}</div></>
                        ) : it.itemType === 'container' ? (
                          <><div style={{ fontWeight: 700 }}>{it.rawWoodData?.woodTypeName || '—'}</div><div style={{ fontSize: '0.68rem', color: 'var(--tm)' }}>Nguyên container{it.rawWoodData?.pieceCount ? ` · ${it.rawWoodData.pieceCount} cây` : ''}{it.rawWoodData?.nccName ? ` · ${it.rawWoodData.nccName}` : ''}{it.refVolume != null && it.volume != it.refVolume ? ` (NCC: ${it.refVolume})` : ''}</div></>
                        ) : (
                          <><div style={{ fontWeight: 700 }}>{w?.name}</div><div style={{ fontSize: '0.68rem', color: 'var(--tm)' }}>{fmtItemAttrs(it, cfg, ats)}</div></>
                        )}
                      </td>
                      <td style={{ padding: '5px 4px', borderBottom: '1px solid var(--bd)', whiteSpace: 'nowrap' }}>
                        <input type="number" min="0" value={it.boardCount} onChange={e => updateItem(idx, 'boardCount', e.target.value)} style={{ width: 60, padding: '4px 6px', borderRadius: 4, border: '1px solid var(--bd)', fontSize: '0.76rem', textAlign: 'right', outline: 'none' }} />
                      </td>
                      <td style={{ padding: '5px 4px', borderBottom: '1px solid var(--bd)', whiteSpace: 'nowrap' }}>
                        <input type="text" inputMode="decimal" key={`vol-${idx}-${it.volume}`} defaultValue={(parseFloat(it.volume) || 0).toFixed(4)}
                          onBlur={e => { const v = parseFloat(e.target.value) || 0; e.target.value = v.toFixed(4); updateItem(idx, 'volume', v); }}
                          onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
                          style={{ width: 80, padding: '4px 6px', borderRadius: 4, border: '1px solid var(--bd)', fontSize: '0.76rem', textAlign: 'right', outline: 'none', fontVariantNumeric: 'tabular-nums' }} />
                      </td>
                      <td style={{ padding: '5px 4px', borderBottom: '1px solid var(--bd)', whiteSpace: 'nowrap' }}>
                        <select value={it.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} style={{ padding: '4px 5px', borderRadius: 4, border: '1px solid var(--bd)', fontSize: '0.74rem', outline: 'none', background: 'var(--bgc)' }}>
                          <option value="m3">m³</option><option value="m2">m²</option>{(it.itemType === 'raw_wood' || it.itemType === 'container' || it.itemType === 'raw_wood_weight') && <option value="ton">tấn</option>}
                        </select>
                      </td>
                      <td style={{ padding: '5px 4px', borderBottom: '1px solid var(--bd)', whiteSpace: 'nowrap' }}>
                        <NumInput value={it.unitPrice ?? 0} onChange={n => updateItem(idx, 'unitPrice', n)} style={{ width: 100, padding: '4px 6px', borderRadius: 4, border: '1.5px solid ' + (priceChanged ? 'var(--ac)' : 'var(--bd)'), fontSize: '0.76rem', textAlign: 'right', outline: 'none', color: priceChanged ? 'var(--ac)' : 'inherit' }} />
                        {m2 && it.listPrice && <div style={{ fontSize: '0.58rem', color: 'var(--tm)', whiteSpace: 'nowrap' }}>lẻ: {fmtMoney(it.listPrice)}{it.listPrice2 ? ` / NK: ${fmtMoney(it.listPrice2)}` : ''}</div>}
                        {!m2 && priceChanged && <div style={{ fontSize: '0.58rem', color: 'var(--ac)', whiteSpace: 'nowrap' }}>⚠ Bảng giá: {fmtMoney(it.listPrice)}</div>}
                      </td>
                      <td style={{ padding: '5px 6px', borderBottom: '1px solid var(--bd)', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmtMoney(it.amount)}</td>
                      <td style={{ padding: '5px 4px', borderBottom: '1px solid var(--bd)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button onClick={() => removeItem(idx)} style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid var(--dg)', background: 'transparent', color: 'var(--dg)', cursor: 'pointer', fontSize: '0.7rem' }}>✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {items.length > 0 && (() => {
              const totalBoards = items.reduce((s, it) => s + (parseInt(it.boardCount) || 0), 0);
              const totalVolume = items.reduce((s, it) => s + (parseFloat(it.volume) || 0), 0).toFixed(4);
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
        {/* Inline product picker */}
        {pickerTab && (
          <div style={{ borderTop: '1.5px solid var(--bd)', marginTop: 10, paddingTop: 10 }}>
            {pickerTab === 'bundle' && <BundleSelector inline wts={wts} ats={ats} prices={prices} cfg={cfg} bundles={bundlesProp} onConfirm={(selected) => { addBundles(selected); }} onClose={() => setPickerTab(null)} existingBundleIds={items.filter(i => i.bundleId).map(i => i.bundleId)} />}
            {pickerTab === 'rawwood' && <RawWoodSelectorDlg inline onConfirm={(newItems) => { addRawWoodItems(newItems); }} onClose={() => setPickerTab(null)} existingItems={items} />}
            {pickerTab === 'container' && <ContainerSelectorDlg inline onConfirm={(newItems) => { addContainerItems(newItems); }} onClose={() => setPickerTab(null)} existingItems={items} />}
            {pickerTab === 'measurement' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#27ae60', textTransform: 'uppercase', letterSpacing: 0.5 }}>DS kiện lẻ vừa soạn</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {measurements.length > 0 && (
                  <button onClick={() => { setMeasSelectMode(p => !p); setMeasSelected(new Set()); }}
                    style={{ padding: '3px 10px', borderRadius: 5, border: '1px solid var(--bd)', background: measSelectMode ? 'rgba(231,76,60,0.08)' : 'transparent', color: measSelectMode ? '#e74c3c' : 'var(--tm)', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 600 }}>
                    {measSelectMode ? 'Hủy chọn' : 'Chọn xóa'}
                  </button>
                )}
                {measSelectMode && measSelected.size > 0 && (
                  <button onClick={() => { if (window.confirm('Xóa ' + measSelected.size + ' kiện lẻ đã chọn?')) handleDeleteMeasurements([...measSelected]); }} disabled={measDeleting}
                    style={{ padding: '3px 10px', borderRadius: 5, border: '1px solid #e74c3c', background: 'rgba(231,76,60,0.1)', color: '#e74c3c', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 700 }}>
                    {measDeleting ? 'Đang xóa...' : `Xóa ${measSelected.size} kiện`}
                  </button>
                )}
                <button onClick={() => { setShowMeasPanel(false); setPickerTab(null); }}
                  style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid var(--bd)', background: 'transparent', color: 'var(--tm)', cursor: 'pointer', fontSize: '0.72rem' }}>✕</button>
              </div>
            </div>
            {measurements.length === 0 ? (
              <div style={{ padding: 12, textAlign: 'center', color: 'var(--tm)', fontSize: '0.76rem' }}>Không có kiện lẻ nào chờ gán</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {measurements.map(m => {
                  const dt = m.created_at ? new Date(m.created_at) : null;
                  const dtStr = dt ? `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}` : '';
                  return (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--bd)', background: '#fff' }}>
                      {measSelectMode && (
                        <input type="checkbox" checked={measSelected.has(m.id)}
                          onChange={() => setMeasSelected(prev => { const n = new Set(prev); n.has(m.id) ? n.delete(m.id) : n.add(m.id); return n; })}
                          style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#e74c3c' }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <input type="text" defaultValue={m.bundle_code}
                            onBlur={e => { const v = e.target.value.trim(); if (v && v !== m.bundle_code) setMeasurements(prev => prev.map(x => x.id === m.id ? { ...x, bundle_code: v } : x)); }}
                            onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
                            style={{ fontWeight: 800, color: 'var(--br)', fontFamily: 'monospace', fontSize: '0.82rem', border: '1px dashed var(--bd)', borderRadius: 4, padding: '1px 6px', width: 130, background: 'transparent', outline: 'none' }}
                            title="Sửa mã kiện" />
                          {m.wood_type && <span style={{ fontSize: '0.7rem', color: 'var(--ts)' }}>· {m.wood_type}</span>}
                          {m.thickness > 0 && <span style={{ fontSize: '0.7rem', color: 'var(--ts)' }}>· {m.thickness}F</span>}
                          {m.quality && <span style={{ fontSize: '0.7rem', color: 'var(--ts)' }}>· {m.quality}</span>}
                        </div>
                        <div style={{ fontSize: '0.66rem', color: 'var(--tm)', marginTop: 2 }}>
                          {m.board_count} tấm · {(m.volume || 0).toFixed(4)} m³ · {m.measured_by} · {dtStr}
                        </div>
                      </div>
                      {!measSelectMode && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => setMeasDetail(m)} title="Xem chi tiết"
                            style={{ padding: '4px 8px', borderRadius: 5, border: '1px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontSize: '0.68rem' }}>👁</button>
                          <button onClick={() => handleAssignMeasurement(m)}
                            style={{ padding: '4px 10px', borderRadius: 5, border: '1.5px solid #27ae60', background: 'rgba(39,174,96,0.08)', color: '#27ae60', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 700 }}>
                            + Gán
                          </button>
                          <button onClick={() => { if (window.confirm('Xóa kiện lẻ ' + m.bundle_code + '?')) handleDeleteMeasurements([m.id]); }}
                            style={{ padding: '4px 8px', borderRadius: 5, border: '1px solid var(--bd)', background: 'transparent', color: 'var(--tm)', cursor: 'pointer', fontSize: '0.68rem' }}>✕</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
          </div>
        )}
      </div>

      {/* Dialog xem nhanh đơn hàng lịch sử */}
      {historyDetailId && (
        <Dialog open={true} onClose={() => setHistoryDetailId(null)} title={`Đơn ${historyDetail?.order?.orderCode || '...'}`} width={700} noEnter maxHeight="80vh">
          {!historyDetail ? <div style={{ padding: 20, textAlign: 'center', color: 'var(--tm)' }}>Đang tải...</div> : (() => {
            const ho = historyDetail.order;
            const hi = historyDetail.items || [];
            const hs = historyDetail.services || [];
            const hp = historyDetail.paymentRecords || [];
            return (
              <div style={{ fontSize: '0.78rem' }}>
                {/* Header */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 10, padding: '0 2px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: 'var(--br)', marginBottom: 2 }}>{ho.customerType === 'company' ? 'Công ty ' : ho.customerSalutation ? ho.customerSalutation + ' ' : ''}{ho.customerName}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--tm)' }}>{new Date(ho.createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · NV: {ho.salesBy || '—'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--br)' }}>{fmtMoney(ho.totalAmount)}</div>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', marginTop: 2 }}>
                      <span style={{ padding: '1px 6px', borderRadius: 3, fontSize: '0.62rem', fontWeight: 700, background: ho.status === 'Đã xác nhận' ? 'rgba(50,79,39,0.1)' : 'rgba(168,155,142,0.15)', color: ho.status === 'Đã xác nhận' ? 'var(--gn)' : 'var(--tm)' }}>{ho.status}</span>
                      <span style={{ padding: '1px 6px', borderRadius: 3, fontSize: '0.62rem', fontWeight: 700, background: ho.paymentStatus === 'Đã thanh toán' ? 'rgba(50,79,39,0.1)' : ho.paymentStatus === 'Đã đặt cọc' ? 'rgba(41,128,185,0.1)' : 'rgba(242,101,34,0.08)', color: ho.paymentStatus === 'Đã thanh toán' ? 'var(--gn)' : ho.paymentStatus === 'Đã đặt cọc' ? '#2980b9' : 'var(--ac)' }}>{ho.paymentStatus}</span>
                      <span style={{ padding: '1px 6px', borderRadius: 3, fontSize: '0.62rem', fontWeight: 700, background: ho.exportStatus === 'Đã xuất' ? 'rgba(50,79,39,0.1)' : 'rgba(168,155,142,0.1)', color: ho.exportStatus === 'Đã xuất' ? 'var(--gn)' : 'var(--tm)' }}>{ho.exportStatus}</span>
                    </div>
                  </div>
                </div>

                {/* Bảng sản phẩm */}
                <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--brl)', textTransform: 'uppercase', marginBottom: 3 }}>Sản phẩm</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '0.72rem', marginBottom: 8 }}>
                  <colgroup>
                    <col style={{ width: 24 }} />
                    <col style={{ width: 90 }} />
                    <col />
                    <col style={{ width: 70 }} />
                    <col style={{ width: 80 }} />
                    <col style={{ width: 85 }} />
                  </colgroup>
                  <thead><tr style={{ background: 'var(--bgh)' }}>
                    <th style={{ padding: '3px 4px', textAlign: 'center', color: 'var(--brl)', fontWeight: 700, fontSize: '0.56rem', textTransform: 'uppercase', borderBottom: '1px solid var(--bds)' }}>#</th>
                    <th style={{ padding: '3px 4px', textAlign: 'left', color: 'var(--brl)', fontWeight: 700, fontSize: '0.56rem', textTransform: 'uppercase', borderBottom: '1px solid var(--bds)' }}>Mã</th>
                    <th style={{ padding: '3px 4px', textAlign: 'left', color: 'var(--brl)', fontWeight: 700, fontSize: '0.56rem', textTransform: 'uppercase', borderBottom: '1px solid var(--bds)' }}>Loại gỗ</th>
                    <th style={{ padding: '3px 4px', textAlign: 'right', color: 'var(--brl)', fontWeight: 700, fontSize: '0.56rem', textTransform: 'uppercase', borderBottom: '1px solid var(--bds)' }}>KL</th>
                    <th style={{ padding: '3px 4px', textAlign: 'right', color: 'var(--brl)', fontWeight: 700, fontSize: '0.56rem', textTransform: 'uppercase', borderBottom: '1px solid var(--bds)' }}>Đơn giá</th>
                    <th style={{ padding: '3px 4px', textAlign: 'right', color: 'var(--brl)', fontWeight: 700, fontSize: '0.56rem', textTransform: 'uppercase', borderBottom: '1px solid var(--bds)' }}>Thành tiền</th>
                  </tr></thead>
                  <tbody>
                    {hi.map((it, idx) => (
                      <tr key={idx} style={{ background: idx % 2 ? 'var(--bgs)' : '#fff' }}>
                        <td style={{ padding: '3px 4px', borderBottom: '1px solid var(--bd)', textAlign: 'center', color: 'var(--tm)', fontSize: '0.64rem' }}>{idx + 1}</td>
                        <td style={{ padding: '3px 4px', borderBottom: '1px solid var(--bd)', fontFamily: 'monospace', fontWeight: 600, fontSize: '0.66rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={it.bundleCode}>{it.bundleCode || '—'}</td>
                        <td style={{ padding: '3px 4px', borderBottom: '1px solid var(--bd)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={wts.find(w => w.id === it.woodId)?.name || it.rawWoodData?.woodTypeName}>{wts.find(w => w.id === it.woodId)?.name || it.rawWoodData?.woodTypeName || '—'}</td>
                        <td style={{ padding: '3px 4px', borderBottom: '1px solid var(--bd)', textAlign: 'right', whiteSpace: 'nowrap' }}>{(it.volume || 0).toFixed(4)}</td>
                        <td style={{ padding: '3px 4px', borderBottom: '1px solid var(--bd)', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtMoney(it.unitPrice)}</td>
                        <td style={{ padding: '3px 4px', borderBottom: '1px solid var(--bd)', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmtMoney(it.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Dịch vụ */}
                {hs.filter(s => s.amount > 0).length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--brl)', textTransform: 'uppercase', marginBottom: 3 }}>Dịch vụ</div>
                    {hs.filter(s => s.amount > 0).map((s, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 4px', fontSize: '0.72rem', borderBottom: '1px solid var(--bd)', background: i % 2 ? 'var(--bgs)' : '#fff' }}>
                        <span style={{ color: 'var(--ts)' }}>{svcLabel(s)}</span>
                        <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{fmtMoney(s.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tổng */}
                <div style={{ borderTop: '2px solid var(--bds)', paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginBottom: 8 }}>
                  <span>Tổng cộng</span><span style={{ fontSize: '0.88rem', color: 'var(--br)' }}>{fmtMoney(ho.totalAmount)}</span>
                </div>

                {/* Lịch sử thanh toán */}
                {hp.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--brl)', textTransform: 'uppercase', marginBottom: 3 }}>Lịch sử thanh toán</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '0.7rem' }}>
                      <colgroup>
                        <col style={{ width: 50 }} />
                        <col style={{ width: 80 }} />
                        <col style={{ width: 95 }} />
                        <col />
                      </colgroup>
                      <thead><tr style={{ background: 'var(--bgh)' }}>
                        <th style={{ padding: '3px 4px', textAlign: 'left', color: 'var(--brl)', fontWeight: 700, fontSize: '0.56rem', textTransform: 'uppercase', borderBottom: '1px solid var(--bds)' }}>Ngày</th>
                        <th style={{ padding: '3px 4px', textAlign: 'center', color: 'var(--brl)', fontWeight: 700, fontSize: '0.56rem', textTransform: 'uppercase', borderBottom: '1px solid var(--bds)' }}>Phương thức</th>
                        <th style={{ padding: '3px 4px', textAlign: 'right', color: 'var(--brl)', fontWeight: 700, fontSize: '0.56rem', textTransform: 'uppercase', borderBottom: '1px solid var(--bds)' }}>Số tiền</th>
                        <th style={{ padding: '3px 4px', textAlign: 'left', color: 'var(--brl)', fontWeight: 700, fontSize: '0.56rem', textTransform: 'uppercase', borderBottom: '1px solid var(--bds)' }}>Ghi chú</th>
                      </tr></thead>
                      <tbody>
                        {hp.map((r, ri) => (
                          <tr key={r.id || ri} style={{ background: ri % 2 ? 'var(--bgs)' : '#fff' }}>
                            <td style={{ padding: '3px 4px', borderBottom: '1px solid var(--bd)', whiteSpace: 'nowrap', color: 'var(--ts)' }}>{new Date(r.paidAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}</td>
                            <td style={{ padding: '3px 4px', borderBottom: '1px solid var(--bd)', textAlign: 'center' }}>
                              <span style={{ padding: '1px 5px', borderRadius: 3, fontSize: '0.62rem', fontWeight: 700, background: r.method === 'Chuyển khoản' ? 'rgba(41,128,185,0.1)' : 'rgba(39,174,96,0.1)', color: r.method === 'Chuyển khoản' ? '#2980b9' : '#27ae60' }}>{r.method}</span>
                            </td>
                            <td style={{ padding: '3px 4px', borderBottom: '1px solid var(--bd)', textAlign: 'right', fontWeight: 700, color: 'var(--gn)', whiteSpace: 'nowrap' }}>{fmtMoney(r.amount)}{r.discount > 0 ? <span style={{ fontSize: '0.58rem', color: '#8e44ad', marginLeft: 3 }}>+{fmtMoney(r.discount)}</span> : ''}</td>
                            <td style={{ padding: '3px 4px', borderBottom: '1px solid var(--bd)', color: 'var(--tm)', fontSize: '0.64rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.note}>{r.note || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}
        </Dialog>
      )}

      {/* Dialog xem chi tiết kiện lẻ */}
      {measDetail && <BoardDetailDialog data={measDetail} onClose={() => setMeasDetail(null)} />}

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

      {/* Vận chuyển */}
      <div style={{ background: 'var(--bgc)', borderRadius: 10, border: '1.5px solid var(--bd)', padding: '12px 16px', marginBottom: 16 }}>
        {secTitle('🚛 Vận chuyển')}
        <div style={{ display: 'flex', gap: 16, marginBottom: fm.shippingType === 'Xe của khách' ? 10 : 0 }}>
          {['Xe của khách', 'Gọi xe cho khách'].map(opt => (
            <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: '0.8rem', fontWeight: (fm.shippingType || 'Gọi xe cho khách') === opt ? 700 : 400 }}>
              <input type="radio" name="shippingType" checked={(fm.shippingType || 'Gọi xe cho khách') === opt} onChange={() => {
                if (opt === 'Gọi xe cho khách') setFm(p => ({ ...p, shippingType: opt, driverName: '', driverPhone: '', licensePlate: '', deliveryAddress: '', shippingNotes: '' }));
                else setFm(p => ({ ...p, shippingType: opt, estimatedArrival: p.estimatedArrival || '' }));
              }} style={{ accentColor: 'var(--ac)' }} />
              {opt === 'Xe của khách' ? '🚛 Khách tự vận chuyển' : '📞 Gọi xe cho khách'}
            </label>
          ))}
        </div>
        {(fm.shippingType || 'Gọi xe cho khách') === 'Gọi xe cho khách' && (
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--tm)', fontStyle: 'italic', marginBottom: 8 }}>Thêm dịch vụ "Vận tải" ở mục Dịch vụ phía trên để chọn đơn vị vận chuyển và nhập phí.</div>
            <div style={{ maxWidth: 260 }}>
              <label style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--brl)', display: 'block', marginBottom: 3, textTransform: 'uppercase' }}>Giờ đóng hàng</label>
              <input type="datetime-local" value={fm.estimatedArrival || ''} onChange={e => f('estimatedArrival')(e.target.value)} style={inpSt} />
            </div>
          </div>
        )}
        {fm.shippingType === 'Xe của khách' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
            <div>
              <label style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--brl)', display: 'block', marginBottom: 3, textTransform: 'uppercase' }}>Nơi đến</label>
              <input value={fm.deliveryAddress || ''} onChange={e => f('deliveryAddress')(e.target.value)} placeholder="Địa chỉ giao hàng..." style={inpSt} />
            </div>
            <div>
              <label style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--brl)', display: 'block', marginBottom: 3, textTransform: 'uppercase' }}>Thời gian đến lấy hàng</label>
              <input type="datetime-local" value={fm.estimatedArrival || ''} onChange={e => f('estimatedArrival')(e.target.value)} style={inpSt} />
            </div>
            <div>
              <label style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--brl)', display: 'block', marginBottom: 3, textTransform: 'uppercase' }}>Họ tên lái xe</label>
              <input value={fm.driverName || ''} onChange={e => f('driverName')(e.target.value)} placeholder="Nguyễn Văn A" style={inpSt} />
            </div>
            <div>
              <label style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--brl)', display: 'block', marginBottom: 3, textTransform: 'uppercase' }}>SĐT lái xe</label>
              <input value={fm.driverPhone || ''} onChange={e => f('driverPhone')(e.target.value)} placeholder="0912 345 678" style={inpSt} />
            </div>
            <div>
              <label style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--brl)', display: 'block', marginBottom: 3, textTransform: 'uppercase' }}>Biển số xe</label>
              <input value={fm.licensePlate || ''} onChange={e => f('licensePlate')(e.target.value)} placeholder="29C-123.45" style={inpSt} />
            </div>
            <div />
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--brl)', display: 'block', marginBottom: 3, textTransform: 'uppercase' }}>Thông tin xe</label>
              <textarea value={fm.shippingNotes || ''} onChange={e => f('shippingNotes')(e.target.value)} rows={2}
                placeholder="VD: Xe tải 5 tấn, thùng 6.2m, mở sườn được, không tháo nóc được"
                style={{ ...inpSt, resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
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
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <label style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--brl)', textTransform: 'uppercase' }}>Đặt cọc (đ)</label>
                {useAPI && parseFloat(fm.deposit) > 0 && (
                  <button onClick={async () => {
                    if (!preOrderCode) {
                      const { genOrderCode } = await import('../api.js');
                      const code = await genOrderCode();
                      setPreOrderCode(code);
                    }
                    if (!depositBankAccounts) {
                      const { fetchBankAccounts } = await import('../api.js');
                      setDepositBankAccounts(await fetchBankAccounts());
                    }
                    setShowDepositQR(true);
                    setDepositQRUsed(true);
                  }} style={{ fontSize: '0.6rem', padding: '1px 6px', borderRadius: 4, border: '1px solid #2980b9', background: 'rgba(41,128,185,0.08)', color: '#2980b9', cursor: 'pointer', fontWeight: 700 }}>QR Cọc</button>
                )}
              </div>
              <NumInput value={fm.deposit} onChange={n => f('deposit')(n)} style={inpSt} />
            </div>
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
            {!isNew && initial?.orderCode && useAPI && toPay > 0 && (
              <button onClick={async () => {
                if (!payQRAccounts) {
                  const { fetchBankAccounts } = await import('../api.js');
                  setPayQRAccounts(await fetchBankAccounts());
                }
                setShowPayQR(true);
              }} style={{ marginTop: 8, padding: '5px 12px', borderRadius: 5, border: '1.5px solid #2980b9', background: 'rgba(41,128,185,0.06)', color: '#2980b9', cursor: 'pointer', fontWeight: 700, fontSize: '0.72rem', width: '100%' }}>
                QR Thanh toán
              </button>
            )}
          </div>
        </div>
      </div>

      {/* QR Thanh toán Dialog (sửa đơn) */}
      {showPayQR && (() => {
        const acc = (payQRAccounts || []).find(a => a.isDefault && a.active) || (payQRAccounts || [])[0];
        const qrAmount = Math.max(0, Math.round(toPay));
        const orderCode = initial?.orderCode || preOrderCode;
        const qrUrl = acc && qrAmount > 0 ? `https://img.vietqr.io/image/${acc.bin}-${acc.accountNumber}-compact2.png?amount=${qrAmount}&addInfo=${encodeURIComponent(orderCode)}&accountName=${encodeURIComponent(acc.accountName)}` : null;
        return (
          <Dialog open={true} onClose={() => setShowPayQR(false)} title="QR Thanh toán" width={400} noEnter>
            {!acc ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--tm)' }}>Chưa cấu hình tài khoản ngân hàng.</div>
            ) : (
              <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <img src={qrUrl} alt="QR" style={{ width: 220, height: 220, borderRadius: 8, border: '1px solid var(--bd)' }} />
                <div style={{ marginTop: 12, fontSize: '0.82rem', color: 'var(--ts)' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--br)', marginBottom: 4 }}>{acc.bankName}</div>
                  <div>STK: <strong style={{ fontFamily: 'monospace', letterSpacing: 1 }}>{acc.accountNumber}</strong>
                    <button onClick={() => { navigator.clipboard.writeText(acc.accountNumber); notify('Đã copy STK'); }} title="Copy" style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 3, border: '1px solid var(--bd)', background: 'var(--bgs)', cursor: 'pointer', fontSize: '0.65rem' }}>Copy</button>
                  </div>
                  <div>CTK: <strong>{acc.accountName}</strong></div>
                </div>
                <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 7, background: 'var(--bgs)', border: '1px solid var(--bd)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--tm)', fontWeight: 600 }}>Số tiền</span>
                    <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--br)' }}>{qrAmount.toLocaleString('vi-VN')}đ</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--tm)', fontWeight: 600 }}>Nội dung CK</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.88rem', color: 'var(--br)' }}>{orderCode}</span>
                      <button onClick={() => { navigator.clipboard.writeText(orderCode); notify('Đã copy mã đơn'); }} title="Copy" style={{ padding: '1px 6px', borderRadius: 3, border: '1px solid var(--bd)', background: 'var(--bgs)', cursor: 'pointer', fontSize: '0.65rem' }}>Copy</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Dialog>
        );
      })()}

      {/* V-27: cảnh báo giá thấp hơn bảng */}
      {belowPriceItems.length > 0 && (
        <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 7, background: '#FFF8E1', border: '1px solid #FFD54F', fontSize: '0.75rem', color: '#5D4037' }}>
          ⚠ <strong>{belowPriceItems.length} mặt hàng</strong> có giá khác bảng giá/giá định giá — đơn sẽ chuyển sang <strong>Chờ duyệt giá</strong> và cần admin xác nhận trước khi xử lý.
          <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: '2px 10px' }}>
            {belowPriceItems.map((it, i) => {
              const diff = it.unitPrice - it.listPrice;
              const pct = Math.round((diff / it.listPrice) * 100);
              const fmtP = (v) => { const m = v / 1000000; return m % 1 === 0 ? m.toFixed(1) : parseFloat(m.toFixed(2)).toString(); };
              return (
                <span key={i} style={{ fontSize: '0.68rem', color: '#795548' }}>
                  {it.bundleCode}: <span style={{ color: 'var(--ac)', fontWeight: 700 }}>{fmtP(it.unitPrice)} tr</span> <span style={{ color: 'var(--tm)' }}>(định giá: {fmtP(it.listPrice)} tr, {pct > 0 ? '+' : ''}{pct}%)</span>
                </span>
              );
            })}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button onClick={handleCancel} disabled={saving} style={{ padding: '9px 16px', borderRadius: 7, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
          ← Hủy
        </button>
        {isNew && (
          <button onClick={() => handleSave('Nháp')} disabled={saving} style={{ padding: '9px 16px', borderRadius: 7, border: '1.5px solid var(--brl)', background: 'transparent', color: 'var(--brl)', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.82rem' }}>
            💾 Lưu nháp
          </button>
        )}
        {initial?.id && <button onClick={() => handleSave(belowPriceItems.length > 0 ? 'Chờ duyệt' : (initial.paymentStatus || 'Chưa thanh toán'))} disabled={saving} style={{ padding: '9px 20px', borderRadius: 7, border: 'none', background: saving ? 'var(--bd)' : 'var(--brl)', color: saving ? 'var(--tm)' : '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.82rem' }}>
          {saving ? 'Đang lưu...' : belowPriceItems.length > 0 ? '⚠ Cập nhật → Chờ duyệt giá' : 'Cập nhật đơn'}
        </button>}
        {!initial?.id && (
          <button onClick={() => handleSave('Chưa thanh toán')} disabled={saving} style={{ padding: '9px 20px', borderRadius: 7, border: 'none', background: saving ? 'var(--bd)' : 'var(--ac)', color: saving ? 'var(--tm)' : '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.82rem' }}>
            {saving ? 'Đang lưu...' : belowPriceItems.length > 0 ? '📋 Tạo đơn → Chờ duyệt giá' : '📋 Tạo đơn (Chưa TT)'}
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
      {/* QR Cọc Dialog */}
      {showDepositQR && (() => {
        const acc = (depositBankAccounts || []).find(a => a.isDefault && a.active) || (depositBankAccounts || [])[0];
        const qrAmount = Math.max(0, Math.round(parseFloat(fm.deposit) || 0));
        const qrUrl = acc && qrAmount > 0 ? `https://img.vietqr.io/image/${acc.bin}-${acc.accountNumber}-compact2.png?amount=${qrAmount}&addInfo=${encodeURIComponent(preOrderCode)}&accountName=${encodeURIComponent(acc.accountName)}` : null;
        return (
          <Dialog open={true} onClose={() => setShowDepositQR(false)} title="QR Cọc" width={400} noEnter>
            {!acc ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--tm)' }}>Chưa cấu hình tài khoản ngân hàng. Vào Đối soát → Cài đặt để thêm.</div>
            ) : !qrUrl ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--tm)' }}>Vui lòng nhập số tiền cọc trước.</div>
            ) : (
              <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <img src={qrUrl} alt="QR" style={{ width: 220, height: 220, borderRadius: 8, border: '1px solid var(--bd)' }} />
                <div style={{ marginTop: 12, fontSize: '0.82rem', color: 'var(--ts)' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--br)', marginBottom: 4 }}>{acc.bankName}</div>
                  <div>STK: <strong style={{ fontFamily: 'monospace', letterSpacing: 1 }}>{acc.accountNumber}</strong>
                    <button onClick={() => { navigator.clipboard.writeText(acc.accountNumber); notify('Đã copy STK'); }} title="Copy" style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 3, border: '1px solid var(--bd)', background: 'var(--bgs)', cursor: 'pointer', fontSize: '0.65rem' }}>Copy</button>
                  </div>
                  <div>CTK: <strong>{acc.accountName}</strong></div>
                </div>
                <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 7, background: 'var(--bgs)', border: '1px solid var(--bd)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--tm)', fontWeight: 600 }}>Số tiền cọc</span>
                    <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--br)' }}>{qrAmount.toLocaleString('vi-VN')}đ</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--tm)', fontWeight: 600 }}>Nội dung CK</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.88rem', color: 'var(--br)' }}>{preOrderCode}</span>
                      <button onClick={() => { navigator.clipboard.writeText(preOrderCode); notify('Đã copy nội dung CK'); }} title="Copy" style={{ padding: '1px 6px', borderRadius: 3, border: '1px solid var(--bd)', background: 'var(--bgs)', cursor: 'pointer', fontSize: '0.65rem' }}>Copy</button>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 8, fontSize: '0.64rem', color: '#7C5CBF', fontWeight: 600 }}>
                  Không sửa nội dung CK để hệ thống tự đối soát chính xác
                </div>
                <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button onClick={async () => { const ok = await copyQrAsImage(qrUrl, { title: 'QR Đặt cọc', amount: qrAmount.toLocaleString('vi-VN'), orderCode: preOrderCode, bankName: acc.bankName, accountNumber: acc.accountNumber, accountName: acc.accountName }); notify(ok ? 'Đã copy QR vào clipboard' : 'Không thể copy — thử tải ảnh', ok); }} style={{ padding: '6px 14px', borderRadius: 6, border: '1.5px solid var(--ac)', background: 'var(--acbg)', color: 'var(--ac)', cursor: 'pointer', fontWeight: 700, fontSize: '0.74rem' }}>Copy QR</button>
                  <button onClick={() => setShowDepositQR(false)} style={{ padding: '6px 14px', borderRadius: 6, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontSize: '0.74rem' }}>Đóng</button>
                </div>
              </div>
            )}
          </Dialog>
        );
      })()}
    </div>
  );
}

// ── OrderDetail ───────────────────────────────────────────────────────────────

function OrderDetail({ orderId, wts, ats, cfg, onBack, onEdit, onOrderUpdated, onOrderDeleted, notify, ce, ceExport, isSuperAdmin, user, vatRate = 0.08, carriers = [] }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exportImgs, setExportImgs] = useState([]);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [qrCustomAmount, setQrCustomAmount] = useState(null); // null = dùng outstanding mặc định
  const [bankAccounts, setBankAccounts] = useState(null); // lazy load
  const [showCancelDlg, setShowCancelDlg] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [salesByLabel, setSalesByLabel] = useState('');
  const [refunds, setRefunds] = useState([]);
  const [showRefundDlg, setShowRefundDlg] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [refundSaving, setRefundSaving] = useState(false);
  const [orderMeasurements, setOrderMeasurements] = useState([]);
  const imgRef = useRef(null);

  useEffect(() => {
    (async () => {
      const { fetchOrderDetail, fetchUsers, fetchRefundsByOrder, fetchMeasurementsByOrderId } = await import('../api.js');
      const [d, users, refs, meas] = await Promise.all([fetchOrderDetail(orderId), fetchUsers().catch(() => []), fetchRefundsByOrder(orderId).catch(() => []), fetchMeasurementsByOrderId(orderId).catch(() => [])]);
      setData(d);
      setRefunds(refs);
      setOrderMeasurements(meas || []);
      if (d?.order?.salesBy) {
        const u = users.find(u => u.username === d.order.salesBy);
        setSalesByLabel(u?.label || d.order.salesBy);
      }
      setLoading(false);
    })();
  }, [orderId]);

  // ── Realtime: payment_records for this order ──
  useEffect(() => {
    if (!orderId) return;
    let channel;
    (async () => {
      try {
        const { subscribePaymentRecords, fetchOrderDetail } = await import('../api.js');
        const { debouncedCallback } = await import('../utils.js');
        const refresh = debouncedCallback(() => {
          fetchOrderDetail(orderId).then(d => {
            if (d) { setData(d); notify(d.order?.orderCode + ' — thanh toán đã cập nhật'); }
          }).catch(() => {});
        }, 500);
        channel = subscribePaymentRecords(refresh, orderId);
      } catch {}
    })();
    return () => { if (channel) channel.unsubscribe(); };
  }, [orderId]); // eslint-disable-line

  const handleRecordPayment = async ({ amount, method, note, discount, discountNote }) => {
    setPaymentSaving(true);
    const { recordPayment } = await import('../api.js');
    const r = await recordPayment(orderId, { amount, method, note, discount, discountNote });
    setPaymentSaving(false);
    if (r.error) return notify('Lỗi: ' + r.error, false);
    const newRecord = { id: Date.now(), amount, method, discount: discount || 0, discountNote: discountNote || '', discountStatus: r.discountStatus || 'none', paidAt: new Date().toISOString(), note: note || '', paidBy: '' };
    setData(d => ({
      ...d,
      order: { ...d.order, paymentStatus: r.paymentStatus },
      paymentRecords: [...(d.paymentRecords || []), newRecord],
    }));
    onOrderUpdated?.({ id: orderId, paymentStatus: r.paymentStatus });
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
      order: { ...d.order, paymentStatus: r.paymentStatus },
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
        const r = await cancelOrder(orderId, cancelReason.trim(), user?.username || 'unknown');
        if (r.error) { notify('Lỗi: ' + r.error, false); setCancelling(false); return; }
        const msgs = [`Đã hủy đơn ${r.orderCode}`];
        if (r.bundlesRestored > 0) msgs.push(`hoàn ${r.bundlesRestored} kiện về kho`);
        if (r.creditAmount > 0) msgs.push(`ghi công nợ dương ${fmtMoney(r.creditAmount)}`);
        notify(msgs.join(' · '));
        setData(d => ({ ...d, order: { ...d.order, status: 'Đã hủy', cancelledAt: new Date().toISOString(), cancelledBy: user?.username || 'admin', cancelReason: cancelReason.trim() } }));
        onOrderUpdated?.({ id: orderId, status: 'Đã hủy' });
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
  const isCancelled = order.status === 'Đã hủy';
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const isCreator = order.createdBy && order.createdBy === user?.username;
  const exported = order.exportStatus === 'Đã xuất';
  const hasMoney = order.paymentStatus === 'Đã đặt cọc' || order.paymentStatus === 'Còn nợ' || order.paymentStatus === 'Đã thanh toán';
  const canEdit = ce && !isCancelled && order.paymentStatus !== 'Đã thanh toán';
  // Hủy đơn: admin mọi trường hợp; bán hàng chỉ đơn mình tạo + chưa TT + chưa xuất
  const canCancel = ce && !isCancelled && (isAdmin || (isCreator && !hasMoney && !exported));

  const pmtBadgeStyle = (s) => {
    if (s === 'Đã thanh toán') return { background: 'rgba(50,79,39,0.1)', color: 'var(--gn)' };
    if (s === 'Nháp') return { background: 'rgba(168,155,142,0.15)', color: 'var(--tm)' };
    if (s === 'Chờ duyệt') return { background: 'rgba(255,152,0,0.15)', color: '#E65100', border: '1px solid #FFB74D' };
    if (s === 'Đã đặt cọc') return { background: 'rgba(41,128,185,0.1)', color: '#2980b9', border: '1px solid rgba(41,128,185,0.3)' };
    if (s === 'Còn nợ') return { background: 'rgba(142,68,173,0.1)', color: '#8e44ad', border: '1px solid rgba(142,68,173,0.3)' };
    if (s === 'Đã hủy') return { background: 'rgba(168,155,142,0.15)', color: 'var(--tm)', textDecoration: 'line-through' };
    return { background: 'rgba(242,101,34,0.1)', color: 'var(--ac)' };
  };
  const badge = (label, ok, isPayment) => {
    const st = isPayment ? pmtBadgeStyle(label) : (ok ? { background: 'rgba(50,79,39,0.1)', color: 'var(--gn)' } : { background: 'rgba(242,101,34,0.1)', color: 'var(--ac)' });
    return <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.68rem', fontWeight: 700, ...st }}>{label}</span>;
  };
  // V-27
  const pendingApproval = order.status === 'Chờ duyệt giá';
  const belowPriceCount = items.filter(it => it.listPrice != null && it.listPrice > 0 && it.unitPrice !== it.listPrice).length;
  const sec = (t) => <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--tm)', textTransform: 'uppercase', marginBottom: 8, marginTop: 4, letterSpacing: '0.06em' }}>{t}</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ padding: '6px 12px', borderRadius: 6, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 600 }}>← Danh sách</button>
        <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '1rem', color: 'var(--br)' }}>{order.orderCode}</span>
        {badge(order.paymentStatus, order.paymentStatus === 'Đã thanh toán', true)}
        {(() => {
          const isContainerOrder = items.some(it => it.itemType === 'container');
          const expLabel = isContainerOrder && order.exportStatus === 'Đã xuất' ? 'Đã điều cont' : order.exportStatus;
          return badge(expLabel, order.exportStatus === 'Đã xuất', false);
        })()}
        <div style={{ flex: 1 }} />
        {/* V-27: nút duyệt giá inline — chỉ admin, chỉ khi Chờ duyệt */}
        {pendingApproval && isAdmin && (
          <button onClick={handleApprovePrice} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#FF9800', color: '#fff', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 700 }}>
            ✅ Duyệt giá ({belowPriceCount} mặt hàng)
          </button>
        )}
        {showPrintModal && (
          <PrintModal onClose={() => setShowPrintModal(false)}
            onPrint={({ layout, hideSupplierName, hidePrice, hideNotes }) => printOrder({ order: { ...order, salesByLabel }, customer, items, services, wts, ats, cfg, vatRate, hideSupplierName, hidePrice, hideNotes, layout, measurements: orderMeasurements })}
            onPreview={({ layout, hideSupplierName, hidePrice, hideNotes }) => printOrder({ order: { ...order, salesByLabel }, customer, items, services, wts, ats, cfg, vatRate, hideSupplierName, hidePrice, hideNotes, layout, previewOnly: true, measurements: orderMeasurements })}
            onCopyImage={({ layout, hideSupplierName, hidePrice, hideNotes }) => { const html = buildOrderHtml({ order: { ...order, salesByLabel }, customer, items, services, wts, ats, cfg, vatRate, hideSupplierName, hidePrice, hideNotes, layout }); return copyOrderAsImage(html, notify); }} />
        )}
        {showPaymentModal && (
          <RecordPaymentModal toPay={toPay} deposit={order.deposit} paymentRecords={paymentRecords}
            saving={paymentSaving} onClose={() => setShowPaymentModal(false)}
            onConfirm={handleRecordPayment} />
        )}
        {showQR && (() => {
          const loadAccounts = async () => {
            if (bankAccounts) return;
            const { fetchBankAccounts } = await import('../api.js');
            const accs = await fetchBankAccounts();
            setBankAccounts(accs);
          };
          loadAccounts();
          const acc = (bankAccounts || []).find(a => a.isDefault && a.active) || (bankAccounts || [])[0];
          const qrAmount = qrCustomAmount != null ? Math.max(0, Math.round(qrCustomAmount)) : Math.max(0, Math.round(outstanding));
          const orderCode = order.orderCode;
          const qrUrl = acc && qrAmount > 0 ? `https://img.vietqr.io/image/${acc.bin}-${acc.accountNumber}-compact2.png?amount=${qrAmount}&addInfo=${encodeURIComponent(orderCode)}&accountName=${encodeURIComponent(acc.accountName)}` : null;
          return (
            <Dialog open={true} onClose={() => { setShowQR(false); setQrCustomAmount(null); }} title="QR Chuyển khoản" width={400} noEnter>
              {!acc ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--tm)' }}>Chưa cấu hình tài khoản ngân hàng. Vào Đối soát → Cài đặt để thêm.</div>
              ) : (
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                  {qrUrl ? <img src={qrUrl} alt="QR" style={{ width: 220, height: 220, borderRadius: 8, border: '1px solid var(--bd)' }} /> : <div style={{ width: 220, height: 220, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: '1px dashed var(--bd)', color: 'var(--tm)', fontSize: '0.78rem' }}>Nhập số tiền để tạo QR</div>}
                  <div style={{ marginTop: 12, fontSize: '0.82rem', color: 'var(--ts)' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--br)', marginBottom: 4 }}>{acc.bankName}</div>
                    <div>STK: <strong style={{ fontFamily: 'monospace', letterSpacing: 1 }}>{acc.accountNumber}</strong>
                      <button onClick={() => { navigator.clipboard.writeText(acc.accountNumber); notify('Đã copy STK'); }} title="Copy" style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 3, border: '1px solid var(--bd)', background: 'var(--bgs)', cursor: 'pointer', fontSize: '0.65rem' }}>Copy</button>
                    </div>
                    <div>CTK: <strong>{acc.accountName}</strong></div>
                  </div>
                  <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 7, background: 'var(--bgs)', border: '1px solid var(--bd)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--tm)', fontWeight: 600 }}>Số tiền</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="text" inputMode="numeric" value={qrAmount > 0 ? qrAmount.toLocaleString('vi-VN') : ''} onChange={e => { const v = parseInt(e.target.value.replace(/\D/g, '')) || 0; setQrCustomAmount(v); }}
                          style={{ width: 130, padding: '4px 8px', borderRadius: 5, border: '1.5px solid var(--ac)', fontSize: '0.9rem', fontWeight: 800, textAlign: 'right', outline: 'none', color: 'var(--br)', background: 'var(--bg)' }} />
                        <span style={{ fontSize: '0.78rem', color: 'var(--tm)' }}>đ</span>
                      </div>
                    </div>
                    {qrCustomAmount != null && qrCustomAmount > outstanding && outstanding > 0 && (
                      <div style={{ fontSize: '0.66rem', color: '#8e44ad', marginBottom: 4, textAlign: 'left' }}>
                        Vượt đơn này {fmtMoney(qrCustomAmount - outstanding)} → tự tạo tín dụng khách hàng
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--tm)', fontWeight: 600 }}>Nội dung CK</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.88rem', color: 'var(--br)' }}>{orderCode}</span>
                        <span style={{ fontSize: '0.6rem', color: '#7C5CBF', fontWeight: 600 }}>🔒</span>
                        <button onClick={() => { navigator.clipboard.writeText(orderCode); notify('Đã copy nội dung CK'); }} title="Copy" style={{ padding: '1px 6px', borderRadius: 3, border: '1px solid var(--bd)', background: 'var(--bgs)', cursor: 'pointer', fontSize: '0.65rem' }}>Copy</button>
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 8, fontSize: '0.64rem', color: '#7C5CBF', fontWeight: 600 }}>
                    Không sửa nội dung CK để hệ thống tự đối soát chính xác
                  </div>
                  <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center' }}>
                    {qrUrl && <button onClick={async () => { const ok = await copyQrAsImage(qrUrl, { title: 'QR Thanh toán', amount: qrAmount.toLocaleString('vi-VN'), orderCode, bankName: acc.bankName, accountNumber: acc.accountNumber, accountName: acc.accountName }); notify(ok ? 'Đã copy QR vào clipboard' : 'Không thể copy — thử tải ảnh', ok); }} style={{ padding: '6px 14px', borderRadius: 6, border: '1.5px solid var(--ac)', background: 'var(--acbg)', color: 'var(--ac)', cursor: 'pointer', fontWeight: 700, fontSize: '0.74rem' }}>Copy QR</button>}
                    <button onClick={() => { setShowQR(false); setQrCustomAmount(null); }} style={{ padding: '6px 14px', borderRadius: 6, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontSize: '0.74rem' }}>Đóng</button>
                  </div>
                </div>
              )}
            </Dialog>
          );
        })()}
        <button onClick={() => setShowPrintModal(true)} style={{ padding: '6px 14px', borderRadius: 6, border: '1.5px solid var(--bd)', background: 'var(--bgs)', color: 'var(--ts)', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 600 }}>🖨 In / PDF</button>
        {canEdit && <button onClick={() => onEdit(order, items, services)} style={{ padding: '6px 14px', borderRadius: 6, border: '1.5px solid var(--ac)', background: 'var(--acbg)', color: 'var(--ac)', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 700 }}>✏️ Sửa đơn</button>}
        {canCancel && <button onClick={() => { setShowCancelDlg(true); setCancelReason(''); }} style={{ padding: '6px 14px', borderRadius: 6, border: '1.5px solid var(--dg)', background: 'transparent', color: 'var(--dg)', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 600 }}>✕ Hủy đơn</button>}
        {!canCancel && ce && !isCancelled && isCreator && <button onClick={() => notify('Đơn này cần admin hủy (đã có thanh toán hoặc đã xuất kho). Liên hệ quản lý.', false)} style={{ padding: '6px 14px', borderRadius: 6, border: '1.5px solid var(--tm)', background: 'transparent', color: 'var(--tm)', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 600 }}>✕ Hủy đơn</button>}
        {isSuperAdmin && isCancelled && <button onClick={async () => {
          if (!window.confirm(`Xóa vĩnh viễn đơn ${order.orderCode}? Dữ liệu sẽ không khôi phục được.`)) return;
          const { deleteOrder } = await import('../api.js');
          const r = await deleteOrder(orderId);
          if (r.error) { notify('Lỗi: ' + r.error, false); return; }
          notify(`Đã xóa đơn ${order.orderCode}`);
          onOrderDeleted?.(orderId);
          onBack();
        }} style={{ padding: '6px 14px', borderRadius: 6, border: '1.5px solid #C0392B', background: 'rgba(192,57,43,0.08)', color: '#C0392B', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 700 }}>🗑 Xóa vĩnh viễn</button>}
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
                      <span>+{it.boardCount} tấm · +{(it.volume || 0).toFixed(4)} {it.unit}</span>
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
          {isAdmin && (
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
            {/* Hoàn tiền */}
            {(() => {
              const pendingRef = refunds.find(r => r.status === 'pending');
              const completedRef = refunds.find(r => r.status === 'completed');
              const rejectedRef = refunds.filter(r => r.status === 'rejected');
              const hasTotalPaid = (paymentRecords || []).reduce((s, r) => s + (r.amount || 0), 0) > 0;
              return <>
                {completedRef && (
                  <div style={{ marginTop: 6, padding: '5px 8px', borderRadius: 5, background: 'rgba(50,79,39,0.08)', fontSize: '0.72rem', color: 'var(--gn)' }}>
                    ✓ Đã hoàn tiền <strong>{fmtMoney(completedRef.amount)}</strong> ({completedRef.method || 'N/A'}) — {completedRef.completedBy} lúc {new Date(completedRef.completedAt).toLocaleString('vi-VN')}
                  </div>
                )}
                {pendingRef && (
                  <div style={{ marginTop: 6, padding: '5px 8px', borderRadius: 5, background: 'rgba(41,128,185,0.08)', fontSize: '0.72rem', color: '#2980b9' }}>
                    ⏳ Yêu cầu hoàn <strong>{fmtMoney(pendingRef.amount)}</strong> — đang chờ admin duyệt
                    {ce && (
                      <span style={{ marginLeft: 8 }}>
                        <button onClick={async () => {
                          const method = prompt('Phương thức hoàn (TM/CK):');
                          if (!method) return;
                          const { approveRefund } = await import('../api.js');
                          const r = await approveRefund(pendingRef.id, { approvedBy: user?.username, method });
                          if (r.error) { notify('Lỗi: ' + r.error, false); return; }
                          setRefunds(prev => prev.map(rf => rf.id === pendingRef.id ? { ...rf, status: 'completed', approvedBy: user?.username, method, completedAt: new Date().toISOString() } : rf));
                          notify('Đã duyệt hoàn tiền');
                        }} style={{ padding: '2px 8px', borderRadius: 4, border: 'none', background: 'var(--gn)', color: '#fff', cursor: 'pointer', fontSize: '0.66rem', fontWeight: 700 }}>✓ Duyệt</button>
                        <button onClick={async () => {
                          const reason = prompt('Lý do từ chối:');
                          if (!reason) return;
                          const { rejectRefund } = await import('../api.js');
                          const r = await rejectRefund(pendingRef.id, { approvedBy: user?.username, rejectReason: reason });
                          if (r.error) { notify('Lỗi: ' + r.error, false); return; }
                          setRefunds(prev => prev.map(rf => rf.id === pendingRef.id ? { ...rf, status: 'rejected', rejectReason: reason } : rf));
                          notify('Đã từ chối yêu cầu hoàn tiền');
                        }} style={{ marginLeft: 4, padding: '2px 8px', borderRadius: 4, border: 'none', background: 'var(--dg)', color: '#fff', cursor: 'pointer', fontSize: '0.66rem', fontWeight: 700 }}>✕ Từ chối</button>
                      </span>
                    )}
                  </div>
                )}
                {rejectedRef.length > 0 && rejectedRef.map((rf, i) => (
                  <div key={i} style={{ marginTop: 4, padding: '5px 8px', borderRadius: 5, background: 'rgba(168,155,142,0.08)', fontSize: '0.72rem', color: 'var(--tm)' }}>
                    ✕ Yêu cầu hoàn {fmtMoney(rf.amount)} bị từ chối{rf.rejectReason ? ` — ${rf.rejectReason}` : ''}
                  </div>
                ))}
                {hasTotalPaid && !completedRef && !pendingRef && ce && (
                  <button onClick={() => setShowRefundDlg(true)} style={{ marginTop: 6, padding: '4px 12px', borderRadius: 5, border: '1.5px solid #2980b9', background: 'rgba(41,128,185,0.06)', color: '#2980b9', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>
                    💰 Yêu cầu hoàn tiền
                  </button>
                )}
              </>;
            })()}
          </div>
        </div>
      )}
      {/* Dialog yêu cầu hoàn tiền */}
      {showRefundDlg && (() => {
        const totalPaid = (paymentRecords || []).reduce((s, r) => { const dc = r.discountStatus === 'auto' || r.discountStatus === 'approved'; return s + (r.amount || 0) + (dc ? (r.discount || 0) : 0); }, 0);
        const credit = data?.order ? null : null; // credit info from cancelOrder response
        return (
          <Dialog open={true} onClose={() => setShowRefundDlg(false)} title="💰 Yêu cầu hoàn tiền" width={400} showFooter okLabel="Gửi yêu cầu"
            onOk={async () => {
              if (!refundReason.trim()) return notify('Vui lòng nhập lý do', false);
              setRefundSaving(true);
              const { requestRefund, fetchCustomerCredits } = await import('../api.js');
              // Tìm credit của đơn này
              const credits = await fetchCustomerCredits(order.customerId).catch(() => []);
              const orderCredit = credits.find(c => c.sourceOrderId === orderId && parseFloat(c.remaining) > 0);
              if (!orderCredit) { notify('Không tìm thấy công nợ dương của đơn này', false); setRefundSaving(false); return; }
              const r = await requestRefund({ creditId: orderCredit.id, customerId: order.customerId, orderId, amount: parseFloat(orderCredit.remaining), reason: refundReason.trim(), requestedBy: user?.username });
              setRefundSaving(false);
              if (r.error) { notify('Lỗi: ' + r.error, false); return; }
              setRefunds(prev => [...prev, { id: r.id, amount: parseFloat(orderCredit.remaining), status: 'pending', reason: refundReason.trim(), requestedBy: user?.username, createdAt: new Date().toISOString() }]);
              setShowRefundDlg(false); setRefundReason('');
              notify('Đã gửi yêu cầu hoàn tiền, chờ admin duyệt');
            }}>
            <div style={{ fontSize: '0.8rem', marginBottom: 10, color: 'var(--ts)' }}>
              Khách đã thanh toán: <strong>{fmtMoney(totalPaid)}</strong>
            </div>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--brl)', display: 'block', marginBottom: 4 }}>Lý do hoàn tiền *</label>
            <input value={refundReason} onChange={e => setRefundReason(e.target.value)} placeholder="VD: Khách yêu cầu hoàn tiền mặt..."
              style={{ width: '100%', padding: '7px 9px', borderRadius: 6, border: '1.5px solid var(--bd)', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }} autoFocus />
          </Dialog>
        );
      })()}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--bgc)', border: '1px solid var(--bd)' }}>
          {sec('Khách hàng')}
          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--br)', marginBottom: 2 }}>
            {customer?.customerType === 'company' && <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#2980b9', background: 'rgba(41,128,185,0.1)', padding: '1px 5px', borderRadius: 3, marginRight: 5 }}>🏢</span>}
            {customer?.salutation && customer?.customerType !== 'company' && <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--ac)', background: 'var(--acbg)', padding: '1px 5px', borderRadius: 3, marginRight: 5 }}>{customer.salutation}</span>}
            {customer?.name || order.customerName}{customer?.nickname && <span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--tm)', marginLeft: 6 }}>· {customer.nickname}</span>}
            {customer?.customerCode && <span style={{ fontSize: '0.62rem', color: 'var(--tm)', marginLeft: 6 }}>{customer.customerCode}</span>}
          </div>
          {customer?.taxCode && <div style={{ fontSize: '0.68rem', color: 'var(--tm)' }}>MST: {customer.taxCode}</div>}
          {customer?.companyName && customer?.customerType !== 'company' && <div style={{ fontSize: '0.76rem', color: 'var(--ts)' }}>{customer.companyName}</div>}
          <div style={{ fontSize: '0.76rem', color: 'var(--ts)' }}>{customer?.address || order.customerAddress}</div>
          <div style={{ fontSize: '0.76rem', color: 'var(--tm)' }}>{customer?.phone1 || order.customerPhone}</div>
          {order.contactName && <div style={{ fontSize: '0.76rem', color: 'var(--ts)', marginTop: 4 }}>Người mua: <strong>{order.contactName}</strong>{order.contactPhone ? ` · ${order.contactPhone}` : ''}</div>}
        </div>
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--bgc)', border: '1px solid var(--bd)' }}>
          {sec('Thông tin đơn')}
          <div style={{ fontSize: '0.76rem', color: 'var(--ts)' }}>Ngày tạo: <strong>{new Date(order.createdAt).toLocaleString('vi-VN')}</strong></div>
          {order.salesBy && <div style={{ fontSize: '0.76rem', color: 'var(--ts)' }}>Nhân viên bán hàng: <strong>{salesByLabel || order.salesBy}</strong></div>}
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
                      {(it.itemType === 'raw_wood' || it.itemType === 'raw_wood_weight') ? (
                        <><div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2980b9' }}>{it.rawWoodData?.pieceCode || it.rawWoodData?.containerCode || '—'}</div><div style={{ fontSize: '0.58rem', color: 'var(--tm)' }}><span style={{ padding: '1px 5px', borderRadius: 3, background: 'rgba(41,128,185,0.1)', color: '#2980b9', fontWeight: 700, fontSize: '0.56rem' }}>{it.itemType === 'raw_wood_weight' ? 'CÂN' : 'NL'}</span></div></>
                      ) : it.itemType === 'container' ? (
                        <><div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#8E44AD' }}>{it.rawWoodData?.containerCode || '—'}</div><div style={{ fontSize: '0.58rem' }}><span style={{ padding: '1px 5px', borderRadius: 3, background: 'rgba(142,68,173,0.1)', color: '#8E44AD', fontWeight: 700, fontSize: '0.56rem' }}>CONT</span></div></>
                      ) : (
                        <><div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--br)' }}>{it.supplierBundleCode || it.bundleCode}</div>{it.supplierBundleCode && <div style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: 'var(--tm)' }}>{it.bundleCode}</div>}</>
                      )}
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--bd)' }}>
                      {(it.itemType === 'raw_wood' || it.itemType === 'raw_wood_weight') ? (
                        <><div style={{ fontWeight: 600 }}>{it.rawWoodData?.woodTypeName || '—'}</div><div style={{ fontSize: '0.68rem', color: 'var(--tm)' }}>{it.itemType === 'raw_wood_weight' ? (() => { const wkg = it.rawWoodData?.weightKg || 0; return `${it.rawWoodData?.pieceCount || it.boardCount || 0} cây · ${wkg >= 1000 ? (wkg / 1000).toFixed(3) + ' tấn' : wkg + 'kg'}`; })() : (it.rawWoodData?.circumferenceCm ? `V${it.rawWoodData.circumferenceCm}cm` : it.rawWoodData?.diameterCm ? `Ø${it.rawWoodData.diameterCm}cm` : '') + (it.rawWoodData?.widthCm ? `${it.rawWoodData.thicknessCm || ''}×${it.rawWoodData.widthCm}cm` : '') + (it.rawWoodData?.lengthM ? ` × ${it.rawWoodData.lengthM}m` : '') + (it.rawWoodData?.quality ? ` · ${it.rawWoodData.quality}` : '')}</div></>
                      ) : it.itemType === 'container' ? (
                        <><div style={{ fontWeight: 600 }}>{it.rawWoodData?.woodTypeName || '—'}</div><div style={{ fontSize: '0.68rem', color: 'var(--tm)' }}>Nguyên container{it.rawWoodData?.pieceCount ? ` · ${it.rawWoodData.pieceCount} cây` : ''}</div></>
                      ) : (
                        <><div style={{ fontWeight: 600 }}>{w?.icon} {w?.name}</div><div style={{ fontSize: '0.68rem', color: 'var(--tm)' }}>{fmtItemAttrs(it, cfg, ats)}</div></>
                      )}
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--bd)', textAlign: 'right', whiteSpace: 'nowrap' }}>{it.boardCount}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--bd)', textAlign: 'right', whiteSpace: 'nowrap' }}>{(it.volume||0).toFixed(m2 ? 2 : 4)} <span style={{ fontSize: '0.65rem', color: 'var(--tm)' }}>{it.unit}</span></td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--bd)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <span style={{ color: priceChanged ? (it.unitPrice > it.listPrice ? 'var(--gn)' : '#E65100') : 'inherit', fontWeight: priceChanged ? 700 : 500 }}>{fmtMoney(it.unitPrice)}</span>
                      {m2 && it.listPrice && <div style={{ fontSize: '0.6rem', color: 'var(--tm)', marginTop: 1 }}>lẻ: {fmtMoney(it.listPrice)}{it.listPrice2 ? ` / NK: ${fmtMoney(it.listPrice2)}` : ''}</div>}
                      {!m2 && priceChanged && (
                        <div style={{ fontSize: '0.6rem', color: '#795548', marginTop: 1 }}>
                          Bảng: {fmtMoney(it.listPrice)} <span style={{ color: discountPct > 0 ? '#E65100' : 'var(--gn)', fontWeight: 700 }}>{discountPct > 0 ? `−${discountPct}` : `+${Math.abs(discountPct)}`}%</span>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--bd)', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmtMoney(it.amount)}</td>
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

      {/* Kiện lẻ đã gán */}
      {orderMeasurements.length > 0 && (
        <div style={{ background: 'var(--bgc)', borderRadius: 8, border: '1px solid #27ae60', marginBottom: 14, padding: '10px 14px' }}>
          <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#27ae60', marginBottom: 8 }}>📐 Kiện lẻ đã soạn ({orderMeasurements.length})</div>
          {orderMeasurements.map((m, i) => {
            const boards = m.boards || [];
            const groups = {};
            boards.forEach(b => { if (!groups[b.l]) groups[b.l] = []; groups[b.l].push(b.w); });
            const lengths = Object.keys(groups).sort((a, b) => a - b);
            lengths.forEach(l => groups[l].sort((a, b) => a - b));
            const columns = [];
            lengths.forEach(l => { const arr = groups[l]; for (let j = 0; j < arr.length; j += 10) columns.push({ length: l, values: arr.slice(j, j + 10) }); });
            const maxRows = columns.length > 0 ? Math.max(...columns.map(c => c.values.length)) : 0;
            return (
              <div key={m.id || i} style={{ marginBottom: 10, border: '1px solid var(--bd)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'rgba(39,174,96,0.06)' }}>
                  <div>
                    <span style={{ fontWeight: 800, fontFamily: 'monospace', color: 'var(--br)', fontSize: '0.82rem' }}>{m.bundle_code}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--tm)', marginLeft: 8 }}>{m.wood_type} · {m.thickness}F · {m.quality}</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--br)' }}>{m.board_count} tấm · {(m.volume || 0).toFixed(4)} m³</div>
                </div>
                {columns.length > 0 && (
                  <div style={{ overflowX: 'auto', padding: '6px' }}>
                    <table style={{ borderCollapse: 'collapse', fontSize: '0.7rem' }}>
                      <thead><tr>
                        <th style={{ background: 'var(--bgh)', padding: '3px 5px', border: '1px solid var(--bd)', fontSize: '0.6rem', color: '#7A3A10', fontWeight: 700 }}>Dài</th>
                        {columns.map((c, ci) => <th key={ci} style={{ background: '#FEF0E8', padding: '3px 5px', border: '1px solid var(--bd)', color: '#C24E10', fontWeight: 700 }}>{c.length}</th>)}
                      </tr></thead>
                      <tbody>
                        {Array.from({ length: maxRows }, (_, r) => (
                          <tr key={r}>
                            {r === 0 && <th rowSpan={maxRows} style={{ background: 'var(--bgh)', padding: '3px 5px', border: '1px solid var(--bd)', fontSize: '0.6rem', color: '#7A3A10', fontWeight: 700, verticalAlign: 'middle' }}>Rộng</th>}
                            {columns.map((c, ci) => <td key={ci} style={{ padding: '2px 5px', border: '1px solid var(--bd)', textAlign: 'center', background: r % 2 ? 'var(--bgs)' : '#fff' }}>{c.values[r] != null ? c.values[r] : ''}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

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
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem', border: '1px solid var(--bd)' }}>
              <thead><tr style={{ background: 'var(--bgh)' }}>
                {[['Ngày thu', 'left'], ['Phương thức', 'center'], ['Số tiền thu', 'right'], ['Gia hàng', 'right'], ['Ghi chú', 'left']].map(([h, align]) =>
                  <th key={h} style={{ padding: '5px 8px', textAlign: align, color: 'var(--brl)', fontWeight: 700, fontSize: '0.6rem', textTransform: 'uppercase', borderBottom: '2px solid var(--bds)', borderRight: '1px solid var(--bd)' }}>{h}</th>
                )}
              </tr></thead>
              <tbody>
                {paymentRecords.map((r, i) => {
                  const cellSt = { padding: '5px 8px', borderBottom: '1px solid var(--bd)', borderRight: '1px solid var(--bd)' };
                  return (
                  <tr key={r.id || i} style={{ background: i % 2 ? 'var(--bgs)' : '#fff' }}>
                    <td style={{ ...cellSt, whiteSpace: 'nowrap', color: 'var(--ts)' }}>{new Date(r.paidAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td style={{ ...cellSt, whiteSpace: 'nowrap', textAlign: 'center' }}>
                      <span style={{ padding: '1px 7px', borderRadius: 3, fontSize: '0.68rem', fontWeight: 700, background: r.method === 'Chuyển khoản' ? 'rgba(41,128,185,0.1)' : 'rgba(39,174,96,0.1)', color: r.method === 'Chuyển khoản' ? '#2980b9' : '#27ae60' }}>{r.method}</span>
                    </td>
                    <td style={{ ...cellSt, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--gn)', whiteSpace: 'nowrap' }}>{fmtMoney(r.amount)}</td>
                    <td style={{ ...cellSt, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {r.discount > 0 ? (
                        <div>
                          <span style={{ fontWeight: 700, color: r.discountStatus === 'pending' ? '#8e44ad' : r.discountStatus === 'rejected' ? 'var(--tm)' : 'var(--gn)', textDecoration: r.discountStatus === 'rejected' ? 'line-through' : 'none' }}>{fmtMoney(r.discount)}</span>
                          <div style={{ fontSize: '0.62rem', color: r.discountStatus === 'pending' ? '#8e44ad' : r.discountStatus === 'approved' ? 'var(--gn)' : 'var(--tm)' }}>
                            {r.discountStatus === 'auto' ? '✓ Tự duyệt' : r.discountStatus === 'approved' ? '✓ Đã duyệt' : r.discountStatus === 'pending' ? '⏳ Chờ duyệt' : '✕ Từ chối'}
                          </div>
                        </div>
                      ) : <span style={{ color: 'var(--tm)' }}>—</span>}
                    </td>
                    <td style={{ ...cellSt, color: 'var(--tm)', fontSize: '0.72rem' }}>{r.note || (r.discountNote ? `Gia hàng: ${r.discountNote}` : '—')}</td>
                  </tr>
                  );
                })}
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
          {(() => {
            const displayToPay = toPay - (parseFloat(order.deposit) || 0);
            const detailPayLabel = (order.deposit > 0 || order.debt > 0) ? 'Cần thanh toán' : 'Tổng thanh toán';
            return <>
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
                  <span style={{ fontWeight: 700, color: 'var(--br)' }}>{detailPayLabel}</span>
                  <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--br)' }}>{fmtMoney(displayToPay)}</span>
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--tm)', fontStyle: 'italic', marginTop: 3 }}>{soThanhChu(displayToPay)}</div>
              </div>
            </>;
          })()}
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
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <button onClick={() => setShowPaymentModal(true)} style={{ flex: 1, padding: '9px', borderRadius: 7, border: 'none', background: outstanding > 0 ? 'var(--ac)' : 'var(--gn)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>
                {outstanding > 0 ? `💰 Ghi thu (còn ${fmtMoney(outstanding)})` : '✓ Đã thanh toán'}
              </button>
              {outstanding > 0 && (
                <button onClick={() => setShowQR(true)} style={{ padding: '9px 14px', borderRadius: 7, border: '1.5px solid #2980b9', background: 'rgba(41,128,185,0.08)', color: '#2980b9', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                  QR
                </button>
              )}
            </div>
          )}
          {order.exportStatus !== 'Đã xuất' && ceExport && (
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

function fmtArrival(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  if (isNaN(d)) return '';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((target - today) / 86400000);
  const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  if (diff === 0) return time;
  if (diff === 1) return `${time} Ngày mai`;
  if (diff === 2) return `${time} Ngày kia`;
  return `${time} ${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`;
}

const PAGE_SIZE = 20;

function OrderList({ orders, onView, onNew, onContinue, onDeleteDraft, ce, ceExport, isAdmin, user, defaultExportFilter = '' }) {
  const isWarehouse = ceExport && !ce; // thủ kho: ceExport nhưng không ceSales
  const isSales = ce && !isAdmin;
  const [fOrder, setFOrder] = useState(isWarehouse ? 'Đã xác nhận' : '');
  const [fPayment, setFPayment] = useState('');
  const [fExport, setFExport] = useState(defaultExportFilter || (isWarehouse ? 'Chưa xuất' : ''));
  const [fSearch, setFSearch] = useState('');
  const [fSalesBy, setFSalesBy] = useState('');
  const { sortField, sortDir, toggleSort: _toggleSort, sortIcon, applySort } = useTableSort('createdAt', 'desc');
  const [page, setPage] = useState(1);
  const toggleSort = (f) => { _toggleSort(f); setPage(1); };

  const filtered = useMemo(() => {
    let arr = [...orders];
    // Bán hàng: chỉ đơn mình tạo hoặc mình bán
    if (isSales && user?.username) arr = arr.filter(o => o.createdBy === user.username || o.salesBy === user.username);
    // Admin: filter NV bán nếu chọn
    if (isAdmin && fSalesBy) arr = arr.filter(o => o.salesBy === fSalesBy || o.createdBy === fSalesBy);
    // Filter trạng thái đơn — mặc định ẩn đơn hủy
    if (fOrder === 'Đã hủy') arr = arr.filter(o => o.status === 'Đã hủy');
    else if (fOrder) arr = arr.filter(o => o.status === fOrder);
    else arr = arr.filter(o => o.status !== 'Đã hủy');
    // Filter thanh toán
    if (fPayment) arr = arr.filter(o => o.paymentStatus === fPayment);
    if (fExport) arr = arr.filter(o => o.exportStatus === fExport);
    if (fSearch) { const s = fSearch.toLowerCase(); arr = arr.filter(o => o.orderCode.toLowerCase().includes(s) || o.customerName.toLowerCase().includes(s) || o.customerPhone.includes(s)); }
    return applySort(arr);
  }, [orders, fOrder, fPayment, fExport, fSearch, fSalesBy, isSales, isAdmin, user, sortField, sortDir, applySort]);

  // Group by ngày
  const groupedByDate = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const groups = [];
    let currentKey = null, currentGroup = null;
    for (const o of filtered) {
      const d = new Date(o.createdAt); d.setHours(0,0,0,0);
      const key = d.toISOString().slice(0, 10);
      if (key !== currentKey) {
        if (currentGroup) groups.push(currentGroup);
        const label = d.getTime() === today.getTime() ? 'Hôm nay' : d.getTime() === yesterday.getTime() ? 'Hôm qua' : '';
        const dateStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        currentKey = key;
        currentGroup = { key, label: label ? `${label} · ${dateStr}` : dateStr, orders: [], total: 0 };
      }
      currentGroup.orders.push(o);
      currentGroup.total += o.totalAmount || 0;
    }
    if (currentGroup) groups.push(currentGroup);
    return groups;
  }, [filtered]);

  // Danh sách NV bán (admin filter)
  const salesByOptions = useMemo(() => {
    if (!isAdmin) return [];
    const set = new Set();
    orders.forEach(o => { if (o.salesBy) set.add(o.salesBy); });
    return [...set].sort();
  }, [orders, isAdmin]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const ths = { padding: '8px 10px', textAlign: 'left', background: 'var(--bgh)', color: 'var(--brl)', fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase', borderBottom: '2px solid var(--bds)', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none', transition: 'all 0.12s' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--br)' }}>🛒 Đơn hàng</h2>
        {ce && <button onClick={onNew} style={{ padding: '7px 16px', borderRadius: 7, background: 'var(--ac)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem' }}>+ Tạo đơn mới</button>}
      </div>
      <div style={{ background: 'var(--bgc)', borderRadius: 10, border: '1px solid var(--bd)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              {(() => {
                const fS = { width: '100%', padding: '4px 8px', borderRadius: 4, border: '1px solid var(--bd)', fontSize: '0.76rem', outline: 'none', boxSizing: 'border-box' };
                const fTd = { padding: '5px 6px' };
                return (
                  <tr style={{ background: 'var(--bgs)' }}>
                    <td style={fTd} />
                    <td style={fTd} />
                    <td style={fTd}>
                      {isAdmin && salesByOptions.length > 0 && (
                        <select value={fSalesBy} onChange={e => { setFSalesBy(e.target.value); setPage(1); }} style={fS}>
                          <option value="">Tất cả NV</option>
                          {salesByOptions.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      )}
                    </td>
                    <td style={fTd} colSpan={2}>
                      <input value={fSearch} onChange={e => { setFSearch(e.target.value); setPage(1); }} placeholder="🔍 Mã đơn, tên khách, SĐT..." style={fS} />
                    </td>
                    <td style={fTd} />
                    <td style={fTd}>
                      <select value={fOrder} onChange={e => { setFOrder(e.target.value); setPage(1); }} style={fS}>
                        <option value="">Tất cả</option>
                        <option>Nháp</option><option>Chờ duyệt giá</option><option>Đã xác nhận</option><option>Đã hủy</option>
                      </select>
                    </td>
                    <td style={fTd}>
                      <select value={fPayment} onChange={e => { setFPayment(e.target.value); setPage(1); }} style={fS}>
                        <option value="">Tất cả</option>
                        <option>Chưa thanh toán</option><option>Đã đặt cọc</option><option>Còn nợ</option><option>Đã thanh toán</option>
                      </select>
                    </td>
                    <td style={fTd}>
                      <select value={fExport} onChange={e => { setFExport(e.target.value); setPage(1); }} style={fS}>
                        <option value="">Tất cả</option>
                        <option>Chưa xuất</option><option>Đã xuất</option>
                      </select>
                    </td>
                    <td style={fTd} />
                    <td style={fTd} />
                    <td style={fTd} />
                    <td style={fTd} />
                  </tr>
                );
              })()}
              <tr>
                <th style={{ ...ths, width: 36, textAlign: "center" }}>STT</th>
                <th onClick={() => toggleSort('createdAt')} style={ths}>Ngày tạo{sortIcon('createdAt')}</th>
                <th style={{ ...ths, cursor: 'default' }}>NV bán</th>
                <th onClick={() => toggleSort('orderCode')} style={ths}>Mã đơn{sortIcon('orderCode')}</th>
                <th onClick={() => toggleSort('customerName')} style={ths}>Khách hàng{sortIcon('customerName')}</th>
                <th style={{ ...ths, cursor: 'default' }}>Địa chỉ thường gọi</th>
                <th onClick={() => toggleSort('status')} style={ths}>Trạng thái{sortIcon('status')}</th>
                <th onClick={() => toggleSort('paymentStatus')} style={ths}>Thanh toán{sortIcon('paymentStatus')}</th>
                <th onClick={() => toggleSort('exportStatus')} style={ths}>Xuất kho{sortIcon('exportStatus')}</th>
                <th style={{ ...ths, cursor: 'default' }}>Vận chuyển</th>
                <th onClick={() => toggleSort('totalVolume')} style={{ ...ths, textAlign: 'right' }}>KL (m³){sortIcon('totalVolume')}</th>
                <th onClick={() => toggleSort('totalAmount')} style={{ ...ths, textAlign: 'right' }}>Tổng tiền (VNĐ){sortIcon('totalAmount')}</th>
                <th style={{ ...ths, cursor: 'default', width: 30 }}></th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={13} style={{ padding: 30, textAlign: 'center', color: 'var(--tm)' }}>{orders.length === 0 ? 'Chưa có đơn hàng nào.' : 'Không có kết quả.'}</td></tr>
              ) : (() => {
                // Insert group headers giữa rows khi ngày thay đổi
                let lastDateKey = null;
                return paginated.map((o, i) => {
                  const d = new Date(o.createdAt); d.setHours(0,0,0,0);
                  const dateKey = d.toISOString().slice(0, 10);
                  const group = dateKey !== lastDateKey ? groupedByDate.find(g => g.key === dateKey) : null;
                  lastDateKey = dateKey;
                  return (<React.Fragment key={o.id}>
                    {group && (
                      <tr><td colSpan={13} style={{ padding: '6px 10px', background: 'var(--bgh)', borderBottom: '2px solid var(--bds)', fontSize: '0.72rem', fontWeight: 700, color: 'var(--br)' }}>
                        {group.label} <span style={{ fontWeight: 500, color: 'var(--tm)', marginLeft: 8 }}>{group.orders.length} đơn · {fmtMoney(group.total)}</span>
                      </td></tr>
                    )}
                    {(() => { const paid = o.paymentStatus === 'Đã thanh toán'; const cancelled = o.status === 'Đã hủy'; const exported = o.exportStatus === 'Đã xuất';
                const ordBg = o.status === 'Đã xác nhận' ? 'rgba(50,79,39,0.1)' : o.status === 'Chờ duyệt giá' ? 'rgba(255,152,0,0.15)' : o.status === 'Nháp' ? 'rgba(168,155,142,0.15)' : o.status === 'Đã hủy' ? 'rgba(168,155,142,0.12)' : 'rgba(242,101,34,0.08)';
                const ordColor = o.status === 'Đã xác nhận' ? 'var(--gn)' : o.status === 'Chờ duyệt giá' ? '#E65100' : o.status === 'Nháp' ? 'var(--tm)' : o.status === 'Đã hủy' ? 'var(--tm)' : 'var(--ac)';
                const pmtBg = paid ? 'rgba(50,79,39,0.1)' : o.paymentStatus === 'Đã đặt cọc' ? 'rgba(41,128,185,0.1)' : o.paymentStatus === 'Còn nợ' ? 'rgba(142,68,173,0.1)' : 'rgba(242,101,34,0.08)';
                const pmtColor = paid ? 'var(--gn)' : o.paymentStatus === 'Đã đặt cọc' ? '#2980b9' : o.paymentStatus === 'Còn nợ' ? '#8e44ad' : 'var(--ac)';
                return (
                  <tr data-clickable="true" key={o.id} onClick={() => o.status === 'Nháp' ? onContinue?.(o.id) : onView(o.id)} style={{ background: i % 2 ? 'var(--bgs)' : '#fff', cursor: 'pointer', opacity: cancelled ? 0.55 : 1 }}>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--bd)', textAlign: "center", fontSize: "0.68rem", color: "var(--tm)", width: 36 }}>{(page - 1) * PAGE_SIZE + i + 1}</td>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--bd)', color: 'var(--tm)', fontSize: '0.74rem', whiteSpace: 'nowrap' }}>{new Date(o.createdAt).toLocaleDateString('vi-VN')}</td>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--bd)', fontSize: '0.72rem', color: 'var(--ts)', whiteSpace: 'nowrap' }}>{o.salesBy || '—'}</td>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--bd)', fontFamily: 'monospace', fontWeight: 700, color: cancelled ? 'var(--tm)' : 'var(--br)', textDecoration: cancelled ? 'line-through' : 'none', whiteSpace: 'nowrap' }}>{o.orderCode}</td>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--bd)', fontWeight: 600 }}>{o.customerType === 'company' ? 'Công ty ' : o.customerSalutation ? `${o.customerSalutation} ` : ''}{o.customerName}<div style={{ fontSize: '0.7rem', color: 'var(--tm)' }}>{o.customerPhone}</div></td>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--bd)', color: 'var(--ts)', fontSize: '0.76rem' }}>{o.customerNickname || o.customerAddress || '—'}</td>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--bd)', whiteSpace: 'nowrap' }}><span style={{ padding: '2px 7px', borderRadius: 4, fontSize: '0.68rem', fontWeight: 700, background: ordBg, color: ordColor, textDecoration: cancelled ? 'line-through' : 'none' }}>{o.status}</span></td>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--bd)', whiteSpace: 'nowrap' }}><span style={{ padding: '2px 7px', borderRadius: 4, fontSize: '0.68rem', fontWeight: 700, background: pmtBg, color: pmtColor }}>{o.paymentStatus}</span></td>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--bd)', whiteSpace: 'nowrap' }}><span style={{ padding: '2px 7px', borderRadius: 4, fontSize: '0.68rem', fontWeight: 700, background: exported ? 'rgba(50,79,39,0.1)' : 'rgba(168,155,142,0.1)', color: exported ? 'var(--gn)' : 'var(--tm)' }}>{o.isContainerOrder && exported ? 'Đã điều cont' : o.exportStatus}</span></td>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--bd)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{(() => {
                      const hasCustomerTransport = o.shippingType === 'Xe của khách' && (o.driverName || o.licensePlate || o.estimatedArrival || o.deliveryAddress);
                      const hasCarrier = !!o.shippingCarrier;
                      if (hasCustomerTransport) return <div><div style={{ fontWeight: 600 }}>🚛 Khách</div>{o.estimatedArrival && <div style={{ fontSize: '0.66rem', color: 'var(--tm)' }}>{fmtArrival(o.estimatedArrival)}</div>}</div>;
                      if (hasCarrier) return <div><div style={{ fontWeight: 600 }}>📞 {o.shippingCarrier}</div>{o.estimatedArrival && <div style={{ fontSize: '0.66rem', color: 'var(--tm)' }}>{fmtArrival(o.estimatedArrival)}</div>}</div>;
                      if (o.estimatedArrival) return <div style={{ fontSize: '0.66rem', color: 'var(--tm)' }}>{fmtArrival(o.estimatedArrival)}</div>;
                      return '';
                    })()}</td>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--bd)', textAlign: 'right', fontSize: '0.76rem', color: 'var(--ts)', whiteSpace: 'nowrap' }}>{o.totalVolume > 0 ? o.totalVolume.toFixed(4) : '—'}</td>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--bd)', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', textDecoration: cancelled ? 'line-through' : 'none', color: cancelled ? 'var(--tm)' : 'inherit', whiteSpace: 'nowrap' }}>{fmtMoney(o.totalAmount)}</td>
                    <td style={{ padding: '4px 6px', borderBottom: '1px solid var(--bd)', textAlign: 'center', width: 30 }}>
                      {o.status === 'Nháp' && ce && (user?.role === 'admin' || user?.role === 'superadmin' || o.createdBy === user?.username) && (
                        <button onClick={e => { e.stopPropagation(); if (window.confirm(`Xóa đơn nháp ${o.orderCode}?`)) onDeleteDraft?.(o.id); }}
                          title="Xóa đơn nháp" style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid var(--dg)', background: 'transparent', color: 'var(--dg)', cursor: 'pointer', fontSize: '0.65rem', lineHeight: 1 }}>🗑</button>
                      )}
                    </td>
                  </tr>
                  );
                  })()}
                  </React.Fragment>);
                });
              })()}
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

function PgSales({ wts, ats, cfg, prices, bundles: bundlesProp = [], customers, setCustomers, carriers = [], xeSayConfig = DEFAULT_XE_SAY_CONFIG, setXeSayConfig, ce, ceExport, isSuperAdmin, user, useAPI, notify, setPg }) {
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

  // ── Realtime: orders ──
  const ordersRef = useRef([]);
  useEffect(() => { ordersRef.current = orders; }, [orders]);
  useEffect(() => {
    if (!useAPI) return;
    let channel;
    (async () => {
      try {
        const { subscribeOrders, fetchOrders } = await import('../api.js');
        const { debouncedCallback } = await import('../utils.js');
        const refresh = debouncedCallback(() => {
          fetchOrders().then(fresh => {
            const oldIds = new Set(ordersRef.current.map(o => o.id));
            const added = fresh.filter(o => !oldIds.has(o.id));
            if (added.length) notify(added.map(o => o.orderCode).join(', ') + ' — đơn hàng mới');
            // Detect payment status changes
            const oldMap = Object.fromEntries(ordersRef.current.map(o => [o.id, o]));
            fresh.forEach(o => {
              const prev = oldMap[o.id];
              if (prev && prev.paymentStatus !== o.paymentStatus) {
                notify(o.orderCode + ' — thanh toán: ' + o.paymentStatus);
              }
              if (prev && prev.status !== o.status && o.status === 'Đã hủy') {
                notify(o.orderCode + ' — đã bị hủy', false);
              }
            });
            setOrders(fresh);
          }).catch(() => {});
        }, 500);
        channel = subscribeOrders(refresh);
      } catch {}
    })();
    return () => { if (channel) channel.unsubscribe(); };
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

  const handleCreatedStay = async (result) => {
    // Refresh orders list in background
    const { fetchOrders, fetchOrderDetail } = await import('../api.js');
    const [fresh, detail] = await Promise.all([
      fetchOrders().catch(() => null),
      fetchOrderDetail(result.id).catch(() => null)
    ]);
    if (fresh) setOrders(fresh);
    if (detail?.order) {
      setEditData({ order: detail.order, items: detail.items, services: detail.services });
      setView('edit');
    } else {
      setView('list'); setEditData(null);
    }
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

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--tm)' }}>Đang tải đơn hàng...</div>;

  if (view === 'detail') return (
    <OrderDetail orderId={detailId} wts={wts} ats={ats} cfg={cfg} ce={ce} ceExport={ceExport} isSuperAdmin={isSuperAdmin} user={user} notify={notify} vatRate={vatRate} carriers={carriers}
      onBack={() => setView('list')}
      onOrderUpdated={handleOrderUpdated}
      onOrderDeleted={handleOrderDeleted}
      onEdit={(order, items, services) => { setEditData({ order, items, services }); setView('edit'); }} />
  );

  if (view === 'create') return (
    <OrderForm customers={customers} setCustomers={setCustomers} wts={wts} ats={ats} cfg={cfg} prices={prices} bundles={bundlesProp} ce={ce} user={user} useAPI={useAPI} notify={notify} vatRate={vatRate} carriers={carriers} xeSayConfig={xeSayConfig} setXeSayConfig={setXeSayConfig}
      onDone={handleOrderDone} onCreatedStay={handleCreatedStay} onViewOrder={(id) => { setDetailId(id); setView('detail'); }} />
  );

  if (view === 'edit' && editData) return (
    <OrderForm initial={{ ...editData.order, id: editData.order.id }} initialItems={editData.items} initialServices={editData.services}
      customers={customers} setCustomers={setCustomers} wts={wts} ats={ats} cfg={cfg} prices={prices} bundles={bundlesProp} ce={ce} user={user} useAPI={useAPI} notify={notify} vatRate={vatRate} carriers={carriers} xeSayConfig={xeSayConfig} setXeSayConfig={setXeSayConfig}
      onDone={handleOrderDone} onViewOrder={(id) => { setDetailId(id); setView('detail'); }} />
  );

  return (
    <OrderList orders={orders} ce={ce} ceExport={ceExport} isAdmin={user?.role === 'admin' || user?.role === 'superadmin'} user={user} onContinue={openEditFromList}
      defaultExportFilter={!ce ? 'Chưa xuất' : ''}
      onView={(id) => { setDetailId(id); setView('detail'); }}
      onNew={() => setView('create')}
      onDeleteDraft={async (id) => {
        try {
          const { deleteOrder } = await import('../api.js');
          const r = await deleteOrder(id);
          if (r.error) { notify('Lỗi: ' + r.error, false); return; }
          setOrders(prev => prev.filter(o => o.id !== id));
          notify('Đã xóa đơn nháp');
        } catch (e) { notify('Lỗi: ' + e.message, false); }
      }} />
  );
}

export default React.memo(PgSales);
