// @vitest-environment jsdom
// tests/export.test.js
// Faz 38 - 41: .csv / .pdf / Markdown dışa aktarma ve URL paylaşımı testleri.
import { describe, it, expect, vi } from 'vitest';
import {
  SIGNATURE_TEXT,
  CSV_UTF8_BOM,
  DEFAULT_CSV_FILENAME,
  DEFAULT_PDF_FILENAME,
  generateCSVContent,
  downloadCSVFile,
  generatePDFReportHTML,
  exportToPDF,
} from '../src/services/export-service.js';
import { createTokenRecord, createPricingProfile } from '../src/core/schema.js';
import { aggregateUsageSummaries, groupRecordsByModel } from '../src/core/calculator.js';
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

describe('Faz 39: generatePDFReportHTML', () => {
  const currencyInfo = { code: 'TRY', rate: 36.5, symbol: '₺' };

  it('A4, beyaz zeminli (yazıcı dostu) tam bir rapor şablonu üretir', () => {
    const { calculatedRecords, summary } = createFixture();
    const html = generatePDFReportHTML(null, calculatedRecords, summary, currencyInfo);

    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('@page');
    expect(html).toContain('size: A4');
    expect(html).toContain('background: #ffffff');
    expect(html).toContain('color: #0f172a');
    // Koyu tema arka planı PDF'e taşınmaz.
    expect(html).not.toContain('background: #0f172a');
    expect(html).not.toContain('background: #111827');
  });

  it('üstte FinOps özet kartlarını, ortada model tablosunu içerir', () => {
    const { calculatedRecords, summary } = createFixture();
    const html = generatePDFReportHTML(null, calculatedRecords, summary, currencyInfo);

    expect(html).toContain('class="pdf-summary"');
    expect((html.match(/class="pdf-card(?![-\w])/g) || [])).toHaveLength(4);
    expect(html).toContain('Normalde Ödenecek');
    expect(html).toContain('Önbellek Tasarrufu');
    expect(html).toContain('$0.26 / ₺9,58');

    expect(html).toContain('class="pdf-table"');
    expect(html).toContain('deepseek-v4.1-flash');
    expect(html).toContain('glm-5.3');
    expect(html).toContain('%60');
  });

  it('sayfa altbilgisinde küçük puntolu "Made by Burak Yıldız" imzası bulunur', () => {
    const { calculatedRecords, summary } = createFixture();
    const html = generatePDFReportHTML(null, calculatedRecords, summary, currencyInfo);

    expect(html).toContain('class="pdf-footer"');
    expect(html).toContain('font-size: 10px');
    expect(html).toContain('#64748b');
    expect(html).toContain(`<small class="app-signature">${SIGNATURE_TEXT}</small>`);
  });

  it('gruplanmış model listesi verilmezse kayıtlardan kendisi gruplar', () => {
    const { calculatedRecords, summary } = createFixture();
    const grouped = groupRecordsByModel(calculatedRecords);

    expect(generatePDFReportHTML(null, calculatedRecords, summary, currencyInfo))
      .toBe(generatePDFReportHTML(grouped, calculatedRecords, summary, currencyInfo));
  });

  it('model adını XML kaçışlı yazar ve boş girdide NaN üretmez', () => {
    const records = buildCalculatedRecords(
      [createTokenRecord({ model: '<b>kötü</b>model', requests: 1, totalTokens: 10, cachedTokens: 0, billedTokens: 10 })],
      { catalog: {} },
    );

    const html = generatePDFReportHTML(null, records, aggregateUsageSummaries(records), { code: 'USD' });
    expect(html).not.toContain('<b>kötü</b>model');
    expect(html).toContain('&lt;b&gt;kötü&lt;/b&gt;model');

    const empty = generatePDFReportHTML(null, [], null, null);
    expect(empty).not.toContain('NaN');
    expect(empty).not.toContain('undefined');
  });
});

describe('Faz 39: exportToPDF', () => {
  it('html2pdf benzeri üretici verilirse doğrudan .pdf dosyasını üretir', () => {
    const generator = vi.fn(() => 'pdf-bytes');

    const result = exportToPDF('<html></html>', 'rapor', generator);

    expect(generator).toHaveBeenCalledTimes(1);
    expect(generator.mock.calls[0][0]).toBe('<html></html>');
    expect(generator.mock.calls[0][1]).toEqual({ filename: 'rapor.pdf' });
    expect(result.mode).toBe('html2pdf');
    expect(result.filename).toBe('rapor.pdf');
  });

  it('üretici yoksa izole yazdırma çerçevesi (iframe) ile yerel PDF motorunu tetikler', () => {
    const printSpy = vi.fn();
    const written = [];
    const frame = {
      className: '',
      style: {},
      setAttribute: vi.fn(),
      contentDocument: {
        open: () => written.push('open'),
        write: (html) => written.push(html),
        close: () => written.push('close'),
      },
      contentWindow: { focus: vi.fn(), print: printSpy },
    };
    const environment = {
      document: { createElement: () => frame, body: { appendChild: vi.fn() } },
    };

    const result = exportToPDF('<html>rapor</html>', undefined, null, environment);

    expect(result.mode).toBe('print');
    expect(result.filename).toBe('tokencost-report.pdf');
    expect(written).toContain('<html>rapor</html>');
    expect(printSpy).toHaveBeenCalledTimes(1);
    expect(frame.className).toContain('pdf-print-frame');
  });

  it('DOM yoksa anlamlı hata verir', () => {
    expect(() => exportToPDF('<html></html>', 'x.pdf', null, { document: null }))
      .toThrow('ERR_DOM_UNAVAILABLE');
  });
});

