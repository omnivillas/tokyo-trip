// Tokyo trip service worker: app shell offline + map tile cache.
const SHELL = "tokyo-shell-20261029-0637";
const TILES = "tokyo-tiles-v1";
const ASSETS = ["./", "index.html", "manifest.webmanifest", "vendor/leaflet/leaflet.css", "vendor/leaflet/leaflet.js",
  "vendor/leaflet/images/marker-icon.png", "vendor/leaflet/images/marker-icon-2x.png", "vendor/leaflet/images/marker-shadow.png", "vendor/leaflet/images/layers.png", "vendor/leaflet/images/layers-2x.png",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-180.png"];
const MAX_TILES = 1200;

self.addEventListener("install", e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("tokyo-shell-") && k !== SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim())); });

self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname === "tile.openstreetmap.org") { e.respondWith(tile(req)); return; }
  if (url.origin !== location.origin) return;                       // sync API, weather, FX: straight to the network
  if (req.mode === "navigate" || url.pathname.endsWith("index.html")) { e.respondWith(networkFirst(req)); return; }
  e.respondWith(cacheFirst(req));
});

async function networkFirst(req) {
  const c = await caches.open(SHELL);
  try { const res = await fetch(req); if (res.ok) c.put("index.html", res.clone()); return res; }
  catch (err) { return (await c.match("index.html")) || (await c.match("./")) || Response.error(); }
}
async function cacheFirst(req) {
  const c = await caches.open(SHELL); const hit = await c.match(req); if (hit) return hit;
  const res = await fetch(req); if (res.ok) c.put(req, res.clone()); return res;
}
let tileCount = null;
async function tile(req) {
  const c = await caches.open(TILES); const hit = await c.match(req.url); if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok || res.type === "opaque") { c.put(req.url, res.clone()); trim(c); }
    return res;
  } catch (err) { return new Response("", { status: 504 }); }
}
async function trim(c) {
  if (tileCount === null) tileCount = (await c.keys()).length; else tileCount++;
  if (tileCount <= MAX_TILES) return;
  const keys = await c.keys(); const drop = keys.slice(0, keys.length - MAX_TILES + 100);
  await Promise.all(drop.map(k => c.delete(k))); tileCount = keys.length - drop.length;
}
