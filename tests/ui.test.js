// @vitest-environment jsdom
// tests/ui.test.js
// Faz 32 - 35: Kullanıcı arayüzü (input, tablo, ilerleme, toast) testleri.
import { describe, it, expect, vi } from 'vitest';
import {
  bindInputEvents,
  isAcceptedFile,
  filterAcceptedFiles,
  ACCEPTED_FILE_EXTENSIONS,
} from '../src/ui/input-handler.js';
import { renderUsageTable } from '../src/ui/components.js';
import { createAppStore } from '../src/ui/store.js';
import { createTokenRecord, createPricingProfile } from '../src/core/schema.js';

/** Sahte dosya nesnesi üretir. */
function createFakeFile(name, type = '') {
  return new File(['x'], name, { type });
}

/** Sahte ClipboardEvent: jsdom constructor'ı clipboardData kabul etmez. */
function createPasteEvent(clipboardData) {
  const event = new window.Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: clipboardData });
  return event;
}

/** Sahte clipboardData nesnesi. */
function createClipboardData({ files = [], text = '', items = [] } = {}) {
  return {
    files,
    items,
    getData: (type) => (type === 'text/plain' ? text : ''),
  };
}

/** Sahte drop/dragover olayı. */
function createDragEvent(type, { files = [], text = '' } = {}) {
  const event = new window.Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      files,
      types: text ? ['text/plain'] : ['Files'],
      getData: (mime) => (mime === 'text/plain' ? text : ''),
    },
  });
  return event;
}

/** Test için boş bir kapsayıcı element üretir. */
function createContainer() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return container;
}

/** Faz 33 testleri için fiyat kataloğu + store + kayıt üretir. */
function createTableFixture() {
  const pricingCatalog = {
    'deepseek-v4.1-flash': createPricingProfile({
      modelId: 'deepseek-v4.1-flash',
      cachedInputCostPerMillion: 0.014,
      uncachedInputCostPerMillion: 0.14,
      outputCostPerMillion: 0.28,
      source: 'litellm',
    }),
  };

  const store = createAppStore({ pricingCatalog });
  store.addRecords([
    createTokenRecord({
      date: '14 Eki',
      model: 'deepseek-v4.1-flash',
      requests: 341,
      totalTokens: 1_000_000,
      cachedTokens: 600_000,
      billedTokens: 400_000,
    }),
  ]);

  return store;
}

/** Tablodan belirli bir hücreyi bulur. */
function findCell(container, rowIndex, field) {
  const row = container.querySelectorAll('tbody tr[data-row-id]')[rowIndex];
  return row.querySelector(`[data-field="${field}"]`);
}

describe('Faz 32: isAcceptedFile / filterAcceptedFiles', () => {
  it('png, jpg, jpeg, webp, csv ve txt dosyalarını kabul eder (büyük/küçük harf duyarsız)', () => {
    expect(ACCEPTED_FILE_EXTENSIONS).toEqual(['png', 'jpg', 'jpeg', 'webp', 'csv', 'txt']);
    expect(isAcceptedFile(createFakeFile('tablo.png', 'image/png'))).toBe(true);
    expect(isAcceptedFile(createFakeFile('TABLO.PNG', 'image/png'))).toBe(true);
    expect(isAcceptedFile(createFakeFile('veri.csv', 'text/csv'))).toBe(true);
    expect(isAcceptedFile(createFakeFile('veri.txt', 'text/plain'))).toBe(true);
  });

  it('exe, zip ve uzantısız dosyaları reddeder', () => {
    expect(isAcceptedFile(createFakeFile('virus.exe'))).toBe(false);
    expect(isAcceptedFile(createFakeFile('arsiv.zip'))).toBe(false);
    expect(isAcceptedFile(createFakeFile('README'))).toBe(false);
    expect(isAcceptedFile(null)).toBe(false);
  });

  it('dosya listesini kabul/red olarak ayırır', () => {
    const { accepted, rejected } = filterAcceptedFiles([
      createFakeFile('a.png'),
      createFakeFile('b.exe'),
      createFakeFile('c.csv'),
    ]);

    expect(accepted.map((file) => file.name)).toEqual(['a.png', 'c.csv']);
    expect(rejected.map((file) => file.name)).toEqual(['b.exe']);
  });
});

