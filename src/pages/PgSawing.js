import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { INV_STATUS, getContainerInvStatus } from "../utils";

// ── Constants ─────────────────────────────────────────────────
const PRIORITY_CFG = {
  normal: { label: 'Bình thường', color: 'var(--tp)',  bg: 'transparent',           border: 'var(--bd)' },
  soon:   { label: 'Ưu tiên',    color: '#92400E',     bg: 'rgba(245,158,11,0.13)', border: 'rgba(245,158,11,0.4)' },
  urgent: { label: 'Gấp',        color: '#fff',         bg: '#C0392B',               border: '#C0392B' },
};
const QUALITY_OPTS = ['Đẹp', 'Xô'];

// ── Styles ────────────────────────────────────────────────────
const cardS   = { background: 'var(--bgc)', borderRadius: 10, border: '1px solid var(--bd)', padding: '12px 14px' };
const btnS    = { padding: '6px 14px', borderRadius: 6, border: 'none', fontWeight: 600, fontSize: '0.74rem', cursor: 'pointer' };
const btnP    = { ...btnS, background: 'var(--ac)', color: '#fff' };
const btnSec  = { ...btnS, background: 'var(--bgs)', color: 'var(--ts)', border: '1px solid var(--bd)' };
const btnDg   = { ...btnS, background: 'var(--dg)', color: '#fff' };
const inpS    = { width: '100%', padding: '6px 9px', borderRadius: 6, border: '1px solid var(--bd)', fontSize: '0.76rem', background: 'var(--bgc)', color: 'var(--tp)', outline: 'none', boxSizing: 'border-box' };
const labelS  = { display: 'block', fontSize: '0.65rem', fontWeight: 700, color: 'var(--brl)', marginBottom: 3 };
const thS     = { padding: '5px 8px', fontSize: '0.64rem', fontWeight: 700, color: 'var(--brl)', textAlign: 'left', borderBottom: '2px solid var(--bd)', whiteSpace: 'nowrap' };
const tdS     = { padding: '5px 8px', fontSize: '0.76rem', borderBottom: '1px solid var(--bd)', verticalAlign: 'middle' };

function fmtNum(n, d = 2) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('vi-VN', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function today() { return new Date().toISOString().slice(0, 10); }

// ── Progress bar ──────────────────────────────────────────────
function ProgressBar({ done, target, priority }) {
  const pct = target > 0 ? Math.min(100, (done / target) * 100) : 0;
  const over = done > target * 1.0;
  const barColor = over ? '#27AE60' : priority === 'urgent' ? '#C0392B' : priority === 'soon' ? '#F59E0B' : 'var(--ac)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--bd)', overflow: 'hidden' }}>
        <div style={{ width: pct + '%', height: '100%', background: barColor, borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: '0.65rem', color: 'var(--ts)', whiteSpace: 'nowrap', minWidth: 60, textAlign: 'right' }}>
        {fmtNum(done, 1)} / {fmtNum(target, 1)} m³
      </span>
    </div>
  );
}

// ── Priority badge ─────────────────────────────────────────────
function PriBadge({ priority }) {
  const cfg = PRIORITY_CFG[priority] || PRIORITY_CFG.normal;
  return (
    <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: 8, fontSize: '0.6rem', fontWeight: 700, color: cfg.color, background: cfg.bg, border: '1px solid ' + cfg.border }}>
      {cfg.label}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════
