// tests/deploy.test.js
// Faz 47: GitHub Actions CI/CD, GitHub Pages dağıtımı, index.html/styles.css ve
// @media print PDF stilleri sözleşme testleri (statik çıktı doğrulaması).
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { EXPORT_CSV_BUTTON_ID } from '../src/ui/components.js';

const WORKFLOW_PATH = '.github/workflows/deploy.yml';
const INDEX_PATH = 'index.html';
const STYLES_PATH = 'styles.css';
const GITATTRIBUTES_PATH = '.gitattributes';
const MAIN_ENTRY_PATH = 'src/main.js';

/** Dosyayı metin olarak okur (yoksa testi anlamlı biçimde düşürür). */
function readArtifact(path) {
  if (!existsSync(path)) throw new Error(`EKSİK DOSYA: ${path}`);
  return readFileSync(path, 'utf8');
}

/** Bir klasördeki tüm .js dosyalarını (özyinelemeli) toplar. */
function collectJavaScriptFiles(directory) {
  const found = [];
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) found.push(...collectJavaScriptFiles(full));
    else if (entry.endsWith('.js')) found.push(full);
  }
  return found;
}

describe('Faz 47: CI/CD, GitHub Pages ve yazdırma (print) sözleşmesi', () => {
  it('deploy.yml her push\'ta npm test çalıştırır ve testler geçmeden dağıtım yapmaz', () => {
    const workflow = readArtifact(WORKFLOW_PATH);

    expect(workflow).toMatch(/branches:\s*\[\s*main\s*\]/);
    expect(workflow).toMatch(/actions\/checkout@v7/);
    expect(workflow).toMatch(/actions\/setup-node@v7/);
    expect(workflow).toMatch(/npm ci/);
    expect(workflow).toMatch(/npm test/);

    // Dağıtım adımları test işine bağlıdır: kırmızı test = yayın yok.
    expect(workflow).toMatch(/needs:\s*test/);
    expect(workflow).toMatch(/needs:\s*build/);
    expect(workflow).toMatch(/actions\/upload-pages-artifact@v5/);
    expect(workflow).toMatch(/actions\/deploy-pages@v5/);

    // Pages izinleri ve eşzamanlılık kilidi
    expect(workflow).toMatch(/pages:\s*write/);
    expect(workflow).toMatch(/id-token:\s*write/);
    expect(workflow).toMatch(/concurrency:/);

    // Yayına giren paket yalnızca statik dosyalardır: testler/node_modules pakete girmez.
    expect(workflow).toContain('mkdir -p dist');
    expect(workflow).toContain('cp -R src dist/src');
    expect(workflow).toContain('test -f dist/src/main.js');
    expect(workflow).toMatch(/path:\s*\.\/dist/);
    expect(workflow).not.toMatch(/path:\s*\.\s*$/m);
  });

  it('index.html uygulama kökünü, demo butonunu ve tüm panel kimliklerini taşır', () => {
    const html = readArtifact(INDEX_PATH);

    expect(html).toMatch(/<html lang="tr"/);
    expect(html).toContain('charset="utf-8"');
    expect(html).toContain('./styles.css');
    expect(html).toContain('./src/main.js');
    expect(html).toContain('type="module"');

    for (const id of [
      'id="app"',
      'id="input-panel"',
      'id="finops-cards"',
      'id="cost-chart"',
      'id="usage-table"',
      'id="progress-banner"',
      'id="toast-container"',
      'id="app-footer"',
      'id="btn-load-demo"',
      'id="btn-theme-toggle"',
      'id="currency-select"',
    ]) {
      expect(html).toContain(id);
    }

    expect(html).toContain('Örnek Konsol Verisi Yükle (333.7M Token)');
    expect(html).toContain('USD');
    expect(html).toContain('TRY');
    expect(html).toContain('EUR');

    // Erişilebilirlik: dil, rol, canlı bölgeler ve içeriğe geç bağlantısı
    expect(html).toContain('role="main"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('skip-link');

    // Sayfa kontrolü uygulamada değil, uygulama kodunda: ilk tema koyu (dark).
    expect(html).toContain('data-theme="dark"');
  });

  it('styles.css @media print ile girdileri gizler, yalnızca raporu ve imzayı basar', () => {
    const css = readArtifact(STYLES_PATH);

    const printIndex = css.indexOf('@media print');
    expect(printIndex).toBeGreaterThan(-1);
    const printBlock = css.slice(printIndex);

    expect(printBlock).toContain('.no-print');
    expect(printBlock).toMatch(/display:\s*none\s*!important/);
    expect(printBlock).toContain('.app-signature');
    expect(printBlock).toContain('.usage-table');
    expect(printBlock).toContain('.finops-cards');
    expect(printBlock).toContain('.donut-chart');
    expect(printBlock).toMatch(/@page/);

    // Koyu/açık tema değişkenleri ve imza tipografisi
    expect(css).toMatch(/\[data-theme=["']dark["']\]/);
    expect(css).toMatch(/\[data-theme=["']light["']\]/);
    expect(css).toContain('.app-signature');
    expect(css).toContain('.finops-card');
    expect(css).toContain('.toast');
  });

  it('tarayıcı giriş noktası (src/main.js) initApp ile uygulamayı başlatır', () => {
    const main = readArtifact(MAIN_ENTRY_PATH);

    expect(main).toContain("from './app.js'");
    expect(main).toContain('initApp(');
    expect(main).toContain('getElementById');
  });

  it('tüm src modülleri içe aktarımlarda açık .js uzantısı kullanır (Pages 404 koruması)', () => {
    const files = collectJavaScriptFiles('src');
    expect(files.length).toBeGreaterThanOrEqual(14);

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      const specifiers = Array.from(content.matchAll(/from\s+['"](\.[^'"]+)['"]/g))
        .map((match) => match[1]);

      for (const specifier of specifiers) {
        expect(`${file} -> ${specifier}`).toMatch(/\.js$/);
      }
    }
  });

  it('.gitattributes satır sonlarını normalize eder (Windows/Linux tutarlılığı)', () => {
    const attributes = readArtifact(GITATTRIBUTES_PATH);

    expect(attributes).toContain('* text=auto');
    expect(attributes).toContain('eol=lf');
  });

  it('index.html iskeleti initApp ile uyumludur (elementler çoğaltılmaz, vitrin çalışır)', async () => {
    const { JSDOM } = await import('jsdom');
    const { initApp } = await import('../src/app.js');

    const dom = new JSDOM(readArtifact(INDEX_PATH), { url: 'https://brakyildiz.github.io/tokencost-finops/' });
    const documentRef = dom.window.document;
    const root = documentRef.getElementById('app');

    expect(root).not.toBeNull();

    const memoryStorage = new Map();
    const app = initApp(root, {
      fetchFn: async () => { throw new Error('offline'); },
      storage: {
        getItem: (key) => (memoryStorage.has(key) ? memoryStorage.get(key) : null),
        setItem: (key, value) => { memoryStorage.set(key, String(value)); },
        removeItem: (key) => { memoryStorage.delete(key); },
      },
      environment: { document: documentRef },
      initialHash: '',
    });

    await app.ready;

    // Statik iskelet yeniden kullanılır: hiçbir element/buton ikinci kez üretilmez.
    for (const id of ['#btn-load-demo', '#btn-theme-toggle', '#currency-select', '#finops-cards', '#cost-chart', '#usage-table', '#progress-banner', '#toast-container', '#app-footer']) {
      expect(`${id}:${documentRef.querySelectorAll(id).length}`).toBe(`${id}:1`);
    }
    expect(documentRef.querySelectorAll('.app-signature')).toHaveLength(1);
    expect(documentRef.querySelector('.app-signature').textContent).toBe('Made by Burak Yıldız');
    expect(documentRef.querySelectorAll(`#${EXPORT_CSV_BUTTON_ID}`)).toHaveLength(1);

    // Vitrin senaryosu gerçek sayfada: 13 satır ve $13.80
    documentRef.getElementById('btn-load-demo').click();
    expect(documentRef.querySelectorAll('#usage-table tbody tr')).toHaveLength(13);
    expect(documentRef.querySelector('[data-metric="invoice"] .finops-card-value').textContent)
      .toContain('$13.80');
    expect(documentRef.querySelector('#cost-chart svg.donut-chart')).not.toBeNull();

    // Tema değiştirici kök elemente yazar (styles.css [data-theme='light'] bloğu devreye girer).
    documentRef.getElementById('btn-theme-toggle').click();
    expect(root.dataset.theme).toBe('light');

    app.destroy();
    expect(app.store.getListenerCount()).toBe(0);
    // İlk jsdom + app.js derlemesi yavaş/yüklü makinelerde 5 sn'yi aşabildiği için açık süre verildi.
  }, 20000);

  it('Faz 48: index.html gerçek veri girişi konsolunu taşır (yapıştırma + dosya + bırakma alanı)', () => {
    const html = readArtifact(INDEX_PATH);

    for (const id of [
      'id="paste-input"',
      'id="btn-analyze-text"',
      'id="btn-clear-text"',
      'id="drop-zone"',
      'id="file-input"',
      'id="btn-open-file"',
      'id="pricing-source-chip"',
    ]) {
      expect(html).toContain(id);
    }

    // Dosya seçici gerçek bir input'tur: çoklu seçim + kabul edilen uzantılar yazılıdır.
    expect(html).toContain('<textarea');
    expect(html).toContain('type="file"');
    expect(html).toContain('multiple');
    expect(html).toContain('accept=".png,.jpg,.jpeg,.webp,.csv,.txt');
    expect(html).toContain('for="paste-input"');
    expect(html).toContain('for="file-input"');
  });

  it('Faz 48: styles.css temayı <html> üzerinden tüm sayfaya uygular, yeni konsol/grafik sınıflarını taşır', () => {
    const css = readArtifact(STYLES_PATH);

    // Açık tema yalnızca uygulama kökünü değil gövdeyi de boyar (data-theme <html>'e de yazılır).
    expect(css).toContain("html:has(#app[data-theme='light'])");
    expect(css).toContain("html:has(#app[data-theme='dark'])");
    expect(css).toContain('color-scheme: light');
    expect(css).toContain('color-scheme: dark');
    expect(css).toMatch(/body\s*\{[^}]*background:\s*var\(--bg\)/s);

    // Yeni konsol ve grafik bileşenlerinin stilleri.
    expect(css).toContain('.paste-input');
    expect(css).toContain('.drop-zone');
    expect(css).toContain('.drop-zone.is-dragover');
    expect(css).toContain('.bar-chart');
    expect(css).toContain('.donut-center');
    expect(css).toContain('.chart-grid');
    expect(css).toContain('.sr-only');
  });

  it('Faz 48: gerçek sayfada metin analizi, tema devri ve çubuk grafik uçtan uca çalışır', async () => {
    const { JSDOM } = await import('jsdom');
    const { initApp } = await import('../src/app.js');

    const dom = new JSDOM(readArtifact(INDEX_PATH), { url: 'https://brakyildiz.github.io/tokencost-finops/' });
    const documentRef = dom.window.document;
    const root = documentRef.getElementById('app');

    const memoryStorage = new Map();
    const app = initApp(root, {
      fetchFn: async () => { throw new Error('offline'); },
      storage: {
        getItem: (key) => (memoryStorage.has(key) ? memoryStorage.get(key) : null),
        setItem: (key, value) => { memoryStorage.set(key, String(value)); },
        removeItem: (key) => { memoryStorage.delete(key); },
      },
      environment: { document: documentRef },
      initialHash: '',
    });

    await app.ready;

    // 1) Kullanıcı gerçekten veri girebilir: metni yapıştır → "Analiz Et" → satır tabloda.
    const textarea = documentRef.getElementById('paste-input');
    textarea.value = '14 Eki\tdeepseek-v4.1-flash\t341\t30.811.037\t29.312.128 (%96)\t2.378.273\t0,00';
    documentRef.getElementById('btn-analyze-text').click();

    expect(app.store.getState().records.length).toBeGreaterThan(0);
    expect(documentRef.querySelectorAll('#usage-table tbody tr').length).toBeGreaterThan(0);
    expect(textarea.value).toBe('');

    // 2) Tema yalnızca kök elementte değil <html>'de de güncellenir (tüm sayfa döner).
    expect(documentRef.documentElement.getAttribute('data-theme')).toBe('dark');
    documentRef.getElementById('btn-theme-toggle').click();
    expect(documentRef.documentElement.getAttribute('data-theme')).toBe('light');
    expect(root.dataset.theme).toBe('light');

    // 3) Grafik bölümü hem halka hem yatay çubuk grafiği taşır; donut ortasında toplam yazar.
    expect(documentRef.querySelector('#cost-chart svg.donut-chart')).not.toBeNull();
    expect(documentRef.querySelector('#cost-chart svg.bar-chart')).not.toBeNull();
    expect(documentRef.querySelector('#cost-chart .donut-center strong')).not.toBeNull();

    // 4) Boş alanda "Analiz Et" kullanıcıyı uyarır, veri eklemez.
    const before = app.store.getState().records.length;
    documentRef.getElementById('btn-analyze-text').click();
    expect(app.store.getState().records).toHaveLength(before);
    expect(documentRef.querySelectorAll('.toast--warning').length).toBeGreaterThan(0);

    app.destroy();
    // Uçtan uca akış (jsdom + app.js + grafikler) yavaş makinelerde 5 sn'yi aşabildiği için açık süre verildi.
  }, 20000);
});
