// @vitest-environment jsdom
// tests/e2e.test.js
// Faz 43 - 46: Uçtan uca (E2E) senaryo testleri.
// Faz 43: Örnek konsol veri seti (demo-data) | Faz 44: Uygulama orkestratörü
// Faz 45: Ham metin -> fatura -> .csv / .pdf akışı | Faz 46: Çoklu görsel OCR + tekilleştirme
import { describe, it, expect, vi } from 'vitest';
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
import {
  APP_ROOT_CLASS,
  CARDS_CONTAINER_ID,
  CHART_CONTAINER_ID,
  CURRENCY_SELECT_ID,
  DEFAULT_THEME,
  FOOTER_CONTAINER_ID,
  PROGRESS_BANNER_ID,
  TABLE_CONTAINER_ID,
  THEME_STORAGE_KEY,
  THEME_TOGGLE_ID,
  TOAST_CONTAINER_ID,
  initApp,
} from '../src/app.js';
import { EXPORT_CSV_BUTTON_ID, EXPORT_PDF_BUTTON_ID, SIGNATURE_TEXT } from '../src/ui/components.js';
import { parsePastedTableText } from '../src/core/parser.js';
import { normalizeModelName, resolveModelAlias } from '../src/core/normalizer.js';
import { aggregateUsageSummaries, groupRecordsByModel } from '../src/core/calculator.js';
import { formatCostDisplay, formatTokenCount } from '../src/core/formatter.js';
import {
  CSV_UTF8_BOM,
  encodeStateToHash,
  generateCSVContent,
  generateMarkdownReport,
  generatePDFReportHTML,
} from '../src/services/export-service.js';
import { cleanOCRTableArtefacts, processMultipleImagesToRecords } from '../src/ocr/ocr-engine.js';
import { buildCalculatedRecords, createAppStore } from '../src/ui/store.js';


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

/** Test için sahte localStorage uygulaması (jsdom'da da izole çalışır). */
function createFakeStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
    clear: () => map.clear(),
    get size() { return map.size; },
  };
}

/**
 * Çevrimdışı (ağ yok) modda, izole bir kök element üzerinde uygulamayı başlatır.
 * `fetchFn` her zaman reddeder; böylece test ağa çıkmaz ve statik katalog kullanılır.
 */
function createOfflineApp(overrides = {}) {
  const root = document.createElement('div');
  document.body.appendChild(root);

  const app = initApp(root, {
    fetchFn: async () => { throw new Error('offline'); },
    storage: createFakeStorage(),
    environment: { document },
    initialHash: '',
    ...overrides,
  });

  return { root, app };
}

