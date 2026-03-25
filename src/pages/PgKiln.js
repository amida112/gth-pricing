import React, { useState, useEffect, useMemo, useCallback } from "react";

const KILN_COUNT = 8;
const BATCH_STATUSES = ['Đang sấy', 'Đã ra lò', 'Hoàn thành'];
const ITEM_STATUSES = ['Trong lò', 'Đã ra lò', 'Đã đóng kiện', 'Bỏ lại - Chờ ghép', 'Bỏ lại - Loại'];

function statusColor(s) {
  if (s === 'Đang sấy') return { color: '#324F27', bg: 'rgba(50,79,39,0.1)' };
  if (s === 'Đã ra lò') return { color: '#FF9800', bg: 'rgba(255,152,0,0.1)' };
  if (s === 'Hoàn thành') return { color: '#7C5CBF', bg: 'rgba(124,92,191,0.1)' };
  return { color: 'var(--tm)', bg: 'var(--bgs)' };
}

function itemStatusColor(s) {
  if (s === 'Trong lò') return { color: '#324F27', bg: 'rgba(50,79,39,0.1)' };
  if (s === 'Đã ra lò') return { color: '#FF9800', bg: 'rgba(255,152,0,0.1)' };
  if (s === 'Đã đóng kiện') return { color: '#7C5CBF', bg: 'rgba(124,92,191,0.1)' };
  if (s === 'Bỏ lại - Chờ ghép') return { color: 'var(--ac)', bg: 'rgba(242,101,34,0.1)' };
  if (s === 'Bỏ lại - Loại') return { color: '#C0392B', bg: 'rgba(192,57,43,0.1)' };
  return { color: 'var(--tm)', bg: 'var(--bgs)' };
}

