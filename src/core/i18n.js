// src/core/i18n.js
// Faz 49: Çok dilli arayüz (i18n) çekirdeği — Türkçe, İngilizce, Almanca, Çince, İspanyolca.
// KURAL: Saf (pure) katman. DOM/window/localStorage erişimi YOKTUR; yalnızca veri + saf fonksiyon.
// Sözleşme: VARSAYILAN DİL TÜRKÇE'dir. Böylece dil seçilmeden önceki tüm davranış (ve testler)
// bayt bayt aynı kalır; diğer diller yalnızca açıkça seçildiğinde devreye girer.

/** Varsayılan dil kodu (dil seçilmezse arayüz Türkçedir). */
export const DEFAULT_LANGUAGE = 'tr';

/** Desteklenen dil kodları (sırayla: menüde de bu sırada gösterilir). */
export const LANGUAGES = Object.freeze(['tr', 'en', 'de', 'zh', 'es']);

/** Dil kodlarının kendi dilindeki adları (dil menüsü bunları gösterir). */
export const LANGUAGE_LABELS = Object.freeze({
  tr: 'Türkçe',
  en: 'English',
  de: 'Deutsch',
  zh: '中文',
  es: 'Español',
});

/** Bayat kullanım için takma adlar (?lang=english gibi girdiler normalleştirilir). */
export const LANGUAGE_ALIASES = Object.freeze({
  tr: 'tr', tur: 'tr', tr_tr: 'tr', turkish: 'tr', türkçe: 'tr', turkce: 'tr',
  en: 'en', eng: 'en', en_us: 'en', en_gb: 'en', english: 'en',
  de: 'de', deu: 'de', ger: 'de', de_de: 'de', german: 'de', deutsch: 'de',
  zh: 'zh', zho: 'zh', chi: 'zh', zh_cn: 'zh', 'zh-cn': 'zh', chinese: 'zh',
  es: 'es', spa: 'es', es_es: 'es', spanish: 'es', español: 'es', espanol: 'es',
});

/** Binlik ayırıcı (Türkçe/Almanca/İspanyolca nokta, İngilizce/Çince virgül). */
export const GROUP_SEPARATORS = Object.freeze({
  tr: '.',
  en: ',',
  de: '.',
  zh: ',',
  es: '.',
});

/** Ondalık ayırıcı (Türkçe/Almanca/İspanyolca virgül, İngilizce/Çince nokta). */
export const DECIMAL_SEPARATORS = Object.freeze({
  tr: ',',
  en: '.',
  de: ',',
  zh: '.',
  es: ',',
});

/**
 * Türkçe sözlük. Yeni bir anahtar eklenirse beş dilde de karşılığı yazılmalıdır;
 * eksik anahtar motor tarafından Türkçe karşılığına düşürülür (asla ham anahtar gösterilmez).
 */
