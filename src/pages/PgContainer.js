import React, { useState, useEffect, useMemo } from "react";
import { CONTAINER_STATUSES } from "./PgNCC";

export default function PgContainer({ suppliers, wts, cfg = {}, ce, useAPI, notify }) {
  const [containers, setContainers] = useState([]);
  const [items, setItems] = useState({});
  const [loadingList, setLoadingList] = useState(true);
  const [expId, setExpId] = useState(null);
  const [ed, setEd] = useState(null);
  const [fm, setFm] = useState({ containerCode: "", nccId: "", arrivalDate: "", totalVolume: "", status: "Tạo mới", notes: "" });
  const [fmErr, setFmErr] = useState({});
  const [newItems, setNewItems] = useState([]);
  const [itemEd, setItemEd] = useState(null);
  const [itemFm, setItemFm] = useState({ woodId: "", thickness: "", quality: "", volume: "", notes: "" });
  const [filterWood, setFilterWood] = useState("");
  const [filterQuality, setFilterQuality] = useState("");
  const [filterThickness, setFilterThickness] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortField, setSortField] = useState("containerCode");
  const [sortDir, setSortDir] = useState("asc");

  const addNewItemRow = () => setNewItems(p => [...p, { _id: Date.now(), woodId: wts[0]?.id || "", thickness: "", quality: "", volume: "", notes: "" }]);
  const updateNewItem = (idx, field, val) => setNewItems(p => p.map((x, i) => i === idx ? { ...x, [field]: val, ...(field === "woodId" ? { quality: "" } : {}) } : x));
  const removeNewItem = (idx) => setNewItems(p => p.filter((_, i) => i !== idx));

  useEffect(() => {
    if (!useAPI) { setLoadingList(false); return; }
    Promise.all([
      import('../api.js').then(api => api.fetchContainers()),
      import('../api.js').then(api => api.fetchAllContainerItems()),
    ]).then(([data, allItems]) => {
      setContainers(data);
      setItems(allItems);
      setLoadingList(false);
    }).catch(e => { notify("Lỗi tải container: " + e.message, false); setLoadingList(false); });
  }, [useAPI]);

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
      .catch(e => notify("Lỗi tải chi tiết: " + e.message, false));
  };

  const toggleExp = (id) => {
    if (expId === id) { setExpId(null); setItemEd(null); return; }
    setExpId(id);
    setItemEd(null);
    loadItems(id);
  };

  const openNew = () => {
    setFm({ containerCode: "", nccId: "", arrivalDate: "", totalVolume: "", status: "Tạo mới", notes: "" });
    setFmErr({}); setNewItems([]); setEd("new");
  };

  const openEdit = (c) => {
    setFm({ containerCode: c.containerCode, nccId: c.nccId || "", arrivalDate: c.arrivalDate || "", totalVolume: c.totalVolume != null ? String(c.totalVolume) : "", status: c.status || "Tạo mới", notes: c.notes || "" });
    setFmErr({}); setEd(c.id);
  };

  const sv = () => {
    const errs = {};
    if (!fm.containerCode.trim()) errs.containerCode = "Không được để trống";
    if (Object.keys(errs).length) { setFmErr(errs); return; }
    setFmErr({});
    const validItems = ed === "new" ? newItems.filter(x => x.woodId) : [];
    const tvol = ed === "new"
      ? (validItems.reduce((s, x) => s + (parseFloat(x.volume) || 0), 0) || null)
      : (fm.totalVolume.trim() ? parseFloat(fm.totalVolume) : null);
    if (ed === "new") {
      const tmp = { id: "tmp_" + Date.now(), containerCode: fm.containerCode.trim(), nccId: fm.nccId || null, arrivalDate: fm.arrivalDate || null, totalVolume: tvol, status: "Tạo mới", notes: fm.notes.trim() || null };
      setContainers(p => [tmp, ...p]);
      if (!useAPI) {
        setItems(p => ({ ...p, [tmp.id]: validItems.map((x, i) => ({ ...x, id: Date.now() + i, volume: x.volume ? parseFloat(x.volume) : null })) }));
      } else {
        import('../api.js').then(api => api.addContainer(fm.containerCode.trim(), fm.nccId, fm.arrivalDate, tvol, "Tạo mới", fm.notes.trim())
          .then(r => {
            if (r?.error) { notify("Lỗi: " + r.error, false); setContainers(p => p.filter(c => c.id !== tmp.id)); return; }
            const realId = r.id;
            setContainers(p => p.map(c => c.id === tmp.id ? { ...c, id: realId } : c));
            if (expId === tmp.id) setExpId(realId);
            if (validItems.length > 0) {
              Promise.all(validItems.map(x => api.addContainerItem(realId, x.woodId, x.thickness, x.quality, x.volume ? parseFloat(x.volume) : null, x.notes)))
                .then(() => reloadItems(realId))
                .catch(() => {});
            } else {
              setItems(p => ({ ...p, [realId]: [] }));
            }
            notify("Đã thêm container " + fm.containerCode.trim() + (validItems.length ? ` (${validItems.length} mặt hàng)` : ""));
          }).catch(e => notify("Lỗi kết nối: " + e.message, false)));
      }
    } else {
      setContainers(p => p.map(c => c.id === ed ? { ...c, containerCode: fm.containerCode.trim(), nccId: fm.nccId || null, arrivalDate: fm.arrivalDate || null, totalVolume: tvol, status: fm.status, notes: fm.notes.trim() || null } : c));
      if (useAPI) import('../api.js').then(api => api.updateContainer(ed, fm.containerCode.trim(), fm.nccId, fm.arrivalDate, tvol, fm.status, fm.notes.trim()))
        .then(r => notify(r?.error ? ("Lỗi: " + r.error) : "Đã cập nhật", !r?.error))
        .catch(e => notify("Lỗi kết nối: " + e.message, false));
    }
    setEd(null);
  };

  const del = (c) => {
    setContainers(p => p.filter(x => x.id !== c.id));
    if (expId === c.id) setExpId(null);
    if (useAPI) import('../api.js').then(api => api.deleteContainer(c.id)
      .then(r => notify(r?.error ? ("Lỗi: " + r.error) : "Đã xóa container", !r?.error))
      .catch(e => notify("Lỗi kết nối: " + e.message, false)));
  };

  const saveItem = (containerId) => {
    const vol = itemFm.volume.trim() ? parseFloat(itemFm.volume) : null;
    if (itemEd === "new") {
      if (!useAPI) {
        setItems(p => ({ ...p, [containerId]: [...(p[containerId] || []), { id: Date.now(), woodId: itemFm.woodId, thickness: itemFm.thickness, quality: itemFm.quality, volume: vol, notes: itemFm.notes }] }));
        setItemEd(null); return;
      }
      import('../api.js').then(api => api.addContainerItem(containerId, itemFm.woodId, itemFm.thickness, itemFm.quality, vol, itemFm.notes))
        .then(r => {
          if (r?.error) notify("Lỗi: " + r.error, false);
          else { reloadItems(containerId); notify("Đã thêm mặt hàng"); }
        }).catch(e => notify("Lỗi kết nối: " + e.message, false));
    } else {
      setItems(p => ({ ...p, [containerId]: (p[containerId] || []).map(x => x.id === itemEd ? { ...x, woodId: itemFm.woodId, thickness: itemFm.thickness, quality: itemFm.quality, volume: vol, notes: itemFm.notes } : x) }));
      if (useAPI) import('../api.js').then(api => api.updateContainerItem(itemEd, itemFm.woodId, itemFm.thickness, itemFm.quality, vol, itemFm.notes)
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

  const statusColor = (s) => s === "Đã về" || s === "Đã nhập kho" ? "var(--gn)" : s === "Đang vận chuyển" ? "var(--ac)" : "var(--ts)";
  const statusBg = (s) => s === "Đã về" || s === "Đã nhập kho" ? "rgba(50,79,39,0.1)" : s === "Đang vận chuyển" ? "rgba(242,101,34,0.08)" : "var(--bgs)";

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };
  const sortIcon = (field) => sortField === field ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  const visContainers = useMemo(() => {
    let arr = [...containers];
    if (filterWood || filterQuality.trim() || filterThickness.trim()) {
      arr = arr.filter(c => {
        const cItems = items[c.id] || [];
        return cItems.some(x =>
          (!filterWood || x.woodId === filterWood) &&
          (!filterQuality.trim() || (x.quality || "").toLowerCase().includes(filterQuality.trim().toLowerCase())) &&
          (!filterThickness.trim() || (x.thickness || "").toLowerCase().includes(filterThickness.trim().toLowerCase()))
        );
      });
    }
    if (filterStatus) arr = arr.filter(c => c.status === filterStatus);
    arr.sort((a, b) => {
      let va = a[sortField] ?? ""; let vb = b[sortField] ?? "";
      if (sortField === "totalVolume") { va = va || 0; vb = vb || 0; }
      const cmp = typeof va === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [containers, items, filterWood, filterQuality, filterThickness, filterStatus, sortField, sortDir]);

  const hasFilters = filterWood || filterQuality || filterThickness || filterStatus;
  const newItemsTotal = newItems.reduce((s, x) => s + (parseFloat(x.volume) || 0), 0);

  if (loadingList) return <div style={{ padding: 40, textAlign: "center", color: "var(--tm)" }}>Đang tải...</div>;

  const ths = { padding: "8px 10px", textAlign: "left", background: "var(--bgh)", color: "var(--brl)", fontWeight: 700, fontSize: "0.65rem", textTransform: "uppercase", borderBottom: "2px solid var(--bds)", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "var(--br)" }}>📦 Container</h2>
        {ce && <button onClick={openNew} style={{ padding: "7px 16px", borderRadius: 7, background: "var(--ac)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>+ Thêm</button>}
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, padding: "10px 12px", borderRadius: 8, background: "var(--bgc)", border: "1px solid var(--bd)" }}>
        <select value={filterWood} onChange={e => setFilterWood(e.target.value)}
          style={{ flex: 1, minWidth: 140, padding: "6px 10px", borderRadius: 6, border: "1.5px solid var(--bd)", fontSize: "0.78rem", background: "var(--bgc)", color: "var(--tp)", outline: "none" }}>
          <option value="">Tất cả loại gỗ</option>
          {wts.map(w => <option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
        </select>
        <input value={filterThickness} onChange={e => setFilterThickness(e.target.value)} placeholder="🔍 Độ dày..."
          style={{ flex: 1, minWidth: 110, padding: "6px 10px", borderRadius: 6, border: "1.5px solid var(--bd)", fontSize: "0.78rem", outline: "none" }} />
        <input value={filterQuality} onChange={e => setFilterQuality(e.target.value)} placeholder="🔍 Chất lượng..."
          style={{ flex: 1, minWidth: 120, padding: "6px 10px", borderRadius: 6, border: "1.5px solid var(--bd)", fontSize: "0.78rem", outline: "none" }} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ flex: 1, minWidth: 140, padding: "6px 10px", borderRadius: 6, border: "1.5px solid var(--bd)", fontSize: "0.78rem", background: "var(--bgc)", color: "var(--tp)", outline: "none" }}>
          <option value="">Tất cả trạng thái</option>
          {CONTAINER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {hasFilters && (
          <button onClick={() => { setFilterWood(""); setFilterQuality(""); setFilterThickness(""); setFilterStatus(""); }}
            style={{ padding: "6px 12px", borderRadius: 6, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600, whiteSpace: "nowrap" }}>✕ Xóa lọc</button>
        )}
      </div>

      {ed != null && (
        <div style={{ padding: 16, borderRadius: 10, background: "var(--bgc)", border: "1.5px solid var(--ac)", marginBottom: 14 }}>
          <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--br)", marginBottom: 12 }}>{ed === "new" ? "Thêm container mới" : "Chỉnh sửa container"}</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ flex: 1, minWidth: 130 }}>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)", marginBottom: 3 }}>Mã container</label>
              <input value={fm.containerCode} onChange={e => { setFm(p => ({ ...p, containerCode: e.target.value })); setFmErr(p => ({ ...p, containerCode: "" })); }} placeholder="VD: CONT2024001"
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid " + (fmErr.containerCode ? "var(--dg)" : "var(--bd)"), fontSize: "0.82rem", outline: "none", boxSizing: "border-box" }} />
              {fmErr.containerCode && <div style={{ fontSize: "0.65rem", color: "var(--dg)", marginTop: 3 }}>{fmErr.containerCode}</div>}
            </div>
            <div style={{ flex: 1, minWidth: 150 }}>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)", marginBottom: 3 }}>Nhà cung cấp</label>
              <select value={fm.nccId} onChange={e => setFm(p => ({ ...p, nccId: e.target.value }))}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid var(--bd)", fontSize: "0.82rem", outline: "none", boxSizing: "border-box", background: "var(--bgc)" }}>
                <option value="">— Chọn NCC —</option>
                {suppliers.map(s => <option key={s.id} value={s.nccId}>{s.name} ({s.nccId})</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 130 }}>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)", marginBottom: 3 }}>Ngày về</label>
              <input type="date" value={fm.arrivalDate} onChange={e => setFm(p => ({ ...p, arrivalDate: e.target.value }))}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid var(--bd)", fontSize: "0.82rem", outline: "none", boxSizing: "border-box" }} />
            </div>
            {ed !== "new" && (
              <>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)", marginBottom: 3 }}>Tổng KL (m³)</label>
                  <input type="number" step="0.001" value={fm.totalVolume} onChange={e => setFm(p => ({ ...p, totalVolume: e.target.value }))} placeholder="0.000"
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid var(--bd)", fontSize: "0.82rem", outline: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ flex: 1, minWidth: 150 }}>
                  <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)", marginBottom: 3 }}>Trạng thái</label>
                  <select value={fm.status} onChange={e => setFm(p => ({ ...p, status: e.target.value }))}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid var(--bd)", fontSize: "0.82rem", outline: "none", boxSizing: "border-box", background: "var(--bgc)" }}>
                    {CONTAINER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </>
            )}
            {ed === "new" && newItems.length > 0 && (
              <div style={{ flex: 1, minWidth: 120 }}>
                <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)", marginBottom: 3 }}>Tổng KL (tự tính)</label>
                <div style={{ padding: "8px 10px", borderRadius: 6, border: "1.5px solid var(--bds)", background: "var(--bgs)", fontSize: "0.88rem", fontWeight: 800, color: "var(--br)" }}>{newItemsTotal.toFixed(3)} m³</div>
              </div>
            )}
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)", marginBottom: 3 }}>Ghi chú</label>
            <input value={fm.notes} onChange={e => setFm(p => ({ ...p, notes: e.target.value }))} placeholder="Ghi chú (tùy chọn)"
              style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid var(--bd)", fontSize: "0.82rem", outline: "none", boxSizing: "border-box" }} />
          </div>
          {ed === "new" && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase" }}>Chi tiết hàng hóa {newItems.length > 0 && `(${newItems.length})`}</span>
                <button onClick={addNewItemRow} style={{ padding: "4px 12px", borderRadius: 5, background: "var(--br)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.72rem" }}>+ Thêm dòng</button>
              </div>
              {newItems.length === 0
                ? <div style={{ padding: "10px 12px", borderRadius: 6, border: "1.5px dashed var(--bd)", background: "var(--bgs)", textAlign: "center", color: "var(--tm)", fontSize: "0.76rem" }}>Bấm "+ Thêm dòng" để thêm hàng hóa</div>
                : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "max-content", minWidth: "100%", borderCollapse: "collapse", fontSize: "0.76rem" }}>
                      <thead>
                        <tr>
                          {["Loại gỗ", "Độ dày", "Chất lượng", "KL (m³)", "Ghi chú", ""].map((h, i) => (
                            <th key={i} style={{ padding: "5px 8px", textAlign: "left", background: "var(--bgs)", color: "var(--brl)", fontWeight: 700, fontSize: "0.62rem", textTransform: "uppercase", borderBottom: "1px solid var(--bds)", whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {newItems.map((item, idx) => {
                          const qualityVals = cfg[item.woodId]?.attrValues?.quality || [];
                          const thicknessVals = cfg[item.woodId]?.attrValues?.thickness || [];
                          return (
                            <tr key={item._id} style={{ background: idx % 2 ? "var(--bgs)" : "#fff" }}>
                              <td style={{ padding: "4px 6px", borderBottom: "1px solid var(--bd)" }}>
                                <select value={item.woodId} onChange={e => updateNewItem(idx, "woodId", e.target.value)}
                                  style={{ padding: "5px 7px", borderRadius: 5, border: "1.5px solid var(--bd)", fontSize: "0.76rem", outline: "none", background: "var(--bgc)", minWidth: 120 }}>
                                  {wts.map(w => <option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
                                </select>
                              </td>
                              <td style={{ padding: "4px 6px", borderBottom: "1px solid var(--bd)" }}>
                                {thicknessVals.length > 0
                                  ? <select value={item.thickness} onChange={e => updateNewItem(idx, "thickness", e.target.value)}
                                      style={{ padding: "5px 7px", borderRadius: 5, border: "1.5px solid var(--bd)", fontSize: "0.76rem", outline: "none", background: "var(--bgc)", minWidth: 80 }}>
                                      <option value="">—</option>
                                      {thicknessVals.map(v => <option key={v} value={v}>{v}</option>)}
                                    </select>
                                  : <input value={item.thickness} onChange={e => updateNewItem(idx, "thickness", e.target.value)} placeholder="VD: 2F"
                                      style={{ width: 70, padding: "5px 7px", borderRadius: 5, border: "1.5px solid var(--bd)", fontSize: "0.76rem", outline: "none", boxSizing: "border-box" }} />
                                }
                              </td>
                              <td style={{ padding: "4px 6px", borderBottom: "1px solid var(--bd)" }}>
                                {qualityVals.length > 0
                                  ? <select value={item.quality} onChange={e => updateNewItem(idx, "quality", e.target.value)}
                                      style={{ padding: "5px 7px", borderRadius: 5, border: "1.5px solid var(--bd)", fontSize: "0.76rem", outline: "none", background: "var(--bgc)", minWidth: 100 }}>
                                      <option value="">—</option>
                                      {qualityVals.map(v => <option key={v} value={v}>{v}</option>)}
                                    </select>
                                  : <input value={item.quality} onChange={e => updateNewItem(idx, "quality", e.target.value)} placeholder="VD: AB"
                                      style={{ width: 80, padding: "5px 7px", borderRadius: 5, border: "1.5px solid var(--bd)", fontSize: "0.76rem", outline: "none", boxSizing: "border-box" }} />
                                }
                              </td>
                              <td style={{ padding: "4px 6px", borderBottom: "1px solid var(--bd)" }}>
                                <input type="number" step="0.001" value={item.volume} onChange={e => updateNewItem(idx, "volume", e.target.value)} placeholder="0.000"
                                  style={{ width: 80, padding: "5px 7px", borderRadius: 5, border: "1.5px solid var(--bd)", fontSize: "0.76rem", outline: "none", boxSizing: "border-box", textAlign: "right" }} />
                              </td>
                              <td style={{ padding: "4px 6px", borderBottom: "1px solid var(--bd)" }}>
                                <input value={item.notes} onChange={e => updateNewItem(idx, "notes", e.target.value)} placeholder="Ghi chú"
                                  style={{ width: 120, padding: "5px 7px", borderRadius: 5, border: "1.5px solid var(--bd)", fontSize: "0.76rem", outline: "none", boxSizing: "border-box" }} />
                              </td>
                              <td style={{ padding: "4px 6px", borderBottom: "1px solid var(--bd)" }}>
                                <button onClick={() => removeNewItem(idx)} style={{ width: 24, height: 24, padding: 0, borderRadius: 4, border: "1px solid var(--dg)", background: "transparent", color: "var(--dg)", cursor: "pointer", fontSize: "0.75rem", lineHeight: 1 }}>✕</button>
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
                              {newItems.reduce((s, x) => s + (parseFloat(x.volume) || 0), 0).toFixed(3)} m³
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

      <div style={{ background: "var(--bgc)", borderRadius: 10, border: "1px solid var(--bd)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
          <thead>
            <tr style={{ background: "var(--bgs)" }}>
              {[
                { field: "containerCode", label: "Mã container" },
                { field: "nccId", label: "Nhà cung cấp" },
                { field: "arrivalDate", label: "Ngày về" },
                { field: "totalVolume", label: "Tổng KL (m³)" },
                { field: "status", label: "Trạng thái" },
              ].map(col => (
                <th key={col.field} onClick={() => toggleSort(col.field)}
                  style={{ ...ths, cursor: "pointer", userSelect: "none", textAlign: col.field === "totalVolume" ? "right" : "left" }}>
                  {col.label} {sortIcon(col.field)}
                </th>
              ))}
              {ce && <th style={{ ...ths, width: 90 }}></th>}
            </tr>
          </thead>
          <tbody>
            {visContainers.length === 0 && (
              <tr><td colSpan={ce ? 6 : 5} style={{ padding: 24, textAlign: "center", color: "var(--tm)" }}>Chưa có container nào</td></tr>
            )}
            {visContainers.map((c, ci) => {
              const sup = suppliers.find(s => s.nccId === c.nccId);
              const isExp = expId === c.id;
              const cItems = items[c.id];
              return (
                <React.Fragment key={c.id}>
                  <tr style={{ background: isExp ? "var(--acbg)" : (ci % 2 ? "var(--bgs)" : "#fff"), cursor: "pointer" }}
                    onClick={() => toggleExp(c.id)}>
                    <td style={{ padding: "9px 12px", borderBottom: isExp ? "none" : "1px solid var(--bd)", fontWeight: 700, color: "var(--br)" }}>
                      <span style={{ fontSize: "0.72rem", color: isExp ? "var(--ac)" : "var(--tm)", marginRight: 6 }}>{isExp ? "▾" : "▸"}</span>
                      📦 {c.containerCode}
                      {c.notes && <div style={{ fontSize: "0.67rem", color: "var(--tm)", fontWeight: 400, marginTop: 2 }}>{c.notes}</div>}
                    </td>
                    <td style={{ padding: "9px 12px", borderBottom: isExp ? "none" : "1px solid var(--bd)", color: "var(--ts)" }}>
                      {sup ? sup.name : (c.nccId || "—")}
                    </td>
                    <td style={{ padding: "9px 12px", borderBottom: isExp ? "none" : "1px solid var(--bd)", color: "var(--ts)" }}>
                      {c.arrivalDate || "—"}
                    </td>
                    <td style={{ padding: "9px 12px", borderBottom: isExp ? "none" : "1px solid var(--bd)", textAlign: "right", fontWeight: 700, color: "var(--br)" }}>
                      {c.totalVolume != null ? c.totalVolume.toFixed(3) : "—"}
                    </td>
                    <td style={{ padding: "9px 12px", borderBottom: isExp ? "none" : "1px solid var(--bd)" }}>
                      <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: statusBg(c.status), color: statusColor(c.status) }}>{c.status}</span>
                    </td>
                    {ce && (
                      <td style={{ padding: "6px 12px", borderBottom: isExp ? "none" : "1px solid var(--bd)" }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={() => openEdit(c)} style={{ padding: "3px 8px", borderRadius: 4, background: "transparent", color: "var(--ac)", border: "1px solid var(--ac)", cursor: "pointer", fontWeight: 600, fontSize: "0.68rem" }}>Sửa</button>
                          <button onClick={() => del(c)} style={{ padding: "3px 8px", borderRadius: 4, background: "transparent", color: "var(--dg)", border: "1px solid var(--dg)", cursor: "pointer", fontWeight: 600, fontSize: "0.68rem" }}>Xóa</button>
                        </div>
                      </td>
                    )}
                  </tr>
                  {isExp && (
                    <tr>
                      <td colSpan={ce ? 6 : 5} style={{ padding: 0, borderBottom: "1px solid var(--bd)" }}>
                        <div style={{ padding: "12px 16px", background: "var(--bgs)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase" }}>
                              Chi tiết hàng hóa {cItems ? `(${cItems.length})` : ""}
                            </span>
                            {ce && itemEd !== "new" && (
                              <button onClick={() => { setItemEd("new"); setItemFm({ woodId: wts[0]?.id || "", thickness: "", quality: "", volume: "", notes: "" }); }}
                                style={{ padding: "4px 12px", borderRadius: 5, background: "var(--br)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.7rem" }}>+ Thêm hàng</button>
                            )}
                          </div>

                          {itemEd === "new" && (
                            <div style={{ padding: 12, borderRadius: 8, background: "var(--bgc)", border: "1.5px solid var(--ac)", marginBottom: 10 }}>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                                <div style={{ flex: 2, minWidth: 130 }}>
                                  <label style={{ display: "block", fontSize: "0.65rem", fontWeight: 700, color: "var(--brl)", marginBottom: 2 }}>Loại gỗ</label>
                                  <select value={itemFm.woodId} onChange={e => setItemFm(p => ({ ...p, woodId: e.target.value }))}
                                    style={{ width: "100%", padding: "6px 8px", borderRadius: 5, border: "1.5px solid var(--bd)", fontSize: "0.78rem", outline: "none", background: "var(--bgc)" }}>
                                    {wts.map(w => <option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
                                  </select>
                                </div>
                                <div style={{ flex: 1, minWidth: 80 }}>
                                  <label style={{ display: "block", fontSize: "0.65rem", fontWeight: 700, color: "var(--brl)", marginBottom: 2 }}>Độ dày</label>
                                  <input value={itemFm.thickness} onChange={e => setItemFm(p => ({ ...p, thickness: e.target.value }))} placeholder="VD: 2F"
                                    style={{ width: "100%", padding: "6px 8px", borderRadius: 5, border: "1.5px solid var(--bd)", fontSize: "0.78rem", outline: "none", boxSizing: "border-box" }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 80 }}>
                                  <label style={{ display: "block", fontSize: "0.65rem", fontWeight: 700, color: "var(--brl)", marginBottom: 2 }}>Chất lượng</label>
                                  <input value={itemFm.quality} onChange={e => setItemFm(p => ({ ...p, quality: e.target.value }))} placeholder="VD: AB"
                                    style={{ width: "100%", padding: "6px 8px", borderRadius: 5, border: "1.5px solid var(--bd)", fontSize: "0.78rem", outline: "none", boxSizing: "border-box" }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 90 }}>
                                  <label style={{ display: "block", fontSize: "0.65rem", fontWeight: 700, color: "var(--brl)", marginBottom: 2 }}>Khối lượng (m³)</label>
                                  <input type="number" step="0.001" value={itemFm.volume} onChange={e => setItemFm(p => ({ ...p, volume: e.target.value }))} placeholder="0.000"
                                    style={{ width: "100%", padding: "6px 8px", borderRadius: 5, border: "1.5px solid var(--bd)", fontSize: "0.78rem", outline: "none", boxSizing: "border-box" }} />
                                </div>
                                <div style={{ flex: 2, minWidth: 130 }}>
                                  <label style={{ display: "block", fontSize: "0.65rem", fontWeight: 700, color: "var(--brl)", marginBottom: 2 }}>Ghi chú</label>
                                  <input value={itemFm.notes} onChange={e => setItemFm(p => ({ ...p, notes: e.target.value }))} placeholder="Ghi chú"
                                    style={{ width: "100%", padding: "6px 8px", borderRadius: 5, border: "1.5px solid var(--bd)", fontSize: "0.78rem", outline: "none", boxSizing: "border-box" }} />
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                                <button onClick={() => setItemEd(null)} style={{ padding: "5px 14px", borderRadius: 5, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.74rem" }}>Hủy</button>
                                <button onClick={() => saveItem(c.id)} style={{ padding: "5px 16px", borderRadius: 5, border: "none", background: "var(--ac)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.74rem" }}>Thêm</button>
                              </div>
                            </div>
                          )}

                          {!cItems && <div style={{ padding: "10px 0", color: "var(--tm)", fontSize: "0.78rem" }}>Đang tải...</div>}
                          {cItems && cItems.length === 0 && itemEd !== "new" && (
                            <div style={{ padding: "10px 0", color: "var(--tm)", fontSize: "0.78rem" }}>Chưa có mặt hàng nào</div>
                          )}
                          {cItems && cItems.length > 0 && (
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.76rem" }}>
                              <thead>
                                <tr>
                                  {["#", "Loại gỗ", "Độ dày", "Chất lượng", "KL (m³)", "Ghi chú"].map((h, hi) => (
                                    <th key={hi} style={{ padding: "5px 8px", textAlign: hi >= 4 ? "right" : "left", background: "var(--bgc)", color: "var(--brl)", fontWeight: 700, fontSize: "0.62rem", textTransform: "uppercase", borderBottom: "1px solid var(--bds)" }}>{h}</th>
                                  ))}
                                  {ce && <th style={{ padding: "5px 8px", background: "var(--bgc)", borderBottom: "1px solid var(--bds)" }}></th>}
                                </tr>
                              </thead>
                              <tbody>
                                {cItems.map((item, ii) => {
                                  const wd = wts.find(w => w.id === item.woodId);
                                  if (itemEd === item.id) {
                                    const editThicknessVals = cfg[itemFm.woodId]?.attrValues?.thickness || [];
                                    const editQualityVals = cfg[itemFm.woodId]?.attrValues?.quality || [];
                                    return (
                                      <tr key={item.id} style={{ background: "var(--acbg)" }}>
                                        <td style={{ padding: "5px 8px", borderBottom: "1px solid var(--bd)" }}>{ii + 1}</td>
                                        <td style={{ padding: "4px 8px", borderBottom: "1px solid var(--bd)" }}>
                                          <select value={itemFm.woodId} onChange={e => setItemFm(p => ({ ...p, woodId: e.target.value, thickness: "", quality: "" }))}
                                            style={{ width: "100%", padding: "4px 6px", borderRadius: 4, border: "1px solid var(--bd)", fontSize: "0.75rem", outline: "none" }}>
                                            {wts.map(w => <option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
                                          </select>
                                        </td>
                                        <td style={{ padding: "4px 8px", borderBottom: "1px solid var(--bd)" }}>
                                          {editThicknessVals.length > 0
                                            ? <select value={itemFm.thickness} onChange={e => setItemFm(p => ({ ...p, thickness: e.target.value }))}
                                                style={{ width: 90, padding: "4px 6px", borderRadius: 4, border: "1px solid var(--bd)", fontSize: "0.75rem", outline: "none" }}>
                                                <option value="">—</option>
                                                {editThicknessVals.map(v => <option key={v} value={v}>{v}</option>)}
                                              </select>
                                            : <input value={itemFm.thickness} onChange={e => setItemFm(p => ({ ...p, thickness: e.target.value }))}
                                                style={{ width: 65, padding: "4px 6px", borderRadius: 4, border: "1px solid var(--bd)", fontSize: "0.75rem", outline: "none" }} />
                                          }
                                        </td>
                                        <td style={{ padding: "4px 8px", borderBottom: "1px solid var(--bd)" }}>
                                          {editQualityVals.length > 0
                                            ? <select value={itemFm.quality} onChange={e => setItemFm(p => ({ ...p, quality: e.target.value }))}
                                                style={{ width: 100, padding: "4px 6px", borderRadius: 4, border: "1px solid var(--bd)", fontSize: "0.75rem", outline: "none" }}>
                                                <option value="">—</option>
                                                {editQualityVals.map(v => <option key={v} value={v}>{v}</option>)}
                                              </select>
                                            : <input value={itemFm.quality} onChange={e => setItemFm(p => ({ ...p, quality: e.target.value }))}
                                                style={{ width: 65, padding: "4px 6px", borderRadius: 4, border: "1px solid var(--bd)", fontSize: "0.75rem", outline: "none" }} />
                                          }
                                        </td>
                                        <td style={{ padding: "4px 8px", borderBottom: "1px solid var(--bd)", textAlign: "right" }}>
                                          <input type="number" step="0.001" value={itemFm.volume} onChange={e => setItemFm(p => ({ ...p, volume: e.target.value }))}
                                            style={{ width: 80, padding: "4px 6px", borderRadius: 4, border: "1px solid var(--bd)", fontSize: "0.75rem", outline: "none", textAlign: "right" }} />
                                        </td>
                                        <td style={{ padding: "4px 8px", borderBottom: "1px solid var(--bd)" }}>
                                          <input value={itemFm.notes} onChange={e => setItemFm(p => ({ ...p, notes: e.target.value }))}
                                            style={{ width: "100%", padding: "4px 6px", borderRadius: 4, border: "1px solid var(--bd)", fontSize: "0.75rem", outline: "none", boxSizing: "border-box" }} />
                                        </td>
                                        {ce && (
                                          <td style={{ padding: "4px 8px", borderBottom: "1px solid var(--bd)" }}>
                                            <div style={{ display: "flex", gap: 4 }}>
                                              <button onClick={() => saveItem(c.id)} style={{ padding: "3px 8px", borderRadius: 4, background: "var(--ac)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.65rem" }}>Lưu</button>
                                              <button onClick={() => setItemEd(null)} style={{ padding: "3px 8px", borderRadius: 4, background: "transparent", color: "var(--ts)", border: "1px solid var(--bd)", cursor: "pointer", fontWeight: 600, fontSize: "0.65rem" }}>Hủy</button>
                                            </div>
                                          </td>
                                        )}
                                      </tr>
                                    );
                                  }
                                  return (
                                    <tr key={item.id} style={{ background: ii % 2 ? "var(--bgs)" : "#fff" }}>
                                      <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--bd)", color: "var(--tm)", fontSize: "0.65rem" }}>{ii + 1}</td>
                                      <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--bd)", fontWeight: 700 }}>{wd ? `${wd.icon} ${wd.name}` : (item.woodId || "—")}</td>
                                      <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--bd)" }}>{item.thickness || "—"}</td>
                                      <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--bd)" }}>{item.quality || "—"}</td>
                                      <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--bd)", textAlign: "right", fontWeight: 700, color: "var(--br)" }}>{item.volume != null ? item.volume.toFixed(3) : "—"}</td>
                                      <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--bd)", color: "var(--ts)", fontSize: "0.72rem" }}>{item.notes || "—"}</td>
                                      {ce && (
                                        <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--bd)" }}>
                                          <div style={{ display: "flex", gap: 4 }}>
                                            <button onClick={() => { setItemEd(item.id); setItemFm({ woodId: item.woodId || "", thickness: item.thickness || "", quality: item.quality || "", volume: item.volume != null ? String(item.volume) : "", notes: item.notes || "" }); }}
                                              style={{ padding: "3px 7px", borderRadius: 4, background: "transparent", color: "var(--ac)", border: "1px solid var(--ac)", cursor: "pointer", fontWeight: 600, fontSize: "0.65rem" }}>Sửa</button>
                                            <button onClick={() => delItem(c.id, item.id)}
                                              style={{ padding: "3px 7px", borderRadius: 4, background: "transparent", color: "var(--dg)", border: "1px solid var(--dg)", cursor: "pointer", fontWeight: 600, fontSize: "0.65rem" }}>Xóa</button>
                                          </div>
                                        </td>
                                      )}
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot>
                                <tr>
                                  <td colSpan={4} style={{ padding: "6px 8px", fontWeight: 700, fontSize: "0.72rem", color: "var(--brl)", textAlign: "right", borderTop: "2px solid var(--bds)" }}>Tổng:</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 800, color: "var(--br)", fontSize: "0.78rem", borderTop: "2px solid var(--bds)" }}>
                                    {cItems.reduce((s, x) => s + (x.volume || 0), 0).toFixed(3)} m³
                                  </td>
                                  <td colSpan={ce ? 2 : 1} style={{ borderTop: "2px solid var(--bds)" }} />
                                </tr>
                              </tfoot>
                            </table>
                          )}
                        </div>
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