// DIALOG: Tạo / Sửa mẻ xẻ
// ══════════════════════════════════════════════════════════════
function BatchFormDlg({ batch, rawWoodTypes, onSave, onClose }) {
  const [woodId, setWoodId]   = useState(batch?.woodId || rawWoodTypes[0]?.id || '');
  const [date, setDate]       = useState(batch?.batchDate || today());
  const [note, setNote]       = useState(batch?.note || '');
  const isEdit = !!batch;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bgc)', borderRadius: 14, padding: 24, width: 400, maxWidth: '95vw' }}>
        <div style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: 16 }}>{isEdit ? 'Sửa mẻ xẻ' : 'Tạo mẻ xẻ mới'}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelS}>Loại gỗ tròn / gỗ hộp *</label>
            <select value={woodId} onChange={e => setWoodId(e.target.value)} style={inpS} disabled={isEdit}>
              {rawWoodTypes.map(w => <option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelS}>Ngày lập kế hoạch *</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inpS} />
          </div>
          <div>
            <label style={labelS}>Ghi chú</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} style={{ ...inpS, resize: 'vertical' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={btnSec}>Hủy</button>
          <button onClick={() => { if (!woodId || !date) return; onSave({ woodId, batchDate: date, note: note || null }); onClose(); }} style={btnP}>
            {isEdit ? 'Lưu' : 'Tạo'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// DIALOG: Thêm / Sửa item trong kế hoạch
// Normalize thickness: "2" → "2.0F", "2.2" → "2.2F", "3.5F" → "3.5F", "3F" → "3.0F"
function normalizeThicknessSawing(raw) {
  if (!raw) return '';
  const s = String(raw).trim().replace(/,/g, '.').replace(/[fF]$/, '').trim();
  const n = parseFloat(s);
  if (isNaN(n) || n <= 0) return raw; // giữ nguyên nếu không parse được
  return n.toFixed(1) + 'F';
}
function thicknessNum(t) {
  return parseFloat(String(t || '').replace(/[fF]$/i, '')) || 0;
}

// ══════════════════════════════════════════════════════════════
function ItemFormDlg({ item, existingItems, onSave, onAddVolume, onClose }) {
  const [f, setF] = useState({
    thickness: item?.thickness || '',
    quality: item?.quality || 'Đẹp',
    targetVolume: item?.targetVolume != null ? String(item.targetVolume) : '',
    note: item?.note || '',
    priority: item?.priority || 'normal',
  });
  const [thickErr, setThickErr] = useState('');
  const [dupItem, setDupItem] = useState(null);  // item bị trùng → confirm cộng thêm
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));

  const handleBlurThickness = () => {
    const norm = normalizeThicknessSawing(f.thickness);
    if (norm) setF(p => ({ ...p, thickness: norm }));
    setThickErr(norm ? '' : 'Nhập số dương, VD: 2.0, 3.5');
  };

  const handleSave = () => {
    const norm = normalizeThicknessSawing(f.thickness);
    if (!norm) { setThickErr('Nhập số dương, VD: 2.0, 3.5'); return; }
    if (!f.quality) return;
    const vol = parseFloat(f.targetVolume) || 0;
    // Kiểm tra trùng (chỉ khi thêm mới, không phải sửa)
    if (!item && existingItems) {
      const dup = existingItems.find(it => it.thickness === norm && it.quality === f.quality);
      if (dup) { setDupItem({ ...dup, addVol: vol }); return; }
    }
    onSave({ thickness: norm, quality: f.quality, targetVolume: vol, note: f.note || null, priority: f.priority });
    onClose();
  };

  if (dupItem) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1010, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bgc)', borderRadius: 14, padding: 24, width: 380, maxWidth: '95vw' }}>
        <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: 8, color: 'var(--dg)' }}>Mã đã tồn tại!</div>
        <p style={{ fontSize: '0.82rem', color: 'var(--ts)', margin: '0 0 4px' }}>
          <strong>{dupItem.thickness} {dupItem.quality}</strong> đã có trong kế hoạch.
        </p>
        <div style={{ padding: '8px 10px', borderRadius: 7, background: 'var(--bgs)', marginBottom: 14, fontSize: '0.78rem' }}>
          Hiện tại: <strong>{fmtNum(dupItem.targetVolume, 1)} m³</strong>
          {dupItem.addVol > 0 && <> → sau khi cộng: <strong style={{ color: 'var(--gn)' }}>{fmtNum(dupItem.targetVolume + dupItem.addVol, 1)} m³</strong></>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {dupItem.addVol > 0 && (
            <button onClick={() => { onAddVolume(dupItem.id, dupItem.targetVolume + dupItem.addVol); onClose(); }}
              style={{ ...btnP, flex: 1, padding: '10px 8px', fontSize: '0.76rem' }}>
              ✓ Cộng thêm {fmtNum(dupItem.addVol, 1)} m³
            </button>
          )}
          <button onClick={onClose} style={{ ...btnSec, flex: dupItem.addVol > 0 ? 'none' : 1, padding: '10px 14px' }}>Hủy</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1010, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bgc)', borderRadius: 14, padding: 22, width: 380, maxWidth: '95vw' }}>
        <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: 14 }}>{item ? 'Sửa mã xẻ' : 'Thêm mã xẻ'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={labelS}>Độ dày * (VD: 2.0, 3.5)</label>
            <input
              value={f.thickness}
              onChange={e => { setF(p => ({ ...p, thickness: e.target.value })); setThickErr(''); }}
              onBlur={handleBlurThickness}
              placeholder="2.0, 3.5..."
              style={{ ...inpS, borderColor: thickErr ? 'var(--dg)' : 'var(--bd)' }}
              autoFocus
            />
            {thickErr && <div style={{ fontSize: '0.62rem', color: 'var(--dg)', marginTop: 2 }}>{thickErr}</div>}
          </div>
          <div>
            <label style={labelS}>Chất lượng *</label>
            <select value={f.quality} onChange={set('quality')} style={inpS}>
              {QUALITY_OPTS.map(q => <option key={q} value={q}>{q}</option>)}
            </select>
          </div>
          <div>
            <label style={labelS}>Khối lượng cần xẻ (m³)</label>
            <input type="number" step="0.1" min="0" value={f.targetVolume} onChange={set('targetVolume')} placeholder="0" style={inpS} />
          </div>
          <div>
            <label style={labelS}>Ưu tiên</label>
            <select value={f.priority} onChange={set('priority')} style={inpS}>
              {Object.entries(PRIORITY_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <label style={labelS}>Ghi chú (độ dài, độ rộng, yêu cầu đặc biệt...)</label>
          <input value={f.note} onChange={set('note')} placeholder="VD: bản 30+, chỉ xẻ xô, bán 20+" style={inpS} />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={btnSec}>Hủy</button>
          <button onClick={handleSave} style={btnP}>Lưu</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB 1: KẾ HOẠCH XẺ
// ══════════════════════════════════════════════════════════════
function TabKiHoach({ batches, items, wts, rawWoodTypes, useAPI, notify, user, onRefresh }) {
  const [selBatch, setSelBatch]   = useState(null);
  const [showNewBatch, setShowNewBatch] = useState(false);
  const [editBatch, setEditBatch] = useState(null);
  const [showNewItem, setShowNewItem]   = useState(false);
  const [editItem, setEditItem]   = useState(null);
  const [filterStatus, setFilterStatus] = useState('sawing');

  const wtMap = useMemo(() => Object.fromEntries(rawWoodTypes.map(w => [w.id, w])), [rawWoodTypes]);

  const filteredBatches = useMemo(() =>
    filterStatus === 'all' ? batches : batches.filter(b => b.status === filterStatus),
  [batches, filterStatus]);

  // Sort: độ dày tăng dần (numeric), cùng dày → Đẹp trước Xô sau
  const batchItems = useMemo(() => {
    if (!selBatch) return [];
    return items.filter(it => it.batchId === selBatch.id).sort((a, b) => {
      const da = thicknessNum(a.thickness), db = thicknessNum(b.thickness);
      if (da !== db) return da - db;
      if (a.quality !== b.quality) return a.quality === 'Đẹp' ? -1 : 1;
      return 0;
    });
  }, [items, selBatch]);

  const batchProgress = useMemo(() => {
    const m = {};
    batches.forEach(b => {
      const its = items.filter(i => i.batchId === b.id);
      const total = its.reduce((s, i) => s + i.targetVolume, 0);
      const done  = its.reduce((s, i) => s + i.doneVolume, 0);
      m[b.id] = { total, done, count: its.length };
    });
    return m;
  }, [batches, items]);

  const handleCreateBatch = useCallback(async (fields) => {
    if (!useAPI) { notify('Cần kết nối API', false); return; }
    const api = await import('../api.js');
    const r = await api.addSawingBatch({ ...fields, createdBy: user?.username });
    if (r?.error) { notify('Lỗi: ' + r.error, false); return; }
    notify('Đã tạo mẻ xẻ ' + r.batchCode);
    await onRefresh();
    setSelBatch(r);
  }, [useAPI, notify, user, onRefresh]);

  const handleUpdateBatch = useCallback(async (fields) => {
    if (!useAPI || !editBatch) return;
    const api = await import('../api.js');
    await api.updateSawingBatch(editBatch.id, fields);
    notify('Đã cập nhật');
    onRefresh();
  }, [useAPI, editBatch, notify, onRefresh]);

  const handleDeleteBatch = useCallback(async (b) => {
    const api = await import('../api.js');
    // Kiểm tra kiln items liên kết
    const kilnLinked = await api.fetchKilnItemsLinkedToBatch(b.id).catch(() => []);
    const selectedLogs = await api.fetchAllRawWoodPackingListsForSawing().catch(() => []);
    const batchSelectedLogs = selectedLogs.filter(l => l.sawingBatchId === b.id);

    let msg = `Xóa mẻ xẻ ${b.batchCode}?\n\nSẽ xóa toàn bộ:\n• Kế hoạch + ${(b._itemCount || 0)} mã xẻ\n• Nhật ký tiến độ\n• Lịch sử gỗ tròn đầu vào`;
    if (batchSelectedLogs.length > 0)
      msg += `\n• Reset ${batchSelectedLogs.length} cây gỗ tròn đã chọn → về tồn kho`;
    if (kilnLinked.length > 0)
      msg += `\n⚠ Gỡ liên kết ${kilnLinked.length} mã gỗ trong lò sấy (${kilnLinked.map(k => k.item_code).join(', ')})`;

    if (!window.confirm(msg)) return;
    const r = await api.deleteSawingBatch(b.id);
    if (r?.error) { notify('Lỗi: ' + r.error, false); return; }
    notify('Đã xóa mẻ ' + b.batchCode + (kilnLinked.length ? ` — ${kilnLinked.length} mã lò đã gỡ liên kết` : ''));
    if (selBatch?.id === b.id) setSelBatch(null);
    onRefresh();
  }, [useAPI, selBatch, notify, onRefresh]);

  const handleDoneBatch = useCallback(async (b) => {
    if (!window.confirm(`Đánh dấu mẻ ${b.batchCode} là Hoàn thành?`)) return;
    const api = await import('../api.js');
    await api.updateSawingBatch(b.id, { status: 'done' });
    notify('Mẻ ' + b.batchCode + ' đã hoàn thành');
    onRefresh();
  }, [notify, onRefresh]);

  const handleAddItem = useCallback(async (fields) => {
    if (!selBatch || !useAPI) return;
    const api = await import('../api.js');
    const r = await api.addSawingItem(selBatch.id, fields);
    if (r?.error) { notify('Lỗi: ' + r.error, false); return; }
    notify('Đã thêm ' + r.thickness + ' ' + r.quality);
    onRefresh();
  }, [selBatch, useAPI, notify, onRefresh]);

  const handleUpdateItem = useCallback(async (fields) => {
    if (!editItem || !useAPI) return;
    const api = await import('../api.js');
    await api.updateSawingItem(editItem.id, fields);
    notify('Đã cập nhật');
    onRefresh();
    setEditItem(null);
  }, [editItem, useAPI, notify, onRefresh]);

  // Cộng thêm khối lượng vào item đã tồn tại (khi nhập trùng thickness+quality)
  const handleAddVolume = useCallback(async (itemId, newTarget) => {
    if (!useAPI) return;
    const api = await import('../api.js');
    await api.updateSawingItem(itemId, { targetVolume: newTarget });
    notify('Đã cộng thêm khối lượng');
    onRefresh();
  }, [useAPI, notify, onRefresh]);

  const handleDeleteItem = useCallback(async (it) => {
    if (!window.confirm(`Xóa mã ${it.thickness} ${it.quality}?`)) return;
    const api = await import('../api.js');
    await api.deleteSawingItem(it.id);
    notify('Đã xóa');
    onRefresh();
  }, [useAPI, notify, onRefresh]);

  const activeBatch = selBatch ? batches.find(b => b.id === selBatch.id) || selBatch : null;

  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {/* ── Danh sách mẻ xẻ ── */}
      <div style={{ minWidth: 260, flex: '0 0 260px' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inpS, width: 'auto', flex: 1, fontSize: '0.7rem' }}>
            <option value="sawing">Đang xẻ</option>
            <option value="done">Hoàn thành</option>
            <option value="all">Tất cả</option>
          </select>
          <button onClick={() => setShowNewBatch(true)} style={btnP}>+ Tạo mẻ</button>
        </div>
        {filteredBatches.length === 0 && <div style={{ color: 'var(--tm)', fontSize: '0.75rem', padding: 12, textAlign: 'center' }}>Không có mẻ xẻ</div>}
        {filteredBatches.map(b => {
          const wt = wtMap[b.woodId];
          const pg = batchProgress[b.id] || { total: 0, done: 0, count: 0 };
          const pct = pg.total > 0 ? Math.min(100, (pg.done / pg.total) * 100) : 0;
          const isSel = selBatch?.id === b.id;
          return (
            <div key={b.id} onClick={() => setSelBatch(b)} style={{ ...cardS, marginBottom: 8, cursor: 'pointer', border: isSel ? '2px solid var(--ac)' : '1px solid var(--bd)', background: isSel ? 'var(--acbg)' : 'var(--bgc)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <span style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--br)' }}>{b.batchCode}</span>
                <span style={{ fontSize: '0.62rem', padding: '2px 6px', borderRadius: 6, fontWeight: 700, color: b.status === 'done' ? '#27AE60' : 'var(--ac)', background: b.status === 'done' ? 'rgba(39,174,96,0.1)' : 'rgba(242,101,34,0.08)' }}>
                  {b.status === 'done' ? 'Hoàn thành' : 'Đang xẻ'}
                </span>
              </div>
              <div style={{ fontSize: '0.74rem', fontWeight: 600, marginBottom: 2 }}>{wt?.icon} {wt?.name}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--ts)', marginBottom: 6 }}>{fmtDate(b.batchDate)} · {pg.count} mã</div>
              <div style={{ height: 5, borderRadius: 3, background: 'var(--bd)', overflow: 'hidden' }}>
                <div style={{ width: pct + '%', height: '100%', background: b.status === 'done' ? '#27AE60' : 'var(--ac)', borderRadius: 3 }} />
              </div>
              <div style={{ fontSize: '0.63rem', color: 'var(--ts)', marginTop: 3 }}>{fmtNum(pg.done, 1)} / {fmtNum(pg.total, 1)} m³</div>
            </div>
          );
        })}
      </div>

      {/* ── Chi tiết mẻ xẻ ── */}
      {activeBatch && (
        <div style={{ flex: 1, minWidth: 320 }}>
          <div style={{ ...cardS, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--br)' }}>{activeBatch.batchCode}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--ts)' }}>{wtMap[activeBatch.woodId]?.icon} {wtMap[activeBatch.woodId]?.name} · {fmtDate(activeBatch.batchDate)}</div>
                {activeBatch.note && <div style={{ fontSize: '0.7rem', color: 'var(--ts)', fontStyle: 'italic', marginTop: 2 }}>{activeBatch.note}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {activeBatch.status === 'sawing' && <button onClick={() => handleDoneBatch(activeBatch)} style={{ ...btnSec, color: '#27AE60' }}>✓ Hoàn thành</button>}
                <button onClick={() => setEditBatch(activeBatch)} style={btnSec}>Sửa</button>
                <button onClick={() => handleDeleteBatch(activeBatch)} style={btnDg}>Xóa</button>
              </div>
            </div>
          </div>

          {/* Bảng items */}
          <div style={{ ...cardS, overflow: 'hidden', padding: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--bd)' }}>
              <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>Kế hoạch xẻ ({batchItems.length} mã)</span>
              {activeBatch.status === 'sawing' && <button onClick={() => setShowNewItem(true)} style={btnP}>+ Thêm mã</button>}
            </div>
            {batchItems.length === 0
              ? <div style={{ padding: 20, textAlign: 'center', color: 'var(--tm)', fontSize: '0.75rem' }}>Chưa có mã xẻ nào. Nhấn "+ Thêm mã" để bắt đầu.</div>
              : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--bgh)' }}>
                        <th style={thS}>Độ dày</th>
                        <th style={thS}>CL</th>
                        <th style={thS}>Ưu tiên</th>
                        <th style={{ ...thS, minWidth: 160 }}>Tiến độ</th>
                        <th style={thS}>Ghi chú</th>
                        {activeBatch.status === 'sawing' && <th style={thS}></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {batchItems.map(it => {
                        const pri = PRIORITY_CFG[it.priority] || PRIORITY_CFG.normal;
                        const rowBg = it.priority === 'urgent' ? 'rgba(192,57,43,0.06)' : it.priority === 'soon' ? 'rgba(245,158,11,0.06)' : undefined;
                        return (
                          <tr key={it.id} style={{ background: rowBg }}>
                            <td style={{ ...tdS, fontWeight: 800, color: 'var(--br)', fontSize: '0.82rem' }}>{it.thickness}</td>
                            <td style={tdS}><span style={{ fontWeight: 700, fontSize: '0.72rem', padding: '2px 6px', borderRadius: 4, background: it.quality === 'Đẹp' ? 'rgba(39,174,96,0.1)' : 'rgba(41,128,185,0.1)', color: it.quality === 'Đẹp' ? '#27AE60' : '#2980b9' }}>{it.quality}</span></td>
                            <td style={tdS}><PriBadge priority={it.priority} /></td>
                            <td style={{ ...tdS, minWidth: 160 }}><ProgressBar done={it.doneVolume} target={it.targetVolume} priority={it.priority} /></td>
                            <td style={{ ...tdS, color: 'var(--ts)', fontSize: '0.68rem' }}>{it.note || '—'}</td>
                            {activeBatch.status === 'sawing' && (
                              <td style={{ ...tdS, whiteSpace: 'nowrap' }}>
                                <button onClick={() => setEditItem(it)} style={{ ...btnSec, padding: '3px 8px', fontSize: '0.64rem' }}>Sửa</button>
                                {' '}
                                <button onClick={() => handleDeleteItem(it)} style={{ ...btnDg, padding: '3px 8px', fontSize: '0.64rem' }}>Xóa</button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            }
          </div>
        </div>
      )}

      {showNewBatch  && <BatchFormDlg rawWoodTypes={rawWoodTypes} onSave={handleCreateBatch} onClose={() => setShowNewBatch(false)} />}
      {editBatch     && <BatchFormDlg batch={editBatch} rawWoodTypes={rawWoodTypes} onSave={handleUpdateBatch} onClose={() => setEditBatch(null)} />}
      {showNewItem   && <ItemFormDlg existingItems={batchItems} onSave={handleAddItem} onAddVolume={handleAddVolume} onClose={() => setShowNewItem(false)} />}
      {editItem      && <ItemFormDlg item={editItem} onSave={fields => handleUpdateItem(fields)} onClose={() => setEditItem(null)} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB 2: CẬP NHẬT TIẾN ĐỘ (Mobile-friendly)
// ══════════════════════════════════════════════════════════════
function TabCapNhat({ batches, items, wts, rawWoodTypes, useAPI, notify, user, onRefresh }) {
  const [selBatchId, setSelBatchId] = useState('');
  const [logDate, setLogDate]       = useState(today());
  const [volumes, setVolumes]       = useState({});   // itemId → string
  const [viewMode, setViewMode]     = useState('card'); // 'card' | 'compact' | 'ultra'
  const [notes, setNotes]           = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [recentLogs, setRecentLogs] = useState([]);

  const sawingBatches = useMemo(() => batches.filter(b => b.status === 'sawing'), [batches]);
  const wtMap = useMemo(() => Object.fromEntries(rawWoodTypes.map(w => [w.id, w])), [rawWoodTypes]);

  useEffect(() => {
    if (!sawingBatches.length) return;
    if (!selBatchId || !sawingBatches.find(b => b.id === selBatchId)) {
      setSelBatchId(sawingBatches[0]?.id || '');
    }
  }, [sawingBatches, selBatchId]);

  const batchItems = useMemo(() => {
    if (!selBatchId) return [];
    return items.filter(i => i.batchId === selBatchId).sort((a, b) => {
      const da = thicknessNum(a.thickness), db = thicknessNum(b.thickness);
      if (da !== db) return da - db;
      return a.quality === 'Đẹp' ? -1 : 1;
    });
  }, [items, selBatchId]);

  useEffect(() => {
    if (!selBatchId || !useAPI) return;
    import('../api.js').then(api =>
      api.fetchSawingDailyLogsByBatch(selBatchId)
        .then(logs => setRecentLogs(logs.slice(0, 30)))
        .catch(() => {})
    );
  }, [selBatchId, useAPI]);

  const selBatch = batches.find(b => b.id === selBatchId);
  const wt = selBatch ? wtMap[selBatch.woodId] : null;

  const handleSubmit = useCallback(async () => {
    const entries = batchItems.filter(it => volumes[it.id] && parseFloat(volumes[it.id]) > 0);
    if (!entries.length) { notify('Chưa nhập khối lượng nào', false); return; }
    setSubmitting(true);
    const api = await import('../api.js');
    let ok = 0;
    for (const it of entries) {
      const vol = parseFloat(volumes[it.id]);
      if (!vol || vol <= 0) continue;
      const r = await api.addSawingDailyLog(it.id, vol, logDate, user?.username, notes[it.id] || null);
      if (!r?.error) ok++;
    }
    await onRefresh();
    const newLogs = await api.fetchSawingDailyLogsByBatch(selBatchId);
    setRecentLogs(newLogs.slice(0, 30));
    setVolumes({});
    setNotes({});
    setSubmitting(false);
    notify(`Đã lưu ${ok} mã xẻ ngày ${logDate}`);
  }, [batchItems, volumes, notes, logDate, selBatchId, user, useAPI, notify, onRefresh]);

  if (!sawingBatches.length) return (
    <div style={{ ...cardS, textAlign: 'center', color: 'var(--tm)', padding: 32 }}>
      Không có mẻ xẻ đang chạy. Tạo mẻ xẻ mới ở tab Kế hoạch xẻ.
    </div>
  );

  return (
    <div style={{ maxWidth: 560 }}>
      {/* Chọn mẻ + ngày */}
      <div style={{ ...cardS, marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelS}>Mẻ xẻ đang chạy</label>
            <select value={selBatchId} onChange={e => { setSelBatchId(e.target.value); setVolumes({}); setNotes({}); }} style={inpS}>
              {sawingBatches.map(b => {
                const w = wtMap[b.woodId];
                return <option key={b.id} value={b.id}>{b.batchCode} — {w?.name}</option>;
              })}
            </select>
          </div>
          <div>
            <label style={labelS}>Ngày xẻ</label>
            <input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} style={inpS} />
          </div>
        </div>
        {selBatch && <div style={{ marginTop: 8, fontSize: '0.7rem', color: 'var(--ts)' }}>{wt?.icon} {wt?.name} · {fmtDate(selBatch.batchDate)}</div>}
        {/* Toggle chế độ xem */}
        <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
          <span style={{ fontSize: '0.63rem', color: 'var(--ts)', marginRight: 4, alignSelf: 'center' }}>Hiển thị:</span>
          {[{k:'card',l:'Card'},{k:'compact',l:'Gọn (~6 mã)'},{k:'ultra',l:'Siêu gọn (~10 mã)'}].map(opt => (
            <button key={opt.k} onClick={() => setViewMode(opt.k)}
              style={{ ...btnSec, padding: '3px 9px', fontSize: '0.63rem', fontWeight: viewMode === opt.k ? 800 : 500, borderColor: viewMode === opt.k ? 'var(--ac)' : 'var(--bd)', color: viewMode === opt.k ? 'var(--ac)' : 'var(--ts)' }}>
              {opt.l}
            </button>
          ))}
        </div>
      </div>

      {/* ── Compact view: bảng gọn ~6 mã ── */}
      {(viewMode === 'compact' || viewMode === 'ultra') && batchItems.length > 0 && (
        <div style={{ ...cardS, padding: 0, overflow: 'hidden', marginBottom: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bgh)' }}>
                <th style={{ ...thS, width: 60 }}>Dày</th>
                <th style={{ ...thS, width: 40 }}>CL</th>
                <th style={{ ...thS, width: 40 }}>Ưu</th>
                {viewMode === 'compact' && <th style={{ ...thS, minWidth: 100 }}>Tiến độ</th>}
                <th style={{ ...thS, width: viewMode === 'ultra' ? 80 : 70, textAlign: 'right' }}>Đã/Cần (m³)</th>
                <th style={{ thS, width: 80, padding: '5px 4px', fontSize: '0.64rem', fontWeight: 700, color: 'var(--brl)', textAlign: 'center', borderBottom: '2px solid var(--bd)', whiteSpace: 'nowrap' }}>
                  +m³ hôm nay
                </th>
                {viewMode === 'compact' && <th style={{ ...thS, width: 80 }}>Ghi chú</th>}
              </tr>
            </thead>
            <tbody>
              {batchItems.map(it => {
                const pri = PRIORITY_CFG[it.priority] || PRIORITY_CFG.normal;
                const rowBg = it.priority === 'urgent' ? 'rgba(192,57,43,0.06)' : it.priority === 'soon' ? 'rgba(245,158,11,0.06)' : undefined;
                const pct = it.targetVolume > 0 ? Math.min(100, it.doneVolume / it.targetVolume * 100) : 0;
                return (
                  <tr key={it.id} style={{ background: rowBg }}>
                    <td style={{ ...tdS, fontWeight: 800, color: 'var(--br)', padding: '4px 6px', fontSize: '0.8rem' }}>{it.thickness}</td>
                    <td style={{ ...tdS, padding: '4px 4px', fontSize: '0.68rem' }}>
                      <span style={{ padding: '1px 5px', borderRadius: 4, background: it.quality === 'Đẹp' ? 'rgba(39,174,96,0.12)' : 'rgba(41,128,185,0.12)', color: it.quality === 'Đẹp' ? '#27AE60' : '#2980b9', fontWeight: 700 }}>{it.quality}</span>
                    </td>
                    <td style={{ ...tdS, padding: '4px 4px' }}>
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: it.priority === 'urgent' ? '#C0392B' : it.priority === 'soon' ? '#F59E0B' : 'var(--bd)' }} />
                    </td>
                    {viewMode === 'compact' && (
                      <td style={{ ...tdS, padding: '4px 6px', minWidth: 100 }}>
                        <div style={{ height: 5, borderRadius: 3, background: 'var(--bd)', overflow: 'hidden' }}>
                          <div style={{ width: pct + '%', height: '100%', background: it.priority === 'urgent' ? '#C0392B' : 'var(--ac)', borderRadius: 3 }} />
                        </div>
                      </td>
                    )}
                    <td style={{ ...tdS, textAlign: 'right', fontSize: '0.68rem', padding: '4px 6px', whiteSpace: 'nowrap' }}>
                      <span style={{ color: 'var(--gn)', fontWeight: 700 }}>{fmtNum(it.doneVolume, 1)}</span>
                      <span style={{ color: 'var(--tm)' }}>/{fmtNum(it.targetVolume, 1)}</span>
                    </td>
                    <td style={{ ...tdS, padding: '4px 4px' }}>
                      <input type="number" step="0.1" min="0"
                        value={volumes[it.id] || ''}
                        onChange={e => setVolumes(p => ({ ...p, [it.id]: e.target.value }))}
                        placeholder="0"
                        style={{ width: '100%', padding: '4px 6px', borderRadius: 5, border: `1.5px solid ${volumes[it.id] ? 'var(--ac)' : 'var(--bd)'}`, fontSize: '0.8rem', fontWeight: 700, textAlign: 'center', color: 'var(--ac)', background: 'var(--bgc)', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </td>
                    {viewMode === 'compact' && (
                      <td style={{ ...tdS, fontSize: '0.62rem', color: 'var(--ts)', padding: '4px 6px' }}>
                        {it.note || '—'}
                        {it.priority !== 'normal' && <span style={{ marginLeft: 4, color: pri.color, fontWeight: 700 }}>{pri.label}</span>}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Card view (mặc định) ── */}
      {viewMode === 'card' && batchItems.map(it => {
        const remaining = Math.max(0, it.targetVolume - it.doneVolume);
        const pri = PRIORITY_CFG[it.priority] || PRIORITY_CFG.normal;
        const rowBg = it.priority === 'urgent' ? 'rgba(192,57,43,0.06)' : it.priority === 'soon' ? 'rgba(245,158,11,0.06)' : 'var(--bgc)';
        return (
          <div key={it.id} style={{ ...cardS, marginBottom: 10, background: rowBg, borderColor: it.priority === 'urgent' ? 'rgba(192,57,43,0.3)' : it.priority === 'soon' ? 'rgba(245,158,11,0.3)' : 'var(--bd)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--br)' }}>{it.thickness}</span>
                <span style={{ fontWeight: 700, fontSize: '0.72rem', padding: '2px 7px', borderRadius: 5, background: it.quality === 'Đẹp' ? 'rgba(39,174,96,0.12)' : 'rgba(41,128,185,0.12)', color: it.quality === 'Đẹp' ? '#27AE60' : '#2980b9' }}>{it.quality}</span>
                <PriBadge priority={it.priority} />
              </div>
              <span style={{ fontSize: '0.65rem', color: 'var(--ts)' }}>còn {fmtNum(remaining, 1)} m³</span>
            </div>
            <ProgressBar done={it.doneVolume} target={it.targetVolume} priority={it.priority} />
            {it.note && <div style={{ fontSize: '0.66rem', color: pri.color, fontStyle: 'italic', marginTop: 4, fontWeight: it.priority !== 'normal' ? 700 : 400 }}>{it.note}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <label style={{ ...labelS, color: 'var(--ac)', fontWeight: 800 }}>Xẻ thêm hôm nay (m³)</label>
                <input
                  type="number" step="0.1" min="0"
                  value={volumes[it.id] || ''}
                  onChange={e => setVolumes(p => ({ ...p, [it.id]: e.target.value }))}
                  placeholder="0.0"
                  style={{ ...inpS, fontSize: '1.1rem', fontWeight: 700, textAlign: 'center', color: 'var(--ac)', borderColor: volumes[it.id] ? 'var(--ac)' : 'var(--bd)' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelS}>Ghi chú</label>
                <input
                  value={notes[it.id] || ''}
                  onChange={e => setNotes(p => ({ ...p, [it.id]: e.target.value }))}
                  placeholder="Tùy chọn"
                  style={inpS}
                />
              </div>
            </div>
          </div>
        );
      })}

      {batchItems.length > 0 && (
        <button onClick={handleSubmit} disabled={submitting} style={{ ...btnP, width: '100%', padding: '12px', fontSize: '0.9rem', marginBottom: 20 }}>
          {submitting ? 'Đang lưu...' : `Lưu tiến độ ngày ${logDate}`}
        </button>
      )}

      {/* Lịch sử nhật ký gần đây */}
      {recentLogs.length > 0 && (
        <div style={{ ...cardS }}>
          <div style={{ fontWeight: 700, fontSize: '0.78rem', marginBottom: 8 }}>Nhật ký gần đây</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bgh)' }}>
                <th style={thS}>Ngày</th>
                <th style={thS}>Mã</th>
                <th style={{ ...thS, textAlign: 'right' }}>+m³</th>
                <th style={thS}>Người</th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.map(log => {
                const it = batchItems.find(i => i.id === log.sawingItemId);
                return (
                  <tr key={log.id}>
                    <td style={{ ...tdS, fontSize: '0.68rem', color: 'var(--ts)' }}>{fmtDate(log.logDate)}</td>
                    <td style={{ ...tdS, fontWeight: 700 }}>{it ? `${it.thickness} ${it.quality}` : '—'}</td>
                    <td style={{ ...tdS, textAlign: 'right', color: 'var(--gn)', fontWeight: 700 }}>+{fmtNum(log.addedVolume, 2)}</td>
                    <td style={{ ...tdS, fontSize: '0.68rem', color: 'var(--ts)' }}>{log.loggedBy || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB 3: GỖ TRÒN ĐẦU VÀO
// Dùng raw_wood_inspection (không phải packing_list)
// Chọn cây → status=sawn, sawing_batch_id=batchId
// ══════════════════════════════════════════════════════════════
function TabGoTron({ batches, wts, rawWoodTypes, useAPI, notify, user }) {
  const [selBatchId, setSelBatchId]   = useState('');
  const [containers, setContainers]   = useState([]);     // containers có nghiệm thu
  const [selectedLogs, setSelectedLogs] = useState([]);  // inspection pieces đã chọn cho batch
  const [inspLists, setInspLists]     = useState({});    // contId → [{inspection piece}]
  const [loadingContId, setLoadingContId] = useState(null);
  const [expandedContId, setExpandedContId] = useState(null);
  const [pendingChanges, setPendingChanges] = useState({}); // id → 'select'|'deselect'
  const [saving, setSaving]           = useState(false);

  const wtMap = useMemo(() => Object.fromEntries(rawWoodTypes.map(w => [w.id, w])), [rawWoodTypes]);
  const sawingBatches = useMemo(() => batches.filter(b => b.status === 'sawing'), [batches]);

  useEffect(() => {
    if (!sawingBatches.length) return;
    if (!selBatchId || !sawingBatches.find(b => b.id === selBatchId))
      setSelBatchId(sawingBatches[0]?.id || '');
  }, [sawingBatches, selBatchId]);

  const selBatch    = sawingBatches.find(b => b.id === selBatchId);
  const batchWoodId = selBatch?.woodId || null;

  // Load containers có nghiệm thu
  const loadContainers = useCallback(async () => {
    if (!useAPI) return;
    const api = await import('../api.js');
    const data = await api.fetchRawContainersWithInspection().catch(() => []);
    setContainers(data);
  }, [useAPI]);

  // Load inspection pieces đã chọn cho batch
  const loadSelectedLogs = useCallback(async (batchId) => {
    if (!useAPI || !batchId) { setSelectedLogs([]); return; }
    const api = await import('../api.js');
    const logs = await api.fetchSelectedInspLogsForBatch(batchId).catch(() => []);
    setSelectedLogs(logs);
  }, [useAPI]);

  useEffect(() => { loadContainers(); }, [loadContainers]);
  useEffect(() => { loadSelectedLogs(selBatchId); setPendingChanges({}); }, [loadSelectedLogs, selBatchId]);

  // Filter containers theo loại gỗ của batch
  const filteredConts = useMemo(() => {
    if (!batchWoodId) return containers;
    return containers.filter(c => !c.rawWoodTypeId || c.rawWoodTypeId === batchWoodId);
  }, [containers, batchWoodId]);

  const selectedMap = useMemo(() => Object.fromEntries(selectedLogs.map(l => [l.id, l])), [selectedLogs]);
  const pendingSelect   = useMemo(() => Object.entries(pendingChanges).filter(([, v]) => v === 'select').map(([id]) => id), [pendingChanges]);
  const pendingDeselect = useMemo(() => Object.entries(pendingChanges).filter(([, v]) => v === 'deselect').map(([id]) => id), [pendingChanges]);
  const pdSet = useMemo(() => new Set(pendingDeselect), [pendingDeselect]);
  const psSet = useMemo(() => new Set(pendingSelect), [pendingSelect]);

  const totalVol = useMemo(() => {
    const selVol  = selectedLogs.filter(l => !pdSet.has(l.id)).reduce((s, l) => s + (l.volumeM3 || 0), 0);
    const pendVol = pendingSelect.reduce((s, id) => {
      for (const pl of Object.values(inspLists)) {
        const found = pl.find(l => l.id === id);
        if (found) return s + (found.volumeM3 || 0);
      }
      return s;
    }, 0);
    return selVol + pendVol;
  }, [selectedLogs, pdSet, pendingSelect, inspLists]);

  // Expand container → load inspection pieces
  const handleExpand = useCallback(async (contId) => {
    if (expandedContId === contId) { setExpandedContId(null); return; }
    setExpandedContId(contId);
    if (inspLists[contId]) return;
    setLoadingContId(contId);
    const api = await import('../api.js');
    const rows = await api.fetchRawWoodInspection(contId).catch(() => []);
    setInspLists(p => ({ ...p, [contId]: rows }));
    setLoadingContId(null);
  }, [expandedContId, inspLists]);

  // Toggle 1 cây inspection
  const toggleLog = useCallback((piece) => {
    const inBatch  = !!selectedMap[piece.id];
    const isPSel   = pendingChanges[piece.id] === 'select';
    const isPDesel = pendingChanges[piece.id] === 'deselect';
    if (inBatch) {
      setPendingChanges(p => isPDesel
        ? (({ [piece.id]: _, ...rest }) => rest)(p)
        : ({ ...p, [piece.id]: 'deselect' }));
    } else if (isPSel) {
      setPendingChanges(p => (({ [piece.id]: _, ...rest }) => rest)(p));
    } else if (piece.status === 'available' && !piece.isMissing) {
      // Chỉ cho chọn piece available và không phải cây thiếu
      setPendingChanges(p => ({ ...p, [piece.id]: 'select' }));
    }
  }, [selectedMap, pendingChanges]);

  // Chọn tất cả available trong cont
  const toggleAllContainer = useCallback((contId) => {
    const pl = inspLists[contId];
    if (!pl) { notify('Mở danh sách container trước để xem nghiệm thu', false); return; }
    const free     = pl.filter(l => l.status === 'available' && !l.isMissing && !psSet.has(l.id));
    const inBatch  = pl.filter(l => selectedMap[l.id]);
    const pendSel  = pl.filter(l => psSet.has(l.id));
    if (free.length === 0 && pendSel.length > 0) {
      setPendingChanges(p => { const n = { ...p }; pendSel.forEach(l => delete n[l.id]); return n; });
      return;
    }
    setPendingChanges(p => {
      const n = { ...p };
      free.forEach(l => { n[l.id] = 'select'; });
      inBatch.filter(l => n[l.id] === 'deselect').forEach(l => delete n[l.id]);
      return n;
    });
  }, [inspLists, selectedMap, psSet, notify]);

  // Bỏ chọn tất cả trong cont
  const deselectAllContainer = useCallback((contId) => {
    const pl = inspLists[contId] || [];
    const inBatch = pl.filter(l => selectedMap[l.id]);
    const pendSel = pl.filter(l => psSet.has(l.id));
    setPendingChanges(p => {
      const n = { ...p };
      inBatch.forEach(l => { n[l.id] = 'deselect'; });
      pendSel.forEach(l => delete n[l.id]);
      return n;
    });
  }, [inspLists, selectedMap, psSet]);

  // Lưu — cập nhật status inspection pieces
  const handleSave = useCallback(async () => {
    if (!pendingSelect.length && !pendingDeselect.length) return;
    setSaving(true);
    const api = await import('../api.js');

    const [resSelect, resDesel] = await Promise.all([
      pendingSelect.length   ? api.selectInspLogsForSawing(pendingSelect, selBatchId)   : Promise.resolve({ success: true }),
      pendingDeselect.length ? api.deselectInspLogsFromSawing(pendingDeselect) : Promise.resolve({ success: true }),
    ]);

    const selErr  = resSelect?.error;
    const deselErr = resDesel?.error;
    if (selErr || deselErr) {
      setSaving(false);
      notify('Lỗi: ' + (selErr || deselErr), false);
      return;
    }

    const needsMigration = resSelect?.needsMigration || resDesel?.needsMigration;

    setPendingChanges({});
    // Reload affected inspection lists
    const affectedCids = new Set([
      ...pendingSelect.map(id => {
        for (const [cid, pl] of Object.entries(inspLists)) if (pl.find(l => l.id === id)) return cid;
        return null;
      }).filter(Boolean),
      ...selectedLogs.filter(l => pdSet.has(l.id)).map(l => String(l.containerId)),
    ]);
    const reloads = [...affectedCids].map(async cid => {
      const rows = await api.fetchRawWoodInspection(parseInt(cid)).catch(() => null);
      if (rows) setInspLists(p => ({ ...p, [parseInt(cid)]: rows }));
    });
    await Promise.all(reloads);
    await loadSelectedLogs(selBatchId);
    await loadContainers();
    setSaving(false);
    if (needsMigration) {
      notify(`Đã lưu (status cây đã cập nhật). Cần chạy migration SQL để lưu sawing_batch_id đầy đủ.`, true);
    } else {
      notify(`Đã lưu: +${pendingSelect.length} cây Đã xẻ, -${pendingDeselect.length} hoàn lại`);
    }
  }, [pendingSelect, pendingDeselect, selBatchId, inspLists, selectedLogs, pdSet, loadSelectedLogs, loadContainers, notify]);

  const hasPending = pendingSelect.length + pendingDeselect.length > 0;

  if (!sawingBatches.length) return (
    <div style={{ ...cardS, textAlign: 'center', color: 'var(--tm)', padding: 32 }}>
      Không có mẻ xẻ đang chạy. Tạo mẻ xẻ mới ở tab Kế hoạch xẻ.
    </div>
  );

  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {/* ── Cột trái: Summary ── */}
      <div style={{ flex: '0 0 270px', minWidth: 240 }}>
        <div style={{ ...cardS, marginBottom: 10 }}>
          <div style={{ marginBottom: 8 }}>
            <label style={labelS}>Mẻ xẻ</label>
            <select value={selBatchId} onChange={e => { setSelBatchId(e.target.value); setPendingChanges({}); }} style={inpS}>
              {sawingBatches.map(b => <option key={b.id} value={b.id}>{b.batchCode} — {wtMap[b.woodId]?.name}</option>)}
            </select>
          </div>
          <div style={{ padding: '8px 10px', borderRadius: 7, background: 'var(--bgs)', marginBottom: 10 }}>
            <div style={{ fontSize: '0.63rem', color: 'var(--ts)', marginBottom: 2 }}>Đã đưa vào xẻ</div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--br)' }}>{fmtNum(totalVol, 3)} m³</div>
            <div style={{ fontSize: '0.63rem', color: 'var(--ts)', marginTop: 1 }}>
              {selectedLogs.filter(l => !pdSet.has(l.id)).length + pendingSelect.length} cây · status = Đã xẻ
            </div>
          </div>
          {hasPending && (
            <div style={{ padding: '6px 10px', borderRadius: 6, background: 'rgba(242,101,34,0.08)', border: '1px solid rgba(242,101,34,0.3)', marginBottom: 8, fontSize: '0.68rem', color: 'var(--ac)' }}>
              <strong>+{pendingSelect.length}</strong> chờ đánh dấu Đã xẻ · <strong>-{pendingDeselect.length}</strong> chờ hoàn lại
            </div>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            {hasPending && <button onClick={() => setPendingChanges({})} style={{ ...btnSec, flex: 1, padding: '6px 8px' }}>Huỷ</button>}
            <button onClick={handleSave} disabled={!hasPending || saving}
              style={{ ...btnP, flex: 1, padding: '6px 8px', opacity: hasPending ? 1 : 0.4 }}>
              {saving ? 'Đang lưu...' : 'Lưu — Đánh dấu Đã xẻ'}
            </button>
          </div>
        </div>

        {/* Danh sách cây đã xẻ */}
        {selectedLogs.length > 0 && (
          <div style={{ ...cardS, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', fontWeight: 700, fontSize: '0.74rem', borderBottom: '1px solid var(--bd)', color: '#2980b9' }}>
              Đã xẻ ({selectedLogs.length} cây)
            </div>
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              {selectedLogs.map(l => {
                const isPDesel = pdSet.has(l.id);
                const cont = containers.find(c => c.id === l.containerId);
                return (
                  <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 10px', borderBottom: '1px solid var(--bd)', opacity: isPDesel ? 0.4 : 1, textDecoration: isPDesel ? 'line-through' : 'none' }}>
                    <div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--tp)' }}>{l.pieceCode || '—'}</span>
                      {cont && <div style={{ fontSize: '0.58rem', color: 'var(--ts)' }}>{cont.containerCode}</div>}
                    </div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#2980b9', minWidth: 50, textAlign: 'right' }}>
                      {fmtNum(l.volumeM3, 3)} m³
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Hướng dẫn */}
        <div style={{ ...cardS, marginTop: 10, fontSize: '0.66rem', color: 'var(--ts)', lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--brl)' }}>Lưu ý</div>
          Chỉ hiện containers đã có <strong>nghiệm thu</strong>. Nếu chưa nghiệm thu, vào module <em>Gỗ nguyên liệu → tab Nghiệm thu</em> và dùng nút <em>"Copy từ Packing List"</em>.
        </div>
      </div>

      {/* ── Cột phải: Containers + checkbox inspection ── */}
      <div style={{ flex: 1, minWidth: 320 }}>
        <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: 8, color: 'var(--br)' }}>
          Gỗ nguyên liệu tồn kho (đã nghiệm thu)
          {batchWoodId && <span style={{ marginLeft: 8, fontSize: '0.68rem', color: 'var(--ts)', fontWeight: 500 }}>· {wtMap[batchWoodId]?.name}</span>}
        </div>
        {filteredConts.length === 0
          ? <div style={{ ...cardS, textAlign: 'center', color: 'var(--tm)', padding: 20 }}>
              Không có container nào đã nghiệm thu{batchWoodId ? ' cho loại gỗ này' : ''}
            </div>
          : filteredConts.map(cont => {
            const insp    = cont.inspection;
            const pl      = inspLists[cont.id] || null;
            const isExp   = expandedContId === cont.id;
            const isLoading = loadingContId === cont.id;
            const selInCont = selectedLogs.filter(l => l.containerId === cont.id && !pdSet.has(l.id)).length
              + (pl ? pl.filter(l => psSet.has(l.id)).length : 0);
            const pct = insp.totalVol > 0 ? Math.min(100, insp.availVol / insp.totalVol * 100) : 0;
            const invKey = getContainerInvStatus(insp);
            const invCfg = INV_STATUS[invKey];

            return (
              <div key={cont.id} style={{ ...cardS, marginBottom: 8, padding: 0, overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  <div onClick={() => handleExpand(cont.id)} style={{ cursor: 'pointer', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontWeight: 800, fontSize: '0.84rem', color: 'var(--br)' }}>{cont.containerCode}</span>
                      <span style={{ padding: '1px 7px', borderRadius: 8, fontSize: '0.62rem', fontWeight: 700, background: invCfg.bg, color: invCfg.color }}>
                        {invCfg.short}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.64rem', color: 'var(--ts)', marginBottom: 3 }}>
                      {fmtDate(cont.arrivalDate)} · {insp.total} cây
                      <span style={{ color: 'var(--gn)', fontWeight: 700 }}> · còn {insp.available}</span>
                      {insp.sawn > 0 && <span style={{ color: '#2980b9' }}> · đã xẻ {insp.sawn}</span>}
                      {insp.sold > 0 && <span style={{ color: '#8B5E3C' }}> · đã bán {insp.sold}</span>}
                      {selInCont > 0 && <span style={{ color: 'var(--ac)', fontWeight: 700 }}> · đang chọn {selInCont}</span>}
                    </div>
                    <div style={{ height: 5, borderRadius: 3, background: 'var(--bd)', overflow: 'hidden', width: 140, marginBottom: 2 }}>
                      <div style={{ width: pct + '%', height: '100%', background: pct < 20 ? 'var(--dg)' : 'var(--gn)', borderRadius: 3 }} />
                    </div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--ts)' }}>
                      Tồn: <strong style={{ color: 'var(--gn)' }}>{fmtNum(insp.availVol, 2)} m³</strong> / {fmtNum(insp.totalVol, 2)} m³
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <button onClick={() => { if (!isExp) handleExpand(cont.id); else toggleAllContainer(cont.id); }}
                      style={{ ...btnSec, padding: '4px 10px', fontSize: '0.65rem', color: 'var(--gn)', borderColor: 'var(--gn)' }}>
                      ✓ Chọn cả
                    </button>
                    {selInCont > 0 && (
                      <button onClick={() => deselectAllContainer(cont.id)}
                        style={{ ...btnSec, padding: '4px 10px', fontSize: '0.65rem', color: 'var(--dg)', borderColor: 'var(--dg)' }}>
                        ✕ Bỏ cả
                      </button>
                    )}
                    <span onClick={() => handleExpand(cont.id)}
                      style={{ padding: '4px 8px', cursor: 'pointer', color: 'var(--tm)', fontSize: '0.8rem' }}>
                      {isExp ? '▲' : '▼'}
                    </span>
                  </div>
                </div>

                {/* Inspection pieces (expand) */}
                {isExp && (
                  <div style={{ borderTop: '1px solid var(--bd)', background: 'var(--bgs)' }}>
                    {isLoading
                      ? <div style={{ padding: 14, textAlign: 'center', color: 'var(--tm)', fontSize: '0.72rem' }}>Đang tải...</div>
                      : !pl || pl.length === 0
                        ? <div style={{ padding: 14, textAlign: 'center', color: 'var(--tm)', fontSize: '0.72rem' }}>Không có bản ghi nghiệm thu</div>
                        : (
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ background: 'var(--bgh)' }}>
                                  <th style={{ ...thS, fontSize: '0.6rem', width: 32, textAlign: 'center' }}>✓</th>
                                  <th style={{ ...thS, fontSize: '0.6rem' }}>Mã cây</th>
                                  <th style={{ ...thS, fontSize: '0.6rem', textAlign: 'right' }}>Dài (m)</th>
                                  <th style={{ ...thS, fontSize: '0.6rem', textAlign: 'right' }}>ĐK (cm)</th>
                                  <th style={{ ...thS, fontSize: '0.6rem', textAlign: 'right' }}>m³</th>
                                  <th style={{ ...thS, fontSize: '0.6rem' }}>CL</th>
                                  <th style={{ ...thS, fontSize: '0.6rem' }}>Trạng thái</th>
                                </tr>
                              </thead>
                              <tbody>
                                {pl.filter(p => !p.isMissing).map(piece => {
                                  const inBatch   = !!selectedMap[piece.id];
                                  const isOther   = piece.status === 'sawn' && !inBatch;  // đã xẻ bởi mẻ khác
                                  const isSold    = piece.status === 'sold';
                                  const isDisabled = isOther || isSold;
                                  const isPSel    = psSet.has(piece.id);
                                  const isPDesel  = pdSet.has(piece.id);
                                  const checked   = isPSel ? true : isPDesel ? false : inBatch;
                                  const rowBg     = isSold ? 'rgba(107,66,38,0.04)' : isOther ? 'rgba(41,128,185,0.05)' : checked ? 'rgba(39,174,96,0.07)' : isPDesel ? 'rgba(192,57,43,0.04)' : undefined;
                                  return (
                                    <tr key={piece.id} style={{ background: rowBg, opacity: isDisabled ? 0.55 : 1 }}
                                      onClick={!isDisabled ? () => toggleLog(piece) : undefined}
                                      title={isOther ? 'Đã xẻ bởi mẻ khác' : isSold ? 'Đã bán' : undefined}>
                                      <td style={{ ...tdS, textAlign: 'center', cursor: isDisabled ? 'not-allowed' : 'pointer' }}>
                                        <input type="checkbox" readOnly checked={checked} disabled={isDisabled}
                                          style={{ cursor: isDisabled ? 'not-allowed' : 'pointer', accentColor: 'var(--gn)', width: 15, height: 15 }} />
                                      </td>
                                      <td style={{ ...tdS, fontSize: '0.7rem', fontWeight: 600, cursor: isDisabled ? 'default' : 'pointer' }}>{piece.pieceCode || '—'}</td>
                                      <td style={{ ...tdS, textAlign: 'right', fontSize: '0.68rem' }}>{piece.lengthM ?? '—'}</td>
                                      <td style={{ ...tdS, textAlign: 'right', fontSize: '0.68rem' }}>{piece.diameterCm ?? piece.circumferenceCm ?? '—'}</td>
                                      <td style={{ ...tdS, textAlign: 'right', fontWeight: 700, fontSize: '0.7rem' }}>{fmtNum(piece.volumeM3, 3)}</td>
                                      <td style={{ ...tdS, fontSize: '0.66rem' }}>{piece.quality || '—'}</td>
                                      <td style={{ ...tdS, fontSize: '0.62rem' }}>
                                        {isPSel    ? <span style={{ color: 'var(--gn)', fontWeight: 700 }}>→ Đánh dấu Đã xẻ</span>
                                         : isPDesel ? <span style={{ color: 'var(--dg)', fontWeight: 700 }}>← Hoàn lại</span>
                                         : inBatch  ? <span style={{ color: '#2980b9', fontWeight: 700 }}>✓ Đã xẻ (mẻ này)</span>
                                         : isOther  ? <span style={{ color: '#2980b9' }}>Đã xẻ</span>
                                         : isSold   ? <span style={{ color: '#8B5E3C' }}>Đã bán</span>
                                         : <span style={{ color: 'var(--gn)', fontWeight: 600 }}>Còn lại</span>}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot>
                                <tr style={{ background: 'var(--bgc)' }}>
                                  <td colSpan={4} style={{ ...tdS, fontWeight: 700, fontSize: '0.66rem' }}>
                                    {pl.filter(l => l.status === 'available').length} còn lại / {pl.length} tổng
                                  </td>
                                  <td style={{ ...tdS, textAlign: 'right', fontWeight: 800, fontSize: '0.68rem', color: 'var(--gn)' }}>
                                    {fmtNum(pl.filter(l => l.status === 'available').reduce((s, l) => s + (l.volumeM3 || 0), 0), 3)} m³
                                  </td>
                                  <td colSpan={2} style={tdS}></td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        )
                    }
                  </div>
                )}
              </div>
            );
          })
        }
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN: PgSawing
// ══════════════════════════════════════════════════════════════
export default function PgSawing({ wts, useAPI, notify, user }) {
  const [tab, setTab]               = useState('plan');
  const [batches, setBatches]       = useState([]);
  const [items, setItems]           = useState([]);
  const [rawWoodTypes, setRawWoodTypes] = useState([]);
  const [loading, setLoading]       = useState(true);

  const loadData = useCallback(async () => {
    if (!useAPI) { setLoading(false); return; }
    const api = await import('../api.js');
    const [bs, its, rwts] = await Promise.all([
      api.fetchSawingBatches().catch(() => []),
      api.fetchSawingItems().catch(() => []),
      api.fetchRawWoodTypes().catch(() => []),
    ]);
    setBatches(bs);
    setItems(its);
    setRawWoodTypes(rwts);
    setLoading(false);
  }, [useAPI]);

  useEffect(() => { loadData(); }, [loadData]);

  const TABS = [
    { key: 'plan',   label: 'Kế hoạch xẻ' },
    { key: 'update', label: 'Cập nhật tiến độ' },
    { key: 'input',  label: 'Gỗ tròn đầu vào' },
  ];

  const sawingCount = batches.filter(b => b.status === 'sawing').length;

  return (
    <div style={{ padding: '16px 12px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--br)' }}>Xẻ gỗ</h2>
        {sawingCount > 0 && (
          <span style={{ padding: '2px 8px', borderRadius: 8, background: 'rgba(242,101,34,0.12)', color: 'var(--ac)', fontSize: '0.72rem', fontWeight: 700 }}>
            {sawingCount} mẻ đang chạy
          </span>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '2px solid var(--bd)', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '7px 16px', border: 'none', borderRadius: '6px 6px 0 0',
            fontSize: '0.76rem', fontWeight: tab === t.key ? 700 : 500, cursor: 'pointer',
            background: tab === t.key ? 'var(--bgc)' : 'transparent',
            color: tab === t.key ? 'var(--ac)' : 'var(--ts)',
            borderBottom: tab === t.key ? '2px solid var(--ac)' : '2px solid transparent',
            marginBottom: -2,
          }}>{t.label}</button>
        ))}
      </div>

      {loading
        ? <div style={{ textAlign: 'center', color: 'var(--tm)', padding: 40 }}>Đang tải...</div>
        : tab === 'plan'   ? <TabKiHoach batches={batches} items={items} wts={wts} rawWoodTypes={rawWoodTypes} useAPI={useAPI} notify={notify} user={user} onRefresh={loadData} />
        : tab === 'update' ? <TabCapNhat batches={batches} items={items} wts={wts} rawWoodTypes={rawWoodTypes} useAPI={useAPI} notify={notify} user={user} onRefresh={loadData} />
        : <TabGoTron batches={batches} wts={wts} rawWoodTypes={rawWoodTypes} useAPI={useAPI} notify={notify} user={user} />
      }
    </div>
  );
}
