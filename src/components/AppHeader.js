import React, { useState, useEffect, useRef } from "react";

const SV_KEY = 'gth_admin_sv';

export default function AppHeader({ role, setRole, pg, useAPI, onMobileMenu, PAGE_LABELS, notify }) {
  const [showLogin, setShowLogin] = useState(false);
  const [pw, setPw] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [logging, setLogging] = useState(false);

  // Đổi mật khẩu
  const [showChangePw, setShowChangePw] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [changing, setChanging] = useState(false);

  const popupRef = useRef(null);

  // Đóng popup khi click ngoài
  useEffect(() => {
    if (!showLogin && !showChangePw) return;
    const handle = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        setShowLogin(false); setShowChangePw(false);
        setPw(""); setPwErr(""); setNewPw(""); setNewPw2("");
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [showLogin, showChangePw]);

  // Poll session version mỗi 30s khi đang là admin
  useEffect(() => {
    if (role !== 'admin' || !useAPI) return;
    const check = async () => {
      try {
        const { fetchAdminSettings } = await import('../api.js');
        const settings = await fetchAdminSettings();
        if (!settings) return;
        const stored = localStorage.getItem(SV_KEY);
        if (stored && settings.session_version !== stored) {
          localStorage.removeItem(SV_KEY);
          setRole('viewer');
          notify('Phiên đăng nhập đã hết hạn', false);
        }
      } catch {}
    };
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, [role, useAPI, setRole, notify]);

  const tryLogin = async () => {
    if (!pw.trim()) return;
    setLogging(true);
    setPwErr("");
    try {
      if (useAPI) {
        const { fetchAdminSettings } = await import('../api.js');
        const settings = await fetchAdminSettings();
        if (!settings || !settings.admin_password) {
          // Fallback nếu chưa có settings trong DB
          if (pw === '0123') {
            doLogin('0');
          } else {
            setPwErr('Sai mật khẩu');
          }
        } else if (pw === settings.admin_password) {
          doLogin(settings.session_version || '0');
        } else {
          setPwErr('Sai mật khẩu');
        }
      } else {
        // Offline: dùng mật khẩu cứng
        if (pw === '0123') doLogin('0');
        else setPwErr('Sai mật khẩu');
      }
    } catch {
      setPwErr('Lỗi kết nối, thử lại');
    }
    setLogging(false);
  };

  const doLogin = (version) => {
    localStorage.setItem(SV_KEY, version);
    setRole('admin');
    setShowLogin(false);
    setPw('');
    setPwErr('');
    notify('Đã chuyển sang chế độ Admin', true);
  };

  const doLogout = () => {
    localStorage.removeItem(SV_KEY);
    setRole('viewer');
    notify('Đã thoát Admin', true);
  };

  const handleChangePw = async () => {
    if (!newPw.trim()) return;
    if (newPw !== newPw2) { notify('Mật khẩu xác nhận không khớp', false); return; }
    if (newPw.length < 4) { notify('Mật khẩu tối thiểu 4 ký tự', false); return; }
    setChanging(true);
    try {
      const { changeAdminPassword } = await import('../api.js');
      const r = await changeAdminPassword(newPw);
      if (r.error) { notify('Lỗi: ' + r.error, false); setChanging(false); return; }
      // Cập nhật session_version của session hiện tại
      localStorage.setItem(SV_KEY, r.version);
      setShowChangePw(false);
      setNewPw(''); setNewPw2('');
      notify('Đã đổi mật khẩu. Các session khác sẽ tự đăng xuất.', true);
    } catch (e) { notify('Lỗi: ' + e.message, false); }
    setChanging(false);
  };

  return (
    <header style={{ height: 52, background: "var(--bgc)", borderBottom: "1px solid var(--bd)", display: "flex", alignItems: "center", padding: "0 20px 0 14px", gap: 10, flexShrink: 0, position: "sticky", top: 0, zIndex: 100, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <button className="mobile-menu-btn" onClick={onMobileMenu} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "1.2rem", padding: "6px", lineHeight: 1, color: "var(--tp)", borderRadius: 6, flexShrink: 0 }}>☰</button>
      <div className="header-logo" style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
        <div style={{ width: 24, height: 24, borderRadius: 5, background: "var(--ac)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: "0.72rem" }}>G</div>
        <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--br)" }}>GTH Pricing</span>
      </div>
      <div style={{ flex: 1, fontSize: "0.82rem", fontWeight: 600, color: "var(--ts)", paddingLeft: 8, borderLeft: "1px solid var(--bd)" }}>{PAGE_LABELS[pg] || pg}</div>
      <div style={{ padding: "3px 8px", borderRadius: 4, background: useAPI ? "rgba(50,79,39,0.08)" : "rgba(242,101,34,0.08)", border: useAPI ? "1px solid var(--gn)" : "1px solid var(--ac)", fontSize: "0.6rem", fontWeight: 600, color: useAPI ? "var(--gn)" : "var(--ac)", whiteSpace: "nowrap" }}>
        {useAPI ? "● Supabase" : "● Offline"}
      </div>

      <div style={{ position: "relative" }} ref={popupRef}>
        {role === "admin" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--gn)", padding: "4px 10px", borderRadius: 6, background: "rgba(50,79,39,0.1)", border: "1px solid rgba(50,79,39,0.2)", whiteSpace: "nowrap" }}>🔑 Admin</span>
            {useAPI && (
              <button onClick={() => { setShowChangePw(p => !p); setShowLogin(false); }} title="Đổi mật khẩu"
                style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--bgs)", border: "1px solid var(--bds)", cursor: "pointer", fontSize: "0.76rem", color: "var(--ts)", display: "flex", alignItems: "center", justifyContent: "center" }}>🔒</button>
            )}
            <button onClick={doLogout} title="Thoát Admin"
              style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--bgs)", border: "1px solid var(--bds)", cursor: "pointer", fontSize: "0.72rem", color: "var(--ts)", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          </div>
        ) : (
          <button onClick={() => { setShowLogin(p => !p); setShowChangePw(false); }} title="Đăng nhập Admin"
            style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--ac)", border: "none", cursor: "pointer", color: "#fff", fontWeight: 800, fontSize: "0.88rem", display: "flex", alignItems: "center", justifyContent: "center" }}>A</button>
        )}

        {/* Popup đăng nhập */}
        {showLogin && (
          <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 230, background: "var(--bgc)", border: "1.5px solid var(--bd)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.14)", padding: 16, zIndex: 500 }}>
            <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--br)", marginBottom: 10 }}>🔑 Đăng nhập Admin</div>
            <input type="password" value={pw} onChange={e => { setPw(e.target.value); setPwErr(""); }}
              onKeyDown={e => e.key === "Enter" && tryLogin()} placeholder="Mật khẩu" autoFocus
              style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid " + (pwErr ? "var(--dg)" : "var(--bd)"), fontSize: "0.82rem", outline: "none", boxSizing: "border-box", marginBottom: pwErr ? 4 : 10 }} />
            {pwErr && <div style={{ fontSize: "0.65rem", color: "var(--dg)", marginBottom: 8 }}>{pwErr}</div>}
            <button onClick={tryLogin} disabled={logging} style={{ width: "100%", padding: "8px", borderRadius: 6, background: logging ? "var(--bd)" : "var(--ac)", color: logging ? "var(--tm)" : "#fff", border: "none", cursor: logging ? "not-allowed" : "pointer", fontWeight: 700, fontSize: "0.78rem" }}>
              {logging ? 'Đang kiểm tra...' : 'Đăng nhập'}
            </button>
          </div>
        )}

        {/* Popup đổi mật khẩu */}
        {showChangePw && (
          <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 250, background: "var(--bgc)", border: "1.5px solid var(--bd)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.14)", padding: 16, zIndex: 500 }}>
            <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--br)", marginBottom: 10 }}>🔒 Đổi mật khẩu Admin</div>
            <div style={{ fontSize: "0.66rem", color: "var(--tm)", marginBottom: 10, lineHeight: 1.5 }}>Sau khi đổi, tất cả thiết bị khác đang đăng nhập sẽ tự đăng xuất.</div>
            <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Mật khẩu mới" autoFocus
              style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid var(--bd)", fontSize: "0.82rem", outline: "none", boxSizing: "border-box", marginBottom: 8 }} />
            <input type="password" value={newPw2} onChange={e => setNewPw2(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleChangePw()} placeholder="Xác nhận mật khẩu"
              style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid var(--bd)", fontSize: "0.82rem", outline: "none", boxSizing: "border-box", marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => { setShowChangePw(false); setNewPw(''); setNewPw2(''); }} style={{ flex: 1, padding: "7px", borderRadius: 6, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.76rem" }}>Hủy</button>
              <button onClick={handleChangePw} disabled={changing || !newPw.trim()} style={{ flex: 1, padding: "7px", borderRadius: 6, background: changing || !newPw.trim() ? "var(--bd)" : "var(--ac)", color: changing || !newPw.trim() ? "var(--tm)" : "#fff", border: "none", cursor: changing || !newPw.trim() ? "not-allowed" : "pointer", fontWeight: 700, fontSize: "0.76rem" }}>
                {changing ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
