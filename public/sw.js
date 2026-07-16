// Service worker — PWA Chauffeur Élite Drive
// Stratégie : network-first pour la navigation et les API (données fraîches),
// avec repli sur le cache hors-ligne. Le shell et les icônes sont pré-cachés.

const CACHE = 'elite-chauffeur-v1'
const SHELL = ['/chauffeur', '/icon-192.png', '/icon-512.png', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return // ne jamais mettre en cache POST/PATCH

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (!url.pathname.startsWith('/chauffeur') &&
      !url.pathname.startsWith('/api/chauffeur') &&
      !url.pathname.startsWith('/icon') &&
      url.pathname !== '/manifest.webmanifest') return

  // Network-first, repli cache
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(request, copy))
        }
        return res
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match('/chauffeur')))
  )
})