describe('Faz 44: Ana uygulama orkestratörü (initApp)', () => {
  it('başlangıçta tarayıcı/İK için vitrin iskeletini ve imzayı çizer', async () => {
    const { root, app } = createOfflineApp();
    await app.ready;

    expect(root.classList.contains(APP_ROOT_CLASS)).toBe(true);
    expect(root.querySelector('.app-signature').textContent).toBe(SIGNATURE_TEXT);
    expect(root.querySelector(`#${DEMO_BUTTON_ID}`).textContent).toBe(DEMO_BUTTON_LABEL);
    expect(root.querySelector(`#${FOOTER_CONTAINER_ID} #${EXPORT_CSV_BUTTON_ID}`)).not.toBeNull();
    expect(root.querySelector(`#${FOOTER_CONTAINER_ID} #${EXPORT_PDF_BUTTON_ID}`)).not.toBeNull();
    expect(root.querySelector(`#${CURRENCY_SELECT_ID}`).value).toBe('USD');
    expect(root.dataset.theme).toBe(DEFAULT_THEME);

    const state = app.store.getState();
    expect(state.records).toHaveLength(0);
    expect(formatCostDisplay(state.summary.totalCostUSD)).toBe('$0.00');
  });

  it('fiyat servisi erişilemezse statik demo kataloğuna düşer ve bilgilendirir', async () => {
    const { root, app } = createOfflineApp();
    await app.ready;

    expect(app.pricing.source).toBe('fallback');
    expect(app.pricing.isOfflineFallback).toBe(true);
    const catalog = app.store.getState().pricingCatalog;
    expect(Object.keys(catalog).length).toBeGreaterThanOrEqual(4);
    expect(root.querySelectorAll('.toast--info').length).toBeGreaterThan(0);
  });

  it('URL paylaşılan #data= hash durumunu çözüp tabloya yükler', async () => {
    const hash = encodeStateToHash(getSampleScreenshotDataset());
    const { app } = createOfflineApp({ initialHash: hash });
    await app.ready;

    const state = app.store.getState();
    expect(state.records).toHaveLength(13);
    expect(formatTokenCount(state.summary.totalTokens).full).toBe('333.698.885');
    expect(formatCostDisplay(state.summary.totalCostUSD)).toBe('$13.80');
  });

  it('bozuk hash verildiğinde çökmez, boş başlangıç durumunda kalır', async () => {
    const { app } = createOfflineApp({ initialHash: '#data=bozuk-veri' });
    await app.ready;

    expect(app.store.getState().records).toHaveLength(0);
  });

  it('"Örnek Konsol Verisi Yükle" butonu 13 satırı ve $13.80 sonucunu canlı gösterir', async () => {
    const { root, app } = createOfflineApp();
    await app.ready;

    root.querySelector(`#${DEMO_BUTTON_ID}`).click();
    const state = app.store.getState();

    expect(state.records).toHaveLength(13);
    expect(formatCostDisplay(state.summary.totalCostUSD)).toBe('$13.80');
    expect(state.unknownModels).toEqual([]);

    // FinOps kartları, düzenlenebilir tablo ve halka grafik anında güncellenir.
    const invoiceCard = root.querySelector('[data-metric="invoice"] .finops-card-value');
    expect(invoiceCard.textContent).toContain('$13.80');
    expect(root.querySelectorAll(`#${TABLE_CONTAINER_ID} tbody tr`)).toHaveLength(13);
    expect(root.querySelector(`#${CHART_CONTAINER_ID} svg.donut-chart`)).not.toBeNull();
    expect(root.querySelectorAll('.toast--success').length).toBeGreaterThan(0);
  });

  it('para birimi seçici USD/TRY/EUR kartları ve dışa aktarımı senkron günceller', async () => {
    const { root, app } = createOfflineApp();
    await app.ready;
    root.querySelector(`#${DEMO_BUTTON_ID}`).click();

    const select = root.querySelector(`#${CURRENCY_SELECT_ID}`);
    select.value = 'TRY';
    select.dispatchEvent(new window.Event('change', { bubbles: true }));

    expect(app.store.getState().currency).toBe('TRY');
    expect(app.currencyInfo.code).toBe('TRY');
    expect(app.currencyInfo.rate).toBe(34);
    expect(root.querySelector('[data-metric="invoice"] .finops-card-value').textContent).toContain('₺');

    app.setCurrency('EUR');
    expect(app.store.getState().currency).toBe('EUR');
    expect(root.querySelector(`#${CURRENCY_SELECT_ID}`).value).toBe('EUR');
  });

  it('tema değiştirici dark/light geçişini köke ve depoya yazar', async () => {
    const storage = createFakeStorage();
    const { root, app } = createOfflineApp({ storage });
    await app.ready;

    expect(app.theme).toBe('dark');
    expect(root.dataset.theme).toBe('dark');

    root.querySelector(`#${THEME_TOGGLE_ID}`).click();
    expect(app.theme).toBe('light');
    expect(root.dataset.theme).toBe('light');
    expect(root.classList.contains('theme-light')).toBe(true);
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe('light');

    root.querySelector(`#${THEME_TOGGLE_ID}`).click();
    expect(app.theme).toBe('dark');
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('.csv ve .pdf butonları export servislerine bağlanır (imza güvenliği)', async () => {
    // jsdom gerçek indirmeyi desteklemez ("Not implemented: navigation"); anchor tıklamasını izole ederiz.
    const anchorClickSpy = vi
      .spyOn(window.HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    const generated = [];
    const { root, app } = createOfflineApp({
      URL: { createObjectURL: () => 'blob:token', revokeObjectURL: () => {} },
      pdfGeneratorFn: (html, config) => {
        generated.push({ html, config });
        return Promise.resolve('pdf-ok');
      },
    });
    await app.ready;
    root.querySelector(`#${DEMO_BUTTON_ID}`).click();

    const csvButton = root.querySelector(`#${EXPORT_CSV_BUTTON_ID}`);
    const pdfButton = root.querySelector(`#${EXPORT_PDF_BUTTON_ID}`);
    expect(csvButton.getAttribute('aria-label')).toBe('CSV raporunu indir');
    expect(pdfButton.getAttribute('aria-label')).toBe('PDF raporu oluştur');

    // Buton gerçekten servise bağlı: tıklama indirme akışını (anchor click) tetikler.
    csvButton.click();
    expect(anchorClickSpy).toHaveBeenCalledTimes(1);

    const csvResult = app.exportCSV();
    expect(anchorClickSpy).toHaveBeenCalledTimes(2);
    expect(csvResult.filename).toBe('tokencost-report.csv');
    expect(csvResult.objectUrl).toBe('blob:token');
    expect(csvResult.blob.size).toBeGreaterThan(0);

    pdfButton.click();
    expect(generated).toHaveLength(1);
    expect(generated[0].config.filename).toBe('tokencost-report.pdf');
    expect(generated[0].html).toContain(SIGNATURE_TEXT);
    expect(generated[0].html).toContain('$13.80');
    expect(app.toasts.success).toBeGreaterThanOrEqual(2);

    anchorClickSpy.mockRestore();
  });

  it('dışa aktarımda veri yoksa uyarı verir (boş rapor üretmez)', async () => {
    const { root, app } = createOfflineApp();
    await app.ready;

    expect(app.exportCSV()).toBeNull();
    expect(app.exportPDF()).toBeNull();
    expect(root.querySelectorAll('.toast--warning').length).toBe(2);
  });

  it('ham metin ve .csv dosyası yüklendiğinde aynı toplamı üretir', async () => {
    const { root, app } = createOfflineApp();
    await app.ready;

    const pasted = app.loadText(SAMPLE_PASTED_TABLE_TEXT);
    expect(pasted.added).toBe(13);
    expect(formatCostDisplay(app.store.getState().summary.totalCostUSD)).toBe('$13.80');

    app.store.clearRecords();
    expect(app.store.getState().records).toHaveLength(0);

    const csvFile = new File([SAMPLE_PASTED_TABLE_TEXT], 'kullanim.csv', { type: 'text/csv' });
    await app.loadFiles([csvFile]);

    expect(app.store.getState().records).toHaveLength(13);
    expect(root.querySelectorAll(`#${TABLE_CONTAINER_ID} tbody tr`)).toHaveLength(13);
    expect(formatCostDisplay(app.store.getState().summary.totalCostUSD)).toBe('$13.80');
  });

  it('anlaşılmaz metinde uyarı verir, satır eklemez', async () => {
    const { root, app } = createOfflineApp();
    await app.ready;

    const result = app.loadText('bu bir kullanım tablosu değil');

    expect(result.added).toBe(0);
    expect(app.store.getState().records).toHaveLength(0);
    expect(root.querySelectorAll('.toast--warning').length).toBe(1);
  });

  it('OCR motoru yokken görsel için kibar uyarı verir (çökmez)', async () => {
    const { root, app } = createOfflineApp();
    await app.ready;

    const image = new File(['x'], 'ekran-goruntusu.png', { type: 'image/png' });
    const results = await app.loadFiles([image]);

    expect(results).toHaveLength(1);
    expect(results[0].records).toEqual([]);
    expect(app.store.getState().records).toHaveLength(0);
    expect(root.querySelectorAll('.toast--warning').length).toBe(1);
  });

  it('destroy() çağrısı store aboneliğini ve tablo bağını bırakır', async () => {
    const { app } = createOfflineApp();
    await app.ready;
    const before = app.store.getListenerCount();

    app.destroy();

    expect(app.store.getListenerCount()).toBeLessThan(before);
  });
});

describe('Faz 45: Ham metinden faturaya, .csv ve .pdf çıktısına tam akış', () => {
  it('E2E: Ham metin yapıştırmadan $13.80 faturaya, .csv ve .pdf çıktısına ve Made by Burak Yıldız imzasına tam akış', () => {
    // 1) Ham metin -> kayıtlar (özet satırı elenir, 13 veri satırı kalır)
    const parsed = parsePastedTableText(SAMPLE_PASTED_TABLE_TEXT);
    expect(parsed.records).toHaveLength(13);
    expect(parsed.parsedSummaryRow).not.toBeNull();

    // 2) Normalizasyon + takma ad: sağlayıcı önekli ad kanonik fiyat anahtarına iner
    const firstRow = parsed.records[0];
    expect(normalizeModelName(firstRow.model)).toBe('deepseek-v4.1-flash');
    expect(resolveModelAlias(normalizeModelName(firstRow.model))).toBe('deepseek-chat');

    // 3) Satır bazlı maliyet + 4) kümülatif özet (FinOps motoru)
    const calculated = buildCalculatedRecords(parsed.records, { catalog: DEMO_PRICING_CATALOG });
    expect(calculated).toHaveLength(13);
    expect(calculated.every((row) => row.pricingSource === 'custom')).toBe(true);

    const summary = aggregateUsageSummaries(calculated);
    expect(summary.totalTokens).toBe(DEMO_TOTAL_TOKENS);
    expect(summary.totalRequests).toBe(DEMO_TOTAL_REQUESTS);
    expect(formatCostDisplay(summary.totalCostUSD)).toBe('$13.80');

    const grouped = groupRecordsByModel(calculated);
    expect(grouped).toHaveLength(4);

    // 5) .csv çıktısı: UTF-8 BOM + başlık + 13 satır + TOPLAM + imza satırı
    const csv = generateCSVContent(calculated, summary);
    expect(csv.startsWith(CSV_UTF8_BOM)).toBe(true);

    const csvLines = csv.replace(CSV_UTF8_BOM, '').split('\n');
    expect(csvLines).toHaveLength(16);
    expect(csvLines[0]).toBe(
      'Tarih,Model,İstek,Toplam Token,Önbelleklenen,Kotaya Yansıyan,'
      + 'Önbellek Tasarrufu (USD),Tahmini Tutar (USD)',
    );
    expect(csvLines[14].startsWith('TOPLAM,')).toBe(true);
    expect(csvLines[14]).toContain('333698885');
    expect(csvLines[15]).toBe(`"${SIGNATURE_TEXT}"`);

    // 6) .pdf (yazdırılabilir HTML raporu): fatura + en altta imza
    const pdfHTML = generatePDFReportHTML(grouped, calculated, summary, { code: 'USD', rate: 1, symbol: '$' });
    expect(pdfHTML).toContain('TokenCost FinOps Analiz Raporu');
    expect(pdfHTML).toContain('$13.80');
    expect(pdfHTML).toContain(`<small class="app-signature">${SIGNATURE_TEXT}</small>`);
    expect(pdfHTML.indexOf(SIGNATURE_TEXT)).toBeGreaterThan(pdfHTML.lastIndexOf('</table>'));

    // 7) GitHub Issue/PR için Markdown raporu da aynı imzayı taşır
    const markdown = generateMarkdownReport(grouped, summary);
    expect(markdown).toContain('| Model |');
    expect(markdown).toContain('$13.80');
    expect(markdown).toContain(`<sub>${SIGNATURE_TEXT}</sub>`);
  });
});

describe('Faz 46: Çoklu ekran görüntüsü OCR ve tekilleştirme', () => {
  /** OCR'a verilebilecek sahte görsel (resolveImageData: imageData alanını okur). */
  function createFakeImage(index) {
    return {
      name: `ekran-${index}.png`,
      type: 'image/png',
      imageData: { data: [], width: 1, height: 1, order: index },
    };
  }

  /** Görsel sırasına göre önceden hazırlanmış OCR metnini döndüren sahte yönetici. */
  function createFakeOCRManager(texts) {
    const calls = [];
    return {
      calls,
      recognize: async (imageData) => {
        calls.push(imageData.order);
        const text = texts[Number(imageData.order) - 1];
        if (typeof text !== 'string') throw new Error('OCR_FAILED');
        return { data: { text } };
      },
    };
  }

  it('OCR gürültüsünü düzeltir: O -> 0, Z -> 2, gIm -> glm (gerçek harfleri korur)', () => {
    expect(cleanOCRTableArtefacts('3.6O0.O00')).toBe('3.600.000');
    expect(cleanOCRTableArtefacts('9Z')).toBe('92');
    expect(cleanOCRTableArtefacts('gIm-5.3')).toBe('glm-5.3');
    expect(cleanOCRTableArtefacts('qwen3-vl-30b')).toBe('qwen3-vl-30b');
  });

  it('E2E: 3 parçalı ekran görüntüsü OCR çıktılarının birleştirilmesi, örtüşen satırların silinmesi ve maliyet hesabı', async () => {
    // 2. görsel OCR gürültüsü içerir; 6 Eki glm-5.3 satırı 1. ve 2. görselde ÖRTÜŞÜR.
    const noisySecondScreenshot = SAMPLE_SCREENSHOT_TEXTS[1]
      .replace('glm-5.3', 'gIm-5.3')
      .replace('3.600.000', '3.6O0.O00')
      .replace('\t92\t', '\t9Z\t');

    expect(noisySecondScreenshot).toContain('gIm-5.3');
    expect(noisySecondScreenshot).toContain('\t9Z\t');

    const manager = createFakeOCRManager([
      SAMPLE_SCREENSHOT_TEXTS[0],
      noisySecondScreenshot,
      SAMPLE_SCREENSHOT_TEXTS[2],
    ]);

    const { root, app } = createOfflineApp({ ocrManager: manager });
    await app.ready;

    const imageFiles = [createFakeImage(1), createFakeImage(2), createFakeImage(3)];
    const results = await app.loadFiles(imageFiles);
    const ocrResult = results[0];

    expect(manager.calls).toEqual([1, 2, 3]);
    expect(ocrResult.errors).toEqual([]);
    expect(ocrResult.records).toHaveLength(13);
    // Örtüşen satır (6 Eki glm-5.3) yalnızca bir kez sayılır.
    expect(ocrResult.skippedDuplicates).toBe(1);

    const state = app.store.getState();
    expect(state.records).toHaveLength(13);
    expect(state.summary.totalTokens).toBe(333698885);
    expect(formatTokenCount(state.summary.totalTokens).full).toBe('333.698.885');
    expect(state.summary.totalRequests).toBe(4044);
    expect(formatCostDisplay(state.summary.totalCostUSD)).toBe('$13.80');

    // İlerleme çubuğu, tablo ve bildirimler
    expect(root.querySelector(`#${PROGRESS_BANNER_ID}`).dataset.step).toBe('done');
    expect(root.querySelectorAll(`#${TABLE_CONTAINER_ID} tbody tr`)).toHaveLength(13);
    expect(app.toasts.success).toBeGreaterThan(0);
  });

  it('okunamayan görselde akış durmaz, diğer görseller işlenir', async () => {
    const manager = createFakeOCRManager([SAMPLE_SCREENSHOT_TEXTS[2], undefined]);

    const { app } = createOfflineApp({ ocrManager: manager });
    await app.ready;

    const results = await app.loadFiles([createFakeImage(1), createFakeImage(2)]);
    const ocrResult = results[0];

    expect(ocrResult.errors).toHaveLength(1);
    expect(ocrResult.errors[0].file).toBe('ekran-2.png');
    expect(ocrResult.records).toHaveLength(3);
    expect(app.store.getState().records).toHaveLength(3);
  });
});
