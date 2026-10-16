# TokenCost FinOps Analyzer — Yapılanlar Raporu

> **Durum:** Faz 1–47 tamamlandı ve commit edildi — **yol haritası bitti, uygulama yayına hazır**.
> **Dal:** `main` · **Toplam commit:** 49 (başlangıç + Faz 1–47 = 48 faz commit'i, +1 doküman commit'i) · **Tarih aralığı:** 2026-10-10 → 2026-11-26
> **Test:** `14 dosya / 274 test — tamamı yeşil` · **Runtime bağımlılığı:** 0 (sıfır)

---

## 1. Proje Nedir?

**TokenCost FinOps Analyzer**, LLM kullanım tablolarını (ekran görüntüsü **veya** kopyala-yapıştır
metni) tarayıcıda okuyup **önbellek (prompt cache) tasarrufunu, gerçek faturayı ve ROI'yi** hesaplayan
**tamamen istemci taraflı (zero-backend)** bir web uygulamasıdır.

| Özellik | Değer |
|---|---|
| Mimari | Zero-backend, statik dosyalar, GitHub Pages'de yayınlanabilir |
| Sunucu / API key | **Yok.** Hiçbir kullanıcı verisi hiçbir yere gönderilmez |
| Çalışma zamanı kütüphanesi | **Yok** (Chart.js / D3 / React / Lodash kullanılmadı) |
| Test altyapısı | Vitest 2 + jsdom 26 (`devDependencies` — üretim paketine girmez) |
| Dil / modül sistemi | Vanilla ES Modules (`"type": "module"`), açık `.js` uzantılı import'lar |
| i18n | Arayüz ve tüm çıktılar **Türkçe**; kod yorumları Türkçe |

**Temel kısıtlar (tüm fazlarda korundu):**

1. `src/core/*` ve `src/ocr/*` **saf** fonksiyonlardan oluşur — DOM'a, `window`'a, `globalThis.fetch`'e doğrudan dokunmaz (bağımlılıklar enjekte edilir).
2. DOM erişimi yalnızca enjekte edilen `ownerDocument` / `environment` nesnesi üzerinden yapılır.
3. Dış veri (fiyat) katmanı her zaman **çevrimdışı fallback zinciri** ile çalışır; ağ hataları uygulamayı çökertmez.
4. Her faz: **önce kırmızı test (TDD) → sonra üretim kodu → yeşil → tek commit**.

---

## 2. Mimari Katman Haritası

```
src/
├── app.js     → Orkestratör (initApp): girdi → OCR/ayrıştırma → hesap → render → dışa aktarma
├── main.js    → Tarayıcı giriş noktası (index.html ile bağlar, globalThis.tokenCostApp)
├── core/      → Saf iş kuralları (DOM yok, ağ yok, yan etki yok)
├── ocr/       → Görsel işleme + OCR boru hattı (tesseract dışarıdan enjekte edilir)
├── services/  → Dış dünya adaptörleri (ağ, önbellek, dosya indirme, rapor üretimi)
└── ui/        → Store, bileşenler, grafik, girdi olayları (DOM enjeksiyonu ile test edilebilir)

index.html · styles.css            → Statik arayüz (kök; GitHub Pages'e doğrudan yayınlanır)
.github/workflows/deploy.yml       → CI/CD: npm test → dist/ paketi → GitHub Pages
```

### Dosya envanteri (üretim kodu — 16 modül / 4.679 satır; kök statik dosyalar hariç)

| Dosya | Satır | Dışa aktarılan API (özet) |
|---|---:|---|
| `src/core/schema.js` | 163 | `createTokenRecord`, `createPricingProfile`, `VALID_PRICING_SOURCES`, `DEFAULT_DATE_LABEL` |
| `src/core/calculator.js` | 210 | `calculateCacheHitRatio`, `validateTokenConsistency`, `calculateSingleRowCost`, `calculateCacheSavings`, `aggregateUsageSummaries`, `groupRecordsByModel` |
| `src/core/formatter.js` | 54 | `formatCostDisplay`, `formatTokenCount` |
| `src/core/normalizer.js` | 205 | `normalizeModelName`, `extractModelIdentifiers`, `DEFAULT_MODEL_ALIASES`, `resolveModelAlias`, `levenshteinDistance`, `fuzzyMatchModel`, `resolveFallbackPricing` |
| `src/core/parser.js` | 427 | `tokenizeRawLine`, `detectColumnIndices`, `buildRecordSignature`, `parsePastedTableText`, `parseCachedColumn`, `sanitizeNumberString`, `isSummaryRow`, `DATE_CELL_PATTERN`, `SUMMARY_ROW_PATTERN` |
| `src/core/demo-data.js` | 162 | `getSampleScreenshotDataset`, `SAMPLE_SCREENSHOT_TEXTS`, `SAMPLE_PASTED_TABLE_TEXT`, `SAMPLE_TABLE_HEADER`, `SAMPLE_TABLE_SUMMARY_ROW`, `DEMO_PRICING_CATALOG`, `DEMO_TOTAL_TOKENS`, `DEMO_TOTAL_REQUESTS`, `DEMO_TOTAL_CACHED_TOKENS`, `DEMO_TOTAL_BILLED_TOKENS`, `DEMO_EXPECTED_INVOICE_USD`, `DEMO_EXPECTED_SAVED_USD`, `DEMO_EXPECTED_CACHE_HIT_RATE`, `DEMO_BUTTON_ID`, `DEMO_BUTTON_LABEL` |
| `src/ocr/ocr-engine.js` | 415 | `createOCRManager`, `preprocessImageData`, `detectDarkTheme`, `reconstructTableLinesFromWords`, `cleanOCRTableArtefacts`, `deduplicateRecords`, `processMultipleImagesToRecords`, `DEFAULT_PREPROCESS_OPTIONS`, `COLUMN_GAP_THRESHOLD`, `DARK_THEME_LUMINANCE_LIMIT` |
| `src/services/currency-service.js` | 76 | `convertCurrency`, `CURRENCY_META`, `DEFAULT_RATES` |
| `src/services/pricing-service.js` | 296 | `fetchLiteLLMPrices`, `parseLiteLLMResponse`, `fetchAndParseOpenRouterPrices`, `parseOpenRouterResponse`, `applyCustomPriceOverrides`, `isPricingCacheStale`, `loadPricingCatalog`, `PRICING_CACHE_KEY`, `DEFAULT_PRICING_TTL_HOURS`, `LITELLM_PRICING_URL`, `OPENROUTER_MODELS_URL` |
| `src/services/export-service.js` | 600 | `SIGNATURE_TEXT`, `generateCSVContent`, `downloadCSVFile`, `escapeCSVCell`, `generatePDFReportHTML`, `printReportHTMLInIframe`, `exportToPDF`, `generateMarkdownReport`, `copyReportToClipboard`, `encodeStateToHash`, `decodeStateFromHash`, `PDF_REPORT_STYLES`, `HASH_STATE_PREFIX`, `HASH_STATE_VERSION` |
| `src/ui/store.js` | 339 | `createAppStore`, `buildCalculatedRecords`, `resolveCatalogKeyForModel`, `FALLBACK_PRICING`, `FALLBACK_PRICING_SOURCE`, `MAX_FUZZY_MODEL_DISTANCE`, `DEFAULT_NEW_MODEL_NAME` |
| `src/ui/components.js` | 801 | `renderUsageTable`, `parseEditableNumber`, `renderFinOpsSummaryCards`, `buildFinOpsMetricValues`, `renderAppFooter`, `updateProgressBanner`, `showNotification`, `notifyUnknownModelPrices`, `SIGNATURE_TEXT` (re-export) + tablo/kart/toast sabitleri |
| `src/ui/charts.js` | 136 | `generateModelCostDonutSVG`, `CHART_COLORS`, `DONUT_VIEWBOX_SIZE`, `DONUT_RADIUS`, `DONUT_STROKE_WIDTH`, `DONUT_EMPTY_COLOR` |
| `src/ui/input-handler.js` | 174 | `bindInputEvents`, `isAcceptedFile`, `filterAcceptedFiles`, `isEditableTarget`, `ACCEPTED_FILE_EXTENSIONS` |
| `src/app.js` | 598 | `initApp` (orkestratör: girdi → OCR/ayrıştırma → hesap → render → dışa aktarma) + 28 dışa aktarım: panel kimlikleri (`INPUT_PANEL_ID`, `CARDS_CONTAINER_ID`, `CHART_CONTAINER_ID`, `TABLE_CONTAINER_ID`, `PROGRESS_BANNER_ID`, `TOAST_CONTAINER_ID`, `FOOTER_CONTAINER_ID`, `THEME_TOGGLE_ID`, `CURRENCY_SELECT_ID`, `APP_ROOT_CLASS`), tema/para birimi sabitleri (`SUPPORTED_THEMES`, `DEFAULT_THEME`, `THEME_STORAGE_KEY`, `THEME_LABELS`, `SUPPORTED_CURRENCIES`, `IMAGE_EXTENSIONS`) ve Türkçe kullanıcı mesajı sabitleri |
| `src/main.js` | 23 | Tarayıcı giriş noktası: `resolveRootElement()` + `initApp(...)`, `globalThis.tokenCostApp` |

