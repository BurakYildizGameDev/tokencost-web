// src/ui/input-handler.js
// Faz 32: Çoklu girdi alanı — Ctrl+V (pano) ve sürükle-bırak dinleyicileri.
// KURAL: Element enjekte edilir (containerEl); global document/window'a doğrudan bağımlılık yok.

/**
 * Kabul edilen dosya uzantıları (küçük harf, nokta yok).
 * Faz 49 düzeltmesi: Telefon/kamera fotoğrafları (.heic/.heif), eski ekran görüntüleri
 * (.gif/.bmp/.tif/.tiff), modern görseller (.avif) ve panodan düşen .jfif dosyaları da
 * kabul edilir. Aksi halde geçerli görseller "desteklenmeyen biçim" diye reddediliyordu.
 */
export const ACCEPTED_FILE_EXTENSIONS = Object.freeze([
  'png', 'jpg', 'jpeg', 'webp', 'csv', 'txt',
  'gif', 'bmp', 'tif', 'tiff', 'avif', 'heic', 'heif', 'jfif',
  'tsv', 'json', 'md', 'log',
]);

/** Metin/tablo sayılan (text/* dışındaki) MIME türleri. */
export const TEXT_MIME_TYPES = Object.freeze([
  'application/json',
  'application/ld+json',
  'application/x-ndjson',
  'application/csv',
  'application/tsv',
  'application/markdown',
  'application/vnd.ms-excel',
]);

/** Pano öğelerinde resim tanıma öneki. */
const IMAGE_MIME_PREFIX = 'image/';

/** MIME türü görsel mi? (adı/uzantısı bozuk dosyalarda tek güvenilir sinyal) */
export function isImageMime(mimeType) {
  return String(mimeType === undefined || mimeType === null ? '' : mimeType)
    .toLowerCase()
    .startsWith(IMAGE_MIME_PREFIX);
}

/** MIME türü metin/tablo mu? */
export function isTextMime(mimeType) {
  const mime = String(mimeType === undefined || mimeType === null ? '' : mimeType).toLowerCase();
  return mime.startsWith('text/') || TEXT_MIME_TYPES.includes(mime);
}

/** Dosya adından uzantıyı (küçük harf) çıkarır. */
function getFileExtension(fileName) {
  if (typeof fileName !== 'string') return '';
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === fileName.length - 1) return '';
  return fileName.slice(dotIndex + 1).toLowerCase();
}

/**
 * Faz 32 / Faz 49: Dosyanın kabul edilebilir olup olmadığını söyler.
 * Öncelik sırası: MIME türü → bilinen uzantı. Uzantısız/uzantısı bozuk ama türü
 * doğru olan dosyalar (panodan gelen "blob", telefon fotoğrafı) artık reddedilmez.
 * @param {File|object} file
 * @returns {boolean}
 */
export function isAcceptedFile(file) {
  if (!file) return false;

  if (isImageMime(file.type) || isTextMime(file.type)) return true;

  if (typeof file.name !== 'string') return false;
  return ACCEPTED_FILE_EXTENSIONS.includes(getFileExtension(file.name));
}

/**
 * Faz 32: Dosya listesini kabul edilenler ve reddedilenler olarak ayırır.
 * @param {FileList|File[]|null} files
 * @returns {{ accepted: File[], rejected: File[] }}
 */
export function filterAcceptedFiles(files) {
  const accepted = [];
  const rejected = [];

  for (const file of toFileArray(files)) {
    if (isAcceptedFile(file)) accepted.push(file);
    else rejected.push(file);
  }

  return { accepted, rejected };
}

/** FileList / dizi / tek dosya girdisini diziye çevirir. */
function toFileArray(files) {
  if (!files) return [];
  if (Array.isArray(files)) return files.filter(Boolean);
  if (typeof files.length === 'number') return Array.from(files).filter(Boolean);
  return [files];
}

/** Elementin pencere nesnesini bulur (tarayıcıda ve jsdom'da çalışır). */
function resolveWindow(containerEl) {
  if (containerEl && containerEl.ownerDocument && containerEl.ownerDocument.defaultView) {
    return containerEl.ownerDocument.defaultView;
  }
  return globalThis;
}

/**
 * Faz 32: Olayın hedefi kullanıcı girişi yapılabilen bir alan mı?
 * Tablo hücreleri satır içi düzenlenirken yapıştırılan değer tablo metni sanılmamalıdır.
 * @param {EventTarget|null} target
 * @returns {boolean}
 */
