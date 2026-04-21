import { useState, useCallback, useRef } from 'react';

/**
 * Hook chống double-click cho async actions.
 * Trả về [wrappedFn, loading] — wrappedFn bỏ qua lời gọi khi đang chạy.
 *
 * @param {Function} fn - async function cần bảo vệ
 * @returns {[Function, boolean]}
 */
export default function useAsyncAction(fn) {
  const [loading, setLoading] = useState(false);
  const runningRef = useRef(false);

  const run = useCallback(async (...args) => {
    if (runningRef.current) return;
    runningRef.current = true;
    setLoading(true);
    try {
      return await fn(...args);
    } finally {
      runningRef.current = false;
      setLoading(false);
    }
  }, [fn]);

  return [run, loading];
}
