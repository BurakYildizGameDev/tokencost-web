// src/main.js
// Faz 47: Tarayıcı giriş noktası. index.html bu modülü yükler ve uygulamayı başlatır.
// KURAL: Tüm göreli içe aktarımlarda açık .js uzantısı (GitHub Pages ES modül 404 koruması).
import { initApp } from './app.js';

/** Uygulama kökü index.html içinde hazır bekler; yoksa oluşturulur. */
function resolveRootElement() {
  const existing = document.getElementById('app');
  if (existing) return existing;

  const created = document.createElement('main');
  created.id = 'app';
  created.className = 'tokencost-app';
  document.body.appendChild(created);
  return created;
}

const app = initApp(resolveRootElement());

// Portföy/demo kolaylığı: konsoldan `tokenCostApp.loadDemoData()` çağrılabilir.
globalThis.tokenCostApp = app;

export default app;
