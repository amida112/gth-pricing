import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Dialog from './Dialog';
import { normalizeThickness } from '../utils';

/**
 * ReviewMeasurementDialog — Review & chỉnh sửa thông tin kiện đo trước khi gán vào mẻ xếp.
 *
 * Props:
 *   measurement: object — bundle_measurements record từ app đo
 *   session: object — packing session đang mở
 *   wts: array — danh sách loại gỗ
 *   cfg: object — config per-wood
 *   canAddMoreM3: number — m³ còn thêm được (120% input - output hiện tại)
 *   onConfirm: (reviewedData) => Promise — gọi khi user xác nhận gán
 *   onClose: () => void
 *   saving: bool
 */

const inpS = { width: '100%', padding: '5px 8px', borderRadius: 5, border: '1px solid var(--bd)', fontSize: '0.76rem', background: 'var(--bgc)', color: 'var(--tp)', outline: 'none', boxSizing: 'border-box' };
const lblS = { display: 'block', fontSize: '0.64rem', fontWeight: 700, color: 'var(--brl)', marginBottom: 2 };
const hintS = { fontSize: '0.6rem', color: '#D4A017', marginTop: 2 };
const btnS = { padding: '6px 14px', borderRadius: 6, border: 'none', fontWeight: 600, fontSize: '0.74rem', cursor: 'pointer' };
const btnP = { ...btnS, background: 'var(--ac)', color: '#fff' };
const btnSec = { ...btnS, background: 'var(--bgs)', color: 'var(--ts)', border: '1px solid var(--bd)' };

const MAX_WIDTHS_PER_ROW = 20;

