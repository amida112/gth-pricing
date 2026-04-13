import React, { useState, useRef, useEffect } from "react";
import { USERS, ROLE_LABELS, hashPassword } from "../auth";
import { THEME } from "../utils";
import { getDeviceFingerprint, getDeviceToken, saveDeviceToken, getIpGeoLocation } from "../utils/deviceFingerprint";
import { checkDevice, registerDevice, updateDeviceLastSeen } from "../api/devices";

export default function Login({ onLogin, dynamicUsers = [], deviceRestrictionEnabled = false }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState(null); // 'pending' | 'blocked'
  const userRef = useRef(null);

  useEffect(() => { userRef.current?.focus(); }, []);

  // Lookup user trong cả hardcode lẫn dynamic
  const findUser = (uname) => {
    if (USERS[uname]) return USERS[uname];
    const dyn = dynamicUsers.find(u => u.username === uname);
    if (dyn && dyn.active !== false) return dyn;
    return null;
  };

  const handleLogin = async () => {
    const uname = username.trim();
    if (!uname || !password) { setErr('Vui lòng nhập đầy đủ thông tin'); return; }
    setLoading(true);
    setErr('');
    setDeviceStatus(null);
    try {
      const user = findUser(uname);
      const hash = await hashPassword(password);
      if (!user || hash !== user.passwordHash) {
        setErr('Tên đăng nhập hoặc mật khẩu không đúng');
        setPassword('');
        setLoading(false);
        return;
      }

      // Lấy fingerprint + device token + IP/geo song song
      const [fp, geo] = await Promise.all([
        getDeviceFingerprint().catch(() => null),
        getIpGeoLocation().catch(() => ({ ip: '', city: '', region: '', country: '', lat: null, lon: null })),
      ]);
      const existingToken = getDeviceToken();

      // SuperAdmin bypass device check
      if (user.role === 'superadmin' || !deviceRestrictionEnabled) {
        // Vẫn đăng ký thiết bị (thu thập) nhưng không chặn
        if (fp) {
          registerDevice(uname, fp, navigator.userAgent, geo, user.id).then(res => {
            if (res.device_token) saveDeviceToken(res.device_token);
          }).catch(() => {});
        }
        onLogin({ username: uname, role: user.role, label: user.label, deviceFingerprint: fp });
        return;
      }

      // Restriction ON mà không lấy được fingerprint → chặn
      if (!fp) {
        setErr('Không thể xác định thiết bị. Vui lòng thử lại.');
        setLoading(false);
        return;
      }

      const result = await checkDevice(uname, fp, existingToken);

      if (result.status === 'approved') {
        // Lưu device token (nếu chưa có hoặc khác)
        if (result.device_token) saveDeviceToken(result.device_token);
        // Cập nhật last seen + IP/geo
        updateDeviceLastSeen(result.id, geo.ip, geo).catch(() => {});
        onLogin({ username: uname, role: user.role, label: user.label, deviceFingerprint: fp });
      } else if (result.status === 'pending') {
        setDeviceStatus('pending');
        setLoading(false);
      } else if (result.status === 'blocked') {
        setDeviceStatus('blocked');
        setLoading(false);
      } else {
        // unknown → auto-register với geo
        const regResult = await registerDevice(uname, fp, navigator.userAgent, geo, user.id);
        if (regResult.device_token) saveDeviceToken(regResult.device_token);
        setDeviceStatus('pending');
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
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--ac)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '1.4rem', marginBottom: 12, boxShadow: '0 4px 16px rgba(242,101,34,0.3)' }}>G</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--br)' }}>GTH Pricing</div>
          <div style={{ fontSize: '0.76rem', color: 'var(--tm)', marginTop: 4 }}>Hệ thống quản lý giá & kho gỗ</div>
        </div>

        {/* Form */}
        <div style={{ background: 'var(--bgc)', borderRadius: 16, border: '1.5px solid var(--bd)', padding: 28, boxShadow: '0 8px 32px rgba(45,32,22,0.1)' }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--br)', marginBottom: 20 }}>Đăng nhập</div>

          {/* Username */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--brl)', textTransform: 'uppercase', marginBottom: 5 }}>Tên đăng nhập</label>
            <div style={{ position: 'relative' }}>
              <input
                ref={userRef}
                type="text"
                value={username}
                onChange={e => { setUsername(e.target.value); setErr(''); }}
                onKeyDown={e => e.key === 'Enter' && document.getElementById('gth-pw-input')?.focus()}
                placeholder="Nhập tên đăng nhập"
                autoComplete="username"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid ' + (err ? 'var(--dg)' : 'var(--bd)'), fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box', background: 'var(--bg)', transition: 'border-color 0.15s' }}
              />
              {roleInfo && (
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: '0.65rem', fontWeight: 700, color: roleInfo.color, background: roleInfo.bg, padding: '2px 7px', borderRadius: 4 }}>
                  {roleInfo.icon} {roleInfo.text}
                </span>
              )}
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--brl)', textTransform: 'uppercase', marginBottom: 5 }}>Mật khẩu</label>
            <div style={{ position: 'relative' }}>
              <input
                id="gth-pw-input"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setErr(''); }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="Nhập mật khẩu"
                autoComplete="current-password"
                style={{ width: '100%', padding: '10px 38px 10px 12px', borderRadius: 8, border: '1.5px solid ' + (err ? 'var(--dg)' : 'var(--bd)'), fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box', background: 'var(--bg)' }}
              />
              <button
                type="button"
                onClick={() => setShowPw(p => !p)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--tm)', fontSize: '0.8rem', padding: 2, lineHeight: 1 }}
              >{showPw ? '🙈' : '👁'}</button>
            </div>
            {err && <div style={{ fontSize: '0.68rem', color: 'var(--dg)', marginTop: 5, fontWeight: 600 }}>⚠️ {err}</div>}
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{ width: '100%', padding: '11px', borderRadius: 8, border: 'none', background: loading ? 'var(--bd)' : 'var(--ac)', color: loading ? 'var(--tm)' : '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.88rem', transition: 'background 0.15s' }}
          >
            {loading ? 'Đang xác thực...' : 'Đăng nhập'}
          </button>

          {/* Device status messages */}
          {deviceStatus === 'pending' && (
            <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 8, background: '#FEF3C7', border: '1px solid #F59E0B', fontSize: '0.78rem', color: '#92400E', lineHeight: 1.5 }}>
              <strong>Thiết bị chưa được phê duyệt</strong><br />
              Thiết bị này đã được ghi nhận và đang chờ quản trị viên phê duyệt. Vui lòng liên hệ admin.
            </div>
          )}
          {deviceStatus === 'blocked' && (
            <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 8, background: '#FEE2E2', border: '1px solid #EF4444', fontSize: '0.78rem', color: '#991B1B', lineHeight: 1.5 }}>
              <strong>Thiết bị đã bị chặn</strong><br />
              Thiết bị này không được phép truy cập hệ thống. Liên hệ quản trị viên nếu cần hỗ trợ.
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: '0.64rem', color: 'var(--tm)' }}>
          GTH Pricing — Nội bộ
        </div>
      </div>
    </div>
  );
}
