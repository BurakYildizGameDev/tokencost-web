// src/core/file-type.js
// Faz 49: Dosya türü tespiti — uzantı ve MIME yetersiz kaldığında ilk baytlara (magic bytes) bakılır.
// Neden: Tarayıcıdan sürüklenen kırpılmış görsellerin adı "image", "blob" ya da "indir" olabilir;
// telefondan gelen fotoğraflar .heic, panodan gelenler uzantısız olabilir. Bu durumda dosya
// reddedilmek yerine gerçek içeriğine göre tanınır (PNG imzası taşıyan bir .txt bile görsel sayılır).
// KURAL: Saf katman — DOM/window/fetch YOKTUR; yalnızca bayt dizisi alır, karar döner.

/** Tespit edilen içerik sınıfları. */
export const FILE_KINDS = Object.freeze({
  IMAGE: 'image',
  TABLE: 'table',
  TEXT: 'text',
  UNKNOWN: 'unknown',
});

/** Görsel imzası taşıyan biçimler (OCR hattına gider). */
export const IMAGE_FORMATS = Object.freeze([
  'png', 'jpeg', 'gif', 'webp', 'bmp', 'tiff', 'avif', 'heic',
]);

/** Düz metin/tablo imzası taşıyan biçimler (ayrıştırıcıya gider). */
export const TEXT_FORMATS = Object.freeze(['csv', 'tsv', 'text', 'json', 'markdown']);

/** İnsan tarafından okunabilir biçim adları (kullanıcı bildirimlerinde kullanılır). */
export const FORMAT_LABELS = Object.freeze({
  png: 'PNG',
  jpeg: 'JPEG',
  gif: 'GIF',
  webp: 'WEBP',
  bmp: 'BMP',
  tiff: 'TIFF',
  avif: 'AVIF',
  heic: 'HEIC',
  csv: 'CSV',
  tsv: 'TSV',
  text: 'TXT',
  json: 'JSON',
  markdown: 'MD',
  pdf: 'PDF',
  svg: 'SVG',
  zip: 'ZIP',
  unknown: '?',
});

/** Desteklenen biçimlerin kullanıcıya gösterilen listesi (tek kaynak). */
export const SUPPORTED_IMAGE_LABEL = 'PNG · JPG · JPEG · WEBP · GIF · BMP · TIFF · AVIF · HEIC';
export const SUPPORTED_TEXT_LABEL = 'CSV · TSV · TXT · JSON · MD';
export const SUPPORTED_FORMATS_LABEL = `${SUPPORTED_IMAGE_LABEL} · ${SUPPORTED_TEXT_LABEL}`;

/** Girdiyi Uint8Array'e çevirir (Uint8Array | ArrayBuffer | number[]). */
export function toUint8Array(input) {
  if (!input) return new Uint8Array(0);
  if (input instanceof Uint8Array) return input;
  if (typeof ArrayBuffer !== 'undefined' && input instanceof ArrayBuffer) return new Uint8Array(input);
  if (Array.isArray(input)) return Uint8Array.from(input);
  if (typeof input === 'object' && typeof input.length === 'number') return Uint8Array.from(input);
  return new Uint8Array(0);
}

/** Bayt dizisi verilen ASCII metinle başlıyor mu? */
function asciiAt(bytes, offset, text) {
  if (bytes.length < offset + text.length) return false;
  for (let i = 0; i < text.length; i += 1) {
    if (bytes[offset + i] !== text.charCodeAt(i)) return false;
  }
  return true;
}

/** Bayt dizisi verilen imza ile başlıyor mu? (number[] imza) */
function bytesAt(bytes, offset, signature) {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((value, index) => bytes[offset + index] === value);
}

/** Bayt dizisinin bir bölümünü ASCII metne çevirir (marka/imza okumak için). */
function asciiSlice(bytes, start, length) {
  let text = '';
  for (let i = start; i < start + length && i < bytes.length; i += 1) {
    text += String.fromCharCode(bytes[i]);
  }
  return text;
}

/** ISO-BMFF (ftyp) kutusunun markası: avif / heic / mif1 … */
function readIsoBrand(bytes) {
  if (!asciiAt(bytes, 4, 'ftyp')) return '';
  return asciiSlice(bytes, 8, 4).toLowerCase();
}

/**
 * Magic bytes imzalarına bakar ve biçimi çözer.
 * @param {Uint8Array|ArrayBuffer|number[]} input
 * @returns {string} Biçim kodu ('png' | 'jpeg' | 'gif' | 'webp' | 'bmp' | 'tiff' | 'avif'
 *   | 'heic' | 'pdf' | 'zip' | 'svg' | 'text' | 'unknown')
 */
