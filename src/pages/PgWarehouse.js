import React, { useState, useEffect, useMemo, useRef } from "react";
import { bpk } from "../utils";
import { WoodPicker } from "../components/Matrix";

export const BUNDLE_STATUSES = ['Kiện nguyên', 'Chưa được bán', 'Kiện lẻ', 'Đã bán'];

function statusSt(status) {
  if (status === 'Kiện nguyên') return { color: 'var(--gn)', bg: 'rgba(50,79,39,0.1)' };
  if (status === 'Chưa được bán') return { color: '#7C5CBF', bg: 'rgba(124,92,191,0.1)' };
  if (status === 'Kiện lẻ') return { color: 'var(--ac)', bg: 'rgba(242,101,34,0.1)' };
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

function BundleDetail({ bundle, wts, containers, suppliers, ats, ce, onClose, onSave, onStatusChange }) {
  const wood = wts.find(w => w.id === bundle.woodId);
  const cont = bundle.containerId ? containers.find(c => c.id === bundle.containerId) : null;
  const ncc = cont?.nccId ? suppliers.find(s => s.nccId === cont.nccId) : null;
  const atLabels = Object.fromEntries(ats.map(a => [a.id, a.name]));
  const { color: statusColor, bg: statusBg } = statusSt(bundle.status);

  const [editing, setEditing] = useState(false);
  const [location, setLocation] = useState(bundle.location || '');
  const [existingImgs, setExistingImgs] = useState(bundle.images || []);
  const [newImgFiles, setNewImgFiles] = useState([]);
  const [existingItemImgs, setExistingItemImgs] = useState(bundle.itemListImages || []);
  const [newItemImgFiles, setNewItemImgFiles] = useState([]);
  const [saving, setSaving] = useState(false);

  const cancelEdit = () => {
    setEditing(false);
    setLocation(bundle.location || '');
    setExistingImgs(bundle.images || []);
    setNewImgFiles([]);
    setExistingItemImgs(bundle.itemListImages || []);
    setNewItemImgFiles([]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { updateBundle, uploadBundleImage } = await import('../api.js');
      let imgUrls = [...existingImgs];
      let itemImgUrls = [...existingItemImgs];
      for (const img of newImgFiles) { const r = await uploadBundleImage(bundle.bundleCode, img.file, 'photo'); if (r.error) throw new Error('Upload ảnh kiện: ' + r.error); imgUrls.push(r.url); }
      for (const img of newItemImgFiles) { const r = await uploadBundleImage(bundle.bundleCode, img.file, 'item-list'); if (r.error) throw new Error('Upload ảnh chi tiết: ' + r.error); itemImgUrls.push(r.url); }
      const updates = {
        location: location || null,
        images: imgUrls,
        item_list_images: itemImgUrls,
      };
      const r = await updateBundle(bundle.id, updates);
      if (r.error) { onSave(null, r.error); setSaving(false); return; }
      const updated = { ...bundle, location, images: imgUrls, itemListImages: itemImgUrls };
      onSave(updated);
      setEditing(false);
      setNewImgFiles([]);
      setNewItemImgFiles([]);
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
    <div style={{ position: "fixed", inset: 0, background: "rgba(45,32,22,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--bgc)", borderRadius: 16, padding: 24, width: 600, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto", border: "1px solid var(--bd)" }}>
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
            <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase", marginBottom: 12 }}>Cập nhật vị trí & ảnh</div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: "0.68rem", fontWeight: 700, color: "var(--brl)", marginBottom: 4, textTransform: "uppercase" }}>Vị trí</label>
              <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Ví dụ: Kệ A-3, Hàng 2..."
                style={{ width: "100%", padding: "7px 9px", borderRadius: 6, border: "1.5px solid var(--bd)", fontSize: "0.82rem", outline: "none", boxSizing: "border-box", background: "var(--bg)" }} />
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
          {ce && bundle.status === 'Kiện nguyên' && (
            <button onClick={() => onStatusChange(bundle, 'Chưa được bán')}
              style={{ padding: "3px 10px", borderRadius: 5, fontSize: "0.72rem", fontWeight: 600, background: 'rgba(124,92,191,0.1)', color: '#7C5CBF', border: '1px solid rgba(124,92,191,0.3)', cursor: 'pointer' }}>
              → Chưa được bán
            </button>
          )}
          {ce && bundle.status === 'Chưa được bán' && (
            <button onClick={() => onStatusChange(bundle, 'Kiện nguyên')}
              style={{ padding: "3px 10px", borderRadius: 5, fontSize: "0.72rem", fontWeight: 600, background: 'rgba(50,79,39,0.1)', color: 'var(--gn)', border: '1px solid rgba(50,79,39,0.3)', cursor: 'pointer' }}>
              → Kiện nguyên
            </button>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
          {[
            { label: "Số tấm ban đầu", val: `${bundle.boardCount} tấm` },
            { label: "Số tấm còn lại", val: `${bundle.remainingBoards} tấm`, hi: bundle.remainingBoards < bundle.boardCount },
            { label: "Khối lượng ban đầu", val: `${(bundle.volume || 0).toFixed(3)} m³` },
            { label: "KL còn lại", val: `${(bundle.remainingVolume || 0).toFixed(3)} m³`, hi: bundle.remainingVolume < bundle.volume },
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
            {Object.entries(bundle.attributes || {}).map(([k, v]) => (
              <span key={k} style={{ padding: "3px 9px", borderRadius: 4, background: "var(--bgs)", border: "1px solid var(--bd)", fontSize: "0.76rem" }}>
                <span style={{ color: "var(--tm)", fontSize: "0.68rem" }}>{atLabels[k] || k}: </span>{v}
              </span>
            ))}
          </div>
        </div>

        {/* Container */}
        {cont && (
          <div style={{ marginBottom: 14, padding: "8px 12px", borderRadius: 7, background: "var(--bgs)", border: "1px solid var(--bd)", fontSize: "0.78rem" }}>
            <div style={{ fontSize: "0.62rem", color: "var(--tm)", fontWeight: 600, marginBottom: 3 }}>Container</div>
            <div style={{ fontWeight: 700, color: "var(--br)", fontFamily: "monospace" }}>{cont.containerCode}</div>
            {ncc && <div style={{ color: "var(--ts)", marginTop: 2 }}>{ncc.name}</div>}
            {cont.arrivalDate && <div style={{ color: "var(--tm)", fontSize: "0.72rem", marginTop: 1 }}>Ngày về: {cont.arrivalDate}</div>}
          </div>
        )}

        {/* Mã NCC / Vị trí */}
        {(bundle.supplierBundleCode || bundle.location) && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            {bundle.supplierBundleCode && (
              <div style={{ flex: "1 1 180px", padding: "8px 12px", borderRadius: 7, background: "var(--bgs)", border: "1px solid var(--bd)" }}>
                <div style={{ fontSize: "0.62rem", color: "var(--tm)", fontWeight: 600, marginBottom: 3 }}>Mã kiện nhà cung cấp</div>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--br)", fontFamily: "monospace" }}>{bundle.supplierBundleCode}</div>
              </div>
            )}
            {bundle.location && (
              <div style={{ flex: "1 1 180px", padding: "8px 12px", borderRadius: 7, background: "var(--bgs)", border: "1px solid var(--bd)" }}>
                <div style={{ fontSize: "0.62rem", color: "var(--tm)", fontWeight: 600, marginBottom: 3 }}>Vị trí</div>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--br)" }}>{bundle.location}</div>
              </div>
            )}
          </div>
        )}

        {/* Ghi chú */}
        {bundle.notes && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--tm)", textTransform: "uppercase", marginBottom: 5 }}>Ghi chú bán hàng</div>
            <div style={{ padding: "8px 12px", borderRadius: 7, background: "var(--bgs)", border: "1px solid var(--bd)", fontSize: "0.78rem", color: "var(--ts)", lineHeight: 1.5 }}>{bundle.notes}</div>
          </div>
        )}

        {/* Ảnh — luôn hiển thị */}
        {!editing && (
          <div style={{ marginBottom: 14 }}>
            <ImgRow label="Ảnh kiện" urls={bundle.images || []} />
            <div style={{ marginTop: 10 }}>
              <ImgRow label="Ảnh danh sách chi tiết" urls={bundle.itemListImages || []} />
            </div>
          </div>
        )}

        {/* QR */}
        {bundle.qrCode && (
          <div style={{ marginBottom: 14, textAlign: "center" }}>
            <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--tm)", textTransform: "uppercase", marginBottom: 8 }}>Mã QR</div>
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(bundle.qrCode)}`} alt="QR" style={{ borderRadius: 6, border: "1px solid var(--bd)" }} />
            <div style={{ fontSize: "0.68rem", color: "var(--tm)", marginTop: 4, fontFamily: "monospace" }}>{bundle.qrCode}</div>
          </div>
        )}
        {bundle.createdAt && <div style={{ fontSize: "0.7rem", color: "var(--tm)", textAlign: "right" }}>Nhập kho: {String(bundle.createdAt).slice(0, 10)}</div>}
      </div>
    </div>
  );
}

// ── InventoryView ─────────────────────────────────────────────────────────────

function InventoryView({ wts, ats, cfg, bundles, onBack }) {
  const [sw, setSw] = useState(wts[0]?.id || '');

  const wc = cfg[sw] || { attrs: [], attrValues: {}, defaultHeader: [] };
  const hak = wc.defaultHeader || [];
  const hAttrs = hak.map(k => ({ key: k, label: ats.find(a => a.id === k)?.name || k, values: wc.attrValues?.[k] || [] }));
  const rAttrKeys = (wc.attrs || []).filter(k => !hak.includes(k));
  const rAttrs = rAttrKeys.map(k => ({ key: k, label: ats.find(a => a.id === k)?.name || k, values: wc.attrValues?.[k] || [] }));

  // Build row combinations
  const allRC = useMemo(() => {
    let combos = [{}];
    rAttrs.forEach(({ key, values }) => {
      const next = [];
      combos.forEach(c => values.forEach(v => next.push({ ...c, [key]: v })));
      combos = next;
    });
    return combos;
  }, [rAttrs]);

  // Build col combinations
  const colC = useMemo(() => {
    if (!hAttrs.length) return [{}];
    let combos = [{}];
    hAttrs.forEach(({ key, values }) => {
      const next = [];
      combos.forEach(c => values.forEach(v => next.push({ ...c, [key]: v })));
      combos = next;
    });
    return combos;
  }, [hAttrs]);

  // Inventory map: bpk → { boards, volume, count }
  const invMap = useMemo(() => {
    const m = {};
    bundles.filter(b => b.woodId === sw && b.status !== 'Đã bán').forEach(b => {
      const k = bpk(sw, b.attributes);
      if (!m[k]) m[k] = { boards: 0, volume: 0, count: 0 };
      m[k].boards += b.remainingBoards || 0;
      m[k].volume += parseFloat(b.remainingVolume) || 0;
      m[k].count += 1;
    });
    return m;
  }, [bundles, sw]);

  const getInv = (ra, ca) => {
    const key = bpk(sw, { ...ra, ...ca });
    return invMap[key] || null;
  };

  const hs = { padding: '5px 8px', textAlign: 'left', background: 'var(--bgh)', color: 'var(--brl)', fontWeight: 700, fontSize: '0.62rem', textTransform: 'uppercase', borderBottom: '2px solid var(--bds)', borderRight: '1px solid var(--bd)', whiteSpace: 'nowrap' };
  const ha = { background: 'var(--br)', color: '#FAF6F0', fontWeight: 800, fontSize: '0.65rem', textAlign: 'center', minWidth: 80 };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <button onClick={onBack} style={{ padding: '5px 12px', borderRadius: 6, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontWeight: 600, fontSize: '0.76rem' }}>← Danh sách kiện</button>
        <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--br)' }}>📊 Tồn kho theo SKU</h2>
      </div>
      <WoodPicker wts={wts} sel={sw} onSel={setSw} />
      <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--bds)', background: 'var(--bgc)' }}>
        <table style={{ width: 'max-content', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
          <colgroup>
            {rAttrs.map(a => <col key={a.key} />)}
            {colC.map((_, i) => <col key={i} style={{ minWidth: 80 }} />)}
          </colgroup>
          <thead>
            {hAttrs.length <= 1 ? (
              <tr>
                {rAttrs.map((a, i) => <th key={a.key} style={{ ...hs, position: i === 0 ? 'sticky' : undefined, left: i === 0 ? 0 : undefined, zIndex: i === 0 ? 4 : 2 }}>{a.label}</th>)}
                {hAttrs.length === 0
                  ? <th style={{ ...hs, ...ha }}>Tồn kho</th>
                  : colC.map(c => { const v = c[hAttrs[0].key]; return <th key={v} style={{ ...hs, ...ha }}>{v}</th>; })}
              </tr>
            ) : (
              <>
                <tr>
                  {rAttrs.map((a, i) => <th key={a.key} rowSpan={2} style={{ ...hs, position: i === 0 ? 'sticky' : undefined, left: i === 0 ? 0 : undefined, zIndex: i === 0 ? 4 : 2, verticalAlign: 'middle' }}>{a.label}</th>)}
                  {hAttrs[0].values.map(v1 => { const cs = colC.filter(c => c[hAttrs[0].key] === v1).length; return cs > 0 ? <th key={v1} colSpan={cs} style={{ ...hs, ...ha, width: 'auto', maxWidth: 'none' }}>{v1}</th> : null; })}
                </tr>
                <tr>
                  {colC.map((c, i) => <th key={i} style={{ padding: '4px 5px', textAlign: 'center', background: 'var(--brl)', color: '#FAF6F0', fontWeight: 700, fontSize: '0.6rem', borderBottom: '2px solid var(--bds)', borderRight: '1px solid var(--bd)', minWidth: 80 }}>{c[hAttrs[1].key]}</th>)}
                </tr>
              </>
            )}
          </thead>
          <tbody>
            {allRC.map((row, rI) => (
              <tr key={rI} style={{ background: rI % 2 === 0 ? '#fff' : 'var(--bgs)' }}>
                {rAttrs.map((at, aI) => (
                  <td key={at.key} style={{ padding: '5px 8px', fontWeight: aI === 0 ? 800 : 600, color: aI === 0 ? 'var(--br)' : 'var(--tp)', borderBottom: '1px solid var(--bd)', borderRight: '1px solid var(--bd)', whiteSpace: 'nowrap', fontSize: aI === 0 ? '0.78rem' : '0.72rem', position: aI === 0 ? 'sticky' : undefined, left: aI === 0 ? 0 : undefined, zIndex: aI === 0 ? 1 : 0, background: rI % 2 === 0 ? 'var(--bgc)' : 'var(--bgs)' }}>
                    {row[at.key]}
                  </td>
                ))}
                {colC.map((col, cI) => {
                  const inv = getInv(row, col);
                  const hasStock = inv && inv.boards > 0;
                  return (
                    <td key={cI} style={{ padding: '5px 6px', textAlign: 'center', borderBottom: '1px solid var(--bd)', borderRight: '1px solid var(--bd)', background: hasStock ? undefined : inv ? 'var(--bgs)' : undefined }}>
                      {inv ? (
                        <>
                          <div style={{ fontWeight: 700, fontSize: '0.82rem', color: hasStock ? 'var(--br)' : 'var(--tm)' }}>{inv.boards} tấm</div>
                          <div style={{ fontSize: '0.62rem', color: 'var(--tm)', marginTop: 1 }}>{inv.volume.toFixed(3)} m³</div>
                          {inv.count > 1 && <div style={{ fontSize: '0.55rem', color: 'var(--ac)', marginTop: 1 }}>{inv.count} kiện</div>}
                        </>
                      ) : (
                        <span style={{ color: 'var(--tm)', fontSize: '0.7rem' }}>—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {allRC.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--tm)' }}>Chưa có cấu hình SKU cho loại gỗ này</div>}
      </div>
    </div>
  );
}

// ── BundleAddForm ──────────────────────────────────────────────────────────────

function BundleAddForm({ wts, ats, cfg, containers, prices, useAPI, notify, setPg, onDone }) {
  const [fm, setFm] = useState({ woodId: wts[0]?.id || '', containerId: '', boardCount: '', volume: '', notes: '', supplierBundleCode: '', location: '' });
  const [attrs, setAttrs] = useState({});
  const [fmErr, setFmErr] = useState({});
  const [saving, setSaving] = useState(false);
  const [images, setImages] = useState([]);
  const [itemListImages, setItemListImages] = useState([]);

  const woodCfg = useMemo(() => cfg[fm.woodId] || { attrs: [], attrValues: {} }, [cfg, fm.woodId]);
  const availContainers = useMemo(() => containers.filter(c => c.status !== 'Đã nhập kho'), [containers]);

  useEffect(() => {
    const defaultAttrs = {};
    (woodCfg.attrs || []).forEach(atId => {
      const vals = woodCfg.attrValues?.[atId] || [];
      defaultAttrs[atId] = vals[0] || '';
    });
    setAttrs(defaultAttrs);
  }, [fm.woodId, woodCfg]);

  const computeSkuKey = () =>
    Object.entries(attrs).filter(([, v]) => v).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}:${v}`).join('||');

  const validate = () => {
    const errs = {};
    if (!fm.woodId) errs.woodId = 'Chọn loại gỗ';
    if (!fm.boardCount || parseInt(fm.boardCount) <= 0) errs.boardCount = 'Nhập số tấm';
    if (!fm.volume || parseFloat(fm.volume) <= 0) errs.volume = 'Nhập khối lượng';
    (woodCfg.attrs || []).forEach(atId => { if (!attrs[atId]) errs[`attr_${atId}`] = 'Bắt buộc'; });
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
      const result = await addBundle({ woodId: fm.woodId, containerId: fm.containerId || null, skuKey, attributes: { ...attrs }, boardCount: parseInt(fm.boardCount), volume: parseFloat(fm.volume), notes: fm.notes, supplierBundleCode: fm.supplierBundleCode, location: fm.location });
      if (result.error) { notify('Lỗi: ' + result.error, false); setSaving(false); return; }

      let imgUrls = [], itemImgUrls = [];
      for (const img of images) { const r = await uploadBundleImage(result.bundleCode, img.file, 'photo'); if (r.error) throw new Error('Upload ảnh kiện: ' + r.error); imgUrls.push(r.url); }
      for (const img of itemListImages) { const r = await uploadBundleImage(result.bundleCode, img.file, 'item-list'); if (r.error) throw new Error('Upload ảnh chi tiết: ' + r.error); itemImgUrls.push(r.url); }
      if (imgUrls.length || itemImgUrls.length) {
        await updateBundle(result.id, { ...(imgUrls.length && { images: imgUrls }), ...(itemImgUrls.length && { item_list_images: itemImgUrls }) });
      }

      const newBundle = { id: result.id, bundleCode: result.bundleCode, woodId: fm.woodId, containerId: fm.containerId ? parseInt(fm.containerId) : null, skuKey, attributes: { ...attrs }, boardCount: parseInt(fm.boardCount), remainingBoards: parseInt(fm.boardCount), volume: parseFloat(fm.volume), remainingVolume: parseFloat(fm.volume), status: 'Còn hàng', notes: fm.notes, supplierBundleCode: fm.supplierBundleCode, location: fm.location, qrCode: result.bundleCode, images: imgUrls, itemListImages: itemImgUrls, createdAt: new Date().toISOString() };

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

        {/* Supplier bundle code & Location */}
        <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 200px" }}>
            <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "var(--brl)", marginBottom: 5, textTransform: "uppercase" }}>Mã kiện nhà cung cấp</label>
            <input value={fm.supplierBundleCode} onChange={e => setFm(p => ({ ...p, supplierBundleCode: e.target.value }))} placeholder="Mã kiện theo NCC"
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
                return (
                  <div key={atId} style={{ flex: "1 1 180px", minWidth: 160 }}>
                    <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: "var(--ts)", marginBottom: 4 }}>{label} *</label>
                    {vals.length > 0 ? (
                      <select value={attrs[atId] || ''} onChange={e => { setAttrs(p => ({ ...p, [atId]: e.target.value })); setFmErr(p => ({ ...p, [errKey]: '' })); }}
                        style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid " + (fmErr[errKey] ? "var(--dg)" : "var(--bd)"), fontSize: "0.82rem", outline: "none", background: "var(--bgc)", boxSizing: "border-box" }}>
                        <option value="">— Chọn —</option>
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
            <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "var(--brl)", marginBottom: 5, textTransform: "uppercase" }}>Khối lượng (m³) *</label>
            <input type="number" min="0.001" step="0.001" value={fm.volume} onChange={e => { setFm(p => ({ ...p, volume: e.target.value })); setFmErr(p => ({ ...p, volume: '' })); }} placeholder="VD: 0.850"
              style={{ width: "100%", padding: "9px 10px", borderRadius: 6, border: "1.5px solid " + (fmErr.volume ? "var(--dg)" : "var(--bd)"), fontSize: "0.88rem", outline: "none", boxSizing: "border-box" }} />
            {fmErr.volume && <div style={{ fontSize: "0.65rem", color: "var(--dg)", marginTop: 2 }}>{fmErr.volume}</div>}
          </div>
        </div>

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

export default function PgWarehouse({ wts, ats, cfg, prices, suppliers, ce, useAPI, notify, setPg, bundles, setBundles }) {
  const [containers, setContainers] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [view, setView] = useState('list');
  const [detail, setDetail] = useState(null);
  const [fWood, setFWood] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fSearch, setFSearch] = useState('');
  const [sortField, setSortField] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const [showExtraCols, setShowExtraCols] = useState(false);
  const [extraCols, setExtraCols] = useState(new Set());

  const EXTRA_COL_OPTS = [
    { id: 'supplier', label: 'Nhà cung cấp' },
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

  const filtered = useMemo(() => {
    let arr = [...bundles];
    if (fWood) arr = arr.filter(b => b.woodId === fWood);
    if (fStatus) arr = arr.filter(b => b.status === fStatus);
    if (fSearch) {
      const s = fSearch.toLowerCase();
      arr = arr.filter(b => b.bundleCode.toLowerCase().includes(s) || Object.values(b.attributes).some(v => String(v).toLowerCase().includes(s)));
    }
    arr.sort((a, b) => {
      let va = a[sortField], vb = b[sortField];
      if (va == null) va = ''; if (vb == null) vb = '';
      const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [bundles, fWood, fStatus, fSearch, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const toggleSort = (field) => { setSortField(field); setSortDir(d => sortField === field ? (d === 'asc' ? 'desc' : 'asc') : 'asc'); setPage(1); };
  const sortIcon = (field) => sortField === field ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';
  const hasFilters = fWood || fStatus || fSearch;

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
    const { deleteBundle } = await import('../api.js');
    const r = await deleteBundle(bundle.id);
    if (r.error) return notify('Lỗi: ' + r.error, false);
    setBundles(prev => prev.filter(b => b.id !== bundle.id));
    notify('Đã xóa kiện gỗ');
  };

  if (loadingList) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--tm)' }}>Đang tải...</div>;

  if (view === 'add') return (
    <BundleAddForm wts={wts} ats={ats} cfg={cfg} containers={containers} prices={prices} useAPI={useAPI} notify={notify} setPg={setPg}
      onDone={(newBundle) => { if (newBundle) setBundles(prev => [newBundle, ...prev]); setView('list'); }} />
  );

  if (view === 'inventory') return (
    <InventoryView wts={wts} ats={ats} cfg={cfg} bundles={bundles} onBack={() => setView('list')} />
  );

  const ths = { padding: "8px 10px", textAlign: "left", background: "var(--bgh)", color: "var(--brl)", fontWeight: 700, fontSize: "0.65rem", textTransform: "uppercase", borderBottom: "2px solid var(--bds)", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "var(--br)" }}>🏪 Tồn kho gỗ kiện</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setView('inventory')} style={{ padding: "7px 14px", borderRadius: 7, background: "var(--bgs)", color: "var(--br)", border: "1.5px solid var(--bds)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>📊 Tồn kho SKU</button>
          {ce && <button onClick={() => setView('add')} style={{ padding: "7px 16px", borderRadius: 7, background: "var(--ac)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>+ Nhập kho</button>}
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        {[
          { label: 'Tổng kiện', val: bundles.length, color: 'var(--br)' },
          { label: 'Kiện nguyên', val: bundles.filter(b => b.status === 'Kiện nguyên').length, color: 'var(--gn)' },
          { label: 'Kiện lẻ', val: bundles.filter(b => b.status === 'Kiện lẻ').length, color: 'var(--ac)' },
          { label: 'Chưa được bán', val: bundles.filter(b => b.status === 'Chưa được bán').length, color: '#7C5CBF' },
          { label: 'Tổng KL còn', val: bundles.reduce((s, b) => s + (b.remainingVolume || 0), 0).toFixed(2) + ' m³', color: 'var(--br)' },
        ].map(s => (
          <div key={s.label} style={{ padding: "8px 14px", borderRadius: 8, background: "var(--bgc)", border: "1px solid var(--bd)", minWidth: 110 }}>
            <div style={{ fontSize: "0.6rem", color: "var(--tm)", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontSize: "1rem", fontWeight: 800, color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8, padding: "10px 12px", borderRadius: 8, background: "var(--bgc)", border: "1px solid var(--bd)", alignItems: "center" }}>
        <input value={fSearch} onChange={e => { setFSearch(e.target.value); setPage(1); }} placeholder="🔍 Tìm mã kiện, thuộc tính..."
          style={{ flex: 2, minWidth: 160, padding: "6px 10px", borderRadius: 6, border: "1.5px solid var(--bd)", fontSize: "0.78rem", outline: "none" }} />
        <select value={fWood} onChange={e => { setFWood(e.target.value); setPage(1); }}
          style={{ flex: 1, minWidth: 140, padding: "6px 10px", borderRadius: 6, border: "1.5px solid var(--bd)", fontSize: "0.78rem", background: "var(--bgc)", color: "var(--tp)", outline: "none" }}>
          <option value="">Tất cả loại gỗ</option>
          {wts.map(w => <option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
        </select>
        <select value={fStatus} onChange={e => { setFStatus(e.target.value); setPage(1); }}
          style={{ flex: 1, minWidth: 130, padding: "6px 10px", borderRadius: 6, border: "1.5px solid var(--bd)", fontSize: "0.78rem", background: "var(--bgc)", color: "var(--tp)", outline: "none" }}>
          <option value="">Tất cả tình trạng</option>
          {BUNDLE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {hasFilters && <button onClick={() => { setFWood(''); setFStatus(''); setFSearch(''); setPage(1); }} style={{ padding: "6px 12px", borderRadius: 6, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600, whiteSpace: "nowrap" }}>✕ Xóa lọc</button>}
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
              <tr style={{ background: "var(--bgs)" }}>
                {[
                  { field: 'bundleCode', label: 'Mã kiện' },
                  { field: 'supplierBundleCode', label: 'Mã kiện NCC', noSort: true },
                  { field: 'woodId', label: 'Loại gỗ' },
                  { field: 'thickness', label: 'Độ dày', noSort: true },
                  { field: 'quality', label: 'Chất lượng', noSort: true },
                  ...(extraCols.has('supplier') ? [{ field: 'supplier', label: 'Nhà cung cấp', noSort: true }] : []),
                  ...(extraCols.has('edging') ? [{ field: 'edging', label: 'Dong cạnh', noSort: true }] : []),
                  { field: 'length', label: 'Độ dài', noSort: true },
                  { field: 'status', label: 'Tình trạng' },
                  { field: 'remainingBoards', label: 'Số tấm còn' },
                  { field: 'remainingVolume', label: 'KL còn (m³)' },
                  { field: 'location', label: 'Vị trí' },
                  { field: 'notes', label: 'Ghi chú', noSort: true },
                  ...(extraCols.has('container') ? [{ field: 'containerId', label: 'Container' }] : []),
                  ...(extraCols.has('createdAt') ? [{ field: 'createdAt', label: 'Ngày nhập' }] : []),
                  { field: '_actions', label: '', noSort: true },
                ].map(col => (
                  <th key={col.field} onClick={() => !col.noSort && toggleSort(col.field)}
                    style={{ ...ths, cursor: col.noSort ? 'default' : 'pointer', textAlign: ['remainingBoards', 'remainingVolume'].includes(col.field) ? 'right' : 'left' }}>
                    {col.label}{!col.noSort && sortIcon(col.field)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={20} style={{ padding: 30, textAlign: "center", color: "var(--tm)" }}>{bundles.length === 0 ? 'Chưa có kiện gỗ nào. Bấm "+ Nhập kho" để bắt đầu.' : 'Không tìm thấy kết quả phù hợp.'}</td></tr>
              ) : paginated.map((b, idx) => {
                const wood = wts.find(w => w.id === b.woodId);
                const cont = b.containerId ? containers.find(c => c.id === b.containerId) : null;
                const ncc = cont?.nccId ? suppliers.find(s => s.nccId === cont.nccId) : null;
                const { color: statusColor, bg: statusBg } = statusSt(b.status);
                const tdBase = { padding: "7px 10px", borderBottom: "1px solid var(--bd)", whiteSpace: "nowrap" };
                return (
                  <tr key={b.id} style={{ background: idx % 2 ? "var(--bgs)" : "#fff", cursor: "pointer" }} onClick={() => setDetail(b)}>
                    <td style={{ ...tdBase, fontWeight: 700, color: "var(--br)", fontFamily: "monospace", fontSize: "0.82rem" }}>{b.bundleCode}</td>
                    <td style={{ ...tdBase, fontFamily: "monospace", fontSize: "0.76rem", color: "var(--ts)" }}>{b.supplierBundleCode || '—'}</td>
                    <td style={tdBase}>{wood?.icon} {wood?.name || b.woodId}</td>
                    <td style={tdBase}>{b.attributes.thickness || '—'}</td>
                    <td style={tdBase}>{b.attributes.quality || '—'}</td>
                    {extraCols.has('supplier') && <td style={tdBase}>{ncc?.name || '—'}</td>}
                    {extraCols.has('edging') && <td style={tdBase}>{b.attributes.edging || '—'}</td>}
                    <td style={tdBase}>{b.attributes.length || '—'}</td>
                    <td style={tdBase}><span style={{ padding: "2px 8px", borderRadius: 4, fontSize: "0.68rem", fontWeight: 700, background: statusBg, color: statusColor }}>{b.status}</span></td>
                    <td style={{ ...tdBase, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{b.remainingBoards}<span style={{ fontSize: "0.62rem", color: "var(--tm)" }}>/{b.boardCount}</span></td>
                    <td style={{ ...tdBase, textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{(b.remainingVolume || 0).toFixed(3)}<span style={{ fontSize: "0.62rem", color: "var(--tm)" }}>/{(b.volume || 0).toFixed(3)}</span></td>
                    <td style={tdBase}>{b.location || '—'}</td>
                    <td style={{ ...tdBase, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", color: "var(--ts)", fontSize: "0.76rem" }}>{b.notes || '—'}</td>
                    {extraCols.has('container') && <td style={{ ...tdBase, fontFamily: "monospace", fontSize: "0.74rem" }}>{cont?.containerCode || (b.containerId ? '#' + b.containerId : '—')}</td>}
                    {extraCols.has('createdAt') && <td style={{ ...tdBase, color: "var(--tm)", fontSize: "0.74rem" }}>{b.createdAt ? String(b.createdAt).slice(0, 10) : '—'}</td>}
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
      {detail && <BundleDetail bundle={detail} wts={wts} containers={containers} suppliers={suppliers} ats={ats} ce={ce} onClose={() => setDetail(null)} onSave={handleBundleSave} onStatusChange={handleStatusChange} />}
    </div>
  );
}
