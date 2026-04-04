import React, { useState, useEffect, useMemo } from "react";
import useTableSort from '../useTableSort';
import { CONTAINER_STATUSES } from "./PgNCC";
import { INV_STATUS, getCargoStatus, getContainerInvStatus } from "../utils";
import Dialog from '../components/Dialog';

// Loại hàng hóa trong container
const CARGO_TYPES = [
  { value: "sawn",      label: "Gỗ xẻ NK",  icon: "🪚", color: "var(--gn)",  bg: "rgba(50,79,39,0.1)" },
  { value: "raw_round", label: "Gỗ tròn",    icon: "🪵", color: "#8B5E3C",   bg: "rgba(139,94,60,0.1)" },
  { value: "raw_box",   label: "Gỗ hộp",     icon: "📦", color: "#2980b9",   bg: "rgba(41,128,185,0.1)" },
];
const cargoInfo = (v) => CARGO_TYPES.find(t => t.value === v) || CARGO_TYPES[0];

const statusColor = (s) => s === "Đã về" || s === "Đã nhập kho" ? "var(--gn)" : s === "Đang vận chuyển" ? "var(--ac)" : "var(--ts)";
const statusBg    = (s) => s === "Đã về" || s === "Đã nhập kho" ? "rgba(50,79,39,0.1)" : s === "Đang vận chuyển" ? "rgba(242,101,34,0.08)" : "var(--bgs)";

const EMPTY_FM = { containerCode: "", cargoType: "sawn", shipmentId: "", isStandalone: false, nccId: "", arrivalDate: "", totalVolume: "", status: "Tạo mới", notes: "", weightUnit: "m3", tonToM3Factor: "", rawWoodTypeId: "" };

