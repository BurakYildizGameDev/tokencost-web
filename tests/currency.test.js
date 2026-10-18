// tests/currency.test.js
// Faz 9: USD -> TRY / EUR para birimi dönüşüm testleri.
import { describe, it, expect } from 'vitest';
import { convertCurrency } from '../src/services/currency-service.js';

/** Tarayıcılar arası boşluk (U+00A0 / U+202F) farklarını normalleştirir. */
const normalize = (text) => String(text).replace(/[\u00A0\u202F]/g, ' ');

describe('Faz 9: convertCurrency', () => {
  it('USD -> TRY dönüşümü, sembol ve yerel format', () => {
    const result = convertCurrency(13.8, 'TRY', { TRY: 36.5, EUR: 0.92 });
    expect(result.currency).toBe('TRY');
    expect(result.amount).toBe(503.7);
    expect(result.symbol).toBe('₺');
    expect(normalize(result.formatted)).toBe('₺503,70');
  });

  it('USD -> EUR dönüşümü', () => {
    const result = convertCurrency(13.8, 'EUR', { TRY: 36.5, EUR: 0.92 });
    expect(result.amount).toBe(12.7);
    expect(result.symbol).toBe('€');
    expect(normalize(result.formatted)).toBe('€12,70');
  });

  it('USD kimlik dönüşümü (rate = 1)', () => {
    const result = convertCurrency(13.8, 'USD');
    expect(result.amount).toBe(13.8);
    expect(result.symbol).toBe('$');
    expect(result.formatted).toBe('$13.80');
  });

  it('desteklenmeyen para biriminde ERR_UNSUPPORTED_CURRENCY fırlatır', () => {
    expect(() => convertCurrency(10, 'JPY', { TRY: 36.5 })).toThrowError('ERR_UNSUPPORTED_CURRENCY');
  });

  it('customRates içinde tanımlı bilinmeyen kod desteklenir', () => {
    const result = convertCurrency(10, 'GBP', { GBP: 0.8 });
    expect(result.amount).toBe(8);
    expect(result.currency).toBe('GBP');
  });

  it('geçersiz tutarda RangeError fırlatır', () => {
    expect(() => convertCurrency(NaN, 'TRY')).toThrow(RangeError);
    expect(() => convertCurrency(Infinity, 'TRY')).toThrow(RangeError);
  });

  it('varsayılan kurlarla (customRates olmadan) çalışır', () => {
    const result = convertCurrency(10, 'TRY');
    expect(result.amount).toBe(340);
  });
});