function daysBetween(d1, d2) {
  if (!d1 || !d2) return null;
  return Math.round((new Date(d2) - new Date(d1)) / 86400000);
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtNum(n, decimals = 2) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('vi-VN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// ── Styles ──────────────────────────────────────────────────
const cardS = { background: 'var(--bgc)', borderRadius: 10, border: '1px solid var(--bd)', padding: 16, cursor: 'pointer', transition: 'box-shadow 0.15s, border-color 0.15s' };
const btnS = { padding: '7px 16px', borderRadius: 6, border: 'none', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' };
const btnPrimary = { ...btnS, background: 'var(--ac)', color: '#fff' };
const btnSecondary = { ...btnS, background: 'var(--bgs)', color: 'var(--ts)', border: '1px solid var(--bd)' };
const btnDanger = { ...btnS, background: 'var(--dg)', color: '#fff' };
const inputS = { width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--bd)', fontSize: '0.78rem', background: 'var(--bgc)', color: 'var(--tp)', outline: 'none', boxSizing: 'border-box' };
const labelS = { display: 'block', fontSize: '0.68rem', fontWeight: 700, color: 'var(--brl)', marginBottom: 4 };
const thS = { padding: '5px 8px', fontSize: '0.68rem', fontWeight: 700, color: 'var(--brl)', textAlign: 'left', borderBottom: '2px solid var(--bd)', whiteSpace: 'nowrap' };
const tdS = { padding: '4px 8px', fontSize: '0.76rem', borderBottom: '1px solid var(--bd)' };
const badgeS = (c) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: '0.65rem', fontWeight: 700, color: c.color, background: c.bg });

// Tìm hệ số quy đổi phù hợp nhất cho loại gỗ + dày
function findRate(woodName, thickness, conversionRates) {
  if (!woodName) return null;
  const wn = woodName.toLowerCase();
  const matches = conversionRates.filter(cr => {
    const cn = cr.name.toLowerCase();
    return wn.includes(cn) || cn.includes(wn);
  });
  if (!matches.length) return null;
  // Parse thickness number cho so sánh threshold
  const thickNum = parseFloat(String(thickness).replace(/[^\d.]/g, ''));
  // Ưu tiên entry có thickness_min phù hợp
  if (!isNaN(thickNum)) {
    const thickMatch = matches.find(cr => {
      if (!cr.thicknessMin) return false;
      const min = parseFloat(String(cr.thicknessMin).replace(/[^\d.]/g, ''));
      return !isNaN(min) && thickNum >= min;
    });
    if (thickMatch) return thickMatch;
  }
  // Fallback: entry không có threshold
  return matches.find(cr => !cr.thicknessMin) || matches[0];
}

// ── Tab: Bảng quy đổi ──────────────────────────────────────
function ConversionTab({ conversionRates, setConversionRates, useAPI, notify, ce }) {
  const [editing, setEditing] = useState(null); // id hoặc 'new'
  const [nameVal, setNameVal] = useState('');
  const [rateVal, setRateVal] = useState('');
  const [thickVal, setThickVal] = useState('');
  const [notesVal, setNotesVal] = useState('');

  const startEdit = (cr) => {
    setEditing(cr.id); setNameVal(cr.name); setRateVal(String(cr.rate)); setThickVal(cr.thicknessMin || ''); setNotesVal(cr.notes || '');
  };
  const startNew = () => {
    setEditing('new'); setNameVal(''); setRateVal(''); setThickVal(''); setNotesVal('');
  };
  const cancel = () => setEditing(null);

  const save = async () => {
    if (!nameVal.trim()) { notify('Tên gỗ không được trống', false); return; }
    const rate = parseFloat(rateVal);
    if (!rate || rate <= 0) { notify('Hệ số phải là số dương', false); return; }
    if (editing === 'new') {
      const tmp = { id: 'tmp_' + Date.now(), name: nameVal.trim(), rate, thicknessMin: thickVal.trim() || null, notes: notesVal.trim() || null, sortOrder: conversionRates.length };
      setConversionRates(prev => [...prev, tmp]);
      setEditing(null);
      if (useAPI) {
        const api = await import('../api.js');
        const r = await api.addConversionRate(nameVal.trim(), rate, thickVal.trim(), notesVal.trim());
        if (r?.error) notify('Lỗi: ' + r.error, false);
        else { notify('Đã thêm'); setConversionRates(prev => prev.map(x => x.id === tmp.id ? { ...x, id: r.id } : x)); }
      }
    } else {
      setConversionRates(prev => prev.map(r => r.id === editing ? { ...r, name: nameVal.trim(), rate, thicknessMin: thickVal.trim() || null, notes: notesVal.trim() || null } : r));
      setEditing(null);
      if (useAPI) {
        const api = await import('../api.js');
        const r = await api.updateConversionRate(editing, nameVal.trim(), rate, thickVal.trim(), notesVal.trim());
        if (r?.error) notify('Lỗi: ' + r.error, false);
        else notify('Đã cập nhật');
      }
    }
  };

  const handleDelete = async (cr) => {
    if (!window.confirm(`Xóa "${cr.name}"?`)) return;
    setConversionRates(prev => prev.filter(r => r.id !== cr.id));
    if (useAPI) {
      const api = await import('../api.js');
      const r = await api.deleteConversionRate(cr.id);
      if (r?.error) notify('Lỗi: ' + r.error, false);
      else notify('Đã xóa');
    }
  };

  return (
    <div style={{ background: 'var(--bgc)', borderRadius: 10, border: '1px solid var(--bd)', overflow: 'hidden', maxWidth: 620 }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>Bảng quy đổi kg/m³</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--tm)' }}>m³ = kg ÷ hệ số</span>
          {ce && editing !== 'new' && <button onClick={startNew} style={{ ...btnPrimary, padding: '3px 10px', fontSize: '0.7rem' }}>+ Thêm</button>}
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>
          <th style={thS}>Tên gỗ</th>
          <th style={thS}>Dày tối thiểu</th>
          <th style={{ ...thS, textAlign: 'right' }}>Hệ số (kg/m³)</th>
          <th style={thS}>Ghi chú</th>
          {ce && <th style={{ ...thS, width: 70 }}></th>}
        </tr></thead>
        <tbody>
          {conversionRates.map(cr => {
            const isEd = editing === cr.id;
            return (
              <tr key={cr.id} style={{ background: isEd ? 'var(--acbg)' : undefined }}>
                <td style={tdS}>{isEd ? <input value={nameVal} onChange={e => setNameVal(e.target.value)} style={{ ...inputS, width: 110, padding: '3px 6px' }} autoFocus /> : <strong>{cr.name}</strong>}</td>
                <td style={{ ...tdS, color: cr.thicknessMin ? 'var(--ac)' : 'var(--tm)', fontSize: '0.72rem' }}>
                  {isEd ? <input value={thickVal} onChange={e => setThickVal(e.target.value)} placeholder="VD: 3.5F" style={{ ...inputS, width: 70, padding: '3px 6px' }} /> : (cr.thicknessMin ? `≥ ${cr.thicknessMin}` : '—')}
                </td>
                <td style={{ ...tdS, textAlign: 'right', fontWeight: 600, fontFamily: 'monospace' }}>
                  {isEd ? <input type="number" step="1" value={rateVal} onChange={e => setRateVal(e.target.value)} style={{ ...inputS, width: 90, padding: '3px 6px', textAlign: 'right' }} /> : fmtNum(cr.rate, 0)}
                </td>
                <td style={{ ...tdS, fontSize: '0.7rem', color: 'var(--tm)' }}>
                  {isEd ? <input value={notesVal} onChange={e => setNotesVal(e.target.value)} style={{ ...inputS, width: 100, padding: '3px 6px' }} /> : (cr.notes || '')}
                </td>
                {ce && <td style={{ ...tdS, textAlign: 'center', whiteSpace: 'nowrap' }}>
                  {isEd ? (
                    <>
                      <button onClick={save} style={{ background: 'none', border: 'none', color: 'var(--gn)', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem' }}>✓</button>
                      <button onClick={cancel} style={{ background: 'none', border: 'none', color: 'var(--tm)', cursor: 'pointer', fontSize: '0.75rem', marginLeft: 4 }}>✕</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEdit(cr)} style={{ background: 'none', border: 'none', color: 'var(--brl)', cursor: 'pointer', fontSize: '0.72rem' }}>sửa</button>
                      <button onClick={() => handleDelete(cr)} style={{ background: 'none', border: 'none', color: 'var(--dg)', cursor: 'pointer', fontSize: '0.72rem', marginLeft: 4 }}>xóa</button>
                    </>
                  )}
                </td>}
              </tr>
            );
          })}
          {editing === 'new' && (
            <tr style={{ background: 'var(--acbg)' }}>
              <td style={tdS}><input value={nameVal} onChange={e => setNameVal(e.target.value)} placeholder="Tên gỗ" style={{ ...inputS, width: 110, padding: '3px 6px' }} autoFocus /></td>
              <td style={tdS}><input value={thickVal} onChange={e => setThickVal(e.target.value)} placeholder="VD: 3.5F" style={{ ...inputS, width: 70, padding: '3px 6px' }} /></td>
              <td style={{ ...tdS, textAlign: 'right' }}><input type="number" step="1" value={rateVal} onChange={e => setRateVal(e.target.value)} placeholder="kg/m³" style={{ ...inputS, width: 90, padding: '3px 6px', textAlign: 'right' }} /></td>
              <td style={tdS}><input value={notesVal} onChange={e => setNotesVal(e.target.value)} placeholder="Ghi chú" style={{ ...inputS, width: 100, padding: '3px 6px' }} /></td>
              {ce && <td style={{ ...tdS, textAlign: 'center', whiteSpace: 'nowrap' }}>
                <button onClick={save} style={{ background: 'none', border: 'none', color: 'var(--gn)', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem' }}>✓</button>
                <button onClick={cancel} style={{ background: 'none', border: 'none', color: 'var(--tm)', cursor: 'pointer', fontSize: '0.75rem', marginLeft: 4 }}>✕</button>
              </td>}
            </tr>
          )}
          {!conversionRates.length && editing !== 'new' && <tr><td colSpan={ce ? 5 : 4} style={{ ...tdS, textAlign: 'center', color: 'var(--tm)', padding: 12 }}>Chưa có hệ số quy đổi</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ── Tab: Hàng bỏ lại ───────────────────────────────────────
function LeftoverTab({ allItems, rawWoodTypes, batches }) {
  const [filterWood, setFilterWood] = useState('');
  const [filterThick, setFilterThick] = useState('');

  const leftovers = useMemo(() => allItems.filter(it => it.status === 'Bỏ lại - Chờ ghép'), [allItems]);
  const wtMap = useMemo(() => Object.fromEntries(rawWoodTypes.map(w => [w.id, w])), [rawWoodTypes]);
  const batchMap = useMemo(() => Object.fromEntries(batches.map(b => [b.id, b])), [batches]);

  const filtered = useMemo(() => {
    let r = leftovers;
    if (filterWood) r = r.filter(it => it.woodTypeId === filterWood);
    if (filterThick) r = r.filter(it => it.thickness === filterThick);
    return r;
  }, [leftovers, filterWood, filterThick]);

  const woodTypes = useMemo(() => [...new Set(leftovers.map(it => it.woodTypeId))].filter(Boolean), [leftovers]);
  const thicknesses = useMemo(() => [...new Set(leftovers.map(it => it.thickness))].filter(Boolean).sort(), [leftovers]);
  const totalVol = filtered.reduce((s, it) => s + (it.volumeLeftover || 0), 0);

  return (
    <div style={{ background: 'var(--bgc)', borderRadius: 10, border: '1px solid var(--bd)', overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Hàng bỏ lại chờ ghép <span style={{ fontWeight: 400, color: 'var(--tm)', fontSize: '0.75rem' }}>({leftovers.length} mục — {fmtNum(totalVol)} m³)</span></div>
        <div style={{ display: 'flex', gap: 6 }}>
          <select value={filterWood} onChange={e => setFilterWood(e.target.value)} style={{ ...inputS, width: 'auto' }}>
            <option value="">Tất cả loại gỗ</option>
            {woodTypes.map(id => <option key={id} value={id}>{wtMap[id]?.name || id}</option>)}
          </select>
          <select value={filterThick} onChange={e => setFilterThick(e.target.value)} style={{ ...inputS, width: 'auto' }}>
            <option value="">Tất cả dày</option>
            {thicknesses.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>
          <th style={thS}>Mã</th>
          <th style={thS}>Loại gỗ</th>
          <th style={thS}>Dày</th>
          <th style={thS}>Đơn vị</th>
          <th style={{ ...thS, textAlign: 'right' }}>m³ bỏ lại</th>
          <th style={thS}>Lý do</th>
          <th style={thS}>Từ lò</th>
        </tr></thead>
        <tbody>
          {filtered.map(it => {
            const batch = batchMap[it.batchId];
            return (
              <tr key={it.id}>
                <td style={{ ...tdS, fontFamily: 'monospace', fontSize: '0.72rem' }}>{it.itemCode}</td>
                <td style={tdS}>{wtMap[it.woodTypeId]?.icon} {wtMap[it.woodTypeId]?.name || '—'}</td>
                <td style={tdS}>{it.thickness}</td>
                <td style={tdS}>{it.ownerType === 'company' ? <span style={{ color: 'var(--gn)', fontWeight: 600 }}>Công ty</span> : it.ownerName}</td>
                <td style={{ ...tdS, textAlign: 'right', fontWeight: 600 }}>{fmtNum(it.volumeLeftover)}</td>
                <td style={{ ...tdS, fontSize: '0.72rem', color: 'var(--ts)' }}>{it.leftoverReason || '—'}</td>
                <td style={{ ...tdS, fontSize: '0.72rem' }}>{batch ? `Lò ${batch.kilnNumber}` : '—'}</td>
              </tr>
            );
          })}
          {!filtered.length && <tr><td colSpan={7} style={{ ...tdS, textAlign: 'center', color: 'var(--tm)', padding: 24 }}>Không có hàng bỏ lại</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ── Dialog: Thêm/Sửa mẻ sấy ──────────────────────────────
function BatchDialog({ batch, kilnNumber, onSave, onClose }) {
  const [entryDate, setEntryDate] = useState(batch?.entryDate || new Date().toISOString().slice(0, 10));
  const [expectedExitDate, setExpectedExitDate] = useState(batch?.expectedExitDate || '');
  const [notes, setNotes] = useState(batch?.notes || '');

  const totalDays = daysBetween(entryDate, expectedExitDate);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bgc)', borderRadius: 12, padding: 24, width: 400, maxWidth: '95vw', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}>
        <div style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: 16 }}>{batch ? 'Sửa mẻ sấy' : `Nạp gỗ — Lò ${kilnNumber}`}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelS}>Ngày vào lò *</label>
            <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} style={inputS} />
          </div>
          <div>
            <label style={labelS}>Ngày ra lò dự kiến</label>
            <input type="date" value={expectedExitDate} onChange={e => setExpectedExitDate(e.target.value)} style={inputS} />
            {totalDays != null && totalDays > 0 && <div style={{ fontSize: '0.68rem', color: 'var(--gn)', marginTop: 2 }}>Tổng: {totalDays} ngày sấy</div>}
          </div>
          <div>
            <label style={labelS}>Ghi chú</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...inputS, resize: 'vertical' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          <button onClick={onClose} style={btnSecondary}>Hủy</button>
          <button onClick={() => { if (!entryDate) return; onSave({ entryDate, expectedExitDate, notes }); }} style={btnPrimary}>{batch ? 'Cập nhật' : 'Tạo mẻ sấy'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Dialog: Thêm mục gỗ ────────────────────────────────────
function AddItemsDialog({ batchId, rawWoodTypes, conversionRates, onSave, onClose }) {
  const [rows, setRows] = useState([makeRow()]);

  function makeRow() {
    return { _id: Date.now() + Math.random(), woodTypeId: rawWoodTypes[0]?.id || '', thickness: '', ownerType: 'company', ownerName: '', weightKg: '', notes: '' };
  }

  const updateRow = (idx, field, val) => setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));

  // Lookup rate cho 1 row: tìm theo tên gỗ + dày
  const getRowRate = (row) => {
    const wt = rawWoodTypes.find(w => w.id === row.woodTypeId);
    const cr = findRate(wt?.name, row.thickness, conversionRates);
    return cr?.rate || 0;
  };
  const calcVol = (row) => {
    const kg = parseFloat(row.weightKg) || 0;
    const rate = getRowRate(row);
    return rate > 0 ? kg / rate : 0;
  };

  const totalKg = rows.reduce((s, r) => s + (parseFloat(r.weightKg) || 0), 0);
  const totalM3 = rows.reduce((s, r) => s + calcVol(r), 0);

  const handleSave = () => {
    const valid = rows.filter(r => r.woodTypeId && r.thickness && (parseFloat(r.weightKg) > 0));
    if (!valid.length) return;
    const items = valid.map(r => ({
      woodTypeId: r.woodTypeId, thickness: r.thickness.trim(),
      ownerType: r.ownerType, ownerName: r.ownerType === 'customer' ? r.ownerName.trim() : null,
      weightKg: parseFloat(r.weightKg) || 0,
      conversionRate: getRowRate(r) || null,
      notes: r.notes.trim() || null,
    }));
    onSave(items);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bgc)', borderRadius: 12, padding: 24, width: 720, maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}>
        <div style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: 16 }}>Thêm gỗ vào lò</div>

        {rows.map((row, idx) => {
          const rate = getRowRate(row);
          const vol = calcVol(row);
          const noRate = row.woodTypeId && !rate;
          return (
            <div key={row._id} style={{ background: 'var(--bgs)', borderRadius: 8, padding: 12, marginBottom: 8, border: '1px solid var(--bd)' }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 6 }}>
                <div style={{ flex: '1 1 150px' }}>
                  <label style={labelS}>Loại gỗ *</label>
                  <select value={row.woodTypeId} onChange={e => updateRow(idx, 'woodTypeId', e.target.value)} style={inputS}>
                    {rawWoodTypes.map(wt => <option key={wt.id} value={wt.id}>{wt.name}</option>)}
                  </select>
                </div>
                <div style={{ flex: '0 0 80px' }}>
                  <label style={labelS}>Dày *</label>
                  <input value={row.thickness} onChange={e => updateRow(idx, 'thickness', e.target.value)} placeholder="4/4" style={inputS} />
                </div>
                <div style={{ flex: '0 0 100px' }}>
                  <label style={labelS}>Số cân (kg) *</label>
                  <input type="number" value={row.weightKg} onChange={e => updateRow(idx, 'weightKg', e.target.value)} style={inputS} />
                </div>
                <div style={{ flex: '0 0 80px', textAlign: 'center' }}>
                  <label style={labelS}>kg/m³</label>
                  <div style={{ fontSize: '0.75rem', color: rate ? 'var(--ts)' : 'var(--dg)', lineHeight: '34px' }}>
                    {rate ? fmtNum(rate, 0) : '—'}
                  </div>
                </div>
                <div style={{ flex: '0 0 70px', textAlign: 'center' }}>
                  <label style={labelS}>m³</label>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--gn)', lineHeight: '34px' }}>
                    {vol > 0 ? fmtNum(vol, 3) : '—'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: '0 0 110px' }}>
                  <label style={labelS}>Đơn vị</label>
                  <select value={row.ownerType} onChange={e => updateRow(idx, 'ownerType', e.target.value)} style={inputS}>
                    <option value="company">Công ty</option>
                    <option value="customer">Khách hàng</option>
                  </select>
                </div>
                {row.ownerType === 'customer' && (
                  <div style={{ flex: '1 1 120px' }}>
                    <label style={labelS}>Tên khách</label>
                    <input value={row.ownerName} onChange={e => updateRow(idx, 'ownerName', e.target.value)} placeholder="Tên chủ gỗ" style={inputS} />
                  </div>
                )}
                <div style={{ flex: '1 1 120px' }}>
                  <label style={labelS}>Ghi chú</label>
                  <input value={row.notes} onChange={e => updateRow(idx, 'notes', e.target.value)} style={inputS} />
                </div>
                <button onClick={() => setRows(prev => prev.filter((_, i) => i !== idx))} style={{ ...btnDanger, padding: '6px 10px', marginBottom: 1 }} title="Xóa dòng">✕</button>
              </div>
              {noRate && <div style={{ marginTop: 4, fontSize: '0.65rem', color: 'var(--dg)' }}>Không tìm thấy hệ số quy đổi — kiểm tra Bảng quy đổi</div>}
            </div>
          );
        })}

        <button onClick={() => setRows(prev => [...prev, makeRow()])} style={{ ...btnSecondary, marginTop: 4, width: '100%' }}>+ Thêm dòng</button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--bd)' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--ts)' }}>
            Tổng: <strong>{fmtNum(totalKg, 0)} kg</strong> = <strong style={{ color: 'var(--gn)' }}>{fmtNum(totalM3, 3)} m³</strong>
            <span style={{ marginLeft: 8, color: 'var(--tm)' }}>({rows.filter(r => r.woodTypeId && r.thickness && parseFloat(r.weightKg) > 0).length} mục hợp lệ)</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={btnSecondary}>Hủy</button>
            <button onClick={handleSave} style={btnPrimary}>Lưu</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Dialog: Đóng kiện (Packing) ────────────────────────────
function PackingDialog({ items, rawWoodTypes, allLeftovers, onSave, onClose }) {
  const wtMap = useMemo(() => Object.fromEntries(rawWoodTypes.map(w => [w.id, w])), [rawWoodTypes]);

  // Nhóm theo loại gỗ + dày
  const groups = useMemo(() => {
    const map = {};
    items.filter(it => it.status === 'Đã ra lò').forEach(it => {
      const key = `${it.woodTypeId}||${it.thickness}`;
      if (!map[key]) map[key] = { woodTypeId: it.woodTypeId, thickness: it.thickness, items: [] };
      map[key].items.push(it);
    });
    return Object.values(map);
  }, [items]);

  // Tìm hàng bỏ lại cùng loại + dày
  const leftoversByGroup = useMemo(() => {
    const map = {};
    allLeftovers.forEach(it => {
      const key = `${it.woodTypeId}||${it.thickness}`;
      if (!map[key]) map[key] = [];
      map[key].push(it);
    });
    return map;
  }, [allLeftovers]);

  const [packingData, setPackingData] = useState(() => {
    const d = {};
    groups.forEach(g => {
      const key = `${g.woodTypeId}||${g.thickness}`;
      const totalVol = g.items.reduce((s, it) => s + (it.volumeM3 || 0), 0);
      d[key] = { volumePacked: String(totalVol.toFixed(3)), volumeLeftover: '0', leftoverReason: 'CL cao - chờ ghép', includeLeftovers: false };
    });
    return d;
  });

  const updateGroup = (key, field, val) => setPackingData(prev => ({ ...prev, [key]: { ...prev[key], [field]: val } }));

  const handleSave = () => {
    const result = [];
    groups.forEach(g => {
      const key = `${g.woodTypeId}||${g.thickness}`;
      const pd = packingData[key];
      const packed = parseFloat(pd.volumePacked) || 0;
      const leftover = parseFloat(pd.volumeLeftover) || 0;
      g.items.forEach(it => {
        const ratio = it.volumeM3 > 0 ? it.volumeM3 / g.items.reduce((s, x) => s + (x.volumeM3 || 0), 0) : 0;
        result.push({
          id: it.id,
          volumePacked: +(packed * ratio).toFixed(4),
          volumeLeftover: +(leftover * ratio).toFixed(4),
          leftoverReason: leftover > 0 ? pd.leftoverReason : null,
          status: leftover > 0 ? 'Bỏ lại - Chờ ghép' : 'Đã đóng kiện',
        });
      });
      // Nếu bật ghép bỏ lại → cập nhật leftover items
      if (pd.includeLeftovers) {
        const lItems = leftoversByGroup[key] || [];
        lItems.forEach(it => {
          result.push({ id: it.id, volumePacked: it.volumeLeftover, volumeLeftover: 0, leftoverReason: null, status: 'Đã đóng kiện' });
        });
      }
    });
    onSave(result);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bgc)', borderRadius: 12, padding: 24, width: 680, maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}>
        <div style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: 16 }}>Đóng kiện</div>

        {groups.map(g => {
          const key = `${g.woodTypeId}||${g.thickness}`;
          const pd = packingData[key];
          const totalVol = g.items.reduce((s, it) => s + (it.volumeM3 || 0), 0);
          const leftoverItems = leftoversByGroup[key] || [];
          const leftoverVol = leftoverItems.reduce((s, it) => s + (it.volumeLeftover || 0), 0);
          return (
            <div key={key} style={{ background: 'var(--bgs)', borderRadius: 8, padding: 14, marginBottom: 10, border: '1px solid var(--bd)' }}>
              <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: 8 }}>
                {wtMap[g.woodTypeId]?.icon} {wtMap[g.woodTypeId]?.name || '—'} — {g.thickness}
                <span style={{ fontWeight: 400, color: 'var(--tm)', marginLeft: 8 }}>{g.items.length} mục, {fmtNum(totalVol, 3)} m³</span>
              </div>
              {g.items.map(it => (
                <div key={it.id} style={{ display: 'flex', gap: 12, fontSize: '0.74rem', padding: '3px 0', color: 'var(--ts)' }}>
                  <span style={{ fontFamily: 'monospace', minWidth: 130 }}>{it.itemCode}</span>
                  <span>{it.ownerType === 'company' ? 'Công ty' : it.ownerName}</span>
                  <span style={{ marginLeft: 'auto', fontWeight: 600 }}>{fmtNum(it.volumeM3, 3)} m³</span>
                </div>
              ))}
              {leftoverItems.length > 0 && (
                <div style={{ marginTop: 8, padding: '6px 8px', background: 'rgba(242,101,34,0.06)', borderRadius: 6, fontSize: '0.72rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input type="checkbox" checked={pd.includeLeftovers} onChange={e => updateGroup(key, 'includeLeftovers', e.target.checked)} />
                    <span>Ghép {leftoverItems.length} mục bỏ lại ({fmtNum(leftoverVol, 3)} m³)</span>
                  </label>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: '0 0 120px' }}>
                  <label style={labelS}>Đóng kiện (m³)</label>
                  <input type="number" step="0.001" value={pd.volumePacked} onChange={e => updateGroup(key, 'volumePacked', e.target.value)} style={inputS} />
                </div>
                <div style={{ flex: '0 0 120px' }}>
                  <label style={labelS}>Bỏ lại (m³)</label>
                  <input type="number" step="0.001" value={pd.volumeLeftover} onChange={e => updateGroup(key, 'volumeLeftover', e.target.value)} style={inputS} />
                </div>
                <div style={{ flex: '1 1 180px' }}>
                  <label style={labelS}>Lý do bỏ lại</label>
                  <select value={pd.leftoverReason} onChange={e => updateGroup(key, 'leftoverReason', e.target.value)} style={inputS}>
                    <option>CL cao - chờ ghép</option>
                    <option>Không đạt CL</option>
                    <option>Khác</option>
                  </select>
                </div>
              </div>
            </div>
          );
        })}

        {!groups.length && <div style={{ padding: 24, textAlign: 'center', color: 'var(--tm)' }}>Không có mục gỗ nào ở trạng thái "Đã ra lò" để đóng kiện</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={btnSecondary}>Hủy</button>
          <button onClick={handleSave} style={btnPrimary} disabled={!groups.length}>Xác nhận đóng kiện</button>
        </div>
      </div>
    </div>
  );
}

