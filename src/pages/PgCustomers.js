import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { VN_PROVINCES } from "../data/vnProvinces.js";

const EMPTY_FORM = {
  salutation: '', name: '', dob: '',
  phone1: '', phone2: '',
  companyName: '', department: '', position: '',
  address: '',          // tỉnh/thành phố (province)
  commune: '',          // xã/phường/thị trấn
  streetAddress: '',    // số nhà, đường
  workshopLat: '',      // tọa độ xưởng
  workshopLng: '',      // tọa độ xưởng
  deliveryAddress: '',
  interestedWoodTypes: [], productDescription: '',
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
  useEffect(() => { const h = e => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h); }, [onClose]);

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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '92vw', maxWidth: 740, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.25)' }}>
        {/* Header */}
        <div style={{ padding: '11px 16px', borderBottom: '1px solid var(--bd)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--br)' }}>📍 Chọn vị trí xưởng trên bản đồ</span>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--tm)', lineHeight: 1 }}>✕</button>
        </div>
        {/* Hint */}
        <div style={{ padding: '6px 16px', fontSize: '0.72rem', color: 'var(--tm)', background: 'var(--bgs)', flexShrink: 0 }}>
          Click trên bản đồ để đặt đinh ghim • Kéo đinh ghim để tinh chỉnh vị trí
        </div>
        {/* Map */}
        <div style={{ position: 'relative', flex: 1, minHeight: 380 }}>
          {loading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bgs)', zIndex: 1, fontSize: '0.82rem', color: 'var(--tm)' }}>
              Đang tải bản đồ...
            </div>
          )}
          <div ref={mapDivRef} style={{ width: '100%', height: '100%', minHeight: 380 }} />
        </div>
        {/* Footer */}
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--bd)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
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
      </div>
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

function CustomerForm({ initial, wts, onSave, onCancel }) {
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
    if (!fm.name.trim()) e.name = 'Bắt buộc';
    if (!fm.address.trim()) e.address = 'Bắt buộc';
    if (!fm.phone1.trim()) e.phone1 = 'Bắt buộc';
    setErrs(e); return Object.keys(e).length === 0;
  };
  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    await onSave(fm);
    setSaving(false);
  };
  const toggleWood = (id) => setFm(p => ({ ...p, interestedWoodTypes: p.interestedWoodTypes.includes(id) ? p.interestedWoodTypes.filter(x => x !== id) : [...p.interestedWoodTypes, id] }));
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

        {/* ── Thông tin cá nhân ── */}
        <SectionLabel>Thông tin cá nhân</SectionLabel>
        <div style={{ flex: '1 1 100%' }}>
          <label style={labelStyle}>Cách xưng hô</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SALUTATIONS.map(s => {
              const sel = fm.salutation === s;
              return (
                <button key={s} type="button" onClick={() => setFm(p => ({ ...p, salutation: sel ? '' : s }))}
                  style={{ padding: '5px 14px', borderRadius: 6, border: sel ? '1.5px solid var(--ac)' : '1.5px solid var(--bd)', background: sel ? 'var(--acbg)' : 'transparent', color: sel ? 'var(--ac)' : 'var(--ts)', cursor: 'pointer', fontWeight: sel ? 700 : 500, fontSize: '0.82rem' }}>
                  {s}
                </button>
              );
            })}
          </div>
        </div>
        {inp('Tên khách hàng', 'name', { req: true, ph: 'Minh, Huệ, Tuấn...' })}
        {inp('Ngày sinh', 'dob', { type: 'date' })}
        {inp('Số điện thoại chính', 'phone1', { req: true, type: 'tel', ph: '0901...' })}
        {inp('Số điện thoại phụ', 'phone2', { ph: '(nếu có)' })}

        {/* ── Thông tin công ty ── */}
        <SectionLabel>Thông tin công ty</SectionLabel>
        {inp('Tên công ty', 'companyName', { ph: '(nếu có)' })}
        {inp('Phòng ban', 'department', { ph: 'Kinh doanh, Kỹ thuật...' })}
        {inp('Chức vụ', 'position', { ph: 'Giám đốc, Trưởng phòng...' })}

        {/* ── Địa chỉ xưởng ── */}
        <SectionLabel>Địa chỉ xưởng khách</SectionLabel>
        <div style={{ flex: '1 1 220px' }}>
          <label style={{ ...labelStyle, color: errs.address ? 'var(--dg)' : 'var(--brl)' }}>Tỉnh / Thành phố *</label>
          <select value={fm.address} onChange={e => { f('address')(e.target.value); setErrs(p => ({ ...p, address: '' })); }}
            style={{ ...inpStyle(errs.address), color: fm.address ? 'var(--br)' : 'var(--tm)' }}>
            <option value="">-- Chọn tỉnh/thành phố --</option>
            {VN_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          {errs.address && <div style={{ fontSize: '0.62rem', color: 'var(--dg)', marginTop: 2 }}>{errs.address}</div>}
        </div>
        {inp('Xã / Phường / Thị trấn', 'commune', { ph: 'Tên xã, phường...' })}
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

        {inp('Địa chỉ giao hàng (nếu khác xưởng)', 'deliveryAddress', { full: true, ph: 'Số nhà, đường, phường...' })}
      </div>

      {/* ── Loại gỗ quan tâm ── */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Loại gỗ quan tâm</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {wts.map(w => { const sel = fm.interestedWoodTypes.includes(w.id); return (
            <button key={w.id} onClick={() => toggleWood(w.id)} style={{ padding: '4px 10px', borderRadius: 5, border: sel ? '1.5px solid var(--ac)' : '1.5px solid var(--bd)', background: sel ? 'var(--acbg)' : 'transparent', color: sel ? 'var(--ac)' : 'var(--ts)', cursor: 'pointer', fontSize: '0.76rem', fontWeight: sel ? 700 : 500 }}>{w.icon} {w.name}</button>
          ); })}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Sản phẩm công ty khách làm</label>
        <textarea value={fm.productDescription} onChange={e => f('productDescription')(e.target.value)} rows={2} placeholder="Mô tả loại sản phẩm..."
          style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1.5px solid var(--bd)', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', background: 'var(--bg)' }} />
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ flex: '1 1 160px' }}>
          <label style={labelStyle}>Trần công nợ (đ)</label>
          <NumInput value={fm.debtLimit} onChange={n => f('debtLimit')(n)} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1.5px solid var(--bd)', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box', background: 'var(--bg)' }} />
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <label style={labelStyle}>Hạn công nợ (ngày)</label>
          <input type="number" min="0" value={fm.debtDays} onChange={e => f('debtDays')(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1.5px solid var(--bd)', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box', background: 'var(--bg)' }} />
        </div>
        <div style={{ flex: '1 1 240px' }}>
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

