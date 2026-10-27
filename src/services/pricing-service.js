// src/services/pricing-service.js
// Faz 15 - 20: Fiyat kataloğu servisi (LiteLLM/OpenRouter fetch + offline fallback zinciri).
// KURAL: Core değil; fetch/localStorage kullanılabilir ancak test edilebilirlik için DI tercih edilir.

import { createPricingProfile } from '../core/schema.js';

/** Değeri güvenli biçimde sayıya çevirir; geçersizse null döner. */
function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** 6 ondalık basamağa yuvarlar. */
function round6(value) {
  return Number(value.toFixed(6));
}

/** 1 token başı fiyatı 1 milyon token başı fiyata çevirir. */
function perTokenToPerMillion(perToken) {
  return round6(perToken * 1e6);
}

/**
 * Faz 15: Kullanıcı tanımlı fiyat geçersiz kılmalarını uygular (immutable).
 * @param {Record<string, object>} baseCatalog
 * @param {Record<string, object>} userOverrides
 * @returns {Record<string, object>}
 */
export function applyCustomPriceOverrides(baseCatalog = {}, userOverrides = {}) {
  const catalog = {};
  for (const [id, profile] of Object.entries(baseCatalog || {})) {
    catalog[id] = { ...profile };
  }

  for (const [id, override] of Object.entries(userOverrides || {})) {
    const existing = catalog[id] || {};
    catalog[id] = createPricingProfile({
      modelId: id,
      displayName: override.displayName || existing.displayName || id,
      cachedInputCostPerMillion:
        override.cachedInputCostPerMillion !== undefined
          ? override.cachedInputCostPerMillion
          : existing.cachedInputCostPerMillion,
      uncachedInputCostPerMillion:
        override.uncachedInputCostPerMillion !== undefined
          ? override.uncachedInputCostPerMillion
          : existing.uncachedInputCostPerMillion,
      outputCostPerMillion:
        override.outputCostPerMillion !== undefined
          ? override.outputCostPerMillion
          : existing.outputCostPerMillion,
      source: 'custom',
    });
  }

  return catalog;
}

/** Faz 16: LiteLLM fiyat veri seti URL'i. */
export const LITELLM_PRICING_URL = 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';

/**
 * Faz 16: LiteLLM fiyat JSON'unu AbortController zaman aşımı koruması ile çeker.
 * @param {Function} [fetchFn=globalThis.fetch]
 * @param {number} [timeoutMs=5000]
 * @returns {Promise<object>}
 */
export async function fetchLiteLLMPrices(fetchFn = globalThis.fetch, timeoutMs = 5000) {
  if (typeof fetchFn !== 'function') {
    throw new Error('ERR_FETCH_UNAVAILABLE');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchFn(LITELLM_PRICING_URL, { signal: controller.signal });
    if (!response || !response.ok) {
      const status = response ? response.status : 'UNKNOWN';
      throw new Error(`ERR_LITELLM_FETCH_FAILED: ${status}`);
    }
    return await response.json();
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('ERR_LITELLM_FETCH_TIMEOUT');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** Görsel/ses/video modları (metin fiyatlandırması dışı). */
const NON_TEXT_MODE_PATTERN = /image|audio|video/i;

/**
 * Faz 17: LiteLLM ham JSON'unu standart ModelPricing kataloğuna dönüştürür.
 * NOT: LiteLLM fiyatları 1 TOKEN başınadır; 1e6 ile çarpılmalıdır.
 * @param {object} rawJson
 * @returns {Record<string, object>}
 */
export function parseLiteLLMResponse(rawJson = {}) {
  const catalog = {};

  for (const [modelId, entry] of Object.entries(rawJson || {})) {
    if (modelId === 'sample_spec') continue;
    if (!entry || typeof entry !== 'object') continue;
    if (typeof entry.mode === 'string' && NON_TEXT_MODE_PATTERN.test(entry.mode)) continue;

    const inputPerToken = toNumber(entry.input_cost_per_token);
    const outputPerToken = toNumber(entry.output_cost_per_token);
    if (inputPerToken === null || outputPerToken === null) continue;

    const cachePerToken = toNumber(entry.cache_read_input_token_cost);

    catalog[modelId] = createPricingProfile({
      modelId,
      displayName: modelId,
      cachedInputCostPerMillion: cachePerToken === null ? undefined : perTokenToPerMillion(cachePerToken),
      uncachedInputCostPerMillion: perTokenToPerMillion(inputPerToken),
      outputCostPerMillion: perTokenToPerMillion(outputPerToken),
      source: 'litellm',
    });
  }

  return catalog;
}

/** Faz 18: OpenRouter canlı modeller endpoint'i. */
export const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';

/**
 * Faz 18: OpenRouter yanıtını standart ModelPricing kataloğuna dönüştürür.
 * NOT: OpenRouter fiyatları STRING gelir (parseFloat zorunlu) ve 1 token başınadır.
 * @param {object} payload
 * @returns {Record<string, object>}
 */
export function parseOpenRouterResponse(payload = {}) {
  const catalog = {};
  const list = Array.isArray(payload?.data) ? payload.data : [];

  for (const model of list) {
    if (!model || typeof model !== 'object' || typeof model.id !== 'string') continue;
    const pricing = model.pricing || {};
    const prompt = toNumber(pricing.prompt);
    const completion = toNumber(pricing.completion);
    if (prompt === null || completion === null) continue;

    const cacheRead = toNumber(pricing.input_cache_read);

    catalog[model.id] = createPricingProfile({
      modelId: model.id,
      displayName: model.name || model.id,
      cachedInputCostPerMillion: cacheRead === null ? undefined : perTokenToPerMillion(cacheRead),
      uncachedInputCostPerMillion: perTokenToPerMillion(prompt),
      outputCostPerMillion: perTokenToPerMillion(completion),
      source: 'openrouter',
    });
  }

  return catalog;
}

/**
 * Faz 18: OpenRouter canlı fiyatlarını çeker ve ayrıştırır.
 * @param {Function} [fetchFn=globalThis.fetch]
 * @returns {Promise<Record<string, object>>}
 */
export async function fetchAndParseOpenRouterPrices(fetchFn = globalThis.fetch) {
  if (typeof fetchFn !== 'function') {
    throw new Error('ERR_FETCH_UNAVAILABLE');
  }
  const response = await fetchFn(OPENROUTER_MODELS_URL);
  if (!response || !response.ok) {
    const status = response ? response.status : 'UNKNOWN';
    throw new Error(`ERR_OPENROUTER_FETCH_FAILED: ${status}`);
  }
  const payload = await response.json();
  return parseOpenRouterResponse(payload);
}
