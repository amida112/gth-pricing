import React, { useState, useEffect, useMemo, useRef } from "react";
import { bpk, resolveRangeGroup, isM2Wood } from "../utils";
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

function BundleDetail({ bundle, wts, containers, suppliers, ats, ce, cePrice, onClose, onSave, onStatusChange }) {
  const wood = wts.find(w => w.id === bundle.woodId);
  const cont = bundle.containerId ? containers.find(c => c.id === bundle.containerId) : null;
  const ncc = cont?.nccId ? suppliers.find(s => s.nccId === cont.nccId) : null;
  const atLabels = Object.fromEntries(ats.map(a => [a.id, a.name]));
  const { color: statusColor, bg: statusBg } = statusSt(bundle.status);
  const isPerBundleWood = wts.find(w => w.id === bundle.woodId)?.pricingMode === 'perBundle';
  const isM2Bundle = isM2Wood(bundle.woodId, wts);
  const volUnit = isM2Bundle ? 'm²' : 'm³';

  const [editing, setEditing] = useState(false);
  const [location, setLocation] = useState(bundle.location || '');
  const [existingImgs, setExistingImgs] = useState(bundle.images || []);
  useEffect(() => { const h = e => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h); }, [onClose]);
  const [newImgFiles, setNewImgFiles] = useState([]);
  const [existingItemImgs, setExistingItemImgs] = useState(bundle.itemListImages || []);
  const [newItemImgFiles, setNewItemImgFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [unitPrice, setUnitPrice] = useState(bundle.unitPrice ?? null);
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceVal, setPriceVal] = useState('');

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
            { label: "Số tấm ban đầu", val: `${bundle.boardCount} tấm` },
            { label: "Số tấm còn lại", val: `${bundle.remainingBoards} tấm`, hi: bundle.remainingBoards < bundle.boardCount },
            { label: isM2Bundle ? "Diện tích ban đầu" : "Khối lượng ban đầu", val: `${(bundle.volume || 0).toFixed(isM2Bundle ? 2 : 3)} ${volUnit}` },
            { label: isM2Bundle ? "DT còn lại" : "KL còn lại", val: `${(bundle.remainingVolume || 0).toFixed(isM2Bundle ? 2 : 3)} ${volUnit}`, hi: bundle.remainingVolume < bundle.volume },
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
                      <span style={{ fontWeight: 700 }}>{rawVal}m</span>
                      <span style={{ color: "var(--tm)", fontSize: "0.65rem", marginLeft: 4 }}>({v}{isManualAttr ? " ⚠️" : ""})</span>
                    </>
                  ) : v}
                </span>
              );
            })}
          </div>
          {bundle.manualGroupAssignment && (
            <div style={{ marginTop: 6, fontSize: "0.65rem", color: "var(--ac)", display: "flex", alignItems: "center", gap: 4 }}>
              ⚠️ Một số thuộc tính được gán nhóm thủ công — chiều dài thực không khớp hoàn toàn với nhóm giá.
            </div>
          )}
        </div>

        {/* Giá kiện (perBundle woods) */}
        {isPerBundleWood && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--tm)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Giá bán</div>
            {editingPrice ? (
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
                <span style={{ fontSize: "1rem", fontWeight: 800, color: unitPrice ? "var(--br)" : "var(--tm)" }}>
                  {unitPrice ? `${unitPrice} tr/m³` : 'Chưa có giá'}
                </span>
                {cePrice && (
                  <button onClick={() => { setPriceVal(unitPrice ? String(unitPrice) : ''); setEditingPrice(true); }}
                    style={{ padding: "3px 10px", borderRadius: 5, border: "1.5px solid var(--ac)", background: "var(--acbg)", color: "var(--ac)", cursor: "pointer", fontWeight: 700, fontSize: "0.72rem" }}>Sửa giá</button>
                )}
              </div>
            )}
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

