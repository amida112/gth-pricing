import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import useTableSort from '../useTableSort';
import Dialog from '../components/Dialog';
import { parsePackingListCsv, getPackingListCsvHint, getPackingListCsvPlaceholder } from '../utils/packingListCsv';

export const SHIPMENT_STATUSES = ["Chờ cập cảng", "Đã cập cảng", "Đang kéo về", "Đã nhập kho", "Đã trả vỏ"];

const LOT_TYPES = [
  { value: "sawn",      label: "Gỗ xẻ",   icon: "🪚", color: "var(--gn)", bg: "rgba(50,79,39,0.1)" },
  { value: "raw_round", label: "Gỗ tròn", icon: "🪵", color: "#8B5E3C",  bg: "rgba(139,94,60,0.1)" },
  { value: "raw_box",   label: "Gỗ hộp",  icon: "📦", color: "#2980b9",  bg: "rgba(41,128,185,0.1)" },
];

const lotTypeInfo = (v) => LOT_TYPES.find(t => t.value === v) || LOT_TYPES[0];

const statusColor = (s) => {
  if (s === "Đã trả vỏ") return "#1a5c1a";
  if (s === "Đã nhập kho") return "var(--gn)";
  if (s === "Đang kéo về") return "#2980b9";
  if (s === "Đã cập cảng") return "var(--ac)";
  return "var(--ts)";
};
const statusBg = (s) => {
  if (s === "Đã trả vỏ") return "rgba(26,92,26,0.1)";
  if (s === "Đã nhập kho") return "rgba(50,79,39,0.1)";
  if (s === "Đang kéo về") return "rgba(41,128,185,0.1)";
  if (s === "Đã cập cảng") return "rgba(242,101,34,0.08)";
  return "var(--bgs)";
};

function daysLeft(deadline) {
  if (!deadline) return null;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const dl = new Date(deadline + "T00:00:00"); dl.setHours(0, 0, 0, 0);
  return Math.ceil((dl - now) / 86400000);
}

function DeadlineBadge({ deadline, muted }) {
  const d = daysLeft(deadline);
  if (d === null) return <span style={{ color: "var(--tm)", fontSize: "0.72rem" }}>—</span>;
  const fmt = new Date(deadline + "T00:00:00").toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  if (muted) return <span style={{ fontSize: "0.73rem", color: "var(--ts)" }}>{fmt}</span>;
  let bg, color, text;
  if (d < 0)      { bg = "#C0392B"; color = "#fff"; text = `Quá ${-d}d`; }
  else if (d <= 2){ bg = "#E74C3C"; color = "#fff"; text = `${d}d`; }
  else if (d <= 5){ bg = "#F39C12"; color = "#fff"; text = `${d}d`; }
  else            { bg = "rgba(50,79,39,0.12)"; color = "var(--gn)"; text = `${d}d`; }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
      <span style={{ fontSize: "0.73rem" }}>{fmt}</span>
      <span style={{ padding: "1px 5px", borderRadius: 4, background: bg, color, fontSize: "0.6rem", fontWeight: 700, whiteSpace: "nowrap", animation: d < 0 ? "blink 1s infinite" : "none" }}>{text}</span>
    </span>
  );
}

/* Inline editable cell */
function ICell({ value, onChange, type = "text", placeholder, style, disabled, options, muted }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value || "");
  const ref = useRef(null);

  const startEdit = () => { if (disabled) return; setDraft(value || ""); setEditing(true); };
  useEffect(() => { if (editing && ref.current) ref.current.focus(); }, [editing]);

  const commit = () => { setEditing(false); if (draft !== (value || "")) onChange(draft); };
  const onKey  = (e) => {
    if (e.key === "Enter")  { e.preventDefault(); commit(); }
    if (e.key === "Escape") { setEditing(false); setDraft(value || ""); }
  };

  const cellBase  = { padding: "5px 7px", fontSize: "0.76rem", cursor: disabled ? "default" : "pointer", minHeight: 28, display: "flex", alignItems: "center", ...style };
  const inputBase = { width: "100%", padding: "4px 6px", borderRadius: 4, border: "1.5px solid var(--ac)", fontSize: "0.76rem", outline: "none", boxSizing: "border-box", background: "#fff" };

  if (!editing) {
    if (type === "status" && value)
      return <div style={cellBase} onClick={startEdit}><span style={{ padding: "2px 7px", borderRadius: 5, background: statusBg(value), color: statusColor(value), fontSize: "0.68rem", fontWeight: 700, whiteSpace: "nowrap" }}>{value}</span></div>;
    if (type === "deadline" && value)
      return <div style={cellBase} onClick={startEdit}><DeadlineBadge deadline={value} muted={muted} /></div>;
    if (type === "date" && value)
      return <div style={cellBase} onClick={startEdit}><span style={{ fontSize: "0.76rem" }}>{new Date(value + "T00:00:00").toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}</span></div>;
    return (
      <div style={{ ...cellBase, color: value ? "var(--tp)" : "var(--tm)" }} onClick={startEdit}>
        {value || <span style={{ opacity: 0.5, fontSize: "0.72rem" }}>{placeholder || "—"}</span>}
      </div>
    );
  }

  if (type === "status" || (options && typeof options[0] === "string")) {
    const opts = options || SHIPMENT_STATUSES;
    return (
      <select ref={ref} value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={onKey}
        style={{ ...inputBase, background: "#fff" }}>
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }

  return (
    <input ref={ref} type={type === "deadline" || type === "date" ? "date" : "text"} value={draft}
      onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={onKey}
      placeholder={placeholder} style={inputBase} />
  );
}

