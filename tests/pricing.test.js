// tests/pricing.test.js
// Faz 15 - 20: Fiyat kataloğu servisi testleri.
import { describe, it, expect } from 'vitest';
import { applyCustomPriceOverrides } from '../src/services/pricing-service.js';

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
