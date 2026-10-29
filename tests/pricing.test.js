// tests/pricing.test.js
// Faz 15 - 20: Fiyat kataloğu servisi testleri.
import { describe, it, expect } from 'vitest';
import { applyCustomPriceOverrides } from '../src/services/pricing-service.js';
import { fetchLiteLLMPrices } from '../src/services/pricing-service.js';
import { parseLiteLLMResponse } from '../src/services/pricing-service.js';
import { fetchAndParseOpenRouterPrices } from '../src/services/pricing-service.js';
import { loadPricingCatalog, PRICING_CACHE_KEY } from '../src/services/pricing-service.js';
import { LITELLM_PRICING_URL, OPENROUTER_MODELS_URL } from '../src/services/pricing-service.js';
import { isPricingCacheStale } from '../src/services/pricing-service.js';

/** Bellek içi Storage taklidi (test amaçlı). */
function createMemoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
    _map: map,
  };
}

describe('Faz 15: applyCustomPriceOverrides', () => {
  const base = {
    'mimo-v2.6-pro': {
      modelId: 'mimo-v2.6-pro',
      displayName: 'mimo',
      cachedInputCostPerMillion: 0.5,
      uncachedInputCostPerMillion: 1,
      outputCostPerMillion: 3,
      source: 'litellm',
    },
  };

  it('mevcut fiyatı ezer ve source:custom yapar', () => {
    const result = applyCustomPriceOverrides(base, {
      'mimo-v2.6-pro': { uncachedInputCostPerMillion: 2, outputCostPerMillion: 6 },
    });
    expect(result['mimo-v2.6-pro'].uncachedInputCostPerMillion).toBe(2);
    expect(result['mimo-v2.6-pro'].outputCostPerMillion).toBe(6);
    expect(result['mimo-v2.6-pro'].source).toBe('custom');
  });

  it('katalogda olmayan yeni modeli ekler', () => {
    const result = applyCustomPriceOverrides(base, {
      'new-model': { uncachedInputCostPerMillion: 0.1, outputCostPerMillion: 0.2 },
    });
    expect(Object.keys(result)).toContain('new-model');
    expect(result['new-model'].source).toBe('custom');
  });

  it('ana katalog nesnesini mutate ETMEZ (immutability)', () => {
    const snapshot = JSON.parse(JSON.stringify(base));
    applyCustomPriceOverrides(base, { 'mimo-v2.6-pro': { uncachedInputCostPerMillion: 99 } });
    expect(base).toEqual(snapshot);
  });
});

describe('Faz 16: fetchLiteLLMPrices', () => {
  it('200 OK yanıtını JSON olarak döndürür', async () => {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ 'deepseek-chat': { input_cost_per_token: 1.4e-7 } }),
    });
    const data = await fetchLiteLLMPrices(mockFetch, 1000);
    expect(data['deepseek-chat'].input_cost_per_token).toBe(1.4e-7);
  });

  it('500 yanıtında ERR_LITELLM_FETCH_FAILED: 500 fırlatır', async () => {
    const mockFetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
    await expect(fetchLiteLLMPrices(mockFetch, 1000)).rejects.toThrowError('ERR_LITELLM_FETCH_FAILED: 500');
  });

  it('404 yanıtında ERR_LITELLM_FETCH_FAILED: 404 fırlatır', async () => {
    const mockFetch = async () => ({ ok: false, status: 404 });
    await expect(fetchLiteLLMPrices(mockFetch, 1000)).rejects.toThrowError('ERR_LITELLM_FETCH_FAILED: 404');
  });

  it('timeoutMs aşılırsa AbortController devreye girer', async () => {
    const hangingFetch = (url, { signal }) => new Promise((resolve, reject) => {
      if (signal) signal.addEventListener('abort', () => reject(new Error('aborted')));
    });
    await expect(fetchLiteLLMPrices(hangingFetch, 10)).rejects.toThrowError('ERR_LITELLM_FETCH_TIMEOUT');
  });
});

describe('Faz 17: parseLiteLLMResponse', () => {
  const raw = {
    sample_spec: { input_cost_per_token: 0 },
    'deepseek-chat': {
      input_cost_per_token: 0.00000014,
      cache_read_input_token_cost: 0.000000014,
      output_cost_per_token: 0.00000028,
      mode: 'chat',
    },
    'dall-e-3': { input_cost_per_token: 0.00004, output_cost_per_token: 0, mode: 'image_generation' },
    'broken-model': { litellm_provider: 'x' },
  };

  it('token başı fiyatları 1e6 ile çarparak dönüştürür', () => {
    const catalog = parseLiteLLMResponse(raw);
    expect(catalog['deepseek-chat'].uncachedInputCostPerMillion).toBe(0.14);
    expect(catalog['deepseek-chat'].cachedInputCostPerMillion).toBe(0.014);
    expect(catalog['deepseek-chat'].outputCostPerMillion).toBe(0.28);
    expect(catalog['deepseek-chat'].source).toBe('litellm');
  });

  it('sample_spec, görsel ve bozuk kayıtları filtreler', () => {
    const catalog = parseLiteLLMResponse(raw);
    expect(catalog.sample_spec).toBeUndefined();
    expect(catalog['dall-e-3']).toBeUndefined();
    expect(catalog['broken-model']).toBeUndefined();
  });

  it('cache_read yoksa alan atlanır ve isCacheEstimated:true olur', () => {
    const catalog = parseLiteLLMResponse({
      m: { input_cost_per_token: 1e-7, output_cost_per_token: 2e-7 },
    });
    expect(catalog.m.cachedInputCostPerMillion).toBe(0.05);
    expect(catalog.m.isCacheEstimated).toBe(true);
  });
});

