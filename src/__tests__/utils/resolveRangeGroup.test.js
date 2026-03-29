import { describe, test, expect } from 'vitest';
import { resolveRangeGroup } from '../../utils';

// ── Fixture data ──────────────────────────────────────────────
const lengthGroups = [
  { label: '1.6-1.9m', min: 1.3, max: 1.9 },
  { label: '1.9-2.5m', min: 1.9, max: 2.79 },
  { label: '2.8-4.9m', min: 2.79, max: 5 },
];

const openEndedGroups = [
  { label: 'Nhỏ', min: 0 },
  { label: 'Trung bình', min: 2 },
  { label: 'Lớn', min: 4 },
];

const textOnlyGroups = [
  { label: 'Loại A' },
  { label: 'Loại B' },
];

describe('resolveRangeGroup — phân giải giá trị thành nhóm', () => {
  // ── Null / edge cases ──
  test('null rangeGroups → null', () => {
    expect(resolveRangeGroup('1.5', null)).toBeNull();
  });

  test('mảng rỗng → null', () => {
    expect(resolveRangeGroup('1.5', [])).toBeNull();
  });

  test('rawVal null → null', () => {
    expect(resolveRangeGroup(null, lengthGroups)).toBeNull();
  });

  test('rawVal rỗng → null', () => {
    expect(resolveRangeGroup('', lengthGroups)).toBeNull();
  });

  test('rawVal không phải số → null (sau khi không khớp label)', () => {
    expect(resolveRangeGroup('abc', lengthGroups)).toBeNull();
  });

  // ── Label match (ưu tiên cao nhất) ──
  test('label exact match', () => {
    expect(resolveRangeGroup('1.6-1.9m', lengthGroups)).toBe('1.6-1.9m');
  });

  test('label match case-insensitive', () => {
    expect(resolveRangeGroup('1.6-1.9M', lengthGroups)).toBe('1.6-1.9m');
  });

  test('text-only group → label match', () => {
    expect(resolveRangeGroup('Loại A', textOnlyGroups)).toBe('Loại A');
  });

  // ── Single value (fit-based mode) ──
  test('giá trị nằm trong nhóm đầu', () => {
    expect(resolveRangeGroup('1.5', lengthGroups)).toBe('1.6-1.9m');
  });

  test('giá trị nằm trong nhóm giữa', () => {
    expect(resolveRangeGroup('2.2', lengthGroups)).toBe('1.9-2.5m');
  });

  test('giá trị nằm trong nhóm cuối', () => {
    expect(resolveRangeGroup('3.5', lengthGroups)).toBe('2.8-4.9m');
  });

  test('biên min nhóm 2 (1.9) → nhóm 1 (max nhóm 1 = 1.9, min nhóm 2 = 1.9, nhóm 1 match trước)', () => {
    // 1.9 ≤ max(1.9) của nhóm 1 → fit-based mode match nhóm 1 trước
    expect(resolveRangeGroup('1.9', lengthGroups)).toBe('1.6-1.9m');
  });

  test('biên max nhóm 2 (2.79) → nhóm 2', () => {
    expect(resolveRangeGroup('2.79', lengthGroups)).toBe('1.9-2.5m');
  });

  test('biên max nhóm cuối (5.0) → nhóm cuối', () => {
    expect(resolveRangeGroup('5.0', lengthGroups)).toBe('2.8-4.9m');
  });

  test('ngoài tất cả range → null', () => {
    expect(resolveRangeGroup('6.0', lengthGroups)).toBeNull();
  });

  test('dưới min nhóm đầu → null (nếu có min)', () => {
    // min nhóm đầu = 1.3, giá trị 0.5 < 1.3
    expect(resolveRangeGroup('0.5', lengthGroups)).toBeNull();
  });

  // ── Suffix "m" handling ──
  test('bỏ hậu tố "m"', () => {
    expect(resolveRangeGroup('2.2m', lengthGroups)).toBe('1.9-2.5m');
  });

  // ── Range input (lo-hi) fit-based ──
  test('range input nằm gọn trong nhóm → match', () => {
    expect(resolveRangeGroup('1.5-1.8', lengthGroups)).toBe('1.6-1.9m');
  });

  test('range input vượt max nhóm → null', () => {
    expect(resolveRangeGroup('1.5-2.5', lengthGroups)).toBeNull();
  });

  // ── Open-ended mode (nhóm không có max) ──
  test('open-ended: giá trị nhỏ → nhóm min=0', () => {
    expect(resolveRangeGroup('1.0', openEndedGroups)).toBe('Nhỏ');
  });

  test('open-ended: giá trị trung bình → nhóm min=2', () => {
    expect(resolveRangeGroup('3.0', openEndedGroups)).toBe('Trung bình');
  });

  test('open-ended: giá trị lớn → nhóm min=4', () => {
    expect(resolveRangeGroup('5.0', openEndedGroups)).toBe('Lớn');
  });

  test('open-ended: đúng biên min=2 → nhóm min=2', () => {
    expect(resolveRangeGroup('2.0', openEndedGroups)).toBe('Trung bình');
  });

  test('open-ended: đúng biên min=4 → nhóm min=4', () => {
    expect(resolveRangeGroup('4.0', openEndedGroups)).toBe('Lớn');
  });
});