export default function PgShipment({ containers, setContainers, suppliers, wts, user, ce, useAPI, notify }) {
  const [shipments, setShipments]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [rawWoodTypes, setRawWoodTypes] = useState([]);
  const [inspSummary, setInspSummary]   = useState({}); // {contId: {total,...}}
  const [expId, setExpId]               = useState(null);
  const [contItems, setContItems]       = useState({});
  const [filterStatus, setFilterStatus]   = useState("");
  const [filterLotType, setFilterLotType] = useState("");
  const [filterAlert, setFilterAlert]     = useState(false);
  const [assignOpen, setAssignOpen]     = useState(null);

  const { toggleSort, sortIcon, applySort } = useTableSort('eta', 'asc');

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!useAPI) { setLoading(false); return; }
    Promise.all([
      import('../api.js').then(api => api.fetchShipments()),
      import('../api.js').then(api => api.fetchRawWoodTypes()),
      import('../api.js').then(api => api.fetchInspectionSummaryAll()),
    ]).then(([data, rwt, inspSum]) => {
      setShipments(data);
      setRawWoodTypes(rwt);
      setInspSummary(inspSum);
      setLoading(false);
    }).catch(e => { notify("Lỗi tải dữ liệu: " + e.message, false); setLoading(false); });
  }, [useAPI, notify]);

  const contByShipment = useMemo(() => {
    const map = {};
    (containers || []).forEach(c => {
      if (c.shipmentId) {
        if (!map[c.shipmentId]) map[c.shipmentId] = [];
        map[c.shipmentId].push(c);
      }
    });
    return map;
  }, [containers]);

  const unassignedConts = useMemo(() => (containers || []).filter(c => !c.shipmentId), [containers]);

  const loadContItems = (containerId) => {
    if (contItems[containerId] !== undefined) return;
    if (!useAPI) { setContItems(p => ({ ...p, [containerId]: [] })); return; }
    import('../api.js').then(api => api.fetchContainerItems(containerId))
      .then(data => setContItems(p => ({ ...p, [containerId]: data })))
      .catch(() => {});
  };

  // Single-field update — truyền object đến API mới
  const updateField = (id, field, value) => {
    setShipments(p => p.map(s => s.id === id ? { ...s, [field]: value ?? null } : s));
    if (!useAPI) return;
    import('../api.js').then(api => api.updateShipment(id, { [field]: value ?? null }))
      .then(r => { if (r?.error) notify("Lỗi: " + r.error, false); })
      .catch(e => notify("Lỗi: " + e.message, false));
  };

  const addRow = () => {
    const tmp = { id: "tmp_" + Date.now(), shipmentCode: "...", name: "", lotType: "sawn", nccId: null, eta: null, arrivalDate: null, portName: null, yardDeadline: null, contDeadline: null, emptyDeadline: null, carrierId: null, carrierName: null, unitCostUsd: null, exchangeRate: null, status: "Chờ cập cảng", notes: null };
    setShipments(p => [tmp, ...p]);
    if (!useAPI) return;
    import('../api.js').then(api => api.addShipment({ status: "Chờ cập cảng" }))
      .then(r => {
        if (r?.error) { notify("Lỗi: " + r.error, false); setShipments(p => p.filter(x => x.id !== tmp.id)); return; }
        setShipments(p => p.map(x => x.id === tmp.id ? { ...x, id: r.id, shipmentCode: r.shipmentCode } : x));
      })
      .catch(e => { notify("Lỗi: " + e.message, false); setShipments(p => p.filter(x => x.id !== tmp.id)); });
  };

  // Trạng thái lô tự động
  const computeShipmentStatus = (sh, sc) => {
    const today = new Date().toISOString().slice(0, 10);
    // Đã về hết: tất cả cont của lô đều có nghiệm thu
    if (sc.length > 0 && sc.every(c => {
      const s = inspSummary[c.id];
      return s && s.total > 0;
    })) return { key: 'da_ve_het', label: 'Đã về hết', color: 'var(--gn)', bg: 'rgba(50,79,39,0.1)' };
    // Đã cập cảng: có hạn lưu cont hoặc lưu bãi
    if (sh.contDeadline || sh.yardDeadline)
      return { key: 'da_cap_cang', label: 'Đã cập cảng', color: 'var(--ac)', bg: 'rgba(242,101,34,0.1)' };
    // Sắp về: ngày hiện tại chưa đến ETA
    if (sh.eta && today <= sh.eta)
      return { key: 'sap_ve', label: 'Sắp về', color: '#2980b9', bg: 'rgba(41,128,185,0.1)' };
    // ETA đã qua nhưng chưa có deadlines
    if (sh.eta && today > sh.eta)
      return { key: 'cho_cap_cang', label: 'Chờ cập cảng', color: '#8B5E3C', bg: 'rgba(139,94,60,0.1)' };
    return { key: 'chua_xac_dinh', label: 'Chưa xác định', color: 'var(--ts)', bg: 'var(--bgs)' };
  };

  const hasAlert = (sh) => {
    const sc = contByShipment[sh.id] || [];
    if (computeShipmentStatus(sh, sc).key === 'da_ve_het') return false;
    return [sh.yardDeadline, sh.contDeadline, sh.emptyDeadline]
      .some(dl => { const d = daysLeft(dl); return d !== null && d <= 2; });
  };

  const getSortVal = useCallback((sh, field) => {
    if (field === 'eta') return sh.eta || sh.arrivalDate || '9999';
    if (field === 'totalVol') {
      const sc = contByShipment[sh.id] || [];
      return sc.reduce((s, c) => s + (c.totalVolume || 0), 0);
    }
    if (field === 'status') {
      const sc = contByShipment[sh.id] || [];
      return computeShipmentStatus(sh, sc).label;
    }
    return sh[field];
  }, [contByShipment, inspSummary]); // eslint-disable-line

  const visList = useMemo(() => {
    let arr = [...shipments];
    if (filterStatus)  arr = arr.filter(s => {
      const sc = contByShipment[s.id] || [];
      return computeShipmentStatus(s, sc).key === filterStatus;
    });
    if (filterLotType) arr = arr.filter(s => s.lotType === filterLotType);
    if (filterAlert)   arr = arr.filter(s => hasAlert(s));
    return applySort(arr, getSortVal);
    // eslint-disable-next-line
  }, [shipments, filterStatus, filterLotType, filterAlert, contByShipment, inspSummary, applySort, getSortVal]);

  const alertShipments = useMemo(
    () => shipments.filter(s => hasAlert(s)),
    // eslint-disable-next-line
    [shipments, contByShipment, inspSummary]
  );

  const del = async (sh) => {
    const sc = contByShipment[sh.id] || [];
    const msg = sc.length > 0
      ? `Xóa lô ${sh.shipmentCode}?\nSẽ xóa cả ${sc.length} container thuộc lô này.`
      : `Xóa lô ${sh.shipmentCode}?`;
    if (!window.confirm(msg)) return;
    setShipments(p => p.filter(x => x.id !== sh.id));
    setContainers(p => p.filter(c => c.shipmentId !== sh.id));
    if (expId === sh.id) setExpId(null);
    if (useAPI) {
      const api = await import('../api.js');
      if (sc.length > 0) await api.deleteContainersByShipment(sh.id);
      const r = await api.deleteShipment(sh.id);
      if (r?.error) notify("Lỗi: " + r.error, false);
      else notify(`Đã xóa lô ${sh.shipmentCode}${sc.length ? ` và ${sc.length} container` : ''}`);
    }
  };

  // containerFields: data cho containers table
  // itemData: data cho container_items (optional — loại gỗ, số kiện, volume, description)
  const addNewContainerToShipment = async (shipmentId, containerFields, itemData) => {
    const api = await import('../api.js');
    const r = await api.addContainer({ ...containerFields, shipmentId, isStandalone: false }).catch(e => ({ error: e.message }));
    if (r?.error) { notify('Lỗi: ' + r.error, false); return false; }
    // Tạo container item nếu có
    if (itemData && r.id) {
      await api.addContainerItem(r.id, itemData).catch(() => {});
    }
    const updated = await api.fetchContainers().catch(() => null);
    if (updated) setContainers(updated);
    notify('Đã tạo container ' + containerFields.containerCode);
    return true;
  };

  const assignCont = (containerId, shipmentId) => {
    setContainers(p => p.map(c => c.id === containerId ? { ...c, shipmentId } : c));
    if (useAPI) import('../api.js').then(api => api.assignContainerToShipment(containerId, shipmentId))
      .then(r => { if (r?.error) notify("Lỗi: " + r.error, false); else notify("Đã gắn container"); })
      .catch(e => notify("Lỗi: " + e.message, false));
    setAssignOpen(null);
  };

  const removeCont = (containerId) => {
    setContainers(p => p.map(c => c.id === containerId ? { ...c, shipmentId: null } : c));
    if (useAPI) import('../api.js').then(api => api.removeContainerFromShipment(containerId))
      .then(r => { if (r?.error) notify("Lỗi: " + r.error, false); else notify("Đã tháo container"); })
      .catch(e => notify("Lỗi: " + e.message, false));
  };

  const toggleExp = (id) => {
    if (expId === id) { setExpId(null); setAssignOpen(null); return; }
    setExpId(id);
    setAssignOpen(null);
    (contByShipment[id] || []).forEach(c => loadContItems(c.id));
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--tm)" }}>Đang tải...</div>;

  const ths = { padding: "7px 8px", textAlign: "left", background: "var(--bgh)", color: "var(--brl)", fontWeight: 700, fontSize: "0.6rem", textTransform: "uppercase", borderBottom: "2px solid var(--bds)", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 2 };
  const thSort = { ...ths, cursor: "pointer", userSelect: "none", transition: "all 0.12s" };
  const hasFilters = filterStatus || filterLotType || filterAlert;

  const filteredSuppliers = () => suppliers;

  // Danh sách loại gỗ theo lotType
  const woodOptsForLot = (lotType) => {
    if (lotType === "sawn") return wts.map(w => ({ id: w.id, label: `${w.icon || ""} ${w.name}` }));
    const form = lotType === "raw_box" ? "box" : "round";
    return rawWoodTypes.filter(r => r.woodForm === form).map(r => ({ id: r.id, label: `${r.icon || ""} ${r.name}` }));
  };

  const woodLabel = (sh) => {
    if (sh.lotType === "sawn") {
      const w = wts.find(x => x.id === sh.woodTypeId);
      return w ? `${w.icon || ""} ${w.name}` : null;
    }
    const r = rawWoodTypes.find(x => x.id === sh.rawWoodTypeId);
    return r ? `${r.icon || ""} ${r.name}` : null;
  };

  return (
    <div>
      <style>{`@keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "var(--br)" }}>📅 Lô hàng & Lịch về</h2>
        {ce && <button onClick={addRow} style={{ padding: "7px 16px", borderRadius: 7, background: "var(--ac)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>+ Thêm lô</button>}
      </div>

      {/* Alert banner */}
      {alertShipments.length > 0 && (
        <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(231,76,60,0.08)", border: "1.5px solid rgba(231,76,60,0.3)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#E74C3C" }}>⚠ Sắp hết hạn:</span>
          {alertShipments.map(s => (
            <span key={s.id} onClick={() => toggleExp(s.id)}
              style={{ padding: "2px 7px", borderRadius: 5, background: "#E74C3C", color: "#fff", fontSize: "0.7rem", fontWeight: 600, cursor: "pointer" }}>
              {s.shipmentCode}
            </span>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
        {/* Lot type toggle */}
        <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1.5px solid var(--bd)" }}>
          {[{ value: "", label: "Tất cả" }, ...LOT_TYPES.map(t => ({ value: t.value, label: `${t.icon} ${t.label}` }))].map(opt => (
            <button key={opt.value} onClick={() => setFilterLotType(opt.value)}
              style={{ padding: "4px 10px", border: "none", cursor: "pointer", fontSize: "0.72rem", fontWeight: filterLotType === opt.value ? 700 : 500, background: filterLotType === opt.value ? "var(--ac)" : "var(--bgc)", color: filterLotType === opt.value ? "#fff" : "var(--ts)" }}>
              {opt.label}
            </button>
          ))}
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: "5px 8px", borderRadius: 6, border: "1.5px solid var(--bd)", fontSize: "0.74rem", background: "var(--bgc)", color: "var(--tp)", outline: "none" }}>
          <option value="">Tất cả trạng thái</option>
          <option value="sap_ve">Sắp về</option>
          <option value="da_cap_cang">Đã cập cảng</option>
          <option value="cho_cap_cang">Chờ cập cảng</option>
          <option value="da_ve_het">Đã về hết</option>
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 3, fontSize: "0.73rem", color: "var(--tp)", cursor: "pointer" }}>
          <input type="checkbox" checked={filterAlert} onChange={e => setFilterAlert(e.target.checked)} style={{ accentColor: "#E74C3C", width: 14, height: 14 }} />
          Cảnh báo
        </label>
        {hasFilters && (
          <button onClick={() => { setFilterStatus(""); setFilterLotType(""); setFilterAlert(false); }}
            style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontSize: "0.72rem" }}>✕ Xóa lọc</button>
        )}
        <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "var(--tm)" }}>{visList.length} lô · Click ô để sửa</span>
      </div>

      {/* Main table */}
      <div style={{ background: "var(--bgc)", borderRadius: 10, border: "1px solid var(--bd)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto", maxHeight: "calc(100vh - 220px)", overflowY: "auto" }}>
          <table style={{ width: "100%", minWidth: 1100, borderCollapse: "collapse", fontSize: "0.76rem" }}>
            <thead>
              <tr>
                <th style={{ ...thSort, minWidth: 130 }} onClick={() => toggleSort('shipmentCode')}>Mã lô{sortIcon('shipmentCode')}</th>
                <th style={{ ...thSort, minWidth: 56, textAlign: "center" }} onClick={() => toggleSort('totalVol')}>Cont{sortIcon('totalVol')}</th>
                <th style={{ ...ths, minWidth: 120 }}>Loại gỗ</th>
                <th style={{ ...ths, minWidth: 110 }}>NCC</th>
                <th style={{ ...ths, minWidth: 120 }}>ĐV Vận tải</th>
                <th style={{ ...thSort, minWidth: 90 }} onClick={() => toggleSort('eta')}>ETA{sortIcon('eta')}</th>
                <th style={{ ...ths, minWidth: 90 }}>Hạn lưu cont</th>
                <th style={{ ...ths, minWidth: 90 }}>Hạn lưu bãi</th>
                <th style={{ ...ths, minWidth: 90 }}>Hạn trả vỏ</th>
                <th style={{ ...thSort, minWidth: 110 }} onClick={() => toggleSort('status')}>Trạng thái{sortIcon('status')}</th>
                <th style={{ ...ths, minWidth: 120 }}>Ghi chú</th>
                {ce && <th style={{ ...ths, width: 36 }}></th>}
              </tr>
            </thead>
            <tbody>
              {visList.length === 0 && (
                <tr><td colSpan={ce ? 12 : 11} style={{ padding: 28, textAlign: "center", color: "var(--tm)" }}>
                  {shipments.length === 0 ? 'Chưa có lô hàng — bấm "+ Thêm lô" để bắt đầu' : "Không có lô nào khớp bộ lọc"}
                </td></tr>
              )}
              {visList.map((sh, idx) => {
                const isExp    = expId === sh.id;
                const sc       = contByShipment[sh.id] || [];
                const totalVol = sc.reduce((s, c) => s + (c.totalVolume || 0), 0);
                const alert    = hasAlert(sh);
                const rowBg    = isExp ? "var(--acbg)" : alert ? "rgba(231,76,60,0.04)" : (idx % 2 ? "var(--bgs)" : "#fff");
                const td       = { padding: 0, borderBottom: isExp ? "none" : "1px solid var(--bd)", background: rowBg, whiteSpace: "nowrap" };
                const lti      = lotTypeInfo(sh.lotType);
                const nccObj   = suppliers.find(s => s.nccId === sh.nccId);
                const woodOpts = woodOptsForLot(sh.lotType);
                const wLabel   = woodLabel(sh);
                const selWoodId = sh.lotType === "sawn" ? sh.woodTypeId : sh.rawWoodTypeId;
                const statusInfo = computeShipmentStatus(sh, sc);

                return (
                  <React.Fragment key={sh.id}>
                    <tr>
                      {/* Mã lô + loại hàng (với expand toggle) */}
                      <td style={{ ...td, padding: "5px 8px", cursor: "pointer" }} onClick={() => toggleExp(sh.id)}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ fontSize: "0.62rem", color: isExp ? "var(--ac)" : "var(--tm)" }}>{isExp ? "▾" : "▸"}</span>
                          <span style={{ fontWeight: 700, color: "var(--br)", fontSize: "0.76rem" }}>{sh.name || sh.shipmentCode}</span>
                          {sh.name && <span style={{ fontSize: "0.6rem", color: "var(--tm)", fontFamily: "monospace" }}>{sh.shipmentCode}</span>}
                        </div>
                        {ce && (
                          <div style={{ marginTop: 2 }} onClick={e => e.stopPropagation()}>
                            <ICell value={sh.name} onChange={v => updateField(sh.id, "name", v)} placeholder="Tên lô hàng..." style={{ fontSize: "0.7rem", padding: "2px 5px", minHeight: 20, color: sh.name ? "var(--ts)" : "var(--tm)" }} />
                          </div>
                        )}
                        <div style={{ marginTop: 3 }}>
                          {ce && sc.length === 0 ? (
                            <select value={sh.lotType || "sawn"}
                              onChange={e => { e.stopPropagation(); updateField(sh.id, "lotType", e.target.value); }}
                              onClick={e => e.stopPropagation()}
                              style={{ padding: "1px 5px", borderRadius: 4, border: `1.5px solid ${lti.color}`, background: lti.bg, color: lti.color, fontSize: "0.62rem", fontWeight: 700, cursor: "pointer", outline: "none" }}>
                              {LOT_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                            </select>
                          ) : (
                            <span title={sc.length > 0 ? "Đã có container — không thể đổi loại hàng" : ""}
                              style={{ padding: "1px 6px", borderRadius: 4, background: lti.bg, color: lti.color, fontSize: "0.62rem", fontWeight: 700, cursor: sc.length > 0 ? "not-allowed" : "default" }}>{lti.icon} {lti.label}</span>
                          )}
                        </div>
                      </td>

                      {/* Số container — click to expand */}
                      <td style={{ ...td, padding: "6px 8px", textAlign: "center", cursor: "pointer" }} onClick={() => toggleExp(sh.id)}>
                        <span style={{ fontWeight: 700, fontSize: "0.82rem", color: sc.length ? "var(--br)" : "var(--tm)" }}>{sc.length}</span>
                        {totalVol > 0 && <div style={{ fontSize: "0.6rem", color: "var(--ts)" }}>{totalVol.toFixed(1)}m³</div>}
                      </td>

                      {/* Loại gỗ — dropdown theo lotType */}
                      <td style={td} onClick={e => e.stopPropagation()}>
                        {ce ? (
                          <select value={selWoodId || ""}
                            onChange={e => {
                              const val = e.target.value || null;
                              if (sh.lotType === "sawn") updateField(sh.id, "woodTypeId", val);
                              else updateField(sh.id, "rawWoodTypeId", val);
                            }}
                            style={{ width: "100%", padding: "5px 6px", border: "none", borderBottom: "1.5px solid transparent", fontSize: "0.74rem", background: "transparent", outline: "none", color: "var(--tp)", cursor: "pointer" }}
                            onFocus={e => e.target.style.borderBottomColor = "var(--ac)"}
                            onBlur={e => e.target.style.borderBottomColor = "transparent"}>
                            <option value="">— Loại gỗ —</option>
                            {woodOpts.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                          </select>
                        ) : (
                          <div style={{ padding: "5px 7px", fontSize: "0.74rem" }}>
                            {wLabel || <span style={{ color: "var(--tm)" }}>—</span>}
                          </div>
                        )}
                      </td>

                      {/* NCC — admin: tên, kho: mã */}
                      <td style={td} onClick={e => e.stopPropagation()}>
                        {ce ? (
                          <select value={sh.nccId || ""}
                            onChange={e => updateField(sh.id, "nccId", e.target.value || null)}
                            style={{ width: "100%", padding: "5px 6px", border: "none", borderBottom: "1.5px solid transparent", fontSize: "0.74rem", background: "transparent", outline: "none", color: "var(--tp)", cursor: "pointer" }}
                            onFocus={e => e.target.style.borderBottomColor = "var(--ac)"}
                            onBlur={e => e.target.style.borderBottomColor = "transparent"}>
                            <option value="">— NCC —</option>
                            {filteredSuppliers().map(s => <option key={s.id} value={s.nccId}>{s.name}</option>)}
                          </select>
                        ) : (
                          <div style={{ padding: "5px 7px", fontSize: "0.74rem" }}>
                            {isAdmin
                              ? (nccObj?.name || sh.nccId || <span style={{ color: "var(--tm)" }}>—</span>)
                              : (sh.nccId || <span style={{ color: "var(--tm)" }}>—</span>)}
                          </div>
                        )}
                      </td>

                      {/* ĐV Vận tải */}
                      <td style={td}><ICell value={sh.carrierName} disabled={!ce} placeholder="Đơn vị vận tải" onChange={v => updateField(sh.id, "carrierName", v || null)} /></td>

                      {/* ETA (Ngày cập cảng) */}
                      <td style={td}><ICell value={sh.eta} type="date" disabled={!ce} placeholder="ETA" onChange={v => updateField(sh.id, "eta", v || null)} /></td>

                      {/* Deadlines: cont → bãi → vỏ — tắt cảnh báo khi đã về hết */}
                      <td style={td}><ICell value={sh.contDeadline}  type="deadline" muted={statusInfo.key === 'da_ve_het'} disabled={!ce} placeholder="Hạn cont" onChange={v => updateField(sh.id, "contDeadline", v || null)} /></td>
                      <td style={td}><ICell value={sh.yardDeadline}  type="deadline" muted={statusInfo.key === 'da_ve_het'} disabled={!ce} placeholder="Hạn bãi"  onChange={v => updateField(sh.id, "yardDeadline", v || null)} /></td>
                      <td style={td}><ICell value={sh.emptyDeadline} type="deadline" muted={statusInfo.key === 'da_ve_het'} disabled={!ce} placeholder="Hạn vỏ"   onChange={v => updateField(sh.id, "emptyDeadline", v || null)} /></td>

                      {/* Trạng thái — tự động */}
                      <td style={{ ...td, padding: "5px 7px" }}>
                        <span style={{ padding: "2px 8px", borderRadius: 5, fontSize: "0.68rem", fontWeight: 700, background: statusInfo.bg, color: statusInfo.color, whiteSpace: "nowrap" }}>
                          {statusInfo.label}
                        </span>
                      </td>

                      {/* Ghi chú */}
                      <td style={{ ...td, whiteSpace: "normal" }}><ICell value={sh.notes} disabled={!ce} placeholder="Ghi chú..." onChange={v => updateField(sh.id, "notes", v || null)} /></td>

                      {ce && (
                        <td style={{ ...td, textAlign: "center", padding: "6px 4px" }}>
                          <button onClick={() => del(sh)} title="Xóa lô"
                            style={{ width: 22, height: 22, padding: 0, borderRadius: 4, border: "1px solid var(--dg)", background: "transparent", color: "var(--dg)", cursor: "pointer", fontSize: "0.68rem" }}>✕</button>
                        </td>
                      )}
                    </tr>

                    {/* Expanded */}
                    {isExp && (
                      <tr>
                        <td colSpan={ce ? 12 : 11} style={{ padding: 0, borderBottom: "2px solid var(--ac)" }}>
                          <ExpandedCargo
                            sh={sh} sc={sc} contItems={contItems} suppliers={suppliers}
                            wts={wts} rawWoodTypes={rawWoodTypes}
                            isAdmin={isAdmin} ce={ce}
                            unassignedConts={unassignedConts} assignOpen={assignOpen}
                            setAssignOpen={setAssignOpen} assignCont={assignCont} removeCont={removeCont}
                            updateField={updateField}
                            addNewContainer={addNewContainerToShipment}
                            useAPI={useAPI} notify={notify}
                          />
                        </td>
                      </tr>
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

/* ── Expanded section ── */
const CARGO_TYPE_OPTS = [
  { value: "sawn",      label: "Gỗ xẻ NK",  icon: "🪚" },
  { value: "raw_round", label: "Gỗ tròn",    icon: "🪵" },
  { value: "raw_box",   label: "Gỗ hộp",     icon: "📦" },
];

// ── Lịch sử xuất cây (withdrawal) ──────────────────────────────────────────────
function WithdrawalHistory({ containerId, totalVolume, weightUnit, useAPI }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!useAPI) { setData([]); return; }
    import('../api.js').then(api => api.fetchWithdrawals(containerId))
      .then(d => setData(d)).catch(() => setData([]));
  }, [containerId, useAPI]);

  if (!data) return <div style={{ padding: 10, color: "var(--tm)", fontSize: "0.72rem" }}>Đang tải...</div>;

  const unitL = weightUnit === 'ton' ? 'tấn' : 'm³';
  const totalSold = data.filter(w => w.type === 'sale').reduce((s, w) => s + ((w.weightKg || 0) / 1000), 0);
  const totalSawn = data.filter(w => w.type === 'sawing').reduce((s, w) => s + ((w.weightKg || 0) / 1000), 0);
  const totalPcsSold = data.filter(w => w.type === 'sale').reduce((s, w) => s + (w.pieceCount || 0), 0);
  const totalPcsSawn = data.filter(w => w.type === 'sawing').reduce((s, w) => s + (w.pieceCount || 0), 0);
  const tot = parseFloat(totalVolume) || 0;
  const remaining = Math.max(0, tot - totalSold - totalSawn);

  const ths = { padding: "4px 6px", background: "var(--bgh)", color: "var(--brl)", fontWeight: 700, fontSize: "0.56rem", textTransform: "uppercase", borderBottom: "1.5px solid var(--bds)", textAlign: "left", whiteSpace: "nowrap" };
  const tds = { padding: "4px 6px", borderBottom: "1px solid var(--bd)", fontSize: "0.72rem", whiteSpace: "nowrap" };

  return (
    <div>
      {/* Summary */}
      <div style={{ display: "flex", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
        {[
          { label: `Tổng NCC`, value: `${tot.toFixed(2)} ${unitL}`, color: "var(--br)" },
          { label: "Đã bán lẻ", value: `${totalPcsSold} cây · ${totalSold.toFixed(2)} ${unitL}`, color: "#E67E22" },
          { label: "Đã xẻ", value: `${totalPcsSawn} cây · ${totalSawn.toFixed(2)} ${unitL}`, color: "#2980b9" },
          { label: "Còn lại", value: `${remaining.toFixed(2)} ${unitL}`, color: remaining > 0 ? "var(--gn)" : "var(--dg)" },
        ].map(c => (
          <div key={c.label} style={{ padding: "6px 10px", borderRadius: 6, background: "var(--bgs)", border: "1px solid var(--bd)", minWidth: 100 }}>
            <div style={{ fontSize: "0.58rem", color: "var(--tm)", fontWeight: 600, textTransform: "uppercase" }}>{c.label}</div>
            <div style={{ fontSize: "0.78rem", fontWeight: 700, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {data.length === 0 ? (
        <div style={{ padding: "10px", textAlign: "center", color: "var(--tm)", fontSize: "0.72rem", fontStyle: "italic" }}>Chưa có lịch sử xuất</div>
      ) : (
        <div style={{ border: "1px solid var(--bd)", borderRadius: 6, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={ths}>#</th>
              <th style={ths}>Ngày</th>
              <th style={ths}>Loại</th>
              <th style={{ ...ths, textAlign: "right" }}>Cây</th>
              <th style={{ ...ths, textAlign: "right" }}>{unitL}</th>
              <th style={{ ...ths, textAlign: "right" }}>Thành tiền</th>
              <th style={ths}>Đơn/Mẻ</th>
              <th style={ths}>Ghi chú</th>
            </tr></thead>
            <tbody>
              {data.map((w, i) => (
                <tr key={w.id} style={{ background: i % 2 ? "var(--bgs)" : "#fff" }}>
                  <td style={tds}>{i + 1}</td>
                  <td style={tds}>{w.createdAt ? new Date(w.createdAt).toLocaleDateString("vi-VN") : "—"}</td>
                  <td style={tds}>
                    <span style={{ padding: "1px 6px", borderRadius: 3, fontSize: "0.62rem", fontWeight: 700, background: w.type === 'sale' ? "rgba(230,126,34,0.1)" : "rgba(41,128,185,0.1)", color: w.type === 'sale' ? "#E67E22" : "#2980b9" }}>
                      {w.type === 'sale' ? 'Bán' : 'Xẻ'}
                    </span>
                  </td>
                  <td style={{ ...tds, textAlign: "right", fontWeight: 600 }}>{w.pieceCount || "—"}</td>
                  <td style={{ ...tds, textAlign: "right", fontWeight: 700, color: "var(--br)" }}>{w.weightKg ? (w.weightKg / 1000).toFixed(3) : "—"}</td>
                  <td style={{ ...tds, textAlign: "right" }}>{w.amount ? Math.round(w.amount).toLocaleString("vi-VN") + "đ" : "—"}</td>
                  <td style={{ ...tds, fontFamily: "monospace", fontSize: "0.68rem" }}>{w.orderId ? `ĐH #${w.orderId}` : w.sawingBatchId ? "Mẻ xẻ" : "—"}</td>
                  <td style={{ ...tds, color: "var(--tm)", fontSize: "0.68rem" }}>{w.notes || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Container expand: packing list + ảnh ──────────────────────────────────────
function ContainerExpandPanel({ c, ce, useAPI, notify, suppliers, rawWoodTypes }) {
  const [tab, setTab] = useState("packing");
  const [plData, setPlData] = useState(null);  // packing list items
  const [plLoading, setPlLoading] = useState(true);
  const [plRows, setPlRows] = useState([]);
  const [showPlForm, setShowPlForm] = useState(false);
  const [showPlCsvInput, setShowPlCsvInput] = useState(false);
  const [plCsvText, setPlCsvText] = useState("");
  const [plSaving, setPlSaving] = useState(false);
  const [images, setImages] = useState(c.images || []);
  const [newImgFiles, setNewImgFiles] = useState([]);
  const [imgSaving, setImgSaving] = useState(false);
  const imgRef = useRef(null);

  const isRound = c.cargoType === "raw_round";
  const rwt = rawWoodTypes.find(r => r.id === c.rawWoodTypeId);

  // Load packing list
  useEffect(() => {
    if (!useAPI) { setPlData([]); setPlLoading(false); return; }
    import('../api.js').then(api => api.fetchRawWoodPackingList(c.id))
      .then(d => { setPlData(d); setPlLoading(false); })
      .catch(() => { setPlData([]); setPlLoading(false); });
  }, [c.id, useAPI]);

  // Empty packing list row
  const emptyPl = () => ({ _id: Date.now() + Math.random(), pieceCode: "", lengthM: "", diameterCm: "", circumferenceCm: "", widthCm: "", thicknessCm: "", weightKg: "", quality: "TB", notes: "" });

  const openPlForm = () => {
    setPlRows([emptyPl(), emptyPl(), emptyPl()]);
    setShowPlForm(true);
  };

  // Parse CSV — dùng shared util
  const parsePlCsv = (text) => parsePackingListCsv(text, isRound);

  // Import from file
  const handlePlCSV = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = ev => {
      const rows = parsePlCsv(ev.target.result);
      if (rows) { setPlRows(rows); setShowPlForm(true); setShowPlCsvInput(false); }
      else notify('Không tìm thấy dữ liệu hợp lệ trong file', false);
    };
    reader.readAsText(file, 'UTF-8');
  };

  // Paste CSV text
  const handlePlPasteCSV = () => {
    if (!plCsvText.trim()) return;
    const rows = parsePlCsv(plCsvText);
    if (rows) { setPlRows(rows); setShowPlForm(true); setShowPlCsvInput(false); setPlCsvText(''); }
    else notify('Không tìm thấy dữ liệu hợp lệ', false);
  };

  const plCsvRef = useRef(null);

  // Save packing list
  const savePl = async () => {
    const valid = plRows.filter(r => r.lengthM || r.weightKg);
    if (!valid.length) { notify('Nhập ít nhất 1 cây có chiều dài', false); return; }
    setPlSaving(true);
    try {
      const { addRawWoodPackingListBatch } = await import('../api.js');
      const pieces = valid.map((r, i) => ({
        pieceCode: r.pieceCode || null,
        lengthM: r.lengthM ? parseFloat(r.lengthM) : null,
        diameterCm: r.diameterCm ? parseFloat(r.diameterCm) : null,
        circumferenceCm: r.circumferenceCm ? parseFloat(r.circumferenceCm) : null,
        widthCm: r.widthCm ? parseFloat(r.widthCm) : null,
        thicknessCm: r.thicknessCm ? parseFloat(r.thicknessCm) : null,
        volumeM3: isRound
          ? (r.circumferenceCm ? parseFloat(r.circumferenceCm) ** 2 * (parseFloat(r.lengthM) || 0) * 8 / 1e6 : null)
          : (r.widthCm && r.thicknessCm && r.lengthM ? parseFloat(r.widthCm) * parseFloat(r.thicknessCm) * parseFloat(r.lengthM) * 100 / 1e6 : null),
        weightKg: r.weightKg || null,
        quality: r.quality || null,
        sortOrder: i,
        notes: r.notes || null,
      }));
      const res = await addRawWoodPackingListBatch(c.id, pieces);
      if (res.error) { notify('Lỗi: ' + res.error, false); setPlSaving(false); return; }
      notify(`Đã thêm ${res.count} mục vào packing list`);
      setPlData(prev => [...(prev || []), ...(res.items || [])]);
      setShowPlForm(false);
      setPlRows([]);
    } catch (e) { notify('Lỗi: ' + e.message, false); }
    setPlSaving(false);
  };

  // Save images
  const handleImgFiles = (e) => {
    Array.from(e.target.files).slice(0, 5 - images.length - newImgFiles.length).forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => setNewImgFiles(prev => [...prev, { file, preview: ev.target.result }]);
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };
  const saveImages = async () => {
    setImgSaving(true);
    try {
      const { uploadBundleImage, updateContainer } = await import('../api.js');
      let urls = [...images];
      for (const img of newImgFiles) {
        const r = await uploadBundleImage(c.containerCode, img.file, 'container');
        if (r.error) { notify('Upload lỗi: ' + r.error, false); setImgSaving(false); return; }
        urls.push(r.url);
      }
      await updateContainer(c.id, { images: urls });
      setImages(urls);
      setNewImgFiles([]);
      notify('Đã lưu ảnh container');
    } catch (e) { notify('Lỗi: ' + e.message, false); }
    setImgSaving(false);
  };

  const ths = { padding: "4px 6px", background: "var(--bgh)", color: "var(--brl)", fontWeight: 700, fontSize: "0.56rem", textTransform: "uppercase", borderBottom: "1.5px solid var(--bds)", textAlign: "left", whiteSpace: "nowrap" };
  const tds = { padding: "4px 6px", borderBottom: "1px solid var(--bd)", fontSize: "0.72rem", whiteSpace: "nowrap" };
  const inpS = { padding: "4px 6px", borderRadius: 4, border: "1.5px solid var(--bd)", fontSize: "0.72rem", outline: "none", background: "var(--bgc)" };
  const tabSt = (t) => ({ padding: "5px 12px", border: "none", borderRadius: "5px 5px 0 0", cursor: "pointer", fontSize: "0.7rem", fontWeight: tab === t ? 700 : 500, background: tab === t ? "var(--ac)" : "transparent", color: tab === t ? "#fff" : "var(--ts)", marginBottom: -1 });

  return (
    <div style={{ padding: "10px 14px 12px" }}>
      <div style={{ display: "flex", gap: 2, marginBottom: 8, borderBottom: "1.5px solid var(--bds)" }}>
        <button onClick={() => setTab("packing")} style={tabSt("packing")}>Packing List{plData ? ` (${plData.length})` : ''}</button>
        <button onClick={() => setTab("withdrawals")} style={tabSt("withdrawals")}>Lịch sử xuất</button>
        <button onClick={() => setTab("images")} style={tabSt("images")}>Ảnh container{images.length > 0 ? ` (${images.length})` : ''}</button>
      </div>

      {/* ── Tab Packing List ── */}
      {tab === "packing" && (
        <div>
          <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
            {ce && <button onClick={openPlForm} style={{ padding: "3px 10px", borderRadius: 5, background: "var(--ac)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.68rem" }}>+ Nhập thủ công</button>}
            {ce && <><button onClick={() => plCsvRef.current?.click()} style={{ padding: "3px 10px", borderRadius: 5, border: "1.5px dashed var(--bd)", background: "var(--bgs)", color: "var(--ts)", cursor: "pointer", fontSize: "0.68rem", fontWeight: 600 }}>↑ Tải file CSV</button><input ref={plCsvRef} type="file" accept=".csv,.txt" onChange={handlePlCSV} style={{ display: "none" }} /></>}
            {ce && <button onClick={() => { setShowPlCsvInput(p => !p); setPlCsvText(''); }}
              style={{ padding: "3px 10px", borderRadius: 5, border: `1.5px dashed ${showPlCsvInput ? "var(--ac)" : "var(--bd)"}`, background: showPlCsvInput ? "var(--acbg)" : "var(--bgs)", color: showPlCsvInput ? "var(--ac)" : "var(--ts)", cursor: "pointer", fontSize: "0.68rem", fontWeight: 600 }}>
              ✎ Nhập CSV
            </button>}
          </div>

          {/* Textarea nhập CSV trực tiếp */}
          {showPlCsvInput && (
            <div style={{ marginBottom: 8, padding: "8px 10px", borderRadius: 6, background: "var(--bgs)", border: "1px solid var(--bd)" }}>
              <div style={{ fontSize: "0.62rem", color: "var(--ts)", marginBottom: 4 }}>
                <strong>{getPackingListCsvHint(isRound)}</strong>
                <span style={{ marginLeft: 6, color: "var(--tm)" }}>— Paste từ Excel (tab) hoặc CSV (dấu phẩy)</span>
              </div>
              <textarea
                value={plCsvText}
                onChange={e => setPlCsvText(e.target.value)}
                placeholder={getPackingListCsvPlaceholder(isRound)}
                rows={4}
                autoFocus
                style={{ width: "100%", padding: "6px 8px", borderRadius: 5, border: "1.5px solid var(--bd)", fontSize: "0.72rem", fontFamily: "monospace", outline: "none", resize: "vertical", boxSizing: "border-box", background: "var(--bgc)", color: "var(--tp)" }}
              />
              <div style={{ display: "flex", gap: 6, marginTop: 5 }}>
                <button onClick={handlePlPasteCSV}
                  style={{ padding: "4px 14px", borderRadius: 5, background: "var(--ac)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.72rem" }}>
                  Áp dụng
                </button>
                <button onClick={() => { setShowPlCsvInput(false); setPlCsvText(''); }}
                  style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontSize: "0.72rem" }}>
                  Đóng
                </button>
              </div>
            </div>
          )}

          {/* Form nhập thủ công */}
          {showPlForm && (
            <div style={{ padding: "8px 10px", borderRadius: 7, border: "1.5px solid var(--ac)", background: "var(--bgc)", marginBottom: 8 }}>
              <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 4, paddingBottom: 4, borderBottom: "1px solid var(--bd)" }}>
                <span style={{ width: 80, fontSize: "0.56rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase" }}>{isRound ? 'Mã cây' : 'Mã hộp'}</span>
                {isRound ? (<>
                  <span style={{ width: 55, fontSize: "0.56rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase", textAlign: "right" }}>Dài (m)</span>
                  <span style={{ width: 55, fontSize: "0.56rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase", textAlign: "right" }}>ĐK (cm)</span>
                  <span style={{ width: 55, fontSize: "0.56rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase", textAlign: "right" }}>CV (cm)</span>
                  <span style={{ width: 55, fontSize: "0.56rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase" }}>CL</span>
                </>) : (<>
                  <span style={{ width: 55, fontSize: "0.56rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase", textAlign: "right" }}>Dày (cm)</span>
                  <span style={{ width: 55, fontSize: "0.56rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase", textAlign: "right" }}>Rộng (cm)</span>
                  <span style={{ width: 55, fontSize: "0.56rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase", textAlign: "right" }}>Dài (cm)</span>
                </>)}
                <span style={{ flex: 1, fontSize: "0.56rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase" }}>Ghi chú</span>
                <span style={{ width: 20 }}></span>
              </div>
              {plRows.map((r, idx) => (
                <div key={r._id} style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 3 }}>
                  <input value={r.pieceCode} onChange={e => setPlRows(p => p.map((x, i) => i === idx ? { ...x, pieceCode: e.target.value } : x))} placeholder={isRound ? "T-001" : "H-001"} autoFocus={idx === 0} style={{ ...inpS, width: 80 }} />
                  {isRound ? (<>
                    <input type="number" step="0.01" value={r.lengthM} onChange={e => setPlRows(p => p.map((x, i) => i === idx ? { ...x, lengthM: e.target.value } : x))} placeholder="0" style={{ ...inpS, width: 55, textAlign: "right" }} />
                    <input type="number" step="0.1" value={r.diameterCm} onChange={e => setPlRows(p => p.map((x, i) => i === idx ? { ...x, diameterCm: e.target.value } : x))} placeholder="0" style={{ ...inpS, width: 55, textAlign: "right" }} />
                    <input type="number" step="0.1" value={r.circumferenceCm} onChange={e => setPlRows(p => p.map((x, i) => i === idx ? { ...x, circumferenceCm: e.target.value } : x))} placeholder="0" style={{ ...inpS, width: 55, textAlign: "right" }} />
                    <select value={r.quality} onChange={e => setPlRows(p => p.map((x, i) => i === idx ? { ...x, quality: e.target.value } : x))} style={{ ...inpS, width: 55 }}>
                      <option>Đẹp</option><option>TB</option><option>Xấu</option>
                    </select>
                  </>) : (<>
                    <input type="number" step="0.1" value={r.thicknessCm} onChange={e => setPlRows(p => p.map((x, i) => i === idx ? { ...x, thicknessCm: e.target.value } : x))} placeholder="0" style={{ ...inpS, width: 55, textAlign: "right" }} />
                    <input type="number" step="0.1" value={r.widthCm} onChange={e => setPlRows(p => p.map((x, i) => i === idx ? { ...x, widthCm: e.target.value } : x))} placeholder="0" style={{ ...inpS, width: 55, textAlign: "right" }} />
                    <input type="number" step="0.1" value={r.lengthM ? String(Math.round(parseFloat(r.lengthM) * 100)) : ''} onChange={e => { const cm = parseFloat(e.target.value) || 0; setPlRows(p => p.map((x, i) => i === idx ? { ...x, lengthM: cm ? String(cm / 100) : '' } : x)); }} placeholder="0" style={{ ...inpS, width: 55, textAlign: "right" }} />
                  </>)}
                  <input value={r.notes} onChange={e => setPlRows(p => p.map((x, i) => i === idx ? { ...x, notes: e.target.value } : x))} placeholder="..." style={{ ...inpS, flex: 1, minWidth: 0 }} />
                  <button onClick={() => setPlRows(p => p.filter((_, i) => i !== idx))} disabled={plRows.length === 1} style={{ width: 20, height: 20, padding: 0, borderRadius: 3, border: "1px solid var(--dg)", background: "transparent", color: plRows.length === 1 ? "var(--bd)" : "var(--dg)", cursor: plRows.length === 1 ? "default" : "pointer", fontSize: "0.6rem" }}>✕</button>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <button onClick={() => setPlRows(p => [...p, emptyPl()])} style={{ padding: "3px 10px", borderRadius: 4, border: "1.5px dashed var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontSize: "0.68rem" }}>+ Thêm dòng</button>
                <div style={{ display: "flex", gap: 5 }}>
                  <button onClick={savePl} disabled={plSaving} style={{ padding: "4px 14px", borderRadius: 5, background: "var(--ac)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.72rem" }}>{plSaving ? "..." : "Lưu"}</button>
                  <button onClick={() => { setShowPlForm(false); setPlRows([]); }} style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontSize: "0.72rem" }}>Hủy</button>
                </div>
              </div>
            </div>
          )}

          {/* Packing list table */}
          {plLoading ? <div style={{ padding: 10, color: "var(--tm)", fontSize: "0.72rem" }}>Đang tải...</div> :
          (plData || []).length === 0 && !showPlForm ? <div style={{ padding: "8px 10px", borderRadius: 6, border: "1.5px dashed var(--bd)", textAlign: "center", color: "var(--tm)", fontSize: "0.72rem" }}>Chưa có packing list. Bấm "+ Nhập thủ công" hoặc "CSV/File".</div> :
          (plData || []).length > 0 && (
            <div style={{ border: "1px solid var(--bd)", borderRadius: 6, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>
                  <th style={ths}>#</th>
                  <th style={ths}>{isRound ? 'Mã cây' : 'Mã hộp'}</th>
                  {isRound ? (<>
                    <th style={{ ...ths, textAlign: "right" }}>Dài (m)</th>
                    <th style={{ ...ths, textAlign: "right" }}>ĐK (cm)</th>
                    <th style={{ ...ths, textAlign: "right" }}>CV (cm)</th>
                  </>) : (<>
                    <th style={{ ...ths, textAlign: "right" }}>Dày (cm)</th>
                    <th style={{ ...ths, textAlign: "right" }}>Rộng (cm)</th>
                    <th style={{ ...ths, textAlign: "right" }}>Dài (cm)</th>
                  </>)}
                  <th style={{ ...ths, textAlign: "right" }}>m³</th>
                  {isRound && <th style={ths}>CL</th>}
                  <th style={ths}>Ghi chú</th>
                </tr></thead>
                <tbody>
                  {plData.map((p, i) => (
                    <tr key={p.id} style={{ background: i % 2 ? "var(--bgs)" : "#fff" }}>
                      <td style={tds}>{i + 1}</td>
                      <td style={{ ...tds, fontFamily: "monospace", fontWeight: 600 }}>{p.pieceCode || "—"}</td>
                      {isRound ? (<>
                        <td style={{ ...tds, textAlign: "right", fontWeight: 600 }}>{p.lengthM ?? "—"}</td>
                        <td style={{ ...tds, textAlign: "right" }}>{p.diameterCm ?? "—"}</td>
                        <td style={{ ...tds, textAlign: "right" }}>{p.circumferenceCm ?? "—"}</td>
                      </>) : (<>
                        <td style={{ ...tds, textAlign: "right" }}>{p.thicknessCm ?? "—"}</td>
                        <td style={{ ...tds, textAlign: "right" }}>{p.widthCm ?? "—"}</td>
                        <td style={{ ...tds, textAlign: "right" }}>{p.lengthM != null ? Math.round(p.lengthM * 100) : "—"}</td>
                      </>)}
                      <td style={{ ...tds, textAlign: "right", fontWeight: 700, color: "var(--br)" }}>{p.volumeM3 != null ? p.volumeM3.toFixed(3) : "—"}</td>
                      {isRound && <td style={tds}>{p.quality || "—"}</td>}
                      <td style={{ ...tds, color: "var(--tm)", fontSize: "0.68rem" }}>{p.notes || ""}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr style={{ background: "var(--bgh)" }}>
                  <td colSpan={isRound ? 5 : 5} style={{ padding: "4px 6px", textAlign: "right", fontWeight: 700, fontSize: "0.62rem", color: "var(--brl)", borderTop: "1.5px solid var(--bds)" }}>Tổng ({plData.length}):</td>
                  <td style={{ padding: "4px 6px", textAlign: "right", fontWeight: 800, color: "var(--br)", fontSize: "0.72rem", borderTop: "1.5px solid var(--bds)" }}>{plData.reduce((s, p) => s + (p.volumeM3 || 0), 0).toFixed(3)} m³</td>
                  <td colSpan={2} style={{ borderTop: "1.5px solid var(--bds)" }} />
                </tr></tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab Lịch sử xuất ── */}
      {tab === "withdrawals" && <WithdrawalHistory containerId={c.id} totalVolume={c.totalVolume} weightUnit={c.weightUnit} useAPI={useAPI} />}

      {/* ── Tab Ảnh container ── */}
      {tab === "images" && (
        <div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {images.map((url, i) => (
              <div key={i} style={{ position: "relative" }}>
                <a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt="" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 6, border: "1px solid var(--bd)" }} /></a>
                {ce && <button onClick={() => setImages(p => p.filter((_, j) => j !== i))} style={{ position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: "50%", border: "none", background: "var(--dg)", color: "#fff", cursor: "pointer", fontSize: "0.56rem", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>}
              </div>
            ))}
            {newImgFiles.map((img, i) => (
              <div key={'n' + i} style={{ position: "relative" }}>
                <img src={img.preview} alt="" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 6, border: "1px solid var(--bd)", opacity: 0.7 }} />
                <div style={{ position: "absolute", bottom: 2, left: 2, fontSize: "0.5rem", background: "rgba(0,0,0,0.5)", color: "#fff", borderRadius: 2, padding: "1px 3px" }}>mới</div>
                <button onClick={() => setNewImgFiles(p => p.filter((_, j) => j !== i))} style={{ position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: "50%", border: "none", background: "var(--dg)", color: "#fff", cursor: "pointer", fontSize: "0.56rem", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
              </div>
            ))}
            {ce && images.length + newImgFiles.length < 5 && (
              <button onClick={() => imgRef.current?.click()} style={{ width: 80, height: 80, borderRadius: 6, border: "1.5px dashed var(--bd)", background: "var(--bgs)", color: "var(--tm)", cursor: "pointer", fontSize: "1.2rem" }}>+</button>
            )}
          </div>
          <input ref={imgRef} type="file" multiple accept="image/*" onChange={handleImgFiles} style={{ display: "none" }} />
          {newImgFiles.length > 0 && (
            <button onClick={saveImages} disabled={imgSaving} style={{ padding: "5px 14px", borderRadius: 5, background: "var(--ac)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.72rem" }}>{imgSaving ? "Đang lưu..." : `Lưu ${newImgFiles.length} ảnh mới`}</button>
          )}
          {images.length === 0 && newImgFiles.length === 0 && (
            <div style={{ fontSize: "0.72rem", color: "var(--tm)", fontStyle: "italic" }}>Chưa có ảnh. Bấm + để upload.</div>
          )}
        </div>
      )}
    </div>
  );
}

function ExpandedCargo({ sh, sc, contItems, suppliers, wts, rawWoodTypes, isAdmin, ce, unassignedConts, assignOpen, setAssignOpen, assignCont, removeCont, updateField, addNewContainer, useAPI, notify }) {
  const totalVol = sc.reduce((s, c) => s + (c.totalVolume || 0), 0);

  // Form tạo container mới inline — multi-row + CSV
  const lotCargoType = sh.lotType === "raw" ? "raw_round" : (sh.lotType || "sawn");
  const [showNewForm, setShowNewForm] = useState(false);
  const [saving, setSaving]           = useState(false);
  const [nfErr, setNfErr]             = useState("");
  const [showCsvInput, setShowCsvInput] = useState(false);
  const [csvText, setCsvText]           = useState("");
  const [formWeightUnit, setFormWeightUnit] = useState("m3");
  const [detailCont, setDetailCont] = useState(null); // container đang mở dialog chi tiết
  const csvRef = useRef(null);

  const defaultWoodId        = lotCargoType === "sawn" ? (sh.woodTypeId || "")    : "";
  const defaultRawWoodTypeId = lotCargoType !== "sawn" ? (sh.rawWoodTypeId || "") : "";

  const isBox = lotCargoType === "raw_box";
  const isRaw = lotCargoType === "raw_round" || lotCargoType === "raw_box";
  const volLabel = formWeightUnit === "ton" ? "tấn" : "m³";

  const emptyRow = () => ({
    containerCode: "",
    woodId: defaultWoodId,
    rawWoodTypeId: defaultRawWoodTypeId,
    lane: "", pieceCount: "", totalVolume: "",
    thicknessCm: "", widthCm: "", lengthCm: "",
    avgWidthCm: "",
    description: "",
    weightUnit: formWeightUnit,
  });
  const [nfRows, setNfRows] = useState([emptyRow()]);

  const setRow = (idx, key, val) =>
    setNfRows(p => p.map((r, i) => i === idx ? { ...r, [key]: val } : r));
  const addRow = () => setNfRows(p => [...p, emptyRow()]);
  const removeRow = (idx) => setNfRows(p => p.filter((_, i) => i !== idx));

  // Tự tính thể tích gỗ hộp: dày × rộng × dài (cm) → m³, làm tròn 3 số thập phân
  const calcBoxVol = (r) => {
    const t = parseFloat(r.thicknessCm), w = parseFloat(r.widthCm), l = parseFloat(r.lengthCm);
    if (!t || !w || !l) return "";
    return (t * w * l / 1e6).toFixed(3);
  };

  // Label số lượng theo lotType
  const pieceLabel = lotCargoType === "raw_round" ? "Số cây"
    : isBox ? "Số hộp" : "Số kiện";

  // Wood type options
  const woodOpts = useMemo(() => {
    if (lotCargoType === "sawn") return wts
      .filter(w => w.thicknessMode === 'fixed')
      .map(w => ({ id: w.id, label: `${w.icon || ""} ${w.name}` }));
    const form = lotCargoType === "raw_box" ? "box" : "round";
    return rawWoodTypes.filter(r => r.woodForm === form).map(r => ({ id: r.id, label: `${r.icon || ""} ${r.name}` }));
  }, [lotCargoType, wts, rawWoodTypes]);

  const openNewForm = () => {
    setNfRows([emptyRow()]);
    setNfErr("");
    setShowNewForm(true);
    setAssignOpen(null);
  };

  // Parse CSV text → rows
  // Gỗ hộp: Mã, Dày(cm), Rộng(cm), Dài(cm), KL(tự tính/bỏ qua), Ghi chú
  // Loại khác: Mã cont, Lối hàng, Số lượng, KL m³, Mô tả
  const parseCSVText = (text) => {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) return null;
    const firstCells = lines[0].split(/[,\t]/);
    const looksLikeHeader = firstCells[0]?.match(/^[A-Za-z\u00C0-\u024F]/) &&
      isNaN(parseFloat(firstCells[2])) && isNaN(parseFloat(firstCells[3]));
    const startIdx = looksLikeHeader ? 1 : 0;
    const parsed = lines.slice(startIdx).map(line => {
      const cols = line.split(/[,\t]/).map(c => c.trim().replace(/^["']|["']$/g, ''));
      const base = { ...emptyRow(), containerCode: cols[0] || '' };
      if (isBox) {
        // Mã, Dày(cm), Rộng(cm), Dài(cm), KL(skip/auto), Ghi chú
        const t = cols[1] || '', w = cols[2] || '', l = cols[3] || '';
        const vol = (parseFloat(t) && parseFloat(w) && parseFloat(l))
          ? (parseFloat(t) * parseFloat(w) * parseFloat(l) / 1e6).toFixed(3) : '';
        return { ...base, thicknessCm: t, widthCm: w, lengthCm: l, totalVolume: vol, description: cols[5] || '' };
      }
      return { ...base, lane: cols[1] || '', pieceCount: cols[2] || '', totalVolume: cols[3] || '', description: cols[4] || '' };
    }).filter(r => r.containerCode);
    return parsed.length ? parsed : null;
  };

  // Import từ file
  const handleCSV = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = ev => {
      const parsed = parseCSVText(ev.target.result || '');
      if (!parsed) { setNfErr('Không tìm thấy dữ liệu hợp lệ trong file'); return; }
      setNfRows(parsed); setNfErr(''); setShowCsvInput(false);
    };
    reader.readAsText(file, 'UTF-8');
  };

  // Áp dụng CSV nhập trực tiếp từ textarea
  const handlePasteCSV = () => {
    if (!csvText.trim()) return;
    const parsed = parseCSVText(csvText);
    if (!parsed) { setNfErr('Không tìm thấy dữ liệu hợp lệ'); return; }
    setNfRows(parsed); setNfErr(''); setShowCsvInput(false); setCsvText('');
  };

  const handleSaveNew = async () => {
    const valid = nfRows.filter(r => r.containerCode.trim());
    if (!valid.length) { setNfErr("Nhập ít nhất 1 mã container"); return; }
    setSaving(true);
    setNfErr("");
    const isSawn = lotCargoType === "sawn";
    let successCount = 0;
    for (const row of valid) {
      // Gỗ hộp: tính lại volume từ chiều đo nếu có
      const volStr = isBox ? (calcBoxVol(row) || row.totalVolume) : row.totalVolume;
      const vol = volStr ? parseFloat(volStr) : null;
      const woodId        = isSawn ? (row.woodId || null) : null;
      const rawWoodTypeId = !isSawn ? (row.rawWoodTypeId || null) : null;
      const containerFields = {
        containerCode: row.containerCode.trim(),
        cargoType: lotCargoType,
        nccId: sh.nccId || null,
        totalVolume: vol,
        notes: isBox ? (row.description || null) : (row.lane || null),
        status: "Tạo mới",
        weightUnit: lotCargoType !== "sawn" ? (row.weightUnit || "m3") : "m3",
        rawWoodTypeId: rawWoodTypeId || null,
        pieceCount: row.pieceCount ? parseInt(row.pieceCount) : null,
        ...(isBox && row.avgWidthCm ? { avgWidthCm: parseFloat(row.avgWidthCm) } : {}),
      };
      const itemData = (woodId || rawWoodTypeId || row.pieceCount || vol || row.description) ? {
        itemType: lotCargoType,
        woodId, rawWoodTypeId,
        pieceCount: row.pieceCount ? parseInt(row.pieceCount) : null,
        volume: vol,
        notes: row.description || null,
      } : null;
      const ok = await addNewContainer(sh.id, containerFields, itemData);
      if (ok) successCount++;
    }
    setSaving(false);
    if (successCount > 0) setShowNewForm(false);
  };

  const inpS = { padding: "5px 8px", borderRadius: 5, border: "1.5px solid var(--bd)", fontSize: "0.76rem", outline: "none", background: "var(--bgc)", color: "var(--tp)" };

  return (
    <div style={{ padding: "10px 14px 14px", background: "rgba(242,101,34,0.03)" }}>

      {/* Meta row: cảng + giá vốn (admin) */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 10, padding: "8px 10px", borderRadius: 7, background: "var(--bgc)", border: "1px solid var(--bds)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: "0.66rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase" }}>Cảng:</span>
          {ce ? (
            <input defaultValue={sh.portName || ""} onBlur={e => updateField(sh.id, "portName", e.target.value || null)}
              placeholder="Tên cảng" style={{ ...inpS, width: 120 }} />
          ) : (
            <span style={{ fontSize: "0.76rem" }}>{sh.portName || <span style={{ color: "var(--tm)" }}>—</span>}</span>
          )}
        </div>
        {sh.carrierName && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: "0.66rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase" }}>ĐVT:</span>
            <span style={{ fontSize: "0.76rem" }}>{sh.carrierName}</span>
          </div>
        )}
        {/* Giá vốn — admin only */}
        {isAdmin && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
            <span style={{ fontSize: "0.66rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase" }}>💰 Giá vốn:</span>
            {ce ? (
              <>
                <input type="number" step="0.01" defaultValue={sh.unitCostUsd ?? ""}
                  onBlur={e => updateField(sh.id, "unitCostUsd", e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="USD/m³" style={{ ...inpS, width: 90, textAlign: "right" }} />
                <span style={{ fontSize: "0.72rem", color: "var(--tm)" }}>USD/m³ ×</span>
                <input type="number" step="1" defaultValue={sh.exchangeRate ?? ""}
                  onBlur={e => updateField(sh.id, "exchangeRate", e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="Tỷ giá" style={{ ...inpS, width: 80, textAlign: "right" }} />
                {sh.unitCostUsd && sh.exchangeRate && (
                  <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--br)" }}>
                    = {(sh.unitCostUsd * sh.exchangeRate).toLocaleString("vi-VN")} đ/m³
                  </span>
                )}
              </>
            ) : (
              <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--br)" }}>
                {sh.unitCostUsd ? `${sh.unitCostUsd} USD/m³` : "—"}
                {sh.unitCostUsd && sh.exchangeRate ? ` = ${(sh.unitCostUsd * sh.exchangeRate).toLocaleString("vi-VN")} đ/m³` : ""}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Container list header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase" }}>
          Containers ({sc.length}) — {totalVol.toFixed(3)}
        </span>
        {ce && (
          <div style={{ display: "flex", gap: 5 }}>
            <button onClick={() => setAssignOpen(assignOpen === sh.id ? null : sh.id)}
              style={{ padding: "3px 9px", borderRadius: 5, background: "var(--bgs)", color: "var(--br)", border: "1.5px solid var(--br)", cursor: "pointer", fontWeight: 600, fontSize: "0.68rem" }}>
              Gắn có sẵn
            </button>
            <button onClick={openNewForm}
              style={{ padding: "3px 9px", borderRadius: 5, background: "var(--br)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.68rem" }}>
              + Tạo container
            </button>
          </div>
        )}
      </div>

      {/* Form tạo container mới inline — multi-row + CSV */}
      {showNewForm && (
        <div style={{ padding: "12px 14px", borderRadius: 8, background: "var(--bgc)", border: "1.5px solid var(--ac)", marginBottom: 10 }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: "0.78rem", color: "var(--br)" }}>
              Tạo container — Lô {sh.shipmentCode}
              {nfRows.length > 1 && <span style={{ marginLeft: 6, fontSize: "0.68rem", color: "var(--ac)", fontWeight: 600 }}>({nfRows.length} container)</span>}
            </span>
            {/* CSV import — cho non-box (gỗ tròn + sawn) */}
            {!isBox && (
              <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                <button onClick={() => csvRef.current?.click()}
                  style={{ padding: "3px 9px", borderRadius: 5, border: "1.5px dashed var(--bd)", background: "var(--bgs)", color: "var(--ts)", cursor: "pointer", fontSize: "0.68rem", fontWeight: 600 }}>
                  ↑ Tải file CSV
                </button>
                <button onClick={() => { setShowCsvInput(p => !p); setCsvText(""); }}
                  style={{ padding: "3px 9px", borderRadius: 5, border: `1.5px dashed ${showCsvInput ? "var(--ac)" : "var(--bd)"}`, background: showCsvInput ? "var(--acbg)" : "var(--bgs)", color: showCsvInput ? "var(--ac)" : "var(--ts)", cursor: "pointer", fontSize: "0.68rem", fontWeight: 600 }}>
                  ✎ Nhập trực tiếp
                </button>
                <input ref={csvRef} type="file" accept=".csv,.txt" onChange={handleCSV} style={{ display: "none" }} />
              </div>
            )}
          </div>

          {/* Chọn đơn vị — cho raw (gỗ tròn + hộp), hiện trước khi nhập data */}
          {isRaw && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, padding: "6px 10px", borderRadius: 6, background: "var(--bgs)", border: "1px solid var(--bds)" }}>
              <span style={{ fontSize: "0.66rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase" }}>Đơn vị đo:</span>
              {[{ v: "m3", l: "m³ (khối)" }, { v: "ton", l: "Tấn" }].map(opt => (
                <button key={opt.v} onClick={() => { setFormWeightUnit(opt.v); setNfRows(prev => prev.map(r => ({ ...r, weightUnit: opt.v }))); }}
                  style={{ padding: "4px 12px", borderRadius: 5, border: `1.5px solid ${formWeightUnit === opt.v ? "var(--br)" : "var(--bd)"}`, background: formWeightUnit === opt.v ? "rgba(90,62,43,0.1)" : "transparent", color: formWeightUnit === opt.v ? "var(--br)" : "var(--ts)", cursor: "pointer", fontSize: "0.72rem", fontWeight: formWeightUnit === opt.v ? 700 : 500 }}>
                  {opt.l}
                </button>
              ))}
            </div>
          )}

          {/* Textarea nhập CSV trực tiếp — chỉ non-box */}
          {!isBox && showCsvInput && (
            <div style={{ marginBottom: 10, padding: "8px 10px", borderRadius: 6, background: "var(--bgs)", border: "1px solid var(--bd)" }}>
              <div style={{ fontSize: "0.62rem", color: "var(--ts)", marginBottom: 4 }}>
                <strong>Mã cont, Lối hàng, Số lượng, KL m³, Mô tả</strong>
                <span style={{ marginLeft: 6, color: "var(--tm)" }}>— Có thể paste thẳng từ Excel (tab-separated)</span>
              </div>
              <textarea
                value={csvText}
                onChange={e => setCsvText(e.target.value)}
                placeholder="TCKU1234567,A1,100,25.5,Gỗ Tần Bì FAS\nTGHU8765432,B3,80,18.2,Gỗ Óc Chó 1COM"
                rows={4}
                autoFocus
                style={{ width: "100%", padding: "6px 8px", borderRadius: 5, border: "1.5px solid var(--bd)", fontSize: "0.74rem", fontFamily: "monospace", outline: "none", resize: "vertical", boxSizing: "border-box", background: "var(--bgc)", color: "var(--tp)" }}
              />
              <div style={{ display: "flex", gap: 6, marginTop: 5 }}>
                <button onClick={handlePasteCSV}
                  style={{ padding: "4px 14px", borderRadius: 5, background: "var(--ac)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.72rem" }}>
                  Áp dụng
                </button>
                <button onClick={() => { setShowCsvInput(false); setCsvText(""); }}
                  style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontSize: "0.72rem" }}>
                  Đóng
                </button>
              </div>
            </div>
          )}

          {/* Info lô hàng cho gỗ hộp */}
          {isBox && (
            <div style={{ marginBottom: 8, fontSize: "0.68rem", color: "var(--tm)", display: "flex", gap: 12 }}>
              <span>NCC: <strong style={{ color: "var(--br)" }}>{suppliers.find(s => s.nccId === sh.nccId)?.name || "—"}</strong> (theo lô)</span>
              <span>Loại gỗ: <strong style={{ color: "var(--br)" }}>{woodOpts.find(o => o.id === defaultRawWoodTypeId)?.label || "—"}</strong> (theo lô)</span>
            </div>
          )}

          {/* Table header */}
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4, paddingBottom: 4, borderBottom: "1px solid var(--bd)" }}>
            <span style={{ flexShrink: 0, width: 140, fontSize: "0.6rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase" }}>Mã cont *</span>
            {!isBox && <span style={{ flexShrink: 0, width: 100, fontSize: "0.6rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase" }}>Lối hàng</span>}
            {!isBox && <span style={{ flexShrink: 0, width: 155, fontSize: "0.6rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase" }}>Loại gỗ</span>}
            {isBox ? (<>
              <span style={{ flexShrink: 0, width: 68, fontSize: "0.6rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase", textAlign: "right" }}>Số cây</span>
              <span style={{ flexShrink: 0, width: 82, fontSize: "0.6rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase", textAlign: "right" }}>Tổng KL ({volLabel})</span>
              <span style={{ flexShrink: 0, width: 72, fontSize: "0.6rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase", textAlign: "right" }}>Rộng TB (cm)</span>
            </>) : (<>
              <span style={{ flexShrink: 0, width: 68, fontSize: "0.6rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase", textAlign: "right" }}>{pieceLabel}</span>
              <span style={{ flexShrink: 0, width: 82, fontSize: "0.6rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase", textAlign: "right" }}>KL ({volLabel})</span>
            </>)}
            <span style={{ flex: 1, fontSize: "0.6rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase" }}>Ghi chú</span>
            <span style={{ width: 22 }}></span>
          </div>

          {/* Rows */}
          {nfRows.map((row, idx) => (
              <div key={idx} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 5 }}>
                <input value={row.containerCode}
                  onChange={e => setRow(idx, "containerCode", e.target.value)}
                  placeholder={isBox ? "Mã cont" : "TCKU1234567"}
                  autoFocus={idx === 0}
                  style={{ ...inpS, flexShrink: 0, width: 140, borderColor: nfErr && !row.containerCode ? "var(--dg)" : "var(--bd)" }} />
                {!isBox && <input value={row.lane}
                  onChange={e => setRow(idx, "lane", e.target.value)}
                  placeholder="A1..."
                  style={{ ...inpS, flexShrink: 0, width: 100 }} />}
                {!isBox && <select
                  value={lotCargoType === "sawn" ? row.woodId : row.rawWoodTypeId}
                  onChange={e => setRow(idx, lotCargoType === "sawn" ? "woodId" : "rawWoodTypeId", e.target.value)}
                  style={{ ...inpS, flexShrink: 0, width: 155 }}>
                  <option value="">— Loại gỗ —</option>
                  {woodOpts.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                </select>}
                {isBox ? (<>
                  <input type="number" min="0" step="1" value={row.pieceCount}
                    onChange={e => setRow(idx, "pieceCount", e.target.value)}
                    placeholder="0"
                    style={{ ...inpS, flexShrink: 0, width: 68, textAlign: "right" }} />
                  <input type="number" step="0.001" min="0" value={row.totalVolume}
                    onChange={e => setRow(idx, "totalVolume", e.target.value)}
                    placeholder="0.000"
                    style={{ ...inpS, flexShrink: 0, width: 82, textAlign: "right" }} />
                  <input type="number" step="0.1" min="0" value={row.avgWidthCm}
                    onChange={e => setRow(idx, "avgWidthCm", e.target.value)}
                    placeholder="—"
                    style={{ ...inpS, flexShrink: 0, width: 72, textAlign: "right" }} />
                </>) : (<>
                  <input type="number" min="0" step="1" value={row.pieceCount}
                    onChange={e => setRow(idx, "pieceCount", e.target.value)}
                    placeholder="0"
                    style={{ ...inpS, flexShrink: 0, width: 68, textAlign: "right" }} />
                  <input type="number" step="0.001" min="0" value={row.totalVolume}
                    onChange={e => setRow(idx, "totalVolume", e.target.value)}
                    placeholder="0.000"
                    style={{ ...inpS, flexShrink: 0, width: 82, textAlign: "right" }} />
                </>)}
                <input value={row.description}
                  onChange={e => setRow(idx, "description", e.target.value)}
                  placeholder="Ghi chú..."
                  style={{ ...inpS, flex: 1, minWidth: 0 }} />
                <button onClick={() => removeRow(idx)} disabled={nfRows.length === 1}
                  style={{ flexShrink: 0, width: 22, height: 22, padding: 0, borderRadius: 4, border: "1px solid var(--dg)", background: "transparent", color: nfRows.length === 1 ? "var(--bd)" : "var(--dg)", cursor: nfRows.length === 1 ? "default" : "pointer", fontSize: "0.62rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  ✕
                </button>
              </div>
          ))}

          {/* Footer */}
          {nfErr && <div style={{ fontSize: "0.66rem", color: "var(--dg)", marginBottom: 6 }}>{nfErr}</div>}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
            <button onClick={addRow}
              style={{ padding: "4px 12px", borderRadius: 5, border: "1.5px dashed var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontSize: "0.72rem", fontWeight: 600 }}>
              + Thêm dòng
            </button>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={handleSaveNew} disabled={saving}
                style={{ padding: "6px 16px", borderRadius: 6, background: "var(--ac)", color: "#fff", border: "none", cursor: saving ? "not-allowed" : "pointer", fontWeight: 700, fontSize: "0.74rem", opacity: saving ? 0.7 : 1, whiteSpace: "nowrap" }}>
                {saving ? "Đang lưu..." : `Tạo & gắn${nfRows.filter(r => r.containerCode.trim()).length > 1 ? ` (${nfRows.filter(r => r.containerCode.trim()).length})` : ""}`}
              </button>
              <button onClick={() => setShowNewForm(false)} disabled={saving}
                style={{ padding: "6px 10px", borderRadius: 6, background: "transparent", color: "var(--ts)", border: "1.5px solid var(--bd)", cursor: "pointer", fontWeight: 600, fontSize: "0.74rem" }}>
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign picker (gắn cont đã có) */}
      {assignOpen === sh.id && (
        <div style={{ padding: "8px 10px", borderRadius: 7, background: "var(--bgc)", border: "1.5px solid var(--bd)", marginBottom: 8 }}>
          <div style={{ fontSize: "0.64rem", fontWeight: 700, color: "var(--brl)", marginBottom: 5, textTransform: "uppercase" }}>Chọn container đã có để gắn vào lô này:</div>
          {unassignedConts.length === 0 ? (
            <div style={{ fontSize: "0.72rem", color: "var(--tm)", fontStyle: "italic" }}>Tất cả container đã được gắn lô.</div>
          ) : (
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {unassignedConts.map(c => {
                const sup = suppliers.find(s => s.nccId === c.nccId);
                return (
                  <button key={c.id} onClick={() => assignCont(c.id, sh.id)}
                    style={{ padding: "4px 8px", borderRadius: 5, border: "1.5px solid var(--bd)", background: "#fff", cursor: "pointer", fontSize: "0.72rem", textAlign: "left" }}>
                    <strong>📦 {c.containerCode}</strong>
                    <span style={{ fontSize: "0.64rem", color: "var(--tm)", marginLeft: 4 }}>{sup?.name || ""} {c.totalVolume ? `${c.totalVolume} ${c.weightUnit === 'ton' ? 'tấn' : 'm³'}` : ""}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Container table — 1 row per container, aggregated from items */}
      {sc.length === 0 ? (
        <div style={{ padding: "10px 12px", borderRadius: 6, border: "1.5px dashed var(--bd)", background: "var(--bgs)", textAlign: "center", color: "var(--tm)", fontSize: "0.74rem" }}>
          Chưa có container — bấm <strong>"+ Tạo container"</strong> để tạo mới hoặc <strong>"Gắn có sẵn"</strong> để gắn container đã tạo
        </div>
      ) : (() => {
        // Dynamic column header based on lot type
        const lotType = sh.lotType;
        const pieceColLabel = lotType === "raw_round" ? "Số cây" : lotType === "raw_box" ? "Số hộp" : "Số kiện";
        const sizeColLabel  = lotType === "raw_round" ? "Kính TB (cm)" : lotType === "raw_box" ? "Rộng TB (cm)" : "Độ dày";
        const colHeaders = ["Loại gỗ", "NCC", "Mã container", pieceColLabel, sizeColLabel, "Chất lượng", "Tổng KL", "Trạng thái", "Ghi chú", ""];
        const thStyle = { padding: "5px 7px", textAlign: "left", color: "var(--brl)", fontWeight: 700, fontSize: "0.58rem", textTransform: "uppercase", borderBottom: "1.5px solid var(--bds)", whiteSpace: "nowrap" };

        // Helper: get wood label from item
        const getWoodLabel = (item) => {
          if (item.woodId) {
            const w = wts.find(x => x.id === item.woodId);
            return w ? `${w.icon || ""} ${w.name}` : item.woodId;
          }
          if (item.rawWoodTypeId) {
            const r = rawWoodTypes.find(x => x.id === item.rawWoodTypeId);
            return r ? `${r.icon || ""} ${r.name}` : item.rawWoodTypeId;
          }
          return null;
        };

        return (
          <div style={{ border: "1.5px solid var(--bd)", borderRadius: 7, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.74rem" }}>
              <thead>
                <tr style={{ background: "var(--bgh)" }}>
                  {colHeaders.map((h, i) => (
                    <th key={i} style={{ ...thStyle, textAlign: i === 3 ? "center" : i === 6 ? "right" : "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sc.map((c, ci) => {
                  const sup   = suppliers.find(s => s.nccId === c.nccId);
                  const items = contItems[c.id];
                  const bdBot = "1px solid var(--bd)";
                  const rowBg = ci % 2 ? "var(--bgs)" : "#fff";

                  // Aggregate from items
                  const woodLabels   = items ? [...new Set(items.map(getWoodLabel).filter(Boolean))].join(", ") : null;
                  const totalPieces  = items ? items.reduce((s, i) => s + (i.pieceCount || 0), 0) : null;
                  const qualities    = items ? [...new Set(items.map(i => i.quality).filter(Boolean))].join(", ") : null;
                  const itemVol      = items ? items.reduce((s, i) => s + (i.volume || 0), 0) : null;
                  const displayVol   = (itemVol && itemVol > 0) ? itemVol : c.totalVolume;

                  // Size metric per lot type
                  let sizeVal = "—";
                  if (lotType === "raw_round" && c.avgDiameterCm != null) {
                    sizeVal = c.avgDiameterCm.toFixed(1) + " cm";
                  } else if (lotType === "raw_box" && c.avgWidthCm != null) {
                    sizeVal = c.avgWidthCm.toFixed(1) + " cm";
                  } else if (items) {
                    // For sawn: aggregate thickness values
                    const thickSet = [...new Set(items.map(i => i.thickness).filter(Boolean))];
                    sizeVal = thickSet.join(", ") || "—";
                  }

                  const isRawCont = c.cargoType === "raw_round" || c.cargoType === "raw_box";
                  return (
                    <tr key={c.id} data-clickable={isRawCont ? "true" : undefined} onClick={() => isRawCont && setDetailCont(c)} style={{ background: rowBg, cursor: isRawCont ? "pointer" : "default" }}>
                      <td style={{ padding: "5px 7px", borderBottom: bdBot, fontWeight: 600, maxWidth: 150, whiteSpace: "nowrap" }}>
                        {items === undefined
                          ? <span style={{ color: "var(--tm)", fontStyle: "italic", fontSize: "0.68rem" }}>Đang tải...</span>
                          : woodLabels || <span style={{ color: "var(--tm)" }}>—</span>}
                      </td>
                      <td style={{ padding: "5px 7px", borderBottom: bdBot, fontSize: "0.72rem", whiteSpace: "nowrap" }}>
                        {sup?.name || c.nccId || <span style={{ color: "var(--tm)" }}>—</span>}
                      </td>
                      <td style={{ padding: "5px 7px", borderBottom: bdBot, fontWeight: 700, fontFamily: "monospace", fontSize: "0.73rem", whiteSpace: "nowrap" }}>
                        📦 {c.containerCode}
                      </td>
                      <td style={{ padding: "5px 7px", borderBottom: bdBot, textAlign: "center", fontWeight: 600, whiteSpace: "nowrap" }}>
                        {totalPieces != null && totalPieces > 0 ? totalPieces.toLocaleString("vi-VN") : "—"}
                      </td>
                      <td style={{ padding: "5px 7px", borderBottom: bdBot, fontSize: "0.72rem", whiteSpace: "nowrap" }}>
                        {sizeVal}
                      </td>
                      <td style={{ padding: "5px 7px", borderBottom: bdBot, fontSize: "0.72rem", whiteSpace: "nowrap" }}>
                        {qualities || <span style={{ color: "var(--tm)" }}>—</span>}
                      </td>
                      <td style={{ padding: "5px 7px", borderBottom: bdBot, textAlign: "right", fontWeight: 700, color: "var(--br)", whiteSpace: "nowrap" }}>
                        {displayVol != null ? `${displayVol.toFixed(3)} ${c.weightUnit === 'ton' ? 'tấn' : 'm³'}` : "—"}
                      </td>
                      <td style={{ padding: "5px 7px", borderBottom: bdBot, whiteSpace: "nowrap" }}>
                        <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: "0.64rem", fontWeight: 700, background: statusBg(c.status), color: statusColor(c.status) }}>{c.status || "—"}</span>
                      </td>
                      <td style={{ padding: "5px 7px", borderBottom: bdBot, fontSize: "0.68rem", color: "var(--ts)", whiteSpace: "normal", maxWidth: 160 }} title={c.notes || ""}>
                        {c.notes || <span style={{ color: "var(--tm)" }}>—</span>}
                      </td>
                      <td style={{ padding: "5px 7px", borderBottom: bdBot, whiteSpace: "nowrap" }} onClick={e => e.stopPropagation()}>
                        {ce && <button onClick={() => removeCont(c.id)} style={{ padding: "2px 7px", borderRadius: 4, border: "1px solid var(--dg)", background: "transparent", color: "var(--dg)", cursor: "pointer", fontSize: "0.62rem", fontWeight: 600 }}>Tháo</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: "var(--bgh)" }}>
                  <td colSpan={8} style={{ padding: "5px 7px", textAlign: "right", fontWeight: 700, fontSize: "0.66rem", color: "var(--brl)", borderTop: "2px solid var(--bds)" }}>Tổng {sc.length} cont:</td>
                  <td style={{ padding: "5px 7px", textAlign: "right", fontWeight: 800, color: "var(--br)", fontSize: "0.76rem", borderTop: "2px solid var(--bds)" }}>{totalVol.toFixed(3)}</td>
                  <td style={{ borderTop: "2px solid var(--bds)" }} />
                </tr>
              </tfoot>
            </table>
          </div>
        );
      })()}

      {/* Dialog chi tiết container raw */}
      {detailCont && (
        <Dialog open={true} onClose={() => setDetailCont(null)} title={`📦 ${detailCont.containerCode}`} width={700} noEnter maxHeight="90vh">
          <ContainerExpandPanel c={detailCont} ce={ce} useAPI={useAPI} notify={notify} suppliers={suppliers} rawWoodTypes={rawWoodTypes} />
        </Dialog>
      )}
    </div>
  );
}
