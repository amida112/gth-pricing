import { describe, test, expect } from 'vitest';
import { bpk } from '../../utils';

describe('bpk — tạo price key composite', () => {
  test('sort attrs theo alphabet', () => {
    expect(bpk('walnut', { thickness: '2F', quality: 'Fas' }))
      .toBe('walnut||quality:Fas||thickness:2F');
  });

  test('nhiều attrs sort đúng', () => {
    expect(bpk('oak', { z: '1', a: '2', m: '3' }))
      .toBe('oak||a:2||m:3||z:1');
  });

  test('không có attrs → woodId + separator', () => {
    // bpk luôn thêm "||" separator sau woodId, kể cả khi không có attrs
    expect(bpk('ash', {})).toBe('ash||');
  });

  test('một attr duy nhất', () => {
    expect(bpk('oak', { quality: 'ABC' }))
      .toBe('oak||quality:ABC');
  });

  test('giá trị chứa ký tự đặc biệt', () => {
    expect(bpk('walnut', { supplier: 'Missouri Lumber' }))
      .toBe('walnut||supplier:Missouri Lumber');
  });
});
