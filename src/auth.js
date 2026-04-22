/**
 * Cấu hình người dùng và phân quyền GTH Pricing
 *
 * USERS: danh sách tài khoản cứng (username → { password, role, label })
 * getPerms(role): trả về object quyền hạn cho role đó
 */

// Mật khẩu lưu dưới dạng SHA-256 hash (không lưu plaintext)
// USERS hardcode — SuperAdmin luôn tồn tại, không thể xóa/sửa từ UI
export const USERS = {
  SuperAdmin: { passwordHash: '08be99aed0439b4a4ce0bbbbec9a75ee6ec6ccef01656d0568e17abfb99076b7', role: 'superadmin', label: 'Super Admin' },
  admin:    { passwordHash: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', role: 'admin',   label: 'Quản trị viên' },
  banhang1: { passwordHash: '0cd2adcda1d323755adc5b0579bd7a9c99be28ce42972abaf9212c48b432c37c', role: 'banhang', label: 'Bán hàng' },
  kho1:     { passwordHash: '586873d8c25ea92f9d3be49fb322c787208fd181f6354cfa1471bec34905d581', role: 'kho',     label: 'Thủ kho' },
};

// Danh sách roles có thể gán cho user (SuperAdmin không gán được)
export const ASSIGNABLE_ROLES = ['admin', 'banhang', 'kho', 'ketoan'];

// Hash mật khẩu bằng SHA-256 (Web Crypto API)
export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Tất cả pages trong hệ thống (trừ 'users' — chỉ superadmin)
export const ALL_PAGES = [
  { id: 'dashboard',  label: 'Tổng quan' },
  { id: 'pricing',    label: 'Bảng giá' },
  { id: 'warehouse',  label: 'Gỗ kiện' },
  { id: 'raw_wood',   label: 'Gỗ nguyên liệu' },
  { id: 'sawing',     label: 'Xẻ gỗ' },
  { id: 'kiln',       label: 'Lò sấy' },
  { id: 'edging',     label: 'Dong cạnh' },
  { id: 'sales',      label: 'Đơn hàng' },
  { id: 'customers',  label: 'Khách hàng' },
  { id: 'carriers',   label: 'Đơn vị vận tải' },
  { id: 'suppliers',  label: 'Nhà cung cấp' },
  { id: 'shipments',  label: 'Lô hàng & Container' },
  { id: 'reconciliation', label: 'Đối soát' },
  { id: 'employees',      label: 'Nhân sự' },
  { id: 'attendance',     label: 'Chấm công' },
  { id: 'payroll',        label: 'Bảng lương' },
  { id: 'wood_types', label: 'Loại gỗ' },
  { id: 'attributes', label: 'Thuộc tính' },
  { id: 'config',     label: 'Cấu hình' },
  { id: 'sku',        label: 'SKU' },
  { id: 'perm_groups', label: 'Nhóm quyền' },
  { id: 'permissions', label: 'Phân quyền' },
  { id: 'audit_log',   label: 'Nhật ký' },
  { id: 'devices',     label: 'Quản lý thiết bị' },
  { id: 'inventory_check', label: 'Đối chiếu sổ kho' },
];

// Định nghĩa các quyền có thể toggle
export const PERM_DEFS = [
  { key: 'ce',             label: 'Sửa giá' },
  { key: 'seeCostPrice',   label: 'Xem giá gốc' },
  { key: 'ceSales',        label: 'Quản lý đơn hàng' },
  { key: 'ceWarehouse',    label: 'Quản lý kho' },
  { key: 'cePayment',      label: 'Đối soát thanh toán' },
  { key: 'viewSales',      label: 'Xem đơn hàng (chỉ đọc)' },
  { key: 'addOnlyNCC',     label: 'NCC (chỉ thêm)' },
  { key: 'addOnlyContainer', label: 'Container (chỉ thêm)' },
  { key: 'ceEmployees',     label: 'Quản lý nhân sự' },
];

/**
 * Quyền hạn mặc định theo role (fallback khi chưa có custom config)
 */
export const DEFAULT_ROLE_PERMS = {
  admin: {
    ce: true, seeCostPrice: true, ceSales: true, ceWarehouse: true,
    cePayment: true, viewSales: true, ceExport: true, ceEmployees: true,
    addOnlyNCC: false, addOnlyContainer: false,
    pages: null, defaultPage: 'dashboard',
  },
  banhang: {
    ce: false, seeCostPrice: false, ceSales: true, ceWarehouse: false,
    ceExport: false,
    addOnlyNCC: false, addOnlyContainer: false,
    pages: ['sales', 'customers', 'pricing', 'dashboard'],
    defaultPage: 'sales',
  },
  kho: {
    ce: false, seeCostPrice: false, ceSales: false, ceWarehouse: true,
    ceExport: true,
    addOnlyNCC: true, addOnlyContainer: true,
    pages: ['warehouse', 'raw_wood', 'sawing', 'kiln', 'edging', 'inventory_check', 'sales', 'suppliers', 'shipments', 'dashboard'],
    defaultPage: 'warehouse',
  },
  ketoan: {
    ce: false, seeCostPrice: false, ceSales: false, ceWarehouse: false,
    cePayment: true, viewSales: true, ceExport: false, ceEmployees: true,
    addOnlyNCC: false, addOnlyContainer: false,
    pages: ['reconciliation', 'sales', 'customers', 'employees', 'attendance', 'payroll', 'dashboard'],
    defaultPage: 'reconciliation',
  },
};

/**
 * Mapping: permission_key mới → pageId để derive danh sách trang từ nhóm quyền
 */
const PERM_KEY_TO_PAGE = {
  'dashboard.view': 'dashboard',
  'pricing.view': 'pricing', 'pricing.edit': 'pricing', 'pricing.see_cost': 'pricing', 'pricing.view_log': 'pricing',
  'sales.view': 'sales', 'sales.create': 'sales', 'sales.edit': 'sales', 'sales.delete': 'sales', 'sales.export_warehouse': 'sales',
  'customers.view': 'customers', 'customers.create': 'customers', 'customers.edit': 'customers',
  'warehouse.view': 'warehouse', 'warehouse.create': 'warehouse', 'warehouse.edit': 'warehouse',
  'raw_wood.view': 'raw_wood', 'raw_wood.create': 'raw_wood', 'raw_wood.edit': 'raw_wood',
  'sawing.view': 'sawing', 'sawing.create': 'sawing', 'sawing.edit': 'sawing',
  'kiln.view': 'kiln', 'kiln.create': 'kiln', 'kiln.edit': 'kiln',
  'edging.view': 'edging', 'edging.create': 'edging', 'edging.edit': 'edging',
  'suppliers.view': 'suppliers', 'suppliers.create': 'suppliers',
  'containers.view': 'containers', 'containers.create': 'containers', 'containers.edit': 'containers',
  'shipments.view': 'shipments', 'shipments.create': 'shipments', 'shipments.edit': 'shipments',
  'carriers.view': 'carriers', 'carriers.create': 'carriers',
  'reconciliation.view': 'reconciliation', 'reconciliation.match': 'reconciliation',
  'employees.view': 'employees', 'employees.create': 'employees', 'employees.edit': 'employees', 'employees.delete': 'employees',
  'attendance.view': 'attendance', 'attendance.edit': 'attendance', 'attendance.import': 'attendance', 'attendance.settings': 'attendance',
  'payroll.view': 'payroll', 'payroll.create': 'payroll', 'payroll.confirm': 'payroll', 'payroll.advances': 'payroll',
  'config.wood_types': 'wood_types', 'config.attributes': 'attributes', 'config.wood_config': 'config', 'config.sku': 'sku',
  'admin.users': 'users', 'admin.groups': 'perm_groups', 'admin.permissions': 'permissions', 'admin.logs': 'audit_log', 'admin.devices': 'devices',
  'inventory_check.view': 'inventory_check',
};

/**
 * Derive perms object từ danh sách permission keys (nhóm quyền chi tiết).
 * Trả về format tương thích với perms cũ (ce, ceSales, pages, ...).
 */
function derivePermsFromKeys(keys) {
  const has = (k) => keys.includes(k);
  // Derive pages từ permission keys
  const pageSet = new Set();
  keys.forEach(k => { if (PERM_KEY_TO_PAGE[k]) pageSet.add(PERM_KEY_TO_PAGE[k]); });
  const pages = pageSet.size === ALL_PAGES.length ? null : [...pageSet];

  // Derive default page: ưu tiên dashboard > trang đầu tiên
  const defaultPage = pageSet.has('dashboard') ? 'dashboard' : (pages?.[0] || 'pricing');

  // Map permission keys mới → flags cũ (backward compatible)
  const ce = has('pricing.edit');
  const ceWarehouse = has('warehouse.create') || has('warehouse.edit');
  const ceSales = has('sales.create') || has('sales.edit');

  return {
    ce,
    seeCostPrice: has('pricing.see_cost'),
    ceSales,
    ceWarehouse,
    cePayment: has('reconciliation.match'),
    viewSales: has('sales.view') && !ceSales,
    addOnlyNCC: has('suppliers.create') && !has('suppliers.edit') && !has('suppliers.delete'),
    addOnlyContainer: has('containers.create') && !has('containers.edit') && !has('containers.delete'),
    manageUsers: has('admin.users'),
    ceExport: has('sales.export_warehouse'),
    ceEmployees: has('employees.create') || has('employees.edit'),
    pages,
    defaultPage,
    // Lưu cả keys gốc để các page có thể kiểm tra chi tiết hơn
    _keys: keys,
  };
}

/**
 * Trả về quyền hạn cho role.
 * @param {string} role
 * @param {object} [customRolePerms] — config tùy chỉnh từ DB (legacy), format { admin: {...}, banhang: {...}, kho: {...} }
 * @param {object} [opts] — { groupPermsMap, permissionGroupId } để dùng nhóm quyền chi tiết
 */
export function getPerms(role, customRolePerms, opts) {
  if (role === 'superadmin') {
    return {
      ce: true, seeCostPrice: true, ceSales: true, ceWarehouse: true,
      cePayment: true, viewSales: true, ceExport: true, ceEmployees: true,
      addOnlyNCC: false, addOnlyContainer: false, manageUsers: true,
      pages: null, defaultPage: 'dashboard',
    };
  }

  // Nếu user có nhóm quyền chi tiết → derive từ permission keys
  const { groupPermsMap, permissionGroupId } = opts || {};
  if (permissionGroupId && groupPermsMap && groupPermsMap[permissionGroupId]) {
    return derivePermsFromKeys(groupPermsMap[permissionGroupId]);
  }

  // Fallback: dùng role-based cũ
  const base = DEFAULT_ROLE_PERMS[role];
  if (!base) {
    return { ce: false, seeCostPrice: false, ceSales: false, ceWarehouse: false, cePayment: false, viewSales: false, addOnlyNCC: false, addOnlyContainer: false, manageUsers: false, pages: ['pricing'] };
  }

  const custom = customRolePerms?.[role];
  const isAdmin = role === 'admin';
  const merged = custom ? { ...base, ...custom, manageUsers: isAdmin } : { ...base, manageUsers: isAdmin };
  return merged;
}

export const ROLE_LABELS = {
  superadmin: { text: 'Super Admin', color: '#E74C3C', bg: 'rgba(231,76,60,0.1)', icon: '👑' },
  admin:   { text: 'Admin',     color: 'var(--gn)',  bg: 'rgba(50,79,39,0.1)',   icon: '🔑' },
  banhang: { text: 'Bán hàng',  color: '#7C5CBF',   bg: 'rgba(124,92,191,0.1)', icon: '🛒' },
  kho:     { text: 'Thủ kho',   color: 'var(--ac)',  bg: 'rgba(242,101,34,0.1)', icon: '🏪' },
  ketoan:  { text: 'Kế toán',   color: '#2980b9',   bg: 'rgba(41,128,185,0.1)', icon: '📊' },
};

const SESSION_KEY = 'gth_user_session';

export function saveSession(user) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(user)); } catch {}
}

export function loadSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
}

export function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}