const tr = {
  'app.docTitle': 'TokenCost FinOps Analyzer — LLM Kota ve Önbellek ROI Hesaplayıcı',
  'app.skipLink': 'İçeriğe geç',
  'app.eyebrow': 'FinOps · LLM Token & Önbellek ROI',
  'app.titleStrong': 'TokenCost',
  'app.titleSuffix': 'FinOps Analyzer',
  'app.tagline': 'Konsol tablonu yapıştır, ekran görüntüsünü bırak ya da CSV yükle: model bazlı fatura, önbellek tasarrufu ve kota baskısı aynı raporda. Sunucu yok, kurulum yok; tüm hesaplama tarayıcıda.',
  'chip.privacy': 'Veri cihazdan çıkmaz',
  'chip.pricing.cache': 'Fiyat kataloğu · önbellek',
  'chip.pricing.litellm': 'Fiyat kataloğu · LiteLLM',
  'chip.pricing.openrouter': 'Fiyat kataloğu · OpenRouter',
  'chip.pricing.fallback': 'Fiyat kataloğu · çevrimdışı',
  'chip.pricing.custom': 'Fiyat kataloğu · özel',
  'chip.pricing.unavailable': 'Fiyat kataloğu yükleniyor',
  'section.input.title': 'Veri Girişi',
  'section.input.hint': 'Metin, görsel (OCR) veya CSV/TXT — üçü de aynı tabloya eklenir',
  'input.paste.label': 'Konsol / tablo metni (Ctrl+V ile yapıştır)',
  'input.paste.placeholder': 'deepseek-v4.1-flash    1.204   98.220.000   88.310.000   9.910.000\nglm-5.3                   806   71.480.000   64.120.000   7.360.000\nmimo-v2.6-pro             612   54.310.000   48.900.000   5.410.000',
  'input.paste.note': 'Satır biçimi: model · istek · toplam token · önbelleklenen · faturalı',
  'btn.analyze': 'Analiz Et',
  'btn.clear': 'Alanı Temizle',
  'input.file.label': 'Dosya yükle',
  'drop.title': 'Dosyayı buraya bırak',
  'drop.sub': 'PNG · JPG · JPEG · WEBP · GIF · BMP · TIFF · AVIF · HEIC · CSV · TSV · TXT · JSON · MD',
  'drop.hint': 'Sürükle-bırak, Ctrl+V veya "Dosya Seç"',
  'btn.chooseFile': 'Dosya Seç…',
  'input.file.note': 'Görseller OCR ile okunur (tesseract.js, çevrimiçi gerekir); CSV/TXT doğrudan ayrıştırılır. Uzantısı silinmiş/yanlış olsa bile dosyanın ilk baytları okunup tanınır.',
  'btn.loadDemo': 'Örnek Konsol Verisi Yükle (333.7M Token)',
  'label.currency': 'Para birimi',
  'label.language': 'Dil',
  'theme.switchToLight': 'Açık Tema',
  'theme.switchToDark': 'Koyu Tema',
  'price.query.label': 'Model adı',
  'price.query.placeholder': 'deepseek-v4.1-flash',
  'price.query.hint': 'Canlı katalogdan model birim fiyatı (1M token)',
  'btn.livePricing': 'Anlık Fiyat Sorgula',
  'section.cards.title': 'FinOps Özeti',
  'section.cards.hint': 'Önbelleksiz maliyet · gerçek fatura · tasarruf · kota baskısı',
  'section.chart.title': 'Model Bazlı Maliyet Dağılımı',
  'section.chart.hint': 'Halka: toplam faturadaki pay · Çubuk: dolu = gerçek fatura, soluk = önlenen maliyet',
  'section.table.title': 'Kullanım & Kota Tablosu',
  'section.table.hint': 'Hücreye tıkla → satır içi düzenle (Enter veya dışına tıkla: kaydeder)',
  'table.addRow': '+ Satır Ekle',
  'table.summaryLabel': 'Toplam Tahmini Tutar: ',
  'table.removeRow': 'Satırı sil',
  'table.col.date': 'Tarih',
  'table.col.model': 'Model',
  'table.col.requests': 'İstek',
  'table.col.totalTokens': 'Toplam Token',
  'table.col.cachedTokens': 'Önbelleklenen',
  'table.col.billedTokens': 'Faturalı',
  'table.col.cachePct': 'Önbellek %',
  'table.col.cost': 'Tahmini Tutar',
  'table.col.actions': 'İşlem',
  'card.withoutCache': 'Normalde Ödenecek (Önbelleksiz)',
  'card.cacheSavings': 'Önbellek Tasarrufu',
  'card.invoice': 'Gerçek Fatura ({cur})',
  'card.quota': 'Kotaya Yansıyan İstek & Token',
  'card.pair': '{primary} / {secondary}',
  'card.savingsProfit': '-{amount} (Kâr)',
  'card.savingsBadge': '%{pct} Hit',
  'card.quotaValue': '{requests} İstek | {tokens} Net Token',
  'chart.donut.aria': 'Model bazlı maliyet dağılımı',
  'chart.donut.center': 'Tahmini fatura',
  'chart.donut.caption': 'Önbellek payı modele göre',
  'chart.bars.aria': 'Model başına maliyet karşılaştırması',
  'chart.bars.caption': 'Gerçek fatura / önlenen maliyet ({cur})',
  'chart.bars.title': '{aria} ({count} model, {cur})',
  'chart.bars.titleOne': '{aria} (1 model, {cur})',
  'chart.empty': 'Gösterilecek maliyet verisi yok',
  'chart.tooltip': '{model}: fatura {invoice} {cur} · önbelleksiz {withoutCache} {cur} · tasarruf {savings}',
  'toast.info': 'Bilgi',
  'toast.success': 'Başarılı',
  'toast.warning': 'Uyarı',
  'toast.error': 'Hata',
  'msg.unitRows': '{count} satır',
  'msg.rowsAdded': '{count} tabloya eklendi',
  'msg.demoLoaded': 'Örnek konsol verisi yüklendi (13 satır, 333.7M token)',
  'msg.rejectedFile': 'Desteklenmeyen dosya biçimi: {name}',
  'msg.rejectedSupported': 'Desteklenen biçimler: {supported}',
  'msg.recognizedFile': '{name} içeriği {format} olarak tanındı',
  'msg.ocrUnavailable': 'OCR motoru bulunamadı; ekran görüntüsü yerine tablo metnini yapıştırın',
  'msg.ocrLabel': 'Görsel {index}/{total}',
  'msg.ocrPreprocess': '{label} ön işleniyor...',
  'msg.ocrReading': '{label} okunuyor...',
  'msg.ocrDone': '{label} tamamlandı ({count} satır).',
  'msg.ocrUnreadable': '{label} okunamadı: {error}',
  'msg.ocrProcessed': '{count} görselden okundu',
  'msg.ocrFailed': 'Görsel işlenemedi',
  'msg.offlinePricing': 'Fiyat servisine ulaşılamadı; çevrimdışı örnek fiyat kataloğu kullanıldı',
  'msg.fallbackPricing': 'Bazı modeller için tahmini fiyat kullanıldı, tablodan birim fiyatı düzenleyebilirsiniz',
  'msg.emptyExport': 'Dışa aktarılacak veri yok; önce tabloya satır yükleyin',
  'msg.emptyText': 'Yapıştırılan metinde kullanım tablosu satırı bulunamadı',
  'msg.clearedPaste': 'Giriş alanı temizlendi (tablodaki satırlar korunur)',
  'msg.emptyPaste': 'Önce tablo metnini yapıştırın; ardından "Analiz Et" düğmesine basın',
  'msg.csvExported': '.CSV raporu indirildi (Made by Burak Yıldız imzalı)',
  'msg.pdfExported': '.PDF raporu hazırlandı (Made by Burak Yıldız imzalı)',
  'msg.livePricingRunning': 'Canlı fiyatlar sorgulanıyor...',
  'msg.livePricingUpdated': '{count} model fiyatı güncellendi · kaynak: {source} · {time}',
  'msg.livePricingOffline': 'Canlı fiyat kaynağına ulaşılamadı; mevcut katalog korundu',
  'msg.languageChanged': 'Dil değiştirildi: {language}',
  'msg.priceQueryMissing': 'Fiyat sorgulamak için model adı yazın',
  'msg.priceQueryUnknown': '{model} fiyat kataloğunda bulunamadı',
  'msg.priceQueryResult': '{model}: giriş {input} / çıkış {output} (1M token) · önbellek {cached}',
  'btn.exportCsv': '.CSV İndir',
  'btn.exportPdf': '.PDF İndir',
  'report.title': 'TokenCost FinOps Raporu',
  'report.h1': 'TokenCost FinOps Analiz Raporu',
  'report.subtitle': 'Önbellek ROI analizi ve kota maliyeti özeti',
  'report.modelsTitle': 'Model Bazlı Kullanım ve Maliyet',
  'report.rowsTitle': 'Satır Detayları',
  'report.col.cachePct': 'Önbellek %',
  'report.col.netTokens': 'Net Token',
  'report.col.costUsd': 'Tahmini Tutar (USD)',
  'report.col.savingsUsd': 'Önbellek Tasarrufu (USD)',
  'report.invoiceUsd': 'Gerçek Fatura (USD)',
  'report.invoicePair': 'Gerçek Fatura (USD & {cur})',
  'report.csv.savings': 'Önbellek Tasarrufu (USD)',
  'report.csv.cost': 'Tahmini Tutar (USD)',
  'report.csv.billed': 'Kotaya Yansıyan',
  'report.md.title': '## TokenCost FinOps Analiz Raporu',
  'report.md.savingsLabel': '**Önbellek Tasarrufu:**',
  'report.md.hitRate': 'Önbellek isabet oranı: %{pct}',
  'report.md.withoutCache': '**Normalde Ödenecek (Önbelleksiz):** {amount}',
  'report.md.cachePct': 'Önbellek (%)',
};

