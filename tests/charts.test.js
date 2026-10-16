// tests/charts.test.js
// Faz 36: Saf SVG halka (donut) grafik üretici testleri (Chart.js / D3.js YOK).
import { describe, it, expect } from 'vitest';
import {
  generateModelCostDonutSVG,
  generateModelCostBarsSVG,
  CHART_COLORS,
  DONUT_EMPTY_COLOR,
  DONUT_RADIUS,
  DONUT_VIEWBOX_SIZE,
  BARS_EMPTY_TEXT,
  BARS_LABEL_WIDTH,
  BARS_VIEWBOX_WIDTH,
  BARS_VALUE_WIDTH,
} from '../src/ui/charts.js';

/** Verilen maliyetlerle gruplanmış model listesi üretir. */
function createGroups(costs) {
  return costs.map(([model, totalCostUSD, totalTokens = 0]) => ({
    model,
    summary: { totalCostUSD, totalTokens, totalRequests: 0 },
  }));
}

/** Bir dilimin (circle) stroke-dasharray/dashoffset çiftini okur. */
function readSegment(svg, index) {
  const circles = svg.match(/<circle[^>]*class="donut-segment"[^>]*>/g) || [];
  const circle = circles[index];
  if (!circle) return null;
  return {
    dasharray: /stroke-dasharray="([^"]+)"/.exec(circle)[1],
    dashoffset: /stroke-dashoffset="([^"]+)"/.exec(circle)[1],
    color: /stroke="([^"]+)"/.exec(circle)[1],
    raw: circle,
  };
}

// Çevre: C = 2πr = 2π*70 ≈ 439.82297
const C = 2 * Math.PI * DONUT_RADIUS;

describe('Faz 36: generateModelCostDonutSVG', () => {
  it('200x200 viewBox içinde 3 dilim için doğru dasharray/dashoffset üretir', () => {
    // Toplam $986: deepseek %62.48, glm %20.59, mimo %16.94
    const svg = generateModelCostDonutSVG(createGroups([
      ['deepseek-v4.1-flash', 616],
      ['glm-5.3', 203],
      ['mimo-v2.6-pro', 167],
    ]));

    expect(DONUT_VIEWBOX_SIZE).toBe(200);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain(`viewBox="0 0 200 200"`);
    expect(svg).toContain('<circle');
    expect((svg.match(/class="donut-segment"/g) || [])).toHaveLength(3);

    // C ≈ 439.82297
    const first = readSegment(svg, 0);
    const second = readSegment(svg, 1);
    const third = readSegment(svg, 2);

    expect(Number(C.toFixed(5))).toBeCloseTo(439.82297, 5);

    // dash = yüzde/100 * C | dashoffset = -(önceki dilimlerin toplamı)
    const firstDash = Number(((616 / 986) * C).toFixed(2));
    const secondDash = Number(((203 / 986) * C).toFixed(2));
    const thirdDash = Number(((167 / 986) * C).toFixed(2));

    expect(first.dasharray).toBe(`${firstDash} ${Number((C - firstDash).toFixed(2))}`);
    expect(first.dashoffset).toBe('0');

    const afterFirst = (616 / 986) * C;
    const afterSecond = afterFirst + (203 / 986) * C;

    expect(second.dasharray).toBe(`${secondDash} ${Number((C - secondDash).toFixed(2))}`);
    expect(second.dashoffset).toBe(String(Number((-afterFirst).toFixed(2))));

    expect(third.dasharray).toBe(`${thirdDash} ${Number((C - thirdDash).toFixed(2))}`);
    expect(third.dashoffset).toBe(String(Number((-afterSecond).toFixed(2))));

    // Dilimler farklı renklerde olmalı ve ilk 3 renk paletten gelmeli
    expect(first.color).toBe(CHART_COLORS[0]);
    expect(second.color).toBe(CHART_COLORS[1]);
    expect(third.color).toBe(CHART_COLORS[2]);
    expect(new Set([first.color, second.color, third.color]).size).toBe(3);
  });

  it('toplam maliyet 0 olduğunda gri boş halka üretir ve NaN içermez', () => {
    for (const input of [
      [],
      null,
      createGroups([['deepseek-v4.1-flash', 0], ['glm-5.3', 0]]),
      createGroups([['bozuk-model', Number.NaN]]),
    ]) {
      const svg = generateModelCostDonutSVG(input);

      expect(svg).not.toContain('NaN');
      expect(svg).not.toContain('undefined');
      expect(svg).toContain('data-empty="true"');
      expect(svg).toContain(`stroke="${DONUT_EMPTY_COLOR}"`);
      expect((svg.match(/class="donut-segment"/g) || [])).toHaveLength(0);
      expect(svg).toContain('<circle');
    }
  });

  it('model adlarını XML kaçışlı yazar (XSS/enjeksiyon koruması)', () => {
    const svg = generateModelCostDonutSVG(createGroups([['<script>alert(1)</script>', 10]]));

    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
  });

  it('aynı girdi için her zaman aynı SVG metnini üretir (deterministik)', () => {
    const groups = createGroups([
      ['deepseek-v4.1-flash', 61.6],
      ['glm-5.3', 20.3],
      ['mimo-v2.6-pro', 16.7],
    ]);

    expect(generateModelCostDonutSVG(groups)).toBe(generateModelCostDonutSVG(groups));
  });

  it('dilim başlığı (title) ve erişilebilirlik nitelikleri ekler', () => {
    const svg = generateModelCostDonutSVG(createGroups([['deepseek-v4.1-flash', 61.6]]));

    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-label=');
    expect(svg).toContain('<title>');
    expect(svg).toContain('deepseek-v4.1-flash');
  });
});

