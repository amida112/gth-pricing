import React, { useState } from "react";

const SVC_TYPES = [
  { value: 'chi_van_chuyen',    label: 'Chỉ vận chuyển',           icon: '🚛' },
  { value: 'van_chuyen_va_cau', label: 'Vận chuyển + Cẩu/Hạ cont', icon: '🚛🏗' },
  { value: 'chi_ha_cont',       label: 'Chỉ hạ cont / Cẩu',        icon: '🏗' },
];

const SVC_COLOR = {
  chi_van_chuyen:    { bg: 'rgba(41,128,185,0.1)',  color: '#2980b9' },
  van_chuyen_va_cau: { bg: 'rgba(242,101,34,0.1)',  color: 'var(--ac)' },
  chi_ha_cont:       { bg: 'rgba(142,68,173,0.1)',  color: '#8e44ad' },
};

const PRIORITY_OPTS = [1, 2, 3];
const EMPTY_FM = { name: '', phone: '', serviceType: 'chi_van_chuyen', priority: 1, vehicles: [] };

function VehicleTable({ vehicles, onChange }) {
  const addRow = () => onChange([...vehicles, { name: '', dimensions: '', suitableCargo: '', canGoProvince: false }]);
  const upd = (i, patch) => onChange(vehicles.map((v, idx) => idx === i ? { ...v, ...patch } : v));
  const del = (i) => onChange(vehicles.filter((_, idx) => idx !== i));

  const cell = { padding: '4px 6px', borderRadius: 5, border: '1.5px solid var(--bd)', fontSize: '0.74rem', background: 'var(--bg)', color: 'var(--tp)', boxSizing: 'border-box', width: '100%' };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--brl)', textTransform: 'uppercase' }}>Danh sách xe</span>
        <button onClick={addRow} style={{ padding: '3px 10px', borderRadius: 5, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontSize: '0.72rem' }}>+ Thêm xe</button>
      </div>
      {vehicles.length === 0 ? (
        <div style={{ fontSize: '0.74rem', color: 'var(--tm)', fontStyle: 'italic', padding: '4px 0' }}>Chưa có xe — bấm "+ Thêm xe".</div>
      ) : (
        <div style={{ border: '1.5px solid var(--bd)', borderRadius: 7, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem' }}>
            <thead>
              <tr style={{ background: 'var(--bgh)' }}>
                {['Tên xe / Tải trọng', 'Kích thước thùng', 'Hàng hóa phù hợp', 'Đi tỉnh?', ''].map(h => (
                  <th key={h} style={{ padding: '5px 7px', textAlign: 'left', color: 'var(--brl)', fontWeight: 700, fontSize: '0.6rem', textTransform: 'uppercase', borderBottom: '1.5px solid var(--bds)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v, i) => (
                <tr key={i} style={{ background: i % 2 ? 'var(--bgs)' : '#fff' }}>
                  <td style={{ padding: '4px 5px', borderBottom: '1px solid var(--bd)', minWidth: 110 }}>
                    <input value={v.name} onChange={e => upd(i, { name: e.target.value })} placeholder="VD: Xe 5 tấn" style={cell} />
                  </td>
                  <td style={{ padding: '4px 5px', borderBottom: '1px solid var(--bd)', minWidth: 110 }}>
                    <input value={v.dimensions} onChange={e => upd(i, { dimensions: e.target.value })} placeholder="VD: 6m × 2.3m" style={cell} />
                  </td>
                  <td style={{ padding: '4px 5px', borderBottom: '1px solid var(--bd)', minWidth: 140 }}>
                    <input value={v.suitableCargo} onChange={e => upd(i, { suitableCargo: e.target.value })} placeholder="VD: Gỗ dài ≤5m, ≤5 tấn" style={cell} />
                  </td>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--bd)', textAlign: 'center' }}>
                    <input type="checkbox" checked={!!v.canGoProvince} onChange={e => upd(i, { canGoProvince: e.target.checked })} style={{ accentColor: 'var(--ac)', width: 15, height: 15, cursor: 'pointer' }} />
                  </td>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--bd)', textAlign: 'center' }}>
                    <button onClick={() => del(i)} style={{ padding: '2px 7px', borderRadius: 4, border: '1px solid var(--dg)', background: 'transparent', color: 'var(--dg)', cursor: 'pointer', fontSize: '0.7rem' }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function PgCarriers({ carriers, setCarriers, useAPI, notify }) {
  const [ed, setEd] = useState(null);
  const [fm, setFm] = useState(EMPTY_FM);
  const [fmErr, setFmErr] = useState({});
  const [expanded, setExpanded] = useState(null);
  const [filterSvc, setFilterSvc] = useState('all');

  const setF = (k) => (v) => setFm(p => ({ ...p, [k]: v }));

  const openNew = () => { setFm(EMPTY_FM); setFmErr({}); setEd('new'); setExpanded(null); };
  const openEdit = (c) => {
    setFm({ name: c.name, phone: c.phone || '', serviceType: c.serviceType || 'chi_van_chuyen', priority: c.priority ?? 1, vehicles: JSON.parse(JSON.stringify(c.vehicles || [])) });
    setFmErr({}); setEd(c.id); setExpanded(null);
  };
  const cancel = () => { setEd(null); setFmErr({}); };

  const validate = () => {
    const errs = {};
    if (!fm.name.trim()) errs.name = 'Không được để trống';
    const dup = carriers.find(c => c.id !== ed && c.name.trim().toLowerCase() === fm.name.trim().toLowerCase());
    if (dup) errs.name = 'Tên đã tồn tại';
    return errs;
  };

  const sv = () => {
    const errs = validate();
    if (Object.keys(errs).length) { setFmErr(errs); return; }
    setFmErr({});
    const name = fm.name.trim();
    const phone = fm.phone.trim();
    const { serviceType, priority, vehicles } = fm;
    if (ed === 'new') {
      const tmp = { id: 'tmp_' + Date.now(), name, phone, serviceType, priority, vehicles, active: true };
      setCarriers(p => [...p, tmp].sort(byPriority));
      if (useAPI) import('../api.js').then(api => api.addCarrier(name, phone, serviceType, priority, vehicles)
        .then(r => {
          if (r?.error) { notify('Lỗi: ' + r.error, false); setCarriers(p => p.filter(c => c.id !== tmp.id)); }
          else { setCarriers(p => p.map(c => c.id === tmp.id ? { ...c, id: r.id ?? c.id } : c)); notify('Đã thêm ' + name); }
        }).catch(e => notify('Lỗi kết nối: ' + e.message, false)));
      else notify('Đã thêm ' + name);
    } else {
      const prev = carriers.find(c => c.id === ed);
      setCarriers(p => p.map(c => c.id === ed ? { ...c, name, phone, serviceType, priority, vehicles } : c).sort(byPriority));
      if (useAPI) import('../api.js').then(api => api.updateCarrier(ed, name, phone, prev?.active ?? true, serviceType, priority, vehicles)
        .then(r => notify(r?.error ? ('Lỗi: ' + r.error) : 'Đã cập nhật', !r?.error))
        .catch(e => notify('Lỗi kết nối: ' + e.message, false)));
      else notify('Đã cập nhật');
    }
    setEd(null);
  };

  const toggleActive = (c) => {
    setCarriers(p => p.map(x => x.id === c.id ? { ...x, active: !x.active } : x));
    if (useAPI) import('../api.js').then(api =>
      api.updateCarrier(c.id, c.name, c.phone, !c.active, c.serviceType, c.priority, c.vehicles)
        .catch(e => notify('Lỗi: ' + e.message, false)));
  };

  const del = (c) => {
    if (!window.confirm(`Xóa đơn vị "${c.name}"?`)) return;
    setCarriers(p => p.filter(x => x.id !== c.id));
    if (useAPI) import('../api.js').then(api => api.deleteCarrier(c.id)
      .then(r => { if (r?.error) { notify('Lỗi: ' + r.error, false); setCarriers(p => [...p, c]); } else notify('Đã xóa'); })
      .catch(e => notify('Lỗi kết nối: ' + e.message, false)));
    else notify('Đã xóa');
  };

  const byPriority = (a, b) => (a.priority ?? 1) - (b.priority ?? 1) || a.id - b.id;

  const filtered = carriers
    .filter(c => filterSvc === 'all' || c.serviceType === filterSvc)
    .sort(byPriority);

  // Count per serviceType for filter badges
  const counts = { all: carriers.length };
  SVC_TYPES.forEach(t => { counts[t.value] = carriers.filter(c => c.serviceType === t.value).length; });

  const inp = { padding: '7px 10px', borderRadius: 7, border: '1.5px solid var(--bd)', background: 'var(--bg)', color: 'var(--tp)', fontSize: '0.82rem', boxSizing: 'border-box', outline: 'none', width: '100%' };
  const th = { padding: '8px 12px', textAlign: 'left', color: 'var(--brl)', fontWeight: 700, fontSize: '0.62rem', textTransform: 'uppercase', borderBottom: '2px solid var(--bds)', whiteSpace: 'nowrap' };
  const tdSt = (extra = {}) => ({ padding: '10px 12px', borderBottom: '1px solid var(--bd)', fontSize: '0.8rem', verticalAlign: 'middle', ...extra });

  const filterTab = (value, label, count) => {
    const active = filterSvc === value;
    return (
      <button key={value} onClick={() => setFilterSvc(value)}
        style={{ padding: '5px 12px', borderRadius: 6, border: active ? '1.5px solid var(--ac)' : '1.5px solid var(--bd)', background: active ? 'var(--acbg)' : 'transparent', color: active ? 'var(--ac)' : 'var(--ts)', cursor: 'pointer', fontSize: '0.74rem', fontWeight: active ? 700 : 500, display: 'flex', alignItems: 'center', gap: 5 }}>
        {label}
        <span style={{ padding: '0 5px', borderRadius: 10, background: active ? 'var(--ac)' : 'var(--bds)', color: active ? '#fff' : 'var(--ts)', fontSize: '0.62rem', fontWeight: 700 }}>{count}</span>
      </button>
    );
  };

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--br)' }}>🚛 Đơn vị vận tải</h2>
          <div style={{ fontSize: '0.72rem', color: 'var(--tm)', marginTop: 3 }}>Quản lý đơn vị vận chuyển, cẩu, hạ cont</div>
        </div>
        {ed === null && (
          <button onClick={openNew} style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: 'var(--ac)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>
            + Thêm mới
          </button>
        )}
      </div>

      {/* ── Form ── */}
      {ed !== null && (
        <div style={{ background: 'var(--bgc)', border: '1.5px solid var(--ac)', borderRadius: 10, padding: 18, marginBottom: 18 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--ac)', textTransform: 'uppercase', marginBottom: 14, letterSpacing: '0.05em' }}>
            {ed === 'new' ? '+ Thêm đơn vị mới' : '✏️ Sửa đơn vị'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 12, alignItems: 'end', marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--brl)', display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>Tên đơn vị *</label>
              <input value={fm.name} onChange={e => setF('name')(e.target.value)}
                placeholder="VD: Thanh Bình Transport" style={{ ...inp, borderColor: fmErr.name ? 'var(--dg)' : undefined }} />
              {fmErr.name && <div style={{ fontSize: '0.68rem', color: 'var(--dg)', marginTop: 3 }}>{fmErr.name}</div>}
            </div>
            <div>
              <label style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--brl)', display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>Số điện thoại</label>
              <input value={fm.phone} onChange={e => setF('phone')(e.target.value)} placeholder="0912 345 678" style={inp} />
            </div>
            <div>
              <label style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--brl)', display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>Loại dịch vụ *</label>
              <select value={fm.serviceType} onChange={e => setF('serviceType')(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                {SVC_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--brl)', display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>Ưu tiên</label>
              <select value={fm.priority ?? 1} onChange={e => setF('priority')(Number(e.target.value))}
                style={{ ...inp, width: 70, cursor: 'pointer' }}>
                {PRIORITY_OPTS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <VehicleTable vehicles={fm.vehicles} onChange={v => setF('vehicles')(v)} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={cancel} style={{ padding: '7px 14px', borderRadius: 7, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontSize: '0.8rem' }}>Hủy</button>
            <button onClick={sv} style={{ padding: '7px 18px', borderRadius: 7, border: 'none', background: 'var(--ac)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>
              {ed === 'new' ? 'Thêm' : 'Lưu'}
            </button>
          </div>
        </div>
      )}

      {/* ── Filter tabs ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {filterTab('all', 'Tất cả', counts.all)}
        {SVC_TYPES.map(t => filterTab(t.value, `${t.icon} ${t.label}`, counts[t.value] || 0))}
      </div>

      {/* ── Danh sách ── */}
      {filtered.length === 0 ? (
        <div style={{ padding: '28px', textAlign: 'center', color: 'var(--tm)', fontSize: '0.82rem', background: 'var(--bgc)', borderRadius: 10, border: '1.5px solid var(--bd)' }}>
          {carriers.length === 0 ? 'Chưa có đơn vị nào. Bấm "+ Thêm mới".' : 'Không có đơn vị nào thuộc loại này.'}
        </div>
      ) : (
        <div style={{ background: 'var(--bgc)', borderRadius: 10, border: '1.5px solid var(--bd)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bgh)' }}>
                {['#', 'Tên đơn vị', 'SĐT', 'Loại dịch vụ', 'Đội xe', 'Trạng thái', ''].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => {
                const svc = SVC_TYPES.find(t => t.value === (c.serviceType || 'chi_van_chuyen'));
                const clr = SVC_COLOR[c.serviceType] || SVC_COLOR.chi_van_chuyen;
                const isExp = expanded === c.id;
                return (
                  <React.Fragment key={c.id}>
                    <tr style={{ background: i % 2 ? 'var(--bgs)' : '#fff', opacity: c.active ? 1 : 0.55 }}>
                      {/* Thứ tự ưu tiên */}
                      <td style={tdSt({ textAlign: 'center', width: 36 })}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', fontSize: '0.7rem', fontWeight: 800,
                          background: c.priority === 1 ? 'rgba(242,101,34,0.15)' : c.priority === 2 ? 'rgba(41,128,185,0.12)' : 'var(--bgs)',
                          color:      c.priority === 1 ? 'var(--ac)'             : c.priority === 2 ? '#2980b9'                : 'var(--tm)' }}>
                          {c.priority ?? 1}
                        </span>
                      </td>
                      <td style={tdSt({ fontWeight: 600, color: 'var(--br)' })}>
                        {svc?.icon} {c.name}
                      </td>
                      <td style={tdSt({ color: 'var(--ts)' })}>
                        {c.phone || <span style={{ color: 'var(--tm)', fontStyle: 'italic' }}>—</span>}
                      </td>
                      <td style={tdSt()}>
                        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.68rem', fontWeight: 700, background: clr.bg, color: clr.color }}>
                          {svc?.label}
                        </span>
                      </td>
                      <td style={tdSt()}>
                        {(c.vehicles || []).length === 0
                          ? <span style={{ color: 'var(--tm)', fontStyle: 'italic', fontSize: '0.74rem' }}>—</span>
                          : <button onClick={() => setExpanded(isExp ? null : c.id)}
                              style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid var(--bd)', background: 'transparent', cursor: 'pointer', fontSize: '0.72rem', color: 'var(--ts)' }}>
                              {c.vehicles.length} xe {isExp ? '▲' : '▼'}
                            </button>}
                      </td>
                      <td style={tdSt()}>
                        <button onClick={() => toggleActive(c)} style={{ padding: '2px 10px', borderRadius: 4, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.68rem',
                          background: c.active ? 'rgba(50,79,39,0.12)' : 'rgba(168,155,142,0.2)',
                          color: c.active ? 'var(--gn)' : 'var(--tm)' }}>
                          {c.active ? 'Đang dùng' : 'Tắt'}
                        </button>
                      </td>
                      <td style={tdSt({ whiteSpace: 'nowrap' })}>
                        <button onClick={() => openEdit(c)} style={{ padding: '3px 10px', borderRadius: 5, border: '1px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontSize: '0.72rem', marginRight: 6 }}>✏️ Sửa</button>
                        <button onClick={() => del(c)} style={{ padding: '3px 10px', borderRadius: 5, border: '1px solid var(--dg)', background: 'transparent', color: 'var(--dg)', cursor: 'pointer', fontSize: '0.72rem' }}>Xóa</button>
                      </td>
                    </tr>

                    {/* Expand: chi tiết xe */}
                    {isExp && (c.vehicles || []).length > 0 && (
                      <tr>
                        <td colSpan={7} style={{ padding: '0 16px 12px 48px', background: 'var(--bgs)', borderBottom: '1px solid var(--bd)' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem', marginTop: 8 }}>
                            <thead>
                              <tr style={{ background: 'var(--bgh)' }}>
                                {['Tên xe / Tải trọng', 'Kích thước thùng', 'Hàng hóa phù hợp', 'Đi tỉnh'].map(h => (
                                  <th key={h} style={{ padding: '5px 8px', textAlign: 'left', color: 'var(--brl)', fontWeight: 700, fontSize: '0.6rem', textTransform: 'uppercase', borderBottom: '1px solid var(--bds)' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {c.vehicles.map((v, vi) => (
                                <tr key={vi} style={{ background: vi % 2 ? 'var(--bgc)' : 'transparent' }}>
                                  <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--bd)', fontWeight: 600, color: 'var(--br)' }}>{v.name || '—'}</td>
                                  <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--bd)', color: 'var(--ts)' }}>{v.dimensions || '—'}</td>
                                  <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--bd)', color: 'var(--ts)' }}>{v.suitableCargo || '—'}</td>
                                  <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--bd)', textAlign: 'center' }}>
                                    {v.canGoProvince ? <span style={{ color: 'var(--gn)', fontWeight: 700 }}>✓</span> : <span style={{ color: 'var(--tm)' }}>—</span>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
