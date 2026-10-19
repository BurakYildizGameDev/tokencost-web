// tests/formatter.test.js
// Faz 10: Sayı ve para formatlayıcı testleri.
import { describe, it, expect } from 'vitest';
import { formatCostDisplay, formatTokenCount } from '../src/core/formatter.js';

describe('Faz 10: formatCostDisplay', () => {
  it('0 için "$0.00" döner', () => {
    expect(formatCostDisplay(0)).toBe('$0.00');
  });

  it('mikro tutar (0.000045) için "< $0.001" döner', () => {
    expect(formatCostDisplay(0.000045)).toBe('< $0.001');
  });

  it('13.8 için "$13.80" döner', () => {
    expect(formatCostDisplay(13.8)).toBe('$13.80');
  });

  it('0.001 <= x < 0.01 aralığında 4 basamak gösterir', () => {
    expect(formatCostDisplay(0.0045)).toBe('$0.0045');
  });

  it('geçersiz girdide "$0.00" döner', () => {
    expect(formatCostDisplay(NaN)).toBe('$0.00');
    expect(formatCostDisplay(undefined)).toBe('$0.00');
  });
});

describe('Faz 10: formatTokenCount', () => {
  it('333698885 için hem tam hem kısaltılmış format döner', () => {
    const result = formatTokenCount(333698885);
    expect(result.raw).toBe(333698885);
    expect(result.full).toBe('333.698.885');
    expect(result.short).toBe('333,7M');
  });

  it('binlik (K) biçimini doğru üretir', () => {
    expect(formatTokenCount(1079).short).toBe('1,1K');
    expect(formatTokenCount(1079).full).toBe('1.079');
  });

  it('tam milyon değerinde gereksiz ondalık göstermez', () => {
    expect(formatTokenCount(2000000).short).toBe('2M');
  });

  it('milyar (B) biçimini doğru üretir', () => {
    expect(formatTokenCount(1500000000).short).toBe('1,5B');
  });

  it('binin altındaki değerleri ham bırakır', () => {
    expect(formatTokenCount(950).short).toBe('950');
    expect(formatTokenCount(950).full).toBe('950');
  });
});
