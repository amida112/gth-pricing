import React, { useState, useEffect, useCallback } from "react";
import { fmtDate, fmtDateTime } from "../utils";
import { fetchDeviceCodes, addDeviceCode, updateDeviceCode, revokeDeviceCode, deleteDeviceCode, fetchLoginHistory, fetchUserLoginHistory, saveDeviceSetting } from "../api/devices";
import { hashPassword } from "../auth";
import { audit } from "../utils/auditHelper";
import Dialog from "../components/Dialog";
import useTableSort from "../useTableSort";

const APPS = [
  { key: 'gth-pricing', label: 'GTH Pricing', icon: '📊', settingKey: 'restriction_gth_pricing', color: '#7C3AED', bg: '#F3E8FF' },
  { key: 'wood-measure', label: 'Đo gỗ', icon: '📐', settingKey: 'restriction_wood_measure', color: '#1D4ED8', bg: '#DBEAFE' },
];

const STATUS_LABELS = {
  available: { text: 'Chưa dùng', color: '#6B7280', bg: '#F3F4F6' },
  active: { text: 'Đang dùng', color: '#059669', bg: '#D1FAE5' },
  revoked: { text: 'Đã thu hồi', color: '#DC2626', bg: '#FEE2E2' },
};

const COLS = 8;

