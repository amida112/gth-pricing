import React, { useState, useEffect, useMemo, useRef } from "react";
import { bpk, resolveRangeGroup, resolveAttrsAlias, isM2Wood, resolvePriceAttrs, autoGrp, normalizeThickness, fmtDate, fmtMoney, svcLabel } from "../utils";
import { WoodPicker } from "../components/Matrix";
import useTableSort from '../useTableSort';
import BoardDetailDialog from '../components/BoardDetailDialog';
import Dialog from '../components/Dialog';
import ComboFilter from '../components/ComboFilter';

export const BUNDLE_STATUSES = ['Kiện nguyên', 'Chưa được bán', 'Kiện lẻ', 'Đã bán', 'Đang dong cạnh'];

function statusSt(status) {
  if (status === 'Kiện nguyên') return { color: 'var(--gn)', bg: 'rgba(50,79,39,0.1)' };
  if (status === 'Chưa được bán') return { color: '#7C5CBF', bg: 'rgba(124,92,191,0.1)' };
  if (status === 'Kiện lẻ') return { color: 'var(--ac)', bg: 'rgba(242,101,34,0.1)' };
  if (status === 'Đang dong cạnh') return { color: '#2563EB', bg: 'rgba(37,99,235,0.1)' };
  return { color: '#6B4226', bg: 'rgba(107,66,38,0.12)' };
}

function ImageUploadSection({ label, images, setImages, maxImages }) {
  const inputRef = useRef(null);
  const atLimit = maxImages != null && images.length >= maxImages;
  const handleFiles = (e) => {
    const remaining = maxImages != null ? maxImages - images.length : Infinity;
    Array.from(e.target.files).slice(0, remaining).forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => setImages(prev => [...prev, { file, preview: ev.target.result, name: file.name }]);
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };
  return (
    <div style={{ flex: "1 1 200px" }}>
      <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "var(--brl)", marginBottom: 6 }}>
        {label}{maxImages != null && <span style={{ fontWeight: 400, color: "var(--tm)", marginLeft: 4 }}>({images.length}/{maxImages})</span>}
      </label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
        {images.map((img, i) => (
          <div key={i} style={{ position: "relative", width: 64, height: 64 }}>
            <img src={img.preview} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6, border: "1px solid var(--bd)" }} />
            <button onClick={() => setImages(prev => prev.filter((_, j) => j !== i))} style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, padding: 0, borderRadius: "50%", border: "none", background: "var(--dg)", color: "#fff", cursor: "pointer", fontSize: "0.65rem", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          </div>
        ))}
        {!atLimit && <button onClick={() => inputRef.current?.click()} style={{ width: 64, height: 64, borderRadius: 6, border: "1.5px dashed var(--bd)", background: "var(--bgs)", color: "var(--tm)", cursor: "pointer", fontSize: "1.4rem", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>}
      </div>
      <input ref={inputRef} type="file" multiple={!maxImages || maxImages > 1} accept="image/*" onChange={handleFiles} style={{ display: "none" }} />
      <div style={{ fontSize: "0.62rem", color: "var(--tm)" }}>JPG, PNG, WEBP</div>
    </div>
  );
}