describe('Faz 32: bindInputEvents - panodan yapıştırma (Ctrl+V)', () => {
  it('pano görselini clipboardData.files üzerinden yakalar', () => {
    const container = createContainer();
    const onFiles = vi.fn();
    const onText = vi.fn();
    bindInputEvents(container, { onFiles, onText });

    window.dispatchEvent(createPasteEvent(createClipboardData({ files: [createFakeFile('ekran.png', 'image/png')] })));

    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onFiles.mock.calls[0][0][0].name).toBe('ekran.png');
    expect(onText).not.toHaveBeenCalled();
  });

  it('panodaki düz metni (tablo) text/plain olarak yakalar', () => {
    const container = createContainer();
    const onFiles = vi.fn();
    const onText = vi.fn();
    bindInputEvents(container, { onFiles, onText });

    window.dispatchEvent(createPasteEvent(createClipboardData({ text: '14 Eki\tglm-5.3\t341' })));

    expect(onText).toHaveBeenCalledWith('14 Eki\tglm-5.3\t341');
    expect(onFiles).not.toHaveBeenCalled();
  });

  it('files boşsa clipboardData.items içindeki resmi kullanır', () => {
    const container = createContainer();
    const onFiles = vi.fn();
    bindInputEvents(container, { onFiles });

    const file = createFakeFile('items.png', 'image/png');
    const items = [
      { kind: 'string', type: 'text/plain', getAsFile: () => null },
      { kind: 'file', type: 'image/png', getAsFile: () => file },
    ];
    window.dispatchEvent(createPasteEvent(createClipboardData({ items })));

    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onFiles.mock.calls[0][0][0].name).toBe('items.png');
  });
});

describe('Faz 32: bindInputEvents - sürükle-bırak', () => {
  it('birden fazla kabul edilen dosyayı onFiles ile iletir', () => {
    const container = createContainer();
    const onFiles = vi.fn();
    bindInputEvents(container, { onFiles });

    container.dispatchEvent(createDragEvent('drop', {
      files: [createFakeFile('a.png'), createFakeFile('b.csv'), createFakeFile('c.JPEG')],
    }));

    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onFiles.mock.calls[0][0].map((file) => file.name)).toEqual(['a.png', 'b.csv', 'c.JPEG']);
  });

  it('reddedilen dosyalarda onFiles çağrılmaz, onReject listesi iletilir', () => {
    const container = createContainer();
    const onFiles = vi.fn();
    const onReject = vi.fn();
    bindInputEvents(container, { onFiles, onReject });

    container.dispatchEvent(createDragEvent('drop', {
      files: [createFakeFile('virus.exe'), createFakeFile('arsiv.zip')],
    }));

    expect(onFiles).not.toHaveBeenCalled();
    expect(onReject.mock.calls[0][0].map((file) => file.name)).toEqual(['virus.exe', 'arsiv.zip']);
  });

  it('dragover olayında varsayılan davranışı engeller (dosya tarayıcıda açılmaz)', () => {
    const container = createContainer();
    bindInputEvents(container, {});

    expect(container.dispatchEvent(createDragEvent('dragover'))).toBe(false);
  });

  it('dosya yoksa sürüklenen metni onText ile iletir', () => {
    const container = createContainer();
    const onText = vi.fn();
    bindInputEvents(container, { onText });

    container.dispatchEvent(createDragEvent('drop', { text: '14 Eki\tglm-5.3' }));

    expect(onText).toHaveBeenCalledWith('14 Eki\tglm-5.3');
  });

  it('destroy çağrıldıktan sonra olaylar işlenmez', () => {
    const container = createContainer();
    const onFiles = vi.fn();
    const { destroy } = bindInputEvents(container, { onFiles });

    destroy();
    window.dispatchEvent(createPasteEvent(createClipboardData({ files: [createFakeFile('a.png')] })));
    container.dispatchEvent(createDragEvent('drop', { files: [createFakeFile('b.png')] }));

    expect(onFiles).not.toHaveBeenCalled();
  });
});

