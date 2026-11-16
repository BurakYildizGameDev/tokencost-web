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
import {
  renderUsageTable,
  renderFinOpsSummaryCards,
  updateProgressBanner,
  showNotification,
  notifyUnknownModelPrices,
  FALLBACK_PRICING_MESSAGE,
} from '../src/ui/components.js';
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

  it('düzenlenebilir input içine yapıştırma global paste işleyicisini tetiklemez', () => {
    const container = createContainer();
    const input = document.createElement('input');
    input.className = 'cell-input';
    container.appendChild(input);
    document.body.appendChild(input);
    input.focus();

    const onText = vi.fn();
    const onFiles = vi.fn();
    bindInputEvents(container, { onText, onFiles });

    const event = createPasteEvent(createClipboardData({ text: 'e74a3b' }));
    Object.defineProperty(event, 'target', { value: input });
    window.dispatchEvent(event);

    expect(onText).not.toHaveBeenCalled();
    expect(onFiles).not.toHaveBeenCalled();
  });

  it('input dışındaki bir elemente yapıştırma normal şekilde işlenir', () => {
    const container = createContainer();
    const onText = vi.fn();
    bindInputEvents(container, { onText });

    const event = createPasteEvent(createClipboardData({ text: '14 Eki\tglm-5.3\t341' }));
    Object.defineProperty(event, 'target', { value: container });
    window.dispatchEvent(event);

    expect(onText).toHaveBeenCalledWith('14 Eki\tglm-5.3\t341');
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

describe('Faz 34: updateProgressBanner', () => {
  it('yüzdeyi ve mesajı erişilebilir ilerleme çubuğuna yazar', () => {
    const banner = createContainer();
    updateProgressBanner(banner, {
      step: 'ocr',
      percentage: 65,
      message: 'Görsel 2/3 okunuyor...',
      isVisible: true,
    });

    const bar = banner.querySelector('[role="progressbar"]');
    expect(bar.getAttribute('aria-valuenow')).toBe('65');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
    expect(bar.getAttribute('aria-label')).toBe('OCR ilerlemesi');

    const fill = banner.querySelector('.progress-bar-fill');
    expect(fill.style.width).toBe('65%');
    expect(fill.getAttribute('style')).toContain('width: 65%');

    expect(banner.querySelector('.progress-message').textContent).toBe('Görsel 2/3 okunuyor...');
    expect(banner.dataset.step).toBe('ocr');
    expect(banner.classList.contains('hidden')).toBe(false);
  });

  it('isVisible false olduğunda hidden sınıfı eklenir, sonra kaldırılabilir', () => {
    const banner = createContainer();
    updateProgressBanner(banner, { percentage: 0, message: '', isVisible: false });
    expect(banner.classList.contains('hidden')).toBe(true);

    updateProgressBanner(banner, { percentage: 100, message: 'Bitti', isVisible: true });
    expect(banner.classList.contains('hidden')).toBe(false);
  });

  it('yüzdeyi 0-100 aralığına kırpar, geçersiz değerde 0 kullanır', () => {
    const banner = createContainer();

    updateProgressBanner(banner, { percentage: 150, message: 'a' });
    expect(banner.querySelector('.progress-bar-fill').style.width).toBe('100%');
    expect(banner.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('100');

    updateProgressBanner(banner, { percentage: -20, message: 'b' });
    expect(banner.querySelector('.progress-bar-fill').style.width).toBe('0%');

    updateProgressBanner(banner, { percentage: 'abc', message: 'c' });
    expect(banner.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('0');
  });

  it('mesajı textContent ile yazar (XSS koruması)', () => {
    const banner = createContainer();
    updateProgressBanner(banner, { percentage: 10, message: '<img src=x onerror=alert(1)>' });

    expect(banner.querySelector('.progress-message').textContent).toBe('<img src=x onerror=alert(1)>');
    expect(banner.querySelector('.progress-message img')).toBeNull();
    expect(banner.querySelectorAll('img')).toHaveLength(0);
  });

  it('başlığı bir kez oluşturur (yeniden çizmez) ve geçersiz kapsayıcıda hata verir', () => {
    const banner = createContainer();
    updateProgressBanner(banner, { percentage: 10, message: 'ilk' });
    const messageEl = banner.querySelector('.progress-message');

    updateProgressBanner(banner, { percentage: 40, message: 'ikinci' });

    expect(banner.querySelectorAll('.progress-message')).toHaveLength(1);
    expect(banner.querySelector('.progress-message')).toBe(messageEl);
    expect(() => updateProgressBanner(null, {})).toThrow(TypeError);
  });
});

describe('Faz 35: showNotification - toast servisi', () => {
  it('warning tipinde sarı uyarı stiliyle DOM\'a eklenir', () => {
    const container = createContainer();
    const { element, dismiss } = showNotification(container, {
      title: 'Uyarı',
      message: 'Bir sorun var',
      type: 'warning',
      durationMs: 5000,
    });

    expect(element.classList.contains('toast')).toBe(true);
    expect(element.classList.contains('toast--warning')).toBe(true);
    expect(element.classList.contains('toast--info')).toBe(false);
    expect(element.getAttribute('role')).toBe('alert');
    expect(element.querySelector('.toast-title').textContent).toBe('Uyarı');
    expect(element.querySelector('.toast-message').textContent).toBe('Bir sorun var');
    expect(container.querySelectorAll('.toast')).toHaveLength(1);

    dismiss();
  });

  it('durationMs sonunda otomatik kaldırılır (fake timer uyumlu)', () => {
    vi.useFakeTimers();
    const container = createContainer();
    showNotification(container, { message: 'okunuyor', type: 'warning', durationMs: 3000 });

    expect(container.querySelectorAll('.toast')).toHaveLength(1);
    vi.advanceTimersByTime(2999);
    expect(container.querySelectorAll('.toast')).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(container.querySelectorAll('.toast')).toHaveLength(0);

    vi.useRealTimers();
  });

  it('bilinmeyen tip "info" stilini kullanır, başlık tipe göre varsayılan seçilir', () => {
    const container = createContainer();
    const unknown = showNotification(container, { message: 'a', type: 'bilinmeyen', durationMs: 0 });
    expect(unknown.element.classList.contains('toast--info')).toBe(true);
    expect(unknown.element.querySelector('.toast-title').textContent).toBe('Bilgi');

    const success = showNotification(container, { message: 'b', type: 'success', durationMs: 0 });
    expect(success.element.classList.contains('toast--success')).toBe(true);
    expect(success.element.querySelector('.toast-title').textContent).toBe('Başarılı');

    unknown.dismiss();
    success.dismiss();
  });

  it('kapatma butonu toast\'ı hemen kaldırır ve zamanlayıcıyı temizler', () => {
    vi.useFakeTimers();
    const container = createContainer();
    showNotification(container, { message: 'x', type: 'error', durationMs: 5000 });

    container.querySelector('[data-action="close-toast"]').click();
    expect(container.querySelectorAll('.toast')).toHaveLength(0);

    vi.advanceTimersByTime(5000);
    expect(container.querySelectorAll('.toast')).toHaveLength(0);
    vi.useRealTimers();
  });

  it('birden fazla toast üst üste eklenir, dismiss tek tek ve idempotent çalışır', () => {
    const container = createContainer();
    const first = showNotification(container, { message: '1', durationMs: 0 });
    const second = showNotification(container, { message: '2', durationMs: 0 });

    expect(container.querySelectorAll('.toast')).toHaveLength(2);
    first.dismiss();
    expect(container.querySelectorAll('.toast')).toHaveLength(1);
    second.dismiss();
    second.dismiss();
    expect(container.querySelectorAll('.toast')).toHaveLength(0);
  });

  it('toast\'lar aria-live bildirim listesine eklenir', () => {
    const container = createContainer();
    const { element, dismiss } = showNotification(container, { message: 'x', durationMs: 0 });

    const list = container.querySelector('.toast-container');
    expect(list).not.toBeNull();
    expect(list.getAttribute('aria-live')).toBe('polite');
    expect(element.parentElement).toBe(list);

    dismiss();
  });

  it('mesaj textContent ile yazılır (XSS koruması), geçersiz kapsayıcıda hata verir', () => {
    const container = createContainer();
    const { element, dismiss } = showNotification(container, { message: '<b>x</b>', durationMs: 0 });

    expect(element.querySelector('.toast-message').textContent).toBe('<b>x</b>');
    expect(element.querySelector('.toast-message b')).toBeNull();
    dismiss();

    expect(() => showNotification(null, { message: 'x' })).toThrow(TypeError);
  });
});

describe('Faz 35: notifyUnknownModelPrices - fallback fiyat uyarısı', () => {
  it('tam olarak beklenen uyarı metnini gösterir', () => {
    const container = createContainer();
    const handle = notifyUnknownModelPrices(container, ['gizemli-model-1', 'gizemli-model-2']);

    expect(FALLBACK_PRICING_MESSAGE).toBe(
      'Bazı modeller için tahmini fiyat kullanıldı, tablodan birim fiyatı düzenleyebilirsiniz',
    );

    const toast = container.querySelector('.toast');
    expect(toast).not.toBeNull();
    expect(toast.classList.contains('toast--warning')).toBe(true);
    expect(toast.querySelector('.toast-message').textContent).toBe(FALLBACK_PRICING_MESSAGE);
    handle.dismiss();
  });

  it('bilinmeyen model listesi boşsa bildirim gösterilmez (null döner)', () => {
    const container = createContainer();

    expect(notifyUnknownModelPrices(container, [])).toBeNull();
    expect(notifyUnknownModelPrices(container, undefined)).toBeNull();
    expect(container.querySelectorAll('.toast')).toHaveLength(0);
  });
});

describe('Faz 37: renderFinOpsSummaryCards', () => {
  /** $13.80 gerçek fatura, $39.64 önbellek tasarrufu, %95 hit, 4.044 istek. */
  function createSummary() {
    return {
      recordCount: 13,
      totalRequests: 4044,
      totalTokens: 333698885,
      totalCachedTokens: 305198885,
      totalBilledTokens: 28500000,
      totalCachedCostUSD: 13.8,
      totalBilledCostUSD: 0,
      totalCostUSD: 13.8,
      totalSavedUSD: 39.64,
      overallCacheHitRate: 95,
      savingsPercentage: 74.18,
    };
  }

  it('4 ana FinOps metriğini doğru biçimlenmiş değerlerle çizer', () => {
    const container = createContainer();
    renderFinOpsSummaryCards(container, createSummary(), 36.5);

    expect(container.querySelectorAll('.finops-card')).toHaveLength(4);

    const withoutCache = container.querySelector('[data-metric="withoutCache"]');
    expect(withoutCache.querySelector('.finops-card-label').textContent).toContain('Normalde Ödenecek');
    expect(withoutCache.querySelector('.finops-card-value').textContent).toBe('$53.44');

    const savings = container.querySelector('[data-metric="cacheSavings"]');
    expect(savings.querySelector('.finops-card-value').textContent).toBe('-$39.64 (Kâr)');
    expect(savings.querySelector('.finops-card-badge').textContent).toBe('%95 Hit');
    expect(savings.className).toContain('finops-card--success');

    const invoice = container.querySelector('[data-metric="invoice"]');
    expect(invoice.querySelector('.finops-card-value').textContent).toBe('$13.80 / ₺503,70');
    expect(invoice.className).toContain('finops-card--accent');

    const quota = container.querySelector('[data-metric="quota"]');
    expect(quota.querySelector('.finops-card-value').textContent).toBe('4.044 İstek | 28,5M Net Token');
  });


  it('boş/geçersiz özet verildiğinde çökmeden sıfır değerleri gösterir', () => {
    for (const input of [undefined, null, {}]) {
      const container = createContainer();
      expect(() => renderFinOpsSummaryCards(container, input)).not.toThrow();

      expect(container.querySelector('[data-metric="withoutCache"] .finops-card-value').textContent).toBe('$0.00');
      expect(container.querySelector('[data-metric="cacheSavings"] .finops-card-value').textContent).toBe('$0.00');
      expect(container.querySelector('[data-metric="invoice"] .finops-card-value').textContent).toBe('$0.00 / ₺0,00');
      expect(container.querySelector('[data-metric="quota"] .finops-card-value').textContent).toBe('0 İstek | 0 Net Token');
    }
  });

  it('iki kez çağrıldığında kartları çoğaltmaz, değerleri günceller (idempotent)', () => {
    const container = createContainer();
    const first = renderFinOpsSummaryCards(container, createSummary(), 36.5);

    renderFinOpsSummaryCards(container, { ...createSummary(), totalCostUSD: 27.6, totalSavedUSD: 0 }, 36.5);

    expect(container.querySelectorAll('.finops-cards')).toHaveLength(1);
    expect(container.querySelectorAll('.finops-card')).toHaveLength(4);
    expect(container.querySelector('[data-metric="invoice"] .finops-card-value').textContent).toBe('$27.60 / ₺1.007,40');
    expect(container.querySelector('[data-metric="cacheSavings"] .finops-card-value').textContent).toBe('$0.00');
    expect(first.element).toBe(container.querySelector('.finops-cards'));
  });

  it('refresh ile yeni özet anında yansıtılır', () => {
    const container = createContainer();
    const cards = renderFinOpsSummaryCards(container, createSummary(), 36.5);

    cards.refresh({ totalCostUSD: 1.5, totalSavedUSD: 3, overallCacheHitRate: 50, totalRequests: 10, totalBilledTokens: 2500 });

    expect(container.querySelector('[data-metric="invoice"] .finops-card-value').textContent).toBe('$1.50 / ₺54,75');
    expect(container.querySelector('[data-metric="cacheSavings"] .finops-card-value').textContent).toBe('-$3.00 (Kâr)');
    expect(container.querySelector('[data-metric="quota"] .finops-card-value').textContent).toBe('10 İstek | 2,5K Net Token');
  });

  it('geçersiz kapsayıcıda TypeError fırlatır', () => {
    expect(() => renderFinOpsSummaryCards(null, createSummary())).toThrow(TypeError);
  });
});

