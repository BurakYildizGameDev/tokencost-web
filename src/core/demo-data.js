// src/core/demo-data.js
// Faz 43: "Gerçek Veriyle Dene" örnek (demo) konsol veri seti (Saf / Pure Core katmanı).
// KURAL: Bu dosyada document, window, localStorage veya fetch KULLANILMAZ.
//
// Vitrin senaryosu (3 ekran görüntüsü / 13 satır):
//   333.698.885 token | 4.044 istek | %89,66 önbellek isabeti
//   Örnek katalogla: $13.80 fatura, önbellek olmasaydı $51.76, tasarruf $37.96 (%73,34)
// Ziyaretçi elinde ekran görüntüsü olmasa bile butona basıp bu rakamları canlı görebilir.

import { createTokenRecord, createPricingProfile } from './schema.js';

/** Demo butonunun DOM kimliği (Faz 44 orkestratörü bu kimliğe bağlanır). */
export const DEMO_BUTTON_ID = 'btn-load-demo';

/** Demo butonunun görünen etiketi (yol haritası Faz 43 metni ile birebir). */
export const DEMO_BUTTON_LABEL = 'Örnek Konsol Verisi Yükle (333.7M Token)';

/** Vitrin senaryosunun beklenen toplamları (test ve UI karşılaştırması için tek kaynak). */
export const DEMO_TOTAL_TOKENS = 333698885;
export const DEMO_TOTAL_REQUESTS = 4044;
export const DEMO_TOTAL_CACHED_TOKENS = 299178278;
export const DEMO_TOTAL_BILLED_TOKENS = 34520607;
export const DEMO_EXPECTED_INVOICE_USD = 13.8;
export const DEMO_EXPECTED_SAVED_USD = 37.955664;
export const DEMO_EXPECTED_CACHE_HIT_RATE = 89.66;

/**
 * Çevrimdışı (offline) modda kullanılan statik fiyat kataloğu (1M token / USD).
 * Canlı LiteLLM/OpenRouter kataloğuna erişilemezse uygulama bu fiyatlarla çalışır.
 * Anahtarlar kanonik (alias çözümünden sonraki) model kimlikleridir:
 *   deepseek-v4.1-flash -> deepseek-chat, glm-5.3 -> glm-4-plus,
 *   mimo-v2.6-pro -> mimo-v2.6-pro, qwen3-vl-30b -> qwen-vl-max
 */
export const DEMO_PRICING_CATALOG = Object.freeze({
  'deepseek-chat': createPricingProfile({
    modelId: 'deepseek-chat',
    displayName: 'DeepSeek V4.1 Flash',
    cachedInputCostPerMillion: 0.014,
    uncachedInputCostPerMillion: 0.14,
    outputCostPerMillion: 0.28,
    source: 'custom',
  }),
  'glm-4-plus': createPricingProfile({
    modelId: 'glm-4-plus',
    displayName: 'GLM 5.3',
    cachedInputCostPerMillion: 0.03,
    uncachedInputCostPerMillion: 0.3,
    outputCostPerMillion: 0.6,
    source: 'custom',
  }),
  'mimo-v2.6-pro': createPricingProfile({
    modelId: 'mimo-v2.6-pro',
    displayName: 'MiMo v2.6 Pro',
    cachedInputCostPerMillion: 0.02,
    uncachedInputCostPerMillion: 0.2,
    outputCostPerMillion: 0.4,
    source: 'custom',
  }),
  'qwen-vl-max': createPricingProfile({
    modelId: 'qwen-vl-max',
    displayName: 'Qwen3-VL 30B',
    cachedInputCostPerMillion: 0.05,
    uncachedInputCostPerMillion: 0.5,
    outputCostPerMillion: 1,
    source: 'custom',
  }),
});

/**
 * 3 ekran görüntüsünden birebir okunan 13 satır (kaynak: model konsolu kullanım dışa aktarımı).
 * Sıralama yeniden eskiye (konsoldaki gibi) korunur; her satırda
 * `cachedTokens + billedTokens === totalTokens` eşitliği eksiksizdir.
 */
