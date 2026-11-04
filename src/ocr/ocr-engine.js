// src/ocr/ocr-engine.js
// Faz 26 - 30: Tarayıcı içi OCR motoru (Tesseract.js enjeksiyonlu, DOM'suz test edilebilir).
// KURAL: Bu dosyada document/canvas KULLANILMAZ; tüm görüntü işlemleri saf piksel
//        ({ data: Uint8ClampedArray, width, height }) üzerinde çalışır.

/** Varsayılan ön işleme seçenekleri. */
export const DEFAULT_PREPROCESS_OPTIONS = Object.freeze({
  invertDarkTheme: true,
  threshold: 140,
});

/** Koyu tema karar eşiği (ortalama parlaklık). */
export const DARK_THEME_LUMINANCE_LIMIT = 128;

/** Bir pikselin insan algısına uygun parlaklığı: L = 0.299R + 0.587G + 0.114B */
function relativeLuminance(red, green, blue) {
  return 0.299 * red + 0.587 * green + 0.114 * blue;
}

/**
 * Köşe piksellerinin ortalama parlaklığına bakarak görüntünün koyu tema
 * (koyu zemin üzerine açık yazı) olup olmadığını söyler.
 * @param {{ data: Uint8ClampedArray, width: number, height: number }} imageData
 * @returns {boolean}
 */
export function detectDarkTheme(imageData) {
  const data = imageData && imageData.data ? imageData.data : null;
  const width = Number(imageData && imageData.width) || 0;
  const height = Number(imageData && imageData.height) || 0;
  if (!data || width <= 0 || height <= 0) return false;

  const corners = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];

  let total = 0;
  let count = 0;
  for (const [x, y] of corners) {
    const offset = (y * width + x) * 4;
    if (offset + 2 >= data.length) continue;
    total += relativeLuminance(data[offset], data[offset + 1], data[offset + 2]);
    count += 1;
  }

  if (count === 0) return false;
  return total / count < DARK_THEME_LUMINANCE_LIMIT;
}

/**
 * Faz 26: Tesseract için görüntüyü ön işler.
 * 1. Koyu tema algılanırsa renkleri tersine çevirir (beyaz zemin + siyah yazı).
 * 2. Eşikleme (binarization) uygular; soluk gri yazılar invert sonrası korunur.
 * Girdi nesnesi MUTATE EDİLMEZ; yeni bir Uint8ClampedArray döner.
 * @param {{ data: Uint8ClampedArray, width: number, height: number }} imageData
 * @param {{ invertDarkTheme?: boolean, threshold?: number }} [options]
 * @returns {{ data: Uint8ClampedArray, width: number, height: number, isDarkTheme: boolean, threshold: number }}
 */
export function preprocessImageData(imageData, options = {}) {
  const { invertDarkTheme, threshold } = { ...DEFAULT_PREPROCESS_OPTIONS, ...options };
  const source = imageData && imageData.data ? imageData.data : new Uint8ClampedArray(0);
  const width = Number(imageData && imageData.width) || 0;
  const height = Number(imageData && imageData.height) || 0;

  const isDarkTheme = invertDarkTheme ? detectDarkTheme(imageData) : false;
  const limit = Number.isFinite(Number(threshold)) ? Number(threshold) : DEFAULT_PREPROCESS_OPTIONS.threshold;

  const output = new Uint8ClampedArray(source.length);

  for (let offset = 0; offset < source.length; offset += 4) {
    let red = source[offset];
    let green = source[offset + 1];
    let blue = source[offset + 2];

    if (isDarkTheme) {
      red = 255 - red;
      green = 255 - green;
      blue = 255 - blue;
    }

    const luminance = relativeLuminance(red, green, blue);
    const value = luminance >= limit ? 255 : 0;

    output[offset] = value;
    output[offset + 1] = value;
    output[offset + 2] = value;
    output[offset + 3] = source[offset + 3];
  }

  return { data: output, width, height, isDarkTheme, threshold: limit };
}