export default function PgDevices({ deviceSettings, setDeviceSettings, useAPI, notify, currentUser }) {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterApp, setFilterApp] = useState('gth-pricing');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const { sortField, sortDir, toggleSort, sortIcon, applySort } = useTableSort('created_at', 'desc');

  // Dialog states
  const [addDlg, setAddDlg] = useState(false);
  const [editDlg, setEditDlg] = useState(null); // device_code object
  const [delDlg, setDelDlg] = useState(null);
  const [historyDlg, setHistoryDlg] = useState(null); // { deviceCodeId, label }
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Form
  const [fmCode, setFmCode] = useState('');
  const [fmLabel, setFmLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const isRestrictionOn = (appKey) => {
    const app = APPS.find(a => a.key === appKey);
    if (!app?.settingKey) return false;
    const v = deviceSettings[app.settingKey];
    return v === true || v === 'true';
  };

  const loadCodes = useCallback(async () => {
    if (!useAPI) return;
    try { setCodes(await fetchDeviceCodes()); } catch { notify('Lỗi tải danh sách mã thiết bị', false); }
    setLoading(false);
  }, [useAPI, notify]);

  useEffect(() => { loadCodes(); }, [loadCodes]);

  // Filter + sort
  const filtered = codes.filter(d => {
    if (d.app_source !== filterApp) return false;
    if (filterStatus && d.status !== filterStatus) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!d.code.toLowerCase().includes(s) && !(d.device_label || '').toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const sorted = applySort(filtered, (a, b, field, dir) => {
    const m = dir === 'asc' ? 1 : -1;
    const va = a[field] || '';
    const vb = b[field] || '';
    if (field === 'activated_at' || field === 'created_at') return m * (new Date(va || 0) - new Date(vb || 0));
    return m * String(va).localeCompare(String(vb), 'vi');
  });

  // Toggle restriction
  const handleToggleRestriction = async () => {
    const app = APPS.find(a => a.key === filterApp);
    if (!app?.settingKey) return;
    const newVal = !isRestrictionOn(filterApp);
    const res = await saveDeviceSetting(app.settingKey, newVal, currentUser?.username);
    if (res.error) { notify(res.error, false); return; }
    setDeviceSettings(prev => ({ ...prev, [app.settingKey]: newVal }));
    audit(currentUser?.username, 'devices', newVal ? 'enable' : 'disable', `Kiểm soát ${app.label}: ${newVal ? 'BẬT' : 'TẮT'}`);
    notify(`${app.label}: ${newVal ? 'Đã bật kiểm soát' : 'Đã tắt kiểm soát'}`);
  };

  // Add
  const handleAdd = async () => {
    const code = fmCode.trim();
    if (!code) { notify('Vui lòng nhập mã', false); return; }
    setSaving(true);
    const codeHash = await hashPassword(code);
    const res = await addDeviceCode(code, codeHash, fmLabel.trim(), filterApp);
    setSaving(false);
    if (res.error) { notify(res.error, false); return; }
    audit(currentUser?.username, 'devices', 'add_code', `Thêm mã: ${code} (${filterApp})`);
    notify('Đã thêm mã thiết bị');
    setAddDlg(false); setFmCode(''); setFmLabel('');
    loadCodes();
  };

  // Edit
  const openEdit = (d) => { setFmCode(d.code); setFmLabel(d.device_label || ''); setEditDlg(d); };
  const handleEdit = async () => {
    const code = fmCode.trim();
    if (!code) { notify('Vui lòng nhập mã', false); return; }
    setSaving(true);
    const codeChanged = code !== editDlg.code;
    const codeHash = codeChanged ? await hashPassword(code) : undefined;
    const res = await updateDeviceCode(editDlg.id, code, codeHash, fmLabel.trim());
    setSaving(false);
    if (res.error) { notify(res.error, false); return; }
    audit(currentUser?.username, 'devices', 'update_code', `Sửa mã: ${editDlg.code}${codeChanged ? ` → ${code}` : ''}`);
    notify(codeChanged ? 'Đã đổi mã — thiết bị cũ sẽ bị logout' : 'Đã cập nhật');
    setEditDlg(null); setFmCode(''); setFmLabel('');
    loadCodes();
  };

  // Revoke
  const handleRevoke = async (d) => {
    const res = await revokeDeviceCode(d.id);
    if (res.error) { notify(res.error, false); return; }
    setCodes(prev => prev.map(x => x.id === d.id ? { ...x, status: 'revoked' } : x));
    audit(currentUser?.username, 'devices', 'revoke', `Thu hồi mã: ${d.code}`);
    notify('Đã thu hồi — thiết bị sẽ bị logout');
  };

  // Delete
  const handleDelete = async (d) => {
    const res = await deleteDeviceCode(d.id);
    if (res.error) { notify(res.error, false); return; }
    setCodes(prev => prev.filter(x => x.id !== d.id));
    audit(currentUser?.username, 'devices', 'delete_code', `Xóa mã: ${d.code}`);
    notify('Đã xóa mã');
    setDelDlg(null);
  };

  // History
  const openHistory = async (d) => {
    setHistoryDlg({ deviceCodeId: d.id, label: d.device_label || d.code });
    setHistoryLoading(true);
    const data = await fetchLoginHistory(d.id);
    setHistoryData(data);
    setHistoryLoading(false);
  };

  // Stats
  const selectedApp = APPS.find(a => a.key === filterApp);
  const activeCount = filtered.filter(d => d.status === 'active').length;
  const availableCount = filtered.filter(d => d.status === 'available').length;
  const revokedCount = filtered.filter(d => d.status === 'revoked').length;
  const appCountMap = {};
  APPS.forEach(a => { appCountMap[a.key] = codes.filter(d => d.app_source === a.key).length; });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--br)' }}>Quản lý thiết bị</h2>
      </div>

      {/* App Picker */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {APPS.map(a => {
          const active = filterApp === a.key;
          return (
            <button key={a.key} onClick={() => setFilterApp(a.key)} style={{
              padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem',
              border: active ? '2px solid var(--ac)' : '1.5px solid var(--bd)',
              background: active ? 'var(--ac)' : 'var(--bgc)', color: active ? '#fff' : 'var(--tp)',
              transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span>{a.icon}</span><span>{a.label}</span>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '1px 7px', borderRadius: 10, background: active ? 'rgba(255,255,255,0.25)' : 'var(--bgs)', color: active ? '#fff' : 'var(--tm)' }}>{appCountMap[a.key] || 0}</span>
            </button>
          );
        })}

        {selectedApp?.settingKey && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 8, background: 'var(--bgc)', border: '1px solid var(--bd)' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--tm)' }}>Kiểm soát:</span>
            <button onClick={handleToggleRestriction} style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: isRestrictionOn(filterApp) ? '#059669' : 'var(--bd)', position: 'relative', transition: 'background 0.2s' }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: isRestrictionOn(filterApp) ? 23 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
            </button>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: isRestrictionOn(filterApp) ? '#059669' : 'var(--tm)' }}>{isRestrictionOn(filterApp) ? 'BẬT' : 'TẮT'}</span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Tổng mã', value: filtered.length, color: 'var(--br)' },
          { label: 'Đang dùng', value: activeCount, color: '#059669' },
          { label: 'Chưa dùng', value: availableCount, color: '#6B7280' },
          { label: 'Đã thu hồi', value: revokedCount, color: '#DC2626' },
        ].map(c => (
          <div key={c.label} style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid var(--bd)', background: 'var(--bgc)', minWidth: 80 }}>
            <div style={{ fontSize: '0.66rem', color: 'var(--tm)', fontWeight: 600 }}>{c.label}</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Actions bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => { setFmCode(''); setFmLabel(''); setAddDlg(true); }} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: 'var(--ac)', color: '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>+ Thêm mã</button>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm mã, tên thiết bị..." style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--bd)', fontSize: '0.82rem', outline: 'none', background: 'var(--bgc)', width: 250, maxWidth: '100%' }} />
      </div>

      {/* Table */}
      {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--tm)' }}>Đang tải...</div> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 36 }} />
            <col style={{ width: 120 }} />
            <col />
            <col style={{ width: 85 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 120 }} />
          </colgroup>
          <thead>
            <tr style={{ background: 'var(--bgs)' }}>
              <td style={{ padding: '5px 6px' }} />
              <td style={{ padding: '5px 6px' }} />
              <td style={{ padding: '5px 6px' }} />
              <td style={{ padding: '5px 6px' }}>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: '100%', fontSize: '0.74rem', padding: '4px 6px', borderRadius: 4, border: '1px solid var(--bd)', outline: 'none' }}>
                  <option value="">Tất cả</option>
                  <option value="available">Chưa dùng</option>
                  <option value="active">Đang dùng</option>
                  <option value="revoked">Đã thu hồi</option>
                </select>
              </td>
              <td style={{ padding: '5px 6px' }} />
              <td style={{ padding: '5px 6px' }} />
              <td style={{ padding: '5px 6px' }} />
              <td style={{ padding: '5px 6px' }} />
            </tr>
            <tr>
              <th style={{ padding: '8px 6px', fontSize: '0.72rem', fontWeight: 700, textAlign: 'center', borderBottom: '2px solid var(--bd)', color: 'var(--tm)' }}>STT</th>
              <th onClick={() => toggleSort('code')} style={{ padding: '8px 6px', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', borderBottom: '2px solid var(--bd)', whiteSpace: 'nowrap' }}>Mã{sortIcon('code')}</th>
              <th onClick={() => toggleSort('device_label')} style={{ padding: '8px 6px', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', borderBottom: '2px solid var(--bd)' }}>Tên thiết bị{sortIcon('device_label')}</th>
              <th onClick={() => toggleSort('status')} style={{ padding: '8px 6px', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', borderBottom: '2px solid var(--bd)', whiteSpace: 'nowrap' }}>Trạng thái{sortIcon('status')}</th>
              <th style={{ padding: '8px 6px', fontSize: '0.74rem', fontWeight: 700, borderBottom: '2px solid var(--bd)', whiteSpace: 'nowrap' }}>Thiết bị</th>
              <th onClick={() => toggleSort('activated_at')} style={{ padding: '8px 6px', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', borderBottom: '2px solid var(--bd)', whiteSpace: 'nowrap' }}>Kích hoạt{sortIcon('activated_at')}</th>
              <th onClick={() => toggleSort('created_at')} style={{ padding: '8px 6px', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', borderBottom: '2px solid var(--bd)', whiteSpace: 'nowrap' }}>Ngày tạo{sortIcon('created_at')}</th>
              <th style={{ padding: '8px 6px', fontSize: '0.74rem', fontWeight: 700, borderBottom: '2px solid var(--bd)', whiteSpace: 'nowrap', textAlign: 'center' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && <tr><td colSpan={COLS} style={{ padding: 30, textAlign: 'center', color: 'var(--tm)', fontSize: '0.82rem' }}>Chưa có mã nào</td></tr>}
            {sorted.map((d, i) => {
              const st = STATUS_LABELS[d.status] || STATUS_LABELS.available;
              const info = d.device_info || {};
              const shortUA = info.user_agent ? (info.user_agent.includes('iPhone') ? 'iPhone' : info.user_agent.includes('Android') ? 'Android' : info.user_agent.includes('Windows') ? 'Windows' : info.user_agent.includes('Mac') ? 'Mac' : '—') : '—';
              return (
                <tr key={d.id} data-clickable="true" style={{ borderBottom: '1px solid var(--bd)' }}>
                  <td style={{ padding: '7px 6px', fontSize: '0.68rem', textAlign: 'center', color: 'var(--tm)' }}>{i + 1}</td>
                  <td style={{ padding: '7px 6px', fontSize: '0.82rem', fontWeight: 700, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{d.code}</td>
                  <td style={{ padding: '7px 6px', fontSize: '0.8rem', color: d.device_label ? 'var(--tp)' : 'var(--tm)', fontStyle: d.device_label ? 'normal' : 'italic' }}>{d.device_label || '—'}</td>
                  <td style={{ padding: '7px 6px', whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700, color: st.color, background: st.bg }}>{st.text}</span>
                  </td>
                  <td style={{ padding: '7px 6px', fontSize: '0.72rem', color: 'var(--tm)' }}>
                    {d.status === 'active' ? <span title={info.user_agent || ''}>{shortUA}{info.ip ? ` · ${info.ip}` : ''}</span> : '—'}
                  </td>
                  <td style={{ padding: '7px 6px', fontSize: '0.74rem', color: 'var(--tm)', whiteSpace: 'nowrap' }}>{d.activated_at ? fmtDate(d.activated_at) : '—'}</td>
                  <td style={{ padding: '7px 6px', fontSize: '0.74rem', color: 'var(--tm)', whiteSpace: 'nowrap' }}>{fmtDate(d.created_at)}</td>
                  <td style={{ padding: '7px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <button onClick={() => openHistory(d)} title="Lịch sử" style={{ padding: '3px 6px', borderRadius: 4, border: '1px solid var(--bd)', background: 'var(--bgc)', fontSize: '0.7rem', cursor: 'pointer', color: 'var(--tm)', marginRight: 3 }}>📋</button>
                    <button onClick={() => openEdit(d)} title="Sửa" style={{ padding: '3px 6px', borderRadius: 4, border: '1px solid var(--bd)', background: 'var(--bgc)', fontSize: '0.7rem', cursor: 'pointer', color: 'var(--tm)', marginRight: 3 }}>✏️</button>
                    {d.status === 'active' && <button onClick={() => handleRevoke(d)} title="Thu hồi" style={{ padding: '3px 6px', borderRadius: 4, border: 'none', background: '#DC2626', color: '#fff', fontWeight: 700, fontSize: '0.7rem', cursor: 'pointer', marginRight: 3 }}>Thu hồi</button>}
                    <button onClick={() => setDelDlg(d)} title="Xóa" style={{ padding: '3px 6px', borderRadius: 4, border: '1px solid var(--bd)', background: 'var(--bgc)', fontSize: '0.7rem', cursor: 'pointer', color: 'var(--tm)' }}>🗑️</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Add Dialog */}
      <Dialog open={addDlg} onClose={() => setAddDlg(false)} onOk={handleAdd} title="Thêm mã thiết bị" width={420} okLabel={saving ? 'Đang lưu...' : 'Thêm'} showFooter>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--brl)', display: 'block', marginBottom: 4 }}>Mã thiết bị *</label>
            <input value={fmCode} onChange={e => setFmCode(e.target.value)} placeholder="VD: Laptop-Kho-1" style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--bd)', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} autoFocus />
          </div>
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--brl)', display: 'block', marginBottom: 4 }}>Tên thiết bị</label>
            <input value={fmLabel} onChange={e => setFmLabel(e.target.value)} placeholder="VD: Laptop văn phòng kho" style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--bd)', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--tm)', lineHeight: 1.5 }}>
            Mã sẽ được mã hóa khi lưu vào thiết bị. Admin nhập mã này trực tiếp trên thiết bị cần kích hoạt.
          </div>
        </div>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editDlg} onClose={() => setEditDlg(null)} onOk={handleEdit} title="Sửa mã thiết bị" width={420} okLabel={saving ? 'Đang lưu...' : 'Lưu'} showFooter>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--brl)', display: 'block', marginBottom: 4 }}>Mã thiết bị *</label>
            <input value={fmCode} onChange={e => setFmCode(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--bd)', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--brl)', display: 'block', marginBottom: 4 }}>Tên thiết bị</label>
            <input value={fmLabel} onChange={e => setFmLabel(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--bd)', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          {editDlg?.status === 'active' && fmCode !== editDlg?.code && (
            <div style={{ padding: '8px 10px', borderRadius: 6, background: '#FEF3C7', border: '1px solid #F59E0B', fontSize: '0.76rem', color: '#92400E', lineHeight: 1.5 }}>
              Đổi mã sẽ khiến thiết bị đang dùng bị logout. Cần nhập mã mới trên thiết bị.
            </div>
          )}
        </div>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!delDlg} onClose={() => setDelDlg(null)} onOk={() => handleDelete(delDlg)} title="Xóa mã thiết bị" width={400} okLabel="Xóa" showFooter>
        {delDlg && <div style={{ fontSize: '0.85rem', lineHeight: 1.6 }}>Xóa mã <strong>{delDlg.code}</strong> ({delDlg.device_label || 'chưa đặt tên'})?{delDlg.status === 'active' && <><br /><span style={{ color: '#DC2626', fontWeight: 600 }}>Thiết bị đang dùng mã này sẽ bị logout.</span></>}</div>}
      </Dialog>

      {/* History Dialog */}
      <Dialog open={!!historyDlg} onClose={() => setHistoryDlg(null)} title={`Lịch sử: ${historyDlg?.label || ''}`} width={560}>
        {historyLoading ? <div style={{ padding: 20, textAlign: 'center', color: 'var(--tm)' }}>Đang tải...</div> : (
          historyData.length === 0 ? <div style={{ padding: 20, textAlign: 'center', color: 'var(--tm)', fontSize: '0.82rem' }}>Chưa có lịch sử đăng nhập</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead><tr>
                <th style={{ padding: '6px', borderBottom: '1px solid var(--bd)', textAlign: 'left' }}>User</th>
                <th style={{ padding: '6px', borderBottom: '1px solid var(--bd)', textAlign: 'left' }}>Thời gian</th>
                <th style={{ padding: '6px', borderBottom: '1px solid var(--bd)', textAlign: 'left' }}>Vị trí / IP</th>
              </tr></thead>
              <tbody>
                {historyData.map(h => (
                  <tr key={h.id} style={{ borderBottom: '1px solid var(--bd)' }}>
                    <td style={{ padding: '5px 6px', fontWeight: 600 }}>{h.username}</td>
                    <td style={{ padding: '5px 6px', color: 'var(--tm)', whiteSpace: 'nowrap' }}>{fmtDateTime(h.logged_in_at)}</td>
                    <td style={{ padding: '5px 6px', color: 'var(--tm)' }}>{[h.city, h.region].filter(Boolean).join(', ')}{h.ip_address ? ` · ${h.ip_address}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </Dialog>
    </div>
  );
}
