import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Dialog from '../components/Dialog';
import ComboFilter from '../components/ComboFilter';
import ReviewMeasurementDialog from '../components/ReviewMeasurementDialog';
import BoardsInput from '../components/BoardsInput';
import useTableSort from '../useTableSort';
import { normalizeThickness } from '../utils';
import { MeasurementList } from '../components/MeasurementPicker';
import BoardDetailDialog from '../components/BoardDetailDialog';

const KILN_COUNT = 8;
const BATCH_STATUSES = ['Đang sấy', 'Đã tắt', 'Đang ra lò', 'Đã ra hết'];
const NEXT_STATUS = { 'Đang sấy': 'Đã tắt', 'Đã tắt': 'Đang ra lò', 'Đang ra lò': 'Đã ra hết' };

function statusColor(s) {
  if (s === 'Đang sấy') return { color: '#324F27', bg: 'rgba(50,79,39,0.1)' };
  if (s === 'Đã tắt') return { color: '#D4A017', bg: 'rgba(212,160,23,0.1)' };
  if (s === 'Đang ra lò') return { color: '#F26522', bg: 'rgba(242,101,34,0.1)' };
  if (s === 'Đã ra hết') return { color: 'var(--tm)', bg: 'var(--bgs)' };
  return { color: 'var(--tm)', bg: 'var(--bgs)' };
}

function daysBetween(d1, d2) {
  if (!d1 || !d2) return null;
  return Math.round((new Date(d2) - new Date(d1)) / 86400000);
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtNum(n, dec = 2) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('vi-VN', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function findRate(woodTypeId, thickness, conversionRates) {
  if (!woodTypeId) return null;
  const matches = conversionRates.filter(cr => cr.woodTypeId === woodTypeId);
  if (!matches.length) return null;
  const thickNum = parseFloat(thickness);
  if (!isNaN(thickNum)) {
    const tm = matches.find(cr => { if (!cr.thicknessMin) return false; const min = parseFloat(String(cr.thicknessMin).replace(/[^\d.]/g, '')); return !isNaN(min) && thickNum >= min; });
    if (tm) return tm;
  }
  return matches.find(cr => !cr.thicknessMin) || matches[0];
}

// ── Styles ───────────────────────────────────────────────────
const cardS = { background: 'var(--bgc)', borderRadius: 10, border: '1px solid var(--bd)', padding: 14, cursor: 'pointer', transition: 'box-shadow 0.15s' };
const btnS = { padding: '6px 14px', borderRadius: 6, border: 'none', fontWeight: 600, fontSize: '0.74rem', cursor: 'pointer' };
const btnP = { ...btnS, background: 'var(--ac)', color: '#fff' };
const btnSec = { ...btnS, background: 'var(--bgs)', color: 'var(--ts)', border: '1px solid var(--bd)' };
const btnDg = { ...btnS, background: 'var(--dg)', color: '#fff' };
const inpS = { width: '100%', padding: '5px 8px', borderRadius: 5, border: '1px solid var(--bd)', fontSize: '0.76rem', background: 'var(--bgc)', color: 'var(--tp)', outline: 'none', boxSizing: 'border-box' };
const thS = { padding: '4px 8px', fontSize: '0.66rem', fontWeight: 700, color: 'var(--brl)', textAlign: 'left', borderBottom: '2px solid var(--bd)', whiteSpace: 'nowrap', transition: 'all 0.12s' };
const tdS = { padding: '3px 8px', fontSize: '0.74rem', borderBottom: '1px solid var(--bd)', whiteSpace: 'nowrap' };
const badge = (c) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: '0.63rem', fontWeight: 700, color: c.color, background: c.bg });
const panelS = { background: 'var(--bgc)', borderRadius: 10, border: '1px solid var(--bd)', overflow: 'hidden' };

function ImgUpload({ label, images, setImages }) {
  const ref = useRef(null);
  const handleFiles = (e) => {
    Array.from(e.target.files).forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => setImages(prev => [...prev, { file, preview: ev.target.result }]);
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.64rem', fontWeight: 700, color: 'var(--brl)', marginBottom: 3 }}>{label}</label>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {images.map((img, i) => (
          <div key={i} style={{ position: 'relative', width: 48, height: 48 }}>
            <img src={img.preview} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--bd)' }} />
            <button onClick={() => setImages(p => p.filter((_, j) => j !== i))} style={{ position: 'absolute', top: -4, right: -4, width: 14, height: 14, padding: 0, borderRadius: '50%', border: 'none', background: 'var(--dg)', color: '#fff', cursor: 'pointer', fontSize: '0.5rem', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
        ))}
        <button onClick={() => ref.current?.click()} style={{ width: 48, height: 48, borderRadius: 4, border: '1px dashed var(--bd)', background: 'var(--bgs)', color: 'var(--tm)', cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
      </div>
      <input ref={ref} type="file" multiple accept="image/*" onChange={handleFiles} style={{ display: 'none' }} />
    </div>
  );
}
const panelHead = { padding: '10px 14px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 };

// ══════════════════════════════════════════════════════════════
// TAB 1: LÒ SẤY (Grid + Detail)
// ══════════════════════════════════════════════════════════════
// ── Dialog nạp lò / sửa ngày ────────────────────────────────
function BatchDateDialog({ title, kilnNumber, entryDate: initEntry, expectedExitDate: initExit, onSave, onClose }) {
  const [entry, setEntry] = useState(initEntry || new Date().toISOString().slice(0, 10));
  const [exit, setExit] = useState(initExit || '');
  const days = daysBetween(entry, exit);
  const handleOk = () => { if (!entry) return; onSave({ entryDate: entry, expectedExitDate: exit || null }); };
  return (
    <Dialog open={true} onClose={onClose} onOk={handleOk} title={title || `Nạp gỗ — Lò ${kilnNumber}`} width={380}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: 'var(--brl)', marginBottom: 3 }}>Ngày vào lò *</label>
          <input type="date" value={entry} onChange={e => setEntry(e.target.value)} style={inpS} autoFocus />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: 'var(--brl)', marginBottom: 3 }}>Ngày ra lò dự kiến</label>
          <input type="date" value={exit} onChange={e => setExit(e.target.value)} style={inpS} />
          {days != null && days > 0 && <div style={{ fontSize: '0.66rem', color: 'var(--gn)', marginTop: 2 }}>Tổng: {days} ngày sấy</div>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
        <button onClick={onClose} style={btnSec}>Hủy</button>
        <button onClick={handleOk} style={btnP}>{initEntry ? 'Cập nhật' : 'Tạo mẻ sấy'}</button>
      </div>
    </Dialog>
  );
}

