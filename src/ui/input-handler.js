// src/ui/input-handler.js
// Faz 32: Çoklu girdi alanı — Ctrl+V (pano) ve sürükle-bırak dinleyicileri.
// KURAL: Element enjekte edilir (containerEl); global document/window'a doğrudan bağımlılık yok.

/** Kabul edilen dosya uzantıları (küçük harf, nokta yok). */
export const ACCEPTED_FILE_EXTENSIONS = Object.freeze(['png', 'jpg', 'jpeg', 'webp', 'csv', 'txt']);

/** Pano öğelerinde resim tanıma öneki. */
const IMAGE_MIME_PREFIX = 'image/';

/** Dosya adından uzantıyı (küçük harf) çıkarır. */
function getFileExtension(fileName) {
  if (typeof fileName !== 'string') return '';
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === fileName.length - 1) return '';
  return fileName.slice(dotIndex + 1).toLowerCase();
}

/**
 * Faz 32: Dosyanın kabul edilebilir uzantıda olup olmadığını söyler.
 * @param {File|object} file
 * @returns {boolean}
 */
export function isAcceptedFile(file) {
  if (!file || typeof file.name !== 'string') return false;
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
 * @param {{ onFiles?: Function, onText?: Function, onReject?: Function, onError?: Function }} [callbacks]
 * @returns {{ destroy: Function }}
 */
export function bindInputEvents(containerEl, callbacks = {}) {
  if (!containerEl || typeof containerEl.addEventListener !== 'function') {
    throw new TypeError('ERR_INVALID_CONTAINER_ELEMENT');
  }

  const win = resolveWindow(containerEl);
  const { onFiles, onText, onReject, onError } = callbacks;

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

  function handleDragOver(event) {
    // Varsayılanı engellemezsek tarayıcı dosyayı yeni sekmede açar.
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
  }

  function handleDrop(event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();

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
  containerEl.addEventListener('drop', handleDrop);

  return {
    destroy() {
      win.removeEventListener('paste', handlePaste);
      containerEl.removeEventListener('dragover', handleDragOver);
      containerEl.removeEventListener('drop', handleDrop);
    },
  };
}
