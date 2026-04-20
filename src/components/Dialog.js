import { useEffect, useRef, useCallback } from 'react';

/**
 * Reusable Dialog component.
 *
 * Props:
 *  - open       : bool — hiển thị dialog
 *  - onClose    : () => void — gọi khi ESC hoặc nút Cancel
 *  - onOk       : () => void — gọi khi Enter (trừ textarea) hoặc nút OK
 *  - title      : string — tiêu đề (optional)
 *  - zIndex     : number — mặc định 1000
 *  - width      : number|string — chiều rộng container (mặc định 460)
 *  - maxHeight  : string — mặc định '90vh'
 *  - noEnter    : bool — tắt Enter = OK (dùng cho dialog có nhiều input/textarea)
 *  - okLabel    : string — text nút submit (mặc định 'OK')
 *  - cancelLabel: string — text nút hủy (mặc định 'Hủy')
 *  - showFooter : bool — hiển thị footer buttons tự động (mặc định false, bật khi muốn Dialog tự render nút Hủy + OK)
 *  - okDisabled : bool — vô hiệu nút OK + chặn Enter (mặc định false)
 *  - children   : nội dung dialog
 */
export default function Dialog({ open, onClose, onOk, title, zIndex = 1000, width = 460, maxHeight = '90vh', noEnter = false, okLabel = 'OK', cancelLabel = 'Hủy', showFooter = false, okDisabled = false, children }) {
  const ref = useRef(null);
  const prevFocus = useRef(null);

  // Focus trap: lấy tất cả focusable elements trong dialog
  const getFocusable = useCallback(() => {
    if (!ref.current) return [];
    return [...ref.current.querySelectorAll(
      'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )].filter(el => el.offsetParent !== null);
  }, []);

  // Lưu focus cũ, auto-focus element đầu tiên khi mở
  useEffect(() => {
    if (!open) return;
    prevFocus.current = document.activeElement;
    // Delay nhỏ để DOM render xong; skip nếu child đã tự focus (VD: ref.focus() trong useEffect)
    const t = setTimeout(() => {
      if (ref.current?.contains(document.activeElement)) return;
      const els = getFocusable();
      if (els.length) els[0].focus();
    }, 50);
    return () => clearTimeout(t);
  }, [open, getFocusable]);

  // Restore focus khi đóng
  useEffect(() => {
    if (!open && prevFocus.current) {
      prevFocus.current.focus?.();
      prevFocus.current = null;
    }
  }, [open]);

  // Keyboard: ESC, Enter, Tab trap
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
        return;
      }
      if (e.key === 'Enter' && !noEnter && onOk && !okDisabled) {
        const tag = e.target?.tagName?.toLowerCase();
        // Không trigger Enter khi đang ở textarea
        if (tag === 'textarea') return;
        e.preventDefault();
        onOk();
        return;
      }
      // Focus trap
      if (e.key === 'Tab') {
        const els = getFocusable();
        if (!els.length) return;
        const first = els[0];
        const last = els[els.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose, onOk, noEnter, getFocusable]);

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex, background: 'rgba(45,32,22,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div ref={ref} style={{ background: '#fff', borderRadius: 12, padding: 0, width, maxWidth: '95vw', maxHeight, overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
        {title && (
          <div style={{ padding: '14px 18px 10px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--br)' }}>{title}</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--tm)', padding: '2px 6px', lineHeight: 1 }}>✕</button>
          </div>
        )}
        <div style={{ padding: title ? '14px 18px 18px' : '18px' }}>
          {children}
        </div>
        {showFooter && onOk && (
          <div style={{ padding: '0 18px 14px', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: 7, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem' }}>{cancelLabel}</button>
            <button onClick={onOk} disabled={okDisabled} style={{ padding: '7px 18px', borderRadius: 7, border: 'none', background: okDisabled ? 'var(--bd)' : 'var(--ac)', color: okDisabled ? 'var(--tm)' : '#fff', cursor: okDisabled ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.78rem' }}>{okLabel}</button>
          </div>
        )}
      </div>
    </div>
  );
}
