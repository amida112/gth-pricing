import React, { useState, useEffect, useRef } from "react";
import { ROLE_LABELS } from "../auth";

const NOTIF_ITEMS = [
  { key: 'sales', icon: '🛒', label: 'đơn hàng chờ duyệt', page: 'sales' },
  { key: 'pricing', icon: '💰', label: 'SKU có hàng chưa định giá', page: 'pricing' },
  { key: 'config', icon: '⚠️', label: 'cấu hình cần kiểm tra', page: 'config' },
  { key: 'devices', icon: '📱', label: 'thiết bị chờ duyệt', page: 'devices' },
];

export default function AppHeader({ user, onLogout, pg, setPg, useAPI, onMobileMenu, PAGE_LABELS, badges = {}, isAdmin }) {
  const roleInfo = user ? (ROLE_LABELS[user.role] || { text: user.role, color: 'var(--tm)', bg: 'var(--bgs)', icon: '👤' }) : null;

  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const notifRef = useRef(null);
  const userRef = useRef(null);

  // Đóng dropdown khi click ngoài
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (userRef.current && !userRef.current.contains(e.target)) { setUserOpen(false); setConfirmLogout(false); }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const totalBadge = isAdmin ? NOTIF_ITEMS.reduce((s, it) => s + (badges[it.key] || 0), 0) : 0;
  const activeNotifs = NOTIF_ITEMS.filter(it => (badges[it.key] || 0) > 0);

  const handleNotifClick = (page) => {
    setPg(page);
    setNotifOpen(false);
  };

  const handleLogoutClick = () => {
    if (!confirmLogout) { setConfirmLogout(true); return; }
    setUserOpen(false);
    setConfirmLogout(false);
    onLogout();
  };

  return (
    <header style={{ height: 52, background: "var(--bgc)", borderBottom: "1px solid var(--bd)", display: "flex", alignItems: "center", padding: "0 20px 0 14px", gap: 10, flexShrink: 0, position: "sticky", top: 0, zIndex: 100, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <button className="mobile-menu-btn" onClick={onMobileMenu} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "1.2rem", padding: "6px", lineHeight: 1, color: "var(--tp)", borderRadius: 6, flexShrink: 0 }}>☰</button>
      <div className="header-logo" style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
        <div style={{ width: 24, height: 24, borderRadius: 5, background: "var(--ac)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: "0.72rem" }}>G</div>
        <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--br)" }}>GTH Pricing</span>
      </div>
      <div style={{ flex: 1, fontSize: "0.82rem", fontWeight: 600, color: "var(--ts)", paddingLeft: 8, borderLeft: "1px solid var(--bd)" }}>
        {PAGE_LABELS[pg] || pg}
      </div>

      {/* Trạng thái kết nối */}
      <div style={{ padding: "3px 8px", borderRadius: 4, background: useAPI ? "rgba(50,79,39,0.08)" : "rgba(242,101,34,0.08)", border: useAPI ? "1px solid var(--gn)" : "1px solid var(--ac)", fontSize: "0.6rem", fontWeight: 600, color: useAPI ? "var(--gn)" : "var(--ac)", whiteSpace: "nowrap" }}>
        {useAPI ? "● Supabase" : "● Offline"}
      </div>

      {/* Notification bell */}
      {isAdmin && (
        <div ref={notifRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={() => { setNotifOpen(v => !v); setUserOpen(false); }}
            title="Thông báo"
            style={{ width: 32, height: 32, borderRadius: "50%", background: notifOpen ? "var(--bgs)" : "transparent", border: "1px solid transparent", cursor: "pointer", fontSize: "0.9rem", color: "var(--ts)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", transition: "all 0.12s" }}
          >
            🔔
            {totalBadge > 0 && (
              <span style={{ position: "absolute", top: -2, right: -4, minWidth: 16, height: 16, borderRadius: 8, background: "#e53935", color: "#fff", fontSize: "0.55rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", lineHeight: 1 }}>
                {totalBadge > 99 ? '99+' : totalBadge}
              </span>
            )}
          </button>

          {/* Notification dropdown */}
          {notifOpen && (
            <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, minWidth: 260, background: "var(--bgc)", border: "1px solid var(--bd)", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 200, overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--bd)", fontSize: "0.75rem", fontWeight: 700, color: "var(--tp)" }}>
                Cần xử lý
              </div>
              {activeNotifs.length === 0 ? (
                <div style={{ padding: "16px 14px", fontSize: "0.75rem", color: "var(--tm)", textAlign: "center" }}>
                  Không có mục nào cần xử lý
                </div>
              ) : (
                activeNotifs.map(it => (
                  <button
                    key={it.key}
                    onClick={() => handleNotifClick(it.page)}
                    style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 14px", background: "transparent", border: "none", cursor: "pointer", fontSize: "0.76rem", color: "var(--tp)", textAlign: "left", transition: "background 0.1s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--hv)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <span style={{ fontSize: "0.9rem", flexShrink: 0 }}>{it.icon}</span>
                    <span style={{ flex: 1 }}><b>{badges[it.key]}</b> {it.label}</span>
                    <span style={{ fontSize: "0.65rem", color: "var(--tm)" }}>→</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* User info + dropdown */}
      {user && roleInfo && (
        <div ref={userRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={() => { setUserOpen(v => !v); setNotifOpen(false); setConfirmLogout(false); }}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 6, background: userOpen ? "var(--bgs)" : roleInfo.bg, border: `1px solid ${roleInfo.color}22`, cursor: "pointer", transition: "all 0.12s" }}
          >
            <span style={{ fontSize: "0.76rem" }}>{roleInfo.icon}</span>
            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: roleInfo.color, whiteSpace: "nowrap" }}>{user.label}</span>
            <span style={{ fontSize: "0.55rem", color: roleInfo.color, opacity: 0.6, marginLeft: 2 }}>▾</span>
          </button>

          {/* User dropdown */}
          {userOpen && (
            <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, minWidth: 200, background: "var(--bgc)", border: "1px solid var(--bd)", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 200, overflow: "hidden" }}>
              {/* User info */}
              <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--bd)" }}>
                <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--tp)" }}>{user.label}</div>
                <div style={{ fontSize: "0.65rem", color: "var(--tm)", marginTop: 2 }}>@{user.username} · {roleInfo.text}</div>
              </div>

              {/* Logout button */}
              <div style={{ padding: 6 }}>
                <button
                  onClick={handleLogoutClick}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", background: confirmLogout ? "#fbe9e7" : "transparent", border: "none", cursor: "pointer", fontSize: "0.76rem", color: confirmLogout ? "#c62828" : "var(--tp)", borderRadius: 6, fontWeight: confirmLogout ? 700 : 400, transition: "all 0.12s" }}
                  onMouseEnter={e => { if (!confirmLogout) e.currentTarget.style.background = "var(--hv)"; }}
                  onMouseLeave={e => { if (!confirmLogout) e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{ fontSize: "0.85rem" }}>{confirmLogout ? '⚠️' : '⏻'}</span>
                  <span>{confirmLogout ? 'Nhấn lần nữa để xác nhận' : 'Đăng xuất'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
