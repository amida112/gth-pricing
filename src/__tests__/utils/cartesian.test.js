import { describe, test, expect } from 'vitest';
import { cart } from '../../utils';

describe('cart — cartesian product', () => {
  test('mảng rỗng → [[]]', () => {
    expect(cart([])).toEqual([[]]);
  });

  test('một mảng → wrap từng phần tử', () => {
    expect(cart([['a', 'b']])).toEqual([['a'], ['b']]);
  });

  test('hai mảng → tổ hợp đầy đủ', () => {
    const result = cart([['a', 'b'], [1, 2]]);
    expect(result).toEqual([['a', 1], ['a', 2], ['b', 1], ['b', 2]]);
  });

  test('ba mảng', () => {
    const result = cart([['x'], ['y', 'z'], [1]]);
    expect(result).toEqual([['x', 'y', 1], ['x', 'z', 1]]);
  });

  test('mảng con rỗng → kết quả rỗng', () => {
    expect(cart([['a'], []])).toEqual([]);
  });
});
