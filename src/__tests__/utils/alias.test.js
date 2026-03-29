import { describe, test, expect } from 'vitest';
import { resolveAlias, resolveAttrsAlias } from '../../utils';

describe('resolveAlias — resolve bí danh chip', () => {
  const aliases = {
    '20-29': ['19-29', '23-29'],
    '<20': ['8-14'],
  };

  test('giá trị đã là chip chính → giữ nguyên', () => {
    expect(resolveAlias('20-29', aliases)).toBe('20-29');
  });

  test('alias → resolve thành chip chính', () => {
    expect(resolveAlias('19-29', aliases)).toBe('20-29');
    expect(resolveAlias('23-29', aliases)).toBe('20-29');
    expect(resolveAlias('8-14', aliases)).toBe('<20');
  });

  test('không khớp alias nào → giữ nguyên', () => {
    expect(resolveAlias('99-100', aliases)).toBe('99-100');
  });

  test('null aliasMap → giữ nguyên', () => {
    expect(resolveAlias('abc', null)).toBe('abc');
  });

  test('null val → null', () => {
    expect(resolveAlias(null, aliases)).toBeNull();
  });
});

describe('resolveAttrsAlias — resolve tất cả attrs qua alias', () => {
  const woodCfg = {
    attrAliases: {
      quality: { 'Fas': ['FAS', 'fas'] },
      width: { '20-29': ['19-29'] },
    },
  };

  test('resolve nhiều attrs cùng lúc', () => {
    const result = resolveAttrsAlias({ quality: 'FAS', width: '19-29', thickness: '2F' }, woodCfg);
    expect(result.quality).toBe('Fas');
    expect(result.width).toBe('20-29');
    expect(result.thickness).toBe('2F'); // không có alias → giữ nguyên
  });

  test('không có attrAliases → passthrough', () => {
    expect(resolveAttrsAlias({ a: '1' }, {})).toEqual({ a: '1' });
  });

  test('attrs null → passthrough', () => {
    expect(resolveAttrsAlias(null, woodCfg)).toBeNull();
  });
});