describe('Faz 33: renderUsageTable - çizim', () => {
  it('başlıkları ve satır hücrelerini data öznitelikleriyle çizer', () => {
    const container = createContainer();
    const store = createTableFixture();
    renderUsageTable(container, store.getState().calculatedRecords, store);

    expect(container.querySelector('table.usage-table')).not.toBeNull();
    expect(container.querySelectorAll('thead th')).toHaveLength(9);
    expect(container.querySelector('thead th[data-field="totalTokens"]').textContent).toBe('Toplam Token');

    const row = container.querySelector('tbody tr[data-row-id]');
    expect(row).not.toBeNull();
    expect(row.dataset.rowId).toBe(store.getState().records[0].id);
    expect(findCell(container, 0, 'model').textContent).toBe('deepseek-v4.1-flash');
    expect(findCell(container, 0, 'requests').textContent).toBe('341');
    expect(findCell(container, 0, 'totalTokens').textContent).toBe('1.000.000');
    expect(findCell(container, 0, 'cacheHitRatio').textContent).toBe('60%');
    expect(findCell(container, 0, 'totalCostUSD').textContent).toBe('$0.10');
    expect(container.querySelector('[data-summary="totalCostUSD"]').textContent).toBe('$0.10');
  });

  it('yalnızca düzenlenebilir hücrelerde data-editable işareti bulunur', () => {
    const container = createContainer();
    const store = createTableFixture();
    renderUsageTable(container, store.getState().calculatedRecords, store);

    expect(findCell(container, 0, 'billedTokens').dataset.editable).toBe('true');
    expect(findCell(container, 0, 'date').dataset.editable).toBe('true');
    expect(findCell(container, 0, 'totalCostUSD').dataset.editable).toBeUndefined();
    expect(findCell(container, 0, 'cacheHitRatio').dataset.editable).toBeUndefined();
  });

  it('boş kayıt listesinde tablo iskeletini yine kurar, geçersiz kapsayıcıda hata verir', () => {
    const container = createContainer();
    const store = createTableFixture();

    expect(() => renderUsageTable(container, [], store)).not.toThrow();
    expect(container.querySelectorAll('tbody tr[data-row-id]')).toHaveLength(0);
    expect(container.querySelector('[data-summary="totalCostUSD"]').textContent).toBe('$0.00');
    expect(() => renderUsageTable(null, [], store)).toThrow(TypeError);
  });
});

describe('Faz 33: renderUsageTable - hücre düzenleme (inline edit)', () => {
  it('hücreye tıklanınca input açılır ve odak input\'a geçer', () => {
    const container = createContainer();
    const store = createTableFixture();
    renderUsageTable(container, store.getState().calculatedRecords, store);

    const cell = findCell(container, 0, 'cachedTokens');
    cell.click();

    const input = cell.querySelector('input');
    expect(input).not.toBeNull();
    expect(input.value).toBe('600000');
    expect(document.activeElement).toBe(input);
    expect(cell.dataset.editing).toBe('true');
  });

  it('input olayında store güncellenir, toplam fatura anında yeniden hesaplanır ve odak korunur', () => {
    const container = createContainer();
    const store = createTableFixture();
    renderUsageTable(container, store.getState().calculatedRecords, store);

    const cell = findCell(container, 0, 'cachedTokens');
    const rowBefore = container.querySelector('tbody tr[data-row-id]');
    cell.click();

    const input = cell.querySelector('input');
    input.value = '1000000';
    input.dispatchEvent(new window.Event('input', { bubbles: true }));

    // 0.6M önbellek -> 1M: 1e6/1e6*0.014 + 0.4M*0.238 = 0.1092
    expect(store.getState().calculatedRecords[0].cachedTokens).toBe(1_000_000);
    expect(store.getState().summary.totalCostUSD).toBeCloseTo(0.1092, 6);
    expect(container.querySelector('[data-summary="totalCostUSD"]').textContent).toBe('$0.11');

    // Kritik kısıt: tüm tablo yeniden çizilmez, odak ve aynı DOM düğümü korunur.
    expect(container.querySelector('tbody tr[data-row-id]')).toBe(rowBefore);
    expect(input.parentElement).toBe(cell);
    expect(document.activeElement).toBe(input);
  });

  it('geçersiz sayısal girdi (abc) yoksayılır, eski değer korunur', () => {
    const container = createContainer();
    const store = createTableFixture();
    renderUsageTable(container, store.getState().calculatedRecords, store);

    const cell = findCell(container, 0, 'totalTokens');
    cell.click();
    const input = cell.querySelector('input');
    input.value = 'abc';
    input.dispatchEvent(new window.Event('input', { bubbles: true }));

    expect(store.getState().calculatedRecords[0].totalTokens).toBe(1_000_000);
  });

  it('blur olayında düzenleme kapanır ve hücre biçimli değeri gösterir', () => {
    const container = createContainer();
    const store = createTableFixture();
    renderUsageTable(container, store.getState().calculatedRecords, store);

    const cell = findCell(container, 0, 'totalTokens');
    cell.click();
    const input = cell.querySelector('input');
    input.value = '1500000';
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    input.blur();

    expect(cell.querySelector('input')).toBeNull();
    expect(cell.dataset.editing).toBeUndefined();
    expect(cell.textContent).toBe('1.500.000');
  });

  it('model hücresi düzenlendiğinde yeni modelin (fallback) fiyatıyla yeniden hesaplanır', () => {
    const container = createContainer();
    const store = createTableFixture();
    renderUsageTable(container, store.getState().calculatedRecords, store);

    const cell = findCell(container, 0, 'model');
    cell.click();
    const input = cell.querySelector('input');
    input.value = 'bilinmeyen-model-x';
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    input.blur();

    const state = store.getState();
    expect(state.calculatedRecords[0].model).toBe('bilinmeyen-model-x');
    expect(state.calculatedRecords[0].pricingSource).toBe('fallback');
    expect(state.unknownModels).toEqual(['bilinmeyen-model-x']);
    expect(container.querySelector('[data-summary="totalCostUSD"]').textContent).toBe('$0.14');
    expect(findCell(container, 0, 'model').textContent).toBe('bilinmeyen-model-x');
  });

  it('fiyat sütununa tıklanınca input açılmaz (salt okunur hücre)', () => {
    const container = createContainer();
    const store = createTableFixture();
    renderUsageTable(container, store.getState().calculatedRecords, store);

    findCell(container, 0, 'totalCostUSD').click();
    expect(findCell(container, 0, 'totalCostUSD').querySelector('input')).toBeNull();
  });
});

