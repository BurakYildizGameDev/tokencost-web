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
