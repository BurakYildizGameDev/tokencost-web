// src/services/currency-service.js
// Faz 9: USD -> TRY / EUR para birimi dönüştürücü.
// KURAL: Saf hesaplama; ağ/localStorage erişimi yok. Kurlar parametre olarak alınır.

/** Desteklenen para birimleri ve varsayılan meta verileri. */
export const CURRENCY_META = Object.freeze({
  USD: { symbol: '$', locale: 'en-US' },
  TRY: { symbol: '₺', locale: 'tr-TR' },
  EUR: { symbol: '€', locale: 'tr-TR' },
});

/** Kurlar verilmediğinde kullanılan güvenli varsayılanlar (USD tabanlı). */
export const DEFAULT_RATES = Object.freeze({
  USD: 1,
  TRY: 34.0,
  EUR: 0.92,
});

/** 2 ondalık basamağa yuvarlar (number döner). */
function round2(value) {
  return Number(value.toFixed(2));
}

/** Tarayıcılar arası boşluk (U+00A0 / U+202F) farklarını normalleştirir. */
function normalizeSpaces(text) {
  return String(text).replace(/[\u00A0\u202F]/g, ' ');
}

/**
 * Faz 9: USD tutarını hedef para birimine çevirir ve yerel formatta döner.
 * @param {number} usdAmount
 * @param {string} targetCurrency - 'USD' | 'TRY' | 'EUR' (veya customRates içinde tanımlı kod)
 * @param {Record<string, number>} [customRates]
 * @returns {{ currency: string, amount: number, symbol: string, formatted: string, rate: number }}
 */
export function convertCurrency(usdAmount, targetCurrency, customRates = {}) {
  const amountUSD = Number(usdAmount);
  if (!Number.isFinite(amountUSD)) {
    throw new RangeError('ERR_INVALID_AMOUNT');
  }

  const code = String(targetCurrency || '').trim().toUpperCase();
  const overrides = customRates && typeof customRates === 'object' ? customRates : {};
  const meta = CURRENCY_META[code];
  const hasOverride = Object.prototype.hasOwnProperty.call(overrides, code);

  if (!meta && !hasOverride) {
    throw new Error('ERR_UNSUPPORTED_CURRENCY');
  }

  const rate = hasOverride ? Number(overrides[code]) : DEFAULT_RATES[code];
  if (!Number.isFinite(rate) || rate < 0) {
    throw new RangeError('ERR_INVALID_RATE');
  }

  const amount = round2(amountUSD * rate);
  const symbol = meta ? meta.symbol : code;
  const locale = meta ? meta.locale : 'en-US';

  let formatted;
  try {
    formatted = normalizeSpaces(
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: code,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount),
    );
  } catch {
    // Bilinmeyen kodlar için Intl hata verirse güvenli metin formatına düş.
    formatted = `${symbol}${amount.toFixed(2)}`;
  }

  return { currency: code, amount, symbol, formatted, rate };
}