export function isEditableTarget(target) {
  if (!target || typeof target !== 'object') return false;

  const tagName = typeof target.tagName === 'string' ? target.tagName.toLowerCase() : '';
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return true;

  return target.isContentEditable === true;
}

/** Panodan resim dosyalarını toplar (files → items fallback). */
function collectPasteFiles(clipboardData) {
  if (!clipboardData) return [];

  const directFiles = toFileArray(clipboardData.files);
  if (directFiles.length > 0) return directFiles;

  const items = clipboardData.items && typeof clipboardData.items.length === 'number'
    ? Array.from(clipboardData.items)
    : [];

  return items
    .filter((item) => item && item.kind === 'file' && typeof item.getAsFile === 'function'
      && String(item.type || '').startsWith(IMAGE_MIME_PREFIX))
    .map((item) => item.getAsFile())
    .filter(Boolean);
}

/**
 * Faz 32: Kapsayıcı elemente sürükle-bırak ve sayfaya Ctrl+V (paste) dinleyicisi bağlar.
 * @param {HTMLElement} containerEl
 * @param {{ onFiles?: Function, onText?: Function, onReject?: Function, onError?: Function, onDragStateChange?: Function }} [callbacks]
 *   onDragStateChange(isActive): sürükleme başladığında/bittiğinde çağrılır (bırakma alanı vurgusu).
 * @returns {{ destroy: Function }}
 */
export function bindInputEvents(containerEl, callbacks = {}) {
  if (!containerEl || typeof containerEl.addEventListener !== 'function') {
    throw new TypeError('ERR_INVALID_CONTAINER_ELEMENT');
  }

  const win = resolveWindow(containerEl);
  const { onFiles, onText, onReject, onError, onDragStateChange } = callbacks;

  /** Geri çağrı hatalarını yutar; uygulama akışı bozulmaz. */
  function safeCall(callback, payload) {
    if (typeof callback !== 'function') return;
    try {
      callback(payload);
    } catch (error) {
      if (typeof onError === 'function') onError(error);
    }
  }

  function handleFiles(files) {
    const { accepted, rejected } = filterAcceptedFiles(files);
    if (accepted.length > 0) safeCall(onFiles, accepted);
    if (rejected.length > 0) safeCall(onReject, rejected);
  }

  function handlePaste(event) {
    // Satır içi düzenleme yapılırken yapıştırılan değer tablo metni değildir.
    if (event && isEditableTarget(event.target)) return;

    const clipboardData = event ? event.clipboardData : null;
    const files = collectPasteFiles(clipboardData);
    if (files.length > 0) {
      handleFiles(files);
      return;
    }

    const text = clipboardData && typeof clipboardData.getData === 'function'
      ? clipboardData.getData('text/plain')
      : '';
    if (typeof text === 'string' && text.trim() !== '') safeCall(onText, text);
  }

  /** Sürükleme durumunu (bırakma alanı vurgusu) güvenli biçimde bildirir. */
  function setDragState(isActive) {
    safeCall(onDragStateChange, Boolean(isActive));
  }

  /** Sürüklenen içerik dosya mı? Bilgi yoksa dosya kabul edilir (varsayılan davranış). */
  function isFileDrag(event) {
    const types = event && event.dataTransfer ? event.dataTransfer.types : null;
    if (!types) return true;
    if (typeof types.includes === 'function') return types.includes('Files');
    if (typeof types.length === 'number') return Array.from(types).includes('Files');
    return true;
  }

  function handleDragOver(event) {
    // Varsayılanı engellemezsek tarayıcı dosyayı yeni sekmede açar.
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    if (isFileDrag(event)) setDragState(true);
  }

  function handleDragLeave() {
    setDragState(false);
  }

  function handleDrop(event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    setDragState(false);

    const dataTransfer = event ? event.dataTransfer : null;
    const files = toFileArray(dataTransfer && dataTransfer.files);
    if (files.length > 0) {
      handleFiles(files);
      return;
    }

    const text = dataTransfer && typeof dataTransfer.getData === 'function'
      ? dataTransfer.getData('text/plain')
      : '';
    if (typeof text === 'string' && text.trim() !== '') safeCall(onText, text);
  }

  win.addEventListener('paste', handlePaste);
  containerEl.addEventListener('dragover', handleDragOver);
  containerEl.addEventListener('dragleave', handleDragLeave);
  containerEl.addEventListener('drop', handleDrop);

  return {
    destroy() {
      win.removeEventListener('paste', handlePaste);
      containerEl.removeEventListener('dragover', handleDragOver);
      containerEl.removeEventListener('dragleave', handleDragLeave);
      containerEl.removeEventListener('drop', handleDrop);
    },
  };
}
