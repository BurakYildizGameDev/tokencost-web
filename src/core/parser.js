// src/core/parser.js
// Faz 21 - 25: Metin / tablo / TSV ayrıştırıcı (Saf / Pure Core katmanı).
// KURAL: Bu dosyada document, window, localStorage veya fetch KULLANILMAZ.

/** Tarih hücresi deseni: "14 Eki", "3 Ocak" vb. (tek boşluk korunur). */
export const DATE_CELL_PATTERN = /^\d{1,2}\s+[A-Za-zÇĞİÖŞÜçğıöşü]{2,}/;

/** Özet satırı deseni: "Toplam (30 gün)", "Total (30 days)" vb. */
export const SUMMARY_ROW_PATTERN = /^(toplam|total)\b/i;

/** Sekme bulunmadığında sütun ayırıcı olarak kullanılan boşluk dizisi. */
const MULTI_SPACE_SEPARATOR = /\s{2,}/;

/**
 * Faz 21: Ham metin satırını hücrelere ayırır.
 * Önce sekme (\t) aranır; yoksa 2 ve daha fazla ardışık boşluk ayırıcı kabul edilir.
 * Bu sayede "14 Eki" gibi tek boşluk içeren hücreler bölünmez.
 * @param {string} lineText
 * @returns {string[]}
 */
export function tokenizeRawLine(lineText) {
  if (typeof lineText !== 'string' || lineText.trim() === '') return [];

  const line = lineText.replace(/\u00a0/g, ' ').replace(/\r/g, '');
  const separator = line.includes('\t') ? /\t+/ : MULTI_SPACE_SEPARATOR;
  const cells = line.split(separator).map((cell) => cell.trim());

  // Sondaki boş hücreleri (satır sonu sekmesi vb.) at.
  while (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
  return cells;
}

/**
 * Faz 21: Satırın "Toplam (30 gün)" benzeri özet satırı olup olmadığını söyler.
 * Bu satırlar çifte sayımı önlemek için veri satırlarından ayrılır.
 * @param {string} lineText
 * @returns {boolean}
 */
export function isSummaryRow(lineText) {
  if (typeof lineText !== 'string') return false;
  const cells = tokenizeRawLine(lineText);
  const firstCell = cells.length > 0 ? cells[0] : lineText.trim();
  return SUMMARY_ROW_PATTERN.test(firstCell);
}

/** Yüzde değerini 2 ondalık basamağa yuvarlar (number döner). */
function roundPercent(value) {
  return Number(Number(value).toFixed(2));
}

/**
 * Faz 23: "29.312.128 (%96)" gibi önbellek sütununu ayrıştırır.
 * Hem "%96" (Türkçe) hem "96%" (İngilizce) biçimini destekler.
 * @param {unknown} cellText
 * @returns {{ cachedTokens: number, reportedPercentage: number }}
 */
export function parseCachedColumn(cellText) {
  const emptyResult = { cachedTokens: 0, reportedPercentage: 0 };
  if (cellText === undefined || cellText === null) return emptyResult;

  const text = String(cellText).trim();
  if (text === '') return emptyResult;

  const percentMatch = text.match(/\(\s*%?\s*(\d+(?:[.,]\d+)?)\s*%?\s*\)/);
  let reportedPercentage = 0;
  if (percentMatch) {
    const parsed = sanitizeNumberString(percentMatch[1]);
    reportedPercentage = roundPercent(Math.min(100, Math.max(0, parsed)));
  }

  const withoutParentheses = text.replace(/\([^)]*\)/g, '').trim();
  const cachedTokens = Math.max(0, Math.round(sanitizeNumberString(withoutParentheses)));

  return { cachedTokens, reportedPercentage };
}

/**
 * Faz 22: Türkçe/İngilizce sayı metinlerini güvenli şekilde sayıya çevirir.
 * - "30.811.037" → 30811037 (Türkçe binlik ayırıcı)
 * - "1.079"      → 1079      (ondalık DEĞİL!)
 * - "30,811,037" → 30811037  (İngilizce binlik ayırıcı)
 * - "—", "-", "" → 0
 * @param {unknown} rawStr
 * @returns {number}
 */
export function sanitizeNumberString(rawStr) {
  if (rawStr === undefined || rawStr === null) return 0;
  if (typeof rawStr === 'number') return Number.isFinite(rawStr) ? rawStr : 0;

  // Tire işaretleri (— – −) normal tireye indir, boşluk ve parantezli açıklamaları at.
  let text = String(rawStr)
    .replace(/[\u2014\u2013\u2212]/g, '-')
    .replace(/\s/g, '');
  const isNegative = text.startsWith('-');
  text = text.replace(/\([^)]*\)/g, '');

  const digits = text.replace(/[^\d.,]/g, '');
  if (digits === '' || /^[.,]+$/.test(digits)) return 0;

  const dotIndex = digits.lastIndexOf('.');
  const commaIndex = digits.lastIndexOf(',');
  let normalized;

  if (dotIndex !== -1 && commaIndex !== -1) {
    if (dotIndex > commaIndex) {
      // İngilizce: virgül binlik, nokta ondalık → "1,234.56"
      normalized = digits.replace(/,/g, '');
    } else {
      // Türkçe: nokta binlik, virgül ondalık → "1.234,56"
      normalized = digits.replace(/\./g, '').replace(',', '.');
    }
  } else if (dotIndex !== -1) {
    // Yalnızca nokta: 3'lü gruplar binlik ayırıcıdır ("1.079" → 1079).
    normalized = /^\d{1,3}(\.\d{3})+$/.test(digits) ? digits.replace(/\./g, '') : digits;
  } else if (commaIndex !== -1) {
    // Yalnızca virgül: 3'lü gruplar İngilizce binlik ayırıcıdır ("30,811,037" → 30811037).
    normalized = /^\d{1,3}(,\d{3})+$/.test(digits) ? digits.replace(/,/g, '') : digits.replace(',', '.');
  } else {
    normalized = digits;
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) return 0;
  return isNegative ? -value : value;
}

