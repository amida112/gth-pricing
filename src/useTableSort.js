import { useState, useCallback } from 'react';

/**
 * Hook quản lý sort cho bảng dữ liệu.
 * @param {string} defaultField - field mặc định sort
 * @param {'asc'|'desc'} defaultDir - hướng mặc định
 */
export default function useTableSort(defaultField = '', defaultDir = 'asc') {
  const [sortField, setSortField] = useState(defaultField);
  const [sortDir, setSortDir] = useState(defaultDir);

  const toggleSort = useCallback((field) => {
    setSortField(prev => {
      if (prev === field) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); return prev; }
      setSortDir('asc');
      return field;
    });
  }, []);

  const sortIcon = useCallback((field) =>
    sortField === field ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''
  , [sortField, sortDir]);

  /** Generic sort — truyền getVal(item, field) nếu cần custom value extraction */
  const applySort = useCallback((arr, getVal) => {
    if (!sortField) return arr;
    return [...arr].sort((a, b) => {
      const va = getVal ? getVal(a, sortField) : a[sortField];
      const vb = getVal ? getVal(b, sortField) : b[sortField];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      const cmp = typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb), 'vi');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [sortField, sortDir]);

  return { sortField, sortDir, toggleSort, sortIcon, applySort, setSortField, setSortDir };
}
