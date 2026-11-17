// src/services/export-service.js
// Faz 38 - 41: Rapor dışa aktarma servisi (.csv, .pdf, Markdown) ve URL durum paylaşımı.
// KURAL: DOM erişimi yalnızca indirme fonksiyonlarında ve enjekte edilebilir biçimde yapılır
//        (test edilebilirlik). İmza metni TEK MERKEZDEN yönetilir: SIGNATURE_TEXT.

import { aggregateUsageSummaries } from '../core/calculator.js';

/** Uygulamanın her çıktısında (footer, .csv, .pdf, .md) kullanılan tek imza sabiti. */
export const SIGNATURE_TEXT = 'Made by Burak Yıldız';

/** Excel'in Türkçe karakterleri doğru okuması için UTF-8 BOM. */
export const CSV_UTF8_BOM = '\uFEFF';

/** Varsayılan .csv dosya adı. */
export const DEFAULT_CSV_FILENAME = 'tokencost-report.csv';

/** .csv başlık satırı (sırayla). */
export const CSV_COLUMN_HEADERS = Object.freeze([
  'Tarih',
  'Model',
  'İstek',
  'Toplam Token',
  'Önbelleklenen',
  'Kotaya Yansıyan',
  'Önbellek Tasarrufu (USD)',
  'Tahmini Tutar (USD)',
]);

/** Sayıyı güvenli biçimde number yapar (geçersizse 0). */
function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

/** Sayıyı kayan nokta gürültüsü olmadan metne çevirir. */
function formatNumber(value) {
  const numeric = toNumber(value);
  if (Number.isInteger(numeric)) return String(numeric);
  return String(Number(numeric.toFixed(6)));
}

/**
 * Tek bir CSV hücresini RFC 4180'a göre güvenli hale getirir.
 * Virgül, çift tırnak, noktalı virgül veya yeni satır içeriyorsa hücre tırnaklanır
 * ve içteki tırnaklar ikizlenir.
 * @param {unknown} value
 * @returns {string}
 */
export function escapeCSVCell(value) {
  const text = value === undefined || value === null ? '' : String(value);
  if (!/[",;\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

/** Bir CSV satırını oluşturur. */
function toCSVLine(cells) {
  return cells.map(escapeCSVCell).join(',');
}

/**
 * Faz 38: Hesaplanmış kayıtları UTF-8 BOM'lu .csv içeriğine çevirir.
 * Sıralama: başlık + veri satırları + TOPLAM satırı + imza satırı.
 * @param {object[]} calculatedRecords
 * @param {object} [summary] Verilmezse kayıtlardan hesaplanır.
 * @returns {string}
 */
export function generateCSVContent(calculatedRecords, summary) {
  const rows = Array.isArray(calculatedRecords)
    ? calculatedRecords.filter((row) => row && typeof row === 'object')
    : [];
  const totals = summary && typeof summary === 'object' ? summary : aggregateUsageSummaries(rows);

  const lines = [toCSVLine(CSV_COLUMN_HEADERS)];

  for (const row of rows) {
    lines.push(toCSVLine([
      row.date,
      row.model,
      Math.round(toNumber(row.requests)),
      Math.round(toNumber(row.totalTokens)),
      Math.round(toNumber(row.cachedTokens)),
      Math.round(toNumber(row.effectiveBilledTokens !== undefined ? row.effectiveBilledTokens : row.billedTokens)),
      formatNumber(row.savedUSD),
      formatNumber(row.totalCostUSD),
    ]));
  }

  lines.push(toCSVLine([
    'TOPLAM',
    '',
    Math.round(toNumber(totals.totalRequests)),
    Math.round(toNumber(totals.totalTokens)),
    Math.round(toNumber(totals.totalCachedTokens)),
    Math.round(toNumber(totals.totalBilledTokens)),
    formatNumber(totals.totalSavedUSD),
    formatNumber(totals.totalCostUSD),
  ]));

  // En alt açıklama satırı: imza her zaman tırnaklı tek hücre olarak yazılır.
  lines.push(`"${SIGNATURE_TEXT}"`);

  return CSV_UTF8_BOM + lines.join('\n');
}

/** Dosya adının ilgili uzantıyla bitmesini sağlar. */
function ensureExtension(filename, extension) {
  const name = typeof filename === 'string' && filename.trim() !== ''
    ? filename.trim()
    : `tokencost-report.${extension}`;
  return name.toLowerCase().endsWith(`.${extension}`) ? name : `${name}.${extension}`;
}

/**
 * Faz 38: Metni tarayıcıda dosya olarak indirir (zero-backend, sunucu yok).
 * `URL.createObjectURL` yoksa `data:` bağlantısına düşer (jsdom/yaşlı tarayıcı).
 * @param {string} csvContent
 * @param {string} [filename=DEFAULT_CSV_FILENAME]
 * @param {{ document?: Document, Blob?: Function, URL?: object }} [environment] Test için enjekte edilir.
 * @returns {{ blob: Blob, filename: string, link: HTMLAnchorElement, objectUrl: string|null }}
 */
export function downloadCSVFile(csvContent, filename = DEFAULT_CSV_FILENAME, environment = {}) {
  const env = environment && typeof environment === 'object' ? environment : {};
  const doc = env.document !== undefined ? env.document : globalThis.document;
  const BlobCtor = env.Blob || globalThis.Blob;
  const URLImpl = env.URL || globalThis.URL;

  if (!doc || typeof doc.createElement !== 'function') {
    throw new Error('ERR_DOM_UNAVAILABLE');
  }

  const text = typeof csvContent === 'string' ? csvContent : '';
  const safeName = ensureExtension(filename, 'csv');
  const blob = new BlobCtor([text], { type: 'text/csv;charset=utf-8;' });

  const canUseObjectUrl = URLImpl && typeof URLImpl.createObjectURL === 'function';
  const objectUrl = canUseObjectUrl ? URLImpl.createObjectURL(blob) : null;

  const link = doc.createElement('a');
  link.href = objectUrl || `data:text/csv;charset=utf-8,${encodeURIComponent(text)}`;
  link.download = safeName;
  link.rel = 'noopener';
  link.style.display = 'none';

  doc.body.appendChild(link);
  link.click();
  if (typeof link.remove === 'function') link.remove();

  if (objectUrl && typeof URLImpl.revokeObjectURL === 'function') {
    // İndirmenin başlaması için bir tur bekle, sonra belleği serbest bırak.
    if (typeof setTimeout === 'function') setTimeout(() => URLImpl.revokeObjectURL(objectUrl), 0);
    else URLImpl.revokeObjectURL(objectUrl);
  }

  return { blob, filename: safeName, link, objectUrl };
}
