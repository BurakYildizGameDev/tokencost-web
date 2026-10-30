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