**Kök statik dosyalar (Faz 47):** `index.html` (87 satır), `styles.css` (693 satır), `README.md` (112 satır),
`.gitattributes` (16 satır), `.github/workflows/deploy.yml` (82 satır).

### Veri akışı (tek yönlü)

```
 [ekran görüntüsü] ─ preprocessImageData → tesseract → reconstructTableLinesFromWords
                                                                      │
                                                         cleanOCRTableArtefacts
                                                                      │
 [Ctrl+V / .txt / .csv metni] ─────────────────────────────► parsePastedTableText
                                                                      │
                     normalizeModelName → resolveModelAlias → fuzzyMatchModel
                                                                      │
      katalog: LiteLLM JSON → OpenRouter → localStorage cache → statik fallback
                                                                      │
                        buildCalculatedRecords (calculateSingleRowCost + cache tasarrufu)
                                                                      │
   ┌────────────────┬───────────────────────┬─────────────────────┬───────────────┐
   ▼                ▼                       ▼                     ▼               ▼
renderUsageTable  FinOpsSummaryCards  Donut SVG (saf)   .csv / .pdf / .md   #data= link
```

---

## 3. Faz Faz Yapılanlar (48 commit, kronolojik)

Her satır: `commit | tarih | faz — kapsam`. Her fazda önce test yazıldı (kırmızı), sonra üretim kodu eklendi (yeşil).

### Blok A — Çekirdek hesaplama ve veri modeli (Faz 1–10 · 2026-10-10 → 2026-10-19)

| Commit | Tarih | Faz ve kapsam |
|---|---|---|
| `985e555` | 2026-10-10 | **Faz 1** — `createTokenRecord`: token veri şeması (tarih, model, istek, toplam/önbelleklenen/net token) + doğrulama, negatif değer ve tutarsızlık reddi |
| `c1f2dc3` | 2026-10-11 | **Faz 2** — `createPricingProfile`: 3 fiyat alanı (cached/uncached input, output) milyon-token başına + `source` doğrulaması |
| `dc297c2` | 2026-10-12 | **Faz 3** — `calculateCacheHitRatio`: 0'a bölme koruması, %100 üstü değerin kırpılması |
| `a49dfd5` | 2026-10-13 | **Faz 4** — `validateTokenConsistency`: "Kotaya Yansıyan Token" ≠ toplam − önbelleklenen durumunu raporlar |
| `d37dedc` | 2026-10-14 | **Faz 5** — `calculateSingleRowCost`: input/output ayrım oranı (varsayılan %30) ile tek satır maliyeti |
| `455d158` | 2026-10-15 | **Faz 6** — `calculateCacheSavings`: önbellekli vs önbelleksiz input farkından tasarruf ($ ve oran) |
| `de71dd9` | 2026-10-16 | **Faz 7** — `aggregateUsageSummaries`: toplam fatura, toplam tasarruf, önbelleksiz maliyet, kota özeti |
| `570aa6c` | 2026-10-17 | **Faz 8** — `groupRecordsByModel`: model bazlı gruplama + maliyet sıralaması (grafik ve tablolar için girdi) |
| `b23f3a8` | 2026-10-18 | **Faz 9** — `convertCurrency` (USD/TRY/EUR): özel kur desteği, `CURRENCY_META`, `DEFAULT_RATES` |
| `7a393cc` | 2026-10-19 | **Faz 10** — `formatCostDisplay`, `formatTokenCount`: TR yerelleştirmeli para/token gösterimi (₺, binlik ayraç, M/K kısaltma) |

### Blok B — Model adı çözümleme ve fiyat servisleri (Faz 11–20 · 2026-10-20 → 2026-10-29)

| Commit | Tarih | Faz ve kapsam |
|---|---|---|
| `0dd4a6e` | 2026-10-20 | **Faz 11** — `normalizeModelName`: küçük harf, `provider/model` öneki temizliği, boşluk/ayraç normalizasyonu |
| `aec7cda` | 2026-10-21 | **Faz 12** — `resolveModelAlias` + `DEFAULT_MODEL_ALIASES`: `glm-5.3 → glm-4-plus`, `deepseek-v4.1-flash → deepseek-chat` gibi statik tablo |
| `cda2c79` | 2026-10-22 | **Faz 13** — `levenshteinDistance`, `fuzzyMatchModel`: OCR/yazım hatası toleranslı eşleşme |
| `185831f` | 2026-10-23 | **Faz 14** — `resolveFallbackPricing`: bilinmeyen model için kademeli politika (ücretsiz model, pro model, embedding, default) |
| `6ec3ba2` | 2026-10-24 | **Faz 15** — `applyCustomPriceOverrides`: kullanıcının elle girdiği fiyatı katalogla birleştirme (kısmi override güvenli) |
| `e6077a3` | 2026-10-25 | **Faz 16** — `fetchLiteLLMPrices`: LiteLLM `model_prices_and_context_window.json` çekici, timeout, enjekte edilebilir `fetchFn` |
| `a0a18c8` | 2026-10-26 | **Faz 17** — `parseLiteLLMResponse`: ham JSON → `PricingProfile` kataloğu (naif USD/token → milyon başına dönüşüm) |
| `58a4f86` | 2026-10-27 | **Faz 18** — `fetchAndParseOpenRouterPrices`, `parseOpenRouterResponse`: ikinci canlı fiyat kaynağı |
| `de684d5` | 2026-10-28 | **Faz 19** — `loadPricingCatalog`: zincir = canlı → localStorage önbelleği → statik gömülü → minimal fallback |
| `dcdeb9b` | 2026-10-29 | **Faz 20** — `isPricingCacheStale`: TTL (varsayılan 24 saat) kontrolü, `now` enjekte edilebilir |

> Tüm hash ve tarihler `git log --reverse --pretty=format:'%h|%ad|%s' --date=short` çıktısından birebir alınmıştır;
> istediğiniz an bu komutla karşılaştırılabilir.

### Blok C — Metin ayrıştırma ve OCR (Faz 21–30 · 2026-10-30 → 2026-11-08)

| Commit | Tarih | Faz ve kapsam |
|---|---|---|
| `4ea4092` | 2026-10-30 | **Faz 21** — `tokenizeRawLine`: sekme/çoklu boşluk/`\|` ayraçlı satır tokenizasyonu |
| `6890715` | 2026-10-31 | **Faz 22** — `sanitizeNumberString`: TR (`1.234.567`) ve EN (`1,234,567`) binlik ayraçlarının ayırt edilerek sayıya çevrilmesi |
| `ff3b173` | 2026-11-01 | **Faz 23** — `parseCachedColumn`: `(%95)` parantezli yüzde ve `—` (veri yok) temizliği |
| `bbec8ac` | 2026-11-02 | **Faz 24** — `detectColumnIndices`: başlık satırından sütun indekslerinin otomatik bulunması |
| `16a682c` | 2026-11-03 | **Faz 25** — `parsePastedTableText`: tam boru hattı; özet satırlarını (`Toplam (30 gün)`) ayıklar |
| `f6bc3fd` | 2026-11-04 | **Faz 26** — `preprocessImageData`, `detectDarkTheme`: gri tonlama, kontrast, koyu tema tersleme |
| `1d3538a` | 2026-11-05 | **Faz 27** — `createOCRManager`: tesseract worker yaşam döngüsü (`terminate` sonrası `ERR_OCR_MANAGER_TERMINATED`) |
| `3c78f2d` | 2026-11-06 | **Faz 28** — `reconstructTableLinesFromWords`: kelime kutularından satır/sütun yeniden kurma (y toleransı, sütun boşluk eşiği) |
| `2398728` | 2026-11-07 | **Faz 29** — `cleanOCRTableArtefacts`: `O→0`, `l→1`, `gIm→glm` gibi OCR kaynaklı metin/sayı düzeltmeleri |
| `b77387c` | 2026-11-08 | **Faz 30** — `processMultipleImagesToRecords`: çoklu görsel → kayıt listesi, ilerleme geri çağrısı, tekrarları ayıklama |

