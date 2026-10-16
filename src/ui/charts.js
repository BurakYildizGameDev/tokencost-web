// src/ui/charts.js
// Faz 36: Sıfır bağımlılıklı saf SVG halka (donut) grafik üretici.
// Faz 48: Aynı dosyaya model başına yatay çubuk (bar) grafik üreticisi eklendi.
// KURAL: Chart.js / D3.js / canvas KULLANILMAZ. DOM'a dokunmaz; string döner
//        (çağıran katman innerHTML veya insertAdjacentHTML ile yerleştirir).

import { formatCostDisplay } from '../core/formatter.js';
import { t } from '../core/i18n.js';

/** SVG tuval boyutu (viewBox birimi). */
export const DONUT_VIEWBOX_SIZE = 200;

/** Halkanın yarıçapı (viewBox birimi). Çevre: C = 2πr ≈ 439.82297 */
export const DONUT_RADIUS = 70;

/** Halka kalınlığı. */
export const DONUT_STROKE_WIDTH = 24;

/** Hiç maliyet yoksa gösterilen nötr halka rengi. */
export const DONUT_EMPTY_COLOR = '#e2e8f0';

/** Dilim renk paleti (koyu/açık temada okunabilir tonlar). */
export const CHART_COLORS = Object.freeze([
  '#6366f1',
  '#22c55e',
  '#f59e0b',
  '#06b6d4',
  '#ef4444',
  '#a855f7',
  '#84cc16',
  '#f97316',
]);

/** 2 ondalık basamağa yuvarlar (string tekrarını ve kayar nokta gürültüsünü önler). */
function round2(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Number(numeric.toFixed(2));
}

/** XML özel karakterlerini kaçırır (model adı üzerinden enjeksiyonu engeller). */
function escapeXml(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  })[char]);
}

/** Paletten sırayla renk seçer (palet bitince başa döner). */
function colorAt(index) {
  return CHART_COLORS[index % CHART_COLORS.length];
}

/**
 * Gruplanmış modelleri maliyeti pozitif olan dilimlere indirger (girdi sırası korunur).
 * @param {Array<{ model: string, summary: object }>} groupedModels
 * @returns {Array<{ model: string, cost: number }>}
 */
function toSegments(groupedModels) {
  const list = Array.isArray(groupedModels) ? groupedModels : [];
  const segments = [];

  for (const group of list) {
    if (!group || typeof group !== 'object') continue;
    const cost = Number(group.summary && group.summary.totalCostUSD);
    if (!Number.isFinite(cost) || cost <= 0) continue;
    const model = typeof group.model === 'string' && group.model.trim() !== ''
      ? group.model.trim()
      : 'Bilinmeyen Model';
    segments.push({ model, cost });
  }

  return segments;
}

/**
 * Faz 36: Model bazlı maliyet dağılımını saf SVG halka (donut) grafiğine çevirir.
 * Her dilim, maliyetinin toplama oranı kadar yay uzunluğu alır:
 * dash = (percentage / 100) * C, dashoffset = -(önceki dilimlerin yay toplamı).
 * Toplam maliyet 0 ise gri boş halka döner; asla NaN/undefined üretilmez.
 * @param {Array<{ model: string, summary: object }>} groupedModels
 * @param {{ ariaLabel?: string, size?: number, radius?: number, strokeWidth?: number }} [options]
 * @returns {string} SVG işaretlemesi
 */
export function generateModelCostDonutSVG(groupedModels, options = {}) {
  const size = Number(options.size) > 0 ? Number(options.size) : DONUT_VIEWBOX_SIZE;
  const radius = Number(options.radius) > 0 ? Number(options.radius) : DONUT_RADIUS;
  const strokeWidth = Number(options.strokeWidth) > 0 ? Number(options.strokeWidth) : DONUT_STROKE_WIDTH;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  const segments = toSegments(groupedModels);
  const total = segments.reduce((sum, segment) => sum + segment.cost, 0);

  const ariaLabel = options.ariaLabel || t('chart.donut.aria');
  const parts = [
    `<svg class="donut-chart" viewBox="0 0 ${size} ${size}" role="img"`
    + ` aria-label="${escapeXml(ariaLabel)}" xmlns="http://www.w3.org/2000/svg">`,
  ];

  if (!Number.isFinite(total) || total <= 0) {
    parts.push(`<title>${escapeXml(t('chart.empty'))}</title>`);
    parts.push(
      `<circle class="donut-track" cx="${center}" cy="${center}" r="${radius}" fill="none"`
      + ` stroke="${DONUT_EMPTY_COLOR}" stroke-width="${strokeWidth}"`
      + ` stroke-dasharray="${round2(circumference)} 0" stroke-dashoffset="0" data-empty="true" />`,
    );
    parts.push('</svg>');
    return parts.join('');
  }

  let consumed = 0;

  segments.forEach((segment, index) => {
    const ratio = segment.cost / total;
    const dash = round2(ratio * circumference);
    // dash + gap her zaman yuvarlanmış çevreye eşit olsun (görsel boşluk/taşma olmaz).
    const gap = round2(round2(circumference) - dash);
    const offset = round2(-consumed);
    const percentage = round2(ratio * 100);
    const color = colorAt(index);

    parts.push(
      `<circle class="donut-segment" cx="${center}" cy="${center}" r="${radius}" fill="none"`
      + ` stroke="${color}" stroke-width="${strokeWidth}" stroke-dasharray="${dash} ${gap}"`
      + ` stroke-dashoffset="${offset}" data-model="${escapeXml(segment.model)}"`
      + ` data-percentage="${percentage}" transform="rotate(-90 ${center} ${center})">`
      + `<title>${escapeXml(`${segment.model}: %${percentage}`)}</title>`
      + '</circle>',
    );

    consumed += ratio * circumference;
  });

  parts.push('</svg>');
  return parts.join('');
}

