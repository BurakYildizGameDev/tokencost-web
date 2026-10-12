// tests/calculator.test.js
// Faz 3 - 8: FinOps hesaplama çekirdeği testleri.
import { describe, it, expect } from 'vitest';
import { calculateCacheHitRatio } from '../src/core/calculator.js';

describe('Faz 3: calculateCacheHitRatio', () => {
  it('gerçek veri için 95.14 döner ve tipi number olur', () => {
    const ratio = calculateCacheHitRatio(29312128, 30811037);
    expect(ratio).toBe(95.14);
    expect(typeof ratio).toBe('number');
  });

  it('0/0 durumunda NaN veya Infinity üretmez, 0 döner', () => {
    expect(calculateCacheHitRatio(0, 0)).toBe(0);
    expect(calculateCacheHitRatio(10, 0)).toBe(0);
    expect(Number.isNaN(calculateCacheHitRatio(0, 0))).toBe(false);
  });

  it('cached > total ise oranı 100 ile sınırlar', () => {
    expect(calculateCacheHitRatio(200, 100)).toBe(100);
  });
});
