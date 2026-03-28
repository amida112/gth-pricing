import React, { useState, useEffect, useMemo } from "react";
import { CONTAINER_STATUSES } from "./PgNCC";
import { INV_STATUS, getContainerInvStatus } from "../utils";

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
  const [expId, setExpId]           = useState(null);
  const [ed, setEd]                 = useState(null);
  const [fm, setFm]                 = useState(EMPTY_FM);
  const [fmErr, setFmErr]           = useState({});
  const [newItems, setNewItems]     = useState([]);
  const [itemEd, setItemEd]         = useState(null);
  const [itemFm, setItemFm]         = useState({ itemType: "sawn", woodId: "", rawWoodTypeId: "", thickness: "", pieceCount: "", quality: "", volume: "", notes: "" });
  const [filterCargoType, setFilterCargoType] = useState("");
  const [filterStatus, setFilterStatus]       = useState("");
  const [sortField, setSortField]   = useState("containerCode");
  const [sortDir, setSortDir]       = useState("asc");
  const [inspSummary, setInspSummary] = useState({}); // {contId: {total,available,sawn,sold}}

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
  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };
  const sortIcon = (field) => sortField === field ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  const visContainers = useMemo(() => {
    let arr = [...containers];
    if (filterCargoType) arr = arr.filter(c => c.cargoType === filterCargoType);
    if (filterStatus)    arr = arr.filter(c => c.status === filterStatus);
    arr.sort((a, b) => {
      let va = a[sortField] ?? ""; let vb = b[sortField] ?? "";
      if (sortField === "totalVolume") { va = va || 0; vb = vb || 0; }
      const cmp = typeof va === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [containers, filterCargoType, filterStatus, sortField, sortDir]);

  const hasFilters   = filterCargoType || filterStatus;
  const newItemsTotal = newItems.reduce((s, x) => s + (parseFloat(x.volume) || 0), 0);
  const isSawn       = fm.cargoType === "sawn";
  const rawTypesForForm = rawWoodTypes.filter(r => r.woodForm === (fm.cargoType === "raw_box" ? "box" : "round"));

  if (loadingList) return <div style={{ padding: 40, textAlign: "center", color: "var(--tm)" }}>Đang tải...</div>;

  const inp  = { width: "100%", padding: "7px 10px", borderRadius: 6, border: "1.5px solid var(--bd)", fontSize: "0.8rem", outline: "none", boxSizing: "border-box", background: "var(--bgc)" };
  const lbl  = { display: "block", fontSize: "0.68rem", fontWeight: 700, color: "var(--brl)", marginBottom: 3 };
  const ths  = { padding: "8px 10px", textAlign: "left", background: "var(--bgh)", color: "var(--brl)", fontWeight: 700, fontSize: "0.65rem", textTransform: "uppercase", borderBottom: "2px solid var(--bds)", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "var(--br)" }}>📦 Container</h2>
        {ce && <button onClick={openNew} style={{ padding: "7px 16px", borderRadius: 7, background: "var(--ac)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>+ Thêm</button>}
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
        {/* Cargo type toggle */}
        <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1.5px solid var(--bd)" }}>
          {[{ value: "", label: "Tất cả" }, ...CARGO_TYPES.map(t => ({ value: t.value, label: `${t.icon} ${t.label}` }))].map(opt => (
            <button key={opt.value} onClick={() => setFilterCargoType(opt.value)}
              style={{ padding: "4px 9px", border: "none", cursor: "pointer", fontSize: "0.7rem", fontWeight: filterCargoType === opt.value ? 700 : 500, background: filterCargoType === opt.value ? "var(--ac)" : "var(--bgc)", color: filterCargoType === opt.value ? "#fff" : "var(--ts)" }}>
              {opt.label}
            </button>
          ))}
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: "5px 8px", borderRadius: 6, border: "1.5px solid var(--bd)", fontSize: "0.74rem", background: "var(--bgc)", color: "var(--tp)", outline: "none" }}>
          <option value="">Tất cả trạng thái</option>
          {CONTAINER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {hasFilters && (
          <button onClick={() => { setFilterCargoType(""); setFilterStatus(""); }}
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
              <>
                <div style={{ flex: 1, minWidth: 100 }}>
                  <label style={lbl}>Tổng KL (m³)</label>
                  <input type="number" step="0.001" value={fm.totalVolume} onChange={e => setFm(p => ({ ...p, totalVolume: e.target.value }))} placeholder="0.000" style={inp} />
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label style={lbl}>Trạng thái</label>
                  <select value={fm.status} onChange={e => setFm(p => ({ ...p, status: e.target.value }))} style={inp}>
                    {CONTAINER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </>
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
          {fm.cargoType === "raw_round" && (
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
                <div style={{ padding: "7px 10px", borderRadius: 6, border: "1.5px solid var(--bds)", background: "var(--bgs)", fontSize: "0.88rem", fontWeight: 800, color: "var(--br)" }}>{newItemsTotal.toFixed(3)} m³</div>
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
                              {newItemsTotal.toFixed(3)} m³
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
            <tr style={{ background: "var(--bgs)" }}>
              <th onClick={() => toggleSort("containerCode")} style={ths}>Mã container {sortIcon("containerCode")}</th>
              <th style={{ ...ths, cursor: "default" }}>Loại hàng</th>
              <th onClick={() => toggleSort("nccId")} style={ths}>NCC {sortIcon("nccId")}</th>
              <th style={{ ...ths, cursor: "default" }}>Lô hàng</th>
              <th onClick={() => toggleSort("arrivalDate")} style={ths}>Ngày về {sortIcon("arrivalDate")}</th>
              <th onClick={() => toggleSort("totalVolume")} style={{ ...ths, textAlign: "right" }}>Tổng KL {sortIcon("totalVolume")}</th>
              <th onClick={() => toggleSort("status")} style={ths}>Trạng thái {sortIcon("status")}</th>
              {ce && !addOnly && <th style={{ ...ths, width: 90, cursor: "default" }}></th>}
            </tr>
          </thead>
          <tbody>
            {visContainers.length === 0 && (
              <tr><td colSpan={ce && !addOnly ? 8 : 7} style={{ padding: 24, textAlign: "center", color: "var(--tm)" }}>Chưa có container nào</td></tr>
            )}
            {visContainers.map((c, ci) => {
              const sup    = suppliers.find(s => s.nccId === c.nccId);
              const sh     = shipments.find(s => s.id === c.shipmentId);
              const isExp  = expId === c.id;
              const ct     = cargoInfo(c.cargoType);
              // Inventory status (chỉ raw_round / raw_box)
              const isRaw  = c.cargoType === 'raw_round' || c.cargoType === 'raw_box';
              const invSum = isRaw ? (inspSummary[c.id] || null) : null;
              const invKey = isRaw ? getContainerInvStatus(invSum) : null;
              const invCfg = invKey ? INV_STATUS[invKey] : null;
              return (
                <React.Fragment key={c.id}>
                  <tr style={{ background: isExp ? "var(--acbg)" : (ci % 2 ? "var(--bgs)" : "#fff"), cursor: "pointer" }}
                    onClick={() => toggleExp(c.id)}>
                    <td style={{ padding: "9px 12px", borderBottom: isExp ? "none" : "1px solid var(--bd)", fontWeight: 700, color: "var(--br)" }}>
                      <span style={{ fontSize: "0.72rem", color: isExp ? "var(--ac)" : "var(--tm)", marginRight: 6 }}>{isExp ? "▾" : "▸"}</span>
                      📦 {c.containerCode}
                      {c.isStandalone && <span style={{ marginLeft: 5, fontSize: "0.6rem", padding: "1px 4px", borderRadius: 3, background: "rgba(242,101,34,0.12)", color: "var(--ac)", fontWeight: 700 }}>LẺ</span>}
                      {c.notes && <div style={{ fontSize: "0.67rem", color: "var(--tm)", fontWeight: 400, marginTop: 2 }}>{c.notes}</div>}
                    </td>
                    <td style={{ padding: "9px 12px", borderBottom: isExp ? "none" : "1px solid var(--bd)" }}>
                      <span style={{ padding: "2px 7px", borderRadius: 5, background: ct.bg, color: ct.color, fontSize: "0.68rem", fontWeight: 700 }}>{ct.icon} {ct.label}</span>
                    </td>
                    <td style={{ padding: "9px 12px", borderBottom: isExp ? "none" : "1px solid var(--bd)", color: "var(--ts)" }}>
                      {sup ? sup.name : (c.nccId || "—")}
                    </td>
                    <td style={{ padding: "9px 12px", borderBottom: isExp ? "none" : "1px solid var(--bd)", fontSize: "0.74rem" }}>
                      {sh ? <span style={{ fontWeight: 600, color: "var(--br)" }}>{sh.shipmentCode}</span> : <span style={{ color: "var(--tm)" }}>—</span>}
                    </td>
                    <td style={{ padding: "9px 12px", borderBottom: isExp ? "none" : "1px solid var(--bd)", color: "var(--ts)" }}>
                      {c.arrivalDate || "—"}
                    </td>
                    <td style={{ padding: "9px 12px", borderBottom: isExp ? "none" : "1px solid var(--bd)", textAlign: "right", fontWeight: 600 }}>
                      {c.totalVolume != null ? `${c.totalVolume.toFixed(3)} m³` : "—"}
                    </td>
                    <td style={{ padding: "9px 12px", borderBottom: isExp ? "none" : "1px solid var(--bd)" }}>
                      {invCfg ? (
                        <>
                          <span style={{ padding: "2px 8px", borderRadius: 5, background: invCfg.bg, color: invCfg.color, fontSize: "0.7rem", fontWeight: 700, whiteSpace: "nowrap" }}>
                            {invCfg.label}
                          </span>
                          {invSum && invKey !== 'no_inspection' && (
                            <div style={{ fontSize: "0.6rem", marginTop: 2 }}>
                              {invSum.available > 0 && <span style={{ color: "var(--gn)" }}>{invSum.available} còn </span>}
                              {invSum.sawn > 0 && <span style={{ color: "#2980b9" }}>{invSum.sawn} xẻ </span>}
                              {invSum.sold > 0 && <span style={{ color: "#8B5E3C" }}>{invSum.sold} bán</span>}
                            </div>
                          )}
                        </>
                      ) : (
                        <span style={{ padding: "2px 8px", borderRadius: 5, background: statusBg(c.status), color: statusColor(c.status), fontSize: "0.7rem", fontWeight: 700 }}>{c.status}</span>
                      )}
                    </td>
                    {ce && !addOnly && (
                      <td style={{ padding: "9px 10px", borderBottom: isExp ? "none" : "1px solid var(--bd)" }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: 5 }}>
                          <button onClick={() => openEdit(c)} style={{ padding: "3px 8px", borderRadius: 4, background: "transparent", color: "var(--ac)", border: "1px solid var(--ac)", cursor: "pointer", fontWeight: 600, fontSize: "0.68rem" }}>Sửa</button>
                          <button onClick={() => del(c)} style={{ padding: "3px 8px", borderRadius: 4, background: "transparent", color: "var(--dg)", border: "1px solid var(--dg)", cursor: "pointer", fontWeight: 600, fontSize: "0.68rem" }}>Xóa</button>
                        </div>
                      </td>
                    )}
                  </tr>

                  {/* Expanded — chi tiết hàng hóa */}
                  {isExp && (
                    <tr>
                      <td colSpan={ce && !addOnly ? 8 : 7} style={{ padding: 0, borderBottom: "2px solid var(--ac)" }}>
                        <ContainerDetail
                          c={c} cItems={items[c.id]} ct={ct}
                          wts={wts} rawWoodTypes={rawWoodTypes} cfg={cfg}
                          ce={ce && !addOnly}
                          itemEd={itemEd} setItemEd={setItemEd}
                          itemFm={itemFm} setItemFm={setItemFm}
                          openItemNew={openItemNew} openItemEdit={openItemEdit}
                          saveItem={saveItem} delItem={delItem}
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
  );
}

/* ── Chi tiết container (expanded) ── */
function ContainerDetail({ c, cItems, ct, wts, rawWoodTypes, cfg, ce, itemEd, setItemEd, itemFm, setItemFm, openItemNew, openItemEdit, saveItem, delItem }) {
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
                    <td style={{ padding: "5px 8px", borderBottom: "1px solid var(--bd)" }}>{w ? `${w.icon || ""} ${w.name}` : "—"}</td>
                    <td style={{ padding: "5px 8px", borderBottom: "1px solid var(--bd)", textAlign: isSawn ? "left" : "right" }}>
                      {isSawn ? (item.thickness || "—") : (item.pieceCount != null ? `${item.pieceCount} cây` : "—")}
                    </td>
                    <td style={{ padding: "5px 8px", borderBottom: "1px solid var(--bd)" }}>{item.quality || "—"}</td>
                    <td style={{ padding: "5px 8px", borderBottom: "1px solid var(--bd)", textAlign: "right", fontWeight: 600 }}>{item.volume != null ? item.volume.toFixed(3) : "—"}</td>
                    <td style={{ padding: "5px 8px", borderBottom: "1px solid var(--bd)", color: "var(--tm)" }}>{item.notes || ""}</td>
                    {ce && (
                      <td style={{ padding: "5px 8px", borderBottom: "1px solid var(--bd)" }}>
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
                  {cItems.reduce((s, x) => s + (x.volume || 0), 0).toFixed(3)} m³
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
