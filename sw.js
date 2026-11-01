/* Pharmalens – service worker: funziona anche senza rete.
   Quando pubblichi una nuova versione dell'app, cambia il numero qui sotto. */
const VERSION = "pharmalens-v1";
const CORE = ["./", "index.html", "farmaci.json", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // pagina e database farmaci: prima la rete (aggiornamenti), poi la copia offline
  if (url.origin === location.origin && (req.mode === "navigate" || url.pathname.endsWith("farmaci.json") || url.pathname.endsWith("index.html"))) {
    e.respondWith(fetch(req).then(r => {
      if (r.ok) { const cp = r.clone(); caches.open(VERSION).then(c => c.put(req.mode === "navigate" ? "index.html" : req, cp)); }
      return r;
    }).catch(() => caches.match(req.mode === "navigate" ? "index.html" : req, { ignoreSearch: true })));
    return;
  }
  // resto (icone, font Google): prima la copia salvata, poi la rete
  if (url.origin === location.origin || url.hostname.endsWith("fonts.googleapis.com") || url.hostname.endsWith("fonts.gstatic.com")) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok || r.type === "opaque") { const cp = r.clone(); caches.open(VERSION).then(c => c.put(req, cp)); }
      return r;
    })));
  }
});
