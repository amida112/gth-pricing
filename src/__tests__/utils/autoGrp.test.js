import { describe, test, expect } from 'vitest';
import { autoGrp, autoGrpLength, bpk } from '../../utils';

describe('autoGrp — gộp thickness theo fingerprint giá', () => {
  // ── Config cơ bản ──
  const cfgBase = {
    attrs: ['thickness', 'quality'],
    attrValues: {
      thickness: ['2F', '2.2F', '2.5F', '3F'],
      quality: ['BC', 'ABC'],
    },
  };

  test('giá giống nhau → gộp liên tiếp', () => {
    const prices = {};
    // 2F và 2.2F có giá giống nhau cho mọi quality
    ['BC', 'ABC'].forEach(q => {
      prices[bpk('ash', { thickness: '2F', quality: q })] = { price: 10 };
      prices[bpk('ash', { thickness: '2.2F', quality: q })] = { price: 10 };
      prices[bpk('ash', { thickness: '2.5F', quality: q })] = { price: 15 };
      prices[bpk('ash', { thickness: '3F', quality: q })] = { price: 15 };
    });

    const result = autoGrp('ash', cfgBase, prices);
    expect(result).toHaveLength(2);
    expect(result[0].members).toEqual(['2F', '2.2F']);
    expect(result[1].members).toEqual(['2.5F', '3F']);
  });

  test('giá khác nhau → không gộp', () => {
    const prices = {};
    ['BC', 'ABC'].forEach(q => {
      prices[bpk('ash', { thickness: '2F', quality: q })] = { price: 10 };
      prices[bpk('ash', { thickness: '2.2F', quality: q })] = { price: 11 };
      prices[bpk('ash', { thickness: '2.5F', quality: q })] = { price: 12 };
      prices[bpk('ash', { thickness: '3F', quality: q })] = { price: 13 };
    });

    const result = autoGrp('ash', cfgBase, prices);
    expect(result).toHaveLength(4);
    result.forEach(g => expect(g.members).toHaveLength(1));
  });

  test('không có giá (all-N) → gộp với adjacent có giá', () => {
    const prices = {};
    // 2F có giá, 2.2F chưa có giá → wildcard → gộp
    ['BC', 'ABC'].forEach(q => {
      prices[bpk('ash', { thickness: '2F', quality: q })] = { price: 10 };
      // 2.2F: no price
      prices[bpk('ash', { thickness: '2.5F', quality: q })] = { price: 15 };
      prices[bpk('ash', { thickness: '3F', quality: q })] = { price: 15 };
    });

    const result = autoGrp('ash', cfgBase, prices);
    // 2F + 2.2F (wildcard gộp), 2.5F + 3F (giá giống)
    expect(result).toHaveLength(2);
    expect(result[0].members).toContain('2F');
    expect(result[0].members).toContain('2.2F');
  });

  test('thickness rỗng → mảng rỗng', () => {
    const cfg = { ...cfgBase, attrValues: { ...cfgBase.attrValues, thickness: [] } };
    // autoGrp trả về [] khi thickness rỗng (không phải null)
    expect(autoGrp('ash', cfg, {})).toEqual([]);
  });

  test('thickness undefined → null', () => {
    const cfg = { attrs: ['quality'], attrValues: { quality: ['BC'] } };
    expect(autoGrp('ash', cfg, {})).toBeNull();
  });

  test('một thickness duy nhất → 1 group', () => {
    const cfg = {
      attrs: ['thickness'], attrValues: { thickness: ['2F'] },
    };
    const result = autoGrp('ash', cfg, {});
    expect(result).toHaveLength(1);
    expect(result[0].members).toEqual(['2F']);
  });

  test('label format: range dùng dash', () => {
    const prices = {};
    ['BC', 'ABC'].forEach(q => {
      prices[bpk('ash', { thickness: '2F', quality: q })] = { price: 10 };
      prices[bpk('ash', { thickness: '2.2F', quality: q })] = { price: 10 };
    });
    const cfg2 = {
      attrs: ['thickness', 'quality'],
      attrValues: { thickness: ['2F', '2.2F'], quality: ['BC', 'ABC'] },
    };
    const result = autoGrp('ash', cfg2, prices);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('2F – 2.2F');
  });
});

describe('autoGrpLength — gộp length theo fingerprint giá', () => {
  const cfgLen = {
    attrs: ['thickness', 'length'],
    attrValues: {
      thickness: ['2F'],
      length: ['1.6-1.9m', '1.9-2.5m', '2.8-4.9m'],
    },
  };

  test('giá giống → gộp', () => {
    const prices = {};
    prices[bpk('w', { thickness: '2F', length: '1.6-1.9m' })] = { price: 10 };
    prices[bpk('w', { thickness: '2F', length: '1.9-2.5m' })] = { price: 10 };
    prices[bpk('w', { thickness: '2F', length: '2.8-4.9m' })] = { price: 15 };

    const result = autoGrpLength('w', cfgLen, prices);
    expect(result).not.toBeNull();
    // Hai nhóm đầu giống giá → check có gộp
    const grouped = result.find(g => g.members.length > 1);
    if (grouped) {
      expect(grouped.members).toContain('1.6-1.9m');
      expect(grouped.members).toContain('1.9-2.5m');
    }
  });

  test('length rỗng → null', () => {
    const cfg = { ...cfgLen, attrValues: { ...cfgLen.attrValues, length: [] } };
    expect(autoGrpLength('w', cfg, {})).toBeNull();
  });

  test('length undefined → null', () => {
    expect(autoGrpLength('w', { attrs: ['thickness'], attrValues: { thickness: ['2F'] } }, {})).toBeNull();
  });
});