describe('Faz 18: fetchAndParseOpenRouterPrices', () => {
  const openRouterPayload = {
    data: [
      {
        id: 'deepseek/deepseek-chat',
        name: 'DeepSeek Chat',
        pricing: {
          prompt: '0.00000014',
          completion: '0.00000028',
          input_cache_read: '0.000000014',
        },
      },
    ],
  };

  it('string fiyatları floata çevirip 1e6 ile çarpar', async () => {
    const mockFetch = async () => ({ ok: true, status: 200, json: async () => openRouterPayload });
    const catalog = await fetchAndParseOpenRouterPrices(mockFetch);
    const entry = catalog['deepseek/deepseek-chat'];
    expect(entry.uncachedInputCostPerMillion).toBe(0.14);
    expect(entry.outputCostPerMillion).toBe(0.28);
    expect(entry.cachedInputCostPerMillion).toBe(0.014);
    expect(entry.source).toBe('openrouter');
  });

  it('başarısız yanıtta ERR_OPENROUTER_FETCH_FAILED fırlatır', async () => {
    const mockFetch = async () => ({ ok: false, status: 503 });
    await expect(fetchAndParseOpenRouterPrices(mockFetch)).rejects.toThrowError('ERR_OPENROUTER_FETCH_FAILED: 503');
  });
});

describe('Faz 19: loadPricingCatalog', () => {
  const litellmJson = {
    'deepseek-chat': {
      input_cost_per_token: 1.4e-7,
      output_cost_per_token: 2.8e-7,
      cache_read_input_token_cost: 1.4e-8,
    },
  };

  it('geçerli ve taze önbellek varsa ağ isteği yapmaz', async () => {
    const storage = createMemoryStorage();
    const now = 1_000_000_000_000;
    storage.setItem(PRICING_CACHE_KEY, JSON.stringify({
      savedAt: now - 1000,
      catalog: { cachedModel: { modelId: 'cachedModel' } },
    }));
    let fetchCalled = false;
    const fetchFn = async () => {
      fetchCalled = true;
      return { ok: true, status: 200, json: async () => litellmJson };
    };

    const result = await loadPricingCatalog({ storage, fetchFn, now });
    expect(fetchCalled).toBe(false);
    expect(result.source).toBe('cache');
    expect(result.catalog.cachedModel).toBeDefined();
  });

  it('önbellek yoksa LiteLLM denenir ve önbelleğe kaydedilir', async () => {
    const storage = createMemoryStorage();
    const fetchFn = async (url) => {
      if (url === LITELLM_PRICING_URL) return { ok: true, status: 200, json: async () => litellmJson };
      return { ok: false, status: 500 };
    };
    const result = await loadPricingCatalog({ storage, fetchFn, now: 2_000_000_000_000 });
    expect(result.source).toBe('litellm');
    expect(result.isOfflineFallback).toBe(false);
    expect(storage.getItem(PRICING_CACHE_KEY)).not.toBeNull();
  });

  it('LiteLLM başarısızsa OpenRouter denenir', async () => {
    const storage = createMemoryStorage();
    const fetchFn = async (url) => {
      if (url === OPENROUTER_MODELS_URL) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [{ id: 'deepseek/deepseek-chat', pricing: { prompt: '0.00000014', completion: '0.00000028' } }],
          }),
        };
      }
      return { ok: false, status: 500 };
    };
    const result = await loadPricingCatalog({ storage, fetchFn, now: 3_000_000_000_000 });
    expect(result.source).toBe('openrouter');
  });

  it('her iki ağ da başarısızsa statik fallback ve isOfflineFallback:true', async () => {
    const storage = createMemoryStorage();
    const fetchFn = async () => { throw new Error('offline'); };
    const result = await loadPricingCatalog({
      storage,
      fetchFn,
      fallbackData: { 'tier-standard-fallback': { modelId: 'tier-standard-fallback' } },
    });
    expect(result.source).toBe('fallback');
    expect(result.isOfflineFallback).toBe(true);
    expect(result.catalog['tier-standard-fallback']).toBeDefined();
  });

  it('storage.setItem kota hatası fırlatsa bile çökmez', async () => {
    const storage = {
      getItem: () => null,
      setItem: () => { throw new Error('QuotaExceededError'); },
    };
    const fetchFn = async () => ({ ok: true, status: 200, json: async () => litellmJson });
    const result = await loadPricingCatalog({ storage, fetchFn });
    expect(result.source).toBe('litellm');
  });
});

describe('Faz 20: isPricingCacheStale', () => {
  const DAY = 24 * 3600 * 1000;

  it('24 saatten eski timestamp için true (bayat) döner', () => {
    const now = 10 * DAY;
    expect(isPricingCacheStale(now - DAY - 1, 24, now)).toBe(true);
  });

  it('24 saatten yeni timestamp için false (taze) döner', () => {
    const now = 10 * DAY;
    expect(isPricingCacheStale(now - DAY + 1, 24, now)).toBe(false);
  });

  it('geçersiz veya gelecek zamanlı timestamp için güvenli tarafta true döner', () => {
    const now = 10 * DAY;
    expect(isPricingCacheStale(NaN, 24, now)).toBe(true);
    expect(isPricingCacheStale(undefined, 24, now)).toBe(true);
    expect(isPricingCacheStale(now + DAY, 24, now)).toBe(true);
  });

  it('özel TTL değerini dikkate alır', () => {
    const now = 10 * DAY;
    expect(isPricingCacheStale(now - 2 * 3600 * 1000, 1, now)).toBe(true);
    expect(isPricingCacheStale(now - 2 * 3600 * 1000, 3, now)).toBe(false);
  });
});
