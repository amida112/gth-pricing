import React, { useState, useEffect, useMemo, useRef } from "react";

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

function DeadlineBadge({ deadline }) {
  const d = daysLeft(deadline);
  if (d === null) return <span style={{ color: "var(--tm)", fontSize: "0.72rem" }}>—</span>;
  let bg, color, text;
  if (d < 0)      { bg = "#C0392B"; color = "#fff"; text = `Quá ${-d}d`; }
  else if (d <= 2){ bg = "#E74C3C"; color = "#fff"; text = `${d}d`; }
  else if (d <= 5){ bg = "#F39C12"; color = "#fff"; text = `${d}d`; }
  else            { bg = "rgba(50,79,39,0.12)"; color = "var(--gn)"; text = `${d}d`; }
  const fmt = new Date(deadline + "T00:00:00").toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
      <span style={{ fontSize: "0.73rem" }}>{fmt}</span>
      <span style={{ padding: "1px 5px", borderRadius: 4, background: bg, color, fontSize: "0.6rem", fontWeight: 700, whiteSpace: "nowrap", animation: d < 0 ? "blink 1s infinite" : "none" }}>{text}</span>
    </span>
  );
}

/* Inline editable cell */
function ICell({ value, onChange, type = "text", placeholder, style, disabled, options }) {
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
      return <div style={cellBase} onClick={startEdit}><DeadlineBadge deadline={value} /></div>;
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

  const hasAlert = (sh) => [sh.yardDeadline, sh.contDeadline, sh.emptyDeadline]
    .some(dl => { const d = daysLeft(dl); return d !== null && d <= 2; });

  const visList = useMemo(() => {
    let arr = [...shipments];
    if (filterStatus)  arr = arr.filter(s => {
      const sc = contByShipment[s.id] || [];
      return computeShipmentStatus(s, sc).key === filterStatus;
    });
    if (filterLotType) arr = arr.filter(s => s.lotType === filterLotType);
    if (filterAlert)   arr = arr.filter(s => hasAlert(s));
    arr.sort((a, b) => {
      const da = a.eta || a.arrivalDate || "9999";
      const db = b.eta || b.arrivalDate || "9999";
      return da.localeCompare(db);
    });
    return arr;
    // eslint-disable-next-line
  }, [shipments, filterStatus, filterLotType, filterAlert, contByShipment, inspSummary]);

  const alertShipments = useMemo(
    () => shipments.filter(s => hasAlert(s) && s.status !== "Đã trả vỏ"),
    // eslint-disable-next-line
    [shipments]
  );

  // Single-field update — truyền object đến API mới
  const updateField = (id, field, value) => {
    setShipments(p => p.map(s => s.id === id ? { ...s, [field]: value ?? null } : s));
    if (!useAPI) return;
    import('../api.js').then(api => api.updateShipment(id, { [field]: value ?? null }))
      .then(r => { if (r?.error) notify("Lỗi: " + r.error, false); })
      .catch(e => notify("Lỗi: " + e.message, false));
  };

  const addRow = () => {
    const tmp = { id: "tmp_" + Date.now(), shipmentCode: "...", lotType: "sawn", nccId: null, eta: null, arrivalDate: null, portName: null, yardDeadline: null, contDeadline: null, emptyDeadline: null, carrierId: null, carrierName: null, unitCostUsd: null, exchangeRate: null, status: "Chờ cập cảng", notes: null };
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
                <th style={{ ...ths, minWidth: 130 }}>Mã lô</th>
                <th style={{ ...ths, minWidth: 56, textAlign: "center" }}>Cont</th>
                <th style={{ ...ths, minWidth: 120 }}>Loại gỗ</th>
                <th style={{ ...ths, minWidth: 110 }}>NCC</th>
                <th style={{ ...ths, minWidth: 120 }}>ĐV Vận tải</th>
                <th style={{ ...ths, minWidth: 90 }}>ETA</th>
                <th style={{ ...ths, minWidth: 90 }}>Hạn lưu cont</th>
                <th style={{ ...ths, minWidth: 90 }}>Hạn lưu bãi</th>
                <th style={{ ...ths, minWidth: 90 }}>Hạn trả vỏ</th>
                <th style={{ ...ths, minWidth: 110 }}>Trạng thái</th>
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
                const td       = { padding: 0, borderBottom: isExp ? "none" : "1px solid var(--bd)", background: rowBg };
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
                          <span style={{ fontWeight: 700, color: "var(--br)", fontSize: "0.76rem" }}>{sh.shipmentCode}</span>
                        </div>
                        <div style={{ marginTop: 3 }}>
                          {ce ? (
                            <select value={sh.lotType || "sawn"}
                              onChange={e => { e.stopPropagation(); updateField(sh.id, "lotType", e.target.value); }}
                              onClick={e => e.stopPropagation()}
                              style={{ padding: "1px 5px", borderRadius: 4, border: `1.5px solid ${lti.color}`, background: lti.bg, color: lti.color, fontSize: "0.62rem", fontWeight: 700, cursor: "pointer", outline: "none" }}>
                              {LOT_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                            </select>
                          ) : (
                            <span style={{ padding: "1px 6px", borderRadius: 4, background: lti.bg, color: lti.color, fontSize: "0.62rem", fontWeight: 700 }}>{lti.icon} {lti.label}</span>
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

                      {/* NCC */}
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
                          <div style={{ padding: "5px 7px", fontSize: "0.74rem" }}>{nccObj?.name || <span style={{ color: "var(--tm)" }}>—</span>}</div>
                        )}
                      </td>

                      {/* ĐV Vận tải */}
                      <td style={td}><ICell value={sh.carrierName} disabled={!ce} placeholder="Đơn vị vận tải" onChange={v => updateField(sh.id, "carrierName", v || null)} /></td>

                      {/* ETA (Ngày cập cảng) */}
                      <td style={td}><ICell value={sh.eta} type="date" disabled={!ce} placeholder="ETA" onChange={v => updateField(sh.id, "eta", v || null)} /></td>

                      {/* Deadlines: cont → bãi → vỏ */}
                      <td style={td}><ICell value={sh.contDeadline}  type="deadline" disabled={!ce} placeholder="Hạn cont" onChange={v => updateField(sh.id, "contDeadline", v || null)} /></td>
                      <td style={td}><ICell value={sh.yardDeadline}  type="deadline" disabled={!ce} placeholder="Hạn bãi"  onChange={v => updateField(sh.id, "yardDeadline", v || null)} /></td>
                      <td style={td}><ICell value={sh.emptyDeadline} type="deadline" disabled={!ce} placeholder="Hạn vỏ"   onChange={v => updateField(sh.id, "emptyDeadline", v || null)} /></td>

                      {/* Trạng thái — tự động */}
                      <td style={{ ...td, padding: "5px 7px" }}>
                        <span style={{ padding: "2px 8px", borderRadius: 5, fontSize: "0.68rem", fontWeight: 700, background: statusInfo.bg, color: statusInfo.color, whiteSpace: "nowrap" }}>
                          {statusInfo.label}
                        </span>
                      </td>

                      {/* Ghi chú */}
                      <td style={td}><ICell value={sh.notes} disabled={!ce} placeholder="Ghi chú..." onChange={v => updateField(sh.id, "notes", v || null)} /></td>

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

function ExpandedCargo({ sh, sc, contItems, suppliers, wts, rawWoodTypes, isAdmin, ce, unassignedConts, assignOpen, setAssignOpen, assignCont, removeCont, updateField, addNewContainer }) {
  const totalVol = sc.reduce((s, c) => s + (c.totalVolume || 0), 0);

  // Form tạo container mới inline
  const defaultCargoType = sh.lotType === "raw" ? "raw_round" : "sawn";
  const [showNewForm, setShowNewForm]   = useState(false);
  const [saving, setSaving]             = useState(false);
  // rawWoodTypes nhận từ prop (đã load ở PgShipment)
  const emptyNf = () => ({
    containerCode: "", cargoType: defaultCargoType,
    nccId: sh.nccId || "",
    woodId: "", rawWoodTypeId: "",  // loại gỗ theo cargoType
    lane: "",                        // lối hàng
    description: "",                 // mô tả hàng hóa
    pieceCount: "",                  // số kiện/cây/hộp
    totalVolume: "",
  });
  const [nf, setNf] = useState(emptyNf);
  const [nfErr, setNfErr] = useState("");
  const setF = (k) => (e) => setNf(p => ({ ...p, [k]: e.target.value }));

  // Label số lượng theo cargoType
  const pieceLabel = nf.cargoType === "raw_round" ? "Số cây"
    : nf.cargoType === "raw_box" ? "Số hộp" : "Số kiện";

  // Wood type list theo cargoType
  const woodOpts = useMemo(() => {
    if (nf.cargoType === "sawn") return wts.map(w => ({ id: w.id, label: `${w.icon || ""} ${w.name}` }));
    const form = nf.cargoType === "raw_box" ? "box" : "round";
    return rawWoodTypes.filter(r => r.woodForm === form).map(r => ({ id: r.id, label: `${r.icon || ""} ${r.name}` }));
  }, [nf.cargoType, wts, rawWoodTypes]);

  const openNewForm = () => {
    setNf(emptyNf());
    setNfErr("");
    setShowNewForm(true);
    setAssignOpen(null);
  };

  // Reset wood selection khi đổi cargoType
  const handleCargoTypeChange = (e) => {
    setNf(p => ({ ...p, cargoType: e.target.value, woodId: "", rawWoodTypeId: "" }));
  };

  const handleSaveNew = async () => {
    if (!nf.containerCode.trim()) { setNfErr("Nhập mã container"); return; }
    setSaving(true);
    setNfErr("");
    const isSawn = nf.cargoType === "sawn";
    const vol = nf.totalVolume ? parseFloat(nf.totalVolume) : null;

    const containerFields = {
      containerCode: nf.containerCode.trim(),
      cargoType: nf.cargoType,
      nccId: nf.nccId || null,
      totalVolume: vol,
      notes: nf.lane || null,   // lối hàng → notes
      status: "Tạo mới",
      weightUnit: "m3",
    };

    // Item data (loại gỗ + số lượng + mô tả)
    const woodId        = isSawn ? (nf.woodId || null) : null;
    const rawWoodTypeId = !isSawn ? (nf.rawWoodTypeId || null) : null;
    const itemData = (woodId || rawWoodTypeId || nf.pieceCount || vol || nf.description) ? {
      itemType: nf.cargoType,
      woodId, rawWoodTypeId,
      pieceCount: nf.pieceCount ? parseInt(nf.pieceCount) : null,
      volume: vol,
      notes: nf.description || null,
    } : null;

    const ok = await addNewContainer(sh.id, containerFields, itemData);
    setSaving(false);
    if (ok) setShowNewForm(false);
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
          Containers ({sc.length}) — {totalVol.toFixed(3)} m³
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

      {/* Form tạo container mới inline */}
      {showNewForm && (
        <div style={{ padding: "14px 16px", borderRadius: 8, background: "var(--bgc)", border: "1.5px solid var(--ac)", marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: "0.78rem", color: "var(--br)", marginBottom: 12 }}>
            Tạo container mới — gắn vào lô {sh.shipmentCode}
          </div>

          {/* Hàng 1: Container code + Loại hàng + NCC */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <div>
              <label style={{ display: "block", fontSize: "0.62rem", fontWeight: 700, color: "var(--brl)", marginBottom: 2 }}>Mã container *</label>
              <input value={nf.containerCode} onChange={setF("containerCode")} placeholder="VD: TCKU1234567"
                autoFocus style={{ ...inpS, width: 150, borderColor: nfErr ? "var(--dg)" : "var(--bd)" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.62rem", fontWeight: 700, color: "var(--brl)", marginBottom: 2 }}>Loại hàng</label>
              <select value={nf.cargoType} onChange={handleCargoTypeChange} style={{ ...inpS }}>
                {CARGO_TYPE_OPTS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.62rem", fontWeight: 700, color: "var(--brl)", marginBottom: 2 }}>NCC</label>
              <select value={nf.nccId} onChange={setF("nccId")} style={{ ...inpS }}>
                <option value="">— Chọn NCC —</option>
                {suppliers.map(s => <option key={s.nccId} value={s.nccId}>{s.name}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={{ display: "block", fontSize: "0.62rem", fontWeight: 700, color: "var(--brl)", marginBottom: 2 }}>Lối hàng</label>
              <input value={nf.lane} onChange={setF("lane")} placeholder="VD: A1, B2..." style={{ ...inpS, width: "100%" }} />
            </div>
          </div>

          {/* Hàng 2: Loại gỗ + Số lượng + Tổng KL + Mô tả */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={{ minWidth: 180 }}>
              <label style={{ display: "block", fontSize: "0.62rem", fontWeight: 700, color: "var(--brl)", marginBottom: 2 }}>
                Loại gỗ ({CARGO_TYPE_OPTS.find(o => o.value === nf.cargoType)?.label})
              </label>
              {woodOpts.length === 0
                ? <div style={{ ...inpS, color: "var(--tm)", fontSize: "0.72rem", padding: "6px 8px" }}>Đang tải...</div>
                : <select
                    value={nf.cargoType === "sawn" ? nf.woodId : nf.rawWoodTypeId}
                    onChange={e => setNf(p => nf.cargoType === "sawn" ? { ...p, woodId: e.target.value } : { ...p, rawWoodTypeId: e.target.value })}
                    style={{ ...inpS, minWidth: 180 }}>
                    <option value="">— Chọn loại gỗ —</option>
                    {woodOpts.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                  </select>
              }
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.62rem", fontWeight: 700, color: "var(--brl)", marginBottom: 2 }}>{pieceLabel}</label>
              <input type="number" min="0" step="1" value={nf.pieceCount} onChange={setF("pieceCount")}
                placeholder="0" style={{ ...inpS, width: 80, textAlign: "right" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.62rem", fontWeight: 700, color: "var(--brl)", marginBottom: 2 }}>Tổng KL (m³)</label>
              <input type="number" step="0.001" min="0" value={nf.totalVolume} onChange={setF("totalVolume")}
                placeholder="0.000" style={{ ...inpS, width: 100, textAlign: "right" }} />
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label style={{ display: "block", fontSize: "0.62rem", fontWeight: 700, color: "var(--brl)", marginBottom: 2 }}>Mô tả hàng hóa</label>
              <input value={nf.description} onChange={setF("description")}
                placeholder="VD: Gỗ Tần Bì 4/4, KD, FAS" style={{ ...inpS, width: "100%" }} />
            </div>
          </div>

          {nfErr && <div style={{ fontSize: "0.66rem", color: "var(--dg)", marginTop: 6 }}>{nfErr}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={handleSaveNew} disabled={saving}
              style={{ padding: "6px 16px", borderRadius: 6, background: "var(--ac)", color: "#fff", border: "none", cursor: saving ? "not-allowed" : "pointer", fontWeight: 700, fontSize: "0.76rem", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Đang lưu..." : "Tạo & gắn vào lô"}
            </button>
            <button onClick={() => setShowNewForm(false)} disabled={saving}
              style={{ padding: "6px 14px", borderRadius: 6, background: "transparent", color: "var(--ts)", border: "1.5px solid var(--bd)", cursor: "pointer", fontWeight: 600, fontSize: "0.76rem" }}>
              Hủy
            </button>
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
                    <span style={{ fontSize: "0.64rem", color: "var(--tm)", marginLeft: 4 }}>{sup?.name || ""} {c.totalVolume ? `${c.totalVolume}m³` : ""}</span>
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
        const colHeaders = ["Loại gỗ", "NCC", "Mã container", pieceColLabel, sizeColLabel, "Chất lượng", "Tổng KL (m³)", ""];
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
                    <th key={i} style={{ ...thStyle, textAlign: i === 6 ? "right" : "left" }}>{h}</th>
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

                  return (
                    <tr key={c.id} style={{ background: rowBg }}>
                      {/* Loại gỗ */}
                      <td style={{ padding: "5px 7px", borderBottom: bdBot, fontWeight: 600, maxWidth: 150 }}>
                        {items === undefined
                          ? <span style={{ color: "var(--tm)", fontStyle: "italic", fontSize: "0.68rem" }}>Đang tải...</span>
                          : woodLabels || <span style={{ color: "var(--tm)" }}>—</span>}
                      </td>
                      {/* NCC */}
                      <td style={{ padding: "5px 7px", borderBottom: bdBot, fontSize: "0.72rem" }}>
                        {sup?.name || c.nccId || <span style={{ color: "var(--tm)" }}>—</span>}
                      </td>
                      {/* Mã container */}
                      <td style={{ padding: "5px 7px", borderBottom: bdBot, fontWeight: 700, fontFamily: "monospace", fontSize: "0.73rem" }}>
                        📦 {c.containerCode}
                      </td>
                      {/* Số kiện/cây/hộp */}
                      <td style={{ padding: "5px 7px", borderBottom: bdBot, textAlign: "right", fontWeight: 600 }}>
                        {totalPieces != null && totalPieces > 0 ? totalPieces.toLocaleString("vi-VN") : "—"}
                      </td>
                      {/* Kính TB / Rộng TB / Độ dày */}
                      <td style={{ padding: "5px 7px", borderBottom: bdBot, fontSize: "0.72rem" }}>
                        {sizeVal}
                      </td>
                      {/* Chất lượng */}
                      <td style={{ padding: "5px 7px", borderBottom: bdBot, fontSize: "0.72rem" }}>
                        {qualities || <span style={{ color: "var(--tm)" }}>—</span>}
                      </td>
                      {/* Tổng KL */}
                      <td style={{ padding: "5px 7px", borderBottom: bdBot, textAlign: "right", fontWeight: 700, color: "var(--br)" }}>
                        {displayVol != null ? displayVol.toFixed(3) : "—"}
                      </td>
                      {/* Tháo */}
                      <td style={{ padding: "5px 7px", borderBottom: bdBot }}>
                        {ce && <button onClick={() => removeCont(c.id)} style={{ padding: "2px 7px", borderRadius: 4, border: "1px solid var(--dg)", background: "transparent", color: "var(--dg)", cursor: "pointer", fontSize: "0.62rem", fontWeight: 600 }}>Tháo</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: "var(--bgh)" }}>
                  <td colSpan={6} style={{ padding: "5px 7px", textAlign: "right", fontWeight: 700, fontSize: "0.66rem", color: "var(--brl)", borderTop: "2px solid var(--bds)" }}>Tổng {sc.length} cont:</td>
                  <td style={{ padding: "5px 7px", textAlign: "right", fontWeight: 800, color: "var(--br)", fontSize: "0.76rem", borderTop: "2px solid var(--bds)" }}>{totalVol.toFixed(3)} m³</td>
                  <td style={{ borderTop: "2px solid var(--bds)" }} />
                </tr>
              </tfoot>
            </table>
          </div>
        );
      })()}
    </div>
  );
}