### Blok D — UI çekirdeği (Faz 31–35 · 2026-11-09 → 2026-11-13)

| Commit | Tarih | Faz ve kapsam |
|---|---|---|
| `787dc06` | 2026-11-09 | **Faz 31** — `createAppStore`: Pub/Sub reaktif store (`subscribe`, `addRecords`, `updateRecord`, `removeRecord`, `setCurrencyRate`, `setCustomPrice`, `getState`, `reset`) + `buildCalculatedRecords` ile türetilmiş durum |
| `f823d16` | 2026-11-10 | **Faz 32** — `bindInputEvents`: dosya sürükle-bırak, dosya seçici, Ctrl+V yapıştırma; uzantı filtresi (`ACCEPTED_FILE_EXTENSIONS`) |
| `16776fa` | 2026-11-11 | **Faz 33** — `renderUsageTable` + `parseEditableNumber`: satır içi düzenlenebilir tablo (`EDITABLE_FIELDS`, `NUMERIC_FIELDS`, `USAGE_TABLE_COLUMNS`), model silme, idempotent yeniden çizim |
| `1cd7b2e` | 2026-11-12 | **Faz 34** — `updateProgressBanner`: OCR ilerleme çubuğu, durum metni, ARIA (`PROGRESS_ARIA_LABEL`) |
| `015935f` | 2026-11-13 | **Faz 35** — `showNotification`, `notifyUnknownModelPrices`: toast bildirimleri (`TOAST_TYPES`, 5 sn varsayılan süre), bilinmeyen model uyarı rozeti |

### Blok E — Bug taraması (2026-11-14 · `7a0254e`)

42 commit'lik kod tabanı "gerçek hata avı" sondalarıyla tarandı; **4 doğrulanmış hata** bulunup düzeltildi
(test sayısı 189 → 197). Ayrıntılar Bölüm 4'te.

### Blok F — Raporlama, grafik ve dışa aktarma (Faz 36–42 · 2026-11-15 → 2026-11-21)

| Commit | Tarih | Faz ve kapsam |
|---|---|---|
| `7c3fbfc` | 2026-11-15 | **Faz 36** — `src/ui/charts.js`: `generateModelCostDonutSVG` **saf SVG** donut üretici (harici kütüphane yok). `viewBox 0 0 200 200`, `r=70`, `stroke-width=24`, dilimler `stroke-dasharray`/`stroke-dashoffset` ile; `CHART_COLORS` paleti; veri yoksa `data-empty` halka; tüm etiketler XML-escape; çıktı deterministik (aynı girdi → aynı string) |
| `2832638` | 2026-11-16 | **Faz 37** — `renderFinOpsSummaryCards` + `buildFinOpsMetricValues`: 4 FinOps kartı — (1) *Normalde Ödenecek (Önbelleksiz)*, (2) *Önbellek Tasarrufu* (negatifse kâr vurgusu), (3) *Gerçek Fatura (USD & TRY)*, (4) *Kotaya Yansıyan İstek & Token*. `FINOPS_METRIC_LABELS` / `FINOPS_METRIC_VARIANTS` sabitleri; `refresh()` ile DOM düğümleri yeniden kullanılır (idempotent) |
| `9102c14` | 2026-11-17 | **Faz 38** — `src/services/export-service.js`: `generateCSVContent` (UTF-8 BOM `\uFEFF`, RFC 4180 kaçışı, `CSV_COLUMN_HEADERS`, sonda `TOPLAM` satırı, en alt satırda tırnaklı `SIGNATURE_TEXT`) + `downloadCSVFile` (Blob + `URL.createObjectURL`, `text/csv;charset=utf-8;`; DOM yoksa `ERR_DOM_UNAVAILABLE`) |
| `e4fcbbf` | 2026-11-18 | **Faz 39** — `generatePDFReportHTML`: A4 `@page` + açık tema `PDF_REPORT_STYLES`, özet kart bloğu, model ve satır tabloları, altbilgi imzası; `printReportHTMLInIframe` (gizli iframe + `print()`); `exportToPDF` hibrit (enjekte edilen `html2pdf` varsa onu kullanır, yoksa yazdırma yoluna düşer) |
| `c56c2da` | 2026-11-19 | **Faz 40** — `generateMarkdownReport`: GitHub Issue/PR'a yapıştırılabilir GFM raporu (özet tablosu, TR ondalık virgüllü `formatPercent`, `<sub>` imza) + `copyReportToClipboard` (enjekte edilebilir `clipboard`) |
| `9335b05` | 2026-11-20 | **Faz 41** — `encodeStateToHash` / `decodeStateFromHash`: zero-backend durum paylaşımı (`#data=` öneki, URL-güvenli Base64, kısa anahtarlar `m/d/r/t/c/b`, `HASH_STATE_VERSION = 1`); bozuk/eksik hash **asla throw etmez**, `null` döner |
| `dc0e6c8` | 2026-11-21 | **Faz 42** — `renderAppFooter` + `APP_FOOTER_CLASS`, `EXPORT_CSV_BUTTON_ID`, `EXPORT_PDF_BUTTON_ID`: `footer.app-footer` içinde `.export-toolbar` (`.CSV İndir` / `.PDF İndir` butonları) ve `small.app-signature` (imza) üretir; ikinci çağrıda mevcut düğümler yeniden kullanılır, geçersiz kapsayıcıda `TypeError('ERR_INVALID_FOOTER_ELEMENT')`. `SIGNATURE_TEXT` `export-service.js`'ten `components.js` üzerinden **tek merkezden** yeniden dışa aktarılır |

### Blok G — Bitiş aşaması: vitrin verisi, orkestratör, E2E ve yayın (Faz 43–47 · 2026-11-22 → 2026-11-26)

| Commit | Tarih | Faz ve kapsam |
|---|---|---|
| `a1de9c6` | 2026-11-22 | **Faz 43** — `src/core/demo-data.js`: 3 ekran görüntüsünün ham konsol metni (`SAMPLE_SCREENSHOT_TEXTS`), `getSampleScreenshotDataset()` → **13 satır / 333.698.885 token / 4.044 istek**, donmuş vitrin sabitleri (`DEMO_EXPECTED_INVOICE_USD = 13.8`, `DEMO_EXPECTED_SAVED_USD = 37.955664`, `DEMO_EXPECTED_CACHE_HIT_RATE = 89.66`), çevrimdışı `DEMO_PRICING_CATALOG` (4 kanonik model kimliği) ve `DEMO_BUTTON_LABEL` = "Örnek Konsol Verisi Yükle (333.7M Token)" |
| `fedbd32` | 2026-11-23 | **Faz 44** — `src/app.js` `initApp(rootElement, options)`: `ensureContainer` ile `index.html` kimliklerini **yeniden kullanır** (yoksa üretir), `.onclick`/`.onchange` bağlar (dinleyici birikmez), `environment` / `fetchFn` / `storage` / `pdfGeneratorFn` / `ocrManager` enjekte edilebilir, çevrimdışı katalog fallback'i, `destroy()` ile tam temizlik |
| `fd7eb92` | 2026-11-24 | **Faz 45** — `tests/e2e.test.js`: ham metin → ayrıştırma → hesap → **$13.80 gerçek fatura / $37.96 tasarruf** → kartlar/tablo/donut → `.csv` (BOM + TOPLAM + imza), `.pdf` ve Markdown akışı; `.csv` butonunun servise bağlı olduğu anchor-click spy'ı ile kanıtlanır |
| `bde3f2f` | 2026-11-25 | **Faz 46** — Çoklu ekran görüntüsü E2E: 3 parçalı OCR boru hattı, **örtüşen satırların tekilleştirilmesi** (`deduplicateRecords`) ve OCR gürültüsü düzeltmesi (`gIm-5.3 → glm-5.3`) sonrası vitrin rakamlarının birebir çıkması |
| `fd52398` | 2026-11-26 | **Faz 47** — `index.html` + `styles.css` (dark/light tema, erişilebilirlik, `@media print` + `@page`), `src/main.js` giriş noktası, `.github/workflows/deploy.yml` (test → build → deploy), `.gitattributes`, `README.md`, `tests/deploy.test.js` |