describe('Faz 33: renderUsageTable - satır ekleme/silme ve store aboneliği', () => {
  it('[X] butonu satırı store\'dan ve DOM\'dan siler, toplamı günceller', () => {
    const container = createContainer();
    const store = createTableFixture();
    renderUsageTable(container, store.getState().calculatedRecords, store);

    container.querySelector('button[data-action="remove-row"]').click();

    expect(store.getState().records).toHaveLength(0);
    expect(container.querySelectorAll('tbody tr[data-row-id]')).toHaveLength(0);
    expect(container.querySelector('[data-summary="totalCostUSD"]').textContent).toBe('$0.00');
  });

  it('"+ Satır Ekle" butonu yeni boş satır ekler ve DOM\'a yansır', () => {
    const container = createContainer();
    const store = createTableFixture();
    renderUsageTable(container, store.getState().calculatedRecords, store);

    container.querySelector('button[data-action="add-row"]').click();

    expect(store.getState().records).toHaveLength(2);
    const rows = container.querySelectorAll('tbody tr[data-row-id]');
    expect(rows).toHaveLength(2);
    expect(rows[1].querySelector('[data-field="model"]').textContent).toBe('Yeni Model');
    expect(rows[1].querySelector('[data-field="totalTokens"]').textContent).toBe('0');
  });

  it('store dışarıdan güncellendiğinde (OCR sonucu) tablo kendini senkronlar', () => {
    const container = createContainer();
    const store = createTableFixture();
    renderUsageTable(container, store.getState().calculatedRecords, store);

    store.addRecords([
      createTokenRecord({
        date: '13 Eki',
        model: 'deepseek-v4.1-flash',
        requests: 120,
        totalTokens: 2_000_000,
        cachedTokens: 1_200_000,
        billedTokens: 800_000,
      }),
    ]);

    const rows = container.querySelectorAll('tbody tr[data-row-id]');
    expect(rows).toHaveLength(2);
    expect(rows[1].querySelector('[data-field="date"]').textContent).toBe('13 Eki');
    expect(container.querySelector('[data-summary="totalCostUSD"]').textContent).toBe('$0.31');

    store.clearRecords();
    expect(container.querySelectorAll('tbody tr[data-row-id]')).toHaveLength(0);
  });

  it('destroy çağrıldığında store aboneliği bırakılır, tablo güncellenmez', () => {
    const container = createContainer();
    const store = createTableFixture();
    const { destroy } = renderUsageTable(container, store.getState().calculatedRecords, store);

    destroy();
    expect(store.getListenerCount()).toBe(0);

    store.clearRecords();
    // Abonelik bırakıldığı için DOM'daki satır korunur.
    expect(container.querySelectorAll('tbody tr[data-row-id]')).toHaveLength(1);
  });
});
