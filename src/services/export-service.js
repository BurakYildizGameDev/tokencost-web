// src/services/export-service.js
// Faz 38 - 41: Rapor dışa aktarma servisi (.csv, .pdf, Markdown) ve URL durum paylaşımı.
// KURAL: DOM erişimi yalnızca indirme fonksiyonlarında ve enjekte edilebilir biçimde yapılır
//        (test edilebilirlik). İmza metni TEK MERKEZDEN yönetilir: SIGNATURE_TEXT.

import { aggregateUsageSummaries, groupRecordsByModel } from '../core/calculator.js';
import { formatCostDisplay, formatTokenCount } from '../core/formatter.js';
import { convertCurrency } from './currency-service.js';

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

/** Varsayılan .pdf dosya adı. */
export const DEFAULT_PDF_FILENAME = 'tokencost-report.pdf';

/** .pdf yazdırma çerçevesinin sınıfı (harici araçlar da gizleyebilsin). */
export const PDF_PRINT_FRAME_CLASS = 'pdf-print-frame';

/** HTML özel karakterlerini kaçırır. */
function escapeHtml(value) {
  return String(value === undefined || value === null ? '' : value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}

/** Kur bilgisini convertCurrency için tabloya çevirir. */
function toRateTable(currencyInfo) {
  if (!currencyInfo || typeof currencyInfo !== 'object') return {};
  const code = typeof currencyInfo.code === 'string' ? currencyInfo.code.toUpperCase() : '';
  const rate = Number(currencyInfo.rate);
  if (code === '' || !Number.isFinite(rate) || rate <= 0) return {};
  return { [code]: rate };
}

/**
 * Faz 39: PDF özet kartlarının (etiket + değer + vurgu) listesini üretir.
 * @param {object} summary
 * @param {object} [currencyInfo]
 * @returns {Array<{ label: string, value: string, variant: string }>}
 */
function buildPDFSummaryCards(summary, currencyInfo) {
  const source = summary && typeof summary === 'object' ? summary : {};
  const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

  const savedUSD = num(source.totalSavedUSD);
  const withoutCacheUSD = num(source.totalCachedCostUSD) + savedUSD;
  const invoiceUSD = num(source.totalCostUSD);
  const hitRate = Math.round(num(source.overallCacheHitRate));
  const requests = Math.round(num(source.totalRequests));
  const netTokens = Math.round(num(source.totalBilledTokens) || num(source.totalTokens));

  const code = currencyInfo && typeof currencyInfo.code === 'string'
    ? currencyInfo.code.toUpperCase()
    : 'TRY';
  const converted = convertCurrency(invoiceUSD, code, toRateTable(currencyInfo));

  return [
    {
      label: 'Normalde Ödenecek (Önbelleksiz)',
      value: formatCostDisplay(withoutCacheUSD),
      variant: 'neutral',
    },
    {
      label: `Önbellek Tasarrufu (%${hitRate} Hit)`,
      value: savedUSD > 0 ? `-${formatCostDisplay(savedUSD)} (Kâr)` : formatCostDisplay(0),
      variant: 'success',
    },
    {
      label: code === 'USD' ? 'Gerçek Fatura (USD)' : `Gerçek Fatura (USD & ${code})`,
      value: code === 'USD'
        ? formatCostDisplay(invoiceUSD)
        : `${formatCostDisplay(invoiceUSD)} / ${converted.formatted}`,
      variant: 'accent',
    },
    {
      label: 'Kotaya Yansıyan İstek & Token',
      value: `${formatTokenCount(requests).full} İstek | ${formatTokenCount(netTokens).short} Net Token`,
      variant: 'neutral',
    },
  ];
}

/** Gruplanmış tek model için `<tr>` üretir. */
function buildPDFModelRow(group) {
  const summary = group && group.summary ? group.summary : {};
  const cachedLabel = `%${Math.round(Number(summary.overallCacheHitRate) || 0)}`;

  return [
    '<tr>',
    `<td>${escapeHtml(group && group.model)}</td>`,
    `<td class="num">${formatTokenCount(summary.totalRequests).full}</td>`,
    `<td class="num">${formatTokenCount(summary.totalTokens).full}</td>`,
    `<td class="num">${cachedLabel}</td>`,
    `<td class="num">${formatTokenCount(summary.totalBilledTokens).short}</td>`,
    `<td class="num">${formatCostDisplay(summary.totalCostUSD)}</td>`,
    '</tr>',
  ].join('');
}

/** Kayıt düzeyindeki detay satırını üretir. */
function buildPDFRecordRow(row) {
  return [
    '<tr>',
    `<td>${escapeHtml(row.date)}</td>`,
    `<td>${escapeHtml(row.model)}</td>`,
    `<td class="num">${formatTokenCount(row.requests).full}</td>`,
    `<td class="num">${formatTokenCount(row.totalTokens).full}</td>`,
    `<td class="num">%${Math.round(Number(row.cacheHitRatio) || 0)}</td>`,
    `<td class="num">${formatTokenCount(row.effectiveBilledTokens !== undefined ? row.effectiveBilledTokens : row.billedTokens).short}</td>`,
    `<td class="num">${formatCostDisplay(row.totalCostUSD)}</td>`,
    '</tr>',
  ].join('');
}

/** PDF/yazdırma dostu stil sayfası (her zaman açık tema, A4). */
export const PDF_REPORT_STYLES = [
  '@page { size: A4; margin: 12mm; }',
  '* { box-sizing: border-box; }',
  '.pdf-page { margin: 0; padding: 18px; background: #ffffff; color: #0f172a;',
  "  font-family: 'Segoe UI', Arial, Helvetica, sans-serif; font-size: 12px; }",
  '.pdf-header h1 { margin: 0 0 4px; font-size: 20px; }',
  '.pdf-subtitle { margin: 0 0 16px; color: #64748b; }',
  '.pdf-summary { display: flex; gap: 10px; margin-bottom: 16px; }',
  '.pdf-card { flex: 1; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; }',
  '.pdf-card-label { display: block; margin-bottom: 4px; font-size: 10px; text-transform: uppercase; color: #64748b; }',
  '.pdf-card-value { font-size: 15px; }',
  '.pdf-card--success .pdf-card-value { color: #16a34a; }',
  '.pdf-card--accent .pdf-card-value { color: #2563eb; }',
  '.pdf-section-title { margin: 18px 0 6px; font-size: 13px; }',
  '.pdf-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }',
  '.pdf-table th { background: #f1f5f9; text-align: left; font-size: 10px; text-transform: uppercase; }',
  '.pdf-table th, .pdf-table td { padding: 6px 8px; border: 1px solid #e2e8f0; }',
  '.pdf-table .num { text-align: right; }',
  '.pdf-footer { margin-top: 22px; padding-top: 8px; border-top: 1px solid #e2e8f0;',
  '  text-align: center; font-size: 10px; color: #64748b; }',
].join('\n');

/**
 * Faz 39: A4, beyaz zeminli, yazıcı/PDF dostu tam rapor şablonunu üretir.
 * Koyu tema renkleri KASITLI olarak kullanılmaz; altbilgide imza bulunur.
 * @param {Array<{ model: string, summary: object }>} groupedModels
 * @param {object[]} calculatedRecords
 * @param {object} [summary]
 * @param {{ code?: string, rate?: number, symbol?: string }} [currencyInfo]
 * @returns {string} HTML
 */
export function generatePDFReportHTML(groupedModels, calculatedRecords, summary, currencyInfo) {
  const records = Array.isArray(calculatedRecords) ? calculatedRecords.filter(Boolean) : [];
  const groups = Array.isArray(groupedModels) && groupedModels.length > 0
    ? groupedModels
    : groupRecordsByModel(records);
  const totals = summary && typeof summary === 'object' ? summary : aggregateUsageSummaries(records);
  const cards = buildPDFSummaryCards(totals, currencyInfo);

  const cardHtml = cards.map((card) => [
    `<div class="pdf-card pdf-card--${card.variant}">`,
    `<span class="pdf-card-label">${escapeHtml(card.label)}</span>`,
    `<strong class="pdf-card-value">${escapeHtml(card.value)}</strong>`,
    '</div>',
  ].join('')).join('');

  const modelRows = groups.map(buildPDFModelRow).join('');
  const recordRows = records.map(buildPDFRecordRow).join('');

  const recordSection = records.length > 0
    ? [
      '<h2 class="pdf-section-title">Satır Detayları</h2>',
      '<table class="pdf-table"><thead><tr>',
      '<th>Tarih</th><th>Model</th><th>İstek</th><th>Toplam Token</th>',
      '<th>Önbellek %</th><th>Net Token</th><th>Tahmini Tutar (USD)</th>',
      '</tr></thead><tbody>',
      recordRows,
      '</tbody></table>',
    ].join('')
    : '';

  return [
    '<!DOCTYPE html>',
    '<html lang="tr">',
    '<head>',
    '<meta charset="utf-8" />',
    '<title>TokenCost FinOps Raporu</title>',
    `<style>\n${PDF_REPORT_STYLES}\n</style>`,
    '</head>',
    '<body class="pdf-page">',
    '<header class="pdf-header">',
    '<h1>TokenCost FinOps Analiz Raporu</h1>',
    '<p class="pdf-subtitle">Önbellek ROI analizi ve kota maliyeti özeti</p>',
    '</header>',
    `<section class="pdf-summary">${cardHtml}</section>`,
    '<h2 class="pdf-section-title">Model Bazlı Kullanım ve Maliyet</h2>',
    '<table class="pdf-table"><thead><tr>',
    '<th>Model</th><th>İstek</th><th>Toplam Token</th><th>Önbellek %</th>',
    '<th>Net Token</th><th>Tahmini Tutar (USD)</th>',
    '</tr></thead><tbody>',
    modelRows,
    '</tbody></table>',
    recordSection,
    `<footer class="pdf-footer"><small class="app-signature">${escapeHtml(SIGNATURE_TEXT)}</small></footer>`,
    '</body>',
    '</html>',
  ].join('\n');
}


/**
 * Faz 39: İzole bir iframe içinde raporu yazdırır (tarayıcının "PDF olarak kaydet" akışı).
 * @param {string} reportHTML
 * @param {{ document?: Document }} [environment] Test için enjekte edilir.
 * @returns {{ mode: string, element: HTMLIFrameElement }}
 */
export function printReportHTMLInIframe(reportHTML, environment = {}) {
  const env = environment && typeof environment === 'object' ? environment : {};
  const doc = env.document !== undefined ? env.document : globalThis.document;

  if (!doc || typeof doc.createElement !== 'function') {
    throw new Error('ERR_DOM_UNAVAILABLE');
  }

  const html = typeof reportHTML === 'string' ? reportHTML : '';
  const frame = doc.createElement('iframe');
  frame.className = PDF_PRINT_FRAME_CLASS;
  frame.setAttribute('title', 'PDF yazdırma çerçevesi');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';

  if (doc.body && typeof doc.body.appendChild === 'function') doc.body.appendChild(frame);

  if (frame.contentDocument && typeof frame.contentDocument.write === 'function') {
    frame.contentDocument.open();
    frame.contentDocument.write(html);
    frame.contentDocument.close();
  }

  const frameWindow = frame.contentWindow;
  if (frameWindow) {
    if (typeof frameWindow.focus === 'function') frameWindow.focus();
    if (typeof frameWindow.print === 'function') frameWindow.print();
  }

  return { mode: 'print', element: frame };
}

/**
 * Faz 39: Hibrit .pdf dışa aktarma motoru.
 * html2pdf varsa doğrudan dosya üretir; yoksa yerel yazdırma penceresine düşer.
 * @param {string} reportHTML
 * @param {string} [filename=DEFAULT_PDF_FILENAME]
 * @param {Function} [pdfGeneratorFn] Örn: html2pdf veya (html, options) => Promise
 * @param {{ document?: Document }} [environment] Test için enjekte edilir.
 * @returns {{ mode: 'html2pdf'|'print', filename: string, result?: unknown, element?: HTMLElement }}
 */
export function exportToPDF(reportHTML, filename = DEFAULT_PDF_FILENAME, pdfGeneratorFn, environment = {}) {
  const name = ensureExtension(filename, 'pdf');
  const html = typeof reportHTML === 'string' ? reportHTML : '';
  const injected = typeof pdfGeneratorFn === 'function' ? pdfGeneratorFn : null;
  const globalGenerator = typeof globalThis !== 'undefined' && typeof globalThis.html2pdf === 'function'
    ? globalThis.html2pdf
    : null;
  const generator = injected || globalGenerator;

  if (generator) {
    const result = generator(html, { filename: name });
    return { mode: 'html2pdf', filename: name, result };
  }

  const printed = printReportHTMLInIframe(html, environment);
  return { mode: printed.mode, filename: name, element: printed.element };
}

/** Markdown tablo hücresini güvenli hale getirir (| ve satır sonu kaçışı). */
function escapeMarkdownCell(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ');
}

/** Yüzde değerini 2 basamakla, Türkçe ondalık ayırıcıyla yazar (53.33 → "53,33"). */
function formatPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '0';
  return String(Number(numeric.toFixed(2))).replace('.', ',');
}

