// tests/ocr.test.js
// Faz 26 - 30: Tarayıcı içi OCR motoru testleri (DOM'suz, saf piksel/mock tabanlı).
import { describe, it, expect, vi } from 'vitest';
import { preprocessImageData, detectDarkTheme } from '../src/ocr/ocr-engine.js';
import { createOCRManager } from '../src/ocr/ocr-engine.js';
import { reconstructTableLinesFromWords } from '../src/ocr/ocr-engine.js';
import { cleanOCRTableArtefacts } from '../src/ocr/ocr-engine.js';
import { deduplicateRecords, processMultipleImagesToRecords } from '../src/ocr/ocr-engine.js';

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

describe('Faz 29: cleanOCRTableArtefacts', () => {
  it('sayısal hücrelerde harf→rakam düzeltmesi yapar (O→0, l→1)', () => {
    expect(cleanOCRTableArtefacts('3O.8ll.O37')).toBe('30.811.037');
    expect(cleanOCRTableArtefacts('29.3l2.l28 (%96)')).toBe('29.312.128 (%96)');
    expect(cleanOCRTableArtefacts('l079')).toBe('1079');
  });

  it('bozuk model adlarını düzeltir (gIm→glm, v4.l→v4.1)', () => {
    expect(cleanOCRTableArtefacts('deepseek-v4.l-flash')).toBe('deepseek-v4.1-flash');
    expect(cleanOCRTableArtefacts('gIm-5.3')).toBe('glm-5.3');
  });

  it('model adındaki gerçek harfleri rakama çevirmez (qwen3-vl-30b)', () => {
    expect(cleanOCRTableArtefacts('qwen3-vl-30b')).toBe('qwen3-vl-30b');
    expect(cleanOCRTableArtefacts('deepseek-v4.1-flash')).toBe('deepseek-v4.1-flash');
  });

  it('tam OCR satırını sütun ayırıcılarını koruyarak temizler', () => {
    const dirty = '14 Eki\tdeepseek-v4.l-flash\t341\t3O.8ll.O37\t29.3l2.l28 (%96)\t2.378.273\t0,00';
    expect(cleanOCRTableArtefacts(dirty)).toBe(
      '14 Eki\tdeepseek-v4.1-flash\t341\t30.811.037\t29.312.128 (%96)\t2.378.273\t0,00',
    );
  });

  it('boşlukla ayrılmış satırlarda da ayırıcıyı korur', () => {
    const dirty = '14 Eki   deepseek-v4.l-flash   3O.8ll.O37';
    expect(cleanOCRTableArtefacts(dirty)).toBe('14 Eki   deepseek-v4.1-flash   30.811.037');
  });
});

const ROW_A = '14 Eki\tdeepseek-v4.1-flash\t341\t30.811.037\t29.312.128 (%96)\t2.378.273\t0,00';
const ROW_B = '13 Eki\tglm-5.3\t120\t8.450.123\t6.112.004 (%72)\t2.338.119\t0,00';
const ROW_C = '12 Eki\tmimo-v2.6-pro\t95\t4.882.310\t3.221.004 (%66)\t1.661.306\t0,00';

/** Sahte OCR yöneticisi: her çağrıda verilen yanıtı (veya fırlatılan hatayı) üretir. */
function createFakeOCRManager(responses) {
  let callCount = 0;
  return {
    recognize: vi.fn(async () => {
      const response = responses[callCount];
      callCount += 1;
      if (typeof response === 'function') return response();
      return response;
    }),
  };
}

/** 1x1 geçerli görüntü girdisi (canvas gerekmez). */
function imageFile(name) {
  return { name, data: new Uint8ClampedArray(4), width: 1, height: 1 };
}

