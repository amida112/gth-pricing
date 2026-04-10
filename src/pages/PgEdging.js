import React, { useState, useEffect, useMemo, useCallback } from "react";
import Dialog from '../components/Dialog';
import useTableSort from '../useTableSort';
import { MeasurementTable, MeasurementList } from '../components/MeasurementPicker';
import BoardDetailDialog from '../components/BoardDetailDialog';
import { fetchEdgingBatches, addEdgingBatch, updateEdgingBatch, deleteEdgingBatch, fetchEdgingInputs, addEdgingInputsBatch, deleteEdgingInput, fetchEdgingLeftovers, fetchAllEdgingLeftovers, addEdgingLeftover, updateEdgingLeftover, deleteEdgingLeftover, subscribeEdgingBatches, fetchBundleMeasurements, subscribeBundleMeasurements } from '../api';

const BATCH_STATUSES = ['Đang xử lý', 'Hoàn thành', 'Đã hủy'];

function statusColor(s) {
  if (s === 'Đang xử lý') return { color: '#2563EB', bg: 'rgba(37,99,235,0.1)' };
  if (s === 'Hoàn thành') return { color: '#16A34A', bg: 'rgba(22,163,74,0.1)' };
  if (s === 'Đã hủy') return { color: 'var(--tm)', bg: 'var(--bgs)' };
  return { color: 'var(--tm)', bg: 'var(--bgs)' };
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtNum(n, dec = 4) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('vi-VN', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

// ── Styles ──
const btnS = { padding: '6px 14px', borderRadius: 6, border: 'none', fontWeight: 600, fontSize: '0.74rem', cursor: 'pointer' };
const btnP = { ...btnS, background: 'var(--ac)', color: '#fff' };
const btnSec = { ...btnS, background: 'var(--bgs)', color: 'var(--ts)', border: '1px solid var(--bd)' };
const btnDg = { ...btnS, background: 'var(--dg)', color: '#fff' };
const inpS = { width: '100%', padding: '5px 8px', borderRadius: 5, border: '1px solid var(--bd)', fontSize: '0.76rem', background: 'var(--bgc)', color: 'var(--tp)', outline: 'none', boxSizing: 'border-box' };
const thS = { padding: '4px 8px', fontSize: '0.66rem', fontWeight: 700, color: 'var(--brl)', textAlign: 'left', borderBottom: '2px solid var(--bd)', whiteSpace: 'nowrap', transition: 'all 0.12s' };
const tdS = { padding: '3px 8px', fontSize: '0.74rem', borderBottom: '1px solid var(--bd)', whiteSpace: 'nowrap' };
const badgeS = (c) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: '0.63rem', fontWeight: 700, color: c.color, background: c.bg });
const panelS = { background: 'var(--bgc)', borderRadius: 10, border: '1px solid var(--bd)', overflow: 'hidden' };
const panelHead = { padding: '10px 14px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 };
const tabS = (active) => ({ padding: '8px 18px', borderRadius: '8px 8px 0 0', border: `1px solid ${active ? 'var(--bd)' : 'transparent'}`, borderBottom: active ? '2px solid var(--ac)' : '1px solid var(--bd)', background: active ? 'var(--bgc)' : 'transparent', fontWeight: active ? 700 : 500, fontSize: '0.78rem', cursor: 'pointer', color: active ? 'var(--ac)' : 'var(--ts)', transition: 'all 0.12s' });

// ════════════════════════════════════════════════════════════════
export default function PgEdging({ wts, ats, cfg, bundles, setBundles, ce, isAdmin, user, useAPI, notify }) {
  const [tab, setTab] = useState('pending'); // 'pending' | 'batches' | 'measurements'
  const [batches, setBatches] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState(null); // batch detail view

  // ── Load data ──
  const loadBatches = useCallback(async () => {
    try {
      const data = await fetchEdgingBatches();
      setBatches(data);
    } catch (e) { console.error('fetchEdgingBatches', e); }
    setLoading(false);
  }, []);

  const loadMeasurements = useCallback(async () => {
    try {
      const data = await fetchBundleMeasurements('whole_bundle');
      setMeasurements(data);
    } catch (e) { console.error('fetchBundleMeasurements', e); }
  }, []);

  useEffect(() => { loadBatches(); loadMeasurements(); }, [loadBatches, loadMeasurements]);

  // Realtime
  useEffect(() => {
    const sub = subscribeEdgingBatches(() => loadBatches());
    return () => sub?.unsubscribe?.();
  }, [loadBatches]);

  useEffect(() => {
    const sub = subscribeBundleMeasurements((payload) => {
      const r = payload.new;
      if (r?.measurement_type === 'whole_bundle') loadMeasurements();
    });
    return () => sub?.unsubscribe?.();
  }, [loadMeasurements]);

  // ── Kiện chờ dong: bundles có edging="Chưa dong" và status active ──
  const pendingBundles = useMemo(() => {
    if (!bundles) return [];
    return bundles.filter(b =>
      b.attributes?.edging && ['Chưa dong', 'Âu chưa dong'].includes(b.attributes.edging)
      && ['Kiện nguyên'].includes(b.status)
    );
  }, [bundles]);

  // Back from detail
  if (selectedBatch) {
    return <BatchDetail
      batch={selectedBatch}
      batches={batches}
      bundles={bundles}
      setBundles={setBundles}
      pendingMeasurements={measurements}
      wts={wts} ats={ats} cfg={cfg}
      ce={ce} isAdmin={isAdmin} user={user}
      notify={notify}
      onBack={() => { setSelectedBatch(null); loadBatches(); }}
      onRefresh={() => { loadBatches(); loadMeasurements(); }}
    />;
  }

  return (
    <div style={{ padding: '0 16px 16px' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid var(--bd)' }}>
        <button style={tabS(tab === 'pending')} onClick={() => setTab('pending')}>Kiện chờ dong ({pendingBundles.length})</button>
        <button style={tabS(tab === 'batches')} onClick={() => setTab('batches')}>Mẻ dong cạnh ({batches.length})</button>
        <button style={tabS(tab === 'measurements')} onClick={() => { setTab('measurements'); loadMeasurements(); }}>
          Kiện đo chờ gán{measurements.length > 0 && <span style={{ marginLeft: 6, background: 'var(--dg)', color: '#fff', borderRadius: 8, padding: '1px 6px', fontSize: '0.64rem', fontWeight: 700 }}>{measurements.length}</span>}
        </button>
      </div>

      {tab === 'pending' && <TabPending bundles={pendingBundles} wts={wts} cfg={cfg} batches={batches} setBatches={setBatches} ce={ce} user={user} notify={notify} onCreated={(b) => { loadBatches(); setSelectedBatch(b); setTab('batches'); }} setBundles={setBundles} />}
      {tab === 'batches' && <TabBatches batches={batches} wts={wts} ce={ce} notify={notify} onSelect={setSelectedBatch} onRefresh={loadBatches} />}
      {tab === 'measurements' && <TabMeasurements measurements={measurements} batches={batches} wts={wts} cfg={cfg} bundles={bundles} setBundles={setBundles} ce={ce} user={user} notify={notify} onRefresh={() => { loadMeasurements(); loadBatches(); }} />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Tab 1: Kiện chờ dong
// ════════════════════════════════════════════════════════════════
const chipS = (active) => ({ padding: '5px 14px', borderRadius: 16, border: `1.5px solid ${active ? 'var(--ac)' : 'var(--bd)'}`, background: active ? 'rgba(242,101,34,0.1)' : 'var(--bgc)', color: active ? 'var(--ac)' : 'var(--ts)', fontWeight: active ? 700 : 500, fontSize: '0.74rem', cursor: 'pointer', transition: 'all 0.12s', whiteSpace: 'nowrap' });

function TabPending({ bundles, wts, cfg, batches, setBatches, ce, user, notify, onCreated, setBundles }) {
  // Unique wood types present in pending bundles
  const woodIds = useMemo(() => [...new Set(bundles.map(b => b.woodId))], [bundles]);
  const [selected, setSelected] = useState(new Set());
  const [fWood, setFWood] = useState(() => woodIds[0] || '');
  const [fThick, setFThick] = useState('');
  const [fContainer, setFContainer] = useState('');
  const [creating, setCreating] = useState(false);
  const { sortField, sortDir, toggleSort, sortIcon, applySort } = useTableSort('bundleCode', 'asc');

  const woodName = (id) => wts?.find(w => w.id === id)?.name || id || '—';

  // Update default wood when woodIds change
  useEffect(() => { if (!fWood && woodIds.length) setFWood(woodIds[0]); }, [woodIds, fWood]);

  const thicknesses = useMemo(() => [...new Set(bundles.filter(b => !fWood || b.woodId === fWood).map(b => b.attributes?.thickness).filter(Boolean))].sort(), [bundles, fWood]);
  const containerIds = useMemo(() => [...new Set(bundles.filter(b => !fWood || b.woodId === fWood).map(b => b.containerId).filter(Boolean))], [bundles, fWood]);

  // Filter + sort
  const filtered = useMemo(() => {
    let arr = [...bundles];
    if (fWood) arr = arr.filter(b => b.woodId === fWood);
    if (fThick) arr = arr.filter(b => b.attributes?.thickness === fThick);
    if (fContainer) arr = arr.filter(b => String(b.containerId) === fContainer);
    return applySort(arr, (a, b) => {
      const va = a[sortField], vb = b[sortField];
      if (typeof va === 'number') return va - vb;
      return String(va || '').localeCompare(String(vb || ''), 'vi');
    });
  }, [bundles, fWood, fThick, fContainer, applySort, sortField]);

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(b => b.id)));
  };
  const toggle = (id) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Validate selection: cùng loại gỗ + cùng dày
  const selBundles = useMemo(() => bundles.filter(b => selected.has(b.id)), [bundles, selected]);
  const selValid = useMemo(() => {
    if (!selBundles.length) return { valid: false, msg: '' };
    const woods = new Set(selBundles.map(b => b.woodId));
    const thicks = new Set(selBundles.map(b => b.attributes?.thickness));
    if (woods.size > 1) return { valid: false, msg: 'Các kiện phải cùng loại gỗ' };
    if (thicks.size > 1) return { valid: false, msg: 'Các kiện phải cùng độ dày' };
    return { valid: true, woodId: selBundles[0].woodId, thickness: selBundles[0].attributes?.thickness };
  }, [selBundles]);

  // Create batch
  const handleCreate = async () => {
    if (!selValid.valid || creating) return;
    setCreating(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const dateStr = today.replace(/-/g, '');
      const existing = batches.filter(b => b.batchCode.startsWith(`DC-${dateStr}`)).length;
      const batchCode = `DC-${dateStr}-${String(existing + 1).padStart(3, '0')}`;

      const { addEdgingBatch, addEdgingInputsBatch, updateBundle } = await import('../api');
      const res = await addEdgingBatch({
        batchCode,
        batchDate: today,
        woodTypeId: selValid.woodId,
        thickness: selValid.thickness,
        createdBy: user?.label || user?.username,
      });
      if (res.error) { notify(res.error, false); setCreating(false); return; }

      // Add inputs
      const items = selBundles.map(b => ({ bundleId: b.id, volume: b.volume, boardCount: b.boardCount }));
      const ir = await addEdgingInputsBatch(res.id, items);
      if (ir.error) { notify(ir.error, false); setCreating(false); return; }

      // Update bundle statuses
      const totalVol = selBundles.reduce((s, b) => s + (b.volume || 0), 0);
      const totalBoards = selBundles.reduce((s, b) => s + (b.boardCount || 0), 0);
      for (const b of selBundles) {
        await updateBundle(b.id, { status: 'Đang dong cạnh' });
      }

      // Update batch totals
      const { updateEdgingBatch: ueb } = await import('../api');
      await ueb(res.id, { totalInputVolume: totalVol, totalInputBoards: totalBoards });

      // Update local bundles state
      setBundles(prev => prev.map(b => selected.has(b.id) ? { ...b, status: 'Đang dong cạnh' } : b));

      setSelected(new Set());
      notify(`Tạo mẻ ${batchCode} thành công (${selBundles.length} kiện)`, true);
      onCreated({ id: res.id, batchCode, batchDate: today, woodTypeId: selValid.woodId, thickness: selValid.thickness, status: 'Đang xử lý', totalInputVolume: totalVol, totalInputBoards: totalBoards, totalOutputVolume: 0, totalOutputBoards: 0 });
    } catch (e) { notify('Lỗi: ' + e.message, false); }
    setCreating(false);
  };

  // Count per wood type
  const woodCounts = useMemo(() => {
    const m = {};
    bundles.forEach(b => { m[b.woodId] = (m[b.woodId] || 0) + 1; });
    return m;
  }, [bundles]);

  const COLS = 8;
  return (
    <div style={panelS}>
      <div style={panelHead}>
        <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>Kiện gỗ chờ dong cạnh</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {selected.size > 0 && <span style={{ fontSize: '0.72rem', color: 'var(--ac)', fontWeight: 600 }}>Chọn {selected.size} kiện</span>}
          {selected.size > 0 && !selValid.valid && selValid.msg && <span style={{ fontSize: '0.68rem', color: 'var(--dg)' }}>{selValid.msg}</span>}
          <button style={{ ...btnP, opacity: selValid.valid ? 1 : 0.5 }} disabled={!selValid.valid || creating} onClick={handleCreate}>
            {creating ? 'Đang tạo...' : '+ Tạo mẻ dong cạnh'}
          </button>
        </div>
      </div>

      {/* Wood type chip picker */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--bd)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {woodIds.map(id => (
          <button key={id} style={chipS(fWood === id)} onClick={() => { setFWood(fWood === id ? '' : id); setSelected(new Set()); }}>
            {woodName(id)} ({woodCounts[id] || 0})
          </button>
        ))}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 36 }} />
            <col style={{ width: 36 }} />
            <col style={{ width: 140 }} />
            <col />
            <col style={{ width: 60 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 60 }} />
            <col style={{ width: 80 }} />
          </colgroup>
          <thead>
            <tr style={{ background: 'var(--bgs)' }}>
              <td style={{ padding: '5px 6px' }} />
              <td style={{ padding: '5px 6px' }}>
                <input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length} onChange={toggleAll} />
              </td>
              <td style={{ padding: '5px 6px' }} />
              <td style={{ padding: '5px 6px' }} />
              <td style={{ padding: '5px 6px' }}>
                <select style={{ ...inpS, fontSize: '0.72rem', padding: '3px 6px' }} value={fThick} onChange={e => setFThick(e.target.value)}>
                  <option value="">Tất cả</option>
                  {thicknesses.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </td>
              <td style={{ padding: '5px 6px' }} />
              <td style={{ padding: '5px 6px' }} />
              <td style={{ padding: '5px 6px' }}>
                <select style={{ ...inpS, fontSize: '0.72rem', padding: '3px 6px' }} value={fContainer} onChange={e => setFContainer(e.target.value)}>
                  <option value="">Tất cả</option>
                  {containerIds.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </td>
            </tr>
            <tr>
              <th style={{ ...thS, textAlign: 'center', width: 36 }}>#</th>
              <th style={{ ...thS, width: 36 }} />
              <th style={{ ...thS, cursor: 'pointer' }} onClick={() => toggleSort('bundleCode')}>Mã kiện{sortIcon('bundleCode')}</th>
              <th style={thS}>Mã NCC</th>
              <th style={thS}>Dày</th>
              <th style={{ ...thS, textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleSort('volume')}>m³{sortIcon('volume')}</th>
              <th style={{ ...thS, textAlign: 'right' }}>Số tấm</th>
              <th style={thS}>Container</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={COLS} style={{ ...tdS, textAlign: 'center', color: 'var(--tm)', padding: 20 }}>Không có kiện nào chờ dong cạnh</td></tr>}
            {filtered.map((b, i) => (
              <tr key={b.id} data-clickable="true">
                <td style={{ ...tdS, textAlign: 'center', fontSize: '0.68rem', color: 'var(--tm)' }}>{i + 1}</td>
                <td style={tdS}><input type="checkbox" checked={selected.has(b.id)} onChange={() => toggle(b.id)} /></td>
                <td style={{ ...tdS, fontWeight: 600 }} title={b.bundleCode}>{b.bundleCode}</td>
                <td style={{ ...tdS, color: 'var(--tm)', overflow: 'hidden', textOverflow: 'ellipsis' }} title={b.supplierBundleCode}>{b.supplierBundleCode || '—'}</td>
                <td style={tdS}>{b.attributes?.thickness || '—'}</td>
                <td style={{ ...tdS, textAlign: 'right', fontFamily: 'monospace' }}>{fmtNum(b.volume)}</td>
                <td style={{ ...tdS, textAlign: 'right' }}>{b.boardCount || 0}</td>
                <td style={tdS}>{b.containerId || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Tab 2: Danh sách mẻ dong cạnh
// ════════════════════════════════════════════════════════════════
function TabBatches({ batches, wts, ce, notify, onSelect, onRefresh }) {
  const { sortField, sortDir, toggleSort, sortIcon, applySort } = useTableSort('batchDate', 'desc');
  const [fStatus, setFStatus] = useState('');

  const woodName = (id) => wts?.find(w => w.id === id)?.name || id || '—';

  // Only show main batches (no parent = mẻ chính) and group sub-batches under them
  const mainBatches = useMemo(() => {
    let arr = batches.filter(b => !b.parentBatchId);
    if (fStatus) arr = arr.filter(b => b.status === fStatus);
    return applySort(arr, (a, b) => {
      if (sortField === 'batchDate') return new Date(a.batchDate) - new Date(b.batchDate);
      const va = a[sortField], vb = b[sortField];
      if (typeof va === 'number') return va - vb;
      return String(va || '').localeCompare(String(vb || ''), 'vi');
    });
  }, [batches, fStatus, applySort, sortField]);

  const subBatchCount = (parentId) => batches.filter(b => b.parentBatchId === parentId).length;

  const COLS = 9;
  return (
    <div style={panelS}>
      <div style={panelHead}>
        <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>Danh sách mẻ dong cạnh</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 36 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 90 }} />
            <col />
            <col style={{ width: 70 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 60 }} />
          </colgroup>
          <thead>
            <tr style={{ background: 'var(--bgs)' }}>
              <td style={{ padding: '5px 6px' }} />
              <td style={{ padding: '5px 6px' }} />
              <td style={{ padding: '5px 6px' }} />
              <td style={{ padding: '5px 6px' }} />
              <td style={{ padding: '5px 6px' }} />
              <td style={{ padding: '5px 6px' }} />
              <td style={{ padding: '5px 6px' }} />
              <td style={{ padding: '5px 6px' }}>
                <select style={{ ...inpS, fontSize: '0.72rem', padding: '3px 6px' }} value={fStatus} onChange={e => setFStatus(e.target.value)}>
                  <option value="">Tất cả</option>
                  {BATCH_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
              <td style={{ padding: '5px 6px' }} />
            </tr>
            <tr>
              <th style={{ ...thS, textAlign: 'center', width: 36 }}>#</th>
              <th style={{ ...thS, cursor: 'pointer' }} onClick={() => toggleSort('batchCode')}>Mã mẻ{sortIcon('batchCode')}</th>
              <th style={{ ...thS, cursor: 'pointer' }} onClick={() => toggleSort('batchDate')}>Ngày{sortIcon('batchDate')}</th>
              <th style={thS}>Loại gỗ</th>
              <th style={thS}>Dày</th>
              <th style={{ ...thS, textAlign: 'right' }}>Input m³</th>
              <th style={{ ...thS, textAlign: 'right' }}>Output m³</th>
              <th style={thS}>Trạng thái</th>
              <th style={thS}>Phụ</th>
            </tr>
          </thead>
          <tbody>
            {mainBatches.length === 0 && <tr><td colSpan={COLS} style={{ ...tdS, textAlign: 'center', color: 'var(--tm)', padding: 20 }}>Chưa có mẻ dong cạnh nào</td></tr>}
            {mainBatches.map((b, i) => {
              const sc = statusColor(b.status);
              const subs = subBatchCount(b.id);
              return (
                <tr key={b.id} data-clickable="true" onClick={() => onSelect(b)} style={{ cursor: 'pointer' }}>
                  <td style={{ ...tdS, textAlign: 'center', fontSize: '0.68rem', color: 'var(--tm)' }}>{i + 1}</td>
                  <td style={{ ...tdS, fontWeight: 600 }}>{b.batchCode}</td>
                  <td style={tdS}>{fmtDate(b.batchDate)}</td>
                  <td style={{ ...tdS, whiteSpace: 'normal' }}>{woodName(b.woodTypeId)}</td>
                  <td style={tdS}>{b.thickness || '—'}</td>
                  <td style={{ ...tdS, textAlign: 'right', fontFamily: 'monospace' }}>{fmtNum(b.totalInputVolume)}</td>
                  <td style={{ ...tdS, textAlign: 'right', fontFamily: 'monospace' }}>{fmtNum(b.totalOutputVolume)}</td>
                  <td style={tdS}><span style={badgeS(sc)}>{b.status}</span></td>
                  <td style={{ ...tdS, textAlign: 'center' }}>{subs > 0 ? subs : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Tab 3: Kiện đo chờ gán
// ════════════════════════════════════════════════════════════════
function TabMeasurements({ measurements, batches, wts, cfg, bundles, setBundles, ce, user, notify, onRefresh }) {
  const [saving, setSaving] = useState(false);
  const [boardDetail, setBoardDetail] = useState(null);
  const woodName = (id) => wts?.find(w => w.id === id)?.name || id || '—';
  const openBatches = useMemo(() => batches.filter(b => b.status === 'Đang xử lý'), [batches]);
  const sessions = useMemo(() => openBatches.map(b => ({ id: b.id, label: `${b.batchCode} — ${woodName(b.woodTypeId)} ${b.thickness}` })), [openBatches]);

  const handleAssign = async (m, batchId) => {
    const batch = batches.find(b => b.id === batchId);
    if (!batch) return;
    if (!window.confirm(`Gán kiện "${m.bundle_code}" vào mẻ ${batch.batchCode}?`)) return;
    setSaving(true);
    try {
      await assignMeasurementToEdging(m, batch, cfg, bundles, setBundles, notify);
      onRefresh();
    } catch (e) { notify('Lỗi: ' + e.message, false); }
    setSaving(false);
  };

  const handleDelete = async (m) => {
    if (!window.confirm(`Xóa kiện đo "${m.bundle_code}"?`)) return;
    try {
      const { softDeleteMeasurement } = await import('../api');
      await softDeleteMeasurement(m.id);
      notify('Đã xóa', true);
      onRefresh();
    } catch (e) { notify('Lỗi: ' + e.message, false); }
  };

  return <>
    <MeasurementTable measurements={measurements} sessions={sessions} onAssign={handleAssign} onDelete={handleDelete} onView={setBoardDetail} saving={saving} sessionLabel="mẻ dong cạnh" />
    {boardDetail && <BoardDetailDialog data={boardDetail} onClose={() => setBoardDetail(null)} />}
  </>;
}

// Shared logic: gán measurement vào edging batch → tạo bundle nhập kho
async function assignMeasurementToEdging(m, batch, cfg, bundles, setBundles, notify) {
  const { addBundle, updateEdgingBatch: ueb, assignMeasurementToOrder, fetchBundles: fb, fetchEdgingInputs: fei } = await import('../api');
  const inputs = await fei(batch.id);
  const inputBundles = inputs.map(i => bundles?.find(b => b.id === i.bundleId)).filter(Boolean);
  const dominantContainer = inputBundles.find(b => b.containerId)?.containerId || null;
  const edgingVal = cfg?.[batch.woodTypeId]?.attrValues?.edging
    ? (cfg[batch.woodTypeId].attrValues.edging.find(v => /dong|Dong|Đã dong|Âu đã dong/.test(v)) || 'Dong cạnh')
    : 'Dong cạnh';
  const attrs = { thickness: m.thickness ? String(m.thickness) : batch.thickness, quality: m.quality || '', edging: edgingVal };
  const { bpk, resolvePriceAttrs } = await import('../utils');
  const resolvedAttrs = typeof resolvePriceAttrs === 'function' ? resolvePriceAttrs(batch.woodTypeId, attrs, cfg) : attrs;
  const skuKey = bpk(batch.woodTypeId, resolvedAttrs);
  const res = await addBundle({
    woodId: batch.woodTypeId, containerId: dominantContainer, edgingBatchId: batch.id,
    skuKey, attributes: attrs, boardCount: m.board_count || 0, volume: m.volume || 0,
    rawMeasurements: m.boards ? { boards: m.boards } : {},
  });
  if (res.error) throw new Error(res.error);
  await assignMeasurementToOrder(m.id, null, res.id);
  await ueb(batch.id, {
    totalOutputVolume: (batch.totalOutputVolume || 0) + (parseFloat(m.volume) || 0),
    totalOutputBoards: (batch.totalOutputBoards || 0) + (m.board_count || 0),
  });
  const allBundles = await fb();
  setBundles(allBundles);
  notify(`Gán ${m.bundle_code} → ${batch.batchCode}`, true);
}

// ════════════════════════════════════════════════════════════════
// Batch Detail View — Full CRUD
// ════════════════════════════════════════════════════════════════
function BatchDetail({ batch, batches, bundles, setBundles, pendingMeasurements, wts, ats, cfg, ce, isAdmin, user, notify, onBack, onRefresh }) {
  const [inputs, setInputs] = useState([]);
  const [leftovers, setLeftovers] = useState([]);
  const [outputBundles, setOutputBundles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Dialogs
  const [showAddInput, setShowAddInput] = useState(false);
  const [showAddLeftover, setShowAddLeftover] = useState(false);
  const [showAssignMeasurement, setShowAssignMeasurement] = useState(false);
  const [boardDetail, setBoardDetail] = useState(null);
  // Leftover form
  const [loQuality, setLoQuality] = useState('');
  const [loVolume, setLoVolume] = useState('');
  const [loBoards, setLoBoards] = useState('');
  const [loNotes, setLoNotes] = useState('');

  const woodName = (id) => wts?.find(w => w.id === id)?.name || id || '—';
  const isOpen = batch.status === 'Đang xử lý';

  // Sub-batches
  const subBatches = useMemo(() => batches.filter(b => b.parentBatchId === batch.id), [batches, batch.id]);

  // Load batch detail
  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const [inp, lo] = await Promise.all([
        fetchEdgingInputs(batch.id),
        fetchEdgingLeftovers(batch.id),
      ]);
      setInputs(inp);
      setLeftovers(lo);
      setOutputBundles((bundles || []).filter(b => b.edgingBatchId === batch.id));
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [batch.id, bundles]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  // Input bundles enriched with bundle data
  const inputBundles = useMemo(() => {
    return inputs.map(inp => {
      const b = bundles?.find(bun => bun.id === inp.bundleId);
      return { ...inp, bundle: b };
    });
  }, [inputs, bundles]);

  // Available bundles to add as input (same wood+thickness, status=Kiện nguyên, edging=Chưa dong)
  const availableForInput = useMemo(() => {
    if (!bundles) return [];
    const existingIds = new Set(inputs.map(i => i.bundleId));
    return bundles.filter(b =>
      b.woodId === batch.woodTypeId
      && b.attributes?.thickness === batch.thickness
      && b.status === 'Kiện nguyên'
      && ['Chưa dong', 'Âu chưa dong'].includes(b.attributes?.edging)
      && !existingIds.has(b.id)
    );
  }, [bundles, inputs, batch.woodTypeId, batch.thickness]);

  // Summary
  const totalInputVol = inputBundles.reduce((s, ib) => s + (ib.inputVolume || 0), 0);
  const totalInputBoards = inputBundles.reduce((s, ib) => s + (ib.inputBoards || 0), 0);
  const totalOutputVol = outputBundles.reduce((s, b) => s + (b.volume || 0), 0);
  const totalOutputBoards = outputBundles.reduce((s, b) => s + (b.boardCount || 0), 0);
  const totalLeftoverVol = leftovers.reduce((s, l) => s + (l.volumeM3 || 0), 0);
  const recoveryPct = totalInputVol > 0 ? ((totalOutputVol + totalLeftoverVol) / totalInputVol * 100) : 0;
  const lossPct = 100 - recoveryPct;
  const lossColor = lossPct <= 10 ? '#16A34A' : lossPct <= 15 ? '#D4A017' : '#DC2626';
  const pendingLeftovers = leftovers.filter(l => l.status === 'Chờ xử lý');

  const sc = statusColor(batch.status);

  // ── Actions ──

  // Remove input (return bundle to warehouse)
  const handleRemoveInput = async (inputRow) => {
    if (!window.confirm('Trả kiện về kho?')) return;
    setSaving(true);
    try {
      const { deleteEdgingInput: dei, updateBundle: ub, updateEdgingBatch: ueb } = await import('../api');
      await dei(inputRow.id);
      await ub(inputRow.bundleId, { status: 'Kiện nguyên' });
      setBundles(prev => prev.map(b => b.id === inputRow.bundleId ? { ...b, status: 'Kiện nguyên' } : b));
      const newTotalVol = totalInputVol - (inputRow.inputVolume || 0);
      const newTotalBoards = totalInputBoards - (inputRow.inputBoards || 0);
      await ueb(batch.id, { totalInputVolume: newTotalVol, totalInputBoards: newTotalBoards });
      notify('Đã trả kiện về kho', true);
      loadDetail();
    } catch (e) { notify('Lỗi: ' + e.message, false); }
    setSaving(false);
  };

  // Add more inputs
  const handleAddInputs = async (bundleIds) => {
    setSaving(true);
    try {
      const { addEdgingInputsBatch: aib, updateBundle: ub, updateEdgingBatch: ueb } = await import('../api');
      const addBundles = bundles.filter(b => bundleIds.includes(b.id));
      const items = addBundles.map(b => ({ bundleId: b.id, volume: b.volume, boardCount: b.boardCount }));
      const res = await aib(batch.id, items);
      if (res.error) { notify(res.error, false); setSaving(false); return; }
      for (const b of addBundles) await ub(b.id, { status: 'Đang dong cạnh' });
      setBundles(prev => prev.map(b => bundleIds.includes(b.id) ? { ...b, status: 'Đang dong cạnh' } : b));
      const addVol = addBundles.reduce((s, b) => s + (b.volume || 0), 0);
      const addBoards = addBundles.reduce((s, b) => s + (b.boardCount || 0), 0);
      await ueb(batch.id, { totalInputVolume: totalInputVol + addVol, totalInputBoards: totalInputBoards + addBoards });
      notify(`Thêm ${addBundles.length} kiện vào mẻ`, true);
      setShowAddInput(false);
      loadDetail();
    } catch (e) { notify('Lỗi: ' + e.message, false); }
    setSaving(false);
  };

  // Add leftover
  const handleAddLeftover = async () => {
    if (!loVolume) return;
    setSaving(true);
    try {
      const res = await addEdgingLeftover(batch.id, {
        woodTypeId: batch.woodTypeId, thickness: batch.thickness,
        quality: loQuality, volumeM3: parseFloat(loVolume) || 0,
        boardCount: parseInt(loBoards) || 0, notes: loNotes,
      });
      if (res.error) { notify(res.error, false); setSaving(false); return; }
      notify('Thêm bán thành phẩm', true);
      setShowAddLeftover(false);
      setLoQuality(''); setLoVolume(''); setLoBoards(''); setLoNotes('');
      loadDetail();
    } catch (e) { notify('Lỗi: ' + e.message, false); }
    setSaving(false);
  };

  // Delete leftover
  const handleDeleteLeftover = async (lo) => {
    if (!window.confirm('Xóa bán thành phẩm này?')) return;
    try {
      await deleteEdgingLeftover(lo.id);
      notify('Đã xóa', true);
      loadDetail();
    } catch (e) { notify('Lỗi: ' + e.message, false); }
  };

  // Assign measurement as output bundle
  const handleAssignMeasurement = async (m) => {
    if (!window.confirm(`Gán kiện "${m.bundle_code}" vào mẻ và nhập kho?`)) return;
    setSaving(true);
    try {
      const { addBundle, updateEdgingBatch: ueb, assignMeasurementToOrder } = await import('../api');
      // Determine container_id from input bundles
      const containerIds = inputBundles.map(ib => ib.bundle?.containerId).filter(Boolean);
      const dominantContainer = containerIds.length ? containerIds[0] : null;
      // Build attributes
      const edgingVal = batch.woodTypeId && cfg?.[batch.woodTypeId]?.attrValues?.edging
        ? (cfg[batch.woodTypeId].attrValues.edging.find(v => v.includes('dong') || v.includes('Dong') || v === 'Đã dong' || v === 'Dong cạnh' || v === 'Âu đã dong') || 'Dong cạnh')
        : 'Dong cạnh';
      const attrs = { thickness: m.thickness ? String(m.thickness) : batch.thickness, quality: m.quality || '', edging: edgingVal };
      // Build SKU key
      const { bpk, resolvePriceAttrs } = await import('../utils');
      const resolvedAttrs = typeof resolvePriceAttrs === 'function'
        ? resolvePriceAttrs(batch.woodTypeId, attrs, cfg) : attrs;
      const skuKey = bpk(batch.woodTypeId, resolvedAttrs);

      const res = await addBundle({
        woodId: batch.woodTypeId,
        containerId: dominantContainer,
        edgingBatchId: batch.id,
        skuKey,
        attributes: attrs,
        boardCount: m.board_count || 0,
        volume: m.volume || 0,
        rawMeasurements: m.boards ? { boards: m.boards } : {},
      });
      if (res.error) { notify(res.error, false); setSaving(false); return; }

      // Mark measurement as assigned
      await assignMeasurementToOrder(m.id, null, res.id);

      // Update batch output totals
      await ueb(batch.id, {
        totalOutputVolume: totalOutputVol + (parseFloat(m.volume) || 0),
        totalOutputBoards: totalOutputBoards + (m.board_count || 0),
      });

      // Refresh local bundles
      const { fetchBundles } = await import('../api');
      const allBundles = await fetchBundles();
      setBundles(allBundles);

      notify(`Gán kiện ${m.bundle_code} → mẻ ${batch.batchCode}`, true);
      setShowAssignMeasurement(false);
      loadDetail();
    } catch (e) { notify('Lỗi: ' + e.message, false); }
    setSaving(false);
  };

  // Create sub-batch from pending leftovers
  const handleCreateSubBatch = async () => {
    if (!pendingLeftovers.length) return;
    if (!window.confirm(`Tạo mẻ phụ từ ${pendingLeftovers.length} BTP?`)) return;
    setSaving(true);
    try {
      const { addEdgingBatch: aeb, updateEdgingLeftover: uel } = await import('../api');
      const parentId = batch.parentBatchId || batch.id; // always link to root parent
      const seq = subBatches.length + 2; // A=1, B=2, C=3...
      const suffix = String.fromCharCode(64 + seq); // B, C, D...
      const rootCode = batch.parentBatchId ? batch.batchCode.replace(/-[A-Z]$/, '') : batch.batchCode;
      const subCode = `${rootCode}-${suffix}`;
      const today = new Date().toISOString().slice(0, 10);

      const res = await aeb({
        batchCode: subCode, batchDate: today,
        woodTypeId: batch.woodTypeId, thickness: batch.thickness,
        parentBatchId: parentId, batchSeq: seq,
        createdBy: user?.label || user?.username,
      });
      if (res.error) { notify(res.error, false); setSaving(false); return; }

      // Mark leftovers as used
      for (const lo of pendingLeftovers) {
        await uel(lo.id, { status: 'Đã sử dụng', usedInBatchId: res.id });
      }

      notify(`Tạo mẻ phụ ${subCode}`, true);
      onRefresh();
      loadDetail();
    } catch (e) { notify('Lỗi: ' + e.message, false); }
    setSaving(false);
  };

  // Complete batch
  const handleComplete = async () => {
    if (pendingLeftovers.length > 0) {
      notify('Còn BTP chưa xử lý — tạo mẻ phụ hoặc xóa trước khi hoàn thành', false);
      return;
    }
    if (!window.confirm('Hoàn thành mẻ dong cạnh? Không thể sửa sau khi hoàn thành.')) return;
    setSaving(true);
    try {
      await updateEdgingBatch(batch.id, { status: 'Hoàn thành' });
      // Also complete all sub-batches
      for (const sb of subBatches) {
        if (sb.status === 'Đang xử lý') await updateEdgingBatch(sb.id, { status: 'Hoàn thành' });
      }
      notify('Mẻ đã hoàn thành', true);
      onRefresh();
      onBack();
    } catch (e) { notify('Lỗi: ' + e.message, false); }
    setSaving(false);
  };

  return (
    <div style={{ padding: '0 16px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <button style={btnSec} onClick={onBack}>&larr; Quay lại</button>
        <span style={{ fontWeight: 700, fontSize: '1rem' }}>{batch.batchCode}</span>
        <span style={badgeS(sc)}>{batch.status}</span>
        <span style={{ fontSize: '0.74rem', color: 'var(--tm)' }}>{woodName(batch.woodTypeId)} &middot; {batch.thickness} &middot; {fmtDate(batch.batchDate)}</span>
        {isOpen && <button style={{ ...btnP, marginLeft: 'auto' }} disabled={saving || pendingLeftovers.length > 0} onClick={handleComplete} title={pendingLeftovers.length > 0 ? 'Còn BTP chưa xử lý' : ''}>Hoàn thành mẻ</button>}
      </div>

      {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--tm)' }}>Đang tải...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <SummaryCard label="Đầu vào" value={`${fmtNum(totalInputVol)} m³`} sub={`${totalInputBoards} tấm`} color="#2563EB" />
            <SummaryCard label="Đầu ra" value={`${fmtNum(totalOutputVol)} m³`} sub={`${totalOutputBoards} tấm`} color="#16A34A" />
            <SummaryCard label="BTP còn lại" value={`${fmtNum(totalLeftoverVol)} m³`} sub={`${pendingLeftovers.length} phần`} color="#D4A017" />
            <SummaryCard label="Tỷ lệ thu hồi" value={`${recoveryPct.toFixed(1)}%`} sub={`Hao hụt: ${lossPct.toFixed(1)}%`} color={lossColor} />
          </div>

          {/* Input section */}
          <div style={panelS}>
            <div style={panelHead}>
              <span style={{ fontWeight: 700, fontSize: '0.78rem' }}>Đầu vào ({inputBundles.length} kiện)</span>
              {isOpen && ce && <button style={btnSec} onClick={() => setShowAddInput(true)}>+ Thêm kiện</button>}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...thS, textAlign: 'center', width: 36 }}>#</th>
                    <th style={thS}>Mã kiện</th>
                    <th style={thS}>Loại gỗ</th>
                    <th style={{ ...thS, textAlign: 'right' }}>m³</th>
                    <th style={{ ...thS, textAlign: 'right' }}>Số tấm</th>
                    <th style={thS}>Container</th>
                    {isOpen && ce && <th style={{ ...thS, width: 60 }} />}
                  </tr>
                </thead>
                <tbody>
                  {inputBundles.map((ib, i) => (
                    <tr key={ib.id}>
                      <td style={{ ...tdS, textAlign: 'center', fontSize: '0.68rem', color: 'var(--tm)' }}>{i + 1}</td>
                      <td style={{ ...tdS, fontWeight: 600 }}>{ib.bundle?.bundleCode || '—'}</td>
                      <td style={tdS}>{woodName(ib.bundle?.woodId)}</td>
                      <td style={{ ...tdS, textAlign: 'right', fontFamily: 'monospace' }}>{fmtNum(ib.inputVolume)}</td>
                      <td style={{ ...tdS, textAlign: 'right' }}>{ib.inputBoards}</td>
                      <td style={tdS}>{ib.bundle?.containerId || '—'}</td>
                      {isOpen && ce && <td style={tdS}><button style={{ ...btnDg, padding: '2px 8px', fontSize: '0.64rem' }} disabled={saving} onClick={() => handleRemoveInput(ib)}>Trả kho</button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Output section */}
          <div style={panelS}>
            <div style={panelHead}>
              <span style={{ fontWeight: 700, fontSize: '0.78rem' }}>Đầu ra ({outputBundles.length} kiện)</span>
              {isOpen && ce && <button style={btnP} onClick={() => setShowAssignMeasurement(true)}>Gán kiện từ app đo{pendingMeasurements?.length > 0 && <span style={{ marginLeft: 6, background: '#fff', color: 'var(--ac)', borderRadius: 8, padding: '0 5px', fontSize: '0.64rem', fontWeight: 700 }}>{pendingMeasurements.length}</span>}</button>}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...thS, textAlign: 'center', width: 36 }}>#</th>
                    <th style={thS}>Mã kiện</th>
                    <th style={thS}>Chất lượng</th>
                    <th style={thS}>Dày</th>
                    <th style={{ ...thS, textAlign: 'right' }}>m³</th>
                    <th style={{ ...thS, textAlign: 'right' }}>Số tấm</th>
                    <th style={thS}>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {outputBundles.length === 0 && <tr><td colSpan={7} style={{ ...tdS, textAlign: 'center', color: 'var(--tm)', padding: 16 }}>Chưa có kiện đầu ra — gán kiện từ app đo</td></tr>}
                  {outputBundles.map((b, i) => {
                    const hasBoards = b.rawMeasurements?.boards?.length > 0;
                    return (
                      <tr key={b.id} data-clickable={hasBoards ? "true" : undefined} style={hasBoards ? { cursor: 'pointer' } : undefined} onClick={hasBoards ? () => setBoardDetail(b) : undefined}>
                        <td style={{ ...tdS, textAlign: 'center', fontSize: '0.68rem', color: 'var(--tm)' }}>{i + 1}</td>
                        <td style={{ ...tdS, fontWeight: 600 }}>{b.bundleCode}{hasBoards && <span style={{ marginLeft: 4, fontSize: '0.6rem' }} title="Xem chi tiết tấm">📐</span>}</td>
                        <td style={tdS}>{b.attributes?.quality || '—'}</td>
                        <td style={tdS}>{b.attributes?.thickness || '—'}</td>
                        <td style={{ ...tdS, textAlign: 'right', fontFamily: 'monospace' }}>{fmtNum(b.volume)}</td>
                        <td style={{ ...tdS, textAlign: 'right' }}>{b.boardCount}</td>
                        <td style={tdS}>{b.status}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Leftovers section */}
          <div style={panelS}>
            <div style={panelHead}>
              <span style={{ fontWeight: 700, fontSize: '0.78rem' }}>Bán thành phẩm ({leftovers.length})</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {isOpen && ce && pendingLeftovers.length > 0 && <button style={btnSec} onClick={handleCreateSubBatch} disabled={saving}>Tạo mẻ phụ</button>}
                {isOpen && ce && <button style={btnSec} onClick={() => setShowAddLeftover(true)}>+ Thêm BTP</button>}
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...thS, textAlign: 'center', width: 36 }}>#</th>
                    <th style={thS}>Mã</th>
                    <th style={thS}>Chất lượng</th>
                    <th style={{ ...thS, textAlign: 'right' }}>m³</th>
                    <th style={{ ...thS, textAlign: 'right' }}>Số tấm</th>
                    <th style={thS}>Trạng thái</th>
                    {isOpen && ce && <th style={{ ...thS, width: 50 }} />}
                  </tr>
                </thead>
                <tbody>
                  {leftovers.length === 0 && <tr><td colSpan={isOpen && ce ? 7 : 6} style={{ ...tdS, textAlign: 'center', color: 'var(--tm)', padding: 16 }}>Không có bán thành phẩm</td></tr>}
                  {leftovers.map((l, i) => {
                    const lsc = l.status === 'Chờ xử lý' ? { color: '#D4A017', bg: 'rgba(212,160,23,0.1)' } : { color: '#16A34A', bg: 'rgba(22,163,74,0.1)' };
                    return (
                      <tr key={l.id}>
                        <td style={{ ...tdS, textAlign: 'center', fontSize: '0.68rem', color: 'var(--tm)' }}>{i + 1}</td>
                        <td style={{ ...tdS, fontWeight: 600 }}>{l.leftoverCode || '—'}</td>
                        <td style={tdS}>{l.quality || '—'}</td>
                        <td style={{ ...tdS, textAlign: 'right', fontFamily: 'monospace' }}>{fmtNum(l.volumeM3)}</td>
                        <td style={{ ...tdS, textAlign: 'right' }}>{l.boardCount}</td>
                        <td style={tdS}><span style={badgeS(lsc)}>{l.status}</span></td>
                        {isOpen && ce && <td style={tdS}>{l.status === 'Chờ xử lý' && <button style={{ ...btnDg, padding: '2px 6px', fontSize: '0.62rem' }} onClick={() => handleDeleteLeftover(l)}>Xóa</button>}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sub-batches */}
          {subBatches.length > 0 && (
            <div style={panelS}>
              <div style={panelHead}>
                <span style={{ fontWeight: 700, fontSize: '0.78rem' }}>Mẻ phụ ({subBatches.length})</span>
              </div>
              <div style={{ padding: 12 }}>
                {subBatches.map(sb => (
                  <div key={sb.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--bd)', fontSize: '0.74rem' }}>
                    <span style={{ fontWeight: 600 }}>{sb.batchCode}</span>
                    <span style={{ marginLeft: 12, color: 'var(--tm)' }}>{fmtDate(sb.batchDate)}</span>
                    <span style={{ marginLeft: 12 }}><span style={badgeS(statusColor(sb.status))}>{sb.status}</span></span>
                    <span style={{ marginLeft: 12 }}>In: {fmtNum(sb.totalInputVolume)} m³</span>
                    <span style={{ marginLeft: 8 }}>Out: {fmtNum(sb.totalOutputVolume)} m³</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dialog: Add Input Bundles */}
      <Dialog open={showAddInput} onClose={() => setShowAddInput(false)} title="Thêm kiện vào mẻ" width={540} noEnter>
        <AddInputPicker bundles={availableForInput} woodName={woodName} onConfirm={handleAddInputs} saving={saving} />
      </Dialog>

      {/* Dialog: Add Leftover */}
      <Dialog open={showAddLeftover} onClose={() => setShowAddLeftover(false)} onOk={handleAddLeftover} title="Thêm bán thành phẩm" width={380} showFooter okLabel="Thêm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ fontSize: '0.72rem' }}>Chất lượng
            <input style={inpS} value={loQuality} onChange={e => setLoQuality(e.target.value)} placeholder="VD: BC, AB..." />
          </label>
          <label style={{ fontSize: '0.72rem' }}>Khối lượng (m³) *
            <input style={inpS} type="number" step="0.0001" value={loVolume} onChange={e => setLoVolume(e.target.value)} />
          </label>
          <label style={{ fontSize: '0.72rem' }}>Số tấm
            <input style={inpS} type="number" value={loBoards} onChange={e => setLoBoards(e.target.value)} />
          </label>
          <label style={{ fontSize: '0.72rem' }}>Ghi chú
            <textarea style={{ ...inpS, minHeight: 50 }} value={loNotes} onChange={e => setLoNotes(e.target.value)} />
          </label>
        </div>
      </Dialog>

      {/* Dialog: Assign Measurement */}
      <Dialog open={showAssignMeasurement} onClose={() => setShowAssignMeasurement(false)} title="Gán kiện đo vào mẻ" width={600} noEnter>
        <MeasurementList measurements={pendingMeasurements || []} onAssign={handleAssignMeasurement} onView={setBoardDetail} saving={saving} />
      </Dialog>

      {boardDetail && <BoardDetailDialog data={boardDetail} onClose={() => setBoardDetail(null)} />}
    </div>
  );
}

// ── Add Input Picker ──
function AddInputPicker({ bundles, woodName, onConfirm, saving }) {
  const [sel, setSel] = useState(new Set());
  const toggle = (id) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  return (
    <div>
      {bundles.length === 0 && <div style={{ padding: 16, textAlign: 'center', color: 'var(--tm)', fontSize: '0.76rem' }}>Không có kiện phù hợp</div>}
      <div style={{ maxHeight: 300, overflow: 'auto' }}>
        {bundles.map(b => (
          <div key={b.id} data-clickable="true" onClick={() => toggle(b.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderBottom: '1px solid var(--bd)', cursor: 'pointer', background: sel.has(b.id) ? 'rgba(37,99,235,0.06)' : 'transparent', fontSize: '0.74rem' }}>
            <input type="checkbox" checked={sel.has(b.id)} readOnly />
            <span style={{ fontWeight: 600 }}>{b.bundleCode}</span>
            <span style={{ color: 'var(--tm)' }}>{fmtNum(b.volume)} m³</span>
            <span style={{ color: 'var(--tm)' }}>{b.boardCount} tấm</span>
          </div>
        ))}
      </div>
      {bundles.length > 0 && (
        <div style={{ padding: '10px 0 0', textAlign: 'right' }}>
          <button style={{ ...btnP, opacity: sel.size > 0 ? 1 : 0.5 }} disabled={sel.size === 0 || saving} onClick={() => onConfirm([...sel])}>
            {saving ? 'Đang thêm...' : `Thêm ${sel.size} kiện`}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Measurement Picker ──
// ── Summary Card ──
function SummaryCard({ label, value, sub, color }) {
  return (
    <div style={{ background: 'var(--bgc)', borderRadius: 8, border: '1px solid var(--bd)', padding: 12 }}>
      <div style={{ fontSize: '0.64rem', fontWeight: 700, color: 'var(--brl)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: '0.68rem', color: 'var(--tm)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