export default function PgCustomers({ customers, setCustomers, wts, ce, useAPI, notify, onSelectCustomer }) {
  const [view, setView] = useState('list'); // list | add | edit
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [summary, setSummary] = useState({ debtMap: {}, lastOrderMap: {} });
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    if (!useAPI || customers.length === 0) return;
    setSummaryLoading(true);
    import('../api.js').then(api => api.fetchCustomersSummary())
      .then(s => setSummary(s))
      .catch(() => {})
      .finally(() => setSummaryLoading(false));
  }, [useAPI, customers.length]); // eslint-disable-line

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const s = search.toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(s) || c.phone1.includes(s) || c.address.toLowerCase().includes(s) || (c.customerCode || '').toLowerCase().includes(s) || (c.companyName || '').toLowerCase().includes(s));
  }, [customers, search]);

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
    return { newThisMonth, upcomingBirthdays, topProvinces, totalWithProv };
  }, [customers]);

  const handleAdd = async (fm) => {
    if (!useAPI) return notify('Cần kết nối API', false);
    // V-30: kiểm tra trùng số điện thoại
    const dupPhone = customers.find(c => fm.phone1.trim() && (c.phone1 === fm.phone1.trim() || c.phone2 === fm.phone1.trim()));
    if (dupPhone) {
      notify(`Số điện thoại ${fm.phone1} đã được dùng cho khách hàng "${dupPhone.name}". Vui lòng kiểm tra lại.`, false);
      return false; // signal form to stay open
    }
    const { addCustomer, fetchCustomers } = await import('../api.js');
    const r = await addCustomer(fm);
    if (r.error) return notify('Lỗi: ' + r.error, false);
    const fresh = await fetchCustomers().catch(() => null);
    if (fresh) setCustomers(fresh);
    setView('list');
    notify('Đã thêm khách hàng ' + fm.name);
  };

  const handleEdit = async (fm) => {
    if (!useAPI) return notify('Cần kết nối API', false);
    const { updateCustomer } = await import('../api.js');
    const r = await updateCustomer(editing.id, fm);
    if (r.error) return notify('Lỗi: ' + r.error, false);
    setCustomers(prev => prev.map(c => c.id === editing.id ? { ...c, ...fm, customerCode: c.customerCode } : c));
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
      <CustomerForm wts={wts} onSave={handleAdd} onCancel={() => setView('list')} />
    </div>
  );

  if (view === 'edit' && editing) return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => { setView('list'); setEditing(null); }} style={{ padding: '6px 12px', borderRadius: 6, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 600 }}>← Quay lại</button>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--br)' }}>✏️ Sửa: {editing.name}</h2>
      </div>
      <CustomerForm initial={editing} wts={wts} onSave={handleEdit} onCancel={() => { setView('list'); setEditing(null); }} />
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
                    <div key={c.id} style={{ fontSize: '0.68rem', color: 'var(--ts)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.salutation ? c.salutation + ' ' : ''}{c.name}
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
                        <div style={{ fontSize: '0.7rem', color: 'var(--ts)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {c.salutation ? c.salutation + ' ' : ''}{c.name}
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
                        <div style={{ width: 100, fontSize: '0.7rem', color: 'var(--ts)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }}>{prov}</div>
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
          </div>
        );
      })()}

      <div style={{ marginBottom: 10 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Tìm tên, SĐT, địa chỉ, mã KH..."
          style={{ width: '100%', maxWidth: 400, padding: '7px 12px', borderRadius: 7, border: '1.5px solid var(--bd)', fontSize: '0.82rem', outline: 'none' }} />
      </div>
      <div style={{ background: 'var(--bgc)', borderRadius: 10, border: '1px solid var(--bd)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead><tr>
              {['Mã KH', 'Xưng hô & Tên', 'Địa chỉ', 'Điện thoại', 'Công ty', 'Loại gỗ QT', 'Công nợ thực tế', 'Mua gần nhất', ''].map(h => <th key={h} style={ths}>{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: 30, textAlign: 'center', color: 'var(--tm)' }}>{customers.length === 0 ? 'Chưa có khách hàng nào.' : 'Không tìm thấy.'}</td></tr>
              ) : filtered.map((c, i) => (
                <tr key={c.id} style={{ background: i % 2 ? 'var(--bgs)' : '#fff', cursor: onSelectCustomer ? 'pointer' : 'default' }}
                  onClick={() => onSelectCustomer?.(c)}>
                  <td style={{ ...tds, fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--tm)' }}>{c.customerCode}</td>
                  <td style={{ ...tds, fontWeight: 700, color: 'var(--br)' }}>
                    {c.salutation && <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--ac)', marginRight: 4, background: 'var(--acbg)', padding: '1px 5px', borderRadius: 3 }}>{c.salutation}</span>}
                    {c.name}
                    {c.dob && <span style={{ fontSize: '0.7rem', color: 'var(--tm)', fontWeight: 500, marginLeft: 5 }}>{new Date(c.dob).toLocaleDateString('vi-VN')}</span>}
                  </td>
                  <td style={{ ...tds, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <div>{c.address}</div>
                    {c.commune && <div style={{ fontSize: '0.72rem', color: 'var(--tm)' }}>{c.commune}</div>}
                    {(c.workshopLat && c.workshopLng) && <a href={`https://www.google.com/maps?q=${c.workshopLat},${c.workshopLng}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: '0.68rem', color: 'var(--ac)' }}>📍 Bản đồ</a>}
                  </td>
                  <td style={tds}>{c.phone1}{c.phone2 && <div style={{ fontSize: '0.7rem', color: 'var(--tm)' }}>{c.phone2}</div>}</td>
                  <td style={tds}>{c.companyName || '—'}</td>
                  <td style={tds}>{c.interestedWoodTypes?.length ? c.interestedWoodTypes.length + ' loại' : '—'}</td>
                  <td style={{ ...tds, color: summary.debtMap[c.id] > 0 ? 'var(--dg)' : 'var(--tm)', fontWeight: summary.debtMap[c.id] > 0 ? 700 : 400 }}>
                    {summaryLoading ? <span style={{ color: 'var(--tm)', fontWeight: 400 }}>…</span>
                      : summary.debtMap[c.id] > 0 ? summary.debtMap[c.id].toLocaleString('vi-VN') + ' đ' : '—'}
                  </td>
                  <td style={{ ...tds, color: 'var(--ts)' }}>
                    {summaryLoading ? <span style={{ color: 'var(--tm)' }}>…</span>
                      : summary.lastOrderMap[c.id]
                        ? new Date(summary.lastOrderMap[c.id]).toLocaleDateString('vi-VN')
                        : <span style={{ color: 'var(--tm)' }}>—</span>}
                  </td>
                  <td style={{ ...tds, whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                    {ce && <><button onClick={() => { setEditing(c); setView('edit'); }} style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid var(--bd)', background: 'transparent', cursor: 'pointer', fontSize: '0.72rem', color: 'var(--ts)', marginRight: 4 }}>Sửa</button>
                    <button onClick={() => handleDelete(c)} style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid var(--dg)', background: 'transparent', cursor: 'pointer', fontSize: '0.72rem', color: 'var(--dg)' }}>Xóa</button></>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ marginTop: 8, fontSize: '0.72rem', color: 'var(--tm)' }}>{filtered.length} khách hàng</div>
    </div>
  );
}
