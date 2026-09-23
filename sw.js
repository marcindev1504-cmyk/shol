const CACHE_NAME = 'kompas-wiedzy-v7'
const BASE = self.registration.scope
const APP_SHELL = [BASE, BASE + 'index.html', BASE + 'manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))))
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (url.pathname.startsWith('/@') || url.pathname.startsWith('/src/')) return

  // Nawigacje i dokument HTML: sieć przede wszystkim, cache jako fallback offline.
  if (event.request.mode === 'navigate' || url.pathname === BASE || url.pathname.endsWith('.html')) {
    event.respondWith(fetch(event.request).then((response) => {
      const copy = response.clone()
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
      return response
    }).catch(() => caches.match(event.request).then((cached) => cached ?? caches.match(BASE))))
    return
  }

  // Statyczne zasoby: network-first — zawsze próbuj najnowszej wersji.
  event.respondWith(fetch(event.request).then((response) => {
    const copy = response.clone()
    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
    return response
  }).catch(() => caches.match(event.request)))
})
