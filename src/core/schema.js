// src/core/schema.js
// Faz 1: Çekirdek token kullanım kaydı modeli ve doğrulama (Saf / Pure Core katmanı).
// KURAL: Bu dosyada document, window, localStorage veya fetch KULLANILMAZ.

/** Tarih verilmediğinde kullanılan varsayılan etiket. */
export const DEFAULT_DATE_LABEL = 'Belirtilmedi';

// Hızlı ardışık çağrılarda da benzersizliği garanti eden iç sayaç.
let __recordCounter = 0;

/**
 * Kısa ve benzersiz bir kayıt kimliği üretir.
 * Örn: rec_1a2b3c4d_17_k9f2x
 * @returns {string}
 */
function generateRecordId() {
  __recordCounter += 1;
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 7);
  return `rec_${stamp}_${__recordCounter}_${rand}`;
}

/**
 * Sayısal alanları doğrular (negatif, NaN, Infinity, yanlış tip reddedilir).
 * @param {unknown} value
 * @param {string} fieldName
 * @returns {number}
 */
function assertNonNegativeFinite(value, fieldName) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new RangeError('ERR_NEGATIVE_OR_INVALID_NUMBER');
  }
  return value;
}

/**
 * Faz 1: Standart bir token kullanım kaydı üretir.
 * @param {object} params
 * @param {string} [params.date]
 * @param {string} params.model
 * @param {number} params.requests
 * @param {number} params.totalTokens
 * @param {number} params.cachedTokens
 * @param {number} params.billedTokens
 * @returns {Readonly<object>}
 */
export function createTokenRecord({
  date,
  model,
  requests,
  totalTokens,
  cachedTokens,
  billedTokens,
} = {}) {
  if (typeof model !== 'string' || model.trim() === '') {
    throw new TypeError('ERR_INVALID_MODEL_NAME');
  }

  const normalizedRequests = requests === undefined || requests === null
    ? 0
    : assertNonNegativeFinite(requests, 'requests');
  const normalizedTotal = totalTokens === undefined || totalTokens === null
    ? 0
    : assertNonNegativeFinite(totalTokens, 'totalTokens');
  const normalizedCached = cachedTokens === undefined || cachedTokens === null
    ? 0
    : assertNonNegativeFinite(cachedTokens, 'cachedTokens');
  const normalizedBilled = billedTokens === undefined || billedTokens === null
    ? 0
    : assertNonNegativeFinite(billedTokens, 'billedTokens');

  const record = {
    id: generateRecordId(),
    date: typeof date === 'string' && date.trim() !== '' ? date.trim() : DEFAULT_DATE_LABEL,
    model: model.trim(),
    requests: normalizedRequests,
    totalTokens: normalizedTotal,
    cachedTokens: normalizedCached,
    billedTokens: normalizedBilled,
  };

  return Object.freeze(record);
}