function InventoryView({ wts, ats, cfg, bundles, onBack, ce }) {
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

  // Inventory map: bpk → { boards, volume, count, splitCount }
  const invMap = useMemo(() => {
    const m = {};
    bundles.filter(b => b.woodId === sw && b.status !== 'Đã bán').forEach(b => {
      const k = bpk(sw, b.attributes);
      if (!m[k]) m[k] = { boards: 0, volume: 0, count: 0, splitCount: 0 };
      m[k].boards += b.remainingBoards || 0;
      m[k].volume += parseFloat(b.remainingVolume) || 0;
      m[k].count += 1;
      if (b.status === 'Kiện lẻ') m[k].splitCount += 1;
    });
    return m;
  }, [bundles, sw]);

  const getInv = (ra, ca) => {
    const key = bpk(sw, { ...ra, ...ca });
    return invMap[key] || null;
  };

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
                    <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--bd)', fontWeight: 700 }}>{b.attributes.length || '—'}</td>
                    <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--bd)' }}>{b.attributes.width || '—'}</td>
                    <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--bd)' }}>{b.attributes.thickness || '—'}</td>
                    <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--bd)', textAlign: 'right', fontWeight: 700, color: b.unitPrice ? 'var(--ac)' : 'var(--tm)' }}>{b.unitPrice ? b.unitPrice.toFixed(1) : '—'}</td>
                    <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--bd)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{b.remainingBoards}<span style={{ color: 'var(--tm)', fontSize: '0.65rem' }}>/{b.boardCount}</span></td>
                    <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--bd)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{(b.remainingVolume || 0).toFixed(3)}<span style={{ color: 'var(--tm)', fontSize: '0.65rem' }}>/{(b.volume || 0).toFixed(3)}</span></td>
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
          </colgroup>
          <thead>
            {hAttrs.length <= 1 ? (
              <tr>
                {rAttrs.map((a, i) => <th key={a.key} style={{ ...hs, position: i === 0 ? 'sticky' : undefined, left: i === 0 ? 0 : undefined, zIndex: i === 0 ? 4 : 2 }}>{a.label}</th>)}
                {hAttrs.length === 0
                  ? <th style={{ ...hs, ...ha }}>Tồn kho</th>
                  : visibleColC.map(c => { const v = c[hAttrs[0].key]; return <th key={v} style={{ ...hs, ...ha }}>{v}</th>; })}
              </tr>
            ) : (
              <>
                <tr>
                  {rAttrs.map((a, i) => <th key={a.key} rowSpan={2} style={{ ...hs, position: i === 0 ? 'sticky' : undefined, left: i === 0 ? 0 : undefined, zIndex: i === 0 ? 4 : 2, verticalAlign: 'middle' }}>{a.label}</th>)}
                  {hAttrs[0].values.map(v1 => { const cs = visibleColC.filter(c => c[hAttrs[0].key] === v1).length; return cs > 0 ? <th key={v1} colSpan={cs} style={{ ...hs, ...ha, width: 'auto', maxWidth: 'none' }}>{v1}</th> : null; })}
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
                        {row[at.key]}
                      </td>
                    );
                  }
                  return (
                  <td key={at.key} style={{ padding: '5px 8px', fontWeight: aI === 0 ? 800 : 600, color: aI === 0 ? 'var(--br)' : 'var(--tp)', borderBottom: '1px solid var(--bd)', borderRight: '1px solid var(--bd)', whiteSpace: 'nowrap', fontSize: aI === 0 ? '0.78rem' : '0.72rem', position: aI === 0 ? 'sticky' : undefined, left: aI === 0 ? 0 : undefined, zIndex: aI === 0 ? 1 : 0, background: rI % 2 === 0 ? 'var(--bgc)' : 'var(--bgs)' }}>
                    {row[at.key]}
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
              </tr>
              );
            })}
          </tbody>
        </table>
        {visibleRC.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--tm)' }}>{onlyStock ? 'Không có SKU nào còn tồn kho' : 'Chưa có cấu hình SKU cho loại gỗ này'}</div>}
      </div>
      )}
    </div>
  );
}

