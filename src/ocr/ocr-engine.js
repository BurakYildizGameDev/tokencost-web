// src/ocr/ocr-engine.js
// Faz 26 - 30: Tarayıcı içi OCR motoru (Tesseract.js enjeksiyonlu, DOM'suz test edilebilir).
// KURAL: Bu dosyada document/canvas KULLANILMAZ; tüm görüntü işlemleri saf piksel
//        ({ data: Uint8ClampedArray, width, height }) üzerinde çalışır.

import { buildRecordSignature, parsePastedTableText } from '../core/parser.js';

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

// --- Faz 28: Kelime kutucuklarından (BBox) tablo satırı kurma -------------------

/** Aynı satırdaki kelimeler arasında sütun ayırıcı sayılan yatay boşluk eşiği (px). */
export const COLUMN_GAP_THRESHOLD = 15;

// --- Faz 29: OCR metin düzeltme filtresi ---------------------------------------

/** Sayısal hücrelerde OCR'ın karıştırdığı harf → rakam eşlemesi. */
const OCR_DIGIT_SUBSTITUTIONS = {
  O: '0', o: '0', D: '0',
  l: '1', I: '1', '|': '1',
  S: '5', Z: '2', B: '8', G: '6',
};

/** Model adı hücrelerinde bilinen OCR bozulmaları (sadece harf bağlamında uygulanır). */
const OCR_MODEL_FIXES = [
  [/\bg[I1l]m\b/g, 'glm'],
  [/\bg1m\b/g, 'glm'],
  [/(\d)\.l(?=[-.\s]|$)/g, '$1.1'],
];

/**
 * Hücre sayısal mı? (Harf→rakam düzeltmesi SADECE bu hücrelerde uygulanır.)
 * Sayı ağırlıklı hücre = rakam sayısı, harf sayısından az değil.
 */
function isDigitDominantCell(cell) {
  const digits = (cell.match(/\d/g) || []).length;
  if (digits === 0) return false;
  const letters = (cell.match(/[A-Za-z]/g) || []).length;
  return digits >= letters;
}

/** Tek hücreyi bağlama duyarlı olarak düzeltir. */
function cleanOCRCell(cell) {
  if (cell === '') return cell;

  if (isDigitDominantCell(cell)) {
    return cell.replace(/[A-Za-z|]/g, (char) => OCR_DIGIT_SUBSTITUTIONS[char] ?? char);
  }

  return OCR_MODEL_FIXES.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), cell);
}

/**
 * Faz 29: OCR çıktısındaki tablo gürültülerini temizler.
 * - Sayısal hücrelerde O/o→0, l/I→1, S→5 gibi harf→rakam düzeltmeleri yapılır.
 * - Model adı hücrelerinde bilinen bozulmalar düzeltilir (gIm→glm, v4.l→v4.1).
 * - Model adındaki gerçek harfler (qwen3-vl-30b içindeki 'l') KORUNUR.
 * Sütun ayırıcıları (sekme / 2+ boşluk) aynen geri yazılır.
 * @param {string} rawLineText
 * @returns {string}
 */
export function cleanOCRTableArtefacts(rawLineText) {
  if (typeof rawLineText !== 'string' || rawLineText === '') return typeof rawLineText === 'string' ? rawLineText : '';

  // Ayırıcıları koruyarak böl: tek indeksler ayırıcı, çift indeksler hücredir.
  const parts = rawLineText.split(/(\t+|\s{2,})/);
  return parts
    .map((part, position) => (position % 2 === 1 ? part : cleanOCRCell(part)))
    .join('');
}

// --- Faz 30: Çoklu görselden tablo çıkarım orkestratörü ------------------------

/**
 * Faz 30: Kayıtları (tarih, model, istek, toplam token) dörtlüsüne göre tekilleştirir.
 * Uzun tablolar kaydırılarak 2-3 ekran görüntüsü halinde alındığında son satır
 * tekrar okunur (scroll overlap); bu mükerrer satırlar burada elenir.
 * NOT: İmza üretimi parser ile ORTAK tutulur (buildRecordSignature) ki iki katman
 * farklı tekilleştirme anahtarı kullanmasın.
 * @param {object[]} records
 * @returns {object[]}
 */
export function deduplicateRecords(records = []) {
  if (!Array.isArray(records)) return [];

  const seen = new Set();
  const unique = [];

  for (const record of records) {
    if (!record) continue;
    const key = buildRecordSignature(record);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(record);
  }

  return unique;
}

/** OCR'a verilecek görüntü verisini çözer (canvas DIŞINDA, enjekte edilebilir biçim). */
async function resolveImageData(imageFile) {
  if (!imageFile) throw new Error('ERR_EMPTY_IMAGE_FILE');
  if (imageFile.imageData) return imageFile.imageData;
  if (imageFile.data && Number(imageFile.width) > 0) return imageFile;
  if (typeof imageFile.getImageData === 'function') return await imageFile.getImageData();
  throw new Error('ERR_UNSUPPORTED_IMAGE_INPUT');
}

/** Tesseract sonucundan tablo metnini üretir (BBox varsa sütunlar korunur). */
function extractTableText(ocrResult) {
  const data = ocrResult && ocrResult.data ? ocrResult.data : ocrResult;
  const words = data && Array.isArray(data.words) ? data.words : [];

  if (words.length > 0) {
    return reconstructTableLinesFromWords(words).join('\n');
  }
  return typeof (data && data.text) === 'string' ? data.text : '';
}