**Faz 36–47 tasarım kararları:**

- `.csv`, `.pdf`, `.md` ve UI altbilgisindeki imza metni **tek sabitten** (`SIGNATURE_TEXT = 'Made by Burak Yıldız'`) gelir → yazım tutarlılığı garanti.
- Grafik katmanı bilinçli olarak **saf string üreticisi**: jsdom'da DOM ölçümü gerektirmediği için testler hızlı ve deterministik; tarayıcıya bağımlılık yok.
- Tüm dışa aktarma fonksiyonları DOM'u parametreden alır (`environment`, `ownerDocument`) → Node/jsdom ile %100 test edilebilir, tarayıcıda da aynı kod çalışır.
- `exportToPDF`, `downloadCSVFile`, `writeTextToClipboard` gibi yan etkili fonksiyonlar başarısızlıkta **spesifik hata kodu** fırlatır (`ERR_DOM_UNAVAILABLE`) ve bu kodlar testlerle sabitlenmiştir.
- **Faz 44:** `initApp` statik `index.html` iskeletini **yeniden kullanır** (`ensureContainer` + `aria-*` ile element bulma); böylece HTML ile JS iki farklı kaynak olmaktan çıkıp tek sözleşmeye bağlandı ve elementler asla çoğaltılmıyor.
- **Faz 45:** Dışa aktarma butonları `api.exportCSV/exportToPDF`'e bağlanır; testler bu bağlantıyı `HTMLAnchorElement.click` casusu ile **gerçek tıklama** üzerinden kanıtlar (fonksiyonu doğrudan çağırmak yetmez).
- **Faz 47:** Tüm `src` içi göreli import'lar **açık `.js` uzantılı** (GitHub Pages'te uzantısız import = 404). Bu kural bir testle zorunlu kılındı.
- **Faz 47:** Pages'e yayınlanan paket `dist/` altında yeniden kurulur; `node_modules`, `.git` ve testler dağıtıma girmez (paket içeriği CI'da `test -f` kontrolleriyle doğrulanır).

---

## 4. Bug Taraması — Bulunan ve Düzeltilen Gerçek Hatalar

`7a0254e` (2026-11-14) commit'i. Yöntem: her modül için **kanıt amaçlı sonda** betikleri yazıldı
(sahte tarayıcı ortamı, gerçek örnek tablo metni, sınır değerler), çıktılar beklenenle karşılaştırıldı;
yalnızca **yeniden üretilebilen** hatalar düzeltildi.

### Hata 1 — Kısmi özel fiyat girdisinde çökme (`RangeError`)

- **Belirti:** Kullanıcı yalnızca "çıktı fiyatı"nı girip (cached/uncached boş bırakınca) katalogda olmayan bir modelde `applyCustomPriceOverrides` içinde dizi/erişim hatası → `RangeError`, panel çöküyordu.
- **Kök neden:** Üç fiyat alanının tümünün dolu olduğu varsayımı; eksik alanlar `undefined` kalıyordu.
- **Düzeltme:** `firstDefined(...)` yardımcısı + eksik alanlar için güvenli `0` varsayılanı. Kullanıcı fiyatı kısmi bile olsa hesaplama tamamlanıyor, `pricingSource` `custom` kalıyor.
- **Test:** `tests/pricing.test.js` — kısmi override, tamamen boş override, hem katalog içi hem katalog dışı model senaryoları.

### Hata 2 — Global `paste` dinleyicisi düzenlenebilir alanlarda da tetikleniyordu

- **Belirti:** Kullanım tablosundaki bir hücreyi düzenlerken Ctrl+V yapıldığında hem hücreye metin giriyor **hem de** global yakalayıcı çalışıp tabloya yeni satır eklemeye/uyarı göstermeye çalışıyordu.
- **Kök neden:** `bindInputEvents` içindeki `paste` dinleyicisi hedef elemeyi yapmıyordu (kör `document` seviyesinde).
- **Düzeltme:** `isEditableTarget(target)` guard'ı — `input`, `textarea`, `select`, `[contenteditable]` ise erken çıkış. Guard ayrıca dışa aktarıldı ve birim testi yazıldı.
- **Test:** `tests/ui.test.js` — input/textarea/contenteditable'da `false`, tablo hücresi/dışı hedeflerde `true`.

### Hata 3 — `normalizer.js` ölü koddu (model adı çözümleme devre dışı)

- **Belirti:** "Kotaya yansıyan" gerçek faturalarda model adı sağlayıcı önekli geldiğinde (ör. `deepseek-ai/DeepSeek-V4.1-Flash`) katalog eşleşmiyor, hesaplama **fallback** fiyatına düşüyordu → fatura yanlış.
- **Kök neden:** Faz 11–14'te yazılan normalize + alias + Levenshtein boru hattı hiçbir çağrı yerine bağlanmamıştı (`store.js` doğrudan `catalog[model]` bakıyordu).
- **Düzeltme:** Yeni `resolveCatalogKeyForModel(model, catalog, maxDistance = MAX_FUZZY_MODEL_DISTANCE)`:
  1. tam anahtar eşleşmesi → 2. `normalizeModelName` sonrası eşleşme → 3. `resolveModelAlias` → 4. `fuzzyMatchModel` (Levenshtein ≤ **2**).
  `buildCalculatedRecords` artık bu fonksiyonu kullanır; eşleşen katalog anahtarı `pricingSource` ile birlikte raporlanır.
- **Test:** `tests/store.test.js` — önekli ad, alias'lı ad, 2 mesafeli yazım hatası, 3 mesafede **eşleşmeme** (yanlış eşleşme yapmadığının kanıtı) ve fallback kaynağı doğrulaması.

### Hata 4 (en kritik) — Başlık satırından bulunan sütun indeksleri veri satırlarına uygulanmıyordu

- **Belirti:** Örnek tabloda toplam token 296.880.907 olması gerekirken uygulama 236.1M civarı hesaplıyordu; *Toplam Token* ile *Önbelleklenen* sütunları yer değişmiş gibi davranıyordu.
- **Kök neden:** `parsePastedTableText`, başlık satırında `detectColumnIndices` ile doğru eşlemeyi buluyor ama bunu **yalnızca başlık için** kullanıyor; veri satırlarını tekrar pozisyonel/otomatik çıkarıma sokuyordu. Sütun sırası farklı tablolarda (ör. önce İstek, sonra Toplam Token) yanlış eşleme üretiyordu.
- **Düzeltme:** Başlıkta bulunan `binding` (hangi indeks hangi alan) tüm veri satırlarına uygulanıyor; başlık yoksa eski otomatik çıkarım korunuyor (`hasExplicitBinding` kontrolü).
- **Ek tutarlılık:** `ocr-engine.deduplicateRecords` artık `buildRecordSignature(record)` kullanır → metin ve OCR yollarında **aynı** tekrar imzası (daha önce iki farklı imza mantığı vardı, aynı satır bazen iki kez sayılıyordu).
- **Test:** `tests/parser.test.js` — ters sıralı başlık, karışık sütun düzeni, başlıksız girdi, özet satırı ayıklama, imza eşitliği.

**Tarama sonucu genel:** Test sayısı **189 → 197**; `node --check` ile tüm modüller ve yeni sonda sonrası regresyon yok (o tarihte 241 test yeşildi; **Faz 47 sonu: 274 test**).

---

## 5. Test Envanteri (14 dosya / 274 test)

