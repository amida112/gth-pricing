/**
 * Cấu hình người dùng và phân quyền GTH Pricing
 *
 * USERS: danh sách tài khoản cứng (username → { password, role, label })
 * getPerms(role): trả về object quyền hạn cho role đó
 */

// Mật khẩu lưu dưới dạng SHA-256 hash (không lưu plaintext)
export const USERS = {
  admin:    { passwordHash: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', role: 'admin',   label: 'Quản trị viên' },
  banhang1: { passwordHash: '0cd2adcda1d323755adc5b0579bd7a9c99be28ce42972abaf9212c48b432c37c', role: 'banhang', label: 'Bán hàng' },
  kho1:     { passwordHash: '586873d8c25ea92f9d3be49fb322c787208fd181f6354cfa1471bec34905d581', role: 'kho',     label: 'Thủ kho' },
};

// Hash mật khẩu bằng SHA-256 (Web Crypto API)
export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

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
        defaultPage: 'dashboard',
      };
    case 'banhang':
      return {
        ce: false,
        seeCostPrice: false,
        ceSales: true,
        ceWarehouse: false,
        addOnlyNCC: false,
        addOnlyContainer: false,
        pages: ['sales', 'customers', 'pricing', 'dashboard'],
        defaultPage: 'sales',
      };
    case 'kho':
      return {
        ce: false,
        seeCostPrice: false,
        ceSales: false,
        ceWarehouse: true,
        addOnlyNCC: true,
        addOnlyContainer: true,
        pages: ['warehouse', 'suppliers', 'containers', 'dashboard'],
        defaultPage: 'warehouse',
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
