/**
 * Cấu hình người dùng và phân quyền GTH Pricing
 *
 * USERS: danh sách tài khoản cứng (username → { password, role, label })
 * getPerms(role): trả về object quyền hạn cho role đó
 */

export const USERS = {
  admin:    { password: '1234',      role: 'admin',   label: 'Quản trị viên' },
  banhang1: { password: 'Mai@333',   role: 'banhang', label: 'Bán hàng' },
  kho1:     { password: 'Nhung@312', role: 'kho',     label: 'Thủ kho' },
};

/**
 * Quyền hạn theo role:
 *
 * admin:
 *   - Full quyền tất cả màn hình
 *   - Xem giá gốc
 *
 * banhang:
 *   - Bảng giá: chỉ xem, không sửa, không thấy giá gốc
 *   - Đơn hàng + Khách hàng: full quyền
 *   - Các màn hình khác: ẩn
 *
 * kho:
 *   - Thủ kho: full quyền
 *   - Nhà cung cấp + Container: chỉ thêm mới, không sửa/xóa
 *   - Các màn hình khác: ẩn
 */
export function getPerms(role) {
  switch (role) {
    case 'admin':
      return {
        ce: true,
        seeCostPrice: true,
        ceSales: true,
        ceWarehouse: true,
        addOnlyNCC: false,
        addOnlyContainer: false,
        pages: null, // null = toàn bộ menu
      };
    case 'banhang':
      return {
        ce: false,
        seeCostPrice: false,
        ceSales: true,
        ceWarehouse: false,
        addOnlyNCC: false,
        addOnlyContainer: false,
        pages: ['sales', 'customers', 'pricing'],
      };
    case 'kho':
      return {
        ce: false,
        seeCostPrice: false,
        ceSales: false,
        ceWarehouse: true,
        addOnlyNCC: true,
        addOnlyContainer: true,
        pages: ['warehouse', 'suppliers', 'containers'],
      };
    default:
      return {
        ce: false,
        seeCostPrice: false,
        ceSales: false,
        ceWarehouse: false,
        addOnlyNCC: false,
        addOnlyContainer: false,
        pages: ['pricing'],
      };
  }
}

export const ROLE_LABELS = {
  admin:   { text: 'Admin',     color: 'var(--gn)',  bg: 'rgba(50,79,39,0.1)',   icon: '🔑' },
  banhang: { text: 'Bán hàng',  color: '#7C5CBF',   bg: 'rgba(124,92,191,0.1)', icon: '🛒' },
  kho:     { text: 'Thủ kho',   color: 'var(--ac)',  bg: 'rgba(242,101,34,0.1)', icon: '🏪' },
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