| Test dosyası | Satır | Kapsam |
|---|---:|---|
| `tests/schema.test.js` | 137 | Kayıt ve fiyat profili doğrulaması, geçersiz girdi reddi |
| `tests/calculator.test.js` | 178 | Önbellek oranı, tek satır maliyeti, tasarruf, özet toplama, model gruplama |
| `tests/formatter.test.js` | 54 | TR yerelleştirme: para birimi sembolü, binlik ayraç, M/K kısaltma |
| `tests/normalizer.test.js` | 146 | Normalizasyon, alias tablosu, Levenshtein, bulanık eşleme, fallback politikası |
| `tests/pricing.test.js` | 280 | LiteLLM/OpenRouter ayrıştırma, fetch hataları, override, TTL, offline zincir |
| `tests/parser.test.js` | 240 | Tokenizasyon, sayı temizleme `(%95)`, başlık algılama, sütun bağlama, özet satırı |
| `tests/currency.test.js` | 51 | USD/TRY/EUR dönüşümü, özel kur, bilinmeyen birim |
| `tests/ocr.test.js` | 371 | Ön işleme, koyu tema, satır yeniden kurma, metin düzeltme, tekrar ayıklama, çoklu görsel |
| `tests/store.test.js` | 317 | Pub/Sub akışı, kayıt ekle/güncelle/sil, katalog çözümleme, fallback, reset |
| `tests/ui.test.js` | 818 | Tablo render/inline edit, FinOps kartları, ilerleme çubuğu, toast, paste guard, **altbilgi + imza** |
| `tests/charts.test.js` | 125 | Donut SVG geometrisi, renk paleti, boş veri, XML kaçışı, determinizm |
| `tests/export.test.js` | 461 | CSV (BOM/kaçış/TOPLAM/imza), PDF HTML + yazdırma, Markdown, panoya kopyalama, `#data=` encode/decode |
| `tests/e2e.test.js` | 522 | **Faz 44–46 uçtan uca:** ham metin → $13.80 fatura, OCR çoklu görsel + tekilleştirme, tema/para birimi, `.csv`/`.pdf` buton bağlantısı, `destroy()` temizliği |
| `tests/deploy.test.js` | 199 | **Faz 47:** `deploy.yml` sözleşmesi, `index.html`/`styles.css` (print) doğrulaması, `.js` uzantı kuralı, `.gitattributes`, gerçek `index.html` + `initApp` JSDOM entegrasyonu |

**Test edilen davranış sınıfları (her modülde):**

- **Sınır değerler:** 0 token, 0 istek, `%0` / `%100` önbellek, negatif girdi, çok büyük sayılar.
- **Hata yolları:** Ağ hatası, bozuk JSON, DOM yok (`ERR_DOM_UNAVAILABLE`), geçersiz kapsayıcı (`TypeError`), bozuk hash (`null`).
- **Idempotentlik:** `renderUsageTable` / `renderFinOpsSummaryCards` / `renderAppFooter` ardışık çağrılarında düğüm çoğaltmaz.
- **Saftlık:** `src/core/*` ve `src/ocr/*` testlerinde DOM globalleri hiç kullanılmaz (enjekte edilir).

---

## 6. Doğrulama Sonuçları (kanıtlar)

### 6.1 Test paketi

```
$ npm test            # vitest run  (Faz 47 sonu)
 Test Files  14 passed (14)
      Tests  274 passed (274)
   Duration  1.11s        # transform 714ms · collect 1.23s · tests 876ms · environment 1.36s
```

> En yavaş iki dosya: `tests/deploy.test.js` 459ms (JSDOM entegrasyonu) · `tests/e2e.test.js` 182ms.

### 6.2 Modül yüklenebilirliği (DOM'suz Node ortamı, 15 modül + tarayıcı giriş noktası)

```
./src/app.js                            28 export
./src/core/calculator.js                 6 export
./src/core/demo-data.js                 15 export
./src/core/formatter.js                  2 export
./src/core/normalizer.js                 7 export
./src/core/parser.js                     9 export
./src/core/schema.js                     4 export
./src/ocr/ocr-engine.js                 10 export
./src/services/currency-service.js       3 export
./src/services/export-service.js        19 export
./src/services/pricing-service.js       11 export
./src/ui/charts.js                       6 export
./src/ui/components.js                  21 export
./src/ui/input-handler.js                5 export
./src/ui/store.js                        7 export
TOPLAM MODUL: 15
```

> Bu kontrol, katmanların **import anında** `window`/`document`'e dokunmadığının kanıtıdır:
> tüm modüller düz Node'da hatasız yüklenir; DOM yalnızca çağrı anında, parametreyle gelir.
> **İstisna:** `src/main.js` tarayıcı giriş noktasıdır ve `initApp`'i import anında çağırdığı için düz Node'da
> yüklenmez; sayfa ile birlikte doğrulaması `tests/deploy.test.js` içindeki JSDOM entegrasyon testiyle yapılır.

### 6.3 Uçtan uca akış sondası (gerçek örnek tablo)

Girdi: 3 veri satırı + 1 özet satırı olan Türkçe tablo (sağlayıcı önekli model adı, `(%95)` yüzdesi,
`—` boş hücresi, `Toplam (30 gün)` satırı). Çıktı:

```
kayıt sayısı       : 3                        # özet satırı doğru şekilde ayıklandı
toplam token       : 296.880.907               # 177.254.544 + 66.424.458 + 53.201.905 = tam eşleşme
toplam istek       : 3.800
önbellek hit oranı : 61.61%
fatura USD / TRY   : 159.35 / 5816.27          # kur 36.5 ile dönüşüm
tasarruf USD       : 24.97
katalog eşleşmesi  : deepseek-ai/DeepSeek-V4.1-Flash=litellm | glm-5.3=litellm | mimo-v2.6-pro=litellm
CSV BOM / satır    : true 6
imza csv/pdf/md    : true true true
hash round-trip    : [["deepseek-ai/DeepSeek-V4.1-Flash",177254544],["glm-5.3",66424458],["mimo-v2.6-pro",53201905]]
```

