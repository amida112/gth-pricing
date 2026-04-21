import React, { useState, useRef, useEffect } from "react";
import { USERS, ROLE_LABELS, hashPassword } from "../auth";
import { THEME } from "../utils";
import { verifyDeviceCode, logDeviceLogin } from "../api/devices";

const DEVICE_CODE_KEY = 'gth_device_code_hash';

export default function Login({ onLogin, dynamicUsers = [], deviceRestrictionEnabled = false }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [deviceBlocked, setDeviceBlocked] = useState(false); // thiết bị chưa kích hoạt
  const userRef = useRef(null);

  useEffect(() => { userRef.current?.focus(); }, []);

  const findUser = (uname) => {
    if (USERS[uname]) return USERS[uname];
    const dyn = dynamicUsers.find(u => u.username === uname);
    if (dyn && dyn.active !== false) return dyn;
    return null;
  };

  // Lấy IP/geo (best effort)
  const getGeo = async () => {
    try {
      const res = await fetch('http://ip-api.com/json/?fields=query,city,regionName,country', { signal: AbortSignal.timeout(3000) });
      const j = await res.json();
      return { ip: j.query || '', city: j.city || '', region: j.regionName || '', country: j.country || '' };
    } catch { return { ip: '', city: '', region: '', country: '' }; }
  };

  const handleLogin = async () => {
    const uname = username.trim();
    if (!uname || !password) { setErr('Vui lòng nhập đầy đủ thông tin'); return; }
    setLoading(true);
    setErr('');
    setDeviceBlocked(false);
    try {
      const user = findUser(uname);
      const hash = await hashPassword(password);
      if (!user || hash !== user.passwordHash) {
        setErr('Tên đăng nhập hoặc mật khẩu không đúng');
        setPassword('');
        setLoading(false);
        return;
      }

      // SuperAdmin bypass
      if (user.role === 'superadmin' || !deviceRestrictionEnabled) {
        onLogin({ username: uname, role: user.role, label: user.label });
        // Ghi lịch sử nếu có device code
        const savedHash = localStorage.getItem(DEVICE_CODE_KEY);
        if (savedHash) {
          verifyDeviceCode(savedHash, 'gth-pricing').then(r => {
            if (r.id) getGeo().then(geo => logDeviceLogin(r.id, uname, 'gth-pricing', geo)).catch(() => {});
          }).catch(() => {});
        }
        return;
      }

      // Device code check
      const savedHash = localStorage.getItem(DEVICE_CODE_KEY);
      if (!savedHash) {
        setDeviceBlocked(true);
        setLoading(false);
        return;
      }

      const result = await verifyDeviceCode(savedHash, 'gth-pricing');
      if (result.status === 'active') {
        // Ghi lịch sử đăng nhập
        getGeo().then(geo => logDeviceLogin(result.id, uname, 'gth-pricing', geo)).catch(() => {});
        onLogin({ username: uname, role: user.role, label: user.label });
      } else {
        // Mã không còn hợp lệ (revoked/đổi mã)
        localStorage.removeItem(DEVICE_CODE_KEY);
        setDeviceBlocked(true);
        setLoading(false);
      }
    } catch {
      setErr('Lỗi xác thực, vui lòng thử lại');
      setLoading(false);
    }
  };

  const foundUser = findUser(username.trim());
  const roleInfo = foundUser?.role ? ROLE_LABELS[foundUser.role] : null;

  return (
    <div style={{ ...THEME, minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ width: 360, maxWidth: '90vw' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--ac)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '1.4rem', marginBottom: 12, boxShadow: '0 4px 16px rgba(242,101,34,0.3)' }}>G</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--br)' }}>GTH Pricing</div>
          <div style={{ fontSize: '0.76rem', color: 'var(--tm)', marginTop: 4 }}>Hệ thống quản lý giá & kho gỗ</div>
        </div>

        <div style={{ background: 'var(--bgc)', borderRadius: 16, border: '1.5px solid var(--bd)', padding: 28, boxShadow: '0 8px 32px rgba(45,32,22,0.1)' }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--br)', marginBottom: 20 }}>Đăng nhập</div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--brl)', textTransform: 'uppercase', marginBottom: 5 }}>Tên đăng nhập</label>
            <div style={{ position: 'relative' }}>
              <input ref={userRef} type="text" value={username} onChange={e => { setUsername(e.target.value); setErr(''); }} onKeyDown={e => e.key === 'Enter' && document.getElementById('gth-pw-input')?.focus()} placeholder="Nhập tên đăng nhập" autoComplete="username" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid ' + (err ? 'var(--dg)' : 'var(--bd)'), fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box', background: 'var(--bg)', transition: 'border-color 0.15s' }} />
              {roleInfo && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: '0.65rem', fontWeight: 700, color: roleInfo.color, background: roleInfo.bg, padding: '2px 7px', borderRadius: 4 }}>{roleInfo.icon} {roleInfo.text}</span>}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--brl)', textTransform: 'uppercase', marginBottom: 5 }}>Mật khẩu</label>
            <div style={{ position: 'relative' }}>
              <input id="gth-pw-input" type={showPw ? 'text' : 'password'} value={password} onChange={e => { setPassword(e.target.value); setErr(''); }} onKeyDown={e => e.key === 'Enter' && handleLogin()} placeholder="Nhập mật khẩu" autoComplete="current-password" style={{ width: '100%', padding: '10px 38px 10px 12px', borderRadius: 8, border: '1.5px solid ' + (err ? 'var(--dg)' : 'var(--bd)'), fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box', background: 'var(--bg)' }} />
              <button type="button" onClick={() => setShowPw(p => !p)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--tm)', fontSize: '0.8rem', padding: 2, lineHeight: 1 }}>{showPw ? '🙈' : '👁'}</button>
            </div>
            {err && <div style={{ fontSize: '0.68rem', color: 'var(--dg)', marginTop: 5, fontWeight: 600 }}>⚠️ {err}</div>}
          </div>

          <button onClick={handleLogin} disabled={loading} style={{ width: '100%', padding: '11px', borderRadius: 8, border: 'none', background: loading ? 'var(--bd)' : 'var(--ac)', color: loading ? 'var(--tm)' : '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.88rem', transition: 'background 0.15s' }}>
            {loading ? 'Đang xác thực...' : 'Đăng nhập'}
          </button>

          {deviceBlocked && (
            <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 8, background: '#FEE2E2', border: '1px solid #EF4444', fontSize: '0.78rem', color: '#991B1B', lineHeight: 1.5 }}>
              <strong>Thiết bị chưa được kích hoạt</strong><br />
              Liên hệ quản trị viên để nhập mã kích hoạt cho thiết bị này.
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: '0.64rem', color: 'var(--tm)' }}>GTH Pricing — Nội bộ</div>
      </div>
    </div>
  );
}
