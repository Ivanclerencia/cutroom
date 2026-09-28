// Service worker de Splice: guarda la app en el dispositivo para abrirla al instante.
// - Página: primero la red (para recibir versiones nuevas); si tarda o no hay conexión, la copia guardada.
// - Archivos con huella (assets/*): se guardan para siempre, nunca cambian.
// - Resto (iconos, manifiesto): copia guardada y se actualiza en segundo plano.
// Las peticiones a Supabase (otro dominio) no pasan por aquí.
const CACHE = 'splice-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))

async function page(request) {
  const cache = await caches.open(CACHE)
  try {
    const res = await Promise.race([fetch(request), timeout(3000)])
    if (res.ok) {
      cache.put('./', res.clone())
      pruneAssets(cache, await res.clone().text())
    }
    return res
  } catch {
    return (await cache.match('./')) || fetch(request)
  }
}

// Borra archivos de versiones anteriores que la versión actual ya no usa.
// Revisa la página y también los scripts que ella carga (que a su vez cargan otros).
const names = (text) => [...text.matchAll(/[\w-]+-[\w-]{8}\.(?:js|css)/g)].map((m) => m[0])

async function pruneAssets(cache, html) {
  const used = new Set(names(html))
  for (const name of [...used]) {
    if (!name.endsWith('.js')) continue
    const url = new URL(`assets/${name}`, self.registration.scope)
    const res = (await cache.match(url)) || (await fetch(url).catch(() => null))
    if (res?.ok) names(await res.clone().text()).forEach((n) => used.add(n))
  }
  for (const req of await cache.keys()) {
    const file = new URL(req.url).pathname.split('/').pop()
    if (new URL(req.url).pathname.includes('/assets/') && !used.has(file)) cache.delete(req)
  }
}

async function asset(request) {
  const cache = await caches.open(CACHE)
  const hit = await cache.match(request)
  if (hit) return hit
  const res = await fetch(request)
  if (res.ok) cache.put(request, res.clone())
  return res
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE)
  const hit = await cache.match(request)
  const update = fetch(request).then((res) => {
    if (res.ok) cache.put(request, res.clone())
    return res
  })
  return hit || update
}

self.addEventListener('fetch', (e) => {
  const { request } = e
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  if (request.mode === 'navigate') return e.respondWith(page(request))
  if (url.pathname.includes('/assets/')) return e.respondWith(asset(request))
  e.respondWith(staleWhileRevalidate(request))
})