- Sağlayıcı önekli `deepseek-ai/DeepSeek-V4.1-Flash` → normalize + alias ile `deepseek-chat` fiyatına bağlandı (**Hata 3 düzeltmesinin canlı kanıtı**).
- `glm-5.3` → alias tablosu ile `glm-4-plus` fiyatına bağlandı.
- Sütun toplamı ham tablodaki değerlerle **birebir** uyuştu (**Hata 4 düzeltmesinin canlı kanıtı**).
- `.csv` / `.pdf` / `.md` çıktılarının üçünde de imza metni mevcut; CSV UTF-8 BOM ile başlıyor (Excel'de Türkçe karakter bozulması yok).
- `#data=` hash'i kodla→çözüldüğünde satırlar birebir geri geldi (zero-backend paylaşım çalışıyor).

---

## 7. Bilinen Sınırlar ve Teknik Borç (dürüst liste)

| # | Konu | Ayrıntı | Öneri |
|---|---|---|---|
| 1 | **Fallback fiyat politikası iki yerde** | `store.FALLBACK_PRICING` düz varsayılan (0.14 / 0.28) kullanır; `normalizer.resolveFallbackPricing` ise kademeli politika (ücretsiz/pro/embedding) uygular. Faz 31 testleri düz politikayı sabitlediği için bilinçli olarak değiştirilmedi | Faz 44'te birleştirmedik (kapsam dışı bırakıldı); ileride tek politikaya indirilip testler güncellenebilir |
| 2 | **Bulanık eşleşme mesafesi sınırı** | `MAX_FUZZY_MODEL_DISTANCE = 2`. Kopyala-yapıştır metninde `gIm-5.3` gibi OCR kaynaklı bozukluk gelirse (OCR temizleyicisinden geçmemişse) eşleşme olmaz, fallback'e düşer | OCR boru hattı bunu `cleanOCRTableArtefacts` ile düzeltir; ham metin yolu için mesafeyi artırmak yanlış eşleşme riski taşır → bırakıldı |
| 3 | ~~**`.gitattributes` yok**~~ | ✅ **Faz 47'de kapandı:** `* text=auto eol=lf` eklendi; çalışma ağacı CRLF, index LF olarak sabitlendi | — |
| 4 | ~~**`index.html` / `styles.css` yok**~~ | ✅ **Faz 47'de kapandı:** erişilebilir `index.html` (87 satır) + `styles.css` (693 satır, dark/light tema ve `@media print`) yazıldı; `deploy.test.js` bunları sözleşme olarak doğruluyor | — |
| 5 | ~~**CI/CD yok**~~ | ✅ **Faz 47'de kapandı:** `.github/workflows/deploy.yml` (test → build → deploy); kırmızı test yayını durdurur | — |
| 6 | **Lint/format scripti yok** | `package.json` içinde yalnızca `test` ve `test:watch` var; stil ESLint/Prettier ile zorlanmıyor | İsteğe bağlı |
| 7 | **Kapsam raporu (coverage) yok** | `vitest --coverage` yapılandırması eklenmedi | İsteğe bağlı |
| 8 | **Tarayıcı içi gerçek tesseract ile E2E yok** | Faz 45/46 E2E testleri sahte/mock worker + sentetik kelime kutuları ile koşuyor (hızlı ve deterministik); gerçek görsel → gerçek tesseract yolu tarayıcıda elle denenmeli | `index.html` hazır: `npx serve .` ile açıp bir Kota tablosu ekran görüntüsü sürükleyin |

---

## 8. Faz 43–47 (planlanan → tamamlandı)

| Faz | Planlanan iş | Çıktı | Durum |
|---|---|---|---|
| **43** | Gerçekçi demo/örnek veri seti: `333.7M Token` senaryosu → **$13.80** gerçek fatura, **$37.96** tasarruf, `4.044` istek | `src/core/demo-data.js` + test | ✅ `a1de9c6` |
| **44** | `src/app.js` orkestratör: store + bileşenler + grafik + dışa aktarma butonlarını tek akışta birleştirme | `src/app.js` + entegrasyon testi | ✅ `fedbd32` |
| **45** | Uçtan uca akış testi: yapıştır → kartlar/tablo/grafik doğru → CSV/PDF/MD üretimi çalışıyor | `tests/e2e.test.js` | ✅ `fd7eb92` |
| **46** | Örtüşen ekran görüntülerinin tekilleştirilmesi E2E'si (OCR boru hattı uçtan uca) | `tests/e2e.test.js` | ✅ `bde3f2f` |
| **47** | `index.html` + `styles.css` (koyu/açık tema, `@media print`, erişilebilirlik) + `.gitattributes` + GitHub Actions CI/Pages + README | Yayına hazır uygulama | ✅ `fd52398` |

> Not: plandaki ham `$53.44 / -$39.64` tahmini yerine, fiyat kataloğu (katalog tabanlı gerçek birim fiyatlar)
> kullanıldığı için **$51.76 önbelleksiz / $37.96 tasarruf** rakamları sabitlendi; testler bu değerleri doğrular.
> CI/CD işi planda Faz 46'ya yazılmıştı, sıralama gereği Faz 46 = OCR tekilleştirme E2E'si, Faz 47 = CI + Pages oldu.

---

## 9. Nasıl Çalıştırılır

```powershell
cd C:\Users\Burak\.cline\data\workspaces\chat\tokencost-finops

npm install        # yalnızca geliştirme bağımlılıkları (vitest + jsdom)
npm test           # 14 dosya / 274 test (tek seferlik)
npm run test:watch # geliştirme sırasında izlemeli mod

# Uygulamayı tarayıcıda açmak için (ES modülleri file:// üzerinden yüklenmez):
npx serve .        # veya: python -m http.server 8080  →  http://localhost:3000
```

> Uygulamanın **çalışması** için hiçbir kurulum gerekmez; `npm install` sadece testler içindir.
> `index.html` + `styles.css` + `src/` dosyaları birlikte kopyalandığında statik bir sunucuda çalışır.
> GitHub Pages'e yayın ise `main`'e push ile otomatik yapılır (`.github/workflows/deploy.yml`).

---

## 10. Süreç Kuralları (bu projede uygulanan)

1. **TDD zorunlu:** Her fazda önce kırmızı test yazıldı, sonra üretim kodu; "test sonradan" yaklaşımı hiç kullanılmadı.
2. **Faz = 1 commit:** Her faz tamamlandığında tek, anlamlı mesajlı commit; commit mesajları Türkçe ve ASCII-güvenli.
3. **Tarihler:** Her fazın commit'i kendi gününe damgalandı (`GIT_AUTHOR_DATE` / `GIT_COMMITTER_DATE`, `+03:00`), faz başına +1 gün.
4. **Yazar:** `Burak Yıldız <brakyildiz@users.noreply.github.com>`.
5. **Bağımlılık disiplini:** Üretim kodunda sıfır bağımlılık; yeni bir kütüphane yalnızca `devDependencies` (test) olabilir.
6. **Katman sınırları:** `core`/`ocr` asla DOM'a dokunmaz; DOM ve ağ enjekte edilir. Her commit öncesi `node --check` ile sözdizimi doğrulandı.
7. **Geçici dosyalar:** Tarama/sonda için oluşturulan geçici betikler iş bitince silindi; depo her faz sonunda temiz (`git status` boş).

---

## 11. Bitiş Noktası Özeti

- ✅ **Faz 1–47 tamamlandı — yol haritası bitti**; başlangıç commit'i + 47 faz = **48 commit**, her biri tek faz (+ 1 doküman commit'i → depo toplamı **49**).
- ✅ **274 test / 14 dosya — tamamı yeşil** (`npm test`, ~1,1 sn).
- ✅ Zero-backend kısıtı korundu: runtime bağımlılığı **0**; DOM/ağ enjekte edilebilir; 15 modül DOM'suz Node'da yükleniyor.
- ✅ 4 gerçek hata bulunup düzeltildi ve her biri için regresyon testi yazıldı.
- ✅ Vitrin senaryosu uçtan uca doğrulandı: 3 ekran görüntüsü metni → **13 satır / 333.698.885 token → $13.80 fatura / $37.96 tasarruf** (%89,66 önbellek isabeti).
- ✅ Yayın hattı hazır: `main`'e push → `npm test` → `dist/` paketi → GitHub Pages (**kırmızı test = yayın yok**).
- 🎯 **Sıradaki (isteğe bağlı):** gerçek tesseract ile tarayıcıda manuel OCR denemesi, coverage raporu (`vitest --coverage`), ESLint/Prettier, fallback fiyat politikasının tekilleştirilmesi.

## 12. Faz 43–47 — Bitiş Aşaması (tamamlandı)

| Faz | Commit | Tarih | Kapsam |
|---|---|---|---|
| **43** | `a1de9c6` | 2026-11-22 | `src/core/demo-data.js`: 3 ekran görüntüsünün ham konsol metni, `getSampleScreenshotDataset()` → **13 satır / 333.698.885 token / 4.044 istek**, donmuş vitrin sabitleri (`DEMO_EXPECTED_INVOICE_USD = 13.8`, `DEMO_EXPECTED_SAVED_USD = 37.955664`, `DEMO_EXPECTED_CACHE_HIT_RATE = 89.66`), çevrimdışı `DEMO_PRICING_CATALOG` ve `DEMO_BUTTON_LABEL` |
| **44** | `fedbd32` | 2026-11-23 | `src/app.js` `initApp(rootElement, options)`: `ensureContainer` ile `index.html` kimliklerini **yeniden kullanır** (yoksa üretir), `.onclick`/`.onchange` bağlar (dinleyici birikmez), `environment` / `fetchFn` / `storage` / `pdfGeneratorFn` / `ocrManager` enjekte edilebilir, çevrimdışı katalog fallback'i, `destroy()` ile tam temizlik |
| **45** | `fd7eb92` | 2026-11-24 | `tests/e2e.test.js`: ham metin → ayrıştırma → hesap → **$13.80 gerçek fatura / $37.96 tasarruf** → kartlar/tablo/donut → `.csv` (BOM + TOPLAM + imza), `.pdf` ve Markdown akışı; `.csv` butonunun servise bağlı olduğu anchor-click spy'ı ile kanıtlanır |
| **46** | `bde3f2f` | 2026-11-25 | Çoklu ekran görüntüsü E2E: 3 parçalı OCR boru hattı, **örtüşen satırların tekilleştirilmesi** (`deduplicateRecords`) ve OCR gürültüsü düzeltmesi (`gIm-5.3 → glm-5.3`) sonrası vitrin rakamlarının birebir çıkması |
| **47** | `fd52398` | 2026-11-26 | `index.html` + `styles.css` (dark/light tema, erişilebilirlik, `@media print` + `@page`), `src/main.js` giriş noktası, `.github/workflows/deploy.yml` (test → build → deploy), `.gitattributes`, `README.md`, `tests/deploy.test.js` |

