import { describe, test, expect } from 'vitest';
import { getPriceGroupValues, isPerBundle, isM2Wood } from '../../utils';

describe('getPriceGroupValues — giá trị hiển thị bảng giá', () => {
  test('không có priceGroups → trả attrValues gốc', () => {
    const wc = { attrValues: { supplier: ['A', 'B', 'C'] } };
    expect(getPriceGroupValues('supplier', wc)).toEqual(['A', 'B', 'C']);
  });

  test('có priceGroups → special + default', () => {
    const wc = {
      attrValues: { supplier: ['Missouri', 'ATLC', 'Midwest'] },
      attrPriceGroups: { supplier: { default: 'Chung', special: ['Missouri', 'ATLC'] } },
    };
    expect(getPriceGroupValues('supplier', wc)).toEqual(['Missouri', 'ATLC', 'Chung']);
  });

  test('priceGroups không có special → chỉ default', () => {
    const wc = {
      attrValues: { supplier: ['A'] },
      attrPriceGroups: { supplier: { default: 'Tất cả' } },
    };
    expect(getPriceGroupValues('supplier', wc)).toEqual(['Tất cả']);
  });

  test('attr không có trong wc → []', () => {
    expect(getPriceGroupValues('missing', {})).toEqual([]);
  });

  test('wc null → []', () => {
    expect(getPriceGroupValues('x', null)).toEqual([]);
  });
});

describe('isPerBundle — check pricing mode', () => {
  const wts = [
    { id: 'pine', pricingMode: 'perBundle' },
    { id: 'ash' },
  ];

  test('pine → true (perBundle)', () => {
    expect(isPerBundle('pine', wts)).toBe(true);
  });

  test('ash → falsy (không có pricingMode)', () => {
    expect(isPerBundle('ash', wts)).toBeFalsy();
  });

  test('unknown wood → falsy', () => {
    expect(isPerBundle('unknown', wts)).toBeFalsy();
  });

  test('wts null → falsy', () => {
    expect(isPerBundle('pine', null)).toBeFalsy();
  });
});

describe('isM2Wood — check unit m²', () => {
  const wts = [
    { id: 'panel', unit: 'm2' },
    { id: 'ash', unit: 'm3' },
  ];

  test('panel (m2) → true', () => {
    expect(isM2Wood('panel', wts)).toBe(true);
  });

  test('ash (m3) → false', () => {
    expect(isM2Wood('ash', wts)).toBe(false);
  });

  test('unknown → falsy', () => {
    expect(isM2Wood('x', wts)).toBeFalsy();
  });
});
