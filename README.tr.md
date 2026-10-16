<div align="center">

# TokenCost FinOps Analyzer

**LLM kullanımınızın gerçek maliyetini ve prompt önbelleğinin size ne kazandırdığını görün.**

Konsol kullanım tablosunu yapıştırın, ekran görüntüsünü bırakın ya da CSV yükleyin: gerçek faturayı,
önbellek olmasaydı ödeyeceğiniz tutarı ve model bazlı kota baskısını saniyeler içinde görün.
Tamamen tarayıcıda çalışır — **verileriniz cihazınızdan çıkmaz.**

[![CI/CD](https://github.com/BurakYildizGameDev/tokencost-web/actions/workflows/deploy.yml/badge.svg)](https://github.com/BurakYildizGameDev/tokencost-web/actions/workflows/deploy.yml)
[![Canlı demo](https://img.shields.io/badge/demo-canl%C4%B1-f0b429)](https://burakyildizgamedev.github.io/tokencost-web/)
[![Lisans: MIT](https://img.shields.io/badge/lisans-MIT-blue.svg)](LICENSE)
![Çalışma zamanı bağımlılığı: 0](https://img.shields.io/badge/runtime%20deps-0-brightgreen)

[**Canlı demo**](https://burakyildizgamedev.github.io/tokencost-web/) ·
[Özellikler](#özellikler) ·
[Başlarken](#başlarken) ·
[Maliyet nasıl hesaplanır](#maliyet-nasıl-hesaplanır) ·
[English](README.md)

![Örnek konsol verisi yüklenmiş TokenCost FinOps Analyzer: özet kartları, model bazlı maliyet dağılımı ve kullanım tablosu](docs/screenshot-tr.png)

</div>

## Neden

LLM sağlayıcı konsolları token sayılarını gösterir ama fatura için önemli soruları pek yanıtlamaz:

- Trafiğimin ne kadarı önbellekten karşılanıyor ve bu bana ne kazandırdı?
- Faturayı hangi model büyütüyor?
- Önbellek olmasaydı bu ay ne öderdim?

TokenCost bu soruları elinizde zaten olan veriden yanıtlar — kopyalanmış bir tablo, ekran görüntüsü ya da
dışa aktarılmış dosya. Üyelik, API anahtarı veya sunucu gerekmez.

## Özellikler

| | |
| --- | --- |
| **Üç giriş yolu** | Tablo yapıştırma (Ctrl+V), ekran görüntüsü sürükle-bırak (Tesseract.js ile OCR) ya da CSV/TSV/TXT/JSON/MD dosyası. |
| **Akıllı ayrıştırma** | Konsol tablosu başlıklarını tanır, özet satırını ayıklar, kaydırmalı ekran görüntülerindeki örtüşen satırları tekilleştirir ve yaygın OCR hatalarını düzeltir (`O → 0`, `gIm → glm`). |
| **FinOps motoru** | Önbellek isabet oranı, gerçek fatura, önbelleksiz maliyet, önbellek tasarrufu ve net kota tokeni — toplamda ve model bazında. |
| **Canlı fiyatlar** | Fiyatlar LiteLLM → OpenRouter zincirinden gelir, 24 saat yerelde saklanır; ağ yoksa çevrimdışı katalog kullanılır. `deepseek-ai/DeepSeek-V4.1-Flash` gibi sağlayıcı önekli adlar normalizasyon, takma ad ve bulanık eşleşmeyle çözülür. |
| **Düzenlenebilir** | Her hücre satır içinde düzenlenir (Enter kaydeder, Escape iptal eder); model başına birim fiyat girilebilir. |
| **Raporlar** | Excel uyumlu UTF-8 `.csv`, yazdırılabilir `.pdf`, GitHub issue/PR için Markdown raporu ve sunucusuz paylaşım bağlantısı (`#data=…`). |
| **5 dil, 3 para birimi** | Türkçe, İngilizce, Almanca, Çince, İspanyolca · USD, TRY, EUR. |
| **Sağlam dosya tanıma** | Dosyalar MIME, ilk baytlar (magic bytes) ve uzantıyla tanınır; adı `rapor.txt` olan bir PNG yine OCR'a gider. |
| **Sıfır bağımlılık** | Framework, grafik kütüphanesi veya çalışma zamanı npm paketi yok. Grafikler saf SVG, durum yönetimi ~50 satırlık pub/sub. |
| **Koyu / açık tema** | Cihaz bazında hatırlanır. |

### Desteklenen girdiler

| Tür | Biçimler | Akış |
| --- | --- | --- |
| Görsel (OCR) | PNG · JPG/JPEG · JFIF · WEBP · GIF · BMP · TIFF · AVIF · HEIC/HEIF | Tesseract.js (CDN'den yüklenir, internet gerekir) |
| Tablo / metin | CSV · TSV · TXT · LOG · JSON · MD | Yerleşik ayrıştırıcı (`src/core/parser.js`) |

## Başlarken

Çevrimiçi kullanın: **https://burakyildizgamedev.github.io/tokencost-web/** — 13 satırlık, 333,7M tokenlik örneği
görmek için **Örnek Konsol Verisi Yükle** düğmesine basın.

Yerelde çalıştırın (Node 18+):

```bash
git clone https://github.com/BurakYildizGameDev/tokencost-web.git
cd tokencost-web
npm ci
npm start        # http://localhost:5173
```

`npm start`, bağımlılıksız bir statik sunucu çalıştırır (`scripts/serve.mjs`). ES modülleri `file://` üzerinden
yüklenemediği için `index.html` doğrudan açılamaz; herhangi bir statik sunucu (ör. `python -m http.server`) da olur.
Port seçmek için `PORT=8080 npm start`; port doluysa sıradaki boş port kullanılır.

### Beklenen girdi

Her model/gün için bir satır (Türkçe ve İngilizce başlıklar tanınır; sekme veya boşlukla ayrılmış,
`1.234` ve `1,234` ikisi de çalışır):

```
Zaman    Model                 İstek    Toplam Token   Önbelleklenen   Kotaya Yansıyan
14 Eki   deepseek-v4.1-flash   2.984    177.254.544    169.521.069     7.733.475
```

## Maliyet nasıl hesaplanır

Tüm hesaplar `src/core/calculator.js` içindeki saf fonksiyonlardadır. Fiyatlar **1M token** başınadır.

| Metrik | Formül |
| --- | --- |
| Önbellek isabeti | `önbelleklenen / toplam` (token ağırlıklı; satır yüzdelerinin ortalaması değil) |
| Gerçek fatura | `önbelleklenen × P_cache + faturalı × (α × P_in + (1 − α) × P_out)`, α = 0,3 girdi payı |
| Önbellek tasarrufu | `önbelleklenen × (P_in − P_cache)` |
| Önbelleksiz maliyet | `gerçek fatura + önbellek tasarrufu` |

Sağlayıcı önbellek okuma fiyatı yayımlamıyorsa girdi fiyatının %50'si varsayılır. Aynı model birçok sağlayıcıda
listelendiğinde, fiyatı eksik veya sıfır olan girdiler yerine kanonik girdi ya da bilinen bir sağlayıcı tercih edilir.

> Canlı site anlık fiyatları kullandığı için toplamlar çevrimdışı katalogdan farklıdır. Yerleşik çevrimdışı
> katalogla örnek veri **$13.80** gerçek fatura, önbelleksiz **$51.76** tutar (**$37.96** tasarruf, %89,66 isabet).

## Proje yapısı

```
index.html              Statik iskelet (erişilebilir, SEO meta etiketli)
styles.css              Koyu/açık tema + PDF için yazdırma stilleri
src/
  main.js               Tarayıcı giriş noktası
  app.js                Orkestratör: tüm katmanları DOM'a bağlar
  core/                 Saf mantık — DOM, window, localStorage, fetch yok
    calculator.js       Maliyet, tasarruf, özet ve gruplama
    parser.js           Konsol tablosu ayrıştırıcı + tekilleştirme
    normalizer.js       Model adı normalizasyonu, takma ad, bulanık eşleşme
    schema.js           Token kaydı ve fiyat profili modelleri
    i18n.js             5 dilin sözlükleri
    file-type.js        MIME / magic bytes / uzantı tespiti
    formatter.js        Sayı ve para biçimlendirme
    demo-data.js        Örnek veri seti + çevrimdışı fiyat kataloğu
  ocr/                  OCR hattı (Tesseract enjekte edilir; mantık test edilebilir)
  services/             Fiyat, kur, dışa aktarım (CSV/PDF/Markdown/paylaşım bağlantısı)
  ui/                   Store (pub/sub), tablo, kartlar, grafikler, girdi olayları
scripts/serve.mjs       Bağımlılıksız geliştirme sunucusu
tests/                  Vitest + jsdom: birim, entegrasyon ve uçtan uca testler
```

**Katman kuralı:** `src/core` ve `src/ocr` DOM'a dokunmaz; DOM'a yalnızca enjekte edilen `document`/`environment`
üzerinden erişilir. Böylece tüm iş mantığı Node'da test edilebilir.

## Testler

```bash
npm test             # tek seferlik (CI ile aynı)
npm run test:watch   # izleme modu
```

17 dosyadaki 356 test; hesaplayıcı, ayrıştırıcı, OCR hattı, fiyat zinciri, diller arası anahtar eşitliği,
dosya türü tespiti, dışa aktarımlar, geliştirme sunucusu ve jsdom'da uçtan uca akışları kapsar.

## Dağıtım

`.github/workflows/deploy.yml` her push ve pull request'te test paketini çalıştırır. `main` dalında testlerin
tamamı geçerse statik dosyalar (`index.html`, `styles.css`, `src/`) GitHub Pages'e yayınlanır.
**Kırmızı test = yayın yok.**

Kendi fork'unuzda yayınlamak için **Settings → Pages → Source: GitHub Actions** seçin.

## Bilinen sınırlar

- OCR ve canlı fiyatlar internet gerektirir; bağlantı yoksa metin/CSV girişi ve çevrimdışı katalog çalışmaya devam eder.
- Kurlar sabit varsayılanlardır (TRY 34,00, EUR 0,92); birim fiyatlar tablodan düzenlenebilir.
- Dışa aktarılan `.csv`/`.pdf` rapor başlıkları, tablodaki tarihler ve OCR ilerleme mesajları şimdilik yalnızca Türkçedir.
- Sayı biçimi dilden bağımsız olarak her zaman `1.234,56` şeklindedir.

## Katkı

Issue ve pull request'ler memnuniyetle karşılanır — bkz. [CONTRIBUTING.md](CONTRIBUTING.md).

## Lisans

[MIT](LICENSE) © Burak Yıldız
