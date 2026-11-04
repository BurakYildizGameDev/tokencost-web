// tests/ocr.test.js
// Faz 26 - 30: Tarayıcı içi OCR motoru testleri (DOM'suz, saf piksel/mock tabanlı).
import { describe, it, expect } from 'vitest';
import { preprocessImageData, detectDarkTheme } from '../src/ocr/ocr-engine.js';

/** Test için RGBA görüntü üretir: base renk + üzerine yazılan pikseller. */
function createImageData(width, height, base, points = []) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = base[0];
    data[i + 1] = base[1];
    data[i + 2] = base[2];
    data[i + 3] = 255;
  }
  for (const { x, y, rgb } of points) {
    const offset = (y * width + x) * 4;
    data[offset] = rgb[0];
    data[offset + 1] = rgb[1];
    data[offset + 2] = rgb[2];
  }
  return { data, width, height };
}

/** Verilen koordinattaki kırmızı kanal değerini okur. */
function redAt(imageData, x, y) {
  return imageData.data[(y * imageData.width + x) * 4];
}

const DARK_NAVY = [10, 15, 40];
const WHITE_TEXT = [235, 235, 235];
const LIGHT_BACKGROUND = [250, 250, 250];
const DARK_TEXT = [20, 20, 20];

describe('Faz 26: preprocessImageData', () => {
  it('koyu tema ekran görüntüsünü algılayıp renkleri tersine çevirir', () => {
    const dark = createImageData(4, 4, DARK_NAVY, [{ x: 2, y: 2, rgb: WHITE_TEXT }]);
    expect(detectDarkTheme(dark)).toBe(true);

    const result = preprocessImageData(dark);
    expect(result.isDarkTheme).toBe(true);
    // Arka plan (koyu lacivert) → beyaz zemin
    expect(redAt(result, 0, 0)).toBe(255);
    // Beyaz yazı → siyah metin
    expect(redAt(result, 2, 2)).toBe(0);
  });

  it('açık tema görüntüyü olduğu gibi (ters çevirmeden) eşikler', () => {
    const light = createImageData(4, 4, LIGHT_BACKGROUND, [{ x: 1, y: 1, rgb: DARK_TEXT }]);
    expect(detectDarkTheme(light)).toBe(false);

    const result = preprocessImageData(light);
    expect(result.isDarkTheme).toBe(false);
    expect(redAt(result, 0, 0)).toBe(255);
    expect(redAt(result, 1, 1)).toBe(0);
  });

  it('soluk gri önbellek yazısını (gri metin) kaybetmez', () => {
    const grayText = [150, 150, 150];
    const dark = createImageData(4, 4, DARK_NAVY, [{ x: 3, y: 3, rgb: grayText }]);
    const result = preprocessImageData(dark);
    // Ters çevirme sonrası gri metin koyu kalır (0) → hâlâ okunabilir bir metin izi var.
    expect(redAt(result, 3, 3)).toBe(0);
  });

  it('girdi nesnesini mutate etmez ve yeni bir dizi döner', () => {
    const dark = createImageData(2, 2, DARK_NAVY);
    const before = Array.from(dark.data);
    const result = preprocessImageData(dark);
    expect(Array.from(dark.data)).toEqual(before);
    expect(result.data).not.toBe(dark.data);
    expect(result.data).toBeInstanceOf(Uint8ClampedArray);
  });

  it('boş/geçersiz girdide çökmez', () => {
    const result = preprocessImageData(null);
    expect(result.data.length).toBe(0);
    expect(result.isDarkTheme).toBe(false);
  });
});
