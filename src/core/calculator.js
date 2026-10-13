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
