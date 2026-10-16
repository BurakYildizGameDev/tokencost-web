// src/core/calculator.js
// Faz 3 - 8: FinOps matematik ve tasarruf motoru (Saf / Pure Core katmanı).
// KURAL: Bu dosyada document, window, localStorage veya fetch KULLANILMAZ.

/** Bir değeri istenen ondalık basamağa yuvarlar (number döner). */
function roundTo(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** 6 ondalık basamağa yuvarlar (kayan nokta hatalarını temizler). */
function round6(value) {
  return Number(value.toFixed(6));
}

/** 2 ondalık basamağa yuvarlar (number döner). */
function round2(value) {
  return Number(value.toFixed(2));
}

/** Bir sayıyı [min, max] aralığına sıkıştırır. */
function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * Faz 3: Ağırlıklı önbellek isabet oranını (%) number olarak hesaplar.
 * NOT: Asla string (toFixed) döndürmez; her zaman number döner.
 * @param {number} cachedTokens
 * @param {number} totalTokens
 * @returns {number}
 */
export function calculateCacheHitRatio(cachedTokens, totalTokens) {
  const cached = Number(cachedTokens) || 0;
  const total = Number(totalTokens) || 0;
  if (total <= 0) return 0;
  const ratio = (cached / total) * 100;
  return Math.min(100, roundTo(ratio, 2));
}

/**
 * Faz 4: Token tutarlılığını doğrular ve metadata üretir (asla throw etmez).
 * @param {object} record
 * @returns {{ isExactMatch: boolean, discrepancy: number, effectiveBilledTokens: number, warningCode: string|null }}
 */
export function validateTokenConsistency(record = {}) {
  const total = Number(record.totalTokens) || 0;
  const cached = Number(record.cachedTokens) || 0;
  const rawBilled = record.billedTokens;
  const billedMissing =
    rawBilled === undefined || rawBilled === null || Number(rawBilled) === 0;
  const billed = Number(rawBilled) || 0;

  let effectiveBilledTokens;
  let warningCode = null;

  if (billedMissing && total > cached) {
    // Kotaya yansıyan değer verilmemiş: total - cached ile türet.
    effectiveBilledTokens = total - cached;
    warningCode = 'BILLED_TOKENS_DERIVED';
  } else {
    effectiveBilledTokens = billed;
  }

  const discrepancy = cached + billed - total;
  const isExactMatch = discrepancy === 0;

  if (!isExactMatch && warningCode === null) {
    // Girdi/çıktı ağırlıklı (weighted) kota farklılığı.
    warningCode = 'QUOTA_WEIGHTED_TOKENS';
  }

  return { isExactMatch, discrepancy, effectiveBilledTokens, warningCode };
}

/**
 * Faz 5: Tek satırlık maliyeti hesaplar.
 * P_blended = alpha * P_in + (1 - alpha) * P_out
 * C_row = (cached/1e6 * P_cache) + (billed/1e6 * P_blended)
 * @param {object} record
 * @param {object} pricingProfile
 * @param {number} [inputOutputSplitRatio=0.3]
 * @returns {{ cachedCostUSD: number, billedCostUSD: number, totalCostUSD: number, blendedInputOutputCostPerMillion: number }}
 */
export function calculateSingleRowCost(record = {}, pricingProfile = {}, inputOutputSplitRatio = 0.3) {
  const cachedTokens = Number(record.cachedTokens) || 0;
  const billedTokens = Number(record.billedTokens) || 0;

  const pCache = Number(pricingProfile.cachedInputCostPerMillion) || 0;
  const pIn = Number(pricingProfile.uncachedInputCostPerMillion) || 0;
  const pOut = Number(pricingProfile.outputCostPerMillion) || 0;

  const alpha = clamp(inputOutputSplitRatio, 0, 1);
  const blended = alpha * pIn + (1 - alpha) * pOut;

  const cachedCostUSD = round6((cachedTokens / 1e6) * pCache);
  const billedCostUSD = round6((billedTokens / 1e6) * blended);
  const totalCostUSD = round6(cachedCostUSD + billedCostUSD);

  return {
    cachedCostUSD,
    billedCostUSD,
    totalCostUSD,
    blendedInputOutputCostPerMillion: round6(blended),
  };
}

/**
 * Faz 6: Önbellek tasarrufunu (ROI) hesaplar.
 * SavedUSD = max(0, cached/1e6 * (P_in - P_cache))
 * @param {number} cachedTokens
 * @param {number} uncachedInputCostPerMillion
 * @param {number} cachedInputCostPerMillion
 * @returns {{ uncachedCostUSD: number, cachedCostUSD: number, savedUSD: number, savingsPercentage: number }}
 */
export function calculateCacheSavings(cachedTokens, uncachedInputCostPerMillion, cachedInputCostPerMillion) {
  const cached = Number(cachedTokens) || 0;
  const pIn = Number(uncachedInputCostPerMillion) || 0;
  const pCache = Number(cachedInputCostPerMillion) || 0;

  const uncachedCostUSD = round6((cached / 1e6) * pIn);
  const cachedCostUSD = round6((cached / 1e6) * pCache);
  const savedUSD = round6(Math.max(0, uncachedCostUSD - cachedCostUSD));
  const savingsPercentage = pIn > 0
    ? round2(Math.max(0, ((pIn - pCache) / pIn) * 100))
    : 0;

  return { uncachedCostUSD, cachedCostUSD, savedUSD, savingsPercentage };
}

/** Boş özet nesnesi. */
function emptySummary() {
  return {
    recordCount: 0,
    totalRequests: 0,
    totalTokens: 0,
    totalCachedTokens: 0,
    totalBilledTokens: 0,
    totalCachedCostUSD: 0,
    totalBilledCostUSD: 0,
    totalCostUSD: 0,
    totalSavedUSD: 0,
    overallCacheHitRate: 0,
    savingsPercentage: 0,
  };
}

/**
 * Faz 7: Tüm satırları tek geçişte (O(N)) kümülatif olarak toplar.
 * Genel önbellek oranı ağırlıklıdır (satır yüzdelerinin ortalaması DEĞİL).
 * @param {object[]} calculatedRecords
 * @returns {object}
 */
export function aggregateUsageSummaries(calculatedRecords = []) {
  if (!Array.isArray(calculatedRecords) || calculatedRecords.length === 0) {
    return emptySummary();
  }

  const acc = calculatedRecords.reduce((summary, record) => {
    summary.recordCount += 1;
    summary.totalRequests += Number(record.requests) || 0;
    summary.totalTokens += Number(record.totalTokens) || 0;
    summary.totalCachedTokens += Number(record.cachedTokens) || 0;
    summary.totalBilledTokens += Number(record.billedTokens) || 0;
    summary.totalCachedCostUSD += Number(record.cachedCostUSD) || 0;
    summary.totalBilledCostUSD += Number(record.billedCostUSD) || 0;
    summary.totalCostUSD += Number(record.totalCostUSD) || 0;
    summary.totalSavedUSD += Number(record.savedUSD) || 0;
    return summary;
  }, emptySummary());

  acc.totalCachedCostUSD = round6(acc.totalCachedCostUSD);
  acc.totalBilledCostUSD = round6(acc.totalBilledCostUSD);
  acc.totalCostUSD = round6(acc.totalCostUSD);
  acc.totalSavedUSD = round6(acc.totalSavedUSD);
  acc.overallCacheHitRate = calculateCacheHitRatio(acc.totalCachedTokens, acc.totalTokens);

  const withoutCacheCost = acc.totalCachedCostUSD + acc.totalSavedUSD;
  acc.savingsPercentage = withoutCacheCost > 0
    ? round2((acc.totalSavedUSD / withoutCacheCost) * 100)
    : 0;

  return acc;
}
