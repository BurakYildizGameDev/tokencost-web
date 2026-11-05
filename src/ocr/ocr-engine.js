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
 * Faz 27: Tesseract worker yaşam döngüsünü yönetir.
 * - Lazy initialization: worker ilk `recognize` çağrısında oluşturulur.
 * - Singleton: arka arkaya görseller yüklendiğinde aynı worker yeniden kullanılır.
 * - terminate(): worker belleği temizlenir, sonraki çağrı hata verir.
 * @param {{ createWorker: Function }} tesseractLib Testlerde mock'lanabilmesi için dışarıdan enjekte edilir.
 * @returns {object}
 */
export function createOCRManager(tesseractLib) {
  if (!tesseractLib || typeof tesseractLib.createWorker !== 'function') {
    throw new TypeError('ERR_INVALID_TESSERACT_LIB');
  }

  let workerPromise = null;
  let terminated = false;
  let recognizeCount = 0;

  const ensureWorker = (logger) => {
    if (workerPromise === null) {
      const workerOptions = typeof logger === 'function' ? { logger } : {};
      workerPromise = Promise.resolve(tesseractLib.createWorker('eng', 1, workerOptions))
        .then(async (worker) => {
          if (worker && typeof worker.setParameters === 'function') {
            await worker.setParameters({ tessedit_pageseg_mode: '6' });
          }
          return worker;
        });
    }
    return workerPromise;
  };

  return {
    /**
     * Görüntüyü metne çevirir (worker tek seferlik oluşturulur).
     * @param {object} imageData
     * @param {{ logger?: Function, preprocess?: boolean }} [options]
     * @returns {Promise<object>}
     */
    async recognize(imageData, options = {}) {
      if (terminated) throw new Error('ERR_OCR_MANAGER_TERMINATED');

      const worker = await ensureWorker(options.logger ?? null);
      recognizeCount += 1;

      const prepared = options.preprocess === false ? imageData : preprocessImageData(imageData);
      return worker.recognize(prepared);
    },

    /** Test ve teşhis için: worker sözü (henüz oluşturulmadıysa null). */
    getWorker() {
      return workerPromise;
    },

    /** Kaç kez recognize çağrıldığı. */
    getRecognizeCount() {
      return recognizeCount;
    },

    /** Worker serbest bırakıldı mı? */
    isTerminated() {
      return terminated;
    },

    /** Worker'ı sonlandırır ve belleği temizler. */
    async terminate() {
      if (terminated) return;
      terminated = true;
      const pending = workerPromise;
      workerPromise = null;
      if (!pending) return;
      const worker = await pending.catch(() => null);
      if (worker && typeof worker.terminate === 'function') {
        await worker.terminate();
      }
    },
  };
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
