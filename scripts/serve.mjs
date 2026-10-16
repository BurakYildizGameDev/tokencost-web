// scripts/serve.mjs
// Araç: `npm start` için sıfır bağımlılıklı statik geliştirme sunucusu.
// Amaç: index.html'i file:// yerine http:// üzerinden açmak (ES modülleri, fetch ve
//        localStorage aynı kaynak kuralına tabidir; file:// bu özellikleri engeller).
// KURAL: çalışma zamanı paketi YOK — yalnızca Node'un kendi node: modülleri kullanılır.

import { createServer } from 'node:http';
import { createReadStream, promises as fs } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Sunulacak kök dizin: depo kökü (bu dosyanın bir üst klasörü). */
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

/** Varsayılan port; `PORT` ortam değişkeniyle değiştirilebilir. */
const BASE_PORT = Number(process.env.PORT) > 0 ? Number(process.env.PORT) : 5173;

/** Port doluysa denenecek ek port sayısı. */
const PORT_ATTEMPTS = 10;

/** Uzantı → MIME eşlemesi (tarayıcının modül/worker yüklemesi için doğru tip şart). */
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
};

/**
 * İstek yolunu kök dizin içindeki güvenli bir dosya yoluna çevirir.
 * `..` ile kök dışına çıkma denemeleri reddedilir (null döner).
 * @param {string} requestUrl - HTTP istek adresi
 * @param {string} [root=ROOT] - kök dizin (test için enjekte edilebilir)
 * @returns {string|null} mutlak dosya yolu veya geçersizse null
 */
export function resolveRequestPath(requestUrl, root = ROOT) {
  // Kök dizin sonunda ayraç olsa bile karşılaştırma tutarlı olsun (resolve ayracı kırpar).
  const base = resolve(root);

  let pathname = '/';
  try {
    pathname = decodeURIComponent(new URL(requestUrl, 'http://localhost').pathname);
  } catch {
    // Bozuk yüzde kodlaması (`/%zz`) veya ayrıştırılamayan adres: güvenli taraf.
    return null;
  }

  const target = resolve(join(base, normalize(pathname)));
  if (target !== base && !target.startsWith(base + sep)) return null;
  return target;
}

/** Basit HTML yanıt gövdesi üretir (404/405 için). */
function htmlPage(title, message) {
  return `<!DOCTYPE html><html lang="tr"><meta charset="utf-8">`
    + `<title>${title}</title>`
    + `<body style="font-family:system-ui;padding:2rem">`
    + `<h1>${title}</h1><p>${message}</p>`
    + `<p><a href="/">Ana sayfaya dön</a></p></body></html>`;
}

/** Yanıt gönderir ve isteği kapatır. */
function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', ...headers });
  res.end(body);
}

/**
 * Statik dosya sunucusunu (başlatmadan) üretir; testler `listen(0)` ile bağlar.
 * @param {string} [root=ROOT] - sunulacak kök dizin
 * @returns {import('node:http').Server}
 */
export function createStaticServer(root = ROOT) {
  return createServer(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      send(res, 405, htmlPage('405 - Yöntem desteklenmiyor', 'Yalnızca GET ve HEAD kabul edilir.'));
      return;
    }

    const requested = resolveRequestPath(req.url || '/', root);
    if (!requested) {
      send(res, 403, htmlPage('403 - Geçersiz yol', 'İstek yolu kök dizin dışına çıkıyor.'));
      return;
    }

    // Klasör istendiğinde index.html sunulur (statik sitenin giriş noktası).
    let filePath = requested;
    try {
      const stats = await fs.stat(filePath);
      if (stats.isDirectory()) filePath = join(filePath, 'index.html');
    } catch {
      send(res, 404, htmlPage('404 - Bulunamadı', `${req.url} için dosya yok.`));
      return;
    }

    let stats;
    try {
      stats = await fs.stat(filePath);
      if (!stats.isFile()) throw new Error('not-a-file');
    } catch {
      send(res, 404, htmlPage('404 - Bulunamadı', `${req.url} için dosya yok.`));
      return;
    }

    const headers = {
      'Content-Type': MIME_TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': String(stats.size),
      // Geliştirme sunucusu: tarayıcı önbelleği bayat dosya göstermesin.
      'Cache-Control': 'no-store',
    };

    if (req.method === 'HEAD') {
      res.writeHead(200, headers);
      res.end();
      return;
    }

    res.writeHead(200, headers);
    createReadStream(filePath).pipe(res);
  });
}

/**
 * İlk boş portu bulup sunucuyu başlatır; port doluysa sırayla sonrakini dener.
 * @param {import('node:http').Server} server
 * @param {number} port
 * @param {number} remaining
 */
function listen(server, port, remaining) {
  server.once('error', (error) => {
    if (error && error.code === 'EADDRINUSE' && remaining > 0) {
      listen(server, port + 1, remaining - 1);
      return;
    }
    console.error(`Sunucu başlatılamadı: ${error && error.message}`);
    process.exitCode = 1;
  });

  server.listen(port, () => {
    const address = server.address();
    const activePort = address && typeof address === 'object' ? address.port : port;
    console.log(`TokenCost FinOps: http://localhost:${activePort}/`);
    console.log(`Kök dizin: ${ROOT}`);
    console.log('Durdurmak için Ctrl+C.');
  });
}

// Yalnızca doğrudan çalıştırıldığında başlat (import edildiğinde testler kendi portunu seçer).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  listen(createStaticServer(), BASE_PORT, PORT_ATTEMPTS);
}

