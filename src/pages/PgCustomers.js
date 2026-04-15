import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import Dialog from '../components/Dialog';
import ComboFilter from '../components/ComboFilter';
import { fmtDate } from "../utils";
import { VN_PROVINCES } from "../data/vnProvinces.js";
import { VN_DISTRICTS } from "../data/vnDistricts.js";
import useTableSort from '../useTableSort';

function friendlyDbError(msg = '') {
  if (msg.includes('duplicate') || msg.includes('unique')) return 'Thông tin bị trùng, vui lòng kiểm tra lại.';
  if (msg.includes('not-null') || msg.includes('null value')) return 'Lưu không thành công. Vui lòng thử lại hoặc liên hệ quản trị viên.';
  if (msg.includes('foreign key')) return 'Dữ liệu liên kết không hợp lệ.';
  if (msg.includes('network') || msg.includes('fetch')) return 'Không kết nối được máy chủ. Kiểm tra mạng và thử lại.';
  return 'Có lỗi xảy ra, vui lòng thử lại.';
}

const EMPTY_FORM = {
  customerType: 'individual', salutation: 'Anh', name: '', nickname: '', dob: '',
  phone1: '', phone2: '',
  companyName: '', department: '', position: '', taxCode: '',
  representative: '', email: '', businessAddress: '',
  address: '',          // tỉnh/thành phố (province)
  commune: '',          // xã/phường/thị trấn
  streetAddress: '',    // số nhà, đường
  workshopLat: '',      // tọa độ xưởng
  workshopLng: '',      // tọa độ xưởng
  products: [],         // [{productId, productName, woodTypes: [woodId,...]}]
  preferences: [],      // [prefId, ...]
  productDescription: '',
  debtLimit: '0', debtDays: '30', notes: '',
};

const SALUTATIONS = ['Anh', 'Chị', 'Chú', 'Cô', 'Ông', 'Bà'];

function NumInput({ value, onChange, style, ...rest }) {
  const fmt = n => (n != null && n !== '' && Number(n) !== 0) ? Number(n).toLocaleString('vi-VN') : '';
  const [txt, setTxt] = React.useState(() => fmt(value));
  const focused = React.useRef(false);
  React.useEffect(() => { if (!focused.current) setTxt(fmt(value)); }, [value]);
  return (
    <input {...rest} type="text" inputMode="numeric" value={txt}
      onFocus={() => { focused.current = true; }}
      onChange={e => setTxt(e.target.value)}
      onBlur={() => {
        focused.current = false;
        const n = parseFloat(String(txt).replace(/\./g, '').replace(/,/g, '')) || 0;
        setTxt(fmt(n));
        onChange(n);
      }}
      style={style} />
  );
}

// Load Leaflet từ CDN một lần duy nhất
function loadLeaflet(cb) {
  if (window.L) { cb(); return; }
  if (!document.getElementById('leaflet-css')) {
    const lnk = document.createElement('link');
    lnk.id = 'leaflet-css'; lnk.rel = 'stylesheet';
    lnk.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(lnk);
  }
  if (document.getElementById('leaflet-js')) {
    document.getElementById('leaflet-js').addEventListener('load', cb);
    return;
  }
  const s = document.createElement('script');
  s.id = 'leaflet-js';
  s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  s.onload = cb;
  document.head.appendChild(s);
}

