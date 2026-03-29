import { describe, test, expect } from 'vitest';
import { normalizeThickness } from '../../utils';

describe('normalizeThickness — validate & normalize thickness input', () => {
  // ── Happy path ──
  test('số nguyên → thêm F', () => {
    expect(normalizeThickness('2')).toEqual({ value: '2F', error: null });
  });

  test('số thập phân → giữ nguyên + F', () => {
    expect(normalizeThickness('2.5')).toEqual({ value: '2.5F', error: null });
  });

  test('dấu phẩy → chuyển thành dấu chấm', () => {
    expect(normalizeThickness('2,5')).toEqual({ value: '2.5F', error: null });
  });

  test('trailing zero → bỏ', () => {
    expect(normalizeThickness('2.50')).toEqual({ value: '2.5F', error: null });
  });

  test('leading zero → bỏ', () => {
    expect(normalizeThickness('02')).toEqual({ value: '2F', error: null });
  });

  test('đã có suffix F → normalize', () => {
    expect(normalizeThickness('2.5F')).toEqual({ value: '2.5F', error: null });
  });

  test('suffix f thường → normalize', () => {
    expect(normalizeThickness('2.5f')).toEqual({ value: '2.5F', error: null });
  });

  test('có khoảng trắng → trim', () => {
    expect(normalizeThickness('  3.2  ')).toEqual({ value: '3.2F', error: null });
  });

  // ── Error cases ──
  test('rỗng → lỗi bắt buộc', () => {
    expect(normalizeThickness('')).toEqual({ value: null, error: 'Bắt buộc nhập' });
  });

  test('null → lỗi bắt buộc', () => {
    expect(normalizeThickness(null)).toEqual({ value: null, error: 'Bắt buộc nhập' });
  });

  test('chữ cái → lỗi format', () => {
    expect(normalizeThickness('abc')).toEqual({ value: null, error: 'Chỉ nhập số (VD: 2.5)' });
  });

  test('số 0 → lỗi phải dương', () => {
    expect(normalizeThickness('0')).toEqual({ value: null, error: 'Phải là số dương > 0' });
  });

  test('số âm → lỗi format (có dấu -)', () => {
    expect(normalizeThickness('-1')).toEqual({ value: null, error: 'Chỉ nhập số (VD: 2.5)' });
  });

  test('quá lớn (>50) → lỗi', () => {
    expect(normalizeThickness('51')).toEqual({ value: null, error: 'Giá trị quá lớn (>50)' });
  });

  test('50 → OK (biên)', () => {
    expect(normalizeThickness('50')).toEqual({ value: '50F', error: null });
  });
});
