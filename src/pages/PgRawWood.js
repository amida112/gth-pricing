import React, { useState, useEffect, useMemo, useCallback } from "react";

const LOT_STATUSES = ["Mới nhập", "Đang kiểm đếm", "Sẵn sàng", "Đang xử lý", "Hoàn tất"];
const DISPOSITIONS = [
  { value: "pending", label: "Chờ xử lý" },
  { value: "sell_whole", label: "Bán nguyên cont" },
  { value: "process_all", label: "Xẻ sấy toàn bộ" },
  { value: "partial", label: "Bóc lẻ" },
];

function calcVolume(woodForm, length, diameter, circumference, width, thickness) {
  const L = parseFloat(length) || 0;
  if (!L) return 0;
  if (woodForm === 'box') {
    const W = parseFloat(width) || 0;
    const T = parseFloat(thickness) || 0;
    return (W && T) ? L * (W / 100) * (T / 100) : 0;
  }
  const D = parseFloat(diameter);
  const C = parseFloat(circumference);
  if (D > 0) return Math.PI / 4 * Math.pow(D / 100, 2) * L;
  if (C > 0) return Math.pow(C / 100, 2) / (4 * Math.PI) * L;
  return 0;
}

const statusColor = (s) => {
  if (s === "Hoàn tất" || s === "Đã xẻ xong") return "var(--gn)";
  if (s === "Đang xử lý" || s === "Đang xẻ") return "#2980b9";
  if (s === "Sẵn sàng" || s === "Chờ xẻ") return "var(--ac)";
  if (s === "Đã bán") return "#6B4226";
  return "var(--ts)";
};
const statusBg = (s) => {
  if (s === "Hoàn tất" || s === "Đã xẻ xong") return "rgba(50,79,39,0.1)";
  if (s === "Đang xử lý" || s === "Đang xẻ") return "rgba(41,128,185,0.1)";
  if (s === "Sẵn sàng" || s === "Chờ xẻ") return "rgba(242,101,34,0.08)";
  if (s === "Đã bán") return "rgba(107,66,38,0.1)";
  return "var(--bgs)";
};

