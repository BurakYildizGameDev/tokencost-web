// src/core/formatter.js
// Faz 10: Dinamik sayı ve para formatlayıcı (Saf / Pure Core katmanı).
// KURAL: DOM manipülasyonu yok, her zaman deterministic string döner.

/** Binlik ayırıcı olarak nokta koyar (Türkçe format). Örn: 333698885 -> "333.698.885" */
function groupThousands(integerValue) {
  return String(integerValue).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Kısaltılmış rozet için ondalığı virgülle ve gereksiz ",0" olmadan biçimler. */
function trimDecimal(value) {
  const fixed = Math.abs(value).toFixed(1);
  return fixed.replace('.', ',').replace(/,0$/, '');
}

/**
 * Faz 10a: Kullanıcı dostu maliyet gösterimi üretir.
 * - 0            -> "$0.00"
 * - 0 < x < 0.001 -> "< $0.001"
 * - 0.001 <= x < 0.01 -> 4 basamak ("$0.0045")
 * - x >= 0.01    -> 2 basamak ("$13.80")
 * @param {number} usdAmount
 * @returns {string}
 */
export function formatCostDisplay(usdAmount) {
  const value = Number(usdAmount);
  if (!Number.isFinite(value) || value === 0) {
    return '$0.00';
  }
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs < 0.001) return `${sign}< $0.001`;
  if (abs < 0.01) return `${sign}$${abs.toFixed(4)}`;
  return `${sign}$${abs.toFixed(2)}`;
}

/**
 * Faz 10b: Token sayısı için hem tam (noktalı) hem de kısaltılmış gösterim üretir.
 * @param {number} tokenCount
 * @returns {{ raw: number, full: string, short: string }}
 */
export function formatTokenCount(tokenCount) {
  const value = Math.round(Number(tokenCount) || 0);
  const abs = Math.abs(value);
  const full = `${value < 0 ? '-' : ''}${groupThousands(abs)}`;

  let short;
  if (abs >= 1e9) short = `${trimDecimal(abs / 1e9)}B`;
  else if (abs >= 1e6) short = `${trimDecimal(abs / 1e6)}M`;
  else if (abs >= 1e3) short = `${trimDecimal(abs / 1e3)}K`;
  else short = String(value);

  return { raw: value, full, short };
}
