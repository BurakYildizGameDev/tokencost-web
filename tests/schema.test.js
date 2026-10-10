// tests/schema.test.js
// Faz 1: Token kaydı şeması testleri.
import { describe, it, expect } from 'vitest';
import { createTokenRecord, DEFAULT_DATE_LABEL } from '../src/core/schema.js';

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