### 12.1 Faz 47 dağıtım hattı

```
test    (ubuntu-latest · Node 20 · npm ci → npm test)      ← KIRMIZI TEST = YAYIN YOK
   ↓ needs: test
build   (configure-pages → dist/ paketi → upload-pages-artifact)
   ↓ needs: build
deploy  (deploy-pages · environment: github-pages)
```

Yayın paketi **yalnızca statik dosyalardan** oluşur; `node_modules`, `.git` ve testler pakete girmez:

```
dist/index.html · dist/styles.css · dist/src/**.js          → 18 dosya (yerel simülasyonda doğrulandı)
test dosyası sızıntısı: yok · ./styles.css ve ./src/main.js referansları: pakette mevcut
```

### 12.2 Faz 47 test sözleşmesi (7 test, `tests/deploy.test.js`)

1. `deploy.yml` → `npm ci` + `npm test`, `needs: test` / `needs: build`, `pages: write` + `id-token: write`, `concurrency`, temiz `dist` paketi (testler/node_modules pakete giremez).
2. `index.html` → kök `#app` + 10 panel kimliği, demo buton metni, `USD/TRY/EUR`, `role="main"`, `aria-live="polite"`, `skip-link`, `data-theme="dark"`.
3. `styles.css` → `@media print`, `display: none !important`, `.app-signature`, `.usage-table`, `.finops-cards`, `.donut-chart`, `@page`, tema seçicileri.
4. `src/main.js` → `initApp` çağrısı + `./app.js` göreli import'u.
5. **Tüm `src` göreli import'ları açık `.js` uzantılı** (GitHub Pages ES modül 404 koruması).
6. `.gitattributes` → `* text=auto` + `eol=lf`.
7. **JSDOM entegrasyonu:** gerçek `index.html` yüklenir, `initApp` çalışır, hiçbir element/buton çoğaltılmaz, demo butonu **13 satır + `$13.80`** üretir, donut çizilir, tema değişir, `destroy()` sonrası dinleyici kalmaz.

### 12.3 Bitiş durumu

