import React, { useState, useEffect, useCallback } from "react";
import { fmtDate, fmtDateTime } from "../utils";
import { fetchDevices, approveDevice, approveDevicesBatch, blockDevice, deleteDevice, updateDeviceName, saveDeviceSetting } from "../api/devices";
import { audit } from "../utils/auditHelper";
import Dialog from "../components/Dialog";
import ComboFilter from '../components/ComboFilter';
import useTableSort from "../useTableSort";

const STATUS_LABELS = {
  pending: { text: 'Chờ duyệt', color: '#D97706', bg: '#FEF3C7' },
  approved: { text: 'Đã duyệt', color: '#059669', bg: '#D1FAE5' },
  blocked: { text: 'Đã chặn', color: '#DC2626', bg: '#FEE2E2' },
};

const APPS = [
  { key: 'gth-pricing', label: 'GTH Pricing', icon: '📊', settingKey: 'restriction_gth_pricing', color: '#7C3AED', bg: '#F3E8FF' },
  { key: 'wood-measure', label: 'Đo gỗ', icon: '📐', settingKey: 'restriction_wood_measure', color: '#1D4ED8', bg: '#DBEAFE' },
];

const COLS = 9;

export default function PgDevices({ deviceSettings, setDeviceSettings, useAPI, notify, currentUser }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterApp, setFilterApp] = useState('gth-pricing');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterOS, setFilterOS] = useState('');
  const [search, setSearch] = useState('');
  const [editNameId, setEditNameId] = useState(null);
  const [editNameVal, setEditNameVal] = useState('');
  const [delConfirm, setDelConfirm] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const { sortField, sortDir, toggleSort, sortIcon, applySort } = useTableSort('created_at', 'desc');

  // Restriction riêng per app
  const isRestrictionOn = (appKey) => {
    const app = APPS.find(a => a.key === appKey);
    if (!app?.settingKey) return false;
    const v = deviceSettings[app.settingKey];
    return v === true || v === 'true';
  };

  const loadDevices = useCallback(async () => {
    if (!useAPI) return;
    try { setDevices(await fetchDevices()); } catch { notify('Lỗi tải danh sách thiết bị', false); }
    setLoading(false);
  }, [useAPI, notify]);

  useEffect(() => { loadDevices(); }, [loadDevices]);

  // Filter + sort
  const filtered = devices.filter(d => {
    if (filterApp && (d.app_source || 'gth-pricing') !== filterApp) return false;
    if (filterStatus && d.status !== filterStatus) return false;
    if (filterUser && d.username !== filterUser) return false;
    if (filterName && !(d.device_name || '').toLowerCase().includes(filterName.toLowerCase())) return false;
    if (filterOS && !(d.os || '').toLowerCase().includes(filterOS.toLowerCase())) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!d.username.toLowerCase().includes(s) && !(d.device_name || '').toLowerCase().includes(s) && !(d.user_agent || '').toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const sorted = applySort(filtered, (a, b, field, dir) => {
    const m = dir === 'asc' ? 1 : -1;
    const va = a[field] || '';
    const vb = b[field] || '';
    if (field === 'last_seen_at' || field === 'created_at') return m * (new Date(va) - new Date(vb));
    return m * String(va).localeCompare(String(vb), 'vi');
  });

  const uniqueUsers = [...new Set(filtered.map(d => d.username))].sort();

  // Toggle restriction per app
  const handleToggleRestriction = async (appKey) => {
    const app = APPS.find(a => a.key === appKey);
    if (!app?.settingKey) return;
    const newVal = !isRestrictionOn(appKey);
    const res = await saveDeviceSetting(app.settingKey, newVal, currentUser?.username);
    if (res.error) { notify(res.error, false); return; }
    setDeviceSettings(prev => ({ ...prev, [app.settingKey]: newVal }));
    audit(currentUser?.username, 'devices', newVal ? 'enable' : 'disable', `Kiểm soát ${app.label}: ${newVal ? 'BẬT' : 'TẮT'}`);
    notify(`${app.label}: ${newVal ? 'Đã bật kiểm soát' : 'Đã tắt kiểm soát'}`);
  };

  // Approve
  const handleApprove = async (d) => {
    const res = await approveDevice(d.id, currentUser?.username);
    if (res.error) { notify(res.error, false); return; }
    setDevices(prev => prev.map(x => x.id === d.id ? { ...x, status: 'approved', approved_by: currentUser?.username, approved_at: new Date().toISOString() } : x));
    audit(currentUser?.username, 'devices', 'approve', `Duyệt thiết bị: ${d.username} — ${d.device_name || d.fingerprint.slice(0, 8)}`);
    notify('Đã duyệt thiết bị');
  };

  const handleApproveBatch = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    const res = await approveDevicesBatch(ids, currentUser?.username);
    if (res.error) { notify(res.error, false); return; }
    setDevices(prev => prev.map(x => ids.includes(x.id) ? { ...x, status: 'approved', approved_by: currentUser?.username, approved_at: new Date().toISOString() } : x));
    setSelected(new Set());
    audit(currentUser?.username, 'devices', 'approve_batch', `Duyệt hàng loạt ${ids.length} thiết bị`);
    notify(`Đã duyệt ${ids.length} thiết bị`);
  };

  const handleBlock = async (d) => {
    const res = await blockDevice(d.id);
    if (res.error) { notify(res.error, false); return; }
    setDevices(prev => prev.map(x => x.id === d.id ? { ...x, status: 'blocked' } : x));
    audit(currentUser?.username, 'devices', 'block', `Chặn thiết bị: ${d.username} — ${d.device_name || d.fingerprint.slice(0, 8)}`);
    notify('Đã chặn thiết bị');
  };

  const handleDelete = async (d) => {
    const res = await deleteDevice(d.id);
    if (res.error) { notify(res.error, false); return; }
    setDevices(prev => prev.filter(x => x.id !== d.id));
    setSelected(prev => { const s = new Set(prev); s.delete(d.id); return s; });
    audit(currentUser?.username, 'devices', 'delete', `Xóa thiết bị: ${d.username} — ${d.device_name || d.fingerprint.slice(0, 8)}`);
    notify('Đã xóa thiết bị');
    setDelConfirm(null);
  };

  const handleSaveName = async (d) => {
    const res = await updateDeviceName(d.id, editNameVal.trim());
    if (res.error) { notify(res.error, false); return; }
    setDevices(prev => prev.map(x => x.id === d.id ? { ...x, device_name: editNameVal.trim() } : x));
    setEditNameId(null);
  };

  const toggleSelect = (id) => setSelected(prev => {
    const s = new Set(prev);
    if (s.has(id)) s.delete(id); else s.add(id);
    return s;
  });
  const toggleSelectAll = () => {
    const pendingIds = sorted.filter(d => d.status === 'pending').map(d => d.id);
    if (pendingIds.every(id => selected.has(id))) setSelected(new Set());
    else setSelected(new Set(pendingIds));
  };

  const shortUA = (ua) => {
    if (!ua) return '—';
    if (ua.includes('Mobile')) return ua.includes('iPhone') || ua.includes('iPad') ? 'iOS' : 'Android';
    if (ua.includes('Windows')) return 'Windows';
    if (ua.includes('Mac OS')) return 'macOS';
    if (ua.includes('Linux')) return 'Linux';
    return ua.slice(0, 20) + '…';
  };

  // Stats theo filter hiện tại
  const pendingCount = filtered.filter(d => d.status === 'pending').length;
  const approvedCount = filtered.filter(d => d.status === 'approved').length;
  const blockedCount = filtered.filter(d => d.status === 'blocked').length;

  // App đang chọn (để hiện toggle)
  const selectedApp = APPS.find(a => a.key === filterApp);
  const appCountMap = {};
  APPS.forEach(a => { appCountMap[a.key] = devices.filter(d => (d.app_source || 'gth-pricing') === a.key).length; });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--br)' }}>Quản lý thiết bị</h2>
      </div>

      {/* App Picker */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {APPS.map(a => {
          const active = filterApp === a.key;
          const count = appCountMap[a.key] || 0;
          return (
            <button
              key={a.key}
              onClick={() => { setFilterApp(a.key); setSelected(new Set()); }}
              style={{
                padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem',
                border: active ? '2px solid var(--ac)' : '1.5px solid var(--bd)',
                background: active ? 'var(--ac)' : 'var(--bgc)',
                color: active ? '#fff' : 'var(--tp)',
                transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <span>{a.icon}</span>
              <span>{a.label}</span>
              <span style={{
                fontSize: '0.7rem', fontWeight: 800, padding: '1px 7px', borderRadius: 10,
                background: active ? 'rgba(255,255,255,0.25)' : 'var(--bgs)',
                color: active ? '#fff' : 'var(--tm)',
              }}>{count}</span>
            </button>
          );
        })}

        {/* Toggle restriction — chỉ hiện khi chọn 1 app cụ thể */}
        {selectedApp?.settingKey && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 8, background: 'var(--bgc)', border: '1px solid var(--bd)' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--tm)' }}>Kiểm soát {selectedApp.label}:</span>
            <button
              onClick={() => handleToggleRestriction(filterApp)}
              style={{
                width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                background: isRestrictionOn(filterApp) ? '#059669' : 'var(--bd)', position: 'relative', transition: 'background 0.2s',
              }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3,
                left: isRestrictionOn(filterApp) ? 23 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </button>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: isRestrictionOn(filterApp) ? '#059669' : 'var(--tm)' }}>
              {isRestrictionOn(filterApp) ? 'BẬT' : 'TẮT'}
            </span>
          </div>
        )}
      </div>

      {/* Stats cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Tổng', value: filtered.length, color: 'var(--br)' },
          { label: 'Chờ duyệt', value: pendingCount, color: '#D97706' },
          { label: 'Đã duyệt', value: approvedCount, color: '#059669' },
          { label: 'Đã chặn', value: blockedCount, color: '#DC2626' },
        ].map(c => (
          <div key={c.label} style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid var(--bd)', background: 'var(--bgc)', minWidth: 80 }}>
            <div style={{ fontSize: '0.66rem', color: 'var(--tm)', fontWeight: 600 }}>{c.label}</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Info banner khi restriction tắt */}
      {selectedApp?.settingKey && !isRestrictionOn(filterApp) && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: '#FEF3C7', border: '1px solid #F59E0B', fontSize: '0.78rem', color: '#92400E', marginBottom: 16, lineHeight: 1.5 }}>
          <strong>Chế độ thu thập ({selectedApp.label}):</strong> Kiểm soát đang tắt. Hệ thống ghi nhận thiết bị khi đăng nhập nhưng không chặn. Bật kiểm soát khi đã duyệt đủ thiết bị.
        </div>
      )}

      {/* Batch actions */}
      {selected.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: 'var(--bgs)', border: '1px solid var(--bd)' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Đã chọn {selected.size} thiết bị</span>
          <button onClick={handleApproveBatch} style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: '#059669', color: '#fff', fontWeight: 700, fontSize: '0.74rem', cursor: 'pointer' }}>Duyệt tất cả</button>
          <button onClick={() => setSelected(new Set())} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--bd)', background: 'var(--bgc)', fontWeight: 600, fontSize: '0.74rem', cursor: 'pointer', color: 'var(--tm)' }}>Bỏ chọn</button>
        </div>
      )}

      {/* Search */}
      <div style={{ marginBottom: 12 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Tìm kiếm theo tên user, tên thiết bị..."
          style={{ width: 300, maxWidth: '100%', padding: '7px 12px', borderRadius: 8, border: '1px solid var(--bd)', fontSize: '0.82rem', outline: 'none', background: 'var(--bgc)' }}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--tm)' }}>Đang tải...</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 36 }} />
            <col style={{ width: 32 }} />
            <col style={{ width: 100 }} />
            <col />
            <col style={{ width: 80 }} />
            <col style={{ width: 65 }} />
            <col style={{ width: 140 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 100 }} />
          </colgroup>
          <thead>
            <tr style={{ background: 'var(--bgs)' }}>
              <td style={{ padding: '5px 4px' }} />
              <td style={{ padding: '5px 4px' }} />
              <td style={{ padding: '5px 4px' }}><ComboFilter value={filterUser} onChange={v => setFilterUser(v)} options={uniqueUsers} placeholder="Tài khoản" /></td>
              <td style={{ padding: '5px 4px' }}><ComboFilter value={filterName || ''} onChange={v => setFilterName(v)} options={[...new Set(devices.map(d => d.device_name).filter(Boolean))].sort()} placeholder="Tên TB" /></td>
              <td style={{ padding: '5px 4px' }}><ComboFilter value={filterStatus ? ({ pending: 'Chờ duyệt', approved: 'Đã duyệt', blocked: 'Đã chặn' }[filterStatus] || filterStatus) : ''} onChange={v => { const m = { 'Chờ duyệt': 'pending', 'Đã duyệt': 'approved', 'Đã chặn': 'blocked' }; setFilterStatus(m[v] || ''); }} options={['Chờ duyệt', 'Đã duyệt', 'Đã chặn']} placeholder="Trạng thái" /></td>
              <td style={{ padding: '5px 4px' }}><ComboFilter value={filterOS || ''} onChange={v => setFilterOS(v)} options={[...new Set(devices.map(d => d.os).filter(Boolean))].sort()} placeholder="OS" /></td>
              <td style={{ padding: '5px 4px' }} />
              <td style={{ padding: '5px 4px' }} />
              <td style={{ padding: '5px 4px' }} />
            </tr>
            <tr>
              <th style={{ padding: '8px 6px', fontSize: '0.72rem', fontWeight: 700, textAlign: 'center', borderBottom: '2px solid var(--bd)', color: 'var(--tm)' }}>STT</th>
              <th style={{ padding: '8px 4px', borderBottom: '2px solid var(--bd)', textAlign: 'center' }}>
                <input type="checkbox" checked={sorted.filter(d => d.status === 'pending').length > 0 && sorted.filter(d => d.status === 'pending').every(d => selected.has(d.id))} onChange={toggleSelectAll} title="Chọn tất cả pending" style={{ cursor: 'pointer' }} />
              </th>
              <th onClick={() => toggleSort('username')} style={{ padding: '8px 6px', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', borderBottom: '2px solid var(--bd)', whiteSpace: 'nowrap' }}>Tài khoản{sortIcon('username')}</th>
              <th onClick={() => toggleSort('device_name')} style={{ padding: '8px 6px', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', borderBottom: '2px solid var(--bd)' }}>Tên thiết bị{sortIcon('device_name')}</th>
              <th onClick={() => toggleSort('status')} style={{ padding: '8px 6px', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', borderBottom: '2px solid var(--bd)', whiteSpace: 'nowrap' }}>Trạng thái{sortIcon('status')}</th>
              <th style={{ padding: '8px 6px', fontSize: '0.74rem', fontWeight: 700, borderBottom: '2px solid var(--bd)', whiteSpace: 'nowrap' }}>OS</th>
              <th style={{ padding: '8px 6px', fontSize: '0.74rem', fontWeight: 700, borderBottom: '2px solid var(--bd)', whiteSpace: 'nowrap' }}>Vị trí / IP</th>
              <th onClick={() => toggleSort('last_seen_at')} style={{ padding: '8px 6px', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', borderBottom: '2px solid var(--bd)', whiteSpace: 'nowrap' }}>Lần cuối{sortIcon('last_seen_at')}</th>
              <th style={{ padding: '8px 6px', fontSize: '0.74rem', fontWeight: 700, borderBottom: '2px solid var(--bd)', whiteSpace: 'nowrap', textAlign: 'center' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={COLS} style={{ padding: 30, textAlign: 'center', color: 'var(--tm)', fontSize: '0.82rem' }}>Chưa có thiết bị nào được ghi nhận</td></tr>
            )}
            {sorted.map((d, i) => {
              const st = STATUS_LABELS[d.status] || STATUS_LABELS.pending;
              const isEditing = editNameId === d.id;
              return (
                <tr key={d.id} data-clickable="true" style={{ borderBottom: '1px solid var(--bd)' }}>
                  <td style={{ padding: '7px 6px', fontSize: '0.68rem', textAlign: 'center', color: 'var(--tm)' }}>{i + 1}</td>
                  <td style={{ padding: '7px 4px', textAlign: 'center' }}>
                    {d.status === 'pending' && <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggleSelect(d.id)} style={{ cursor: 'pointer' }} />}
                  </td>
                  <td style={{ padding: '7px 6px', fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{d.username}</td>
                  <td style={{ padding: '7px 6px', fontSize: '0.8rem' }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input value={editNameVal} onChange={e => setEditNameVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSaveName(d); if (e.key === 'Escape') setEditNameId(null); }} autoFocus style={{ flex: 1, padding: '3px 6px', borderRadius: 4, border: '1px solid var(--ac)', fontSize: '0.78rem', outline: 'none' }} placeholder="VD: Laptop VP, ĐT anh Đại..." />
                        <button onClick={() => handleSaveName(d)} style={{ padding: '2px 8px', borderRadius: 4, border: 'none', background: 'var(--ac)', color: '#fff', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 700 }}>OK</button>
                        <button onClick={() => setEditNameId(null)} style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid var(--bd)', background: 'var(--bgc)', fontSize: '0.7rem', cursor: 'pointer', color: 'var(--tm)' }}>Hủy</button>
                      </div>
                    ) : (
                      <span onClick={() => { setEditNameId(d.id); setEditNameVal(d.device_name || ''); }} style={{ cursor: 'pointer', color: d.device_name ? 'var(--tp)' : 'var(--tm)', fontStyle: d.device_name ? 'normal' : 'italic' }} title="Click để đặt tên thiết bị">
                        {d.device_name || 'Chưa đặt tên — click để sửa'}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '7px 6px', whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700, color: st.color, background: st.bg }}>{st.text}</span>
                  </td>
                  <td style={{ padding: '7px 6px', fontSize: '0.74rem', color: 'var(--tm)', whiteSpace: 'nowrap' }} title={d.user_agent || ''}>{shortUA(d.user_agent)}</td>
                  <td style={{ padding: '7px 6px', fontSize: '0.72rem', color: 'var(--tm)', overflow: 'hidden', textOverflow: 'ellipsis' }} title={[d.city, d.region, d.country, d.ip_address].filter(Boolean).join(', ')}>
                    {d.city || d.region ? <span>{[d.city, d.region].filter(Boolean).join(', ')}</span> : null}
                    {d.ip_address ? <div style={{ fontSize: '0.66rem', color: 'var(--tm)', opacity: 0.7 }}>{d.ip_address}</div> : null}
                    {!d.city && !d.region && !d.ip_address ? '—' : null}
                  </td>
                  <td style={{ padding: '7px 6px', fontSize: '0.74rem', color: 'var(--tm)', whiteSpace: 'nowrap' }} title={d.last_seen_at ? fmtDateTime(d.last_seen_at) : ''}>{d.last_seen_at ? fmtDate(d.last_seen_at) : '—'}</td>
                  <td style={{ padding: '7px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {d.status === 'pending' && <button onClick={() => handleApprove(d)} title="Duyệt" style={{ padding: '3px 8px', borderRadius: 4, border: 'none', background: '#059669', color: '#fff', fontWeight: 700, fontSize: '0.7rem', cursor: 'pointer', marginRight: 4 }}>Duyệt</button>}
                    {d.status === 'approved' && <button onClick={() => handleBlock(d)} title="Chặn" style={{ padding: '3px 8px', borderRadius: 4, border: 'none', background: '#DC2626', color: '#fff', fontWeight: 700, fontSize: '0.7rem', cursor: 'pointer', marginRight: 4 }}>Chặn</button>}
                    {d.status === 'blocked' && <button onClick={() => handleApprove(d)} title="Bỏ chặn" style={{ padding: '3px 8px', borderRadius: 4, border: 'none', background: '#059669', color: '#fff', fontWeight: 700, fontSize: '0.7rem', cursor: 'pointer', marginRight: 4 }}>Bỏ chặn</button>}
                    <button onClick={() => setDelConfirm(d)} title="Xóa" style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid var(--bd)', background: 'var(--bgc)', fontWeight: 600, fontSize: '0.7rem', cursor: 'pointer', color: 'var(--tm)' }}>Xóa</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <Dialog open={!!delConfirm} onClose={() => setDelConfirm(null)} onOk={() => handleDelete(delConfirm)} title="Xác nhận xóa thiết bị" width={400} okLabel="Xóa" showFooter>
        {delConfirm && (
          <div style={{ fontSize: '0.85rem', lineHeight: 1.6 }}>
            Xóa thiết bị <strong>{delConfirm.device_name || delConfirm.fingerprint.slice(0, 8)}</strong> của <strong>{delConfirm.username}</strong>?<br />
            <span style={{ color: 'var(--tm)', fontSize: '0.78rem' }}>User sẽ cần đăng ký lại nếu đăng nhập từ thiết bị này.</span>
          </div>
        )}
      </Dialog>
    </div>
  );
}
