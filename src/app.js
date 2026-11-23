// src/app.js
// Faz 44: Ana uygulama orkestratörü ve DOM bağlayıcı.
// Tüm katmanları (store, pricing, parser, OCR, charts, export) tek noktadan bağlar.
// KURAL: Her içe aktarımda açık .js uzantısı yazılır; aksi halde GitHub Pages'te
// yerel ES modülleri 404 Not Found verir.

import { createAppStore } from './ui/store.js';
import { bindInputEvents, filterAcceptedFiles } from './ui/input-handler.js';
import {
  EXPORT_CSV_BUTTON_ID,
  EXPORT_PDF_BUTTON_ID,
  notifyUnknownModelPrices,
  renderAppFooter,
  renderFinOpsSummaryCards,
  renderUsageTable,
  showNotification,
  updateProgressBanner,
} from './ui/components.js';
import { generateModelCostDonutSVG } from './ui/charts.js';
import { parsePastedTableText } from './core/parser.js';
import {
  DEMO_BUTTON_ID,
  DEMO_BUTTON_LABEL,
  DEMO_PRICING_CATALOG,
  getSampleScreenshotDataset,
} from './core/demo-data.js';
import { DEFAULT_RATES, convertCurrency } from './services/currency-service.js';
import { applyCustomPriceOverrides, loadPricingCatalog } from './services/pricing-service.js';
import {
  DEFAULT_CSV_FILENAME,
  DEFAULT_PDF_FILENAME,
  decodeStateFromHash,
  downloadCSVFile,
  exportToPDF,
  generateCSVContent,
  generatePDFReportHTML,
} from './services/export-service.js';
import { createOCRManager, processMultipleImagesToRecords } from './ocr/ocr-engine.js';

/** Uygulama kökünün sınıfı (styles.css bu sınıfa bağlanır). */
export const APP_ROOT_CLASS = 'tokencost-app';

/** DOM kimlikleri: index.html statik iskeleti bu kimlikleri taşırsa elementler yeniden kullanılır. */
export const INPUT_PANEL_ID = 'input-panel';
export const PROGRESS_BANNER_ID = 'progress-banner';
export const CARDS_CONTAINER_ID = 'finops-cards';
export const CHART_CONTAINER_ID = 'cost-chart';
export const TABLE_CONTAINER_ID = 'usage-table';
export const TOAST_CONTAINER_ID = 'toast-container';
export const FOOTER_CONTAINER_ID = 'app-footer';
export const THEME_TOGGLE_ID = 'btn-theme-toggle';
export const CURRENCY_SELECT_ID = 'currency-select';

/** Tema sözleşmesi. */
export const SUPPORTED_THEMES = Object.freeze(['dark', 'light']);
export const DEFAULT_THEME = 'dark';
export const THEME_STORAGE_KEY = 'tokencost_theme';
export const THEME_LABELS = Object.freeze({ dark: 'Açık Tema', light: 'Koyu Tema' });

/** Desteklenen para birimleri (kurlar currency-service varsayılanlarından gelir). */
export const SUPPORTED_CURRENCIES = Object.freeze(['USD', 'TRY', 'EUR']);

/** Düzenlenebilir tabloya kabul edilen görsel uzantıları. */
export const IMAGE_EXTENSIONS = Object.freeze(['png', 'jpg', 'jpeg', 'webp']);

/** Kullanıcıya gösterilen sabit metinler (test ve UI tek kaynaktan okur). */
export const CHART_ARIA_LABEL = 'Model bazlı maliyet dağılımı';
export const CSV_BUTTON_ARIA_LABEL = 'CSV raporunu indir';
export const PDF_BUTTON_ARIA_LABEL = 'PDF raporu oluştur';
export const OFFLINE_PRICING_MESSAGE =
  'Fiyat servisine ulaşılamadı; çevrimdışı örnek fiyat kataloğu kullanıldı';