export function detectFormatFromBytes(input) {
  const bytes = toUint8Array(input);
  if (bytes.length === 0) return 'unknown';

  if (bytesAt(bytes, 0, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) return 'png';
  if (bytesAt(bytes, 0, [0xFF, 0xD8, 0xFF])) return 'jpeg';
  if (asciiAt(bytes, 0, 'GIF87a') || asciiAt(bytes, 0, 'GIF89a')) return 'gif';
  if (asciiAt(bytes, 0, 'RIFF') && asciiAt(bytes, 8, 'WEBP')) return 'webp';
  if (bytesAt(bytes, 0, [0x42, 0x4D])) return 'bmp';
  if (bytesAt(bytes, 0, [0x49, 0x49, 0x2A, 0x00])) return 'tiff';
  if (bytesAt(bytes, 0, [0x4D, 0x4D, 0x00, 0x2A])) return 'tiff';

  const brand = readIsoBrand(bytes);
  if (brand === 'avif' || brand === 'avis') return 'avif';
  if (['heic', 'heix', 'hevc', 'heim', 'mif1', 'msf1'].includes(brand)) return 'heic';


  if (asciiAt(bytes, 0, '%PDF')) return 'pdf';
  if (bytesAt(bytes, 0, [0x50, 0x4B, 0x03, 0x04])) return 'zip';

  // SVG/XML: "<svg" ya da "<?xml" ile başlayan metin (OCR okuyamaz, bu yüzden ayrı raporlanır).
  const head = asciiSlice(bytes, 0, 5).toLowerCase();
  if (head.startsWith('<svg') || head.startsWith('<?xml')) return 'svg';

  return isProbablyText(bytes) ? 'text' : 'unknown';
}

/**
 * Bayt dizisi düz metin (CSV/TXT/JSON) mı?
 * Kural: NUL yok, kontrol karakteri yok; ilk 512 baytta yazdırılabilir oranı %90'ın üzerinde.
 * UTF-8 çok baytlı karakterler (>= 0x80) metin kabul edilir.
 * @param {Uint8Array|ArrayBuffer|number[]} input
 * @returns {boolean}
 */
export function isProbablyText(input) {
  const bytes = toUint8Array(input);
  if (bytes.length === 0) return false;

  const limit = Math.min(bytes.length, 512);
  let printable = 0;

  for (let i = 0; i < limit; i += 1) {
    const byte = bytes[i];
    if (byte === 0x00) return false;
    if (byte === 0x09 || byte === 0x0A || byte === 0x0D || (byte >= 0x20 && byte <= 0x7E)) {
      printable += 1;
    } else if (byte >= 0x80) {
      printable += 1; // UTF-8 yüksek/devam baytı: metin sayılır
    } else {
      return false; // ESC, BEL, FF gibi kontrol karakterleri: ikili (binary) içerik
    }
  }

  return printable / limit >= 0.9;
}

/** Metin içeriğini ayırıcısına göre sınıflar: json / tsv / csv / text. */
export function detectTextFormatFromString(text) {
  const body = typeof text === 'string' ? text : '';
  const trimmed = body.trim();
  if (trimmed === '') return 'text';

  const sample = body.slice(0, 4096);
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  if (/\t/.test(sample)) return 'tsv';
  if (/[;,]/.test(sample)) return 'csv';
  return 'text';
}

/**
 * Bayt dizisinden içerik türünü ve biçimini çıkarır (magic bytes + metin sezgisi).
 * @param {Uint8Array|ArrayBuffer|number[]} input
 * @param {{ textPreview?: string }} [options] Ayırıcı seçimi için okunmuş metin parçası
 * @returns {{ kind: string, format: string, label: string, mime: string, isImage: boolean, isText: boolean }}
 */
export function detectFileKindFromBytes(input, options = {}) {
  const bytes = toUint8Array(input);
  let format = detectFormatFromBytes(bytes);
  let kind;

  if (IMAGE_FORMATS.includes(format)) {
    kind = FILE_KINDS.IMAGE;
  } else if (format === 'text') {
    format = detectTextFormatFromString(options.textPreview || asciiSlice(bytes, 0, 2048));
    kind = format === 'text' ? FILE_KINDS.TEXT : FILE_KINDS.TABLE;
  } else {
    kind = FILE_KINDS.UNKNOWN;
  }

  return {
    kind,
    format,
    label: FORMAT_LABELS[format] || FORMAT_LABELS.unknown,
    mime: kind === FILE_KINDS.IMAGE ? `image/${format === 'jpeg' ? 'jpeg' : format}` : '',
    isImage: kind === FILE_KINDS.IMAGE,
    isText: kind === FILE_KINDS.TEXT || kind === FILE_KINDS.TABLE,
  };
}

/** Biçim kodu görsel mi? */
export function isImageFormat(format) {
  return IMAGE_FORMATS.includes(String(format || '').toLowerCase());
}

/** Biçim kodu metin/tablo mu? */
export function isTextFormat(format) {
  return TEXT_FORMATS.includes(String(format || '').toLowerCase());
}

/** Biçimin kullanıcıya gösterilen adı (bilinmeyende '?'). */
export function formatLabel(format) {
  return FORMAT_LABELS[String(format || '').toLowerCase()] || FORMAT_LABELS.unknown;
}
