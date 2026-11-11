// src/ui/components.js
// Faz 33 - 35: Arayüz bileşenleri (düzenlenebilir tablo, ilerleme çubuğu, toast).
// KURAL: Framework yok; event delegation + kısmi DOM güncellemesi kullanılır.
// Kritik: Her tuş vuruşunda tüm tablo yeniden çizilmez (kullanıcı odağı korunur).

import { aggregateUsageSummaries } from '../core/calculator.js';
import { formatCostDisplay, formatTokenCount } from '../core/formatter.js';

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


