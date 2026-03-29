import { describe, test, expect } from 'vitest';
import { resolvePriceAttrs } from '../../utils';

// ── Fixture: config cho các loại gỗ ──────────────────────────
const cfg = {
  walnut: {
    attrs: ['thickness', 'quality', 'length', 'supplier'],
    attrValues: {
      thickness: ['2F', '3F'],
      quality: ['Fas', '1COM'],
      length: ['1.6-1.9m', '1.9-2.5m'],
      supplier: ['Missouri', 'ATLC', 'Midwest'],
    },
    rangeGroups: {
      length: [
        { label: '1.6-1.9m', min: 1.3, max: 1.9 },
        { label: '1.9-2.5m', min: 1.9, max: 2.79 },
      ],
    },
    attrPriceGroups: {
      supplier: { default: 'Chung', special: ['Missouri'] },
    },
    attrAliases: {
      quality: { 'Fas': ['FAS', 'fas'] },
    },
  },
  ash: {
    attrs: ['thickness', 'quality'],
    attrValues: { thickness: ['2F'], quality: ['BC'] },
  },
};

describe('resolvePriceAttrs — resolve attrs thành price lookup key', () => {
  // ── Lọc attrs không trong config ──
  test('bỏ attr không nằm trong cfg.attrs', () => {
    const result = resolvePriceAttrs('ash', { thickness: '2F', quality: 'BC', extra: 'X' }, cfg);
    expect(result).toEqual({ thickness: '2F', quality: 'BC' });
    expect(result.extra).toBeUndefined();
  });

  // ── attrPriceGroups ──
  test('NCC special giữ nguyên', () => {
    const result = resolvePriceAttrs('walnut', {
      thickness: '2F', quality: 'Fas', length: '1.6-1.9m', supplier: 'Missouri',
    }, cfg);
    expect(result.supplier).toBe('Missouri');
  });

  test('NCC không special → gom vào default', () => {
    const result = resolvePriceAttrs('walnut', {
      thickness: '2F', quality: 'Fas', length: '1.6-1.9m', supplier: 'ATLC',
    }, cfg);
    expect(result.supplier).toBe('Chung');
  });

  test('NCC khác (Midwest) → cũng gom vào default', () => {
    const result = resolvePriceAttrs('walnut', {
      thickness: '2F', quality: 'Fas', length: '1.6-1.9m', supplier: 'Midwest',
    }, cfg);
    expect(result.supplier).toBe('Chung');
  });

  // ── rangeGroups ──
  test('resolve giá trị length số thực → nhóm', () => {
    const result = resolvePriceAttrs('walnut', {
      thickness: '2F', quality: 'Fas', length: '1.82', supplier: 'Missouri',
    }, cfg);
    expect(result.length).toBe('1.6-1.9m');
  });

  test('length đã là label → giữ nguyên', () => {
    const result = resolvePriceAttrs('walnut', {
      thickness: '2F', quality: 'Fas', length: '1.9-2.5m', supplier: 'Missouri',
    }, cfg);
    expect(result.length).toBe('1.9-2.5m');
  });

  // ── attrAliases ──
  test('resolve alias quality', () => {
    const result = resolvePriceAttrs('walnut', {
      thickness: '2F', quality: 'FAS', length: '1.6-1.9m', supplier: 'Missouri',
    }, cfg);
    expect(result.quality).toBe('Fas');
  });

  // ── Wood không có config ──
  test('wood chưa có config → passthrough tất cả attrs', () => {
    const result = resolvePriceAttrs('unknown', { a: '1', b: '2' }, cfg);
    expect(result).toEqual({ a: '1', b: '2' });
  });

  // ── Config không có rangeGroups/aliases/priceGroups ──
  test('ash chỉ có attrs cơ bản → resolve đơn giản', () => {
    const result = resolvePriceAttrs('ash', { thickness: '2F', quality: 'BC' }, cfg);
    expect(result).toEqual({ thickness: '2F', quality: 'BC' });
  });
});