describe('Faz 30: deduplicateRecords', () => {
  it('örtüşen (scroll overlap) satırları tekilleştirir, ilk kaydı korur', () => {
    const first = { date: '6 Eki', model: 'glm-5.3', requests: 42, totalTokens: 1000, id: 'a' };
    const duplicate = { date: '6 Eki', model: 'glm-5.3', requests: 42, totalTokens: 1000, id: 'b' };
    const other = { date: '5 Eki', model: 'glm-5.3', requests: 42, totalTokens: 1000, id: 'c' };

    expect(deduplicateRecords([first, duplicate, other])).toEqual([first, other]);
  });

  it('boş girdi ve geçersiz kayıtlarda çökmez', () => {
    expect(deduplicateRecords()).toEqual([]);
    expect(deduplicateRecords([null, undefined])).toEqual([]);
  });
});

describe('Faz 30: processMultipleImagesToRecords', () => {
  it('3 parçalı ekran görüntüsünü sırayla okur, örtüşeni tekilleştirir', async () => {
    const manager = createFakeOCRManager([
      { data: { text: `${ROW_A}\n${ROW_B}` } },
      { data: { text: `${ROW_B}\n${ROW_C}` } },
      { data: { text: ROW_C } },
    ]);

    const result = await processMultipleImagesToRecords(
      [imageFile('image1.png'), imageFile('image2.png'), imageFile('image3.png')],
      manager,
    );

    expect(result.records).toHaveLength(3);
    expect(result.records.map((record) => record.model)).toEqual([
      'deepseek-v4.1-flash',
      'glm-5.3',
      'mimo-v2.6-pro',
    ]);
    expect(result.skippedDuplicates).toBe(2);
    expect(result.errors).toEqual([]);
    expect(manager.recognize).toHaveBeenCalledTimes(3);
  });

  it('BBox (words) çıktısını sütunlara bölerek ayrıştırır', async () => {
    const manager = createFakeOCRManager([
      {
        data: {
          words: [
            word('14', 10, 100, 25, 120),
            word('Eki', 30, 100, 55, 120),
            word('deepseek-v4.1-flash', 200, 100, 380, 120),
            word('341', 450, 100, 490, 120),
            word('3O.8ll.O37', 520, 100, 640, 120),
            word('29.3l2.l28', 670, 100, 780, 120),
            word('(%96)', 790, 100, 830, 120),
            word('2.378.273', 860, 100, 950, 120),
            word('0,00', 980, 100, 1020, 120),
          ],
        },
      },
    ]);

    const result = await processMultipleImagesToRecords([imageFile('image1.png')], manager);

    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      date: '14 Eki',
      model: 'deepseek-v4.1-flash',
      requests: 341,
      totalTokens: 30811037,
      cachedTokens: 29312128,
      billedTokens: 2378273,
    });
  });

  it('ilerleme bildirimlerini (onProgress) yüzdeyle birlikte gönderir', async () => {
    const manager = createFakeOCRManager([
      { data: { text: ROW_A } },
      { data: { text: ROW_B } },
    ]);
    const progress = [];

    await processMultipleImagesToRecords(
      [imageFile('image1.png'), imageFile('image2.png')],
      manager,
      (payload) => progress.push(payload),
    );

    expect(progress.some((entry) => entry.step === 'recognize' && entry.total === 2)).toBe(true);
    expect(progress[progress.length - 1]).toMatchObject({ step: 'complete', percentage: 100 });
  });

  it('okunamayan görselde akışı durdurmaz, hatayı raporlar', async () => {
    const manager = createFakeOCRManager([
      { data: { text: ROW_A } },
      () => { throw new Error('OCR_FAILED'); },
      { data: { text: ROW_B } },
    ]);

    const result = await processMultipleImagesToRecords(
      [imageFile('image1.png'), imageFile('image2.png'), imageFile('image3.png')],
      manager,
    );

    expect(result.records).toHaveLength(2);
    expect(result.errors).toEqual([{ file: 'image2.png', message: 'OCR_FAILED' }]);
  });

  it('geçersiz ocrManager enjeksiyonunda TypeError fırlatır', async () => {
    await expect(processMultipleImagesToRecords([], null)).rejects.toThrow(TypeError);
  });
});