function fmtNum(n, dec = 4) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('vi-VN', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

// ── Packing table (reuse logic từ BoardDetailDialog) ──
function PackingPreview({ boards, thickness, bundleCode, tableRef, woodType, thickMm, quality }) {
  const thickNum = parseFloat(thickness) || 0;
  const groups = {};
  boards.forEach(b => {
    const cm = Math.round(b.l * 10);
    if (!groups[cm]) groups[cm] = { dm: b.l, widths: [] };
    groups[cm].widths.push(b.w);
  });
  const lengthKeys = Object.keys(groups).sort((a, b) => b - a);
  const allRows = [];
  lengthKeys.forEach(cm => {
    const g = groups[cm];
    const widths = g.widths.sort((a, b) => a - b);
    for (let i = 0; i < widths.length; i += MAX_WIDTHS_PER_ROW) {
      const chunk = widths.slice(i, i + MAX_WIDTHS_PER_ROW);
      const chunkM3 = chunk.reduce((s, w) => s + (g.dm / 10) * (w / 100) * (thickNum / 100), 0);
      allRows.push({ cm, widths: chunk, pcs: chunk.length, m3: chunkM3 });
    }
  });
  const totalPcs = boards.length;
  const totalM3 = boards.reduce((s, b) => s + (b.l / 10) * (b.w / 100) * (thickNum / 100), 0);
  const maxWidthsInRow = Math.max(...allRows.map(r => r.widths.length), 1);
  const widthColW = maxWidthsInRow * 28 + 12;
  const COL_PKG = 100, COL_LEN = 60, COL_PCS = 50, COL_M3 = 70;
  const tableW = COL_PKG + COL_LEN + widthColW + COL_PCS + COL_M3;
  const thS = { fontSize: '0.78rem', fontWeight: 700, color: '#1a1a1a', textAlign: 'left', padding: '4px 0', borderBottom: '1.5px solid #1a1a1a', whiteSpace: 'nowrap' };

  return (
    <div style={{ overflowX: 'auto' }}>
    <div ref={tableRef} style={{ background: '#fff', padding: '8px 10px', display: 'inline-block', minWidth: '100%' }}>
      {(woodType || thickMm || quality) && (
        <div style={{ fontSize: '0.76rem', color: '#444', marginBottom: 4, lineHeight: 1.4 }}>
          {woodType && <div style={{ fontWeight: 600 }}>{woodType}</div>}
          <div>{thickMm ? `${thickMm}mm` : ''}{thickMm && quality ? ' ' : ''}{quality || ''}</div>
        </div>
      )}
      <table style={{ width: tableW, tableLayout: 'fixed', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
        <colgroup>
          <col style={{ width: COL_PKG }} />
          <col style={{ width: COL_LEN }} />
          <col style={{ width: widthColW }} />
          <col style={{ width: COL_PCS }} />
          <col style={{ width: COL_M3 }} />
        </colgroup>
        <thead>
          <tr>
            <th style={{ ...thS }}>Package</th>
            <th style={{ ...thS }}>Length</th>
            <th style={{ ...thS, textAlign: 'center' }}>Width</th>
            <th style={{ ...thS, textAlign: 'right' }}>PCS</th>
            <th style={{ ...thS, textAlign: 'right' }}>M3</th>
          </tr>
        </thead>
        <tbody>
          {allRows.map((row, ri) => (
            <tr key={ri}>
              {ri === 0 && <td rowSpan={allRows.length} style={{ fontWeight: 700, fontSize: '0.82rem', verticalAlign: 'top', padding: '2px 0', whiteSpace: 'nowrap', overflow: 'hidden' }}>{bundleCode}</td>}
              <td style={{ fontWeight: 700, fontSize: '0.82rem', whiteSpace: 'nowrap', padding: '2px 0', verticalAlign: 'top' }}>{row.cm}</td>
              <td style={{ fontSize: '0.78rem', lineHeight: 1.5, padding: '2px 0', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                {row.widths.map((w, wi) => <span key={wi} style={{ display: 'inline-block', width: 28, textAlign: 'right' }}>{w}</span>)}
              </td>
              <td style={{ fontSize: '0.78rem', textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'top', padding: '2px 0' }}>{row.pcs}</td>
              <td style={{ fontSize: '0.78rem', textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'top', padding: '2px 0' }}>{row.m3.toFixed(4)}</td>
            </tr>
          ))}
          <tr>
            <td style={{ borderTop: '1.5px solid #1a1a1a' }} colSpan={2} />
            <td style={{ textAlign: 'right', borderTop: '1.5px solid #1a1a1a', paddingTop: 6, fontWeight: 700, fontSize: '0.78rem' }}>Total:</td>
            <td style={{ textAlign: 'right', borderTop: '1.5px solid #1a1a1a', paddingTop: 6, fontWeight: 700, fontSize: '0.78rem' }}>{totalPcs}</td>
            <td style={{ textAlign: 'right', borderTop: '1.5px solid #1a1a1a', paddingTop: 6, fontWeight: 700, fontSize: '0.78rem' }}>{totalM3.toFixed(4)}</td>
          </tr>
        </tbody>
      </table>
    </div>
    </div>
  );
}

function MatrixPreview({ boards, thickness, tableRef, bundleCode, woodType, thickMm, quality, boardCount, volume }) {
  const thickNum = parseFloat(thickness) || 0;
  const groups = {};
  boards.forEach(b => { if (!groups[b.l]) groups[b.l] = []; groups[b.l].push(b.w); });
  const lengths = Object.keys(groups).sort((a, b) => a - b);
  lengths.forEach(l => groups[l].sort((a, b) => a - b));
  const columns = [];
  lengths.forEach(l => { const arr = groups[l]; for (let i = 0; i < arr.length; i += 10) columns.push({ length: l, values: arr.slice(i, i + 10) }); });
  const maxRows = columns.length > 0 ? Math.max(...columns.map(c => c.values.length)) : 0;
  const thBase = { padding: '4px 6px', border: '1px solid var(--bd)', fontWeight: 700 };

  const volNum = parseFloat(volume) || 0;
  const thickF = thickness ? `${parseFloat(thickness)}F` : '';

  return (
    <div ref={tableRef} style={{ overflowX: 'auto', background: '#fff', padding: '8px 10px' }}>
      <div style={{ fontSize: '0.78rem', marginBottom: 6 }}>
        <strong>{bundleCode}</strong>{woodType ? `  ${woodType}` : ''}{thickF ? ` · ${thickF}` : ''}{quality ? ` · ${quality}` : ''}
      </div>
      <table style={{ borderCollapse: 'collapse', fontSize: '0.74rem' }}>
        <thead>
          <tr>
            <th style={{ ...thBase, background: 'var(--bgh)', fontSize: '0.66rem', color: '#7A3A10' }}>Dài</th>
            {columns.map((c, i) => <th key={i} style={{ ...thBase, background: '#FEF0E8', color: '#C24E10' }}>{c.length}</th>)}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: maxRows }, (_, r) => (
            <tr key={r}>
              {r === 0 && <th rowSpan={maxRows} style={{ ...thBase, background: 'var(--bgh)', fontSize: '0.66rem', color: '#7A3A10', verticalAlign: 'middle' }}>Rộng</th>}
              {columns.map((c, i) => <td key={i} style={{ padding: '3px 6px', border: '1px solid var(--bd)', textAlign: 'center', background: r % 2 ? 'var(--bgs)' : '#fff' }}>{c.values[r] != null ? c.values[r] : ''}</td>)}
            </tr>
          ))}
          <tr>
            <th style={{ ...thBase, background: '#FEF0E8', fontSize: '0.66rem', color: '#C24E10' }}>Tổng</th>
            {columns.map((c, i) => {
              const sumW = c.values.reduce((s, w) => s + Number(w || 0), 0);
              const total = c.length * sumW * thickNum;
              return <th key={i} style={{ ...thBase, background: '#FEF0E8', fontSize: '0.62rem', color: '#C24E10' }}>{sumW ? total.toFixed(0) : ''}</th>;
            })}
          </tr>
        </tbody>
      </table>
      <div style={{ fontSize: '0.78rem', fontWeight: 700, marginTop: 6 }}>{boardCount} pcs · {volNum.toFixed(4)} m³</div>
    </div>
  );
}

// ── Capture table to clipboard ──
async function captureTable(ref, onDone) {
  if (!ref?.current) return;
  try {
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(ref.current, { backgroundColor: '#ffffff', scale: 2 });
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) { onDone?.(false); return; }
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    onDone?.(true);
  } catch {
    onDone?.(false);
  }
}

export default function ReviewMeasurementDialog({ measurement: m, session, wts, cfg, canAddMoreM3, onConfirm, onClose, saving, notify }) {
  const wtMap = useMemo(() => Object.fromEntries(wts.map(w => [w.id, w])), [wts]);

  const boards = m.boards || [];

  // ── Form state ──
  const [bundleCode, setBundleCode] = useState('');
  const [codeLoading, setCodeLoading] = useState(true);
  const [codeDup, setCodeDup] = useState(false);
  // Mặc định loại gỗ từ measurement (match tên mềm), fallback session
  const [woodTypeId, setWoodTypeId] = useState(() => {
    if (!m.wood_type) return session.woodTypeId;
    const raw = m.wood_type.trim().toUpperCase();
    // 1) exact match tên
    const exact = wts.find(w => w.name?.toUpperCase() === raw || w.nameEn?.toUpperCase() === raw);
    if (exact) return exact.id;
    // 2) includes match (VD: "SỒI ĐỎ NK ÂU" includes "SỒI ĐỎ")
    const partial = wts.find(w => raw.includes(w.name?.toUpperCase()));
    if (partial) return partial.id;
    // 3) gốc tên match — bỏ hậu tố NK/XS/MỸ/ÂU/XẺ SẤY rồi so
    const core = raw.replace(/\s*(NK|XS|XẺ\s*SẤY|MỸ|ÂU|EU|US)\s*/g, '').trim();
    const coreMatch = wts.find(w => {
      const wCore = (w.name || '').toUpperCase().replace(/\s*(NK|XS|XẺ\s*SẤY|MỸ|ÂU|EU|US)\s*/g, '').trim();
      return wCore && core.includes(wCore);
    });
    if (coreMatch) return coreMatch.id;
    return session.woodTypeId;
  });
  const [thick, setThick] = useState(String(m.thickness || session.thicknessCm));
  const [quality, setQuality] = useState(m.quality || '');
  const [width, setWidth] = useState('');
  // Auto-fill chiều dài từ boards: min-max (mét), luôn 1 decimal
  const fmtLen = (v) => { const n = parseFloat(v); return isNaN(n) ? String(v) : n % 1 === 0 ? n.toFixed(1) : String(n); };
  const [length, setLength] = useState(() => {
    if (!boards.length) return '';
    const lengths = boards.map(b => b.l / 10); // dm → m
    const minL = Math.min(...lengths);
    const maxL = Math.max(...lengths);
    if (minL === maxL) return fmtLen(minL);
    return `${fmtLen(minL)}-${fmtLen(maxL)}`;
  });
  // Tính m³ từ boards + thickness
  const calcVolumeFromBoards = (thickCm) => {
    if (!boards.length) return parseFloat(m.volume) || 0;
    const t = parseFloat(thickCm) || 0;
    return boards.reduce((s, b) => s + (b.l / 10) * (b.w / 100) * (t / 100), 0);
  };
  const [volume, setVolume] = useState(() => String(+calcVolumeFromBoards(m.thickness || session.thicknessCm).toFixed(4)));
  const [notes, setNotes] = useState('');
  const [measurer1, setMeasurer1] = useState('');
  const [measurer2, setMeasurer2] = useState('');

  // ── Config reactive theo woodTypeId đã chọn ──
  const woodCfg = cfg[woodTypeId] || { attrs: [], attrValues: {} };
  const qualities = woodCfg.attrValues?.quality || [];
  const cfgWidthValues = woodCfg.attrValues?.width || [];
  const cfgLengthValues = woodCfg.attrValues?.length || [];
  const hasWidthAttr = woodCfg.attrs?.includes('width');
  const hasLengthAttr = woodCfg.attrs?.includes('length');

  // ── Load bundle code + employees ──
  const [packers, setPackers] = useState([]); // NV bộ phận Xếp hàng

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const api = await import('../api.js');
      // Gen bundle code
      const code = await api.genKilnBundleCode();
      if (!cancelled) { setBundleCode(code); setCodeLoading(false); }
      // Load employees
      try {
        const [depts, emps] = await Promise.all([api.fetchDepartments(), api.fetchEmployees()]);
        const packDept = depts.find(d => /xếp/i.test(d.name));
        if (packDept) {
          const filtered = emps.filter(e => e.departmentId === packDept.id && e.status === 'active');
          if (!cancelled) setPackers(filtered);
        }
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Pre-fill measurer from measurement.measured_by
  useEffect(() => {
    if (!m.measured_by || !packers.length) return;
    const names = m.measured_by.split(/[,&+]/).map(n => n.trim()).filter(Boolean);
    if (names[0]) {
      const match = packers.find(p => p.fullName === names[0] || p.fullName.includes(names[0]) || names[0].includes(p.fullName));
      if (match) setMeasurer1(match.id);
    }
    if (names[1]) {
      const match = packers.find(p => p.fullName === names[1] || p.fullName.includes(names[1]) || names[1].includes(p.fullName));
      if (match) setMeasurer2(match.id);
    }
  }, [m.measured_by, packers]);

  // ── Validate bundle code ──
  const codeCheckRef = useRef(null);
  const checkCode = useCallback(async (code) => {
    if (!code.trim()) { setCodeDup(false); return; }
    clearTimeout(codeCheckRef.current);
    codeCheckRef.current = setTimeout(async () => {
      const api = await import('../api.js');
      const exists = await api.checkBundleCodeExists(code.trim());
      setCodeDup(exists);
    }, 400);
  }, []);

  const handleCodeChange = (val) => {
    setBundleCode(val);
    checkCode(val);
  };

  // ── Width/Length hint ──
  const widthHint = useMemo(() => {
    if (!hasWidthAttr || !width.trim() || !cfgWidthValues.length) return null;
    if (cfgWidthValues.includes(width.trim())) return null;
    return `"${width}" chưa có trong danh sách chip rộng (${cfgWidthValues.join(', ')}). Cần báo Admin tạo alias.`;
  }, [width, hasWidthAttr, cfgWidthValues]);

  const lengthHint = useMemo(() => {
    if (!hasLengthAttr || !length.trim() || !cfgLengthValues.length) return null;
    if (cfgLengthValues.includes(length.trim())) return null;
    return `"${length}" chưa có trong danh sách chip dài (${cfgLengthValues.join(', ')}). Cần báo Admin tạo alias.`;
  }, [length, hasLengthAttr, cfgLengthValues]);

  // ── Preview layout ──
  const [layout, setLayout] = useState('matrix');
  const tableRef = useRef(null);

  const swS = { display: 'flex', gap: 2, background: '#f0f0f0', borderRadius: 5, padding: 2 };
  const swBtn = (active) => ({ padding: '3px 10px', border: 'none', borderRadius: 3, fontSize: '0.64rem', fontWeight: 600, cursor: 'pointer', background: active ? '#fff' : 'transparent', color: active ? 'var(--tp)' : 'var(--tm)', boxShadow: active ? '0 1px 2px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' });

  // ── Submit ──
  const volNum = parseFloat(volume) || 0;
  const volOk = volNum > 0 && volNum <= canAddMoreM3 + 0.001;
  const codeOk = bundleCode.trim() && !codeDup && !codeLoading;
  const qualityOk = !!quality;
  const measurerOk = !!measurer1;
  const canSubmit = codeOk && qualityOk && measurerOk && volOk && !saving;

  const handleSubmit = () => {
    const measuredByNames = [measurer1, measurer2]
      .map(id => packers.find(p => p.id === id)?.fullName)
      .filter(Boolean);

    // Build attributes — thickness normalize thêm hậu tố F
    const nt = normalizeThickness(thick);
    const thickNorm = nt.value || thick;
    const attrs = { quality, thickness: thickNorm };
    if (hasWidthAttr && width.trim()) attrs.width = width.trim();
    if (hasLengthAttr && length.trim()) attrs.length = length.trim();

    // skuKey chỉ gồm attrs có trong cfg
    const skuAttrs = { quality, thickness: thickNorm };
    if (hasWidthAttr && width.trim() && cfgWidthValues.includes(width.trim())) skuAttrs.width = width.trim();
    if (hasLengthAttr && length.trim() && cfgLengthValues.includes(length.trim())) skuAttrs.length = length.trim();
    const skuKey = Object.entries(skuAttrs).filter(([, v]) => v).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}:${v}`).join('||');

    onConfirm({
      bundleCode: bundleCode.trim(),
      woodTypeId,
      skuKey,
      attributes: attrs,
      boardCount: boards.length || m.board_count || 0,
      volume: volNum,
      rawMeasurements: boards.length ? { boards } : {},
      measuredBy: measuredByNames,
      notes: notes.trim() || null,
      measurementId: m.id,
    });
  };

  const thickMm = Math.round(parseFloat(thick) * 10);

  return (
    <Dialog open={true} onClose={onClose} title={`📐 Review kiện đo — Gán vào ${session.sessionCode}`} width={720} noEnter>
      {/* Header info từ app đo */}
      <div style={{ fontSize: '0.68rem', color: 'var(--tm)', marginBottom: 10, padding: '6px 8px', background: 'var(--bgs)', borderRadius: 6 }}>
        Mã từ app đo: <strong>{m.bundle_code}</strong> · {m.wood_type} · {m.thickness} · {m.quality} · {m.board_count} tấm · {fmtNum(parseFloat(m.volume))} m³ · Người đo: {m.measured_by}
      </div>

      {/* Form chỉnh sửa */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {/* Mã kiện */}
        <div style={{ flex: '1 0 140px' }}>
          <label style={lblS}>Mã kiện *</label>
          <input value={bundleCode} onChange={e => handleCodeChange(e.target.value)} style={{ ...inpS, borderColor: codeDup ? 'var(--dg)' : codeOk ? 'var(--gn)' : 'var(--bd)' }} disabled={codeLoading} />
          {codeDup && <div style={{ fontSize: '0.6rem', color: 'var(--dg)', marginTop: 1 }}>Mã kiện đã tồn tại</div>}
          {codeLoading && <div style={{ fontSize: '0.6rem', color: 'var(--tm)', marginTop: 1 }}>Đang tạo mã...</div>}
        </div>
        {/* Loại gỗ */}
        <div style={{ flex: '1 0 120px' }}>
          <label style={lblS}>Loại gỗ *</label>
          <select value={woodTypeId} onChange={e => setWoodTypeId(e.target.value)} style={inpS}>
            {wts.map(w => <option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
          </select>
        </div>
        {/* Dày */}
        <div style={{ flex: '0 0 70px' }}>
          <label style={lblS}>Dày (cm) *</label>
          <input type="number" step="0.1" value={thick} onChange={e => { setThick(e.target.value); if (boards.length) setVolume(String(+calcVolumeFromBoards(e.target.value).toFixed(4))); }} style={inpS} />
        </div>
        {/* Chất lượng */}
        <div style={{ flex: '0 0 100px' }}>
          <label style={lblS}>Chất lượng *</label>
          <select value={quality} onChange={e => setQuality(e.target.value)} style={{ ...inpS, borderColor: qualityOk ? undefined : 'var(--dg)' }}>
            <option value="">— Chọn —</option>
            {qualities.map(q => <option key={q} value={q}>{q}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {/* Rộng */}
        <div style={{ flex: '1 0 100px' }}>
          <label style={lblS}>Rộng (cm){hasWidthAttr ? '' : ' — không cấu hình'}</label>
          <input value={width} onChange={e => setWidth(e.target.value.replace(/\s/g, ''))} placeholder="VD: 27 hoặc 28-32" style={inpS} />
          {widthHint && <div style={hintS}>{widthHint}</div>}
        </div>
        {/* Dài */}
        <div style={{ flex: '1 0 100px' }}>
          <label style={lblS}>Dài (m){hasLengthAttr ? '' : ' — không cấu hình'}</label>
          <input value={length} onChange={e => setLength(e.target.value.replace(/\s/g, ''))} placeholder="VD: 3.0 hoặc 2.8-3.2" style={inpS} />
          {lengthHint && <div style={hintS}>{lengthHint}</div>}
        </div>
        {/* m³ */}
        <div style={{ flex: '0 0 90px' }}>
          <label style={lblS}>m³ *</label>
          <input type="number" step="0.0001" value={volume} onChange={e => setVolume(e.target.value)} style={{ ...inpS, borderColor: volOk ? 'var(--gn)' : volume ? 'var(--dg)' : 'var(--bd)' }} />
          {volNum > canAddMoreM3 + 0.001 && <div style={{ fontSize: '0.6rem', color: 'var(--dg)', marginTop: 1 }}>Vượt giới hạn ({fmtNum(canAddMoreM3, 3)} m³)</div>}
        </div>
        {/* Số tấm (readonly) */}
        <div style={{ flex: '0 0 60px' }}>
          <label style={lblS}>Số tấm</label>
          <input value={boards.length || m.board_count || 0} readOnly style={{ ...inpS, background: 'var(--bgs)', color: 'var(--tm)' }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {/* Người đo 1 */}
        <div style={{ flex: '1 0 160px' }}>
          <label style={lblS}>Người đo 1 *</label>
          <select value={measurer1} onChange={e => setMeasurer1(e.target.value)} style={{ ...inpS, borderColor: measurerOk ? undefined : 'var(--dg)' }}>
            <option value="">— Chọn —</option>
            {packers.filter(p => p.id !== measurer2).map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
          </select>
          {!packers.length && <div style={{ fontSize: '0.6rem', color: 'var(--tm)', marginTop: 1 }}>Đang tải NV...</div>}
        </div>
        {/* Người đo 2 */}
        <div style={{ flex: '1 0 160px' }}>
          <label style={lblS}>Người đo 2 (tùy chọn)</label>
          <select value={measurer2} onChange={e => setMeasurer2(e.target.value)} style={inpS}>
            <option value="">— Không —</option>
            {packers.filter(p => p.id !== measurer1).map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
          </select>
        </div>
        {/* Ghi chú */}
        <div style={{ flex: '1 0 160px' }}>
          <label style={lblS}>Ghi chú</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} style={inpS} />
        </div>
      </div>

      {/* Chi tiết tấm */}
      {boards.length > 0 && (
        <div style={{ border: '1px solid var(--bd)', borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--bgs)' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--ts)' }}>
              Chi tiết tấm — {wtMap[woodTypeId]?.name} · {thickMm}mm · {quality || '?'}
            </span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <div style={swS}>
                <button style={swBtn(layout === 'packing')} onClick={() => setLayout('packing')}>Packing</button>
                <button style={swBtn(layout === 'matrix')} onClick={() => setLayout('matrix')}>Matrix</button>
              </div>
              <button onClick={() => captureTable(tableRef, ok => { if (notify) notify(ok ? 'Đã copy ảnh vào clipboard' : 'Không thể copy — thử lại', ok !== false); })} style={{ ...btnSec, padding: '2px 8px', fontSize: '0.62rem' }} title="Chụp ảnh bảng → copy clipboard">📷 Chụp</button>
            </div>
          </div>
          {layout === 'packing'
            ? <PackingPreview boards={boards} thickness={thick} bundleCode={bundleCode} tableRef={tableRef} woodType={wtMap[woodTypeId]?.nameEn || wtMap[woodTypeId]?.name || ''} thickMm={thickMm} quality={quality} />
            : <MatrixPreview boards={boards} thickness={thick} tableRef={tableRef} bundleCode={bundleCode} woodType={wtMap[woodTypeId]?.name || ''} thickMm={thickMm} quality={quality} boardCount={boards.length || m.board_count || 0} volume={volume} />
          }
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
        <button onClick={onClose} style={btnSec}>Hủy</button>
        <button onClick={handleSubmit} disabled={!canSubmit} style={{ ...btnP, opacity: canSubmit ? 1 : 0.4 }}>
          {saving ? 'Đang gán...' : 'Gán vào mẻ xếp'}
        </button>
      </div>
    </Dialog>
  );
}
