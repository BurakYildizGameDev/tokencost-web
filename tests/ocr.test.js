// tests/ocr.test.js
// Faz 26 - 30: Tarayıcı içi OCR motoru testleri (DOM'suz, saf piksel/mock tabanlı).
import { describe, it, expect, vi } from 'vitest';
import { preprocessImageData, detectDarkTheme } from '../src/ocr/ocr-engine.js';
import { createOCRManager } from '../src/ocr/ocr-engine.js';
import { reconstructTableLinesFromWords } from '../src/ocr/ocr-engine.js';

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

/** Testlerde kullanılan sahte Tesseract kütüphanesi (worker enjekte edilir). */
function createMockTesseract() {
  const createdWorkers = [];
  const lib = {
    createWorker: vi.fn(async () => {
      const worker = {
        setParameters: vi.fn(async () => {}),
        recognize: vi.fn(async (imageData) => ({ data: { text: 'ok', words: [], imageData } })),
        terminate: vi.fn(async () => {}),
      };
      createdWorkers.push(worker);
      return worker;
    }),
  };
  return { lib, createdWorkers };
}

describe('Faz 27: createOCRManager', () => {
  it('arka arkaya 3 görselde tek worker kullanır (singleton)', async () => {
    const { lib, createdWorkers } = createMockTesseract();
    const manager = createOCRManager(lib);
    const image = createImageData(2, 2, LIGHT_BACKGROUND);

    await manager.recognize(image);
    await manager.recognize(image);
    await manager.recognize(image);

    expect(lib.createWorker).toHaveBeenCalledTimes(1);
    expect(createdWorkers).toHaveLength(1);
    expect(createdWorkers[0].recognize).toHaveBeenCalledTimes(3);
    expect(manager.getRecognizeCount()).toBe(3);
  });

  it('terminate() worker belleğini temizler ve yeni çağrıyı reddeder', async () => {
    const { lib, createdWorkers } = createMockTesseract();
    const manager = createOCRManager(lib);
    const image = createImageData(2, 2, LIGHT_BACKGROUND);

    await manager.recognize(image);
    await manager.terminate();

    expect(createdWorkers[0].terminate).toHaveBeenCalledTimes(1);
    expect(manager.isTerminated()).toBe(true);
    expect(manager.getWorker()).toBeNull();
    await expect(manager.recognize(image)).rejects.toThrow('ERR_OCR_MANAGER_TERMINATED');
  });

  it('ilerleme logger callbackini tesseract kütüphanesine aktarır', async () => {
    const { lib } = createMockTesseract();
    const manager = createOCRManager(lib);
    const logger = vi.fn();
    await manager.recognize(createImageData(2, 2, LIGHT_BACKGROUND), { logger });

    const options = lib.createWorker.mock.calls[0][2];
    expect(options.logger).toBe(logger);
    expect(lib.createWorker.mock.calls[0][0]).toBe('eng');
  });

  it('geçersiz kütüphane enjeksiyonunda TypeError fırlatır', () => {
    expect(() => createOCRManager(null)).toThrow(TypeError);
    expect(() => createOCRManager({})).toThrow('ERR_INVALID_TESSERACT_LIB');
  });

  it('preprocess: false verilirse piksel ön işleme atlanır', async () => {
    const { lib, createdWorkers } = createMockTesseract();
    const manager = createOCRManager(lib);
    const image = createImageData(2, 2, DARK_NAVY);

    await manager.recognize(image, { preprocess: false });
    expect(createdWorkers[0].recognize.mock.calls[0][0]).toBe(image);
  });
});

/** BBox'ı kısa yoldan üretir. */
function word(text, x0, y0, x1, y1) {
  return { text, bbox: { x0, y0, x1, y1 } };
}

describe('Faz 28: reconstructTableLinesFromWords', () => {
  it('aynı satırdaki kelimeleri (yTolerance içinde) tek satırda toplar', () => {
    const words = [
      word('14', 10, 100, 25, 120),
      word('Eki', 30, 102, 55, 122),
      word('deepseek-v4.1-flash', 200, 100, 380, 120),
      word('341', 450, 100, 490, 120),
      word('13', 10, 160, 25, 180),
      word('Eki', 30, 161, 55, 181),
      word('glm-5.3', 200, 160, 300, 180),
    ];

    expect(reconstructTableLinesFromWords(words)).toEqual([
      '14 Eki\tdeepseek-v4.1-flash\t341',
      '13 Eki\tglm-5.3',
    ]);
  });

  it('kelimeler karışık sırada gelse de soldan sağa / yukarıdan aşağıya dizer', () => {
    const words = [
      word('341', 450, 100, 490, 120),
      word('Eki', 30, 102, 55, 122),
      word('glm-5.3', 200, 160, 300, 180),
      word('deepseek-v4.1-flash', 200, 100, 380, 120),
      word('14', 10, 100, 25, 120),
      word('13', 10, 160, 25, 180),
      word('Eki', 30, 161, 55, 181),
    ];

    expect(reconstructTableLinesFromWords(words)[0]).toBe('14 Eki\tdeepseek-v4.1-flash\t341');
    expect(reconstructTableLinesFromWords(words)[1]).toBe('13 Eki\tglm-5.3');
  });

  it('yakın olmayan dikey kelimeleri ayrı satırlara böler (yTolerance)', () => {
    const words = [
      word('alpha', 10, 10, 60, 30),
      word('beta', 10, 60, 50, 80),
    ];
    expect(reconstructTableLinesFromWords(words)).toEqual(['alpha', 'beta']);
    expect(reconstructTableLinesFromWords(words, 60)).toEqual(['alpha beta']);
  });

  it('boş girdide ve geçersiz bbox taşıyan kayıtlarda çökmez', () => {
    expect(reconstructTableLinesFromWords([])).toEqual([]);
    expect(reconstructTableLinesFromWords(undefined)).toEqual([]);
    expect(reconstructTableLinesFromWords([{ text: 'x' }, { text: '   ' }])).toEqual([]);
  });
});