// ── BundleImportForm ───────────────────────────────────────────────────────────

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
  const headers = parseRow(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'));
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

  const TEMPLATE_HEADER = ['wood_id', 'supplier_bundle_code', 'board_count', 'remaining_boards', 'volume', 'remaining_volume', 'unit_price', 'location', 'notes', ...allAttrIds];

  // Lookup map cho update mode
  const existingByCode = useMemo(
    () => Object.fromEntries(existingBundles.filter(b => b.supplierBundleCode).map(b => [b.supplierBundleCode, b])),
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

  // V-22: build set supplierBundleCode đã tồn tại trong kho
  const existingCodes = useMemo(
    () => new Set(existingBundles.map(b => b.supplierBundleCode).filter(Boolean)),
    [existingBundles]
  );

  // ── Update mode: chỉ cần supplier_bundle_code để match, attr nào có giá trị thì cập nhật ──
  const validateRowsUpdate = (rows) => {
    const batchCodes = {};
    rows.forEach((row, i) => { if (row.supplier_bundle_code) batchCodes[row.supplier_bundle_code] = (batchCodes[row.supplier_bundle_code] || []).concat(i + 1); });
    return rows.map((row, i) => {
      const errors = [];
      const code = (row.supplier_bundle_code || '').trim();
      if (!code) errors.push('supplier_bundle_code bắt buộc cho chế độ cập nhật');
      else if ((batchCodes[code] || []).length > 1) errors.push(`Mã "${code}" bị trùng trong file (dòng ${batchCodes[code].join(', ')})`);
      const existing = code ? existingByCode[code] : null;
      if (code && !existing) errors.push(`Không tìm thấy kiện mã NCC "${code}" trong kho`);
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
            if (resolved) { updatedAttrs[atId] = resolved; }
            else {
              const allowed = woodCfg?.attrValues?.[atId] || [];
              if (allowed.includes(val)) updatedAttrs[atId] = val;
              else errors.push(`${atId}="${val}" không khớp nhóm nào. Hợp lệ: ${allowed.join(', ')}`);
            }
          } else {
            updatedAttrs[atId] = val;
          }
        });
        if (Object.keys(updatedAttrs).length === 0 && !errors.length)
          errors.push('Không có thuộc tính nào cần cập nhật (tất cả cột attr đều trống)');
      }
      return { ...row, _existing: existing || null, _updatedAttrs: updatedAttrs, _errors: errors, _idx: i + 1 };
    });
  };

  const validateRows = (rows) => {
    // Check trùng trong chính batch CSV
    const batchCodes = {};
    rows.forEach((row, i) => { if (row.supplier_bundle_code) { batchCodes[row.supplier_bundle_code] = (batchCodes[row.supplier_bundle_code] || []).concat(i + 1); } });
    return rows.map((row, i) => {
    const errors = [];
    const woodId = resolveWood(row.wood_id);
    if (!woodId) errors.push(`Loại gỗ "${row.wood_id}" không hợp lệ`);
    const boardCount = parseInt(row.board_count);
    if (!boardCount || boardCount <= 0) errors.push('board_count phải là số nguyên > 0');
    const volume = parseFloat(row.volume);
    if (!volume || volume <= 0) errors.push('volume phải là số > 0');
    const remainingBoards = row.remaining_boards !== '' && row.remaining_boards != null ? parseInt(row.remaining_boards) : boardCount;
    if (isNaN(remainingBoards) || remainingBoards < 0) errors.push('remaining_boards phải là số nguyên ≥ 0');
    else if (remainingBoards > boardCount) errors.push(`remaining_boards (${remainingBoards}) không thể lớn hơn board_count (${boardCount})`);
    const remainingVolume = row.remaining_volume !== '' && row.remaining_volume != null ? parseFloat(row.remaining_volume) : volume;
    if (isNaN(remainingVolume) || remainingVolume < 0) errors.push('remaining_volume phải là số ≥ 0');
    else if (remainingVolume > volume) errors.push(`remaining_volume (${remainingVolume}) không thể lớn hơn volume (${volume})`);
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
        if (!val) { errors.push(`${atId} bắt buộc cho ${woodId}`); return; }
        // Range attr: thử tự động resolve, nếu không khớp kiểm tra trực tiếp label
        const woodRangeGroups = woodCfg.rangeGroups?.[atId];
        if (woodRangeGroups?.length) {
          const resolved = resolveRangeGroup(val, woodRangeGroups);
          if (resolved) {
            attrs[atId] = resolved;
            rawMeas[atId] = val;
          } else if (allowed.includes(val)) {
            attrs[atId] = val; // nhập thẳng label nhóm
          } else {
            errors.push(`${atId}="${val}" không khớp nhóm nào. Giá trị hợp lệ: ${allowed.join(', ')}`);
          }
        } else {
          if (allowed.length && !allowed.includes(val)) {
            // Thử normalize: "2" → "2F", "2f" → "2F", case-insensitive
            const candidates = [
              val + 'F',
              val.toUpperCase(),
              val.charAt(0).toUpperCase() + val.slice(1).toLowerCase(),
              /^\d+$/.test(val) ? val + 'F' : null,
              /^\d+f$/i.test(val) ? val.slice(0, -1) + 'F' : null,
            ].filter(Boolean);
            const matched = candidates.find(c => allowed.includes(c));
            if (matched) { attrs[atId] = matched; }
            else { errors.push(`${atId}="${val}" không hợp lệ (${allowed.join(', ')})`); }
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
    // V-22: check trùng supplierBundleCode
    if (row.supplier_bundle_code) {
      if (existingCodes.has(row.supplier_bundle_code)) {
        errors.push(`Mã kiện NCC "${row.supplier_bundle_code}" đã tồn tại trong kho`);
      } else if ((batchCodes[row.supplier_bundle_code] || []).length > 1) {
        errors.push(`Mã kiện NCC "${row.supplier_bundle_code}" bị trùng trong file CSV (dòng ${batchCodes[row.supplier_bundle_code].join(', ')})`);
      }
    }
    const unitPriceRaw = row.unit_price?.trim();
    const _unitPrice = unitPriceRaw ? parseFloat(unitPriceRaw) : null;
    const isPerBundleWood = woodId && wts.find(w => w.id === woodId)?.pricingMode === 'perBundle';
    if (_unitPrice !== null && isPerBundleWood && (isNaN(_unitPrice) || _unitPrice <= 0)) errors.push('unit_price phải là số > 0');
    return { ...row, _woodId: woodId, _boardCount: boardCount, _volume: volume, _remainingBoards: remainingBoards, _remainingVolume: remainingVolume, _unitPrice: isPerBundleWood ? _unitPrice : null, _attrs: attrs, _rawMeas: rawMeas, _errors: errors, _idx: i + 1 };
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
        const r = await addBundle({ woodId: row._woodId, containerId: null, skuKey, attributes: row._attrs, boardCount: row._boardCount, remainingBoards: row._remainingBoards, volume: row._volume, remainingVolume: row._remainingVolume, status: derivedStatus, notes: row.notes || '', supplierBundleCode: row.supplier_bundle_code || '', location: row.location || '', rawMeasurements: hasRaw ? row._rawMeas : undefined, manualGroupAssignment: false, ...(row._unitPrice ? { unit_price: row._unitPrice } : {}) });
        if (r.error) apiErrorRows.push({ ...row, _apiError: r.error });
        else results.push({ id: r.id, bundleCode: r.bundleCode, woodId: row._woodId, containerId: null, skuKey, attributes: row._attrs, boardCount: row._boardCount, remainingBoards: row._remainingBoards, volume: row._volume, remainingVolume: row._remainingVolume, status: derivedStatus, notes: row.notes || '', supplierBundleCode: row.supplier_bundle_code || '', location: row.location || '', qrCode: r.bundleCode, images: [], itemListImages: [], rawMeasurements: row._rawMeas || {}, manualGroupAssignment: false, createdAt: new Date().toISOString(), ...(row._unitPrice ? { unitPrice: row._unitPrice } : {}) });
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
      try {
        const r = await updateBundleFn(b.id, { attributes: mergedAttrs, sku_key: newSkuKey });
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
      const row = { wood_id: w.id, supplier_bundle_code: `NCC-00${wi + 1}`, board_count: '20', remaining_boards: isPartial ? '12' : '20', volume: '1.250', remaining_volume: isPartial ? '0.750' : '1.250', unit_price: w.pricingMode === 'perBundle' ? '14.5' : '', location: 'Kho A', notes: isPartial ? 'Kiện lẻ còn lại' : '' };
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
                  {progress.apiErrorRows.map((r, i) => <div key={i} style={{ fontSize: '0.7rem', color: 'var(--dg)', padding: '1px 0' }}>Dòng {r._idx} ({r.supplier_bundle_code || r.wood_id}): {r._apiError}</div>)}
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
                  supplier_bundle_code: wi === 0 ? 'NCC-001' : 'NCC-002',
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
        <textarea value={rawText} onChange={e => { setRawText(e.target.value); setParsed(null); }} placeholder={'wood_id,supplier_bundle_code,board_count,volume,location,notes,' + allAttrIds.join(',') + '\nwalnut,NCC-001,25,1.250,Kho A,,2F,Fas,,1.6-1.9m,,'}
          style={{ width: '100%', minHeight: 120, padding: '8px 10px', borderRadius: 7, border: '1.5px solid var(--bd)', fontSize: '0.74rem', fontFamily: 'monospace', outline: 'none', resize: 'vertical', boxSizing: 'border-box', background: 'var(--bg)' }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button onClick={handleParse} disabled={!rawText.trim()} style={{ padding: '7px 18px', borderRadius: 6, border: 'none', background: rawText.trim() ? 'var(--br)' : 'var(--bd)', color: rawText.trim() ? '#fff' : 'var(--tm)', cursor: rawText.trim() ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: '0.78rem' }}>🔍 Kiểm tra dữ liệu</button>
          {parsed && <span style={{ fontSize: '0.74rem', color: 'var(--tm)', alignSelf: 'center' }}>{parsed.length} dòng — <span style={{ color: 'var(--gn)', fontWeight: 700 }}>{validRows.length} hợp lệ</span>{errorRows.length > 0 && <span style={{ color: 'var(--dg)', fontWeight: 700 }}> · {errorRows.length} lỗi</span>}</span>}
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
                      <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--bd)', fontSize: '0.65rem', color: hasErr ? 'var(--dg)' : 'var(--gn)', maxWidth: 260, whiteSpace: 'normal' }}>
                        {hasErr ? row._errors.join('; ') : '✓'}
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

function BundleAddForm({ wts, ats, cfg, containers, prices, bundles, cePrice, useAPI, notify, setPg, onDone }) {
  const [fm, setFm] = useState({ woodId: wts[0]?.id || '', containerId: '', boardCount: '', volume: '', notes: '', supplierBundleCode: '', location: '' });
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
      const hasRaw = Object.keys(rawMeasurements).some(k => rawMeasurements[k]);
      const parsedUnitPrice = isPerBundleWood && cePrice && unitPrice ? parseFloat(unitPrice) : undefined;
      const result = await addBundle({ woodId: fm.woodId, containerId: fm.containerId || null, skuKey, attributes: { ...attrs }, boardCount: parseInt(fm.boardCount), volume: parseFloat(fm.volume), notes: fm.notes, supplierBundleCode: fm.supplierBundleCode, location: fm.location, rawMeasurements: hasRaw ? rawMeasurements : undefined, manualGroupAssignment: Object.values(manualGroups).some(Boolean), ...(parsedUnitPrice ? { unit_price: parsedUnitPrice } : {}) });
      if (result.error) { notify('Lỗi: ' + result.error, false); setSaving(false); return; }

      let imgUrls = [], itemImgUrls = [];
      for (const img of images) { const r = await uploadBundleImage(result.bundleCode, img.file, 'photo'); if (r.error) throw new Error('Upload ảnh kiện: ' + r.error); imgUrls.push(r.url); }
      for (const img of itemListImages) { const r = await uploadBundleImage(result.bundleCode, img.file, 'item-list'); if (r.error) throw new Error('Upload ảnh chi tiết: ' + r.error); itemImgUrls.push(r.url); }
      if (imgUrls.length || itemImgUrls.length) {
        await updateBundle(result.id, { ...(imgUrls.length && { images: imgUrls }), ...(itemImgUrls.length && { item_list_images: itemImgUrls }) });
      }

      const parsedUnitPriceForState = isPerBundleWood && cePrice && unitPrice ? parseFloat(unitPrice) : undefined;
      const newBundle = { id: result.id, bundleCode: result.bundleCode, woodId: fm.woodId, containerId: fm.containerId ? parseInt(fm.containerId) : null, skuKey, attributes: { ...attrs }, boardCount: parseInt(fm.boardCount), remainingBoards: parseInt(fm.boardCount), volume: parseFloat(fm.volume), remainingVolume: parseFloat(fm.volume), status: 'Kiện nguyên', notes: fm.notes, supplierBundleCode: fm.supplierBundleCode, location: fm.location, qrCode: result.bundleCode, images: imgUrls, itemListImages: itemImgUrls, rawMeasurements: rawMeasurements, manualGroupAssignment: Object.values(manualGroups).some(Boolean), createdAt: new Date().toISOString(), ...(parsedUnitPriceForState ? { unitPrice: parsedUnitPriceForState } : {}) };

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
                      setAttrs(p => ({ ...p, [atId]: grp }));
                      setManualGroups(p => ({ ...p, [atId]: false }));
                    } else {
                      setAttrs(p => ({ ...p, [atId]: '' }));
                      setManualGroups(p => ({ ...p, [atId]: !!val.trim() }));
                    }
                    setFmErr(p => ({ ...p, [errKey]: '' }));
                  };
                  const rawHint = atId === 'thickness' ? 'VD: 2.2 hoặc 3' : 'VD: 1.6-1.9 hoặc 2.5';
                  return (
                    <div key={atId} style={{ flex: "1 1 220px", minWidth: 200 }}>
                      <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: "var(--ts)", marginBottom: 4 }}>
                        {label} thực tế *
                        <span style={{ fontWeight: 400, color: "var(--tm)", marginLeft: 4 }}>({rawHint})</span>
                      </label>
                      <input value={rawVal} onChange={e => handleRawChange(e.target.value)} placeholder={rawHint}
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

                // ── Thuộc tính thông thường ───────────────────────────────────
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

export default function PgWarehouse({ wts, ats, cfg, prices, suppliers, ce, cePrice, useAPI, notify, setPg, bundles, setBundles }) {
  const [containers, setContainers] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [view, setView] = useState('list');
  const [detail, setDetail] = useState(null);
  const [fWood, setFWood] = useState(wts[0]?.id || '');
  const [fStatus, setFStatus] = useState('');
  const [fLength, setFLength] = useState('');
  const [fOutOfRange, setFOutOfRange] = useState(false);
  const [fSearch, setFSearch] = useState('');
  const [sortField, setSortField] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const [showExtraCols, setShowExtraCols] = useState(false);
  const [extraCols, setExtraCols] = useState(new Set(['supplier']));

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
    if (fLength) arr = arr.filter(b => b.attributes?.length === fLength);
    if (fOutOfRange) arr = arr.filter(b => {
      const rg = cfg[b.woodId]?.rangeGroups?.length;
      if (!rg?.length) return false; // loại gỗ không có rangeGroups → không "ngoài khoảng"
      const raw = b.rawMeasurements?.length;
      if (!raw) return false;
      return resolveRangeGroup(raw, rg) === null;
    });
    if (fSearch) {
      const s = fSearch.toLowerCase();
      arr = arr.filter(b => b.bundleCode.toLowerCase().includes(s) || (b.supplierBundleCode && b.supplierBundleCode.toLowerCase().includes(s)) || Object.values(b.attributes).some(v => String(v).toLowerCase().includes(s)));
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
  }, [bundles, fWood, fStatus, fLength, fOutOfRange, fSearch, sortField, sortDir, wts, cfg]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const toggleSort = (field) => { setSortField(field); setSortDir(d => sortField === field ? (d === 'asc' ? 'desc' : 'asc') : 'asc'); setPage(1); };
  const sortIcon = (field) => sortField === field ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';
  const hasFilters = fWood !== (wts[0]?.id || '') || fStatus || fLength || fOutOfRange || fSearch;
  const isFilteredPerBundle = !!(fWood && wts.find(w => w.id === fWood)?.pricingMode === 'perBundle');
  const isFilteredM2 = !!(fWood && isM2Wood(fWood, wts));
  const listVolUnit = isFilteredM2 ? 'm²' : 'm³';

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
            setBundles(prev => [...results, ...prev]);
            notify(`Đã nhập ${results.length} kiện`);
          }
        }
        setPage(1); setView('list');
      }} />
  );

  if (view === 'inventory') return (
    <InventoryView wts={wts} ats={ats} cfg={cfg} bundles={bundles} onBack={() => setView('list')} ce={ce} />
  );

  const ths = { padding: "8px 10px", textAlign: "left", background: "var(--bgh)", color: "var(--brl)", fontWeight: 700, fontSize: "0.65rem", textTransform: "uppercase", borderBottom: "2px solid var(--bds)", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "var(--br)" }}>🏪 Tồn kho gỗ kiện</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setView('inventory')} style={{ padding: "7px 14px", borderRadius: 7, background: "var(--bgs)", color: "var(--br)", border: "1.5px solid var(--bds)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>📊 Tồn kho SKU</button>
          {ce && <button onClick={() => setView('import')} style={{ padding: "7px 14px", borderRadius: 7, background: "var(--bgs)", color: "var(--br)", border: "1.5px solid var(--bds)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>📂 Nhập hàng loạt</button>}
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
          { label: 'Tổng KL còn', val: bundles.filter(b => !isM2Wood(b.woodId, wts)).reduce((s, b) => s + (b.remainingVolume || 0), 0).toFixed(2) + ' m³', color: 'var(--br)' },
        ].map(s => (
          <div key={s.label} style={{ padding: "8px 14px", borderRadius: 8, background: "var(--bgc)", border: "1px solid var(--bd)", minWidth: 110 }}>
            <div style={{ fontSize: "0.6rem", color: "var(--tm)", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontSize: "1rem", fontWeight: 800, color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ marginBottom: 8, padding: "10px 12px", borderRadius: 8, background: "var(--bgc)", border: "1px solid var(--bd)" }}>
        <WoodPicker wts={wts} sel={fWood} onSel={id => { setFWood(id); setFLength(''); setPage(1); }} mb={8} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input value={fSearch} onChange={e => { setFSearch(e.target.value); setPage(1); }} placeholder="🔍 Tìm mã kiện, mã NCC, thuộc tính..."
          style={{ flex: 2, minWidth: 160, padding: "6px 10px", borderRadius: 6, border: "1.5px solid var(--bd)", fontSize: "0.78rem", outline: "none" }} />
        <select value={fStatus} onChange={e => { setFStatus(e.target.value); setPage(1); }}
          style={{ flex: 1, minWidth: 130, padding: "6px 10px", borderRadius: 6, border: "1.5px solid var(--bd)", fontSize: "0.78rem", background: "var(--bgc)", color: "var(--tp)", outline: "none" }}>
          <option value="">Tất cả tình trạng</option>
          {BUNDLE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {(() => {
          const lengthVals = fWood ? (cfg[fWood]?.attrValues?.length || []) : [];
          if (!lengthVals.length) return null;
          return (
            <select value={fLength} onChange={e => { setFLength(e.target.value); setPage(1); }}
              style={{ flex: 1, minWidth: 130, padding: "6px 10px", borderRadius: 6, border: "1.5px solid " + (fLength ? "var(--ac)" : "var(--bd)"), fontSize: "0.78rem", background: fLength ? "var(--acbg)" : "var(--bgc)", color: fLength ? "var(--ac)" : "var(--tp)", fontWeight: fLength ? 700 : 400, outline: "none" }}>
              <option value="">Tất cả độ dài</option>
              {lengthVals.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          );
        })()}
        <button onClick={() => { setFOutOfRange(p => !p); setPage(1); }}
          style={{ padding: "6px 12px", borderRadius: 6, border: "1.5px solid " + (fOutOfRange ? "#856404" : "var(--bd)"), background: fOutOfRange ? "rgba(133,100,4,0.08)" : "transparent", color: fOutOfRange ? "#856404" : "var(--ts)", cursor: "pointer", fontSize: "0.75rem", fontWeight: fOutOfRange ? 700 : 600, whiteSpace: "nowrap" }}>
          ⚠ Ngoài khoảng
        </button>
        {hasFilters && <button onClick={() => { setFWood(wts[0]?.id || ''); setFStatus(''); setFLength(''); setFOutOfRange(false); setFSearch(''); setPage(1); }} style={{ padding: "6px 12px", borderRadius: 6, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600, whiteSpace: "nowrap" }}>✕ Xóa lọc</button>}
        <button onClick={() => setShowExtraCols(p => !p)} style={{ padding: "6px 12px", borderRadius: 6, border: "1.5px solid " + (showExtraCols ? "var(--ac)" : "var(--bd)"), background: showExtraCols ? "var(--acbg)" : "transparent", color: showExtraCols ? "var(--ac)" : "var(--ts)", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600, whiteSpace: "nowrap" }}>⚙ Cột hiển thị</button>
        </div>
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
                {(isFilteredPerBundle ? [
                  { field: 'bundleCode', label: 'Mã kiện' },
                  { field: 'supplierBundleCode', label: 'Mã kiện NCC', noSort: true },
                  { field: 'spec', label: 'Quy cách (mm)', noSort: true },
                  { field: 'quality', label: 'Chất lượng', noSort: true },
                  { field: 'unitPrice', label: 'Giá (tr/m³)', noSort: true },
                  { field: 'status', label: 'Tình trạng' },
                  { field: 'remainingBoards', label: 'Số tấm còn' },
                  { field: 'remainingVolume', label: `KL còn (${listVolUnit})` },
                  { field: 'location', label: 'Vị trí' },
                  { field: 'notes', label: 'Ghi chú', noSort: true },
                  ...(extraCols.has('container') ? [{ field: 'containerId', label: 'Container' }] : []),
                  ...(extraCols.has('createdAt') ? [{ field: 'createdAt', label: 'Ngày nhập' }] : []),
                  { field: '_actions', label: '', noSort: true },
                ] : [
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
                  { field: 'remainingVolume', label: `KL còn (${listVolUnit})` },
                  { field: 'location', label: 'Vị trí' },
                  { field: 'notes', label: 'Ghi chú', noSort: true },
                  ...(extraCols.has('container') ? [{ field: 'containerId', label: 'Container' }] : []),
                  ...(extraCols.has('createdAt') ? [{ field: 'createdAt', label: 'Ngày nhập' }] : []),
                  { field: '_actions', label: '', noSort: true },
                ]).map(col => (
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
                const bIsM2 = isM2Wood(b.woodId, wts);
                const bVolDec = bIsM2 ? 2 : 3;
                if (isFilteredPerBundle) {
                  const spec = [b.attributes.thickness, b.attributes.width, b.attributes.length].filter(Boolean).join('×');
                  return (
                    <tr key={b.id} style={{ background: idx % 2 ? "var(--bgs)" : "#fff", cursor: "pointer" }} onClick={() => setDetail(b)}>
                      <td style={{ ...tdBase, fontWeight: 700, color: "var(--br)", fontFamily: "monospace", fontSize: "0.82rem" }}>{b.bundleCode}</td>
                      <td style={{ ...tdBase, fontFamily: "monospace", fontSize: "0.76rem", color: "var(--ts)" }}>{b.supplierBundleCode || '—'}</td>
                      <td style={{ ...tdBase, fontWeight: 700, color: "var(--br)", fontFamily: "monospace" }}>{spec || '—'}</td>
                      <td style={tdBase}>{b.attributes.quality || '—'}</td>
                      <td style={{ ...tdBase, fontWeight: 700, color: b.unitPrice ? "var(--br)" : "var(--tm)" }}>{b.unitPrice ? b.unitPrice + ' tr' : '—'}</td>
                      <td style={tdBase}><span style={{ padding: "2px 8px", borderRadius: 4, fontSize: "0.68rem", fontWeight: 700, background: statusBg, color: statusColor }}>{b.status}</span></td>
                      <td style={{ ...tdBase, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{b.remainingBoards}<span style={{ fontSize: "0.62rem", color: "var(--tm)" }}>/{b.boardCount}</span></td>
                      <td style={{ ...tdBase, textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{(b.remainingVolume || 0).toFixed(bVolDec)}<span style={{ fontSize: "0.62rem", color: "var(--tm)" }}>/{(b.volume || 0).toFixed(bVolDec)}</span></td>
                      <td style={tdBase}>{b.location || '—'}</td>
                      <td style={{ ...tdBase, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", color: "var(--ts)", fontSize: "0.76rem" }}>{b.notes || '—'}</td>
                      {extraCols.has('container') && <td style={{ ...tdBase, fontFamily: "monospace", fontSize: "0.74rem" }}>{cont?.containerCode || (b.containerId ? '#' + b.containerId : '—')}</td>}
                      {extraCols.has('createdAt') && <td style={{ ...tdBase, color: "var(--tm)", fontSize: "0.74rem" }}>{b.createdAt ? String(b.createdAt).slice(0, 10) : '—'}</td>}
                      <td style={{ ...tdBase }} onClick={e => e.stopPropagation()}>
                        {ce && <button onClick={() => handleDelete(b)} title="Xóa" style={{ width: 24, height: 24, padding: 0, borderRadius: 4, border: "1px solid var(--dg)", background: "transparent", color: "var(--dg)", cursor: "pointer", fontSize: "0.72rem" }}>✕</button>}
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={b.id} style={{ background: idx % 2 ? "var(--bgs)" : "#fff", cursor: "pointer" }} onClick={() => setDetail(b)}>
                    <td style={{ ...tdBase, fontWeight: 700, color: "var(--br)", fontFamily: "monospace", fontSize: "0.82rem" }}>{b.bundleCode}</td>
                    <td style={{ ...tdBase, fontFamily: "monospace", fontSize: "0.76rem", color: "var(--ts)" }}>{b.supplierBundleCode || '—'}</td>
                    <td style={tdBase}>{wood?.icon} {wood?.name || b.woodId}</td>
                    <td style={tdBase}>{b.attributes.thickness || '—'}</td>
                    <td style={tdBase}>{b.attributes.quality || '—'}</td>
                    {extraCols.has('supplier') && <td style={tdBase}>{b.attributes.supplier || ncc?.name || '—'}</td>}
                    {extraCols.has('edging') && <td style={tdBase}>{b.attributes.edging || '—'}</td>}
                    <td style={tdBase}>
                      {b.attributes.length
                        ? b.rawMeasurements?.length
                          ? (() => {
                              const rg = cfg[b.woodId]?.rangeGroups?.length;
                              const outOfRange = rg?.length && resolveRangeGroup(b.rawMeasurements.length, rg) === null;
                              return (
                                <>
                                  <span style={{ fontWeight: 700 }}>{b.rawMeasurements.length}m</span>
                                  <span style={{ fontSize: '0.68rem', color: 'var(--tm)', marginLeft: 3 }}>({b.attributes.length})</span>
                                  {outOfRange && <span title="Raw nằm ngoài khoảng nhóm nào" style={{ marginLeft: 4, color: '#856404', fontSize: '0.7rem', cursor: 'default' }}>⚠</span>}
                                </>
                              );
                            })()
                          : b.attributes.length
                        : '—'}
                    </td>
                    <td style={tdBase}><span style={{ padding: "2px 8px", borderRadius: 4, fontSize: "0.68rem", fontWeight: 700, background: statusBg, color: statusColor }}>{b.status}</span></td>
                    <td style={{ ...tdBase, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{b.remainingBoards}<span style={{ fontSize: "0.62rem", color: "var(--tm)" }}>/{b.boardCount}</span></td>
                    <td style={{ ...tdBase, textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{(b.remainingVolume || 0).toFixed(bVolDec)}<span style={{ fontSize: "0.62rem", color: "var(--tm)" }}>/{(b.volume || 0).toFixed(bVolDec)}</span></td>
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
      {detail && <BundleDetail bundle={detail} wts={wts} containers={containers} suppliers={suppliers} ats={ats} ce={ce} cePrice={cePrice} onClose={() => setDetail(null)} onSave={handleBundleSave} onStatusChange={handleStatusChange} />}
    </div>
  );
}