export default function PgRawWood({ suppliers, customers, supplierAssignments = [], ce, useAPI, notify }) {
  const [woodTypes, setWoodTypes] = useState([]);
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expId, setExpId] = useState(null);
  const [items, setItems] = useState({});
  const [filterWood, setFilterWood] = useState("");
  const [filterForm, setFilterForm] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [lotEd, setLotEd] = useState(null);
  const [lotFm, setLotFm] = useState({ woodTypeId: "", supplierId: "", quality: "", notes: "" });
  const [addingItems, setAddingItems] = useState(false);
  const [newRows, setNewRows] = useState([]);

  // Wood type CRUD
  const [showTypeMgr, setShowTypeMgr] = useState(false);
  const [typeEd, setTypeEd] = useState(null);
  const [typeFm, setTypeFm] = useState({ name: "", woodForm: "round", icon: "🪵" });

  useEffect(() => {
    if (!useAPI) { setLoading(false); return; }
    Promise.all([
      import('../api.js').then(api => api.fetchRawWoodTypes()),
      import('../api.js').then(api => api.fetchRawWoodLots()),
    ]).then(([types, data]) => { setWoodTypes(types); setLots(data); setLoading(false); })
      .catch(e => { notify("Lỗi tải dữ liệu: " + e.message, false); setLoading(false); });
  }, [useAPI, notify]);

  const loadItems = useCallback((lotId) => {
    if (items[lotId] !== undefined) return;
    if (!useAPI) { setItems(p => ({ ...p, [lotId]: [] })); return; }
    import('../api.js').then(api => api.fetchRawWoodItems(lotId))
      .then(data => setItems(p => ({ ...p, [lotId]: data })))
      .catch(() => {});
  }, [items, useAPI]);

  // Get woodForm from lot's wood type
  const getWoodForm = (lot) => {
    const wt = woodTypes.find(w => w.id === lot?.woodTypeId);
    return wt?.woodForm || 'round';
  };

  const stats = useMemo(() => {
    const all = Object.values(items).flat();
    const inStock = all.filter(i => i.status === "Trong kho");
    const waiting = all.filter(i => i.status === "Chờ xẻ");
    const sold = all.filter(i => i.status === "Đã bán");
    const sawn = all.filter(i => ["Đang xẻ", "Đã xẻ xong"].includes(i.status));
    const sum = arr => arr.reduce((s, i) => s + (i.volume || 0), 0);
    return { inStock: { count: inStock.length, vol: sum(inStock) }, waiting: { count: waiting.length, vol: sum(waiting) }, sold: { count: sold.length, vol: sum(sold) }, sawn: { count: sawn.length, vol: sum(sawn) } };
  }, [items]);

  const filteredTypes = useMemo(() => filterForm ? woodTypes.filter(w => w.woodForm === filterForm) : woodTypes, [woodTypes, filterForm]);

  const visList = useMemo(() => {
    let arr = [...lots];
    if (filterWood) arr = arr.filter(l => l.woodTypeId === filterWood);
    else if (filterForm) { const ids = new Set(filteredTypes.map(w => w.id)); arr = arr.filter(l => ids.has(l.woodTypeId)); }
    if (filterStatus) arr = arr.filter(l => l.status === filterStatus);
    return arr;
  }, [lots, filterWood, filterForm, filterStatus, filteredTypes]);

  const toggleExp = (id) => {
    if (expId === id) { setExpId(null); setAddingItems(false); setSelected(new Set()); return; }
    setExpId(id); setAddingItems(false); setSelected(new Set()); loadItems(id);
  };

  // ── Lot CRUD ──
  const addLot = () => { setLotFm({ woodTypeId: woodTypes[0]?.id || "", supplierId: "", quality: "", notes: "" }); setLotEd("new"); };
  const saveLot = () => {
    if (!lotFm.woodTypeId) { notify("Chọn loại gỗ", false); return; }
    const wt = woodTypes.find(w => w.id === lotFm.woodTypeId);
    if (lotEd === "new") {
      const tmp = { id: "tmp_" + Date.now(), lotCode: "...", woodForm: wt?.woodForm || "round", woodTypeId: lotFm.woodTypeId, supplierId: lotFm.supplierId, quality: lotFm.quality, totalPieces: 0, totalVolume: 0, disposition: "pending", status: "Mới nhập", notes: lotFm.notes };
      setLots(p => [tmp, ...p]);
      if (useAPI) import('../api.js').then(api => api.addRawWoodLot(wt?.woodForm || "round", lotFm.woodTypeId, lotFm.supplierId, lotFm.quality, null, null, lotFm.notes))
        .then(r => {
          if (r?.error) { notify("Lỗi: " + r.error, false); setLots(p => p.filter(x => x.id !== tmp.id)); return; }
          setLots(p => p.map(x => x.id === tmp.id ? { ...x, id: r.id, lotCode: r.lotCode } : x));
          notify("Đã thêm lô " + r.lotCode);
        }).catch(e => notify("Lỗi: " + e.message, false));
    } else {
      setLots(p => p.map(x => x.id === lotEd ? { ...x, woodTypeId: lotFm.woodTypeId, supplierId: lotFm.supplierId, quality: lotFm.quality, notes: lotFm.notes } : x));
      if (useAPI) import('../api.js').then(api => api.updateRawWoodLot(lotEd, lotFm))
        .then(r => { if (r?.error) notify("Lỗi: " + r.error, false); }).catch(e => notify("Lỗi: " + e.message, false));
    }
    setLotEd(null);
  };
  const editLot = (lot) => { setLotFm({ woodTypeId: lot.woodTypeId || "", supplierId: lot.supplierId || "", quality: lot.quality || "", notes: lot.notes || "" }); setLotEd(lot.id); };
  const deleteLot = (lot) => {
    if ((items[lot.id] || []).length > 0) { notify(`Không thể xóa — lô có ${(items[lot.id] || []).length} mục.`, false); return; }
    if (!window.confirm(`Xóa lô ${lot.lotCode}?`)) return;
    setLots(p => p.filter(x => x.id !== lot.id)); if (expId === lot.id) setExpId(null);
    if (useAPI) import('../api.js').then(api => api.deleteRawWoodLot(lot.id));
  };
  const updateLotField = (id, field, value) => {
    setLots(p => p.map(l => l.id === id ? { ...l, [field]: value } : l));
    if (useAPI) import('../api.js').then(api => api.updateRawWoodLot(id, { [field]: value }));
  };

  // ── Items ──
  const addEmptyRow = (wf) => setNewRows(p => [...p, { _id: Date.now(), itemCode: "", length: "", diameter: "", circumference: "", width: "", thickness: "", quality: "", notes: "" }]);
  const updateNewRow = (idx, f, v) => setNewRows(p => p.map((r, i) => i === idx ? { ...r, [f]: v } : r));
  const removeNewRow = (idx) => setNewRows(p => p.filter((_, i) => i !== idx));

  const saveNewItems = (lotId) => {
    const lot = lots.find(l => l.id === lotId);
    const wf = getWoodForm(lot);
    const valid = wf === 'box' ? newRows.filter(r => r.length && r.width && r.thickness) : newRows.filter(r => r.length);
    if (!valid.length) { notify(wf === 'box' ? "Nhập đủ dài, rộng, dày" : "Nhập ít nhất 1 cây", false); return; }
    const mapped = valid.map(r => ({
      itemCode: r.itemCode, woodTypeId: lot?.woodTypeId, quality: r.quality || lot?.quality,
      length: parseFloat(r.length) || null, diameter: parseFloat(r.diameter) || null,
      circumference: parseFloat(r.circumference) || null, width: parseFloat(r.width) || null,
      thickness: parseFloat(r.thickness) || null,
      volume: calcVolume(wf, r.length, r.diameter, r.circumference, r.width, r.thickness), notes: r.notes,
    }));
    const tmpItems = mapped.map((m, i) => ({ ...m, id: "tmp_" + Date.now() + i, lotId, status: "Trong kho" }));
    setItems(p => ({ ...p, [lotId]: [...(p[lotId] || []), ...tmpItems] }));
    const newTotal = [...(items[lotId] || []), ...tmpItems];
    setLots(p => p.map(l => l.id === lotId ? { ...l, totalPieces: newTotal.length, totalVolume: newTotal.reduce((s, i) => s + (i.volume || 0), 0) } : l));
    setNewRows([]); setAddingItems(false);
    if (useAPI) import('../api.js').then(api => api.addRawWoodItemsBatch(lotId, mapped)
      .then(r => { if (r?.error) { notify("Lỗi: " + r.error, false); return; } notify(`Đã thêm ${r.count} mục`); api.fetchRawWoodItems(lotId).then(data => setItems(p => ({ ...p, [lotId]: data }))); }));
  };

  const deleteItem = (lotId, itemId) => {
    setItems(p => ({ ...p, [lotId]: (p[lotId] || []).filter(i => i.id !== itemId) }));
    if (useAPI) import('../api.js').then(api => api.deleteRawWoodItem(itemId));
    const remaining = (items[lotId] || []).filter(i => i.id !== itemId);
    setLots(p => p.map(l => l.id === lotId ? { ...l, totalPieces: remaining.length, totalVolume: remaining.reduce((s, i) => s + (i.volume || 0), 0) } : l));
  };

  const batchUpdateStatus = (lotId, newStatus) => {
    const ids = [...selected]; if (!ids.length) return;
    setItems(p => ({ ...p, [lotId]: (p[lotId] || []).map(i => ids.includes(i.id) ? { ...i, status: newStatus } : i) }));
    setSelected(new Set());
    if (useAPI) import('../api.js').then(api => api.updateRawWoodItemsBatch(ids, { status: newStatus }))
      .then(r => { if (r?.error) notify("Lỗi: " + r.error, false); else notify(`Đã cập nhật ${ids.length} mục → ${newStatus}`); });
  };
  const toggleSelect = (id) => setSelected(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleSelectAll = (lotId) => {
    const lotItems = (items[lotId] || []).filter(i => i.status === "Trong kho");
    if (lotItems.every(i => selected.has(i.id))) setSelected(new Set());
    else setSelected(new Set(lotItems.map(i => i.id)));
  };

  // ── Wood type CRUD ──
  const saveType = () => {
    if (!typeFm.name.trim()) { notify("Tên không được trống", false); return; }
    if (typeEd === "new") {
      const tmp = { id: "tmp_" + Date.now(), name: typeFm.name.trim(), woodForm: typeFm.woodForm, icon: typeFm.icon || "🪵", sortOrder: woodTypes.length + 1 };
      setWoodTypes(p => [...p, tmp]);
      if (useAPI) import('../api.js').then(api => api.addRawWoodType(typeFm.name.trim(), typeFm.woodForm, typeFm.icon))
        .then(r => { if (r?.id) setWoodTypes(p => p.map(t => t.id === tmp.id ? { ...t, id: r.id } : t)); });
      notify("Đã thêm " + typeFm.name.trim());
    } else {
      setWoodTypes(p => p.map(t => t.id === typeEd ? { ...t, name: typeFm.name.trim(), icon: typeFm.icon } : t));
      if (useAPI) import('../api.js').then(api => api.updateRawWoodType(typeEd, typeFm.name.trim(), typeFm.icon));
    }
    setTypeEd(null);
  };
  const deleteType = (t) => {
    if (lots.some(l => l.woodTypeId === t.id)) { notify(`Không thể xóa "${t.name}" — đang có lô hàng sử dụng.`, false); return; }
    setWoodTypes(p => p.filter(x => x.id !== t.id));
    if (useAPI) import('../api.js').then(api => api.deleteRawWoodType(t.id));
    notify("Đã xóa " + t.name);
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--tm)" }}>Đang tải...</div>;

  const ths = { padding: "7px 8px", textAlign: "left", background: "var(--bgh)", color: "var(--brl)", fontWeight: 700, fontSize: "0.6rem", textTransform: "uppercase", borderBottom: "2px solid var(--bds)", whiteSpace: "nowrap" };
  const inp = { width: "100%", padding: "6px 8px", borderRadius: 5, border: "1.5px solid var(--bd)", fontSize: "0.78rem", outline: "none", boxSizing: "border-box" };
  const lbl = { display: "block", fontSize: "0.66rem", fontWeight: 700, color: "var(--brl)", marginBottom: 2 };
  const hasFilters = filterWood || filterForm || filterStatus;
  const unitLabel = "mục";

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "var(--br)" }}>🪵 Gỗ nguyên liệu</h2>
        <div style={{ display: "flex", gap: 6 }}>
          {ce && <button onClick={() => { setShowTypeMgr(!showTypeMgr); setTypeEd(null); }} style={{ padding: "7px 12px", borderRadius: 7, background: "transparent", color: "var(--ts)", border: "1.5px solid var(--bd)", cursor: "pointer", fontWeight: 600, fontSize: "0.76rem" }}>⚙ Loại gỗ</button>}
          {ce && <button onClick={addLot} style={{ padding: "7px 16px", borderRadius: 7, background: "var(--ac)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>+ Nhập lô</button>}
        </div>
      </div>

      {/* Wood type manager */}
      {showTypeMgr && (
        <div style={{ padding: 14, borderRadius: 10, background: "var(--bgc)", border: "1.5px solid var(--bd)", marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--br)" }}>⚙ Quản lý loại gỗ nguyên liệu</span>
            <button onClick={() => { setTypeFm({ name: "", woodForm: "round", icon: "🪵" }); setTypeEd("new"); }}
              style={{ padding: "4px 10px", borderRadius: 5, background: "var(--br)", color: "#fff", border: "none", cursor: "pointer", fontSize: "0.72rem", fontWeight: 600 }}>+ Thêm</button>
          </div>
          {typeEd != null && (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 8, padding: "8px 10px", borderRadius: 7, background: "var(--bgs)", flexWrap: "wrap" }}>
              <div style={{ minWidth: 150, flex: 2 }}>
                <label style={lbl}>Tên loại gỗ</label>
                <input value={typeFm.name} onChange={e => setTypeFm(p => ({ ...p, name: e.target.value }))} placeholder="VD: Sồi trắng tròn" style={inp} />
              </div>
              <div style={{ minWidth: 100 }}>
                <label style={lbl}>Hình thức</label>
                <select value={typeFm.woodForm} onChange={e => setTypeFm(p => ({ ...p, woodForm: e.target.value }))} style={{ ...inp, background: "var(--bgc)" }} disabled={typeEd !== "new"}>
                  <option value="round">Gỗ tròn</option>
                  <option value="box">Gỗ hộp</option>
                </select>
              </div>
              <div style={{ minWidth: 60 }}>
                <label style={lbl}>Icon</label>
                <input value={typeFm.icon} onChange={e => setTypeFm(p => ({ ...p, icon: e.target.value }))} style={{ ...inp, width: 50, textAlign: "center" }} />
              </div>
              <button onClick={saveType} style={{ padding: "6px 12px", borderRadius: 5, background: "var(--ac)", color: "#fff", border: "none", cursor: "pointer", fontSize: "0.74rem", fontWeight: 700 }}>Lưu</button>
              <button onClick={() => setTypeEd(null)} style={{ padding: "6px 10px", borderRadius: 5, border: "1px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontSize: "0.74rem" }}>Hủy</button>
            </div>
          )}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {woodTypes.map(t => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, border: "1.5px solid " + (t.woodForm === 'box' ? "#2980b922" : "#8B5E3C22"), background: t.woodForm === 'box' ? "rgba(41,128,185,0.06)" : "rgba(139,94,60,0.06)", fontSize: "0.74rem" }}>
                <span>{t.icon} {t.name}</span>
                <span style={{ fontSize: "0.6rem", padding: "1px 4px", borderRadius: 3, background: t.woodForm === 'box' ? "rgba(41,128,185,0.15)" : "rgba(139,94,60,0.15)", color: t.woodForm === 'box' ? "#2980b9" : "#8B5E3C", fontWeight: 600 }}>{t.woodForm === 'box' ? 'hộp' : 'tròn'}</span>
                {ce && <>
                  <button onClick={() => { setTypeFm({ name: t.name, woodForm: t.woodForm, icon: t.icon }); setTypeEd(t.id); }} style={{ padding: "1px 4px", borderRadius: 3, border: "1px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontSize: "0.6rem" }}>✎</button>
                  <button onClick={() => deleteType(t)} style={{ padding: "1px 4px", borderRadius: 3, border: "1px solid var(--dg)", background: "transparent", color: "var(--dg)", cursor: "pointer", fontSize: "0.6rem" }}>✕</button>
                </>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dashboard cards */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {[
          { label: "Trong kho", ...stats.inStock, color: "var(--gn)", bg: "rgba(50,79,39,0.08)" },
          { label: "Chờ xẻ", ...stats.waiting, color: "var(--ac)", bg: "rgba(242,101,34,0.08)" },
          { label: "Đã bán", ...stats.sold, color: "#6B4226", bg: "rgba(107,66,38,0.08)" },
          { label: "Đã xẻ", ...stats.sawn, color: "#2980b9", bg: "rgba(41,128,185,0.08)" },
        ].map(c => (
          <div key={c.label} style={{ flex: 1, minWidth: 120, padding: "10px 12px", borderRadius: 8, background: c.bg, border: "1.5px solid " + c.color + "22" }}>
            <div style={{ fontSize: "0.65rem", fontWeight: 700, color: c.color, textTransform: "uppercase", marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: "1.1rem", fontWeight: 800, color: c.color }}>{c.count} <span style={{ fontSize: "0.7rem", fontWeight: 600 }}>{unitLabel}</span></div>
            <div style={{ fontSize: "0.72rem", color: "var(--tm)" }}>{c.vol.toFixed(3)} m³</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
        <select value={filterForm} onChange={e => { setFilterForm(e.target.value); setFilterWood(""); }}
          style={{ padding: "5px 8px", borderRadius: 6, border: "1.5px solid var(--bd)", fontSize: "0.74rem", background: "var(--bgc)", color: "var(--tp)", outline: "none" }}>
          <option value="">Tất cả (tròn + hộp)</option>
          <option value="round">🪵 Gỗ tròn</option>
          <option value="box">📦 Gỗ hộp</option>
        </select>
        <select value={filterWood} onChange={e => setFilterWood(e.target.value)}
          style={{ padding: "5px 8px", borderRadius: 6, border: "1.5px solid var(--bd)", fontSize: "0.74rem", background: "var(--bgc)", color: "var(--tp)", outline: "none" }}>
          <option value="">Tất cả loại gỗ</option>
          {filteredTypes.map(w => <option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: "5px 8px", borderRadius: 6, border: "1.5px solid var(--bd)", fontSize: "0.74rem", background: "var(--bgc)", color: "var(--tp)", outline: "none" }}>
          <option value="">Tất cả trạng thái</option>
          {LOT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {hasFilters && <button onClick={() => { setFilterWood(""); setFilterForm(""); setFilterStatus(""); }} style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontSize: "0.72rem" }}>✕ Xóa lọc</button>}
        <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "var(--tm)" }}>{visList.length} lô</span>
      </div>

      {/* Lot form */}
      {lotEd != null && (
        <div style={{ padding: 14, borderRadius: 10, background: "var(--bgc)", border: "1.5px solid var(--ac)", marginBottom: 12 }}>
          <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--br)", marginBottom: 10 }}>{lotEd === "new" ? "Nhập lô mới" : "Chỉnh sửa lô"}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label style={lbl}>Loại gỗ *</label>
              <select value={lotFm.woodTypeId} onChange={e => setLotFm(p => ({ ...p, woodTypeId: e.target.value }))} style={{ ...inp, background: "var(--bgc)" }}>
                {woodTypes.length === 0 && <option value="">— Chưa có loại gỗ —</option>}
                {woodTypes.map(w => <option key={w.id} value={w.id}>{w.icon} {w.name} ({w.woodForm === 'box' ? 'hộp' : 'tròn'})</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={lbl}>NCC</label>
              <select value={lotFm.supplierId} onChange={e => setLotFm(p => ({ ...p, supplierId: e.target.value }))} style={{ ...inp, background: "var(--bgc)" }}>
                <option value="">— Chọn —</option>
                {suppliers.filter(s => {
                  if (!supplierAssignments.length) return true;
                  const wt = woodTypes.find(w => w.id === lotFm.woodTypeId);
                  return supplierAssignments.some(a => a.supplierNccId === s.nccId && a.productType === (wt?.woodForm || 'round') && (!lotFm.woodTypeId || a.rawWoodTypeId === lotFm.woodTypeId));
                }).map(s => <option key={s.id} value={s.nccId}>{s.name}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 80 }}>
              <label style={lbl}>Chất lượng</label>
              <input value={lotFm.quality} onChange={e => setLotFm(p => ({ ...p, quality: e.target.value }))} placeholder="A, B" style={inp} />
            </div>
            <div style={{ flex: 2, minWidth: 140 }}>
              <label style={lbl}>Ghi chú</label>
              <input value={lotFm.notes} onChange={e => setLotFm(p => ({ ...p, notes: e.target.value }))} style={inp} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button onClick={() => setLotEd(null)} style={{ padding: "6px 14px", borderRadius: 6, background: "transparent", color: "var(--ts)", border: "1.5px solid var(--bd)", cursor: "pointer", fontWeight: 600, fontSize: "0.76rem" }}>Hủy</button>
            <button onClick={saveLot} style={{ padding: "6px 16px", borderRadius: 6, background: "var(--ac)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.76rem" }}>Lưu</button>
          </div>
        </div>
      )}

      {/* Lot table */}
      <div style={{ background: "var(--bgc)", borderRadius: 10, border: "1px solid var(--bd)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 850, borderCollapse: "collapse", fontSize: "0.76rem" }}>
            <thead><tr>
              <th style={{ ...ths, width: 32 }}>STT</th>
              <th style={ths}>Mã lô</th>
              <th style={ths}>Loại gỗ</th>
              <th style={ths}>NCC</th>
              <th style={ths}>CL</th>
              <th style={{ ...ths, textAlign: "right" }}>SL</th>
              <th style={{ ...ths, textAlign: "right" }}>m³</th>
              <th style={ths}>Trạng thái</th>
              <th style={ths}>Xử lý</th>
              {ce && <th style={{ ...ths, width: 60 }}></th>}
            </tr></thead>
            <tbody>
              {visList.length === 0 && <tr><td colSpan={ce ? 10 : 9} style={{ padding: 28, textAlign: "center", color: "var(--tm)" }}>Chưa có lô nào</td></tr>}
              {visList.map((lot, idx) => {
                const isExp = expId === lot.id;
                const w = woodTypes.find(x => x.id === lot.woodTypeId);
                const wf = w?.woodForm || 'round';
                const sup = suppliers.find(s => s.nccId === lot.supplierId);
                const disp = DISPOSITIONS.find(d => d.value === lot.disposition);
                const lotItems = items[lot.id] || [];
                const inStockCount = lotItems.filter(i => i.status === "Trong kho").length;
                const soldCount = lotItems.filter(i => i.status === "Đã bán").length;
                const sawnCount = lotItems.filter(i => ["Chờ xẻ", "Đang xẻ", "Đã xẻ xong"].includes(i.status)).length;
                const td = { padding: "7px 8px", borderBottom: isExp ? "none" : "1px solid var(--bd)" };
                const formBadge = wf === 'box' ? { text: 'hộp', color: '#2980b9', bg: 'rgba(41,128,185,0.1)' } : { text: 'tròn', color: '#8B5E3C', bg: 'rgba(139,94,60,0.1)' };

                return (
                  <React.Fragment key={lot.id}>
                    <tr style={{ background: isExp ? "var(--acbg)" : (idx % 2 ? "var(--bgs)" : "#fff"), cursor: "pointer" }} onClick={() => toggleExp(lot.id)}>
                      <td style={{ ...td, textAlign: "center", color: "var(--tm)", fontWeight: 600, fontSize: "0.72rem" }}>
                        <span style={{ fontSize: "0.65rem", color: isExp ? "var(--ac)" : "var(--tm)", marginRight: 2 }}>{isExp ? "▾" : "▸"}</span>{idx + 1}
                      </td>
                      <td style={{ ...td, fontWeight: 700, color: "var(--br)" }}>{lot.lotCode}</td>
                      <td style={td}>
                        {w ? `${w.icon || ""} ${w.name}` : "—"}
                        <span style={{ marginLeft: 4, padding: "0px 4px", borderRadius: 3, background: formBadge.bg, color: formBadge.color, fontSize: "0.58rem", fontWeight: 700 }}>{formBadge.text}</span>
                      </td>
                      <td style={td}>{sup?.name || lot.supplierId || "—"}</td>
                      <td style={td}>{lot.quality || "—"}</td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>
                        {lot.totalPieces}
                        {lotItems.length > 0 && <div style={{ fontSize: "0.6rem", color: "var(--tm)", fontWeight: 400 }}>{inStockCount > 0 && `${inStockCount} kho`}{soldCount > 0 && ` · ${soldCount} bán`}{sawnCount > 0 && ` · ${sawnCount} xẻ`}</div>}
                      </td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{lot.totalVolume ? lot.totalVolume.toFixed(3) : "0"}</td>
                      <td style={td}><span style={{ padding: "2px 7px", borderRadius: 5, background: statusBg(lot.status), color: statusColor(lot.status), fontSize: "0.68rem", fontWeight: 700 }}>{lot.status}</span></td>
                      <td style={td} onClick={e => e.stopPropagation()}>
                        {ce ? <select value={lot.disposition} onChange={e => updateLotField(lot.id, "disposition", e.target.value)} style={{ padding: "3px 6px", borderRadius: 4, border: "1px solid var(--bd)", fontSize: "0.7rem", background: "var(--bgc)", color: "var(--tp)", outline: "none" }}>{DISPOSITIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}</select> : <span style={{ fontSize: "0.7rem" }}>{disp?.label || "—"}</span>}
                      </td>
                      {ce && <td style={td} onClick={e => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: 3 }}>
                          <button onClick={() => editLot(lot)} style={{ padding: "3px 6px", borderRadius: 4, border: "1px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontSize: "0.68rem" }}>✎</button>
                          <button onClick={() => deleteLot(lot)} style={{ padding: "3px 6px", borderRadius: 4, border: "1px solid var(--dg)", background: "transparent", color: "var(--dg)", cursor: "pointer", fontSize: "0.68rem" }}>✕</button>
                        </div>
                      </td>}
                    </tr>

                    {/* Expanded items */}
                    {isExp && (
                      <tr><td colSpan={ce ? 10 : 9} style={{ padding: 0, borderBottom: "2px solid var(--ac)" }}>
                        <div style={{ padding: "10px 14px", background: "rgba(242,101,34,0.03)" }}>
                          {lot.notes && <div style={{ fontSize: "0.73rem", color: "var(--tm)", marginBottom: 8, fontStyle: "italic" }}>📝 {lot.notes}</div>}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 6 }}>
                            <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase" }}>Chi tiết: {lotItems.length} {unitLabel} — {lotItems.reduce((s, i) => s + (i.volume || 0), 0).toFixed(3)} m³</span>
                            <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
                              {selected.size > 0 && ce && (<>
                                <span style={{ fontSize: "0.68rem", color: "var(--ac)", fontWeight: 600 }}>{selected.size} chọn</span>
                                <button onClick={() => batchUpdateStatus(lot.id, "Chờ xẻ")} style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid #2980b9", background: "rgba(41,128,185,0.1)", color: "#2980b9", cursor: "pointer", fontSize: "0.68rem", fontWeight: 600 }}>→ Chờ xẻ</button>
                                <button onClick={() => batchUpdateStatus(lot.id, "Đã bán")} style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid #6B4226", background: "rgba(107,66,38,0.1)", color: "#6B4226", cursor: "pointer", fontSize: "0.68rem", fontWeight: 600 }}>→ Đã bán</button>
                                <button onClick={() => batchUpdateStatus(lot.id, "Trong kho")} style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontSize: "0.68rem", fontWeight: 600 }}>↩ Về kho</button>
                              </>)}
                              {ce && <button onClick={() => { setAddingItems(true); setNewRows([{ _id: Date.now(), itemCode: "", length: "", diameter: "", circumference: "", width: "", thickness: "", quality: "", notes: "" }]); }} style={{ padding: "3px 9px", borderRadius: 5, background: "var(--br)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.68rem" }}>+ Thêm</button>}
                            </div>
                          </div>

                          {/* Add items — adaptive columns */}
                          {addingItems && (
                            <div style={{ padding: "10px 12px", borderRadius: 8, background: "var(--bgc)", border: "1.5px solid var(--ac)", marginBottom: 8 }}>
                              <div style={{ overflowX: "auto" }}>
                                <table style={{ width: "100%", minWidth: 550, borderCollapse: "collapse", fontSize: "0.74rem" }}>
                                  <thead><tr>
                                    {["Mã", "Dài (m)",
                                      ...(wf === 'box' ? ["Rộng (cm)", "Dày (cm)"] : ["Kính (cm)", "Vanh (cm)"]),
                                      "CL", "m³", "Ghi chú", ""].map((h, i) => (
                                      <th key={i} style={{ padding: "4px 6px", textAlign: [5].includes(i) ? "right" : "left", background: "var(--bgs)", color: "var(--brl)", fontWeight: 700, fontSize: "0.58rem", textTransform: "uppercase", borderBottom: "1px solid var(--bds)" }}>{h}</th>
                                    ))}
                                  </tr></thead>
                                  <tbody>
                                    {newRows.map((r, ridx) => {
                                      const vol = calcVolume(wf, r.length, r.diameter, r.circumference, r.width, r.thickness);
                                      const iStyle = { padding: "4px 5px", borderRadius: 4, border: "1.5px solid var(--bd)", fontSize: "0.74rem", outline: "none", textAlign: "right" };
                                      return (
                                        <tr key={r._id}>
                                          <td style={{ padding: "3px 4px" }}><input value={r.itemCode} onChange={e => updateNewRow(ridx, "itemCode", e.target.value)} placeholder="01" style={{ ...iStyle, width: 50, textAlign: "left" }} /></td>
                                          <td style={{ padding: "3px 4px" }}><input type="number" step="0.01" value={r.length} onChange={e => updateNewRow(ridx, "length", e.target.value)} placeholder="3.20" style={{ ...iStyle, width: 60 }} /></td>
                                          {wf === 'box' ? (<>
                                            <td style={{ padding: "3px 4px" }}><input type="number" step="0.1" value={r.width} onChange={e => updateNewRow(ridx, "width", e.target.value)} placeholder="25" style={{ ...iStyle, width: 55 }} /></td>
                                            <td style={{ padding: "3px 4px" }}><input type="number" step="0.1" value={r.thickness} onChange={e => updateNewRow(ridx, "thickness", e.target.value)} placeholder="15" style={{ ...iStyle, width: 55 }} /></td>
                                          </>) : (<>
                                            <td style={{ padding: "3px 4px" }}><input type="number" step="0.1" value={r.diameter} onChange={e => updateNewRow(ridx, "diameter", e.target.value)} placeholder="42" style={{ ...iStyle, width: 55 }} /></td>
                                            <td style={{ padding: "3px 4px" }}><input type="number" step="0.1" value={r.circumference} onChange={e => updateNewRow(ridx, "circumference", e.target.value)} placeholder="125" style={{ ...iStyle, width: 55 }} /></td>
                                          </>)}
                                          <td style={{ padding: "3px 4px" }}><input value={r.quality} onChange={e => updateNewRow(ridx, "quality", e.target.value)} placeholder="A" style={{ ...iStyle, width: 40, textAlign: "left" }} /></td>
                                          <td style={{ padding: "3px 4px", textAlign: "right", fontWeight: 600, color: vol > 0 ? "var(--br)" : "var(--tm)", fontSize: "0.74rem" }}>{vol > 0 ? vol.toFixed(4) : "—"}</td>
                                          <td style={{ padding: "3px 4px" }}><input value={r.notes} onChange={e => updateNewRow(ridx, "notes", e.target.value)} style={{ ...iStyle, width: 80, textAlign: "left" }} /></td>
                                          <td style={{ padding: "3px 4px" }}><button onClick={() => removeNewRow(ridx)} style={{ width: 20, height: 20, padding: 0, borderRadius: 3, border: "1px solid var(--dg)", background: "transparent", color: "var(--dg)", cursor: "pointer", fontSize: "0.65rem" }}>✕</button></td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                  <tfoot><tr>
                                    <td colSpan={5} style={{ padding: "4px 6px", textAlign: "right", fontWeight: 700, fontSize: "0.66rem", color: "var(--brl)", borderTop: "1.5px solid var(--bds)" }}>Tổng ({newRows.filter(r => r.length).length}):</td>
                                    <td style={{ padding: "4px 6px", textAlign: "right", fontWeight: 800, color: "var(--br)", fontSize: "0.76rem", borderTop: "1.5px solid var(--bds)" }}>{newRows.reduce((s, r) => s + calcVolume(wf, r.length, r.diameter, r.circumference, r.width, r.thickness), 0).toFixed(4)} m³</td>
                                    <td colSpan={2} style={{ borderTop: "1.5px solid var(--bds)" }} />
                                  </tr></tfoot>
                                </table>
                              </div>
                              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 8 }}>
                                <button onClick={() => addEmptyRow(wf)} style={{ padding: "4px 10px", borderRadius: 5, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontSize: "0.72rem", fontWeight: 600 }}>+ Dòng</button>
                                <button onClick={() => { setAddingItems(false); setNewRows([]); }} style={{ padding: "4px 12px", borderRadius: 5, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontSize: "0.72rem" }}>Hủy</button>
                                <button onClick={() => saveNewItems(lot.id)} style={{ padding: "4px 14px", borderRadius: 5, background: "var(--ac)", color: "#fff", border: "none", cursor: "pointer", fontSize: "0.72rem", fontWeight: 700 }}>Lưu</button>
                              </div>
                            </div>
                          )}

                          {/* Items table — adaptive columns */}
                          {lotItems.length === 0 && !addingItems ? (
                            <div style={{ padding: "12px", borderRadius: 6, border: "1.5px dashed var(--bd)", background: "var(--bgs)", textAlign: "center", color: "var(--tm)", fontSize: "0.74rem" }}>Chưa có mục nào — bấm "+ Thêm"</div>
                          ) : lotItems.length > 0 && (
                            <div style={{ border: "1.5px solid var(--bd)", borderRadius: 7, overflow: "hidden" }}>
                              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.74rem" }}>
                                <thead><tr style={{ background: "var(--bgh)" }}>
                                  {ce && <th style={{ padding: "5px 6px", width: 28, borderBottom: "1.5px solid var(--bds)" }}>
                                    <input type="checkbox" onChange={() => toggleSelectAll(lot.id)} checked={lotItems.filter(i => i.status === "Trong kho").length > 0 && lotItems.filter(i => i.status === "Trong kho").every(i => selected.has(i.id))} style={{ accentColor: "var(--ac)", width: 14, height: 14, cursor: "pointer" }} />
                                  </th>}
                                  {["Mã", "Dài(m)",
                                    ...(wf === 'box' ? ["Rộng(cm)", "Dày(cm)"] : ["Kính(cm)", "Vanh(cm)"]),
                                    "m³", "CL", "Trạng thái", "Ghi chú"].map((h, i) => (
                                    <th key={i} style={{ padding: "5px 6px", textAlign: [1, 2, 3, 4].includes(i) ? "right" : "left", color: "var(--brl)", fontWeight: 700, fontSize: "0.58rem", textTransform: "uppercase", borderBottom: "1.5px solid var(--bds)", whiteSpace: "nowrap" }}>{h}</th>
                                  ))}
                                  {ce && <th style={{ padding: "5px 6px", width: 28, borderBottom: "1.5px solid var(--bds)" }}></th>}
                                </tr></thead>
                                <tbody>
                                  {lotItems.map((item, ii) => (
                                    <tr key={item.id} style={{ background: ii % 2 ? "var(--bgs)" : "#fff" }}>
                                      {ce && <td style={{ padding: "4px 6px", borderBottom: "1px solid var(--bd)" }}>{item.status === "Trong kho" && <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)} style={{ accentColor: "var(--ac)", width: 14, height: 14, cursor: "pointer" }} />}</td>}
                                      <td style={{ padding: "4px 6px", borderBottom: "1px solid var(--bd)", fontWeight: 600 }}>{item.itemCode || (ii + 1)}</td>
                                      <td style={{ padding: "4px 6px", borderBottom: "1px solid var(--bd)", textAlign: "right" }}>{item.length?.toFixed(2) || "—"}</td>
                                      {wf === 'box' ? (<>
                                        <td style={{ padding: "4px 6px", borderBottom: "1px solid var(--bd)", textAlign: "right" }}>{item.width || "—"}</td>
                                        <td style={{ padding: "4px 6px", borderBottom: "1px solid var(--bd)", textAlign: "right" }}>{item.thickness || "—"}</td>
                                      </>) : (<>
                                        <td style={{ padding: "4px 6px", borderBottom: "1px solid var(--bd)", textAlign: "right" }}>{item.diameter || "—"}</td>
                                        <td style={{ padding: "4px 6px", borderBottom: "1px solid var(--bd)", textAlign: "right" }}>{item.circumference || "—"}</td>
                                      </>)}
                                      <td style={{ padding: "4px 6px", borderBottom: "1px solid var(--bd)", textAlign: "right", fontWeight: 600 }}>{item.volume?.toFixed(4) || "—"}</td>
                                      <td style={{ padding: "4px 6px", borderBottom: "1px solid var(--bd)" }}>{item.quality || "—"}</td>
                                      <td style={{ padding: "4px 6px", borderBottom: "1px solid var(--bd)" }}><span style={{ padding: "1px 6px", borderRadius: 4, background: statusBg(item.status), color: statusColor(item.status), fontSize: "0.66rem", fontWeight: 700 }}>{item.status}</span></td>
                                      <td style={{ padding: "4px 6px", borderBottom: "1px solid var(--bd)", color: "var(--tm)", fontSize: "0.7rem" }}>{item.notes || ""}</td>
                                      {ce && <td style={{ padding: "4px 6px", borderBottom: "1px solid var(--bd)" }}>{item.status === "Trong kho" && <button onClick={() => deleteItem(lot.id, item.id)} style={{ width: 18, height: 18, padding: 0, borderRadius: 3, border: "1px solid var(--dg)", background: "transparent", color: "var(--dg)", cursor: "pointer", fontSize: "0.6rem" }}>✕</button>}</td>}
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot><tr style={{ background: "var(--bgh)" }}>
                                  {ce && <td style={{ borderTop: "2px solid var(--bds)" }} />}
                                  <td colSpan={4} style={{ padding: "5px 6px", textAlign: "right", fontWeight: 700, fontSize: "0.66rem", color: "var(--brl)", borderTop: "2px solid var(--bds)" }}>Tổng ({lotItems.length}):</td>
                                  <td style={{ padding: "5px 6px", textAlign: "right", fontWeight: 800, color: "var(--br)", fontSize: "0.76rem", borderTop: "2px solid var(--bds)" }}>{lotItems.reduce((s, i) => s + (i.volume || 0), 0).toFixed(4)} m³</td>
                                  <td colSpan={ce ? 4 : 3} style={{ borderTop: "2px solid var(--bds)" }} />
                                </tr></tfoot>
                              </table>
                            </div>
                          )}
                        </div>
                      </td></tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
