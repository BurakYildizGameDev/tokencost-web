// tests/calculator.test.js
// Faz 3 - 8: FinOps hesaplama çekirdeği testleri.
import { describe, it, expect } from 'vitest';
import {
  calculateCacheHitRatio,
  validateTokenConsistency,
  calculateSingleRowCost,
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

describe('Faz 5: calculateSingleRowCost', () => {
  const pricing = {
    cachedInputCostPerMillion: 0.014,
    uncachedInputCostPerMillion: 0.14,
    outputCostPerMillion: 0.28,
  };

  it('önbellek ve karma net maliyeti doğru hesaplar (alpha=0.3)', () => {
    const result = calculateSingleRowCost({ cachedTokens: 281215362, billedTokens: 22858077 }, pricing);
    expect(result.cachedCostUSD).toBe(3.937015);
    expect(result.billedCostUSD).toBe(5.440222);
    expect(result.totalCostUSD).toBe(9.377237);
    expect(result.blendedInputOutputCostPerMillion).toBe(0.238);
  });

  it('tüm tokenlar 0 ise tüm maliyet alanları 0 döner', () => {
    const result = calculateSingleRowCost({ cachedTokens: 0, billedTokens: 0 }, pricing);
    expect(result.cachedCostUSD).toBe(0);
    expect(result.billedCostUSD).toBe(0);
    expect(result.totalCostUSD).toBe(0);
  });

  it('inputOutputSplitRatio karma fiyatı değiştirir', () => {
    const allOutput = calculateSingleRowCost({ cachedTokens: 0, billedTokens: 1e6 }, pricing, 0);
    expect(allOutput.billedCostUSD).toBe(0.28);
    const allInput = calculateSingleRowCost({ cachedTokens: 0, billedTokens: 1e6 }, pricing, 1);
    expect(allInput.billedCostUSD).toBe(0.14);
  });

  it('girdi nesnesini mutate etmez (saf fonksiyon)', () => {
    const record = { cachedTokens: 100, billedTokens: 200 };
    const snapshot = { ...record };
    calculateSingleRowCost(record, pricing);
    expect(record).toEqual(snapshot);
  });
});