function EditableImageSection({ label, existingUrls, setExistingUrls, newFiles, setNewFiles, maxImages }) {
  const inputRef = useRef(null);
  const total = existingUrls.length + newFiles.length;
  const atLimit = maxImages != null && total >= maxImages;
  const handleFiles = (e) => {
    const remaining = maxImages != null ? maxImages - total : Infinity;
    Array.from(e.target.files).slice(0, remaining).forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => setNewFiles(prev => [...prev, { file, preview: ev.target.result }]);
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };
  const thumb = { width: 72, height: 72, objectFit: "cover", borderRadius: 6, border: "1px solid var(--bd)" };
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: "0.68rem", fontWeight: 700, color: "var(--brl)", marginBottom: 6, textTransform: "uppercase" }}>
        {label}{maxImages != null && <span style={{ fontWeight: 400, color: "var(--tm)", marginLeft: 4, textTransform: "none" }}>({total}/{maxImages})</span>}
      </label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-start" }}>
        {existingUrls.map((url, i) => (
          <div key={i} style={{ position: "relative" }}>
            <a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt="" style={thumb} /></a>
            <button onClick={() => setExistingUrls(p => p.filter((_, j) => j !== i))} style={{ position: "absolute", top: -5, right: -5, width: 16, height: 16, padding: 0, borderRadius: "50%", border: "none", background: "var(--dg)", color: "#fff", cursor: "pointer", fontSize: "0.6rem", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          </div>
        ))}
        {newFiles.map((img, i) => (
          <div key={'n' + i} style={{ position: "relative" }}>
            <img src={img.preview} alt="" style={{ ...thumb, opacity: 0.7 }} />
            <button onClick={() => setNewFiles(p => p.filter((_, j) => j !== i))} style={{ position: "absolute", top: -5, right: -5, width: 16, height: 16, padding: 0, borderRadius: "50%", border: "none", background: "var(--dg)", color: "#fff", cursor: "pointer", fontSize: "0.6rem", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            <div style={{ position: "absolute", bottom: 2, left: 2, fontSize: "0.5rem", background: "rgba(0,0,0,0.5)", color: "#fff", borderRadius: 2, padding: "1px 3px" }}>mới</div>
          </div>
        ))}
        {!atLimit && <button onClick={() => inputRef.current?.click()} style={{ width: 72, height: 72, borderRadius: 6, border: "1.5px dashed var(--bd)", background: "var(--bgs)", color: "var(--tm)", cursor: "pointer", fontSize: "1.4rem", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>}
      </div>
      <input ref={inputRef} type="file" multiple={!maxImages || maxImages > 1} accept="image/*" onChange={handleFiles} style={{ display: "none" }} />
    </div>
  );
}

function BundleDetail({ bundle, wts, containers, suppliers, ats, prices, cfg, ce, cePrice, onClose, onSave, onStatusChange, notify }) {
  const wood = wts.find(w => w.id === bundle.woodId);
  const cont = bundle.containerId ? containers.find(c => c.id === bundle.containerId) : null;
  const ncc = cont?.nccId ? suppliers.find(s => s.nccId === cont.nccId) : null;
  const atLabels = Object.fromEntries(ats.map(a => [a.id, a.name]));
  const { color: statusColor, bg: statusBg } = statusSt(bundle.status);
  const isPerBundleWood = wts.find(w => w.id === bundle.woodId)?.pricingMode === 'perBundle';
  const isM2Bundle = isM2Wood(bundle.woodId, wts);
  const volUnit = isM2Bundle ? 'm²' : 'm³';
  const woodCfg = useMemo(() => cfg[bundle.woodId] || { attrs: [], attrValues: {} }, [cfg, bundle.woodId]);

  const [editing, setEditing] = useState(false);
  const [boardDetail, setBoardDetail] = useState(null);
  const [location, setLocation] = useState(bundle.location || '');
  const [existingImgs, setExistingImgs] = useState(bundle.images || []);
  const [newImgFiles, setNewImgFiles] = useState([]);
  // Sửa thuộc tính
  const [editAttrs, setEditAttrs] = useState({ ...bundle.attributes });
  const [editRawMeas, setEditRawMeas] = useState({ ...(bundle.rawMeasurements || {}) });
  const [editManualGroups, setEditManualGroups] = useState({});
  const [editAttrErr, setEditAttrErr] = useState({});
  const [editBoardCount, setEditBoardCount] = useState(String(bundle.boardCount || ''));
  const [editVolume, setEditVolume] = useState(String(bundle.volume || ''));
  const [existingItemImgs, setExistingItemImgs] = useState(bundle.itemListImages || []);
  const [newItemImgFiles, setNewItemImgFiles] = useState([]);
  const [saving, setSaving] = useState(false);

  // Lịch sử bán hàng
  const [salesHistory, setSalesHistory] = useState([]);
  const [loadingSales, setLoadingSales] = useState(true);
  const [orderDetailId, setOrderDetailId] = useState(null);
  const [orderDetail, setOrderDetail] = useState(null);

  // ESC guard: chỉ đóng BundleDetail khi không có nested dialog
  useEffect(() => { const h = e => { if (e.key === 'Escape' && !orderDetailId && !boardDetail) onClose(); }; document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h); }, [onClose, orderDetailId, boardDetail]);

  // Load sales history
  useEffect(() => {
    (async () => {
      try {
        const { fetchBundleSalesHistoryFull } = await import('../api.js');
        const data = await fetchBundleSalesHistoryFull(bundle.id, bundle.bundleCode);
        setSalesHistory(data);
      } catch { setSalesHistory([]); }
      setLoadingSales(false);
    })();
  }, [bundle.id, bundle.bundleCode]);

  // Load order detail on click
  useEffect(() => {
    if (!orderDetailId) { setOrderDetail(null); return; }
    (async () => {
      try {
        const { fetchOrderDetail } = await import('../api.js');
        setOrderDetail(await fetchOrderDetail(orderDetailId));
      } catch { setOrderDetail(null); }
    })();
  }, [orderDetailId]);
  const [unitPrice, setUnitPrice] = useState(bundle.unitPrice ?? null);
  const [priceAdj, setPriceAdj] = useState(bundle.priceAdjustment ?? null); // { type, value, reason }
  const [priceOvr, setPriceOvr] = useState(bundle.priceAttrsOverride ?? null); // { attrId: value, ... }
  const [priceOvrReason, setPriceOvrReason] = useState(bundle.priceOverrideReason || '');
  const [editingOvr, setEditingOvr] = useState(false);
  const [ovrDraft, setOvrDraft] = useState({}); // draft override attrs while editing
  const [ovrReasonDraft, setOvrReasonDraft] = useState('');
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceVal, setPriceVal] = useState('');
  const [adjType, setAdjType] = useState('absolute');
  const [adjVal, setAdjVal] = useState('');
  const [adjReason, setAdjReason] = useState('');

  // Giá bảng chuẩn (SKU) cho non-perBundle — dùng priceAttrsOverride nếu có
  const skuPrice = useMemo(() => {
    if (isPerBundleWood || !prices || !cfg) return null;
    const lookupAttrs = { ...bundle.attributes, ...(bundle.priceAttrsOverride || {}) };
    const key = bpk(bundle.woodId, resolvePriceAttrs(bundle.woodId, lookupAttrs, cfg));
    return prices[key]?.price ?? null;
  }, [isPerBundleWood, prices, cfg, bundle.woodId, bundle.attributes, bundle.priceAttrsOverride]); // eslint-disable-line

  const cancelEdit = () => {
    setEditing(false);
    setLocation(bundle.location || '');
    setExistingImgs(bundle.images || []);
    setNewImgFiles([]);
    setExistingItemImgs(bundle.itemListImages || []);
    setNewItemImgFiles([]);
    setEditAttrs({ ...bundle.attributes });
    setEditRawMeas({ ...(bundle.rawMeasurements || {}) });
    setEditManualGroups({});
    setEditAttrErr({});
    setEditBoardCount(String(bundle.boardCount || ''));
    setEditVolume(String(bundle.volume || ''));
  };

  const handleSave = async () => {
    // Validate attrs bắt buộc + số tấm + khối lượng
    const errs = {};
    (woodCfg.attrs || []).forEach(atId => {
      if (atId === 'width') return;
      if (!editAttrs[atId]) errs[atId] = 'Bắt buộc';
    });
    if (!editBoardCount || parseInt(editBoardCount) <= 0) errs._boardCount = 'Nhập số tấm > 0';
    if (!editVolume || parseFloat(editVolume) <= 0) errs._volume = 'Nhập khối lượng > 0';
    setEditAttrErr(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      const { updateBundle, uploadBundleImage } = await import('../api.js');
      let imgUrls = [...existingImgs];
      let itemImgUrls = [...existingItemImgs];
      for (const img of newImgFiles) { const r = await uploadBundleImage(bundle.bundleCode, img.file, 'photo'); if (r.error) throw new Error('Upload ảnh kiện: ' + r.error); imgUrls.push(r.url); }
      for (const img of newItemImgFiles) { const r = await uploadBundleImage(bundle.bundleCode, img.file, 'item-list'); if (r.error) throw new Error('Upload ảnh chi tiết: ' + r.error); itemImgUrls.push(r.url); }

      // Tính sku_key từ editAttrs
      const filteredAttrs = Object.fromEntries(Object.entries(editAttrs).filter(([, v]) => v));
      const newSkuKey = Object.entries(filteredAttrs).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}:${v}`).join('||');
      const hasManual = Object.values(editManualGroups).some(Boolean);
      const hasRawMeas = Object.keys(editRawMeas).some(k => editRawMeas[k]);

      // Tính lại remaining dựa trên chênh lệch boardCount/volume
      const newBoardCount = parseInt(editBoardCount) || 0;
      const newVolume = +(parseFloat(editVolume) || 0).toFixed(4);
      const boardDiff = newBoardCount - (bundle.boardCount || 0);
      const volDiff = +(newVolume - (bundle.volume || 0)).toFixed(4);
      const newRemainingBoards = Math.max(0, (bundle.remainingBoards || 0) + boardDiff);
      const newRemainingVol = +Math.max(0, (bundle.remainingVolume || 0) + volDiff).toFixed(4);

      const updates = {
        location: location || null,
        images: imgUrls,
        item_list_images: itemImgUrls,
        attributes: filteredAttrs,
        sku_key: newSkuKey,
        ...(hasRawMeas ? { raw_measurements: editRawMeas } : {}),
        manual_group_assignment: hasManual,
        board_count: newBoardCount,
        remaining_boards: newRemainingBoards,
        volume: newVolume,
        remaining_volume: newRemainingVol,
      };
      const r = await updateBundle(bundle.id, updates);
      if (r.error) { onSave(null, r.error); setSaving(false); return; }
      const updated = { ...bundle, location, images: imgUrls, itemListImages: itemImgUrls, attributes: filteredAttrs, skuKey: newSkuKey, rawMeasurements: editRawMeas, manualGroupAssignment: hasManual, boardCount: newBoardCount, remainingBoards: newRemainingBoards, volume: newVolume, remainingVolume: newRemainingVol };
      onSave(updated);
      setEditing(false);
      setNewImgFiles([]);
      setNewItemImgFiles([]);
    } catch (e) { onSave(null, e.message); }
    setSaving(false);
  };

  const handleSavePrice = async () => {
    const newPrice = parseFloat(priceVal);
    if (isNaN(newPrice) || newPrice <= 0) return;
    setSaving(true);
    try {
      const { updateBundle } = await import('../api.js');
      const r = await updateBundle(bundle.id, { unit_price: newPrice });
      if (r.error) { onSave(null, r.error); setSaving(false); return; }
      const updated = { ...bundle, unitPrice: newPrice };
      onSave(updated);
      setUnitPrice(newPrice);
      setEditingPrice(false);
    } catch (e) { onSave(null, e.message); }
    setSaving(false);
  };

  const handleSaveAdj = async () => {
    const v = parseFloat(adjVal);
    if (isNaN(v) || v === 0 || !adjReason.trim()) return;
    setSaving(true);
    try {
      const { updateBundle } = await import('../api.js');
      const adj = { type: adjType, value: v, reason: adjReason.trim() };
      const r = await updateBundle(bundle.id, { price_adjustment: adj });
      if (r.error) { onSave(null, r.error); setSaving(false); return; }
      setPriceAdj(adj);
      onSave({ ...bundle, priceAdjustment: adj });
      setEditingPrice(false);
    } catch (e) { onSave(null, e.message); }
    setSaving(false);
  };

  const handleClearAdj = async () => {
    if (!window.confirm('Xóa điều chỉnh giá cho kiện này?')) return;
    setSaving(true);
    try {
      const { updateBundle } = await import('../api.js');
      const r = await updateBundle(bundle.id, { price_adjustment: null });
      if (r.error) { onSave(null, r.error); setSaving(false); return; }
      setPriceAdj(null);
      onSave({ ...bundle, priceAdjustment: null });
    } catch (e) { onSave(null, e.message); }
    setSaving(false);
  };

  // === SKU Override handlers ===
  const wc = cfg?.[bundle.woodId];
  const ovrAttrs = useMemo(() => {
    if (!wc?.attrs) return [];
    return (wc.attrs || []).filter(k => bundle.attributes?.[k] != null).map(k => ({
      key: k,
      label: atLabels[k] || k,
      values: wc.attrValues?.[k] || [],
      current: bundle.attributes[k],
    }));
  }, [wc, bundle.attributes, atLabels]);

  const handleStartOvr = () => {
    const draft = {};
    ovrAttrs.forEach(a => { draft[a.key] = priceOvr?.[a.key] || a.current; });
    setOvrDraft(draft);
    setOvrReasonDraft(priceOvrReason || '');
    setEditingOvr(true);
  };

  const ovrHasChanges = useMemo(() => {
    return ovrAttrs.some(a => ovrDraft[a.key] && ovrDraft[a.key] !== a.current);
  }, [ovrAttrs, ovrDraft]);

  const handleSaveOvr = async () => {
    if (!ovrReasonDraft.trim()) return;
    const overrides = {};
    ovrAttrs.forEach(a => {
      if (ovrDraft[a.key] && ovrDraft[a.key] !== a.current) overrides[a.key] = ovrDraft[a.key];
    });
    if (!Object.keys(overrides).length) return;
    setSaving(true);
    try {
      const { updateBundle } = await import('../api.js');
      const r = await updateBundle(bundle.id, { price_attrs_override: overrides, price_override_reason: ovrReasonDraft.trim() });
      if (r.error) { onSave(null, r.error); setSaving(false); return; }
      setPriceOvr(overrides);
      setPriceOvrReason(ovrReasonDraft.trim());
      onSave({ ...bundle, priceAttrsOverride: overrides, priceOverrideReason: ovrReasonDraft.trim() });
      setEditingOvr(false);
    } catch (e) { onSave(null, e.message); }
    setSaving(false);
  };

  const handleClearOvr = async () => {
    if (!window.confirm('Xóa đổi mã tra giá cho kiện này?')) return;
    setSaving(true);
    try {
      const { updateBundle } = await import('../api.js');
      const r = await updateBundle(bundle.id, { price_attrs_override: null, price_override_reason: null });
      if (r.error) { onSave(null, r.error); setSaving(false); return; }
      setPriceOvr(null);
      setPriceOvrReason('');
      onSave({ ...bundle, priceAttrsOverride: null, priceOverrideReason: '' });
    } catch (e) { onSave(null, e.message); }
    setSaving(false);
  };

  const ImgRow = ({ label, urls }) => (
    <div style={{ marginBottom: urls.length ? 10 : 0 }}>
      <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--tm)", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      {urls.length > 0 ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {urls.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer">
              <img src={url} alt="" style={{ width: 90, height: 90, objectFit: "cover", borderRadius: 6, border: "1px solid var(--bd)" }} />
            </a>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: "0.72rem", color: "var(--tm)", fontStyle: "italic" }}>Chưa có ảnh</div>
      )}
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(45,32,22,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--bgc)", borderRadius: 16, padding: 24, width: 600, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto", border: "1px solid var(--bd)" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: "1rem", fontWeight: 800, color: "var(--br)", fontFamily: "monospace", marginBottom: 4 }}>{bundle.bundleCode}</div>
            <div style={{ fontSize: "0.82rem", color: "var(--ts)" }}>{wood?.icon} {wood?.name || bundle.woodId}</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {ce && !editing && <button onClick={() => setEditing(true)} style={{ padding: "5px 12px", borderRadius: 6, border: "1.5px solid var(--ac)", background: "var(--acbg)", color: "var(--ac)", cursor: "pointer", fontWeight: 700, fontSize: "0.74rem" }}>Sửa</button>}
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid var(--bd)", background: "transparent", cursor: "pointer", color: "var(--ts)", fontSize: "0.8rem" }}>✕</button>
          </div>
        </div>

        {/* Edit form — chỉ vị trí + ảnh */}
        {editing && (
          <div style={{ background: "var(--bgs)", borderRadius: 10, padding: 16, border: "1px solid var(--bd)", marginBottom: 16 }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase", marginBottom: 12 }}>Cập nhật kiện</div>

            {/* Thuộc tính */}
            {(woodCfg.attrs || []).length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: "0.68rem", fontWeight: 700, color: "var(--brl)", marginBottom: 6, textTransform: "uppercase" }}>Thuộc tính</label>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {(woodCfg.attrs || []).map(atId => {
                    const atDef = ats.find(a => a.id === atId);
                    const label = atDef?.name || atId;
                    const vals = woodCfg.attrValues?.[atId] || [];
                    const isOptional = atId === 'width';
                    const rangeGrps = woodCfg.rangeGroups?.[atId];
                    const isAutoTh = atId === 'thickness' && wood?.thicknessMode === 'auto';
                    const errMsg = editAttrErr[atId];
                    const inpSt = { padding: "6px 8px", borderRadius: 5, border: `1.5px solid ${errMsg ? 'var(--dg)' : 'var(--bd)'}`, fontSize: "0.78rem", outline: "none", boxSizing: "border-box" };

                    // Range attr (length/width)
                    if (rangeGrps?.length && atId !== 'thickness') {
                      const rawVal = editRawMeas[atId] || '';
                      const resolved = resolveRangeGroup(rawVal, rangeGrps);
                      const isManual = editManualGroups[atId];
                      return (
                        <div key={atId} style={{ flex: "1 1 140px", minWidth: 120 }}>
                          <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--brl)", marginBottom: 3 }}>{label}{!isOptional ? ' *' : ''}</div>
                          <input value={rawVal} onChange={e => {
                            const v = e.target.value.trim().replace(/\s*-\s*/g, '-');
                            setEditRawMeas(p => ({ ...p, [atId]: v }));
                            const grp = resolveRangeGroup(v, rangeGrps);
                            if (grp) {
                              setEditAttrs(p => ({ ...p, [atId]: grp }));
                              setEditManualGroups(p => ({ ...p, [atId]: false }));
                            } else if (v) {
                              // Ngoài khoảng — lưu raw value
                              setEditAttrs(p => ({ ...p, [atId]: v }));
                              setEditManualGroups(p => ({ ...p, [atId]: true }));
                            } else {
                              setEditAttrs(p => ({ ...p, [atId]: '' }));
                            }
                            setEditAttrErr(p => ({ ...p, [atId]: undefined }));
                          }} placeholder={`VD: 2.2-2.5`} style={{ ...inpSt, width: "100%" }} />
                          {rawVal && <div style={{ fontSize: "0.62rem", marginTop: 2, color: resolved ? "var(--gn)" : "#D4A017", fontWeight: 600 }}>
                            {resolved ? `→ ${resolved}` : 'Ngoài khoảng'}
                            {isManual && ' ⚠️'}
                          </div>}
                          {!rawVal && editAttrs[atId] && <div style={{ fontSize: "0.62rem", marginTop: 2, color: "var(--tm)" }}>Nhóm: {editAttrs[atId]}</div>}
                          {errMsg && <div style={{ fontSize: "0.6rem", color: "var(--dg)", marginTop: 1 }}>{errMsg}</div>}
                        </div>
                      );
                    }

                    // Thickness auto
                    if (isAutoTh) {
                      return (
                        <div key={atId} style={{ flex: "1 1 100px", minWidth: 80 }}>
                          <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--brl)", marginBottom: 3 }}>{label} *</div>
                          <input value={editAttrs[atId] || ''} onChange={e => {
                            const { value: norm } = normalizeThickness(e.target.value);
                            setEditAttrs(p => ({ ...p, thickness: norm || e.target.value }));
                            setEditAttrErr(p => ({ ...p, thickness: undefined }));
                          }} placeholder="VD: 2.5F" style={{ ...inpSt, width: "100%" }} />
                          {errMsg && <div style={{ fontSize: "0.6rem", color: "var(--dg)", marginTop: 1 }}>{errMsg}</div>}
                        </div>
                      );
                    }

                    // Standard attr (dropdown hoặc input)
                    return (
                      <div key={atId} style={{ flex: "1 1 100px", minWidth: 80 }}>
                        <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--brl)", marginBottom: 3 }}>{label}{!isOptional ? ' *' : ''}</div>
                        {vals.length > 0 ? (
                          <select value={editAttrs[atId] || ''} onChange={e => { setEditAttrs(p => ({ ...p, [atId]: e.target.value })); setEditAttrErr(p => ({ ...p, [atId]: undefined })); }}
                            style={{ ...inpSt, width: "100%", background: "var(--bgc)" }}>
                            <option value="">— Chọn —</option>
                            {vals.map(v => <option key={v} value={v}>{v}</option>)}
                          </select>
                        ) : (
                          <input value={editAttrs[atId] || ''} onChange={e => { setEditAttrs(p => ({ ...p, [atId]: e.target.value })); setEditAttrErr(p => ({ ...p, [atId]: undefined })); }}
                            placeholder={label} style={{ ...inpSt, width: "100%" }} />
                        )}
                        {errMsg && <div style={{ fontSize: "0.6rem", color: "var(--dg)", marginTop: 1 }}>{errMsg}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Số tấm + Khối lượng */}
            <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              <div style={{ flex: "1 1 140px" }}>
                <label style={{ display: "block", fontSize: "0.68rem", fontWeight: 700, color: "var(--brl)", marginBottom: 4, textTransform: "uppercase" }}>Số tấm *</label>
                <input type="number" min="1" value={editBoardCount} onChange={e => { setEditBoardCount(e.target.value); setEditAttrErr(p => ({ ...p, _boardCount: undefined })); }}
                  style={{ width: "100%", padding: "7px 9px", borderRadius: 6, border: `1.5px solid ${editAttrErr._boardCount ? 'var(--dg)' : 'var(--bd)'}`, fontSize: "0.82rem", outline: "none", boxSizing: "border-box", textAlign: "right" }} />
                {editAttrErr._boardCount && <div style={{ fontSize: "0.6rem", color: "var(--dg)", marginTop: 1 }}>{editAttrErr._boardCount}</div>}
              </div>
              <div style={{ flex: "1 1 140px" }}>
                <label style={{ display: "block", fontSize: "0.68rem", fontWeight: 700, color: "var(--brl)", marginBottom: 4, textTransform: "uppercase" }}>Khối lượng ({volUnit}) *</label>
                <input type="number" step="0.0001" min="0" value={editVolume} onChange={e => { setEditVolume(e.target.value); setEditAttrErr(p => ({ ...p, _volume: undefined })); }}
                  style={{ width: "100%", padding: "7px 9px", borderRadius: 6, border: `1.5px solid ${editAttrErr._volume ? 'var(--dg)' : 'var(--bd)'}`, fontSize: "0.82rem", outline: "none", boxSizing: "border-box", textAlign: "right" }} />
                {editAttrErr._volume && <div style={{ fontSize: "0.6rem", color: "var(--dg)", marginTop: 1 }}>{editAttrErr._volume}</div>}
              </div>
            </div>

            {/* Vị trí */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: "0.68rem", fontWeight: 700, color: "var(--brl)", marginBottom: 4, textTransform: "uppercase" }}>Vị trí</label>
              <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Ví dụ: Kệ A-3, Hàng 2..."
                style={{ width: "100%", padding: "7px 9px", borderRadius: 6, border: "1.5px solid var(--bd)", fontSize: "0.82rem", outline: "none", boxSizing: "border-box" }} />
            </div>
            <EditableImageSection label="Ảnh chụp kiện" existingUrls={existingImgs} setExistingUrls={setExistingImgs} newFiles={newImgFiles} setNewFiles={setNewImgFiles} maxImages={2} />
            <EditableImageSection label="Ảnh list chi tiết kiện" existingUrls={existingItemImgs} setExistingUrls={setExistingItemImgs} newFiles={newItemImgFiles} setNewFiles={setNewItemImgFiles} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <button onClick={cancelEdit} style={{ padding: "6px 14px", borderRadius: 6, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>Hủy</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: "6px 18px", borderRadius: 6, border: "none", background: saving ? "var(--bd)" : "var(--ac)", color: saving ? "var(--tm)" : "#fff", cursor: saving ? "not-allowed" : "pointer", fontWeight: 700, fontSize: "0.78rem" }}>{saving ? 'Đang lưu...' : 'Lưu'}</button>
            </div>
          </div>
        )}

        {/* View: tình trạng + số liệu */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <span style={{ padding: "3px 10px", borderRadius: 5, fontSize: "0.76rem", fontWeight: 700, background: statusBg, color: statusColor }}>{bundle.status}</span>
          {ce && (bundle.status === 'Kiện nguyên' || bundle.status === 'Kiện lẻ') && (
            <button onClick={() => onStatusChange(bundle, 'Chưa được bán')}
              style={{ padding: "3px 10px", borderRadius: 5, fontSize: "0.72rem", fontWeight: 600, background: 'rgba(124,92,191,0.1)', color: '#7C5CBF', border: '1px solid rgba(124,92,191,0.3)', cursor: 'pointer' }}>
              🔒 Hold
            </button>
          )}
          {ce && bundle.status === 'Chưa được bán' && (
            <button onClick={() => onStatusChange(bundle, bundle.remainingBoards < bundle.boardCount ? 'Kiện lẻ' : 'Kiện nguyên')}
              style={{ padding: "3px 10px", borderRadius: 5, fontSize: "0.72rem", fontWeight: 600, background: 'rgba(50,79,39,0.1)', color: 'var(--gn)', border: '1px solid rgba(50,79,39,0.3)', cursor: 'pointer' }}>
              🔓 Bỏ hold
            </button>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
          {[
            ...(bundle.supplierBoards != null ? [{ label: "Số tấm NCC", val: `${bundle.supplierBoards} tấm`, sub: true }] : []),
            { label: bundle.supplierBoards != null ? "Số tấm nghiệm thu" : "Số tấm ban đầu", val: `${bundle.boardCount} tấm` },
            { label: "Số tấm còn lại", val: `${bundle.remainingBoards} tấm`, hi: bundle.remainingBoards < bundle.boardCount },
            { label: isM2Bundle ? "Diện tích ban đầu" : "Khối lượng ban đầu", val: `${(bundle.volume || 0).toFixed(isM2Bundle ? 2 : 4)} ${volUnit}` },
            { label: isM2Bundle ? "DT còn lại" : "KL còn lại", val: `${(bundle.remainingVolume || 0).toFixed(isM2Bundle ? 2 : 4)} ${volUnit}`, hi: bundle.remainingVolume < bundle.volume },
          ].map(item => (
            <div key={item.label} style={{ padding: "8px 12px", borderRadius: 7, background: "var(--bgs)", border: "1px solid var(--bd)" }}>
              <div style={{ fontSize: "0.62rem", color: "var(--tm)", fontWeight: 600, marginBottom: 3 }}>{item.label}</div>
              <div style={{ fontSize: "0.9rem", fontWeight: 800, color: item.hi ? "var(--ac)" : "var(--br)" }}>{item.val}</div>
            </div>
          ))}
        </div>

        {/* Thuộc tính */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--tm)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Thuộc tính</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {Object.entries(bundle.attributes || {}).map(([k, v]) => {
              const rawVal = bundle.rawMeasurements?.[k];
              const isManualAttr = bundle.manualGroupAssignment && rawVal;
              return (
                <span key={k} style={{ padding: "3px 9px", borderRadius: 4, background: isManualAttr ? "rgba(242,101,34,0.06)" : "var(--bgs)", border: "1px solid " + (isManualAttr ? "rgba(242,101,34,0.3)" : "var(--bd)"), fontSize: "0.76rem" }}>
                  <span style={{ color: "var(--tm)", fontSize: "0.68rem" }}>{atLabels[k] || k}: </span>
                  {rawVal ? (
                    <>
                      <span style={{ fontWeight: 700 }}>{rawVal}{k === 'length' ? 'm' : k === 'width' ? 'mm' : ''}</span>
                      <span style={{ color: "var(--tm)", fontSize: "0.65rem", marginLeft: 4 }}>({v}{isManualAttr ? " ⚠️" : ""})</span>
                    </>
                  ) : v}
                </span>
              );
            })}
          </div>
          {bundle.manualGroupAssignment && (
            <div style={{ marginTop: 6, fontSize: "0.65rem", color: "var(--ac)", display: "flex", alignItems: "center", gap: 4 }}>
              ⚠️ Một số thuộc tính được gán nhóm thủ công — kích thước thực không khớp hoàn toàn với nhóm giá.
            </div>
          )}
          {/* Hiển thị SKU override nếu có */}
          {priceOvr && Object.keys(priceOvr).length > 0 && (
            <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 6, background: "rgba(124,92,191,0.08)", border: "1px solid rgba(124,92,191,0.25)" }}>
              <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "#7C5CBF", marginBottom: 4 }}>Mã tra giá khác thuộc tính gốc</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {Object.entries(priceOvr).map(([k, v]) => (
                  <span key={k} style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(124,92,191,0.12)", border: "1px solid rgba(124,92,191,0.3)", fontSize: "0.74rem", fontWeight: 700, color: "#7C5CBF" }}>
                    {atLabels[k] || k}: {bundle.attributes[k]} → {v}
                  </span>
                ))}
              </div>
              {priceOvrReason && <div style={{ fontSize: "0.64rem", color: "#7C5CBF", marginTop: 3 }}>Lý do: {priceOvrReason}</div>}
            </div>
          )}
        </div>

        {/* Đổi mã tra giá (SKU override) — chỉ non-perBundle + admin */}
        {!isPerBundleWood && cePrice && ovrAttrs.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            {editingOvr ? (
              <div style={{ padding: "10px 12px", borderRadius: 7, border: "1.5px solid #7C5CBF", background: "rgba(124,92,191,0.04)" }}>
                <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#7C5CBF", marginBottom: 8, textTransform: "uppercase" }}>Đổi mã tra giá (SKU)</div>
                <div style={{ fontSize: "0.64rem", color: "var(--tm)", marginBottom: 8 }}>Chọn giá trị thuộc tính dùng để tra bảng giá. Thuộc tính gốc của kiện không thay đổi.</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                  {ovrAttrs.map(a => (
                    <div key={a.key} style={{ minWidth: 120 }}>
                      <label style={{ display: "block", fontSize: "0.62rem", fontWeight: 600, color: "var(--tm)", marginBottom: 3 }}>{a.label} <span style={{ fontSize: "0.58rem", color: "var(--tm)" }}>(gốc: {a.current})</span></label>
                      <select value={ovrDraft[a.key] || a.current} onChange={e => setOvrDraft(prev => ({ ...prev, [a.key]: e.target.value }))}
                        style={{ width: "100%", padding: "5px 8px", borderRadius: 5, border: "1.5px solid " + ((ovrDraft[a.key] && ovrDraft[a.key] !== a.current) ? "#7C5CBF" : "var(--bd)"), fontSize: "0.78rem", outline: "none", background: (ovrDraft[a.key] && ovrDraft[a.key] !== a.current) ? "rgba(124,92,191,0.06)" : "#fff" }}>
                        {a.values.map(v => <option key={v} value={v}>{v}{v === a.current ? ' (gốc)' : ''}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                {ovrHasChanges && (
                  <div style={{ fontSize: "0.68rem", color: "#7C5CBF", marginBottom: 8, fontWeight: 600 }}>
                    SKU tra giá: {ovrAttrs.map(a => ovrDraft[a.key] || a.current).join(' / ')}
                    {' '}(gốc: {ovrAttrs.map(a => a.current).join(' / ')})
                  </div>
                )}
                <input value={ovrReasonDraft} onChange={e => setOvrReasonDraft(e.target.value)} placeholder="Lý do đổi mã tra giá (bắt buộc)"
                  style={{ width: "100%", padding: "5px 8px", borderRadius: 5, border: "1.5px solid " + (ovrReasonDraft.trim() ? "#7C5CBF" : "var(--dg)"), fontSize: "0.76rem", outline: "none", boxSizing: "border-box", marginBottom: 8 }} />
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={handleSaveOvr} disabled={saving || !ovrHasChanges || !ovrReasonDraft.trim()}
                    style={{ padding: "5px 14px", borderRadius: 5, border: "none", background: ovrHasChanges && ovrReasonDraft.trim() ? "#7C5CBF" : "var(--bd)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.74rem" }}>
                    {saving ? '...' : 'Lưu mã tra giá'}
                  </button>
                  <button onClick={() => setEditingOvr(false)} style={{ padding: "5px 10px", borderRadius: 5, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontSize: "0.74rem" }}>Hủy</button>
                  {priceOvr && <button onClick={handleClearOvr} style={{ padding: "5px 10px", borderRadius: 5, border: "1.5px solid var(--dg)", background: "transparent", color: "var(--dg)", cursor: "pointer", fontSize: "0.72rem" }}>Xóa đổi mã</button>}
                </div>
              </div>
            ) : (
              <button onClick={handleStartOvr}
                style={{ padding: "4px 12px", borderRadius: 5, border: "1.5px solid #7C5CBF", background: "rgba(124,92,191,0.06)", color: "#7C5CBF", cursor: "pointer", fontWeight: 700, fontSize: "0.72rem" }}>
                {priceOvr ? '✏ Sửa mã tra giá' : '⚡ Đổi mã tra giá (SKU)'}
              </button>
            )}
          </div>
        )}

        {/* Giá kiện */}
        {(isPerBundleWood || skuPrice != null || cePrice) && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--tm)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Giá bán</div>

            {/* perBundle: chỉnh unit_price trực tiếp */}
            {isPerBundleWood && (editingPrice ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="number" min="0.01" step="0.1" value={priceVal} onChange={e => setPriceVal(e.target.value)}
                  autoFocus placeholder="VD: 14.5"
                  style={{ width: 120, padding: "6px 9px", borderRadius: 6, border: "1.5px solid var(--ac)", fontSize: "0.88rem", outline: "none" }} />
                <span style={{ fontSize: "0.76rem", color: "var(--ts)" }}>tr/m³</span>
                <button onClick={handleSavePrice} disabled={saving} style={{ padding: "5px 14px", borderRadius: 6, border: "none", background: "var(--ac)", color: "#fff", cursor: saving ? "not-allowed" : "pointer", fontWeight: 700, fontSize: "0.74rem" }}>{saving ? '...' : 'Lưu'}</button>
                <button onClick={() => setEditingPrice(false)} style={{ padding: "5px 10px", borderRadius: 6, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontSize: "0.74rem" }}>Hủy</button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: "1rem", fontWeight: 800, color: unitPrice ? "var(--br)" : "var(--tm)" }}>{unitPrice ? `${unitPrice} tr/m³` : 'Chưa có giá'}</span>
                {cePrice && <button onClick={() => { setPriceVal(unitPrice ? String(unitPrice) : ''); setEditingPrice(true); }} style={{ padding: "3px 10px", borderRadius: 5, border: "1.5px solid var(--ac)", background: "var(--acbg)", color: "var(--ac)", cursor: "pointer", fontWeight: 700, fontSize: "0.72rem" }}>Sửa giá</button>}
              </div>
            ))}

            {/* non-perBundle: điều chỉnh % hoặc +/- so với bảng giá */}
            {!isPerBundleWood && (() => {
              const effPrice = skuPrice != null && priceAdj
                ? priceAdj.type === 'percent'
                  ? skuPrice * (1 + priceAdj.value / 100)
                  : skuPrice + priceAdj.value
                : skuPrice;
              const diff = priceAdj && skuPrice != null
                ? priceAdj.type === 'percent'
                  ? skuPrice * priceAdj.value / 100
                  : priceAdj.value
                : null;
              return (
                <div>
                  {/* Hiển thị giá */}
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                    {effPrice != null
                      ? <span style={{ fontSize: "1rem", fontWeight: 800, color: "var(--br)" }}>{effPrice.toFixed(2)} tr/m³</span>
                      : <span style={{ fontSize: "0.88rem", color: "var(--tm)" }}>Chưa có giá bảng</span>}
                    {priceAdj && skuPrice != null && (
                      <span style={{ fontSize: "0.72rem", color: diff > 0 ? "var(--gn)" : "var(--dg)", fontWeight: 600 }}>
                        ({diff > 0 ? '+' : ''}{priceAdj.type === 'percent' ? `${priceAdj.value}%` : `${priceAdj.value > 0 ? '+' : ''}${priceAdj.value} tr`} · {priceAdj.reason})
                      </span>
                    )}
                  </div>
                  {skuPrice != null && priceAdj && (
                    <div style={{ fontSize: "0.68rem", color: "var(--tm)", marginBottom: 6 }}>
                      Bảng giá chuẩn: <span style={{ textDecoration: "line-through" }}>{skuPrice.toFixed(2)} tr/m³</span>
                    </div>
                  )}

                  {/* Form điều chỉnh */}
                  {editingPrice ? (
                    <div style={{ padding: "10px 12px", borderRadius: 7, border: "1.5px solid var(--ac)", background: "var(--acbg)", marginTop: 4 }}>
                      <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--ac)", marginBottom: 8, textTransform: "uppercase" }}>Điều chỉnh giá so với bảng</div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                        <select value={adjType} onChange={e => setAdjType(e.target.value)}
                          style={{ padding: "5px 8px", borderRadius: 5, border: "1.5px solid var(--ac)", fontSize: "0.76rem", background: "#fff", outline: "none" }}>
                          <option value="percent">% phần trăm</option>
                          <option value="absolute">tr/m³ tuyệt đối</option>
                        </select>
                        <input type="number" step="0.1" value={adjVal} onChange={e => setAdjVal(e.target.value)} autoFocus
                          placeholder={adjType === 'percent' ? 'VD: -10 hoặc +5' : 'VD: -2.5 hoặc +3'}
                          style={{ width: 130, padding: "5px 8px", borderRadius: 5, border: "1.5px solid var(--ac)", fontSize: "0.82rem", outline: "none" }} />
                        <span style={{ fontSize: "0.72rem", color: "var(--ts)" }}>{adjType === 'percent' ? '%' : 'tr/m³'}</span>
                      </div>
                      {skuPrice != null && adjVal && !isNaN(parseFloat(adjVal)) && (
                        <div style={{ fontSize: "0.68rem", color: "var(--ac)", marginBottom: 8, fontWeight: 600 }}>
                          → {adjType === 'percent'
                            ? `${skuPrice.toFixed(2)} × (1 ${parseFloat(adjVal) >= 0 ? '+' : ''}${parseFloat(adjVal)/100}) = ${(skuPrice * (1 + parseFloat(adjVal)/100)).toFixed(2)} tr/m³`
                            : `${skuPrice.toFixed(2)} + (${adjVal}) = ${(skuPrice + parseFloat(adjVal)).toFixed(2)} tr/m³`}
                        </div>
                      )}
                      <input value={adjReason} onChange={e => setAdjReason(e.target.value)} placeholder="Lý do điều chỉnh (bắt buộc)"
                        style={{ width: "100%", padding: "5px 8px", borderRadius: 5, border: "1.5px solid " + (adjReason.trim() ? "var(--ac)" : "var(--dg)"), fontSize: "0.76rem", outline: "none", boxSizing: "border-box", marginBottom: 8 }} />
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={handleSaveAdj} disabled={saving || !adjVal || !adjReason.trim()}
                          style={{ padding: "5px 14px", borderRadius: 5, border: "none", background: adjVal && adjReason.trim() ? "var(--ac)" : "var(--bd)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.74rem" }}>
                          {saving ? '...' : 'Lưu điều chỉnh'}
                        </button>
                        <button onClick={() => setEditingPrice(false)} style={{ padding: "5px 10px", borderRadius: 5, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontSize: "0.74rem" }}>Hủy</button>
                        {priceAdj && <button onClick={handleClearAdj} style={{ padding: "5px 10px", borderRadius: 5, border: "1.5px solid var(--dg)", background: "transparent", color: "var(--dg)", cursor: "pointer", fontSize: "0.72rem" }}>Xóa điều chỉnh</button>}
                      </div>
                    </div>
                  ) : cePrice && (
                    <button onClick={() => { setAdjType(priceAdj?.type || 'absolute'); setAdjVal(priceAdj ? String(priceAdj.value) : ''); setAdjReason(priceAdj?.reason || ''); setEditingPrice(true); }}
                      style={{ padding: "4px 12px", borderRadius: 5, border: "1.5px solid var(--ac)", background: "var(--acbg)", color: "var(--ac)", cursor: "pointer", fontWeight: 700, fontSize: "0.72rem" }}>
                      {priceAdj ? '✏ Sửa điều chỉnh' : '+ Điều chỉnh giá riêng'}
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* Container */}
        {cont && (
          <div style={{ marginBottom: 14, padding: "8px 12px", borderRadius: 7, background: "var(--bgs)", border: "1px solid var(--bd)", fontSize: "0.78rem" }}>
            <div style={{ fontSize: "0.62rem", color: "var(--tm)", fontWeight: 600, marginBottom: 3 }}>Container</div>
            <div style={{ fontWeight: 700, color: "var(--br)", fontFamily: "monospace" }}>{cont.containerCode}</div>
            {ncc && <div style={{ color: "var(--ts)", marginTop: 2 }}>{ncc.name}</div>}
            {cont.arrivalDate && <div style={{ color: "var(--tm)", fontSize: "0.72rem", marginTop: 1 }}>Ngày về: {cont.arrivalDate}</div>}
          </div>
        )}

        {/* Vị trí */}
        {bundle.location && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            <div style={{ flex: "1 1 180px", padding: "8px 12px", borderRadius: 7, background: "var(--bgs)", border: "1px solid var(--bd)" }}>
              <div style={{ fontSize: "0.62rem", color: "var(--tm)", fontWeight: 600, marginBottom: 3 }}>Vị trí</div>
              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--br)" }}>{bundle.location}</div>
            </div>
          </div>
        )}

        {/* Ghi chú */}
        {bundle.notes && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--tm)", textTransform: "uppercase", marginBottom: 5 }}>Ghi chú bán hàng</div>
            <div style={{ padding: "8px 12px", borderRadius: 7, background: "var(--bgs)", border: "1px solid var(--bd)", fontSize: "0.78rem", color: "var(--ts)", lineHeight: 1.5 }}>{bundle.notes}</div>
          </div>
        )}

        {/* Ảnh + chi tiết tấm — luôn hiển thị */}
        {!editing && (
          <div style={{ marginBottom: 14 }}>
            <ImgRow label="Ảnh kiện" urls={bundle.images || []} />
            <div style={{ marginTop: 10 }}>
              <ImgRow label="Ảnh danh sách chi tiết" urls={bundle.itemListImages || []} />
            </div>
            {bundle.rawMeasurements?.boards?.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <button onClick={() => setBoardDetail(bundle)} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--bd)', background: 'var(--bgs)', color: 'var(--ts)', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>📐 Xem chi tiết tấm ({bundle.rawMeasurements.boards.length} tấm)</button>
              </div>
            )}
          </div>
        )}

        {/* Lịch sử bán hàng */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase", marginBottom: 6 }}>Lịch sử bán hàng</div>
          {loadingSales ? (
            <div style={{ fontSize: "0.72rem", color: "var(--tm)" }}>Đang tải...</div>
          ) : salesHistory.length === 0 ? (
            <div style={{ padding: "8px 12px", borderRadius: 6, border: "1.5px dashed var(--bd)", textAlign: "center", color: "var(--tm)", fontSize: "0.72rem" }}>Chưa có đơn bán</div>
          ) : (
            <div style={{ border: "1px solid var(--bd)", borderRadius: 6, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.72rem" }}>
                <thead><tr style={{ background: "var(--bgh)" }}>
                  <th style={{ padding: "4px 6px", textAlign: "left", color: "var(--brl)", fontWeight: 700, fontSize: "0.56rem", textTransform: "uppercase", borderBottom: "1px solid var(--bds)" }}>Mã đơn</th>
                  <th style={{ padding: "4px 6px", textAlign: "left", color: "var(--brl)", fontWeight: 700, fontSize: "0.56rem", textTransform: "uppercase", borderBottom: "1px solid var(--bds)" }}>Ngày</th>
                  <th style={{ padding: "4px 6px", textAlign: "left", color: "var(--brl)", fontWeight: 700, fontSize: "0.56rem", textTransform: "uppercase", borderBottom: "1px solid var(--bds)" }}>Khách hàng</th>
                  <th style={{ padding: "4px 6px", textAlign: "right", color: "var(--brl)", fontWeight: 700, fontSize: "0.56rem", textTransform: "uppercase", borderBottom: "1px solid var(--bds)" }}>Tấm</th>
                  <th style={{ padding: "4px 6px", textAlign: "right", color: "var(--brl)", fontWeight: 700, fontSize: "0.56rem", textTransform: "uppercase", borderBottom: "1px solid var(--bds)" }}>KL</th>
                  <th style={{ padding: "4px 6px", textAlign: "right", color: "var(--brl)", fontWeight: 700, fontSize: "0.56rem", textTransform: "uppercase", borderBottom: "1px solid var(--bds)" }}>Thành tiền</th>
                  <th style={{ padding: "4px 6px", textAlign: "center", color: "var(--brl)", fontWeight: 700, fontSize: "0.56rem", textTransform: "uppercase", borderBottom: "1px solid var(--bds)" }}>TT</th>
                </tr></thead>
                <tbody>
                  {salesHistory.map((s, i) => {
                    const payBg = s.paymentStatus === 'Đã thanh toán' ? 'rgba(50,79,39,0.1)' : s.paymentStatus === 'Đã đặt cọc' ? 'rgba(41,128,185,0.1)' : 'rgba(242,101,34,0.08)';
                    const payColor = s.paymentStatus === 'Đã thanh toán' ? 'var(--gn)' : s.paymentStatus === 'Đã đặt cọc' ? '#2980b9' : 'var(--ac)';
                    const payLabel = s.paymentStatus === 'Đã thanh toán' ? 'Đã TT' : s.paymentStatus === 'Đã đặt cọc' ? 'Cọc' : s.paymentStatus === 'Công nợ' ? 'Nợ' : 'Chưa';
                    return (
                      <tr key={s.id} data-clickable="true" style={{ background: i % 2 ? "var(--bgs)" : "#fff", cursor: "pointer" }} onClick={() => setOrderDetailId(s.orderId)}>
                        <td style={{ padding: "4px 6px", borderBottom: "1px solid var(--bd)", fontWeight: 600, color: "var(--ac)" }}>{s.orderCode}</td>
                        <td style={{ padding: "4px 6px", borderBottom: "1px solid var(--bd)", whiteSpace: "nowrap", color: "var(--ts)" }}>{fmtDate(s.createdAt)}</td>
                        <td style={{ padding: "4px 6px", borderBottom: "1px solid var(--bd)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={s.customerName}>{s.customerName || '—'}</td>
                        <td style={{ padding: "4px 6px", borderBottom: "1px solid var(--bd)", textAlign: "right" }}>{s.boardCount}</td>
                        <td style={{ padding: "4px 6px", borderBottom: "1px solid var(--bd)", textAlign: "right" }}>{s.volume.toFixed(4)}</td>
                        <td style={{ padding: "4px 6px", borderBottom: "1px solid var(--bd)", textAlign: "right", fontWeight: 700 }}>{fmtMoney(s.amount)}</td>
                        <td style={{ padding: "4px 6px", borderBottom: "1px solid var(--bd)", textAlign: "center" }}>
                          <span style={{ padding: "1px 5px", borderRadius: 3, fontSize: "0.58rem", fontWeight: 700, background: payBg, color: payColor }}>{payLabel}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {salesHistory.length > 0 && (
                  <tfoot><tr style={{ background: "var(--bgh)" }}>
                    <td colSpan={3} style={{ padding: "4px 6px", textAlign: "right", fontWeight: 700, fontSize: "0.62rem", color: "var(--brl)", borderTop: "1.5px solid var(--bds)" }}>Tổng ({salesHistory.length}):</td>
                    <td style={{ padding: "4px 6px", textAlign: "right", fontWeight: 700, borderTop: "1.5px solid var(--bds)" }}>{salesHistory.reduce((s, x) => s + x.boardCount, 0)}</td>
                    <td style={{ padding: "4px 6px", textAlign: "right", fontWeight: 700, borderTop: "1.5px solid var(--bds)" }}>{salesHistory.reduce((s, x) => s + x.volume, 0).toFixed(4)}</td>
                    <td style={{ padding: "4px 6px", textAlign: "right", fontWeight: 800, color: "var(--br)", borderTop: "1.5px solid var(--bds)" }}>{fmtMoney(salesHistory.reduce((s, x) => s + (x.amount || 0), 0))}</td>
                    <td style={{ borderTop: "1.5px solid var(--bds)" }} />
                  </tr></tfoot>
                )}
              </table>
            </div>
          )}
        </div>

        {/* QR */}
        {bundle.qrCode && (
          <div style={{ marginBottom: 14, textAlign: "center" }}>
            <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--tm)", textTransform: "uppercase", marginBottom: 8 }}>Mã QR</div>
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(bundle.qrCode)}`} alt="QR" style={{ borderRadius: 6, border: "1px solid var(--bd)" }} />
            <div style={{ fontSize: "0.68rem", color: "var(--tm)", marginTop: 4, fontFamily: "monospace" }}>{bundle.qrCode}</div>
          </div>
        )}
        {bundle.createdAt && <div style={{ fontSize: "0.7rem", color: "var(--tm)", textAlign: "right" }}>Nhập kho: {fmtDate(bundle.createdAt)}</div>}
      </div>
      {boardDetail && <BoardDetailDialog data={boardDetail} onClose={() => setBoardDetail(null)} wts={wts} notify={notify} />}

      {/* Dialog chi tiết đơn hàng (nested) */}
      {orderDetailId && (
        <Dialog open={true} onClose={() => setOrderDetailId(null)} title={`Đơn ${orderDetail?.order?.orderCode || '...'}`} width={700} noEnter maxHeight="80vh" zIndex={1100}>
          {!orderDetail ? <div style={{ padding: 20, textAlign: 'center', color: 'var(--tm)' }}>Đang tải...</div> : (() => {
            const ho = orderDetail.order;
            const hi = orderDetail.items || [];
            const hs = orderDetail.services || [];
            const hp = orderDetail.paymentRecords || [];
            return (
              <div style={{ fontSize: '0.78rem' }}>
                <div style={{ display: 'flex', gap: 12, marginBottom: 10, padding: '0 2px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: 'var(--br)', marginBottom: 2 }}>{ho.customerType === 'company' ? 'Công ty ' : ho.customerSalutation ? ho.customerSalutation + ' ' : ''}{ho.customerName}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--tm)' }}>{new Date(ho.createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · NV: {ho.salesBy || '—'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--br)' }}>{fmtMoney(ho.totalAmount)}</div>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', marginTop: 2 }}>
                      <span style={{ padding: '1px 6px', borderRadius: 3, fontSize: '0.62rem', fontWeight: 700, background: ho.status === 'Đã xác nhận' ? 'rgba(50,79,39,0.1)' : 'rgba(168,155,142,0.15)', color: ho.status === 'Đã xác nhận' ? 'var(--gn)' : 'var(--tm)' }}>{ho.status}</span>
                      <span style={{ padding: '1px 6px', borderRadius: 3, fontSize: '0.62rem', fontWeight: 700, background: ho.paymentStatus === 'Đã thanh toán' ? 'rgba(50,79,39,0.1)' : ho.paymentStatus === 'Đã đặt cọc' ? 'rgba(41,128,185,0.1)' : 'rgba(242,101,34,0.08)', color: ho.paymentStatus === 'Đã thanh toán' ? 'var(--gn)' : ho.paymentStatus === 'Đã đặt cọc' ? '#2980b9' : 'var(--ac)' }}>{ho.paymentStatus}</span>
                      <span style={{ padding: '1px 6px', borderRadius: 3, fontSize: '0.62rem', fontWeight: 700, background: ho.exportStatus === 'Đã xuất' ? 'rgba(50,79,39,0.1)' : 'rgba(168,155,142,0.1)', color: ho.exportStatus === 'Đã xuất' ? 'var(--gn)' : 'var(--tm)' }}>{ho.exportStatus}</span>
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--brl)', textTransform: 'uppercase', marginBottom: 3 }}>Sản phẩm</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '0.72rem', marginBottom: 8 }}>
                  <colgroup><col style={{ width: 24 }} /><col style={{ width: 90 }} /><col /><col style={{ width: 70 }} /><col style={{ width: 80 }} /><col style={{ width: 85 }} /></colgroup>
                  <thead><tr style={{ background: 'var(--bgh)' }}>
                    {['#', 'Mã', 'Loại gỗ', 'KL', 'Đơn giá', 'Thành tiền'].map((h, i) => (
                      <th key={i} style={{ padding: '3px 4px', textAlign: i >= 3 ? 'right' : i === 0 ? 'center' : 'left', color: 'var(--brl)', fontWeight: 700, fontSize: '0.56rem', textTransform: 'uppercase', borderBottom: '1px solid var(--bds)' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {hi.map((it, idx) => (
                      <tr key={idx} style={{ background: idx % 2 ? 'var(--bgs)' : '#fff' }}>
                        <td style={{ padding: '3px 4px', borderBottom: '1px solid var(--bd)', textAlign: 'center', color: 'var(--tm)', fontSize: '0.64rem' }}>{idx + 1}</td>
                        <td style={{ padding: '3px 4px', borderBottom: '1px solid var(--bd)', fontFamily: 'monospace', fontWeight: 600, fontSize: '0.66rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={it.bundleCode}>{it.bundleCode || '—'}</td>
                        <td style={{ padding: '3px 4px', borderBottom: '1px solid var(--bd)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={wts.find(w => w.id === it.woodId)?.name || it.rawWoodData?.woodTypeName}>{wts.find(w => w.id === it.woodId)?.name || it.rawWoodData?.woodTypeName || '—'}</td>
                        <td style={{ padding: '3px 4px', borderBottom: '1px solid var(--bd)', textAlign: 'right', whiteSpace: 'nowrap' }}>{(it.volume || 0).toFixed(4)}</td>
                        <td style={{ padding: '3px 4px', borderBottom: '1px solid var(--bd)', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtMoney(it.unitPrice)}</td>
                        <td style={{ padding: '3px 4px', borderBottom: '1px solid var(--bd)', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmtMoney(it.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {hs.filter(s => s.amount > 0).length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--brl)', textTransform: 'uppercase', marginBottom: 3 }}>Dịch vụ</div>
                    {hs.filter(s => s.amount > 0).map((s, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 4px', fontSize: '0.72rem', borderBottom: '1px solid var(--bd)', background: i % 2 ? 'var(--bgs)' : '#fff' }}>
                        <span style={{ color: 'var(--ts)' }}>{svcLabel(s)}</span>
                        <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{fmtMoney(s.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ borderTop: '2px solid var(--bds)', paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginBottom: 8 }}>
                  <span>Tổng cộng</span><span style={{ fontSize: '0.88rem', color: 'var(--br)' }}>{fmtMoney(ho.totalAmount)}</span>
                </div>
                {hp.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--brl)', textTransform: 'uppercase', marginBottom: 3 }}>Lịch sử thanh toán</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '0.7rem' }}>
                      <colgroup><col style={{ width: 50 }} /><col style={{ width: 80 }} /><col style={{ width: 95 }} /><col /></colgroup>
                      <thead><tr style={{ background: 'var(--bgh)' }}>
                        {['Ngày', 'Phương thức', 'Số tiền', 'Ghi chú'].map((h, i) => (
                          <th key={i} style={{ padding: '3px 4px', textAlign: i === 2 ? 'right' : i === 1 ? 'center' : 'left', color: 'var(--brl)', fontWeight: 700, fontSize: '0.56rem', textTransform: 'uppercase', borderBottom: '1px solid var(--bds)' }}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {hp.map((r, ri) => (
                          <tr key={r.id || ri} style={{ background: ri % 2 ? 'var(--bgs)' : '#fff' }}>
                            <td style={{ padding: '3px 4px', borderBottom: '1px solid var(--bd)', whiteSpace: 'nowrap', color: 'var(--ts)' }}>{new Date(r.paidAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}</td>
                            <td style={{ padding: '3px 4px', borderBottom: '1px solid var(--bd)', textAlign: 'center' }}>
                              <span style={{ padding: '1px 5px', borderRadius: 3, fontSize: '0.62rem', fontWeight: 700, background: r.method === 'Chuyển khoản' ? 'rgba(41,128,185,0.1)' : 'rgba(39,174,96,0.1)', color: r.method === 'Chuyển khoản' ? '#2980b9' : '#27ae60' }}>{r.method}</span>
                            </td>
                            <td style={{ padding: '3px 4px', borderBottom: '1px solid var(--bd)', textAlign: 'right', fontWeight: 700, color: 'var(--gn)', whiteSpace: 'nowrap' }}>{fmtMoney(r.amount)}{r.discount > 0 ? <span style={{ fontSize: '0.58rem', color: '#8e44ad', marginLeft: 3 }}>+{fmtMoney(r.discount)}</span> : ''}</td>
                            <td style={{ padding: '3px 4px', borderBottom: '1px solid var(--bd)', color: 'var(--tm)', fontSize: '0.64rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.note}>{r.note || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}
        </Dialog>
      )}
    </div>
  );
}

// ── InventoryView ─────────────────────────────────────────────────────────────

function InventoryView({ wts, ats, cfg, prices, bundles, onBack, ce, ugPersist }) {
  const [sw, setSw] = useState(wts[0]?.id || '');
  const [onlyStock, setOnlyStock] = useState(true);
  const [showSplit, setShowSplit] = useState(false);
  const [showMinVol, setShowMinVol] = useState(false);
  const [minThresholds, setMinThresholds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('wh_min_thresholds') || '{}'); } catch { return {}; }
  });
  const [editThKey, setEditThKey] = useState(null);
  const [editThVal, setEditThVal] = useState('');

  const saveThreshold = (key, val) => {
    const v = parseFloat(String(val).replace(',', '.'));
    const next = { ...minThresholds };
    if (isNaN(v) || v <= 0) { delete next[key]; } else { next[key] = v; }
    setMinThresholds(next);
    localStorage.setItem('wh_min_thresholds', JSON.stringify(next));
    setEditThKey(null);
  };

  const isPerBundleWood = wts.find(w => w.id === sw)?.pricingMode === 'perBundle';
  const wc = cfg[sw] || { attrs: [], attrValues: {}, defaultHeader: [] };
  const hak = wc.defaultHeader || [];

  // autoGrp cho thickness khi ugPersist bật
  const grps = useMemo(() => ugPersist && prices ? autoGrp(sw, wc, prices) : null, [ugPersist, prices, sw, wc]);
  // Map từ member thickness → group label (VD: "2F" → "2F – 2.2F")
  const thicknessToGroupLabel = useMemo(() => {
    if (!grps) return null;
    const m = {};
    grps.forEach(g => g.members.forEach(t => { m[t] = g.label; }));
    return m;
  }, [grps]);
  // Danh sách group labels thay thế attrValues.thickness khi ug ON
  const groupedThicknessValues = useMemo(() => grps ? grps.map(g => g.label) : null, [grps]);

  const hAttrs = hak.map(k => ({
    key: k, label: ats.find(a => a.id === k)?.name || k,
    values: (k === 'thickness' && groupedThicknessValues) ? groupedThicknessValues : (wc.attrValues?.[k] || []),
    optional: k === 'width',
  }));
  const rAttrKeys = (wc.attrs || []).filter(k => !hak.includes(k));
  const rAttrs = rAttrKeys.map(k => ({
    key: k,
    label: ats.find(a => a.id === k)?.name || k,
    values: (k === 'thickness' && groupedThicknessValues) ? groupedThicknessValues : (wc.attrValues?.[k] || []),
    optional: k === 'width', // width luôn optional — trống = BT
  }));

  // Build row combinations
  // Attr optional (width không có rangeGroups): thêm combo không có attr → nhận kiện "bình thường"
  const allRC = useMemo(() => {
    let combos = [{}];
    rAttrs.forEach(({ key, values, optional }) => {
      const next = [];
      combos.forEach(c => {
        if (optional) next.push({ ...c }); // combo bình thường (không có attr này)
        values.forEach(v => next.push({ ...c, [key]: v }));
      });
      combos = next;
    });
    return combos;
  }, [rAttrs]);

  // Build col combinations
  const colC = useMemo(() => {
    if (!hAttrs.length) return [{}];
    let combos = [{}];
    hAttrs.forEach(({ key, values, optional }) => {
      const next = [];
      combos.forEach(c => {
        if (optional) next.push({ ...c }); // combo BT (không có attr này)
        values.forEach(v => next.push({ ...c, [key]: v }));
      });
      combos = next;
    });
    return combos;
  }, [hAttrs]);

  // Inventory map: bpk → { boards, volume, count, splitCount }
  // Chỉ dùng configured attrs (wc.attrs) để tính key — nhất quán với getInv
  // Tránh trường hợp bundle có extra attrs (vd: length được thêm qua batch update)
  // làm key không khớp với grid lookup
  const configuredAttrSet = useMemo(() => new Set(wc.attrs || []), [wc]);
  const invMap = useMemo(() => {
    const m = {};
    bundles.filter(b => b.woodId === sw && b.status !== 'Đã bán').forEach(b => {
      const cfgAttrs = Object.fromEntries(
        Object.entries(b.attributes || {}).filter(([k]) => configuredAttrSet.has(k))
      );
      // Resolve rangeGroup attrs về group label để key khớp với grid (vd: "1.6" → "1.5F")
      const resolvedAttrs = { ...cfgAttrs };
      if (wc.rangeGroups) {
        for (const [atId, rg] of Object.entries(wc.rangeGroups)) {
          if (resolvedAttrs[atId] != null && rg?.length) {
            const gl = resolveRangeGroup(String(resolvedAttrs[atId]), rg);
            if (gl) resolvedAttrs[atId] = gl;
          }
        }
      }
      // Resolve alias: "19-29" → "20-29", "A" → "Đẹp"
      if (wc.attrAliases) {
        for (const [atId, aliasMap] of Object.entries(wc.attrAliases)) {
          if (resolvedAttrs[atId] != null && aliasMap) {
            const resolved = Object.entries(aliasMap).find(([, als]) => als?.includes(resolvedAttrs[atId]));
            if (resolved) resolvedAttrs[atId] = resolved[0];
          }
        }
      }
      // Gộp dày: map thickness thực → group label khi ugPersist bật
      if (thicknessToGroupLabel && resolvedAttrs.thickness) {
        const gl = thicknessToGroupLabel[resolvedAttrs.thickness];
        if (gl) resolvedAttrs.thickness = gl;
      }
      // Default missing configured attrs — bỏ qua width (optional: trống = BT)
      (wc.attrs || []).forEach(atId => {
        if (atId === 'width') return;
        if (!resolvedAttrs[atId] && wc.attrValues?.[atId]?.[0]) resolvedAttrs[atId] = wc.attrValues[atId][0];
      });
      const key = bpk(sw, resolvedAttrs);
      if (!m[key]) m[key] = { boards: 0, volume: 0, count: 0, splitCount: 0 };
      m[key].boards += b.remainingBoards || 0;
      m[key].volume += parseFloat(b.remainingVolume) || 0;
      m[key].count += 1;
      if (b.status === 'Kiện lẻ') m[key].splitCount += 1;
    });
    return m;
  }, [bundles, sw, wc, configuredAttrSet, thicknessToGroupLabel]);

  const getInv = (ra, ca) => {
    const key = bpk(sw, { ...ra, ...ca });
    return invMap[key] || null;
  };

  // Orphan detection: bundles trong invMap nhưng không match grid nào
  const orphanData = useMemo(() => {
    const gridKeys = new Set();
    allRC.forEach(r => colC.forEach(c => gridKeys.add(bpk(sw, { ...r, ...c }))));
    const configuredVals = {};
    (wc.attrs || []).forEach(atId => {
      const s = new Set(wc.attrValues?.[atId] || []);
      // Thêm alias values vào configured set
      const aliasMap = wc.attrAliases?.[atId];
      if (aliasMap) Object.values(aliasMap).forEach(als => als?.forEach(a => s.add(a)));
      configuredVals[atId] = s;
    });
    // Nhóm dày: thêm group labels vào configured nếu ugPersist ON
    if (groupedThicknessValues) configuredVals.thickness = new Set(groupedThicknessValues);
    const rows = [];
    Object.entries(invMap).forEach(([key, inv]) => {
      if (gridKeys.has(key) || inv.volume <= 0) return;
      // Parse key → tìm attr nào lệch
      const parts = key.replace(sw + '||', '').split('||');
      const attrs = {};
      const badAttrs = [];
      parts.forEach(p => {
        const [k, ...rest] = p.split(':');
        const v = rest.join(':');
        attrs[k] = v;
        if (configuredVals[k] && !configuredVals[k].has(v)) badAttrs.push({ attr: k, val: v });
      });
      rows.push({ key, attrs, badAttrs, ...inv });
    });
    if (!rows.length) return null;
    const totalVol = rows.reduce((s, r) => s + r.volume, 0);
    const totalCount = rows.reduce((s, r) => s + r.count, 0);
    // Gom theo attr lệch
    const byAttr = {};
    rows.forEach(r => r.badAttrs.forEach(({ attr, val }) => {
      const k = `${attr}:${val}`;
      if (!byAttr[k]) byAttr[k] = { attr, val, count: 0, volume: 0 };
      byAttr[k].count += r.count;
      byAttr[k].volume += r.volume;
    }));
    return { rows, totalVol, totalCount, byAttr: Object.values(byAttr) };
  }, [invMap, allRC, colC, sw, wc, groupedThicknessValues]);

  const visibleColC = onlyStock ? colC.filter(col => allRC.some(row => { const inv = getInv(row, col); return inv && inv.boards > 0; })) : colC;
  const visibleRC = onlyStock ? allRC.filter(row => visibleColC.some(col => { const inv = getInv(row, col); return inv && inv.boards > 0; })) : allRC;

  // Dynamic rowspan cho visibleRC
  const rowSpanMap = useMemo(() => {
    if (rAttrs.length <= 1 || visibleRC.length === 0) return null;
    const map = visibleRC.map((row, rI) =>
      rAttrs.map((at, aI) => {
        if (rI === 0) return { show: true, span: 1 };
        for (let j = 0; j <= aI; j++) {
          if (row[rAttrs[j].key] !== visibleRC[rI - 1][rAttrs[j].key]) return { show: true, span: 1 };
        }
        return { show: false, span: 0 };
      })
    );
    for (let aI = 0; aI < rAttrs.length; aI++) {
      for (let rI = visibleRC.length - 1; rI >= 0; rI--) {
        if (map[rI][aI].show) {
          let span = 1;
          for (let k = rI + 1; k < visibleRC.length && !map[k][aI].show; k++) span++;
          map[rI][aI].span = span;
        }
      }
    }
    return map;
  }, [visibleRC, rAttrs]);

  const hs ={ padding: '5px 8px', textAlign: 'left', background: 'var(--bgh)', color: 'var(--brl)', fontWeight: 700, fontSize: '0.62rem', textTransform: 'uppercase', borderBottom: '2px solid var(--bds)', borderRight: '1px solid var(--bd)', whiteSpace: 'nowrap' };
  const ha = { background: 'var(--br)', color: '#FAF6F0', fontWeight: 800, fontSize: '0.65rem', textAlign: 'center', minWidth: 80 };

  // Pine flat list: sort length → width → thickness
  const pineBundles = useMemo(() => {
    if (!isPerBundleWood) return [];
    return bundles
      .filter(b => b.woodId === sw && b.status !== 'Đã bán')
      .sort((a, b) => {
        const l = parseFloat(a.attributes.length) - parseFloat(b.attributes.length);
        if (l !== 0) return l;
        const w = parseFloat(a.attributes.width) - parseFloat(b.attributes.width);
        if (w !== 0) return w;
        return parseFloat(a.attributes.thickness) - parseFloat(b.attributes.thickness);
      });
  }, [isPerBundleWood, bundles, sw]);

  const { color: pineSts, bg: pineBg } = useMemo(() => ({ color: 'var(--tp)', bg: 'transparent' }), []);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <button onClick={onBack} style={{ padding: '5px 12px', borderRadius: 6, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontWeight: 600, fontSize: '0.76rem' }}>← Danh sách kiện</button>
        <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--br)' }}>📊 Tồn kho theo SKU</h2>
      </div>
      <WoodPicker wts={wts} sel={sw} onSel={setSw} />
      {!isPerBundleWood && (
        <div style={{ display: 'flex', justifyContent: 'flex-start', gap: 14, marginTop: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          {[
            { checked: onlyStock, onChange: setOnlyStock, label: 'Chỉ có tồn kho' },
            { checked: showSplit, onChange: setShowSplit, label: 'Kiện lẻ / tổng kiện' },
            { checked: showMinVol, onChange: setShowMinVol, label: 'Tồn kho tối thiểu' },
          ].map(({ checked, onChange, label }) => (
            <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.76rem', fontWeight: 600, color: 'var(--ts)', cursor: 'pointer' }}>
              <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ width: 15, height: 15, accentColor: 'var(--br)', cursor: 'pointer' }} />
              {label}
            </label>
          ))}
        </div>
      )}

      {/* Pine: flat list theo từng kiện */}
      {isPerBundleWood && (
        <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--bds)', background: 'var(--bgc)', marginTop: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
            <thead>
              <tr>
                {['Mã kiện', 'Chất lượng', 'Dài (mm)', 'Rộng (mm)', 'Dày (mm)', 'Giá (tr/m³)', 'Tấm còn/tổng', 'KL còn/tổng (m³)', 'Trạng thái'].map(h => (
                  <th key={h} style={{ padding: '6px 8px', textAlign: h.includes('KL') || h.includes('Tấm') || h.includes('Giá') ? 'right' : 'left', background: 'var(--bgh)', color: 'var(--brl)', fontWeight: 700, fontSize: '0.62rem', textTransform: 'uppercase', borderBottom: '2px solid var(--bds)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pineBundles.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: 20, textAlign: 'center', color: 'var(--tm)' }}>Không có kiện nào trong kho</td></tr>
              ) : pineBundles.map((b, i) => {
                const { color: sc, bg: sb } = statusSt(b.status);
                return (
                  <tr key={b.id} style={{ background: i % 2 ? 'var(--bgs)' : '#fff' }}>
                    <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--bd)', fontWeight: 700, color: 'var(--br)', fontFamily: 'monospace', fontSize: '0.74rem' }}>{b.bundleCode}</td>
                    <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--bd)' }}>{b.attributes.quality || '—'}</td>
                    <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--bd)', fontWeight: 700 }}>
                      {b.rawMeasurements?.length
                        ? <>{b.rawMeasurements.length}m<span style={{ color: 'var(--tm)', fontSize: '0.65rem', marginLeft: 3 }}>({b.attributes.length})</span></>
                        : b.attributes.length || '—'}
                    </td>
                    <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--bd)' }}>
                      {b.rawMeasurements?.width
                        ? <>{b.rawMeasurements.width}mm<span style={{ color: 'var(--tm)', fontSize: '0.65rem', marginLeft: 3 }}>({b.attributes.width})</span></>
                        : b.attributes.width || '—'}
                    </td>
                    <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--bd)' }}>{b.attributes.thickness || '—'}</td>
                    <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--bd)', textAlign: 'right', fontWeight: 700, color: b.unitPrice ? 'var(--ac)' : 'var(--tm)' }}>{b.unitPrice ? b.unitPrice.toFixed(1) : '—'}</td>
                    <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--bd)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{b.remainingBoards}<span style={{ color: 'var(--tm)', fontSize: '0.65rem' }}>/{b.boardCount}</span>{b.supplierBoards != null && b.supplierBoards !== b.boardCount && <div style={{ fontSize: '0.58rem', color: '#A89B8E' }} title="Số tấm NCC">NCC:{b.supplierBoards}</div>}</td>
                    <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--bd)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{(b.remainingVolume || 0).toFixed(4)}<span style={{ color: 'var(--tm)', fontSize: '0.65rem' }}>/{(b.volume || 0).toFixed(4)}</span></td>
                    <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--bd)' }}><span style={{ padding: '2px 7px', borderRadius: 4, fontSize: '0.65rem', fontWeight: 700, background: sb, color: sc }}>{b.status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Non-pine: matrix 2D */}
      {!isPerBundleWood && (
      <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--bds)', background: 'var(--bgc)' }}>
        <table style={{ width: 'max-content', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
          <colgroup>
            {rAttrs.map(a => <col key={a.key} />)}
            {visibleColC.map((_, i) => <col key={i} style={{ minWidth: 80 }} />)}
            <col style={{ minWidth: 80 }} />{/* Tổng col */}
          </colgroup>
          <thead>
            {hAttrs.length <= 1 ? (
              <tr>
                {rAttrs.map((a, i) => <th key={a.key} style={{ ...hs, position: i === 0 ? 'sticky' : undefined, left: i === 0 ? 0 : undefined, zIndex: i === 0 ? 4 : 2 }}>{a.label}</th>)}
                {hAttrs.length === 0
                  ? <th style={{ ...hs, ...ha }}>Tồn kho</th>
                  : visibleColC.map((c, i) => { const v = c[hAttrs[0].key]; return <th key={v ?? '__bt' + i} style={{ ...hs, ...ha }}>{v != null ? v : <span style={{ fontStyle: 'italic', fontWeight: 400, opacity: 0.8 }}>BT</span>}</th>; })}
                <th style={{ ...hs, ...ha, background: 'var(--sb)' }}>Tổng</th>
              </tr>
            ) : (
              <>
                <tr>
                  {rAttrs.map((a, i) => <th key={a.key} rowSpan={2} style={{ ...hs, position: i === 0 ? 'sticky' : undefined, left: i === 0 ? 0 : undefined, zIndex: i === 0 ? 4 : 2, verticalAlign: 'middle' }}>{a.label}</th>)}
                  {[...(hAttrs[0].optional ? [null] : []), ...hAttrs[0].values].map(v1 => { const cs = visibleColC.filter(c => c[hAttrs[0].key] === v1).length; return cs > 0 ? <th key={v1 ?? '__bt'} colSpan={cs} style={{ ...hs, ...ha, width: 'auto', maxWidth: 'none' }}>{v1 != null ? v1 : <span style={{ fontStyle: 'italic', fontWeight: 400, opacity: 0.8 }}>BT</span>}</th> : null; })}
                  <th rowSpan={2} style={{ ...hs, ...ha, background: 'var(--sb)', verticalAlign: 'middle' }}>Tổng</th>
                </tr>
                <tr>
                  {visibleColC.map((c, i) => <th key={i} style={{ padding: '4px 5px', textAlign: 'center', background: 'var(--brl)', color: '#FAF6F0', fontWeight: 700, fontSize: '0.6rem', borderBottom: '2px solid var(--bds)', borderRight: '1px solid var(--bd)', minWidth: 80 }}>{c[hAttrs[1].key]}</th>)}
                </tr>
              </>
            )}
          </thead>
          <tbody>
            {visibleRC.map((row, rI) => {
              const mg = rowSpanMap ? rowSpanMap[rI][0].show : true;
              return (
              <tr key={rI} style={{ background: rI % 2 === 0 ? '#fff' : 'var(--bgs)', borderTop: mg && rI > 0 ? '2px solid var(--bds)' : undefined }}>
                {rAttrs.map((at, aI) => {
                  if (rowSpanMap) {
                    const cell = rowSpanMap[rI][aI];
                    if (!cell.show) return null;
                    const isF = aI === 0;
                    return (
                      <td key={at.key} rowSpan={cell.span} style={{ padding: '5px 8px', fontWeight: isF ? 800 : 600, color: isF ? 'var(--br)' : 'var(--tp)', borderBottom: '1px solid var(--bd)', borderRight: '1px solid var(--bd)', whiteSpace: 'nowrap', fontSize: isF ? '0.78rem' : '0.72rem', position: isF ? 'sticky' : undefined, left: isF ? 0 : undefined, zIndex: isF ? 1 : 0, background: 'var(--bgc)', verticalAlign: 'middle' }}>
                        {row[at.key] ?? (at.optional ? <span style={{ color: 'var(--tm)', fontWeight: 400, fontStyle: 'italic' }}>Bình thường</span> : '—')}
                      </td>
                    );
                  }
                  return (
                  <td key={at.key} style={{ padding: '5px 8px', fontWeight: aI === 0 ? 800 : 600, color: aI === 0 ? 'var(--br)' : 'var(--tp)', borderBottom: '1px solid var(--bd)', borderRight: '1px solid var(--bd)', whiteSpace: 'nowrap', fontSize: aI === 0 ? '0.78rem' : '0.72rem', position: aI === 0 ? 'sticky' : undefined, left: aI === 0 ? 0 : undefined, zIndex: aI === 0 ? 1 : 0, background: rI % 2 === 0 ? 'var(--bgc)' : 'var(--bgs)' }}>
                    {row[at.key] ?? (at.optional ? <span style={{ color: 'var(--tm)', fontWeight: 400, fontStyle: 'italic' }}>Bình thường</span> : '—')}
                  </td>
                  );
                })}
                {visibleColC.map((col, cI) => {
                  const inv = getInv(row, col);
                  const hasStock = inv && inv.boards > 0;
                  const cellKey = bpk(sw, { ...row, ...col });
                  const minVol = minThresholds[cellKey];
                  const isBelowMin = hasStock && minVol && inv.volume < minVol;
                  const isEditing = editThKey === cellKey;
                  return (
                    <td key={cI} onClick={ce && !isEditing ? () => { setEditThKey(cellKey); setEditThVal(minVol ? String(minVol) : ''); } : undefined}
                      style={{ padding: '5px 6px', textAlign: 'center', borderBottom: '1px solid var(--bd)', borderRight: '1px solid var(--bd)', cursor: ce ? 'pointer' : undefined,
                        background: isBelowMin ? '#fff3e0' : hasStock ? undefined : inv ? 'var(--bgs)' : undefined }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                          <div style={{ fontSize: '0.58rem', color: 'var(--tm)', fontWeight: 600, whiteSpace: 'nowrap' }}>Tối thiểu (m³)</div>
                          <input autoFocus type="text" value={editThVal} onChange={e => setEditThVal(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveThreshold(cellKey, editThVal); if (e.key === 'Escape') setEditThKey(null); }}
                            onBlur={() => saveThreshold(cellKey, editThVal)}
                            style={{ width: 54, textAlign: 'center', fontSize: '0.72rem', padding: '2px 4px', border: '1.5px solid var(--br)', borderRadius: 4, outline: 'none' }} />
                          {minVol && <span style={{ fontSize: '0.55rem', color: '#d32f2f', cursor: 'pointer', textDecoration: 'underline' }}
                            onMouseDown={e => { e.preventDefault(); saveThreshold(cellKey, ''); }}>Xóa ngưỡng</span>}
                        </div>
                      ) : inv ? (
                        <>
                          <div style={{ fontWeight: 700, fontSize: '0.82rem', color: isBelowMin ? '#e65100' : hasStock ? 'var(--br)' : 'var(--tm)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                            {isBelowMin && <span style={{ fontSize: '0.7rem' }}>⚠</span>}
                            {inv.volume.toFixed(1)}
                          </div>
                          {showSplit && inv.count > 0 && <div style={{ fontSize: '0.55rem', color: inv.splitCount > 0 ? '#d32f2f' : 'var(--tm)', fontWeight: inv.splitCount > 0 ? 700 : 400, marginTop: 1 }}>{inv.splitCount}/{inv.count} kiện lẻ</div>}
                          {showMinVol && minVol && <div style={{ fontSize: '0.52rem', color: isBelowMin ? '#e65100' : 'var(--tm)', marginTop: 1 }}>min: {minVol} m³</div>}
                        </>
                      ) : (
                        <span style={{ color: 'var(--tm)', fontSize: '0.7rem' }}>—</span>
                      )}
                    </td>
                  );
                })}
                {/* Row total */}
                {(() => {
                  const rowTotal = visibleColC.reduce((sum, col) => { const inv = getInv(row, col); return sum + (inv?.volume || 0); }, 0);
                  return (
                    <td style={{ padding: '5px 6px', textAlign: 'center', borderBottom: '1px solid var(--bd)', background: 'rgba(90,62,39,0.06)', fontWeight: 800, fontSize: '0.82rem', color: rowTotal > 0 ? 'var(--sb)' : 'var(--tm)' }}>
                      {rowTotal > 0 ? rowTotal.toFixed(1) : '—'}
                    </td>
                  );
                })()}
              </tr>
              );
            })}
            {/* Column totals row */}
            {visibleRC.length > 0 && (
              <tr style={{ borderTop: '2.5px solid var(--bds)' }}>
                {rAttrs.map((at, aI) => (
                  aI === 0
                    ? <td key={at.key} colSpan={rAttrs.length} style={{ padding: '6px 8px', fontWeight: 800, fontSize: '0.78rem', color: 'var(--sb)', borderBottom: '1px solid var(--bd)', borderRight: '1px solid var(--bd)', background: 'rgba(90,62,39,0.06)', position: 'sticky', left: 0, zIndex: 1 }}>Tổng</td>
                    : null
                ))}
                {visibleColC.map((col, cI) => {
                  const colTotal = visibleRC.reduce((sum, row) => { const inv = getInv(row, col); return sum + (inv?.volume || 0); }, 0);
                  return (
                    <td key={cI} style={{ padding: '5px 6px', textAlign: 'center', borderBottom: '1px solid var(--bd)', borderRight: '1px solid var(--bd)', background: 'rgba(90,62,39,0.06)', fontWeight: 800, fontSize: '0.82rem', color: colTotal > 0 ? 'var(--sb)' : 'var(--tm)' }}>
                      {colTotal > 0 ? colTotal.toFixed(1) : '—'}
                    </td>
                  );
                })}
                {(() => {
                  const grandTotal = visibleRC.reduce((sum, row) => visibleColC.reduce((s, col) => { const inv = getInv(row, col); return s + (inv?.volume || 0); }, sum), 0);
                  return (
                    <td style={{ padding: '5px 6px', textAlign: 'center', borderBottom: '1px solid var(--bd)', background: 'rgba(90,62,39,0.10)', fontWeight: 900, fontSize: '0.88rem', color: 'var(--sb)' }}>
                      {grandTotal > 0 ? grandTotal.toFixed(1) : '—'}
                    </td>
                  );
                })()}
              </tr>
            )}
          </tbody>
        </table>
        {visibleRC.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--tm)' }}>{onlyStock ? 'Không có SKU nào còn tồn kho' : 'Chưa có cấu hình SKU cho loại gỗ này'}</div>}
      </div>
      )}

      {/* Orphan warning */}
      {orphanData && (
        <div style={{ marginTop: 14, background: '#FFF8F0', borderRadius: 10, border: '1.5px solid #E8A838', padding: '12px 16px' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#C07000', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '1rem' }}>⚠</span>
            {orphanData.totalCount} kiện ({orphanData.totalVol.toFixed(1)} m³) không khớp cấu hình SKU
          </div>
          <div style={{ fontSize: '0.68rem', color: '#8B6914', marginBottom: 10, lineHeight: 1.5 }}>
            Các kiện dưới đây có giá trị thuộc tính không nằm trong danh sách chip đã cấu hình — không được hiển thị trong bảng tồn kho và không có giá.
            Cần <strong>thêm chip</strong> trong Cấu hình hoặc <strong>migrate giá trị</strong> để khớp chip hiện tại.
          </div>

          {/* Tóm tắt theo attr lệch */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {orphanData.byAttr.map(({ attr, val, count, volume }) => (
              <div key={`${attr}:${val}`} style={{ padding: '5px 10px', borderRadius: 6, background: '#FDE8C8', border: '1px solid #E8A838', fontSize: '0.7rem' }}>
                <strong style={{ color: '#C07000' }}>{ats.find(a => a.id === attr)?.name || attr}</strong>
                {' = '}
                <span style={{ color: '#8B2500', fontWeight: 700 }}>"{val}"</span>
                <span style={{ color: '#8B6914', marginLeft: 6 }}>{count} kiện · {volume.toFixed(1)} m³</span>
              </div>
            ))}
          </div>

          {/* Bảng chi tiết */}
          <div style={{ maxHeight: 220, overflowY: 'auto', borderRadius: 6, border: '1px solid #E8C888' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.68rem' }}>
              <thead>
                <tr style={{ background: '#F5E6CC' }}>
                  {(wc.attrs || []).map(atId => (
                    <th key={atId} style={{ padding: '4px 6px', textAlign: 'left', fontWeight: 700, color: '#6B4400', borderBottom: '1px solid #E8C888' }}>
                      {ats.find(a => a.id === atId)?.name || atId}
                    </th>
                  ))}
                  <th style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 700, color: '#6B4400', borderBottom: '1px solid #E8C888' }}>Kiện</th>
                  <th style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 700, color: '#6B4400', borderBottom: '1px solid #E8C888' }}>KL (m³)</th>
                </tr>
              </thead>
              <tbody>
                {orphanData.rows.map((r, i) => {
                  const badSet = new Set(r.badAttrs.map(b => b.attr));
                  return (
                    <tr key={i} style={{ background: i % 2 ? '#FFF8F0' : '#fff' }}>
                      {(wc.attrs || []).map(atId => (
                        <td key={atId} style={{
                          padding: '4px 6px', borderBottom: '1px solid #F0DFC0',
                          color: badSet.has(atId) ? '#C02000' : '#6B4400',
                          fontWeight: badSet.has(atId) ? 800 : 400,
                          background: badSet.has(atId) ? 'rgba(200,40,0,0.07)' : 'transparent',
                        }}>
                          {r.attrs[atId] || '—'}
                        </td>
                      ))}
                      <td style={{ padding: '4px 6px', textAlign: 'right', borderBottom: '1px solid #F0DFC0', color: '#6B4400' }}>{r.count}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', borderBottom: '1px solid #F0DFC0', color: '#6B4400', fontWeight: 700 }}>{r.volume.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── BundleImportForm ───────────────────────────────────────────────────────────

const HEADER_ALIASES = {
  'loại_gỗ': 'wood_id', 'loai_go': 'wood_id', 'gỗ': 'wood_id', 'go': 'wood_id',
  'mã_kiện': 'bundle_code', 'ma_kien': 'bundle_code', 'mã_ncc': 'bundle_code', 'ma_ncc': 'bundle_code',
  'số_tấm': 'board_count', 'so_tam': 'board_count', 'st': 'board_count',
  'tấm_còn': 'remaining_boards', 'tam_con': 'remaining_boards', 'còn_lại': 'remaining_boards', 'con_lai': 'remaining_boards', 'số_tấm_còn': 'remaining_boards', 'so_tam_con': 'remaining_boards', 'st_còn': 'remaining_boards', 'st_con': 'remaining_boards', 'st_còn_lại': 'remaining_boards', 'st_con_lai': 'remaining_boards',
  'khối_lượng': 'volume', 'khoi_luong': 'volume', 'm3': 'volume', 'thể_tích': 'volume', 'the_tich': 'volume',
  'kl_còn': 'remaining_volume', 'kl_con': 'remaining_volume', 'kl_còn_lại': 'remaining_volume', 'kl_con_lai': 'remaining_volume', 'khối_lượng_còn_lại': 'remaining_volume', 'khoi_luong_con_lai': 'remaining_volume', 'khối_lượng_cl': 'remaining_volume', 'khoi_luong_cl': 'remaining_volume', 'khối_lượng_còn': 'remaining_volume', 'khoi_luong_con': 'remaining_volume',
  'đơn_giá': 'unit_price', 'don_gia': 'unit_price', 'giá': 'unit_price', 'gia': 'unit_price',
  'vị_trí': 'location', 'vi_tri': 'location', 'kho': 'location',
  'ghi_chú': 'notes', 'ghi_chu': 'notes',
  'dày': 'thickness', 'day': 'thickness', 'độ_dày': 'thickness', 'do_day': 'thickness',
  'chất_lượng': 'quality', 'chat_luong': 'quality', 'cl': 'quality',
  'dài': 'length', 'dai': 'length', 'chiều_dài': 'length', 'chieu_dai': 'length', 'độ_dài': 'length', 'do_dai': 'length',
  'ncc': 'supplier', 'nhà_cung_cấp': 'supplier', 'nha_cung_cap': 'supplier',
  'rộng': 'width', 'rong': 'width', 'bản_rộng': 'width', 'ban_rong': 'width', 'độ_rộng': 'width', 'do_rong': 'width',
  'dong_cạnh': 'edging', 'dong_canh': 'edging', 'cạnh': 'edging', 'canh': 'edging', 'dc': 'edging',
};

function parseCSVText(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
  if (!lines.length) return [];
  const parseRow = (line) => {
    const cells = []; let cur = ''; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && !inQ && cur === '') { inQ = true; }
      else if (ch === '"' && inQ) { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else if (ch === ',' && !inQ) { cells.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  };
  const headers = parseRow(lines[0]).map(h => {
    const norm = h.toLowerCase().replace(/\s+/g, '_');
    return HEADER_ALIASES[norm] || norm;
  });
  return lines.slice(1).filter(l => l.trim()).map(l => {
    const cells = parseRow(l);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (cells[i] || '').trim(); });
    return obj;
  });
}

function BundleImportForm({ wts, ats, cfg, useAPI, notify, onDone, existingBundles = [] }) {
  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState(null); // null = not parsed yet
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(null); // { done, total, errors[] }
  const [editCell, setEditCell] = useState(null); // { rowIdx, colKey }
  const [editVal, setEditVal] = useState('');
  const [mode, setMode] = useState('add'); // 'add' | 'update'
  const editInputRef = React.useRef(null);
  const fileRef = React.useRef(null);

  // All attribute IDs across all wood types
  const allAttrIds = useMemo(() => [...new Set(Object.values(cfg).flatMap(c => c.attrs || []))], [cfg]);

  const TEMPLATE_HEADER = ['wood_id', 'bundle_code', 'board_count', 'remaining_boards', 'volume', 'remaining_volume', 'unit_price', 'location', 'notes', ...allAttrIds];

  // Lookup map cho update mode
  const existingByCode = useMemo(
    () => Object.fromEntries(existingBundles.filter(b => b.bundleCode).map(b => [b.bundleCode, b])),
    [existingBundles]
  );

  // Normalize wood_id: accept both ID (walnut) and name (Óc Chó)
  const resolveWood = (val) => {
    const v = val?.trim() || '';
    const byId = wts.find(w => w.id.toLowerCase() === v.toLowerCase());
    if (byId) return byId.id;
    const byName = wts.find(w => w.name.toLowerCase() === v.toLowerCase() || w.nameEn?.toLowerCase() === v.toLowerCase());
    return byName ? byName.id : null;
  };

  // V-22: build set bundleCode đã tồn tại trong kho
  const existingCodes = useMemo(
    () => new Set(existingBundles.map(b => b.bundleCode).filter(Boolean)),
    [existingBundles]
  );

  // ── Update mode: chỉ cần bundle_code để match, attr nào có giá trị thì cập nhật ──
  const validateRowsUpdate = (rows) => {
    const batchCodes = {};
    rows.forEach((row, i) => { if (row.bundle_code) batchCodes[row.bundle_code] = (batchCodes[row.bundle_code] || []).concat(i + 1); });
    return rows.map((row, i) => {
      const errors = [];
      const code = (row.bundle_code || '').trim();
      if (!code) errors.push('bundle_code bắt buộc cho chế độ cập nhật');
      else if ((batchCodes[code] || []).length > 1) errors.push(`Mã "${code}" bị trùng trong file (dòng ${batchCodes[code].join(', ')})`);
      const existing = code ? existingByCode[code] : null;
      if (code && !existing) errors.push(`Không tìm thấy kiện mã "${code}" trong kho`);
      const updatedAttrs = {};
      if (existing) {
        const woodCfg = cfg[existing.woodId];
        allAttrIds.forEach(atId => {
          const rawInput = (row[atId] || '').trim();
          if (!rawInput) return; // trống → giữ nguyên giá trị cũ
          const val = rawInput.replace(/\s*-\s*/g, '-');
          const woodRangeGroups = woodCfg?.rangeGroups?.[atId];
          if (woodRangeGroups?.length) {
            const resolved = resolveRangeGroup(val, woodRangeGroups);
            if (resolved) {
              const atDef = ats.find(a => a.id === atId);
              const storeActual = atDef?.groupable || atId === 'thickness';
              if (storeActual) {
                const { value: normVal } = normalizeThickness(val);
                updatedAttrs[atId] = normVal || (/^[\d.]+$/.test(val) ? val + 'F' : val);
              } else {
                updatedAttrs[atId] = resolved;
              }
            } else {
              const allowed = woodCfg?.attrValues?.[atId] || [];
              const aliasMap = woodCfg?.attrAliases?.[atId];
              const aliasHit = aliasMap && Object.entries(aliasMap).find(([, als]) => als?.includes(val));
              if (allowed.includes(val) || aliasHit) updatedAttrs[atId] = val;
              else errors.push(`${atId}="${val}" không khớp nhóm nào. Hợp lệ: ${allowed.join(', ')}`);
            }
          } else {
            updatedAttrs[atId] = val;
          }
        });
      }
      // Parse volume update
      let _newVolume = null, _newRemaining = null, _volumeDelta = null;
      const csvVol = row.volume !== '' && row.volume != null ? parseFloat(row.volume) : null;
      if (csvVol != null && existing) {
        if (isNaN(csvVol) || csvVol <= 0) errors.push('volume phải là số > 0');
        else {
          _newVolume = +csvVol.toFixed(4);
          const oldVol = parseFloat(existing.volume) || 0;
          _volumeDelta = _newVolume - oldVol;
          const oldRem = parseFloat(existing.remainingVolume) || 0;
          if (oldRem <= 0) {
            _newRemaining = 0; // kiện đã bán hết → giữ remaining = 0
          } else {
            _newRemaining = +Math.max(0, oldRem + _volumeDelta).toFixed(4);
          }
        }
      }
      const hasAttrUpdate = Object.keys(updatedAttrs).length > 0;
      if (!hasAttrUpdate && _newVolume == null && !errors.length)
          errors.push('Không có gì cần cập nhật (tất cả cột đều trống)');
      return { ...row, _existing: existing || null, _updatedAttrs: updatedAttrs, _newVolume, _newRemaining, _volumeDelta, _errors: errors, _idx: i + 1 };
    });
  };

  const validateRows = (rows) => {
    // Check trùng trong chính batch CSV
    const batchCodes = {};
    rows.forEach((row, i) => { if (row.bundle_code) { batchCodes[row.bundle_code] = (batchCodes[row.bundle_code] || []).concat(i + 1); } });
    return rows.map((row, i) => {
    const errors = [];
    const woodId = resolveWood(row.wood_id);
    if (!woodId) errors.push(`Loại gỗ "${row.wood_id}" không hợp lệ`);
    const boardCount = parseInt(row.board_count) || 0;
    const volume = parseFloat(row.volume);
    if (!volume || volume <= 0) errors.push('volume phải là số > 0');
    if (!boardCount || boardCount <= 0) errors.push('board_count (số tấm) bắt buộc, phải là số nguyên > 0');
    const hasExplicitRemaining = row.remaining_boards !== '' && row.remaining_boards != null;
    const remainingBoardsRaw = hasExplicitRemaining ? parseInt(row.remaining_boards) : boardCount;
    const remainingBoards = isNaN(remainingBoardsRaw) ? boardCount : remainingBoardsRaw;
    const isClosed = hasExplicitRemaining && remainingBoards === 0;
    if (hasExplicitRemaining) {
      if (isNaN(remainingBoards) || remainingBoards < 0) errors.push('remaining_boards phải là số nguyên ≥ 0');
      else if (remainingBoards > boardCount) errors.push(`remaining_boards (${remainingBoards}) không thể lớn hơn board_count (${boardCount})`);
    }
    const remainingVolumeRaw = row.remaining_volume !== '' && row.remaining_volume != null ? parseFloat(row.remaining_volume) : (isClosed ? 0 : volume);
    if (isNaN(remainingVolumeRaw)) errors.push('remaining_volume phải là số');
    const remainingVolume = isNaN(remainingVolumeRaw) ? 0 : remainingVolumeRaw;
    if (!isClosed) {
      if (remainingVolume < 0) errors.push('remaining_volume phải là số ≥ 0');
      else if (remainingVolume > volume) errors.push(`remaining_volume (${remainingVolume}) không thể lớn hơn volume (${volume})`);
    }
    const volumeAdjustment = isClosed ? remainingVolume : null;
    const woodCfg = woodId && cfg[woodId];
    const attrs = {};
    const rawMeas = {};
    if (woodCfg) {
      (woodCfg.attrs || []).forEach(atId => {
        const rawInput = (row[atId] || '').trim();
        // Normalize khoảng trắng quanh dấu gạch ngang: "1.6 - 2.5" → "1.6-2.5"
        const val = rawInput.replace(/\s*-\s*/g, '-');
        const allowed = woodCfg.attrValues?.[atId] || [];
        const atDef = ats.find(a => a.id === atId);
        const isOptionalAttr = atId === 'width'; // width luôn optional — trống = bình thường
        if (!val) { if (!isOptionalAttr) errors.push(`${atId} bắt buộc cho ${woodId}`); return; }
        // Range attr: thử tự động resolve, nếu không khớp kiểm tra trực tiếp label
        const woodRangeGroups = woodCfg.rangeGroups?.[atId];
        if (woodRangeGroups?.length) {
          const resolved = resolveRangeGroup(val, woodRangeGroups);
          if (resolved) {
            if (atDef?.groupable || atId === 'thickness') {
              // Groupable (thickness): normalize nhất quán
              const { value: normVal } = normalizeThickness(val);
              attrs[atId] = normVal || (/^[\d.]+$/.test(val) ? val + 'F' : val);
            } else {
              // Non-groupable (length): lưu label nhóm vào attributes, actual vào rawMeas
              attrs[atId] = resolved;
              rawMeas[atId] = val;
            }
          } else if (allowed.includes(val)) {
            attrs[atId] = val; // nhập thẳng label nhóm
          } else {
            // Cho phép import — lưu raw value, ghi nhận ngoài khoảng (sẽ hiện trong PgCFG orphan)
            attrs[atId] = val;
            rawMeas[atId] = val;
          }
        } else {
          // Auto thickness: nhập tự do, normalize + validate
          const isAutoThicknessCSV = atId === 'thickness' && wts.find(w => w.id === woodId)?.thicknessMode === 'auto';
          if (isAutoThicknessCSV) {
            const { value: normVal, error: normErr } = normalizeThickness(val);
            if (normVal) attrs[atId] = normVal;
            else errors.push(`thickness="${val}" ${normErr || 'không hợp lệ'}`);
          } else if (allowed.length && !allowed.includes(val)) {
            // Thử alias trước
            const aliasMap = woodCfg.attrAliases?.[atId];
            const aliasResolved = aliasMap && Object.entries(aliasMap).find(([, als]) => als?.includes(val));
            if (aliasResolved) { attrs[atId] = val; } // lưu giá trị gốc, resolve khi tính SKU
            // Thử normalize: "2" → "2F", "2f" → "2F", case-insensitive
            else {
            const candidates = [
              val + 'F',
              val.toUpperCase(),
              val.charAt(0).toUpperCase() + val.slice(1).toLowerCase(),
              /^\d+$/.test(val) ? val + 'F' : null,
              /^\d+f$/i.test(val) ? val.slice(0, -1) + 'F' : null,
            ].filter(Boolean);
            const matched = candidates.find(c => allowed.includes(c));
            if (matched) { attrs[atId] = matched; }
            else {
              // Attr đo lường (ít nhất 1 loại gỗ có rangeGroups cho attr này): lưu giá trị thực, không báo lỗi
              const isRangeableAttr = Object.values(cfg).some(wc => wc.rangeGroups?.[atId]?.length > 0);
              if (isRangeableAttr) { attrs[atId] = val; }
              else { errors.push(`${atId}="${val}" không hợp lệ (${allowed.join(', ')})`); }
            }
            }
          } else attrs[atId] = val;
        }
      });
      // Attrs có giá trị nhưng không cấu hình: lưu thẳng, không validate, không tính skuKey
      const extraAttrs = {};
      allAttrIds.forEach(atId => {
        if ((woodCfg.attrs || []).includes(atId)) return;
        const val = (row[atId] || '').trim();
        if (val) extraAttrs[atId] = val;
      });
      Object.assign(attrs, extraAttrs);
    }
    // V-22: check trùng bundleCode
    if (row.bundle_code) {
      if (existingCodes.has(row.bundle_code)) {
        errors.push(`Mã kiện "${row.bundle_code}" đã tồn tại trong kho`);
      } else if ((batchCodes[row.bundle_code] || []).length > 1) {
        errors.push(`Mã kiện "${row.bundle_code}" bị trùng trong file CSV (dòng ${batchCodes[row.bundle_code].join(', ')})`);
      }
    }
    const unitPriceRaw = row.unit_price?.trim();
    const _unitPrice = unitPriceRaw ? parseFloat(unitPriceRaw) : null;
    const isPerBundleWood = woodId && wts.find(w => w.id === woodId)?.pricingMode === 'perBundle';
    if (_unitPrice !== null && isPerBundleWood && (isNaN(_unitPrice) || _unitPrice <= 0)) errors.push('unit_price phải là số > 0');
    return { ...row, _woodId: woodId, _boardCount: boardCount, _volume: +(volume || 0).toFixed(4), _remainingBoards: remainingBoards, _remainingVolume: isClosed ? 0 : +(remainingVolume || 0).toFixed(4), _volumeAdjustment: volumeAdjustment, _isClosed: isClosed, _unitPrice: isPerBundleWood ? _unitPrice : null, _attrs: attrs, _rawMeas: rawMeas, _errors: errors, _idx: i + 1 };
  });
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      setRawText(text);
      const rows = parseCSVText(text);
      setParsed(mode === 'update' ? validateRowsUpdate(rows) : validateRows(rows));
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const handleParse = () => {
    const rows = parseCSVText(rawText);
    if (!rows.length) return notify('Không tìm thấy dữ liệu', false);
    setParsed(mode === 'update' ? validateRowsUpdate(rows) : validateRows(rows));
    setEditCell(null);
  };

  // Re-validate sau khi sửa cell — giữ nguyên raw fields, tính lại _errors/_attrs/v.v.
  const revalidate = (newParsed) => {
    const rawRows = newParsed.map(r => {
      const raw = {};
      TEMPLATE_HEADER.forEach(h => { raw[h] = r[h] ?? ''; });
      return raw;
    });
    setParsed(validateRows(rawRows));
  };

  const startEdit = (rowIdx, colKey, currentVal) => {
    setEditCell({ rowIdx, colKey });
    setEditVal(currentVal ?? '');
    setTimeout(() => editInputRef.current?.focus(), 0);
  };

  const commitEdit = () => {
    if (!editCell) return;
    const { rowIdx, colKey } = editCell;
    setEditCell(null);
    const newParsed = parsed.map((r, i) => i === rowIdx ? { ...r, [colKey]: editVal } : r);
    revalidate(newParsed);
  };

  const isDuplicateRow = (r) => r._errors.some(e => e.includes('đã tồn tại') || e.includes('bị trùng'));

  const removeDuplicates = () => {
    const filtered = parsed.filter(r => !isDuplicateRow(r));
    const rawRows = filtered.map(r => { const raw = {}; TEMPLATE_HEADER.forEach(h => { raw[h] = r[h] ?? ''; }); return raw; });
    setParsed(validateRows(rawRows));
    setEditCell(null);
  };

  const removeRow = (rowIdx) => {
    const newParsed = parsed.filter((_, i) => i !== rowIdx);
    revalidate(newParsed);
    setEditCell(null);
  };

  const validRows = parsed?.filter(r => r._errors.length === 0) || [];
  const errorRows = parsed?.filter(r => r._errors.length > 0) || [];
  const duplicateRows = parsed?.filter(isDuplicateRow) || [];
  const closedRows = validRows.filter(r => r._isClosed);

  const downloadErrorCSV = (rows, filename) => {
    const header = [...TEMPLATE_HEADER, 'error'];
    const csvRows = rows.map(row => header.map(h => {
      const v = h === 'error' ? (row._errors || [row._apiError || '']).join('; ') : (row[h] ?? '');
      return `"${String(v).replace(/"/g, '""')}"`;
    }).join(','));
    const csv = [header.join(','), ...csvRows].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!validRows.length) return;
    if (!useAPI) return notify('Cần kết nối API', false);
    setImporting(true);
    setProgress({ done: 0, total: validRows.length, apiErrorRows: [], results: [] });
    let addBundle;
    try {
      ({ addBundle } = await import('../api.js'));
    } catch (e) {
      notify('Lỗi tải API: ' + e.message, false);
      setImporting(false);
      return;
    }
    let done = 0; const apiErrorRows = []; const results = [];
    for (const row of validRows) {
      // skuKey chỉ dùng configured attrs để tra bảng giá; extraAttrs lưu vào attributes nhưng không vào skuKey
      const configuredAttrIds = new Set(row._woodId && cfg[row._woodId]?.attrs || []);
      const skuKey = Object.entries(row._attrs).filter(([k, v]) => v && configuredAttrIds.has(k)).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}:${v}`).join('||');
      const hasRaw = Object.keys(row._rawMeas || {}).some(k => row._rawMeas[k]);
      const derivedStatus = row._remainingBoards < row._boardCount ? 'Kiện lẻ' : 'Kiện nguyên';
      try {
        const r = await addBundle({ woodId: row._woodId, containerId: null, skuKey, attributes: row._attrs, boardCount: row._boardCount, remainingBoards: row._remainingBoards, volume: row._volume, remainingVolume: row._remainingVolume, notes: row.notes || '', bundleCode: row.bundle_code || '', location: row.location || '', rawMeasurements: hasRaw ? row._rawMeas : undefined, manualGroupAssignment: false, ...(row._unitPrice ? { unit_price: row._unitPrice } : {}), ...(row._isClosed ? { volumeAdjustment: row._volumeAdjustment } : {}) });
        if (r.error) apiErrorRows.push({ ...row, _apiError: r.error });
        else results.push({ id: r.id, bundleCode: r.bundleCode, woodId: row._woodId, containerId: null, skuKey, attributes: row._attrs, boardCount: row._boardCount, remainingBoards: row._remainingBoards, volume: row._volume, remainingVolume: row._isClosed ? 0 : row._remainingVolume, status: row._isClosed ? 'Đã bán' : derivedStatus, notes: row.notes || '', location: row.location || '', qrCode: r.bundleCode, images: [], itemListImages: [], rawMeasurements: row._rawMeas || {}, manualGroupAssignment: false, createdAt: new Date().toISOString(), ...(row._unitPrice ? { unitPrice: row._unitPrice } : {}), ...(row._isClosed ? { volumeAdjustment: row._volumeAdjustment } : {}) });
      } catch (e) {
        apiErrorRows.push({ ...row, _apiError: e.message });
      }
      done++;
      setProgress({ done, total: validRows.length, apiErrorRows: [...apiErrorRows], results: [...results] });
    }
    setImporting(false);
    // Không tự động gọi onDone — user xem kết quả rồi bấm "Xong"
  };

  const handleUpdate = async () => {
    if (!validRows.length) return;
    if (!useAPI) return notify('Cần kết nối API', false);
    setImporting(true);
    setProgress({ done: 0, total: validRows.length, apiErrorRows: [], results: [] });
    let updateBundleFn;
    try { ({ updateBundle: updateBundleFn } = await import('../api.js')); }
    catch (e) { notify('Lỗi tải API: ' + e.message, false); setImporting(false); return; }
    let done = 0; const apiErrorRows = []; const results = [];
    for (const row of validRows) {
      const b = row._existing;
      const mergedAttrs = { ...b.attributes, ...row._updatedAttrs };
      const configuredAttrIds = new Set(cfg[b.woodId]?.attrs || []);
      const newSkuKey = Object.entries(mergedAttrs).filter(([k, v]) => v && configuredAttrIds.has(k)).sort(([a], [c]) => a.localeCompare(c)).map(([k, v]) => `${k}:${v}`).join('||');
      const updateFields = { attributes: mergedAttrs, sku_key: newSkuKey };
      if (row._newVolume != null) {
        updateFields.volume = row._newVolume;
        updateFields.remaining_volume = row._newRemaining;
      }
      try {
        const r = await updateBundleFn(b.id, updateFields);
        if (r?.error) apiErrorRows.push({ ...row, _apiError: r.error });
        else results.push({ ...b, attributes: mergedAttrs, skuKey: newSkuKey });
      } catch (e) { apiErrorRows.push({ ...row, _apiError: e.message }); }
      done++;
      setProgress({ done, total: validRows.length, apiErrorRows: [...apiErrorRows], results: [...results] });
    }
    setImporting(false);
  };

  // Chọn một gỗ thường + một gỗ perBundle (pine) làm ví dụ
  const exampleWoods = [
    wts.find(w => w.pricingMode !== 'perBundle'),
    wts.find(w => w.pricingMode === 'perBundle'),
  ].filter(Boolean);

  const downloadTemplate = () => {
    const exampleRows = exampleWoods.map((w, wi) => {
      const wc = cfg[w.id] || {};
      const isPartial = wi === 1;
      const row = { wood_id: w.id, bundle_code: `K-00${wi + 1}`, board_count: '20', remaining_boards: isPartial ? '12' : '20', volume: '1.250', remaining_volume: isPartial ? '0.750' : '1.250', unit_price: w.pricingMode === 'perBundle' ? '14.5' : '', location: 'Kho A', notes: isPartial ? 'Kiện lẻ còn lại' : '' };
      allAttrIds.forEach(atId => { row[atId] = (wc.attrValues?.[atId] || [])[0] || ''; });
      return TEMPLATE_HEADER.map(h => `"${row[h] || ''}"`).join(',');
    });
    const csv = [TEMPLATE_HEADER.join(','), ...exampleRows].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'template_kien_go.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const cellSt = (err) => ({ padding: '5px 8px', borderBottom: '1px solid var(--bd)', borderRight: '1px solid var(--bd)', fontSize: '0.72rem', whiteSpace: 'nowrap', background: err ? 'rgba(192,57,43,0.06)' : undefined });

  if (progress) {
    const done = progress.done >= progress.total;
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          {done && <button onClick={() => { setParsed(null); setRawText(''); setProgress(null); setImporting(false); }} style={{ padding: '6px 12px', borderRadius: 6, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 600 }}>← Quay lại</button>}
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--br)' }}>📂 Nhập hàng loạt</h2>
        </div>
        <div style={{ background: 'var(--bgc)', borderRadius: 12, border: '1.5px solid var(--bd)', padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>{importing ? 'Đang nhập...' : 'Hoàn thành'}</span>
              <span style={{ fontSize: '0.82rem', color: 'var(--tm)' }}>{progress.done} / {progress.total}</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: 'var(--bd)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 4, background: 'var(--gn)', width: `${Math.round(progress.done / progress.total * 100)}%`, transition: 'width 0.2s' }} />
            </div>
          </div>
          {done && (
            <div style={{ fontSize: '0.82rem' }}>
              <div style={{ color: 'var(--gn)', fontWeight: 700, marginBottom: 6 }}>✓ {mode === 'update' ? `Đã cập nhật ${progress.results?.length} kiện thành công` : `Đã nhập ${progress.results?.length} kiện thành công`}</div>
              {progress.apiErrorRows?.length > 0 && (
                <div style={{ marginTop: 10, padding: '12px 14px', borderRadius: 8, background: 'rgba(192,57,43,0.05)', border: '1px solid rgba(192,57,43,0.2)' }}>
                  <div style={{ fontWeight: 700, color: 'var(--dg)', marginBottom: 6 }}>⚠ {progress.apiErrorRows.length} kiện không nhập được do lỗi API:</div>
                  {progress.apiErrorRows.map((r, i) => <div key={i} style={{ fontSize: '0.7rem', color: 'var(--dg)', padding: '1px 0' }}>Dòng {r._idx} ({r.bundle_code || r.wood_id}): {r._apiError}</div>)}
                  <button onClick={() => downloadErrorCSV(progress.apiErrorRows, 'kien_loi_api.csv')} style={{ marginTop: 10, padding: '6px 14px', borderRadius: 6, border: '1.5px solid var(--dg)', background: 'transparent', color: 'var(--dg)', cursor: 'pointer', fontWeight: 700, fontSize: '0.74rem' }}>⬇ Tải {progress.apiErrorRows.length} dòng lỗi (CSV)</button>
                </div>
              )}
              <button onClick={() => onDone(progress.results || [], mode)} style={{ marginTop: 16, padding: '8px 20px', borderRadius: 7, border: 'none', background: 'var(--ac)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem' }}>Xong</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => onDone([])} style={{ padding: '6px 12px', borderRadius: 6, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 600 }}>← Quay lại</button>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--br)' }}>📂 Nhập hàng loạt</h2>
        <div style={{ display: 'flex', gap: 4, marginLeft: 8, background: 'var(--bgs)', borderRadius: 7, padding: 3, border: '1px solid var(--bd)' }}>
          {[['add', '+ Thêm mới'], ['update', '✏️ Cập nhật']].map(([m, label]) => (
            <button key={m} onClick={() => { setMode(m); setParsed(null); }}
              style={{ padding: '4px 12px', borderRadius: 5, border: 'none', background: mode === m ? 'var(--bgc)' : 'transparent', color: mode === m ? 'var(--br)' : 'var(--tm)', cursor: 'pointer', fontWeight: mode === m ? 700 : 500, fontSize: '0.74rem', boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>{label}</button>
          ))}
        </div>
      </div>

      {/* Hướng dẫn + Template */}
      <div style={{ background: 'var(--bgc)', borderRadius: 12, border: '1.5px solid var(--bd)', padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--brl)', textTransform: 'uppercase', marginBottom: 10 }}>Format CSV</div>
        <div style={{ overflowX: 'auto', marginBottom: 10 }}>
          <table style={{ borderCollapse: 'collapse', fontSize: '0.68rem', whiteSpace: 'nowrap' }}>
            <thead>
              <tr style={{ background: 'var(--bgh)' }}>
                {TEMPLATE_HEADER.map(h => <th key={h} style={{ padding: '4px 10px', border: '1px solid var(--bd)', fontWeight: 700, color: allAttrIds.includes(h) ? 'var(--ac)' : 'var(--brl)' }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {exampleWoods.map((w, wi) => {
                const wc = cfg[w.id];
                const fixedSamples = {
                  wood_id: w.id,
                  bundle_code: wi === 0 ? 'K-001' : 'K-002',
                  board_count: '20',
                  remaining_boards: wi === 1 ? '12' : '20',
                  volume: '1.250',
                  remaining_volume: wi === 1 ? '0.750' : '1.250',
                  unit_price: w.pricingMode === 'perBundle' ? '14.5' : '',
                  location: wi === 0 ? 'Kho A - Dãy 1' : 'Kho B',
                  notes: wi === 1 ? 'Kiện lẻ còn lại' : '',
                };
                return (
                  <tr key={w.id} style={{ background: wi % 2 === 1 ? 'var(--bgs)' : undefined }}>
                    {TEMPLATE_HEADER.map(h => {
                      if (h in fixedSamples) {
                        const val = fixedSamples[h];
                        return <td key={h} style={{ padding: '4px 10px', border: '1px solid var(--bd)', color: h === 'wood_id' ? 'var(--gn)' : val ? 'var(--tp)' : 'var(--tm)', fontWeight: h === 'wood_id' ? 600 : 400 }}>{val || '—'}</td>;
                      }
                      // attribute column
                      const val = wc?.attrValues?.[h]?.[0] || '';
                      const required = wc?.attrs?.includes(h);
                      return <td key={h} style={{ padding: '4px 10px', border: '1px solid var(--bd)', color: val ? 'var(--tp)' : 'var(--tm)', opacity: required ? 1 : 0.4 }}>{val || (required ? '(bắt buộc)' : '(bỏ trống)')}</td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: '0.68rem', color: 'var(--tm)', marginBottom: 10, lineHeight: 1.7 }}>
          <strong style={{ color: 'var(--ac)' }}>Cột cam</strong> = thuộc tính (bắt buộc theo loại gỗ) &nbsp;·&nbsp;
          <strong>wood_id</strong>: {wts.map(w => w.id).join(', ')} &nbsp;·&nbsp;
          Cũng chấp nhận tên tiếng Việt: {wts.map(w => w.name).join(', ')}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {wts.map(w => {
            const wc = cfg[w.id]; if (!wc) return null;
            return (
              <div key={w.id} style={{ fontSize: '0.65rem', padding: '4px 8px', borderRadius: 5, background: 'var(--bgs)', border: '1px solid var(--bd)' }}>
                <strong>{w.id}</strong>: {(wc.attrs || []).map(atId => `${atId} (${(wc.attrValues?.[atId] || []).join('/')})`).join(' · ')}
              </div>
            );
          })}
        </div>
        <button onClick={downloadTemplate} style={{ marginTop: 12, padding: '6px 14px', borderRadius: 6, border: '1.5px solid var(--bd)', background: 'var(--bgs)', color: 'var(--ts)', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 600 }}>⬇ Tải file mẫu CSV</button>
      </div>

      {/* Upload / Paste */}
      <div style={{ background: 'var(--bgc)', borderRadius: 12, border: '1.5px solid var(--bd)', padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={() => fileRef.current?.click()} style={{ padding: '7px 16px', borderRadius: 6, border: '1.5px solid var(--bd)', background: 'var(--bgs)', color: 'var(--ts)', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem' }}>📁 Chọn file CSV</button>
          <span style={{ fontSize: '0.72rem', color: 'var(--tm)' }}>hoặc dán nội dung CSV vào ô bên dưới</span>
          <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={handleFile} />
        </div>
        <textarea value={rawText} onChange={e => { setRawText(e.target.value); setParsed(null); }} placeholder={'wood_id,bundle_code,board_count,volume,location,notes,' + allAttrIds.join(',') + '\nwalnut,K-001,25,1.250,Kho A,,2F,Fas,,1.6-1.9m,,'}
          style={{ width: '100%', minHeight: 120, padding: '8px 10px', borderRadius: 7, border: '1.5px solid var(--bd)', fontSize: '0.74rem', fontFamily: 'monospace', outline: 'none', resize: 'vertical', boxSizing: 'border-box', background: 'var(--bg)' }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button onClick={handleParse} disabled={!rawText.trim()} style={{ padding: '7px 18px', borderRadius: 6, border: 'none', background: rawText.trim() ? 'var(--br)' : 'var(--bd)', color: rawText.trim() ? '#fff' : 'var(--tm)', cursor: rawText.trim() ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: '0.78rem' }}>🔍 Kiểm tra dữ liệu</button>
          {parsed && <span style={{ fontSize: '0.74rem', color: 'var(--tm)', alignSelf: 'center' }}>{parsed.length} dòng — <span style={{ color: 'var(--gn)', fontWeight: 700 }}>{validRows.length} hợp lệ</span>{closedRows.length > 0 && <span style={{ color: '#ea580c', fontWeight: 700 }}> · {closedRows.length} kiện Đã bán (lịch sử)</span>}{errorRows.length > 0 && <span style={{ color: 'var(--dg)', fontWeight: 700 }}> · {errorRows.length} lỗi</span>}</span>}
        </div>
      </div>

      {/* Preview table */}
      {parsed && parsed.length > 0 && (
        <div style={{ background: 'var(--bgc)', borderRadius: 12, border: '1.5px solid var(--bd)', padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--brl)', textTransform: 'uppercase' }}>
              Xem trước ({parsed.length} dòng)
            </span>
            {validRows.length > 0 && (
              <button onClick={mode === 'update' ? handleUpdate : handleImport} disabled={importing}
                style={{ padding: '5px 16px', borderRadius: 6, border: 'none', background: 'var(--ac)', color: '#fff', cursor: importing ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.76rem' }}>
                {mode === 'update' ? `✏️ Cập nhật ${validRows.length} kiện` : `📥 Nhập ${validRows.length} kiện hợp lệ`}
              </button>
            )}
            {errorRows.length > 0 && (
              <button onClick={() => downloadErrorCSV(errorRows, 'kien_loi.csv')}
                style={{ padding: '5px 14px', borderRadius: 6, border: '1.5px solid var(--dg)', background: 'transparent', color: 'var(--dg)', cursor: 'pointer', fontWeight: 700, fontSize: '0.74rem' }}>
                ⬇ Tải {errorRows.length} dòng lỗi
              </button>
            )}
            {duplicateRows.length > 0 && (
              <button onClick={removeDuplicates}
                style={{ padding: '5px 12px', borderRadius: 6, border: '1.5px solid var(--dg)', background: 'rgba(192,57,43,0.06)', color: 'var(--dg)', cursor: 'pointer', fontWeight: 700, fontSize: '0.72rem' }}>
                ✕ Loại bỏ {duplicateRows.length} trùng mã
              </button>
            )}
            <span style={{ fontSize: '0.65rem', color: 'var(--tm)', marginLeft: 'auto' }}>Click ô để sửa trực tiếp</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: 'max-content', borderCollapse: 'collapse', fontSize: '0.71rem' }}>
              <thead>
                <tr style={{ background: 'var(--bgh)' }}>
                  <th style={{ padding: '5px 8px', border: '1px solid var(--bd)', color: 'var(--brl)', fontWeight: 700 }}>#</th>
                  {TEMPLATE_HEADER.map(h => <th key={h} style={{ padding: '5px 8px', border: '1px solid var(--bd)', color: allAttrIds.includes(h) ? 'var(--ac)' : 'var(--brl)', fontWeight: 700 }}>{h}</th>)}
                  <th style={{ padding: '5px 8px', border: '1px solid var(--bd)', color: 'var(--brl)', fontWeight: 700 }}>Lỗi</th>
                  <th style={{ padding: '5px 8px', border: '1px solid var(--bd)' }}></th>
                </tr>
              </thead>
              <tbody>
                {parsed.map((row, rowIdx) => {
                  const hasErr = row._errors.length > 0;
                  return (
                    <tr key={rowIdx} style={{ background: hasErr ? 'rgba(192,57,43,0.04)' : undefined }}>
                      <td style={{ ...cellSt(hasErr), color: hasErr ? 'var(--dg)' : 'var(--tm)', textAlign: 'center' }}>{row._idx}</td>
                      {TEMPLATE_HEADER.map(h => {
                        const cellHasErr = row._errors.some(e => e.toLowerCase().includes(h.replace('_', ' ')) || e.includes(`${h}=`) || e.includes(`${h} `));
                        const isEditing = editCell?.rowIdx === rowIdx && editCell?.colKey === h;
                        return (
                          <td key={h} style={{ ...cellSt(cellHasErr), padding: 0, minWidth: 70 }}
                            onClick={() => !isEditing && startEdit(rowIdx, h, row[h] ?? '')}>
                            {isEditing
                              ? <input ref={editInputRef} value={editVal}
                                  onChange={e => setEditVal(e.target.value)}
                                  onBlur={commitEdit}
                                  onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditCell(null); }}
                                  style={{ width: '100%', minWidth: 80, padding: '4px 7px', border: 'none', outline: '2px solid var(--ac)', borderRadius: 0, fontSize: '0.71rem', background: 'var(--acbg)', boxSizing: 'border-box' }} />
                              : <span style={{ display: 'block', padding: '5px 8px', cursor: 'text',
                                  color: row._woodId && h === 'wood_id' ? 'var(--gn)' : cellHasErr ? 'var(--dg)' : undefined,
                                  fontWeight: h === 'wood_id' || h === 'board_count' || h === 'volume' ? 600 : 400 }}>
                                  {row[h] || <span style={{ color: 'var(--tm)', fontStyle: 'italic' }}>—</span>}
                                </span>
                            }
                          </td>
                        );
                      })}
                      <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--bd)', fontSize: '0.65rem', color: hasErr ? 'var(--dg)' : row._isClosed ? '#ea580c' : 'var(--gn)', maxWidth: 260, whiteSpace: 'normal' }}>
                        {hasErr ? row._errors.join('; ') : row._isClosed ? `Đã bán · Chênh lệch: ${row._volumeAdjustment > 0 ? '+' : ''}${(row._volumeAdjustment ?? 0).toFixed(4)} m³` : mode === 'update' && row._volumeDelta != null ? `✓ KL: ${row._existing?.volume} → ${row._newVolume} (${row._volumeDelta > 0 ? '+' : ''}${row._volumeDelta.toFixed(4)}) · rem: ${row._newRemaining}` : '✓'}
                      </td>
                      <td style={{ ...cellSt(false), textAlign: 'center', padding: '3px 6px' }}>
                        <button onClick={() => removeRow(rowIdx)} title="Xóa dòng này"
                          style={{ width: 20, height: 20, padding: 0, border: '1px solid var(--bd)', borderRadius: 3, background: 'transparent', color: 'var(--tm)', cursor: 'pointer', fontSize: '0.65rem', lineHeight: 1 }}>✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── BundleAddForm ──────────────────────────────────────────────────────────────

// ── DCBundleAddForm — Nhập kiện DC (dong cạnh) ─────────────────────────────
function DCBundleAddForm({ wts, ats, cfg, bundles, useAPI, notify, onDone }) {
  const sawnWoods = useMemo(() => wts.filter(w => w.productForm === 'processed'), [wts]);
  const [woodId, setWoodId] = useState(sawnWoods[0]?.id || '');
  const [thickness, setThickness] = useState('2');
  const [weightTon, setWeightTon] = useState('');
  const [dimL, setDimL] = useState('');
  const [dimW, setDimW] = useState('');
  const [dimH, setDimH] = useState('');
  const [ratio, setRatio] = useState('85');
  const [volMode, setVolMode] = useState('calc'); // 'weight' | 'calc'
  const [boardCount] = useState('1'); // mặc định 1 — DC không trừ kho theo tấm
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [fmErr, setFmErr] = useState({});

  const woodCfg = useMemo(() => cfg[woodId] || { attrs: [], attrValues: {} }, [cfg, woodId]);

  // Check DC có trong cfg quality không
  const qualityValues = woodCfg.attrValues?.quality || [];
  const hasDC = qualityValues.includes('DC');

  // Thickness values từ cfg
  const thicknessValues = woodCfg.attrValues?.thickness || [];
  const hasThicknessRange = (woodCfg.rangeGroups?.thickness || []).length > 0;
  const isAutoThickness = wts.find(w => w.id === woodId)?.thicknessMode === 'auto';

  // Auto-generate mã kiện DC-yymmdd-NN (max 12 ký tự)
  const nextCode = useMemo(() => {
    const now = new Date();
    const ymd = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const prefix = `DC-${ymd}-`;
    const todayCodes = bundles
      .map(b => b.supplierBundleCode || b.bundleCode || '')
      .filter(c => c.startsWith(prefix))
      .map(c => parseInt(c.slice(prefix.length)) || 0);
    const maxNum = todayCodes.length ? Math.max(...todayCodes) : 0;
    return `${prefix}${String(maxNum + 1).padStart(2, '0')}`;
  }, [bundles]);

  // Tính khối lượng từ kích thước
  const calcVolume = useMemo(() => {
    if (volMode !== 'calc') return null;
    const l = parseFloat(dimL) || 0;
    const w = parseFloat(dimW) || 0;
    const h = parseFloat(dimH) || 0;
    const r = parseFloat(ratio) || 0;
    if (l > 0 && w > 0 && h > 0 && r > 0) return +(l * w * h / 1000000 * (r / 100)).toFixed(4);
    return null;
  }, [volMode, dimL, dimW, dimH, ratio]);

  const finalVolume = volMode === 'calc' ? calcVolume : (parseFloat(weightTon) || null);

  const validate = () => {
    const errs = {};
    if (!woodId) errs.woodId = 'Chọn loại gỗ';
    if (!hasDC) errs.quality = `Loại gỗ "${wts.find(w => w.id === woodId)?.name || woodId}" chưa có chất lượng DC trong cấu hình`;
    if (!thickness) errs.thickness = 'Chọn độ dày';
    if (!finalVolume || finalVolume <= 0) errs.volume = 'Khối lượng phải > 0';
    setFmErr(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    if (!useAPI) return notify('Cần kết nối API', false);
    setSaving(true);
    try {
      const { addBundle } = await import('../api.js');
      const { value: normTh } = normalizeThickness(thickness);
      const finalTh = normTh || thickness;
      const attrs = { quality: 'DC', thickness: finalTh };
      const skuKey = Object.entries(attrs).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}:${v}`).join('||');
      const parsedVol = +finalVolume.toFixed(4);
      // Build ghi chú tự động
      let autoNote = '';
      if (volMode === 'weight') {
        autoNote = 'Gỗ đo tấn';
      } else {
        autoNote = `Đo dài rộng cao: (${dimL}cm x ${dimW}cm x ${dimH}cm x ${ratio}%)`;
      }
      const fullNotes = [autoNote, notes.trim()].filter(Boolean).join(' | ');
      const result = await addBundle({
        woodId, containerId: null, skuKey, attributes: attrs,
        boardCount: 1, volume: parsedVol, notes: fullNotes,
        bundleCode: nextCode, location: '',
      });
      if (result.error) { notify('Lỗi: ' + result.error, false); setSaving(false); return; }
      const newBundle = {
        id: result.id, bundleCode: result.bundleCode, woodId,
        containerId: null, skuKey, attributes: attrs,
        boardCount: 1, remainingBoards: 1,
        volume: parsedVol, remainingVolume: parsedVol,
        status: 'Kiện nguyên', notes: fullNotes, location: '',
        qrCode: result.bundleCode, images: [], itemListImages: [],
        rawMeasurements: {}, manualGroupAssignment: false,
        createdAt: new Date().toISOString(),
      };
      notify(`Đã nhập kiện DC: ${result.bundleCode}`);
      onDone(newBundle);
    } catch (e) { notify('Lỗi: ' + e.message, false); setSaving(false); }
  };

  const ls = { fontSize: '0.76rem', fontWeight: 600, color: 'var(--ts)', marginBottom: 4, display: 'block' };
  const is = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1.5px solid var(--bd)', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box', background: 'var(--bg)' };
  const errS = { fontSize: '0.68rem', color: '#c0392b', marginTop: 2 };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => onDone(null)} style={{ padding: '6px 12px', borderRadius: 6, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 600 }}>← Quay lại</button>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--br)' }}>📦 Nhập kiện DC</h2>
      </div>
      <div style={{ maxWidth: 600, background: 'var(--bgc)', borderRadius: 12, border: '1.5px solid var(--bd)', padding: 24 }}>
        {/* Loại gỗ */}
        <div style={{ marginBottom: 18 }}>
          <label style={ls}>Loại gỗ *</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {sawnWoods.map(w => (
              <button key={w.id} onClick={() => { setWoodId(w.id); setFmErr({}); }}
                style={{ border: woodId === w.id ? '2px solid var(--ac)' : '1.5px solid var(--bd)', background: woodId === w.id ? 'var(--acbg)' : 'var(--bgc)', padding: '6px 14px', borderRadius: 7, cursor: 'pointer', fontWeight: woodId === w.id ? 700 : 500, fontSize: '0.8rem', color: woodId === w.id ? 'var(--ac)' : 'var(--ts)', transition: 'all 0.12s' }}>
                {w.icon} {w.name}
              </button>
            ))}
          </div>
          {!sawnWoods.length && <div style={{ fontSize: '0.76rem', color: 'var(--tm)', fontStyle: 'italic' }}>Chưa có loại gỗ xẻ sấy nào</div>}
          {fmErr.woodId && <div style={errS}>{fmErr.woodId}</div>}
        </div>

        {/* Cảnh báo DC */}
        {!hasDC && woodId && (
          <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(192,57,43,0.08)', border: '1.5px solid rgba(192,57,43,0.3)', color: '#c0392b', fontSize: '0.78rem', fontWeight: 600, marginBottom: 18 }}>
            ⚠ Loại gỗ "{wts.find(w => w.id === woodId)?.name}" chưa có giá trị chất lượng "DC" trong cấu hình. Vui lòng thêm "DC" vào danh sách chất lượng trước khi nhập.
          </div>
        )}

        {/* Mã kiện + Chất lượng */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label style={ls}>Mã kiện (tự sinh)</label>
            <input value={nextCode} readOnly style={{ ...is, background: 'var(--bgs)', color: 'var(--tm)', fontFamily: 'monospace', fontWeight: 700 }} />
          </div>
          <div style={{ flex: '0 0 120px' }}>
            <label style={ls}>Chất lượng</label>
            <input value="DC" readOnly style={{ ...is, background: 'var(--bgs)', fontWeight: 700, textAlign: 'center' }} />
          </div>
        </div>

        {/* Độ dày */}
        <div style={{ marginBottom: 18 }}>
          <label style={ls}>Độ dày *</label>
          {isAutoThickness ? (
            <input value={thickness} onChange={e => setThickness(e.target.value)} placeholder="VD: 2F, 3F, 2.5F..." style={is} />
          ) : thicknessValues.length > 0 ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {thicknessValues.map(v => (
                <button key={v} onClick={() => { setThickness(v); setFmErr(p => ({ ...p, thickness: '' })); }}
                  style={{ padding: '6px 16px', borderRadius: 6, border: thickness === v ? '2px solid var(--ac)' : '1.5px solid var(--bd)', background: thickness === v ? 'var(--acbg)' : 'var(--bgc)', cursor: 'pointer', fontWeight: thickness === v ? 700 : 500, fontSize: '0.8rem', color: thickness === v ? 'var(--ac)' : 'var(--ts)', transition: 'all 0.12s' }}>
                  {v}
                </button>
              ))}
            </div>
          ) : (
            <input value={thickness} onChange={e => setThickness(e.target.value)} placeholder="Nhập độ dày" style={is} />
          )}
          {fmErr.thickness && <div style={errS}>{fmErr.thickness}</div>}
        </div>

        {/* Số tấm */}
        <div style={{ marginBottom: 18 }}>
          <label style={ls}>Số tấm</label>
          <input value="1" readOnly style={{ ...is, width: 80, background: 'var(--bgs)', color: 'var(--tm)', fontWeight: 700, textAlign: 'center' }} />
          <div style={{ fontSize: '0.68rem', color: 'var(--tm)', marginTop: 2 }}>DC không trừ kho theo tấm — mặc định 1 để đại diện</div>
        </div>

        {/* Khối lượng */}
        <div style={{ marginBottom: 18 }}>
          <label style={ls}>Khối lượng (m³) *</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button onClick={() => setVolMode('calc')}
              style={{ padding: '5px 14px', borderRadius: 6, border: volMode === 'calc' ? '2px solid var(--ac)' : '1.5px solid var(--bd)', background: volMode === 'calc' ? 'var(--acbg)' : 'var(--bgc)', cursor: 'pointer', fontWeight: volMode === 'calc' ? 700 : 500, fontSize: '0.76rem', color: volMode === 'calc' ? 'var(--ac)' : 'var(--ts)' }}>
              Đo dài rộng cao
            </button>
            <button onClick={() => setVolMode('weight')}
              style={{ padding: '5px 14px', borderRadius: 6, border: volMode === 'weight' ? '2px solid var(--ac)' : '1.5px solid var(--bd)', background: volMode === 'weight' ? 'var(--acbg)' : 'var(--bgc)', cursor: 'pointer', fontWeight: volMode === 'weight' ? 700 : 500, fontSize: '0.76rem', color: volMode === 'weight' ? 'var(--ac)' : 'var(--ts)' }}>
              Khối lượng cân (tấn)
            </button>
          </div>
          {volMode === 'weight' ? (
            <div>
              <input type="number" value={weightTon} onChange={e => setWeightTon(e.target.value)} placeholder="VD: 0.8508" step="0.0001" min="0" style={{ ...is, width: 200 }} />
              <div style={{ fontSize: '0.68rem', color: 'var(--tm)', marginTop: 4 }}>Nhập khối lượng cân tính bằng tấn (= m³)</div>
            </div>
          ) : (
            <div style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--bgs)', border: '1px solid var(--bd)' }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                <div style={{ flex: '1 1 100px' }}>
                  <label style={{ ...ls, fontSize: '0.7rem' }}>Dài (cm)</label>
                  <input type="number" value={dimL} onChange={e => setDimL(e.target.value)} placeholder="VD: 200" step="1" min="0" style={is} />
                </div>
                <div style={{ flex: '1 1 100px' }}>
                  <label style={{ ...ls, fontSize: '0.7rem' }}>Rộng (cm)</label>
                  <input type="number" value={dimW} onChange={e => setDimW(e.target.value)} placeholder="VD: 98" step="1" min="0" style={is} />
                </div>
                <div style={{ flex: '1 1 100px' }}>
                  <label style={{ ...ls, fontSize: '0.7rem' }}>Cao (cm)</label>
                  <input type="number" value={dimH} onChange={e => setDimH(e.target.value)} placeholder="VD: 110" step="1" min="0" style={is} />
                </div>
                <div style={{ flex: '0 0 90px' }}>
                  <label style={{ ...ls, fontSize: '0.7rem' }}>Tỷ lệ (%)</label>
                  <input type="number" value={ratio} onChange={e => setRatio(e.target.value)} placeholder="85" min="1" max="100" style={is} />
                </div>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--tm)' }}>
                Công thức: Dài(cm) × Rộng(cm) × Cao(cm) ÷ 1.000.000 × Tỷ lệ(%)
              </div>
              {calcVolume !== null && (
                <div style={{ marginTop: 6, fontSize: '0.88rem', fontWeight: 800, color: 'var(--br)' }}>
                  = {calcVolume.toFixed(4)} m³
                  <span style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--tm)', marginLeft: 8 }}>
                    ({dimL}cm × {dimW}cm × {dimH}cm × {ratio}%)
                  </span>
                </div>
              )}
            </div>
          )}
          {fmErr.volume && <div style={errS}>{fmErr.volume}</div>}
        </div>

        {/* Ghi chú */}
        <div style={{ marginBottom: 24 }}>
          <label style={ls}>Ghi chú</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="VD: hàng dài, hàng đẹp..." rows={2} style={{ ...is, resize: 'vertical', minHeight: 50 }} />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleSave} disabled={saving || !hasDC}
            style={{ padding: '9px 24px', borderRadius: 7, border: 'none', background: hasDC ? 'var(--ac)' : 'var(--tm)', color: '#fff', cursor: hasDC ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: '0.82rem', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Đang lưu...' : '📦 Nhập kiện DC'}
          </button>
          <button onClick={() => onDone(null)} style={{ padding: '9px 20px', borderRadius: 7, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>Hủy</button>
        </div>
      </div>
    </div>
  );
}

// ── BundleAddForm ───────────────────────────────────────────────────────────
function BundleAddForm({ wts, ats, cfg, containers, prices, bundles, cePrice, useAPI, notify, setPg, onDone, onAutoAddChip }) {
  const [fm, setFm] = useState({ woodId: wts[0]?.id || '', containerId: '', boardCount: '', volume: '', notes: '', bundleCode: '', location: '' });
  const [attrs, setAttrs] = useState({});
  const [rawMeasurements, setRawMeasurements] = useState({}); // { atId: "1.6-1.9" } — giá trị đo thực cho range attrs
  const [manualGroups, setManualGroups] = useState({});       // { atId: true } — gán thủ công vì không khớp tự động
  const [fmErr, setFmErr] = useState({});
  const [saving, setSaving] = useState(false);
  const [images, setImages] = useState([]);
  const [itemListImages, setItemListImages] = useState([]);
  const [unitPrice, setUnitPrice] = useState('');

  const woodCfg = useMemo(() => cfg[fm.woodId] || { attrs: [], attrValues: {} }, [cfg, fm.woodId]);
  const availContainers = useMemo(() => containers.filter(c => c.status !== 'Đã nhập kho'), [containers]);
  const isPerBundleWood = wts.find(w => w.id === fm.woodId)?.pricingMode === 'perBundle';
  const isM2Form = isM2Wood(fm.woodId, wts);
  const volUnitForm = isM2Form ? 'm²' : 'm³';

  // Auto-suggest price from same-spec bundles
  const suggestedPrice = useMemo(() => {
    if (!isPerBundleWood || !bundles) return null;
    const sameSpec = bundles.filter(b =>
      b.woodId === fm.woodId &&
      b.unitPrice &&
      Object.keys(attrs).every(k => b.attributes[k] === attrs[k])
    );
    if (!sameSpec.length) return null;
    return sameSpec[sameSpec.length - 1].unitPrice; // dùng giá của kiện gần nhất
  }, [isPerBundleWood, bundles, fm.woodId, attrs]);

  useEffect(() => {
    const defaultAttrs = {};
    (woodCfg.attrs || []).forEach(atId => {
      // Range attrs: không pre-select, để trống chờ nhập thực tế
      if (woodCfg.rangeGroups?.[atId]?.length) { defaultAttrs[atId] = ''; return; }
      const vals = woodCfg.attrValues?.[atId] || [];
      defaultAttrs[atId] = vals[0] || '';
    });
    setAttrs(defaultAttrs);
    setRawMeasurements({});
    setManualGroups({});
  }, [fm.woodId, woodCfg, ats]);

  const computeSkuKey = () =>
    Object.entries(attrs).filter(([, v]) => v).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}:${v}`).join('||');

  const validate = () => {
    const errs = {};
    if (!fm.woodId) errs.woodId = 'Chọn loại gỗ';
    if (!fm.boardCount || parseInt(fm.boardCount) <= 0) errs.boardCount = 'Nhập số tấm';
    if (!fm.volume || parseFloat(fm.volume) <= 0) errs.volume = 'Nhập khối lượng';
    (woodCfg.attrs || []).forEach(atId => {
      const isOptional = atId === 'width'; // width luôn optional — để trống = bình thường
      if (!isOptional && !attrs[atId]) errs[`attr_${atId}`] = 'Bắt buộc';
    });
    setFmErr(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    if (!useAPI) return notify('Cần kết nối API để nhập kho', false);
    setSaving(true);
    try {
      const { addBundle, uploadBundleImage, updateBundle } = await import('../api.js');
      const skuKey = computeSkuKey();
      const hasRaw = Object.keys(rawMeasurements).some(k => rawMeasurements[k]);
      const parsedUnitPrice = isPerBundleWood && cePrice && unitPrice ? parseFloat(unitPrice) : undefined;
      const parsedVol = +parseFloat(fm.volume).toFixed(4);
      const result = await addBundle({ woodId: fm.woodId, containerId: fm.containerId || null, skuKey, attributes: Object.fromEntries(Object.entries(attrs).filter(([, v]) => v)), boardCount: parseInt(fm.boardCount), volume: parsedVol, notes: fm.notes, bundleCode: fm.bundleCode, location: fm.location, rawMeasurements: hasRaw ? rawMeasurements : undefined, manualGroupAssignment: Object.values(manualGroups).some(Boolean), ...(parsedUnitPrice ? { unit_price: parsedUnitPrice } : {}) });
      if (result.error) { notify('Lỗi: ' + result.error, false); setSaving(false); return; }

      let imgUrls = [], itemImgUrls = [];
      for (const img of images) { const r = await uploadBundleImage(result.bundleCode, img.file, 'photo'); if (r.error) throw new Error('Upload ảnh kiện: ' + r.error); imgUrls.push(r.url); }
      for (const img of itemListImages) { const r = await uploadBundleImage(result.bundleCode, img.file, 'item-list'); if (r.error) throw new Error('Upload ảnh chi tiết: ' + r.error); itemImgUrls.push(r.url); }
      if (imgUrls.length || itemImgUrls.length) {
        await updateBundle(result.id, { ...(imgUrls.length && { images: imgUrls }), ...(itemImgUrls.length && { item_list_images: itemImgUrls }) });
      }

      const parsedUnitPriceForState = isPerBundleWood && cePrice && unitPrice ? parseFloat(unitPrice) : undefined;
      const newBundle = { id: result.id, bundleCode: result.bundleCode, woodId: fm.woodId, containerId: fm.containerId ? parseInt(fm.containerId) : null, skuKey, attributes: { ...attrs }, boardCount: parseInt(fm.boardCount), remainingBoards: parseInt(fm.boardCount), volume: parsedVol, remainingVolume: parsedVol, status: 'Kiện nguyên', notes: fm.notes, location: fm.location, qrCode: result.bundleCode, images: imgUrls, itemListImages: itemImgUrls, rawMeasurements: rawMeasurements, manualGroupAssignment: Object.values(manualGroups).some(Boolean), createdAt: new Date().toISOString(), ...(parsedUnitPriceForState ? { unitPrice: parsedUnitPriceForState } : {}) };

      // Auto-add thickness chip nếu thicknessMode=auto
      const thVal = attrs.thickness;
      if (thVal && onAutoAddChip && wts.find(w => w.id === fm.woodId)?.thicknessMode === 'auto') {
        onAutoAddChip(fm.woodId, [thVal]);
      }

      notify(`Đã nhập kiện ${result.bundleCode}`);
      onDone(newBundle);
    } catch (e) { notify('Lỗi: ' + e.message, false); setSaving(false); }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={() => onDone(null)} style={{ padding: "6px 12px", borderRadius: 6, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontSize: "0.76rem", fontWeight: 600 }}>← Quay lại</button>
        <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "var(--br)" }}>📥 Nhập kiện gỗ mới</h2>
      </div>
      <div style={{ maxWidth: 720, background: "var(--bgc)", borderRadius: 12, border: "1.5px solid var(--bd)", padding: 24 }}>
        {/* Wood type */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "var(--brl)", marginBottom: 6, textTransform: "uppercase" }}>Loại gỗ *</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {wts.map(w => (
              <button key={w.id} onClick={() => { setFm(p => ({ ...p, woodId: w.id })); setFmErr(p => ({ ...p, woodId: '' })); }}
                style={{ padding: "6px 12px", borderRadius: 6, border: fm.woodId === w.id ? "2px solid var(--ac)" : "1.5px solid var(--bd)", background: fm.woodId === w.id ? "var(--acbg)" : "var(--bgc)", color: fm.woodId === w.id ? "var(--ac)" : "var(--ts)", cursor: "pointer", fontWeight: fm.woodId === w.id ? 700 : 500, fontSize: "0.78rem" }}>
                {w.icon} {w.name}
              </button>
            ))}
          </div>
          {fmErr.woodId && <div style={{ fontSize: "0.65rem", color: "var(--dg)", marginTop: 3 }}>{fmErr.woodId}</div>}
        </div>

        {/* Container */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "var(--brl)", marginBottom: 6, textTransform: "uppercase" }}>Container</label>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={fm.containerId} onChange={e => setFm(p => ({ ...p, containerId: e.target.value }))}
              style={{ flex: 1, padding: "8px 10px", borderRadius: 6, border: "1.5px solid var(--bd)", fontSize: "0.82rem", outline: "none", background: "var(--bgc)" }}>
              <option value="">— Chọn container (tùy chọn) —</option>
              {availContainers.map(c => <option key={c.id} value={c.id}>{c.containerCode}{c.arrivalDate ? ` (${c.arrivalDate})` : ''} — {c.status}</option>)}
            </select>
            <button onClick={() => setPg('containers')} title="Tạo container mới"
              style={{ padding: "8px 12px", borderRadius: 6, border: "1.5px solid var(--bd)", background: "var(--bgs)", color: "var(--ts)", cursor: "pointer", fontSize: "0.76rem", fontWeight: 600, whiteSpace: "nowrap" }}>+ Tạo mới</button>
          </div>
        </div>

        {/* Bundle code & Location */}
        <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 200px" }}>
            <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "var(--brl)", marginBottom: 5, textTransform: "uppercase" }}>Mã kiện (bắt buộc)</label>
            <input value={fm.bundleCode} onChange={e => setFm(p => ({ ...p, bundleCode: e.target.value }))} placeholder="Mã kiện (bắt buộc)"
              style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid var(--bd)", fontSize: "0.82rem", outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ flex: "1 1 200px" }}>
            <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "var(--brl)", marginBottom: 5, textTransform: "uppercase" }}>Vị trí</label>
            <input value={fm.location} onChange={e => setFm(p => ({ ...p, location: e.target.value }))} placeholder="VD: Kho A - Dãy 3"
              style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid var(--bd)", fontSize: "0.82rem", outline: "none", boxSizing: "border-box" }} />
          </div>
        </div>

        {/* Attributes */}
        {(woodCfg.attrs || []).length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "var(--brl)", marginBottom: 8, textTransform: "uppercase" }}>Thuộc tính *</label>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {(woodCfg.attrs || []).map(atId => {
                const atDef = ats.find(a => a.id === atId);
                const vals = woodCfg.attrValues?.[atId] || [];
                const label = atDef?.name || atId;
                const errKey = `attr_${atId}`;

                // ── Thuộc tính nhóm khoảng (range attr) ──────────────────────
                const woodRangeGroupsEdit = woodCfg.rangeGroups?.[atId];
                if (woodRangeGroupsEdit?.length) {
                  const rawVal = rawMeasurements[atId] || '';
                  const resolved = resolveRangeGroup(rawVal, woodRangeGroupsEdit);
                  const isManual = manualGroups[atId];
                  const handleRawChange = (val) => {
                    const normalized = val.trim().replace(/\s*-\s*/g, '-');
                    setRawMeasurements(p => ({ ...p, [atId]: normalized }));
                    const grp = resolveRangeGroup(normalized, woodRangeGroupsEdit);
                    if (grp) {
                      // groupable (thickness): lưu actual vào attrs; non-groupable (length): lưu group label
                      let actualVal = normalized;
                      if (atDef?.groupable || atId === 'thickness') {
                        const { value: normVal } = normalizeThickness(normalized);
                        actualVal = normVal || (/^[\d.]+$/.test(normalized) ? normalized + 'F' : normalized);
                      }
                      setAttrs(p => ({ ...p, [atId]: (atDef?.groupable || atId === 'thickness') ? actualVal : grp }));
                      setManualGroups(p => ({ ...p, [atId]: false }));
                    } else {
                      setAttrs(p => ({ ...p, [atId]: '' }));
                      setManualGroups(p => ({ ...p, [atId]: !!val.trim() }));
                    }
                    setFmErr(p => ({ ...p, [errKey]: '' }));
                  };
                  const isOptionalRaw = atId === 'width';
                  const rawHint = atId === 'thickness' ? 'VD: 2.2 hoặc 3' : atId === 'width' ? 'VD: 26 hoặc 23-40 (rộng tối thiểu)' : 'VD: 1.6-1.9 hoặc 2.5';
                  return (
                    <div key={atId} style={{ flex: "1 1 220px", minWidth: 200 }}>
                      <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: "var(--ts)", marginBottom: 4 }}>
                        {label} thực tế
                        {isOptionalRaw
                          ? <span style={{ fontWeight: 400, color: "var(--tm)", marginLeft: 4 }}>(tùy chọn — trống = bình thường)</span>
                          : <> *<span style={{ fontWeight: 400, color: "var(--tm)", marginLeft: 4 }}>({rawHint})</span></>}
                      </label>
                      <input value={rawVal} onChange={e => handleRawChange(e.target.value)} placeholder={isOptionalRaw ? 'Để trống nếu rộng bình thường' : rawHint}
                        style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid " + (fmErr[errKey] ? "var(--dg)" : isManual ? "var(--ac)" : "var(--bd)"), fontSize: "0.82rem", outline: "none", background: "var(--bgc)", boxSizing: "border-box" }} />
                      {/* Kết quả tự động resolve */}
                      {rawVal && resolved && !isManual && (
                        <div style={{ fontSize: "0.65rem", color: "var(--gn)", marginTop: 3, fontWeight: 600 }}>
                          ✓ Nhóm giá: <strong>{resolved}</strong>
                        </div>
                      )}
                      {/* Không khớp → chọn thủ công */}
                      {rawVal && !resolved && isManual && (
                        <div style={{ marginTop: 5 }}>
                          <div style={{ fontSize: "0.65rem", color: "var(--ac)", marginBottom: 4, fontWeight: 600 }}>
                            ⚠️ Không khớp nhóm nào — chọn nhóm phù hợp nhất:
                          </div>
                          <select value={attrs[atId] || ''} onChange={e => { setAttrs(p => ({ ...p, [atId]: e.target.value })); setFmErr(p => ({ ...p, [errKey]: '' })); }}
                            style={{ width: "100%", padding: "6px 8px", borderRadius: 5, border: "1.5px solid var(--ac)", fontSize: "0.78rem", outline: "none", background: "var(--bgc)" }}>
                            <option value="">— Chọn nhóm —</option>
                            {vals.map(v => <option key={v} value={v}>{v}</option>)}
                          </select>
                          {attrs[atId] && (
                            <div style={{ fontSize: "0.62rem", color: "var(--ac)", marginTop: 2 }}>
                              Gán thủ công: <strong>{attrs[atId]}</strong> · sẽ lưu flag ⚠️
                            </div>
                          )}
                        </div>
                      )}
                      {fmErr[errKey] && <div style={{ fontSize: "0.65rem", color: "var(--dg)", marginTop: 2 }}>{fmErr[errKey]}</div>}
                    </div>
                  );
                }

                // ── Thickness auto-mode: nhập tự do, chip tự sinh ────────────
                const isAutoThickness = atId === 'thickness' && wts.find(w => w.id === fm.woodId)?.thicknessMode === 'auto';
                if (isAutoThickness) {
                  const handleAutoThickness = (val) => {
                    const { value, error } = normalizeThickness(val);
                    if (value) {
                      setAttrs(p => ({ ...p, [atId]: value }));
                      setFmErr(p => ({ ...p, [errKey]: '' }));
                    } else {
                      setAttrs(p => ({ ...p, [atId]: '' }));
                      if (val.trim()) setFmErr(p => ({ ...p, [errKey]: error }));
                    }
                  };
                  return (
                    <div key={atId} style={{ flex: "1 1 180px", minWidth: 160 }}>
                      <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: "var(--ts)", marginBottom: 4 }}>
                        {label} *
                        <span style={{ fontWeight: 400, color: "var(--gtx)", marginLeft: 4, fontSize: "0.62rem" }}>Chip tự sinh</span>
                      </label>
                      <input value={attrs[atId]?.replace(/F$/i, '') || ''} onChange={e => handleAutoThickness(e.target.value)}
                        onBlur={e => handleAutoThickness(e.target.value)}
                        placeholder="VD: 2.5"
                        style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid " + (fmErr[errKey] ? "var(--dg)" : "var(--bd)"), fontSize: "0.82rem", outline: "none", boxSizing: "border-box" }} />
                      {attrs[atId] && !fmErr[errKey] && <div style={{ fontSize: "0.62rem", color: "var(--gn)", marginTop: 2, fontWeight: 600 }}>→ {attrs[atId]}</div>}
                      {fmErr[errKey] && <div style={{ fontSize: "0.65rem", color: "var(--dg)", marginTop: 2 }}>{fmErr[errKey]}</div>}
                    </div>
                  );
                }

                // ── Thuộc tính thông thường ───────────────────────────────────
                const isOptionalAttr = atId === 'width'; // width luôn optional
                return (
                  <div key={atId} style={{ flex: "1 1 180px", minWidth: 160 }}>
                    <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: "var(--ts)", marginBottom: 4 }}>
                      {label}{isOptionalAttr
                        ? <span style={{ fontWeight: 400, color: "var(--tm)", marginLeft: 4 }}>(tùy chọn)</span>
                        : ' *'}
                    </label>
                    {vals.length > 0 ? (
                      <select value={attrs[atId] || ''} onChange={e => { setAttrs(p => ({ ...p, [atId]: e.target.value })); setFmErr(p => ({ ...p, [errKey]: '' })); }}
                        style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid " + (fmErr[errKey] ? "var(--dg)" : "var(--bd)"), fontSize: "0.82rem", outline: "none", background: "var(--bgc)", boxSizing: "border-box" }}>
                        <option value="">{isOptionalAttr ? '— Bình thường —' : '— Chọn —'}</option>
                        {vals.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    ) : (
                      <input value={attrs[atId] || ''} onChange={e => { setAttrs(p => ({ ...p, [atId]: e.target.value })); setFmErr(p => ({ ...p, [errKey]: '' })); }} placeholder={label}
                        style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid " + (fmErr[errKey] ? "var(--dg)" : "var(--bd)"), fontSize: "0.82rem", outline: "none", boxSizing: "border-box" }} />
                    )}
                    {fmErr[errKey] && <div style={{ fontSize: "0.65rem", color: "var(--dg)", marginTop: 2 }}>{fmErr[errKey]}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Board count & volume */}
        <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 150px" }}>
            <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "var(--brl)", marginBottom: 5, textTransform: "uppercase" }}>Số tấm *</label>
            <input type="number" min="1" step="1" value={fm.boardCount} onChange={e => { setFm(p => ({ ...p, boardCount: e.target.value })); setFmErr(p => ({ ...p, boardCount: '' })); }} placeholder="VD: 20"
              style={{ width: "100%", padding: "9px 10px", borderRadius: 6, border: "1.5px solid " + (fmErr.boardCount ? "var(--dg)" : "var(--bd)"), fontSize: "0.88rem", outline: "none", boxSizing: "border-box" }} />
            {fmErr.boardCount && <div style={{ fontSize: "0.65rem", color: "var(--dg)", marginTop: 2 }}>{fmErr.boardCount}</div>}
          </div>
          <div style={{ flex: "1 1 150px" }}>
            <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "var(--brl)", marginBottom: 5, textTransform: "uppercase" }}>{isM2Form ? `Diện tích (m²)` : `Khối lượng (m³)`} *</label>
            <input type="number" min="0.001" step="0.001" value={fm.volume} onChange={e => { setFm(p => ({ ...p, volume: e.target.value })); setFmErr(p => ({ ...p, volume: '' })); }} placeholder="VD: 0.850"
              style={{ width: "100%", padding: "9px 10px", borderRadius: 6, border: "1.5px solid " + (fmErr.volume ? "var(--dg)" : "var(--bd)"), fontSize: "0.88rem", outline: "none", boxSizing: "border-box" }} />
            {fmErr.volume && <div style={{ fontSize: "0.65rem", color: "var(--dg)", marginTop: 2 }}>{fmErr.volume}</div>}
          </div>
        </div>

        {/* Giá bán (chỉ hiện cho perBundle + admin) */}
        {isPerBundleWood && cePrice && (
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "var(--brl)", marginBottom: 5, textTransform: "uppercase" }}>Giá bán ({isM2Form ? 'k/m²' : 'tr/m³'})</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="number" min="0.01" step="0.1" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} placeholder="VD: 14.5"
                style={{ width: 150, padding: "9px 10px", borderRadius: 6, border: "1.5px solid var(--bd)", fontSize: "0.88rem", outline: "none", boxSizing: "border-box" }} />
              <span style={{ fontSize: "0.76rem", color: "var(--ts)" }}>{isM2Form ? 'k/m²' : 'tr/m³'}</span>
              {suggestedPrice && !unitPrice && (
                <button type="button" onClick={() => setUnitPrice(String(suggestedPrice))}
                  style={{ padding: "5px 10px", borderRadius: 5, border: "1.5px solid var(--bd)", background: "var(--bgs)", color: "var(--ts)", cursor: "pointer", fontSize: "0.72rem", fontWeight: 600 }}>
                  Dùng {suggestedPrice} tr (từ kiện cùng quy cách)
                </button>
              )}
            </div>
            <div style={{ fontSize: "0.65rem", color: "var(--tm)", marginTop: 3 }}>Để trống nếu chưa xác định giá</div>
          </div>
        )}

        {/* Notes */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "var(--brl)", marginBottom: 5, textTransform: "uppercase" }}>Ghi chú bán hàng</label>
          <textarea value={fm.notes} onChange={e => setFm(p => ({ ...p, notes: e.target.value }))} placeholder="Đặc điểm đặc biệt, lưu ý khi bán..." rows={3}
            style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid var(--bd)", fontSize: "0.82rem", outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
        </div>

        {/* Images */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
          <ImageUploadSection label="Ảnh chụp kiện" images={images} setImages={setImages} maxImages={2} />
          <ImageUploadSection label="Ảnh danh sách chi tiết" images={itemListImages} setImages={setItemListImages} />
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={() => onDone(null)} style={{ padding: "9px 20px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.82rem" }}>Hủy</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: "9px 24px", borderRadius: 7, border: "none", background: saving ? "var(--bd)" : "var(--ac)", color: saving ? "var(--tm)" : "#fff", cursor: saving ? "not-allowed" : "pointer", fontWeight: 700, fontSize: "0.82rem" }}>
            {saving ? 'Đang lưu...' : '📥 Nhập kho'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PgWarehouse({ wts, ats, cfg, prices, suppliers, ce, cePrice, useAPI, notify, setPg, bundles, setBundles, ugPersist, onAutoAddChip, user, subPath = [], setSubPath }) {
  const [containers, setContainers] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  // Deep URL: #/warehouse → list, #/warehouse/add → add, #/warehouse/import → import, #/warehouse/inventory → inventory
  const validViews = ['list', 'add', 'dc', 'import', 'inventory'];
  const [view, setViewRaw] = useState(() => validViews.includes(subPath[0]) ? subPath[0] : 'list');
  const setView = (v) => { setViewRaw(v); setSubPath?.(v === 'list' ? [] : [v]); };
  const [detail, setDetail] = useState(null);
  const [fWood, setFWood] = useState('');
  const [fOutOfRange, setFOutOfRange] = useState(false);
  const [colFilters, setColFilters] = useState({}); // { [field]: 'text' }
  const setColFilter = (field, val) => { setColFilters(p => ({ ...p, [field]: val })); setPage(1); };
  const { sortField, sortDir, toggleSort, sortIcon } = useTableSort('createdAt', 'desc');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const [showExtraCols, setShowExtraCols] = useState(false);
  const [extraCols, setExtraCols] = useState(new Set());

  const EXTRA_COL_OPTS = [
    { id: 'edging', label: 'Dong cạnh' },
    { id: 'container', label: 'Container' },
    { id: 'createdAt', label: 'Ngày nhập' },
  ];

  useEffect(() => {
    if (!useAPI) { setLoadingList(false); return; }
    (async () => {
      try {
        const { fetchContainers } = await import('../api.js');
        const cs = await fetchContainers();
        setContainers(cs);
      } catch (e) { notify('Lỗi tải dữ liệu kho: ' + e.message, false); }
      setLoadingList(false);
    })();
  }, [useAPI]);

  // Helper: lấy text hiển thị cho 1 cột của bundle (dùng cho filter match + datalist)
  const getColText = (b, field) => {
    if (field === 'bundleCode') return b.supplierBundleCode || b.bundleCode || '';
    if (field === 'woodId') { const w = wts.find(x => x.id === b.woodId); return w ? w.name : b.woodId; }
    if (field === 'thickness') return b.attributes?.thickness || '';
    if (field === 'quality') return b.attributes?.quality || '';
    if (field === 'supplier') return b.attributes?.supplier || '';
    if (field === 'edging') return b.attributes?.edging || '';
    if (field === 'width') return b.rawMeasurements?.width || b.attributes?.width || '';
    if (field === 'length') return b.rawMeasurements?.length || b.attributes?.length || '';
    if (field === 'status') return b.status || '';
    if (field === 'location') return b.location || '';
    if (field === 'notes') return b.notes || '';
    if (field === 'unitPrice') return b.unitPrice ? String(b.unitPrice) : '';
    if (field === 'containerId') { const c = b.containerId ? containers.find(x => x.id === b.containerId) : null; return c?.containerCode || ''; }
    if (field === 'createdAt') return b.createdAt ? fmtDate(b.createdAt) : '';
    if (field === 'remainingBoards') return String(b.remainingBoards ?? '');
    if (field === 'remainingVolume') return (b.remainingVolume || 0).toFixed(isM2Wood(b.woodId, wts) ? 2 : 4);
    return '';
  };

  const filtered = useMemo(() => {
    let arr = [...bundles];
    if (fWood) arr = arr.filter(b => b.woodId === fWood);
    if (fOutOfRange) arr = arr.filter(b => {
      const woodRangeGroups = cfg[b.woodId]?.rangeGroups || {};
      return Object.keys(woodRangeGroups).some(atId => {
        const rg = woodRangeGroups[atId];
        if (!rg?.length) return false;
        const raw = b.rawMeasurements?.[atId];
        return raw ? resolveRangeGroup(raw, rg) === null : false;
      });
    });
    // Apply column filters
    for (const [field, val] of Object.entries(colFilters)) {
      if (!val) continue;
      const lower = val.toLowerCase();
      arr = arr.filter(b => {
        const text = getColText(b, field);
        return text === val || text.toLowerCase().includes(lower);
      });
    }
    const isPineFilter = fWood && wts.find(w => w.id === fWood)?.pricingMode === 'perBundle';
    if (isPineFilter) {
      arr.sort((a, b) => {
        const t = parseFloat(a.attributes.thickness) - parseFloat(b.attributes.thickness);
        if (t !== 0) return t;
        const w = parseFloat(a.attributes.width) - parseFloat(b.attributes.width);
        if (w !== 0) return w;
        const l = parseFloat(a.attributes.length) - parseFloat(b.attributes.length);
        if (l !== 0) return l;
        return String(a.attributes.quality || '').localeCompare(String(b.attributes.quality || ''));
      });
    } else {
      arr.sort((a, b) => {
        let va = a[sortField], vb = b[sortField];
        if (va == null) va = ''; if (vb == null) vb = '';
        const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb));
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return arr;
  }, [bundles, fWood, fOutOfRange, colFilters, sortField, sortDir, wts, cfg, containers]); // eslint-disable-line

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const doToggleSort = (field) => { toggleSort(field); setPage(1); };
  const hasFilters = !!fWood || fOutOfRange || Object.values(colFilters).some(v => v);

  // Unique values cho datalist — tính từ bundles sau wood filter
  const uniqueColVals = useMemo(() => {
    const base = fWood ? bundles.filter(b => b.woodId === fWood) : bundles;
    const collectUnique = (field) => [...new Set(base.map(b => getColText(b, field)).filter(Boolean))].sort();
    return { bundleCode: collectUnique('bundleCode'), woodId: collectUnique('woodId'), thickness: collectUnique('thickness'), quality: collectUnique('quality'), supplier: collectUnique('supplier'), edging: collectUnique('edging'), width: collectUnique('width'), length: collectUnique('length'), status: collectUnique('status'), location: collectUnique('location'), unitPrice: collectUnique('unitPrice'), containerId: collectUnique('containerId') };
  }, [bundles, fWood]); // eslint-disable-line
  const isFilteredPerBundle = !!(fWood && wts.find(w => w.id === fWood)?.pricingMode === 'perBundle');
  const isFilteredM2 = !!(fWood && isM2Wood(fWood, wts));
  const listVolUnit = isFilteredM2 ? 'm²' : 'm³';
  const showSupplierCol = !!(cfg[fWood]?.attrs?.includes('supplier'));
  const showWidthCol = !!(cfg[fWood]?.attrs?.includes('width'));
  const showEdgingCol = !!(cfg[fWood]?.attrs?.includes('edging')) || extraCols.has('edging');

  const handleStatusChange = async (bundle, newStatus) => {
    const { updateBundle } = await import('../api.js');
    const r = await updateBundle(bundle.id, { status: newStatus });
    if (r.error) return notify('Lỗi: ' + r.error, false);
    setBundles(prev => prev.map(b => b.id === bundle.id ? { ...b, status: newStatus } : b));
    if (detail?.id === bundle.id) setDetail(d => ({ ...d, status: newStatus }));
    notify('Đã cập nhật tình trạng');
  };

  const handleBundleSave = (updated, err) => {
    if (err) return notify('Lỗi: ' + err, false);
    setBundles(prev => prev.map(b => b.id === updated.id ? updated : b));
    setDetail(updated);
    notify('Đã cập nhật kiện gỗ');
  };

  const handleDelete = async (bundle) => {
    if (!window.confirm(`Xóa kiện ${bundle.bundleCode}?`)) return;
    if (useAPI) {
      const { checkBundleInOrders, deleteBundle, deleteBundleImages } = await import('../api.js');
      const inOrders = await checkBundleInOrders(bundle.id);
      if (inOrders) {
        notify(`Không thể xóa kiện ${bundle.bundleCode} — đang được sử dụng trong đơn hàng.`, false);
        return;
      }
      // Xóa ảnh trong Storage trước khi xóa record
      const allImageUrls = [...(bundle.images || []), ...(bundle.itemListImages || [])];
      if (allImageUrls.length) {
        const imgResult = await deleteBundleImages(allImageUrls);
        if (imgResult.error) console.warn('Xóa ảnh thất bại (tiếp tục xóa kiện):', imgResult.error);
      }
      const r = await deleteBundle(bundle.id);
      if (r.error) return notify('Lỗi: ' + r.error, false);
    }
    setBundles(prev => prev.filter(b => b.id !== bundle.id));
    notify('Đã xóa kiện gỗ');
  };

  if (loadingList) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--tm)' }}>Đang tải...</div>;

  if (view === 'add') return (
    <BundleAddForm wts={wts} ats={ats} cfg={cfg} containers={containers} prices={prices} bundles={bundles} cePrice={cePrice} useAPI={useAPI} notify={notify} setPg={setPg}
      onAutoAddChip={onAutoAddChip}
      onDone={(newBundle) => { if (newBundle) setBundles(prev => [newBundle, ...prev]); setPage(1); setView('list'); }} />
  );

  if (view === 'dc') return (
    <DCBundleAddForm wts={wts} ats={ats} cfg={cfg} bundles={bundles} useAPI={useAPI} notify={notify}
      onDone={(newBundle) => { if (newBundle) setBundles(prev => [newBundle, ...prev]); setPage(1); setView('list'); }} />
  );

  if (view === 'import') return (
    <BundleImportForm wts={wts} ats={ats} cfg={cfg} useAPI={useAPI} notify={notify} existingBundles={bundles}
      onDone={(results, importMode) => {
        if (results.length) {
          if (importMode === 'update') {
            setBundles(prev => prev.map(b => results.find(r => r.id === b.id) || b));
            notify(`Đã cập nhật ${results.length} kiện`);
          } else {
            setBundles(prev => {
              const existingIds = new Set(prev.map(b => b.id));
              const newOnly = results.filter(r => !existingIds.has(r.id));
              return newOnly.length ? [...newOnly, ...prev] : prev;
            });
            notify(`Đã nhập ${results.length} kiện`);
          }
          // Auto-add thickness chips từ import cho gỗ xẻ sấy (thicknessMode=auto)
          if (onAutoAddChip) {
            const byWood = {};
            results.forEach(r => {
              const wid = r.woodId || r.wood_id;
              const t = r.attributes?.thickness;
              if (t && wts.find(w => w.id === wid)?.thicknessMode === 'auto') {
                if (!byWood[wid]) byWood[wid] = new Set();
                byWood[wid].add(t);
              }
            });
            Object.entries(byWood).forEach(([wid, vals]) => onAutoAddChip(wid, [...vals]));
          }
        }
        setPage(1); setView('list');
      }} />
  );

  if (view === 'inventory') return (
    <InventoryView wts={wts} ats={ats} cfg={cfg} prices={prices} bundles={bundles} onBack={() => setView('list')} ce={ce} ugPersist={ugPersist} />
  );

  if (view === 'adjustment') {
    const InventoryAdjustment = React.lazy(() => import('../components/InventoryAdjustment'));
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <button onClick={() => setView('list')} style={{ padding: "6px 12px", borderRadius: 6, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontSize: "0.76rem", fontWeight: 600 }}>← Quay lại</button>
          <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "var(--br)" }}>Cân kho / Điều chỉnh tồn</h2>
        </div>
        <React.Suspense fallback={<div style={{ padding: 20, textAlign: "center", color: "var(--tm)" }}>Đang tải...</div>}>
          <InventoryAdjustment bundles={bundles} wts={wts} user={user} isAdmin={cePrice} useAPI={useAPI} notify={notify} onBundleUpdated={() => {
            import('../api.js').then(api => api.fetchBundles()).then(bs => setBundles(bs)).catch(() => {});
          }} />
        </React.Suspense>
      </div>
    );
  }

  const ths = { padding: "8px 10px", textAlign: "left", background: "var(--bgh)", color: "var(--brl)", fontWeight: 700, fontSize: "0.65rem", textTransform: "uppercase", borderBottom: "2px solid var(--bds)", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none", transition: "all 0.12s" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "var(--br)" }}>🏪 Tồn kho gỗ kiện</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setView('inventory')} style={{ padding: "7px 14px", borderRadius: 7, background: "var(--bgs)", color: "var(--br)", border: "1.5px solid var(--bds)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>📊 Tồn kho SKU</button>
          {ce && <button onClick={() => setView('adjustment')} style={{ padding: "7px 14px", borderRadius: 7, background: "var(--bgs)", color: "var(--br)", border: "1.5px solid var(--bds)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>Cân kho</button>}
          {ce && <button onClick={() => setView('import')} style={{ padding: "7px 14px", borderRadius: 7, background: "var(--bgs)", color: "var(--br)", border: "1.5px solid var(--bds)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>📂 Nhập hàng loạt</button>}
          {ce && <button onClick={() => setView('dc')} style={{ padding: "7px 14px", borderRadius: 7, background: "var(--bgs)", color: "var(--br)", border: "1.5px solid var(--bds)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>📦 Nhập DC</button>}
          {ce && <button onClick={() => setView('add')} style={{ padding: "7px 16px", borderRadius: 7, background: "var(--ac)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>+ Nhập kho</button>}
        </div>
      </div>

      {/* Summary stats — theo kết quả filter hiện tại */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        {[
          { label: 'Tổng kiện', val: filtered.length, color: 'var(--br)' },
          { label: 'Kiện nguyên', val: filtered.filter(b => b.status === 'Kiện nguyên').length, color: 'var(--gn)' },
          { label: 'Kiện lẻ', val: filtered.filter(b => b.status === 'Kiện lẻ').length, color: 'var(--ac)' },
          { label: 'Chưa được bán', val: filtered.filter(b => b.status === 'Chưa được bán').length, color: '#7C5CBF' },
          { label: 'Tổng KL còn', val: filtered.reduce((s, b) => s + (b.remainingVolume || 0), 0).toFixed(1) + ' ' + listVolUnit, color: 'var(--br)' },
        ].map(s => (
          <div key={s.label} style={{ padding: "8px 14px", borderRadius: 8, background: "var(--bgc)", border: "1px solid var(--bd)", minWidth: 110 }}>
            <div style={{ fontSize: "0.6rem", color: "var(--tm)", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontSize: "1rem", fontWeight: 800, color: s.color }}>{s.val}</div>
          </div>
        ))}
        {hasFilters && <span style={{ fontSize: "0.65rem", color: "var(--tm)", fontStyle: "italic" }}>theo bộ lọc</span>}
      </div>

      {/* Filters */}
      <div style={{ marginBottom: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <WoodPicker wts={wts} sel={fWood} onSel={id => { setFWood(id); setColFilters({}); setPage(1); }} allLabel="Tất cả" mb={0} />
        <button onClick={() => { setFOutOfRange(p => !p); setPage(1); }}
          style={{ padding: "6px 12px", borderRadius: 6, border: "1.5px solid " + (fOutOfRange ? "#856404" : "var(--bd)"), background: fOutOfRange ? "rgba(133,100,4,0.08)" : "transparent", color: fOutOfRange ? "#856404" : "var(--ts)", cursor: "pointer", fontSize: "0.75rem", fontWeight: fOutOfRange ? 700 : 600, whiteSpace: "nowrap" }}>
          ⚠ Ngoài khoảng
        </button>
        {hasFilters && <button onClick={() => { setFWood(''); setColFilters({}); setFOutOfRange(false); setPage(1); }} style={{ padding: "6px 12px", borderRadius: 6, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600, whiteSpace: "nowrap" }}>✕ Xóa lọc</button>}
        <button onClick={() => setShowExtraCols(p => !p)} style={{ padding: "6px 12px", borderRadius: 6, border: "1.5px solid " + (showExtraCols ? "var(--ac)" : "var(--bd)"), background: showExtraCols ? "var(--acbg)" : "transparent", color: showExtraCols ? "var(--ac)" : "var(--ts)", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600, whiteSpace: "nowrap" }}>⚙ Cột hiển thị</button>
      </div>

      {showExtraCols && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8, padding: "8px 12px", borderRadius: 8, background: "var(--bgc)", border: "1px solid var(--bd)" }}>
          {EXTRA_COL_OPTS.map(col => (
            <label key={col.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.76rem", cursor: "pointer", color: "var(--ts)", userSelect: "none" }}>
              <input type="checkbox" checked={extraCols.has(col.id)} onChange={e => setExtraCols(prev => { const n = new Set(prev); e.target.checked ? n.add(col.id) : n.delete(col.id); return n; })} />
              {col.label}
            </label>
          ))}
        </div>
      )}

      <div style={{ background: "var(--bgc)", borderRadius: 10, border: "1px solid var(--bd)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
            <thead>
              {(() => {
                const columns = isFilteredPerBundle ? [
                  { field: 'bundleCode', label: 'Mã kiện' },
                  { field: 'thickness', label: 'Dày', noSort: true },
                  { field: 'width', label: 'Rộng', noSort: true },
                  { field: 'length', label: 'Dài', noSort: true },
                  { field: 'quality', label: 'CL', noSort: true },
                  { field: 'unitPrice', label: 'Giá', noSort: true },
                  { field: 'status', label: 'Tình trạng' },
                  { field: 'remainingBoards', label: 'Tấm' },
                  { field: 'remainingVolume', label: `KL (${listVolUnit})` },
                  { field: 'location', label: 'Vị trí' },
                  { field: 'notes', label: 'Ghi chú', noSort: true, flex: true },
                  ...(extraCols.has('container') ? [{ field: 'containerId', label: 'Cont' }] : []),
                  ...(extraCols.has('createdAt') ? [{ field: 'createdAt', label: 'Ngày nhập' }] : []),
                  { field: '_actions', label: '', noSort: true },
                ] : [
                  { field: 'bundleCode', label: 'Mã kiện' },
                  { field: 'woodId', label: 'Loại gỗ' },
                  { field: 'thickness', label: 'Dày', noSort: true },
                  { field: 'quality', label: 'CL', noSort: true },
                  ...(showSupplierCol ? [{ field: 'supplier', label: 'NCC', noSort: true }] : []),
                  ...(showEdgingCol ? [{ field: 'edging', label: 'DC', noSort: true }] : []),
                  ...(showWidthCol ? [{ field: 'width', label: 'Rộng', noSort: true }] : []),
                  { field: 'length', label: 'Dài', noSort: true },
                  { field: 'status', label: 'Tình trạng' },
                  { field: 'remainingBoards', label: 'Tấm' },
                  { field: 'remainingVolume', label: `KL (${listVolUnit})` },
                  { field: 'location', label: 'Vị trí' },
                  { field: 'notes', label: 'Ghi chú', noSort: true, flex: true },
                  ...(extraCols.has('container') ? [{ field: 'containerId', label: 'Cont' }] : []),
                  ...(extraCols.has('createdAt') ? [{ field: 'createdAt', label: 'Ngày nhập' }] : []),
                  { field: '_actions', label: '', noSort: true },
                ];
                return <>
                  <tr style={{ background: "var(--bgs)" }}>
                    <td style={{ padding: "5px 3px" }} />
                    {columns.map(col => {
                      if (col.field === '_actions') return <td key={col.field} style={{ padding: "5px 3px" }} />;
                      const vals = uniqueColVals[col.field] || [];
                      return (
                        <td key={col.field} style={{ padding: "5px 3px" }}>
                          <ComboFilter
                            value={colFilters[col.field] || ''}
                            onChange={v => setColFilter(col.field, v)}
                            options={vals}
                            placeholder={col.label}
                          />
                        </td>
                      );
                    })}
                  </tr>
                  <tr style={{ background: "var(--bgs)" }}>
                    <th style={{ ...ths, width: 1, textAlign: "center", padding: "8px 4px" }}>STT</th>
                    {columns.map(col => (
                      <th key={col.field} onClick={() => !col.noSort && doToggleSort(col.field)}
                        style={{ ...ths, cursor: col.noSort ? 'default' : 'pointer', textAlign: ['remainingBoards', 'remainingVolume'].includes(col.field) ? 'right' : 'left', ...(col.flex ? { width: '100%' } : {}) }}>
                        {col.label}{!col.noSort && sortIcon(col.field)}
                      </th>
                    ))}
                  </tr>
                </>;
              })()}
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={99} style={{ padding: 30, textAlign: "center", color: "var(--tm)" }}>{bundles.length === 0 ? 'Chưa có kiện gỗ nào. Bấm "+ Nhập kho" để bắt đầu.' : 'Không tìm thấy kết quả phù hợp.'}</td></tr>
              ) : paginated.map((b, i) => {
                const wood = wts.find(w => w.id === b.woodId);
                const cont = b.containerId ? containers.find(c => c.id === b.containerId) : null;
                const ncc = cont?.nccId ? suppliers.find(s => s.nccId === cont.nccId) : null;
                const { color: statusColor, bg: statusBg } = statusSt(b.status);
                const tdBase = { padding: "6px 8px", borderBottom: "1px solid var(--bd)", whiteSpace: "nowrap" };
                const bIsM2 = isM2Wood(b.woodId, wts);
                const bVolDec = bIsM2 ? 2 : 4;
                if (isFilteredPerBundle) {
                  return (
                    <tr data-clickable="true" key={b.id} style={{ background: i % 2 ? "var(--bgs)" : "#fff", cursor: "pointer" }} onClick={() => setDetail(b)}>
                      <td style={{ ...tdBase, textAlign: "center", fontSize: "0.68rem", color: "var(--tm)", padding: "6px 4px" }}>{(page - 1) * PAGE_SIZE + i + 1}</td>
                      <td style={{ ...tdBase, maxWidth: 130 }}>
                        <div style={{ fontWeight: 700, color: "var(--br)", fontSize: "0.78rem", overflow: "hidden", textOverflow: "ellipsis" }} title={b.supplierBundleCode || b.bundleCode}>
                          {b.supplierBundleCode || b.bundleCode}
                          {b.priceAttrsOverride && <span title={'Tra giá theo: ' + Object.entries(b.priceAttrsOverride).map(([k,v]) => `${k}=${v}`).join(', ') + (b.priceOverrideReason ? ' — ' + b.priceOverrideReason : '')} style={{ marginLeft: 4, padding: "1px 4px", borderRadius: 3, fontSize: "0.52rem", fontWeight: 800, background: "rgba(124,92,191,0.15)", color: "#7C5CBF", verticalAlign: "middle" }}>SKU≠</span>}
                        </div>
                      </td>
                      <td style={{ ...tdBase, fontWeight: 700, fontFamily: "monospace" }}>{b.attributes.thickness || '—'}</td>
                      <td style={{ ...tdBase, fontWeight: 700, fontFamily: "monospace" }}>
                        {b.rawMeasurements?.width
                          ? <>{b.rawMeasurements.width}<span style={{ color: 'var(--tm)', fontSize: '0.65rem', marginLeft: 2 }}>({b.attributes.width})</span></>
                          : b.attributes.width || <span style={{ color: 'var(--tm)', fontWeight: 400, fontStyle: 'italic' }}>BT</span>}
                      </td>
                      <td style={{ ...tdBase, fontWeight: 700, fontFamily: "monospace" }}>
                        {b.rawMeasurements?.length
                          ? <>{b.rawMeasurements.length}<span style={{ color: 'var(--tm)', fontSize: '0.65rem', marginLeft: 2 }}>({b.attributes.length})</span></>
                          : b.attributes.length || '—'}
                      </td>
                      <td style={tdBase}>{b.attributes.quality || '—'}</td>
                      <td style={{ ...tdBase, fontWeight: 700, color: b.unitPrice ? "var(--br)" : "var(--tm)" }}>{b.unitPrice ? b.unitPrice + ' tr' : '—'}</td>
                      <td style={tdBase}><span style={{ padding: "2px 8px", borderRadius: 4, fontSize: "0.68rem", fontWeight: 700, background: statusBg, color: statusColor }}>{b.status}</span></td>
                      <td style={{ ...tdBase, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        <div>{b.remainingBoards}</div>
                        <div style={{ fontSize: "0.62rem", color: "var(--tm)" }}>/{b.boardCount}</div>
                      </td>
                      <td style={{ ...tdBase, textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                        <div>{(b.remainingVolume || 0).toFixed(bVolDec)}</div>
                        <div style={{ fontSize: "0.62rem", color: "var(--tm)", fontWeight: 400 }}>/{(b.volume || 0).toFixed(bVolDec)}</div>
                      </td>
                      <td style={{ ...tdBase, whiteSpace: "normal" }}>{b.location || '—'}</td>
                      <td title={b.notes || '—'} style={{ ...tdBase, whiteSpace: "normal", color: "var(--ts)", fontSize: "0.76rem" }}>{b.notes || '—'}</td>
                      {extraCols.has('container') && <td style={{ ...tdBase, fontFamily: "monospace", fontSize: "0.74rem" }}>{cont?.containerCode || (b.containerId ? '#' + b.containerId : '—')}</td>}
                      {extraCols.has('createdAt') && <td style={{ ...tdBase, color: "var(--tm)", fontSize: "0.74rem" }}>{b.createdAt ? fmtDate(b.createdAt) : '—'}</td>}
                      <td style={{ ...tdBase }} onClick={e => e.stopPropagation()}>
                        {ce && <button onClick={() => handleDelete(b)} title="Xóa" style={{ width: 24, height: 24, padding: 0, borderRadius: 4, border: "1px solid var(--dg)", background: "transparent", color: "var(--dg)", cursor: "pointer", fontSize: "0.72rem" }}>✕</button>}
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr data-clickable="true" key={b.id} style={{ background: i % 2 ? "var(--bgs)" : "#fff", cursor: "pointer" }} onClick={() => setDetail(b)}>
                    <td style={{ ...tdBase, textAlign: "center", fontSize: "0.68rem", color: "var(--tm)", padding: "6px 4px" }}>{(page - 1) * PAGE_SIZE + i + 1}</td>
                    <td style={{ ...tdBase, maxWidth: 130 }}>
                      <div style={{ fontWeight: 700, color: "var(--br)", fontSize: "0.78rem", overflow: "hidden", textOverflow: "ellipsis" }} title={b.supplierBundleCode || b.bundleCode}>
                        {b.supplierBundleCode || b.bundleCode}
                        {b.priceAttrsOverride && <span title={'Tra giá theo: ' + Object.entries(b.priceAttrsOverride).map(([k,v]) => `${k}=${v}`).join(', ') + (b.priceOverrideReason ? ' — ' + b.priceOverrideReason : '')} style={{ marginLeft: 4, padding: "1px 4px", borderRadius: 3, fontSize: "0.52rem", fontWeight: 800, background: "rgba(124,92,191,0.15)", color: "#7C5CBF", verticalAlign: "middle" }}>SKU≠</span>}
                      </div>
                    </td>
                    <td style={tdBase}>{wood?.icon} {wood?.name || b.woodId}</td>
                    <td style={tdBase}>{b.attributes.thickness || '—'}</td>
                    <td style={tdBase}>{b.attributes.quality || '—'}</td>
                    {showSupplierCol && <td style={tdBase}>{b.attributes.supplier || ncc?.name || '—'}</td>}
                    {showEdgingCol && <td style={tdBase}>{b.attributes.edging || '—'}</td>}
                    {showWidthCol && <td style={tdBase}>
                      {b.rawMeasurements?.width
                        ? <>{b.rawMeasurements.width}<span style={{ color: 'var(--tm)', fontSize: '0.65rem', marginLeft: 2 }}>({b.attributes.width})</span></>
                        : b.attributes.width || <span style={{ color: 'var(--tm)', fontStyle: 'italic' }}>BT</span>}
                    </td>}
                    <td style={tdBase}>
                      {b.attributes.length
                        ? b.rawMeasurements?.length
                          ? (() => {
                              const rg = cfg[b.woodId]?.rangeGroups?.length;
                              const outOfRange = rg?.length && resolveRangeGroup(b.rawMeasurements.length, rg) === null;
                              return (
                                <div>
                                  <div style={{ fontWeight: 700 }}>{b.rawMeasurements.length}m{outOfRange && <span title="Raw nằm ngoài khoảng nhóm nào" style={{ marginLeft: 3, color: '#856404', fontSize: '0.68rem' }}>⚠</span>}</div>
                                  <div style={{ fontSize: '0.63rem', color: 'var(--tm)' }}>{b.attributes.length}</div>
                                </div>
                              );
                            })()
                          : b.attributes.length
                        : '—'}
                    </td>
                    <td style={tdBase}><span style={{ padding: "2px 8px", borderRadius: 4, fontSize: "0.68rem", fontWeight: 700, background: statusBg, color: statusColor }}>{b.status}</span></td>
                    <td style={{ ...tdBase, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      <div>{b.remainingBoards}</div>
                      <div style={{ fontSize: "0.62rem", color: "var(--tm)" }}>/{b.boardCount}</div>
                    </td>
                    <td style={{ ...tdBase, textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                      <div>{(b.remainingVolume || 0).toFixed(bVolDec)}</div>
                      <div style={{ fontSize: "0.62rem", color: "var(--tm)", fontWeight: 400 }}>/{(b.volume || 0).toFixed(bVolDec)}</div>
                    </td>
                    <td style={{ ...tdBase, whiteSpace: "normal" }}>{b.location || '—'}</td>
                    <td title={b.notes || '—'} style={{ ...tdBase, whiteSpace: "normal", color: "var(--ts)", fontSize: "0.76rem" }}>{b.notes || '—'}</td>
                    {extraCols.has('container') && <td style={{ ...tdBase, fontFamily: "monospace", fontSize: "0.74rem" }}>{cont?.containerCode || (b.containerId ? '#' + b.containerId : '—')}</td>}
                    {extraCols.has('createdAt') && <td style={{ ...tdBase, color: "var(--tm)", fontSize: "0.74rem" }}>{b.createdAt ? fmtDate(b.createdAt) : '—'}</td>}
                    <td style={{ ...tdBase }} onClick={e => e.stopPropagation()}>
                      {ce && <button onClick={() => handleDelete(b)} title="Xóa" style={{ width: 24, height: 24, padding: 0, borderRadius: 4, border: "1px solid var(--dg)", background: "transparent", color: "var(--dg)", cursor: "pointer", fontSize: "0.72rem" }}>✕</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, padding: "10px", borderTop: "1px solid var(--bd)" }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid var(--bd)", background: page === 1 ? "var(--bgs)" : "var(--bgc)", cursor: page === 1 ? "not-allowed" : "pointer", color: "var(--ts)", fontSize: "0.78rem" }}>◀</button>
            <span style={{ fontSize: "0.78rem", color: "var(--ts)" }}>{page} / {totalPages} — {filtered.length} kiện</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid var(--bd)", background: page === totalPages ? "var(--bgs)" : "var(--bgc)", cursor: page === totalPages ? "not-allowed" : "pointer", color: "var(--ts)", fontSize: "0.78rem" }}>▶</button>
          </div>
        )}
      </div>
      {detail && <BundleDetail bundle={detail} wts={wts} containers={containers} suppliers={suppliers} ats={ats} prices={prices} cfg={cfg} ce={ce} cePrice={cePrice} onClose={() => setDetail(null)} onSave={handleBundleSave} onStatusChange={handleStatusChange} notify={notify} />}
    </div>
  );
}

export default React.memo(PgWarehouse);