/* ------------------------------------------------------------------ *
 * Faz 48: Yatay çubuk grafik (model başına maliyet karşılaştırması)
 * ------------------------------------------------------------------ */

/** Çubuk grafiğin iç (viewBox) genişliği. */
export const BARS_VIEWBOX_WIDTH = 720;

/** Satır yüksekliği (viewBox birimi). */
export const BARS_ROW_HEIGHT = 30;

/** Üst/alt iç boşluk. */
export const BARS_PADDING = 6;

/** Model adı sütununun genişliği. */
export const BARS_LABEL_WIDTH = 200;

/** Sağdaki sayı sütununun genişliği (fatura + tasarruf %). */
export const BARS_VALUE_WIDTH = 132;

/** Çubuk kalınlığı. */
export const BARS_BAR_HEIGHT = 12;

/** Önlenen maliyet (önbellek tasarrufu) parçasının saydamlığı. */
export const BARS_SAVED_OPACITY = 0.3;

/** Model adı bu uzunluktan sonra kısaltılır. */
export const BARS_LABEL_MAX_LENGTH = 26;

/**
 * Maliyet verisi yokken gösterilen Türkçe yedek metin.
 * Çıktıda sözlük değeri (`chart.empty`) kullanılır; bu sabit geriye dönük uyumluluk için korunur.
 */
export const BARS_EMPTY_TEXT = 'Gösterilecek maliyet verisi yok';