export const EMPTY_EXPORT_MESSAGE = 'Dışa aktarılacak veri yok; önce tabloya satır yükleyin';
export const EMPTY_TEXT_MESSAGE = 'Yapıştırılan metinde kullanım tablosu satırı bulunamadı';
export const REJECTED_FILE_MESSAGE = 'Desteklenmeyen dosya biçimi (PNG, JPG, JPEG, WEBP, CSV, TXT)';
export const OCR_UNAVAILABLE_MESSAGE =
  'OCR motoru bulunamadı; ekran görüntüsü yerine tablo metnini yapıştırın';
export const DEMO_LOADED_MESSAGE = 'Örnek konsol verisi yüklendi (13 satır, 333.7M token)';
export const CSV_EXPORTED_MESSAGE = '.CSV raporu indirildi (Made by Burak Yıldız imzalı)';
export const PDF_EXPORTED_MESSAGE = '.PDF raporu hazırlandı (Made by Burak Yıldız imzalı)';

/** Ortam nesnesini normalize eder; DOM okuma/URL yazma tek noktadan enjekte edilebilir. */
function resolveEnvironment(options = {}) {
  const env = options.environment && typeof options.environment === 'object'
    ? { ...options.environment }
    : {};
  const doc = env.document
    || (options.rootElement ? options.rootElement.ownerDocument : null)
    || (typeof globalThis !== 'undefined' ? globalThis.document : null);
  if (doc) env.document = doc;
  if (!env.storage && options.storage) env.storage = options.storage;
  if (!env.URL && options.URL) env.URL = options.URL;
  if (!env.FileReader && options.FileReader) env.FileReader = options.FileReader;
  return env;
}

/**
 * Elementi kimliğine göre bulur, yoksa oluşturur.
 * index.html statik iskelet sunmadığında da uygulama tek başına çalışır.
 */
function ensureContainer(doc, parent, id, tagName, className) {
  const existing = parent.querySelector(`#${id}`);
  if (existing) return existing;

  const element = doc.createElement(tagName);
  element.id = id;
  if (className) element.className = className;
  parent.appendChild(element);
  return element;
}

/** Tema değerini desteklenenler listesine göre doğrular. */
function normalizeTheme(value) {
  return SUPPORTED_THEMES.includes(value) ? value : DEFAULT_THEME;
}

/** Dosya görsel mi? (OCR yalnızca görsellerde çalışır; CSV/TXT doğrudan okunur) */
function isImageFile(file) {
  const name = file && typeof file.name === 'string' ? file.name.toLowerCase() : '';
  const type = file && typeof file.type === 'string' ? file.type.toLowerCase() : '';
  if (type.indexOf('image/') === 0) return true;
  return IMAGE_EXTENSIONS.some((extension) => name.endsWith(`.${extension}`));
}

/** Dosyayı metne çevirir (FileReader yoksa Blob.text() yedeğine düşer). */
function readFileAsText(file, environment = {}) {
  const Reader = environment.FileReader
    || (typeof globalThis !== 'undefined' ? globalThis.FileReader : null);

  if (typeof Reader !== 'function') {
    if (file && typeof file.text === 'function') return Promise.resolve(file.text());
    return Promise.reject(new Error('ERR_FILE_READER_UNAVAILABLE'));
  }

  return new Promise((resolve, reject) => {
    try {
      const reader = new Reader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(reader.error || new Error('ERR_FILE_READ_FAILED'));
      reader.readAsText(file);
    } catch (error) {
      reject(error);
    }
  });
}

/** Hata mesajını kullanıcıya gösterilebilir metne çevirir. */
function describeError(error) {
  return error && typeof error.message === 'string' && error.message !== ''
    ? error.message
    : 'Beklenmeyen bir hata oluştu';
}

/** Satır sayısını kullanıcı dostu metne çevirir ("13 satır"). */
function formatRowCount(count) {
  const value = Number.isFinite(Number(count)) ? Math.round(Number(count)) : 0;
  return `${value} satır`;
}

/**
 * Faz 44: Uygulamayı verilen kök element üzerinde başlatır.
 * @param {HTMLElement} rootElement
 * @param {object} [options] Test enjeksiyonları (fetchFn, storage, environment, pdfGeneratorFn...)
 * @returns {object} Uygulama denetleyicisi (api)
 */