const SCREENSHOT_ROWS = Object.freeze([
  { date: '14 Eki', model: 'deepseek-ai/DeepSeek-V4.1-Flash', requests: 2984, totalTokens: 177254544, cachedTokens: 169521069, billedTokens: 7733475 },
  { date: '13 Eki', model: 'deepseek-ai/DeepSeek-V4.1-Flash', requests: 412, totalTokens: 31428906, cachedTokens: 27028906, billedTokens: 4400000 },
  { date: '12 Eki', model: 'deepseek-ai/DeepSeek-V4.1-Flash', requests: 168, totalTokens: 24880412, cachedTokens: 21180412, billedTokens: 3700000 },
  { date: '11 Eki', model: 'deepseek-ai/DeepSeek-V4.1-Flash', requests: 106, totalTokens: 21356788, cachedTokens: 18156788, billedTokens: 3200000 },
  { date: '10 Eki', model: 'deepseek-ai/DeepSeek-V4.1-Flash', requests: 78, totalTokens: 18742663, cachedTokens: 16242663, billedTokens: 2500000 },
  { date: '9 Eki', model: 'deepseek-ai/DeepSeek-V4.1-Flash', requests: 62, totalTokens: 16415900, cachedTokens: 14015900, billedTokens: 2400000 },
  { date: '8 Eki', model: 'deepseek-ai/DeepSeek-V4.1-Flash', requests: 30, totalTokens: 13880225, cachedTokens: 11684060, billedTokens: 2196165 },
  { date: '7 Eki', model: 'deepseek-ai/DeepSeek-V4.1-Flash', requests: 20, totalTokens: 9742318, cachedTokens: 8042318, billedTokens: 1700000 },
  { date: '6 Eki', model: 'glm-5.3', requests: 92, totalTokens: 3600000, cachedTokens: 1200000, billedTokens: 2400000 },
  { date: '5 Eki', model: 'deepseek-ai/DeepSeek-V4.1-Flash', requests: 14, totalTokens: 7415662, cachedTokens: 6115662, billedTokens: 1300000 },
  { date: '4 Eki', model: 'deepseek-ai/DeepSeek-V4.1-Flash', requests: 10, totalTokens: 5881467, cachedTokens: 5390500, billedTokens: 490967 },
  { date: '3 Eki', model: 'mimo-v2.6-pro', requests: 44, totalTokens: 2000000, cachedTokens: 400000, billedTokens: 1600000 },
  { date: '1 Eki', model: 'qwen3-vl-30b', requests: 24, totalTokens: 1100000, cachedTokens: 200000, billedTokens: 900000 },
]);

/**
 * Faz 43: Örnek konsol veri setini (13 satır, 333.698.885 token, 4.044 istek) döner.
 * Her çağrıda yeni ve dondurulmuş kayıt nesneleri üretir; çağıran taraf
 * demo verisini düzenlese bile sabit şablon bozulmaz.
 * @returns {Readonly<object>[]}
 */
export function getSampleScreenshotDataset() {
  return SCREENSHOT_ROWS.map((row) => createTokenRecord({ ...row }));
}

/** Konsol tablosunun başlık satırı (TSV). */
export const SAMPLE_TABLE_HEADER = 'Zaman\tModel\tİstek\tToplam Token\tÖnbelleklenen\tKotaya Yansıyan';

/** Konsol tablosunun özet satırı (TSV) — çifte sayımı önlemek için ayrıştırıcı bunu eler. */
export const SAMPLE_TABLE_SUMMARY_ROW =
  'Toplam (30 gün)\t—\t4.044\t333.698.885 (%90)\t299.178.278\t34.520.607';

/**
 * Faz 43 / 46: Sayfa kaydırılarak alınmış 3 ekran görüntüsünün ham tablo metinleri.
 * 1. ve 2. görüntü **örtüşür**: `6 Eki glm-5.3` satırı her ikisinde de görünür,
 * tekilleştirme (deduplicateRecords) sayesinde toplamda yalnızca bir kez sayılır.
 * @type {Readonly<string[]>}
 */
