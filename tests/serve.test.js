// tests/serve.test.js
// Araç: `npm start` (scripts/serve.mjs) statik sunucu sözleşmesi.
// Kapsam: kök → index.html, modül MIME tipi, 404/405, HEAD gövdesizlik, kök dışına çıkma koruması.
// Ortam: gerçek HTTP (varsayılan node ortamı); sunucu 0 numaralı portta dinler, çakışma olmaz.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { fileURLToPath } from 'node:url';
import { join, resolve, sep } from 'node:path';
import { createStaticServer, resolveRequestPath } from '../scripts/serve.mjs';

/** Depo kökü (test dosyasından bir üst klasör); resolve, son ayracı kırpar. */
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

/** @type {import('node:http').Server} */
let server;
/** @type {string} */
let baseUrl;

beforeAll(async () => {
  server = createStaticServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('Araç: npm start statik sunucu (scripts/serve.mjs)', () => {
  it('kök isteğinde index.html sunar (text/html)', async () => {
    const res = await fetch(`${baseUrl}/`);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(await res.text()).toContain('TokenCost');
  });

  it('ES modüllerini doğru MIME tipiyle sunar (modül yüklemesi için şart)', async () => {
    const res = await fetch(`${baseUrl}/src/main.js`);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/javascript');
  });

  it('geliştirme sırasında bayat dosya göstermemek için önbelleği kapatır', async () => {
    const res = await fetch(`${baseUrl}/styles.css`);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/css');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('olmayan dosya için 404, GET/HEAD dışı yöntemler için 405 döner', async () => {
    const missing = await fetch(`${baseUrl}/yok-boyle-dosya.js`);
    const wrongMethod = await fetch(`${baseUrl}/`, { method: 'POST' });

    expect(missing.status).toBe(404);
    expect(wrongMethod.status).toBe(405);
  });

  it('HEAD isteğinde gövde göndermez ama uzunluğu bildirir', async () => {
    const res = await fetch(`${baseUrl}/index.html`, { method: 'HEAD' });

    expect(res.status).toBe(200);
    expect(Number(res.headers.get('content-length'))).toBeGreaterThan(0);
    expect(await res.text()).toBe('');
  });

  it('bozuk yüzde kodlamalı yolu 403 ile bloklar (güvenli taraf)', async () => {
    const res = await fetch(`${baseUrl}/%zz`);

    expect(res.status).toBe(403);
    expect(await res.text()).toContain('Geçersiz yol');
  });

  it('kök dizin dışına çıkan her yol ya reddedilir ya da kök altında kalır', () => {
    const attempts = [
      '/%2e%2e',
      '/%2e%2e/%2e%2e/%2e%2e/gizli.txt',
      '/..%2f..%2fpackage.json',
      '/%2e%2e%2fgizli.txt',
      '/src/main.js',
      '/',
    ];

    for (const attempt of attempts) {
      const resolved = resolveRequestPath(attempt, ROOT);
      expect(resolved === null || resolved.startsWith(ROOT)).toBe(true);
    }
  });

  it('normalize edilen geçerli yolları kök altında çözer', () => {
    expect(resolveRequestPath('/./src/../src/main.js', ROOT)).toBe(join(ROOT, 'src', 'main.js'));
    expect(resolveRequestPath('/', ROOT)).toBe(ROOT);
    // Sonunda ayraç bulunan kök de kabul edilir (çağıran taraf normalize etmese bile).
    expect(resolveRequestPath('/styles.css', `${ROOT}${sep}`)).toBe(join(ROOT, 'styles.css'));
  });
});