export function initApp(rootElement, options = {}) {
  if (!rootElement || typeof rootElement.querySelector !== 'function') {
    throw new TypeError('ERR_INVALID_ROOT_ELEMENT');
  }

  const environment = resolveEnvironment({ ...options, rootElement });
  const doc = environment.document || rootElement.ownerDocument;
  const storage = environment.storage || null;

  rootElement.classList.add(APP_ROOT_CLASS);

  // --- DOM iskeleti (index.html varsa yeniden kullanılır, yoksa üretilir) ---
  const panel = ensureContainer(doc, rootElement, INPUT_PANEL_ID, 'section', 'input-panel no-print');
  const banner = ensureContainer(doc, rootElement, PROGRESS_BANNER_ID, 'div', 'progress-banner no-print');
  const cardsContainer = ensureContainer(doc, rootElement, CARDS_CONTAINER_ID, 'section', 'cards-section');
  const chartContainer = ensureContainer(doc, rootElement, CHART_CONTAINER_ID, 'section', 'chart-section');
  const tableContainer = ensureContainer(doc, rootElement, TABLE_CONTAINER_ID, 'section', 'table-section');
  const toastContainer = ensureContainer(doc, rootElement, TOAST_CONTAINER_ID, 'div', 'toast-region no-print');
  const footerContainer = ensureContainer(doc, rootElement, FOOTER_CONTAINER_ID, 'div', 'footer-region');

  updateProgressBanner(banner, { step: 'idle', percentage: 0, message: '', isVisible: false });

  // --- Üst panel kontrolleri ---
  const demoButton = ensureContainer(doc, panel, DEMO_BUTTON_ID, 'button', 'btn-demo no-print');
  demoButton.type = 'button';
  demoButton.textContent = DEMO_BUTTON_LABEL;

  const themeButton = ensureContainer(doc, panel, THEME_TOGGLE_ID, 'button', 'btn-theme-toggle no-print');
  themeButton.type = 'button';

  const currencySelect = ensureContainer(doc, panel, CURRENCY_SELECT_ID, 'select', 'currency-select no-print');
  if (currencySelect.options && currencySelect.options.length === 0) {
    for (const code of SUPPORTED_CURRENCIES) {
      const option = doc.createElement('option');
      option.value = code;
      option.textContent = code;
      currencySelect.appendChild(option);
    }
  }

  // --- Durum yönetimi (offline ilk açılışta demo kataloğu tohum olarak yüklenir) ---
  const store = options.store || createAppStore({
    currency: SUPPORTED_CURRENCIES[0],
    currencyRates: { ...DEFAULT_RATES, ...(options.currencyRates || {}) },
    pricingCatalog: { ...DEMO_PRICING_CATALOG, ...(options.pricingCatalog || {}) },
  });

  let theme = normalizeTheme(options.theme || readStoredTheme());
  let pricing = { catalog: {}, source: 'unavailable', isOfflineFallback: false, savedAt: null };
  let lastUnknownKey = '';
  const toasts = { info: 0, success: 0, warning: 0, error: 0 };

  function readStoredTheme() {
    if (!storage || typeof storage.getItem !== 'function') return DEFAULT_THEME;
    try {
      return storage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME;
    } catch {
      return DEFAULT_THEME;
    }
  }

  /** Bildirim gösterir ve tip sayaçlarını artırır (test/gözlem için). */
  function notify(notification = {}) {
    const toast = showNotification(toastContainer, notification);
    const type = toast && Object.prototype.hasOwnProperty.call(toasts, toast.type) ? toast.type : 'info';
    toasts[type] += 1;
    return toast;
  }

  // --- Altbilgi: imza + .csv/.pdf araç çubuğu (Faz 42 bileşeni) ---
  const footer = renderAppFooter(footerContainer, {
    onExportCSV: () => api.exportCSV(),
    onExportPDF: () => api.exportPDF(),
  });
  if (footer.csvButton) footer.csvButton.setAttribute('aria-label', CSV_BUTTON_ARIA_LABEL);
  if (footer.pdfButton) footer.pdfButton.setAttribute('aria-label', PDF_BUTTON_ARIA_LABEL);

  // --- Tablo (store'a kendi abone olur, düzenlemeleri geri yazar) ---
  const table = renderUsageTable(tableContainer, store.getState().calculatedRecords, store);

  /** Halka grafiği çizer (harici grafik kütüphanesi YOK, saf SVG). */
  function renderChart(groupedModels) {
    const svg = generateModelCostDonutSVG(groupedModels, { ariaLabel: CHART_ARIA_LABEL });
    chartContainer.innerHTML = svg;
    return svg;
  }

  /** Tüm türetilmiş görünümleri (kartlar + grafik) günceller. */
  function renderDerived(state) {
    renderFinOpsSummaryCards(cardsContainer, state.summary, state.currencyRates);
    renderChart(state.groupedModels);
    if (currencySelect.value !== state.currency) currencySelect.value = state.currency;
    return state;
  }

  const unsubscribe = store.subscribe((state) => {
    renderDerived(state);

    // Aynı bilinmeyen model kümesi için tekrar tekrar uyarı göstermeyiz.
    const unknownKey = state.unknownModels.join('|');
    if (unknownKey !== '' && unknownKey !== lastUnknownKey) {
      notifyUnknownModelPrices(toastContainer, state.unknownModels);
      toasts.warning += 1;
    }
    lastUnknownKey = unknownKey;
  });

  // --- Girdi olayları: Ctrl+V yapıştırma ve sürükle-bırak ---
  const inputBinding = bindInputEvents(panel, {
    onText: (text) => { api.loadText(text); },
    onFiles: (files) => { api.loadFiles(files); },
    onReject: () => notify({ type: 'warning', message: REJECTED_FILE_MESSAGE }),
    onError: (error) => notify({ type: 'error', message: describeError(error) }),
  });

  // --- Üst panel kontrollerinin olay bağları (onclick/onchange: dinleyici birikmez) ---
  demoButton.onclick = () => api.loadDemoData();
  themeButton.onclick = () => api.toggleTheme();
  currencySelect.onchange = () => api.setCurrency(currencySelect.value);

  // --- Tema (Dark / Light) ---
  function applyTheme(next) {
    theme = normalizeTheme(next);
    rootElement.setAttribute('data-theme', theme);
    rootElement.classList.toggle('theme-dark', theme === 'dark');
    rootElement.classList.toggle('theme-light', theme === 'light');
    themeButton.textContent = THEME_LABELS[theme];
    themeButton.setAttribute('aria-pressed', String(theme === 'dark'));
    themeButton.setAttribute('title', THEME_LABELS[theme]);

    if (storage && typeof storage.setItem === 'function') {
      try {
        storage.setItem(THEME_STORAGE_KEY, theme);
      } catch {
        // Gizli mod / kota hataları uygulamayı durdurmaz.
      }
    }

    return theme;
  }

  function setTheme(next) {
    return applyTheme(next);
  }

  function toggleTheme() {
    return applyTheme(theme === 'dark' ? 'light' : 'dark');
  }

  // --- Para birimi ---
  function setCurrency(code) {
    const requested = String(code || '').trim().toUpperCase();
    const normalized = SUPPORTED_CURRENCIES.includes(requested) ? requested : SUPPORTED_CURRENCIES[0];
    store.setState({ currency: normalized });
    renderDerived(store.getState());
    return normalized;
  }

  /** PDF rapor başlığı için para birimi bilgisi (kod, kur, sembol). */
  function buildCurrencyInfo(state) {
    const code = SUPPORTED_CURRENCIES.includes(state.currency) ? state.currency : SUPPORTED_CURRENCIES[0];
    try {
      const converted = convertCurrency(1, code, state.currencyRates);
      return { code, rate: converted.rate, symbol: converted.symbol };
    } catch {
      return { code: 'USD', rate: 1, symbol: String.fromCharCode(36) };
    }
  }

  // --- Demo (vitrin) verisi ---
  /** Vitrin senaryosunun fiyatlarını garanti altına alır (offline demo kataloğu). */
  function ensureDemoPricing() {
    const state = store.getState();
    const missing = {};
    for (const [key, profile] of Object.entries(DEMO_PRICING_CATALOG)) {
      if (!state.pricingCatalog[key]) missing[key] = profile;
    }
    if (Object.keys(missing).length > 0) {
      store.setState({ pricingCatalog: { ...state.pricingCatalog, ...missing } });
    }
    return Object.keys(missing).length;
  }

  function loadDemoData() {
    ensureDemoPricing();
    store.clearRecords();
    store.addRecords(getSampleScreenshotDataset());
    notify({ type: 'success', message: DEMO_LOADED_MESSAGE });
    return store.getState();
  }

  // --- Metin ve dosya yükleme ---
  /** Yapıştırılan tablo metnini ayrıştırıp tabloya ekler. */
  function loadText(text) {
    const parsed = parsePastedTableText(text);

    if (parsed.records.length === 0) {
      notify({ type: 'warning', message: EMPTY_TEXT_MESSAGE });
      return { added: 0, parsed };
    }

    store.addRecords(parsed.records);
    notify({
      type: 'success',
      message: `${formatRowCount(parsed.records.length)} tabloya eklendi`,
    });

    return { added: parsed.records.length, parsed };
  }

  /** OCR yöneticisini çözer: enjekte edilen > global Tesseract. */
  function resolveOCRManager() {
    if (options.ocrManager) return options.ocrManager;

    const lib = options.tesseractLib
      || (typeof globalThis !== 'undefined' ? globalThis.Tesseract : null);
    if (!lib) return null;

    try {
      return createOCRManager(lib);
    } catch {
      return null;
    }
  }

  /** Ekran görüntülerini OCR'dan geçirip satırları tabloya ekler. */
  async function loadImages(imageFiles) {
    const manager = resolveOCRManager();

    if (!manager) {
      notify({ type: 'warning', message: OCR_UNAVAILABLE_MESSAGE });
      return { records: [], skippedDuplicates: 0, errors: [] };
    }

    updateProgressBanner(banner, {
      step: 'ocr',
      percentage: 0,
      message: 'Ekran görüntüleri işleniyor...',
      isVisible: true,
    });

    try {
      const result = await processMultipleImagesToRecords(imageFiles, manager, (progress) => {
        updateProgressBanner(banner, {
          step: progress && progress.step ? progress.step : 'ocr',
          percentage: progress ? progress.percentage : 0,
          message: progress && progress.message ? progress.message : '',
          isVisible: true,
        });
      });

      store.addRecords(result.records);
      updateProgressBanner(banner, {
        step: 'done',
        percentage: 100,
        message: `${formatRowCount(result.records.length)} görselden okundu`,
        isVisible: true,
      });
      notify({
        type: 'success',
        message: `${formatRowCount(result.records.length)} görselden okundu`,
      });

      return result;
    } catch (error) {
      updateProgressBanner(banner, {
        step: 'error',
        percentage: 0,
        message: 'Görsel işlenemedi',
        isVisible: true,
      });
      notify({ type: 'error', message: describeError(error) });
      return { records: [], skippedDuplicates: 0, errors: [{ file: '', message: describeError(error) }] };
    }
  }

  /** Sürüklenen/yapıştırılan dosyaları türüne göre işler (görsel -> OCR, metin -> ayrıştırıcı). */
  async function loadFiles(files) {
    const list = Array.isArray(files) ? files.filter(Boolean) : [files].filter(Boolean);
    const { accepted, rejected } = filterAcceptedFiles(list);

    if (rejected.length > 0) notify({ type: 'warning', message: REJECTED_FILE_MESSAGE });
    if (accepted.length === 0) return [];

    const images = accepted.filter((file) => isImageFile(file));
    const textFiles = accepted.filter((file) => !isImageFile(file));
    const results = [];

    for (const file of textFiles) {
      try {
        const text = await readFileAsText(file, environment);
        results.push(loadText(text));
      } catch (error) {
        notify({ type: 'error', message: describeError(error) });
        results.push({ added: 0, parsed: null });
      }
    }

    if (images.length > 0) results.push(await loadImages(images));

    return results;
  }

  // --- Dışa aktarım (.csv / .pdf) ---
  function exportCSV() {
    const state = store.getState();
    if (state.calculatedRecords.length === 0) {
      notify({ type: 'warning', message: EMPTY_EXPORT_MESSAGE });
      return null;
    }

    const csv = generateCSVContent(state.calculatedRecords, state.summary);
    const result = downloadCSVFile(csv, DEFAULT_CSV_FILENAME, environment);
    notify({ type: 'success', message: CSV_EXPORTED_MESSAGE });
    return result;
  }

  function exportPDF() {
    const state = store.getState();
    if (state.calculatedRecords.length === 0) {
      notify({ type: 'warning', message: EMPTY_EXPORT_MESSAGE });
      return null;
    }

    const reportHTML = generatePDFReportHTML(
      state.groupedModels,
      state.calculatedRecords,
      state.summary,
      buildCurrencyInfo(state),
    );
    const result = exportToPDF(reportHTML, DEFAULT_PDF_FILENAME, options.pdfGeneratorFn, environment);
    notify({ type: 'success', message: PDF_EXPORTED_MESSAGE });
    return result;
  }

  // --- URL hash durumu (#data=...) ---
  function resolveInitialHash() {
    if (typeof options.initialHash === 'string') return options.initialHash;

    const location = environment.location
      || (environment.window && environment.window.location)
      || (typeof globalThis !== 'undefined' ? globalThis.location : null);

    return location && typeof location.hash === 'string' ? location.hash : '';
  }

  /** Paylaşılan bağlantıdaki kayıtları tabloya yükler (bozuksa sessizce boş kalır). */
  function restoreFromHash() {
    const restored = decodeStateFromHash(resolveInitialHash());
    if (!restored || restored.length === 0) return [];
    store.addRecords(restored);
    return restored;
  }

  // --- Fiyat kataloğu: cache -> LiteLLM -> OpenRouter -> statik fallback ---
  async function bootstrapPricing() {
    try {
      const result = await loadPricingCatalog({
        storage,
        fetchFn: options.fetchFn,
        fallbackData: DEMO_PRICING_CATALOG,
        now: options.now,
      });

      pricing = result;
      const current = store.getState();
      store.setState({
        pricingCatalog: applyCustomPriceOverrides(result.catalog, current.customPrices),
        pricingSource: result.source,
      });

      if (result.isOfflineFallback) {
        notify({ type: 'info', title: 'Çevrimdışı fiyatlar', message: OFFLINE_PRICING_MESSAGE });
      }

      return result;
    } catch (error) {
      notify({ type: 'error', message: describeError(error) });
      return pricing;
    }
  }

  // --- İlk çizim ve başlangıç akışı ---
  applyTheme(theme);
  renderDerived(store.getState());
  const restoredRecords = restoreFromHash();
  const ready = bootstrapPricing();

  const api = {
    store,
    ready,
    toasts,
    restoredRecords,
    elements: {
      root: rootElement,
      panel,
      banner,
      cards: cardsContainer,
      chart: chartContainer,
      table: tableContainer,
      toastRegion: toastContainer,
      footer: footerContainer,
      usageTable: table.table,
    },
    loadDemoData,
    loadText,
    loadFiles,
    loadImages,
    exportCSV,
    exportPDF,
    setCurrency,
    setTheme,
    toggleTheme,
    destroy,
    get theme() { return theme; },
    get pricing() { return pricing; },
    get currencyInfo() { return buildCurrencyInfo(store.getState()); },
  };

  /** Abonelikleri ve DOM dinleyicilerini bırakır (test/SPA temizliği). */
  function destroy() {
    unsubscribe();
    inputBinding.destroy();
    table.destroy();
    return true;
  }

  return api;
}





