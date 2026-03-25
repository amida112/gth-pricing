import React, { useState, useEffect, useMemo, useRef } from "react";

export const SHIPMENT_STATUSES = ["Chờ cập cảng", "Đã cập cảng", "Đang kéo về", "Đã nhập kho", "Đã trả vỏ"];

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
  if (d < 0) { bg = "#C0392B"; color = "#fff"; text = `Quá ${-d}d`; }
  else if (d <= 2) { bg = "#E74C3C"; color = "#fff"; text = `${d}d`; }
  else if (d <= 5) { bg = "#F39C12"; color = "#fff"; text = `${d}d`; }
  else { bg = "rgba(50,79,39,0.12)"; color = "var(--gn)"; text = `${d}d`; }
  const fmt = new Date(deadline + "T00:00:00").toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
      <span style={{ fontSize: "0.73rem" }}>{fmt}</span>
      <span style={{ padding: "1px 5px", borderRadius: 4, background: bg, color, fontSize: "0.6rem", fontWeight: 700, whiteSpace: "nowrap", animation: d < 0 ? "blink 1s infinite" : "none" }}>{text}</span>
    </span>
  );
}

/* Inline editable cell — click to edit, blur/Enter to commit */
function ICell({ value, onChange, type = "text", placeholder, style, disabled, options }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const ref = useRef(null);

  const startEdit = () => {
    if (disabled) return;
    setDraft(value || "");
    setEditing(true);
  };

  useEffect(() => { if (editing && ref.current) ref.current.focus(); }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== (value || "")) onChange(draft);
  };

  const onKey = (e) => {
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    if (e.key === "Escape") { setEditing(false); setDraft(value || ""); }
  };

  const cellBase = { padding: "5px 7px", fontSize: "0.76rem", cursor: disabled ? "default" : "pointer", minHeight: 28, display: "flex", alignItems: "center", ...style };
  const inputBase = { width: "100%", padding: "4px 6px", borderRadius: 4, border: "1.5px solid var(--ac)", fontSize: "0.76rem", outline: "none", boxSizing: "border-box", background: "#fff" };

  if (!editing) {
    if (type === "status" && value) {
      return (
        <div style={cellBase} onClick={startEdit}>
          <span style={{ padding: "2px 7px", borderRadius: 5, background: statusBg(value), color: statusColor(value), fontSize: "0.68rem", fontWeight: 700, whiteSpace: "nowrap" }}>{value}</span>
        </div>
      );
    }
    if (type === "deadline" && value) {
      return <div style={cellBase} onClick={startEdit}><DeadlineBadge deadline={value} /></div>;
    }
    if (type === "date" && value) {
      return <div style={cellBase} onClick={startEdit}><span style={{ fontSize: "0.76rem" }}>{new Date(value + "T00:00:00").toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}</span></div>;
    }
    return (
      <div style={{ ...cellBase, color: value ? "var(--tp)" : "var(--tm)" }} onClick={startEdit}>
        {value || <span style={{ opacity: 0.5, fontSize: "0.72rem" }}>{placeholder || "—"}</span>}
      </div>
    );
  }

  if (type === "status" || options) {
    const opts = options || SHIPMENT_STATUSES;
    return (
      <select ref={ref} value={draft} onChange={e => { setDraft(e.target.value); }} onBlur={commit} onKeyDown={onKey}
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

export default function PgShipment({ containers, setContainers, suppliers, wts, cfg = {}, ce, useAPI, notify }) {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expId, setExpId] = useState(null);
  const [contItems, setContItems] = useState({});
  const [filterStatus, setFilterStatus] = useState("");
  const [filterWood, setFilterWood] = useState("");
  const [filterAlert, setFilterAlert] = useState(false);
  const [assignOpen, setAssignOpen] = useState(null);

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

  const hasAlert = (sh) => [sh.yardDeadline, sh.contDeadline, sh.emptyDeadline].some(dl => { const d = daysLeft(dl); return d !== null && d <= 2; });

  const visList = useMemo(() => {
    let arr = [...shipments];
    if (filterStatus) arr = arr.filter(s => s.status === filterStatus);
    if (filterAlert) arr = arr.filter(s => hasAlert(s));
    if (filterWood) {
      arr = arr.filter(s => {
        const sc = contByShipment[s.id] || [];
        return sc.some(c => (contItems[c.id] || []).some(it => it.woodId === filterWood));
      });
    }
    arr.sort((a, b) => {
      if (!a.arrivalDate && !b.arrivalDate) return 0;
      if (!a.arrivalDate) return 1;
      if (!b.arrivalDate) return -1;
      return a.arrivalDate.localeCompare(b.arrivalDate);
    });
    return arr;
    // eslint-disable-next-line
  }, [shipments, filterStatus, filterAlert, filterWood, contByShipment, contItems]);

  const alertShipments = useMemo(() => shipments.filter(s => hasAlert(s) && s.status !== "Đã trả vỏ"), [shipments]); // eslint-disable-line

  // ── Inline update field ──
  const updateField = (id, field, value) => {
    setShipments(p => p.map(s => s.id === id ? { ...s, [field]: value || null } : s));
    if (!useAPI) return;
    // Build full row for API call
    const sh = shipments.find(s => s.id === id);
    if (!sh) return;
    const updated = { ...sh, [field]: value || null };
    import('../api.js').then(api => api.updateShipment(
      id, updated.arrivalDate, updated.portName, updated.yardDeadline,
      updated.contDeadline, updated.emptyDeadline, updated.carrierName,
      updated.carrierPhone, updated.status, updated.notes
    )).then(r => { if (r?.error) notify("Lỗi: " + r.error, false); })
      .catch(e => notify("Lỗi: " + e.message, false));
  };

  // ── Add new row ──
  const addRow = () => {
    const tmp = { id: "tmp_" + Date.now(), shipmentCode: "...", arrivalDate: "", portName: "", yardDeadline: null, contDeadline: null, emptyDeadline: null, carrierName: "", carrierPhone: "", status: "Chờ cập cảng", notes: "" };
    setShipments(p => [tmp, ...p]);
    if (!useAPI) return;
    import('../api.js').then(api => api.addShipment("", "", "", "", "", "", "", "Chờ cập cảng", ""))
      .then(r => {
        if (r?.error) { notify("Lỗi: " + r.error, false); setShipments(p => p.filter(x => x.id !== tmp.id)); return; }
        setShipments(p => p.map(x => x.id === tmp.id ? { ...x, id: r.id, shipmentCode: r.shipmentCode } : x));
      })
      .catch(e => { notify("Lỗi: " + e.message, false); setShipments(p => p.filter(x => x.id !== tmp.id)); });
  };

  // ── Delete ──
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
  const hasFilters = filterStatus || filterAlert || filterWood;

  return (
    <div>
      <style>{`@keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "var(--br)" }}>📅 Lịch hàng về</h2>
        {ce && <button onClick={addRow} style={{ padding: "7px 16px", borderRadius: 7, background: "var(--ac)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>+ Thêm dòng</button>}
      </div>

      {/* Alert banner */}
      {alertShipments.length > 0 && (
        <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(231,76,60,0.08)", border: "1.5px solid rgba(231,76,60,0.3)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#E74C3C" }}>⚠ Sắp hết hạn:</span>
          {alertShipments.map(s => (
            <span key={s.id} onClick={() => toggleExp(s.id)} style={{ padding: "2px 7px", borderRadius: 5, background: "#E74C3C", color: "#fff", fontSize: "0.7rem", fontWeight: 600, cursor: "pointer" }}>
              {s.shipmentCode}
            </span>
          ))}
        </div>
      )}

      {/* Compact filters */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: "5px 8px", borderRadius: 6, border: "1.5px solid var(--bd)", fontSize: "0.74rem", background: "var(--bgc)", color: "var(--tp)", outline: "none" }}>
          <option value="">Tất cả trạng thái</option>
          {SHIPMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterWood} onChange={e => setFilterWood(e.target.value)}
          style={{ padding: "5px 8px", borderRadius: 6, border: "1.5px solid var(--bd)", fontSize: "0.74rem", background: "var(--bgc)", color: "var(--tp)", outline: "none" }}>
          <option value="">Tất cả loại gỗ</option>
          {wts.map(w => <option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 3, fontSize: "0.73rem", color: "var(--tp)", cursor: "pointer" }}>
          <input type="checkbox" checked={filterAlert} onChange={e => setFilterAlert(e.target.checked)} style={{ accentColor: "#E74C3C", width: 14, height: 14 }} />
          Cảnh báo
        </label>
        {hasFilters && (
          <button onClick={() => { setFilterStatus(""); setFilterWood(""); setFilterAlert(false); }}
            style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontSize: "0.72rem" }}>✕ Xóa lọc</button>
        )}
        <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "var(--tm)" }}>{visList.length} lô · Click ô để sửa</span>
      </div>

      {/* Main table — inline editable */}
      <div style={{ background: "var(--bgc)", borderRadius: 10, border: "1px solid var(--bd)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto", maxHeight: "calc(100vh - 220px)", overflowY: "auto" }}>
          <table style={{ width: "100%", minWidth: 1080, borderCollapse: "collapse", fontSize: "0.76rem" }}>
            <thead>
              <tr>
                <th style={{ ...ths, width: 32, textAlign: "center" }}>STT</th>
                <th style={{ ...ths, minWidth: 90 }}>Mã lô</th>
                <th style={{ ...ths, minWidth: 100 }}>Ngày cập cảng</th>
                <th style={{ ...ths, minWidth: 90 }}>Hạn lưu bãi</th>
                <th style={{ ...ths, minWidth: 90 }}>Hạn lưu cont</th>
                <th style={{ ...ths, minWidth: 90 }}>Hạn trả vỏ</th>
                <th style={{ ...ths, minWidth: 120 }}>ĐV vận tải</th>
                <th style={{ ...ths, minWidth: 70 }}>Cont</th>
                <th style={{ ...ths, minWidth: 100 }}>Trạng thái</th>
                <th style={{ ...ths, minWidth: 60 }}>Cảng</th>
                <th style={{ ...ths, minWidth: 120 }}>Ghi chú</th>
                {ce && <th style={{ ...ths, width: 36 }}></th>}
              </tr>
            </thead>
            <tbody>
              {visList.length === 0 && (
                <tr><td colSpan={ce ? 12 : 11} style={{ padding: 28, textAlign: "center", color: "var(--tm)" }}>
                  {shipments.length === 0 ? 'Chưa có lô hàng — bấm "+ Thêm dòng" để bắt đầu' : "Không có lô nào khớp bộ lọc"}
                </td></tr>
              )}
              {visList.map((sh, idx) => {
                const isExp = expId === sh.id;
                const sc = contByShipment[sh.id] || [];
                const totalVol = sc.reduce((s, c) => s + (c.totalVolume || 0), 0);
                const alert = hasAlert(sh);
                const rowBg = isExp ? "var(--acbg)" : alert ? "rgba(231,76,60,0.04)" : (idx % 2 ? "var(--bgs)" : "#fff");
                const td = { padding: 0, borderBottom: isExp ? "none" : "1px solid var(--bd)", background: rowBg };

                return (
                  <React.Fragment key={sh.id}>
                    <tr>
                      <td style={{ ...td, textAlign: "center", padding: "6px 4px", color: "var(--tm)", fontWeight: 600, fontSize: "0.72rem", cursor: "pointer" }}
                        onClick={() => toggleExp(sh.id)}>
                        <span style={{ fontSize: "0.65rem", color: isExp ? "var(--ac)" : "var(--tm)", marginRight: 2 }}>{isExp ? "▾" : "▸"}</span>
                        {idx + 1}
                      </td>
                      <td style={{ ...td, fontWeight: 700, color: "var(--br)", padding: "6px 8px", fontSize: "0.74rem", cursor: "pointer" }}
                        onClick={() => toggleExp(sh.id)}>
                        {sh.shipmentCode}
                      </td>
                      <td style={td}><ICell value={sh.arrivalDate} type="date" disabled={!ce} placeholder="Chọn ngày" onChange={v => updateField(sh.id, "arrivalDate", v)} /></td>
                      <td style={td}><ICell value={sh.yardDeadline} type="deadline" disabled={!ce} placeholder="Hạn bãi" onChange={v => updateField(sh.id, "yardDeadline", v)} /></td>
                      <td style={td}><ICell value={sh.contDeadline} type="deadline" disabled={!ce} placeholder="Hạn cont" onChange={v => updateField(sh.id, "contDeadline", v)} /></td>
                      <td style={td}><ICell value={sh.emptyDeadline} type="deadline" disabled={!ce} placeholder="Hạn vỏ" onChange={v => updateField(sh.id, "emptyDeadline", v)} /></td>
                      <td style={td}><ICell value={sh.carrierName} disabled={!ce} placeholder="ĐV vận tải" onChange={v => updateField(sh.id, "carrierName", v)} /></td>
                      <td style={{ ...td, padding: "6px 8px", cursor: "pointer" }} onClick={() => toggleExp(sh.id)}>
                        <span style={{ fontWeight: 600 }}>{sc.length}</span>
                        {totalVol > 0 && <div style={{ fontSize: "0.65rem", color: "var(--tm)" }}>{totalVol.toFixed(1)} m³</div>}
                      </td>
                      <td style={td}><ICell value={sh.status} type="status" disabled={!ce} onChange={v => updateField(sh.id, "status", v)} /></td>
                      <td style={td}><ICell value={sh.portName} disabled={!ce} placeholder="Cảng" onChange={v => updateField(sh.id, "portName", v)} /></td>
                      <td style={td}><ICell value={sh.notes} disabled={!ce} placeholder="Ghi chú..." onChange={v => updateField(sh.id, "notes", v)} /></td>
                      {ce && (
                        <td style={{ ...td, textAlign: "center", padding: "6px 4px" }}>
                          <button onClick={() => del(sh)} title="Xóa lô" style={{ width: 22, height: 22, padding: 0, borderRadius: 4, border: "1px solid var(--dg)", background: "transparent", color: "var(--dg)", cursor: "pointer", fontSize: "0.68rem", lineHeight: 1 }}>✕</button>
                        </td>
                      )}
                    </tr>

                    {/* Expanded: containers + cargo */}
                    {isExp && (
                      <tr>
                        <td colSpan={ce ? 12 : 11} style={{ padding: 0, borderBottom: "2px solid var(--ac)" }}>
                          <ExpandedCargo
                            sh={sh} sc={sc} contItems={contItems} suppliers={suppliers} wts={wts}
                            ce={ce} unassignedConts={unassignedConts} assignOpen={assignOpen}
                            setAssignOpen={setAssignOpen} assignCont={assignCont} removeCont={removeCont}
                            loadContItems={loadContItems}
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

/* ── Expanded cargo section (extracted for readability) ── */
function ExpandedCargo({ sh, sc, contItems, suppliers, wts, ce, unassignedConts, assignOpen, setAssignOpen, assignCont, removeCont }) {
  const totalVol = sc.reduce((s, c) => s + (c.totalVolume || 0), 0);

  return (
    <div style={{ padding: "10px 14px 12px", background: "rgba(242,101,34,0.03)" }}>
      {sh.notes && <div style={{ fontSize: "0.73rem", color: "var(--tm)", marginBottom: 8, fontStyle: "italic" }}>📝 {sh.notes}</div>}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase" }}>
          Containers ({sc.length}) — {totalVol.toFixed(3)} m³
        </span>
        {ce && (
          <button onClick={() => setAssignOpen(assignOpen === sh.id ? null : sh.id)}
            style={{ padding: "3px 9px", borderRadius: 5, background: "var(--br)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.68rem" }}>
            + Gắn cont
          </button>
        )}
      </div>

      {assignOpen === sh.id && (
        <div style={{ padding: "8px 10px", borderRadius: 7, background: "var(--bgc)", border: "1.5px solid var(--ac)", marginBottom: 8 }}>
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

      {sc.length === 0 ? (
        <div style={{ padding: "10px 12px", borderRadius: 6, border: "1.5px dashed var(--bd)", background: "var(--bgs)", textAlign: "center", color: "var(--tm)", fontSize: "0.74rem" }}>Chưa gắn container — bấm "+ Gắn cont"</div>
      ) : (
        <div style={{ border: "1.5px solid var(--bd)", borderRadius: 7, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.74rem" }}>
            <thead>
              <tr style={{ background: "var(--bgh)" }}>
                {["Container", "NCC", "Loại gỗ", "Dày", "CL", "m³", ""].map((h, i) => (
                  <th key={i} style={{ padding: "5px 7px", textAlign: i === 5 ? "right" : "left", color: "var(--brl)", fontWeight: 700, fontSize: "0.58rem", textTransform: "uppercase", borderBottom: "1.5px solid var(--bds)", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sc.map((c, ci) => {
                const sup = suppliers.find(s => s.nccId === c.nccId);
                const items = contItems[c.id];
                const rowCount = items ? Math.max(items.length, 1) : 1;
                const bdBot = "1px solid var(--bd)";
                const bdSub = "1px solid var(--bds)";

                if (items === undefined) {
                  return (
                    <tr key={c.id} style={{ background: ci % 2 ? "var(--bgs)" : "#fff" }}>
                      <td style={{ padding: "5px 7px", borderBottom: bdBot, fontWeight: 600 }}>📦 {c.containerCode}</td>
                      <td style={{ padding: "5px 7px", borderBottom: bdBot }}>{sup?.name || c.nccId || "—"}</td>
                      <td colSpan={4} style={{ padding: "5px 7px", borderBottom: bdBot, color: "var(--tm)", fontStyle: "italic" }}>Đang tải...</td>
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
                      <td style={{ padding: "5px 7px", borderBottom: bdBot }}>{sup?.name || c.nccId || "—"}</td>
                      <td colSpan={3} style={{ padding: "5px 7px", borderBottom: bdBot, color: "var(--tm)", fontStyle: "italic" }}>Chưa có hàng</td>
                      <td style={{ padding: "5px 7px", borderBottom: bdBot, textAlign: "right", fontWeight: 600 }}>{c.totalVolume ? c.totalVolume.toFixed(3) : "—"}</td>
                      <td style={{ padding: "5px 7px", borderBottom: bdBot }}>
                        {ce && <button onClick={() => removeCont(c.id)} style={{ padding: "2px 5px", borderRadius: 4, border: "1px solid var(--dg)", background: "transparent", color: "var(--dg)", cursor: "pointer", fontSize: "0.62rem" }}>Tháo</button>}
                      </td>
                    </tr>
                  );
                }
                return items.map((item, ii) => {
                  const w = wts.find(x => x.id === item.woodId);
                  return (
                    <tr key={item.id} style={{ background: ci % 2 ? "var(--bgs)" : "#fff" }}>
                      {ii === 0 && (
                        <>
                          <td rowSpan={rowCount} style={{ padding: "5px 7px", borderBottom: bdBot, fontWeight: 600, verticalAlign: "top" }}>📦 {c.containerCode}</td>
                          <td rowSpan={rowCount} style={{ padding: "5px 7px", borderBottom: bdBot, verticalAlign: "top" }}>{sup?.name || c.nccId || "—"}</td>
                        </>
                      )}
                      <td style={{ padding: "3px 7px", borderBottom: ii === items.length - 1 ? bdBot : bdSub }}>{w ? `${w.icon || ""} ${w.name}` : item.woodId}</td>
                      <td style={{ padding: "3px 7px", borderBottom: ii === items.length - 1 ? bdBot : bdSub }}>{item.thickness || "—"}</td>
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
                <td colSpan={5} style={{ padding: "5px 7px", textAlign: "right", fontWeight: 700, fontSize: "0.66rem", color: "var(--brl)", borderTop: "2px solid var(--bds)" }}>Tổng:</td>
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
