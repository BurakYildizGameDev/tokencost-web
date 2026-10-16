// src/app.js
// Faz 44: Ana uygulama orkestratörü ve DOM bağlayıcı.
// Tüm katmanları (store, pricing, parser, OCR, charts, export) tek noktadan bağlar.
// KURAL: Her içe aktarımda açık .js uzantısı yazılır; aksi halde GitHub Pages'te
// yerel ES modülleri 404 Not Found verir.

import { createAppStore } from './ui/store.js';
import { bindInputEvents, filterAcceptedFiles, isImageMime, isTextMime } from './ui/input-handler.js';
import { FILE_KINDS, SUPPORTED_FORMATS_LABEL, detectFileKindFromBytes } from './core/file-type.js';
import {
  EXPORT_CSV_BUTTON_ID,
  EXPORT_PDF_BUTTON_ID,
  applyTranslations,
  notifyUnknownModelPrices,
  renderAppFooter,
  renderFinOpsSummaryCards,
  renderUsageTable,
  showNotification,
  updateProgressBanner,
} from './ui/components.js';
import { generateModelCostBarsSVG, generateModelCostDonutSVG } from './ui/charts.js';
import { formatCostDisplay } from './core/formatter.js';
import {
  LANGUAGES,
  LANGUAGE_LABELS,
  LANGUAGE_STORAGE_KEY,
  getLanguage,
  htmlLang,
  isSupportedLanguage,
  resolveLanguage,
  setLanguage,
  t,
} from './core/i18n.js';
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
export const LANGUAGE_SELECT_ID = 'language-select';

/** Veri girişi konsolu kimlikleri (index.html statik iskeletiyle birebir hizalı). */
export const PASTE_INPUT_ID = 'paste-input';
export const ANALYZE_TEXT_BUTTON_ID = 'btn-analyze-text';
export const CLEAR_TEXT_BUTTON_ID = 'btn-clear-text';
export const DROP_ZONE_ID = 'drop-zone';
export const FILE_INPUT_ID = 'file-input';
export const OPEN_FILE_BUTTON_ID = 'btn-open-file';
export const PRICING_SOURCE_CHIP_ID = 'pricing-source-chip';

/** Tema sözleşmesi. */
export const SUPPORTED_THEMES = Object.freeze(['dark', 'light']);
export const DEFAULT_THEME = 'dark';
export const THEME_STORAGE_KEY = 'tokencost_theme';
export const THEME_LABELS = Object.freeze({ dark: 'Açık Tema', light: 'Koyu Tema' });

/** Desteklenen para birimleri (kurlar currency-service varsayılanlarından gelir). */
export const SUPPORTED_CURRENCIES = Object.freeze(['USD', 'TRY', 'EUR']);

/** Düzenlenebilir tabloya kabul edilen görsel uzantıları (Faz 49: HEIC/GIF/BMP/TIFF/AVIF eklendi). */
export const IMAGE_EXTENSIONS = Object.freeze([
  'png', 'jpg', 'jpeg', 'jfif', 'webp', 'gif', 'bmp', 'tif', 'tiff', 'avif', 'heic', 'heif',
]);

/** Canlı fiyat sorgusu düğmesi (Faz 49). */
export const LIVE_PRICE_BUTTON_ID = 'btn-refresh-pricing';

/** Kullanıcıya gösterilen sabit metinler (test ve UI tek kaynaktan okur). */
export const CHART_ARIA_LABEL = 'Model bazlı maliyet dağılımı';
export const BARS_ARIA_LABEL = 'Model başına maliyet karşılaştırması';

/** Fiyat kataloğu kaynağının üst bilgi çipindeki karşılığı (tek kaynak). */
export const PRICING_SOURCE_LABELS = Object.freeze({
  cache: 'Fiyat kataloğu · önbellek',
  litellm: 'Fiyat kataloğu · LiteLLM',
  openrouter: 'Fiyat kataloğu · OpenRouter',
  fallback: 'Fiyat kataloğu · çevrimdışı',
  custom: 'Fiyat kataloğu · özel',
  unavailable: 'Fiyat kataloğu · yükleniyor',
});