/**
 * Faz 30: Birden çok ekran görüntüsünü sırayla OCR'dan geçirip tek kayıt listesine indirger.
 * - Her görsel: ön işleme → recognize → satır yeniden kurma → OCR düzeltme → ayrıştırma.
 * - Örtüşen (mükerrer) satırlar otomatik tekilleştirilir.
 * - Bir görsel okunamazsa akış durmaz; hata `errors` içinde raporlanır.
 * @param {Array<object>} imageFiles
 * @param {object} ocrManager createOCRManager() çıktısı (enjekte edilir)
 * @param {(progress: { step:string, index:number, total:number, percentage:number, message:string }) => void} [onProgress]
 * @returns {Promise<{ records: object[], skippedDuplicates: number, errors: Array<{ file:string, message:string }> }>}
 */
export async function processMultipleImagesToRecords(imageFiles, ocrManager, onProgress) {
  if (!ocrManager || typeof ocrManager.recognize !== 'function') {
    throw new TypeError('ERR_INVALID_OCR_MANAGER');
  }

  const files = Array.isArray(imageFiles) ? imageFiles : [];
  const total = files.length;
  const collected = [];
  const errors = [];
  const notify = (payload) => {
    if (typeof onProgress === 'function') onProgress(payload);
  };

  for (let index = 0; index < total; index += 1) {
    const imageFile = files[index];
    const label = `Görsel ${index + 1}/${total}`;
    const startPercentage = total > 0 ? Math.round((index / total) * 100) : 0;

    try {
      notify({ step: 'preprocess', index: index + 1, total, percentage: startPercentage, message: `${label} ön işleniyor...` });
      const imageData = await resolveImageData(imageFile);

      notify({ step: 'recognize', index: index + 1, total, percentage: startPercentage, message: `${label} okunuyor...` });
      const ocrResult = await ocrManager.recognize(imageData);

      const tableText = extractTableText(ocrResult);
      const cleanedText = tableText.split(/\r?\n/).map(cleanOCRTableArtefacts).join('\n');
      const parsed = parsePastedTableText(cleanedText);
      collected.push(...parsed.records);

      notify({
        step: 'done',
        index: index + 1,
        total,
        percentage: total > 0 ? Math.round(((index + 1) / total) * 100) : 100,
        message: `${label} tamamlandı (${parsed.records.length} satır).`,
      });
    } catch (error) {
      const message = (error && error.message) || String(error);
      errors.push({ file: (imageFile && imageFile.name) || `index-${index}`, message });
      notify({ step: 'error', index: index + 1, total, percentage: startPercentage, message: `${label} okunamadı: ${message}` });
    }
  }

  const records = deduplicateRecords(collected);

  notify({
    step: 'complete',
    index: total,
    total,
    percentage: 100,
    message: `${records.length} satır çıkarıldı.`,
  });

  return { records, skippedDuplicates: collected.length - records.length, errors };
}



/**
 * Faz 28: Tesseract kelime kutucuklarını tablo satırlarına dönüştürür.
 * - y0 koordinatı yTolerance (±10 px) içinde olan kelimeler aynı satırda toplanır (Y kümeleme).
 * - Satır içinde kelimeler x0'a göre soldan sağa sıralanır.
 * - Aralarındaki boşluk COLUMN_GAP_THRESHOLD'dan büyükse araya \t (sütun) konur.
 * @param {Array<{ text: string, bbox: { x0:number, y0:number, x1:number, y1:number } }>} words
 * @param {number} [yTolerance=10]
 * @returns {string[]} Yukarıdan aşağıya, soldan sağa tablo satırları
 */
export function reconstructTableLinesFromWords(words, yTolerance = 10) {
  if (!Array.isArray(words) || words.length === 0) return [];

  const tolerance = Number.isFinite(Number(yTolerance)) ? Math.abs(Number(yTolerance)) : 10;

  const items = words
    .filter((word) => word && word.bbox && typeof word.text === 'string' && word.text.trim() !== '')
    .map((word) => {
      const x0 = Number(word.bbox.x0) || 0;
      const x1 = Number(word.bbox.x1) || x0;
      const y0 = Number(word.bbox.y0) || 0;
      const y1 = Number(word.bbox.y1) || y0;
      const centerY = Number.isFinite((y0 + y1) / 2) ? (y0 + y1) / 2 : y0;
      return { text: word.text.trim(), x0, x1, y0, y1, centerY };
    })
    .sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);

  if (items.length === 0) return [];

  const rows = [];
  for (const item of items) {
    // En yakın dikey küme bulunur.
    let target = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const row of rows) {
      const distance = Math.abs(row.centerY - item.centerY);
      if (distance <= tolerance && distance < bestDistance) {
        bestDistance = distance;
        target = row;
      }
    }

    if (target) {
      target.words.push(item);
      target.centerY = target.words.reduce((sum, word) => sum + word.centerY, 0) / target.words.length;
    } else {
      rows.push({ centerY: item.centerY, words: [item] });
    }
  }

  rows.sort((a, b) => a.centerY - b.centerY);

  return rows.map((row) => {
    const sorted = [...row.words].sort((a, b) => a.x0 - b.x0);
    let line = sorted[0].text;
    for (let index = 1; index < sorted.length; index += 1) {
      const gap = sorted[index].x0 - sorted[index - 1].x1;
      line += `${gap > COLUMN_GAP_THRESHOLD ? '\t' : ' '}${sorted[index].text}`;
    }
    return line;
  });
}

