import { describe, test, expect } from 'vitest';
import { getContainerInvStatus } from '../../utils';

describe('getContainerInvStatus — trạng thái tồn kho container', () => {
  test('null / undefined → no_inspection', () => {
    expect(getContainerInvStatus(null)).toBe('no_inspection');
    expect(getContainerInvStatus(undefined)).toBe('no_inspection');
  });

  test('total = 0 → no_inspection', () => {
    expect(getContainerInvStatus({ total: 0, available: 0, sawn: 0, sold: 0 })).toBe('no_inspection');
  });

  test('tất cả available → ready', () => {
    expect(getContainerInvStatus({ total: 10, available: 10, sawn: 0, sold: 0 })).toBe('ready');
  });

  test('tất cả sold → all_sold', () => {
    expect(getContainerInvStatus({ total: 10, available: 0, sawn: 0, sold: 10 })).toBe('all_sold');
  });

  test('tất cả sawn → all_sawn', () => {
    expect(getContainerInvStatus({ total: 10, available: 0, sawn: 10, sold: 0 })).toBe('all_sawn');
  });

  test('hỗn hợp sawn + sold, không available → sawn_sold', () => {
    expect(getContainerInvStatus({ total: 10, available: 0, sawn: 6, sold: 4 })).toBe('sawn_sold');
  });

  test('còn available lẻ → partial', () => {
    expect(getContainerInvStatus({ total: 10, available: 3, sawn: 5, sold: 2 })).toBe('partial');
  });
});
