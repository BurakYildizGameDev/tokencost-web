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

// --- Faz 24: Sütun indeksi otomatik algılama ------------------------------------

/** Başlık kelimesi → alan eşlemesi (öncelik sırası korunur, ASCII'ye katlanmış metinlerle çalışır). */
const HEADER_KEYWORD_RULES = [
  ['model', /\bmodel\b/],
  ['date', /(zaman|tarih|\bdate\b|\btime\b)/],
  ['cachedTokens', /(onbellek|cache)/],
  ['billedTokens', /(kota|yansiyan|billed|charged)/],
  ['requests', /(istek|request|cagri|call)/],
  ['cost', /(ucret|maliyet|cost|tutar|fiyat|price)/],
  ['totalTokens', /(toplam|total|token)/],
];

/** Türkçe harfleri ASCII karşılıklarına katlar (İ→i, ı→i, ş→s, ğ→g, ç→c, ö→o, ü→u). */
const TURKISH_FOLD_MAP = {
  'ı': 'i', 'İ': 'i', 'ş': 's', 'Ş': 's', 'ğ': 'g', 'Ğ': 'g',
  'ç': 'c', 'Ç': 'c', 'ö': 'o', 'Ö': 'o', 'ü': 'u', 'Ü': 'u',
};

/**
 * Başlık metnini karşılaştırmaya hazırlar.
 * NOT: 'İ'.toLowerCase() === 'i̇' (i + birleşik nokta) olduğu için önce Türkçe harfler katlanır.
 * @param {unknown} cell
 * @returns {string}
 */
function foldHeaderText(cell) {
  return String(cell)
    .replace(/[ıİşŞğĞçÇöÖüÜ]/g, (char) => TURKISH_FOLD_MAP[char])
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Başlıksız çıkarımda sayısal hücrelerin doldurulma sırası. */
const NUMERIC_FIELD_ORDER = [
  'requests',
  'totalTokens',
  'cachedTokens',
  'billedTokens',
  'cost',
];

/** Tüm alanları -1 (bulunamadı) olarak başlatan iskelet üretir. */
function createColumnIndexMap(hasHeader) {
  return {
    date: -1,
    model: -1,
    requests: -1,
    totalTokens: -1,
    cachedTokens: -1,
    billedTokens: -1,
    cost: -1,
    hasHeader,
  };
}

/** Bir başlık hücresinin hangi alana ait olduğunu söyler. */
function classifyHeaderCell(cell) {
  const text = foldHeaderText(cell);
  for (const [key, pattern] of HEADER_KEYWORD_RULES) {
    if (pattern.test(text)) return key;
  }
  return null;
}

/** Hücre sayısal mı? (para, yüzde, parantez ve boşluklar temizlendikten sonra) */
function isNumericCell(cell) {
  const normalized = String(cell).replace(/[\u2014\u2013\u2212]/g, '-');
  const stripped = normalized.replace(/[$€₺£%()\s]/g, '');
  if (stripped === '' || !/\d/.test(stripped)) return false;
  return /^[\d.,+\-]+$/.test(stripped);
}

/** Para benzeri hücre: sembol içeriyor veya tam 2 ondalıklı ("0,00", "1.25"). */
function isMoneyCell(cell) {
  const text = String(cell).trim();
  if (/[$€₺£]/.test(text)) return true;
  return /^\d{1,3}[.,]\d{2}$/.test(text) || /^\d+[.,]\d{2}$/.test(text);
}

/**
 * Faz 24: Tablo hücrelerinden sütun indekslerini otomatik çıkarır.
 * Başlık satırı varsa anahtar kelimelere, yoksa veri desenine göre çalışır.
 * Başlıksız durumda ilk veri satırı asla "başlık" sanılıp yutulmaz.
 * @param {string[]} cells
 * @returns {{ date:number, model:number, requests:number, totalTokens:number,
 *             cachedTokens:number, billedTokens:number, cost:number, hasHeader:boolean }}
 */
export function detectColumnIndices(cells) {
  const list = Array.isArray(cells)
    ? cells.map((cell) => (cell === undefined || cell === null ? '' : String(cell).trim()))
    : [];
  if (list.length === 0) return createColumnIndexMap(false);

  const headerKeys = list.map(classifyHeaderCell).filter((key) => key !== null);
  const hasHeader = headerKeys.length >= 2 || list.some((cell) => /^model$/.test(foldHeaderText(cell)));

  if (hasHeader) {
    const indices = createColumnIndexMap(true);
    list.forEach((cell, position) => {
      const key = classifyHeaderCell(cell);
      if (key !== null && indices[key] === -1) indices[key] = position;
    });
    return indices;
  }

  // --- Başlıksız: yapısal çıkarım ---
  const indices = createColumnIndexMap(false);

  list.forEach((cell, position) => {
    if (indices.date === -1 && DATE_CELL_PATTERN.test(cell)) indices.date = position;
  });

  list.forEach((cell, position) => {
    if (
      indices.model === -1
      && position !== indices.date
      && /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(cell)
      && !isNumericCell(cell)
    ) {
      indices.model = position;
    }
  });

  const numericEntries = list
    .map((cell, position) => ({ cell, position }))
    .filter(({ cell, position }) => position !== indices.date
      && position !== indices.model
      && isNumericCell(cell));

  const reserved = new Set();

  // Yüzde ipucu taşıyan hücre önbellek sütunudur.
  for (const { cell, position } of numericEntries) {
    if (indices.cachedTokens === -1 && /\(|%/.test(cell)) {
      indices.cachedTokens = position;
      reserved.add(position);
    }
  }

  // Para benzeri hücre ücret sütunudur.
  for (const { cell, position } of numericEntries) {
    if (indices.cost === -1 && !reserved.has(position) && isMoneyCell(cell)) {
      indices.cost = position;
      reserved.add(position);
    }
  }

  // Kalan sayısal hücreler sırayla doldurulur: istek → toplam → önbellek → kota → ücret.
  for (const { position } of numericEntries) {
    if (reserved.has(position)) continue;
    const nextKey = NUMERIC_FIELD_ORDER.find((key) => indices[key] === -1);
    if (!nextKey) break;
    indices[nextKey] = position;
    reserved.add(position);
  }

  return indices;
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