/** Dosya seçiciye yazılan kabul listesi (index.html ile aynı; Faz 49'da genişletildi). */
export const ACCEPTED_FILE_ATTRIBUTE = [
  '.png', '.jpg', '.jpeg', '.webp', '.csv', '.txt',
  '.gif', '.bmp', '.tif', '.tiff', '.avif', '.heic', '.heif', '.jfif',
  '.tsv', '.json', '.md', '.log',
  'image/*', 'text/*',
].join(',');

/** Sürükleme sırasında bırakma alanına eklenen sınıf (styles.css ile hizalı). */
export const DROP_ACTIVE_CLASS = 'is-dragover';
export const CSV_BUTTON_ARIA_LABEL = 'CSV raporunu indir';
export const PDF_BUTTON_ARIA_LABEL = 'PDF raporu oluştur';
export const OFFLINE_PRICING_MESSAGE =
  'Fiyat servisine ulaşılamadı; çevrimdışı örnek fiyat kataloğu kullanıldı';
export const EMPTY_EXPORT_MESSAGE = 'Dışa aktarılacak veri yok; önce tabloya satır yükleyin';
export const EMPTY_TEXT_MESSAGE = 'Yapıştırılan metinde kullanım tablosu satırı bulunamadı';
export const REJECTED_FILE_MESSAGE = `Desteklenmeyen dosya biçimi (${SUPPORTED_FORMATS_LABEL})`;
export const UNSUPPORTED_CONTENT_MESSAGE =
  'Dosya içeriği okunamadı; geçerli bir görsel veya tablo metni (CSV/TXT) yükleyin';
export const EMPTY_PASTE_MESSAGE = 'Önce tablo metnini yapıştırın; ardından "Analiz Et" düğmesine basın';
export const CLEARED_PASTE_MESSAGE = 'Giriş alanı temizlendi (tablodaki satırlar korunur)';

/** Konsol düğme/etiket metinleri (index.html ve üretilen iskelet aynı metni kullanır). */
export const ANALYZE_BUTTON_LABEL = 'Analiz Et';
export const CLEAR_BUTTON_LABEL = 'Alanı Temizle';
export const OPEN_FILE_BUTTON_LABEL = 'Dosya Seç…';
export const DONUT_CENTER_LABEL = 'Tahmini fatura';
export const DONUT_CAPTION = 'Önbellek payı modele göre';
export const BARS_CAPTION = 'Gerçek fatura / önlenen maliyet (USD)';
export const OCR_UNAVAILABLE_MESSAGE =
  'OCR motoru bulunamadı; ekran görüntüsü yerine tablo metnini yapıştırın';
export const DEMO_LOADED_MESSAGE = 'Örnek konsol verisi yüklendi (13 satır, 333.7M token)';
export const CSV_EXPORTED_MESSAGE = '.CSV raporu indirildi (Made by Burak Yıldız imzalı)';
export const PDF_EXPORTED_MESSAGE = '.PDF raporu hazırlandı (Made by Burak Yıldız imzalı)';

/** Faz 49: Canlı (ağdan) fiyat sorgulama düğmesi metinleri. */
export const LIVE_PRICE_BUTTON_LABEL = 'Anlık Fiyat Sorgula';
export const LIVE_PRICE_LOADING_LABEL = 'Fiyatlar sorgulanıyor…';
export const LIVE_PRICE_FAILURE_MESSAGE =
  'Canlı fiyat kaynağına ulaşılamadı; mevcut/çevrimdışı fiyat kataloğu korundu';

/** Canlı fiyat sorgusu başarı bildirimi (model sayısı ile). */
export function buildLivePriceSuccessMessage(modelCount, source = 'litellm') {
  const count = Number.isFinite(Number(modelCount)) ? Math.max(0, Math.round(Number(modelCount))) : 0;
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return t('msg.livePricingUpdated', { count, source, time });
}

/** Faz 49: Reddedilen dosyalar için aktif dilde bildirim metni üretir. */
export function buildRejectedFileMessage(files) {
  const list = Array.isArray(files) ? files.filter(Boolean) : [];
  const names = list.map((file) => (file && file.name ? file.name : '?')).join(', ');
  return `${t('msg.rejectedFile', { name: names || '?' })} — ${t('msg.rejectedSupported', { supported: SUPPORTED_FORMATS_LABEL })}`;
}

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
  if (!file) return false;
  if (isImageMime(file.type)) return true;
  const name = typeof file.name === 'string' ? file.name.toLowerCase() : '';
  return IMAGE_EXTENSIONS.some((extension) => name.endsWith(`.${extension}`));
}