function MapPickerModal({ initialLat, initialLng, onConfirm, onClose }) {
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [coords, setCoords] = useState(
    initialLat && initialLng ? { lat: parseFloat(initialLat), lng: parseFloat(initialLng) } : null
  );
  const [loading, setLoading] = useState(true);

  const placeMarker = useCallback((lat, lng) => {
    const L = window.L;
    const p = { lat: +lat.toFixed(6), lng: +lng.toFixed(6) };
    setCoords(p);
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(mapRef.current);
      markerRef.current.on('dragend', e => {
        const pos = e.target.getLatLng();
        setCoords({ lat: +pos.lat.toFixed(6), lng: +pos.lng.toFixed(6) });
      });
    }
  }, []);

  useEffect(() => {
    loadLeaflet(() => {
      setLoading(false);
      const L = window.L;
      const initLat = initialLat ? parseFloat(initialLat) : 16.047;
      const initLng = initialLng ? parseFloat(initialLng) : 108.206;
      const zoom = (initialLat && initialLng) ? 15 : 6;

      // Leaflet cần div đã mount, dùng setTimeout để chắc chắn
      setTimeout(() => {
        if (!mapDivRef.current || mapRef.current) return;
        const map = L.map(mapDivRef.current).setView([initLat, initLng], zoom);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);
        mapRef.current = map;

        if (initialLat && initialLng) {
          markerRef.current = L.marker([parseFloat(initialLat), parseFloat(initialLng)], { draggable: true }).addTo(map);
          markerRef.current.on('dragend', e => {
            const pos = e.target.getLatLng();
            setCoords({ lat: +pos.lat.toFixed(6), lng: +pos.lng.toFixed(6) });
          });
        }

        map.on('click', e => placeMarker(e.latlng.lat, e.latlng.lng));
      }, 50);
    });
    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; markerRef.current = null; }
    };
  }, []); // eslint-disable-line

  const handleGeo = () => {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      mapRef.current.setView([lat, lng], 16);
      placeMarker(lat, lng);
    }, null, { enableHighAccuracy: true, timeout: 8000 });
  };

  return (
    <Dialog open={true} onClose={onClose} onOk={() => coords && onConfirm(coords)} title="Chọn vị trí xưởng" width={740} maxHeight="90vh" zIndex={9999} noEnter>
      {/* Hint */}
      <div style={{ padding: '6px 0 10px', fontSize: '0.72rem', color: 'var(--tm)' }}>
        Click trên bản đồ để đặt đinh ghim • Kéo đinh ghim để tinh chỉnh vị trí
      </div>
      {/* Map */}
      <div style={{ position: 'relative', minHeight: 380 }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bgs)', zIndex: 1, fontSize: '0.82rem', color: 'var(--tm)' }}>
            Đang tải bản đồ...
          </div>
        )}
        <div ref={mapDivRef} style={{ width: '100%', height: '100%', minHeight: 380 }} />
      </div>
      {/* Footer */}
      <div style={{ paddingTop: 10, borderTop: '1px solid var(--bd)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={handleGeo}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1.5px solid var(--ac)', background: 'var(--acbg)', color: 'var(--ac)', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
          📍 Vị trí hiện tại
        </button>
        <span style={{ fontSize: '0.74rem', color: 'var(--ts)', fontFamily: 'monospace', flex: 1 }}>
          {coords ? `${coords.lat}, ${coords.lng}` : <span style={{ color: 'var(--tm)', fontFamily: 'inherit' }}>Chưa chọn vị trí</span>}
        </span>
        <button onClick={onClose}
          style={{ padding: '7px 16px', borderRadius: 7, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>
          Hủy
        </button>
        <button onClick={() => coords && onConfirm(coords)} disabled={!coords}
          style={{ padding: '7px 20px', borderRadius: 7, border: 'none', background: coords ? 'var(--ac)' : 'var(--bd)', color: coords ? '#fff' : 'var(--tm)', cursor: coords ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: '0.8rem' }}>
          Xác nhận
        </button>
      </div>
    </Dialog>
  );
}

// Tạo ID ngắn từ timestamp + random
function shortId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

// Component chọn sản phẩm và loại gỗ cho khách hàng (có quản lý catalog)
function ProductPicker({ products, onChange, wts, productCatalog, setProductCatalog, useAPI, customers }) {
  const [showAdd, setShowAdd] = useState(false);
  const [managing, setManaging] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [newName, setNewName] = useState('');
  const [working, setWorking] = useState(false);
  const addInputRef = useRef(null);
  const editRef = useRef(null);

  useEffect(() => { if (showAdd) setTimeout(() => addInputRef.current?.focus(), 50); }, [showAdd]);
  useEffect(() => { if (editingId) setTimeout(() => editRef.current?.focus(), 50); }, [editingId]);

  const usageCount = (id) => (customers || []).filter(c => c.products?.some(p => p.productId === id)).length;
  const catalogNotSelected = productCatalog.filter(c => !products.find(p => p.productId === c.id));

  const handleSelectFromCatalog = (cat) => {
    onChange([...products, { productId: cat.id, productName: cat.name, woodTypes: [] }]);
    setShowAdd(false);
  };

  const handleAddNew = async () => {
    const name = newName.trim();
    if (!name) return;
    setWorking(true);
    const id = shortId();
    if (useAPI) {
      const { upsertProductCatalogItem } = await import('../api.js');
      await upsertProductCatalogItem(id, name, productCatalog.length);
    }
    setProductCatalog(prev => [...prev, { id, name, sortOrder: prev.length }]);
    onChange([...products, { productId: id, productName: name, woodTypes: [] }]);
    setNewName(''); setWorking(false); setShowAdd(false);
  };

  const handleRename = async (id) => {
    const name = editName.trim();
    if (!name) { setEditingId(null); return; }
    if (name === productCatalog.find(c => c.id === id)?.name) { setEditingId(null); return; }
    setWorking(true);
    const item = productCatalog.find(c => c.id === id);
    if (useAPI) {
      const { upsertProductCatalogItem } = await import('../api.js');
      await upsertProductCatalogItem(id, name, item?.sortOrder ?? 0);
    }
    // Cập nhật catalog + cập nhật productName trong form hiện tại
    setProductCatalog(prev => prev.map(c => c.id === id ? { ...c, name } : c));
    onChange(products.map(p => p.productId === id ? { ...p, productName: name } : p));
    setEditingId(null); setWorking(false);
  };

  const handleDelete = async (id) => {
    const cat = productCatalog.find(c => c.id === id);
    const cnt = usageCount(id);
    const msg = cnt > 0
      ? `Xóa loại sản phẩm "${cat?.name}"?\n${cnt} khách hàng đang có sản phẩm này.`
      : `Xóa loại sản phẩm "${cat?.name}"?`;
    if (!window.confirm(msg)) return;
    setWorking(true);
    if (useAPI) {
      const { deleteProductCatalogItem } = await import('../api.js');
      await deleteProductCatalogItem(id);
    }
    setProductCatalog(prev => prev.filter(c => c.id !== id));
    onChange(products.filter(p => p.productId !== id));
    setWorking(false);
  };

  const handleRemoveProduct = (productId) => onChange(products.filter(p => p.productId !== productId));
  const handleToggleWood = (productId, woodId) => onChange(products.map(p => p.productId !== productId ? p : {
    ...p, woodTypes: p.woodTypes.includes(woodId) ? p.woodTypes.filter(id => id !== woodId) : [...p.woodTypes, woodId],
  }));

  const chipSel = { padding: '3px 9px', borderRadius: 5, border: '1.5px solid var(--ac)', background: 'var(--acbg)', color: 'var(--ac)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 };
  const chipOff = { padding: '3px 9px', borderRadius: 5, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 500 };

  // Chế độ quản lý catalog
  if (managing) return (
    <div>
      <div style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 7, border: '1.5px solid var(--ac)', background: 'var(--acbg)' }}>
        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--ac)', marginBottom: 8, textTransform: 'uppercase' }}>Quản lý danh sách sản phẩm</div>
        {productCatalog.length === 0
          ? <div style={{ fontSize: '0.76rem', color: 'var(--tm)' }}>Chưa có sản phẩm nào.</div>
          : productCatalog.map(cat => {
            const cnt = usageCount(cat.id);
            if (editingId === cat.id) return (
              <div key={cat.id} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                <input ref={editRef} value={editName} onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleRename(cat.id); } if (e.key === 'Escape') setEditingId(null); }}
                  style={{ flex: 1, padding: '5px 8px', borderRadius: 5, border: '1.5px solid var(--ac)', fontSize: '0.78rem', outline: 'none' }} />
                <button type="button" onClick={() => handleRename(cat.id)} disabled={working}
                  style={{ padding: '5px 10px', borderRadius: 5, border: 'none', background: 'var(--ac)', color: '#fff', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}>Lưu</button>
                <button type="button" onClick={() => setEditingId(null)}
                  style={{ padding: '5px 8px', borderRadius: 5, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', fontSize: '0.74rem', cursor: 'pointer' }}>Hủy</button>
              </div>
            );
            return (
              <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ flex: 1, fontSize: '0.8rem', color: 'var(--ts)' }}>{cat.name}</span>
                {cnt > 0 && <span style={{ fontSize: '0.66rem', color: 'var(--tm)', whiteSpace: 'nowrap' }}>{cnt} khách</span>}
                <button type="button" onClick={() => { setEditingId(cat.id); setEditName(cat.name); }} disabled={working}
                  style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid var(--bd)', background: 'transparent', color: 'var(--ac)', cursor: 'pointer', fontSize: '0.72rem' }}>✏ Sửa</button>
                <button type="button" onClick={() => handleDelete(cat.id)} disabled={working}
                  style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid var(--dg)', background: 'transparent', color: 'var(--dg)', cursor: 'pointer', fontSize: '0.72rem' }}>✕ Xóa</button>
              </div>
            );
          })
        }
      </div>
      <button type="button" onClick={() => { setManaging(false); setEditingId(null); }}
        style={{ fontSize: '0.68rem', color: 'var(--ac)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 700, textDecoration: 'underline' }}>
        ✓ Xong quản lý
      </button>
    </div>
  );

  return (
    <div>
      {products.map(p => (
        <div key={p.productId} style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 7, border: '1px solid var(--bd)', background: 'var(--bgs)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--br)' }}>{p.productName}</span>
            <button type="button" onClick={() => handleRemoveProduct(p.productId)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dg)', fontSize: '0.75rem', padding: '0 4px', lineHeight: 1 }}>✕</button>
          </div>
          <div style={{ fontSize: '0.64rem', fontWeight: 700, color: 'var(--brl)', textTransform: 'uppercase', marginBottom: 4 }}>Loại gỗ</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {wts.map(w => {
              const sel = p.woodTypes.includes(w.id);
              return (
                <button key={w.id} type="button" onClick={() => handleToggleWood(p.productId, w.id)}
                  style={sel ? chipSel : chipOff}>
                  {w.icon} {w.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {showAdd ? (
        <div style={{ border: '1.5px dashed var(--ac)', borderRadius: 7, padding: '8px 10px', marginBottom: 6 }}>
          {catalogNotSelected.length > 0 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
              {catalogNotSelected.map(cat => (
                <button key={cat.id} type="button" onClick={() => handleSelectFromCatalog(cat)}
                  style={{ padding: '4px 10px', borderRadius: 5, border: '1.5px solid var(--ac)', background: 'transparent', color: 'var(--ac)', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 600 }}>
                  + {cat.name}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input ref={addInputRef} value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddNew(); } if (e.key === 'Escape') setShowAdd(false); }}
              placeholder="Tên sản phẩm mới..." style={{ flex: 1, padding: '6px 8px', borderRadius: 5, border: '1.5px solid var(--bd)', fontSize: '0.78rem', outline: 'none' }} />
            <button type="button" onClick={handleAddNew} disabled={!newName.trim() || working}
              style={{ padding: '6px 12px', borderRadius: 5, border: 'none', background: newName.trim() ? 'var(--ac)' : 'var(--bd)', color: newName.trim() ? '#fff' : 'var(--tm)', cursor: newName.trim() ? 'pointer' : 'not-allowed', fontSize: '0.76rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
              {working ? '...' : 'Thêm mới'}
            </button>
            <button type="button" onClick={() => { setShowAdd(false); setNewName(''); }}
              style={{ padding: '6px 10px', borderRadius: 5, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontSize: '0.76rem' }}>
              Hủy
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" onClick={() => setShowAdd(true)}
            style={{ padding: '5px 12px', borderRadius: 5, border: '1.5px dashed var(--bd)', background: 'transparent', color: 'var(--ac)', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 600 }}>
            + Thêm sản phẩm
          </button>
          {productCatalog.length > 0 && (
            <button type="button" onClick={() => setManaging(true)}
              style={{ fontSize: '0.68rem', color: 'var(--tm)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
              ⚙ Quản lý danh sách
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Component chọn sở thích / nhu cầu khách (multi-select chips, thêm mới + quản lý)
function PreferencePicker({ selected, onChange, catalog, setCatalog, useAPI, customers }) {
  const [adding, setAdding] = useState(false);
  const [managing, setManaging] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [newName, setNewName] = useState('');
  const [working, setWorking] = useState(false);
  const inputRef = useRef(null);
  const editRef = useRef(null);

  useEffect(() => { if (adding) setTimeout(() => inputRef.current?.focus(), 50); }, [adding]);
  useEffect(() => { if (editingId) setTimeout(() => editRef.current?.focus(), 50); }, [editingId]);

  const usageCount = (id) => (customers || []).filter(c => c.preferences?.includes(id)).length;

  const toggle = (id) => {
    if (managing) return;
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  };

  const handleAddNew = async () => {
    const name = newName.trim();
    if (!name) return;
    if (catalog.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      const ex = catalog.find(c => c.name.toLowerCase() === name.toLowerCase());
      if (!selected.includes(ex.id)) onChange([...selected, ex.id]);
      setNewName(''); setAdding(false); return;
    }
    setWorking(true);
    const id = shortId();
    if (useAPI) {
      const { upsertPreferenceCatalogItem } = await import('../api.js');
      await upsertPreferenceCatalogItem(id, name, catalog.length);
    }
    setCatalog(prev => [...prev, { id, name, sortOrder: prev.length }]);
    onChange([...selected, id]);
    setNewName(''); setWorking(false); setAdding(false);
  };

  const handleRename = async (id) => {
    const name = editName.trim();
    if (!name) { setEditingId(null); return; }
    if (name === catalog.find(c => c.id === id)?.name) { setEditingId(null); return; }
    setWorking(true);
    const item = catalog.find(c => c.id === id);
    if (useAPI) {
      const { upsertPreferenceCatalogItem } = await import('../api.js');
      await upsertPreferenceCatalogItem(id, name, item?.sortOrder ?? 0);
    }
    setCatalog(prev => prev.map(c => c.id === id ? { ...c, name } : c));
    setEditingId(null); setWorking(false);
  };

  const handleDelete = async (id) => {
    const pref = catalog.find(c => c.id === id);
    const cnt = usageCount(id);
    const msg = cnt > 0
      ? `Xóa "${pref?.name}"?\n${cnt} khách hàng đang dùng nhu cầu này.`
      : `Xóa "${pref?.name}"?`;
    if (!window.confirm(msg)) return;
    setWorking(true);
    if (useAPI) {
      const { deletePreferenceCatalogItem } = await import('../api.js');
      await deletePreferenceCatalogItem(id);
    }
    setCatalog(prev => prev.filter(c => c.id !== id));
    onChange(selected.filter(x => x !== id));
    setWorking(false);
  };

  const chipBase = { padding: '5px 12px', borderRadius: 20, cursor: 'pointer', fontSize: '0.78rem', transition: 'all 0.12s', display: 'inline-flex', alignItems: 'center', gap: 4 };

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {catalog.map(pref => {
          const sel = selected.includes(pref.id);
          if (managing) {
            // Chế độ quản lý: hiện rename + delete
            if (editingId === pref.id) return (
              <div key={pref.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <input ref={editRef} value={editName} onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleRename(pref.id); } if (e.key === 'Escape') setEditingId(null); }}
                  style={{ padding: '4px 8px', borderRadius: 20, border: '1.5px solid var(--ac)', fontSize: '0.76rem', outline: 'none', width: 130 }} />
                <button type="button" onClick={() => handleRename(pref.id)} disabled={working}
                  style={{ ...chipBase, padding: '4px 8px', border: 'none', background: 'var(--ac)', color: '#fff', fontSize: '0.72rem', fontWeight: 700 }}>Lưu</button>
                <button type="button" onClick={() => setEditingId(null)}
                  style={{ ...chipBase, padding: '4px 8px', border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', fontSize: '0.72rem' }}>Hủy</button>
              </div>
            );
            const cnt = usageCount(pref.id);
            return (
              <div key={pref.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, border: '1.5px solid var(--bd)', borderRadius: 20, padding: '3px 6px 3px 10px', background: 'var(--bgs)' }}>
                <span style={{ fontSize: '0.76rem', color: 'var(--ts)' }}>{pref.name}</span>
                {cnt > 0 && <span style={{ fontSize: '0.62rem', color: 'var(--tm)', marginLeft: 3 }}>({cnt})</span>}
                <button type="button" title="Sửa tên" onClick={() => { setEditingId(pref.id); setEditName(pref.name); }}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ac)', padding: '0 3px', fontSize: '0.7rem', lineHeight: 1 }}>✏</button>
                <button type="button" title="Xóa" onClick={() => handleDelete(pref.id)} disabled={working}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--dg)', padding: '0 3px', fontSize: '0.7rem', lineHeight: 1 }}>✕</button>
              </div>
            );
          }
          return (
            <button key={pref.id} type="button" onClick={() => toggle(pref.id)}
              style={{ ...chipBase, border: sel ? '1.5px solid var(--ac)' : '1.5px solid var(--bd)', background: sel ? 'var(--acbg)' : 'transparent', color: sel ? 'var(--ac)' : 'var(--ts)', fontWeight: sel ? 700 : 500 }}>
              {sel && <span>✓</span>}{pref.name}
            </button>
          );
        })}

        {!managing && (adding ? (
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <input ref={inputRef} value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddNew(); } if (e.key === 'Escape') { setAdding(false); setNewName(''); } }}
              placeholder="Tên sở thích mới..." style={{ padding: '5px 8px', borderRadius: 20, border: '1.5px solid var(--ac)', fontSize: '0.76rem', outline: 'none', width: 160 }} />
            <button type="button" onClick={handleAddNew} disabled={!newName.trim() || working}
              style={{ ...chipBase, padding: '5px 10px', border: 'none', background: newName.trim() ? 'var(--ac)' : 'var(--bd)', color: newName.trim() ? '#fff' : 'var(--tm)', cursor: newName.trim() ? 'pointer' : 'not-allowed', fontWeight: 700 }}>
              {working ? '...' : 'Thêm'}
            </button>
            <button type="button" onClick={() => { setAdding(false); setNewName(''); }}
              style={{ ...chipBase, padding: '5px 8px', border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)' }}>Hủy</button>
          </div>
        ) : (
          <button type="button" onClick={() => setAdding(true)}
            style={{ ...chipBase, border: '1.5px dashed var(--bd)', background: 'transparent', color: 'var(--ac)', fontWeight: 600 }}>
            + Thêm mới
          </button>
        ))}
      </div>

      {/* Nút quản lý */}
      {catalog.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <button type="button" onClick={() => { setManaging(m => !m); setEditingId(null); setAdding(false); }}
            style={{ fontSize: '0.68rem', color: managing ? 'var(--ac)' : 'var(--tm)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: managing ? 700 : 400, textDecoration: 'underline' }}>
            {managing ? '✓ Xong quản lý' : '⚙ Quản lý danh sách'}
          </button>
        </div>
      )}
    </div>
  );
}

const SectionLabel = ({ children }) => (
  <div style={{ flex: '1 1 100%', borderBottom: '1.5px solid var(--bds)', paddingBottom: 4, marginBottom: 4, marginTop: 8 }}>
    <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--ac)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{children}</span>
  </div>
);

const inpStyle = (err) => ({ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1.5px solid ' + (err ? 'var(--dg)' : 'var(--bd)'), fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box', background: 'var(--bg)' });
const labelStyle = { display: 'block', fontSize: '0.68rem', fontWeight: 700, color: 'var(--brl)', marginBottom: 4, textTransform: 'uppercase' };

function CustomerForm({ initial, wts, productCatalog, setProductCatalog, preferenceCatalog, setPreferenceCatalog, useAPI, customers, onSave, onCancel }) {
  const [fm, setFm] = useState(() => ({ ...EMPTY_FORM, ...(initial || {}) }));
  const [saving, setSaving] = useState(false);
  const [errs, setErrs] = useState({});
  const [geoLoading, setGeoLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const f = (k) => (v) => setFm(p => ({ ...p, [k]: v }));
  const inp = (label, key, opts = {}) => (
    <div style={{ flex: opts.full ? '1 1 100%' : '1 1 220px' }}>
      <label style={labelStyle}>{label}{opts.req && ' *'}</label>
      <input value={fm[key] ?? ''} onChange={e => { f(key)(e.target.value); setErrs(p => ({ ...p, [key]: '' })); }}
        placeholder={opts.ph || ''} type={opts.type || 'text'} style={inpStyle(errs[key])} />
      {errs[key] && <div style={{ fontSize: '0.62rem', color: 'var(--dg)', marginTop: 2 }}>{errs[key]}</div>}
    </div>
  );
  const validate = () => {
    const e = {};
    const isCompany = fm.customerType === 'company';
    if (!isCompany && !fm.salutation) e.salutation = 'Bắt buộc';
    if (!fm.name.trim()) e.name = 'Bắt buộc';
    if (!fm.nickname.trim()) e.nickname = 'Bắt buộc';
    setErrs(e); return Object.keys(e).length === 0;
  };
  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    await onSave(fm);
    setSaving(false);
  };
  const handleGeo = () => {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setFm(p => ({ ...p, workshopLat: pos.coords.latitude.toFixed(6), workshopLng: pos.coords.longitude.toFixed(6) }));
        setGeoLoading(false);
      },
      () => setGeoLoading(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div style={{ maxWidth: 800, background: 'var(--bgc)', borderRadius: 12, border: '1.5px solid var(--bd)', padding: 24 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>

        {/* ── Loại khách hàng ── */}
        <div style={{ flex: '1 1 100%', marginBottom: 4 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {[['individual', '👤 Cá nhân'], ['company', '🏢 Công ty']].map(([t, label]) => {
              const active = (fm.customerType || 'individual') === t;
              return <button key={t} type="button" onClick={() => setFm(p => ({ ...p, customerType: t, salutation: t === 'company' ? '' : (p.salutation || 'Anh') }))}
                style={{ padding: '5px 14px', borderRadius: 6, border: active ? '1.5px solid var(--ac)' : '1.5px solid var(--bd)', background: active ? 'var(--acbg)' : 'transparent', color: active ? 'var(--ac)' : 'var(--ts)', cursor: 'pointer', fontWeight: active ? 700 : 500, fontSize: '0.82rem' }}>{label}</button>;
            })}
          </div>
        </div>

        {/* ── Thông tin ── */}
        <SectionLabel>{fm.customerType === 'company' ? 'Thông tin công ty' : 'Thông tin cá nhân'}</SectionLabel>
        {fm.customerType !== 'company' && <div style={{ flex: '1 1 100%' }}>
          <label style={{ ...labelStyle, color: errs.salutation ? 'var(--dg)' : 'var(--brl)' }}>Cách xưng hô *</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SALUTATIONS.map(s => {
              const sel = fm.salutation === s;
              return (
                <button key={s} type="button" onClick={() => { setFm(p => ({ ...p, salutation: sel ? '' : s })); setErrs(p => ({ ...p, salutation: '' })); }}
                  style={{ padding: '5px 14px', borderRadius: 6, border: sel ? '1.5px solid var(--ac)' : (errs.salutation ? '1.5px solid var(--dg)' : '1.5px solid var(--bd)'), background: sel ? 'var(--acbg)' : 'transparent', color: sel ? 'var(--ac)' : 'var(--ts)', cursor: 'pointer', fontWeight: sel ? 700 : 500, fontSize: '0.82rem' }}>
                  {s}
                </button>
              );
            })}
          </div>
          {errs.salutation && <div style={{ fontSize: '0.62rem', color: 'var(--dg)', marginTop: 4 }}>{errs.salutation}</div>}
        </div>}
        {inp(fm.customerType === 'company' ? 'Tên công ty' : 'Tên khách hàng', 'name', { req: true, ph: fm.customerType === 'company' ? 'Công ty TNHH ABC' : 'Minh, Huệ, Tuấn...' })}
        {inp('Địa chỉ thường gọi', 'nickname', { req: true, ph: 'VD: Quảng Nam, TP. HCM...' })}
        {fm.customerType === 'company' && inp('Mã số thuế', 'taxCode', { ph: '0102241163' })}
        {fm.customerType !== 'company' && inp('Ngày sinh', 'dob', { type: 'date' })}
        {inp('Số điện thoại chính', 'phone1', { type: 'tel', ph: '0901...' })}
        {inp('Số điện thoại phụ', 'phone2', { ph: '(nếu có)' })}

        {fm.customerType === 'company' ? <>
          {/* ── Thông tin xuất hóa đơn (công ty) ── */}
          <SectionLabel>Thông tin xuất hóa đơn</SectionLabel>
          {inp('Người đại diện', 'representative', { ph: 'Nguyễn Văn A' })}
          {inp('Email', 'email', { type: 'email', ph: 'info@company.com' })}
          {inp('Địa chỉ ĐKKD', 'businessAddress', { ph: 'Số 10, Phố Trần Duy Hưng, Cầu Giấy, Hà Nội' })}

          {/* ── Người mua hàng ── */}
          <SectionLabel>Người mua hàng</SectionLabel>
          <div style={{ flex: '1 1 100%' }}>
            {(fm.contacts || []).map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                <select value={c.salutation || ''} onChange={e => { const arr = [...(fm.contacts || [])]; arr[i] = { ...arr[i], salutation: e.target.value }; setFm(p => ({ ...p, contacts: arr })); }}
                  style={{ width: 75, padding: '5px 6px', borderRadius: 5, border: '1px solid var(--bd)', fontSize: '0.78rem', outline: 'none', cursor: 'pointer' }}>
                  <option value="">—</option><option>Anh</option><option>Chị</option><option>Ông</option><option>Bà</option>
                </select>
                <input value={c.name || ''} onChange={e => { const arr = [...(fm.contacts || [])]; arr[i] = { ...arr[i], name: e.target.value }; setFm(p => ({ ...p, contacts: arr })); }}
                  placeholder="Họ tên" style={{ flex: 1, padding: '5px 8px', borderRadius: 5, border: '1px solid var(--bd)', fontSize: '0.78rem', outline: 'none' }} />
                <input value={c.phone || ''} onChange={e => { const arr = [...(fm.contacts || [])]; arr[i] = { ...arr[i], phone: e.target.value }; setFm(p => ({ ...p, contacts: arr })); }}
                  placeholder="SĐT" style={{ width: 120, padding: '5px 8px', borderRadius: 5, border: '1px solid var(--bd)', fontSize: '0.78rem', outline: 'none' }} />
                <button type="button" onClick={() => { const arr = (fm.contacts || []).filter((_, j) => j !== i); setFm(p => ({ ...p, contacts: arr })); }}
                  title="Xóa" style={{ width: 24, height: 24, borderRadius: 4, border: '1px solid var(--dg)', background: 'transparent', color: 'var(--dg)', cursor: 'pointer', fontSize: '0.7rem', flexShrink: 0 }}>✕</button>
              </div>
            ))}
            <button type="button" onClick={() => setFm(p => ({ ...p, contacts: [...(p.contacts || []), { name: '', salutation: '', phone: '', lastUsed: '' }] }))}
              style={{ padding: '4px 12px', borderRadius: 5, border: '1px dashed var(--ac)', background: 'transparent', color: 'var(--ac)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>+ Thêm người mua</button>
          </div>
        </> : <>
          {/* ── Thông tin công ty (cho cá nhân) ── */}
          <SectionLabel>Thông tin công ty</SectionLabel>
          {inp('Tên công ty', 'companyName', { ph: '(nếu có)' })}
          {inp('Phòng ban', 'department', { ph: 'Kinh doanh, Kỹ thuật...' })}
          {inp('Chức vụ', 'position', { ph: 'Giám đốc, Trưởng phòng...' })}
        </>}

        {/* ── Địa chỉ xưởng ── */}
        <SectionLabel>Địa chỉ xưởng khách</SectionLabel>
        <div style={{ flex: '1 1 220px' }}>
          <label style={labelStyle}>Tỉnh / Thành phố</label>
          <select value={fm.address} onChange={e => setFm(p => ({ ...p, address: e.target.value, commune: '' }))}
            style={{ ...inpStyle(false), color: fm.address ? 'var(--br)' : 'var(--tm)' }}>
            <option value="">-- Chọn tỉnh/thành phố --</option>
            {VN_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div style={{ flex: '1 1 220px' }}>
          <label style={labelStyle}>Quận / Huyện / Xã / Phường</label>
          <input
            list="commune-list"
            value={fm.commune ?? ''}
            onChange={e => f('commune')(e.target.value)}
            placeholder={fm.address ? 'Chọn hoặc gõ tên...' : 'Chọn tỉnh/thành trước'}
            disabled={!fm.address}
            style={{ ...inpStyle(false), color: fm.address ? 'var(--br)' : 'var(--tm)' }}
          />
          <datalist id="commune-list">
            {(VN_DISTRICTS[fm.address] || []).map(d => <option key={d} value={d} />)}
          </datalist>
        </div>
        {inp('Địa chỉ chi tiết (số nhà, đường)', 'streetAddress', { full: true, ph: 'VD: 123 Đường Trần Phú' })}

        {/* Tọa độ xưởng */}
        <div style={{ flex: '1 1 100%' }}>
          <label style={labelStyle}>Tọa độ xưởng khách (để vẽ bản đồ phân bố doanh số)</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input value={fm.workshopLat ?? ''} onChange={e => f('workshopLat')(e.target.value)}
              placeholder="Vĩ độ (lat)" type="number" step="any"
              style={{ ...inpStyle(false), flex: '1 1 140px' }} />
            <input value={fm.workshopLng ?? ''} onChange={e => f('workshopLng')(e.target.value)}
              placeholder="Kinh độ (lng)" type="number" step="any"
              style={{ ...inpStyle(false), flex: '1 1 140px' }} />
            <button type="button" onClick={() => setShowMap(true)}
              style={{ padding: '8px 14px', borderRadius: 6, border: '1.5px solid var(--br)', background: 'var(--br)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
              🗺 Chọn trên bản đồ
            </button>
            <button type="button" onClick={handleGeo} disabled={geoLoading}
              style={{ padding: '8px 14px', borderRadius: 6, border: '1.5px solid var(--ac)', background: 'var(--acbg)', color: 'var(--ac)', cursor: geoLoading ? 'wait' : 'pointer', fontWeight: 600, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
              {geoLoading ? '⏳ Đang lấy...' : '📍 Vị trí hiện tại'}
            </button>
            {fm.workshopLat && fm.workshopLng && (
              <a href={`https://www.google.com/maps?q=${fm.workshopLat},${fm.workshopLng}`} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: '0.75rem', color: 'var(--ac)', textDecoration: 'underline' }}>
                Xem Google Maps ↗
              </a>
            )}
          </div>
        </div>
        {showMap && (
          <MapPickerModal
            initialLat={fm.workshopLat}
            initialLng={fm.workshopLng}
            onConfirm={({ lat, lng }) => { setFm(p => ({ ...p, workshopLat: String(lat), workshopLng: String(lng) })); setShowMap(false); }}
            onClose={() => setShowMap(false)}
          />
        )}

      </div>

      {/* ── Sản phẩm / Công việc khách làm ── */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Sản phẩm / Công việc khách làm</label>
        <ProductPicker
          products={fm.products}
          onChange={v => setFm(p => ({ ...p, products: v }))}
          wts={wts}
          productCatalog={productCatalog}
          setProductCatalog={setProductCatalog}
          useAPI={useAPI}
          customers={customers}
        />
      </div>

      {/* ── Tính cách & Nhu cầu ── */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Tính cách & Nhu cầu khách</label>
        <PreferencePicker
          selected={fm.preferences}
          onChange={v => setFm(p => ({ ...p, preferences: v }))}
          catalog={preferenceCatalog}
          setCatalog={setPreferenceCatalog}
          useAPI={useAPI}
          customers={customers}
        />
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ flex: '1 1 100%' }}>
          <label style={labelStyle}>Ghi chú</label>
          <input value={fm.notes} onChange={e => f('notes')(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1.5px solid var(--bd)', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box', background: 'var(--bg)' }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{ padding: '8px 18px', borderRadius: 7, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>Hủy</button>
        <button onClick={handleSave} disabled={saving} style={{ padding: '8px 22px', borderRadius: 7, border: 'none', background: saving ? 'var(--bd)' : 'var(--ac)', color: saving ? 'var(--tm)' : '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>{saving ? 'Đang lưu...' : 'Lưu'}</button>
      </div>
    </div>
  );
}

function PgCustomers({ customers, setCustomers, wts, productCatalog, setProductCatalog, preferenceCatalog, setPreferenceCatalog, ce, useAPI, notify, onSelectCustomer, subPath = [], setSubPath }) {
  const validViews = ['list', 'add', 'edit'];
  const [view, setViewRaw] = useState(() => validViews.includes(subPath[0]) ? subPath[0] : 'list');
  const setView = (v) => { setViewRaw(v); setSubPath?.(v === 'list' ? [] : [v]); };
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [fProvince, setFProvince] = useState('');
  const [fCode, setFCode] = useState('');
  const [fPhone, setFPhone] = useState('');
  const [fCompany, setFCompany] = useState('');
  const { sortField, sortDir, toggleSort, sortIcon, applySort } = useTableSort('', 'asc');
  const [summary, setSummary] = useState({ debtMap: {}, lastOrderMap: {} });
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [debtExpandId, setDebtExpandId] = useState(null); // ID khách đang xem chi tiết nợ
  const [debtExpandData, setDebtExpandData] = useState([]); // dữ liệu chi tiết nợ
  const [debtExpandLoading, setDebtExpandLoading] = useState(false);

  useEffect(() => {
    if (!useAPI || customers.length === 0) return;
    setSummaryLoading(true);
    import('../api.js').then(api => api.fetchCustomersSummary())
      .then(s => setSummary(s))
      .catch(() => {})
      .finally(() => setSummaryLoading(false));
  }, [useAPI, customers.length]); // eslint-disable-line

  const filtered = useMemo(() => {
    let list = customers;
    // Province filter
    if (fProvince) list = list.filter(c => c.address === fProvince);
    if (fCode) list = list.filter(c => (c.customerCode || '').toLowerCase().includes(fCode.toLowerCase()));
    if (fPhone) list = list.filter(c => [c.phone1, c.phone2].some(p => (p || '').includes(fPhone)));
    if (fCompany) list = list.filter(c => (c.companyName || '').toLowerCase().includes(fCompany.toLowerCase()));
    // Text search
    const tokens = search.trim().toLowerCase().normalize('NFC').split(/\s+/).filter(Boolean);
    if (tokens.length) {
      list = list.filter(c => {
        const fields = [
          c.salutation || '', c.name, c.nickname || '',
          c.phone1 || '', c.phone2 || '',
          c.address || '', c.commune || '', c.streetAddress || '',
          c.companyName || '', c.customerCode || '',
        ].map(f => f.toLowerCase().normalize('NFC'));
        return tokens.every(tok => fields.some(f => f.includes(tok)));
      });
    }
    // Sort
    const getVal = (c, field) => {
      if (field === 'debt') return summary.debtMap[c.id] || 0;
      if (field === 'lastOrder') return summary.lastOrderMap[c.id] || '';
      return c[field] || '';
    };
    list = applySort(list, getVal);
    return list;
  }, [customers, search, fProvince, sortField, sortDir, summary, applySort]);

  const stats = useMemo(() => {
    const now = new Date();
    // Mới tháng này
    const newThisMonth = customers.filter(c => {
      if (!c.createdAt) return false;
      const d = new Date(c.createdAt);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    // Sinh nhật trong 5 ngày tới (so sánh tháng+ngày, bỏ qua năm)
    const upcomingBirthdays = customers.filter(c => {
      if (!c.dob) return false;
      const dob = new Date(c.dob);
      // Lấy ngày sinh trong năm nay
      const thisYear = new Date(now.getFullYear(), dob.getMonth(), dob.getDate());
      const diff = Math.ceil((thisYear - now) / 86400000);
      // diff = 0 → hôm nay, diff = 1..5 → trong 5 ngày tới
      // Nếu âm (đã qua), thử năm sau
      if (diff < 0) {
        const nextYear = new Date(now.getFullYear() + 1, dob.getMonth(), dob.getDate());
        const diff2 = Math.ceil((nextYear - now) / 86400000);
        return diff2 >= 0 && diff2 <= 5;
      }
      return diff <= 5;
    });
    // Phân bổ tỉnh thành
    const provMap = {};
    customers.forEach(c => { if (c.address) provMap[c.address] = (provMap[c.address] || 0) + 1; });
    const topProvinces = Object.entries(provMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const totalWithProv = customers.filter(c => c.address).length;
    // Thống kê sản phẩm
    const productMap = {};
    customers.forEach(c => {
      (c.products || []).forEach(p => {
        if (!productMap[p.productName]) productMap[p.productName] = { count: 0, woodTypes: {} };
        productMap[p.productName].count++;
        (p.woodTypes || []).forEach(wId => {
          productMap[p.productName].woodTypes[wId] = (productMap[p.productName].woodTypes[wId] || 0) + 1;
        });
      });
    });
    const topProducts = Object.entries(productMap).sort((a, b) => b[1].count - a[1].count);
    return { newThisMonth, upcomingBirthdays, topProvinces, totalWithProv, topProducts };
  }, [customers]);

  const handleAdd = async (fm) => {
    if (!useAPI) return notify('Cần kết nối API', false);
    // V-30: kiểm tra trùng số điện thoại
    const dupPhone = customers.find(c => fm.phone1.trim() && (c.phone1 === fm.phone1.trim() || c.phone2 === fm.phone1.trim()));
    if (dupPhone) {
      notify(`Số điện thoại ${fm.phone1} đã được dùng cho khách hàng "${dupPhone.name}". Vui lòng kiểm tra lại.`, false);
      return false; // signal form to stay open
    }
    const last3 = fm.phone1.trim().slice(-3);
    const nicknamePart = fm.nickname?.trim() || fm.address;
    const customerCode = `${fm.name.trim()} · ${nicknamePart} · ${last3}`;
    const { addCustomer, fetchCustomers } = await import('../api.js');
    const r = await addCustomer({ ...fm, customerCode });
    if (r.error) return notify(friendlyDbError(r.error), false);
    const fresh = await fetchCustomers().catch(() => null);
    if (fresh) setCustomers(fresh);
    setView('list');
    notify('Đã thêm khách hàng ' + fm.name);
  };

  const handleEdit = async (fm) => {
    if (!useAPI) return notify('Cần kết nối API', false);
    const last3 = fm.phone1.trim().slice(-3);
    const nicknamePart = fm.nickname?.trim() || fm.address;
    const customerCode = `${fm.name.trim()} · ${nicknamePart} · ${last3}`;
    const { updateCustomer } = await import('../api.js');
    const r = await updateCustomer(editing.id, { ...fm, customerCode });
    if (r.error) return notify(friendlyDbError(r.error), false);
    setCustomers(prev => prev.map(c => c.id === editing.id ? { ...c, ...fm, customerCode } : c));
    setView('list'); setEditing(null);
    notify('Đã cập nhật');
  };

  const handleDelete = async (c) => {
    if (!window.confirm(`Xóa khách hàng "${c.name}"?`)) return;
    // V-29: kiểm tra khách hàng có đơn hàng không
    if (useAPI) {
      const { checkCustomerHasOrders, deleteCustomer } = await import('../api.js');
      if (checkCustomerHasOrders) {
        const hasOrders = await checkCustomerHasOrders(c.id);
        if (hasOrders) {
          notify(`Không thể xóa "${c.name}" — khách hàng này đang có đơn hàng. Cần xóa đơn hàng trước.`, false);
          return;
        }
      }
      const r = await deleteCustomer(c.id);
      if (r.error) return notify('Lỗi: ' + r.error, false);
    }
    setCustomers(prev => prev.filter(x => x.id !== c.id));
    notify('Đã xóa');
  };

  const ths = { padding: '8px 10px', textAlign: 'left', background: 'var(--bgh)', color: 'var(--brl)', fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase', borderBottom: '2px solid var(--bds)', whiteSpace: 'nowrap' };
  const tds = { padding: '8px 10px', borderBottom: '1px solid var(--bd)', fontSize: '0.8rem', whiteSpace: 'nowrap' };

  if (view === 'add') return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => setView('list')} style={{ padding: '6px 12px', borderRadius: 6, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 600 }}>← Quay lại</button>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--br)' }}>👥 Thêm khách hàng mới</h2>
      </div>
      <CustomerForm wts={wts} productCatalog={productCatalog} setProductCatalog={setProductCatalog} preferenceCatalog={preferenceCatalog} setPreferenceCatalog={setPreferenceCatalog} useAPI={useAPI} customers={customers} onSave={handleAdd} onCancel={() => setView('list')} />
    </div>
  );

  if (view === 'edit' && editing) return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => { setView('list'); setEditing(null); }} style={{ padding: '6px 12px', borderRadius: 6, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 600 }}>← Quay lại</button>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--br)' }}>✏️ Sửa: {editing.name}</h2>
      </div>
      <CustomerForm initial={editing} wts={wts} productCatalog={productCatalog} setProductCatalog={setProductCatalog} preferenceCatalog={preferenceCatalog} setPreferenceCatalog={setPreferenceCatalog} useAPI={useAPI} customers={customers} onSave={handleEdit} onCancel={() => { setView('list'); setEditing(null); }} />
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--br)' }}>👥 Khách hàng</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {ce && <button onClick={() => setView('add')} style={{ padding: '7px 16px', borderRadius: 7, background: 'var(--ac)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem' }}>+ Thêm mới</button>}
        </div>
      </div>
      {/* ── Thống kê (admin) ── */}
      {ce && customers.length > 0 && (() => {
        const CARD = { height: 130, background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 10, padding: '10px 14px', overflow: 'hidden', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' };
        const LBL = { fontSize: '0.6rem', fontWeight: 700, color: 'var(--brl)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3, flexShrink: 0 };
        const NUM = (color) => ({ fontSize: '1.4rem', fontWeight: 800, color, lineHeight: 1.1, flexShrink: 0, marginBottom: 5 });
        return (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'stretch' }}>

            {/* Card 1: Mới tháng này */}
            <div style={{ ...CARD, flex: '0 0 148px' }}>
              <div style={LBL}>Mới tháng này</div>
              <div style={NUM('#7c3aed')}>🆕 {stats.newThisMonth.length}</div>
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {stats.newThisMonth.length === 0
                  ? <span style={{ fontSize: '0.68rem', color: 'var(--tm)' }}>Không có</span>
                  : stats.newThisMonth.slice(0, 4).map(c => (
                    <div key={c.id} title={(c.customerType === 'company' ? 'Công ty ' : c.salutation ? c.salutation + ' ' : '') + c.name} style={{ fontSize: '0.68rem', color: 'var(--ts)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.customerType === 'company' ? 'Công ty ' : c.salutation ? c.salutation + ' ' : ''}{c.name}
                    </div>
                  ))
                }
                {stats.newThisMonth.length > 4 && (
                  <div style={{ fontSize: '0.62rem', color: 'var(--tm)' }}>+{stats.newThisMonth.length - 4} người khác</div>
                )}
              </div>
            </div>

            {/* Card 2: Sinh nhật sắp tới */}
            <div style={{ ...CARD, flex: '0 0 200px' }}>
              <div style={LBL}>Sinh nhật 5 ngày tới</div>
              <div style={NUM('#db2777')}>🎂 {stats.upcomingBirthdays.length}</div>
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 3 }}>
                {stats.upcomingBirthdays.length === 0
                  ? <span style={{ fontSize: '0.68rem', color: 'var(--tm)' }}>Không có</span>
                  : stats.upcomingBirthdays.map(c => {
                    const dob = new Date(c.dob);
                    const now = new Date();
                    const thisYear = new Date(now.getFullYear(), dob.getMonth(), dob.getDate());
                    const diff = Math.ceil((thisYear - now) / 86400000);
                    const dayLabel = diff === 0 ? 'Hôm nay' : diff === 1 ? 'Ngày mai' : `${diff > 0 ? diff : Math.ceil((new Date(now.getFullYear()+1, dob.getMonth(), dob.getDate()) - now) / 86400000)} ngày nữa`;
                    return (
                      <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 4 }}>
                        <div title={(c.customerType === 'company' ? 'Công ty ' : c.salutation ? c.salutation + ' ' : '') + c.name} style={{ fontSize: '0.7rem', color: 'var(--ts)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {c.customerType === 'company' ? 'Công ty ' : c.salutation ? c.salutation + ' ' : ''}{c.name}
                        </div>
                        <div style={{ fontSize: '0.62rem', fontWeight: 700, color: diff === 0 ? '#db2777' : 'var(--tm)', whiteSpace: 'nowrap', flexShrink: 0 }}>{dayLabel}</div>
                      </div>
                    );
                  })
                }
              </div>
            </div>

            {/* Card 3: Phân bổ tỉnh thành */}
            {stats.topProvinces.length > 0 && (
              <div style={{ ...CARD, flex: '1 1 0' }}>
                <div style={{ ...LBL, marginBottom: 6 }}>Phân bổ tỉnh / thành phố</div>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {stats.topProvinces.map(([prov, cnt]) => {
                    const pct = stats.totalWithProv ? Math.round(cnt / stats.totalWithProv * 100) : 0;
                    return (
                      <div key={prov} style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <div title={prov} style={{ width: 100, fontSize: '0.7rem', color: 'var(--ts)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }}>{prov}</div>
                        <div style={{ flex: 1, height: 5, background: 'var(--bds)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: pct + '%', height: '100%', background: 'var(--ac)', borderRadius: 3 }} />
                        </div>
                        <div style={{ fontSize: '0.66rem', color: 'var(--tm)', width: 52, textAlign: 'right', flexShrink: 0 }}>{cnt} ({pct}%)</div>
                      </div>
                    );
                  })}
                  {stats.topProvinces.length === 8 && stats.totalWithProv > stats.topProvinces.reduce((s, [, n]) => s + n, 0) && (
                    <div style={{ fontSize: '0.6rem', color: 'var(--tm)', flexShrink: 0 }}>…và các tỉnh khác</div>
                  )}
                </div>
              </div>
            )}

            {/* Card 4: Thống kê sản phẩm */}
            {stats.topProducts.length > 0 && (
              <div style={{ ...CARD, flex: '1 1 0' }}>
                <div style={{ ...LBL, marginBottom: 6 }}>Sản phẩm khách làm</div>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {stats.topProducts.map(([name, info]) => {
                    const topWoods = Object.entries(info.woodTypes).sort((a, b) => b[1] - a[1]).slice(0, 3)
                      .map(([wId]) => wts.find(w => w.id === wId)?.icon).filter(Boolean).join(' ');
                    return (
                      <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <div title={name} style={{ flex: 1, fontSize: '0.7rem', color: 'var(--ts)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                        {topWoods && <span style={{ fontSize: '0.7rem' }}>{topWoods}</span>}
                        <div style={{ fontSize: '0.66rem', color: 'var(--tm)', fontWeight: 700, flexShrink: 0 }}>{info.count}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      <div style={{ background: 'var(--bgc)', borderRadius: 10, border: '1px solid var(--bd)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: 'var(--bgs)' }}>
                <td style={{ padding: '3px 4px' }} />
                <td style={{ padding: '5px 4px' }}><ComboFilter value={fCode || ''} onChange={v => setFCode(v)} options={[...new Set(customers.map(c => c.customerCode).filter(Boolean))].sort()} placeholder="Mã KH" /></td>
                <td style={{ padding: '5px 4px' }} colSpan={2}>
                  <ComboFilter value={search} onChange={v => setSearch(v)} options={[]} placeholder="Tên, SĐT, địa chỉ..." />
                </td>
                <td style={{ padding: '5px 4px' }}><ComboFilter value={fPhone || ''} onChange={v => setFPhone(v)} options={[]} placeholder="SĐT" /></td>
                <td style={{ padding: '5px 4px' }}><ComboFilter value={fCompany || ''} onChange={v => setFCompany(v)} options={[...new Set(customers.map(c => c.companyName).filter(Boolean))].sort()} placeholder="Công ty" /></td>
                <td style={{ padding: '5px 4px' }} />
                <td style={{ padding: '5px 4px' }}>
                  <ComboFilter value={fProvince} onChange={v => setFProvince(v)} options={[...new Set(customers.map(c => c.address).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'))} placeholder="Tỉnh/TP" />
                </td>
                <td style={{ padding: '5px 4px' }} />
                <td style={{ padding: '5px 4px' }} />
                <td style={{ padding: '5px 4px' }} />
              </tr>
              <tr>
                <th style={{ ...ths, width: 36, textAlign: "center" }}>STT</th>
                {[
                  { label: 'Mã KH', field: '' },
                  { label: 'Xưng hô & Tên', field: 'name' },
                  { label: 'Địa chỉ thường gọi', field: '' },
                  { label: 'Điện thoại', field: '' },
                  { label: 'Công ty', field: 'companyName' },
                  { label: 'Sản phẩm', field: '' },
                  { label: 'Tỉnh/TP', field: '' },
                  { label: 'Công nợ thực tế', field: 'debt' },
                  { label: 'Mua gần nhất', field: 'lastOrder' },
                  { label: '', field: '' },
                ].map(({ label, field }, idx) => (
                  <th key={idx} style={{ ...ths, cursor: field ? 'pointer' : 'default', userSelect: 'none' }}
                    onClick={() => field && toggleSort(field)}>
                    {label}{sortIcon(field)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={11} style={{ padding: 30, textAlign: 'center', color: 'var(--tm)' }}>{customers.length === 0 ? 'Chưa có khách hàng nào.' : 'Không tìm thấy.'}</td></tr>
              ) : filtered.map((c, i) => (
                <React.Fragment key={c.id}>
                <tr style={{ background: i % 2 ? 'var(--bgs)' : '#fff', cursor: onSelectCustomer ? 'pointer' : 'default' }}
                  onClick={() => onSelectCustomer?.(c)}>
                  <td style={{ ...tds, textAlign: "center", fontSize: "0.68rem", color: "var(--tm)", width: 36 }}>{i + 1}</td>
                  <td style={{ ...tds, fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--tm)' }}>{c.customerCode}</td>
                  <td style={{ ...tds, fontWeight: 700, color: 'var(--br)' }}>
                    {c.customerType === 'company' ? <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#2980b9', marginRight: 4, background: 'rgba(41,128,185,0.1)', padding: '1px 5px', borderRadius: 3 }}>Công ty</span> : c.salutation ? <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--ac)', marginRight: 4, background: 'var(--acbg)', padding: '1px 5px', borderRadius: 3 }}>{c.salutation}</span> : null}
                    {c.name}
                    {c.dob && <span style={{ fontSize: '0.7rem', color: 'var(--tm)', fontWeight: 500, marginLeft: 5 }}>{fmtDate(c.dob)}</span>}
                  </td>
                  <td title={c.nickname || '—'} style={{ ...tds, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <div>{c.nickname || '—'}</div>
                    {c.commune && <div style={{ fontSize: '0.72rem', color: 'var(--tm)' }}>{c.commune}</div>}
                    {(c.workshopLat && c.workshopLng) && <a href={`https://www.google.com/maps?q=${c.workshopLat},${c.workshopLng}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: '0.68rem', color: 'var(--ac)' }}>📍 Bản đồ</a>}
                  </td>
                  <td style={tds}>{c.phone1}{c.phone2 && <div style={{ fontSize: '0.7rem', color: 'var(--tm)' }}>{c.phone2}</div>}</td>
                  <td style={tds}>{c.companyName || '—'}</td>
                  <td style={{ ...tds, maxWidth: 160 }}>
                    {c.products?.length ? c.products.map(p => (
                      <div key={p.productId} title={p.productName} style={{ fontSize: '0.72rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.productName}{p.woodTypes?.length ? <span style={{ color: 'var(--tm)', marginLeft: 4 }}>{p.woodTypes.map(id => wts.find(w => w.id === id)?.icon).filter(Boolean).join('')}</span> : null}
                      </div>
                    )) : <span style={{ color: 'var(--tm)' }}>—</span>}
                  </td>
                  <td style={{ ...tds, fontSize: '0.74rem', whiteSpace: 'normal' }}>{c.address || '—'}</td>
                  <td style={{ ...tds, textAlign: 'right', color: summary.debtMap[c.id] > 0 ? 'var(--dg)' : 'var(--tm)', fontWeight: summary.debtMap[c.id] > 0 ? 700 : 400, cursor: summary.debtMap[c.id] > 0 ? 'pointer' : 'default' }}
                    onClick={e => { e.stopPropagation(); if (!summary.debtMap[c.id]) return;
                      if (debtExpandId === c.id) { setDebtExpandId(null); return; }
                      setDebtExpandId(c.id); setDebtExpandLoading(true); setDebtExpandData([]);
                      import('../api.js').then(api => api.fetchCustomerDebtDetail(c.id)).then(d => { setDebtExpandData(d || []); setDebtExpandLoading(false); }).catch(() => setDebtExpandLoading(false));
                    }}>
                    {summaryLoading ? <span style={{ color: 'var(--tm)', fontWeight: 400 }}>…</span>
                      : summary.debtMap[c.id] > 0 ? <span title="Click xem chi tiết" style={{ textDecoration: 'underline', textDecorationStyle: 'dotted' }}>{summary.debtMap[c.id].toLocaleString('vi-VN') + ' đ'}</span> : '—'}
                  </td>
                  <td style={{ ...tds, color: 'var(--ts)' }}>
                    {summaryLoading ? <span style={{ color: 'var(--tm)' }}>…</span>
                      : summary.lastOrderMap[c.id]
                        ? fmtDate(summary.lastOrderMap[c.id])
                        : <span style={{ color: 'var(--tm)' }}>—</span>}
                  </td>
                  <td style={{ ...tds, whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                    {ce && <><button onClick={() => { setEditing(c); setView('edit'); }} style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid var(--bd)', background: 'transparent', cursor: 'pointer', fontSize: '0.72rem', color: 'var(--ts)', marginRight: 4 }}>Sửa</button>
                    <button onClick={() => handleDelete(c)} style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid var(--dg)', background: 'transparent', cursor: 'pointer', fontSize: '0.72rem', color: 'var(--dg)' }}>Xóa</button></>}
                  </td>
                </tr>
                {debtExpandId === c.id && (
                  <tr><td colSpan={11} style={{ padding: '8px 12px', background: '#FFF8E1', borderBottom: '2px solid #FFD54F' }}>
                    {debtExpandLoading ? <span style={{ color: 'var(--tm)', fontSize: '0.74rem' }}>Đang tải...</span> : debtExpandData.length === 0 ? <span style={{ color: 'var(--tm)', fontSize: '0.74rem' }}>Không có đơn nợ</span> : (
                      <div>
                        <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                          <div style={{ padding: '6px 12px', borderRadius: 6, background: 'rgba(255,152,0,0.12)', border: '1px solid #FFD54F', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.58rem', fontWeight: 700, color: '#795548', textTransform: 'uppercase' }}>Tổng nợ</div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#E65100' }}>{fmtMoney(debtExpandData.reduce((s, d) => s + d.outstanding, 0))}</div>
                          </div>
                          {(() => { const overdue = debtExpandData.filter(d => d.daysSince > (c.debtDays || 30)); return overdue.length > 0 ? (
                            <div style={{ padding: '6px 12px', borderRadius: 6, background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.3)', textAlign: 'center' }}>
                              <div style={{ fontSize: '0.58rem', fontWeight: 700, color: '#B71C1C', textTransform: 'uppercase' }}>Quá hạn</div>
                              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#c0392b' }}>{fmtMoney(overdue.reduce((s, d) => s + d.outstanding, 0))}</div>
                              <div style={{ fontSize: '0.56rem', color: '#c0392b' }}>{overdue.length} đơn</div>
                            </div>
                          ) : null; })()}
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
                          <thead><tr style={{ background: 'rgba(255,213,79,0.3)' }}>
                            {['#', 'Đơn hàng', 'Ngày tạo', 'Tổng đơn', 'Đã trả', 'Còn nợ', 'Thời gian'].map(h => (
                              <th key={h} style={{ padding: '4px 6px', textAlign: h === 'Tổng đơn' || h === 'Đã trả' || h === 'Còn nợ' ? 'right' : 'left', fontWeight: 700, fontSize: '0.58rem', textTransform: 'uppercase', color: '#795548', borderBottom: '1px solid #FFD54F' }}>{h}</th>
                            ))}
                          </tr></thead>
                          <tbody>{debtExpandData.map((d, di) => (
                            <tr key={d.orderId} style={{ background: di % 2 ? 'rgba(255,248,225,0.5)' : 'transparent' }}>
                              <td style={{ padding: '3px 6px', textAlign: 'center', color: 'var(--tm)', fontSize: '0.64rem' }}>{di + 1}</td>
                              <td style={{ padding: '3px 6px', fontFamily: 'Consolas,monospace', fontWeight: 700, color: '#5D4037' }}>{d.orderCode}</td>
                              <td style={{ padding: '3px 6px' }}>{fmtDate(d.createdAt)}</td>
                              <td style={{ padding: '3px 6px', textAlign: 'right' }}>{fmtMoney(d.totalAmount)}</td>
                              <td style={{ padding: '3px 6px', textAlign: 'right', color: 'var(--gn)' }}>{d.totalPaid > 0 ? fmtMoney(d.totalPaid) : '—'}</td>
                              <td style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 700, color: d.daysSince > (c.debtDays || 30) ? '#c0392b' : '#8e44ad' }}>{fmtMoney(d.outstanding)}</td>
                              <td style={{ padding: '3px 6px' }}>
                                <span style={{ padding: '1px 5px', borderRadius: 3, background: d.daysSince > (c.debtDays || 30) ? 'rgba(192,57,43,0.1)' : 'rgba(142,68,173,0.1)', color: d.daysSince > (c.debtDays || 30) ? '#c0392b' : '#8e44ad', fontWeight: 700, fontSize: '0.6rem' }}>{d.daysSince} ngày</span>
                              </td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    )}
                  </td></tr>
                )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ marginTop: 8, fontSize: '0.72rem', color: 'var(--tm)' }}>{filtered.length} khách hàng</div>
    </div>
  );
}

export default React.memo(PgCustomers);
