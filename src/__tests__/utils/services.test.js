import { describe, test, expect } from 'vitest';
import { calcSvcAmount, svcLabel } from '../../utils';

describe('calcSvcAmount — tính tiền dịch vụ', () => {
  test('xe_say: unitPrice × volume', () => {
    expect(calcSvcAmount({ type: 'xe_say', unitPrice: 1500000, volume: 2.5 }))
      .toBe(3750000);
  });

  test('xe_say: làm tròn', () => {
    expect(calcSvcAmount({ type: 'xe_say', unitPrice: 1000000, volume: 0.333 }))
      .toBe(333000);
  });

  test('luoc_go: 1,000,000 × volume', () => {
    expect(calcSvcAmount({ type: 'luoc_go', volume: 1.5 }))
      .toBe(1500000);
  });

  test('other: trả về amount trực tiếp', () => {
    expect(calcSvcAmount({ type: 'other', amount: 500000 }))
      .toBe(500000);
  });

  test('missing values → 0', () => {
    expect(calcSvcAmount({ type: 'xe_say' })).toBe(0);
    expect(calcSvcAmount({ type: 'luoc_go' })).toBe(0);
    expect(calcSvcAmount({ type: 'other' })).toBe(0);
  });
});

describe('svcLabel — nhãn hiển thị dịch vụ', () => {
  test('xe_say có đầy đủ info', () => {
    const label = svcLabel({ type: 'xe_say', volume: 2.5, unitPrice: 1500000 });
    expect(label).toContain('Xẻ sấy');
    expect(label).toContain('2.500m³');
  });

  test('luoc_go', () => {
    expect(svcLabel({ type: 'luoc_go', volume: 1.0 })).toContain('Luộc gỗ');
  });

  test('van_chuyen có tên carrier', () => {
    const label = svcLabel({ type: 'van_chuyen', carrierName: 'ABC Logistics' });
    expect(label).toContain('Vận tải');
    expect(label).toContain('ABC Logistics');
  });

  test('van_chuyen không có carrier', () => {
    expect(svcLabel({ type: 'van_chuyen' })).toBe('Vận tải');
  });

  test('other với description', () => {
    expect(svcLabel({ type: 'other', description: 'Bốc xếp' })).toBe('Bốc xếp');
  });

  test('other không description → fallback', () => {
    expect(svcLabel({ type: 'other' })).toBe('Dịch vụ khác');
  });
});