/**
 * Faz 49: Dosyanın ilk baytlarını okur (magic bytes denetimi için).
 * Önce Blob.slice + arrayBuffer denenir; desteklenmezse FileReader'a düşülür.
 * Hiçbiri yoksa null döner ve karar MIME/uzantıya bırakılır.
 */
async function readFileHeadBytes(file, environment = {}) {
  if (!file) return null;

  try {
    if (typeof file.slice === 'function') {
      const head = file.slice(0, 512);
      if (head && typeof head.arrayBuffer === 'function') return await head.arrayBuffer();
    }
    if (typeof file.arrayBuffer === 'function') return await file.arrayBuffer();
  } catch {
    // İkili okuma başarısızsa FileReader yedeğine geçilir.
  }

  const Reader = environment.FileReader
    || (typeof globalThis !== 'undefined' ? globalThis.FileReader : null);
  if (typeof Reader !== 'function') return null;

  return new Promise((resolve) => {
    try {
      const reader = new Reader();
      reader.onload = () => resolve(reader.result || null);
      reader.onerror = () => resolve(null);
      reader.readAsArrayBuffer(file);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Faz 49: Kabul edilen bir dosyanın görsel mi, metin mi olduğunu çözer.
 * Sıra: MIME türü → ilk baytlar (magic bytes) → uzantı. Böylece uzantısı yanlış olan
 * gerçek bir PNG görsel sayılır (metin sanılıp bozuk ayrıştırılmaz).
 * @returns {Promise<{ kind: 'image'|'text'|'unknown', format: string }>}
 */
async function classifyAcceptedFile(file, environment = {}) {
  if (isImageMime(file && file.type)) return { kind: FILE_KINDS.IMAGE, format: '' };
  if (isTextMime(file && file.type)) return { kind: FILE_KINDS.TEXT, format: '' };

  try {
    const buffer = await readFileHeadBytes(file, environment);
    if (buffer && buffer.byteLength > 0) {
      const detected = detectFileKindFromBytes(buffer);
      if (detected.isImage) return { kind: FILE_KINDS.IMAGE, format: detected.format };
      if (detected.isText) return { kind: FILE_KINDS.TEXT, format: detected.format };
      if (detected.kind === FILE_KINDS.UNKNOWN) {
        return { kind: FILE_KINDS.UNKNOWN, format: detected.format };
      }
    }
  } catch {
    // Baytlar okunamazsa uzantı sezgisiyle devam edilir.
  }

  return { kind: isImageFile(file) ? FILE_KINDS.IMAGE : FILE_KINDS.TEXT, format: '' };
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

/**
 * Tarayıcı File/Blob nesnesini OCR ön işlemesi için piksel verisine ({ name, data, width, height }) çevirir.
 * createImageBitmap + OffscreenCanvas (veya HTMLImageElement + Canvas) kullanır.
 * Saf piksel nesnesi veya mock ise doğrudan döner.
 */
async function readImageFileAsImageData(file, environment = {}) {
  if (!file) return null;
  if (file.imageData || (file.data && Number(file.width) > 0) || typeof file.getImageData === 'function') {
    return file;
  }

  const doc = environment.document || (typeof document !== 'undefined' ? document : null);
  const win = (doc && doc.defaultView) || (typeof window !== 'undefined' ? window : globalThis);

  // 1. Modern API: createImageBitmap + OffscreenCanvas
  if (typeof win.createImageBitmap === 'function' && typeof win.OffscreenCanvas === 'function') {
    try {
      const bitmap = await win.createImageBitmap(file);
      const canvas = new win.OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0);
        const imgData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
        if (typeof bitmap.close === 'function') bitmap.close();
        return {
          name: file.name || 'image',
          data: imgData.data,
          width: bitmap.width,
          height: bitmap.height,
        };
      }
    } catch {
      // 2. adıma düş
    }
  }

  // 2. DOM Canvas API: Image + document.createElement('canvas')
  if (doc && typeof doc.createElement === 'function') {
    const URLImpl = environment.URL || win.URL || globalThis.URL;
    if (URLImpl && typeof URLImpl.createObjectURL === 'function') {
      try {
        return await new Promise((resolve) => {
          const img = doc.createElement('img');
          const objectUrl = URLImpl.createObjectURL(file);
          img.onload = () => {
            try {
              const canvas = doc.createElement('canvas');
              const w = img.naturalWidth || img.width || 1;
              const h = img.naturalHeight || img.height || 1;
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0);
                const imgData = ctx.getImageData(0, 0, w, h);
                URLImpl.revokeObjectURL(objectUrl);
                resolve({
                  name: file.name || 'image',
                  data: imgData.data,
                  width: w,
                  height: h,
                });
                return;
              }
            } catch {
              // yoksay
            }
            URLImpl.revokeObjectURL(objectUrl);
            resolve(file);
          };
          img.onerror = () => {
            URLImpl.revokeObjectURL(objectUrl);
            resolve(file);
          };
          img.src = objectUrl;
        });
      } catch {
        // Hata durumunda dosyayı olduğu gibi bırak
      }
    }
  }

  return file;
}

/** HTML özel karakterlerini kaçırır (grafik/etiket metinleri güvenle gömülür). */
function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}

