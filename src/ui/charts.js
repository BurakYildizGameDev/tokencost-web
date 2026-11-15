// src/ui/charts.js
// Faz 36: Sıfır bağımlılıklı saf SVG halka (donut) grafik üretici.
// KURAL: Chart.js / D3.js / canvas KULLANILMAZ. DOM'a dokunmaz; string döner
//        (çağıran katman innerHTML veya insertAdjacentHTML ile yerleştirir).

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

  const ariaLabel = options.ariaLabel || 'Model bazlı maliyet dağılımı';
  const parts = [
    `<svg class="donut-chart" viewBox="0 0 ${size} ${size}" role="img"`
    + ` aria-label="${escapeXml(ariaLabel)}" xmlns="http://www.w3.org/2000/svg">`,
  ];

  if (!Number.isFinite(total) || total <= 0) {
    parts.push(`<title>${escapeXml('Gösterilecek maliyet verisi yok')}</title>`);
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
