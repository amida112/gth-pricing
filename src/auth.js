/**
 * Cấu hình người dùng và phân quyền GTH Pricing
 *
 * USERS: danh sách tài khoản cứng (username → { password, role, label })
 * getPerms(role): trả về object quyền hạn cho role đó
 */

// Mật khẩu lưu dưới dạng SHA-256 hash (không lưu plaintext)
// USERS hardcode — SuperAdmin luôn tồn tại, không thể xóa/sửa từ UI
export const USERS = {
  SuperAdmin: { passwordHash: '4cfc6666a27d7182247b565967e6b7476f81a62b5c338d694cbe9e929c1da7ff', role: 'superadmin', label: 'Super Admin' },
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
  { id: 'sales',      label: 'Đơn hàng' },
  { id: 'customers',  label: 'Khách hàng' },
  { id: 'carriers',   label: 'Đơn vị vận tải' },
  { id: 'suppliers',  label: 'Nhà cung cấp' },
  { id: 'containers', label: 'Container' },
  { id: 'shipments',  label: 'Lịch hàng về' },
  { id: 'reconciliation', label: 'Đối soát' },
  { id: 'wood_types', label: 'Loại gỗ' },
  { id: 'attributes', label: 'Thuộc tính' },
  { id: 'config',     label: 'Cấu hình' },
  { id: 'sku',        label: 'SKU' },
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
];

/**
 * Quyền hạn mặc định theo role (fallback khi chưa có custom config)
 */
export const DEFAULT_ROLE_PERMS = {
  admin: {
    ce: true, seeCostPrice: true, ceSales: true, ceWarehouse: true,
    cePayment: true, viewSales: true,
    addOnlyNCC: false, addOnlyContainer: false,
    pages: null, defaultPage: 'dashboard',
  },
  banhang: {
    ce: false, seeCostPrice: false, ceSales: true, ceWarehouse: false,
    addOnlyNCC: false, addOnlyContainer: false,
    pages: ['sales', 'customers', 'pricing', 'dashboard'],
    defaultPage: 'sales',
  },
  kho: {
    ce: false, seeCostPrice: false, ceSales: false, ceWarehouse: true,
    addOnlyNCC: true, addOnlyContainer: true,
    pages: ['warehouse', 'raw_wood', 'sawing', 'kiln', 'sales', 'suppliers', 'containers', 'shipments', 'dashboard'],
    defaultPage: 'warehouse',
  },
  ketoan: {
    ce: false, seeCostPrice: false, ceSales: false, ceWarehouse: false,
    cePayment: true, viewSales: true,
    addOnlyNCC: false, addOnlyContainer: false,
    pages: ['reconciliation', 'sales', 'customers', 'dashboard'],
    defaultPage: 'reconciliation',
  },
};

/**
 * Trả về quyền hạn cho role.
 * @param {string} role
 * @param {object} [customRolePerms] — config tùy chỉnh từ DB, format { admin: {...}, banhang: {...}, kho: {...} }
 */
export function getPerms(role, customRolePerms) {
  if (role === 'superadmin') {
    return {
      ce: true, seeCostPrice: true, ceSales: true, ceWarehouse: true,
      cePayment: true, viewSales: true,
      addOnlyNCC: false, addOnlyContainer: false, manageUsers: true,
      pages: null, defaultPage: 'dashboard',
    };
  }

  // Merge: default ← custom override
  const base = DEFAULT_ROLE_PERMS[role];
  if (!base) {
    return { ce: false, seeCostPrice: false, ceSales: false, ceWarehouse: false, cePayment: false, viewSales: false, addOnlyNCC: false, addOnlyContainer: false, manageUsers: false, pages: ['pricing'] };
  }

  const custom = customRolePerms?.[role];
  const merged = custom ? { ...base, ...custom, manageUsers: false } : { ...base, manageUsers: false };
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
