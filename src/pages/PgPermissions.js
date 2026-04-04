import React, { useState, useEffect, useCallback } from "react";

// ===== ĐỊNH NGHĨA MA TRẬN QUYỀN THEO MODULE =====
const PERMISSION_MODULES = [
  {
    id: 'dashboard', label: 'Tổng quan', icon: '🏠',
    permissions: [
      { key: 'dashboard.view', label: 'Xem tổng quan' },
    ]
  },
  {
    id: 'pricing', label: 'Bảng giá', icon: '📊',
    permissions: [
      { key: 'pricing.view', label: 'Xem bảng giá' },
      { key: 'pricing.edit', label: 'Sửa giá' },
      { key: 'pricing.see_cost', label: 'Xem giá gốc' },
      { key: 'pricing.view_log', label: 'Xem lịch sử giá' },
    ]
  },
  {
    id: 'sales', label: 'Đơn hàng', icon: '🛒',
    permissions: [
      { key: 'sales.view', label: 'Xem đơn hàng' },
      { key: 'sales.create', label: 'Tạo đơn' },
      { key: 'sales.edit', label: 'Sửa đơn' },
      { key: 'sales.delete', label: 'Xóa đơn' },
      { key: 'sales.approve_price', label: 'Duyệt giá' },
      { key: 'sales.record_payment', label: 'Ghi thanh toán' },
      { key: 'sales.export', label: 'Xuất/in đơn' },
      { key: 'sales.export_warehouse', label: 'Xuất kho + ảnh' },
    ]
  },
  {
    id: 'customers', label: 'Khách hàng', icon: '👥',
    permissions: [
      { key: 'customers.view', label: 'Xem danh sách' },
      { key: 'customers.create', label: 'Thêm mới' },
      { key: 'customers.edit', label: 'Sửa' },
      { key: 'customers.delete', label: 'Xóa' },
      { key: 'customers.view_debt', label: 'Xem công nợ' },
    ]
  },
  {
    id: 'warehouse', label: 'Gỗ kiện', icon: '🪚',
    permissions: [
      { key: 'warehouse.view', label: 'Xem kho' },
      { key: 'warehouse.create', label: 'Nhập kiện' },
      { key: 'warehouse.edit', label: 'Sửa kiện' },
      { key: 'warehouse.delete', label: 'Xóa kiện' },
      { key: 'warehouse.change_status', label: 'Đổi trạng thái' },
    ]
  },
  {
    id: 'raw_wood', label: 'Gỗ nguyên liệu', icon: '🪵',
    permissions: [
      { key: 'raw_wood.view', label: 'Xem danh sách' },
      { key: 'raw_wood.create', label: 'Nhập lô' },
      { key: 'raw_wood.edit', label: 'Sửa' },
      { key: 'raw_wood.delete', label: 'Xóa' },
      { key: 'raw_wood.pricing', label: 'Cấu hình giá NL' },
      { key: 'raw_wood.sell', label: 'Bán gỗ NL' },
    ]
  },
  {
    id: 'sawing', label: 'Xẻ gỗ', icon: '🪛',
    permissions: [
      { key: 'sawing.view', label: 'Xem danh sách' },
      { key: 'sawing.create', label: 'Tạo mẻ xẻ' },
      { key: 'sawing.edit', label: 'Sửa' },
      { key: 'sawing.delete', label: 'Xóa' },
    ]
  },
  {
    id: 'kiln', label: 'Lò sấy', icon: '🔥',
    permissions: [
      { key: 'kiln.view', label: 'Xem danh sách' },
      { key: 'kiln.create', label: 'Tạo mẻ sấy' },
      { key: 'kiln.edit', label: 'Sửa' },
      { key: 'kiln.delete', label: 'Xóa' },
    ]
  },
  {
    id: 'suppliers', label: 'Nhà cung cấp', icon: '🏭',
    permissions: [
      { key: 'suppliers.view', label: 'Xem danh sách' },
      { key: 'suppliers.create', label: 'Thêm NCC' },
      { key: 'suppliers.edit', label: 'Sửa' },
      { key: 'suppliers.delete', label: 'Xóa' },
    ]
  },
  {
    id: 'containers', label: 'Container', icon: '📦',
    permissions: [
      { key: 'containers.view', label: 'Xem danh sách' },
      { key: 'containers.create', label: 'Tạo container' },
      { key: 'containers.edit', label: 'Sửa' },
      { key: 'containers.delete', label: 'Xóa' },
      { key: 'containers.inspect', label: 'Kiểm đếm' },
    ]
  },
  {
    id: 'shipments', label: 'Lịch hàng về', icon: '📅',
    permissions: [
      { key: 'shipments.view', label: 'Xem danh sách' },
      { key: 'shipments.create', label: 'Tạo lịch' },
      { key: 'shipments.edit', label: 'Sửa' },
      { key: 'shipments.delete', label: 'Xóa' },
    ]
  },
  {
    id: 'carriers', label: 'Đơn vị vận tải', icon: '🚛',
    permissions: [
      { key: 'carriers.view', label: 'Xem danh sách' },
      { key: 'carriers.create', label: 'Thêm mới' },
      { key: 'carriers.edit', label: 'Sửa' },
      { key: 'carriers.delete', label: 'Xóa' },
    ]
  },
  {
    id: 'reconciliation', label: 'Đối soát', icon: '🏦',
    permissions: [
      { key: 'reconciliation.view', label: 'Xem giao dịch' },
      { key: 'reconciliation.match', label: 'Khớp GD - đơn' },
      { key: 'reconciliation.refund', label: 'Hoàn tiền' },
    ]
  },
  {
    id: 'employees', label: 'Nhân sự', icon: '👤',
    permissions: [
      { key: 'employees.view', label: 'Xem danh sách NV' },
      { key: 'employees.create', label: 'Thêm nhân viên' },
      { key: 'employees.edit', label: 'Sửa thông tin NV' },
      { key: 'employees.delete', label: 'Xóa nhân viên' },
    ]
  },
  {
    id: 'attendance', label: 'Chấm công', icon: '📅',
    permissions: [
      { key: 'attendance.view', label: 'Xem chấm công' },
      { key: 'attendance.edit', label: 'Chấm công / sửa' },
      { key: 'attendance.import', label: 'Import Excel' },
      { key: 'attendance.settings', label: 'Cấu hình lương' },
    ]
  },
  {
    id: 'payroll', label: 'Bảng lương', icon: '💰',
    permissions: [
      { key: 'payroll.view', label: 'Xem bảng lương' },
      { key: 'payroll.create', label: 'Tạo / tính lương' },
      { key: 'payroll.confirm', label: 'Duyệt lương' },
      { key: 'payroll.advances', label: 'Quản lý tạm ứng' },
    ]
  },
  {
    id: 'config', label: 'Cấu hình hệ thống', icon: '⚙️',
    permissions: [
      { key: 'config.wood_types', label: 'Loại gỗ' },
      { key: 'config.attributes', label: 'Thuộc tính' },
      { key: 'config.wood_config', label: 'Cấu hình bảng giá' },
      { key: 'config.sku', label: 'Xem SKU' },
    ]
  },
  {
    id: 'admin', label: 'Quản trị hệ thống', icon: '🛡️',
    permissions: [
      { key: 'admin.users', label: 'Quản lý user' },
      { key: 'admin.groups', label: 'Nhóm quyền' },
      { key: 'admin.permissions', label: 'Phân quyền' },
      { key: 'admin.logs', label: 'Nhật ký hệ thống' },
    ]
  },
];

