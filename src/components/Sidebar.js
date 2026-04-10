import React, { useState } from "react";

export default function Sidebar({ pg, setPg, mobileOpen, onMobileClose, allowedPages, manageUsers, badges = {} }) {
  const [collapsed, setCollapsed] = useState(false);
  const [groupOpen, setGroupOpen] = useState({ "HỆ THỐNG": true, "KINH DOANH": true, "KHO HÀNG": true, "BÁN HÀNG": true, "NHÂN SỰ": true, "NHẬP HÀNG": true, "DANH MỤC": true });

  const menu = [
    { group: "KINH DOANH", items: [{ id: "dashboard", ic: "🏠", lb: "Tổng quan" }, { id: "pricing", ic: "📊", lb: "Bảng giá" }] },
    { group: "KHO HÀNG", items: [
      { id: "warehouse", ic: "🪚", lb: "Gỗ kiện" },
      { id: "raw_wood", ic: "🪵", lb: "Gỗ tròn" },
      { id: "sawing",   ic: "🪛", lb: "Xẻ gỗ" },
      { id: "kiln",     ic: "🔥", lb: "Lò sấy" },
      { id: "edging",   ic: "📐", lb: "Dong cạnh" },
    ] },
    { group: "BÁN HÀNG", items: [
      { id: "sales", ic: "🛒", lb: "Đơn hàng" },
      { id: "customers", ic: "👥", lb: "Khách hàng" },
      { id: "carriers", ic: "🚛", lb: "Đơn vị vận tải" },
      { id: "reconciliation", ic: "🏦", lb: "Đối soát" }
    ] },
    { group: "NHÂN SỰ", items: [
      { id: "employees", ic: "👤", lb: "Nhân viên" },
      { id: "attendance", ic: "📅", lb: "Chấm công" },
      { id: "payroll", ic: "💰", lb: "Bảng lương" },
    ] },
    { group: "NHẬP HÀNG", items: [
      { id: "shipments", ic: "📦", lb: "Lô hàng & Container" }
    ] },
    { group: "DANH MỤC", items: [
      { id: "wood_types", ic: "🌳", lb: "Loại gỗ" },
      { id: "attributes", ic: "📋", lb: "Thuộc tính" },
      { id: "config", ic: "⚙️", lb: "Cấu hình" },
      { id: "sku", ic: "🏷️", lb: "SKU" },
      { id: "suppliers", ic: "🏭", lb: "Nhà cung cấp" }
    ] },
    { group: "HỆ THỐNG", items: [
      { id: "users", ic: "👤", lb: "Tài khoản" },
      { id: "perm_groups", ic: "🔐", lb: "Nhóm quyền" },
      { id: "permissions", ic: "🛡️", lb: "Phân quyền" },
      { id: "audit_log", ic: "📋", lb: "Nhật ký" },
    ] },
  ];

  const toggleGroup = (g) => setGroupOpen(p => ({ ...p, [g]: !p[g] }));

  return (
    <>
      {/* Mobile overlay backdrop */}
      {mobileOpen && <div className="mob-overlay" onClick={onMobileClose} />}

      <div className={"sidebar" + (mobileOpen ? " mob-open" : "")} style={{ width: collapsed ? 52 : 200, minHeight: "100vh", background: "var(--sb)", display: "flex", flexDirection: "column", flexShrink: 0, transition: "width 0.2s ease", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "16px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 8, justifyContent: collapsed ? "center" : "space-between", minHeight: 56 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: "var(--ac)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: "0.85rem", flexShrink: 0 }}>G</div>
            {!collapsed && <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#FAF6F0", whiteSpace: "nowrap" }}>GTH Pricing</div>}
          </div>
          {!collapsed && (
            <button className="sb-collapse-btn" onClick={() => setCollapsed(true)} title="Thu gọn" style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.35)", cursor: "pointer", fontSize: "0.8rem", padding: "2px 4px", borderRadius: 4, lineHeight: 1 }}>◀</button>
          )}
          {/* Nút đóng drawer trên mobile */}
          <button className="sb-close-btn" onClick={onMobileClose} style={{ display: "none", background: "transparent", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: "1.1rem", padding: "4px 6px", lineHeight: 1, marginLeft: "auto" }}>✕</button>
        </div>

        {/* Expand button khi collapsed */}
        {collapsed && (
          <button className="sb-expand-btn" onClick={() => setCollapsed(false)} title="Mở rộng" style={{ margin: "8px auto", background: "transparent", border: "none", color: "rgba(255,255,255,0.35)", cursor: "pointer", fontSize: "0.8rem", padding: "4px", borderRadius: 4, display: "block" }}>▶</button>
        )}

        {/* Menu */}
        <div style={{ flex: 1, padding: "8px 0", overflowY: "auto", overflowX: "hidden" }}>
          {menu.map(g => {
            const adminPages = ['users', 'perm_groups', 'permissions', 'audit_log'];
            const visibleItems = (allowedPages ? g.items.filter(it => allowedPages.includes(it.id)) : g.items).filter(it => !adminPages.includes(it.id) || manageUsers);
            if (visibleItems.length === 0) return null;
            const open = groupOpen[g.group] !== false;
            return (
              <div key={g.group} style={{ marginBottom: 4 }}>
                {/* Group header */}
                {!collapsed ? (
                  <button onClick={() => toggleGroup(g.group)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "4px 16px", background: "transparent", border: "none", cursor: "pointer", marginBottom: 2 }}>
                    <span style={{ fontSize: "0.55rem", fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{g.group}</span>
                    <span style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.25)", transition: "transform 0.15s", display: "inline-block", transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}>▼</span>
                  </button>
                ) : (
                  <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "6px 8px" }} />
                )}

                {/* Menu items */}
                {(collapsed || open) && g.items.filter(it => (!allowedPages || allowedPages.includes(it.id)) && (!adminPages.includes(it.id) || manageUsers)).map(it => {
                  const active = pg === it.id;
                  return (
                    <button key={it.id} onClick={() => { setPg(it.id); onMobileClose?.(); }} title={collapsed ? it.lb : undefined}
                      style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: collapsed ? "10px 0" : "8px 16px", justifyContent: collapsed ? "center" : "flex-start", background: active ? "rgba(242,101,34,0.15)" : "transparent", border: "none", borderLeft: collapsed ? "none" : (active ? "3px solid var(--ac)" : "3px solid transparent"), borderRight: collapsed && active ? "3px solid var(--ac)" : "none", color: active ? "#FAF6F0" : "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: collapsed ? "1rem" : "0.78rem", fontWeight: active ? 700 : 500, textAlign: "left", position: "relative" }}>
                      <span style={{ position: "relative" }}>
                        {it.ic}
                        {collapsed && badges[it.id] > 0 && (
                          <span style={{ position: "absolute", top: -4, right: -6, minWidth: 14, height: 14, borderRadius: 7, background: "#FF9800", color: "#fff", fontSize: "0.5rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px", lineHeight: 1 }}>{badges[it.id]}</span>
                        )}
                      </span>
                      {!collapsed && <span style={{ flex: 1 }}>{it.lb}</span>}
                      {!collapsed && badges[it.id] > 0 && (
                        <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: "#FF9800", color: "#fff", fontSize: "0.6rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", lineHeight: 1, marginLeft: "auto" }}>{badges[it.id]}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

      </div>
    </>
  );
}