function KilnGrid({ batches, allItems, unsorted, wts, conversionRates, ce, isAdmin, user, useAPI, notify, onRefresh }) {
  const [selKiln, setSelKiln] = useState(null);
  const [showNewDialog, setShowNewDialog] = useState(null);
  const [companyOnly, setCompanyOnly] = useState(false);
  const wtMap = useMemo(() => Object.fromEntries(wts.map(w => [w.id, w])), [wts]);

  const kilnMap = useMemo(() => {
    const m = {};
    for (let i = 1; i <= KILN_COUNT; i++) m[i] = null;
    batches.filter(b => b.status !== 'Đã ra hết').forEach(b => { if (!m[b.kilnNumber]) m[b.kilnNumber] = b; });
    return m;
  }, [batches]);

  const stats = useMemo(() => {
    let drying = 0, off = 0, unloading = 0, empty = 0;
    for (let i = 1; i <= KILN_COUNT; i++) {
      const b = kilnMap[i];
      if (!b) { empty++; continue; }
      if (b.status === 'Đang sấy') drying++;
      else if (b.status === 'Đã tắt') off++;
      else unloading++;
    }
    return { drying, off, unloading, empty };
  }, [kilnMap]);

  const handleCreate = useCallback(async (kilnNum, data) => {
    setShowNewDialog(null);
    if (useAPI) {
      const api = await import('../api.js');
      const r = await api.addKilnBatch(kilnNum, data.entryDate, data.expectedExitDate, null);
      if (r?.error) { notify('Lỗi: ' + r.error, false); return; }
      notify(`Đã tạo mẻ sấy lò ${kilnNum}`);
    }
    onRefresh();
  }, [useAPI, notify, onRefresh]);

  const handleStatusChange = useCallback(async (batch, newStatus) => {
    if (!window.confirm(`Chuyển lò ${batch.kilnNumber} sang "${newStatus}"?`)) return;
    const updates = { status: newStatus };
    if (newStatus === 'Đã ra hết') updates.actualExitDate = new Date().toISOString().slice(0, 10);
    if (useAPI) {
      const api = await import('../api.js');
      await api.updateKilnBatch(batch.id, updates);
      notify(`Lò ${batch.kilnNumber}: ${newStatus}`);
    }
    // Reload data rồi cập nhật selKiln với batch mới
    await onRefresh();
    if (newStatus === 'Đã ra hết') {
      setSelKiln(null);
    } else {
      // Cập nhật selKiln ngay để UI phản ánh trạng thái mới
      setSelKiln(prev => prev?.id === batch.id ? { ...prev, ...updates } : prev);
    }
  }, [useAPI, notify, onRefresh]);

  const handleDeleteBatch = useCallback(async (batch) => {
    if (!window.confirm(`Xóa mẻ sấy ${batch.batchCode} (Lò ${batch.kilnNumber})? Tất cả mã gỗ bên trong sẽ bị xóa.`)) return;
    if (useAPI) {
      const api = await import('../api.js');
      await api.deleteKilnBatch(batch.id);
      notify(`Đã xóa mẻ ${batch.batchCode}`);
    }
    setSelKiln(null);
    onRefresh();
  }, [useAPI, notify, onRefresh]);

  // Tìm batch mới nhất từ state (sau refresh sẽ có data mới)
  const activeBatch = selKiln ? batches.find(b => b.id === selKiln.id) || selKiln : null;
  if (activeBatch) {
    return <KilnDetail batch={activeBatch} allItems={allItems} unsorted={unsorted} wts={wts} conversionRates={conversionRates} ce={ce} isAdmin={isAdmin} user={user} useAPI={useAPI} notify={notify} onBack={() => { setSelKiln(null); onRefresh(); }} onRefresh={onRefresh} onStatusChange={handleStatusChange} onDeleteBatch={isAdmin ? handleDeleteBatch : null} />;
  }

  return (
    <div>
      {/* Option filter */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: 'var(--ts)', cursor: 'pointer' }}>
          <input type="checkbox" checked={companyOnly} onChange={e => setCompanyOnly(e.target.checked)} />
          Chỉ gỗ công ty
        </label>
      </div>

      {/* Grid 4x2 cố định */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
        {Array.from({ length: KILN_COUNT }, (_, i) => i + 1).map(n => {
          const b = kilnMap[n];
          const minH = 160;
          if (!b) return (
            <div key={n} style={{ ...cardS, borderStyle: 'dashed', textAlign: 'center', opacity: 0.65, minHeight: minH, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }} onClick={() => ce && setShowNewDialog(n)}>
              <div style={{ fontSize: '0.92rem', fontWeight: 800, marginBottom: 4 }}>Lò {n}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--tm)' }}>Trống</div>
              {ce && <div style={{ fontSize: '0.68rem', color: 'var(--ac)', fontWeight: 600, marginTop: 8 }}>+ Nạp gỗ</div>}
            </div>
          );
          const rawItems = allItems.filter(it => it.batchId === b.id);
          const items = companyOnly ? rawItems.filter(it => it.ownerType === 'company') : rawItems;
          const totalM3 = items.reduce((s, it) => s + (it.volumeM3 || 0), 0);
          const totalDays = daysBetween(b.entryDate, b.expectedExitDate);
          const elapsed = daysBetween(b.entryDate, new Date().toISOString().slice(0, 10));
          const overdue = b.status === 'Đang sấy' && totalDays && elapsed > totalDays;
          const sc = statusColor(b.status);
          const splitCount = unsorted.filter(u => rawItems.some(it => it.id === u.kilnItemId)).length;

          // Nhóm theo loại gỗ + dày
          const groups = {};
          items.forEach(it => {
            const key = `${it.woodTypeId}||${it.thicknessCm}`;
            if (!groups[key]) groups[key] = { woodTypeId: it.woodTypeId, thicknessCm: it.thicknessCm, kg: 0, m3: 0, count: 0 };
            groups[key].kg += (it.weightKg || 0);
            groups[key].m3 += (it.volumeM3 || 0);
            groups[key].count++;
          });
          const groupList = Object.values(groups);

          return (
            <div key={n} style={{ ...cardS, borderColor: overdue ? 'var(--dg)' : undefined, minHeight: minH, display: 'flex', flexDirection: 'column' }} onClick={() => setSelKiln(b)}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: '0.92rem', fontWeight: 800 }}>Lò {n}</span>
                <span style={badge(sc)}>{b.status}</span>
              </div>

              {/* Progress */}
              {b.status === 'Đang sấy' && totalDays > 0 && (
                <div style={{ marginBottom: 4 }}>
                  <div style={{ height: 4, background: 'var(--bd)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: Math.min((elapsed / totalDays) * 100, 100) + '%', background: overdue ? 'var(--dg)' : 'var(--gn)', borderRadius: 2 }} />
                  </div>
                  <div style={{ fontSize: '0.58rem', color: overdue ? 'var(--dg)' : 'var(--tm)', marginTop: 1 }}>{elapsed}/{totalDays} ngày {overdue && '⚠ QUÁ HẠN'}</div>
                </div>
              )}
              {(b.status === 'Đang ra lò') && <div style={{ fontSize: '0.62rem', color: 'var(--ac)', marginBottom: 2 }}>{splitCount}/{rawItems.length} đã tách</div>}

              {/* Tổng */}
              <div style={{ fontSize: '0.7rem', color: 'var(--ts)', marginBottom: 4, fontWeight: 600 }}>{fmtNum(totalM3, 2)} m³</div>

              {/* Danh sách gỗ theo nhóm */}
              {b.status !== 'Đã ra hết' && groupList.length > 0 && (
                <div style={{ flex: 1, fontSize: '0.62rem', color: 'var(--ts)', lineHeight: 1.5, borderTop: '1px solid var(--bd)', paddingTop: 4, marginTop: 2 }}>
                  {groupList.map((g, gi) => {
                    const wt = wtMap[g.woodTypeId];
                    return (
                      <div key={gi} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <span>{wt?.icon || ''}</span>
                        <span style={{ fontWeight: 600 }}>{wt?.name || '—'}</span>
                        <span style={{ color: 'var(--tm)' }}>{fmtNum(g.thicknessCm, 1)}cm</span>
                        <span style={{ marginLeft: 'auto', fontFamily: 'monospace' }}>{fmtNum(g.m3, 3)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Stats */}
      <div style={{ ...panelS, padding: '8px 14px', display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.74rem', color: 'var(--ts)' }}>
        <span>Đang sấy: <strong style={{ color: 'var(--gn)' }}>{stats.drying}</strong></span>
        <span>Đã tắt: <strong style={{ color: '#D4A017' }}>{stats.off}</strong></span>
        <span>Đang ra: <strong style={{ color: 'var(--ac)' }}>{stats.unloading}</strong></span>
        <span>Trống: <strong>{stats.empty}</strong></span>
      </div>

      {/* Lịch sử đốt lò */}
      <KilnHistory batches={batches} allItems={allItems} wts={wts} wtMap={wtMap} ce={ce} useAPI={useAPI} notify={notify} onRefresh={onRefresh} />

      {showNewDialog && <BatchDateDialog kilnNumber={showNewDialog} onSave={(data) => handleCreate(showNewDialog, data)} onClose={() => setShowNewDialog(null)} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// LỊCH SỬ ĐỐT LÒ (dưới KilnGrid)
// ══════════════════════════════════════════════════════════════
function KilnHistory({ batches, allItems, wts, wtMap, ce, useAPI, notify, onRefresh }) {
  const [editing, setEditing] = useState(false);
  const [editItems, setEditItems] = useState({});   // item edits: { [itemId]: { woodTypeId, thicknessCm, weightKg, volumeM3, ownerType, ownerName } }
  const [editBatches, setEditBatches] = useState({}); // batch date edits: { [batchId]: { entryDate, exitDate } }
  const [saving, setSaving] = useState(false);
  const kilnWts = useMemo(() => wts.filter(w => w.thicknessMode === 'auto'), [wts]);

  // Group by batch, sort by entryDate desc → kilnNumber
  const batchGroups = useMemo(() => {
    const bMap = Object.fromEntries(batches.map(b => [b.id, b]));
    const groups = {};
    allItems.forEach(it => {
      const b = bMap[it.batchId];
      if (!b) return;
      if (!groups[b.id]) {
        const exitD = b.actualExitDate || b.expectedExitDate;
        const days = b.entryDate && exitD ? Math.round((new Date(exitD) - new Date(b.entryDate)) / 86400000) : null;
        groups[b.id] = { batch: b, entryDate: b.entryDate, exitDate: exitD, days, items: [] };
      }
      groups[b.id].items.push(it);
    });
    return Object.values(groups).sort((a, b) => new Date(b.entryDate || 0) - new Date(a.entryDate || 0) || a.batch.kilnNumber - b.batch.kilnNumber);
  }, [batches, allItems]);

  const totalItems = batchGroups.reduce((s, g) => s + g.items.length, 0);

  const startEdit = () => {
    const iv = {}, bv = {};
    batchGroups.forEach(g => {
      bv[g.batch.id] = { entryDate: g.entryDate || '', exitDate: g.exitDate || '' };
      g.items.forEach(it => {
        iv[it.id] = { woodTypeId: it.woodTypeId, thicknessCm: String(it.thicknessCm), weightKg: String(it.weightKg || ''), volumeM3: String(it.volumeM3 || ''), ownerType: it.ownerType, ownerName: it.ownerName || '' };
      });
    });
    setEditItems(iv);
    setEditBatches(bv);
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const api = await import('../api.js');
      // Save batch date changes
      for (const [batchId, val] of Object.entries(editBatches)) {
        const orig = batchGroups.find(g => g.batch.id === batchId);
        if (!orig) continue;
        const entryChanged = val.entryDate !== (orig.entryDate || '');
        const exitChanged = val.exitDate !== (orig.exitDate || '');
        if (entryChanged || exitChanged) {
          const updates = {};
          if (entryChanged) updates.entryDate = val.entryDate || null;
          if (exitChanged) updates.expectedExitDate = val.exitDate || null;
          await api.updateKilnBatch(batchId, updates);
        }
      }
      // Save item changes
      for (const [id, val] of Object.entries(editItems)) {
        const orig = allItems.find(it => it.id === id);
        if (!orig) continue;
        const changed = val.woodTypeId !== orig.woodTypeId || val.thicknessCm !== String(orig.thicknessCm)
          || val.weightKg !== String(orig.weightKg || '') || val.volumeM3 !== String(orig.volumeM3 || '')
          || val.ownerType !== orig.ownerType || val.ownerName !== (orig.ownerName || '');
        if (!changed) continue;
        await api.updateKilnItem(id, {
          woodTypeId: val.woodTypeId, thicknessCm: parseFloat(val.thicknessCm) || 0,
          weightKg: parseFloat(val.weightKg) || 0, volumeM3: parseFloat(val.volumeM3) || 0,
          ownerType: val.ownerType, ownerName: val.ownerType === 'customer' ? val.ownerName : null,
        });
      }
      notify('Đã lưu thay đổi');
      setEditing(false);
      onRefresh();
    } catch (e) { notify('Lỗi: ' + e.message, false); }
    setSaving(false);
  };

  const handleDeleteItem = async (item) => {
    if (!window.confirm(`Xóa mã gỗ ${item.itemCode}?`)) return;
    if (useAPI) {
      const api = await import('../api.js');
      await api.deleteKilnItem(item.id);
      notify('Đã xóa');
    }
    onRefresh();
  };

  if (!totalItems) return null;

  const eiv = (id) => editItems[id] || {};
  const setEiv = (id, field, val) => setEditItems(p => ({ ...p, [id]: { ...p[id], [field]: val } }));
  const ebv = (batchId) => editBatches[batchId] || {};
  const setEbv = (batchId, field, val) => setEditBatches(p => ({ ...p, [batchId]: { ...p[batchId], [field]: val } }));

  const BAND_COLORS = ['transparent', 'rgba(0,0,0,0.05)'];
  const itemCols = editing ? 6 : 5; // Loại gỗ + Dày + Kg + m³ + Đơn vị (+ Xóa khi edit)

  // Tổng toàn bộ
  const grandTotalKg = allItems.reduce((s, it) => s + (it.weightKg || 0), 0);
  const grandTotalM3 = allItems.reduce((s, it) => s + (it.volumeM3 || 0), 0);

  // Style chung
  const bdr = '1px solid var(--bd)';
  const mergeS = { ...tdS, textAlign: 'center', verticalAlign: 'middle', borderRight: bdr };
  const cellS = { ...tdS, borderRight: bdr }; // cell thường có border dọc

  return (
    <div style={{ ...panelS, marginTop: 12 }}>
      <div style={panelHead}>
        <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>Lịch sử đốt lò <span style={{ fontWeight: 400, color: 'var(--tm)', fontSize: '0.72rem' }}>({totalItems} mã gỗ)</span></span>
        {ce && <div style={{ display: 'flex', gap: 6 }}>
          {!editing
            ? <button onClick={startEdit} style={btnSec}>Sửa</button>
            : <>
              <button onClick={() => setEditing(false)} style={btnSec} disabled={saving}>Hủy</button>
              <button onClick={handleSave} style={btnP} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</button>
            </>}
        </div>}
      </div>
      <div style={{ overflowY: 'auto', maxHeight: 420 }}>
      <table style={{ borderCollapse: 'collapse' }}>
        <thead><tr style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bgc)' }}>
          <th style={{ ...thS, textAlign: 'center', width: 28, borderRight: bdr }}>Lò</th>
          <th style={{ ...thS, textAlign: 'center', width: 74, borderRight: bdr }}>Vào lò</th>
          <th style={{ ...thS, textAlign: 'center', width: 74, borderRight: bdr }}>Ra lò</th>
          <th style={{ ...thS, textAlign: 'center', width: 38, borderRight: bdr }}>Số ngày</th>
          <th style={{ ...thS, textAlign: 'center', width: 60, borderRight: bdr }}>Trạng thái</th>
          <th style={{ ...thS, whiteSpace: 'nowrap', borderRight: bdr }}>Loại gỗ</th>
          <th style={{ ...thS, textAlign: 'right', width: 36, borderRight: bdr }}>Dày</th>
          <th style={{ ...thS, textAlign: 'right', width: 55, borderRight: bdr }}>Kg</th>
          <th style={{ ...thS, textAlign: 'right', width: 50, borderRight: bdr }}>m³</th>
          <th style={{ ...thS, borderRight: editing ? bdr : 'none' }}>Đơn vị</th>
          {editing && <th style={{ ...thS, width: 24 }} />}
        </tr></thead>
        <tbody>
          {batchGroups.map((g, gi) => {
            const rowSpan = g.items.length;
            const bandBg = BAND_COLORS[gi % 2];
            const borderTop = gi > 0 ? '2.5px solid var(--bd)' : undefined;
            const isEd = editing;
            const bDays = isEd && ebv(g.batch.id).entryDate && ebv(g.batch.id).exitDate
              ? Math.round((new Date(ebv(g.batch.id).exitDate) - new Date(ebv(g.batch.id).entryDate)) / 86400000)
              : g.days;
            const batchKg = g.items.reduce((s, it) => s + (it.weightKg || 0), 0);
            const batchM3 = g.items.reduce((s, it) => s + (it.volumeM3 || 0), 0);
            const sc = statusColor(g.batch.status);

            const rows = g.items.map((it, ii) => {
              const wt = wtMap[it.woodTypeId];
              return (
                <tr key={it.id} style={{ background: bandBg, borderTop: ii === 0 ? borderTop : undefined }}>
                  {ii === 0 && <>
                    <td rowSpan={rowSpan} style={{ ...mergeS, fontWeight: 700, fontSize: '0.76rem' }}>{g.batch.kilnNumber}</td>
                    <td rowSpan={rowSpan} style={{ ...mergeS, whiteSpace: 'nowrap', fontSize: '0.7rem' }}>{isEd
                      ? <input type="date" value={ebv(g.batch.id).entryDate} onChange={e => setEbv(g.batch.id, 'entryDate', e.target.value)} style={{ ...inpS, width: 110, fontSize: '0.66rem' }} />
                      : fmtDate(g.entryDate)}</td>
                    <td rowSpan={rowSpan} style={{ ...mergeS, whiteSpace: 'nowrap', fontSize: '0.7rem' }}>{isEd
                      ? <input type="date" value={ebv(g.batch.id).exitDate} onChange={e => setEbv(g.batch.id, 'exitDate', e.target.value)} style={{ ...inpS, width: 110, fontSize: '0.66rem' }} />
                      : fmtDate(g.exitDate)}</td>
                    <td rowSpan={rowSpan} style={{ ...mergeS, fontSize: '0.7rem', fontWeight: 600 }}>{bDays != null ? bDays : '—'}</td>
                    <td rowSpan={rowSpan} style={{ ...mergeS, fontSize: '0.6rem' }}><span style={badge(sc)}>{g.batch.status}</span></td>
                  </>}
                  <td style={{ ...cellS, whiteSpace: 'nowrap' }}>{isEd
                    ? <select value={eiv(it.id).woodTypeId} onChange={e => setEiv(it.id, 'woodTypeId', e.target.value)} style={{ ...inpS, width: 100, fontSize: '0.66rem' }}>{kilnWts.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
                    : <span>{wt?.icon} {wt?.name || '—'}</span>}</td>
                  <td style={{ ...cellS, textAlign: 'right' }}>{isEd
                    ? <input value={eiv(it.id).thicknessCm} onChange={e => setEiv(it.id, 'thicknessCm', e.target.value)} style={{ ...inpS, width: 36, textAlign: 'right', fontSize: '0.66rem' }} />
                    : fmtNum(it.thicknessCm, 1)}</td>
                  <td style={{ ...cellS, textAlign: 'right' }}>{isEd
                    ? <input value={eiv(it.id).weightKg} onChange={e => setEiv(it.id, 'weightKg', e.target.value)} style={{ ...inpS, width: 50, textAlign: 'right', fontSize: '0.66rem' }} />
                    : fmtNum(it.weightKg, 0)}</td>
                  <td style={{ ...cellS, textAlign: 'right', fontWeight: 600 }}>{isEd
                    ? <input value={eiv(it.id).volumeM3} onChange={e => setEiv(it.id, 'volumeM3', e.target.value)} style={{ ...inpS, width: 50, textAlign: 'right', fontSize: '0.66rem' }} />
                    : fmtNum(it.volumeM3, 2)}</td>
                  <td style={{ ...tdS, borderRight: editing ? bdr : 'none' }}>{isEd
                    ? <select value={eiv(it.id).ownerType} onChange={e => setEiv(it.id, 'ownerType', e.target.value)} style={{ ...inpS, width: 60, fontSize: '0.66rem' }}><option value="company">Cty</option><option value="customer">Khách</option></select>
                    : (it.ownerType === 'company' ? <span style={{ color: 'var(--gn)', fontWeight: 600 }}>Cty</span> : (it.ownerName || 'Khách'))}</td>
                  {isEd && <td style={tdS}><button onClick={() => handleDeleteItem(it)} style={{ background: 'none', border: 'none', color: 'var(--dg)', cursor: 'pointer', fontSize: '0.58rem' }}>✕</button></td>}
                </tr>
              );
            });
            // Dòng tổng per-batch
            rows.push(
              <tr key={'sum-' + g.batch.id} style={{ background: bandBg, borderBottom: '2.5px solid var(--bd)' }}>
                <td colSpan={5} style={{ ...tdS, borderRight: bdr }} />
                <td colSpan={2} style={{ ...cellS, textAlign: 'right', fontSize: '0.68rem', fontWeight: 700, color: 'var(--brl)' }}>Tổng lò {g.batch.kilnNumber}:</td>
                <td style={{ ...cellS, textAlign: 'right', fontWeight: 700, fontSize: '0.72rem', borderTop: '1px solid var(--brl)' }}>{fmtNum(batchKg, 0)}</td>
                <td style={{ ...cellS, textAlign: 'right', fontWeight: 700, fontSize: '0.72rem', borderTop: '1px solid var(--brl)' }}>{fmtNum(batchM3, 2)}</td>
                <td style={{ ...tdS, borderRight: editing ? bdr : 'none' }} />{editing && <td style={tdS} />}
              </tr>
            );
            return rows;
          })}
        </tbody>
        <tfoot>
          <tr style={{ position: 'sticky', bottom: 0, background: 'var(--bgc)', borderTop: '2.5px solid var(--tp)' }}>
            <td colSpan={7} style={{ ...tdS, fontWeight: 800, fontSize: '0.82rem', textAlign: 'right', padding: '6px 8px', borderRight: bdr }}>TỔNG</td>
            <td style={{ ...tdS, textAlign: 'right', fontWeight: 800, fontSize: '0.82rem', padding: '6px 8px', borderRight: bdr }}>{fmtNum(grandTotalKg, 0)}</td>
            <td style={{ ...tdS, textAlign: 'right', fontWeight: 800, fontSize: '0.82rem', padding: '6px 8px', borderRight: bdr }}>{fmtNum(grandTotalM3, 2)}</td>
            <td style={{ ...tdS, borderRight: editing ? bdr : 'none' }} />{editing && <td style={tdS} />}
          </tr>
        </tfoot>
      </table>
      </div>
    </div>
  );
}

// ── Dialog chọn mã từ mẻ xẻ để nạp vào lò ───────────────────
function SawingPickerDlg({ wts, conversionRates, useAPI, notify, user, batchId, onAdd, onClose }) {
  const [sawingItems, setSawingItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(null);       // selected sawing item
  const [vol, setVol] = useState('');
  const wtMap = useMemo(() => Object.fromEntries(wts.map(w => [w.id, w])), [wts]);

  useEffect(() => {
    if (!useAPI) { setLoading(false); return; }
    import('../api.js').then(api =>
      api.fetchSawingItemsForKiln().then(d => { setSawingItems(d); setLoading(false); }).catch(() => setLoading(false))
    );
  }, [useAPI]);

  const selItem = sawingItems.find(i => i.id === sel);
  const volNum = parseFloat(vol) || 0;
  const minVol = selItem ? +(selItem.available * 0.8).toFixed(3) : 0;
  const maxVol = selItem ? +(selItem.available * 1.2).toFixed(3) : 0;
  const volOk = selItem && volNum >= minVol && volNum <= maxVol && volNum > 0;

  const handleAdd = async () => {
    if (!selItem || !volOk) return;
    const thick = parseFloat(String(selItem.thickness).replace(/[^\d.]/g, '')) || 0;
    const cr = findRate(selItem.woodId, thick, conversionRates);
    const rate = cr?.rate || 0;
    const kg = rate > 0 ? +(volNum * rate).toFixed(1) : 0;
    const api = await import('../api.js');
    const newItem = {
      woodTypeId: selItem.woodId, thicknessCm: thick,
      ownerType: 'company', ownerName: null,
      weightKg: kg, conversionRate: rate || null,
      volumeM3: volNum, quality: selItem.quality,
      sawingItemId: selItem.id,
    };
    const r = await api.addKilnItem(batchId, newItem);
    if (r?.error) { notify('Lỗi: ' + r.error, false); return; }
    if (r?.id) await api.addKilnEditLog(r.id, 'add', user?.username, null, { ...newItem, itemCode: r.itemCode });
    notify(`Đã thêm ${selItem.thickness} ${selItem.quality} (${volNum} m³) từ mẻ xẻ`);
    onAdd();
    onClose();
  };

  return (
    <Dialog open={true} onClose={onClose} title="Nạp gỗ từ mẻ xẻ vào lò" width={520} maxHeight="85vh" noEnter>
      {loading
        ? <div style={{ textAlign: 'center', color: 'var(--tm)', padding: 24 }}>Đang tải...</div>
        : sawingItems.length === 0
          ? <div style={{ textAlign: 'center', color: 'var(--tm)', padding: 24 }}>Chưa có mẻ xẻ nào có sản lượng khả dụng.</div>
          : (
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {sawingItems.map(it => {
                const wt = wtMap[it.woodId];
                const isSel = sel === it.id;
                const priColor = it.priority === 'urgent' ? '#C0392B' : it.priority === 'soon' ? '#F59E0B' : 'var(--bd)';
                return (
                  <div key={it.id} onClick={() => { setSel(it.id); setVol(it.available > 0 ? it.available.toFixed(3) : ''); }}
                    style={{ padding: '10px 12px', borderRadius: 8, border: `2px solid ${isSel ? 'var(--ac)' : priColor}`, background: isSel ? 'var(--acbg)' : 'var(--bgc)', marginBottom: 8, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--br)' }}>{it.thickness}</span>
                        {' '}
                        <span style={{ fontWeight: 700, fontSize: '0.72rem', padding: '1px 6px', borderRadius: 4, background: it.quality === 'Đẹp' ? 'rgba(39,174,96,0.12)' : 'rgba(41,128,185,0.12)', color: it.quality === 'Đẹp' ? '#27AE60' : '#2980b9' }}>{it.quality}</span>
                        {' '}
                        <span style={{ fontSize: '0.7rem', color: 'var(--ts)' }}>{wt?.icon} {wt?.name}</span>
                      </div>
                      <span style={{ fontSize: '0.65rem', color: 'var(--ts)' }}>{it.batchCode}</span>
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--ts)', marginTop: 3 }}>
                      Đã xẻ: <strong>{it.doneVolume.toFixed(2)} m³</strong>
                      {' · '}Đã nạp lò: {it.usedInKiln.toFixed(2)} m³
                      {' · '}Khả dụng: <strong style={{ color: it.available > 0 ? 'var(--gn)' : 'var(--dg)' }}>{it.available.toFixed(2)} m³</strong>
                      {it.note && <span style={{ marginLeft: 8, fontStyle: 'italic' }}>{it.note}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )
      }
      {selItem && (
        <div style={{ marginTop: 12, padding: '12px', borderRadius: 8, background: 'var(--bgs)', border: '1px solid var(--bd)' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--ts)', marginBottom: 6 }}>
            Nhập khối lượng nạp lò (±20%: <strong>{minVol}–{maxVol} m³</strong>)
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input type="number" step="0.01" min="0" value={vol} onChange={e => setVol(e.target.value)} autoFocus
              placeholder={selItem.available.toFixed(3)}
              style={{ ...inpS, flex: 1, borderColor: vol && !volOk ? 'var(--dg)' : vol && volOk ? 'var(--gn)' : 'var(--bd)', fontWeight: 700, textAlign: 'center' }} />
            <span style={{ fontSize: '0.74rem' }}>m³</span>
          </div>
          {vol && !volOk && volNum > 0 && (
            <div style={{ fontSize: '0.65rem', color: 'var(--dg)', marginTop: 4 }}>
              Ngoài phạm vi ±20% (khả dụng: {selItem.available.toFixed(2)} m³)
            </div>
          )}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
        <button onClick={onClose} style={btnSec}>Hủy</button>
        <button onClick={handleAdd} disabled={!volOk} style={{ ...btnP, opacity: volOk ? 1 : 0.4 }}>Nạp vào lò</button>
      </div>
    </Dialog>
  );
}

// ── Chi tiết lò (inline edit items + tách kiện) ─────────────
function KilnDetail({ batch, allItems, unsorted, wts, conversionRates, ce, isAdmin, user, useAPI, notify, onBack, onRefresh, onStatusChange, onDeleteBatch }) {
  const items = useMemo(() => allItems.filter(it => it.batchId === batch.id), [allItems, batch.id]);
  const wtMap = useMemo(() => Object.fromEntries(wts.map(w => [w.id, w])), [wts]);
  // Chỉ gỗ xẻ sấy (thicknessMode=auto) cho dropdown
  const kilnWts = useMemo(() => wts.filter(w => w.thicknessMode === 'auto'), [wts]);
  const totalKg = items.reduce((s, it) => s + (it.weightKg || 0), 0);
  const totalM3 = items.reduce((s, it) => s + (it.volumeM3 || 0), 0);
  const totalDays = daysBetween(batch.entryDate, batch.expectedExitDate);
  const elapsed = daysBetween(batch.entryDate, new Date().toISOString().slice(0, 10));
  const overdue = batch.status === 'Đang sấy' && totalDays && elapsed > totalDays;
  const sc = statusColor(batch.status);
  const rawNextSt = NEXT_STATUS[batch.status];
  // Chỉ cho tắt lò khi còn ≤ 1 ngày trước ngày ra DK (hoặc đã quá hạn)
  const canTurnOff = batch.status !== 'Đang sấy' || !batch.expectedExitDate || (() => {
    const daysLeft = daysBetween(new Date().toISOString().slice(0, 10), batch.expectedExitDate);
    return daysLeft == null || daysLeft <= 1;
  })();
  const nextSt = rawNextSt && (batch.status !== 'Đang sấy' || canTurnOff) ? rawNextSt : null;
  const turnOffBlocked = rawNextSt === 'Đã tắt' && !canTurnOff;

  // Edit dates dialog
  const [showEditDates, setShowEditDates] = useState(false);
  const handleEditDates = useCallback(async (data) => {
    setShowEditDates(false);
    if (useAPI) {
      const api = await import('../api.js');
      await api.updateKilnBatch(batch.id, { entryDate: data.entryDate, expectedExitDate: data.expectedExitDate });
      notify('Đã cập nhật ngày');
    }
    onRefresh();
  }, [batch.id, useAPI, notify, onRefresh]);

  // Inline add
  const [adding, setAdding] = useState(false);
  const [showSawingPicker, setShowSawingPicker] = useState(false);
  const [nf, setNf] = useState({ woodTypeId: kilnWts[0]?.id || '', thicknessCm: '', ownerType: 'company', ownerName: '', weightKg: '' });
  const [editId, setEditId] = useState(null);
  const [ef, setEf] = useState({});

  // Split dialog
  const [splitItem, setSplitItem] = useState(null);
  const [splitWeights, setSplitWeights] = useState(['']);

  const getRate = (woodId, thick) => {
    const cr = findRate(woodId, thick, conversionRates);
    return cr?.rate || 0;
  };

  const handleAdd = async () => {
    const kg = parseFloat(nf.weightKg);
    const thick = parseFloat(nf.thicknessCm);
    if (!nf.woodTypeId || !thick || !kg) { notify('Điền đầy đủ loại gỗ, dày, kg', false); return; }
    const rate = getRate(nf.woodTypeId, thick);
    if (useAPI) {
      const api = await import('../api.js');
      const newItem = { woodTypeId: nf.woodTypeId, thicknessCm: thick, ownerType: nf.ownerType, ownerName: nf.ownerType === 'customer' ? nf.ownerName : null, weightKg: kg, conversionRate: rate || null };
      const r = await api.addKilnItem(batch.id, newItem);
      if (r?.error) { notify('Lỗi: ' + r.error, false); return; }
      await api.addKilnEditLog(r.id, 'add', user?.username, null, { ...newItem, itemCode: r.itemCode });
      notify('Đã thêm ' + r.itemCode);
    }
    setNf({ woodTypeId: kilnWts[0]?.id || '', thicknessCm: '', ownerType: 'company', ownerName: '', weightKg: '' });
    setAdding(false);
    onRefresh();
  };

  const handleEdit = async (id) => {
    const kg = parseFloat(ef.weightKg);
    const thick = parseFloat(ef.thicknessCm);
    if (!thick || !kg) return;
    const rate = getRate(ef.woodTypeId, thick);
    const vol = rate > 0 ? kg / rate : 0;
    const newVals = { woodTypeId: ef.woodTypeId, thicknessCm: thick, ownerType: ef.ownerType, ownerName: ef.ownerType === 'customer' ? ef.ownerName : null, weightKg: kg, conversionRate: rate || null, volumeM3: vol };
    if (useAPI) {
      const api = await import('../api.js');
      // Snapshot old values
      const oldItem = items.find(it => it.id === id);
      const oldVals = oldItem ? { woodTypeId: oldItem.woodTypeId, thicknessCm: oldItem.thicknessCm, ownerType: oldItem.ownerType, ownerName: oldItem.ownerName, weightKg: oldItem.weightKg, conversionRate: oldItem.conversionRate, volumeM3: oldItem.volumeM3 } : null;
      await api.updateKilnItem(id, newVals);
      await api.addKilnEditLog(id, 'edit', user?.username, oldVals, newVals);
    }
    setEditId(null);
    onRefresh();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Xóa mã gỗ sấy này?')) return;
    if (useAPI) {
      const api = await import('../api.js');
      const oldItem = items.find(it => it.id === id);
      await api.addKilnEditLog(id, 'delete', user?.username, oldItem ? { itemCode: oldItem.itemCode, woodTypeId: oldItem.woodTypeId, thicknessCm: oldItem.thicknessCm, weightKg: oldItem.weightKg } : null, null);
      await api.deleteKilnItem(id);
    }
    onRefresh();
  };

  // Tách kiện — input m³, tính kg tỷ lệ
  const handleSplit = async () => {
    if (!splitItem) return;
    const vols = splitWeights.map(w => parseFloat(w)).filter(w => w > 0);
    if (!vols.length) { notify('Nhập ít nhất 1 giá trị m³', false); return; }
    const totalVol = vols.reduce((s, v) => s + v, 0);
    const origM3 = splitItem.volumeM3 || 0;
    const origKg = splitItem.weightKg || 0;
    const rate = splitItem.conversionRate || 0;
    if (useAPI) {
      const api = await import('../api.js');
      const items = vols.map(vol => ({
        kilnItemId: splitItem.id, woodTypeId: splitItem.woodTypeId, thicknessCm: splitItem.thicknessCm,
        ownerType: splitItem.ownerType, ownerName: splitItem.ownerName,
        weightKg: origM3 > 0 ? +(origKg * vol / origM3).toFixed(1) : (rate > 0 ? +(vol * rate).toFixed(1) : 0),
        volumeM3: +vol.toFixed(4),
      }));
      const r = await api.addUnsortedBundlesBatch(items);
      if (r?.error) { notify('Lỗi: ' + r.error, false); return; }
      notify(`Đã tách ${vols.length} kiện từ ${splitItem.itemCode}`);
    }
    setSplitItem(null);
    setSplitWeights(['']);
    onRefresh();
  };

  const itemUnsorted = useMemo(() => {
    const m = {};
    unsorted.forEach(u => { if (!m[u.kilnItemId]) m[u.kilnItemId] = []; m[u.kilnItemId].push(u); });
    return m;
  }, [unsorted]);

  return (
    <div>
      <button onClick={onBack} style={{ ...btnSec, marginBottom: 10 }}>← Quay lại</button>
      {/* Header */}
      <div style={{ ...panelS, padding: 14, marginBottom: 12, cursor: 'default' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 800 }}>Lò {batch.kilnNumber} — {batch.batchCode}</div>
            <div style={{ display: 'flex', gap: 14, marginTop: 6, fontSize: '0.76rem', color: 'var(--ts)', flexWrap: 'wrap' }}>
              <span>Vào: <strong>{fmtDate(batch.entryDate)}</strong></span>
              <span>Ra DK: <strong>{fmtDate(batch.expectedExitDate)}</strong></span>
              {totalDays != null && <span>{elapsed}/{totalDays} ngày {overdue && <strong style={{ color: 'var(--dg)' }}>⚠ QUÁ HẠN</strong>}</span>}
            </div>
            <div style={{ marginTop: 4, fontSize: '0.76rem' }}>{items.length} mã · <strong>{fmtNum(totalM3, 2)} m³</strong></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={badge(sc)}>{batch.status}</span>
            {ce && <button onClick={() => setShowEditDates(true)} style={{ ...btnSec, padding: '3px 10px', fontSize: '0.68rem' }}>Sửa ngày</button>}
            {ce && nextSt && <button onClick={() => onStatusChange(batch, nextSt)} style={{ ...btnP, fontSize: '0.7rem' }}>→ {nextSt}</button>}
            {ce && turnOffBlocked && <span style={{ fontSize: '0.62rem', color: 'var(--tm)' }}>Tắt lò: chờ đến 1 ngày trước ngày ra DK</span>}
            {onDeleteBatch && <button onClick={() => onDeleteBatch(batch)} style={{ background: 'none', border: '1px solid var(--dg)', color: 'var(--dg)', padding: '3px 10px', borderRadius: 6, fontSize: '0.68rem', cursor: 'pointer', fontWeight: 600 }}>Xóa mẻ</button>}
          </div>
        </div>
      </div>

      {/* Items table — inline edit */}
      <div style={{ ...panelS, overflow: 'auto', marginBottom: 12 }}>
        <div style={{ ...panelHead }}><span style={{ fontWeight: 700, fontSize: '0.8rem' }}>Mã gỗ sấy ({items.length})</span>
          {ce && (batch.status === 'Đang sấy' || batch.status === 'Đã tắt') && !adding && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setShowSawingPicker(true)} style={{ ...btnSec, padding: '3px 10px', fontSize: '0.7rem', color: '#7C5CBF', borderColor: '#7C5CBF' }}>⇑ Từ mẻ xẻ</button>
              <button onClick={() => setAdding(true)} style={{ ...btnP, padding: '3px 10px', fontSize: '0.7rem' }}>+ Thêm thủ công</button>
            </div>
          )}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 650 }}>
          <thead><tr>
            <th style={thS}>Mã</th><th style={thS}>Loại gỗ</th><th style={{ ...thS, textAlign: 'right' }}>Dày(cm)</th><th style={thS}>Đơn vị</th>
            <th style={{ ...thS, textAlign: 'right' }}>Kg</th><th style={{ ...thS, textAlign: 'right' }}>kg/m³</th><th style={{ ...thS, textAlign: 'right' }}>m³</th>
            {(batch.status === 'Đang ra lò' || batch.status === 'Đã ra hết') && <th style={thS}>Tách</th>}
            {ce && <th style={{ ...thS, width: 60 }}></th>}
          </tr></thead>
          <tbody>
            {items.map(it => {
              const isEd = editId === it.id;
              const ubs = itemUnsorted[it.id] || [];
              const rate = it.conversionRate || 0;
              if (isEd) {
                const eRate = getRate(ef.woodTypeId, ef.thicknessCm);
                const eVol = eRate > 0 ? (parseFloat(ef.weightKg) || 0) / eRate : 0;
                return (
                  <tr key={it.id} style={{ background: 'var(--acbg)' }} onKeyDown={e => { if (e.key === 'Enter') handleEdit(it.id); if (e.key === 'Escape') setEditId(null); }}>
                    <td style={tdS}><span style={{ fontFamily: 'monospace', fontSize: '0.68rem' }}>{it.itemCode}</span></td>
                    <td style={tdS}><select value={ef.woodTypeId} onChange={e => setEf(p => ({ ...p, woodTypeId: e.target.value }))} style={{ ...inpS, width: 120 }}>{kilnWts.map(w => <option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}</select></td>
                    <td style={tdS}><input type="number" step="0.1" value={ef.thicknessCm} onChange={e => setEf(p => ({ ...p, thicknessCm: e.target.value }))} style={{ ...inpS, width: 60, textAlign: 'right' }} /></td>
                    <td style={tdS}>
                      <select value={ef.ownerType} onChange={e => setEf(p => ({ ...p, ownerType: e.target.value }))} style={{ ...inpS, width: 80 }}><option value="company">Cty</option><option value="customer">Khách</option></select>
                      {ef.ownerType === 'customer' && <input value={ef.ownerName || ''} onChange={e => setEf(p => ({ ...p, ownerName: e.target.value }))} placeholder="Tên" style={{ ...inpS, width: 80, marginTop: 2 }} />}
                    </td>
                    <td style={tdS}><input type="number" value={ef.weightKg} onChange={e => setEf(p => ({ ...p, weightKg: e.target.value }))} style={{ ...inpS, width: 70, textAlign: 'right' }} /></td>
                    <td style={{ ...tdS, textAlign: 'right', fontSize: '0.7rem', color: 'var(--tm)' }}>{eRate ? fmtNum(eRate, 0) : '—'}</td>
                    <td style={{ ...tdS, textAlign: 'right', fontWeight: 600 }}>{eVol > 0 ? fmtNum(eVol, 3) : '—'}</td>
                    {(batch.status === 'Đang ra lò' || batch.status === 'Đã ra hết') && <td style={tdS}></td>}
                    <td style={{ ...tdS, whiteSpace: 'nowrap' }}>
                      <button onClick={() => handleEdit(it.id)} style={{ background: 'none', border: 'none', color: 'var(--gn)', cursor: 'pointer', fontWeight: 700 }}>✓</button>
                      <button onClick={() => setEditId(null)} style={{ background: 'none', border: 'none', color: 'var(--tm)', cursor: 'pointer', marginLeft: 4 }}>✕</button>
                    </td>
                  </tr>
                );
              }
              return (
                <React.Fragment key={it.id}>
                  <tr>
                    <td style={{ ...tdS, fontFamily: 'monospace', fontSize: '0.68rem' }}>{it.itemCode}</td>
                    <td style={tdS}>{wtMap[it.woodTypeId]?.name || '—'}</td>
                    <td style={{ ...tdS, textAlign: 'right' }}>{fmtNum(it.thicknessCm, 1)}</td>
                    <td style={tdS}>{it.ownerType === 'company' ? <span style={{ color: 'var(--gn)', fontWeight: 600 }}>Cty</span> : it.ownerName}</td>
                    <td style={{ ...tdS, textAlign: 'right' }}>{fmtNum(it.weightKg, 0)}</td>
                    <td style={{ ...tdS, textAlign: 'right', fontSize: '0.7rem', color: 'var(--tm)' }}>{rate ? fmtNum(rate, 0) : '—'}</td>
                    <td style={{ ...tdS, textAlign: 'right', fontWeight: 600 }}>{fmtNum(it.volumeM3, 3)}</td>
                    {(batch.status === 'Đang ra lò' || batch.status === 'Đã ra hết') && <td style={tdS}>
                      {ubs.length > 0
                        ? <span style={{ fontSize: '0.65rem', color: 'var(--gn)' }}>✓ {ubs.length} kiện</span>
                        : <button onClick={() => { setSplitItem(it); setSplitWeights([it.volumeM3 ? it.volumeM3.toFixed(3) : '']); }} style={{ ...btnP, padding: '2px 8px', fontSize: '0.65rem' }}>Tách</button>}
                    </td>}
                    {ce && <td style={{ ...tdS, whiteSpace: 'nowrap' }}>
                      <button onClick={() => { setEditId(it.id); setEf({ woodTypeId: it.woodTypeId, thicknessCm: String(it.thicknessCm), ownerType: it.ownerType, ownerName: it.ownerName || '', weightKg: String(it.weightKg) }); }} style={{ background: 'none', border: 'none', color: 'var(--brl)', cursor: 'pointer', fontSize: '0.7rem' }}>sửa</button>
                      <button onClick={() => handleDelete(it.id)} style={{ background: 'none', border: 'none', color: 'var(--dg)', cursor: 'pointer', fontSize: '0.7rem', marginLeft: 4 }}>xóa</button>
                    </td>}
                  </tr>
                  {/* Show split bundles */}
                  {ubs.length > 0 && ubs.map(u => (
                    <tr key={u.id} style={{ background: 'rgba(50,79,39,0.03)' }}>
                      <td style={{ ...tdS, paddingLeft: 24, fontFamily: 'monospace', fontSize: '0.65rem', color: 'var(--gn)' }}>↳ {u.bundleCode}</td>
                      <td colSpan={2} style={{ ...tdS, fontSize: '0.68rem', color: 'var(--tm)' }}>{u.status}</td>
                      <td style={tdS}></td>
                      <td style={{ ...tdS, textAlign: 'right', fontSize: '0.7rem' }}>{fmtNum(u.weightKg, 0)}</td>
                      <td style={tdS}></td>
                      <td style={{ ...tdS, textAlign: 'right', fontSize: '0.7rem' }}>{fmtNum(u.volumeM3, 3)}</td>
                      {(batch.status === 'Đang ra lò' || batch.status === 'Đã ra hết') && <td style={tdS}></td>}
                      {ce && <td style={tdS}></td>}
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
            {/* Inline add row */}
            {adding && (
              <tr style={{ background: 'var(--acbg)' }} onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false); }}>
                <td style={tdS}><span style={{ fontSize: '0.65rem', color: 'var(--tm)' }}>mới</span></td>
                <td style={tdS}><select value={nf.woodTypeId} onChange={e => setNf(p => ({ ...p, woodTypeId: e.target.value }))} style={{ ...inpS, width: 120 }}>{kilnWts.map(w => <option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}</select></td>
                <td style={tdS}><input type="number" step="0.1" value={nf.thicknessCm} onChange={e => setNf(p => ({ ...p, thicknessCm: e.target.value }))} placeholder="cm" style={{ ...inpS, width: 60, textAlign: 'right' }} autoFocus /></td>
                <td style={tdS}>
                  <select value={nf.ownerType} onChange={e => setNf(p => ({ ...p, ownerType: e.target.value }))} style={{ ...inpS, width: 80 }}><option value="company">Cty</option><option value="customer">Khách</option></select>
                  {nf.ownerType === 'customer' && <input value={nf.ownerName} onChange={e => setNf(p => ({ ...p, ownerName: e.target.value }))} placeholder="Tên" style={{ ...inpS, width: 80, marginTop: 2 }} />}
                </td>
                <td style={tdS}><input type="number" value={nf.weightKg} onChange={e => setNf(p => ({ ...p, weightKg: e.target.value }))} placeholder="kg" style={{ ...inpS, width: 70, textAlign: 'right' }} /></td>
                <td style={{ ...tdS, textAlign: 'right', fontSize: '0.7rem', color: 'var(--tm)' }}>{(() => { const r = getRate(nf.woodTypeId, nf.thicknessCm); return r ? fmtNum(r, 0) : '—'; })()}</td>
                <td style={{ ...tdS, textAlign: 'right', fontWeight: 600 }}>{(() => { const r = getRate(nf.woodTypeId, nf.thicknessCm); const kg = parseFloat(nf.weightKg) || 0; return r > 0 && kg > 0 ? fmtNum(kg / r, 3) : '—'; })()}</td>
                {(batch.status === 'Đang ra lò' || batch.status === 'Đã ra hết') && <td style={tdS}></td>}
                <td style={{ ...tdS, whiteSpace: 'nowrap' }}>
                  <button onClick={handleAdd} style={{ background: 'none', border: 'none', color: 'var(--gn)', cursor: 'pointer', fontWeight: 700 }}>✓</button>
                  <button onClick={() => setAdding(false)} style={{ background: 'none', border: 'none', color: 'var(--tm)', cursor: 'pointer', marginLeft: 4 }}>✕</button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Split dialog — nhập m³ */}
      {splitItem && (() => {
        const origM3 = splitItem.volumeM3 || 0;
        const origKg = splitItem.weightKg || 0;
        const rate = splitItem.conversionRate || 0;
        const splitVols = splitWeights.map(w => parseFloat(w) || 0);
        const totalSplitM3 = splitVols.reduce((s, v) => s + v, 0);
        const remaining = origM3 - totalSplitM3;
        const diffPct = origM3 > 0 ? Math.abs(origM3 - totalSplitM3) / origM3 * 100 : 0;
        const isOver = totalSplitM3 > origM3;
        const isUnder10 = !isOver && diffPct > 10;

        // Khi thêm kiện mới → auto fill m³ còn lại
        const addWithRemaining = () => {
          const rem = Math.max(0, origM3 - splitVols.reduce((s, v) => s + v, 0));
          setSplitWeights(p => [...p, rem > 0 ? rem.toFixed(3) : '']);
        };

        return (
          <Dialog open={true} onClose={() => setSplitItem(null)} title={`Tách ${splitItem.itemCode}`} width={400} noEnter>
            <div style={{ fontSize: '0.72rem', color: 'var(--ts)', marginBottom: 12 }}>Tổng gốc: <strong>{fmtNum(origM3, 3)} m³</strong> ({fmtNum(origKg, 0)} kg)</div>

            {splitWeights.map((w, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--tm)', minWidth: 50 }}>Kiện {i + 1}</span>
                <input type="number" step="0.001" value={w}
                  onChange={e => setSplitWeights(p => p.map((v, j) => j === i ? e.target.value : v))}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (i === splitWeights.length - 1) addWithRemaining(); } }}
                  placeholder="m³" style={{ ...inpS, flex: 1 }} autoFocus={i === splitWeights.length - 1} />
                <span style={{ fontSize: '0.68rem', color: 'var(--tm)', minWidth: 30 }}>m³</span>
                {splitWeights.length > 1 && <button onClick={() => setSplitWeights(p => p.filter((_, j) => j !== i))} style={{ ...btnDg, padding: '3px 8px' }}>✕</button>}
              </div>
            ))}

            <button onClick={addWithRemaining} style={{ ...btnSec, width: '100%', marginBottom: 10 }}>+ Thêm kiện {remaining > 0.0005 ? `(${fmtNum(remaining, 3)} m³ còn lại)` : ''}</button>

            {/* Tổng & cảnh báo */}
            <div style={{ fontSize: '0.74rem', marginBottom: 4 }}>
              Tổng tách: <strong style={{ color: isOver ? 'var(--dg)' : 'var(--ts)' }}>{fmtNum(totalSplitM3, 3)} m³</strong> / {fmtNum(origM3, 3)} m³
              {remaining > 0.0005 && <span style={{ color: 'var(--tm)', marginLeft: 6 }}>Còn lại: {fmtNum(remaining, 3)}</span>}
            </div>
            {isOver && <div style={{ fontSize: '0.68rem', color: 'var(--dg)', marginBottom: 4 }}>Tổng tách vượt quá khối lượng gốc</div>}
            {isUnder10 && <div style={{ fontSize: '0.68rem', color: '#D4A017', marginBottom: 4 }}>⚠ Chênh lệch {fmtNum(diffPct, 1)}% (> 10%) — kiểm tra lại</div>}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button onClick={() => setSplitItem(null)} style={btnSec}>Hủy</button>
              <button onClick={handleSplit} style={btnP}>Tách</button>
            </div>
          </Dialog>
        );
      })()}

      {/* Dialog sửa ngày */}
      {showEditDates && <BatchDateDialog title={`Sửa ngày — Lò ${batch.kilnNumber}`} kilnNumber={batch.kilnNumber} entryDate={batch.entryDate} expectedExitDate={batch.expectedExitDate} onSave={handleEditDates} onClose={() => setShowEditDates(false)} />}

      {/* Dialog nạp từ mẻ xẻ */}
      {showSawingPicker && (
        <SawingPickerDlg
          wts={wts} conversionRates={conversionRates}
          useAPI={useAPI} notify={notify} user={user}
          batchId={batch.id}
          onAdd={onRefresh}
          onClose={() => setShowSawingPicker(false)}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB 2: KIỆN CHƯA XẾP
// ══════════════════════════════════════════════════════════════
function UnsortedTab({ unsorted, leftovers, batches, allItems, sessions, wts, ce, useAPI, notify, onRefresh }) {
  const [selected, setSelected] = useState(new Set());
  const [filterWood, setFilterWood] = useState('');
  const [filterThick, setFilterThick] = useState('');
  const [filterNotes, setFilterNotes] = useState('');
  const [filterCode, setFilterCode] = useState('');
  const [filterQuality, setFilterQuality] = useState('');
  const [filterKilnNum, setFilterKilnNum] = useState('');
  const [filterOwnerType, setFilterOwnerType] = useState('');
  const { sortField, sortDir, toggleSort, sortIcon } = useTableSort('wood', 'asc');
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);
  const kilnWts = useMemo(() => wts.filter(w => w.thicknessMode === 'auto'), [wts]);
  const wtMap = useMemo(() => Object.fromEntries(wts.map(w => [w.id, w])), [wts]);
  const wtByName = useMemo(() => {
    const m = {};
    wts.forEach(w => { m[w.name.toLowerCase()] = w; if (w.nameEn) m[w.nameEn.toLowerCase()] = w; });
    return m;
  }, [wts]);
  const batchMap = useMemo(() => Object.fromEntries(batches.map(b => [b.id, b])), [batches]);
  const itemMap = useMemo(() => Object.fromEntries(allItems.map(it => [it.id, it])), [allItems]);

  // Pool = unsorted bundles (Chưa xếp) + kiln items chưa tách từ lò đã ra (coi như 1 kiện)
  const unsortedPool = useMemo(() => unsorted.filter(u => u.status === 'Chưa xếp'), [unsorted]);
  const unsplitAsUnsorted = useMemo(() => {
    // Kiln items từ lò Đang ra / Đã ra hết, chưa có unsorted_bundles nào
    const splitItemIds = new Set(unsorted.map(u => u.kilnItemId));
    const activeBatchIds = new Set(batches.filter(b => b.status === 'Đang ra lò' || b.status === 'Đã ra hết').map(b => b.id));
    return allItems
      .filter(it => activeBatchIds.has(it.batchId) && !splitItemIds.has(it.id) && it.ownerType === 'company')
      .map(it => {
        const batch = batchMap[it.batchId];
        return {
          id: 'ki_' + it.id, _kilnItemId: it.id, bundleCode: it.itemCode + ' (chưa tách)',
          kilnItemId: it.id, woodTypeId: it.woodTypeId, thicknessCm: it.thicknessCm,
          ownerType: it.ownerType, ownerName: it.ownerName,
          weightKg: it.weightKg, volumeM3: it.volumeM3,
          status: 'Chưa xếp', packingSessionId: null,
          _isUnsplit: true, _kilnNumber: batch?.kilnNumber,
        };
      });
  }, [allItems, unsorted, batches, batchMap]);
  const pool = useMemo(() => [...unsortedPool, ...unsplitAsUnsorted], [unsortedPool, unsplitAsUnsorted]);
  const availLeftovers = useMemo(() => leftovers.filter(l => l.status === 'Chưa xếp'), [leftovers]);

  // Gộp unsorted + leftovers thành 1 danh sách thống nhất
  const combined = useMemo(() => {
    const fromUnsorted = pool.map(u => ({ ...u, _type: 'unsorted', _code: u.bundleCode, _quality: null, _notes: u.notes }));
    const fromLeftovers = availLeftovers.map(l => ({
      id: 'lf_' + l.id, _leftoverId: l.id, _type: 'leftover', _code: l.leftoverCode,
      woodTypeId: l.woodTypeId, thicknessCm: l.thicknessCm, volumeM3: l.volumeM3,
      weightKg: l.weightKg, ownerType: null, ownerName: null,
      _quality: l.quality, _notes: l.notes, _kilnNumber: null,
      kilnItemId: null, _isUnsplit: false, status: 'Chưa xếp',
    }));
    return [...fromUnsorted, ...fromLeftovers];
  }, [pool, availLeftovers]);

  const filtered = useMemo(() => {
    let r = combined;
    if (filterWood) r = r.filter(u => u.woodTypeId === filterWood);
    if (filterThick) r = r.filter(u => String(u.thicknessCm) === filterThick);
    if (filterNotes) r = r.filter(u => (u._notes || '') === filterNotes);
    if (filterCode) r = r.filter(u => (u._code || '').toLowerCase().includes(filterCode.toLowerCase()));
    if (filterQuality) r = r.filter(u => (u._quality || '').toLowerCase().includes(filterQuality.toLowerCase()));
    if (filterKilnNum) r = r.filter(u => { const ki = u.kilnItemId ? itemMap[u.kilnItemId] : null; const b = ki ? batchMap[ki.batchId] : null; return String(u._kilnNumber || b?.kilnNumber || '') === filterKilnNum; });
    if (filterOwnerType) r = r.filter(u => filterOwnerType === 'Cty' ? u.ownerType === 'company' : (u.ownerName || '') === filterOwnerType);
    // Sort
    const dir = sortDir === 'asc' ? 1 : -1;
    r = [...r].sort((a, b) => {
      if (sortField === 'wood') {
        const na = (wtMap[a.woodTypeId]?.name || '').localeCompare(wtMap[b.woodTypeId]?.name || '');
        if (na !== 0) return na * dir;
        const ta = (a.thicknessCm || 0) - (b.thicknessCm || 0);
        return ta * dir;
      }
      if (sortField === 'thick') {
        const ta = (a.thicknessCm || 0) - (b.thicknessCm || 0);
        if (ta !== 0) return ta * dir;
        return ((wtMap[a.woodTypeId]?.name || '').localeCompare(wtMap[b.woodTypeId]?.name || '')) * dir;
      }
      if (sortField === 'quality') {
        const qa = (a._quality || '').localeCompare(b._quality || '');
        if (qa !== 0) return qa * dir;
        return ((wtMap[a.woodTypeId]?.name || '').localeCompare(wtMap[b.woodTypeId]?.name || '')) * dir;
      }
      return 0;
    });
    return r;
  }, [combined, filterWood, filterThick, filterNotes, filterCode, filterQuality, filterKilnNum, filterOwnerType, sortField, sortDir, wtMap, itemMap, batchMap]);


  // Cross-filter: mỗi dropdown chỉ hiện giá trị tồn tại sau khi các filter khác đã áp dụng
  const applyCross = useCallback((skipField) => {
    let pool = combined;
    if (skipField !== 'wood' && filterWood) pool = pool.filter(u => u.woodTypeId === filterWood);
    if (skipField !== 'thick' && filterThick) pool = pool.filter(u => String(u.thicknessCm) === filterThick);
    if (skipField !== 'notes' && filterNotes) pool = pool.filter(u => (u._notes || '') === filterNotes);
    return pool;
  }, [combined, filterWood, filterThick, filterNotes]);
  const woodTypes = useMemo(() => [...new Set(applyCross('wood').map(u => u.woodTypeId))].filter(Boolean), [applyCross]);
  const thicknesses = useMemo(() => [...new Set(applyCross('thick').map(u => String(u.thicknessCm)))].sort((a, b) => parseFloat(a) - parseFloat(b)), [applyCross]);
  const notesList = useMemo(() => [...new Set(applyCross('notes').map(u => u._notes || '').filter(Boolean))].sort(), [applyCross]);
  const hasFilter = filterWood || filterThick || filterNotes || filterCode || filterQuality || filterKilnNum || filterOwnerType;
  // Auto-reset filter nếu giá trị đã chọn không còn tồn tại trong cross-filter
  useEffect(() => { if (filterWood && !woodTypes.includes(filterWood)) setFilterWood(''); }, [filterWood, woodTypes]);
  useEffect(() => { if (filterThick && !thicknesses.includes(filterThick)) setFilterThick(''); }, [filterThick, thicknesses]);
  useEffect(() => { if (filterNotes && !notesList.includes(filterNotes)) setFilterNotes(''); }, [filterNotes, notesList]);

  const cardStats = useMemo(() => {
    const items = filtered;
    const total = items.length;
    const leftoverCount = items.filter(i => i._type === 'leftover').length;
    const totalM3 = items.reduce((s, i) => s + (i.volumeM3 || 0), 0);
    const totalKg = items.reduce((s, i) => s + (i.weightKg || 0), 0);
    const company = items.filter(i => i.ownerType === 'company');
    const companyM3 = company.reduce((s, i) => s + (i.volumeM3 || 0), 0);
    const customer = items.filter(i => i.ownerType === 'customer');
    const customerM3 = customer.reduce((s, i) => s + (i.volumeM3 || 0), 0);
    const customerNames = [...new Set(customer.map(i => i.ownerName).filter(Boolean))];
    const unsplitCount = items.filter(i => i._isUnsplit).length;
    const unsplitM3 = items.filter(i => i._isUnsplit).reduce((s, i) => s + (i.volumeM3 || 0), 0);
    return { total, leftoverCount, totalM3, totalKg, companyCount: company.length, companyM3, customerCount: customer.length, customerM3, customerNames, unsplitCount, unsplitM3 };
  }, [filtered]);

  const selArr = useMemo(() => [...selected], [selected]);
  const selItems = filtered.filter(u => selected.has(u.id));
  const selWoodType = selItems[0]?.woodTypeId;
  const selThick = selItems[0]?.thicknessCm;
  const allSameType = selItems.every(u => u.woodTypeId === selWoodType && u.thicknessCm === selThick);
  const selKg = selItems.reduce((s, u) => s + (u.weightKg || 0), 0);
  const selM3 = selItems.reduce((s, u) => s + (u.volumeM3 || 0), 0);

  const toggle = (id) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleDeleteUnsorted = async (item) => {
    if (!window.confirm(`Xóa "${item._code}"?`)) return;
    if (useAPI) {
      const api = await import('../api.js');
      if (item._type === 'leftover') {
        await api.deletePackingLeftover(item._leftoverId);
      } else if (item._isUnsplit) {
        // Kiln item chưa tách — không xóa, chỉ thông báo
        notify('Kiện chưa tách — vào chi tiết lò để xóa mã gỗ sấy', false); return;
      } else {
        await api.deleteUnsortedBundle(item.id);
      }
      notify('Đã xóa');
    }
    onRefresh();
  };

  // Tách kiện chưa tách
  const [splitItem, setSplitItem] = useState(null);
  const [splitWeights, setSplitWeights] = useState(['']);
  const [splitting, setSplitting] = useState(false);

  const handleSplitUnsorted = async () => {
    if (!splitItem || splitting) return;
    const vols = splitWeights.map(w => parseFloat(w)).filter(w => w > 0);
    if (!vols.length) { notify('Nhập ít nhất 1 giá trị m³', false); return; }
    setSplitting(true);
    const origM3 = splitItem.volumeM3 || 0;
    const origKg = splitItem.weightKg || 0;
    const rate = splitItem.conversionRate || 0;
    try {
      if (useAPI) {
        const api = await import('../api.js');
        const items = vols.map(vol => ({
          kilnItemId: splitItem._kilnItemId, woodTypeId: splitItem.woodTypeId, thicknessCm: splitItem.thicknessCm,
          ownerType: splitItem.ownerType, ownerName: splitItem.ownerName,
          weightKg: origM3 > 0 ? +(origKg * vol / origM3).toFixed(1) : (rate > 0 ? +(vol * rate).toFixed(1) : 0),
          volumeM3: +vol.toFixed(4),
        }));
        const r = await api.addUnsortedBundlesBatch(items);
        if (r?.error) { notify('Lỗi: ' + r.error, false); setSplitting(false); return; }
        notify(`Đã tách ${vols.length} kiện`);
      }
      setSplitItem(null);
      setSplitWeights(['']);
      onRefresh();
    } catch (e) { notify('Lỗi: ' + e.message, false); }
    setSplitting(false);
  };

  // Parse CSV: Loại gỗ, Dày(cm), m³, Đơn vị, Ghi chú
  const parseCsv = (text) => {
    const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
    const items = [];
    const errors = [];
    lines.forEach((line, i) => {
      // Skip header nếu chứa "loại gỗ" hoặc "wood"
      if (i === 0 && /lo[aạ]i g[oỗ]|wood|tên/i.test(line)) return;
      const cols = line.split(/[,\t;]/).map(c => c.trim());
      if (cols.length < 3) { errors.push(`Dòng ${i + 1}: thiếu cột (cần ít nhất: Loại gỗ, Dày, m³)`); return; }
      const [woodName, thickRaw, volRaw, ownerRaw, notesRaw] = cols;
      const wt = wtByName[woodName.toLowerCase()] || kilnWts.find(w => w.name.toLowerCase().includes(woodName.toLowerCase()) || woodName.toLowerCase().includes(w.name.toLowerCase()));
      if (!wt) { errors.push(`Dòng ${i + 1}: không tìm thấy loại gỗ "${woodName}"`); return; }
      const thick = parseFloat(thickRaw.replace(',', '.'));
      const vol = parseFloat(volRaw.replace(',', '.'));
      if (!thick || thick <= 0) { errors.push(`Dòng ${i + 1}: dày không hợp lệ "${thickRaw}"`); return; }
      if (!vol || vol <= 0) { errors.push(`Dòng ${i + 1}: m³ không hợp lệ "${volRaw}"`); return; }
      const isCustomer = ownerRaw && ownerRaw.toLowerCase() !== 'cty' && ownerRaw.toLowerCase() !== 'company' && ownerRaw.toLowerCase() !== 'công ty';
      items.push({ woodTypeId: wt.id, thicknessCm: thick, volumeM3: vol, weightKg: 0, ownerType: isCustomer ? 'customer' : 'company', ownerName: isCustomer ? ownerRaw : null, notes: notesRaw || null });
    });
    return { items, errors };
  };

  const handleImport = async () => {
    const { items, errors } = parseCsv(csvText);
    if (errors.length) { notify(errors[0] + (errors.length > 1 ? ` (+${errors.length - 1} lỗi khác)` : ''), false); return; }
    if (!items.length) { notify('Không có dữ liệu hợp lệ', false); return; }
    setImporting(true);
    if (useAPI) {
      const api = await import('../api.js');
      const r = await api.importUnsortedBundles(items);
      if (r?.error) { notify('Lỗi: ' + r.error, false); setImporting(false); return; }
      notify(`Đã import ${r.count} kiện`);
    }
    setCsvText('');
    setShowImport(false);
    setImporting(false);
    onRefresh();
  };

  // Gán các kiện đã chọn vào 1 session (dùng chung cho tạo mới + bổ sung)
  const [conflictSession, setConflictSession] = useState(null); // mẻ trùng đang xếp
  const assignItemsToSession = useCallback(async (sessionId, sessionCode, addKg, addM3) => {
    if (!useAPI) return;
    try {
      const api = await import('../api.js');
      const unsplitItems = selItems.filter(u => u._type === 'unsorted' && u._isUnsplit);
      const realUnsortedIds = selItems.filter(u => u._type === 'unsorted' && !u._isUnsplit).map(u => u.id);
      const leftoverItems = selItems.filter(u => u._type === 'leftover');
      for (const ui of unsplitItems) {
        const ub = await api.addUnsortedBundle(ui._kilnItemId, ui.weightKg, ui.volumeM3, ui.woodTypeId, ui.thicknessCm, ui.ownerType, ui.ownerName, null);
        if (ub?.error) { notify('Lỗi tách kiện: ' + ub.error, false); return; }
        if (ub?.id) realUnsortedIds.push(ub.id);
      }
      if (realUnsortedIds.length) await api.updateUnsortedBundlesBatch(realUnsortedIds, { status: 'Đã xếp', packingSessionId: sessionId });
      for (const li of leftoverItems) {
        await api.updatePackingLeftover(li._leftoverId, { status: 'Đã xếp', usedInSessionId: sessionId });
      }
      if (addKg || addM3) {
        const existing = sessions.find(s => s.id === sessionId);
        if (existing) await api.updatePackingSession(sessionId, { totalInputKg: (existing.totalInputKg || 0) + addKg, totalInputM3: (existing.totalInputM3 || 0) + addM3 });
      }
      notify(`Đã ${addKg ? 'bổ sung vào' : 'tạo'} mẻ xếp ${sessionCode}`);
    } catch (e) { notify('Lỗi: ' + e.message, false); }
    setSelected(new Set());
    setConflictSession(null);
    onRefresh();
  }, [selItems, sessions, useAPI, notify, onRefresh]);

  const handleCreateSession = async () => {
    if (!selItems.length || !allSameType) { notify('Chọn kiện cùng loại gỗ + dày', false); return; }
    // Check mẻ đang xếp cùng loại gỗ + dày
    const existing = sessions.find(s => s.status === 'Đang xếp' && s.woodTypeId === selWoodType && s.thicknessCm === selThick);
    if (existing) { setConflictSession(existing); return; }
    await doCreateNewSession();
  };

  const doCreateNewSession = async () => {
    const totalKg = selItems.reduce((s, u) => s + (u.weightKg || 0), 0);
    const totalM3 = selM3;
    const today = new Date().toISOString().slice(0, 10);
    if (useAPI) {
      const api = await import('../api.js');
      const r = await api.addPackingSession(today, selWoodType, selThick, totalKg, totalM3, null);
      if (r?.error) { notify('Lỗi: ' + r.error, false); return; }
      await assignItemsToSession(r.id, r.sessionCode, 0, 0);
    }
  };

  const handleAddToExisting = async () => {
    if (!conflictSession) return;
    const totalKg = selItems.reduce((s, u) => s + (u.weightKg || 0), 0);
    const totalM3 = selM3;
    await assignItemsToSession(conflictSession.id, conflictSession.sessionCode, totalKg, totalM3);
  };

  return (
    <div style={panelS}>
      <div style={panelHead}>
        <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>Kiện chưa xếp <span style={{ fontWeight: 400, color: 'var(--tm)', fontSize: '0.72rem' }}>({combined.length})</span></span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {ce && <button onClick={() => setShowImport(true)} style={{ ...btnSec, padding: '3px 10px', fontSize: '0.68rem' }}>Import</button>}
        </div>
      </div>
      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${3 + (cardStats.unsplitCount > 0 ? 1 : 0) + (cardStats.customerCount > 0 ? 1 : 0)}, 1fr)`, gap: 8, padding: '10px 14px' }}>
        <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bgc)', border: '1px solid var(--bd)', borderTop: '3px solid var(--ac)' }}>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--tp)' }}>{cardStats.total} <span style={{ fontSize: '0.68rem', fontWeight: 500, color: 'var(--ts)' }}>kiện</span></div>
          <div style={{ fontSize: '0.64rem', color: 'var(--tm)', marginTop: 2 }}>{cardStats.leftoverCount > 0 ? `${cardStats.leftoverCount} kiện bỏ lại` : 'Tổng kiện chưa xếp'}</div>
        </div>
        <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bgc)', border: '1px solid var(--bd)', borderTop: '3px solid var(--gn)' }}>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--tp)' }}>{fmtNum(cardStats.totalM3, 3)} <span style={{ fontSize: '0.68rem', fontWeight: 500, color: 'var(--ts)' }}>m³</span></div>
          <div style={{ fontSize: '0.64rem', color: 'var(--tm)', marginTop: 2 }}>{fmtNum(cardStats.totalKg, 0)} kg</div>
        </div>
        <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bgc)', border: '1px solid var(--bd)', borderTop: '3px solid #2980b9' }}>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--tp)' }}>{cardStats.companyCount} <span style={{ fontSize: '0.68rem', fontWeight: 500, color: 'var(--ts)' }}>kiện Cty</span></div>
          <div style={{ fontSize: '0.64rem', color: 'var(--tm)', marginTop: 2 }}>{fmtNum(cardStats.companyM3, 3)} m³</div>
        </div>
        {cardStats.unsplitCount > 0 && (
          <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bgc)', border: '1px solid var(--bd)', borderTop: '3px solid #F26522' }}>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#F26522' }}>{cardStats.unsplitCount} <span style={{ fontSize: '0.68rem', fontWeight: 500, color: 'var(--ts)' }}>chưa tách</span></div>
            <div style={{ fontSize: '0.64rem', color: 'var(--tm)', marginTop: 2 }}>{fmtNum(cardStats.unsplitM3, 3)} m³ ra lò</div>
          </div>
        )}
        {cardStats.customerCount > 0 && (
          <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bgc)', border: '1px solid var(--bd)', borderTop: '3px solid #8E44AD' }}>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--tp)' }}>{cardStats.customerCount} <span style={{ fontSize: '0.68rem', fontWeight: 500, color: 'var(--ts)' }}>kiện Khách</span></div>
            <div style={{ fontSize: '0.64rem', color: 'var(--tm)', marginTop: 2 }}>{fmtNum(cardStats.customerM3, 3)} m³{cardStats.customerNames.length > 0 && cardStats.customerNames.length <= 2 ? ' · ' + cardStats.customerNames.join(', ') : ''}</div>
          </div>
        )}
      </div>

      {/* Selection bar — top */}
      {ce && (
        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--bd)', borderBottom: '1px solid var(--bd)', background: selItems.length > 0 ? 'var(--acbg)' : 'var(--bgs)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          <span style={{ fontSize: '0.76rem', color: selItems.length > 0 ? 'var(--tp)' : 'var(--tm)' }}>
            {selItems.length > 0
              ? <>Đã chọn: <strong>{selItems.length}</strong> kiện · <strong>{fmtNum(selM3, 3)} m³</strong>{!allSameType && <span style={{ color: 'var(--dg)', marginLeft: 8 }}>⚠ Phải cùng loại gỗ + dày</span>}</>
              : 'Tick chọn kiện để tạo mẻ xếp'}
          </span>
          <button onClick={handleCreateSession} disabled={!selItems.length || !allSameType} style={{ ...btnP, opacity: selItems.length && allSameType ? 1 : 0.35 }}>Tạo mẻ xếp</button>
        </div>
      )}

      <table style={{ width: 'auto', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--bgs)' }}>
            {ce && <td style={{ padding: '5px 4px' }} />}
            <td style={{ padding: '5px 4px' }}><ComboFilter value={filterCode || ''} onChange={v => setFilterCode(v)} options={[...new Set(filtered.map(u => u._code).filter(Boolean))]} placeholder="Mã" /></td>
            <td style={{ padding: '5px 4px' }}><ComboFilter value={filterWood ? (wtMap[filterWood]?.name || filterWood) : ''} onChange={v => { const w = Object.entries(wtMap).find(([, x]) => x.name === v); setFilterWood(w ? w[0] : ''); }} options={woodTypes.map(id => wtMap[id]?.name || id)} placeholder="Loại gỗ" /></td>
            <td style={{ padding: '5px 4px' }}><ComboFilter value={filterThick} onChange={v => setFilterThick(v)} options={thicknesses} placeholder="Dày" strict /></td>
            <td style={{ padding: '5px 4px' }} />
            <td style={{ padding: '5px 4px' }}><ComboFilter value={filterQuality || ''} onChange={v => setFilterQuality(v)} options={[...new Set(filtered.map(u => u._quality).filter(Boolean))].sort()} placeholder="CL" strict /></td>
            <td style={{ padding: '5px 4px' }}><ComboFilter value={filterNotes} onChange={v => setFilterNotes(v)} options={notesList} placeholder="Ghi chú" strict /></td>
            <td style={{ padding: '5px 4px' }}><ComboFilter value={filterKilnNum || ''} onChange={v => setFilterKilnNum(v)} options={[...new Set(filtered.map(u => { const ki = u.kilnItemId ? itemMap[u.kilnItemId] : null; const b = ki ? batchMap[ki.batchId] : null; return u._kilnNumber || b?.kilnNumber; }).filter(Boolean).map(String))].sort()} placeholder="Lò" /></td>
            <td style={{ padding: '5px 4px' }}><ComboFilter value={filterOwnerType || ''} onChange={v => setFilterOwnerType(v)} options={['Cty', ...new Set(filtered.map(u => u.ownerType === 'company' ? null : u.ownerName).filter(Boolean))].filter(Boolean)} placeholder="Đơn vị" /></td>
            <td style={{ padding: '5px 4px' }} />
            <td style={{ padding: '5px 4px' }} />
            {ce && <td style={{ padding: '5px 4px' }} />}
          </tr>
          <tr>
          {ce && <th style={{ ...thS, width: 26, padding: '4px 4px' }}></th>}
          <th style={thS}>Mã</th>
          <th style={{ ...thS, cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('wood')}>Loại gỗ{sortIcon('wood')}</th>
          <th style={{ ...thS, textAlign: 'right', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('thick')}>Dày{sortIcon('thick')}</th>
          <th style={{ ...thS, textAlign: 'right' }}>m³</th>
          <th style={{ ...thS, cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('quality')}>CL{sortIcon('quality')}</th>
          <th style={thS}>Ghi chú</th>
          <th style={thS}>Lò</th>
          <th style={thS}>Đơn vị</th>
          <th style={thS}>Nguồn</th>
          <th style={thS}>Ngày tách</th>
          {ce && <th style={{ ...thS, width: 30 }}></th>}
        </tr></thead>
        <tbody>
          {filtered.map(u => {
            const ki = u.kilnItemId ? itemMap[u.kilnItemId] : null;
            const batch = ki ? batchMap[ki.batchId] : null;
            const kilnNum = u._kilnNumber || batch?.kilnNumber;
            const isLeftover = u._type === 'leftover';
            return (
              <tr key={u.id} style={{ background: selected.has(u.id) ? 'var(--acbg)' : u._isUnsplit ? 'rgba(242,101,34,0.06)' : isLeftover ? 'rgba(242,101,34,0.03)' : undefined }}>
                {ce && <td style={{ ...tdS, padding: '3px 4px' }}>{u.ownerType === 'customer' ? <span title="Gỗ khách — không cho vào mẻ xếp" style={{ fontSize: '0.6rem', color: 'var(--tm)' }}>—</span> : u._isUnsplit ? <span title="Cần tách trước khi xếp" style={{ fontSize: '0.6rem', color: 'var(--tm)' }}>—</span> : <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggle(u.id)} />}</td>}
                <td style={{ ...tdS, fontFamily: 'monospace', fontSize: '0.66rem', whiteSpace: 'nowrap' }}>
                  {isLeftover && <span title="Kiện bỏ lại" style={{ color: 'var(--ac)' }}>↺ </span>}
                  {u._isUnsplit
                    ? <><span>{u._code.replace(' (chưa tách)', '')}</span> <span style={{ fontSize: '0.56rem', padding: '1px 4px', borderRadius: 4, background: 'var(--ac)', color: '#fff', fontWeight: 700, fontFamily: 'inherit', verticalAlign: 'middle' }}>chưa tách</span></>
                    : u._code}
                </td>
                <td style={{ ...tdS, whiteSpace: 'nowrap' }}>{wtMap[u.woodTypeId]?.name || '—'}</td>
                <td style={{ ...tdS, textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtNum(u.thicknessCm, 1)}</td>
                <td style={{ ...tdS, textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtNum(u.volumeM3, 3)}</td>
                <td style={{ ...tdS, fontSize: '0.7rem', whiteSpace: 'nowrap' }}>{u._quality || ''}</td>
                <td title={u._notes || ''} style={{ ...tdS, fontSize: '0.68rem', color: 'var(--tm)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>{u._notes || ''}</td>
                <td style={{ ...tdS, fontSize: '0.68rem', whiteSpace: 'nowrap' }}>{kilnNum ? `${kilnNum}` : ''}</td>
                <td style={{ ...tdS, whiteSpace: 'nowrap' }}>{u.ownerType === 'company' ? <span style={{ color: 'var(--gn)', fontWeight: 600 }}>Cty</span> : (u.ownerName || '')}</td>
                <td style={{ ...tdS, fontFamily: 'monospace', fontSize: '0.6rem', whiteSpace: 'nowrap', color: 'var(--tm)' }}>{ki?.itemCode || ''}</td>
                <td style={{ ...tdS, fontSize: '0.64rem', whiteSpace: 'nowrap', color: 'var(--tm)' }}>{u.createdAt && !u._isUnsplit ? new Date(u.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : ''}</td>
                {ce && <td style={{ ...tdS, whiteSpace: 'nowrap' }}>
                  {u._isUnsplit && <button onClick={() => { setSplitItem(u); setSplitWeights([u.volumeM3 ? u.volumeM3.toFixed(3) : '']); }} style={{ padding: '2px 8px', borderRadius: 4, border: 'none', background: 'var(--ac)', color: '#fff', cursor: 'pointer', fontSize: '0.6rem', fontWeight: 700, marginRight: 4 }}>Tách</button>}
                  {!u._isUnsplit && <button onClick={() => handleDeleteUnsorted(u)} style={{ background: 'none', border: 'none', color: 'var(--dg)', cursor: 'pointer', fontSize: '0.6rem' }}>Xóa</button>}
                </td>}
              </tr>
            );
          })}
          {!filtered.length && <tr><td colSpan={ce ? 12 : 10} style={{ ...tdS, textAlign: 'center', color: 'var(--tm)', padding: 20 }}>Không có kiện chưa xếp</td></tr>}
        </tbody>
      </table>
      {/* Selection bar removed — moved to top */}

      {/* Dialog Import */}
      {showImport && (
        <Dialog open={true} onClose={() => setShowImport(false)} title="Import kiện chưa xếp" width={520} maxHeight="85vh" noEnter>
          <div style={{ fontSize: '0.7rem', color: 'var(--tm)', marginBottom: 10 }}>
            Paste dữ liệu CSV/Tab — mỗi dòng 1 kiện. Không cần dữ liệu lò sấy.
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--ts)', marginBottom: 8, padding: '6px 8px', background: 'var(--bgs)', borderRadius: 6, fontFamily: 'monospace' }}>
            Loại gỗ, Dày(cm), m³, Đơn vị, Ghi chú<br />
            Óc chó, 2.5, 0.45, Cty,<br />
            Tần bì, 3.0, 0.32, Kh.Minh, Lô cũ
          </div>
          <textarea value={csvText} onChange={e => setCsvText(e.target.value)} rows={8} placeholder="Paste CSV ở đây..." style={{ ...inpS, fontFamily: 'monospace', fontSize: '0.72rem', resize: 'vertical', marginBottom: 8 }} autoFocus />
          {csvText.trim() && (() => {
            const { items, errors } = parseCsv(csvText);
            return (
              <div style={{ fontSize: '0.7rem', marginBottom: 8 }}>
                <span style={{ color: 'var(--gn)', fontWeight: 600 }}>{items.length} kiện hợp lệ</span>
                {errors.length > 0 && <span style={{ color: 'var(--dg)', marginLeft: 8 }}>{errors.length} lỗi</span>}
                {errors.slice(0, 3).map((e, i) => <div key={i} style={{ color: 'var(--dg)', fontSize: '0.65rem', marginTop: 2 }}>{e}</div>)}
              </div>
            );
          })()}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowImport(false)} style={btnSec}>Hủy</button>
            <button onClick={handleImport} disabled={importing || !csvText.trim()} style={{ ...btnP, opacity: importing || !csvText.trim() ? 0.5 : 1 }}>{importing ? 'Đang import...' : 'Import'}</button>
          </div>
        </Dialog>
      )}

      {/* Dialog tách kiện chưa tách */}
      {splitItem && (() => {
        const origM3 = splitItem.volumeM3 || 0;
        const origKg = splitItem.weightKg || 0;
        const splitVols = splitWeights.map(w => parseFloat(w) || 0);
        const totalSplitM3 = splitVols.reduce((s, v) => s + v, 0);
        const remaining = origM3 - totalSplitM3;
        const diffPct = origM3 > 0 ? Math.abs(origM3 - totalSplitM3) / origM3 * 100 : 0;
        const isOver = totalSplitM3 > origM3;
        const isUnder10 = !isOver && diffPct > 10;
        const addWithRemaining = () => {
          const rem = Math.max(0, origM3 - splitVols.reduce((s, v) => s + v, 0));
          setSplitWeights(p => [...p, rem > 0 ? rem.toFixed(3) : '']);
        };
        return (
          <Dialog open={true} onClose={() => setSplitItem(null)} title={`Tách ${splitItem._code?.replace(' (chưa tách)', '')}`} width={400} noEnter>
            <div style={{ fontSize: '0.72rem', color: 'var(--ts)', marginBottom: 12 }}>
              {wtMap[splitItem.woodTypeId]?.icon} {wtMap[splitItem.woodTypeId]?.name} · {fmtNum(splitItem.thicknessCm, 1)}cm · Tổng gốc: <strong>{fmtNum(origM3, 3)} m³</strong> ({fmtNum(origKg, 0)} kg)
            </div>
            {splitWeights.map((w, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--tm)', minWidth: 50 }}>Kiện {i + 1}</span>
                <input type="number" step="0.001" value={w}
                  onChange={e => setSplitWeights(p => p.map((v, j) => j === i ? e.target.value : v))}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (i === splitWeights.length - 1) addWithRemaining(); } }}
                  placeholder="m³" style={{ ...inpS, flex: 1 }} autoFocus={i === splitWeights.length - 1} />
                <span style={{ fontSize: '0.68rem', color: 'var(--tm)', minWidth: 30 }}>m³</span>
                {splitWeights.length > 1 && <button onClick={() => setSplitWeights(p => p.filter((_, j) => j !== i))} style={{ ...btnDg, padding: '3px 8px' }}>✕</button>}
              </div>
            ))}
            <button onClick={addWithRemaining} style={{ ...btnSec, width: '100%', marginBottom: 10 }}>+ Thêm kiện {remaining > 0.0005 ? `(${fmtNum(remaining, 3)} m³ còn lại)` : ''}</button>
            <div style={{ fontSize: '0.74rem', marginBottom: 4 }}>
              Tổng tách: <strong style={{ color: isOver ? 'var(--dg)' : 'var(--ts)' }}>{fmtNum(totalSplitM3, 3)} m³</strong> / {fmtNum(origM3, 3)} m³
              {remaining > 0.0005 && <span style={{ color: 'var(--tm)', marginLeft: 6 }}>Còn lại: {fmtNum(remaining, 3)}</span>}
            </div>
            {isOver && <div style={{ fontSize: '0.68rem', color: 'var(--dg)', marginBottom: 4 }}>Tổng tách vượt quá khối lượng gốc</div>}
            {isUnder10 && <div style={{ fontSize: '0.68rem', color: '#D4A017', marginBottom: 4 }}>⚠ Chênh lệch {fmtNum(diffPct, 1)}% ({'>'} 10%) — kiểm tra lại</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button onClick={() => setSplitItem(null)} style={btnSec}>Hủy</button>
              <button onClick={handleSplitUnsorted} disabled={splitting} style={{ ...btnP, opacity: splitting ? 0.5 : 1 }}>{splitting ? 'Đang tách...' : 'Tách'}</button>
            </div>
          </Dialog>
        );
      })()}

      {/* Dialog cảnh báo trùng mẻ đang xếp */}
      {conflictSession && (
        <Dialog open={true} onClose={() => setConflictSession(null)} title="Đã có mẻ đang xếp" width={440} noEnter>
          <div style={{ fontSize: '0.76rem', color: 'var(--ts)', marginBottom: 12 }}>
            Mẻ <strong>{conflictSession.sessionCode}</strong> ({wtMap[conflictSession.woodTypeId]?.name} · {fmtNum(conflictSession.thicknessCm, 1)}cm) đang xếp với {fmtNum(conflictSession.totalInputM3, 3)} m³ đầu vào.
          </div>
          <div style={{ fontSize: '0.74rem', marginBottom: 12 }}>
            Bạn muốn <strong>bổ sung {selItems.length} kiện</strong> ({fmtNum(selM3, 3)} m³) vào mẻ này hay tạo mẻ mới?
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setConflictSession(null)} style={btnSec}>Hủy</button>
            <button onClick={async () => { setConflictSession(null); await doCreateNewSession(); }} style={btnSec}>Tạo mẻ mới</button>
            <button onClick={handleAddToExisting} style={btnP}>Bổ sung vào {conflictSession.sessionCode}</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB 3: MẺ XẾP
// ══════════════════════════════════════════════════════════════
function PackingTab({ sessions, unsorted, leftovers, bundles, setBundles, wts, ats, cfg, ce, useAPI, notify, onRefresh, pendingMeasurements = [] }) {
  const [selSession, setSelSession] = useState(null);
  const [delSession, setDelSession] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterWoodPk, setFilterWoodPk] = useState('');
  const [filterSessionCode, setFilterSessionCode] = useState('');
  const [filterThickPk, setFilterThickPk] = useState('');
  const wtMap = useMemo(() => Object.fromEntries(wts.map(w => [w.id, w])), [wts]);

  const filteredSessions = useMemo(() => {
    let r = sessions;
    if (filterStatus) r = r.filter(s => s.status === filterStatus);
    if (filterWoodPk) r = r.filter(s => s.woodTypeId === filterWoodPk);
    if (filterSessionCode) r = r.filter(s => (s.sessionCode || '').toLowerCase().includes(filterSessionCode.toLowerCase()));
    if (filterThickPk) r = r.filter(s => String(s.thicknessCm || '') === filterThickPk);
    return r;
  }, [sessions, filterStatus, filterWoodPk, filterSessionCode, filterThickPk]);
  const sessionWoods = useMemo(() => {
    const pool = filterStatus ? sessions.filter(s => s.status === filterStatus) : sessions;
    return [...new Set(pool.map(s => s.woodTypeId))].filter(Boolean);
  }, [sessions, filterStatus]);

  const handleDeleteSession = async () => {
    if (!delSession) return;
    if (delSession.status === 'Hoàn thành') { notify('Không thể xóa mẻ đã hoàn thành. Mở lại mẻ trước khi xóa.', false); setDelSession(null); return; }
    if (useAPI) {
      const api = await import('../api.js');
      // Check bundle đã gán vào đơn hàng
      const sessionBundles = bundles.filter(b => b.packingSessionId === delSession.id);
      for (const b of sessionBundles) {
        const inOrder = await api.checkBundleInOrders(b.id);
        if (inOrder) { notify(`Không thể xóa — kiện ${b.bundleCode} đã có trong đơn hàng`, false); setDelSession(null); return; }
      }
      // Trả unsorted về chưa xếp
      const sessionUnsorted = unsorted.filter(u => u.packingSessionId === delSession.id);
      if (sessionUnsorted.length) await api.updateUnsortedBundlesBatch(sessionUnsorted.map(u => u.id), { status: 'Chưa xếp', packingSessionId: null });
      // Trả leftovers input về chưa xếp
      const sessionInputLf = leftovers.filter(l => l.usedInSessionId === delSession.id);
      for (const l of sessionInputLf) await api.updatePackingLeftover(l.id, { status: 'Chưa xếp', usedInSessionId: null });
      // Xóa output bundles
      for (const b of sessionBundles) await api.deleteBundle(b.id);
      if (sessionBundles.length) setBundles(prev => prev.filter(b => b.packingSessionId !== delSession.id));
      // Xóa output leftovers (cascade bởi FK)
      // Xóa session
      await api.deletePackingSession(delSession.id);
      notify(`Đã xóa mẻ ${delSession.sessionCode}`);
    }
    setDelSession(null);
    onRefresh();
  };

  // Tính output per-session cho danh sách + dialog xóa (phải khai báo trước if/return)
  const sessionOutputMap = useMemo(() => {
    const m = {};
    sessions.forEach(s => {
      const ob = bundles.filter(b => b.packingSessionId === s.id);
      const ol = leftovers.filter(l => l.sourceSessionId === s.id);
      const outM3 = ob.reduce((sum, b) => sum + (b.volume || 0), 0) + ol.reduce((sum, l) => sum + (l.volumeM3 || 0), 0);
      const inM3 = s.totalInputM3 || 0;
      const diffPct = inM3 > 0 ? Math.abs(inM3 - outM3) / inM3 * 100 : 0;
      m[s.id] = { bundleCount: ob.length, leftoverCount: ol.length, outM3, diffPct };
    });
    return m;
  }, [sessions, bundles, leftovers]);

  // Stats cho tab mẻ xếp
  const packingStats = useMemo(() => {
    const active = sessions.filter(s => s.status === 'Đang xếp');
    const done = sessions.filter(s => s.status === 'Hoàn thành');
    const totalInM3 = sessions.reduce((s, x) => s + (x.totalInputM3 || 0), 0);
    const totalOutM3 = Object.values(sessionOutputMap).reduce((s, x) => s + (x.outM3 || 0), 0);
    const totalBundles = Object.values(sessionOutputMap).reduce((s, x) => s + (x.bundleCount || 0), 0);
    return { activeCount: active.length, doneCount: done.length, totalInM3, totalOutM3, totalBundles };
  }, [sessions, sessionOutputMap]);

  if (selSession) {
    return <PackingDetail session={selSession} unsorted={unsorted} leftovers={leftovers} bundles={bundles} setBundles={setBundles} wts={wts} ats={ats} cfg={cfg} wtMap={wtMap} ce={ce} useAPI={useAPI} notify={notify} onBack={() => { setSelSession(null); onRefresh(); }} onRefresh={onRefresh} pendingMeasurements={pendingMeasurements} />;
  }

  const delBundles = delSession ? bundles.filter(b => b.packingSessionId === delSession.id) : [];
  const delLeftovers = delSession ? leftovers.filter(l => l.sourceSessionId === delSession.id) : [];

  return (
    <div style={panelS}>
      <div style={panelHead}>
        <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>Mẻ xếp ({filteredSessions.length}{filteredSessions.length !== sessions.length ? `/${sessions.length}` : ''})</span>
        {(filterStatus || filterWoodPk || filterSessionCode || filterThickPk) && <button onClick={() => { setFilterStatus(''); setFilterWoodPk(''); setFilterSessionCode(''); setFilterThickPk(''); }} style={{ ...btnSec, padding: '2px 8px', fontSize: '0.64rem', color: 'var(--dg)' }}>Xóa lọc</button>}
      </div>
      {/* Stats cards */}
      {sessions.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, padding: '10px 14px' }}>
          <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bgc)', border: '1px solid var(--bd)', borderTop: '3px solid var(--ac)' }}>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--tp)' }}>{packingStats.activeCount} <span style={{ fontSize: '0.68rem', fontWeight: 500, color: 'var(--ts)' }}>đang xếp</span></div>
            <div style={{ fontSize: '0.64rem', color: 'var(--tm)', marginTop: 2 }}>{packingStats.doneCount} hoàn thành</div>
          </div>
          <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bgc)', border: '1px solid var(--bd)', borderTop: '3px solid var(--gn)' }}>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--tp)' }}>{fmtNum(packingStats.totalInM3, 2)} <span style={{ fontSize: '0.68rem', fontWeight: 500, color: 'var(--ts)' }}>m³ vào</span></div>
            <div style={{ fontSize: '0.64rem', color: 'var(--tm)', marginTop: 2 }}>Tổng đầu vào</div>
          </div>
          <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bgc)', border: '1px solid var(--bd)', borderTop: '3px solid #2980b9' }}>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--tp)' }}>{fmtNum(packingStats.totalOutM3, 2)} <span style={{ fontSize: '0.68rem', fontWeight: 500, color: 'var(--ts)' }}>m³ ra</span></div>
            <div style={{ fontSize: '0.64rem', color: 'var(--tm)', marginTop: 2 }}>Tổng đầu ra</div>
          </div>
          <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bgc)', border: '1px solid var(--bd)', borderTop: '3px solid #8E44AD' }}>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--tp)' }}>{packingStats.totalBundles} <span style={{ fontSize: '0.68rem', fontWeight: 500, color: 'var(--ts)' }}>kiện</span></div>
            <div style={{ fontSize: '0.64rem', color: 'var(--tm)', marginTop: 2 }}>Tổng kiện output</div>
          </div>
        </div>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--bgs)' }}>
            <td style={{ padding: '5px 4px' }}><ComboFilter value={filterSessionCode || ''} onChange={v => setFilterSessionCode(v)} options={[...new Set(sessions.map(s => s.sessionCode).filter(Boolean))]} placeholder="Mã" /></td>
            <td style={{ padding: '5px 4px' }} />
            <td style={{ padding: '5px 4px' }}><ComboFilter value={filterWoodPk ? (wtMap[filterWoodPk]?.name || filterWoodPk) : ''} onChange={v => { const w = Object.entries(wtMap).find(([, x]) => x.name === v); setFilterWoodPk(w ? w[0] : ''); }} options={sessionWoods.map(id => wtMap[id]?.name || id)} placeholder="Loại gỗ" /></td>
            <td style={{ padding: '5px 4px' }}><ComboFilter value={filterThickPk || ''} onChange={v => setFilterThickPk(v)} options={[...new Set(sessions.map(s => s.thicknessCm ? `${s.thicknessCm}` : null).filter(Boolean))].sort()} placeholder="Dày" strict /></td>
            <td style={{ padding: '5px 4px' }} />
            <td style={{ padding: '5px 4px' }} />
            <td style={{ padding: '5px 4px' }} />
            <td style={{ padding: '5px 4px' }}><ComboFilter value={filterStatus} onChange={v => setFilterStatus(v)} options={['Đang xếp', 'Hoàn thành']} placeholder="TT" /></td>
            {ce && <td style={{ padding: '5px 4px' }} />}
          </tr>
          <tr>
          <th style={thS}>Mã</th><th style={thS}>Ngày</th><th style={thS}>Loại gỗ</th><th style={{ ...thS, textAlign: 'right' }}>Dày</th>
          <th style={{ ...thS, textAlign: 'right' }}>m³ vào</th><th style={{ ...thS, textAlign: 'right' }}>m³ ra</th><th style={{ ...thS, textAlign: 'right' }}>Kiện</th><th style={{ ...thS, textAlign: 'center' }}>CL%</th><th style={thS}>TT</th>
          {ce && <th style={{ ...thS, width: 30 }}></th>}
        </tr></thead>
        <tbody>
          {filteredSessions.map(s => (
            <tr key={s.id} style={{ cursor: 'pointer' }}>
              <td style={{ ...tdS, fontFamily: 'monospace', fontSize: '0.68rem' }} onClick={() => setSelSession(s)}>{s.sessionCode}</td>
              <td style={tdS} onClick={() => setSelSession(s)}>{fmtDate(s.packingDate)}</td>
              <td style={tdS} onClick={() => setSelSession(s)}>{wtMap[s.woodTypeId]?.name || '—'}</td>
              <td style={{ ...tdS, textAlign: 'right' }} onClick={() => setSelSession(s)}>{fmtNum(s.thicknessCm, 1)} cm</td>
              <td style={{ ...tdS, textAlign: 'right', fontWeight: 600 }} onClick={() => setSelSession(s)}>{fmtNum(s.totalInputM3, 3)}</td>
              <td style={{ ...tdS, textAlign: 'right' }} onClick={() => setSelSession(s)}>{fmtNum(sessionOutputMap[s.id]?.outM3 || 0, 3)}</td>
              <td style={{ ...tdS, textAlign: 'right' }} onClick={() => setSelSession(s)}>{sessionOutputMap[s.id]?.bundleCount || 0}</td>
              <td style={{ ...tdS, textAlign: 'center' }} onClick={() => setSelSession(s)}>{(() => { const d = sessionOutputMap[s.id]?.diffPct; const lv = d <= 10 ? 'ok' : d <= 15 ? 'warn' : 'error'; return s.status === 'Đang xếp' && !sessionOutputMap[s.id]?.bundleCount ? <span style={{ color: 'var(--tm)', fontSize: '0.65rem' }}>—</span> : <span style={{ fontSize: '0.65rem', fontWeight: 600, color: lv === 'ok' ? 'var(--gn)' : lv === 'warn' ? '#D4A017' : 'var(--dg)' }}>{fmtNum(d, 1)}%</span>; })()}</td>
              <td style={tdS} onClick={() => setSelSession(s)}><span style={badge(s.status === 'Đang xếp' ? { color: 'var(--ac)', bg: 'rgba(242,101,34,0.1)' } : { color: 'var(--gn)', bg: 'rgba(50,79,39,0.1)' })}>{s.status}</span></td>
              {ce && <td style={tdS}>{s.status !== 'Hoàn thành' && <button onClick={e => { e.stopPropagation(); setDelSession(s); }} style={{ background: 'none', border: 'none', color: 'var(--dg)', cursor: 'pointer', fontSize: '0.6rem' }}>Xóa</button>}</td>}
            </tr>
          ))}
          {!filteredSessions.length && <tr><td colSpan={ce ? 10 : 9} style={{ ...tdS, textAlign: 'center', color: 'var(--tm)', padding: 20 }}>{sessions.length ? 'Không có mẻ phù hợp' : 'Chưa có mẻ xếp'}</td></tr>}
        </tbody>
      </table>

      {/* Dialog xác nhận xóa mẻ */}
      {delSession && (
        <Dialog open={true} onClose={() => setDelSession(null)} onOk={handleDeleteSession} title={`Xóa mẻ xếp ${delSession.sessionCode}?`} width={480}>
          <div style={{ fontSize: '0.76rem', color: 'var(--ts)', marginBottom: 10 }}>
            Các kiện đầu vào sẽ được trả về danh sách chưa xếp.
          </div>

          {delBundles.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--dg)', marginBottom: 4 }}>Kiện gỗ xẻ sẽ bị xóa ({delBundles.length}):</div>
              {delBundles.map(b => (
                <div key={b.id} style={{ fontSize: '0.7rem', padding: '2px 0', display: 'flex', gap: 8 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.64rem' }}>{b.bundleCode}</span>
                  <span>{b.attributes?.quality || ''}</span>
                  <span style={{ marginLeft: 'auto', fontWeight: 600 }}>{fmtNum(b.volume, 3)} m³</span>
                </div>
              ))}
            </div>
          )}

          {delLeftovers.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--ac)', marginBottom: 4 }}>Kiện bỏ lại sẽ bị xóa ({delLeftovers.length}):</div>
              {delLeftovers.map(l => (
                <div key={l.id} style={{ fontSize: '0.7rem', padding: '2px 0', display: 'flex', gap: 8 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.64rem' }}>{l.leftoverCode}</span>
                  <span>{l.quality || ''}</span>
                  <span style={{ marginLeft: 'auto', fontWeight: 600 }}>{fmtNum(l.volumeM3, 3)} m³</span>
                </div>
              ))}
            </div>
          )}

          {!delBundles.length && !delLeftovers.length && (
            <div style={{ fontSize: '0.74rem', color: 'var(--tm)', marginBottom: 10 }}>Mẻ chưa có đầu ra.</div>
          )}

          <div style={{ fontSize: '0.7rem', color: 'var(--dg)', fontWeight: 600, marginBottom: 12 }}>
            Thao tác này không thể hoàn tác.
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setDelSession(null)} style={btnSec}>Hủy</button>
            <button onClick={handleDeleteSession} style={btnDg}>Xóa mẻ xếp</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

// ── Chi tiết mẻ xếp (input, output bundles, leftovers, đối soát) ─
function PackingDetail({ session, unsorted, leftovers, bundles, setBundles, wts, ats, cfg, wtMap, ce, useAPI, notify, onBack, onRefresh, pendingMeasurements = [] }) {
  const inputs = useMemo(() => unsorted.filter(u => u.packingSessionId === session.id), [unsorted, session.id]);
  const inputLeftovers = useMemo(() => leftovers.filter(l => l.usedInSessionId === session.id), [leftovers, session.id]);
  const outputBundles = useMemo(() => bundles.filter(b => b.packingSessionId === session.id), [bundles, session.id]);
  const outputLeftovers = useMemo(() => leftovers.filter(l => l.sourceSessionId === session.id), [leftovers, session.id]);

  const totalInputM3 = inputs.reduce((s, u) => s + (u.volumeM3 || 0), 0) + inputLeftovers.reduce((s, l) => s + (l.volumeM3 || 0), 0);
  const totalOutputM3 = outputBundles.reduce((s, b) => s + (b.volume || 0), 0);
  const totalLeftoverM3 = outputLeftovers.reduce((s, l) => s + (l.volumeM3 || 0), 0);
  const totalOutM3 = totalOutputM3 + totalLeftoverM3;
  const diffM3 = totalInputM3 - totalOutM3;
  const diffPct = totalInputM3 > 0 ? Math.abs(diffM3) / totalInputM3 * 100 : 0;
  const diffLevel = diffPct <= 10 ? 'ok' : diffPct <= 15 ? 'warn' : 'error';

  const woodCfg = cfg[session.woodTypeId] || { attrs: [], attrValues: {} };
  const qualities = woodCfg.attrValues?.quality || [];

  // Kiện chưa xếp cùng loại+dày (cho dialog thêm đầu vào)
  const availableForInput = useMemo(() => {
    // unsorted chưa xếp + cùng loại + cùng dày
    const ub = unsorted.filter(u => u.status === 'Chưa xếp' && u.woodTypeId === session.woodTypeId && u.thicknessCm === session.thicknessCm);
    // leftovers chưa xếp cùng loại + dày
    const lf = leftovers.filter(l => l.status === 'Chưa xếp' && l.woodTypeId === session.woodTypeId && l.thicknessCm === session.thicknessCm);
    return { unsorted: ub, leftovers: lf };
  }, [unsorted, leftovers, session]);

  const [addInputSel, setAddInputSel] = useState(new Set());

  const handleAddInputs = async () => {
    const selIds = [...addInputSel];
    if (!selIds.length) return;
    if (useAPI) {
      const api = await import('../api.js');
      const ubIds = selIds.filter(id => !id.startsWith('lf_'));
      const lfIds = selIds.filter(id => id.startsWith('lf_')).map(id => id.slice(3));
      if (ubIds.length) await api.updateUnsortedBundlesBatch(ubIds, { status: 'Đã xếp', packingSessionId: session.id });
      for (const lid of lfIds) await api.updatePackingLeftover(lid, { status: 'Đã xếp', usedInSessionId: session.id });
      // Cập nhật tổng input
      const addedKg = [...availableForInput.unsorted.filter(u => ubIds.includes(u.id)), ...availableForInput.leftovers.filter(l => lfIds.includes(l.id))];
      const addKg = addedKg.reduce((s, x) => s + (x.weightKg || 0), 0);
      const addM3 = addedKg.reduce((s, x) => s + (x.volumeM3 || 0), 0);
      await api.updatePackingSession(session.id, { totalInputKg: (session.totalInputKg || 0) + addKg, totalInputM3: (session.totalInputM3 || 0) + addM3 });
      notify(`Đã thêm ${selIds.length} kiện vào mẻ xếp`);
    }
    setAddInputSel(new Set());
    setShowAddInput(false);
    onRefresh();
  };

  // Trả kiện đầu vào về danh sách chưa xếp
  const handleReturnUnsorted = async (unsortedId) => {
    if (!window.confirm('Trả kiện này về danh sách chưa xếp?')) return;
    if (useAPI) {
      const api = await import('../api.js');
      await api.updateUnsortedBundle(unsortedId, { status: 'Chưa xếp', packingSessionId: null });
      notify('Đã trả kiện về danh sách chưa xếp');
    }
    onRefresh();
  };

  const handleReturnLeftover = async (leftoverId) => {
    if (!window.confirm('Trả kiện bỏ lại này về danh sách chưa xếp?')) return;
    if (useAPI) {
      const api = await import('../api.js');
      await api.updatePackingLeftover(leftoverId, { status: 'Chưa xếp', usedInSessionId: null });
      notify('Đã trả kiện bỏ lại về danh sách chưa xếp');
    }
    onRefresh();
  };

  // Dialog chọn thêm kiện đầu vào
  const [showAddInput, setShowAddInput] = useState(false);

  // Add bundle (kiện gỗ xẻ)
  const [showAddBundle, setShowAddBundle] = useState(false);
  const initBf = { quality: '', width: '', length: '', location: '', boardCount: '', volume: '', notes: '', bundleCode: '' };
  const [bf, setBf] = useState(initBf);
  const [bfCodeLoading, setBfCodeLoading] = useState(false);
  const [bfCodeDup, setBfCodeDup] = useState(false);
  const [bfImages, setBfImages] = useState([]);
  const [bfItemImages, setBfItemImages] = useState([]);
  const [savingBundle, setSavingBundle] = useState(false);
  const [bfBoards, setBfBoards] = useState([]);
  const resetBf = () => { setBf(initBf); setBfImages([]); setBfItemImages([]); setBfBoards([]); setBfCodeDup(false); };

  // Gen mã kiện khi mở dialog
  useEffect(() => {
    if (!showAddBundle) return;
    setBfCodeLoading(true);
    import('../api.js').then(api => api.genKilnBundleCode()).then(code => {
      setBf(p => ({ ...p, bundleCode: code }));
      setBfCodeLoading(false);
    });
  }, [showAddBundle]);

  // Check trùng mã kiện (debounce)
  const bfCodeTimer = useRef(null);
  const checkBfCode = (code) => {
    setBf(p => ({ ...p, bundleCode: code }));
    clearTimeout(bfCodeTimer.current);
    if (!code.trim()) { setBfCodeDup(false); return; }
    bfCodeTimer.current = setTimeout(async () => {
      const api = await import('../api.js');
      setBfCodeDup(await api.checkBundleCodeExists(code.trim()));
    }, 400);
  };
  const widthValues = woodCfg.attrValues?.width || [];

  const handleAddBundle = async () => {
    if (savingBundle) return;
    if (!bf.quality) { notify('Chọn chất lượng', false); return; }
    if (!bf.boardCount || parseInt(bf.boardCount) <= 0) { notify('Nhập số tấm', false); return; }
    const vol = parseFloat(bf.volume);
    if (!vol || vol <= 0) { notify('Nhập m³', false); return; }
    if (vol > canAddMoreM3 + 0.001) { notify(`Vượt giới hạn: tổng ra chỉ được ≤ 120% đầu vào (còn ${fmtNum(canAddMoreM3, 3)} m³)`, false); return; }
    setSavingBundle(true);
    try {
      const api = await import('../api.js');
      // Tạo attributes + skuKey theo cfg (bỏ supplier)
      const attrs = { quality: bf.quality };
      if (bf.width) attrs.width = bf.width;
      if (bf.length) attrs.length = bf.length.trim();
      // thickness từ session → normalize thêm hậu tố F (VD: "2.5" → "2.5F")
      const nt = normalizeThickness(session.thicknessCm);
      attrs.thickness = nt.value || String(session.thicknessCm);
      const skuKey = Object.entries(attrs).filter(([, v]) => v).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}:${v}`).join('||');
      const parsedVol = +parseFloat(bf.volume).toFixed(4);
      const bundleCode = bf.bundleCode.trim();
      if (!bundleCode) { notify('Nhập mã kiện', false); setSavingBundle(false); return; }
      if (bfCodeDup) { notify('Mã kiện đã tồn tại', false); setSavingBundle(false); return; }
      const result = await api.addBundle({
        bundleCode,
        woodId: session.woodTypeId, packingSessionId: session.id, skuKey, attributes: attrs,
        boardCount: parseInt(bf.boardCount), volume: parsedVol,
        notes: bf.notes || null, location: bf.location || null,
        rawMeasurements: bfBoards.length ? { boards: bfBoards } : {},
      });
      if (result.error) { notify('Lỗi: ' + result.error, false); setSavingBundle(false); return; }
      // Upload ảnh
      let imgUrls = [], itemImgUrls = [];
      for (const img of bfImages) { const r = await api.uploadBundleImage(result.bundleCode, img.file, 'photo'); if (!r.error) imgUrls.push(r.url); }
      for (const img of bfItemImages) { const r = await api.uploadBundleImage(result.bundleCode, img.file, 'item-list'); if (!r.error) itemImgUrls.push(r.url); }
      if (imgUrls.length || itemImgUrls.length) {
        await api.updateBundle(result.id, { ...(imgUrls.length && { images: imgUrls }), ...(itemImgUrls.length && { item_list_images: itemImgUrls }) });
      }
      // Thêm bundle mới vào state ngay để hiển thị
      const newBundle = {
        id: result.id, bundleCode: result.bundleCode, woodId: session.woodTypeId,
        packingSessionId: session.id, skuKey, attributes: attrs,
        boardCount: parseInt(bf.boardCount), volume: parsedVol,
        remainingBoards: parseInt(bf.boardCount), remainingVolume: parsedVol,
        status: 'Kiện nguyên', location: bf.location || null, notes: bf.notes || null,
        images: imgUrls, itemListImages: itemImgUrls, rawMeasurements: bfBoards.length ? { boards: bfBoards } : {},
        createdAt: new Date().toISOString(),
      };
      setBundles(prev => [newBundle, ...prev]);
      notify(`Đã tạo kiện ${result.bundleCode}`);
      resetBf();
      setShowAddBundle(false);
    } catch (e) { notify('Lỗi: ' + e.message, false); }
    setSavingBundle(false);
    onRefresh();
  };

  // Validate tổng output không vượt 120% input
  const maxOutputM3 = totalInputM3 * 1.2;
  const canAddMoreM3 = maxOutputM3 - totalOutM3;

  // Assign measurement from app — 2 bước: chọn → review → confirm
  const [showAssignMeasure, setShowAssignMeasure] = useState(false);
  const [reviewMeasurement, setReviewMeasurement] = useState(null);
  const [savingMeasure, setSavingMeasure] = useState(false);

  const handlePickMeasure = (m) => {
    // Bước 1: chọn kiện từ list → mở ReviewDialog
    setShowAssignMeasure(false);
    setReviewMeasurement(m);
  };

  const handleConfirmAssign = async (reviewed) => {
    // Bước 2: user đã review + chỉnh sửa → tạo bundle
    setSavingMeasure(true);
    try {
      const api = await import('../api.js');
      const result = await api.addBundle({
        bundleCode: reviewed.bundleCode,
        woodId: reviewed.woodTypeId, packingSessionId: session.id,
        skuKey: reviewed.skuKey, attributes: reviewed.attributes,
        boardCount: reviewed.boardCount, volume: reviewed.volume,
        rawMeasurements: reviewed.rawMeasurements,
        measuredBy: reviewed.measuredBy,
        notes: reviewed.notes,
      });
      if (result.error) { notify(result.error, false); setSavingMeasure(false); return; }
      await api.assignMeasurementToOrder(reviewed.measurementId, null, result.id);
      const allBundles = await api.fetchBundles();
      setBundles(allBundles);
      notify(`Gán kiện ${reviewed.bundleCode} → mẻ ${session.sessionCode}`);
      setReviewMeasurement(null);
      onRefresh();
    } catch (e) { notify('Lỗi: ' + e.message, false); }
    setSavingMeasure(false);
  };

  // Gỡ kiện output khỏi mẻ — xóa bundle + trả measurement về pool
  const handleRemoveBundle = async (bundle) => {
    if (!window.confirm(`Gỡ kiện ${bundle.bundleCode} khỏi mẻ xếp?\nKiện sẽ bị xóa khỏi kho.`)) return;
    if (useAPI) {
      const api = await import('../api.js');
      // Check kiện đã gán vào đơn hàng chưa
      const inOrder = await api.checkBundleInOrders(bundle.id);
      if (inOrder) { notify(`Không thể gỡ — kiện ${bundle.bundleCode} đã có trong đơn hàng`, false); return; }
      // Trả measurement về pool "chờ gán"
      try {
        const measurements = await api.fetchMeasurementsByBundleId(bundle.id);
        for (const m of measurements) await api.unlinkMeasurement(m.id);
      } catch { /* không có measurement liên kết — bỏ qua */ }
      // Xóa bundle
      await api.deleteBundle(bundle.id);
      setBundles(prev => prev.filter(b => b.id !== bundle.id));
      notify(`Đã gỡ kiện ${bundle.bundleCode}`);
    }
    onRefresh();
  };

  const [boardDetail, setBoardDetail] = useState(null);

  // Add leftover
  const [addingLeftover, setAddingLeftover] = useState(false);
  const [savingLeftover, setSavingLeftover] = useState(false);
  const [lf, setLf] = useState({ quality: '', volumeM3: '', notes: '' });

  const handleAddLeftover = async () => {
    if (savingLeftover) return;
    const vol = +parseFloat(lf.volumeM3).toFixed(4);
    if (!vol || vol <= 0) { notify('Nhập m³', false); return; }
    if (vol > canAddMoreM3 + 0.001) { notify(`Vượt giới hạn: tổng ra chỉ được ≤ 120% đầu vào (còn ${fmtNum(canAddMoreM3, 3)} m³)`, false); return; }
    setSavingLeftover(true);
    if (useAPI) {
      const api = await import('../api.js');
      const r = await api.addPackingLeftover(session.id, session.woodTypeId, session.thicknessCm, lf.quality, 0, vol, lf.notes);
      if (r?.error) { notify('Lỗi: ' + r.error, false); setSavingLeftover(false); return; }
      notify('Đã thêm kiện bỏ lại ' + r.leftoverCode);
    }
    setLf({ quality: '', volumeM3: '', notes: '' });
    setAddingLeftover(false);
    setSavingLeftover(false);
    onRefresh();
  };

  const handleDeleteLeftover = async (leftoverId) => {
    if (!window.confirm('Xóa kiện bỏ lại này?')) return;
    if (useAPI) {
      const api = await import('../api.js');
      await api.deletePackingLeftover(leftoverId);
      notify('Đã xóa kiện bỏ lại');
    }
    onRefresh();
  };

  const handleComplete = async () => {
    if (diffLevel === 'error') {
      if (!window.confirm(`Chênh lệch ${fmtNum(diffPct, 1)}% (> 15%). Vẫn hoàn thành?`)) return;
    }
    if (useAPI) {
      const api = await import('../api.js');
      await api.updatePackingSession(session.id, { status: 'Hoàn thành' });
      notify('Đã hoàn thành mẻ xếp');
    }
    onBack();
  };

  const handleReopen = async () => {
    if (!window.confirm(`Mở lại mẻ ${session.sessionCode}?`)) return;
    if (useAPI) {
      const api = await import('../api.js');
      const r = await api.updatePackingSession(session.id, { status: 'Đang xếp' });
      if (r?.error) { notify('Lỗi: ' + r.error, false); return; }
      notify('Đã mở lại mẻ xếp');
    }
    onRefresh();
  };


  return (
    <div>
      <button onClick={onBack} style={{ ...btnSec, marginBottom: 10 }}>← Quay lại</button>
      <div style={{ ...panelS, padding: 14, marginBottom: 12, cursor: 'default' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 800 }}>{session.sessionCode} — {wtMap[session.woodTypeId]?.name || '—'} {fmtNum(session.thicknessCm, 1)}cm</div>
            <div style={{ fontSize: '0.76rem', color: 'var(--ts)', marginTop: 4 }}>Ngày: {fmtDate(session.packingDate)}</div>
          </div>
          <span style={badge(session.status === 'Đang xếp' ? { color: 'var(--ac)', bg: 'rgba(242,101,34,0.1)' } : { color: 'var(--gn)', bg: 'rgba(50,79,39,0.1)' })}>{session.status}</span>
        </div>
      </div>

      {/* ── 2 panel: Đầu vào | Đầu ra ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12, alignItems: 'start' }}>

        {/* Panel trái: ĐẦU VÀO */}
        <div style={panelS}>
          <div style={{ ...panelHead, background: 'rgba(50,79,39,0.04)' }}>
            <span style={{ fontWeight: 700, fontSize: '0.78rem' }}>Đầu vào <span style={{ fontWeight: 400, color: 'var(--tm)', fontSize: '0.7rem' }}>{inputs.length + inputLeftovers.length} kiện</span></span>
            {ce && session.status === 'Đang xếp' && <button onClick={() => { setAddInputSel(new Set()); setShowAddInput(true); }} style={{ ...btnP, padding: '2px 8px', fontSize: '0.64rem' }}>+ Thêm</button>}
          </div>
          <div style={{ padding: '6px 10px' }}>
            {inputs.map(u => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: '0.72rem', borderBottom: '1px solid var(--bd)' }}>
                <span title={u.bundleCode} style={{ fontFamily: 'monospace', fontSize: '0.64rem', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.bundleCode}</span>
                <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtNum(u.volumeM3, 3)}</span>
                {ce && session.status === 'Đang xếp' && <button onClick={() => handleReturnUnsorted(u.id)} style={{ background: 'none', border: 'none', color: 'var(--dg)', cursor: 'pointer', fontSize: '0.6rem', fontWeight: 600, whiteSpace: 'nowrap' }}>Trả</button>}
              </div>
            ))}
            {inputLeftovers.map(l => (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: '0.72rem', borderBottom: '1px solid var(--bd)', color: 'var(--ac)' }}>
                <span title={l.leftoverCode} style={{ fontFamily: 'monospace', fontSize: '0.64rem', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>↺ {l.leftoverCode}</span>
                <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtNum(l.volumeM3, 3)}</span>
                {ce && session.status === 'Đang xếp' && <button onClick={() => handleReturnLeftover(l.id)} style={{ background: 'none', border: 'none', color: 'var(--dg)', cursor: 'pointer', fontSize: '0.6rem', fontWeight: 600, whiteSpace: 'nowrap' }}>Trả</button>}
              </div>
            ))}
            {!inputs.length && !inputLeftovers.length && <div style={{ padding: 10, textAlign: 'center', color: 'var(--tm)', fontSize: '0.72rem' }}>Không có</div>}
          </div>
          {/* Tổng đầu vào */}
          <div style={{ padding: '8px 12px', borderTop: '2px solid var(--bd)', display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.82rem' }}>
            <span>Tổng vào</span>
            <span style={{ fontFamily: 'monospace' }}>{fmtNum(totalInputM3, 3)} m³</span>
          </div>
        </div>

        {/* Panel phải: ĐẦU RA */}
        <div style={panelS}>
          <div style={{ ...panelHead, background: 'rgba(124,92,191,0.04)' }}>
            <span style={{ fontWeight: 700, fontSize: '0.78rem' }}>Đầu ra <span style={{ fontWeight: 400, color: 'var(--tm)', fontSize: '0.7rem' }}>{outputBundles.length + outputLeftovers.length} kiện</span></span>
            {ce && session.status === 'Đang xếp' && <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setShowAssignMeasure(true)} style={{ ...btnP, padding: '2px 8px', fontSize: '0.64rem' }}>Gán từ app đo{pendingMeasurements.length > 0 && <span style={{ marginLeft: 4, background: '#fff', color: 'var(--ac)', borderRadius: 8, padding: '0 4px', fontSize: '0.6rem', fontWeight: 700 }}>{pendingMeasurements.length}</span>}</button>
              <button onClick={() => setShowAddBundle(true)} style={{ ...btnSec, padding: '2px 8px', fontSize: '0.64rem' }}>+ Nhập tay</button>
              <button onClick={() => setAddingLeftover(true)} style={{ ...btnSec, padding: '2px 8px', fontSize: '0.64rem' }}>+ Bỏ lại</button>
            </div>}
          </div>
          <div style={{ padding: '6px 10px' }}>
            {/* Kiện gỗ xẻ */}
            {outputBundles.map(b => {
              const hasBoards = b.rawMeasurements?.boards?.length > 0;
              return (
                <div key={b.id} data-clickable={hasBoards ? "true" : undefined} onClick={hasBoards ? () => setBoardDetail(b) : undefined} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: '0.72rem', borderBottom: '1px solid var(--bd)', cursor: hasBoards ? 'pointer' : 'default' }}>
                  <span title={b.bundleCode} style={{ fontFamily: 'monospace', fontSize: '0.64rem', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.bundleCode}{hasBoards && <span style={{ marginLeft: 3, fontSize: '0.58rem' }}>📐</span>}</span>
                  <span style={{ fontSize: '0.64rem', color: 'var(--ts)' }}>{b.attributes?.quality || ''}</span>
                  <span style={{ fontSize: '0.64rem', color: 'var(--tm)' }}>{b.boardCount}t</span>
                  <span style={{ marginLeft: 'auto', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtNum(b.volume, 3)}</span>
                  {ce && session.status === 'Đang xếp' && <button onClick={e => { e.stopPropagation(); handleRemoveBundle(b); }} style={{ background: 'none', border: 'none', color: 'var(--dg)', cursor: 'pointer', fontSize: '0.6rem', fontWeight: 600, marginLeft: 4 }}>Gỡ</button>}
                </div>
              );
            })}
            {/* Kiện bỏ lại */}
            {outputLeftovers.map(l => (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: '0.72rem', borderBottom: '1px solid var(--bd)', color: 'var(--ac)' }}>
                <span title={l.leftoverCode} style={{ fontFamily: 'monospace', fontSize: '0.64rem', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>↺ {l.leftoverCode}</span>
                <span style={{ fontSize: '0.64rem' }}>{l.quality || ''}</span>
                <span style={{ marginLeft: 'auto', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtNum(l.volumeM3, 3)}</span>
                {ce && session.status === 'Đang xếp' && <button onClick={() => handleDeleteLeftover(l.id)} style={{ background: 'none', border: 'none', color: 'var(--dg)', cursor: 'pointer', fontSize: '0.6rem', fontWeight: 600 }}>Xóa</button>}
              </div>
            ))}
            {!outputBundles.length && !outputLeftovers.length && <div style={{ padding: 10, textAlign: 'center', color: 'var(--tm)', fontSize: '0.72rem' }}>Chưa có</div>}
          </div>
          {/* Tổng đầu ra — cùng hàng với tổng đầu vào */}
          <div style={{ padding: '8px 12px', borderTop: '2px solid var(--bd)', display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.82rem' }}>
            <span>Tổng ra</span>
            <span style={{ fontFamily: 'monospace' }}>{fmtNum(totalOutM3, 3)} m³</span>
          </div>
        </div>
      </div>

      {/* Chênh lệch */}
      <div style={{ ...panelS, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: diffLevel === 'ok' ? 'var(--gn)' : diffLevel === 'warn' ? '#D4A017' : 'var(--dg)' }}>
          {diffLevel === 'ok' ? '✅' : diffLevel === 'warn' ? '⚠' : '❌'} Chênh lệch: {fmtNum(Math.abs(diffM3), 3)} m³ ({fmtNum(diffPct, 1)}%)
          <span style={{ fontWeight: 400, color: 'var(--tm)', marginLeft: 8, fontSize: '0.7rem' }}>{fmtNum(totalInputM3, 3)} vào — {fmtNum(totalOutM3, 3)} ra</span>
        </span>
        {ce && session.status === 'Đang xếp' && <button onClick={handleComplete} style={btnP}>Hoàn thành mẻ xếp</button>}
        {ce && session.status === 'Hoàn thành' && <button onClick={handleReopen} style={btnSec}>Mở lại mẻ xếp</button>}
      </div>

      {/* Dialog thêm đầu vào */}
      {showAddInput && (
        <Dialog open={true} onClose={() => setShowAddInput(false)} title="Thêm đầu vào" width={480} maxHeight="80vh" noEnter>
          <div style={{ fontSize: '0.72rem', color: 'var(--tm)', marginBottom: 12 }}>{wtMap[session.woodTypeId]?.icon} {wtMap[session.woodTypeId]?.name} · {fmtNum(session.thicknessCm, 1)}cm — chỉ hiện kiện cùng loại + dày</div>
          {availableForInput.unsorted.length === 0 && availableForInput.leftovers.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--tm)', fontSize: '0.76rem' }}>Không có kiện chưa xếp cùng loại + dày</div>
          ) : (
            <div>
              {availableForInput.unsorted.map(u => (
                <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--bd)', cursor: 'pointer', fontSize: '0.74rem' }}>
                  <input type="checkbox" checked={addInputSel.has(u.id)} onChange={() => setAddInputSel(p => { const n = new Set(p); n.has(u.id) ? n.delete(u.id) : n.add(u.id); return n; })} />
                  <span style={{ fontFamily: 'monospace', fontSize: '0.66rem' }}>{u.bundleCode}</span>
                  <span style={{ marginLeft: 'auto', fontWeight: 600 }}>{fmtNum(u.volumeM3, 3)} m³</span>
                </label>
              ))}
              {availableForInput.leftovers.map(l => (
                <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--bd)', cursor: 'pointer', fontSize: '0.74rem', color: 'var(--ac)' }}>
                  <input type="checkbox" checked={addInputSel.has('lf_' + l.id)} onChange={() => setAddInputSel(p => { const n = new Set(p); const k = 'lf_' + l.id; n.has(k) ? n.delete(k) : n.add(k); return n; })} />
                  <span style={{ fontFamily: 'monospace', fontSize: '0.66rem' }}>↺ {l.leftoverCode}</span>
                  <span style={{ fontSize: '0.66rem' }}>{l.quality || ''}</span>
                  <span style={{ marginLeft: 'auto', fontWeight: 600 }}>{fmtNum(l.volumeM3, 3)} m³</span>
                </label>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
            <button onClick={() => setShowAddInput(false)} style={btnSec}>Hủy</button>
            <button onClick={handleAddInputs} disabled={!addInputSel.size} style={{ ...btnP, opacity: addInputSel.size ? 1 : 0.5 }}>Thêm {addInputSel.size > 0 ? `(${addInputSel.size})` : ''}</button>
          </div>
        </Dialog>
      )}

      {/* Dialog chọn kiện từ app đo */}
      {showAssignMeasure && (
        <Dialog open={true} onClose={() => setShowAssignMeasure(false)} title="Chọn kiện đo để gán" width={600} noEnter>
          <div style={{ fontSize: '0.72rem', color: 'var(--tm)', marginBottom: 8 }}>{wtMap[session.woodTypeId]?.icon} {wtMap[session.woodTypeId]?.name} · {fmtNum(session.thicknessCm, 1)}cm · còn thêm được {fmtNum(canAddMoreM3, 3)} m³</div>
          <MeasurementList measurements={pendingMeasurements} onAssign={handlePickMeasure} onView={setBoardDetail} saving={false} emptyText="Không có kiện đo nào chờ gán" />
        </Dialog>
      )}
      {/* Dialog review trước khi gán */}
      {reviewMeasurement && (
        <ReviewMeasurementDialog
          measurement={reviewMeasurement}
          session={session}
          wts={wts}
          cfg={cfg}
          canAddMoreM3={canAddMoreM3}
          onConfirm={handleConfirmAssign}
          onClose={() => setReviewMeasurement(null)}
          saving={savingMeasure}
          notify={notify}
        />
      )}
      {/* Dialog thêm kiện gỗ xẻ (nhập tay) */}
      {showAddBundle && (
        <Dialog open={true} onClose={() => { setShowAddBundle(false); resetBf(); }} title="Thêm kiện đã xếp" width={560} noEnter>
          <div style={{ fontSize: '0.72rem', color: 'var(--tm)', marginBottom: 12 }}>{wtMap[session.woodTypeId]?.icon} {wtMap[session.woodTypeId]?.name} · {fmtNum(session.thicknessCm, 1)}cm</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <div style={{ flex: '1 0 130px' }}>
              <label style={{ display: 'block', fontSize: '0.64rem', fontWeight: 700, color: 'var(--brl)', marginBottom: 2 }}>Mã kiện *</label>
              <input value={bf.bundleCode} onChange={e => checkBfCode(e.target.value)} disabled={bfCodeLoading}
                style={{ ...inpS, borderColor: bfCodeDup ? 'var(--dg)' : bf.bundleCode.trim() && !bfCodeLoading ? 'var(--gn)' : 'var(--bd)' }} />
              {bfCodeDup && <div style={{ fontSize: '0.58rem', color: 'var(--dg)', marginTop: 1 }}>Mã đã tồn tại</div>}
              {bfCodeLoading && <div style={{ fontSize: '0.58rem', color: 'var(--tm)', marginTop: 1 }}>Đang tạo mã...</div>}
            </div>
            <div style={{ flex: '0 0 100px' }}>
              <label style={{ display: 'block', fontSize: '0.64rem', fontWeight: 700, color: 'var(--brl)', marginBottom: 2 }}>Chất lượng *</label>
              <select value={bf.quality} onChange={e => setBf(p => ({ ...p, quality: e.target.value }))} style={inpS}>
                <option value="">— Chọn —</option>{qualities.map(q => <option key={q} value={q}>{q}</option>)}
              </select>
            </div>
            {widthValues.length > 0 && <div style={{ flex: '0 0 80px' }}>
              <label style={{ display: 'block', fontSize: '0.64rem', fontWeight: 700, color: 'var(--brl)', marginBottom: 2 }}>Rộng</label>
              <select value={bf.width} onChange={e => setBf(p => ({ ...p, width: e.target.value }))} style={inpS}>
                <option value="">—</option>{widthValues.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>}
            <div style={{ flex: '0 0 100px' }}>
              <label style={{ display: 'block', fontSize: '0.64rem', fontWeight: 700, color: 'var(--brl)', marginBottom: 2 }}>Dài</label>
              <input value={bf.length} onChange={e => setBf(p => ({ ...p, length: e.target.value }))} placeholder="2.5 hoặc 1.6-1.9" style={inpS} />
            </div>
            <div style={{ flex: '0 0 70px' }}>
              <label style={{ display: 'block', fontSize: '0.64rem', fontWeight: 700, color: 'var(--brl)', marginBottom: 2 }}>Số tấm *</label>
              <input type="number" value={bf.boardCount} onChange={e => setBf(p => ({ ...p, boardCount: e.target.value }))} style={inpS} />
            </div>
            <div style={{ flex: '0 0 80px' }}>
              <label style={{ display: 'block', fontSize: '0.64rem', fontWeight: 700, color: 'var(--brl)', marginBottom: 2 }}>m³ *</label>
              <input type="number" step="0.001" value={bf.volume} onChange={e => setBf(p => ({ ...p, volume: e.target.value }))} style={inpS} />
            </div>
            <div style={{ flex: '0 0 80px' }}>
              <label style={{ display: 'block', fontSize: '0.64rem', fontWeight: 700, color: 'var(--brl)', marginBottom: 2 }}>Vị trí</label>
              <input value={bf.location} onChange={e => setBf(p => ({ ...p, location: e.target.value }))} style={inpS} />
            </div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', fontSize: '0.64rem', fontWeight: 700, color: 'var(--brl)', marginBottom: 2 }}>Ghi chú</label>
            <input value={bf.notes} onChange={e => setBf(p => ({ ...p, notes: e.target.value }))} style={inpS} />
          </div>
          {/* Chi tiết tấm */}
          <BoardsInput thickness={session.thicknessCm} boards={bfBoards}
            onBoardsChange={(boards, stats) => {
              setBfBoards(boards);
              if (stats) setBf(p => ({ ...p, boardCount: String(stats.count), volume: String(stats.volume) }));
            }} />
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <ImgUpload label="Ảnh kiện" images={bfImages} setImages={setBfImages} />
            <ImgUpload label="Ảnh chi tiết" images={bfItemImages} setImages={setBfItemImages} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => { setShowAddBundle(false); resetBf(); }} style={btnSec}>Hủy</button>
            <button onClick={handleAddBundle} disabled={savingBundle} style={{ ...btnP, opacity: savingBundle ? 0.5 : 1 }}>Lưu kiện</button>
          </div>
        </Dialog>
      )}

      {/* Dialog thêm kiện bỏ lại */}
      {addingLeftover && (
        <Dialog open={true} onClose={() => setAddingLeftover(false)} onOk={() => { if (!savingLeftover) handleAddLeftover(); }} title="Thêm kiện bỏ lại" width={400}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.66rem', fontWeight: 700, color: 'var(--brl)', marginBottom: 2 }}>Chất lượng</label>
              <select value={lf.quality} onChange={e => setLf(p => ({ ...p, quality: e.target.value }))} style={inpS} autoFocus><option value="">—</option>{qualities.map(q => <option key={q} value={q}>{q}</option>)}</select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.66rem', fontWeight: 700, color: 'var(--brl)', marginBottom: 2 }}>m³ *</label>
              <input type="number" step="0.001" value={lf.volumeM3} onChange={e => setLf(p => ({ ...p, volumeM3: e.target.value }))} style={inpS} placeholder="m³" />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: '0.66rem', fontWeight: 700, color: 'var(--brl)', marginBottom: 2 }}>Ghi chú</label>
            <input value={lf.notes} onChange={e => setLf(p => ({ ...p, notes: e.target.value }))} style={inpS} placeholder="Ghi chú" />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setAddingLeftover(false)} style={btnSec}>Hủy</button>
            <button onClick={handleAddLeftover} disabled={savingLeftover} style={{ ...btnP, opacity: savingLeftover ? 0.4 : 1 }}>Lưu</button>
          </div>
        </Dialog>
      )}

      {boardDetail && <BoardDetailDialog data={boardDetail} onClose={() => setBoardDetail(null)} defaultLayout="matrix" wts={wts} notify={notify} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB 4: LỊCH SỬ
// ══════════════════════════════════════════════════════════════
function HistoryTab({ batches, allItems, unsorted, wts, isAdmin, useAPI, notify, onRefresh }) {
  const [filterKiln, setFilterKiln] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterWood, setFilterWood] = useState('');
  const [filterThick, setFilterThick] = useState('');
  const [filterOwner, setFilterOwner] = useState('');
  const [filterEntryFrom, setFilterEntryFrom] = useState('');
  const [filterEntryTo, setFilterEntryTo] = useState('');
  const [filterExitFrom, setFilterExitFrom] = useState('');
  const [filterItemCode, setFilterItemCode] = useState('');
  const [filterExitTo, setFilterExitTo] = useState('');
  const wtMap = useMemo(() => Object.fromEntries(wts.map(w => [w.id, w])), [wts]);

  // Danh sách unique cho filters
  const allWoodIds = useMemo(() => [...new Set(allItems.map(it => it.woodTypeId))].filter(Boolean), [allItems]);
  const allThick = useMemo(() => [...new Set(allItems.map(it => String(it.thicknessCm)))].sort((a, b) => parseFloat(a) - parseFloat(b)), [allItems]);
  const allOwners = useMemo(() => [...new Set(allItems.map(it => it.ownerType === 'company' ? 'company' : it.ownerName).filter(Boolean))], [allItems]);

  const sorted = useMemo(() => {
    let r = batches;
    if (filterKiln) r = r.filter(b => String(b.kilnNumber) === filterKiln);
    if (filterStatus) r = r.filter(b => b.status === filterStatus);
    if (filterEntryFrom) r = r.filter(b => b.entryDate >= filterEntryFrom);
    if (filterEntryTo) r = r.filter(b => b.entryDate <= filterEntryTo);
    if (filterExitFrom) r = r.filter(b => (b.actualExitDate || b.expectedExitDate || '') >= filterExitFrom);
    if (filterExitTo) r = r.filter(b => (b.actualExitDate || b.expectedExitDate || '') <= filterExitTo);
    if (filterWood || filterThick || filterOwner) {
      r = r.filter(b => allItems.some(it => {
        if (it.batchId !== b.id) return false;
        if (filterWood && it.woodTypeId !== filterWood) return false;
        if (filterThick && String(it.thicknessCm) !== filterThick) return false;
        if (filterOwner) { const ov = it.ownerType === 'company' ? 'company' : it.ownerName; if (ov !== filterOwner) return false; }
        return true;
      }));
    }
    return [...r].sort((a, b) => (b.entryDate || '').localeCompare(a.entryDate || ''));
  }, [batches, allItems, filterKiln, filterStatus, filterWood, filterThick, filterOwner, filterEntryFrom, filterEntryTo, filterExitFrom, filterExitTo]);

  // Flatten: mỗi batch → nhiều rows, cột lò merge theo rowSpan
  const rows = useMemo(() => {
    const result = [];
    sorted.forEach(b => {
      let items = allItems.filter(it => it.batchId === b.id);
      // Filter items nếu có item-level filter
      if (filterWood) items = items.filter(it => it.woodTypeId === filterWood);
      if (filterThick) items = items.filter(it => String(it.thicknessCm) === filterThick);
      if (filterOwner) items = items.filter(it => (it.ownerType === 'company' ? 'company' : it.ownerName) === filterOwner);
      if (filterItemCode) items = items.filter(it => (it.itemCode || '').toLowerCase().includes(filterItemCode.toLowerCase()));
      const totalDays = daysBetween(b.entryDate, b.actualExitDate || b.expectedExitDate);
      const sc = statusColor(b.status);
      const rowCount = Math.max(items.length, 1);
      items.forEach((it, idx) => {
        const ubs = unsorted.filter(u => u.kilnItemId === it.id);
        const ubStatus = ubs.length > 0 ? (ubs.every(u => u.status === 'Đã xếp') ? 'Đã xếp' : `${ubs.filter(u => u.status === 'Chưa xếp').length} chưa xếp`) : 'chưa tách';
        result.push({ batch: b, item: it, isFirst: idx === 0, rowSpan: rowCount, sc, totalDays, ubs, ubStatus });
      });
      if (!items.length) result.push({ batch: b, item: null, isFirst: true, rowSpan: 1, sc, totalDays, ubs: [], ubStatus: '' });
    });
    return result;
  }, [sorted, allItems, unsorted, filterWood, filterThick, filterOwner]);

  const handleDeleteBatch = async (b) => {
    const items = allItems.filter(it => it.batchId === b.id);
    const ubCount = unsorted.filter(u => items.some(it => it.id === u.kilnItemId)).length;
    const msg = `Xóa mẻ sấy ${b.batchCode} (Lò ${b.kilnNumber})?\n\n` +
      `${items.length} mã gỗ sấy` + (ubCount ? ` + ${ubCount} kiện đã tách` : '') +
      ` sẽ bị xóa.\nThao tác không thể hoàn tác.`;
    if (!window.confirm(msg)) return;
    if (useAPI) {
      const api = await import('../api.js');
      // Xóa unsorted bundles liên quan
      const ubIds = unsorted.filter(u => items.some(it => it.id === u.kilnItemId)).map(u => u.id);
      for (const id of ubIds) await api.deleteUnsortedBundle(id);
      // Xóa batch (cascade xóa kiln_items)
      await api.deleteKilnBatch(b.id);
      notify(`Đã xóa mẻ ${b.batchCode}`);
    }
    onRefresh();
  };

  return (
    <div style={panelS}>
      <div style={panelHead}>
        <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>Lịch sử mẻ sấy ({sorted.length})</span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--bgs)' }}>
            <td style={{ padding: '5px 4px' }}><ComboFilter value={filterKiln} onChange={v => setFilterKiln(v)} options={Array.from({ length: KILN_COUNT }, (_, i) => String(i + 1))} placeholder="Lò" /></td>
            <td style={{ padding: '5px 4px' }}><input type="date" value={filterEntryFrom} onChange={e => setFilterEntryFrom(e.target.value)} style={{ ...inpS, fontSize: '0.76rem', padding: '4px 8px', width: '100%' }} title="Vào từ" /></td>
            <td style={{ padding: '5px 4px' }}><input type="date" value={filterExitFrom} onChange={e => setFilterExitFrom(e.target.value)} style={{ ...inpS, fontSize: '0.76rem', padding: '4px 8px', width: '100%' }} title="Ra từ" /></td>
            <td style={{ padding: '5px 4px' }} />
            <td style={{ padding: '5px 4px' }}><ComboFilter value={filterStatus} onChange={v => setFilterStatus(v)} options={BATCH_STATUSES} placeholder="TT" /></td>
            <td style={{ padding: '5px 4px', borderLeft: '2px solid var(--bd)' }}><ComboFilter value={filterItemCode || ''} onChange={v => setFilterItemCode(v)} options={[...new Set(rows.map(r => r.item?.itemCode).filter(Boolean))]} placeholder="Mã" /></td>
            <td style={{ padding: '5px 4px' }}><ComboFilter value={filterWood ? (wtMap[filterWood]?.name || filterWood) : ''} onChange={v => { const w = Object.entries(wtMap).find(([, x]) => x.name === v); setFilterWood(w ? w[0] : ''); }} options={allWoodIds.map(id => wtMap[id]?.name || id)} placeholder="Loại gỗ" /></td>
            <td style={{ padding: '5px 4px' }}><ComboFilter value={filterThick} onChange={v => setFilterThick(v)} options={allThick} placeholder="Dày" strict /></td>
            <td style={{ padding: '5px 4px' }}><ComboFilter value={filterOwner} onChange={v => setFilterOwner(v)} options={['Cty', ...allOwners.filter(o => o !== 'company')]} placeholder="Đơn vị" /></td>
            <td style={{ padding: '5px 4px' }} />
            <td style={{ padding: '5px 4px' }} />
            {isAdmin && <td style={{ padding: '5px 4px' }} />}
          </tr>
          <tr>
            <th style={thS}>Lò</th><th style={thS}>Vào</th><th style={thS}>Ra</th><th style={thS}>Ngày</th><th style={thS}>TT</th>
            <th style={{ ...thS, borderLeft: '2px solid var(--bd)' }}>Mã gỗ sấy</th><th style={thS}>Loại gỗ</th><th style={{ ...thS, textAlign: 'right' }}>Dày</th><th style={thS}>Đơn vị</th><th style={{ ...thS, textAlign: 'right' }}>m³</th><th style={thS}>Tách</th>
            {isAdmin && <th style={{ ...thS, width: 30 }}></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => {
            const { batch: b, item: it, isFirst, rowSpan, sc, totalDays, ubs, ubStatus } = r;
            return (
              <tr key={ri} style={{ background: isFirst && ri > 0 ? undefined : undefined, borderTop: isFirst ? '2px solid var(--bd)' : undefined }}>
                {isFirst && <>
                  <td rowSpan={rowSpan} style={{ ...tdS, verticalAlign: 'middle', fontWeight: 700, whiteSpace: 'nowrap' }}>Lò {b.kilnNumber}</td>
                  <td rowSpan={rowSpan} style={{ ...tdS, verticalAlign: 'middle', whiteSpace: 'nowrap' }}>{fmtDate(b.entryDate)}</td>
                  <td rowSpan={rowSpan} style={{ ...tdS, verticalAlign: 'middle', whiteSpace: 'nowrap' }}>{fmtDate(b.actualExitDate || b.expectedExitDate)}</td>
                  <td rowSpan={rowSpan} style={{ ...tdS, verticalAlign: 'middle', whiteSpace: 'nowrap' }}>{totalDays != null ? `${totalDays}` : '—'}</td>
                  <td rowSpan={rowSpan} style={{ ...tdS, verticalAlign: 'middle' }}><span style={badge(sc)}>{b.status}</span></td>
                </>}
                {/* (item cells below) */}
                {it ? <>
                  <td style={{ ...tdS, fontFamily: 'monospace', fontSize: '0.66rem', whiteSpace: 'nowrap', borderLeft: '2px solid var(--bd)' }}>{it.itemCode}</td>
                  <td style={{ ...tdS, whiteSpace: 'nowrap' }}>{wtMap[it.woodTypeId]?.name || '—'}</td>
                  <td style={{ ...tdS, textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtNum(it.thicknessCm, 1)}</td>
                  <td style={{ ...tdS, whiteSpace: 'nowrap' }}>{it.ownerType === 'company' ? <span style={{ color: 'var(--gn)', fontWeight: 600 }}>Cty</span> : it.ownerName}</td>
                  <td style={{ ...tdS, textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtNum(it.volumeM3, 3)}</td>
                  <td style={{ ...tdS, fontSize: '0.64rem', color: 'var(--tm)', whiteSpace: 'nowrap' }}>{ubs.length > 0 ? `${ubs.length} KCX · ${ubStatus}` : ubStatus}</td>
                  {isAdmin && isFirst && <td rowSpan={rowSpan} style={{ ...tdS, verticalAlign: 'middle' }}>
                    <button onClick={() => handleDeleteBatch(b)} style={{ background: 'none', border: 'none', color: 'var(--dg)', cursor: 'pointer', fontSize: '0.6rem', fontWeight: 600 }}>Xóa</button>
                  </td>}
                </> : <>
                  <td colSpan={6} style={{ ...tdS, color: 'var(--tm)', fontSize: '0.72rem', borderLeft: '2px solid var(--bd)' }}>Chưa có mã gỗ</td>
                  {isAdmin && <td style={tdS}><button onClick={() => handleDeleteBatch(b)} style={{ background: 'none', border: 'none', color: 'var(--dg)', cursor: 'pointer', fontSize: '0.6rem', fontWeight: 600 }}>Xóa</button></td>}
                </>}
              </tr>
            );
          })}
          {!rows.length && <tr><td colSpan={isAdmin ? 12 : 11} style={{ ...tdS, textAlign: 'center', color: 'var(--tm)', padding: 20 }}>Chưa có lịch sử</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB: THỐNG KÊ SẤY
// ══════════════════════════════════════════════════════════════
function StatsTab({ batches, allItems, wts, kilnSettings, setKilnSettings, ce, useAPI, notify }) {
  const wtMap = useMemo(() => Object.fromEntries(wts.map(w => [w.id, w])), [wts]);
  const dryingPrice = parseFloat(kilnSettings.drying_price) || 70000;
  const [editPrice, setEditPrice] = useState(false);
  const [priceVal, setPriceVal] = useState(String(dryingPrice));

  // Date range — mặc định 3 tháng gần nhất
  const today = new Date().toISOString().slice(0, 10);
  const d3m = new Date(); d3m.setMonth(d3m.getMonth() - 3);
  const [fromDate, setFromDate] = useState(d3m.toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(today);
  const [ownerFilter, setOwnerFilter] = useState('');

  const handleSavePrice = async () => {
    const v = parseFloat(priceVal);
    if (!v || v <= 0) { notify('Giá phải là số dương', false); return; }
    if (useAPI) {
      const api = await import('../api.js');
      await api.saveKilnSetting('drying_price', String(v));
      setKilnSettings(p => ({ ...p, drying_price: String(v) }));
      notify('Đã lưu giá sấy');
    }
    setEditPrice(false);
  };

  // Tính thống kê
  const stats = useMemo(() => {
    const bMap = Object.fromEntries(batches.map(b => [b.id, b]));
    const items = allItems.filter(it => {
      const b = bMap[it.batchId];
      if (!b?.entryDate) return false;
      if (b.entryDate < fromDate || b.entryDate > toDate) return false;
      if (ownerFilter === 'company' && it.ownerType !== 'company') return false;
      if (ownerFilter === 'customer' && it.ownerType !== 'customer') return false;
      return true;
    }).map(it => {
      const b = bMap[it.batchId];
      const days = b.entryDate && (b.actualExitDate || b.expectedExitDate)
        ? Math.max(1, Math.round((new Date(b.actualExitDate || b.expectedExitDate) - new Date(b.entryDate)) / 86400000))
        : 0;
      return { ...it, days };
    });

    // Group by wood type
    const groups = {};
    items.forEach(it => {
      const key = it.woodTypeId;
      if (!groups[key]) groups[key] = { woodTypeId: key, kg: 0, m3: 0, cost: 0 };
      groups[key].kg += (it.weightKg || 0);
      groups[key].m3 += (it.volumeM3 || 0);
      groups[key].cost += (it.volumeM3 || 0) * dryingPrice * (it.days || 0);
    });

    const list = Object.values(groups).sort((a, b) => {
      const na = wtMap[a.woodTypeId]?.name || '';
      const nb = wtMap[b.woodTypeId]?.name || '';
      return na.localeCompare(nb);
    });
    const totalKg = list.reduce((s, g) => s + g.kg, 0);
    const totalM3 = list.reduce((s, g) => s + g.m3, 0);
    const totalCost = list.reduce((s, g) => s + g.cost, 0);
    return { list, totalKg, totalM3, totalCost };
  }, [allItems, batches, fromDate, toDate, ownerFilter, dryingPrice, wtMap]);

  return (
    <div style={panelS}>
      <div style={panelHead}>
        <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>Thống kê sấy gỗ</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--tm)' }}>Giá sấy (đ/m³/ngày):</span>
          {editPrice
            ? <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input type="number" value={priceVal} onChange={e => setPriceVal(e.target.value)} style={{ ...inpS, width: 90, textAlign: 'right' }} />
              <button onClick={handleSavePrice} style={{ background: 'none', border: 'none', color: 'var(--gn)', cursor: 'pointer', fontWeight: 700 }}>✓</button>
              <button onClick={() => setEditPrice(false)} style={{ background: 'none', border: 'none', color: 'var(--tm)', cursor: 'pointer' }}>✕</button>
            </div>
            : <span style={{ fontWeight: 700, fontSize: '0.82rem', cursor: ce ? 'pointer' : 'default' }} onClick={() => ce && setEditPrice(true)}>{fmtNum(dryingPrice, 0)} đ{ce && <span style={{ fontSize: '0.6rem', color: 'var(--ac)', marginLeft: 4 }}>sửa</span>}</span>}
        </div>
      </div>

      {/* Filters */}
      <div style={{ padding: '10px 14px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid var(--bd)' }}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <label style={{ fontSize: '0.68rem', color: 'var(--brl)', fontWeight: 700 }}>Từ</label>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ ...inpS, width: 130 }} />
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <label style={{ fontSize: '0.68rem', color: 'var(--brl)', fontWeight: 700 }}>Đến</label>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ ...inpS, width: 130 }} />
        </div>
        <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)} style={{ ...inpS, width: 120 }}>
          <option value="">Tất cả</option>
          <option value="company">Công ty</option>
          <option value="customer">Khách</option>
        </select>
      </div>

      {/* Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>
          <th style={thS}>Loại gỗ</th>
          <th style={{ ...thS, textAlign: 'right' }}>Trọng lượng (Kg)</th>
          <th style={{ ...thS, textAlign: 'right' }}>KL (m³)</th>
          <th style={{ ...thS, textAlign: 'right' }}>Thành tiền (đ)</th>
        </tr></thead>
        <tbody>
          {stats.list.map(g => {
            const wt = wtMap[g.woodTypeId];
            return (
              <tr key={g.woodTypeId}>
                <td style={tdS}>{wt?.icon} {wt?.name || '—'}</td>
                <td style={{ ...tdS, textAlign: 'right', fontFamily: 'monospace' }}>{fmtNum(g.kg, 0)}</td>
                <td style={{ ...tdS, textAlign: 'right', fontFamily: 'monospace' }}>{fmtNum(g.m3, 2)}</td>
                <td style={{ ...tdS, textAlign: 'right', fontFamily: 'monospace' }}>{fmtNum(g.cost, 0)}</td>
              </tr>
            );
          })}
          {!stats.list.length && <tr><td colSpan={4} style={{ ...tdS, textAlign: 'center', color: 'var(--tm)', padding: 20 }}>Không có dữ liệu trong khoảng thời gian</td></tr>}
        </tbody>
        {stats.list.length > 0 && <tfoot>
          <tr style={{ borderTop: '2px solid var(--tp)' }}>
            <td style={{ ...tdS, fontWeight: 800, fontSize: '0.82rem' }}>TỔNG</td>
            <td style={{ ...tdS, textAlign: 'right', fontWeight: 800, fontFamily: 'monospace' }}>{fmtNum(stats.totalKg, 0)}</td>
            <td style={{ ...tdS, textAlign: 'right', fontWeight: 800, fontFamily: 'monospace' }}>{fmtNum(stats.totalM3, 2)}</td>
            <td style={{ ...tdS, textAlign: 'right', fontWeight: 800, fontFamily: 'monospace' }}>{fmtNum(stats.totalCost, 0)}</td>
          </tr>
        </tfoot>}
      </table>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB 5: BẢNG QUY ĐỔI (giữ nguyên từ v1)
// ══════════════════════════════════════════════════════════════
function ConversionTab({ conversionRates, setConversionRates, kilnWts, useAPI, notify, ce, onRefresh }) {
  const [editing, setEditing] = useState(null);
  const [woodIdVal, setWoodIdVal] = useState('');
  const [rateVal, setRateVal] = useState('');
  const [thickVal, setThickVal] = useState('');
  const [notesVal, setNotesVal] = useState('');
  const [saving, setSaving] = useState(false);
  const wtMap = useMemo(() => Object.fromEntries(kilnWts.map(w => [w.id, w])), [kilnWts]);

  const startEdit = (cr) => { if (String(cr.id).startsWith('tmp_')) return; setEditing(cr.id); setWoodIdVal(cr.woodTypeId || ''); setRateVal(String(cr.rate)); setThickVal(cr.thicknessMin || ''); setNotesVal(cr.notes || ''); };
  const startNew = () => { setEditing('new'); setWoodIdVal(''); setRateVal(''); setThickVal(''); setNotesVal(''); };
  const cancel = () => setEditing(null);

  const save = async () => {
    if (!woodIdVal) { notify('Chọn loại gỗ', false); return; }
    const rate = parseFloat(rateVal);
    if (!rate || rate <= 0) { notify('Hệ số phải là số dương', false); return; }
    const wt = wtMap[woodIdVal];
    const name = wt?.name || woodIdVal;
    setSaving(true); setEditing(null);
    if (useAPI) {
      const api = await import('../api.js');
      if (editing === 'new') {
        const r = await api.addConversionRate(woodIdVal, name + (thickVal.trim() ? ` (≥${thickVal.trim()}cm)` : ''), rate, thickVal.trim(), notesVal.trim());
        if (r?.error) notify('Lỗi: ' + r.error, false); else notify('Đã thêm');
      } else {
        const r = await api.updateConversionRate(editing, woodIdVal, name + (thickVal.trim() ? ` (≥${thickVal.trim()}cm)` : ''), rate, thickVal.trim(), notesVal.trim());
        if (r?.error) notify('Lỗi: ' + r.error, false); else notify('Đã cập nhật');
      }
      const freshRates = await api.fetchConversionRates();
      const recalc = await api.recalcKilnItemVolumes(freshRates);
      if (recalc.updated > 0) notify(`Đã cập nhật m³ cho ${recalc.updated} mã gỗ trong lò`);
      onRefresh();
    }
    setSaving(false);
  };

  const handleDelete = async (cr) => {
    if (String(cr.id).startsWith('tmp_')) return;
    if (!window.confirm(`Xóa "${cr.name}"?`)) return;
    if (useAPI) { const api = await import('../api.js'); await api.deleteConversionRate(cr.id); notify('Đã xóa'); onRefresh(); }
  };

  const woodSelect = (val, onChange) => (
    <select value={val} onChange={e => onChange(e.target.value)} style={{ ...inpS, width: 130 }}>
      <option value="">— Chọn gỗ —</option>
      {kilnWts.map(w => <option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
    </select>
  );

  return (
    <div style={{ ...panelS, maxWidth: 650 }}>
      <div style={{ ...panelHead }}>
        <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>Bảng quy đổi kg/m³</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--tm)' }}>m³ = kg ÷ hệ số</span>
          {ce && !editing && !saving && <button onClick={startNew} style={{ ...btnP, padding: '3px 10px', fontSize: '0.7rem' }}>+ Thêm</button>}
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>
          <th style={thS}>Loại gỗ</th><th style={thS}>Dày tối thiểu</th><th style={{ ...thS, textAlign: 'right' }}>Hệ số (kg/m³)</th><th style={thS}>Ghi chú</th>
          {ce && <th style={{ ...thS, width: 70 }}></th>}
        </tr></thead>
        <tbody>
          {conversionRates.map(cr => {
            const isEd = editing === cr.id;
            const wt = wtMap[cr.woodTypeId];
            return (
              <tr key={cr.id} style={{ background: isEd ? 'var(--acbg)' : undefined }}>
                <td style={tdS}>{isEd ? woodSelect(woodIdVal, setWoodIdVal) : <strong>{wt ? `${wt.icon} ${wt.name}` : cr.name}</strong>}</td>
                <td style={{ ...tdS, color: cr.thicknessMin ? 'var(--ac)' : 'var(--tm)', fontSize: '0.7rem' }}>{isEd ? <input value={thickVal} onChange={e => setThickVal(e.target.value)} placeholder="cm" style={{ ...inpS, width: 60 }} /> : (cr.thicknessMin ? `≥ ${cr.thicknessMin}cm` : '—')}</td>
                <td style={{ ...tdS, textAlign: 'right', fontWeight: 600, fontFamily: 'monospace' }}>{isEd ? <input type="number" step="1" value={rateVal} onChange={e => setRateVal(e.target.value)} style={{ ...inpS, width: 80, textAlign: 'right' }} /> : fmtNum(cr.rate, 0)}</td>
                <td style={{ ...tdS, fontSize: '0.7rem', color: 'var(--tm)' }}>{isEd ? <input value={notesVal} onChange={e => setNotesVal(e.target.value)} style={{ ...inpS, width: 100 }} /> : (cr.notes || '')}</td>
                {ce && <td style={{ ...tdS, textAlign: 'center', whiteSpace: 'nowrap' }}>
                  {isEd ? <><button onClick={save} style={{ background: 'none', border: 'none', color: 'var(--gn)', cursor: 'pointer', fontWeight: 700 }}>✓</button><button onClick={cancel} style={{ background: 'none', border: 'none', color: 'var(--tm)', cursor: 'pointer', marginLeft: 4 }}>✕</button></> : <><button onClick={() => startEdit(cr)} style={{ background: 'none', border: 'none', color: 'var(--brl)', cursor: 'pointer', fontSize: '0.7rem' }}>sửa</button><button onClick={() => handleDelete(cr)} style={{ background: 'none', border: 'none', color: 'var(--dg)', cursor: 'pointer', fontSize: '0.7rem', marginLeft: 4 }}>xóa</button></>}
                </td>}
              </tr>
            );
          })}
          {editing === 'new' && (
            <tr style={{ background: 'var(--acbg)' }}>
              <td style={tdS}>{woodSelect(woodIdVal, setWoodIdVal)}</td>
              <td style={tdS}><input value={thickVal} onChange={e => setThickVal(e.target.value)} placeholder="cm" style={{ ...inpS, width: 60 }} /></td>
              <td style={{ ...tdS, textAlign: 'right' }}><input type="number" step="1" value={rateVal} onChange={e => setRateVal(e.target.value)} placeholder="kg/m³" style={{ ...inpS, width: 80, textAlign: 'right' }} /></td>
              <td style={tdS}><input value={notesVal} onChange={e => setNotesVal(e.target.value)} placeholder="Ghi chú" style={{ ...inpS, width: 100 }} /></td>
              {ce && <td style={{ ...tdS, textAlign: 'center' }}><button onClick={save} style={{ background: 'none', border: 'none', color: 'var(--gn)', cursor: 'pointer', fontWeight: 700 }}>✓</button><button onClick={cancel} style={{ background: 'none', border: 'none', color: 'var(--tm)', cursor: 'pointer', marginLeft: 4 }}>✕</button></td>}
            </tr>
          )}
          {!conversionRates.length && editing !== 'new' && <tr><td colSpan={ce ? 5 : 4} style={{ ...tdS, textAlign: 'center', color: 'var(--tm)', padding: 12 }}>Chưa có</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN: PgKiln
// ══════════════════════════════════════════════════════════════
function PgKiln({ wts, ats, cfg, bundles, setBundles, ce, isAdmin, user, useAPI, notify, subPath = [], setSubPath }) {
  const validTabs = ['kilns', 'unsorted', 'packing', 'stats'];
  const [tab, setTabRaw] = useState(() => validTabs.includes(subPath[0]) ? subPath[0] : 'kilns');
  const setTab = (t) => { setTabRaw(t); setSubPath?.(t === 'kilns' ? [] : [t]); };
  const [batches, setBatches] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [unsorted, setUnsorted] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [leftovers, setLeftovers] = useState([]);
  const [conversionRates, setConversionRates] = useState([]);
  const [pendingMeasurements, setPendingMeasurements] = useState([]);
  const [kilnSettings, setKilnSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const kilnWts = useMemo(() => wts.filter(w => w.thicknessMode === 'auto'), [wts]);

  const loadMeasurements = useCallback(async () => {
    try {
      const api = await import('../api.js');
      const data = await api.fetchBundleMeasurements('whole_bundle');
      setPendingMeasurements(data);
    } catch (e) { /* silent */ }
  }, []);

  useEffect(() => { loadMeasurements(); }, [loadMeasurements]);

  useEffect(() => {
    let sub;
    import('../api.js').then(api => {
      sub = api.subscribeBundleMeasurements((payload) => {
        if (payload.new?.measurement_type === 'whole_bundle') loadMeasurements();
      });
    });
    return () => sub?.unsubscribe?.();
  }, [loadMeasurements]);

  const loadData = useCallback(async () => {
    if (!useAPI) { setLoading(false); return; }
    try {
      const api = await import('../api.js');
      const [b, i, u, s, l, cr, ks] = await Promise.all([
        api.fetchKilnBatches(), api.fetchAllKilnItems(), api.fetchUnsortedBundles(),
        api.fetchPackingSessions(), api.fetchPackingLeftovers(), api.fetchConversionRates(),
        api.fetchKilnSettings(),
      ]);
      setBatches(b); setAllItems(i); setUnsorted(u); setSessions(s); setLeftovers(l); setConversionRates(cr); setKilnSettings(ks);
    } catch (e) { notify('Lỗi tải dữ liệu lò sấy: ' + e.message, false); }
    setLoading(false);
  }, [useAPI, notify]);

  useEffect(() => { loadData(); }, [loadData]);

  // Count pool: unsorted chưa xếp + kiln items chưa tách (gỗ cty) từ lò đã ra
  const unsortedCount = useMemo(() => {
    const realCount = unsorted.filter(u => u.status === 'Chưa xếp').length;
    const splitItemIds = new Set(unsorted.map(u => u.kilnItemId));
    const activeBatchIds = new Set(batches.filter(b => b.status === 'Đang ra lò' || b.status === 'Đã ra hết').map(b => b.id));
    const unsplitCount = allItems.filter(it => activeBatchIds.has(it.batchId) && !splitItemIds.has(it.id) && it.ownerType === 'company').length;
    return realCount + unsplitCount;
  }, [unsorted, allItems, batches]);
  const activeSessionCount = useMemo(() => sessions.filter(s => s.status === 'Đang xếp').length, [sessions]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--tm)' }}>Đang tải dữ liệu lò sấy...</div>;

  const tabBtn = (id, label, badgeCount) => {
    const active = tab === id;
    return (
      <button key={id} style={{ padding: '8px 14px', borderRadius: '8px 8px 0 0', border: '1px solid var(--bd)', borderBottom: active ? '2px solid var(--bgc)' : '1px solid var(--bd)', background: active ? 'var(--bgc)' : 'var(--bgs)', color: active ? 'var(--tp)' : 'var(--ts)', fontWeight: active ? 700 : 500, fontSize: '0.76rem', cursor: 'pointer', marginBottom: -1, position: 'relative', zIndex: active ? 2 : 1, display: 'flex', alignItems: 'center', gap: 4 }}
        onClick={() => setTab(id)}>
        {label}
        {badgeCount > 0 && <span style={{ minWidth: 16, height: 16, borderRadius: 8, background: 'var(--ac)', color: '#fff', fontSize: '0.58rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{badgeCount}</span>}
      </button>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--bd)', flexWrap: 'wrap', marginBottom: 0 }}>
        {tabBtn('kilns', 'Lò sấy', 0)}
        {tabBtn('unsorted', 'Kiện chưa xếp', unsortedCount)}
        {tabBtn('packing', 'Mẻ xếp', activeSessionCount)}
        {tabBtn('stats', 'Thống kê', 0)}
        {tabBtn('history', 'Lịch sử', 0)}
        {tabBtn('conversion', 'Quy đổi', 0)}
      </div>
      <div style={{ paddingTop: 14 }}>
        {tab === 'kilns' && <KilnGrid batches={batches} allItems={allItems} unsorted={unsorted} wts={wts} conversionRates={conversionRates} ce={ce} isAdmin={isAdmin} user={user} useAPI={useAPI} notify={notify} onRefresh={loadData} />}
        {tab === 'unsorted' && <UnsortedTab unsorted={unsorted} leftovers={leftovers} batches={batches} allItems={allItems} sessions={sessions} wts={wts} ce={ce} useAPI={useAPI} notify={notify} onRefresh={loadData} />}
        {tab === 'packing' && <PackingTab sessions={sessions} unsorted={unsorted} leftovers={leftovers} bundles={bundles} setBundles={setBundles} wts={wts} ats={ats} cfg={cfg} ce={ce} useAPI={useAPI} notify={notify} onRefresh={loadData} pendingMeasurements={pendingMeasurements} />}
        {tab === 'stats' && <StatsTab batches={batches} allItems={allItems} wts={wts} kilnSettings={kilnSettings} setKilnSettings={setKilnSettings} ce={ce} useAPI={useAPI} notify={notify} />}
        {tab === 'history' && <HistoryTab batches={batches} allItems={allItems} unsorted={unsorted} wts={wts} isAdmin={isAdmin} useAPI={useAPI} notify={notify} onRefresh={loadData} />}
        {tab === 'conversion' && <ConversionTab conversionRates={conversionRates} setConversionRates={setConversionRates} kilnWts={kilnWts} useAPI={useAPI} notify={notify} ce={ce} onRefresh={loadData} />}
      </div>
    </div>
  );
}

export default React.memo(PgKiln);