// Export cho các module khác dùng
export { PERMISSION_MODULES };

// Lấy tất cả permission keys
const ALL_PERM_KEYS = PERMISSION_MODULES.flatMap(m => m.permissions.map(p => p.key));

export default function PgPermissions({ permGroups, groupPermsMap, setGroupPermsMap, useAPI, notify }) {
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedModules, setExpandedModules] = useState(() => {
    const init = {};
    PERMISSION_MODULES.forEach(m => { init[m.id] = true; });
    return init;
  });

  // Chọn nhóm đầu tiên nếu chưa chọn
  useEffect(() => {
    if (!selectedGroupId && permGroups.length > 0) {
      setSelectedGroupId(permGroups[0].id);
    }
  }, [permGroups, selectedGroupId]);

  const selectedGroup = permGroups.find(g => g.id === selectedGroupId);
  const currentPerms = groupPermsMap[selectedGroupId] || [];

  const hasPerm = useCallback((key) => {
    return currentPerms.includes(key);
  }, [currentPerms]);

  const togglePerm = (key) => {
    const current = groupPermsMap[selectedGroupId] || [];
    const next = current.includes(key) ? current.filter(k => k !== key) : [...current, key];
    setGroupPermsMap(p => ({ ...p, [selectedGroupId]: next }));
    setDirty(true);
  };

  const toggleModule = (moduleId) => {
    const mod = PERMISSION_MODULES.find(m => m.id === moduleId);
    if (!mod) return;
    const keys = mod.permissions.map(p => p.key);
    const current = groupPermsMap[selectedGroupId] || [];
    const allChecked = keys.every(k => current.includes(k));
    let next;
    if (allChecked) {
      next = current.filter(k => !keys.includes(k));
    } else {
      next = [...new Set([...current, ...keys])];
    }
    setGroupPermsMap(p => ({ ...p, [selectedGroupId]: next }));
    setDirty(true);
  };

  const selectAll = () => {
    setGroupPermsMap(p => ({ ...p, [selectedGroupId]: [...ALL_PERM_KEYS] }));
    setDirty(true);
  };

  const deselectAll = () => {
    setGroupPermsMap(p => ({ ...p, [selectedGroupId]: [] }));
    setDirty(true);
  };

  const savePerms = async () => {
    if (!selectedGroupId) return;
    setSaving(true);
    if (useAPI) {
      try {
        const api = await import('../api.js');
        const perms = groupPermsMap[selectedGroupId] || [];
        const r = await api.saveGroupPermissions(selectedGroupId, perms);
        if (r?.error) notify("Lỗi lưu: " + r.error, false);
        else { notify("Đã lưu phân quyền cho " + (selectedGroup?.name || '')); setDirty(false); }
      } catch (e) { notify("Lỗi: " + e.message, false); }
    } else {
      notify("Đã lưu phân quyền (local)");
      setDirty(false);
    }
    setSaving(false);
  };

  const toggleExpand = (moduleId) => {
    setExpandedModules(p => ({ ...p, [moduleId]: !p[moduleId] }));
  };

  const chkS = { accentColor: "var(--gn)", cursor: "pointer", width: 16, height: 16 };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "var(--br)" }}>Phân quyền chi tiết</h2>
      </div>

      {/* Chọn nhóm quyền */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {permGroups.filter(g => g.active !== false).map(g => (
          <button key={g.id} onClick={() => { setSelectedGroupId(g.id); setDirty(false); }}
            style={{
              padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: "0.78rem",
              border: selectedGroupId === g.id ? "2px solid " + (g.color || "var(--ac)") : "1.5px solid var(--bd)",
              background: selectedGroupId === g.id ? (g.color || "var(--ac)") + '18' : "#fff",
              color: selectedGroupId === g.id ? (g.color || "var(--ac)") : "var(--ts)",
              transition: "all 0.12s",
            }}>
            {g.icon} {g.name}
          </button>
        ))}
      </div>

      {selectedGroup && (
        <>
          {/* Actions bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "8px 12px", borderRadius: 8, background: "var(--bgs)" }}>
            <div style={{ fontSize: "0.78rem", color: "var(--ts)" }}>
              Đang cấu hình: <strong style={{ color: selectedGroup.color || "var(--br)" }}>{selectedGroup.icon} {selectedGroup.name}</strong>
              {' '}— {(groupPermsMap[selectedGroupId] || []).length}/{ALL_PERM_KEYS.length} quyền
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={selectAll} style={{ padding: "4px 10px", borderRadius: 5, background: "transparent", color: "var(--gn)", border: "1px solid var(--gn)", cursor: "pointer", fontWeight: 600, fontSize: "0.68rem" }}>Chọn tất cả</button>
              <button onClick={deselectAll} style={{ padding: "4px 10px", borderRadius: 5, background: "transparent", color: "var(--tm)", border: "1px solid var(--bd)", cursor: "pointer", fontWeight: 600, fontSize: "0.68rem" }}>Bỏ tất cả</button>
              <button onClick={savePerms} disabled={!dirty || saving}
                style={{ padding: "4px 14px", borderRadius: 5, background: dirty ? "var(--ac)" : "var(--bd)", color: dirty ? "#fff" : "var(--tm)", border: "none", cursor: dirty ? "pointer" : "not-allowed", fontWeight: 700, fontSize: "0.7rem" }}>
                {saving ? "Đang lưu..." : "Lưu phân quyền"}
              </button>
            </div>
          </div>

          {/* Ma trận phân quyền */}
          <div style={{ borderRadius: 10, background: "var(--bgc)", border: "1px solid var(--bd)", overflow: "hidden" }}>
            {PERMISSION_MODULES.map((mod, mi) => {
              const modKeys = mod.permissions.map(p => p.key);
              const checkedCount = modKeys.filter(k => hasPerm(k)).length;
              const allChecked = checkedCount === modKeys.length;
              const someChecked = checkedCount > 0 && !allChecked;
              const isOpen = expandedModules[mod.id] !== false;

              return (
                <div key={mod.id} style={{ borderBottom: mi < PERMISSION_MODULES.length - 1 ? "1px solid var(--bd)" : "none" }}>
                  {/* Module header */}
                  <div
                    onClick={() => toggleExpand(mod.id)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer", background: allChecked ? "rgba(50,79,39,0.04)" : someChecked ? "rgba(242,101,34,0.04)" : "transparent", transition: "background 0.12s" }}>
                    <span style={{ fontSize: "0.6rem", color: "var(--tm)", transition: "transform 0.15s", display: "inline-block", transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}>▼</span>
                    <label style={{ cursor: "pointer", display: "inline-flex", alignItems: "center" }} onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={allChecked} ref={el => { if (el) el.indeterminate = someChecked; }}
                        onChange={() => toggleModule(mod.id)} style={chkS} />
                    </label>
                    <span style={{ fontSize: "1rem" }}>{mod.icon}</span>
                    <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--br)", flex: 1 }}>{mod.label}</span>
                    <span style={{ fontSize: "0.68rem", color: "var(--tm)", fontWeight: 600 }}>{checkedCount}/{modKeys.length}</span>
                  </div>

                  {/* Permission rows */}
                  {isOpen && (
                    <div style={{ padding: "0 14px 8px 52px" }}>
                      {mod.permissions.map(perm => (
                        <label key={perm.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", cursor: "pointer", fontSize: "0.78rem", color: hasPerm(perm.key) ? "var(--br)" : "var(--ts)" }}>
                          <input type="checkbox" checked={hasPerm(perm.key)} onChange={() => togglePerm(perm.key)} style={chkS} />
                          <span style={{ fontWeight: hasPerm(perm.key) ? 600 : 400 }}>{perm.label}</span>
                          <span style={{ fontSize: "0.62rem", color: "var(--tm)", fontFamily: "monospace" }}>{perm.key}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {dirty && <div style={{ marginTop: 8, fontSize: "0.68rem", color: "var(--ac)", fontWeight: 600 }}>* Có thay đổi chưa lưu</div>}
        </>
      )}

      {permGroups.length === 0 && (
        <div style={{ padding: 40, textAlign: "center", color: "var(--tm)" }}>
          Chưa có nhóm quyền nào. Hãy tạo nhóm quyền trước.
        </div>
      )}
    </div>
  );
}
