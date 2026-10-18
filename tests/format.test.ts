import { describe, it, expect } from 'vitest';
import { fmt } from '../src/ui/format';

describe('fmt', () => {
  it('до 1000 как есть', () => {
    expect(fmt(0)).toBe('0'); expect(fmt(7)).toBe('7'); expect(fmt(999)).toBe('999'); expect(fmt(5.5)).toBe('5.5'); expect(fmt(5.04)).toBe('5');
  });
  it('суффиксы K M B T', () => {
    expect(fmt(1000)).toBe('1K'); expect(fmt(1234)).toBe('1.23K'); expect(fmt(45600000)).toBe('45.6M');
    expect(fmt(7.89e9)).toBe('7.89B'); expect(fmt(1.2e12)).toBe('1.2T'); expect(fmt(123456)).toBe('123K');
  });
  it('округление до границы не даёт 1000K', () => {
    expect(fmt(999999)).toBe('1M'); expect(fmt(999.9)).toBe('1K');
  });
  it('буквенные aa, ab, …', () => {
    expect(fmt(1e15)).toBe('1aa'); expect(fmt(1.5e18)).toBe('1.5ab'); expect(fmt(1e30)).toBe('1af');
    expect(fmt(1e100)).toBe('10bc');
  });
  it('очень большие, строки Decimal, экспонента после aa..zz', () => {
    expect(fmt('1.5e400')).toMatch(/^[a-z]{2}$|^\d+(\.\d+)?[a-z]{2}$/);
    expect(fmt('1e5000')).toBe('1.00e5000'); expect(fmt('12345')).toBe('12.3K');
  });
  it('ноль, отрицательные, NaN, Infinity не ломаются', () => {
    expect(fmt(NaN)).toBe('0'); expect(fmt(-0)).toBe('0'); expect(fmt(-1500)).toBe('-1.5K'); expect(fmt(-3)).toBe('-3');
    expect(fmt(Infinity)).toBe('∞'); expect(fmt(-Infinity)).toBe('-∞'); expect(fmt('abc')).toBe('0'); expect(fmt('')).toBe('0'); expect(fmt('-2e3')).toBe('-2K');
  });
});

import { ICONS } from '../src/ui/pixelIcons';
describe('pixelIcons', () => {
  it('сетки 8x8, ключи есть в палитре', () => {
    for (const [n, d] of Object.entries(ICONS)) {
      expect(d.grid.length, n).toBe(8);
      for (const r of d.grid) { expect(r.length, n).toBe(8); expect(r).toMatch(/^[.abcd]+$/); }
    }
  });
});
