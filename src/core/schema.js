// src/core/schema.js
// Faz 1 - 2: Çekirdek token ve fiyat veri modelleri ile doğrulama (Saf / Pure Core katmanı).
// KURAL: Bu dosyada document, window, localStorage veya fetch KULLANILMAZ.

/** Geçerli fiyat kaynakları. */
export const VALID_PRICING_SOURCES = Object.freeze([
  'litellm',
  'openrouter',
  'custom',
  'fallback',
]);

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

/**
 * Fiyat değerini ondalık sayıya çevirir ve doğrular.
 * String fiyatlar (API'den gelen "0.14" gibi) parseFloat ile dönüştürülür.
 * @param {unknown} value
 * @param {string} fieldName
 * @returns {number}
 */
function parsePrice(value, fieldName) {
  let numeric = value;
  if (typeof numeric === 'string') {
    numeric = parseFloat(numeric);
  }
  if (typeof numeric !== 'number' || !Number.isFinite(numeric) || numeric < 0) {
    throw new RangeError('ERR_NEGATIVE_OR_INVALID_NUMBER');
  }
  return numeric;
}

/**
 * Faz 2: 1 Milyon ($10^6$) token başına USD cinsinden bir fiyat profili üretir.
 * @param {object} params
 * @param {string} params.modelId
 * @param {string} [params.displayName]
 * @param {number|string} [params.cachedInputCostPerMillion]
 * @param {number|string} params.uncachedInputCostPerMillion
 * @param {number|string} params.outputCostPerMillion
 * @param {'litellm'|'openrouter'|'custom'|'fallback'} params.source
 * @returns {Readonly<object>}
 */
export function createPricingProfile({
  modelId,
  displayName,
  cachedInputCostPerMillion,
  uncachedInputCostPerMillion,
  outputCostPerMillion,
  source,
} = {}) {
  if (typeof modelId !== 'string' || modelId.trim() === '') {
    throw new TypeError('ERR_INVALID_MODEL_ID');
  }
  if (!VALID_PRICING_SOURCES.includes(source)) {
    throw new Error('ERR_INVALID_PRICING_SOURCE');
  }

  const uncached = parsePrice(uncachedInputCostPerMillion, 'uncachedInputCostPerMillion');
  const output = parsePrice(outputCostPerMillion, 'outputCostPerMillion');

  let cached;
  let isCacheEstimated = false;
  if (cachedInputCostPerMillion === undefined || cachedInputCostPerMillion === null) {
    // Önbellek fiyatı yoksa girdi fiyatının %50'si varsayılır.
    cached = Number((uncached * 0.5).toFixed(6));
    isCacheEstimated = true;
  } else {
    cached = parsePrice(cachedInputCostPerMillion, 'cachedInputCostPerMillion');
  }

  const profile = {
    modelId: modelId.trim(),
    displayName: typeof displayName === 'string' && displayName.trim() !== ''
      ? displayName.trim()
      : modelId.trim(),
    cachedInputCostPerMillion: cached,
    uncachedInputCostPerMillion: uncached,
    outputCostPerMillion: output,
    source,
    isCacheEstimated,
  };

  return Object.freeze(profile);
}
