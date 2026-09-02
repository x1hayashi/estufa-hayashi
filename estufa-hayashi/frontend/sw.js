// ============================================================
// SERVICE WORKER — Estufa Hayashi PWA
// Versão: 2.0
// ============================================================
// Estratégia:
//   - App shell (HTML, fontes, libs) → Cache First
//   - APIs externas (Anthropic, Apps Script) → Network Only
//   - Tudo mais → Network First com fallback para cache
// ============================================================

const CACHE_NAME    = 'hayashi-v2';
const CACHE_OFFLINE = 'hayashi-offline-v2';

// Arquivos do app shell — cacheados na instalação
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  'https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Sora:wght@300;400;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
];

// Domínios que NUNCA devem ser cacheados (sempre rede)
const NETWORK_ONLY = [
  'api.anthropic.com',
  'script.google.com',
  'fonts.gstatic.com',
];

// ── INSTALAÇÃO ────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cachear app shell — ignorar erros individuais
      return Promise.allSettled(
        APP_SHELL.map(url => cache.add(url).catch(() => null))
      );
    }).then(() => self.skipWaiting())
  );
});

// ── ATIVAÇÃO — limpar caches antigos ─────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== CACHE_OFFLINE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH — estratégia inteligente ────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Network Only — APIs externas
  if (NETWORK_ONLY.some(domain => url.hostname.includes(domain))) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 2. POST requests — sempre rede (nunca cachear)
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  // 3. App shell — Cache First
  if (
    url.pathname === '/' ||
    url.pathname.endsWith('.html') ||
    url.pathname === '/manifest.json' ||
    url.pathname.endsWith('.png')
  ) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // 4. Tudo mais — Network First com fallback para cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// ── MENSAGENS DO APP ──────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
  if (event.data === 'clearCache') {
    caches.delete(CACHE_NAME).then(() => {
      event.ports[0].postMessage({ ok: true });
    });
  }
});
