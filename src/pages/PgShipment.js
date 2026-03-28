import React, { useState, useEffect, useMemo, useRef } from "react";

export const SHIPMENT_STATUSES = ["Chờ cập cảng", "Đã cập cảng", "Đang kéo về", "Đã nhập kho", "Đã trả vỏ"];

const LOT_TYPES = [
  { value: "sawn", label: "Gỗ xẻ", icon: "🪚", color: "var(--gn)",  bg: "rgba(50,79,39,0.1)" },
  { value: "raw",  label: "Gỗ NL",  icon: "🪵", color: "#8B5E3C",   bg: "rgba(139,94,60,0.1)" },
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
  const [shipments, setShipments]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [expId, setExpId]             = useState(null);
  const [contItems, setContItems]     = useState({});
  const [filterStatus, setFilterStatus]   = useState("");
  const [filterLotType, setFilterLotType] = useState("");
  const [filterAlert, setFilterAlert]     = useState(false);
  const [assignOpen, setAssignOpen]   = useState(null);

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!useAPI) { setLoading(false); return; }
    import('../api.js').then(api => api.fetchShipments())
      .then(data => { setShipments(data); setLoading(false); })
      .catch(e => { notify("Lỗi tải lô hàng: " + e.message, false); setLoading(false); });
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
    if (filterStatus)  arr = arr.filter(s => s.status === filterStatus);
    if (filterLotType) arr = arr.filter(s => s.lotType === filterLotType);
    if (filterAlert)   arr = arr.filter(s => hasAlert(s));
    // Sắp xếp: ETA (nếu có), sau đó arrivalDate
    arr.sort((a, b) => {
      const da = a.eta || a.arrivalDate || "9999";
      const db = b.eta || b.arrivalDate || "9999";
      return da.localeCompare(db);
    });
    return arr;
    // eslint-disable-next-line
  }, [shipments, filterStatus, filterLotType, filterAlert]);

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

  const del = (sh) => {
    const sc = contByShipment[sh.id] || [];
    if (sc.length > 0) { notify(`Không thể xóa — đang có ${sc.length} container thuộc lô này.`, false); return; }
    if (!window.confirm(`Xóa lô ${sh.shipmentCode}?`)) return;
    setShipments(p => p.filter(x => x.id !== sh.id));
    if (expId === sh.id) setExpId(null);
    if (useAPI) import('../api.js').then(api => api.deleteShipment(sh.id))
      .then(r => { if (r?.error) notify("Lỗi: " + r.error, false); })
      .catch(e => notify("Lỗi: " + e.message, false));
  };

  const addNewContainerToShipment = async (shipmentId, fields) => {
    const api = await import('../api.js');
    const r = await api.addContainer({ ...fields, shipmentId, isStandalone: false }).catch(e => ({ error: e.message }));
    if (r?.error) { notify('Lỗi: ' + r.error, false); return false; }
    // Reload containers để có id thực
    const updated = await api.fetchContainers().catch(() => null);
    if (updated) setContainers(updated);
    notify('Đã tạo container ' + fields.containerCode);
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

  // Supplier list filtered by lot type
  const filteredSuppliers = (lotType) => {
    if (!lotType || lotType === "sawn") return suppliers;
    return suppliers; // Có thể filter theo supplier_wood_assignments sau
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
          {SHIPMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
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
          <table style={{ width: "100%", minWidth: 1200, borderCollapse: "collapse", fontSize: "0.76rem" }}>
            <thead>
              <tr>
                <th style={{ ...ths, width: 32, textAlign: "center" }}>STT</th>
                <th style={{ ...ths, minWidth: 110 }}>Mã lô</th>
                <th style={{ ...ths, minWidth: 110 }}>NCC</th>
                <th style={{ ...ths, minWidth: 96 }}>ETA (dự kiến)</th>
                <th style={{ ...ths, minWidth: 96 }}>Ngày về</th>
                <th style={{ ...ths, minWidth: 88 }}>Hạn lưu bãi</th>
                <th style={{ ...ths, minWidth: 88 }}>Hạn lưu cont</th>
                <th style={{ ...ths, minWidth: 88 }}>Hạn trả vỏ</th>
                <th style={{ ...ths, minWidth: 130 }}>ĐV vận tải</th>
                <th style={{ ...ths, minWidth: 60, textAlign: "center" }}>Cont</th>
                <th style={{ ...ths, minWidth: 110 }}>Trạng thái</th>
                <th style={{ ...ths, minWidth: 120 }}>Ghi chú</th>
                {ce && <th style={{ ...ths, width: 36 }}></th>}
              </tr>
            </thead>
            <tbody>
              {visList.length === 0 && (
                <tr><td colSpan={ce ? 13 : 12} style={{ padding: 28, textAlign: "center", color: "var(--tm)" }}>
                  {shipments.length === 0 ? 'Chưa có lô hàng — bấm "+ Thêm lô" để bắt đầu' : "Không có lô nào khớp bộ lọc"}
                </td></tr>
              )}
              {visList.map((sh, idx) => {
                const isExp = expId === sh.id;
                const sc    = contByShipment[sh.id] || [];
                const totalVol = sc.reduce((s, c) => s + (c.totalVolume || 0), 0);
                const alert = hasAlert(sh);
                const rowBg = isExp ? "var(--acbg)" : alert ? "rgba(231,76,60,0.04)" : (idx % 2 ? "var(--bgs)" : "#fff");
                const td    = { padding: 0, borderBottom: isExp ? "none" : "1px solid var(--bd)", background: rowBg };
                const lti   = lotTypeInfo(sh.lotType);
                const nccObj = suppliers.find(s => s.nccId === sh.nccId);

                return (
                  <React.Fragment key={sh.id}>
                    <tr>
                      {/* STT + expand */}
                      <td style={{ ...td, textAlign: "center", padding: "6px 4px", color: "var(--tm)", fontWeight: 600, fontSize: "0.72rem", cursor: "pointer" }}
                        onClick={() => toggleExp(sh.id)}>
                        <span style={{ fontSize: "0.65rem", color: isExp ? "var(--ac)" : "var(--tm)", marginRight: 2 }}>{isExp ? "▾" : "▸"}</span>
                        {idx + 1}
                      </td>

                      {/* Mã lô + lot type badge */}
                      <td style={{ ...td, padding: "5px 8px", cursor: "pointer" }} onClick={() => toggleExp(sh.id)}>
                        <div style={{ fontWeight: 700, color: "var(--br)", fontSize: "0.74rem" }}>{sh.shipmentCode}</div>
                        <div style={{ marginTop: 2 }}>
                          {ce ? (
                            <select value={sh.lotType || "sawn"}
                              onChange={e => { e.stopPropagation(); updateField(sh.id, "lotType", e.target.value); }}
                              onClick={e => e.stopPropagation()}
                              style={{ padding: "1px 4px", borderRadius: 4, border: `1.5px solid ${lti.color}`, background: lti.bg, color: lti.color, fontSize: "0.62rem", fontWeight: 700, cursor: "pointer", outline: "none" }}>
                              {LOT_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                            </select>
                          ) : (
                            <span style={{ padding: "1px 6px", borderRadius: 4, background: lti.bg, color: lti.color, fontSize: "0.62rem", fontWeight: 700 }}>{lti.icon} {lti.label}</span>
                          )}
                        </div>
                      </td>

                      {/* NCC */}
                      <td style={td} onClick={e => e.stopPropagation()}>
                        {ce ? (
                          <select value={sh.nccId || ""}
                            onChange={e => updateField(sh.id, "nccId", e.target.value || null)}
                            style={{ width: "100%", padding: "5px 6px", border: "none", borderBottom: "1.5px solid transparent", fontSize: "0.74rem", background: "transparent", outline: "none", color: "var(--tp)", cursor: "pointer" }}
                            onFocus={e => e.target.style.borderBottomColor = "var(--ac)"}
                            onBlur={e => e.target.style.borderBottomColor = "transparent"}>
                            <option value="">— Chọn NCC —</option>
                            {filteredSuppliers(sh.lotType).map(s => <option key={s.id} value={s.nccId}>{s.name}</option>)}
                          </select>
                        ) : (
                          <div style={{ padding: "5px 7px", fontSize: "0.74rem" }}>{nccObj?.name || sh.nccId || <span style={{ color: "var(--tm)" }}>—</span>}</div>
                        )}
                      </td>

                      {/* ETA */}
                      <td style={td}><ICell value={sh.eta} type="date" disabled={!ce} placeholder="ETA" onChange={v => updateField(sh.id, "eta", v || null)} /></td>

                      {/* Ngày về thực tế */}
                      <td style={td}><ICell value={sh.arrivalDate} type="date" disabled={!ce} placeholder="Ngày về" onChange={v => updateField(sh.id, "arrivalDate", v || null)} /></td>

                      {/* Deadlines */}
                      <td style={td}><ICell value={sh.yardDeadline}  type="deadline" disabled={!ce} placeholder="Hạn bãi"  onChange={v => updateField(sh.id, "yardDeadline", v || null)} /></td>
                      <td style={td}><ICell value={sh.contDeadline}  type="deadline" disabled={!ce} placeholder="Hạn cont"  onChange={v => updateField(sh.id, "contDeadline", v || null)} /></td>
                      <td style={td}><ICell value={sh.emptyDeadline} type="deadline" disabled={!ce} placeholder="Hạn vỏ"   onChange={v => updateField(sh.id, "emptyDeadline", v || null)} /></td>

                      {/* ĐV vận tải — free text */}
                      <td style={td}><ICell value={sh.carrierName} disabled={!ce} placeholder="Tên đơn vị vận tải" onChange={v => updateField(sh.id, "carrierName", v || null)} /></td>

                      {/* Số container */}
                      <td style={{ ...td, padding: "6px 8px", textAlign: "center", cursor: "pointer" }} onClick={() => toggleExp(sh.id)}>
                        <span style={{ fontWeight: 600 }}>{sc.length}</span>
                        {totalVol > 0 && <div style={{ fontSize: "0.62rem", color: "var(--tm)" }}>{totalVol.toFixed(1)}m³</div>}
                      </td>

                      {/* Trạng thái */}
                      <td style={td}><ICell value={sh.status} type="status" disabled={!ce} onChange={v => updateField(sh.id, "status", v)} /></td>

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
                        <td colSpan={ce ? 13 : 12} style={{ padding: 0, borderBottom: "2px solid var(--ac)" }}>
                          <ExpandedCargo
                            sh={sh} sc={sc} contItems={contItems} suppliers={suppliers} wts={wts}
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

function ExpandedCargo({ sh, sc, contItems, suppliers, wts, isAdmin, ce, unassignedConts, assignOpen, setAssignOpen, assignCont, removeCont, updateField, addNewContainer }) {
  const totalVol = sc.reduce((s, c) => s + (c.totalVolume || 0), 0);

  // Form tạo container mới inline
  const defaultCargoType = sh.lotType === "raw" ? "raw_round" : "sawn";
  const [showNewForm, setShowNewForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nf, setNf] = useState({
    containerCode: "", cargoType: defaultCargoType,
    nccId: sh.nccId || "", arrivalDate: "", totalVolume: "", notes: "",
  });
  const [nfErr, setNfErr] = useState("");
  const setF = (k) => (e) => setNf(p => ({ ...p, [k]: e.target.value }));

  const openNewForm = () => {
    setNf({ containerCode: "", cargoType: defaultCargoType, nccId: sh.nccId || "", arrivalDate: "", totalVolume: "", notes: "" });
    setNfErr("");
    setShowNewForm(true);
    setAssignOpen(null);
  };

  const handleSaveNew = async () => {
    if (!nf.containerCode.trim()) { setNfErr("Nhập mã container"); return; }
    setSaving(true);
    const fields = {
      containerCode: nf.containerCode.trim(),
      cargoType: nf.cargoType,
      nccId: nf.nccId || null,
      arrivalDate: nf.arrivalDate || null,
      totalVolume: nf.totalVolume ? parseFloat(nf.totalVolume) : null,
      notes: nf.notes || null,
      status: "Tạo mới",
      weightUnit: "m3",
    };
    const ok = await addNewContainer(sh.id, fields);
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
        <div style={{ padding: "12px 14px", borderRadius: 8, background: "var(--bgc)", border: "1.5px solid var(--ac)", marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: "0.78rem", color: "var(--br)", marginBottom: 10 }}>
            Tạo container mới — gắn vào lô {sh.shipmentCode}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.62rem", fontWeight: 700, color: "var(--brl)", marginBottom: 2 }}>Mã container *</label>
              <input value={nf.containerCode} onChange={setF("containerCode")} placeholder="VD: TCKU1234567"
                autoFocus
                style={{ ...inpS, width: 140, borderColor: nfErr ? "var(--dg)" : "var(--bd)" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.62rem", fontWeight: 700, color: "var(--brl)", marginBottom: 2 }}>Loại hàng</label>
              <select value={nf.cargoType} onChange={setF("cargoType")} style={{ ...inpS }}>
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
            <div>
              <label style={{ display: "block", fontSize: "0.62rem", fontWeight: 700, color: "var(--brl)", marginBottom: 2 }}>Ngày về</label>
              <input type="date" value={nf.arrivalDate} onChange={setF("arrivalDate")} style={{ ...inpS, width: 140 }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.62rem", fontWeight: 700, color: "var(--brl)", marginBottom: 2 }}>Tổng KL (m³)</label>
              <input type="number" step="0.001" min="0" value={nf.totalVolume} onChange={setF("totalVolume")} placeholder="0.000" style={{ ...inpS, width: 90, textAlign: "right" }} />
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <label style={{ display: "block", fontSize: "0.62rem", fontWeight: 700, color: "var(--brl)", marginBottom: 2 }}>Ghi chú</label>
              <input value={nf.notes} onChange={setF("notes")} placeholder="Tùy chọn" style={{ ...inpS, width: "100%" }} />
            </div>
          </div>
          {nfErr && <div style={{ fontSize: "0.66rem", color: "var(--dg)", marginTop: 4 }}>{nfErr}</div>}
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

      {/* Container table */}
      {sc.length === 0 ? (
        <div style={{ padding: "10px 12px", borderRadius: 6, border: "1.5px dashed var(--bd)", background: "var(--bgs)", textAlign: "center", color: "var(--tm)", fontSize: "0.74rem" }}>
          Chưa có container — bấm <strong>"+ Tạo container"</strong> để tạo mới hoặc <strong>"Gắn có sẵn"</strong> để gắn container đã tạo
        </div>
      ) : (
        <div style={{ border: "1.5px solid var(--bd)", borderRadius: 7, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.74rem" }}>
            <thead>
              <tr style={{ background: "var(--bgh)" }}>
                {["Container", "Loại hàng", "NCC", "Loại gỗ", "Dày/SL", "CL", "m³", ""].map((h, i) => (
                  <th key={i} style={{ padding: "5px 7px", textAlign: i === 6 ? "right" : "left", color: "var(--brl)", fontWeight: 700, fontSize: "0.58rem", textTransform: "uppercase", borderBottom: "1.5px solid var(--bds)", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sc.map((c, ci) => {
                const sup   = suppliers.find(s => s.nccId === c.nccId);
                const items = contItems[c.id];
                const rowCount = items ? Math.max(items.length, 1) : 1;
                const bdBot = "1px solid var(--bd)";
                const bdSub = "1px solid var(--bds)";
                // cargo type badge
                const ctInfo = { sawn: { label: "Gỗ xẻ", color: "var(--gn)" }, raw_round: { label: "Gỗ tròn", color: "#8B5E3C" }, raw_box: { label: "Gỗ hộp", color: "#2980b9" } };
                const ct = ctInfo[c.cargoType] || ctInfo.sawn;

                if (items === undefined) {
                  return (
                    <tr key={c.id} style={{ background: ci % 2 ? "var(--bgs)" : "#fff" }}>
                      <td style={{ padding: "5px 7px", borderBottom: bdBot, fontWeight: 600 }}>📦 {c.containerCode}</td>
                      <td style={{ padding: "5px 7px", borderBottom: bdBot }}><span style={{ fontSize: "0.65rem", color: ct.color, fontWeight: 700 }}>{ct.label}</span></td>
                      <td style={{ padding: "5px 7px", borderBottom: bdBot }}>{sup?.name || c.nccId || "—"}</td>
                      <td colSpan={3} style={{ padding: "5px 7px", borderBottom: bdBot, color: "var(--tm)", fontStyle: "italic" }}>Đang tải...</td>
                      <td style={{ padding: "5px 7px", borderBottom: bdBot, textAlign: "right" }}>{c.totalVolume?.toFixed(3) || "—"}</td>
                      <td style={{ padding: "5px 7px", borderBottom: bdBot }}>
                        {ce && <button onClick={() => removeCont(c.id)} style={{ padding: "2px 5px", borderRadius: 4, border: "1px solid var(--dg)", background: "transparent", color: "var(--dg)", cursor: "pointer", fontSize: "0.62rem" }}>Tháo</button>}
                      </td>
                    </tr>
                  );
                }
                if (items.length === 0) {
                  return (
                    <tr key={c.id} style={{ background: ci % 2 ? "var(--bgs)" : "#fff" }}>
                      <td style={{ padding: "5px 7px", borderBottom: bdBot, fontWeight: 600 }}>📦 {c.containerCode}</td>
                      <td style={{ padding: "5px 7px", borderBottom: bdBot }}><span style={{ fontSize: "0.65rem", color: ct.color, fontWeight: 700 }}>{ct.label}</span></td>
                      <td style={{ padding: "5px 7px", borderBottom: bdBot }}>{sup?.name || c.nccId || "—"}</td>
                      <td colSpan={3} style={{ padding: "5px 7px", borderBottom: bdBot, color: "var(--tm)", fontStyle: "italic" }}>Chưa có hàng</td>
                      <td style={{ padding: "5px 7px", borderBottom: bdBot, textAlign: "right", fontWeight: 600 }}>{c.totalVolume?.toFixed(3) || "—"}</td>
                      <td style={{ padding: "5px 7px", borderBottom: bdBot }}>
                        {ce && <button onClick={() => removeCont(c.id)} style={{ padding: "2px 5px", borderRadius: 4, border: "1px solid var(--dg)", background: "transparent", color: "var(--dg)", cursor: "pointer", fontSize: "0.62rem" }}>Tháo</button>}
                      </td>
                    </tr>
                  );
                }
                return items.map((item, ii) => {
                  const w = wts.find(x => x.id === item.woodId);
                  const displayThickness = item.thickness || (item.pieceCount ? `${item.pieceCount} cây` : "—");
                  return (
                    <tr key={item.id} style={{ background: ci % 2 ? "var(--bgs)" : "#fff" }}>
                      {ii === 0 && (
                        <>
                          <td rowSpan={rowCount} style={{ padding: "5px 7px", borderBottom: bdBot, fontWeight: 600, verticalAlign: "top" }}>📦 {c.containerCode}</td>
                          <td rowSpan={rowCount} style={{ padding: "5px 7px", borderBottom: bdBot, verticalAlign: "top" }}><span style={{ fontSize: "0.65rem", color: ct.color, fontWeight: 700 }}>{ct.label}</span></td>
                          <td rowSpan={rowCount} style={{ padding: "5px 7px", borderBottom: bdBot, verticalAlign: "top" }}>{sup?.name || c.nccId || "—"}</td>
                        </>
                      )}
                      <td style={{ padding: "3px 7px", borderBottom: ii === items.length - 1 ? bdBot : bdSub }}>{w ? `${w.icon || ""} ${w.name}` : (item.woodId || item.rawWoodTypeId || "—")}</td>
                      <td style={{ padding: "3px 7px", borderBottom: ii === items.length - 1 ? bdBot : bdSub }}>{displayThickness}</td>
                      <td style={{ padding: "3px 7px", borderBottom: ii === items.length - 1 ? bdBot : bdSub }}>{item.quality || "—"}</td>
                      <td style={{ padding: "3px 7px", borderBottom: ii === items.length - 1 ? bdBot : bdSub, textAlign: "right", fontWeight: 600 }}>{item.volume != null ? item.volume.toFixed(3) : "—"}</td>
                      {ii === 0 && (
                        <td rowSpan={rowCount} style={{ padding: "5px 7px", borderBottom: bdBot, verticalAlign: "top" }}>
                          {ce && <button onClick={() => removeCont(c.id)} style={{ padding: "2px 5px", borderRadius: 4, border: "1px solid var(--dg)", background: "transparent", color: "var(--dg)", cursor: "pointer", fontSize: "0.62rem" }}>Tháo</button>}
                        </td>
                      )}
                    </tr>
                  );
                });
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: "var(--bgh)" }}>
                <td colSpan={6} style={{ padding: "5px 7px", textAlign: "right", fontWeight: 700, fontSize: "0.66rem", color: "var(--brl)", borderTop: "2px solid var(--bds)" }}>Tổng:</td>
                <td style={{ padding: "5px 7px", textAlign: "right", fontWeight: 800, color: "var(--br)", fontSize: "0.76rem", borderTop: "2px solid var(--bds)" }}>{totalVol.toFixed(3)} m³</td>
                <td style={{ borderTop: "2px solid var(--bds)" }} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