/**
 * Faz 40: GitHub Issue / PR içine yapıştırılabilir Markdown raporu üretir.
 * GFM tablo hizalaması `| :--- | ---: |` sözdizimini kullanır.
 * @param {Array<{ model: string, summary: object }>} groupedModels
 * @param {object} [summary]
 * @returns {string} Markdown
 */
export function generateMarkdownReport(groupedModels, summary) {
  const groups = Array.isArray(groupedModels) ? groupedModels.filter(Boolean) : [];
  const fallbackSummary = aggregateUsageSummaries(
    groups.map((group) => (group && group.summary ? group.summary : {})),
  );
  const totals = summary && typeof summary === 'object' ? summary : fallbackSummary;

  const rows = groups.map((group) => {
    const groupSummary = group.summary && typeof group.summary === 'object' ? group.summary : {};
    const model = escapeMarkdownCell(group.model === undefined ? '' : group.model);
    const hitRate = formatPercent(groupSummary.overallCacheHitRate);

    return `| ${model} | ${formatTokenCount(groupSummary.totalRequests).full} | ${formatTokenCount(groupSummary.totalTokens).full}`
      + ` | %${hitRate} | ${formatTokenCount(groupSummary.totalBilledTokens).short}`
      + ` | ${formatCostDisplay(groupSummary.totalCostUSD)} |`;
  });

  const totalRow = `| **TOPLAM** | ${formatTokenCount(totals.totalRequests).full}`
    + ` | ${formatTokenCount(totals.totalTokens).full} | %${formatPercent(totals.overallCacheHitRate)}`
    + ` | ${formatTokenCount(totals.totalBilledTokens).short} | ${formatCostDisplay(totals.totalCostUSD)} |`;

  const savedUSD = Number(totals.totalSavedUSD) || 0;
  const withoutCacheUSD = (Number(totals.totalCachedCostUSD) || 0) + savedUSD;

  return [
    '## TokenCost FinOps Analiz Raporu',
    '',
    '| Model | İstek | Toplam Token | Önbellek (%) | Net Token | Tahmini Tutar (USD) |',
    '| :--- | ---: | ---: | ---: | ---: | ---: |',
    ...rows,
    totalRow,
    '',
    `**Önbellek Tasarrufu:** ${savedUSD > 0 ? `-${formatCostDisplay(savedUSD)} (Kâr)` : formatCostDisplay(0)}`
      + ` — Önbellek isabet oranı: %${formatPercent(totals.overallCacheHitRate)}`,
    `**Normalde Ödenecek (Önbelleksiz):** ${formatCostDisplay(withoutCacheUSD)}`,
    '',
    `<sub>${SIGNATURE_TEXT}</sub>`,
  ].join('\n');
}

/**
 * Faz 40: Raporu panoya kopyalar (tek tıkla paylaşım).
 * Clipboard API yoksa veya hata verirse çökmez, `false` döner.
 * @param {string} markdown
 * @param {{ writeText?: Function }} [clipboard]
 * @returns {Promise<boolean>}
 */
export function copyReportToClipboard(markdown, clipboard) {
  const target = clipboard !== undefined
    ? clipboard
    : (typeof globalThis !== 'undefined' && globalThis.navigator ? globalThis.navigator.clipboard : null);
  const text = typeof markdown === 'string' ? markdown : '';

  if (!target || typeof target.writeText !== 'function') return Promise.resolve(false);

  try {
    return Promise.resolve(target.writeText(text))
      .then(() => true)
      .catch(() => false);
  } catch {
    return Promise.resolve(false);
  }
}