export const SAMPLE_SCREENSHOT_TEXTS = Object.freeze([
  [
    SAMPLE_TABLE_HEADER,
    '14 Eki\tdeepseek-ai/DeepSeek-V4.1-Flash\t2.984\t177.254.544 (%95)\t169.521.069\t7.733.475',
    '13 Eki\tdeepseek-ai/DeepSeek-V4.1-Flash\t412\t31.428.906 (%86)\t27.028.906\t4.400.000',
    '12 Eki\tdeepseek-ai/DeepSeek-V4.1-Flash\t168\t24.880.412 (%85)\t21.180.412\t3.700.000',
    '11 Eki\tdeepseek-ai/DeepSeek-V4.1-Flash\t106\t21.356.788 (%85)\t18.156.788\t3.200.000',
    '10 Eki\tdeepseek-ai/DeepSeek-V4.1-Flash\t78\t18.742.663 (%87)\t16.242.663\t2.500.000',
    '6 Eki\tglm-5.3\t92\t3.600.000 (%33)\t1.200.000\t2.400.000',
  ].join('\n'),
  [
    SAMPLE_TABLE_HEADER,
    '6 Eki\tglm-5.3\t92\t3.600.000 (%33)\t1.200.000\t2.400.000',
    '9 Eki\tdeepseek-ai/DeepSeek-V4.1-Flash\t62\t16.415.900 (%85)\t14.015.900\t2.400.000',
    '8 Eki\tdeepseek-ai/DeepSeek-V4.1-Flash\t30\t13.880.225 (%84)\t11.684.060\t2.196.165',
    '7 Eki\tdeepseek-ai/DeepSeek-V4.1-Flash\t20\t9.742.318 (%83)\t8.042.318\t1.700.000',
    '5 Eki\tdeepseek-ai/DeepSeek-V4.1-Flash\t14\t7.415.662 (%82)\t6.115.662\t1.300.000',
  ].join('\n'),
  [
    SAMPLE_TABLE_HEADER,
    '4 Eki\tdeepseek-ai/DeepSeek-V4.1-Flash\t10\t5.881.467 (%92)\t5.390.500\t490.967',
    '3 Eki\tmimo-v2.6-pro\t44\t2.000.000 (%20)\t400.000\t1.600.000',
    '1 Eki\tqwen3-vl-30b\t24\t1.100.000 (%18)\t200.000\t900.000',
  ].join('\n'),
]);

/**
 * Faz 43: Tek seferde yapıştırılabilir tam tablo metni (başlık + 13 satır + özet satırı).
 * `parsePastedTableText` bu metinden tam olarak 13 kayıt üretir.
 * @type {string}
 */
export const SAMPLE_PASTED_TABLE_TEXT = [
  SAMPLE_TABLE_HEADER,
  '14 Eki\tdeepseek-ai/DeepSeek-V4.1-Flash\t2.984\t177.254.544 (%95)\t169.521.069\t7.733.475',
  '13 Eki\tdeepseek-ai/DeepSeek-V4.1-Flash\t412\t31.428.906 (%86)\t27.028.906\t4.400.000',
  '12 Eki\tdeepseek-ai/DeepSeek-V4.1-Flash\t168\t24.880.412 (%85)\t21.180.412\t3.700.000',
  '11 Eki\tdeepseek-ai/DeepSeek-V4.1-Flash\t106\t21.356.788 (%85)\t18.156.788\t3.200.000',
  '10 Eki\tdeepseek-ai/DeepSeek-V4.1-Flash\t78\t18.742.663 (%87)\t16.242.663\t2.500.000',
  '9 Eki\tdeepseek-ai/DeepSeek-V4.1-Flash\t62\t16.415.900 (%85)\t14.015.900\t2.400.000',
  '8 Eki\tdeepseek-ai/DeepSeek-V4.1-Flash\t30\t13.880.225 (%84)\t11.684.060\t2.196.165',
  '7 Eki\tdeepseek-ai/DeepSeek-V4.1-Flash\t20\t9.742.318 (%83)\t8.042.318\t1.700.000',
  '6 Eki\tglm-5.3\t92\t3.600.000 (%33)\t1.200.000\t2.400.000',
  '5 Eki\tdeepseek-ai/DeepSeek-V4.1-Flash\t14\t7.415.662 (%82)\t6.115.662\t1.300.000',
  '4 Eki\tdeepseek-ai/DeepSeek-V4.1-Flash\t10\t5.881.467 (%92)\t5.390.500\t490.967',
  '3 Eki\tmimo-v2.6-pro\t44\t2.000.000 (%20)\t400.000\t1.600.000',
  '1 Eki\tqwen3-vl-30b\t24\t1.100.000 (%18)\t200.000\t900.000',
  SAMPLE_TABLE_SUMMARY_ROW,
].join('\n');