// ── Chi tiết lò ─────────────────────────────────────────────
function KilnDetail({ batch, items, rawWoodTypes, conversionRates, allLeftovers, ce, useAPI, notify, onBack, onRefresh }) {
  const wtMap = useMemo(() => Object.fromEntries(rawWoodTypes.map(w => [w.id, w])), [rawWoodTypes]);
  const [showAddItems, setShowAddItems] = useState(false);
  const [showPacking, setShowPacking] = useState(false);
  const [showEditBatch, setShowEditBatch] = useState(false);
  const batchItems = useMemo(() => items.filter(it => it.batchId === batch.id), [items, batch.id]);

  const totalKg = batchItems.reduce((s, it) => s + (it.weightKg || 0), 0);
  const totalM3 = batchItems.reduce((s, it) => s + (it.volumeM3 || 0), 0);
  const totalDays = daysBetween(batch.entryDate, batch.expectedExitDate);
  const elapsed = daysBetween(batch.entryDate, new Date().toISOString().slice(0, 10));
  const progress = totalDays && elapsed != null ? Math.min(Math.max(elapsed / totalDays, 0), 1) : 0;

  const { color: stColor, bg: stBg } = statusColor(batch.status);

  const handleAddItems = useCallback(async (newItems) => {
    setShowAddItems(false);
    if (useAPI) {
      const api = await import('../api.js');
      const r = await api.addKilnItemsBatch(batch.id, newItems);
      if (r?.error) { notify('Lỗi: ' + r.error, false); return; }
      notify(`Đã thêm ${newItems.length} mục gỗ vào lò`);
    }
    onRefresh();
  }, [batch.id, useAPI, notify, onRefresh]);

  const handleExitKiln = useCallback(async () => {
    if (!window.confirm('Xác nhận ra lò? Tất cả gỗ sẽ chuyển sang trạng thái "Đã ra lò".')) return;
    const today = new Date().toISOString().slice(0, 10);
    if (useAPI) {
      const api = await import('../api.js');
      const itemIds = batchItems.filter(it => it.status === 'Trong lò').map(it => it.id);
      await Promise.all([
        api.updateKilnBatch(batch.id, { status: 'Đã ra lò', actualExitDate: today }),
        itemIds.length ? api.updateKilnItemsBatch(itemIds, { status: 'Đã ra lò' }) : Promise.resolve(),
      ]);
      notify('Đã ra lò thành công');
    }
    onRefresh();
  }, [batch.id, batchItems, useAPI, notify, onRefresh]);

  const handlePacking = useCallback(async (packingResult) => {
    setShowPacking(false);
    const today = new Date().toISOString().slice(0, 10);
    if (useAPI) {
      const api = await import('../api.js');
      for (const r of packingResult) {
        await api.updateKilnItem(r.id, {
          status: r.status, volumePacked: r.volumePacked, volumeLeftover: r.volumeLeftover,
          leftoverReason: r.leftoverReason, packingDate: today,
        });
      }
      // Kiểm tra tất cả items đã settled → chuyển batch sang Hoàn thành
      const updItems = await api.fetchKilnItems(batch.id);
      const allSettled = updItems.every(it => it.status !== 'Trong lò' && it.status !== 'Đã ra lò');
      if (allSettled) {
        await api.updateKilnBatch(batch.id, { status: 'Hoàn thành' });
      }
      notify('Đã cập nhật đóng kiện');
    }
    onRefresh();
  }, [batch.id, useAPI, notify, onRefresh]);

  const handleEditBatch = useCallback(async (data) => {
    setShowEditBatch(false);
    if (useAPI) {
      const api = await import('../api.js');
      await api.updateKilnBatch(batch.id, data);
      notify('Đã cập nhật mẻ sấy');
    }
    onRefresh();
  }, [batch.id, useAPI, notify, onRefresh]);

  const handleDeleteItem = useCallback(async (itemId) => {
    if (!window.confirm('Xóa mục gỗ này?')) return;
    if (useAPI) {
      const api = await import('../api.js');
      await api.deleteKilnItem(itemId);
      notify('Đã xóa');
    }
    onRefresh();
  }, [useAPI, notify, onRefresh]);

  const ownerStats = useMemo(() => {
    const companyM3 = batchItems.filter(it => it.ownerType === 'company').reduce((s, it) => s + (it.volumeM3 || 0), 0);
    const customerM3 = batchItems.filter(it => it.ownerType === 'customer').reduce((s, it) => s + (it.volumeM3 || 0), 0);
    const customerNames = [...new Set(batchItems.filter(it => it.ownerType === 'customer').map(it => it.ownerName).filter(Boolean))];
    return { companyM3, customerM3, customerNames };
  }, [batchItems]);

  return (
    <div>
      <button onClick={onBack} style={{ ...btnSecondary, marginBottom: 12 }}>← Quay lại</button>

      {/* Header */}
      <div style={{ ...cardS, cursor: 'default', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800 }}>Lò {batch.kilnNumber} — {batch.batchCode}</div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: '0.78rem', color: 'var(--ts)', flexWrap: 'wrap' }}>
              <span>Vào: <strong>{fmtDate(batch.entryDate)}</strong></span>
              <span>Ra DK: <strong>{fmtDate(batch.expectedExitDate)}</strong></span>
              {batch.actualExitDate && <span>Ra TT: <strong>{fmtDate(batch.actualExitDate)}</strong></span>}
              {totalDays != null && <span>Tổng: <strong>{totalDays} ngày</strong></span>}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: '0.75rem' }}>
              <span>Tổng: <strong>{fmtNum(totalKg, 0)} kg</strong> = <strong style={{ color: 'var(--gn)' }}>{fmtNum(totalM3, 3)} m³</strong></span>
              <span style={{ color: 'var(--gn)' }}>CT: {fmtNum(ownerStats.companyM3, 3)} m³</span>
              <span style={{ color: 'var(--ac)' }}>GC: {fmtNum(ownerStats.customerM3, 3)} m³</span>
            </div>
            {batch.notes && <div style={{ marginTop: 6, fontSize: '0.72rem', color: 'var(--tm)' }}>{batch.notes}</div>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <span style={badgeS(statusColor(batch.status))}>{batch.status}</span>
            {batch.status === 'Đang sấy' && totalDays > 0 && (
              <div style={{ width: 120 }}>
                <div style={{ height: 6, background: 'var(--bd)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: progress >= 1 ? 'var(--ac)' : 'var(--gn)', width: (progress * 100) + '%', borderRadius: 3, transition: 'width 0.3s' }} />
                </div>
                <div style={{ fontSize: '0.62rem', color: 'var(--tm)', textAlign: 'right', marginTop: 2 }}>{elapsed}/{totalDays} ngày</div>
              </div>
            )}
          </div>
        </div>

        {ce && (
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            {batch.status === 'Đang sấy' && <button onClick={() => setShowAddItems(true)} style={btnPrimary}>+ Thêm gỗ</button>}
            {batch.status === 'Đang sấy' && batchItems.length > 0 && <button onClick={handleExitKiln} style={{ ...btnS, background: '#FF9800', color: '#fff' }}>Ra lò</button>}
            {batch.status === 'Đã ra lò' && <button onClick={() => setShowPacking(true)} style={{ ...btnS, background: '#7C5CBF', color: '#fff' }}>Đóng kiện</button>}
            <button onClick={() => setShowEditBatch(true)} style={btnSecondary}>Sửa</button>
          </div>
        )}
      </div>

      {/* Items table */}
      <div style={{ background: 'var(--bgc)', borderRadius: 10, border: '1px solid var(--bd)', overflow: 'auto' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--bd)', fontWeight: 700, fontSize: '0.82rem' }}>
          Danh sách gỗ ({batchItems.length} mục)
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
          <thead><tr>
            <th style={thS}>Mã</th>
            <th style={thS}>Loại gỗ</th>
            <th style={thS}>Dày</th>
            <th style={thS}>Đơn vị</th>
            <th style={{ ...thS, textAlign: 'right' }}>Kg</th>
            <th style={{ ...thS, textAlign: 'right' }}>m³</th>
            <th style={thS}>Trạng thái</th>
            <th style={{ ...thS, textAlign: 'right' }}>Đã đóng</th>
            <th style={{ ...thS, textAlign: 'right' }}>Bỏ lại</th>
            {ce && <th style={{ ...thS, width: 50 }}></th>}
          </tr></thead>
          <tbody>
            {batchItems.map(it => {
              const isc = itemStatusColor(it.status);
              return (
                <tr key={it.id}>
                  <td style={{ ...tdS, fontFamily: 'monospace', fontSize: '0.72rem' }}>{it.itemCode}</td>
                  <td style={tdS}>{wtMap[it.woodTypeId]?.icon} {wtMap[it.woodTypeId]?.name || '—'}</td>
                  <td style={tdS}>{it.thickness}</td>
                  <td style={tdS}>{it.ownerType === 'company' ? <span style={{ color: 'var(--gn)', fontWeight: 600 }}>Công ty</span> : it.ownerName}</td>
                  <td style={{ ...tdS, textAlign: 'right' }}>{fmtNum(it.weightKg, 0)}</td>
                  <td style={{ ...tdS, textAlign: 'right', fontWeight: 600 }}>{fmtNum(it.volumeM3, 3)}</td>
                  <td style={tdS}><span style={badgeS(isc)}>{it.status}</span></td>
                  <td style={{ ...tdS, textAlign: 'right', color: it.volumePacked > 0 ? 'var(--gn)' : 'var(--tm)' }}>{it.volumePacked > 0 ? fmtNum(it.volumePacked, 3) : '—'}</td>
                  <td style={{ ...tdS, textAlign: 'right', color: it.volumeLeftover > 0 ? 'var(--ac)' : 'var(--tm)' }}>{it.volumeLeftover > 0 ? fmtNum(it.volumeLeftover, 3) : '—'}</td>
                  {ce && <td style={{ ...tdS, textAlign: 'center' }}>
                    {batch.status === 'Đang sấy' && <button onClick={() => handleDeleteItem(it.id)} style={{ background: 'none', border: 'none', color: 'var(--dg)', cursor: 'pointer', fontSize: '0.8rem' }} title="Xóa">✕</button>}
                  </td>}
                </tr>
              );
            })}
            {!batchItems.length && <tr><td colSpan={ce ? 10 : 9} style={{ ...tdS, textAlign: 'center', color: 'var(--tm)', padding: 24 }}>Chưa có gỗ trong lò</td></tr>}
          </tbody>
        </table>
      </div>

      {showAddItems && <AddItemsDialog batchId={batch.id} rawWoodTypes={rawWoodTypes} conversionRates={conversionRates} onSave={handleAddItems} onClose={() => setShowAddItems(false)} />}
      {showPacking && <PackingDialog items={batchItems} rawWoodTypes={rawWoodTypes} allLeftovers={allLeftovers} onSave={handlePacking} onClose={() => setShowPacking(false)} />}
      {showEditBatch && <BatchDialog batch={batch} kilnNumber={batch.kilnNumber} onSave={handleEditBatch} onClose={() => setShowEditBatch(false)} />}
    </div>
  );
}

// ── Tab: Lịch sử ────────────────────────────────────────────
function HistoryTab({ batches, rawWoodTypes, items }) {
  const wtMap = useMemo(() => Object.fromEntries(rawWoodTypes.map(w => [w.id, w])), [rawWoodTypes]);
  const completed = useMemo(() => batches.filter(b => b.status !== 'Đang sấy').sort((a, b) => (b.actualExitDate || b.entryDate || '').localeCompare(a.actualExitDate || a.entryDate || '')), [batches]);

  return (
    <div style={{ background: 'var(--bgc)', borderRadius: 10, border: '1px solid var(--bd)', overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--bd)', fontWeight: 700, fontSize: '0.85rem' }}>Lịch sử mẻ sấy</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>
          <th style={thS}>Mã mẻ</th>
          <th style={thS}>Lò</th>
          <th style={thS}>Vào</th>
          <th style={thS}>Ra</th>
          <th style={thS}>Ngày sấy</th>
          <th style={{ ...thS, textAlign: 'right' }}>m³</th>
          <th style={thS}>Trạng thái</th>
        </tr></thead>
        <tbody>
          {completed.map(b => {
            const bItems = items.filter(it => it.batchId === b.id);
            const totalM3 = bItems.reduce((s, it) => s + (it.volumeM3 || 0), 0);
            const days = daysBetween(b.entryDate, b.actualExitDate || b.expectedExitDate);
            return (
              <tr key={b.id}>
                <td style={{ ...tdS, fontFamily: 'monospace', fontSize: '0.72rem' }}>{b.batchCode}</td>
                <td style={tdS}>Lò {b.kilnNumber}</td>
                <td style={tdS}>{fmtDate(b.entryDate)}</td>
                <td style={tdS}>{fmtDate(b.actualExitDate || b.expectedExitDate)}</td>
                <td style={tdS}>{days != null ? `${days} ngày` : '—'}</td>
                <td style={{ ...tdS, textAlign: 'right', fontWeight: 600 }}>{fmtNum(totalM3, 3)}</td>
                <td style={tdS}><span style={badgeS(statusColor(b.status))}>{b.status}</span></td>
              </tr>
            );
          })}
          {!completed.length && <tr><td colSpan={7} style={{ ...tdS, textAlign: 'center', color: 'var(--tm)', padding: 24 }}>Chưa có lịch sử</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ── MAIN: PgKiln ─────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════
export default function PgKiln({ ce, useAPI, notify, rawWoodTypes: rawWoodTypesProp }) {
  const [tab, setTab] = useState('kilns'); // kilns | leftover | conversion | history
  const [batches, setBatches] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [conversionRates, setConversionRates] = useState([]);
  const [rawWoodTypes, setRawWoodTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedKiln, setSelectedKiln] = useState(null); // batch object
  const [showNewBatch, setShowNewBatch] = useState(null); // kiln number

  // Load data
  const loadData = useCallback(async () => {
    if (!useAPI) { setLoading(false); return; }
    try {
      const api = await import('../api.js');
      const [bData, iData, crData, rwt] = await Promise.all([
        api.fetchKilnBatches(), api.fetchAllKilnItems(),
        api.fetchConversionRates(), api.fetchRawWoodTypes(),
      ]);
      setBatches(bData);
      setAllItems(iData);
      setConversionRates(crData);
      setRawWoodTypes(rwt);
    } catch (e) {
      notify('Lỗi tải dữ liệu lò sấy: ' + e.message, false);
    }
    setLoading(false);
  }, [useAPI, notify]);

  useEffect(() => { loadData(); }, [loadData]);

  // Kiln grid data
  const kilnData = useMemo(() => {
    const map = {};
    for (let i = 1; i <= KILN_COUNT; i++) map[i] = null;
    batches.filter(b => b.status === 'Đang sấy' || b.status === 'Đã ra lò').forEach(b => {
      if (!map[b.kilnNumber]) map[b.kilnNumber] = b;
    });
    return map;
  }, [batches]);

  const leftoverItems = useMemo(() => allItems.filter(it => it.status === 'Bỏ lại - Chờ ghép'), [allItems]);
  const leftoverCount = leftoverItems.length;

  // Stats
  const stats = useMemo(() => {
    let drying = 0, waiting = 0, empty = 0;
    let totalCompanyM3 = 0, totalCustomerM3 = 0;
    for (let i = 1; i <= KILN_COUNT; i++) {
      const b = kilnData[i];
      if (!b) { empty++; continue; }
      if (b.status === 'Đang sấy') drying++;
      else waiting++;
    }
    allItems.filter(it => it.status === 'Trong lò' || it.status === 'Đã ra lò').forEach(it => {
      if (it.ownerType === 'company') totalCompanyM3 += (it.volumeM3 || 0);
      else totalCustomerM3 += (it.volumeM3 || 0);
    });
    return { drying, waiting, empty, totalCompanyM3, totalCustomerM3 };
  }, [kilnData, allItems]);

  // Create batch
  const handleCreateBatch = useCallback(async (kilnNumber, data) => {
    setShowNewBatch(null);
    if (useAPI) {
      const api = await import('../api.js');
      const r = await api.addKilnBatch(kilnNumber, data.entryDate, data.expectedExitDate, data.notes);
      if (r?.error) { notify('Lỗi: ' + r.error, false); return; }
      notify(`Đã tạo mẻ sấy lò ${kilnNumber}`);
    }
    loadData();
  }, [useAPI, notify, loadData]);

  // Delete batch
  const handleDeleteBatch = useCallback(async (batchId) => {
    if (!window.confirm('Xóa mẻ sấy này? Tất cả mục gỗ bên trong sẽ bị xóa.')) return;
    if (useAPI) {
      const api = await import('../api.js');
      await api.deleteKilnBatch(batchId);
      notify('Đã xóa mẻ sấy');
    }
    setSelectedKiln(null);
    loadData();
  }, [useAPI, notify, loadData]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--tm)' }}>Đang tải dữ liệu lò sấy...</div>;

  // Detail view
  if (selectedKiln) {
    return (
      <KilnDetail
        batch={selectedKiln}
        items={allItems}
        rawWoodTypes={rawWoodTypes}
        conversionRates={conversionRates}
        allLeftovers={leftoverItems}
        ce={ce}
        useAPI={useAPI}
        notify={notify}
        onBack={() => { setSelectedKiln(null); loadData(); }}
        onRefresh={loadData}
      />
    );
  }

  const tabBtnS = (active) => ({
    padding: '8px 16px', borderRadius: '8px 8px 0 0', border: '1px solid var(--bd)', borderBottom: active ? '2px solid var(--bgc)' : '1px solid var(--bd)',
    background: active ? 'var(--bgc)' : 'var(--bgs)', color: active ? 'var(--tp)' : 'var(--ts)',
    fontWeight: active ? 700 : 500, fontSize: '0.78rem', cursor: 'pointer', marginBottom: -1, position: 'relative', zIndex: active ? 2 : 1,
  });

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 0, borderBottom: '1px solid var(--bd)', flexWrap: 'wrap' }}>
        <button style={tabBtnS(tab === 'kilns')} onClick={() => setTab('kilns')}>Lò sấy</button>
        <button style={tabBtnS(tab === 'leftover')} onClick={() => setTab('leftover')}>
          Hàng bỏ lại {leftoverCount > 0 && <span style={{ marginLeft: 4, minWidth: 18, height: 18, borderRadius: 9, background: 'var(--ac)', color: '#fff', fontSize: '0.6rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>{leftoverCount}</span>}
        </button>
        <button style={tabBtnS(tab === 'conversion')} onClick={() => setTab('conversion')}>Bảng quy đổi</button>
        <button style={tabBtnS(tab === 'history')} onClick={() => setTab('history')}>Lịch sử</button>
      </div>

      <div style={{ paddingTop: 16 }}>
        {/* ── TAB: Lò sấy ──────────── */}
        {tab === 'kilns' && (
          <div>
            {/* Grid 8 lò */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 12, marginBottom: 16 }}>
              {Array.from({ length: KILN_COUNT }, (_, i) => i + 1).map(n => {
                const batch = kilnData[n];
                if (!batch) {
                  return (
                    <div key={n} style={{ ...cardS, borderStyle: 'dashed', textAlign: 'center', opacity: 0.7 }} onClick={() => ce && setShowNewBatch(n)}>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: 6 }}>Lò {n}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--tm)', marginBottom: 8 }}>Trống</div>
                      {ce && <div style={{ fontSize: '0.7rem', color: 'var(--ac)', fontWeight: 600 }}>+ Nạp gỗ</div>}
                    </div>
                  );
                }
                const bItems = allItems.filter(it => it.batchId === batch.id);
                const totalKg = bItems.reduce((s, it) => s + (it.weightKg || 0), 0);
                const totalM3 = bItems.reduce((s, it) => s + (it.volumeM3 || 0), 0);
                const totalDays = daysBetween(batch.entryDate, batch.expectedExitDate);
                const elapsed = daysBetween(batch.entryDate, new Date().toISOString().slice(0, 10));
                const prog = totalDays && elapsed != null ? Math.min(Math.max(elapsed / totalDays, 0), 1) : 0;
                const { color: sc, bg: sbg } = statusColor(batch.status);
                const overdue = batch.status === 'Đang sấy' && totalDays && elapsed > totalDays;

                return (
                  <div key={n} style={{ ...cardS, borderColor: overdue ? 'var(--dg)' : undefined, boxShadow: overdue ? '0 0 0 1px var(--dg)' : undefined }} onClick={() => setSelectedKiln(batch)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800 }}>Lò {n}</div>
                      <span style={badgeS({ color: sc, bg: sbg })}>{batch.status}</span>
                    </div>
                    {batch.status === 'Đang sấy' && totalDays > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ height: 5, background: 'var(--bd)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: overdue ? 'var(--dg)' : 'var(--gn)', width: Math.min(prog, 1) * 100 + '%', borderRadius: 3 }} />
                        </div>
                        <div style={{ fontSize: '0.62rem', color: overdue ? 'var(--dg)' : 'var(--tm)', marginTop: 2 }}>
                          {elapsed}/{totalDays} ngày {overdue && '(quá hạn!)'}
                        </div>
                      </div>
                    )}
                    <div style={{ fontSize: '0.74rem', color: 'var(--ts)', lineHeight: 1.6 }}>
                      <div>{fmtNum(totalM3, 2)} m³ — {fmtNum(totalKg, 0)} kg</div>
                      <div>{bItems.length} mục gỗ</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Stats bar */}
            <div style={{ background: 'var(--bgc)', borderRadius: 8, border: '1px solid var(--bd)', padding: '10px 16px', display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: '0.76rem', color: 'var(--ts)' }}>
              <span>Đang sấy: <strong style={{ color: 'var(--gn)' }}>{stats.drying} lò</strong></span>
              <span>Chờ đóng: <strong style={{ color: '#FF9800' }}>{stats.waiting} lò</strong></span>
              <span>Trống: <strong>{stats.empty} lò</strong></span>
              <span style={{ marginLeft: 'auto' }}>Gỗ CT: <strong style={{ color: 'var(--gn)' }}>{fmtNum(stats.totalCompanyM3, 2)} m³</strong></span>
              <span>Gia công: <strong style={{ color: 'var(--ac)' }}>{fmtNum(stats.totalCustomerM3, 2)} m³</strong></span>
            </div>
          </div>
        )}

        {/* ── TAB: Hàng bỏ lại ──── */}
        {tab === 'leftover' && <LeftoverTab allItems={allItems} rawWoodTypes={rawWoodTypes} batches={batches} />}

        {/* ── TAB: Bảng quy đổi ─── */}
        {tab === 'conversion' && <ConversionTab conversionRates={conversionRates} setConversionRates={setConversionRates} useAPI={useAPI} notify={notify} ce={ce} />}

        {/* ── TAB: Lịch sử ──────── */}
        {tab === 'history' && <HistoryTab batches={batches} rawWoodTypes={rawWoodTypes} items={allItems} />}
      </div>

      {/* New batch dialog */}
      {showNewBatch && <BatchDialog kilnNumber={showNewBatch} onSave={(data) => handleCreateBatch(showNewBatch, data)} onClose={() => setShowNewBatch(null)} />}
    </div>
  );
}