/** İngilizce sözlük. */
const en = {
  'app.docTitle': 'TokenCost FinOps Analyzer — LLM Quota & Prompt Cache ROI Calculator',
  'app.skipLink': 'Skip to content',
  'app.eyebrow': 'FinOps · LLM Tokens & Prompt Cache ROI',
  'app.titleStrong': 'TokenCost',
  'app.titleSuffix': 'FinOps Analyzer',
  'app.tagline': 'Paste your console table, drop a screenshot or load a CSV: per-model invoice, cache savings and quota pressure in one report. No server, no setup; everything runs in your browser.',
  'chip.privacy': 'Data never leaves your device',
  'chip.pricing.cache': 'Price catalog · cache',
  'chip.pricing.litellm': 'Price catalog · LiteLLM',
  'chip.pricing.openrouter': 'Price catalog · OpenRouter',
  'chip.pricing.fallback': 'Price catalog · offline',
  'chip.pricing.custom': 'Price catalog · custom',
  'chip.pricing.unavailable': 'Price catalog loading',
  'section.input.title': 'Data input',
  'section.input.hint': 'Text, image (OCR) or CSV/TXT — all three feed the same table',
  'input.paste.label': 'Console / table text (paste with Ctrl+V)',
  'input.paste.note': 'Row format: model · requests · total tokens · cached · billed',
  'btn.analyze': 'Analyze',
  'btn.clear': 'Clear field',
  'input.file.label': 'Upload file',
  'drop.title': 'Drop the file here',
  'drop.sub': 'PNG · JPG · JPEG · WEBP · GIF · BMP · TIFF · AVIF · HEIC · CSV · TSV · TXT · JSON · MD',
  'drop.hint': 'Drag & drop, Ctrl+V or "Choose file"',
  'btn.chooseFile': 'Choose file…',
  'input.file.note': 'Images are read with OCR (tesseract.js, online required); CSV/TXT is parsed directly. Even with a missing or wrong extension the first bytes of the file are sniffed and recognized.',
  'btn.loadDemo': 'Load sample console data (333.7M tokens)',
  'label.currency': 'Currency',
  'label.language': 'Language',
  'theme.switchToLight': 'Light theme',
  'theme.switchToDark': 'Dark theme',
  'price.query.label': 'Model name',
  'price.query.placeholder': 'deepseek-v4.1-flash',
  'price.query.hint': 'Unit price from the live catalog (per 1M tokens)',
  'btn.livePricing': 'Query live price',
  'section.cards.title': 'FinOps summary',
  'section.cards.hint': 'Cost without cache · real invoice · savings · quota pressure',
  'section.chart.title': 'Cost breakdown by model',
  'section.chart.hint': 'Donut: share of the total invoice · Bars: solid = real invoice, faded = avoided cost',
  'section.table.title': 'Usage & quota table',
  'section.table.hint': 'Click a cell → inline edit (Enter or click away saves)',
  'table.addRow': '+ Add row',
  'table.summaryLabel': 'Total estimated cost: ',
  'table.removeRow': 'Delete row',
  'table.col.date': 'Date',
  'table.col.model': 'Model',
  'table.col.requests': 'Requests',
  'table.col.totalTokens': 'Total tokens',
  'table.col.cachedTokens': 'Cached',
  'table.col.billedTokens': 'Billed',
  'table.col.cachePct': 'Cache %',
  'table.col.cost': 'Estimated cost',
  'table.col.actions': 'Action',
  'card.withoutCache': 'Payable without cache',
  'card.cacheSavings': 'Cache savings',
  'card.invoice': 'Real invoice ({cur})',
  'card.quota': 'Quota billed requests & tokens',
  'card.pair': '{primary} / {secondary}',
  'card.savingsProfit': '-{amount} (profit)',
  'card.savingsBadge': '{pct}% hit',
  'card.quotaValue': '{requests} requests | {tokens} net tokens',
  'input.paste.placeholder': 'deepseek-v4.1-flash    1.204   98.220.000   88.310.000   9.910.000\nglm-5.3                   806   71.480.000   64.120.000   7.360.000\nmimo-v2.6-pro             612   54.310.000   48.900.000   5.410.000',
  'chart.donut.aria': 'Cost breakdown by model',
  'chart.donut.center': 'Estimated invoice',
  'chart.donut.caption': 'Cache share per model',
  'chart.bars.aria': 'Cost comparison per model',
  'chart.bars.caption': 'Real invoice / avoided cost ({cur})',
  'chart.bars.title': '{aria} ({count} models, {cur})',
  'chart.bars.titleOne': '{aria} (1 model, {cur})',
  'chart.empty': 'No cost data to display',
  'chart.tooltip': '{model}: invoice {invoice} {cur} · without cache {withoutCache} {cur} · savings {savings}',
  'toast.info': 'Info',
  'toast.success': 'Success',
  'toast.warning': 'Warning',
  'toast.error': 'Error',
  'msg.unitRows': '{count} rows',
  'msg.rowsAdded': '{count} added to the table',
  'msg.demoLoaded': 'Sample console data loaded (13 rows, 333.7M tokens)',
  'msg.rejectedFile': 'Unsupported file format: {name}',
  'msg.rejectedSupported': 'Supported formats: {supported}',
  'msg.recognizedFile': '{name} recognized as {format}',
  'msg.ocrUnavailable': 'OCR engine not found; paste the table text instead of a screenshot',
  'msg.ocrLabel': 'Image {index}/{total}',
  'msg.ocrPreprocess': '{label} preprocessing...',
  'msg.ocrReading': '{label} reading...',
  'msg.ocrDone': '{label} finished ({count} rows).',
  'msg.ocrUnreadable': '{label} failed: {error}',
  'msg.ocrProcessed': '{count} read from images',
  'msg.ocrFailed': 'Image could not be processed',
  'msg.offlinePricing': 'Pricing service unreachable; offline sample catalog used',
  'msg.fallbackPricing': 'Estimated prices were used for some models; edit unit prices in the table if needed',
  'msg.emptyExport': 'Nothing to export; load rows into the table first',
  'msg.emptyText': 'No usage table row found in the pasted text',
  'msg.clearedPaste': 'Input field cleared (rows in the table are kept)',
  'msg.emptyPaste': 'Paste the table text first, then press "Analyze"',
  'msg.csvExported': '.CSV report downloaded (signed by Burak Yıldız)',
  'msg.pdfExported': '.PDF report prepared (signed by Burak Yıldız)',
  'msg.livePricingRunning': 'Querying live prices...',
  'msg.livePricingUpdated': '{count} model prices updated · source: {source} · {time}',
  'msg.livePricingOffline': 'Live price source unreachable; current catalog kept',
  'msg.languageChanged': 'Language changed: {language}',
  'msg.priceQueryMissing': 'Enter a model name to query its price',
  'msg.priceQueryUnknown': '{model} not found in the price catalog',
  'msg.priceQueryResult': '{model}: input {input} / output {output} (1M tokens) · cached {cached}',
  'btn.exportCsv': '.CSV download',
  'btn.exportPdf': '.PDF download',
  'report.title': 'TokenCost FinOps Report',
  'report.h1': 'TokenCost FinOps Analysis Report',
  'report.subtitle': 'Prompt cache ROI and quota cost summary',
  'report.modelsTitle': 'Usage and cost by model',
  'report.rowsTitle': 'Row details',
  'report.col.cachePct': 'Cache %',
  'report.col.netTokens': 'Net tokens',
  'report.col.costUsd': 'Estimated cost (USD)',
  'report.col.savingsUsd': 'Cache savings (USD)',
  'report.md.cachePct': 'Cache (%)',
  'report.invoiceUsd': 'Real invoice (USD)',
  'report.invoicePair': 'Real invoice (USD & {cur})',
  'report.csv.savings': 'Cache savings (USD)',
  'report.csv.cost': 'Estimated cost (USD)',
  'report.csv.billed': 'Quota billed',
  'report.md.title': '## TokenCost FinOps Analysis Report',
  'report.md.savingsLabel': '**Cache savings:**',
  'report.md.hitRate': 'Cache hit rate: %{pct}',
  'report.md.withoutCache': '**Payable without cache:** {amount}',
};
/** Almanca sözlük. */
const de = {
  'app.docTitle': 'TokenCost FinOps Analyzer — LLM-Kontingent & Prompt-Cache-ROI-Rechner',
  'app.skipLink': 'Zum Inhalt springen',
  'app.eyebrow': 'FinOps · LLM-Tokens & Prompt-Cache-ROI',
  'app.titleStrong': 'TokenCost',
  'app.titleSuffix': 'FinOps Analyzer',
  'app.tagline': 'Konsolentabelle einfügen, Screenshot ablegen oder CSV laden: Rechnung pro Modell, Cache-Ersparnis und Kontingentdruck in einem Bericht. Kein Server, keine Installation; alles läuft im Browser.',
  'chip.privacy': 'Daten verlassen das Gerät nicht',
  'chip.pricing.cache': 'Preiskatalog · Cache',
  'chip.pricing.litellm': 'Preiskatalog · LiteLLM',
  'chip.pricing.openrouter': 'Preiskatalog · OpenRouter',
  'chip.pricing.fallback': 'Preiskatalog · offline',
  'chip.pricing.custom': 'Preiskatalog · individuell',
  'chip.pricing.unavailable': 'Preiskatalog wird geladen',
  'section.input.title': 'Dateneingabe',
  'section.input.hint': 'Text, Bild (OCR) oder CSV/TXT — alle drei füllen dieselbe Tabelle',
  'input.paste.label': 'Konsolen-/Tabellentext (mit Strg+V einfügen)',
  'input.paste.placeholder': 'deepseek-v4.1-flash    1.204   98.220.000   88.310.000   9.910.000\nglm-5.3                   806   71.480.000   64.120.000   7.360.000\nmimo-v2.6-pro             612   54.310.000   48.900.000   5.410.000',
  'input.paste.note': 'Zeilenformat: Modell · Anfragen · Gesamt-Tokens · gecacht · berechnet',
  'btn.analyze': 'Analysieren',
  'btn.clear': 'Feld leeren',
  'input.file.label': 'Datei hochladen',
  'drop.title': 'Datei hier ablegen',
  'drop.sub': 'PNG · JPG · JPEG · WEBP · GIF · BMP · TIFF · AVIF · HEIC · CSV · TSV · TXT · JSON · MD',
  'drop.hint': 'Drag & Drop, Strg+V oder "Datei wählen"',
  'btn.chooseFile': 'Datei wählen…',
  'input.file.note': 'Bilder werden per OCR gelesen (tesseract.js, online erforderlich); CSV/TXT wird direkt geparst. Auch ohne korrekte Dateiendung werden die ersten Bytes geprüft und erkannt.',
  'btn.loadDemo': 'Beispiel-Konsolendaten laden (333,7 Mio. Tokens)',
  'label.currency': 'Währung',
  'label.language': 'Sprache',
  'theme.switchToLight': 'Helles Design',
  'theme.switchToDark': 'Dunkles Design',
  'price.query.label': 'Modellname',
  'price.query.placeholder': 'deepseek-v4.1-flash',
  'price.query.hint': 'Stückpreis aus dem Live-Katalog (pro 1 Mio. Tokens)',
  'btn.livePricing': 'Live-Preis abfragen',
  'section.cards.title': 'FinOps-Übersicht',
  'section.cards.hint': 'Kosten ohne Cache · echte Rechnung · Ersparnis · Kontingentdruck',
  'section.chart.title': 'Kostenverteilung nach Modell',
  'section.chart.hint': 'Ring: Anteil an der Gesamtrechnung · Balken: voll = echte Rechnung, blass = vermiedene Kosten',
  'section.table.title': 'Nutzungs- & Kontingenttabelle',
  'section.table.hint': 'Zelle anklicken → direkt bearbeiten (Enter oder Klick daneben speichert)',
  'table.addRow': '+ Zeile hinzufügen',
  'table.summaryLabel': 'Geschätzte Gesamtkosten: ',
  'table.removeRow': 'Zeile löschen',
  'table.col.date': 'Datum',
  'table.col.model': 'Modell',
  'table.col.requests': 'Anfragen',
  'table.col.totalTokens': 'Gesamt-Tokens',
  'table.col.cachedTokens': 'Gecacht',
  'table.col.billedTokens': 'Berechnet',
  'table.col.cachePct': 'Cache %',
  'table.col.cost': 'Geschätzte Kosten',
  'table.col.actions': 'Aktion',
  'card.withoutCache': 'Fällig ohne Cache',
  'card.cacheSavings': 'Cache-Ersparnis',
  'card.invoice': 'Echte Rechnung ({cur})',
  'card.quota': 'Kontingent: Anfragen & Tokens',
  'card.pair': '{primary} / {secondary}',
  'card.savingsProfit': '-{amount} (Gewinn)',
  'card.savingsBadge': '{pct}% Treffer',
  'card.quotaValue': '{requests} Anfragen | {tokens} Netto-Tokens',
  'chart.donut.aria': 'Kostenverteilung nach Modell',
  'chart.donut.center': 'Geschätzte Rechnung',
  'chart.donut.caption': 'Cache-Anteil je Modell',
  'chart.bars.aria': 'Kostenvergleich je Modell',
  'chart.bars.caption': 'Echte Rechnung / vermiedene Kosten ({cur})',
  'chart.bars.title': '{aria} ({count} Modelle, {cur})',
  'chart.bars.titleOne': '{aria} (1 Modell, {cur})',
  'chart.empty': 'Keine Kostendaten zum Anzeigen',
  'chart.tooltip': '{model}: Rechnung {invoice} {cur} · ohne Cache {withoutCache} {cur} · Ersparnis {savings}',
  'toast.info': 'Info',
  'toast.success': 'Erfolg',
  'toast.warning': 'Warnung',
  'toast.error': 'Fehler',
  'msg.unitRows': '{count} Zeilen',
  'msg.rowsAdded': '{count} zur Tabelle hinzugefügt',
  'msg.demoLoaded': 'Beispiel-Konsolendaten geladen (13 Zeilen, 333,7 Mio. Tokens)',
  'msg.rejectedFile': 'Nicht unterstütztes Dateiformat: {name}',
  'msg.rejectedSupported': 'Unterstützte Formate: {supported}',
  'msg.recognizedFile': '{name} als {format} erkannt',
  'msg.ocrUnavailable': 'OCR-Engine nicht gefunden; Tabellentext statt Screenshot einfügen',
  'msg.ocrLabel': 'Bild {index}/{total}',
  'msg.ocrPreprocess': '{label} wird vorbereitet...',
  'msg.ocrReading': '{label} wird gelesen...',
  'msg.ocrDone': '{label} fertig ({count} Zeilen).',
  'msg.ocrUnreadable': '{label} fehlgeschlagen: {error}',
  'msg.ocrProcessed': '{count} aus Bildern gelesen',
  'msg.ocrFailed': 'Bild konnte nicht verarbeitet werden',
  'msg.offlinePricing': 'Preisdienst nicht erreichbar; Offline-Beispielkatalog verwendet',
  'msg.fallbackPricing': 'Für einige Modelle wurden geschätzte Preise verwendet; Stückpreise in der Tabelle anpassbar',
  'msg.emptyExport': 'Nichts zu exportieren; zuerst Zeilen in die Tabelle laden',
  'msg.emptyText': 'Im eingefügten Text wurde keine Nutzungszeile gefunden',
  'msg.clearedPaste': 'Eingabefeld geleert (Tabellenzeilen bleiben erhalten)',
  'msg.emptyPaste': 'Zuerst den Tabellentext einfügen, dann "Analysieren" drücken',
  'msg.csvExported': '.CSV-Bericht heruntergeladen (signiert von Burak Yıldız)',
  'msg.pdfExported': '.PDF-Bericht erstellt (signiert von Burak Yıldız)',
  'msg.livePricingRunning': 'Live-Preise werden abgefragt...',
  'msg.livePricingUpdated': '{count} Modellpreise aktualisiert · Quelle: {source} · {time}',
  'msg.livePricingOffline': 'Live-Preisquelle nicht erreichbar; aktueller Katalog beibehalten',
  'msg.languageChanged': 'Sprache geändert: {language}',
  'msg.priceQueryMissing': 'Modellnamen eingeben, um den Preis abzufragen',
  'msg.priceQueryUnknown': '{model} im Preiskatalog nicht gefunden',
  'msg.priceQueryResult': '{model}: Eingabe {input} / Ausgabe {output} (1 Mio. Tokens) · gecacht {cached}',
  'btn.exportCsv': '.CSV herunterladen',
  'btn.exportPdf': '.PDF herunterladen',
  'report.title': 'TokenCost FinOps Bericht',
  'report.h1': 'TokenCost FinOps Analysebericht',
  'report.subtitle': 'Prompt-Cache-ROI und Kontingentkosten',
  'report.modelsTitle': 'Nutzung und Kosten je Modell',
  'report.rowsTitle': 'Zeilendetails',
  'report.col.cachePct': 'Cache %',
  'report.col.netTokens': 'Netto-Tokens',
  'report.col.costUsd': 'Geschätzte Kosten (USD)',
  'report.col.savingsUsd': 'Cache-Ersparnis (USD)',
  'report.md.cachePct': 'Cache (%)',
  'report.invoiceUsd': 'Echte Rechnung (USD)',
  'report.invoicePair': 'Echte Rechnung (USD & {cur})',
  'report.csv.savings': 'Cache-Ersparnis (USD)',
  'report.csv.cost': 'Geschätzte Kosten (USD)',
  'report.csv.billed': 'Kontingent berechnet',
  'report.md.title': '## TokenCost FinOps Analysebericht',
  'report.md.savingsLabel': '**Cache-Ersparnis:**',
  'report.md.hitRate': 'Cache-Trefferrate: %{pct}',
  'report.md.withoutCache': '**Fällig ohne Cache:** {amount}',
};
/** Çince (Basitleştirilmiş) sözlük. */
const zh = {
  'app.docTitle': 'TokenCost FinOps Analyzer — LLM 配额与提示缓存 ROI 计算器',
  'app.skipLink': '跳到内容',
  'app.eyebrow': 'FinOps · LLM Token 与提示缓存 ROI',
  'app.titleStrong': 'TokenCost',
  'app.titleSuffix': 'FinOps Analyzer',
  'app.tagline': '粘贴控制台表格、拖入截图或加载 CSV：按模型统计账单、缓存节省与配额压力一表看懂。无服务器、无需安装，全部在浏览器中计算。',
  'chip.privacy': '数据不离开本机',
  'chip.pricing.cache': '价格目录 · 缓存',
  'chip.pricing.litellm': '价格目录 · LiteLLM',
  'chip.pricing.openrouter': '价格目录 · OpenRouter',
  'chip.pricing.fallback': '价格目录 · 离线',
  'chip.pricing.custom': '价格目录 · 自定义',
  'chip.pricing.unavailable': '价格目录加载中',
  'section.input.title': '数据输入',
  'section.input.hint': '文本、图片 (OCR) 或 CSV/TXT —— 都会写入同一张表',
  'input.paste.label': '控制台／表格文本（用 Ctrl+V 粘贴）',
  'input.paste.placeholder': 'deepseek-v4.1-flash    1.204   98.220.000   88.310.000   9.910.000\nglm-5.3                   806   71.480.000   64.120.000   7.360.000\nmimo-v2.6-pro             612   54.310.000   48.900.000   5.410.000',
  'input.paste.note': '行格式：模型 · 请求 · 总 Token · 已缓存 · 计费',
  'btn.analyze': '分析',
  'btn.clear': '清空输入框',
  'input.file.label': '上传文件',
  'drop.title': '把文件拖到这里',
  'drop.sub': 'PNG · JPG · JPEG · WEBP · GIF · BMP · TIFF · AVIF · HEIC · CSV · TSV · TXT · JSON · MD',
  'drop.hint': '拖放、Ctrl+V 或“选择文件”',
  'btn.chooseFile': '选择文件…',
  'input.file.note': '图片通过 OCR 识别（tesseract.js，需要联网）；CSV/TXT 直接解析。即使扩展名缺失或错误，也会读取文件头字节进行识别。',
  'btn.loadDemo': '加载示例控制台数据（3.337 亿 Token）',
  'label.currency': '货币',
  'label.language': '语言',
  'theme.switchToLight': '浅色主题',
  'theme.switchToDark': '深色主题',
  'price.query.label': '模型名称',
  'price.query.placeholder': 'deepseek-v4.1-flash',
  'price.query.hint': '从实时目录获取单价（每 100 万 Token）',
  'btn.livePricing': '查询实时价格',
  'section.cards.title': 'FinOps 概览',
  'section.cards.hint': '无缓存成本 · 实际账单 · 节省 · 配额压力',
  'section.chart.title': '按模型的成本分布',
  'section.chart.hint': '圆环：占总账单比例 · 条形：实色 = 实际账单，浅色 = 已避免成本',
  'section.table.title': '使用与配额表',
  'section.table.hint': '点击单元格 → 就地编辑（回车或点击外部即保存）',
  'table.addRow': '+ 添加行',
  'table.summaryLabel': '预计总费用：',
  'table.removeRow': '删除行',
  'table.col.date': '日期',
  'table.col.model': '模型',
  'table.col.requests': '请求',
  'table.col.totalTokens': '总 Token',
  'table.col.cachedTokens': '已缓存',
  'table.col.billedTokens': '计费',
  'table.col.cachePct': '缓存 %',
  'table.col.cost': '预计费用',
  'table.col.actions': '操作',
  'card.withoutCache': '无缓存应付',
  'card.cacheSavings': '缓存节省',
  'card.invoice': '实际账单（{cur}）',
  'card.quota': '计入配额的请求与 Token',
  'card.pair': '{primary} / {secondary}',
  'card.savingsProfit': '-{amount}（收益）',
  'card.savingsBadge': '命中 {pct}%',
  'card.quotaValue': '{requests} 请求 | {tokens} 净 Token',
  'chart.donut.aria': '按模型的成本分布',
  'chart.donut.center': '预计账单',
  'chart.donut.caption': '各模型缓存占比',
  'chart.bars.aria': '各模型成本对比',
  'chart.bars.caption': '实际账单／已避免成本（{cur}）',
  'chart.bars.title': '{aria}（{count} 个模型，{cur}）',
  'chart.bars.titleOne': '{aria}（1 个模型，{cur}）',
  'chart.empty': '暂无可显示的成本数据',
  'chart.tooltip': '{model}：账单 {invoice} {cur} · 无缓存 {withoutCache} {cur} · 节省 {savings}',
  'toast.info': '信息',
  'toast.success': '成功',
  'toast.warning': '警告',
  'toast.error': '错误',
  'msg.unitRows': '{count} 行',
  'msg.rowsAdded': '已向表格添加 {count} 行',
  'msg.demoLoaded': '示例控制台数据已加载（13 行，3.337 亿 Token）',
  'msg.rejectedFile': '不支持的文件格式：{name}',
  'msg.rejectedSupported': '支持的格式：{supported}',
  'msg.recognizedFile': '{name} 被识别为 {format}',
  'msg.ocrUnavailable': '未找到 OCR 引擎；请粘贴表格文本而不是截图',
  'msg.ocrLabel': '图片 {index}/{total}',
  'msg.ocrPreprocess': '{label} 预处理中...',
  'msg.ocrReading': '{label} 识别中...',
  'msg.ocrDone': '{label} 完成（{count} 行）。',
  'msg.ocrUnreadable': '{label} 失败：{error}',
  'msg.ocrProcessed': '已从 {count} 张图片读取',
  'msg.ocrFailed': '图片处理失败',
  'msg.offlinePricing': '无法访问价格服务；已使用离线示例目录',
  'msg.fallbackPricing': '部分模型使用了估算价格，可在表格中编辑单价',
  'msg.emptyExport': '没有可导出的数据；请先向表格加载行',
  'msg.emptyText': '粘贴的文本中未找到使用表格行',
  'msg.clearedPaste': '输入框已清空（表格中的行保留）',
  'msg.emptyPaste': '请先粘贴表格文本，然后点击“分析”',
  'msg.csvExported': '.CSV 报告已下载（由 Burak Yıldız 签名）',
  'msg.pdfExported': '.PDF 报告已生成（由 Burak Yıldız 签名）',
  'msg.livePricingRunning': '正在查询实时价格...',
  'msg.livePricingUpdated': '已更新 {count} 个模型价格 · 来源：{source} · {time}',
  'msg.livePricingOffline': '无法访问实时价格源；保留当前目录',
  'msg.languageChanged': '语言已切换：{language}',
  'msg.priceQueryMissing': '请输入模型名称以查询价格',
  'msg.priceQueryUnknown': '价格目录中未找到 {model}',
  'msg.priceQueryResult': '{model}：输入 {input} / 输出 {output}（100 万 Token）· 缓存 {cached}',
  'btn.exportCsv': '.CSV 下载',
  'btn.exportPdf': '.PDF 下载',
  'report.title': 'TokenCost FinOps 报告',
  'report.h1': 'TokenCost FinOps 分析报告',
  'report.subtitle': '提示缓存 ROI 与配额成本摘要',
  'report.modelsTitle': '按模型的使用与成本',
  'report.rowsTitle': '行详情',
  'report.col.cachePct': '缓存 %',
  'report.col.netTokens': '净 Token',
  'report.col.costUsd': '预计费用（USD）',
  'report.col.savingsUsd': '缓存节省（USD）',
  'report.md.cachePct': '缓存 (%)',
  'report.invoiceUsd': '实际账单（USD）',
  'report.invoicePair': '实际账单（USD 与 {cur}）',
  'report.csv.savings': '缓存节省（USD）',
  'report.csv.cost': '预计费用（USD）',
  'report.csv.billed': '计入配额',
  'report.md.title': '## TokenCost FinOps 分析报告',
  'report.md.savingsLabel': '**缓存节省：**',
  'report.md.hitRate': '缓存命中率：%{pct}',
  'report.md.withoutCache': '**无缓存应付：** {amount}',
};
/** İspanyolca sözlük. */
const es = {

  'app.docTitle': 'TokenCost FinOps Analyzer — Calculadora de cuota LLM y ROI de caché de prompt',
  'app.skipLink': 'Ir al contenido',
  'app.eyebrow': 'FinOps · Tokens LLM y ROI de caché',
  'app.titleStrong': 'TokenCost',
  'app.titleSuffix': 'FinOps Analyzer',
  'app.tagline': 'Pega tu tabla de consola, suelta una captura o carga un CSV: factura por modelo, ahorro de caché y presión de cuota en un solo informe. Sin servidor ni instalación; todo se calcula en el navegador.',
  'chip.privacy': 'Los datos no salen de tu dispositivo',
  'chip.pricing.cache': 'Catálogo de precios · caché',
  'chip.pricing.litellm': 'Catálogo de precios · LiteLLM',
  'chip.pricing.openrouter': 'Catálogo de precios · OpenRouter',
  'chip.pricing.fallback': 'Catálogo de precios · sin conexión',
  'chip.pricing.custom': 'Catálogo de precios · propio',
  'chip.pricing.unavailable': 'Catálogo de precios cargando',
  'section.input.title': 'Entrada de datos',
  'section.input.hint': 'Texto, imagen (OCR) o CSV/TXT: los tres alimentan la misma tabla',
  'input.paste.label': 'Texto de consola / tabla (pega con Ctrl+V)',
  'input.paste.placeholder': 'deepseek-v4.1-flash    1.204   98.220.000   88.310.000   9.910.000\nglm-5.3                   806   71.480.000   64.120.000   7.360.000\nmimo-v2.6-pro             612   54.310.000   48.900.000   5.410.000',
  'input.paste.note': 'Formato de fila: modelo · solicitudes · tokens totales · en caché · facturado',
  'btn.analyze': 'Analizar',
  'btn.clear': 'Limpiar campo',
  'input.file.label': 'Subir archivo',
  'drop.title': 'Suelta el archivo aquí',
  'drop.sub': 'PNG · JPG · JPEG · WEBP · GIF · BMP · TIFF · AVIF · HEIC · CSV · TSV · TXT · JSON · MD',
  'drop.hint': 'Arrastra y suelta, Ctrl+V o "Elegir archivo"',
  'btn.chooseFile': 'Elegir archivo…',
  'input.file.note': 'Las imágenes se leen con OCR (tesseract.js, requiere conexión); CSV/TXT se procesa directamente. Aunque falte la extensión o sea incorrecta, se leen los primeros bytes del archivo y se reconoce el tipo.',
  'btn.loadDemo': 'Cargar datos de consola de ejemplo (333,7M tokens)',
  'label.currency': 'Moneda',
  'label.language': 'Idioma',
  'theme.switchToLight': 'Tema claro',
  'theme.switchToDark': 'Tema oscuro',
  'price.query.label': 'Nombre del modelo',
  'price.query.placeholder': 'deepseek-v4.1-flash',
  'price.query.hint': 'Precio unitario del catálogo en vivo (por 1M tokens)',
  'btn.livePricing': 'Consultar precio en vivo',
  'section.cards.title': 'Resumen FinOps',
  'section.cards.hint': 'Coste sin caché · factura real · ahorro · presión de cuota',
  'section.chart.title': 'Distribución de coste por modelo',
  'section.chart.hint': 'Anillo: parte de la factura total · Barras: sólido = factura real, tenue = coste evitado',
  'section.table.title': 'Tabla de uso y cuota',
  'section.table.hint': 'Haz clic en una celda → edición en línea (Enter o clic fuera guarda)',
  'table.addRow': '+ Añadir fila',
  'table.summaryLabel': 'Coste total estimado: ',
  'table.removeRow': 'Eliminar fila',
  'table.col.date': 'Fecha',
  'table.col.model': 'Modelo',
  'table.col.requests': 'Solicitudes',
  'table.col.totalTokens': 'Tokens totales',
  'table.col.cachedTokens': 'En caché',
  'table.col.billedTokens': 'Facturado',
  'table.col.cachePct': 'Caché %',
  'table.col.cost': 'Coste estimado',
  'table.col.actions': 'Acción',
  'card.withoutCache': 'A pagar sin caché',
  'card.cacheSavings': 'Ahorro de caché',
  'card.invoice': 'Factura real ({cur})',
  'card.quota': 'Solicitudes y tokens facturados a la cuota',
  'card.pair': '{primary} / {secondary}',
  'card.savingsProfit': '-{amount} (beneficio)',
  'card.savingsBadge': '{pct}% de aciertos',
  'card.quotaValue': '{requests} solicitudes | {tokens} tokens netos',
  'chart.donut.aria': 'Distribución de coste por modelo',
  'chart.donut.center': 'Factura estimada',
  'chart.donut.caption': 'Cuota de caché por modelo',
  'chart.bars.aria': 'Comparación de coste por modelo',
  'chart.bars.caption': 'Factura real / coste evitado ({cur})',
  'chart.bars.title': '{aria} ({count} modelos, {cur})',
  'chart.bars.titleOne': '{aria} (1 modelo, {cur})',
  'chart.empty': 'No hay datos de coste que mostrar',
  'chart.tooltip': '{model}: factura {invoice} {cur} · sin caché {withoutCache} {cur} · ahorro {savings}',
  'toast.info': 'Información',
  'toast.success': 'Correcto',
  'toast.warning': 'Advertencia',
  'toast.error': 'Error',
  'msg.unitRows': '{count} filas',
  'msg.rowsAdded': 'Se añadieron {count} a la tabla',
  'msg.demoLoaded': 'Datos de consola de ejemplo cargados (13 filas, 333,7M tokens)',
  'msg.rejectedFile': 'Formato de archivo no compatible: {name}',
  'msg.rejectedSupported': 'Formatos admitidos: {supported}',
  'msg.recognizedFile': '{name} reconocido como {format}',
  'msg.ocrUnavailable': 'Motor OCR no encontrado; pega el texto de la tabla en lugar de una captura',
  'msg.ocrLabel': 'Imagen {index}/{total}',
  'msg.ocrPreprocess': '{label} preprocesando...',
  'msg.ocrReading': '{label} leyendo...',
  'msg.ocrDone': '{label} finalizado ({count} filas).',
  'msg.ocrUnreadable': '{label} falló: {error}',
  'msg.ocrProcessed': 'Leídas {count} desde imágenes',
  'msg.ocrFailed': 'No se pudo procesar la imagen',
  'msg.offlinePricing': 'Servicio de precios inaccesible; se usó el catálogo de ejemplo sin conexión',
  'msg.fallbackPricing': 'Se usaron precios estimados para algunos modelos; puedes editar los precios unitarios en la tabla',
  'msg.emptyExport': 'Nada que exportar; carga filas en la tabla primero',
  'msg.emptyText': 'No se encontró ninguna fila de uso en el texto pegado',
  'msg.clearedPaste': 'Campo de entrada vaciado (las filas de la tabla se conservan)',
  'msg.emptyPaste': 'Pega primero el texto de la tabla y pulsa "Analizar"',
  'msg.csvExported': 'Informe .CSV descargado (firmado por Burak Yıldız)',
  'msg.pdfExported': 'Informe .PDF preparado (firmado por Burak Yıldız)',
  'msg.livePricingRunning': 'Consultando precios en vivo...',
  'msg.livePricingUpdated': 'Precios actualizados de {count} modelos · origen: {source} · {time}',
  'msg.livePricingOffline': 'Origen de precios en vivo inaccesible; se mantiene el catálogo actual',
  'msg.languageChanged': 'Idioma cambiado: {language}',
  'msg.priceQueryMissing': 'Escribe un nombre de modelo para consultar su precio',
  'msg.priceQueryUnknown': '{model} no está en el catálogo de precios',
  'msg.priceQueryResult': '{model}: entrada {input} / salida {output} (1M tokens) · caché {cached}',
  'btn.exportCsv': '.CSV descargar',
  'btn.exportPdf': '.PDF descargar',
  'report.title': 'Informe TokenCost FinOps',
  'report.h1': 'Informe de análisis TokenCost FinOps',
  'report.subtitle': 'ROI de caché de prompt y resumen de coste de cuota',
  'report.modelsTitle': 'Uso y coste por modelo',
  'report.rowsTitle': 'Detalle de filas',
  'report.col.cachePct': 'Caché %',
  'report.col.netTokens': 'Tokens netos',
  'report.col.costUsd': 'Coste estimado (USD)',
  'report.col.savingsUsd': 'Ahorro de caché (USD)',
  'report.md.cachePct': 'Caché (%)',
  'report.invoiceUsd': 'Factura real (USD)',
  'report.invoicePair': 'Factura real (USD y {cur})',
  'report.csv.savings': 'Ahorro de caché (USD)',
  'report.csv.cost': 'Coste estimado (USD)',
  'report.csv.billed': 'Facturado a cuota',
  'report.md.title': '## Informe de análisis TokenCost FinOps',
  'report.md.savingsLabel': '**Ahorro de caché:**',
  'report.md.hitRate': 'Tasa de aciertos de caché: %{pct}',
  'report.md.withoutCache': '**A pagar sin caché:** {amount}',
};