/** Model adını tek satıra sığdırır (uzun adlar "…" ile kısaltılır). */
function truncateModel(model, maxLength = BARS_LABEL_MAX_LENGTH) {
  const text = String(model);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(1, maxLength - 1))}…`;
}

/** Yüzdeyi "%73" biçiminde yazar (kayan nokta gürültüsü olmadan). */
function formatPercent(value) {
  return `%${round2(value)}`;
}

/**
 * Gruplanmış modelleri çubuk satırlarına indirger ve çubuk uzunluğuna göre sıralar.
 * withoutCache = gerçek fatura + önbellek tasarrufu (önbellek olmasaydı ödenecek tutar).
 * @param {Array<{ model: string, summary: object }>} groupedModels
 * @returns {Array<{ model: string, invoice: number, saved: number, withoutCache: number, savingsRate: number }>}
 */
function toBarRows(groupedModels) {
  const list = Array.isArray(groupedModels) ? groupedModels : [];
  const rows = [];

  for (const group of list) {
    if (!group || typeof group !== 'object') continue;

    const summary = group.summary && typeof group.summary === 'object' ? group.summary : {};
    const invoice = Number(summary.totalCostUSD);
    const saved = Number(summary.totalSavedUSD);
    const safeInvoice = Number.isFinite(invoice) && invoice > 0 ? invoice : 0;
    const safeSaved = Number.isFinite(saved) && saved > 0 ? saved : 0;
    const withoutCache = round2(safeInvoice + safeSaved);
    if (withoutCache <= 0) continue;

    rows.push({
      model: typeof group.model === 'string' && group.model.trim() !== ''
        ? group.model.trim()
        : 'Bilinmeyen Model',
      invoice: safeInvoice,
      saved: safeSaved,
      withoutCache,
      savingsRate: round2((safeSaved / withoutCache) * 100),
    });
  }

  // Büyük çubuk üstte; eşitlikte model adına göre sıralanır (deterministik çıktı).
  rows.sort((a, b) => {
    if (b.withoutCache !== a.withoutCache) return b.withoutCache - a.withoutCache;
    if (a.model === b.model) return 0;
    return a.model < b.model ? -1 : 1;
  });

  return rows;
}

/**
 * Halka grafikteki renk sırasını çubuklara taşır: aynı model her iki grafikte aynı renktir.
 * @param {Array<{ model: string, summary: object }>} groupedModels
 * @returns {Map<string, number>}
 */
function buildColorIndex(groupedModels) {
  const index = new Map();
  toSegments(groupedModels).forEach((segment, position) => {
    if (!index.has(segment.model)) index.set(segment.model, position);
  });
  return index;
}

/** Çubuk grafiğin toplam yüksekliği (satır sayısına göre). */
function heightOfBars(rowCount, rowHeight) {
  const rows = Number(rowCount) > 0 ? Number(rowCount) : 1;
  return round2(rows * rowHeight + BARS_PADDING * 2);
}

/**
 * Faz 48: Model başına maliyeti yatay çubuklarla gösterir (saf SVG, harici kütüphane YOK).
 * Tüm çubuklar "önbellek olmasaydı" tutarına göre ölçeklenir; dolu parça gerçek fatura,
 * soluk parça önbellek sayesinde ödenmeyen tutardır. Veri yoksa nötr metin döner.
 * @param {Array<{ model: string, summary: object }>} groupedModels
 * @param {{ ariaLabel?: string, width?: number, rowHeight?: number }} [options]
 * @returns {string} SVG işaretlemesi
 */
export function generateModelCostBarsSVG(groupedModels, options = {}) {
  const width = Number(options.width) > 0 ? Number(options.width) : BARS_VIEWBOX_WIDTH;
  const rowHeight = Number(options.rowHeight) > 0 ? Number(options.rowHeight) : BARS_ROW_HEIGHT;
  const ariaLabel = options.ariaLabel || t('chart.bars.aria');
  const rows = toBarRows(groupedModels);
  const trackWidth = Math.max(1, width - BARS_LABEL_WIDTH - BARS_VALUE_WIDTH);
  const height = heightOfBars(rows.length, rowHeight);

  const header = `<svg class="bar-chart" viewBox="0 0 ${width} ${height}"`
    + ` role="img" aria-label="${escapeXml(ariaLabel)}" xmlns="http://www.w3.org/2000/svg">`;

  if (rows.length === 0) {
    const emptyText = t('chart.empty');
    return header
      + `<title>${escapeXml(emptyText)}</title>`
      + `<text class="bar-empty" x="0" y="${round2(rowHeight / 2 + 4)}">${escapeXml(emptyText)}</text>`
      + '</svg>';
  }

  const colors = buildColorIndex(groupedModels);
  const maxWithoutCache = rows.reduce((max, row) => Math.max(max, row.withoutCache), 0);
  const invoiceTextX = width - 58;
  const savingsTextX = width - 4;

  const titleKey = rows.length === 1 ? 'chart.bars.titleOne' : 'chart.bars.title';
  const parts = [
    header,
    `<title>${escapeXml(t(titleKey, { aria: ariaLabel, count: rows.length, cur: 'USD' }))}</title>`,
  ];

  rows.forEach((row, index) => {
    const rowY = BARS_PADDING + index * rowHeight;
    const barY = rowY + (rowHeight - BARS_BAR_HEIGHT) / 2;
    const textY = rowY + rowHeight - 10;
    const color = colorAt(colors.has(row.model) ? colors.get(row.model) : index);

    const barWidth = round2((row.withoutCache / maxWithoutCache) * trackWidth);
    const invoiceWidth = Math.max(row.invoice > 0 ? 2 : 0, round2((row.invoice / row.withoutCache) * barWidth));
    const savedWidth = Math.max(0, round2(barWidth - invoiceWidth));
    const tooltip = t('chart.tooltip', {
      model: row.model,
      invoice: round2(row.invoice),
      withoutCache: row.withoutCache,
      cur: 'USD',
      savings: formatPercent(row.savingsRate),
    });

    parts.push(`<g class="bar-row" data-model="${escapeXml(row.model)}">`);
    parts.push(`<title>${escapeXml(tooltip)}</title>`);
    parts.push(
      `<rect class="bar-track" x="${BARS_LABEL_WIDTH}" y="${round2(barY)}"`
      + ` width="${trackWidth}" height="${BARS_BAR_HEIGHT}" rx="1" />`,
    );

    if (savedWidth > 0) {
      parts.push(
        `<rect class="bar-saved" x="${round2(BARS_LABEL_WIDTH + invoiceWidth)}" y="${round2(barY)}"`
        + ` width="${savedWidth}" height="${BARS_BAR_HEIGHT}" fill="${color}"`
        + ` fill-opacity="${BARS_SAVED_OPACITY}" rx="1" />`,
      );
    }

    if (invoiceWidth > 0) {
      parts.push(
        `<rect class="bar-actual" x="${BARS_LABEL_WIDTH}" y="${round2(barY)}"`
        + ` width="${invoiceWidth}" height="${BARS_BAR_HEIGHT}" fill="${color}" rx="1" />`,
      );
    }

    parts.push(`<text class="bar-label" x="0" y="${round2(textY)}">${escapeXml(truncateModel(row.model))}</text>`);
    parts.push(
      `<text class="bar-value" x="${invoiceTextX}" y="${round2(textY)}" text-anchor="end">`
      + `${escapeXml(formatCostDisplay(row.invoice))}</text>`,
    );
    parts.push(
      `<text class="bar-meta" x="${savingsTextX}" y="${round2(textY)}" text-anchor="end">`
      + `${escapeXml(row.savingsRate > 0 ? `-${formatPercent(row.savingsRate)}` : '')}</text>`,
    );
    parts.push('</g>');
  });

  parts.push('</svg>');
  return parts.join('');
}
