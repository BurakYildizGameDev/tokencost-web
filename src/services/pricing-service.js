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