export const MESSAGES = Object.freeze({ tr, en, de, zh, es });

/** Eksik anahtar/çeviride başvurulan yedek dil (her zaman dolu sözlük). */
export const FALLBACK_LANGUAGE = 'tr';

/** localStorage anahtarı (dil tercihi cihazda saklanır). */
export const LANGUAGE_STORAGE_KEY = 'tokencost_language';

/** <html lang="..."> için BCP-47 karşılıkları. */
export const HTML_LANG = Object.freeze({ tr: 'tr', en: 'en', de: 'de', zh: 'zh-CN', es: 'es' });

/** Aktif dil (modül içi tek durum). Varsayılan: Türkçe. */
let currentLanguage = DEFAULT_LANGUAGE;

/** Dil girdisini anahtar biçimine indirger: ' English ' → 'english', 'zh-CN' → 'zh_cn'. */
function normalizeLanguageKey(value) {
  return String(value).trim().toLowerCase().replace(/[\s-]/g, '_');
}

/**
 * Verilen değeri desteklenen dil koduna çözer ('english' → 'en', 'zh-CN' → 'zh').
 * Çözülemezse `fallback` döner (varsayılan: Türkçe).
 * @param {string} [value]
 * @param {string} [fallback=DEFAULT_LANGUAGE]
 * @returns {string} 'tr' | 'en' | 'de' | 'zh' | 'es'
 */
