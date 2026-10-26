// tests/pricing.test.js
// Faz 15 - 20: Fiyat kataloğu servisi testleri.
import { describe, it, expect } from 'vitest';
import { applyCustomPriceOverrides } from '../src/services/pricing-service.js';
import { fetchLiteLLMPrices } from '../src/services/pricing-service.js';
import { parseLiteLLMResponse } from '../src/services/pricing-service.js';

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
