import { useState, useEffect } from 'react';

/**
 * Hook trả về true nếu user đang bật toggle "💻 Chế độ máy tính" (ép desktop view).
 * Listen 'storage' event + custom event 'gth-force-desktop-change' để sync cross-component.
 */
export function useForceDesktop() {
  const [v, setV] = useState(
    () => typeof localStorage !== 'undefined' && localStorage.getItem('gth.force-desktop') === '1'
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const h = () => setV(localStorage.getItem('gth.force-desktop') === '1');
    window.addEventListener('storage', h);
    window.addEventListener('gth-force-desktop-change', h);
    return () => {
      window.removeEventListener('storage', h);
      window.removeEventListener('gth-force-desktop-change', h);
    };
  }, []);
  return v;
}

/**
 * Hook tổng hợp: trả true CHỈ KHI user thực sự nên thấy mobile view.
 *   - user.experimentalMobileForm = true (flag DB), VÀ
 *   - viewport < 640px, VÀ
 *   - không bật toggle "Chế độ máy tính"
 */
export function useMobileFormMode(user, bp = 640) {
  const small = useIsMobile(bp);
  const forced = useForceDesktop();
  return user?.experimentalMobileForm === true && small && !forced;
}


/**
 * Hook trả về true khi viewport width < breakpoint (mặc định 640px).
 *
 * Dùng cho responsive form tạo đơn (Phase 2+):
 *   const isMobile = useIsMobile() && user?.experimentalMobileForm && !document.body.classList.contains('force-desktop');
 *
 * Lưu ý: hook chỉ trả viewport size — caller phải tự kiểm tra flag user
 * và force-desktop để tránh switch view khi user không bật flag.
 */
export default function useIsMobile(bp = 640) {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.innerWidth < bp);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(`(max-width: ${bp - 1}px)`);
    const h = (e) => setM(e.matches);
    // Initial sync (SSR-safe)
    setM(mq.matches);
    if (mq.addEventListener) mq.addEventListener('change', h);
    else mq.addListener(h); // Safari < 14 fallback
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', h);
      else mq.removeListener(h);
    };
  }, [bp]);
  return m;
}