export function resolveLanguage(value, fallback = DEFAULT_LANGUAGE) {
  if (value === undefined || value === null) return fallback;
  const key = normalizeLanguageKey(value);
  if (LANGUAGES.includes(key)) return key;
  return LANGUAGE_ALIASES[key] || fallback;
}

/**
 * Değer desteklenen bir dile karşılık geliyor mu? (takma adlar da geçerli sayılır)
 * @param {string} [value]
 * @returns {boolean}
 */
export function isSupportedLanguage(value) {
  if (value === undefined || value === null || String(value).trim() === '') return false;
  const key = normalizeLanguageKey(value);
  return LANGUAGES.includes(key) || Object.prototype.hasOwnProperty.call(LANGUAGE_ALIASES, key);
}

/**
 * Aktif dili ayarlar. Desteklenmeyen değer sessizce varsayılan dile düşer.
 * @param {string} value
 * @returns {string} Uygulanan dil kodu
 */
export function setLanguage(value) {
  currentLanguage = resolveLanguage(value);
  return currentLanguage;
}

/** @returns {string} Aktif dil kodu */
export function getLanguage() {
  return currentLanguage;
}

/**
 * Bir dilin sözlüğünü döndürür (kopya değil, salt okunur referans).
 * @param {string} [language=getLanguage()]
 * @returns {Record<string, string>}
 */