/** Faz 48: fatura + tasarruf içeren gruplanmış model listesi üretir. */
function createSavingsGroups(entries) {
  return entries.map(([model, totalCostUSD, totalSavedUSD]) => ({
    model,
    summary: { totalCostUSD, totalSavedUSD, totalTokens: 0, totalRequests: 0 },
  }));
}

/** Çubuk satırındaki dikdörtgenleri sınıf adına göre okur. */
function readBarRects(rowMarkup) {
  const rects = {};
  for (const match of rowMarkup.matchAll(/<rect class="([^"]+)"[^>]*x="([^"]+)"[^>]*width="([^"]+)"/g)) {
    rects[match[1]] = { x: Number(match[2]), width: Number(match[3]) };
  }
  return rects;
}

/** SVG içindeki çubuk satırlarını model adıyla birlikte döndürür. */
function readBarRows(svg) {
  const rows = {};
  for (const match of svg.matchAll(/<g class="bar-row" data-model="([^"]+)">([\s\S]*?)<\/g>/g)) {
    rows[match[1]] = match[2];
  }
  return rows;
}

describe('Faz 48: generateModelCostBarsSVG', () => {
  const trackWidth = BARS_VIEWBOX_WIDTH - BARS_LABEL_WIDTH - BARS_VALUE_WIDTH;

  it('çubukları önbelleksiz maliyete göre ölçekler, dolu/soluk parçayı ayırır', () => {
    const svg = generateModelCostBarsSVG(createSavingsGroups([
      ['model-a', 10, 30], // fatura $10, tasarruf $30 → önbelleksiz $40 (en büyük çubuk)
      ['model-b', 5, 5],   // fatura $5, tasarruf $5 → önbelleksiz $10
    ]));

    expect(svg).toContain(`viewBox="0 0 ${BARS_VIEWBOX_WIDTH} 72"`);
    expect((svg.match(/class="bar-row"/g) || [])).toHaveLength(2);

    const rows = readBarRows(svg);
    const rectsA = readBarRects(rows['model-a']);
    const rectsB = readBarRects(rows['model-b']);

    // Tam ölçek: en büyük çubuk çizim alanını doldurur.
    expect(rectsA['bar-track'].width).toBe(trackWidth);
    expect(rectsA['bar-actual']).toEqual({ x: BARS_LABEL_WIDTH, width: Number(((10 / 40) * trackWidth).toFixed(2)) });
    expect(rectsA['bar-saved']).toEqual({
      x: BARS_LABEL_WIDTH + Number(((10 / 40) * trackWidth).toFixed(2)),
      width: Number((trackWidth - Number(((10 / 40) * trackWidth).toFixed(2))).toFixed(2)),
    });

    // Küçük çubuk, büyüğün dörtte biri kadar (10/40).
    expect(rectsB['bar-track'].width).toBe(trackWidth);
    expect(rectsB['bar-actual'].width).toBe(Number((trackWidth / 4 / 2).toFixed(2)));
    expect(rectsB['bar-saved'].width).toBe(Number((trackWidth / 4 / 2).toFixed(2)));

    // Sağdaki sayılar: fatura tutarı ve tasarruf oranı.
    expect(rows['model-a']).toContain('$10.00');
    expect(rows['model-a']).toContain('-%75');
    expect(rows['model-b']).toContain('$5.00');
    expect(rows['model-b']).toContain('-%50');
  });

  it('çubukları büyükten küçüğe sıralar (girdi sırası ne olursa olsun)', () => {
    const svg = generateModelCostBarsSVG(createSavingsGroups([
      ['kucuk', 1, 0],
      ['buyuk', 40, 0],
      ['orta', 8, 0],
    ]));

    const order = Array.from(svg.matchAll(/data-model="([^"]+)"/g)).map((match) => match[1]);
    expect(order).toEqual(['buyuk', 'orta', 'kucuk']);
  });

  it('model renklerini halka grafikle aynı sıradan alır (aynı model = aynı renk)', () => {
    const groups = createSavingsGroups([
      ['kucuk', 5, 5],
      ['buyuk', 10, 30],
    ]);
    const rows = readBarRows(generateModelCostBarsSVG(groups));

    // Girdi sırası: kucuk → palet[0]; sıralamada büyük çubuk üstte ama rengi korunur.
    expect(rows['kucuk']).toContain(`fill="${CHART_COLORS[0]}"`);
    expect(rows['buyuk']).toContain(`fill="${CHART_COLORS[1]}"`);
  });

  it('maliyet verisi yoksa nötr metin döner ve NaN/undefined üretmez', () => {
    for (const input of [
      [],
      null,
      createGroups([['deepseek-v4.1-flash', 0], ['glm-5.3', 0]]),
      createSavingsGroups([['bozuk-model', Number.NaN, Number.NaN]]),
    ]) {
      const svg = generateModelCostBarsSVG(input);

      expect(svg).toContain('class="bar-chart"');
      expect(svg).toContain('role="img"');
      expect(svg).toContain(BARS_EMPTY_TEXT);
      expect(svg).not.toContain('NaN');
      expect(svg).not.toContain('undefined');
      expect((svg.match(/class="bar-row"/g) || [])).toHaveLength(0);
    }
  });

  it('model adlarını XML kaçışlı yazar ve uzun adları kısaltır', () => {
    const longName = 'cok-uzun-model-adi-ile-sinir-testi-2026';
    const svg = generateModelCostBarsSVG(createSavingsGroups([
      ['<script>alert(1)</script>', 10, 0],
      [longName, 5, 0],
    ]));

    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
    expect(svg).toContain('cok-uzun-model-adi-ile-si…');
    expect(svg).not.toContain(`>${longName}<`);
  });

  it('aynı girdi için her zaman aynı SVG metnini üretir (deterministik)', () => {
    const groups = createSavingsGroups([
      ['deepseek-v4.1-flash', 13.8, 37.96],
      ['glm-5.3', 4.2, 12.1],
      ['mimo-v2.6-pro', 2.5, 6.4],
    ]);

    expect(generateModelCostBarsSVG(groups)).toBe(generateModelCostBarsSVG(groups));
  });
});
