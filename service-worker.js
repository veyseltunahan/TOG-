/* TOGİ – service worker
   Strateji:
   - Uygulama kabuğu (index, manifest, ikonlar) kurulumda önbelleğe alınır.
   - Sayfa açılışı: önce ağ, ağ yoksa önbellek (güncelleme hemen gelir, çevrimdışı da açılır).
   - Aynı kaynaktaki dosyalar ve Google Fonts: önbellekten ver, arkada güncelle.
   - Diğer her şey (API çağrıları vb.) olduğu gibi ağa gider, hiç dokunulmaz.
   Uygulamayı güncelleyince VERSION değerini artır (togi-v2, togi-v3 ...). */
const VERSION = 'togi-v1';
const CORE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => Promise.allSettled(CORE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function staleWhileRevalidate(request) {
  return caches.open(VERSION).then((cache) =>
    cache.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Sayfa gezintisi: önce ağ, olmazsa önbellek
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match('./index.html') || caches.match('./')))
    );
    return;
  }
   

  // Aynı kaynak + Google Fonts: önbellek öncelikli, arkada yenile
  if (url.origin === self.location.origin || FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
