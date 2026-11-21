// src/ui/components.js
// Faz 33 - 35: Arayüz bileşenleri (düzenlenebilir tablo, ilerleme çubuğu, toast).
// KURAL: Framework yok; event delegation + kısmi DOM güncellemesi kullanılır.
// Kritik: Her tuş vuruşunda tüm tablo yeniden çizilmez (kullanıcı odağı korunur).

import { aggregateUsageSummaries } from '../core/calculator.js';
import { formatCostDisplay, formatTokenCount } from '../core/formatter.js';
import { convertCurrency } from '../services/currency-service.js';
import { SIGNATURE_TEXT } from '../services/export-service.js';

/** Kullanıcı tarafından düzenlenebilen hücre alanları. */
export const EDITABLE_FIELDS = Object.freeze([
  'date',
  'model',
  'requests',
  'totalTokens',
  'cachedTokens',
  'billedTokens',
]);

/** Sayısal (metin değil) düzenlenebilir alanlar. */
export const NUMERIC_FIELDS = Object.freeze(['requests', 'totalTokens', 'cachedTokens', 'billedTokens']);

/** Tablo sütun tanımları (sırayla). */
export const USAGE_TABLE_COLUMNS = Object.freeze([
  { field: 'date', label: 'Tarih' },
  { field: 'model', label: 'Model' },
  { field: 'requests', label: 'İstek' },
  { field: 'totalTokens', label: 'Toplam Token' },
  { field: 'cachedTokens', label: 'Önbelleklenen' },
  { field: 'billedTokens', label: 'Faturalı' },
  { field: 'cacheHitRatio', label: 'Önbellek %' },
  { field: 'totalCostUSD', label: 'Tahmini Tutar' },
  { field: 'actions', label: 'İşlem' },
]);

/**
 * Faz 33: Kullanıcının hücreye yazdığı sayıyı çözer.
 * TR (1.234.567,89) ve EN (1,234,567.89) biçimlerini destekler.
 * @param {string|number} raw
 * @returns {number|null} Geçersizse null (eski değer korunur).
 */
