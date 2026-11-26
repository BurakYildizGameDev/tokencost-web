# TokenCost FinOps Analyzer

**LLM Kota ve Prompt Cache ROI Analiz Aracı** — %100 tarayıcıda çalışan, sunucusuz (zero-backend) FinOps hesaplayıcı.
Ekran görüntüsünü, kopyaladığınız konsol tablosunu veya CSV dosyasını verin; önbellek tasarrufunu,
gerçek faturayı ve kota dağılımını saniyeler içinde görün. **Hiçbir veri cihazınızdan çıkmaz.**

> Made by Burak Yıldız

---

## Vitrin Senaryosu (örnek veriyle deneyin)

"Örnek Konsol Verisi Yükle (333.7M Token)" butonuna basın: 3 ekran görüntüsündeki 13 satır
(4 model: `deepseek-v4.1-flash`, `glm-5.3`, `mimo-v2.6-pro`, `qwen3-vl-30b`) anında tabloya yüklenir.

| Metrik | Değer |
| --- | --- |
| Toplam token | **333.698.885** (333,7M) |
| Toplam istek | **4.044** |
| Önbellek isabeti | **%89,66** |
| Gerçek fatura (tahmini) | **$13.80** |
| Önbellek olmasaydı | **$51.76** |
| Önbellek tasarrufu | **$37.96** (Kâr, %73,34) |

## Özellikler

- **Çoklu girdi:** Ctrl+V ile tablo metni yapıştırma, ekran görüntüsü sürükle-bırak (OCR, Tesseract.js),
  CSV/TXT dosyası bırakma.
- **Akıllı ayrıştırma:** Türkçe konsol tablosu başlıkları (Zaman / Model / İstek / Toplam Token /
  Önbelleklenen / Kotaya Yansıyan), özet satırı ayıklama, mükerrer satır tekilleştirme
  (kaydırmalı ekran görüntülerindeki örtüşmeler çifte sayılmaz), OCR gürültüsü düzeltme (`O → 0`, `gIm → glm`).
- **FinOps motoru:** önbellek isabet oranı, normalde ödenecek tutar, önbellek tasarrufu (Kâr),
  net kota tokeni, model bazlı gruplama — hepsi `src/core` içinde saf (pure) fonksiyonlar.
- **Fiyat kataloğu:** önbellek → LiteLLM → OpenRouter → çevrimdışı statik katalog zinciri;
  model adı normalizasyonu, takma ad (alias) ve bulanık eşleşme sayesinde `deepseek-ai/DeepSeek-V4.1-Flash`
  gibi sağlayıcı önekli adlar da doğru fiyatlanır. Hücreden birim fiyat düzenlenebilir.
- **Raporlama:** UTF-8 BOM'lu `.csv` (Excel uyumlu), yazdırılabilir `.pdf` raporu, GitHub Issue/PR için
  Markdown raporu ve panoya kopyalama; hepsinin altında `Made by Burak Yıldız` imzası.
- **Paylaşım:** `#data=...` URL hash'i ile sunucu olmadan analiz paylaşımı.
- **Tema ve para birimi:** Dark/Light tema (cihazda saklanır) ve USD/TRY/EUR seçici.
- **Bağımlılık yok:** çalışma zamanında hiçbir npm paketi, framework veya grafik kütüphanesi yok
  (grafikler saf SVG, tablo/state saf JavaScript).

## Hızlı Başlangıç

ES modülleri `file://` üzerinden yüklenemez; küçük bir statik sunucu yeterlidir:

```bash
# 1) Depoyu alın
git clone https://github.com/brakyildiz/tokencost-finops.git
cd tokencost-finops

# 2) Testleri çalıştırın (47 faz sözleşmesi)
npm ci
npm test

# 3) Tarayıcıda açın
npx serve .        # veya: python -m http.server 8080
# http://localhost:3000
```

OCR (ekran görüntüsü) özelliği Tesseract.js CDN'inden gelir; erişim yoksa metin/CSV akışı sorunsuz çalışır
(görsel yüklendiğinde kibar bir uyarı gösterilir).

## Mimari

```
index.html            # Statik iskelet (erişilebilir, SEO meta etiketli)
styles.css            # Dark/Light tema + @media print PDF stilleri
src/
  main.js             # Tarayıcı giriş noktası (initApp)
  app.js              # Faz 44: orkestratör — tüm katmanları DOM'a bağlar
  core/               # SAF katman: DOM/window/localStorage/fetch YOK
    schema.js         #   token kaydı ve fiyat profili modelleri
    calculator.js     #   maliyet, tasarruf, özet ve gruplama motoru
    parser.js         #   konsol tablosu ayrıştırıcı + tekilleştirme imzası
    normalizer.js     #   model adı normalizasyonu, alias, bulanık eşleşme
    formatter.js      #   Türkçe sayı/para biçimlendirme
    demo-data.js      #   örnek (vitrin) veri seti + çevrimdışı fiyat kataloğu
  ocr/                # OCR hattı (Tesseract enjekte edilir, saf mantık test edilebilir)
  services/           # fiyat, kur, dışa aktarım (CSV/PDF/Markdown/hash) servisleri
  ui/                 # store (pub/sub), bileşenler, grafikler, girdi olayları
tests/                # Vitest: 14 dosya, 270 test (unit + entegrasyon + E2E)
```

**Katman kuralı:** `src/core` ve `src/ocr` içinde DOM'a dokunulmaz; DOM yalnızca enjekte edilen
`ownerDocument` / `environment` üzerinden kullanılır. Bu sayede tüm iş mantığı Node üzerinde
DOM olmadan test edilebilir.

## Testler

```bash
npm test           # tek seferlik (CI ile aynı komut)
npm run test:watch # geliştirme sırasında izleme
```

Her faz TDD ile ilerledi (önce kırmızı test, sonra uygulama). E2E testleri ham metinden **$13.80**
faturaya, `.csv`/`.pdf` çıktısındaki imzaya ve 3 parçalı OCR akışının tekilleştirmesine kadar
tüm zinciri doğrular.

## GitHub Pages Dağıtımı

1. Depoyu GitHub'a gönderin (`main` dalı).
2. **Settings → Pages → Build and deployment → Source: GitHub Actions** seçin.
3. `.github/workflows/deploy.yml` her `push` işleminde `npm test` çalıştırır; tüm testler yeşilse
   statik site Pages'e yayınlanır. **Kırmızı test = yayın yok.**

## Lisans

MIT — dilediğiniz gibi kullanabilirsiniz.

<sub>Made by Burak Yıldız</sub>
