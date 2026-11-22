// tests/e2e.test.js
// Faz 43 - 46: Uçtan uca (E2E) senaryo testleri.
// Faz 43: Örnek konsol veri seti (demo-data) | Faz 44: Uygulama orkestratörü
// Faz 45: Ham metin -> fatura -> .csv / .pdf akışı | Faz 46: Çoklu görsel OCR + tekilleştirme
import { describe, it, expect } from 'vitest';
import {
  DEMO_BUTTON_ID,
  DEMO_BUTTON_LABEL,
  DEMO_EXPECTED_CACHE_HIT_RATE,
  DEMO_EXPECTED_INVOICE_USD,
  DEMO_EXPECTED_SAVED_USD,
  DEMO_PRICING_CATALOG,
  DEMO_TOTAL_BILLED_TOKENS,
  DEMO_TOTAL_CACHED_TOKENS,
  DEMO_TOTAL_REQUESTS,
  DEMO_TOTAL_TOKENS,
  SAMPLE_PASTED_TABLE_TEXT,
  SAMPLE_SCREENSHOT_TEXTS,
  getSampleScreenshotDataset,
} from '../src/core/demo-data.js';
import { parsePastedTableText } from '../src/core/parser.js';
import { formatCostDisplay, formatTokenCount } from '../src/core/formatter.js';
import { createAppStore } from '../src/ui/store.js';

/** Kayıt dizisinde bir alanı tek geçişte toplar. */
function sumBy(rows, field) {
  return rows.reduce((total, row) => total + Number(row[field] || 0), 0);
}

/** Demo veri setini örnek katalogla fiyatlandırıp türetilmiş durumu döner. */
function createDemoStore() {
  return createAppStore({
    records: getSampleScreenshotDataset(),
    pricingCatalog: DEMO_PRICING_CATALOG,
  });
}

describe('Faz 43: Örnek konsol veri seti (demo-data)', () => {
  const dataset = getSampleScreenshotDataset();
  const { summary, groupedModels, unknownModels } = createDemoStore().getState();

  it('3 ekran görüntüsündeki 13 satırı dondurulmuş kayıt olarak döner', () => {
    expect(SAMPLE_SCREENSHOT_TEXTS).toHaveLength(3);
    expect(dataset).toHaveLength(13);
    expect(dataset.every((row) => Object.isFrozen(row))).toBe(true);
    expect(dataset.every((row) => typeof row.id === 'string' && row.id !== '')).toBe(true);
    expect(new Set(dataset.map((row) => row.model)).size).toBe(4);
    expect(dataset.map((row) => row.model)).toContain('glm-5.3');
    expect(dataset.map((row) => row.model)).toContain('mimo-v2.6-pro');
    expect(dataset.map((row) => row.model)).toContain('qwen3-vl-30b');
  });

  it('her satırda cached + billed === total eşitliğini korur', () => {
    for (const row of dataset) {
      expect(row.cachedTokens + row.billedTokens).toBe(row.totalTokens);
    }
  });

  it('333.698.885 token ve 4.044 istek toplamını verir', () => {
    expect(sumBy(dataset, 'totalTokens')).toBe(333698885);
    expect(sumBy(dataset, 'requests')).toBe(4044);
    expect(sumBy(dataset, 'totalTokens')).toBe(DEMO_TOTAL_TOKENS);
    expect(sumBy(dataset, 'requests')).toBe(DEMO_TOTAL_REQUESTS);
    expect(sumBy(dataset, 'cachedTokens')).toBe(DEMO_TOTAL_CACHED_TOKENS);
    expect(sumBy(dataset, 'billedTokens')).toBe(DEMO_TOTAL_BILLED_TOKENS);
    expect(formatTokenCount(summary.totalTokens).full).toBe('333.698.885');
    expect(formatTokenCount(summary.totalTokens).short).toBe('333,7M');
  });

  it('örnek katalogda 4 modeli fiyatlar, fallback fiyatına düşmez', () => {
    expect(Object.keys(DEMO_PRICING_CATALOG)).toHaveLength(4);
    expect(groupedModels).toHaveLength(4);
    expect(unknownModels).toEqual([]);
    expect(groupedModels.every((group) => group.summary.recordCount > 0)).toBe(true);
  });

  it('örnek katalogla tam $13.80 fatura ve $37.96 tasarruf üretir (vitrin senaryosu)', () => {
    expect(summary.totalCostUSD).toBeCloseTo(DEMO_EXPECTED_INVOICE_USD, 6);
    expect(formatCostDisplay(summary.totalCostUSD)).toBe('$13.80');
    expect(summary.totalSavedUSD).toBeCloseTo(DEMO_EXPECTED_SAVED_USD, 6);
    expect(formatCostDisplay(summary.totalSavedUSD)).toBe('$37.96');
    expect(summary.overallCacheHitRate).toBe(DEMO_EXPECTED_CACHE_HIT_RATE);
    expect(summary.totalCachedTokens + summary.totalSavedUSD > summary.totalCostUSD).toBe(true);
  });

  it('çevrimdışı olmayan (canlı) fiyat kaynaklarını demo kataloğunda kullanmaz', () => {
    const sources = new Set(Object.values(DEMO_PRICING_CATALOG).map((profile) => profile.source));
    expect(Array.from(sources)).toEqual(['custom']);
  });

  it('her çağrıda bağımsız (izole) kayıt kopyası üretir', () => {
    const first = getSampleScreenshotDataset();
    const second = getSampleScreenshotDataset();
    expect(first).not.toBe(second);
    expect(first[0]).not.toBe(second[0]);
    expect(first[0].id).not.toBe(second[0].id);
    expect(first.map((row) => row.totalTokens)).toEqual(second.map((row) => row.totalTokens));
  });

  it('yapıştırılabilir TSV metni de aynı toplamları verir', () => {
    const parsed = parsePastedTableText(SAMPLE_PASTED_TABLE_TEXT);
    expect(parsed.records).toHaveLength(13);
    expect(sumBy(parsed.records, 'totalTokens')).toBe(DEMO_TOTAL_TOKENS);
    expect(sumBy(parsed.records, 'requests')).toBe(DEMO_TOTAL_REQUESTS);
    expect(parsed.parsedSummaryRow).not.toBeNull();
  });

  it('demo buton sözleşmesini dışa aktarır', () => {
    expect(DEMO_BUTTON_ID).toBe('btn-load-demo');
    expect(DEMO_BUTTON_LABEL).toBe('Örnek Konsol Verisi Yükle (333.7M Token)');
  });
});
