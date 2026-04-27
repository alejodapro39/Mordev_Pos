/**
 * Mordev POS — Service Worker
 * Estrategia: Network-first para la API, Cache-first para assets estáticos.
 * Permite uso offline básico del POS.
 */

const CACHE_NAME = 'mordev-pos-v2';

// Assets que se cachean en la instalación
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/app.js',
    '/styles.css',
    '/manifest.json',
    '/static/icon.png',
];

// ── Instalación: pre-cachear assets estáticos ─────────────────────────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS).catch(() => {
                // Si algún asset falla, continuar de todos modos
            });
        })
    );
    self.skipWaiting();
});

// ── Activación: limpiar caches viejas ─────────────────────────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((k) => k !== CACHE_NAME)
                    .map((k) => caches.delete(k))
            )
        )
    );
    self.clients.claim();
});

// ── Fetch: Network-first para /api/, Cache-first para el resto ────────────────
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Nunca cachear requests de API, pagos o webhooks
    if (
        url.pathname.startsWith('/api/') ||
        url.pathname.startsWith('/create_payment') ||
        url.pathname.startsWith('/webhook-pagos')
    ) {
        event.respondWith(fetch(event.request));
        return;
    }

    // Cache-first para assets estáticos
    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return fetch(event.request).then((response) => {
                if (!response || response.status !== 200) return response;
                const clone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                return response;
            });
        })
    );
});
