// tests/file-type.test.js
// Faz 49: Dosya türü tespiti (magic bytes) birim testleri.
// KURAL: Bu katman saftır — DOM/window/fetch yoktur; yalnızca bayt dizisi alır.
import { describe, it, expect } from 'vitest';
import {
  FILE_KINDS,
  FORMAT_LABELS,
  IMAGE_FORMATS,
  SUPPORTED_FORMATS_LABEL,
  TEXT_FORMATS,
  detectFileKindFromBytes,
  detectFormatFromBytes,
  detectTextFormatFromString,
  formatLabel,
  isImageFormat,
  isProbablyText,
  isTextFormat,
  toUint8Array,
} from '../src/core/file-type.js';

/** ASCII metni bayt dizisine çevirir (imza kurmak için). */
function bytesFrom(text) {
  return Uint8Array.from(Array.from(text).map((char) => char.charCodeAt(0)));
}

/** İmza + dolgu baytlarından örnek dosya başlığı üretir. */
function withPadding(signature, padLength = 16) {
  const head = Uint8Array.from(signature);
  const out = new Uint8Array(head.length + padLength);
  out.set(head, 0);
  return out;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

/** ftyp (ISO-BMFF) başlığı üretir: 4 bayt boyut + 'ftyp' + marka. */
function isoBmff(brand) {
  return withPadding([...bytesFrom('\u0000\u0000\u0000\u001Cftyp'), ...bytesFrom(brand)], 12);
}

describe('Faz 49: toUint8Array', () => {
  it('Uint8Array, ArrayBuffer ve number[] girdilerini normalize eder', () => {
    const source = Uint8Array.from([1, 2, 3]);
    expect(toUint8Array(source)).toBe(source);
    expect(Array.from(toUint8Array(source.buffer))).toEqual([1, 2, 3]);
    expect(Array.from(toUint8Array([4, 5]))).toEqual([4, 5]);
  });

  it('boş/geçersiz girdide boş dizi döner (çökmez)', () => {
    expect(toUint8Array(null).length).toBe(0);
    expect(toUint8Array(undefined).length).toBe(0);
    expect(toUint8Array({}).length).toBe(0);
  });
});

describe('Faz 49: detectFormatFromBytes — görsel imzaları', () => {
  it('PNG, JPEG, GIF, WEBP, BMP ve TIFF imzalarını tanır', () => {
    expect(detectFormatFromBytes(withPadding(PNG_SIGNATURE))).toBe('png');
    expect(detectFormatFromBytes(withPadding([0xFF, 0xD8, 0xFF, 0xE0]))).toBe('jpeg');
    expect(detectFormatFromBytes(bytesFrom('GIF87a-rest'))).toBe('gif');
    expect(detectFormatFromBytes(bytesFrom('GIF89a-rest'))).toBe('gif');
    expect(detectFormatFromBytes(withPadding([...bytesFrom('RIFF'), 0, 0, 0, 0, ...bytesFrom('WEBP')]))).toBe('webp');
    expect(detectFormatFromBytes(withPadding([0x42, 0x4D]))).toBe('bmp');
    expect(detectFormatFromBytes(withPadding([0x49, 0x49, 0x2A, 0x00]))).toBe('tiff');
    expect(detectFormatFromBytes(withPadding([0x4D, 0x4D, 0x00, 0x2A]))).toBe('tiff');
  });

  it('HEIC/AVIF (ftyp markası) ayırt edilir — telefon fotoğrafı yanlış ret yaşamaz', () => {
    expect(detectFormatFromBytes(isoBmff('heic'))).toBe('heic');
    expect(detectFormatFromBytes(isoBmff('heix'))).toBe('heic');
    expect(detectFormatFromBytes(isoBmff('mif1'))).toBe('heic');
    expect(detectFormatFromBytes(isoBmff('avif'))).toBe('avif');
  });

  it('imza boyutu için yeterli bayt yoksa görsel sayılmaz (yanlış pozitif yok)', () => {
    expect(detectFormatFromBytes([0x01, 0x02])).toBe('unknown');
    expect(detectFormatFromBytes([])).toBe('unknown');
  });
});

describe('Faz 49: detectFormatFromBytes — metin ve diğer biçimler', () => {
  it('PDF, ZIP ve SVG tanınır (OCR hattına gönderilmez)', () => {
    expect(detectFormatFromBytes(bytesFrom('%PDF-1.7'))).toBe('pdf');
    expect(detectFormatFromBytes(withPadding([0x50, 0x4B, 0x03, 0x04]))).toBe('zip');
    expect(detectFormatFromBytes(bytesFrom('<svg xmlns="...">'))).toBe('svg');
    expect(detectFormatFromBytes(bytesFrom('<?xml version="1.0"?>'))).toBe('svg');
  });

  it('kontrol karakteri içeren ikili içerik unknown döner', () => {
    const binary = Uint8Array.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
    expect(detectFormatFromBytes(binary)).toBe('unknown');
    expect(isProbablyText(binary)).toBe(false);
  });

  it('Türkçe ve UTF-8 karakterli metin dosyası metin sayılır', () => {
    const text = new TextEncoder().encode('Tarih\tModel\tİstek\n2026-05-01\tglm-5.3\t806');
    expect(isProbablyText(text)).toBe(true);
    expect(detectFormatFromBytes(text)).toBe('text');
  });

  it('kısa metin gövdesi de metin kabul edilir', () => {
    expect(detectFormatFromBytes(bytesFrom('x'))).toBe('text');
  });
});

describe('Faz 49: detectFileKindFromBytes — sınıflandırma', () => {
  it('görsel biçimlerde kind "image" ve isImage true olur', () => {
    for (const [label, bytes] of [
      ['png', withPadding(PNG_SIGNATURE)],
      ['jpeg', withPadding([0xFF, 0xD8, 0xFF])],
      ['gif', bytesFrom('GIF89a...')],
      ['heic', isoBmff('heic')],
    ]) {
      const result = detectFileKindFromBytes(bytes);
      expect(result.kind, label).toBe(FILE_KINDS.IMAGE);
      expect(result.isImage, label).toBe(true);
      expect(result.isText, label).toBe(false);
    }
  });

  it('CSV/TSV/JSON içerik "table", düz metin "text" sınıfına girer', () => {
    const csv = detectFileKindFromBytes(bytesFrom('model,istek,toplam\nglm-5.3,806,71480000'));
    expect(csv.kind).toBe(FILE_KINDS.TABLE);
    expect(csv.format).toBe('csv');
    expect(csv.isText).toBe(true);

    const tsv = detectFileKindFromBytes(bytesFrom('glm-5.3\t806\t71480000'));
    expect(tsv.format).toBe('tsv');
    expect(tsv.kind).toBe(FILE_KINDS.TABLE);

    const json = detectFileKindFromBytes(bytesFrom('{"model":"glm-5.3"}'));
    expect(json.format).toBe('json');
    expect(json.kind).toBe(FILE_KINDS.TABLE);

    const plain = detectFileKindFromBytes(bytesFrom('bu bir kullanim tablosu degil'));
    expect(plain.format).toBe('text');
    expect(plain.kind).toBe(FILE_KINDS.TEXT);
  });

  it('PDF/ZIP gibi OCR edilemeyen ikili içerik "unknown" olur', () => {
    expect(detectFileKindFromBytes(bytesFrom('%PDF-1.7')).kind).toBe(FILE_KINDS.UNKNOWN);
    expect(detectFileKindFromBytes(withPadding([0x50, 0x4B, 0x03, 0x04])).kind).toBe(FILE_KINDS.UNKNOWN);
  });

  it('textPreview verilirse ayırıcı seçimi bu önizlemeden yapılır', () => {
    const result = detectFileKindFromBytes(bytesFrom('x'), { textPreview: 'a;b;c' });
    expect(result.format).toBe('csv');
    expect(result.kind).toBe(FILE_KINDS.TABLE);
  });

  it('görsel için mime alanı üretir, metin için boş bırakır', () => {
    expect(detectFileKindFromBytes(withPadding(PNG_SIGNATURE)).mime).toBe('image/png');
    expect(detectFileKindFromBytes(bytesFrom('a\tb')).mime).toBe('');
  });
});

describe('Faz 49: detectTextFormatFromString', () => {
  it('ayırıcıya göre json/tsv/csv/text ayırt eder', () => {
    expect(detectTextFormatFromString('{"a":1}')).toBe('json');
    expect(detectTextFormatFromString('[1,2,3]')).toBe('json');
    expect(detectTextFormatFromString('a\tb\tc')).toBe('tsv');
    expect(detectTextFormatFromString('a;b;c')).toBe('csv');
    expect(detectTextFormatFromString('a,b,c')).toBe('csv');
    expect(detectTextFormatFromString('sadece bir cumle')).toBe('text');
    expect(detectTextFormatFromString('')).toBe('text');
    expect(detectTextFormatFromString(undefined)).toBe('text');
  });
});

describe('Faz 49: biçim yardımcıları ve destek listesi', () => {
  it('isImageFormat / isTextFormat büyük-küçük harf duyarsız çalışır', () => {
    expect(isImageFormat('PNG')).toBe(true);
    expect(isImageFormat('heic')).toBe(true);
    expect(isImageFormat('csv')).toBe(false);
    expect(isTextFormat('JSON')).toBe(true);
    expect(isTextFormat('png')).toBe(false);
    expect(isImageFormat('')).toBe(false);
  });

  it('formatLabel insan okunur adı verir, bilinmeyende "?" döner', () => {
    expect(formatLabel('png')).toBe('PNG');
    expect(formatLabel('jpeg')).toBe('JPEG');
    expect(formatLabel('markdown')).toBe('MD');
    expect(formatLabel('bilinmeyen')).toBe(FORMAT_LABELS.unknown);
  });

  it('IMAGE_FORMATS ve TEXT_FORMATS birbirine karışmaz', () => {
    expect(IMAGE_FORMATS).toContain('png');
    expect(IMAGE_FORMATS).toContain('heic');
    expect(IMAGE_FORMATS.some((format) => TEXT_FORMATS.includes(format))).toBe(false);
    expect(TEXT_FORMATS).toContain('csv');
  });

  it('SUPPORTED_FORMATS_LABEL kullanıcıya gösterilen listenin tek kaynağıdır', () => {
    expect(SUPPORTED_FORMATS_LABEL).toContain('PNG');
    expect(SUPPORTED_FORMATS_LABEL).toContain('HEIC');
    expect(SUPPORTED_FORMATS_LABEL).toContain('CSV');
    expect(SUPPORTED_FORMATS_LABEL).toContain('MD');
  });
});

