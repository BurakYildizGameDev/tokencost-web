// @vitest-environment jsdom
// tests/export.test.js
// Faz 38 - 41: .csv / .pdf / Markdown dışa aktarma ve URL paylaşımı testleri.
import { describe, it, expect, vi } from 'vitest';
import {
  SIGNATURE_TEXT,
  CSV_UTF8_BOM,
  DEFAULT_CSV_FILENAME,
  generateCSVContent,
  downloadCSVFile,
} from '../src/services/export-service.js';
import { createTokenRecord, createPricingProfile } from '../src/core/schema.js';
import { aggregateUsageSummaries } from '../src/core/calculator.js';
import { buildCalculatedRecords } from '../src/ui/store.js';

/** Test fiyat kataloğu. */
function createCatalog() {
  return {
    'deepseek-v4.1-flash': createPricingProfile({
      modelId: 'deepseek-v4.1-flash',
      cachedInputCostPerMillion: 0.014,
      uncachedInputCostPerMillion: 0.14,
      outputCostPerMillion: 0.28,
      source: 'litellm',
    }),
    'glm-5.3': createPricingProfile({
      modelId: 'glm-5.3',
      cachedInputCostPerMillion: 0.03,
      uncachedInputCostPerMillion: 0.3,
      outputCostPerMillion: 0.6,
      source: 'litellm',
    }),
  };
}

/** İki satırlık örnek kayıt + hesaplanmış satırlar + özet üretir. */
function createFixture() {
  const records = [
    createTokenRecord({
      date: '14 Eki',
      model: 'deepseek-v4.1-flash',
      requests: 341,
      totalTokens: 1_000_000,
      cachedTokens: 600_000,
      billedTokens: 400_000,
    }),
    createTokenRecord({
      date: '13 Eki',
      model: 'glm-5.3',
      requests: 120,
      totalTokens: 500_000,
      cachedTokens: 200_000,
      billedTokens: 300_000,
    }),
  ];

  const calculatedRecords = buildCalculatedRecords(records, { catalog: createCatalog() });
  return { records, calculatedRecords, summary: aggregateUsageSummaries(calculatedRecords) };
}

describe('Faz 38: generateCSVContent', () => {
  it('UTF-8 BOM ile başlar (Excel Türkçe karakter bozulması olmaz)', () => {
    const { calculatedRecords, summary } = createFixture();
    const csv = generateCSVContent(calculatedRecords, summary);

    expect(CSV_UTF8_BOM).toBe('\uFEFF');
    expect(csv.startsWith(CSV_UTF8_BOM)).toBe(true);
    expect(csv).toContain('Önbelleklenen');
    expect(csv).toContain('Kotaya Yansıyan');
  });

  it('başlık satırı, veri satırları ve TOPLAM satırını sırayla yazar', () => {
    const { calculatedRecords, summary } = createFixture();
    const lines = generateCSVContent(calculatedRecords, summary).split('\n');

    expect(lines[0]).toBe(
      `${CSV_UTF8_BOM}Tarih,Model,İstek,Toplam Token,Önbelleklenen,Kotaya Yansıyan,Önbellek Tasarrufu (USD),Tahmini Tutar (USD)`,
    );
    expect(lines[1]).toBe('14 Eki,deepseek-v4.1-flash,341,1000000,600000,400000,0.0756,0.1036');
    expect(lines[2]).toBe('13 Eki,glm-5.3,120,500000,200000,300000,0.054,0.159');

    const totalLine = lines[3];
    expect(totalLine.startsWith('TOPLAM,,461,1500000,800000,700000,')).toBe(true);
    expect(totalLine).toContain('0.1296');
    expect(totalLine).toContain('0.2626');
  });

  it('en alt satırda tırnaklı "Made by Burak Yıldız" imzası bulunur', () => {
    const { calculatedRecords, summary } = createFixture();
    const csv = generateCSVContent(calculatedRecords, summary);

    expect(SIGNATURE_TEXT).toBe('Made by Burak Yıldız');
    expect(csv.trimEnd().endsWith(`"${SIGNATURE_TEXT}"`)).toBe(true);
    expect(csv.split('\n').at(-1)).toBe(`"${SIGNATURE_TEXT}"`);
  });

  it('virgül/çift tırnak içeren hücreleri RFC 4180 uyumlu tırnaklar', () => {
    const rows = [{
      id: 'rec_1',
      date: '14 Eki',
      model: 'mimo, v2.6 "pro"',
      requests: 1,
      totalTokens: 1000,
      cachedTokens: 500,
      billedTokens: 500,
      savedUSD: 0.1,
      totalCostUSD: 0.2,
    }];

    const csv = generateCSVContent(rows, null);
    const dataLine = csv.split('\n')[1];

    expect(dataLine).toContain('"mimo, v2.6 ""pro"""');
  });

  it('boş/eksik girdilerde yalnızca başlık, TOPLAM ve imza üretir (çökmez)', () => {
    for (const input of [undefined, null, [], 'bozuk']) {
      const csv = generateCSVContent(input);
      const lines = csv.split('\n');

      expect(lines).toHaveLength(3);
      expect(lines[1].startsWith('TOPLAM,')).toBe(true);
      expect(lines[2]).toBe(`"${SIGNATURE_TEXT}"`);
    }
  });

  it('özet verilmezse toplam satırını kayıtlardan kendisi hesaplar', () => {
    const { calculatedRecords, summary } = createFixture();
    expect(generateCSVContent(calculatedRecords).split('\n')[3])
      .toBe(generateCSVContent(calculatedRecords, summary).split('\n')[3]);
  });
});

describe('Faz 38: downloadCSVFile', () => {
  it('text/csv Blob oluşturur ve .csv uzantılı dosyayı indirir', () => {
    const clickSpy = vi.spyOn(window.HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const result = downloadCSVFile(`${CSV_UTF8_BOM}a,b\n1,2`);

    expect(result.filename).toBe(DEFAULT_CSV_FILENAME);
    expect(DEFAULT_CSV_FILENAME).toBe('tokencost-report.csv');
    expect(result.blob.type).toBe('text/csv;charset=utf-8;');
    expect(result.link.download).toBe('tokencost-report.csv');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(result.link.isConnected).toBe(false);

    clickSpy.mockRestore();
  });

  it('uzantısız dosya adına .csv ekler, verilen adı korur', () => {
    const clickSpy = vi.spyOn(window.HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    expect(downloadCSVFile('a', 'onbellek-raporu').filename).toBe('onbellek-raporu.csv');
    expect(downloadCSVFile('a', 'rapor.csv').filename).toBe('rapor.csv');

    clickSpy.mockRestore();
  });

  it('DOM bulunmayan ortamda anlamlı hata verir ve metin olmayan içeriği boş kabul eder', () => {
    const clickSpy = vi.spyOn(window.HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    expect(() => downloadCSVFile('a', 'x', { document: null })).toThrow('ERR_DOM_UNAVAILABLE');
    expect(downloadCSVFile(null).blob.size).toBe(0);

    clickSpy.mockRestore();
  });
});
