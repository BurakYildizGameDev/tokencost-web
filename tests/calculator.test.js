// tests/calculator.test.js
// Faz 3 - 8: FinOps hesaplama çekirdeği testleri.
import { describe, it, expect } from 'vitest';
import {
  calculateCacheHitRatio,
  validateTokenConsistency,
} from '../src/core/calculator.js';

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

describe('Faz 4: validateTokenConsistency', () => {
  it('gerçek tutarsız veride metadata üretir ve throw etmez', () => {
    const result = validateTokenConsistency({
      totalTokens: 30811037,
      cachedTokens: 29312128,
      billedTokens: 2378273,
    });
    expect(result).toEqual({
      isExactMatch: false,
      discrepancy: 879364,
      effectiveBilledTokens: 2378273,
      warningCode: 'QUOTA_WEIGHTED_TOKENS',
    });
  });

  it('billedTokens 0 veya null ama total > cached ise total-cached türetir', () => {
    const withZero = validateTokenConsistency({ totalTokens: 1000, cachedTokens: 400, billedTokens: 0 });
    expect(withZero.effectiveBilledTokens).toBe(600);
    expect(withZero.warningCode).toBe('BILLED_TOKENS_DERIVED');

    const withNull = validateTokenConsistency({ totalTokens: 1000, cachedTokens: 400, billedTokens: null });
    expect(withNull.effectiveBilledTokens).toBe(600);
    expect(withNull.warningCode).toBe('BILLED_TOKENS_DERIVED');
  });

  it('tam eşleşmede isExactMatch true ve warningCode null olur', () => {
    const result = validateTokenConsistency({ totalTokens: 1000, cachedTokens: 400, billedTokens: 600 });
    expect(result.isExactMatch).toBe(true);
    expect(result.discrepancy).toBe(0);
    expect(result.warningCode).toBe(null);
  });
});