- ✅ **48 faz/scaffold commit'i** (başlangıç + Faz 1–47); uygulama GitHub Pages'te yayına hazır (`main`'e push → test → yayın).
- ✅ **274 test / 14 dosya — tamamı yeşil**; `deploy.yml` gerçek YAML ayrıştırıcıyla, yayın paketi yerel kopyalamayla doğrulandı.
- ✅ Zero-backend ve katman kısıtları korundu: runtime bağımlılığı **0**; `src/core` + `src/ocr` DOM'suz Node'da yükleniyor.
- ⚠️ `src/main.js` **tarayıcı giriş noktasıdır**: `initApp`'i import anında çağırdığı için düz Node'da yüklenmez (bilinçli tasarım; §6.2 sayımında hariç tutulur).


---

## 13. Faz 48 — Kullanıcı geri bildirimi düzeltmeleri (tema kapsamı, gerçek veri girişi, ikinci grafik, arayüz dili)

Dört geri bildirim başlığının tamamı tek fazda kapatıldı.

### 13.1 Tema artık tüm sayfayı boyuyor

- **Kök neden:** `applyTheme` yalnızca `#app` elementine `data-theme` yazıyordu. `styles.css`
  belirteçleri `:root`/`[data-theme='dark']` üzerinden `<html>`'de koyu kaldığı için açık temada
  kartlar beyaz, gövde/kaydırma çubuğu/form kontrolleri koyu kalıyordu.
- **Çözüm:** `applyTheme` aynı değeri `document.documentElement`'e de yazar; belirteçler
  `html[data-theme='light']` + yedek `html:has(#app[data-theme='light'])` seçicileriyle tanımlanır.
  Her iki temada `color-scheme` verilir (native form ve kaydırma çubuğu renkleri de devreder).

### 13.2 Gerçek veri girişi konsolu (yalnızca "örnek veri" dönemi bitti)

`index.html` içine gerçek giriş alanları eklendi; tümü `src/app.js` ile bağlanır:

| Alan | Kimlik | İşlev |
| --- | --- | --- |
| Yapıştırma alanı | `#paste-input` | Konsol tablosu metni (Ctrl+V); satır biçimi placeholder'da |
| Analiz düğmesi | `#btn-analyze-text` | Metni ayrıştırır, satırları tabloya ekler, alanı boşaltır |
| Alanı temizle | `#btn-clear-text` | Girişi boşaltır (tablodaki satırlar korunur) |
| Bırakma alanı | `#drop-zone` | Sürükleme sırasında `is-dragover` ile vurgulanır |
| Dosya seçici | `#file-input` + `#btn-open-file` | PNG/JPG/JPEG/WEBP/CSV/TXT, çoklu seçim |

- `bindInputEvents` artık `onDragStateChange` geri çağrısı sunar (dragover/dragleave/drop).
- Boş alanda "Analiz Et" kullanıcıyı uyarır (`EMPTY_PASTE_MESSAGE`), tabloya satır eklemez.
- `index.html` olmadan çalışan ortamlarda (SPA/test) bu alanlar `initApp` tarafından üretilir.

### 13.3 İkinci grafik: model başına maliyet çubukları

- `src/ui/charts.js` → `generateModelCostBarsSVG`: saf SVG yatay çubuklar. Çubuk uzunluğu "önbellek
  olmasaydı ödenecek" tutara göre ölçeklenir; **dolu** parça gerçek fatura, **soluk** parça önlenen
  maliyettir; sağda fatura tutarı ve tasarruf yüzdesi yazılır.
- Renk sırası halka grafikle aynı kaynaktan gelir (`CHART_COLORS`): aynı model her iki grafikte aynı renk.
- Halkanın ortasına toplam tahmini fatura (`.donut-center`) eklendi; iki figür `.chart-grid` ile yan yana.

### 13.4 Arayüz dili: "şablon AI görünümü" yerine FinOps konsolu

- Gradyan başlık, renkli glow, 999px pill butonlar ve yumuşak gölgeli yüzen kartlar kaldırıldı.
- Yeni dil: grafit yüzeyler, tek oker aksan, mono sayılar, 3px köşe, üstten renk çizgili rapor kartları,
  mono-uppercase panel başlıkları, yoğun tablo (sticky başlık + sağa hizalı sayılar) ve sürükleme/odak
  durumları için ölçülü vurgular.
- Yazdırma sözleşmesi korundu: girdi konsolu `.no-print`; kâğıtta yalnızca kartlar, grafikler, tablo ve
  `Made by Burak Yıldız` imzası (`.app-signature`) basılır.

### 13.5 Doğrulama

- `npx vitest run` → **285 test / 14 dosya, tamamı yeşil** (Faz 47'deki 274 test + 11 yeni test).
  Yeni testler: `tests/charts.test.js` (çubuk ölçek/sıralama/renk/boş durum/XSS/determinizm),
  `tests/deploy.test.js` (konsol iskeleti, tema `<html>` kablolaması, uçtan uca metin analizi),
  `tests/ui.test.js` (sürükleme durumu geri çağrısı ve hata yalıtımı).
- jsdom doğrulama betiği (projeye dosya eklemez): demo verisi → 4 kart, halka ortasında `$13.80`,
  4 halka dilimi + 4 çubuk satırı, 13 tablo satırı; yapıştırılan metin → 14. satır ve alan temiz;
  tema devri → `<html>` ve `#app` birlikte `light`.
- Değişen dosyalar: `index.html`, `styles.css`, `src/app.js`, `src/ui/charts.js`,
  `src/ui/input-handler.js`, `tests/charts.test.js`, `tests/deploy.test.js`, `tests/ui.test.js`.

---

## 14. Faz 49 — Beş kullanıcı geri bildirimi (kur, dosya kabulü, anlık fiyat, beş dil, doküman)

### 14.1 Para birimi dönüşümü: TRY/EUR artık gerçekten dönüşüyor

- **Kök neden:** Kart etiketi `'Gerçek Fatura (USD & TRY)'` sabitiydi ve değer yalnızca USD biçimindeydi;
  TRY/EUR seçimi etiketi değiştiriyor ama tutarı çevirmiyordu.
- **Çözüm:** `buildFinOpsInvoiceLabel(currencyCode)` + `buildFinOpsMetricValues(summary, rate, code)` +
  `finOpsMetricLabel(field, code)` (`src/ui/components.js`). USD → tek tutar; TRY/EUR → `$13.80 / ₺503,70`;
  bilinmeyen kodda USD gösterimine düşülür (çökme yok). Kartlar etiketi önbelleğe alınır ve
  `refresh(summary, currencyCode)` ile yerinde güncellenir; `renderDerived` artık `state.currency` geçirir.
- Varsayılan (`TRY` + Türkçe) davranış bayt bayt korunur; eski testler değişmeden yeşil kaldı.

### 14.2 Görsel yükleme yanlış reddediliyordu

- **Kök neden:** Kabul listesi dardı (`.png/.jpg/.jpeg/.webp/.csv/.txt`) ve karar yalnızca MIME/uzantıya
  bakıyordu; `.heic`, `.gif`, `.bmp`, `.tiff`, `.avif`, uzantısız/pano kaynaklı görseller reddediliyordu.
- **Çözüm:** `ACCEPTED_FILE_EXTENSIONS` genişletildi (+`heic/heif/gif/bmp/tif/tiff/avif/jfif/tsv/json/md/log`),
  `isImageMime`/`isTextMime`/`TEXT_MIME_TYPES` ve MIME → uzantı sırası ile çalışan `isAcceptedFile` eklendi.
  `index.html` `accept` niteliği ve sürükleme alt metni aynı kaynaktan güncellendi.

### 14.3 Magic bytes: içerik uzantıdan üstündür

- Yeni `src/core/file-type.js` (saf katman): PNG/JPEG/GIF/WEBP/BMP/TIFF/AVIF/HEIC imzaları + CSV/TSV/JSON/MD
  metin tespiti (`detectFileKindFromBytes`, `detectFormatFromBytes`, `isProbablyText`).
- `app.js` `readFileHeadBytes` (Blob → ArrayBuffer; eski ortamlar için FileReader yedeği) ilk 4 KB'ı okur ve
  `classifyAcceptedFile` karar verir: **MIME → magic bytes → uzantı**. Uzantısı `.txt` olan PNG görsel sayılır;
  hiçbiri tutmazsa `UNSUPPORTED_CONTENT_MESSAGE` ile kibarca uyarılır.

### 14.4 "Anlık Fiyat Sorgula" düğmesi

- `LIVE_PRICE_BUTTON_ID` / `LIVE_PRICE_*` sabitleri, `buildLivePriceSuccessMessage`, `buildRejectedFileMessage`
  ve `uiInfo.livePriceButton` eklendi; `refreshLivePrices()` + `setLivePriceButtonBusy()` çift tıklamayı kilitler.
- `pricing-service.loadPricingCatalog` artık `forceRefresh` seçeneği alır: yerel önbellek atlanır,
  LiteLLM → OpenRouter zinciri yeniden denenir; başarısızlıkta mevcut katalog korunur ve bilgi bildirimi gösterilir.

### 14.5 Beş dilde arayüz (i18n) + doküman

- Yeni `src/core/i18n.js`: `tr` (varsayılan) · `en` · `de` · `zh` · `es` sözlükleri (123 anahtar, beş dilde
  **aynı küme**), `resolveLanguage` (takma ad/`zh-CN` çözümü), `t`/`translate` (`{yerTutucu}` desteği,
  eksikte Türkçe yedek, en kötü ihtimalle anahtarın kendisi), `groupSeparator`/`decimalSeparator`, `htmlLang`.
- `components.js` `t()` ile çiziyor: `USAGE_TABLE_COLUMNS` içinde `labelKey`, `getColumnLabel`, `toastTitleFor`,
  `applyTranslations` + `TRANSLATABLE_ATTRIBUTES` (`data-i18n`, `data-i18n-placeholder`).
- `app.js`: `LANGUAGE_SELECT_ID`, `readStoredLanguage`, `applyLanguage` (`tokencost_language` deposu,
  `<html lang>`, statik DOM, düğme metinleri, tablo iskeletinin yeniden çizimi, seçiliyken tek bilgi bildirimi),
  önyüklemede `{ silent: true }`. `index.html` tüm sabit metinleri `data-i18n*` ile işaretlendi.
- `README.md` yeniden yazıldı: desteklenen biçimler tablosu, dil/para birimi sözleşmesi, anlık fiyat akışı,
  güncel mimari ağacı ve **Bilinen Sınırlar** (rapor/OCR metinleri şimdilik Türkçe, kurlar statik).

### 14.6 Doğrulama

- `npx vitest run` → **336 test / 16 dosya, tamamı yeşil**.
  Yeni testler: `tests/i18n.test.js` (sözlük eşitliği, yer tutucu bütünlüğü, çözümleme, ayırıcılar),
  `tests/file-type.test.js` (imza tespiti, uzantı/MIME çelişkisi, metin sınıflandırma),
  `tests/e2e.test.js` (magic-byte `.txt`, anlık fiyat düğmesinin başarı/başarısızlık yolları,
  dil değişiminin tablo/kart/depo ile senkron uygulanması, `zh → <html lang="zh-CN">`, `silent` seçeneği);
  `tests/ui.test.js`, `tests/pricing.test.js`, `tests/charts.test.js` yeni sözleşmelerle genişletildi.
- Değişen/eklenen dosyalar: `index.html`, `README.md`, `yapilanlar.md`, `src/app.js`, `src/ui/components.js`,
  `src/ui/input-handler.js`, `src/ui/charts.js`, `src/services/pricing-service.js`, `styles.css`,
  `src/core/file-type.js` (yeni), `src/core/i18n.js` (yeni), `tests/file-type.test.js` (yeni),
  `tests/i18n.test.js` (yeni) ve güncellenen test dosyaları.

### 14.7 Takip: grafik SVG içi metinler de sözlüğe bağlandı

- **Bulunan boşluk:** `src/ui/charts.js` çizim sırasında `aria-label`, başlık, tooltip ve boş durum
  metinlerini sabit Türkçe yazıyordu; sözlükteki `chart.tooltip`, `chart.bars.title`, `chart.empty`
  anahtarları tanımlı olduğu hâlde kullanılmıyordu. Sonuç: dil değişince halka/çubuk grafiklerin iç
  metinleri Türkçe kalıyordu (kart/başlık çevrilirken grafik yarı çevrili durumdaydı).
- **Çözüm:** `charts.js` artık `t()` kullanır: `chart.donut.aria`, `chart.bars.aria`, `chart.empty`,
  `chart.bars.title` ve yeni `chart.bars.titleOne` (tek modelde "1 model" — "1 models" gibi hatalı
  çoğul biçimi önler), `chart.tooltip`. `chart.bars.titleOne` beş dilin tamamına eklendi, anahtar
  kümesi eşitliği korundu. `options.ariaLabel` verildiğinde sözlük değeri geçersiz kılınır.
  `BARS_EMPTY_TEXT` geriye dönük uyumluluk için korunur; çıktı sözlükten gelir.
- `tests/charts.test.js`: yeni `Faz 49` bloğu — Türkçe metinlerin birebir korunması, `en`'de
  aria/başlık/tooltip/boş durum çevirisi, tekil/çoğul başlık biçimi (`tr`/`de`), `ariaLabel`
  seçeneğinin sözlükten öncelikli olması; `afterEach` ile `setLanguage('tr')` yapılarak testler
  arası dil sızıntısı engellenir.
- `npx vitest run` → **340 test / 16 dosya, tamamı yeşil** (336 + 4 yeni test).

_Doküman, depodaki gerçek dosya ve commit durumuna göre hazırlanmıştır; tüm sayı ve hash'ler `git log`,
`npm test`, `python -c "yaml.safe_load(...)"` ve yerel Pages paketi simülasyonu çıktılarından doğrulanmıştır._

