// tests/calculator.test.js
// Faz 3 - 8: FinOps hesaplama çekirdeği testleri.
import { describe, it, expect } from 'vitest';
import {
  calculateCacheHitRatio,
  validateTokenConsistency,
  calculateSingleRowCost,
  calculateCacheSavings,
  aggregateUsageSummaries,
  groupRecordsByModel,
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

describe('Faz 6: calculateCacheSavings', () => {
  it('tasarrufu ve yüzdeyi doğru hesaplar', () => {
    const result = calculateCacheSavings(314601056, 0.14, 0.014);
    expect(result.uncachedCostUSD).toBe(44.044148);
    expect(result.cachedCostUSD).toBe(4.404415);
    expect(result.savedUSD).toBe(39.639733);
    expect(result.savingsPercentage).toBe(90);
  });

  it('önbellek indirimi yoksa tasarruf 0 ve yüzde 0 olur', () => {
    const result = calculateCacheSavings(1000000, 0.14, 0.14);
    expect(result.savedUSD).toBe(0);
    expect(result.savingsPercentage).toBe(0);
  });

  it('cached fiyat uncached fiyattan büyükse negatifi 0 ile sınırlar', () => {
    const result = calculateCacheSavings(1000000, 0.1, 0.2);
    expect(result.savedUSD).toBe(0);
  });
});

describe('Faz 7: aggregateUsageSummaries', () => {
  it('boş dizi için tüm alanlarda 0 döndürür', () => {
    const summary = aggregateUsageSummaries([]);
    expect(summary.recordCount).toBe(0);
    expect(summary.totalCostUSD).toBe(0);
    expect(summary.overallCacheHitRate).toBe(0);
  });

  it('satırları toplar ve ağırlıklı genel isabet oranını hesaplar', () => {
    const rows = [
      { requests: 341, totalTokens: 30811037, cachedTokens: 29312128, billedTokens: 1498909, cachedCostUSD: 0.41, billedCostUSD: 0.36, totalCostUSD: 0.77, savedUSD: 3.69 },
      { requests: 100, totalTokens: 5000000, cachedTokens: 1000000, billedTokens: 4000000, cachedCostUSD: 0.014, billedCostUSD: 0.95, totalCostUSD: 0.96, savedUSD: 0.13 },
    ];
    const summary = aggregateUsageSummaries(rows);
    expect(summary.recordCount).toBe(2);
    expect(summary.totalRequests).toBe(441);
    expect(summary.totalTokens).toBe(35811037);
    expect(summary.totalCachedTokens).toBe(30312128);
    // Ağırlıklı oran: 30312128 / 35811037 = 84.64 (satır yüzdelerinin ortalaması DEĞİL).
    expect(summary.overallCacheHitRate).toBe(84.64);
    expect(typeof summary.overallCacheHitRate).toBe('number');
  });

  it('sayısal alanlar number tipinde kalır ve NaN üretilmez', () => {
    const summary = aggregateUsageSummaries([{ totalTokens: 1e6, cachedTokens: 5e5 }]);
    expect(typeof summary.totalCostUSD).toBe('number');
    expect(Number.isNaN(summary.totalCostUSD)).toBe(false);
    expect(Number.isNaN(summary.overallCacheHitRate)).toBe(false);
  });
});

describe('Faz 8: groupRecordsByModel', () => {
  it('boş girdi için boş dizi döndürür', () => {
    expect(groupRecordsByModel([])).toEqual([]);
  });

  it('kayıtları modele göre gruplar ve her grup için özet üretir', () => {
    const rows = [
      { model: 'deepseek-v4.1-flash', totalTokens: 100, cachedTokens: 50, totalCostUSD: 1 },
      { model: 'deepseek-v4.1-flash', totalTokens: 200, cachedTokens: 100, totalCostUSD: 2 },
      { model: 'glm-5.3', totalTokens: 50, cachedTokens: 0, totalCostUSD: 0.5 },
    ];
    const groups = groupRecordsByModel(rows);
    expect(groups).toHaveLength(2);
    const deepseek = groups.find((g) => g.model === 'deepseek-v4.1-flash');
    expect(deepseek.summary.recordCount).toBe(2);
    expect(deepseek.summary.totalTokens).toBe(300);
    expect(deepseek.summary.totalCostUSD).toBe(3);
    const glm = groups.find((g) => g.model === 'glm-5.3');
    expect(glm.summary.recordCount).toBe(1);
  });

  it('model adı boşsa "Bilinmeyen Model" altında toplar', () => {
    const groups = groupRecordsByModel([{ totalTokens: 10, cachedTokens: 0 }]);
    expect(groups[0].model).toBe('Bilinmeyen Model');
  });
});
