import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import useTableSort from '../useTableSort';
import Dialog from '../components/Dialog';
import { parsePackingListCsv, getPackingListCsvHint, getPackingListCsvPlaceholder } from '../utils/packingListCsv';

export const SHIPMENT_STATUSES = ["Chờ cập cảng", "Đã cập cảng", "Đang kéo về", "Đã nhập kho", "Đã trả vỏ"];

// ── Dialog tạo / sửa lô hàng ──────────────────────────────────────────────────
const formInp = { width: "100%", padding: "7px 10px", borderRadius: 6, border: "1.5px solid var(--bd)", fontSize: "0.8rem", outline: "none", boxSizing: "border-box", background: "var(--bgc)", color: "var(--tp)" };
const formLbl = { display: "block", fontSize: "0.66rem", fontWeight: 700, color: "var(--brl)", marginBottom: 3, textTransform: "uppercase" };

function ShipmentFormDlg({ shipment, suppliers, onSave, onClose, isAdmin }) {
  const isNew = !shipment;
  const [fm, setFm] = useState({
    name: shipment?.name || '',
    nccId: shipment?.nccId || '',
    carrierName: shipment?.carrierName || '',
    eta: shipment?.eta || '',
    portName: shipment?.portName || '',
    contDeadline: shipment?.contDeadline || '',
    yardDeadline: shipment?.yardDeadline || '',
    emptyDeadline: shipment?.emptyDeadline || '',
    unitCostUsd: shipment?.unitCostUsd != null ? String(shipment.unitCostUsd) : '',
    exchangeRate: shipment?.exchangeRate != null ? String(shipment.exchangeRate) : '',
    notes: shipment?.notes || '',
  });
  const f = (k) => (v) => setFm(p => ({ ...p, [k]: typeof v === 'object' ? v.target.value : v }));
  const costVnd = fm.unitCostUsd && fm.exchangeRate ? (parseFloat(fm.unitCostUsd) * parseFloat(fm.exchangeRate)) : null;

  const handleSave = () => {
    const fields = {
      name: fm.name.trim() || null,
      nccId: fm.nccId || null,
      carrierName: fm.carrierName.trim() || null,
      eta: fm.eta || null,
      portName: fm.portName.trim() || null,
      contDeadline: fm.contDeadline || null,
      yardDeadline: fm.yardDeadline || null,
      emptyDeadline: fm.emptyDeadline || null,
      unitCostUsd: fm.unitCostUsd ? parseFloat(fm.unitCostUsd) : null,
      exchangeRate: fm.exchangeRate ? parseFloat(fm.exchangeRate) : null,
      notes: fm.notes.trim() || null,
    };
    onSave(fields);
    onClose();
  };

  return (
    <Dialog open={true} onClose={onClose} onOk={handleSave} title={isNew ? "Tạo lô hàng mới" : `Sửa lô ${shipment.shipmentCode}`} width={520}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Tên lô + NCC */}
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={formLbl}>Tên lô hàng</label>
            <input value={fm.name} onChange={f('name')} placeholder="VD: Lô Tần Bì T3" style={formInp} autoFocus />
          </div>
          <div style={{ flex: 1 }}>
            <label style={formLbl}>Nhà cung cấp</label>
            <select value={fm.nccId} onChange={f('nccId')} style={formInp}>
              <option value="">— Chọn NCC —</option>
              {suppliers.map(s => <option key={s.id} value={s.nccId}>{s.name}</option>)}
            </select>
          </div>
        </div>
        {/* ĐV vận tải + Cảng */}
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={formLbl}>ĐV Vận tải</label>
            <input value={fm.carrierName} onChange={f('carrierName')} placeholder="Tên đơn vị" style={formInp} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={formLbl}>Cảng</label>
            <input value={fm.portName} onChange={f('portName')} placeholder="VD: Hải Phòng" style={formInp} />
          </div>
        </div>
        {/* ETA */}
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={formLbl}>Ngày cập cảng (ETA)</label>
            <input type="date" value={fm.eta} onChange={f('eta')} style={formInp} />
          </div>
          <div style={{ flex: 1 }} />
        </div>
        {/* 3 hạn lưu — chỉ hiện khi sửa */}
        {!isNew && (
          <div style={{ padding: "10px 12px", borderRadius: 7, background: "var(--bgs)", border: "1px solid var(--bd)" }}>
            <div style={{ fontSize: "0.66rem", fontWeight: 700, color: "var(--brl)", marginBottom: 8, textTransform: "uppercase" }}>Hạn lưu (sau khi thông quan)</div>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={formLbl}>Lưu cont</label>
                <input type="date" value={fm.contDeadline} onChange={f('contDeadline')} style={formInp} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={formLbl}>Lưu bãi</label>
                <input type="date" value={fm.yardDeadline} onChange={f('yardDeadline')} style={formInp} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={formLbl}>Trả vỏ</label>
                <input type="date" value={fm.emptyDeadline} onChange={f('emptyDeadline')} style={formInp} />
              </div>
            </div>
          </div>
        )}
        {/* Giá vốn — admin only, chỉ khi sửa */}
        {!isNew && isAdmin && (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label style={formLbl}>Giá vốn (USD/m³)</label>
              <input type="number" step="0.01" value={fm.unitCostUsd} onChange={f('unitCostUsd')} placeholder="0" style={formInp} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={formLbl}>Tỷ giá VND</label>
              <input type="number" step="1" value={fm.exchangeRate} onChange={f('exchangeRate')} placeholder="25300" style={formInp} />
            </div>
            {costVnd && (
              <div style={{ flex: 1, padding: "7px 10px", borderRadius: 6, background: "rgba(90,62,43,0.08)", fontWeight: 700, fontSize: "0.82rem", color: "var(--br)", textAlign: "center" }}>
                = {Math.round(costVnd).toLocaleString("vi-VN")} đ/m³
              </div>
            )}
          </div>
        )}
        {/* Ghi chú */}
        <div>
          <label style={formLbl}>Ghi chú</label>
          <textarea value={fm.notes} onChange={f('notes')} rows={2} placeholder="Ghi chú tùy chọn..." style={{ ...formInp, resize: "vertical", fontFamily: "inherit" }} />
        </div>
      </div>
    </Dialog>
  );
}

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
  const [editDlg, setEditDlg]           = useState(null); // shipment object | 'new'

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

  // Tạo lô mới qua dialog
  const handleCreateShipment = (fields) => {
    const tmp = { id: "tmp_" + Date.now(), shipmentCode: "...", lotType: "sawn", ...fields };
    setShipments(p => [tmp, ...p]);
    if (!useAPI) return;
    import('../api.js').then(api => api.addShipment({ ...fields, status: "Chờ cập cảng" }))
      .then(r => {
        if (r?.error) { notify("Lỗi: " + r.error, false); setShipments(p => p.filter(x => x.id !== tmp.id)); return; }
        setShipments(p => p.map(x => x.id === tmp.id ? { ...x, ...r } : x));
        notify("Đã tạo lô " + r.shipmentCode);
      })
      .catch(e => { notify("Lỗi: " + e.message, false); setShipments(p => p.filter(x => x.id !== tmp.id)); });
  };

  // Sửa lô qua dialog — cập nhật nhiều field cùng lúc
  const handleUpdateShipment = (fields) => {
    const id = editDlg?.id;
    if (!id) return;
    setShipments(p => p.map(s => s.id === id ? { ...s, ...fields } : s));
    if (!useAPI) return;
    import('../api.js').then(api => api.updateShipment(id, fields))
      .then(r => { if (r?.error) notify("Lỗi: " + r.error, false); else notify("Đã cập nhật"); })
      .catch(e => notify("Lỗi: " + e.message, false));
  };

  // Điều cont — cập nhật dispatch fields
  // Điều cont — hỗ trợ 1 hoặc nhiều cont (batch)
  // Phương án C: auto xuất kho khi điều về khách, auto hủy xuất khi hủy điều
  const handleDispatchCont = async (containerIds, fields) => {
    const ids = Array.isArray(containerIds) ? containerIds : [containerIds];
    const dispatched = fields.dispatchStatus === 'dispatched';
    const isCustomer = fields.dispatchType === 'customer';
    const extra = dispatched ? { dispatchedAt: new Date().toISOString(), dispatchedBy: user?.username || null } : { dispatchedAt: null, dispatchedBy: null };
    const merged = { ...fields, ...extra };
    // Optimistic update containers
    setContainers(p => p.map(c => ids.includes(c.id) ? { ...c, ...merged } : c));
    if (useAPI) {
      const api = await import('../api.js');
      for (const id of ids) {
        const r = await api.updateContainer(id, merged);
        if (r?.error) { notify("Lỗi: " + r.error, false); return; }
      }
      // Auto export/rollback đơn hàng nguyên cont
      if (dispatched && isCustomer) {
        const res = await api.autoExportByContainerDispatch(ids);
        if (res.exportedOrderIds?.length) notify(`📦 Đã tự động xuất kho ${res.exportedOrderIds.length} đơn hàng`);
      } else if (!dispatched) {
        await api.rollbackExportByContainerDispatch(ids);
      }
    }
    const names = ids.map(id => (containers || []).find(c => c.id === id)?.containerCode).filter(Boolean);
    notify(dispatched ? `✓ Đã điều ${ids.length} cont: ${names.join(', ')}` : `↩ Hủy điều ${ids.length} cont`);
  };

  // Trạng thái lô tự động — 6 bước: Mới ký → Sắp về → Đã cập cảng → Đã thông quan → Đang về → Đã về hết
  const computeShipmentStatus = (sh, sc) => {
    const today = new Date().toISOString().slice(0, 10);
    const hasDeadline = !!(sh.contDeadline || sh.yardDeadline || sh.emptyDeadline);
    // Đếm cont đã điều
    const dispatchedCount = sc.filter(c => c.dispatchStatus === 'dispatched').length;
    // 6. Đã về hết: tất cả cont đã điều
    if (sc.length > 0 && dispatchedCount === sc.length)
      return { key: 'da_ve_het', label: 'Đã về hết', color: 'var(--gn)', bg: 'rgba(50,79,39,0.1)', order: 6 };
    // 5. Đang về: ≥1 cont đã điều nhưng chưa hết
    if (dispatchedCount > 0)
      return { key: 'dang_ve', label: `Đang về (${dispatchedCount}/${sc.length})`, color: '#16A085', bg: 'rgba(22,160,133,0.1)', order: 5 };
    // 4. Đã thông quan: có ≥1 hạn lưu (cont/bãi/vỏ) → đã qua hải quan
    if (hasDeadline)
      return { key: 'da_thong_quan', label: 'Đã thông quan', color: '#E67E22', bg: 'rgba(230,126,34,0.1)', order: 4 };
    // 3. Đã cập cảng: ngày hiện tại ≥ ETA → tàu đã tới cảng
    if (sh.eta && today >= sh.eta)
      return { key: 'da_cap_cang', label: 'Đã cập cảng', color: 'var(--ac)', bg: 'rgba(242,101,34,0.1)', order: 3 };
    // 2. Sắp về: có ETA, chưa tới ngày
    if (sh.eta)
      return { key: 'sap_ve', label: 'Sắp về', color: '#2980b9', bg: 'rgba(41,128,185,0.1)', order: 2 };
    // 1. Mới ký: chưa có ETA
    return { key: 'moi_ky', label: 'Mới ký', color: 'var(--ts)', bg: 'var(--bgs)', order: 1 };
  };

  const hasAlert = (sh) => {
    const sc = contByShipment[sh.id] || [];
    const st = computeShipmentStatus(sh, sc).key;
    if (st === 'da_ve_het' || st === 'dang_ve') return false;
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

  // Tóm tắt mô tả hàng hóa lô — gộp thông minh từ containers + items
  const getShipmentDesc = (sh, sc) => {
    if (!sc.length) return '';
    const lti = lotTypeInfo(sh.lotType);
    if (sh.lotType === 'raw_round' || sh.lotType === 'raw_box') {
      // Nhóm theo loại gỗ
      const groups = {};
      sc.forEach(c => {
        const rwId = c.rawWoodTypeId || sh.rawWoodTypeId || '_';
        if (!groups[rwId]) groups[rwId] = { count: 0, vol: 0 };
        groups[rwId].count++;
        groups[rwId].vol += c.totalVolume || 0;
      });
      return Object.entries(groups).map(([rwId, g]) => {
        const rw = rawWoodTypes.find(r => r.id === rwId);
        const name = rw ? `${rw.icon || ''} ${rw.name}` : '';
        return name;
      }).join(' · ');
    }
    // Gỗ xẻ: gộp từ items nếu đã load, nếu chưa dùng shipment-level
    const allItems = sc.flatMap(c => contItems[c.id] || []);
    if (allItems.length > 0) {
      const woodSet = [...new Set(allItems.map(i => i.woodId).filter(Boolean))];
      const thickSet = [...new Set(allItems.map(i => i.thickness).filter(Boolean))];
      const qualSet = [...new Set(allItems.map(i => i.quality).filter(Boolean))];
      const woodNames = woodSet.map(id => { const w = wts.find(x => x.id === id); return w ? (w.icon || '') + ' ' + w.name : ''; }).filter(Boolean);
      const parts = [...woodNames, thickSet.join('/'), qualSet.join('/')].filter(Boolean);
      // Nếu tất cả cont giống nhau → gộp
      if (parts.length) return parts.join(' · ');
    }
    // Fallback: dùng loại gỗ từ shipment
    const w = wts.find(x => x.id === sh.woodTypeId);
    const wName = w ? `${w.icon || ''} ${w.name}` : '';
    return wName ? `${lti.icon} ${wName}` : '';
  };

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
        {ce && <button onClick={() => setEditDlg('new')} style={{ padding: "7px 16px", borderRadius: 7, background: "var(--ac)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>+ Thêm lô</button>}
      </div>

      {/* Alert banner — cảnh báo deadline + ước tính chi phí lưu cont */}
      {alertShipments.length > 0 && (() => {
        // Tính chi phí phát sinh: ~1.2tr/cont/ngày quá hạn lưu cont
        const COST_PER_CONT_DAY = 1200000;
        let totalOverdueCost = 0;
        alertShipments.forEach(s => {
          const d = daysLeft(s.contDeadline);
          if (d !== null && d < 0) {
            const sc = contByShipment[s.id] || [];
            totalOverdueCost += sc.length * (-d) * COST_PER_CONT_DAY;
          }
        });
        return (
          <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(231,76,60,0.08)", border: "1.5px solid rgba(231,76,60,0.3)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#E74C3C" }}>⚠ Sắp hết hạn:</span>
            {alertShipments.map(s => {
              const dlInfo = [
                { dl: s.contDeadline, label: 'C' },
                { dl: s.yardDeadline, label: 'B' },
                { dl: s.emptyDeadline, label: 'V' },
              ].filter(x => { const d = daysLeft(x.dl); return d !== null && d <= 2; })
               .map(x => { const d = daysLeft(x.dl); return `${x.label}:${d < 0 ? `+${-d}d` : `${d}d`}`; }).join(' ');
              const overdue = [s.contDeadline, s.yardDeadline, s.emptyDeadline].some(dl => { const d = daysLeft(dl); return d !== null && d < 0; });
              const sc = contByShipment[s.id] || [];
              const pending = sc.filter(c => c.dispatchStatus !== 'dispatched').length;
              return (
                <span key={s.id} onClick={() => toggleExp(s.id)}
                  style={{ padding: "2px 7px", borderRadius: 5, background: overdue ? "#C0392B" : "#E74C3C", color: "#fff", fontSize: "0.7rem", fontWeight: 600, cursor: "pointer", animation: overdue ? "blink 1s infinite" : "none" }}>
                  {s.name || s.shipmentCode} ({dlInfo}){pending > 0 ? ` · ${pending} chưa điều` : ''}
                </span>
              );
            })}
            {totalOverdueCost > 0 && (
              <span style={{ marginLeft: "auto", fontSize: "0.72rem", fontWeight: 700, color: "#C0392B", padding: "2px 8px", borderRadius: 5, background: "rgba(192,57,43,0.1)" }}>
                💰 Phí lưu cont ≈ {(totalOverdueCost / 1e6).toFixed(1)}tr
              </span>
            )}
          </div>
        );
      })()}

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
          <option value="moi_ky">Mới ký</option>
          <option value="sap_ve">Sắp về</option>
          <option value="da_cap_cang">Đã cập cảng</option>
          <option value="da_thong_quan">Đã thông quan</option>
          <option value="dang_ve">Đang về</option>
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
          <table style={{ width: "100%", minWidth: 1250, borderCollapse: "collapse", fontSize: "0.76rem" }}>
            <thead>
              <tr>
                <th style={{ ...ths, width: 28, textAlign: "center" }}>#</th>
                <th style={{ ...thSort, minWidth: 140 }} onClick={() => toggleSort('shipmentCode')}>Mã lô{sortIcon('shipmentCode')}</th>
                <th style={{ ...ths, minWidth: 200 }}>Mô tả</th>
                <th style={{ ...ths, minWidth: 100 }}>NCC</th>
                <th style={{ ...ths, minWidth: 100 }}>ĐV Vận tải</th>
                <th style={{ ...thSort, minWidth: 80 }} onClick={() => toggleSort('eta')}>Cập cảng{sortIcon('eta')}</th>
                <th style={{ ...ths, minWidth: 160 }}>Hạn lưu</th>
                <th style={{ ...thSort, minWidth: 100 }} onClick={() => toggleSort('status')}>Trạng thái{sortIcon('status')}</th>
                {ce && <th style={{ ...ths, width: 60 }}></th>}
              </tr>
            </thead>
            <tbody>
              {visList.length === 0 && (
                <tr><td colSpan={ce ? 9 : 8} style={{ padding: 28, textAlign: "center", color: "var(--tm)" }}>
                  {shipments.length === 0 ? 'Chưa có lô hàng — bấm "+ Thêm lô" để bắt đầu' : "Không có lô nào khớp bộ lọc"}
                </td></tr>
              )}
              {visList.map((sh, idx) => {
                const isExp    = expId === sh.id;
                const sc       = contByShipment[sh.id] || [];
                const totalVol = sc.reduce((s, c) => s + (c.totalVolume || 0), 0);
                const alert    = hasAlert(sh);
                const rowBg    = isExp ? "var(--acbg)" : alert ? "rgba(231,76,60,0.04)" : (idx % 2 ? "var(--bgs)" : "#fff");
                const td       = { padding: "6px 8px", borderBottom: isExp ? "none" : "1px solid var(--bd)", background: rowBg, whiteSpace: "nowrap" };
                const lti      = lotTypeInfo(sh.lotType);
                const nccObj   = suppliers.find(s => s.nccId === sh.nccId);
                const statusInfo = computeShipmentStatus(sh, sc);
                const shipDesc = getShipmentDesc(sh, sc);
                const muteDeadline = statusInfo.key === 'da_ve_het' || statusInfo.key === 'dang_ve';

                // Hạn lưu gộp: C/B/V
                const fmtDl = (dl, label) => {
                  if (!dl) return null;
                  const d = daysLeft(dl);
                  const fmt = new Date(dl + "T00:00:00").toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
                  if (muteDeadline) return <span style={{ color: "var(--ts)" }}>{label}{fmt}</span>;
                  const urgent = d !== null && d <= 2;
                  const overdue = d !== null && d < 0;
                  return (
                    <span style={{ color: overdue ? "#C0392B" : urgent ? "#E74C3C" : "var(--ts)", fontWeight: urgent ? 700 : 400, animation: overdue ? "blink 1s infinite" : "none" }}>
                      {label}{fmt}{d !== null && <span style={{ fontSize: "0.58rem", marginLeft: 2 }}>{overdue ? `(+${-d}d)` : `(${d}d)`}</span>}
                    </span>
                  );
                };
                const dlParts = [fmtDl(sh.contDeadline, "C:"), fmtDl(sh.yardDeadline, "B:"), fmtDl(sh.emptyDeadline, "V:")].filter(Boolean);

                return (
                  <React.Fragment key={sh.id}>
                    <tr data-clickable="true" onClick={() => toggleExp(sh.id)} style={{ cursor: "pointer" }}>
                      {/* # */}
                      <td style={{ ...td, textAlign: "center", color: "var(--tm)", fontSize: "0.68rem" }}>{idx + 1}</td>

                      {/* Mã lô + tên + lotType badge */}
                      <td style={td}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ fontSize: "0.62rem", color: isExp ? "var(--ac)" : "var(--tm)" }}>{isExp ? "▾" : "▸"}</span>
                          <span style={{ fontWeight: 700, color: "var(--br)", fontSize: "0.78rem" }}>{sh.name || sh.shipmentCode}</span>
                        </div>
                        {sh.name && <div style={{ fontSize: "0.6rem", color: "var(--tm)", fontFamily: "monospace", marginLeft: 17 }}>{sh.shipmentCode}</div>}
                      </td>

                      {/* Mô tả auto: summary + cont count + volume */}
                      <td style={{ ...td, whiteSpace: "normal", maxWidth: 240 }}>
                        {shipDesc
                          ? <div style={{ fontSize: "0.73rem", color: "var(--br)", fontWeight: 600, lineHeight: 1.4 }}>{shipDesc}</div>
                          : <span style={{ color: "var(--tm)", fontSize: "0.72rem" }}>—</span>
                        }
                        {sc.length > 0 && <div style={{ fontSize: "0.62rem", color: "var(--ts)", marginTop: 1 }}>{sc.length} cont · {totalVol.toFixed(1)} m³</div>}
                      </td>

                      {/* NCC */}
                      <td style={{ ...td, fontSize: "0.74rem" }}>
                        {nccObj?.name || sh.nccId || <span style={{ color: "var(--tm)" }}>—</span>}
                      </td>

                      {/* ĐV Vận tải */}
                      <td style={{ ...td, fontSize: "0.74rem" }}>
                        {sh.carrierName || <span style={{ color: "var(--tm)" }}>—</span>}
                      </td>

                      {/* Cập cảng (ETA) */}
                      <td style={td}>
                        {sh.eta ? (
                          <div>
                            <div style={{ fontSize: "0.74rem" }}>{new Date(sh.eta + "T00:00:00").toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}</div>
                            {(() => { const d = daysLeft(sh.eta); return d !== null && d > 0 ? <div style={{ fontSize: "0.58rem", color: "#2980b9" }}>({d}d)</div> : null; })()}
                          </div>
                        ) : <span style={{ color: "var(--tm)", fontSize: "0.72rem" }}>—</span>}
                      </td>

                      {/* Hạn lưu gộp: C/B/V */}
                      <td style={{ ...td, whiteSpace: "normal" }}>
                        {dlParts.length > 0
                          ? <div style={{ display: "flex", gap: 6, flexWrap: "wrap", fontSize: "0.68rem" }}>{dlParts.map((p, i) => <span key={i}>{p}</span>)}</div>
                          : <span style={{ color: "var(--tm)", fontSize: "0.72rem" }}>—</span>
                        }
                      </td>

                      {/* Trạng thái */}
                      <td style={td}>
                        <span style={{ padding: "2px 8px", borderRadius: 5, fontSize: "0.66rem", fontWeight: 700, background: statusInfo.bg, color: statusInfo.color }}>
                          {statusInfo.label}
                        </span>
                      </td>

                      {/* Sửa / Xóa */}
                      {ce && (
                        <td style={{ ...td, textAlign: "center" }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: "flex", gap: 3, justifyContent: "center" }}>
                            <button onClick={() => setEditDlg(sh)} title="Sửa lô"
                              style={{ width: 24, height: 24, padding: 0, borderRadius: 4, border: "1px solid var(--br)", background: "transparent", color: "var(--br)", cursor: "pointer", fontSize: "0.68rem" }}>✎</button>
                            <button onClick={() => del(sh)} title="Xóa lô"
                              style={{ width: 24, height: 24, padding: 0, borderRadius: 4, border: "1px solid var(--dg)", background: "transparent", color: "var(--dg)", cursor: "pointer", fontSize: "0.68rem" }}>✕</button>
                          </div>
                        </td>
                      )}
                    </tr>

                    {/* Expanded */}
                    {isExp && (
                      <tr>
                        <td colSpan={ce ? 9 : 8} style={{ padding: 0, borderBottom: "2px solid var(--ac)" }}>
                          <ExpandedCargo
                            sh={sh} sc={sc} contItems={contItems} suppliers={suppliers}
                            wts={wts} rawWoodTypes={rawWoodTypes}
                            isAdmin={isAdmin} ce={ce}
                            unassignedConts={unassignedConts} assignOpen={assignOpen}
                            setAssignOpen={setAssignOpen} assignCont={assignCont} removeCont={removeCont}
                            updateField={updateField}
                            addNewContainer={addNewContainerToShipment}
                            onDispatchCont={handleDispatchCont}
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

      {/* Dialog tạo/sửa lô */}
      {editDlg && (
        <ShipmentFormDlg
          shipment={editDlg === 'new' ? null : editDlg}
          suppliers={suppliers}
          isAdmin={isAdmin}
          onSave={editDlg === 'new' ? handleCreateShipment : handleUpdateShipment}
          onClose={() => setEditDlg(null)}
        />
      )}
    </div>
  );
}

// ── Dialog Điều cont (1 cont hoặc batch) ──────────────────────────────────────

function DispatchDlg({ containers: contList, shipment, shipmentConts, suppliers, isAdmin, onSave, onClose }) {
  // contList: 1 container hoặc array containers (batch)
  const conts = Array.isArray(contList) ? contList : [contList];
  const isBatch = conts.length > 1;
  const firstCont = conts[0];
  const anyDispatched = conts.some(c => c.dispatchStatus === 'dispatched');

  const [companyInfo, setCompanyInfo] = useState(null);
  const [savingInfo, setSavingInfo] = useState(false);
  const [orderInfo, setOrderInfo] = useState(null); // auto-fill từ đơn hàng nếu cont đã bán
  const [fm, setFm] = useState({
    dispatchType: firstCont.dispatchType || 'company',
    dispatchDate: firstCont.dispatchDate || new Date().toISOString().slice(0, 10),
    recipientName: firstCont.recipientName || '',
    recipientPhone: firstCont.recipientPhone || '',
    dispatchDestination: firstCont.dispatchDestination || '',
    dispatchProvince: firstCont.dispatchProvince || '',
    dispatchNotes: firstCont.dispatchNotes || '',
  });
  const [templateText, setTemplateText] = useState('');
  const [copied, setCopied] = useState(false);
  const f = (k) => (v) => setFm(p => ({ ...p, [k]: typeof v === 'object' ? v.target.value : v }));

  // Load company info + check if container sold (auto-fill from order)
  useEffect(() => {
    import('../api.js').then(api => api.fetchCompanyDispatchInfo()).then(setCompanyInfo).catch(() => {});
    // E: Nếu cont đã bán nguyên → fetch thông tin đơn hàng
    if (!isBatch && (firstCont.saleOrderId || firstCont.sale_order_id)) {
      const orderId = firstCont.saleOrderId || firstCont.sale_order_id;
      import('../api.js').then(api => api.fetchOrderDetail(orderId))
        .then(d => { if (d?.order) setOrderInfo(d.order); })
        .catch(() => {});
    }
  }, []); // eslint-disable-line

  const fillFromCompany = async () => {
    let info = companyInfo;
    if (!info) { info = await import('../api.js').then(api => api.fetchCompanyDispatchInfo()).catch(() => null); if (info) setCompanyInfo(info); }
    if (!info) return;
    const c0 = info.contacts?.[0];
    setFm(p => ({ ...p, dispatchDestination: info.address || '', dispatchProvince: info.province || '', recipientName: c0?.name || '', recipientPhone: c0?.phone || '' }));
  };

  const fillFromOrder = () => {
    if (!orderInfo) return;
    setFm(p => ({ ...p, dispatchType: 'customer', recipientName: orderInfo.customerName || '', recipientPhone: orderInfo.customerPhone || '', dispatchDestination: orderInfo.deliveryAddress || orderInfo.customerAddress || '', dispatchProvince: '' }));
  };

  const saveCompanyInfo = async () => {
    setSavingInfo(true);
    const contacts = companyInfo?.contacts || [];
    const existing = contacts.find(c => c.name === fm.recipientName && c.phone === fm.recipientPhone);
    const updatedContacts = existing ? contacts : [...contacts.filter(c => c.name || c.phone), { name: fm.recipientName.trim(), phone: fm.recipientPhone.trim() }].filter(c => c.name || c.phone).slice(0, 5);
    const info = { address: fm.dispatchDestination.trim(), province: fm.dispatchProvince.trim(), contacts: updatedContacts };
    await import('../api.js').then(api => api.saveCompanyDispatchInfo(info)).catch(() => {});
    setCompanyInfo(info);
    setSavingInfo(false);
  };

  const selectContact = (idx) => { const c = companyInfo?.contacts?.[idx]; if (c) setFm(p => ({ ...p, recipientName: c.name || '', recipientPhone: c.phone || '' })); };

  const switchType = (type) => { setFm(p => ({ ...p, dispatchType: type, dispatchDestination: '', dispatchProvince: '', recipientName: '', recipientPhone: '' })); };

  // Template
  const contCount = shipmentConts?.length || 1;
  const contCodes = conts.map(c => c.containerCode).join(', ');
  useEffect(() => {
    const lines = [
      `LỆNH ĐIỀU CONTAINER`,
      `════════════════════`,
      isBatch ? `Containers (${conts.length}): ${contCodes}` : `Mã container: ${contCodes}`,
      shipment ? `Thuộc lô: ${shipment.name || shipment.shipmentCode} (${contCount} cont)` : '',
      ``,
      `Ngày giao: ${fm.dispatchDate ? new Date(fm.dispatchDate + 'T00:00:00').toLocaleDateString('vi-VN') : '—'}`,
      fm.dispatchProvince ? `Tỉnh/TP: ${fm.dispatchProvince}` : '',
      `Địa chỉ: ${fm.dispatchDestination || '—'}`,
      ``,
      `Người nhận: ${fm.recipientName || '_______________'}`,
      `Điện thoại: ${fm.recipientPhone || '_______________'}`,
      fm.dispatchNotes ? `Lưu ý: ${fm.dispatchNotes}` : '',
    ].filter(Boolean).join('\n');
    setTemplateText(lines);
  }, [fm, contCodes, isBatch, conts.length, shipment, contCount]);

  const handleSave = (status) => {
    const ids = conts.map(c => c.id);
    onSave(ids, { dispatchStatus: status, dispatchDate: fm.dispatchDate || null, dispatchType: fm.dispatchType || null, recipientName: fm.recipientName.trim() || null, recipientPhone: fm.recipientPhone.trim() || null, dispatchDestination: fm.dispatchDestination.trim() || null, dispatchProvince: fm.dispatchProvince.trim() || null, dispatchNotes: fm.dispatchNotes.trim() || null });
    onClose();
  };

  const handleCopy = () => { navigator.clipboard.writeText(templateText).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };

  const inp = { width: "100%", padding: "7px 10px", borderRadius: 6, border: "1.5px solid var(--bd)", fontSize: "0.8rem", outline: "none", boxSizing: "border-box", background: "var(--bgc)", color: "var(--tp)" };
  const lbl = { display: "block", fontSize: "0.66rem", fontWeight: 700, color: "var(--brl)", marginBottom: 3, textTransform: "uppercase" };
  const contacts = companyInfo?.contacts?.filter(c => c.name || c.phone) || [];

  return (
    <Dialog open={true} onClose={onClose} title={isBatch ? `Điều ${conts.length} container` : `Điều cont — ${firstCont.containerCode}`} width={640} noEnter>
      {/* Lịch sử điều (B) — chỉ hiện khi 1 cont đã từng điều */}
      {!isBatch && firstCont.dispatchedAt && (
        <div style={{ padding: "6px 10px", borderRadius: 6, background: "rgba(22,160,133,0.06)", border: "1px solid rgba(22,160,133,0.2)", marginBottom: 12, fontSize: "0.72rem", color: "#16A085" }}>
          ✓ Đã điều lúc <strong>{new Date(firstCont.dispatchedAt).toLocaleString('vi-VN')}</strong>
          {firstCont.dispatchedBy && <> bởi <strong>{firstCont.dispatchedBy}</strong></>}
          {firstCont.dispatchType && <> · {firstCont.dispatchType === 'customer' ? '🏭 Về khách' : '🏠 Về công ty'}</>}
        </div>
      )}

      {/* E: Auto-fill từ đơn hàng */}
      {orderInfo && (
        <div style={{ padding: "6px 10px", borderRadius: 6, background: "rgba(142,68,173,0.06)", border: "1px solid rgba(142,68,173,0.2)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8, fontSize: "0.72rem" }}>
          <span style={{ color: "#8E44AD" }}>🛒 Cont đã bán cho <strong>{orderInfo.customerName}</strong></span>
          <button onClick={fillFromOrder}
            style={{ marginLeft: "auto", padding: "3px 10px", borderRadius: 5, border: "1.5px solid #8E44AD", background: "rgba(142,68,173,0.08)", color: "#8E44AD", cursor: "pointer", fontSize: "0.68rem", fontWeight: 700 }}>
            Dùng thông tin KH
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: 16 }}>
        {/* Form trái */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label style={lbl}>Điều về</label>
            <div style={{ display: "flex", gap: 6 }}>
              {[{ v: 'customer', l: '🏭 Khách hàng', c: '#8E44AD' }, { v: 'company', l: '🏠 Công ty', c: 'var(--br)' }].map(opt => (
                <button key={opt.v} onClick={() => switchType(opt.v)}
                  style={{ flex: 1, padding: "7px 8px", borderRadius: 6, border: `1.5px solid ${fm.dispatchType === opt.v ? opt.c : "var(--bd)"}`, background: fm.dispatchType === opt.v ? (opt.v === 'customer' ? 'rgba(142,68,173,0.08)' : 'rgba(90,62,43,0.06)') : "transparent", color: fm.dispatchType === opt.v ? opt.c : "var(--ts)", cursor: "pointer", fontSize: "0.76rem", fontWeight: fm.dispatchType === opt.v ? 700 : 500 }}>
                  {opt.l}
                </button>
              ))}
            </div>
          </div>

          {fm.dispatchType === 'company' && (
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={fillFromCompany} style={{ padding: "4px 10px", borderRadius: 5, border: "1.5px solid var(--br)", background: "rgba(90,62,43,0.06)", color: "var(--br)", cursor: "pointer", fontSize: "0.68rem", fontWeight: 600 }}>↓ Lấy từ đã lưu</button>
              <button onClick={saveCompanyInfo} disabled={savingInfo} style={{ padding: "4px 10px", borderRadius: 5, border: "1.5px solid var(--gn)", background: "rgba(50,79,39,0.06)", color: "var(--gn)", cursor: savingInfo ? "not-allowed" : "pointer", fontSize: "0.68rem", fontWeight: 600 }}>{savingInfo ? "Đang lưu..." : "↑ Lưu lại"}</button>
            </div>
          )}

          <div>
            <label style={lbl}>Ngày nhận hàng</label>
            <input type="date" value={fm.dispatchDate} onChange={f('dispatchDate')} style={inp} />
          </div>
          <div><label style={lbl}>Tỉnh/TP</label><input value={fm.dispatchProvince} onChange={f('dispatchProvince')} placeholder="VD: Hà Nội" style={inp} /></div>
          <div><label style={lbl}>Địa chỉ cụ thể</label><input value={fm.dispatchDestination} onChange={f('dispatchDestination')} placeholder="Địa chỉ giao hàng" style={inp} /></div>

          <div>
            <label style={lbl}>Người nhận hàng</label>
            {contacts.length > 0 && (
              <div style={{ display: "flex", gap: 4, marginBottom: 6, flexWrap: "wrap" }}>
                {contacts.map((c, i) => {
                  const active = fm.recipientName === c.name && fm.recipientPhone === c.phone;
                  return <button key={i} onClick={() => selectContact(i)} style={{ padding: "3px 8px", borderRadius: 5, border: active ? "1.5px solid var(--ac)" : "1px solid var(--bd)", background: active ? "var(--acbg)" : "var(--bgs)", color: active ? "var(--ac)" : "var(--ts)", cursor: "pointer", fontSize: "0.7rem", fontWeight: active ? 700 : 500 }}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</button>;
                })}
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}><input value={fm.recipientName} onChange={f('recipientName')} placeholder="Họ tên" style={inp} /></div>
              <div style={{ flex: 1 }}><input value={fm.recipientPhone} onChange={f('recipientPhone')} placeholder="0912 345 678" style={inp} /></div>
            </div>
          </div>

          <div>
            <label style={lbl}>Lưu ý cho vận tải</label>
            <textarea value={fm.dispatchNotes} onChange={f('dispatchNotes')} rows={2} placeholder="VD: Cân hàng tại cảng, chờ lệnh SĐT xxx..." style={{ ...inp, resize: "vertical", fontFamily: "inherit" }} />
          </div>
        </div>

        {/* Template phải */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label style={lbl}>Lệnh điều cont (preview)</label>
            <button onClick={handleCopy} style={{ padding: "3px 10px", borderRadius: 5, border: "1.5px solid var(--ac)", background: copied ? "var(--ac)" : "transparent", color: copied ? "#fff" : "var(--ac)", cursor: "pointer", fontSize: "0.68rem", fontWeight: 700 }}>{copied ? "✓ Đã copy" : "📋 Copy"}</button>
          </div>
          <textarea value={templateText} onChange={e => setTemplateText(e.target.value)} style={{ ...inp, flex: 1, minHeight: 200, fontFamily: "Consolas, monospace", fontSize: "0.74rem", lineHeight: 1.5, resize: "none", background: "var(--bgs)" }} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
        {anyDispatched && isAdmin && (
          <button onClick={() => handleSave('pending')} style={{ padding: "8px 16px", borderRadius: 7, border: "1.5px solid var(--dg)", background: "transparent", color: "var(--dg)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>↩ Hủy điều</button>
        )}
        <button onClick={() => handleSave('dispatched')} style={{ padding: "8px 20px", borderRadius: 7, border: "none", background: "#16A085", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.82rem" }}>✓ {isBatch ? `Điều ${conts.length} cont` : 'Xác nhận đã điều'}</button>
      </div>
    </Dialog>
  );
}

// ── Dialog chọn container để điều ──────────────────────────────────────────────
function DispatchPickerDlg({ containers, onConfirm, onClose }) {
  const [selected, setSelected] = useState(new Set());
  const toggle = (id) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(p => p.size === containers.length ? new Set() : new Set(containers.map(c => c.id)));

  return (
    <Dialog open={true} onClose={onClose} title="Chọn container để điều" width={460} noEnter>
      <div style={{ fontSize: "0.74rem", color: "var(--ts)", marginBottom: 10 }}>
        Chọn các container cần điều về cùng địa chỉ. Nếu điều về các điểm khác nhau, chọn từng nhóm rồi điều riêng.
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: "0.72rem", fontWeight: 600 }}>
          <input type="checkbox" checked={selected.size === containers.length} onChange={toggleAll} style={{ accentColor: "#16A085" }} />
          Chọn tất cả ({containers.length})
        </label>
      </div>
      <div style={{ maxHeight: 300, overflowY: "auto", border: "1px solid var(--bd)", borderRadius: 7 }}>
        {containers.map((c, i) => {
          const checked = selected.has(c.id);
          return (
            <div key={c.id} onClick={() => toggle(c.id)} data-clickable="true"
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderBottom: i < containers.length - 1 ? "1px solid var(--bd)" : "none", cursor: "pointer", background: checked ? "rgba(22,160,133,0.06)" : (i % 2 ? "var(--bgs)" : "#fff") }}>
              <input type="checkbox" readOnly checked={checked} style={{ accentColor: "#16A085", flexShrink: 0 }} />
              <span style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--br)", fontSize: "0.78rem" }}>📦 {c.containerCode}</span>
              {c.totalVolume != null && <span style={{ fontSize: "0.68rem", color: "var(--ts)", marginLeft: "auto" }}>{parseFloat(c.totalVolume).toFixed(2)} {c.weightUnit === 'ton' ? 'tấn' : 'm³'}</span>}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
        <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>Hủy</button>
        <button onClick={() => { if (!selected.size) return; onConfirm(containers.filter(c => selected.has(c.id))); }}
          disabled={!selected.size}
          style={{ padding: "8px 20px", borderRadius: 7, border: "none", background: selected.size ? "#16A085" : "var(--bd)", color: "#fff", cursor: selected.size ? "pointer" : "not-allowed", fontWeight: 700, fontSize: "0.78rem" }}>
          Tiếp tục — Điều {selected.size} cont
        </button>
      </div>
    </Dialog>
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

function ExpandedCargo({ sh, sc, contItems, suppliers, wts, rawWoodTypes, isAdmin, ce, unassignedConts, assignOpen, setAssignOpen, assignCont, removeCont, updateField, addNewContainer, onDispatchCont, useAPI, notify }) {
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
  const [dispatchCont, setDispatchCont] = useState(null); // container đang mở dialog điều cont
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

  // Tính KTB dự kiến từ khối lượng (tấn ≈ m³), số cây, chiều dài
  // V = D² × L × 7854 × N / 10⁸ → D = √(V × 10⁸ / (7854 × L × N))
  // Nếu 2 chiều dài (min-max): thu hẹp khoảng (min+0.7, max-0.3) → tính KTB min-max
  const calcKTB = (vol, pieceCount, lengthStr) => {
    const v = parseFloat(vol), n = parseInt(pieceCount);
    if (!v || !n || !lengthStr) return '';
    const parts = String(lengthStr).split('-').map(s => parseFloat(s.trim())).filter(x => x > 0);
    if (!parts.length) return '';
    // Auto-detect m vs cm
    const toM = (x) => x > 20 ? x / 100 : x;
    const calcD = (l) => {
      if (l < 1 || l > 15) return null;
      const dSq = v * 1e8 / (7854 * l * n);
      if (dSq <= 0) return null;
      const d = Math.sqrt(dSq);
      return (d >= 15 && d <= 100) ? d : null;
    };
    if (parts.length === 1) {
      const d = calcD(toM(parts[0]));
      return d ? d.toFixed(1) : '';
    }
    // 2 chiều dài → thu hẹp: min+0.7m, max-0.3m → tính KTB range
    // Dài hơn → kính nhỏ hơn, ngắn hơn → kính lớn hơn
    const lMax = toM(Math.max(...parts)) - 0.3; // dài max thu hẹp → KTB min
    const lMin = toM(Math.min(...parts)) + 0.7; // dài min thu hẹp → KTB max
    const dMin = calcD(Math.max(lMin, lMax)); // dài lớn → kính nhỏ
    const dMax = calcD(Math.min(lMin, lMax)); // dài nhỏ → kính lớn
    if (!dMin && !dMax) return '';
    if (dMin && dMax && Math.abs(dMin - dMax) > 1) return `${dMin.toFixed(0)}-${dMax.toFixed(0)}`;
    return (dMin || dMax).toFixed(1);
  };

  // CSV template hint theo loại hàng + đơn vị
  const csvTemplateHint = () => {
    if (isBox) return 'Mã, Dày(cm), Rộng(cm), Dài(cm), KL(bỏ qua), Ghi chú';
    if (lotCargoType === 'raw_round' && formWeightUnit === 'ton')
      return 'Mã, Số cây, Độ dài(m), KL tấn, Mô tả';
    if (lotCargoType === 'raw_round')
      return 'Mã, Lối hàng, Chất lượng, Số cây, KL m³, Mô tả';
    // Gỗ kiện (sawn)
    return 'Mã, Số kiện, Độ dày, Chất lượng, KL m³, Mô tả';
  };

  // Parse CSV text → rows (theo loại hàng + đơn vị)
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

      // Gỗ hộp: Mã, Dày, Rộng, Dài, KL(skip), Ghi chú
      if (isBox) {
        const t = cols[1] || '', w = cols[2] || '', l = cols[3] || '';
        const vol = (parseFloat(t) && parseFloat(w) && parseFloat(l))
          ? (parseFloat(t) * parseFloat(w) * parseFloat(l) / 1e6).toFixed(3) : '';
        return { ...base, thicknessCm: t, widthCm: w, lengthCm: l, totalVolume: vol, description: cols[5] || '' };
      }

      // Gỗ tròn + tấn: Mã, Số cây, Độ dài, KL tấn, Mô tả
      if (lotCargoType === 'raw_round' && formWeightUnit === 'ton') {
        const pc = cols[1] || '', len = cols[2] || '', vol = cols[3] || '', desc = cols[4] || '';
        const ktb = calcKTB(vol, pc, len);
        return { ...base, pieceCount: pc, lengthRange: len, totalVolume: vol, avgDiameterCm: ktb, description: desc };
      }

      // Gỗ tròn + m³: Mã, Lối, CL, Số cây, KL m³, Mô tả
      if (lotCargoType === 'raw_round') {
        return { ...base, lane: cols[1] || '', quality: cols[2] || '', pieceCount: cols[3] || '', totalVolume: cols[4] || '', description: cols[5] || '' };
      }

      // Gỗ kiện (sawn): Mã, Số kiện, Dày, CL, KL m³, Mô tả
      return { ...base, pieceCount: cols[1] || '', thickness: cols[2] || '', quality: cols[3] || '', totalVolume: cols[4] || '', description: cols[5] || '' };
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

      {/* C: Tổng quan tài chính lô — admin only */}
      {isAdmin && sh.unitCostUsd && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10, padding: "8px 12px", borderRadius: 7, background: "var(--bgc)", border: "1px solid var(--bds)" }}>
          {(() => {
            const costPerM3Vnd = (sh.unitCostUsd || 0) * (sh.exchangeRate || 0);
            const totalCostVnd = costPerM3Vnd * totalVol;
            const COST_PER_CONT_DAY = 1200000;
            const overdueDays = sh.contDeadline ? Math.max(0, -daysLeft(sh.contDeadline)) : 0;
            const storageCost = overdueDays * sc.length * COST_PER_CONT_DAY;
            return [
              { label: "Giá vốn", value: `${sh.unitCostUsd} USD × ${(sh.exchangeRate || 0).toLocaleString('vi-VN')} = ${costPerM3Vnd.toLocaleString('vi-VN')} đ/m³`, color: "var(--br)" },
              { label: `Tổng (${totalVol.toFixed(1)} m³)`, value: `${(totalCostVnd / 1e6).toFixed(1)} tr`, color: "var(--br)" },
              ...(storageCost > 0 ? [{ label: `Phí lưu cont (${overdueDays}d × ${sc.length})`, value: `${(storageCost / 1e6).toFixed(1)} tr`, color: "#C0392B" }] : []),
              ...(storageCost > 0 ? [{ label: "Tổng chi phí", value: `${((totalCostVnd + storageCost) / 1e6).toFixed(1)} tr`, color: "#C0392B" }] : []),
            ].map(c => (
              <div key={c.label} style={{ padding: "4px 10px", borderRadius: 5, background: "var(--bgs)", minWidth: 100 }}>
                <div style={{ fontSize: "0.56rem", color: "var(--tm)", fontWeight: 600, textTransform: "uppercase" }}>{c.label}</div>
                <div style={{ fontSize: "0.78rem", fontWeight: 700, color: c.color }}>{c.value}</div>
              </div>
            ));
          })()}
        </div>
      )}

      {/* Container list header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase" }}>
          Containers ({sc.length}) — {totalVol.toFixed(3)}
        </span>
        <div style={{ display: "flex", gap: 5 }}>
          {ce && sc.filter(c => c.dispatchStatus !== 'dispatched').length > 0 && (
            <button onClick={() => setDispatchCont('pick')}
              style={{ padding: "3px 9px", borderRadius: 5, background: "#16A085", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.68rem" }}>
              🚛 Điều cont ({sc.filter(c => c.dispatchStatus !== 'dispatched').length} chưa điều)
            </button>
          )}
          {ce && (
            <>
              <button onClick={() => setAssignOpen(assignOpen === sh.id ? null : sh.id)}
                style={{ padding: "3px 9px", borderRadius: 5, background: "var(--bgs)", color: "var(--br)", border: "1.5px solid var(--br)", cursor: "pointer", fontWeight: 600, fontSize: "0.68rem" }}>
                Gắn có sẵn
              </button>
              <button onClick={openNewForm}
                style={{ padding: "3px 9px", borderRadius: 5, background: "var(--br)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.68rem" }}>
                + Tạo container
              </button>
            </>
          )}
        </div>
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
            {/* CSV import */}
            {(
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
          {showCsvInput && (
            <div style={{ marginBottom: 10, padding: "8px 10px", borderRadius: 6, background: "var(--bgs)", border: "1px solid var(--bd)" }}>
              <div style={{ fontSize: "0.62rem", color: "var(--ts)", marginBottom: 4 }}>
                <strong>{csvTemplateHint()}</strong>
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

          {/* Table — dynamic columns theo loại hàng + đơn vị */}
          {(() => {
            const hs = { flexShrink: 0, fontSize: "0.6rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase" };
            const isRoundTon = lotCargoType === 'raw_round' && formWeightUnit === 'ton';
            const isRoundM3  = lotCargoType === 'raw_round' && formWeightUnit !== 'ton';
            const isSawn     = lotCargoType === 'sawn';

            // Định nghĩa cột theo loại
            // Gỗ tròn m³: Mã, Lối, CL, Số cây, KL m³, KTB(auto), Mô tả
            // Gỗ tròn tấn: Mã, Số cây, Độ dài, KL tấn, KTB dự kiến(auto), Mô tả
            // Gỗ hộp: Mã, Số hộp, KL m³, Rộng TB, Mô tả
            // Gỗ kiện: Mã, Số kiện, Dày, CL, KL m³/m², Mô tả

            return (<>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4, paddingBottom: 4, borderBottom: "1px solid var(--bd)" }}>
                <span style={{ ...hs, width: 130 }}>Mã cont *</span>
                {isRoundM3 && <><span style={{ ...hs, width: 70 }}>Lối hàng</span><span style={{ ...hs, width: 70 }}>Chất lượng</span></>}
                {isRoundTon && <span style={{ ...hs, width: 80 }}>Độ dài (m)</span>}
                {isSawn && <><span style={{ ...hs, width: 65 }}>Dày</span><span style={{ ...hs, width: 70 }}>Chất lượng</span></>}
                <span style={{ ...hs, width: 65, textAlign: "right" }}>{pieceLabel}</span>
                <span style={{ ...hs, width: 80, textAlign: "right" }}>KL ({volLabel})</span>
                {(isRoundM3 || isRoundTon) && <span style={{ ...hs, width: 70, textAlign: "right", color: "#2980b9" }}>KTB (cm)</span>}
                {isBox && <span style={{ ...hs, width: 70, textAlign: "right" }}>Rộng TB</span>}
                <span style={{ ...hs, flex: 1 }}>Mô tả</span>
                <span style={{ width: 22 }} />
              </div>

              {nfRows.map((row, idx) => (
                <div key={idx} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 5 }}>
                  <input value={row.containerCode} onChange={e => setRow(idx, "containerCode", e.target.value)}
                    placeholder="TCKU1234567" autoFocus={idx === 0}
                    style={{ ...inpS, flexShrink: 0, width: 130, borderColor: nfErr && !row.containerCode ? "var(--dg)" : "var(--bd)" }} />

                  {isRoundM3 && <>
                    <input value={row.lane || ''} onChange={e => setRow(idx, "lane", e.target.value)} placeholder="A1" style={{ ...inpS, flexShrink: 0, width: 70 }} />
                    <input value={row.quality || ''} onChange={e => setRow(idx, "quality", e.target.value)} placeholder="CL" style={{ ...inpS, flexShrink: 0, width: 70 }} />
                  </>}

                  {isRoundTon && (
                    <input value={row.lengthRange || ''} onChange={e => { setRow(idx, "lengthRange", e.target.value); }}
                      placeholder="6 hoặc 1.8-2.4" style={{ ...inpS, flexShrink: 0, width: 80 }} />
                  )}

                  {isSawn && <>
                    <input value={row.thickness || ''} onChange={e => setRow(idx, "thickness", e.target.value)} placeholder="2F" style={{ ...inpS, flexShrink: 0, width: 65 }} />
                    <input value={row.quality || ''} onChange={e => setRow(idx, "quality", e.target.value)} placeholder="Fas" style={{ ...inpS, flexShrink: 0, width: 70 }} />
                  </>}

                  <input type="number" min="0" step="1" value={row.pieceCount || ''} onChange={e => setRow(idx, "pieceCount", e.target.value)}
                    placeholder="0" style={{ ...inpS, flexShrink: 0, width: 65, textAlign: "right" }} />

                  <input type="number" step="0.001" min="0" value={row.totalVolume || ''} onChange={e => setRow(idx, "totalVolume", e.target.value)}
                    placeholder="0.000" style={{ ...inpS, flexShrink: 0, width: 80, textAlign: "right" }} />

                  {(isRoundM3 || isRoundTon) && (
                    <span style={{ flexShrink: 0, width: 70, textAlign: "right", fontSize: "0.76rem", fontWeight: 700, color: "#2980b9" }}>
                      {isRoundTon ? (row.avgDiameterCm || calcKTB(row.totalVolume, row.pieceCount, row.lengthRange) || '—') : (row.avgDiameterCm || '—')}
                    </span>
                  )}

                  {isBox && (
                    <input type="number" step="0.1" min="0" value={row.avgWidthCm || ''} onChange={e => setRow(idx, "avgWidthCm", e.target.value)}
                      placeholder="—" style={{ ...inpS, flexShrink: 0, width: 70, textAlign: "right" }} />
                  )}

                  <input value={row.description || ''} onChange={e => setRow(idx, "description", e.target.value)} placeholder="Mô tả" style={{ ...inpS, flex: 1, minWidth: 0 }} />
                  <button onClick={() => removeRow(idx)} disabled={nfRows.length === 1}
                    style={{ flexShrink: 0, width: 22, height: 22, padding: 0, borderRadius: 4, border: "1px solid var(--dg)", background: "transparent", color: nfRows.length === 1 ? "var(--bd)" : "var(--dg)", cursor: nfRows.length === 1 ? "default" : "pointer", fontSize: "0.62rem", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                </div>
              ))}
            </>);
          })()}

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
        const colHeaders = ["Loại gỗ", "NCC", "Mã container", pieceColLabel, sizeColLabel, "Chất lượng", "Tổng KL", "Điều cont", "Trạng thái", "Ghi chú", ""];
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
                      {/* Điều cont */}
                      <td style={{ padding: "5px 7px", borderBottom: bdBot, whiteSpace: "nowrap" }} onClick={e => e.stopPropagation()}>
                        {c.dispatchStatus === 'dispatched'
                          ? <span onClick={() => setDispatchCont(c)} style={{ padding: "2px 7px", borderRadius: 4, fontSize: "0.62rem", fontWeight: 700, background: "rgba(22,160,133,0.12)", color: "#16A085", cursor: "pointer" }}>✓ Đã điều</span>
                          : ce
                            ? <button onClick={() => setDispatchCont(c)} style={{ padding: "2px 8px", borderRadius: 4, border: "1.5px solid #E67E22", background: "rgba(230,126,34,0.08)", color: "#E67E22", cursor: "pointer", fontSize: "0.62rem", fontWeight: 700 }}>Điều</button>
                            : <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: "0.62rem", fontWeight: 700, background: "rgba(230,126,34,0.08)", color: "#E67E22" }}>Chưa điều</span>
                        }
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
                  <td colSpan={9} style={{ padding: "5px 7px", textAlign: "right", fontWeight: 700, fontSize: "0.66rem", color: "var(--brl)", borderTop: "2px solid var(--bds)" }}>Tổng {sc.length} cont:</td>
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

      {/* Dialog chọn cont để điều */}
      {dispatchCont === 'pick' && (
        <DispatchPickerDlg
          containers={sc.filter(c => c.dispatchStatus !== 'dispatched')}
          onConfirm={(selected) => setDispatchCont(selected)}
          onClose={() => setDispatchCont(null)}
        />
      )}

      {/* Dialog điều cont (1 hoặc batch) */}
      {dispatchCont && dispatchCont !== 'pick' && (
        <DispatchDlg
          containers={dispatchCont}
          shipment={sh}
          shipmentConts={sc}
          suppliers={suppliers}
          isAdmin={isAdmin}
          onSave={(ids, fields) => onDispatchCont(ids, fields)}
          onClose={() => setDispatchCont(null)}
        />
      )}
    </div>
  );
}
