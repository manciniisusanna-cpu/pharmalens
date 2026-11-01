/* Pharmalens – service worker: funziona anche senza rete.
   Quando pubblichi una nuova versione dell'app, cambia il numero qui sotto. */
const VERSION = "pharmalens-v2";
const CORE = ["index.html", "farmaci.json", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png"];
const FONTS = "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Barlow+Condensed:wght@600;700&family=JetBrains+Mono:wght@400;500&display=swap";

async function precache() {
  const c = await caches.open(VERSION);
  // un file alla volta: se uno manca, gli altri vengono salvati comunque
  for (const u of CORE) {
    try { const r = await fetch(u, { cache: "reload" }); if (r.ok) await c.put(u, r); } catch (e) {}
  }
  try { const r = await fetch(FONTS, { mode: "no-cors" }); await c.put(FONTS, r); } catch (e) {}
}
self.addEventListener("install", e => { e.waitUntil(precache().then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
    .then(() => self.clients.matchAll()).then(cs => cs.forEach(c => c.postMessage("pronta"))));
});

function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)); }

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const same = url.origin === location.origin;
  const isPage = req.mode === "navigate" || (same && url.pathname.endsWith("/index.html"));
  if (isPage || (same && url.pathname.endsWith("farmaci.json"))) {
    const key = isPage ? "index.html" : "farmaci.json";
    // prima la rete (per gli aggiornamenti) ma con limite di 4 s, poi la copia salvata
    e.respondWith(Promise.race([fetch(req), timeout(4000)]).then(r => {
      if (r.ok) { const cp = r.clone(); caches.open(VERSION).then(c => c.put(key, cp)); }
      return r;
    }).catch(() => caches.open(VERSION).then(c => c.match(key)).then(hit => hit || Response.error())));
    return;
  }
  if (same || url.hostname.endsWith("fonts.googleapis.com") || url.hostname.endsWith("fonts.gstatic.com")) {
    e.respondWith(caches.match(req, { ignoreSearch: same }).then(hit => hit || fetch(req).then(r => {
      if (r.ok || r.type === "opaque") { const cp = r.clone(); caches.open(VERSION).then(c => c.put(req, cp)); }
      return r;
    })));
  }
});