export function parseEditableNumber(raw) {
  if (typeof raw === 'number') return Number.isFinite(raw) && raw >= 0 ? raw : null;

  let text = String(raw === undefined || raw === null ? '' : raw).trim().replace(/\s/g, '');
  if (text === '') return 0;

  if (text.includes(',')) {
    text = text.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
    text = text.replace(/\./g, '');
  }

  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/** Hücre içeriğini (kullanıcıya gösterilecek biçimde) üretir. */
function formatCellValue(field, record) {
  switch (field) {
    case 'cacheHitRatio':
      return `${Number(record.cacheHitRatio) || 0}%`;
    case 'totalCostUSD':
      return formatCostDisplay(record.totalCostUSD);
    case 'requests':
    case 'totalTokens':
    case 'cachedTokens':
    case 'billedTokens':
      return formatTokenCount(record[field]).full;
    default:
      return record[field] === undefined || record[field] === null ? '' : String(record[field]);
  }
}

/** Düzenleme açıldığında input'a yazılacak ham değeri üretir. */
function formatEditableValue(field, record) {
  if (NUMERIC_FIELDS.includes(field)) return String(Number(record[field]) || 0);
  return record[field] === undefined || record[field] === null ? '' : String(record[field]);
}

/** Boş bir satır (tr) DOM düğümü üretir. */
function createRowElement(doc, record) {
  const row = doc.createElement('tr');
  row.className = 'usage-row';
  row.dataset.rowId = record.id;

  for (const column of USAGE_TABLE_COLUMNS) {
    const cell = doc.createElement('td');
    cell.className = 'cell';
    cell.dataset.field = column.field;
    cell.dataset.rowId = record.id;

    if (EDITABLE_FIELDS.includes(column.field)) {
      cell.classList.add('cell--editable');
      cell.dataset.editable = 'true';
      cell.tabIndex = 0;
    }

    if (column.field === 'actions') {
      const removeButton = doc.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'btn-remove-row';
      removeButton.dataset.action = 'remove-row';
      removeButton.dataset.rowId = record.id;
      removeButton.title = 'Satırı sil';
      removeButton.textContent = '✕';
      cell.appendChild(removeButton);
    } else {
      cell.textContent = formatCellValue(column.field, record);
    }

    row.appendChild(cell);
  }

  return row;
}

/** Tablo iskeletini (thead + tbody + footer) bir kez oluşturur. */
function ensureTableStructure(containerEl) {
  const existingTable = containerEl.querySelector('table.usage-table');
  if (existingTable) {
    return {
      table: existingTable,
      tbody: existingTable.querySelector('tbody'),
      summaryValue: containerEl.querySelector('[data-summary="totalCostUSD"]'),
    };
  }

  const doc = containerEl.ownerDocument;
  const table = doc.createElement('table');
  table.className = 'usage-table';

  const thead = doc.createElement('thead');
  const headRow = doc.createElement('tr');
  for (const column of USAGE_TABLE_COLUMNS) {
    const th = doc.createElement('th');
    th.dataset.field = column.field;
    th.textContent = column.label;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);

  const tbody = doc.createElement('tbody');
  table.appendChild(thead);
  table.appendChild(tbody);

  const footer = doc.createElement('div');
  footer.className = 'usage-table-footer';

  const addButton = doc.createElement('button');
  addButton.type = 'button';
  addButton.className = 'btn-add-row';
  addButton.dataset.action = 'add-row';
  addButton.textContent = '+ Satır Ekle';

  const summary = doc.createElement('span');
  summary.className = 'usage-summary';
  const summaryLabel = doc.createElement('span');
  summaryLabel.className = 'usage-summary-label';
  summaryLabel.textContent = 'Toplam Tahmini Tutar: ';
  const summaryValue = doc.createElement('strong');
  summaryValue.className = 'usage-summary-value';
  summaryValue.dataset.summary = 'totalCostUSD';
  summary.appendChild(summaryLabel);
  summary.appendChild(summaryValue);

  footer.appendChild(addButton);
  footer.appendChild(summary);
  containerEl.appendChild(table);
  containerEl.appendChild(footer);

  return { table, tbody, summaryValue };
}

/** Store içinden kimliğe göre hesaplanmış kaydı bulur. */
function findRecordById(store, recordId) {
  if (!store || typeof store.getState !== 'function') return null;
  const state = store.getState();
  const rows = Array.isArray(state.calculatedRecords) ? state.calculatedRecords : [];
  return rows.find((row) => row.id === recordId) || null;
}

/** Özet (toplam fatura) alanını günceller. */
function updateSummaryValue(summaryValue, records) {
  if (!summaryValue) return;
  const summary = aggregateUsageSummaries(records);
  const text = formatCostDisplay(summary.totalCostUSD);
  if (summaryValue.textContent !== text) summaryValue.textContent = text;
}

/**
 * Satır hücrelerini günceller.
 * Düzenleme modundaki (data-editing="true") hücreye dokunmaz; böylece kullanıcı odağı kaybolmaz.
 */
function updateRowElement(row, record) {
  for (const column of USAGE_TABLE_COLUMNS) {
    if (column.field === 'actions') continue;
    const cell = row.querySelector(`[data-field="${column.field}"]`);
    if (!cell) continue;
    if (cell.dataset.editing === 'true') continue;

    const text = formatCellValue(column.field, record);
    if (cell.textContent !== text) cell.textContent = text;
  }
}

/** Kayıt listesini mevcut DOM satırlarıyla senkronlar (innerHTML='' ile tam yeniden çizim YAPMAZ). */
function syncRows(tbody, records) {
  if (!tbody) return;
  const doc = tbody.ownerDocument;
  const seen = new Set();

  records.forEach((record, index) => {
    seen.add(record.id);
    let row = tbody.querySelector(`tr[data-row-id="${record.id}"]`);
    if (!row) row = createRowElement(doc, record);

    const referenceRow = tbody.children[index] || null;
    if (referenceRow !== row) tbody.insertBefore(row, referenceRow);

    updateRowElement(row, record);
  });

  for (const row of Array.from(tbody.children)) {
    if (!seen.has(row.dataset.rowId)) row.remove();
  }
}

/** Hücrede satır içi düzenleme (inline edit) başlatır. */
function startEditing(cell, store) {
  if (cell.dataset.editing === 'true') return;

  const record = findRecordById(store, cell.dataset.rowId);
  if (!record) return;

  const input = cell.ownerDocument.createElement('input');
  input.type = 'text';
  input.className = 'cell-input';
  input.dataset.field = cell.dataset.field;
  input.dataset.rowId = cell.dataset.rowId;
  input.value = formatEditableValue(cell.dataset.field, record);

  cell.dataset.editing = 'true';
  cell.textContent = '';
  cell.appendChild(input);
  input.focus();
  try {
    if (typeof input.select === 'function') input.select();
  } catch {
    // Bazı tarayıcılarda select() desteklenmez; kritik değil.
  }
}

/** Input değerini store'a yazar (geçersiz girdi yoksayılır). */
function commitInput(input, store) {
  const field = input.dataset.field;
  const rowId = input.dataset.rowId;
  if (!field || !rowId || !store || typeof store.updateRecord !== 'function') return;

  let value;
  if (NUMERIC_FIELDS.includes(field)) {
    value = parseEditableNumber(input.value);
    if (value === null) return;
  } else {
    value = input.value.trim();
    if (value === '') return;
  }

  try {
    store.updateRecord(rowId, { [field]: value });
  } catch {
    // Geçersiz kayıt değeri (örn. boş model adı) sessizce yoksayılır.
  }
}

/** Düzenlemeyi kapatır: hücre yeniden biçimli metni gösterir. */
function finishEditing(input, store) {
  const cell = input.parentElement;
  if (!cell) return;

  commitInput(input, store);
  delete cell.dataset.editing;

  const record = findRecordById(store, cell.dataset.rowId);
  cell.textContent = record ? formatCellValue(cell.dataset.field, record) : '';
}

/** Tablo ve footer etkileşimlerini event delegation ile bağlar. */
function bindTableEvents(containerEl, store) {
  function onClick(event) {
    const target = event.target;
    if (!target || typeof target.closest !== 'function') return;

    const addButton = target.closest('button[data-action="add-row"]');
    if (addButton && typeof store.addEmptyRecord === 'function') {
      store.addEmptyRecord();
      return;
    }

    const removeButton = target.closest('button[data-action="remove-row"]');
    if (removeButton && typeof store.removeRecord === 'function') {
      store.removeRecord(removeButton.dataset.rowId);
      return;
    }

    const cell = target.closest('td[data-field]');
    if (cell && cell.dataset.editable === 'true') startEditing(cell, store);
  }

  function onInput(event) {
    const target = event.target;
    if (!target || !target.classList) return;
    if (target.classList.contains('cell-input')) commitInput(target, store);
  }

  function onBlur(event) {
    const target = event.target;
    if (!target || !target.classList) return;
    if (target.classList.contains('cell-input')) finishEditing(target, store);
  }

  containerEl.addEventListener('click', onClick);
  containerEl.addEventListener('input', onInput);
  containerEl.addEventListener('blur', onBlur, true);

  return function unbind() {
    containerEl.removeEventListener('click', onClick);
    containerEl.removeEventListener('input', onInput);
    containerEl.removeEventListener('blur', onBlur, true);
  };
}

/** Aynı kapsayıcıya yapılan ardışık bağlamaları takip eder. */
const BOUND_TABLES = new WeakMap();

/**
 * Faz 33: Düzenlenebilir kullanım tablosunu çizer ve store ile iki yönlü senkronlar.
 * @param {HTMLElement} containerEl
 * @param {object[]} calculatedRecords
 * @param {object} store
 * @returns {{ table: HTMLElement, refresh: Function, destroy: Function }}
 */
export function renderUsageTable(containerEl, calculatedRecords, store) {
  if (!containerEl || typeof containerEl.querySelector !== 'function') {
    throw new TypeError('ERR_INVALID_CONTAINER_ELEMENT');
  }

  const { table, tbody, summaryValue } = ensureTableStructure(containerEl);

  const previous = BOUND_TABLES.get(containerEl);
  if (previous) {
    previous.unbind();
    if (typeof previous.unsubscribe === 'function') previous.unsubscribe();
  }

  const unbind = bindTableEvents(containerEl, store);

  function applyState(records) {
    const list = Array.isArray(records) ? records : [];
    syncRows(tbody, list);
    updateSummaryValue(summaryValue, list);
  }

  applyState(calculatedRecords);

  const unsubscribe = store && typeof store.subscribe === 'function'
    ? store.subscribe((state) => applyState(state.calculatedRecords))
    : null;

  BOUND_TABLES.set(containerEl, { unbind, unsubscribe });

  return {
    table,
    refresh() {
      const current = store && typeof store.getState === 'function'
        ? store.getState().calculatedRecords
        : calculatedRecords;
      applyState(current);
    },
    destroy() {
      unbind();
      if (typeof unsubscribe === 'function') unsubscribe();
      BOUND_TABLES.delete(containerEl);
    },
  };
}

// Toplam imza metni TEK MERKEZDEN gelir: hem UI footer'da hem .csv/.pdf/.md
// çıktılarında aynı sabit kullanılır (harf hatası riski sıfırlanır).
export { SIGNATURE_TEXT };

/** Uygulama altbilgisinin kök sınıfı (Faz 42). */
export const APP_FOOTER_CLASS = 'app-footer';

/** Dışa aktarım araç çubuğu buton kimlikleri. */
export const EXPORT_CSV_BUTTON_ID = 'btn-export-csv';
export const EXPORT_PDF_BUTTON_ID = 'btn-export-pdf';

/**
 * Faz 42: Altbilgiyi (imza + .csv/.pdf araç çubuğu) çizer.
 * İkinci çağrıda mevcut altbilgi yeniden kullanılır; imza/butonlar çoğaltılmaz.
 * @param {HTMLElement} footerEl
 * @param {{ onExportCSV?: Function, onExportPDF?: Function }} [options]
 * @returns {{ element: HTMLElement, signatureEl: HTMLElement, csvButton: HTMLElement, pdfButton: HTMLElement }}
 */
export function renderAppFooter(footerEl, options = {}) {
  if (!footerEl || typeof footerEl.querySelector !== 'function') {
    throw new TypeError('ERR_INVALID_FOOTER_ELEMENT');
  }

  const doc = footerEl.ownerDocument;
  let wrapper = footerEl.querySelector(`footer.${APP_FOOTER_CLASS}`);

  if (!wrapper) {
    wrapper = doc.createElement('footer');
    wrapper.className = APP_FOOTER_CLASS;

    const toolbar = doc.createElement('div');
    toolbar.className = 'export-toolbar no-print';

    const csvButton = doc.createElement('button');
    csvButton.type = 'button';
    csvButton.id = EXPORT_CSV_BUTTON_ID;
    csvButton.className = 'btn-export btn-export--csv';
    csvButton.textContent = '.CSV İndir';

    const pdfButton = doc.createElement('button');
    pdfButton.type = 'button';
    pdfButton.id = EXPORT_PDF_BUTTON_ID;
    pdfButton.className = 'btn-export btn-export--pdf';
    pdfButton.textContent = '.PDF İndir';

    toolbar.appendChild(csvButton);
    toolbar.appendChild(pdfButton);

    const signatureEl = doc.createElement('small');
    signatureEl.className = 'app-signature';
    signatureEl.textContent = SIGNATURE_TEXT;

    wrapper.appendChild(toolbar);
    wrapper.appendChild(signatureEl);
    footerEl.appendChild(wrapper);
  }

  const csvButton = wrapper.querySelector(`#${EXPORT_CSV_BUTTON_ID}`);
  const pdfButton = wrapper.querySelector(`#${EXPORT_PDF_BUTTON_ID}`);
  const signatureEl = wrapper.querySelector('.app-signature');

  // onclick özelliği atandığı için ardışık bağlamalar dinleyici biriktirmez.
  if (csvButton) csvButton.onclick = typeof options.onExportCSV === 'function' ? options.onExportCSV : null;
  if (pdfButton) pdfButton.onclick = typeof options.onExportPDF === 'function' ? options.onExportPDF : null;

  return { element: wrapper, signatureEl, csvButton, pdfButton };
}

export const FINOPS_METRIC_LABELS = Object.freeze({
  withoutCache: 'Normalde Ödenecek (Önbelleksiz)',
  cacheSavings: 'Önbellek Tasarrufu',
  invoice: 'Gerçek Fatura (USD & TRY)',
  quota: 'Kotaya Yansıyan İstek & Token',
});

/** Kart renk vurguları: yeşil = tasarruf, mavi = gerçek fatura. */
export const FINOPS_METRIC_VARIANTS = Object.freeze({
  withoutCache: 'neutral',
  cacheSavings: 'success',
  invoice: 'accent',
  quota: 'neutral',
});

/** currencyRate parametresini kur tablosuna çevirir: 36.5 → { TRY: 36.5 } */
function normalizeCurrencyRates(currencyRate) {
  if (typeof currencyRate === 'number' && Number.isFinite(currencyRate) && currencyRate > 0) {
    return { TRY: currencyRate };
  }
  if (currencyRate && typeof currencyRate === 'object') return { ...currencyRate };
  return {};
}

/**
 * Faz 37: Özet nesnesinden kart metinlerini üretir (saf fonksiyon).
 * Tüm sayılar Faz 10 formatlayıcılarından geçer.
 * @param {object} summary
 * @param {number|object} [currencyRate]
 * @returns {Record<string, string>}
 */
export function buildFinOpsMetricValues(summary, currencyRate) {
  const source = summary && typeof summary === 'object' ? summary : {};
  const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

  const savedUSD = num(source.totalSavedUSD);
  const withoutCacheUSD = num(source.totalCachedCostUSD) + savedUSD;
  const invoiceUSD = num(source.totalCostUSD);
  const hitRate = Math.round(num(source.overallCacheHitRate));
  const requests = Math.round(num(source.totalRequests));
  const netTokens = Math.round(num(source.totalBilledTokens) || num(source.totalTokens));

  const invoiceTRY = convertCurrency(invoiceUSD, 'TRY', normalizeCurrencyRates(currencyRate)).formatted;

  return {
    withoutCache: formatCostDisplay(withoutCacheUSD),
    cacheSavings: savedUSD > 0 ? `-${formatCostDisplay(savedUSD)} (Kâr)` : formatCostDisplay(0),
    savingsBadge: `%${hitRate} Hit`,
    invoice: `${formatCostDisplay(invoiceUSD)} / ${invoiceTRY}`,
    quota: `${formatTokenCount(requests).full} İstek | ${formatTokenCount(netTokens).short} Net Token`,
  };
}

/**
 * Faz 37: FinOps özet kartlarını çizer (4 metrik) ve mevcut kartları yeniden kullanır.
 * İkinci çağrıda kartlar çoğaltılmaz; yalnızca değerler güncellenir.
 * @param {HTMLElement} containerEl
 * @param {object} summary
 * @param {number|object} [currencyRate]
 * @returns {{ element: HTMLElement, values: object, refresh: Function }}
 */
export function renderFinOpsSummaryCards(containerEl, summary, currencyRate) {
  if (!containerEl || typeof containerEl.querySelector !== 'function') {
    throw new TypeError('ERR_INVALID_CONTAINER_ELEMENT');
  }

  const doc = containerEl.ownerDocument;
  const fields = Object.keys(FINOPS_METRIC_LABELS);
  let grid = containerEl.querySelector('.finops-cards');
  const cards = {};

  if (!grid) {
    grid = doc.createElement('div');
    grid.className = 'finops-cards';

    for (const field of fields) {
      const card = doc.createElement('div');
      card.className = `finops-card finops-card--${FINOPS_METRIC_VARIANTS[field]}`;
      card.dataset.metric = field;

      const label = doc.createElement('span');
      label.className = 'finops-card-label';
      label.textContent = FINOPS_METRIC_LABELS[field];

      const value = doc.createElement('strong');
      value.className = 'finops-card-value';

      card.appendChild(label);
      card.appendChild(value);

      if (field === 'cacheSavings') {
        const badge = doc.createElement('span');
        badge.className = 'finops-card-badge';
        card.appendChild(badge);
      }

      grid.appendChild(card);
    }

    containerEl.appendChild(grid);
  }

  for (const field of fields) {
    const card = grid.querySelector(`[data-metric="${field}"]`);
    cards[field] = {
      card,
      value: card ? card.querySelector('.finops-card-value') : null,
      badge: card ? card.querySelector('.finops-card-badge') : null,
    };
  }

  /** Metinleri yazar (aynı metinde gereksiz DOM güncellemesi yapmaz). */
  function apply(nextSummary) {
    const values = buildFinOpsMetricValues(nextSummary, currencyRate);

    for (const field of fields) {
      const parts = cards[field];
      if (!parts || !parts.value) continue;
      if (parts.value.textContent !== values[field]) parts.value.textContent = values[field];
      if (parts.badge && parts.badge.textContent !== values.savingsBadge) {
        parts.badge.textContent = values.savingsBadge;
      }
    }

    return values;
  }

  const values = apply(summary);

  return {
    element: grid,
    cards,
    values,
    refresh: (nextSummary) => apply(nextSummary),
  };
}

/** İlerleme çubuğu için erişilebilirlik (ARIA) etiketi. */
export const PROGRESS_ARIA_LABEL = 'OCR ilerlemesi';

/** Yüzdeyi 0-100 aralığına sıkıştırır (geçersiz/NaN değerlerde 0 döner). */
function clampPercentage(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(100, Math.max(0, Math.round(numeric)));
}

/** İlerleme başlığının DOM iskeletini bir kez oluşturur. */
function ensureProgressBanner(bannerEl) {
  const existing = bannerEl.querySelector('.progress-banner');
  if (existing) {
    return {
      bar: existing.querySelector('[role="progressbar"]'),
      fill: existing.querySelector('.progress-bar-fill'),
      messageEl: existing.querySelector('.progress-message'),
    };
  }

  const doc = bannerEl.ownerDocument;

  const wrapper = doc.createElement('div');
  wrapper.className = 'progress-banner';
  wrapper.setAttribute('role', 'status');
  wrapper.setAttribute('aria-live', 'polite');

  const bar = doc.createElement('div');
  bar.className = 'progress-bar';
  bar.setAttribute('role', 'progressbar');
  bar.setAttribute('aria-valuemin', '0');
  bar.setAttribute('aria-valuemax', '100');
  bar.setAttribute('aria-valuenow', '0');
  bar.setAttribute('aria-label', PROGRESS_ARIA_LABEL);

  const fill = doc.createElement('div');
  fill.className = 'progress-bar-fill';
  fill.style.width = '0%';
  bar.appendChild(fill);

  const messageEl = doc.createElement('p');
  messageEl.className = 'progress-message';

  wrapper.appendChild(bar);
  wrapper.appendChild(messageEl);
  bannerEl.appendChild(wrapper);

  return { bar, fill, messageEl };
}

/**
 * Faz 34: Durum çubuğu / OCR ilerleme göstergesini günceller.
 * XSS koruması: mesaj her zaman textContent ile yazılır.
 * @param {HTMLElement} bannerEl
 * @param {{ step?: string, percentage?: number, message?: string, isVisible?: boolean }} [state]
 * @returns {{ bar: HTMLElement, fill: HTMLElement, messageEl: HTMLElement, percentage: number, isVisible: boolean }}
 */
export function updateProgressBanner(bannerEl, {
  step = 'idle',
  percentage = 0,
  message = '',
  isVisible = true,
} = {}) {
  if (!bannerEl || typeof bannerEl.querySelector !== 'function') {
    throw new TypeError('ERR_INVALID_BANNER_ELEMENT');
  }

  const { bar, fill, messageEl } = ensureProgressBanner(bannerEl);
  const safePercentage = clampPercentage(percentage);
  const safeMessage = message === undefined || message === null ? '' : String(message);

  if (fill) fill.style.width = `${safePercentage}%`;
  if (bar) bar.setAttribute('aria-valuenow', String(safePercentage));
  if (messageEl && messageEl.textContent !== safeMessage) messageEl.textContent = safeMessage;

  bannerEl.dataset.step = String(step);
  bannerEl.classList.toggle('hidden', !isVisible);

  return { bar, fill, messageEl, percentage: safePercentage, isVisible: Boolean(isVisible) };
}



/** Bildirim (toast) kartının varsayılan görünme süresi. */
export const TOAST_DEFAULT_DURATION_MS = 5000;

/** Bilinmeyen model fiyatı uyarısının sabit metni (tek merkezden yönetilir). */
export const FALLBACK_PRICING_MESSAGE =
  'Bazı modeller için tahmini fiyat kullanıldı, tablodan birim fiyatı düzenleyebilirsiniz';

/** Geçerli bildirim tipleri. */
export const TOAST_TYPES = Object.freeze(['info', 'success', 'warning', 'error']);

/** Tip başına varsayılan başlık. */
const TOAST_TYPE_TITLES = Object.freeze({
  info: 'Bilgi',
  success: 'Başarılı',
  warning: 'Uyarı',
  error: 'Hata',
});

/** Bildirimlerin birikeceği listeyi (aria-live) bir kez oluşturur. */
function ensureToastContainer(toastContainer) {
  const existing = toastContainer.querySelector('.toast-container');
  if (existing) return existing;

  const list = toastContainer.ownerDocument.createElement('div');
  list.className = 'toast-container';
  list.setAttribute('role', 'region');
  list.setAttribute('aria-live', 'polite');
  toastContainer.appendChild(list);
  return list;
}

/**
 * Faz 35: Otomatik temizlenen bildirim (toast) kartı ekler.
 * XSS koruması: başlık ve mesaj her zaman textContent ile yazılır.
 * @param {HTMLElement} toastContainer
 * @param {{ title?: string, message?: string, type?: 'info'|'success'|'warning'|'error', durationMs?: number }} [options]
 * @returns {{ element: HTMLElement, type: string, dismiss: Function }}
 */
export function showNotification(toastContainer, {
  title,
  message = '',
  type = 'info',
  durationMs = TOAST_DEFAULT_DURATION_MS,
} = {}) {
  if (!toastContainer || typeof toastContainer.querySelector !== 'function') {
    throw new TypeError('ERR_INVALID_TOAST_CONTAINER');
  }

  const list = ensureToastContainer(toastContainer);
  const doc = toastContainer.ownerDocument;
  const safeType = TOAST_TYPES.includes(type) ? type : 'info';
  const safeTitle = title === undefined || title === null || title === '' ? TOAST_TYPE_TITLES[safeType] : String(title);
  const safeMessage = message === undefined || message === null ? '' : String(message);

  const toast = doc.createElement('div');
  toast.className = `toast toast--${safeType}`;
  toast.dataset.type = safeType;
  toast.setAttribute('role', 'alert');

  const titleEl = doc.createElement('strong');
  titleEl.className = 'toast-title';
  titleEl.textContent = safeTitle;

  const messageEl = doc.createElement('p');
  messageEl.className = 'toast-message';
  messageEl.textContent = safeMessage;

  const closeButton = doc.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'toast-close';
  closeButton.dataset.action = 'close-toast';
  closeButton.setAttribute('aria-label', 'Bildirimi kapat');
  closeButton.textContent = '✕';

  toast.appendChild(titleEl);
  toast.appendChild(messageEl);
  toast.appendChild(closeButton);
  list.appendChild(toast);

  let timer = null;
  let isDismissed = false;

  function dismiss() {
    if (isDismissed) return;
    isDismissed = true;
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (typeof toast.remove === 'function') toast.remove();
  }

  closeButton.addEventListener('click', dismiss);

  const duration = Number(durationMs);
  if (Number.isFinite(duration) && duration > 0) {
    timer = setTimeout(dismiss, duration);
  }

  return { element: toast, type: safeType, dismiss };
}

/**
 * Faz 35: Katalogda bulunamayan (fallback fiyat kullanılan) modeller için kullanıcıyı uyarır.
 * @param {HTMLElement} toastContainer
 * @param {string[]} unknownModels
 * @param {{ title?: string, durationMs?: number }} [options]
 * @returns {{ element: HTMLElement, type: string, dismiss: Function }|null}
 */
export function notifyUnknownModelPrices(toastContainer, unknownModels = [], options = {}) {
  const models = Array.isArray(unknownModels)
    ? unknownModels.filter((model) => typeof model === 'string' && model.trim() !== '')
    : [];
  if (models.length === 0) return null;

  return showNotification(toastContainer, {
    title: options.title || 'Tahmini fiyat',
    message: FALLBACK_PRICING_MESSAGE,
    type: 'warning',
    durationMs: options.durationMs === undefined ? TOAST_DEFAULT_DURATION_MS : options.durationMs,
  });
}

