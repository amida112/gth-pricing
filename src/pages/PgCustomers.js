import React, { useState, useMemo } from "react";

const EMPTY_FORM = { salutation: '', name: '', dob: '', address: '', deliveryAddress: '', phone1: '', phone2: '', companyName: '', interestedWoodTypes: [], productDescription: '', debtLimit: '0', debtDays: '30', notes: '' };

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

function CustomerForm({ initial, wts, onSave, onCancel }) {
  const [fm, setFm] = useState(initial || EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [errs, setErrs] = useState({});
  const f = (k) => (v) => setFm(p => ({ ...p, [k]: v }));
  const inp = (label, key, opts = {}) => (
    <div style={{ flex: opts.full ? '1 1 100%' : '1 1 220px' }}>
      <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: 'var(--brl)', marginBottom: 4, textTransform: 'uppercase' }}>{label}{opts.req && ' *'}</label>
      <input value={fm[key] ?? ''} onChange={e => { f(key)(e.target.value); setErrs(p => ({ ...p, [key]: '' })); }} placeholder={opts.ph || ''} type={opts.type || 'text'}
        style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1.5px solid ' + (errs[key] ? 'var(--dg)' : 'var(--bd)'), fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box', background: 'var(--bg)' }} />
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
  return (
    <div style={{ maxWidth: 760, background: 'var(--bgc)', borderRadius: 12, border: '1.5px solid var(--bd)', padding: 24 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        {/* Cách xưng hô */}
        <div style={{ flex: '1 1 100%' }}>
          <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: 'var(--brl)', marginBottom: 6, textTransform: 'uppercase' }}>Cách xưng hô</label>
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
        {inp('Địa chỉ', 'address', { req: true, full: false, ph: 'Tỉnh/thành phố' })}
        {inp('Địa chỉ nhận hàng chi tiết', 'deliveryAddress', { ph: 'Số nhà, đường, phường...' })}
        {inp('Tên công ty', 'companyName', { ph: '(nếu có)' })}
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: 'var(--brl)', marginBottom: 6, textTransform: 'uppercase' }}>Loại gỗ quan tâm</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {wts.map(w => { const sel = fm.interestedWoodTypes.includes(w.id); return (
            <button key={w.id} onClick={() => toggleWood(w.id)} style={{ padding: '4px 10px', borderRadius: 5, border: sel ? '1.5px solid var(--ac)' : '1.5px solid var(--bd)', background: sel ? 'var(--acbg)' : 'transparent', color: sel ? 'var(--ac)' : 'var(--ts)', cursor: 'pointer', fontSize: '0.76rem', fontWeight: sel ? 700 : 500 }}>{w.icon} {w.name}</button>
          ); })}
        </div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: 'var(--brl)', marginBottom: 4, textTransform: 'uppercase' }}>Sản phẩm công ty khách làm</label>
        <textarea value={fm.productDescription} onChange={e => f('productDescription')(e.target.value)} rows={2} placeholder="Mô tả loại sản phẩm..."
          style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1.5px solid var(--bd)', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', background: 'var(--bg)' }} />
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ flex: '1 1 160px' }}>
          <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: 'var(--brl)', marginBottom: 4, textTransform: 'uppercase' }}>Trần công nợ (đ)</label>
          <NumInput value={fm.debtLimit} onChange={n => f('debtLimit')(n)} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1.5px solid var(--bd)', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box', background: 'var(--bg)' }} />
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: 'var(--brl)', marginBottom: 4, textTransform: 'uppercase' }}>Hạn công nợ (ngày)</label>
          <input type="number" min="0" value={fm.debtDays} onChange={e => f('debtDays')(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1.5px solid var(--bd)', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box', background: 'var(--bg)' }} />
        </div>
        <div style={{ flex: '1 1 240px' }}>
          <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: 'var(--brl)', marginBottom: 4, textTransform: 'uppercase' }}>Ghi chú</label>
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

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const s = search.toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(s) || c.phone1.includes(s) || c.address.toLowerCase().includes(s) || (c.customerCode || '').toLowerCase().includes(s) || (c.companyName || '').toLowerCase().includes(s));
  }, [customers, search]);

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
      <div style={{ marginBottom: 10 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Tìm tên, SĐT, địa chỉ, mã KH..."
          style={{ width: '100%', maxWidth: 400, padding: '7px 12px', borderRadius: 7, border: '1.5px solid var(--bd)', fontSize: '0.82rem', outline: 'none' }} />
      </div>
      <div style={{ background: 'var(--bgc)', borderRadius: 10, border: '1px solid var(--bd)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead><tr>
              {['Mã KH', 'Xưng hô & Tên', 'Địa chỉ', 'Điện thoại', 'Công ty', 'Loại gỗ QT', 'Công nợ', ''].map(h => <th key={h} style={ths}>{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 30, textAlign: 'center', color: 'var(--tm)' }}>{customers.length === 0 ? 'Chưa có khách hàng nào.' : 'Không tìm thấy.'}</td></tr>
              ) : filtered.map((c, i) => (
                <tr key={c.id} style={{ background: i % 2 ? 'var(--bgs)' : '#fff', cursor: onSelectCustomer ? 'pointer' : 'default' }}
                  onClick={() => onSelectCustomer?.(c)}>
                  <td style={{ ...tds, fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--tm)' }}>{c.customerCode}</td>
                  <td style={{ ...tds, fontWeight: 700, color: 'var(--br)' }}>
                    {c.salutation && <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--ac)', marginRight: 4, background: 'var(--acbg)', padding: '1px 5px', borderRadius: 3 }}>{c.salutation}</span>}
                    {c.name}
                    {c.dob && <span style={{ fontSize: '0.7rem', color: 'var(--tm)', fontWeight: 500, marginLeft: 5 }}>{new Date(c.dob).toLocaleDateString('vi-VN')}</span>}
                  </td>
                  <td style={{ ...tds, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.address}</td>
                  <td style={tds}>{c.phone1}{c.phone2 && <div style={{ fontSize: '0.7rem', color: 'var(--tm)' }}>{c.phone2}</div>}</td>
                  <td style={tds}>{c.companyName || '—'}</td>
                  <td style={tds}>{c.interestedWoodTypes?.length ? c.interestedWoodTypes.length + ' loại' : '—'}</td>
                  <td style={{ ...tds, color: c.debtLimit > 0 ? 'var(--ac)' : 'var(--tm)' }}>{c.debtLimit > 0 ? c.debtLimit.toLocaleString('vi-VN') + ' đ' : '—'}</td>
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
