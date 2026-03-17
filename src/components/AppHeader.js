import React from "react";
import { ROLE_LABELS } from "../auth";

export default function AppHeader({ user, onLogout, pg, useAPI, onMobileMenu, PAGE_LABELS }) {
  const roleInfo = user ? (ROLE_LABELS[user.role] || { text: user.role, color: 'var(--tm)', bg: 'var(--bgs)', icon: '👤' }) : null;

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

      {/* User info + Logout */}
      {user && roleInfo && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 6, background: roleInfo.bg, border: `1px solid ${roleInfo.color}22` }}>
            <span style={{ fontSize: "0.76rem" }}>{roleInfo.icon}</span>
            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: roleInfo.color, whiteSpace: "nowrap" }}>{user.label}</span>
            <span style={{ fontSize: "0.6rem", color: roleInfo.color, opacity: 0.7, whiteSpace: "nowrap", display: "none" }} className="header-username">({user.username})</span>
          </div>
          <button
            onClick={onLogout}
            title="Đăng xuất"
            style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--bgs)", border: "1px solid var(--bds)", cursor: "pointer", fontSize: "0.72rem", color: "var(--ts)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
          >⏻</button>
        </div>
      )}
    </header>
  );
}