export function getMessages(language = currentLanguage) {
  return MESSAGES[resolveLanguage(language)];
}

/** `{ad}` yer tutucularını parametrelerle değiştirir; bilinmeyen yer tutucu korunur. */
function interpolate(template, params = {}) {
  return String(template).replace(/\{(\w+)\}/g, (match, name) => {
    if (params === null || params === undefined) return match;
    const value = params[name];
    return value === undefined || value === null ? match : String(value);
  });
}

/**
 * Anahtarı verilen (veya aktif) dilde çevirir. Eksik anahtarda Türkçeye düşer;
 * hiçbir yerde yoksa anahtarın kendisi döner (arayüz asla boş kalmaz).
 * @param {string} key
 * @param {string} [language=getLanguage()]
 * @param {object} [params]
 * @returns {string}
 */
export function translate(key, language = currentLanguage, params = {}) {
  const lang = resolveLanguage(language);
  const dict = MESSAGES[lang] || MESSAGES[FALLBACK_LANGUAGE];
  const fallbackDict = MESSAGES[FALLBACK_LANGUAGE];
  const template = dict[key] !== undefined
    ? dict[key]
    : (fallbackDict[key] !== undefined ? fallbackDict[key] : null);
  if (template === null || template === undefined) return String(key);
  return interpolate(template, params);
}