export default function PgContainer({ suppliers, wts, cfg = {}, ce, addOnly, useAPI, notify, bundles = [], allContainers, setAllContainers }) {
  const containers   = allContainers || [];
  const setContainers = setAllContainers || (() => {});

  const [items, setItems]           = useState({});
  const [loadingList, setLoadingList] = useState(true);
  const [rawWoodTypes, setRawWoodTypes] = useState([]);
  const [shipments, setShipments]   = useState([]);
  const [expId, setExpId]           = useState(null); // container detail dialog
  const [ed, setEd]                 = useState(null);
  const [fm, setFm]                 = useState(EMPTY_FM);
  const [fmErr, setFmErr]           = useState({});
  const [newItems, setNewItems]     = useState([]);
  const [itemEd, setItemEd]         = useState(null);
  const [itemFm, setItemFm]         = useState({ itemType: "sawn", woodId: "", rawWoodTypeId: "", thickness: "", pieceCount: "", quality: "", volume: "", notes: "" });
  const [filterCargoType, setFilterCargoType] = useState("");
  const [filterStatus, setFilterStatus]       = useState("");
  const [filterShipment, setFilterShipment]   = useState("");
  const [filterNcc, setFilterNcc]             = useState("");
  const [filterWoodType, setFilterWoodType]   = useState("");
  const { sortField, sortDir, toggleSort, sortIcon, applySort } = useTableSort("shipmentId", "desc");
  const [inspSummary, setInspSummary] = useState({}); // {contId: {total,available,sawn,sold}}
  const [confirmDel, setConfirmDel] = useState(null); // container cần xác nhận xóa

  // Fetch dữ liệu ban đầu
  useEffect(() => {
    if (!useAPI) { setLoadingList(false); return; }
    Promise.all([
      import('../api.js').then(api => api.fetchAllContainerItems()),
      import('../api.js').then(api => api.fetchRawWoodTypes()),
      import('../api.js').then(api => api.fetchShipments()),
      import('../api.js').then(api => api.fetchInspectionSummaryAll()),
    ]).then(([allItems, rwTypes, sms, inspSum]) => {
      setItems(allItems);
      setRawWoodTypes(rwTypes);
      setShipments(sms);
      setInspSummary(inspSum);
      setLoadingList(false);
    }).catch(e => { notify("Lỗi tải dữ liệu: " + e.message, false); setLoadingList(false); });
  }, [useAPI]); // eslint-disable-line

  const loadItems = (containerId) => {
    if (items[containerId] !== undefined) return;
    if (!useAPI) { setItems(p => ({ ...p, [containerId]: [] })); return; }
    import('../api.js').then(api => api.fetchContainerItems(containerId))
      .then(data => setItems(p => ({ ...p, [containerId]: data })))
      .catch(e => notify("Lỗi tải chi tiết: " + e.message, false));
  };

  const reloadItems = (containerId) => {
    if (!useAPI) return;
    import('../api.js').then(api => api.fetchContainerItems(containerId))
      .then(data => setItems(p => ({ ...p, [containerId]: data })))
      .catch(e => notify("Lỗi: " + e.message, false));
  };

  const toggleExp = (id) => {
    if (expId === id) { setExpId(null); setItemEd(null); return; }
    setExpId(id); setItemEd(null); loadItems(id);
  };

  // ── Form mở ──
  const openNew = () => {
    setFm(EMPTY_FM); setFmErr({}); setNewItems([]); setEd("new");
  };

  const openEdit = (c) => {
    setFm({
      containerCode: c.containerCode,
      cargoType:     c.cargoType || "sawn",
      shipmentId:    c.shipmentId || "",
      isStandalone:  c.isStandalone || !c.shipmentId,
      nccId:         c.nccId || "",
      arrivalDate:   c.arrivalDate || "",
      totalVolume:   c.totalVolume != null ? String(c.totalVolume) : "",
      status:        c.status || "Tạo mới",
      notes:         c.notes || "",
      weightUnit:    c.weightUnit || "m3",
      tonToM3Factor: c.tonToM3Factor != null ? String(c.tonToM3Factor) : "",
      rawWoodTypeId: c.rawWoodTypeId || "",
    });
    setFmErr({}); setEd(c.id);
  };

  // Khi chọn lô → auto-fill NCC + cargoType
  const onShipmentChange = (shipmentId) => {
    const sh = shipments.find(s => s.id === shipmentId);
    const updates = { shipmentId, isStandalone: false };
    if (sh) {
      if (sh.nccId) updates.nccId = sh.nccId;
      if (sh.lotType) updates.cargoType = sh.lotType === "raw" ? "raw_round" : "sawn";
    }
    setFm(p => ({ ...p, ...updates }));
  };

  // ── Lưu container ──
  const sv = () => {
    const errs = {};
    if (!fm.containerCode.trim()) errs.containerCode = "Không được để trống";
    if (Object.keys(errs).length) { setFmErr(errs); return; }
    setFmErr({});

    const validItems = ed === "new" ? newItems.filter(x => x.woodId || x.rawWoodTypeId) : [];
    const tvol = ed === "new"
      ? (validItems.reduce((s, x) => s + (parseFloat(x.volume) || 0), 0) || null)
      : (fm.totalVolume.trim() ? parseFloat(fm.totalVolume) : null);

    const fields = {
      containerCode: fm.containerCode.trim(),
      cargoType:     fm.cargoType || "sawn",
      shipmentId:    fm.isStandalone ? null : (fm.shipmentId || null),
      isStandalone:  fm.isStandalone,
      nccId:         fm.nccId || null,
      arrivalDate:   fm.arrivalDate || null,
      totalVolume:   tvol,
      status:        ed === "new" ? "Tạo mới" : (fm.status || "Tạo mới"),
      notes:         fm.notes.trim() || null,
      weightUnit:    fm.weightUnit || "m3",
      tonToM3Factor: fm.tonToM3Factor ? parseFloat(fm.tonToM3Factor) : null,
      rawWoodTypeId: fm.rawWoodTypeId || null,
    };

    if (ed === "new") {
      const tmp = { id: "tmp_" + Date.now(), ...fields };
      setContainers(p => [tmp, ...p]);
      if (!useAPI) {
        setItems(p => ({ ...p, [tmp.id]: validItems.map((x, i) => ({ ...x, id: Date.now() + i, volume: x.volume ? parseFloat(x.volume) : null })) }));
      } else {
        import('../api.js').then(api => api.addContainer(fields)
          .then(r => {
            if (r?.error) { notify("Lỗi: " + r.error, false); setContainers(p => p.filter(c => c.id !== tmp.id)); return; }
            const realId = r.id;
            setContainers(p => p.map(c => c.id === tmp.id ? { ...c, id: realId } : c));
            if (expId === tmp.id) setExpId(realId);
            if (validItems.length > 0) {
              Promise.all(validItems.map(x => api.addContainerItem(realId, {
                itemType:      fm.cargoType === "sawn" ? "sawn" : fm.cargoType,
                woodId:        fm.cargoType === "sawn" ? x.woodId : null,
                rawWoodTypeId: fm.cargoType !== "sawn" ? x.rawWoodTypeId : null,
                thickness:     fm.cargoType === "sawn" ? x.thickness : null,
                pieceCount:    fm.cargoType !== "sawn" ? (parseInt(x.pieceCount) || null) : null,
                quality:       x.quality || null,
                volume:        x.volume ? parseFloat(x.volume) : null,
                notes:         x.notes || null,
              }))).then(() => reloadItems(realId)).catch(() => {});
            } else {
              setItems(p => ({ ...p, [realId]: [] }));
            }
            notify("Đã thêm " + fields.containerCode + (validItems.length ? ` (${validItems.length} mặt hàng)` : ""));
          }).catch(e => notify("Lỗi kết nối: " + e.message, false)));
      }
    } else {
      setContainers(p => p.map(c => c.id === ed ? { ...c, ...fields } : c));
      if (useAPI) import('../api.js').then(api => api.updateContainer(ed, fields)
        .then(r => notify(r?.error ? ("Lỗi: " + r.error) : "Đã cập nhật", !r?.error))
        .catch(e => notify("Lỗi kết nối: " + e.message, false)));
    }
    setEd(null);
  };

  const del = (c) => {
    const bundleCount = bundles.filter(b => b.containerId === c.id || b.container_id === c.id).length;
    if (bundleCount > 0) { notify(`Không thể xóa "${c.containerCode}" — đang có ${bundleCount} gỗ kiện.`, false); return; }
    setConfirmDel(c);
  };
  const confirmDelete = () => {
    const c = confirmDel;
    if (!c) return;
    setConfirmDel(null);
    setContainers(p => p.filter(x => x.id !== c.id));
    if (expId === c.id) setExpId(null);
    if (useAPI) import('../api.js').then(api => api.deleteContainer(c.id)
      .then(r => notify(r?.error ? ("Lỗi: " + r.error) : "Đã xóa container", !r?.error))
      .catch(e => notify("Lỗi kết nối: " + e.message, false)));
  };

  // ── Item CRUD (khi expand) ──
  const openItemNew = (c) => {
    const ct = c.cargoType || "sawn";
    setItemFm({ itemType: ct, woodId: wts[0]?.id || "", rawWoodTypeId: "", thickness: "", pieceCount: "", quality: "", volume: "", notes: "" });
    setItemEd("new");
  };

  const openItemEdit = (item) => {
    setItemFm({
      itemType:       item.itemType || "sawn",
      woodId:         item.woodId || "",
      rawWoodTypeId:  item.rawWoodTypeId || "",
      thickness:      item.thickness || "",
      pieceCount:     item.pieceCount != null ? String(item.pieceCount) : "",
      quality:        item.quality || "",
      volume:         item.volume != null ? String(item.volume) : "",
      notes:          item.notes || "",
    });
    setItemEd(item.id);
  };

  const saveItem = (containerId) => {
    const vol = itemFm.volume.trim() ? parseFloat(itemFm.volume) : null;
    const itemPayload = {
      itemType:      itemFm.itemType || "sawn",
      woodId:        itemFm.itemType === "sawn" ? (itemFm.woodId || null) : null,
      rawWoodTypeId: itemFm.itemType !== "sawn" ? (itemFm.rawWoodTypeId || null) : null,
      thickness:     itemFm.itemType === "sawn" ? (itemFm.thickness || null) : null,
      pieceCount:    itemFm.itemType !== "sawn" ? (parseInt(itemFm.pieceCount) || null) : null,
      quality:       itemFm.quality || null,
      volume:        vol,
      notes:         itemFm.notes || null,
    };
    if (itemEd === "new") {
      if (!useAPI) {
        setItems(p => ({ ...p, [containerId]: [...(p[containerId] || []), { id: Date.now(), ...itemPayload }] }));
        setItemEd(null); return;
      }
      import('../api.js').then(api => api.addContainerItem(containerId, itemPayload))
        .then(r => {
          if (r?.error) notify("Lỗi: " + r.error, false);
          else { reloadItems(containerId); notify("Đã thêm mặt hàng"); }
        }).catch(e => notify("Lỗi kết nối: " + e.message, false));
    } else {
      setItems(p => ({ ...p, [containerId]: (p[containerId] || []).map(x => x.id === itemEd ? { ...x, ...itemPayload } : x) }));
      if (useAPI) import('../api.js').then(api => api.updateContainerItem(itemEd, itemPayload)
        .then(r => notify(r?.error ? ("Lỗi: " + r.error) : "Đã cập nhật", !r?.error))
        .catch(e => notify("Lỗi kết nối: " + e.message, false)));
    }
    setItemEd(null);
  };

  const delItem = (containerId, itemId) => {
    setItems(p => ({ ...p, [containerId]: (p[containerId] || []).filter(x => x.id !== itemId) }));
    if (useAPI) import('../api.js').then(api => api.deleteContainerItem(itemId)
      .then(r => notify(r?.error ? ("Lỗi: " + r.error) : "Đã xóa", !r?.error))
      .catch(e => notify("Lỗi kết nối: " + e.message, false)));
  };

  // ── New item rows trong form tạo mới ──
  const newItemEmpty = (cargoType) => ({
    _id: Date.now() + Math.random(),
    woodId: cargoType === "sawn" ? (wts[0]?.id || "") : "",
    rawWoodTypeId: cargoType !== "sawn" ? (rawWoodTypes.find(r => r.woodForm === (cargoType === "raw_box" ? "box" : "round"))?.id || "") : "",
    thickness: "", pieceCount: "", quality: "", volume: "", notes: "",
  });
  const addNewItemRow    = () => setNewItems(p => [...p, newItemEmpty(fm.cargoType)]);
  const updateNewItem    = (idx, f, v) => setNewItems(p => p.map((x, i) => i === idx ? { ...x, [f]: v } : x));
  const removeNewItem    = (idx) => setNewItems(p => p.filter((_, i) => i !== idx));

  // ── Sort & filter ──
  // Helper: lấy tên loại gỗ cho container (từ items hoặc rawWoodTypeId)
  const getContWoodLabel = (c) => {
    if (c.rawWoodTypeId) {
      const r = rawWoodTypes.find(x => x.id === c.rawWoodTypeId);
      return r ? `${r.icon || ''} ${r.name}` : '';
    }
    const ci = items[c.id];
    if (!ci?.length) return '';
    const woodId = ci[0].woodId || ci[0].rawWoodTypeId;
    if (!woodId) return '';
    const w = wts.find(x => x.id === woodId) || rawWoodTypes.find(x => x.id === woodId);
    return w ? `${w.icon || ''} ${w.name}` : '';
  };
  // Helper: số cây/kiện từ items
  const getContPieceCount = (c) => {
    const ci = items[c.id];
    return ci ? ci.reduce((s, i) => s + (i.pieceCount || 0), 0) : null;
  };

  const visContainers = useMemo(() => {
    let arr = [...containers];
    if (filterCargoType) arr = arr.filter(c => c.cargoType === filterCargoType);
    if (filterStatus)    arr = arr.filter(c => {
      const isRaw = c.cargoType === 'raw_round' || c.cargoType === 'raw_box';
      const invSum = isRaw ? (inspSummary[c.id] || null) : null;
      return getCargoStatus({ container: c, inspSummary: invSum }) === filterStatus;
    });
    if (filterShipment)  arr = arr.filter(c => c.shipmentId ? String(c.shipmentId) === filterShipment : filterShipment === '__none__');
    if (filterNcc)       arr = arr.filter(c => (c.nccId || '') === filterNcc);
    if (filterWoodType)  arr = arr.filter(c => {
      if (c.rawWoodTypeId) return c.rawWoodTypeId === filterWoodType;
      const ci = items[c.id];
      return ci?.some(i => (i.woodId || i.rawWoodTypeId) === filterWoodType);
    });
    return applySort(arr, (item, field) => {
      const v = item[field];
      if (field === "totalVolume") return v || 0;
      if (field === "shipmentId") {
        const s = shipments.find(x => x.id === item.shipmentId);
        return s?.name || s?.shipmentCode || '';
      }
      if (field === "nccId") {
        const s = suppliers.find(x => x.nccId === item.nccId);
        return s?.name || '';
      }
      return v ?? "";
    });
  }, [containers, filterCargoType, filterStatus, filterShipment, filterNcc, filterWoodType, applySort, shipments, suppliers, items, rawWoodTypes, wts]);

  const hasFilters = filterCargoType || filterStatus || filterShipment || filterNcc || filterWoodType;
  const newItemsTotal = newItems.reduce((s, x) => s + (parseFloat(x.volume) || 0), 0);
  const isSawn       = fm.cargoType === "sawn";
  const rawTypesForForm = rawWoodTypes.filter(r => r.woodForm === (fm.cargoType === "raw_box" ? "box" : "round"));

  if (loadingList) return <div style={{ padding: 40, textAlign: "center", color: "var(--tm)" }}>Đang tải...</div>;

  const inp  = { width: "100%", padding: "7px 10px", borderRadius: 6, border: "1.5px solid var(--bd)", fontSize: "0.8rem", outline: "none", boxSizing: "border-box", background: "var(--bgc)" };
  const lbl  = { display: "block", fontSize: "0.68rem", fontWeight: 700, color: "var(--brl)", marginBottom: 3 };
  const ths  = { padding: "8px 10px", textAlign: "left", background: "var(--bgh)", color: "var(--brl)", fontWeight: 700, fontSize: "0.65rem", textTransform: "uppercase", borderBottom: "2px solid var(--bds)", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none", transition: "all 0.12s" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "var(--br)" }}>📦 Container</h2>
        {ce && <button onClick={openNew} style={{ padding: "7px 16px", borderRadius: 7, background: "var(--ac)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>+ Thêm</button>}
      </div>

      {/* Filter bar — cargo type toggle + clear */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
        <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1.5px solid var(--bd)" }}>
          {[{ value: "", label: "Tất cả" }, ...CARGO_TYPES.map(t => ({ value: t.value, label: `${t.icon} ${t.label}` }))].map(opt => (
            <button key={opt.value} onClick={() => setFilterCargoType(opt.value)}
              style={{ padding: "4px 9px", border: "none", cursor: "pointer", fontSize: "0.7rem", fontWeight: filterCargoType === opt.value ? 700 : 500, background: filterCargoType === opt.value ? "var(--ac)" : "var(--bgc)", color: filterCargoType === opt.value ? "#fff" : "var(--ts)" }}>
              {opt.label}
            </button>
          ))}
        </div>
        {hasFilters && (
          <button onClick={() => { setFilterCargoType(""); setFilterStatus(""); setFilterShipment(""); setFilterNcc(""); setFilterWoodType(""); }}
            style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontSize: "0.72rem" }}>✕ Xóa lọc</button>
        )}
        <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "var(--tm)" }}>{visContainers.length} container</span>
      </div>

      {/* Form thêm/sửa */}
      {ed != null && (
        <div style={{ padding: 16, borderRadius: 10, background: "var(--bgc)", border: "1.5px solid var(--ac)", marginBottom: 14 }}>
          <div style={{ fontSize: "0.84rem", fontWeight: 700, color: "var(--br)", marginBottom: 12 }}>
            {ed === "new" ? "Thêm container mới" : "Chỉnh sửa container"}
          </div>

          {/* Hàng 1: mã cont + loại hàng */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={lbl}>Mã container *</label>
              <input value={fm.containerCode}
                onChange={e => { setFm(p => ({ ...p, containerCode: e.target.value })); setFmErr(p => ({ ...p, containerCode: "" })); }}
                placeholder="VD: CONT2025001"
                style={{ ...inp, borderColor: fmErr.containerCode ? "var(--dg)" : "var(--bd)" }} />
              {fmErr.containerCode && <div style={{ fontSize: "0.65rem", color: "var(--dg)", marginTop: 2 }}>{fmErr.containerCode}</div>}
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label style={lbl}>Loại hàng hóa</label>
              <div style={{ display: "flex", gap: 4 }}>
                {CARGO_TYPES.map(ct => (
                  <button key={ct.value} onClick={() => setFm(p => ({ ...p, cargoType: ct.value, }))}
                    style={{ flex: 1, padding: "7px 4px", borderRadius: 6, border: `1.5px solid ${fm.cargoType === ct.value ? ct.color : "var(--bd)"}`, background: fm.cargoType === ct.value ? ct.bg : "transparent", color: fm.cargoType === ct.value ? ct.color : "var(--ts)", cursor: "pointer", fontSize: "0.72rem", fontWeight: fm.cargoType === ct.value ? 700 : 500, whiteSpace: "nowrap" }}>
                    {ct.icon} {ct.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Hàng 2: thuộc lô / standalone */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10, alignItems: "flex-end" }}>
            <div style={{ flex: 2, minWidth: 200 }}>
              <label style={lbl}>Thuộc lô hàng</label>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <select value={fm.isStandalone ? "__standalone__" : (fm.shipmentId || "")}
                  onChange={e => {
                    if (e.target.value === "__standalone__") setFm(p => ({ ...p, isStandalone: true, shipmentId: "" }));
                    else onShipmentChange(e.target.value);
                  }}
                  style={{ ...inp, flex: 1 }} disabled={!ce}>
                  <option value="">— Chọn lô —</option>
                  <option value="__standalone__">📦 Hàng lẻ (không theo lô)</option>
                  {shipments.map(s => <option key={s.id} value={s.id}>{s.shipmentCode} — {s.status}{s.nccId ? ` · ${s.nccId}` : ""}</option>)}
                </select>
                {fm.isStandalone && <span style={{ fontSize: "0.7rem", padding: "3px 8px", borderRadius: 5, background: "rgba(242,101,34,0.1)", color: "var(--ac)", fontWeight: 700, whiteSpace: "nowrap" }}>Lẻ</span>}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 150 }}>
              <label style={lbl}>Nhà cung cấp {!fm.isStandalone && fm.shipmentId ? "(từ lô)" : ""}</label>
              <select value={fm.nccId} onChange={e => setFm(p => ({ ...p, nccId: e.target.value }))}
                style={{ ...inp }} disabled={!ce || (!fm.isStandalone && !!fm.shipmentId)}>
                <option value="">— Chọn NCC —</option>
                {suppliers.map(s => <option key={s.id} value={s.nccId}>{s.name}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 130 }}>
              <label style={lbl}>Ngày về</label>
              <input type="date" value={fm.arrivalDate} onChange={e => setFm(p => ({ ...p, arrivalDate: e.target.value }))} style={inp} />
            </div>
            {ed !== "new" && (
              <div style={{ flex: 1, minWidth: 100 }}>
                <label style={lbl}>Tổng KL ({fm.weightUnit === 'ton' ? 'tấn' : 'm³'})</label>
                <input type="number" step="0.001" value={fm.totalVolume} onChange={e => setFm(p => ({ ...p, totalVolume: e.target.value }))} placeholder="0.000" style={inp} />
              </div>
            )}
          </div>

          {/* Hàng 2b: loại nguyên liệu + đơn vị — chỉ hiện với gỗ tròn/hộp */}
          {(fm.cargoType === "raw_round" || fm.cargoType === "raw_box") && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10, alignItems: "flex-end" }}>
              <div style={{ flex: 2, minWidth: 200 }}>
                <label style={lbl}>Loại gỗ nguyên liệu *</label>
                <select value={fm.rawWoodTypeId} onChange={e => setFm(p => ({ ...p, rawWoodTypeId: e.target.value }))} style={inp} disabled={!ce}>
                  <option value="">— Chọn loại gỗ —</option>
                  {rawWoodTypes
                    .filter(rwt => fm.cargoType === "raw_round" ? rwt.woodForm === "round" : rwt.woodForm === "box")
                    .map(rwt => <option key={rwt.id} value={rwt.id}>{rwt.icon || ''} {rwt.name}</option>)}
                </select>
              </div>
            </div>
          )}
          {(fm.cargoType === "raw_round" || fm.cargoType === "raw_box") && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10, alignItems: "flex-end" }}>
              <div>
                <label style={lbl}>Đơn vị đo</label>
                <div style={{ display: "flex", gap: 4 }}>
                  {[{ v: "m3", l: "m³ (khối)" }, { v: "ton", l: "Tấn" }].map(opt => (
                    <button key={opt.v} onClick={() => setFm(p => ({ ...p, weightUnit: opt.v }))}
                      style={{ padding: "6px 14px", borderRadius: 6, border: `1.5px solid ${fm.weightUnit === opt.v ? "var(--br)" : "var(--bd)"}`, background: fm.weightUnit === opt.v ? "rgba(90,62,43,0.1)" : "transparent", color: fm.weightUnit === opt.v ? "var(--br)" : "var(--ts)", cursor: "pointer", fontSize: "0.74rem", fontWeight: fm.weightUnit === opt.v ? 700 : 500 }}>
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>
              {fm.weightUnit === "ton" && (
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label style={lbl}>Hệ số quy đổi (1 tấn = ? m³)</label>
                  <input type="number" step="0.01" min="0" value={fm.tonToM3Factor} onChange={e => setFm(p => ({ ...p, tonToM3Factor: e.target.value }))}
                    placeholder="VD: 1.35" style={inp} />
                  {fm.tonToM3Factor && fm.totalVolume && (
                    <div style={{ fontSize: "0.65rem", color: "var(--ts)", marginTop: 2 }}>
                      ≈ {(parseFloat(fm.totalVolume) * parseFloat(fm.tonToM3Factor)).toFixed(2)} m³
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Hàng 3: ghi chú + tổng KL tự tính */}
          <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Ghi chú</label>
              <input value={fm.notes} onChange={e => setFm(p => ({ ...p, notes: e.target.value }))} placeholder="Ghi chú (tùy chọn)" style={inp} />
            </div>
            {ed === "new" && newItems.length > 0 && (
              <div style={{ minWidth: 130 }}>
                <label style={lbl}>Tổng KL (tự tính)</label>
                <div style={{ padding: "7px 10px", borderRadius: 6, border: "1.5px solid var(--bds)", background: "var(--bgs)", fontSize: "0.88rem", fontWeight: 800, color: "var(--br)" }}>{newItemsTotal.toFixed(3)} {fm.weightUnit === 'ton' ? 'tấn' : 'm³'}</div>
              </div>
            )}
          </div>

          {/* Chi tiết hàng hóa (chỉ khi tạo mới) */}
          {ed === "new" && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase" }}>
                  Chi tiết hàng hóa — {cargoInfo(fm.cargoType).icon} {cargoInfo(fm.cargoType).label} {newItems.length > 0 && `(${newItems.length})`}
                </span>
                <button onClick={addNewItemRow} style={{ padding: "4px 12px", borderRadius: 5, background: "var(--br)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.72rem" }}>+ Thêm dòng</button>
              </div>

              {newItems.length === 0
                ? <div style={{ padding: "10px 12px", borderRadius: 6, border: "1.5px dashed var(--bd)", background: "var(--bgs)", textAlign: "center", color: "var(--tm)", fontSize: "0.76rem" }}>Bấm "+ Thêm dòng" để thêm hàng hóa</div>
                : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "max-content", minWidth: "100%", borderCollapse: "collapse", fontSize: "0.76rem" }}>
                      <thead>
                        <tr>
                          {(isSawn
                            ? ["Loại gỗ (xẻ)", "Độ dày", "Chất lượng", "KL (m³)", "Ghi chú", ""]
                            : ["Loại gỗ", "Số cây/hộp", "Chất lượng", "KL (m³)", "Ghi chú", ""]
                          ).map((h, i) => (
                            <th key={i} style={{ padding: "5px 8px", textAlign: "left", background: "var(--bgs)", color: "var(--brl)", fontWeight: 700, fontSize: "0.62rem", textTransform: "uppercase", borderBottom: "1px solid var(--bds)", whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {newItems.map((item, idx) => {
                          const qualityVals    = isSawn ? (cfg[item.woodId]?.attrValues?.quality || []) : [];
                          const thicknessVals  = isSawn ? (cfg[item.woodId]?.attrValues?.thickness || []) : [];
                          const cellS = { padding: "4px 6px", borderBottom: "1px solid var(--bd)" };
                          const iS    = { padding: "5px 7px", borderRadius: 5, border: "1.5px solid var(--bd)", fontSize: "0.76rem", outline: "none", boxSizing: "border-box", background: "var(--bgc)" };
                          return (
                            <tr key={item._id} style={{ background: idx % 2 ? "var(--bgs)" : "#fff" }}>
                              {/* Loại gỗ */}
                              <td style={cellS}>
                                {isSawn
                                  ? <select value={item.woodId} onChange={e => updateNewItem(idx, "woodId", e.target.value)}
                                      style={{ ...iS, minWidth: 130 }}>
                                      {wts.map(w => <option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
                                    </select>
                                  : <select value={item.rawWoodTypeId} onChange={e => updateNewItem(idx, "rawWoodTypeId", e.target.value)}
                                      style={{ ...iS, minWidth: 130 }}>
                                      <option value="">— Chọn —</option>
                                      {rawTypesForForm.map(r => <option key={r.id} value={r.id}>{r.icon} {r.name}</option>)}
                                    </select>
                                }
                              </td>
                              {/* Dày / Số cây */}
                              <td style={cellS}>
                                {isSawn
                                  ? (thicknessVals.length > 0
                                    ? <select value={item.thickness} onChange={e => updateNewItem(idx, "thickness", e.target.value)} style={{ ...iS, minWidth: 70 }}>
                                        <option value="">—</option>
                                        {thicknessVals.map(v => <option key={v} value={v}>{v}</option>)}
                                      </select>
                                    : <input value={item.thickness} onChange={e => updateNewItem(idx, "thickness", e.target.value)} placeholder="VD: 2F" style={{ ...iS, width: 70 }} />)
                                  : <input type="number" min="1" value={item.pieceCount} onChange={e => updateNewItem(idx, "pieceCount", e.target.value)} placeholder="SL" style={{ ...iS, width: 70, textAlign: "right" }} />
                                }
                              </td>
                              {/* Chất lượng */}
                              <td style={cellS}>
                                {isSawn && qualityVals.length > 0
                                  ? <select value={item.quality} onChange={e => updateNewItem(idx, "quality", e.target.value)} style={{ ...iS, minWidth: 90 }}>
                                      <option value="">—</option>
                                      {qualityVals.map(v => <option key={v} value={v}>{v}</option>)}
                                    </select>
                                  : <input value={item.quality} onChange={e => updateNewItem(idx, "quality", e.target.value)} placeholder="CL" style={{ ...iS, width: 70 }} />
                                }
                              </td>
                              {/* KL */}
                              <td style={cellS}>
                                <input type="number" step="0.001" value={item.volume} onChange={e => updateNewItem(idx, "volume", e.target.value)} placeholder="0.000"
                                  style={{ ...iS, width: 80, textAlign: "right" }} />
                              </td>
                              {/* Ghi chú */}
                              <td style={cellS}>
                                <input value={item.notes} onChange={e => updateNewItem(idx, "notes", e.target.value)} placeholder="Ghi chú"
                                  style={{ ...iS, width: 120 }} />
                              </td>
                              <td style={cellS}>
                                <button onClick={() => removeNewItem(idx)} style={{ width: 24, height: 24, padding: 0, borderRadius: 4, border: "1px solid var(--dg)", background: "transparent", color: "var(--dg)", cursor: "pointer", fontSize: "0.75rem" }}>✕</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {newItems.length > 0 && (
                        <tfoot>
                          <tr>
                            <td colSpan={3} style={{ padding: "5px 8px", textAlign: "right", fontWeight: 700, fontSize: "0.7rem", color: "var(--brl)", borderTop: "2px solid var(--bds)" }}>Tổng:</td>
                            <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 800, color: "var(--br)", fontSize: "0.76rem", borderTop: "2px solid var(--bds)" }}>
                              {newItemsTotal.toFixed(3)} {fm.weightUnit === 'ton' ? 'tấn' : 'm³'}
                            </td>
                            <td colSpan={2} style={{ borderTop: "2px solid var(--bds)" }} />
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                )
              }
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => { setEd(null); setFmErr({}); setNewItems([]); }} style={{ padding: "7px 16px", borderRadius: 7, background: "transparent", color: "var(--ts)", border: "1.5px solid var(--bd)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>Hủy</button>
            <button onClick={sv} style={{ padding: "7px 20px", borderRadius: 7, background: "var(--ac)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>Lưu</button>
          </div>
        </div>
      )}

      {/* Danh sách containers */}
      <div style={{ background: "var(--bgc)", borderRadius: 10, border: "1px solid var(--bd)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
          <thead>
            {/* Inline filter row */}
            {(() => {
              const fS = { width: '100%', fontSize: '0.76rem', padding: '4px 8px', borderRadius: 4, border: '1px solid var(--bd)', outline: 'none' };
              const td = { padding: '5px 6px' };
              const shipmentOpts = [...new Set(containers.map(c => c.shipmentId).filter(Boolean))];
              const nccOpts = [...new Set(containers.map(c => c.nccId).filter(Boolean))];
              const woodOpts = [...new Set(containers.flatMap(c => {
                if (c.rawWoodTypeId) return [c.rawWoodTypeId];
                const ci = items[c.id];
                return ci ? ci.map(i => i.woodId || i.rawWoodTypeId).filter(Boolean) : [];
              }))];
              return (
                <tr style={{ background: 'var(--bgs)' }}>
                  {/* # — no filter */}
                  <td style={td} />
                  {/* Mã container — no filter */}
                  <td style={td} />
                  {/* Lô hàng */}
                  <td style={td}><select value={filterShipment} onChange={e => setFilterShipment(e.target.value)} style={fS}>
                    <option value="">Tất cả</option>
                    <option value="__none__">Không có lô</option>
                    {shipmentOpts.map(id => { const s = shipments.find(x => x.id === id); return <option key={id} value={id}>{s?.name || s?.shipmentCode || id}</option>; })}
                  </select></td>
                  {/* NCC */}
                  <td style={td}><select value={filterNcc} onChange={e => setFilterNcc(e.target.value)} style={fS}>
                    <option value="">Tất cả</option>
                    {nccOpts.map(id => { const s = suppliers.find(x => x.nccId === id); return <option key={id} value={id}>{s?.name || id}</option>; })}
                  </select></td>
                  {/* Loại gỗ */}
                  <td style={td}><select value={filterWoodType} onChange={e => setFilterWoodType(e.target.value)} style={fS}>
                    <option value="">Tất cả</option>
                    {woodOpts.map(id => { const w = wts.find(x => x.id === id) || rawWoodTypes.find(x => x.id === id); return <option key={id} value={id}>{w ? `${w.icon || ''} ${w.name}` : id}</option>; })}
                  </select></td>
                  {/* Số cây — no filter */}
                  <td style={td} />
                  {/* Tổng KL — no filter */}
                  <td style={td} />
                  {/* Trạng thái */}
                  <td style={td}><select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={fS}>
                    <option value="">Tất cả</option>
                    {Object.entries(INV_STATUS).filter(([k]) => k !== 'no_inspection').map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select></td>
                  {/* Ghi chú — no filter */}
                  <td style={td} />
                  {/* Ngày về — no filter */}
                  <td style={td} />
                  {ce && !addOnly && <td style={td} />}
                </tr>
              );
            })()}
            <tr style={{ background: "var(--bgs)" }}>
              <th onClick={() => toggleSort("containerCode")} style={ths}>Mã container {sortIcon("containerCode")}</th>
              <th onClick={() => toggleSort("shipmentId")} style={ths}>Lô hàng {sortIcon("shipmentId")}</th>
              <th onClick={() => toggleSort("nccId")} style={ths}>NCC {sortIcon("nccId")}</th>
              <th style={{ ...ths, cursor: "default" }}>Loại gỗ</th>
              <th style={{ ...ths, cursor: "default", textAlign: "right" }}>Số cây</th>
              <th onClick={() => toggleSort("totalVolume")} style={{ ...ths, textAlign: "right" }}>Tổng KL {sortIcon("totalVolume")}</th>
              <th onClick={() => toggleSort("status")} style={ths}>Trạng thái {sortIcon("status")}</th>
              <th style={{ ...ths, cursor: "default" }}>Ghi chú</th>
              <th onClick={() => toggleSort("arrivalDate")} style={ths}>Ngày về {sortIcon("arrivalDate")}</th>
              {ce && !addOnly && <th style={{ ...ths, width: 90, cursor: "default" }}></th>}
            </tr>
          </thead>
          <tbody>
            {visContainers.length === 0 && (
              <tr><td colSpan={ce && !addOnly ? 10 : 9} style={{ padding: 24, textAlign: "center", color: "var(--tm)" }}>Chưa có container nào</td></tr>
            )}
            {visContainers.map((c, ci) => {
              const sup    = suppliers.find(s => s.nccId === c.nccId);
              const sh     = shipments.find(s => s.id === c.shipmentId);
              const isExp  = expId === c.id;
              const ct     = cargoInfo(c.cargoType);
              // Inventory status (chỉ raw_round / raw_box)
              const isRaw  = c.cargoType === 'raw_round' || c.cargoType === 'raw_box';
              const invSum = isRaw ? (inspSummary[c.id] || null) : null;
              const cargoKey = getCargoStatus({ container: c, inspSummary: invSum });
              const cargoCfg = INV_STATUS[cargoKey] || INV_STATUS.incoming;
              const woodLabel = getContWoodLabel(c);
              const pieceCount = getContPieceCount(c);
              const bdBot = "1px solid var(--bd)";
              const tdP = { padding: "7px 10px", borderBottom: bdBot, whiteSpace: "nowrap" };
              return (
                <tr key={c.id} data-clickable="true" style={{ background: ci % 2 ? "var(--bgs)" : "#fff", cursor: "pointer" }}
                  onClick={() => { toggleExp(c.id); }}>
                  {/* Mã container */}
                  <td style={{ ...tdP, fontWeight: 700, color: "var(--br)" }}>
                    📦 {c.containerCode}
                    {c.isStandalone && <span style={{ marginLeft: 5, fontSize: "0.6rem", padding: "1px 4px", borderRadius: 3, background: "rgba(242,101,34,0.12)", color: "var(--ac)", fontWeight: 700 }}>LẺ</span>}
                    {c.notes && <div style={{ fontSize: "0.65rem", color: "var(--tm)", fontWeight: 400, marginTop: 1 }}>{c.notes}</div>}
                  </td>
                  {/* Lô hàng */}
                  <td style={{ ...tdP, fontSize: "0.74rem" }}>
                    {sh ? <><span style={{ fontWeight: 600, color: "var(--br)" }}>{sh.name || sh.shipmentCode}</span>{sh.name && <div style={{ fontSize: "0.6rem", color: "var(--tm)", fontFamily: "monospace" }}>{sh.shipmentCode}</div>}</> : <span style={{ color: "var(--tm)" }}>—</span>}
                  </td>
                  {/* NCC */}
                  <td style={{ ...tdP, color: "var(--ts)" }}>
                    {sup ? sup.name : (c.nccId || "—")}
                  </td>
                  {/* Loại gỗ */}
                  <td style={{ ...tdP, fontWeight: 600 }}>
                    {woodLabel || <span style={{ color: "var(--tm)" }}>—</span>}
                  </td>
                  {/* Số cây/kiện */}
                  <td style={{ ...tdP, textAlign: "right", fontWeight: 600 }}>
                    {pieceCount != null && pieceCount > 0 ? pieceCount : "—"}
                  </td>
                  {/* Tổng KL */}
                  <td style={{ ...tdP, textAlign: "right", fontWeight: 700, color: "var(--br)" }}>
                    {c.totalVolume != null ? `${c.totalVolume.toFixed(3)} ${c.weightUnit === 'ton' ? 'tấn' : 'm³'}` : "—"}
                  </td>
                  {/* Trạng thái hàng hóa — auto */}
                  <td style={tdP}>
                    <span style={{ padding: "2px 8px", borderRadius: 5, background: cargoCfg.bg, color: cargoCfg.color, fontSize: "0.7rem", fontWeight: 700 }}>
                      {cargoCfg.label}
                    </span>
                    {invSum && cargoKey !== 'not_inspected' && cargoKey !== 'incoming' && (
                      <div style={{ fontSize: "0.6rem", marginTop: 2 }}>
                        {invSum.available > 0 && <span style={{ color: "var(--gn)" }}>{invSum.available} còn </span>}
                        {invSum.on_order > 0 && <span style={{ color: "#8E44AD" }}>{invSum.on_order} đơn </span>}
                        {invSum.sawn > 0 && <span style={{ color: "#2980b9" }}>{invSum.sawn} xẻ </span>}
                        {invSum.sold > 0 && <span style={{ color: "#8B5E3C" }}>{invSum.sold} bán</span>}
                      </div>
                    )}
                  </td>
                  {/* Ghi chú */}
                  <td title={c.notes || ''} style={{ ...tdP, color: "var(--tm)", fontSize: "0.72rem", whiteSpace: "normal", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {c.notes || ""}
                  </td>
                  {/* Ngày về */}
                  <td style={{ ...tdP, color: "var(--ts)" }}>
                    {c.arrivalDate || "—"}
                  </td>
                  {ce && !addOnly && (
                    <td style={{ ...tdP }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: 5 }}>
                        <button onClick={() => openEdit(c)} style={{ padding: "3px 8px", borderRadius: 4, background: "transparent", color: "var(--ac)", border: "1px solid var(--ac)", cursor: "pointer", fontWeight: 600, fontSize: "0.68rem" }}>Sửa</button>
                        <button onClick={() => del(c)} style={{ padding: "3px 8px", borderRadius: 4, background: "transparent", color: "var(--dg)", border: "1px solid var(--dg)", cursor: "pointer", fontWeight: 600, fontSize: "0.68rem" }}>Xóa</button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Dialog chi tiết container */}
      {expId && (() => {
        const c = visContainers.find(x => x.id === expId);
        if (!c) return null;
        const ct = cargoInfo(c.cargoType);
        return (
          <Dialog open={true} onClose={() => { setExpId(null); setItemEd(null); }} title={`${ct.icon} ${c.containerCode} — ${ct.label}`} width={720} noEnter maxHeight="90vh">
            <ContainerDetail
              c={c} cItems={items[c.id]} ct={ct}
              wts={wts} rawWoodTypes={rawWoodTypes} cfg={cfg}
              ce={ce && !addOnly}
              itemEd={itemEd} setItemEd={setItemEd}
              itemFm={itemFm} setItemFm={setItemFm}
              openItemNew={openItemNew} openItemEdit={openItemEdit}
              saveItem={saveItem} delItem={delItem}
              isAdmin={ce && !addOnly} notify={notify}
            />
          </Dialog>
        );
      })()}

      {/* Dialog xác nhận xóa container */}
      <Dialog open={!!confirmDel} onClose={() => setConfirmDel(null)} onOk={confirmDelete} title="Xác nhận xóa" width={400}>
        <p style={{ margin: "0 0 16px", fontSize: "0.82rem", lineHeight: 1.6 }}>
          Bạn có chắc muốn xóa container <b>{confirmDel?.containerCode}</b>?
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={() => setConfirmDel(null)} style={{ padding: "7px 18px", borderRadius: 6, border: "1px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>Hủy</button>
          <button onClick={confirmDelete} style={{ padding: "7px 18px", borderRadius: 6, border: "none", background: "var(--dg)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>Xóa</button>
        </div>
      </Dialog>
    </div>
  );
}

/* ── Giá bán container (admin) ── */
function ContainerSalePrice({ c, notify }) {
  const [editing, setEditing] = React.useState(false);
  const [price, setPrice] = React.useState(c.saleUnitPrice != null ? String(c.saleUnitPrice) : '');
  const [notes, setNotes] = React.useState(c.saleNotes || '');
  const [saving, setSaving] = React.useState(false);
  const unitLabel = c.weightUnit === 'ton' ? 'tấn' : 'm³';
  const vol = parseFloat(c.totalVolume) || 0;
  const p = parseFloat(price) || 0;

  const handleSave = async () => {
    setSaving(true);
    const { updateContainerSalePrice } = await import('../api.js');
    const r = await updateContainerSalePrice(c.id, p || null, notes.trim() || null);
    setSaving(false);
    if (r.error) { notify(r.error, false); return; }
    notify('Đã lưu giá bán container');
    setEditing(false);
    c.saleUnitPrice = p || null;
    c.saleNotes = notes.trim() || null;
  };

  return (
    <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 7, background: 'rgba(142,68,173,0.04)', border: '1px solid rgba(142,68,173,0.15)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: editing ? 8 : 0 }}>
        <span style={{ fontSize: '0.64rem', fontWeight: 700, color: '#8E44AD', textTransform: 'uppercase' }}>Giá bán nguyên container</span>
        {!editing && (
          <button onClick={() => setEditing(true)} style={{ padding: '2px 10px', borderRadius: 4, border: '1px solid #8E44AD', background: 'transparent', color: '#8E44AD', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 600 }}>
            {c.saleUnitPrice != null ? '✏ Sửa' : '+ Định giá'}
          </button>
        )}
      </div>
      {!editing && c.saleUnitPrice != null && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', marginTop: 4 }}>
          <span style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--br)' }}>{c.saleUnitPrice} tr/{unitLabel}</span>
          {vol > 0 && <span style={{ fontSize: '0.76rem', color: 'var(--ts)' }}>= {(c.saleUnitPrice * vol).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}tr tổng</span>}
          {c.saleNotes && <span style={{ fontSize: '0.72rem', color: 'var(--tm)', fontStyle: 'italic' }}>{c.saleNotes}</span>}
        </div>
      )}
      {!editing && c.saleUnitPrice == null && (
        <div style={{ fontSize: '0.72rem', color: 'var(--tm)', fontStyle: 'italic', marginTop: 2 }}>Chưa định giá</div>
      )}
      {editing && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="number" step="0.1" value={price} onChange={e => setPrice(e.target.value)} autoFocus placeholder="VD: 8.0"
            style={{ width: 90, padding: '5px 8px', borderRadius: 5, border: '1.5px solid #8E44AD', fontSize: '0.82rem', textAlign: 'right', outline: 'none', fontWeight: 700 }} />
          <span style={{ fontSize: '0.76rem', color: 'var(--tm)' }}>tr/{unitLabel}</span>
          {p > 0 && vol > 0 && <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--br)' }}>= {Math.round(p * vol * 1000000).toLocaleString('vi-VN')}đ</span>}
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ghi chú giá..."
            style={{ flex: 1, minWidth: 120, padding: '5px 8px', borderRadius: 5, border: '1.5px solid var(--bd)', fontSize: '0.76rem', outline: 'none' }} />
          <button onClick={handleSave} disabled={saving} style={{ padding: '5px 12px', borderRadius: 5, border: 'none', background: '#8E44AD', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.72rem' }}>{saving ? '...' : 'Lưu'}</button>
          <button onClick={() => setEditing(false)} style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontSize: '0.72rem' }}>Hủy</button>
        </div>
      )}
    </div>
  );
}

/* ── Chi tiết container (expanded) ── */
function ContainerDetail({ c, cItems, ct, wts, rawWoodTypes, cfg, ce, itemEd, setItemEd, itemFm, setItemFm, openItemNew, openItemEdit, saveItem, delItem, isAdmin, notify }) {
  const isSawn = c.cargoType === "sawn" || !c.cargoType;
  const rawTypesForType = rawWoodTypes.filter(r => r.woodForm === (c.cargoType === "raw_box" ? "box" : "round"));
  const inp = { padding: "5px 7px", borderRadius: 5, border: "1.5px solid var(--bd)", fontSize: "0.76rem", outline: "none", background: "var(--bgc)", boxSizing: "border-box" };

  return (
    <div style={{ padding: "10px 14px 12px", background: "rgba(242,101,34,0.03)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase" }}>
          {ct.icon} {ct.label} — Chi tiết hàng hóa
        </span>
        {ce && <button onClick={() => openItemNew(c)}
          style={{ padding: "3px 10px", borderRadius: 5, background: "var(--br)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.68rem" }}>+ Thêm</button>}
      </div>

      {/* Form sửa/thêm item */}
      {itemEd != null && (
        <div style={{ padding: "10px 12px", borderRadius: 7, background: "var(--bgc)", border: "1.5px solid var(--ac)", marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            {/* Loại gỗ */}
            <div style={{ flex: 2, minWidth: 130 }}>
              <label style={{ display: "block", fontSize: "0.65rem", fontWeight: 700, color: "var(--brl)", marginBottom: 2 }}>Loại gỗ</label>
              {isSawn
                ? <select value={itemFm.woodId} onChange={e => setItemFm(p => ({ ...p, woodId: e.target.value }))} style={{ ...inp, width: "100%" }}>
                    {wts.map(w => <option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
                  </select>
                : <select value={itemFm.rawWoodTypeId} onChange={e => setItemFm(p => ({ ...p, rawWoodTypeId: e.target.value }))} style={{ ...inp, width: "100%" }}>
                    <option value="">— Chọn —</option>
                    {rawTypesForType.map(r => <option key={r.id} value={r.id}>{r.icon} {r.name}</option>)}
                  </select>
              }
            </div>
            {/* Dày / Số cây */}
            {isSawn ? (
              <div style={{ minWidth: 80 }}>
                <label style={{ display: "block", fontSize: "0.65rem", fontWeight: 700, color: "var(--brl)", marginBottom: 2 }}>Độ dày</label>
                {(cfg[itemFm.woodId]?.attrValues?.thickness || []).length > 0
                  ? <select value={itemFm.thickness} onChange={e => setItemFm(p => ({ ...p, thickness: e.target.value }))} style={{ ...inp, width: 80 }}>
                      <option value="">—</option>
                      {(cfg[itemFm.woodId]?.attrValues?.thickness || []).map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  : <input value={itemFm.thickness} onChange={e => setItemFm(p => ({ ...p, thickness: e.target.value }))} placeholder="VD: 2F" style={{ ...inp, width: 80 }} />
                }
              </div>
            ) : (
              <div style={{ minWidth: 80 }}>
                <label style={{ display: "block", fontSize: "0.65rem", fontWeight: 700, color: "var(--brl)", marginBottom: 2 }}>Số cây/hộp</label>
                <input type="number" min="1" value={itemFm.pieceCount} onChange={e => setItemFm(p => ({ ...p, pieceCount: e.target.value }))} placeholder="SL" style={{ ...inp, width: 70, textAlign: "right" }} />
              </div>
            )}
            {/* CL */}
            <div style={{ minWidth: 80 }}>
              <label style={{ display: "block", fontSize: "0.65rem", fontWeight: 700, color: "var(--brl)", marginBottom: 2 }}>CL</label>
              {isSawn && (cfg[itemFm.woodId]?.attrValues?.quality || []).length > 0
                ? <select value={itemFm.quality} onChange={e => setItemFm(p => ({ ...p, quality: e.target.value }))} style={{ ...inp, width: 80 }}>
                    <option value="">—</option>
                    {(cfg[itemFm.woodId]?.attrValues?.quality || []).map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                : <input value={itemFm.quality} onChange={e => setItemFm(p => ({ ...p, quality: e.target.value }))} placeholder="CL" style={{ ...inp, width: 70 }} />
              }
            </div>
            {/* KL */}
            <div style={{ minWidth: 90 }}>
              <label style={{ display: "block", fontSize: "0.65rem", fontWeight: 700, color: "var(--brl)", marginBottom: 2 }}>KL (m³)</label>
              <input type="number" step="0.001" value={itemFm.volume} onChange={e => setItemFm(p => ({ ...p, volume: e.target.value }))} placeholder="0.000" style={{ ...inp, width: 90, textAlign: "right" }} />
            </div>
            {/* Ghi chú */}
            <div style={{ flex: 1, minWidth: 100 }}>
              <label style={{ display: "block", fontSize: "0.65rem", fontWeight: 700, color: "var(--brl)", marginBottom: 2 }}>Ghi chú</label>
              <input value={itemFm.notes} onChange={e => setItemFm(p => ({ ...p, notes: e.target.value }))} placeholder="Ghi chú" style={{ ...inp, width: "100%" }} />
            </div>
            <button onClick={() => saveItem(c.id)} style={{ padding: "6px 14px", borderRadius: 5, background: "var(--ac)", color: "#fff", border: "none", cursor: "pointer", fontSize: "0.74rem", fontWeight: 700 }}>Lưu</button>
            <button onClick={() => setItemEd(null)} style={{ padding: "6px 10px", borderRadius: 5, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontSize: "0.74rem" }}>Hủy</button>
          </div>
        </div>
      )}

      {/* Giá bán container — admin only, chỉ raw */}
      {!isSawn && isAdmin && (
        <ContainerSalePrice c={c} notify={notify} />
      )}

      {/* Items table */}
      {!cItems ? (
        <div style={{ padding: 12, textAlign: "center", color: "var(--tm)", fontSize: "0.74rem" }}>Đang tải...</div>
      ) : cItems.length === 0 ? (
        <div style={{ padding: "10px 12px", borderRadius: 6, border: "1.5px dashed var(--bd)", background: "var(--bgs)", textAlign: "center", color: "var(--tm)", fontSize: "0.74rem" }}>Chưa có hàng hóa</div>
      ) : (
        <div style={{ border: "1.5px solid var(--bd)", borderRadius: 7, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.74rem" }}>
            <thead>
              <tr style={{ background: "var(--bgh)" }}>
                <th style={{ padding: "5px 8px", textAlign: "left", color: "var(--brl)", fontWeight: 700, fontSize: "0.58rem", textTransform: "uppercase", borderBottom: "1.5px solid var(--bds)" }}>Loại gỗ</th>
                <th style={{ padding: "5px 8px", textAlign: isSawn ? "left" : "right", color: "var(--brl)", fontWeight: 700, fontSize: "0.58rem", textTransform: "uppercase", borderBottom: "1.5px solid var(--bds)" }}>{isSawn ? "Dày" : "Số cây/hộp"}</th>
                <th style={{ padding: "5px 8px", textAlign: "left", color: "var(--brl)", fontWeight: 700, fontSize: "0.58rem", textTransform: "uppercase", borderBottom: "1.5px solid var(--bds)" }}>CL</th>
                <th style={{ padding: "5px 8px", textAlign: "right", color: "var(--brl)", fontWeight: 700, fontSize: "0.58rem", textTransform: "uppercase", borderBottom: "1.5px solid var(--bds)" }}>m³</th>
                <th style={{ padding: "5px 8px", textAlign: "left", color: "var(--brl)", fontWeight: 700, fontSize: "0.58rem", textTransform: "uppercase", borderBottom: "1.5px solid var(--bds)" }}>Ghi chú</th>
                {ce && <th style={{ padding: "5px 8px", borderBottom: "1.5px solid var(--bds)", width: 60 }}></th>}
              </tr>
            </thead>
            <tbody>
              {cItems.map((item, ii) => {
                const w   = isSawn ? wts.find(x => x.id === item.woodId) : rawWoodTypes.find(x => x.id === item.rawWoodTypeId);
                return (
                  <tr key={item.id} style={{ background: ii % 2 ? "var(--bgs)" : "#fff" }}>
                    <td style={{ padding: "5px 8px", borderBottom: "1px solid var(--bd)", whiteSpace: "nowrap" }}>{w ? `${w.icon || ""} ${w.name}` : "—"}</td>
                    <td style={{ padding: "5px 8px", borderBottom: "1px solid var(--bd)", textAlign: isSawn ? "left" : "right", whiteSpace: "nowrap" }}>
                      {isSawn ? (item.thickness || "—") : (item.pieceCount != null ? `${item.pieceCount} cây` : "—")}
                    </td>
                    <td style={{ padding: "5px 8px", borderBottom: "1px solid var(--bd)", whiteSpace: "nowrap" }}>{item.quality || "—"}</td>
                    <td style={{ padding: "5px 8px", borderBottom: "1px solid var(--bd)", textAlign: "right", fontWeight: 600, whiteSpace: "nowrap" }}>{item.volume != null ? item.volume.toFixed(3) : "—"}</td>
                    <td style={{ padding: "5px 8px", borderBottom: "1px solid var(--bd)", color: "var(--tm)" }}>{item.notes || ""}</td>
                    {ce && (
                      <td style={{ padding: "5px 8px", borderBottom: "1px solid var(--bd)", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={() => openItemEdit(item)} style={{ padding: "2px 5px", borderRadius: 3, border: "1px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontSize: "0.62rem" }}>✎</button>
                          <button onClick={() => delItem(c.id, item.id)} style={{ padding: "2px 5px", borderRadius: 3, border: "1px solid var(--dg)", background: "transparent", color: "var(--dg)", cursor: "pointer", fontSize: "0.62rem" }}>✕</button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: "var(--bgh)" }}>
                <td colSpan={3} style={{ padding: "5px 8px", textAlign: "right", fontWeight: 700, fontSize: "0.66rem", color: "var(--brl)", borderTop: "2px solid var(--bds)" }}>
                  Tổng ({cItems.length}):
                </td>
                <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 800, color: "var(--br)", fontSize: "0.76rem", borderTop: "2px solid var(--bds)" }}>
                  {cItems.reduce((s, x) => s + (x.volume || 0), 0).toFixed(3)} {c.weightUnit === 'ton' ? 'tấn' : 'm³'}
                </td>
                <td colSpan={ce ? 2 : 1} style={{ borderTop: "2px solid var(--bds)" }} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