/** Hata mesajını kullanıcıya gösterilebilir metne çevirir. */
function describeError(error) {
  return error && typeof error.message === 'string' && error.message !== ''
    ? error.message
    : 'Beklenmeyen bir hata oluştu';
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

  // --- Veri girişi konsolu: yapıştırma alanı, dosya seçici, sürükle-bırak hedefi ---
  // index.html bu elementleri hazır sunar; sunmadığı ortamda (SPA/test) burada üretilir.
  // Kullanıcı verisini girecek gerçek bir alanı olmadan uygulama "vitrin" gibi kalırdı.
  const pasteInput = ensureContainer(doc, panel, PASTE_INPUT_ID, 'textarea', 'paste-input');
  const analyzeButton = ensureContainer(doc, panel, ANALYZE_TEXT_BUTTON_ID, 'button', 'btn btn--primary');
  analyzeButton.type = 'button';
  analyzeButton.textContent = t('btn.analyze');

  const clearButton = ensureContainer(doc, panel, CLEAR_TEXT_BUTTON_ID, 'button', 'btn');
  clearButton.type = 'button';
  clearButton.textContent = t('btn.clear');

  const dropZone = ensureContainer(doc, panel, DROP_ZONE_ID, 'div', 'drop-zone');
  const fileInput = ensureContainer(doc, dropZone, FILE_INPUT_ID, 'input', 'sr-only');
  fileInput.type = 'file';
  fileInput.multiple = true;
  if (!fileInput.getAttribute('accept')) fileInput.setAttribute('accept', ACCEPTED_FILE_ATTRIBUTE);

  const openFileButton = ensureContainer(doc, dropZone, OPEN_FILE_BUTTON_ID, 'button', 'btn');
  openFileButton.type = 'button';
  openFileButton.textContent = t('btn.chooseFile');

  // --- Üst panel kontrolleri ---
  const demoButton = ensureContainer(doc, panel, DEMO_BUTTON_ID, 'button', 'btn-demo no-print');
  demoButton.type = 'button';
  demoButton.textContent = t('btn.loadDemo');

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

  // Faz 49: "Anlık Fiyat Sorgula" — önbelleği atlayıp canlı fiyat kataloğunu yeniler.
  const livePriceButton = ensureContainer(doc, panel, LIVE_PRICE_BUTTON_ID, 'button', 'btn-refresh-pricing no-print');
  livePriceButton.type = 'button';
  livePriceButton.textContent = t('btn.livePricing');
  livePriceButton.title = t('btn.livePricing');

  // Faz 49: Arayüz dili seçici (TR/EN/DE/ZH/ES). Seçim localStorage'da saklanır.
  const languageSelect = ensureContainer(doc, panel, LANGUAGE_SELECT_ID, 'select', 'language-select no-print');
  if (languageSelect.options && languageSelect.options.length === 0) {
    for (const code of LANGUAGES) {
      const option = doc.createElement('option');
      option.value = code;
      option.textContent = LANGUAGE_LABELS[code] || code;
      languageSelect.appendChild(option);
    }
  }
  languageSelect.setAttribute('aria-label', t('label.language'));

  // --- Durum yönetimi (offline ilk açılışta demo kataloğu tohum olarak yüklenir) ---
  const store = options.store || createAppStore({
    currency: SUPPORTED_CURRENCIES[0],
    currencyRates: { ...DEFAULT_RATES, ...(options.currencyRates || {}) },
    pricingCatalog: { ...DEMO_PRICING_CATALOG, ...(options.pricingCatalog || {}) },
  });

  let theme = normalizeTheme(options.theme || readStoredTheme());
  let pricing = { catalog: {}, source: 'unavailable', isOfflineFallback: false, savedAt: null };
  let lastUnknownKey = '';
  let isRefreshingPrices = false;
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

  /** Fiyat kataloğunun kaynağını üst bilgideki çipe yazar (kullanıcı hangi fiyatı gördüğünü bilir). */
  function updatePricingSourceChip(result) {
    const chip = doc ? doc.getElementById(PRICING_SOURCE_CHIP_ID) : null;
    if (!chip) return null;

    const source = result && typeof result.source === 'string' ? result.source : 'unavailable';
    const label = t(`chip.pricing.${Object.prototype.hasOwnProperty.call(PRICING_SOURCE_LABELS, source) ? source : 'unavailable'}`);
    if (chip.textContent !== label) chip.textContent = label;
    return label;
  }

  // --- Altbilgi: imza + .csv/.pdf araç çubuğu (Faz 42 bileşeni) ---
  const footer = renderAppFooter(footerContainer, {
    onExportCSV: () => api.exportCSV(),
    onExportPDF: () => api.exportPDF(),
  });
  if (footer.csvButton) footer.csvButton.setAttribute('aria-label', CSV_BUTTON_ARIA_LABEL);
  if (footer.pdfButton) footer.pdfButton.setAttribute('aria-label', PDF_BUTTON_ARIA_LABEL);

  // --- Tablo (store'a kendi abone olur, düzenlemeleri geri yazar) ---
  let table = renderUsageTable(tableContainer, store.getState().calculatedRecords, store);

  /**
   * Grafikleri çizer (harici grafik kütüphanesi YOK, saf SVG):
   * solda fatura payını gösteren halka + ortada toplam, sağda model başına çubuklar.
   */
  function renderChart(groupedModels, summary) {
    const totalUSD = summary && Number.isFinite(Number(summary.totalCostUSD))
      ? Number(summary.totalCostUSD)
      : 0;

    const donut = generateModelCostDonutSVG(groupedModels, { ariaLabel: t('chart.donut.aria') });
    const bars = generateModelCostBarsSVG(groupedModels, { ariaLabel: t('chart.bars.aria') });

    const markup = [
      '<div class="chart-grid">',
      '<figure class="chart-figure chart-figure--donut">',
      '<div class="donut-wrap">',
      donut,
      '<div class="donut-center">',
      `<strong>${escapeHtml(formatCostDisplay(totalUSD))}</strong>`,
      `<span>${escapeHtml(t('chart.donut.center'))}</span>`,
      '</div>',
      '</div>',
      `<figcaption>${escapeHtml(t('chart.donut.caption'))}</figcaption>`,
      '</figure>',
      '<figure class="chart-figure chart-figure--bars">',
      bars,
      `<figcaption>${escapeHtml(t('chart.bars.caption', { cur: 'USD' }))}</figcaption>`,
      '</figure>',
      '</div>',
    ].join('');

    chartContainer.innerHTML = markup;
    return markup;
  }

  /** Tüm türetilmiş görünümleri (kartlar + grafikler) günceller. */
  function renderDerived(state) {
    // Faz 49: Seçili para birimi kartlara ve PDF raporuna aynı yerden geçirilir.
    renderFinOpsSummaryCards(cardsContainer, state.summary, state.currencyRates, state.currency);
    renderChart(state.groupedModels, state.summary);
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
    onReject: (files) => notify({ type: 'warning', message: buildRejectedFileMessage(files) }),
    onError: (error) => notify({ type: 'error', message: describeError(error) }),
    // Sürükleme sırasında bırakma alanı görsel olarak işaretlenir (kullanıcı nereye
    // bırakacağını görür); olay girdi panelinin tamamını kapsar.
    onDragStateChange: (isActive) => {
      if (dropZone && dropZone.classList) {
        dropZone.classList.toggle(DROP_ACTIVE_CLASS, Boolean(isActive));
      }
    },
  });

  // --- Üst panel + konsol kontrollerinin olay bağları (onclick/onchange: dinleyici birikmez) ---
  demoButton.onclick = () => api.loadDemoData();
  themeButton.onclick = () => api.toggleTheme();
  currencySelect.onchange = () => api.setCurrency(currencySelect.value);
  livePriceButton.onclick = () => { api.refreshLivePrices(); };
  languageSelect.onchange = () => { api.setLanguage(languageSelect.value); };

  analyzeButton.onclick = () => api.analyzePastedText();
  clearButton.onclick = () => api.clearPasteInput();
  openFileButton.onclick = () => {
    if (typeof fileInput.click === 'function') fileInput.click();
  };

  // Dosya seçici: seçim sonrası girdi sıfırlanır, böylece aynı dosya tekrar seçilebilir.
  fileInput.onchange = () => {
    const files = fileInput.files;
    api.loadFiles(files);
    try {
      fileInput.value = '';
    } catch {
      // Bazı ortamlar file input değerini sıfırlamaya izin vermez; kritik değil.
    }
  };

  // --- Tema (Dark / Light) ---
  function applyTheme(next) {
    theme = normalizeTheme(next);
    rootElement.setAttribute('data-theme', theme);

    // Tema yalnızca kök elemente yazılırsa gövde/scrollbar/formlar koyu kalıyordu.
    // Aynı değer <html> elementine de yazılır: styles.css belirteçleri buradan tüm sayfayı boyar.
    if (doc && doc.documentElement && typeof doc.documentElement.setAttribute === 'function') {
      doc.documentElement.setAttribute('data-theme', theme);
    }

    rootElement.classList.toggle('theme-dark', theme === 'dark');
    rootElement.classList.toggle('theme-light', theme === 'light');
    const themeLabel = t(theme === 'dark' ? 'theme.switchToLight' : 'theme.switchToDark');
    themeButton.textContent = themeLabel;
    themeButton.setAttribute('aria-pressed', String(theme === 'dark'));
    themeButton.setAttribute('title', themeLabel);

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
    notify({ type: 'success', message: t('msg.demoLoaded') });
    return store.getState();
  }

  // --- Metin ve dosya yükleme ---
  /** Yapıştırılan tablo metnini ayrıştırıp tabloya ekler. */
  function loadText(text) {
    const parsed = parsePastedTableText(text);

    if (parsed.records.length === 0) {
      notify({ type: 'warning', message: t('msg.emptyText') });
      return { added: 0, parsed };
    }

    store.addRecords(parsed.records);
    const rowCountStr = t('msg.unitRows', { count: parsed.records.length });
    notify({
      type: 'success',
      message: t('msg.rowsAdded', { count: rowCountStr }),
    });

    return { added: parsed.records.length, parsed };
  }

  /**
   * Metin alanındaki konsol tablosunu ayrıştırır ("Analiz Et" düğmesi).
   * Başarılı ayrıştırmada alan boşaltılır: veri artık tabloda, alan yeniden kullanılabilir.
   */
  function analyzePastedText() {
    const text = pasteInput && typeof pasteInput.value === 'string' ? pasteInput.value : '';

    if (text.trim() === '') {
      notify({ type: 'warning', message: t('msg.emptyPaste') });
      return { added: 0, parsed: null };
    }

    const result = loadText(text);
    if (result.added > 0 && pasteInput) pasteInput.value = '';
    return result;
  }

  /** Giriş alanını boşaltır (tabloya eklenmiş satırlar korunur). */
  function clearPasteInput() {
    if (pasteInput) pasteInput.value = '';
    notify({ type: 'info', message: t('msg.clearedPaste') });
    return true;
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
      notify({ type: 'warning', message: t('msg.ocrUnavailable') });
      return { records: [], skippedDuplicates: 0, errors: [] };
    }

    updateProgressBanner(banner, {
      step: 'ocr',
      percentage: 0,
      message: t('msg.ocrPreprocess', { label: t('drop.title') }),
      isVisible: true,
    });

    try {
      const preparedFiles = [];
      for (const file of imageFiles) {
        preparedFiles.push(await readImageFileAsImageData(file, environment));
      }

      const result = await processMultipleImagesToRecords(preparedFiles, manager, (progress) => {
        updateProgressBanner(banner, {
          step: progress && progress.step ? progress.step : 'ocr',
          percentage: progress ? progress.percentage : 0,
          message: progress && progress.message ? progress.message : '',
          isVisible: true,
        });
      });

      store.addRecords(result.records);
      const rowCountStr = t('msg.unitRows', { count: result.records.length });
      updateProgressBanner(banner, {
        step: 'done',
        percentage: 100,
        message: t('msg.ocrProcessed', { count: rowCountStr }),
        isVisible: true,
      });
      notify({
        type: 'success',
        message: t('msg.ocrProcessed', { count: rowCountStr }),
      });

      return result;
    } catch (error) {
      updateProgressBanner(banner, {
        step: 'error',
        percentage: 0,
        message: t('msg.ocrFailed'),
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

    if (rejected.length > 0) notify({ type: 'warning', message: buildRejectedFileMessage(rejected) });
    if (accepted.length === 0) return [];

    // Faz 49: Tür kararı MIME türü + ilk baytlar (magic bytes) ile verilir; uzantı son çaredir.
    // Böylece uzantısı/kimliği bozuk gerçek görseller yanlışlıkla metin sanılmaz.
    const classified = [];
    for (const file of accepted) {
      classified.push({ file, info: await classifyAcceptedFile(file, environment) });
    }

    const images = classified
      .filter((item) => item.info.kind === FILE_KINDS.IMAGE)
      .map((item) => item.file);
    const textFiles = classified
      .filter((item) => item.info.kind === FILE_KINDS.TEXT || item.info.kind === FILE_KINDS.TABLE)
      .map((item) => item.file);
    const unreadable = classified.filter((item) => item.info.kind === FILE_KINDS.UNKNOWN);

    if (unreadable.length > 0) notify({ type: 'warning', message: UNSUPPORTED_CONTENT_MESSAGE });

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
      notify({ type: 'warning', message: t('msg.emptyExport') });
      return null;
    }

    const csv = generateCSVContent(state.calculatedRecords, state.summary);
    const result = downloadCSVFile(csv, DEFAULT_CSV_FILENAME, environment);
    notify({ type: 'success', message: t('msg.csvExported') });
    return result;
  }

  function exportPDF() {
    const state = store.getState();
    if (state.calculatedRecords.length === 0) {
      notify({ type: 'warning', message: t('msg.emptyExport') });
      return null;
    }

    const reportHTML = generatePDFReportHTML(
      state.groupedModels,
      state.calculatedRecords,
      state.summary,
      buildCurrencyInfo(state),
    );
    const result = exportToPDF(reportHTML, DEFAULT_PDF_FILENAME, options.pdfGeneratorFn, environment);
    notify({ type: 'success', message: t('msg.pdfExported') });
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
      updatePricingSourceChip(result);
      const current = store.getState();
      store.setState({
        pricingCatalog: applyCustomPriceOverrides(result.catalog, current.customPrices),
        pricingSource: result.source,
      });

      if (result.isOfflineFallback) {
        notify({ type: 'info', title: t('toast.info'), message: t('msg.offlinePricing') });
      }

      return result;
    } catch (error) {
      notify({ type: 'error', message: describeError(error) });
      return pricing;
    }
  }

  /** Faz 49: "Anlık Fiyat Sorgula" düğmesini meşgul/hazır durumuna alır. */
  function setLivePriceButtonBusy(isBusy) {
    if (!livePriceButton) return;
    livePriceButton.disabled = Boolean(isBusy);
    livePriceButton.textContent = isBusy ? t('msg.livePricingRunning') : t('btn.livePricing');
    if (isBusy) livePriceButton.setAttribute('aria-busy', 'true');
    else livePriceButton.removeAttribute('aria-busy');
  }

  /**
   * Faz 49: Canlı fiyat sorgusu. Taze önbellek atlanır (forceRefresh) ve fiyatlar
   * LiteLLM/OpenRouter zincirinden yeniden çekilir. Ağ yoksa mevcut katalog korunur.
   * @returns {Promise<object>} pricing sonucu
   */
  async function refreshLivePrices() {
    if (isRefreshingPrices) return pricing;

    isRefreshingPrices = true;
    setLivePriceButtonBusy(true);

    try {
      const result = await loadPricingCatalog({
        storage,
        fetchFn: options.fetchFn,
        fallbackData: DEMO_PRICING_CATALOG,
        now: options.now,
        forceRefresh: true,
      });

      pricing = result;
      updatePricingSourceChip(result);

      const current = store.getState();
      const catalog = applyCustomPriceOverrides(result.catalog, current.customPrices);
      store.setState({ pricingCatalog: catalog, pricingSource: result.source });

      if (result.isOfflineFallback) {
        notify({ type: 'warning', message: t('msg.livePricingOffline') });
      } else {
        notify({ type: 'success', message: buildLivePriceSuccessMessage(Object.keys(catalog).length, result.source) });
      }

      return result;
    } catch (error) {
      notify({ type: 'error', message: describeError(error) });
      return pricing;
    } finally {
      isRefreshingPrices = false;
      setLivePriceButtonBusy(false);
    }
  }

  /** Faz 49: Kaydedilmiş dil tercihini okur (yoksa varsayılan dil). */
  function readStoredLanguage() {
    if (!storage || typeof storage.getItem !== 'function') return resolveLanguage(undefined);
    try {
      const stored = storage.getItem(LANGUAGE_STORAGE_KEY);
      return isSupportedLanguage(stored) ? resolveLanguage(stored) : resolveLanguage(undefined);
    } catch {
      return resolveLanguage(undefined);
    }
  }

  /** Faz 49: Üretilen iskelet düğmelerinin metinlerini aktif dile göre yeniler. */
  function applyControlLabels() {
    if (analyzeButton) analyzeButton.textContent = t('btn.analyze');
    if (clearButton) clearButton.textContent = t('btn.clear');
    if (openFileButton) openFileButton.textContent = t('btn.chooseFile');
    if (demoButton) demoButton.textContent = t('btn.loadDemo');
    if (livePriceButton && !livePriceButton.disabled) livePriceButton.textContent = t('btn.livePricing');
    if (languageSelect) languageSelect.setAttribute('aria-label', t('label.language'));
  }

  /**
   * Faz 49: Arayüz dilini uygular: sözlük + `<html lang>` + statik DOM + depolama.
   * Üretilen bileşenler `t()` ile çizildiği için tablo iskeleti de yeniden kurulur.
   * @param {string} code - 'tr' | 'en' | 'de' | 'zh' | 'es' (takma adlar kabul edilir)
   * @param {{ silent?: boolean }} [options] silent: kullanıcıya bildirim gösterme
   * @returns {string} Uygulanan dil kodu
   */
  function applyLanguage(code, options = {}) {
    const applied = setLanguage(code);

    try {
      if (storage && typeof storage.setItem === 'function') {
        storage.setItem(LANGUAGE_STORAGE_KEY, applied);
      }
    } catch {
      // Gizli mod/kota hatası dil seçimini yalnızca oturuma indirger.
    }

    if (doc && doc.documentElement) {
      doc.documentElement.lang = htmlLang(applied);
    }
    if (languageSelect && languageSelect.value !== applied) languageSelect.value = applied;

    applyTranslations(doc);
    applyControlLabels();
    updatePricingSourceChip(pricing);
    applyTheme(theme);

    // Tablo başlıkları/butonları çizim sırasında çevrildiği için iskelet tazelenir.
    table.destroy();
    tableContainer.innerHTML = '';
    table = renderUsageTable(tableContainer, store.getState().calculatedRecords, store);
    renderDerived(store.getState());

    if (!options.silent) {
      notify({
        type: 'info',
        message: t('msg.languageChanged', { language: LANGUAGE_LABELS[applied] || applied }),
      });
    }

    return applied;
  }

  // --- İlk çizim ve başlangıç akışı ---
  applyTheme(theme);
  applyLanguage(readStoredLanguage(), { silent: true });
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
      pasteInput,
      dropZone,
      fileInput,
      banner,
      cards: cardsContainer,
      chart: chartContainer,
      table: tableContainer,
      toastRegion: toastContainer,
      footer: footerContainer,
      usageTable: table.table,
      livePriceButton,
      languageSelect,
    },
    loadDemoData,
    loadText,
    analyzePastedText,
    clearPasteInput,
    loadFiles,
    loadImages,
    refreshLivePrices,
    exportCSV,
    exportPDF,
    setCurrency,
    setLanguage: applyLanguage,
    setTheme,
    toggleTheme,
    destroy,
    get theme() { return theme; },
    get pricing() { return pricing; },
    get language() { return getLanguage(); },
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