/**
 * Aktif dilde çeviri (kısa yol): t('btn.analyze') → 'Analiz Et'
 * @param {string} key
 * @param {object} [params]
 * @returns {string}
 */
export function t(key, params = {}) {
  return translate(key, currentLanguage, params);
}

/** Aktif dilin binlik ayırıcısı ('.' veya ','). */
export function groupSeparator(language = currentLanguage) {
  return GROUP_SEPARATORS[resolveLanguage(language)] || GROUP_SEPARATORS[DEFAULT_LANGUAGE];
}

/** Aktif dilin ondalık ayırıcısı (',' veya '.'). */
export function decimalSeparator(language = currentLanguage) {
  return DECIMAL_SEPARATORS[resolveLanguage(language)] || DECIMAL_SEPARATORS[DEFAULT_LANGUAGE];
}

/** <html lang> değeri (zh → 'zh-CN'). */
export function htmlLang(language = currentLanguage) {
  const code = resolveLanguage(language);
  return HTML_LANG[code] || code;
}

/**
 * Bir dilde eksik çevrilmiş anahtarları listeler (dil menüsü/CI kontrolü için).
 * @param {string} language
 * @returns {string[]}
 */
export function missingKeys(language) {
  const dict = getMessages(language) || {};
  return Object.keys(MESSAGES[FALLBACK_LANGUAGE]).filter((key) => dict[key] === undefined);
}
