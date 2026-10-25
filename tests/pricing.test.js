// tests/pricing.test.js
// Faz 15 - 20: Fiyat kataloğu servisi testleri.
import { describe, it, expect } from 'vitest';
import { applyCustomPriceOverrides } from '../src/services/pricing-service.js';
import { fetchLiteLLMPrices } from '../src/services/pricing-service.js';

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
