// tests/charts.test.js
// Faz 36: Saf SVG halka (donut) grafik üretici testleri (Chart.js / D3.js YOK).
import { describe, it, expect } from 'vitest';
import {
  generateModelCostDonutSVG,
  CHART_COLORS,
  DONUT_EMPTY_COLOR,
  DONUT_RADIUS,
  DONUT_VIEWBOX_SIZE,
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
