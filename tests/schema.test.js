// tests/schema.test.js
// Faz 1 - 2: Token kaydı ve fiyat profili şeması testleri.
import { describe, it, expect } from 'vitest';
import {
  createTokenRecord,
  createPricingProfile,
  VALID_PRICING_SOURCES,
  DEFAULT_DATE_LABEL,
} from '../src/core/schema.js';

describe('Faz 1: createTokenRecord', () => {
  it('geçerli parametrelerle dondurulmuş (frozen) standart bir nesne döndürür', () => {
    const record = createTokenRecord({
      model: 'deepseek-v4.1-flash',
      requests: 341,
      totalTokens: 30811037,
      cachedTokens: 29312128,
      billedTokens: 2378273,
    });

    expect(Object.isFrozen(record)).toBe(true);
    expect(record.model).toBe('deepseek-v4.1-flash');
    expect(record.requests).toBe(341);
    expect(record.totalTokens).toBe(30811037);
    expect(record.cachedTokens).toBe(29312128);
    expect(record.billedTokens).toBe(2378273);
    expect(record.id).toMatch(/^rec_/);
  });

  it('her kayda benzersiz bir id atar', () => {
    const a = createTokenRecord({ model: 'm', requests: 1 });
    const b = createTokenRecord({ model: 'm', requests: 1 });
    expect(a.id).not.toBe(b.id);
  });

  it('model boş / null / sadece boşluk olduğunda ERR_INVALID_MODEL_NAME fırlatır', () => {
    expect(() => createTokenRecord({ model: '', requests: 1 })).toThrowError('ERR_INVALID_MODEL_NAME');
    expect(() => createTokenRecord({ model: null })).toThrow(TypeError);
    expect(() => createTokenRecord({ model: '   ' })).toThrowError('ERR_INVALID_MODEL_NAME');
    expect(() => createTokenRecord({})).toThrowError('ERR_INVALID_MODEL_NAME');
  });

  it('negatif / NaN / Infinity sayısal alanlarda ERR_NEGATIVE_OR_INVALID_NUMBER fırlatır', () => {
    expect(() => createTokenRecord({ model: 'm', requests: -1 })).toThrowError('ERR_NEGATIVE_OR_INVALID_NUMBER');
    expect(() => createTokenRecord({ model: 'm', totalTokens: -500 })).toThrow(RangeError);
    expect(() => createTokenRecord({ model: 'm', cachedTokens: NaN })).toThrowError('ERR_NEGATIVE_OR_INVALID_NUMBER');
    expect(() => createTokenRecord({ model: 'm', billedTokens: Infinity })).toThrow(RangeError);
  });

  it('date verilmezse "Belirtilmedi" atanır, verilirse trim edilir', () => {
    const a = createTokenRecord({ model: 'm', requests: 0 });
    expect(a.date).toBe(DEFAULT_DATE_LABEL);
    const b = createTokenRecord({ date: '  14 Eki  ', model: 'm' });
    expect(b.date).toBe('14 Eki');
  });

  it('verilmeyen sayısal alanları 0 kabul eder', () => {
    const record = createTokenRecord({ model: 'm' });
    expect(record.requests).toBe(0);
    expect(record.totalTokens).toBe(0);
    expect(record.cachedTokens).toBe(0);
    expect(record.billedTokens).toBe(0);
  });
});

describe('Faz 2: createPricingProfile', () => {
  it('1 milyon token başına USD maliyetleri doğru saklar', () => {
    const profile = createPricingProfile({
      modelId: 'deepseek-chat',
      displayName: 'DeepSeek Chat',
      cachedInputCostPerMillion: 0.014,
      uncachedInputCostPerMillion: 0.14,
      outputCostPerMillion: 0.28,
      source: 'litellm',
    });

    expect(profile.cachedInputCostPerMillion).toBe(0.014);
    expect(profile.uncachedInputCostPerMillion).toBe(0.14);
    expect(profile.outputCostPerMillion).toBe(0.28);
    expect(profile.source).toBe('litellm');
    expect(profile.isCacheEstimated).toBe(false);
    expect(Object.isFrozen(profile)).toBe(true);
  });

  it('VALID_PRICING_SOURCES yalnızca izin verilen 4 değeri içerir', () => {
    expect(VALID_PRICING_SOURCES).toEqual(['litellm', 'openrouter', 'custom', 'fallback']);
  });

  it('geçersiz source değerinde ERR_INVALID_PRICING_SOURCE fırlatır', () => {
    expect(() => createPricingProfile({
      modelId: 'm',
      uncachedInputCostPerMillion: 0.14,
      outputCostPerMillion: 0.28,
      source: 'bogus',
    })).toThrowError('ERR_INVALID_PRICING_SOURCE');
  });

  it('cachedInputCostPerMillion yoksa %50 varsayar ve isCacheEstimated:true ekler', () => {
    const profile = createPricingProfile({
      modelId: 'm',
      uncachedInputCostPerMillion: 0.14,
      outputCostPerMillion: 0.28,
      source: 'fallback',
    });
    expect(profile.cachedInputCostPerMillion).toBe(0.07);
    expect(profile.isCacheEstimated).toBe(true);

    const profileNull = createPricingProfile({
      modelId: 'm2',
      cachedInputCostPerMillion: null,
      uncachedInputCostPerMillion: 0.2,
      outputCostPerMillion: 0.4,
      source: 'custom',
    });
    expect(profileNull.cachedInputCostPerMillion).toBe(0.1);
    expect(profileNull.isCacheEstimated).toBe(true);
  });

  it('string fiyatları parseFloat ile kabul eder, negatifleri reddeder', () => {
    const profile = createPricingProfile({
      modelId: 'm',
      cachedInputCostPerMillion: '0.014',
      uncachedInputCostPerMillion: '0.14',
      outputCostPerMillion: '0.28',
      source: 'openrouter',
    });
    expect(profile.uncachedInputCostPerMillion).toBe(0.14);
    expect(profile.outputCostPerMillion).toBe(0.28);

    expect(() => createPricingProfile({
      modelId: 'm',
      uncachedInputCostPerMillion: -1,
      outputCostPerMillion: 0.28,
      source: 'litellm',
    })).toThrow(RangeError);
  });
});
