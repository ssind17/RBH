/* RBH service worker: makes the app work offline and installable.
   Bump VERSION whenever you publish a new release so every device picks it up. */
const VERSION = "1.201026";
const CACHE = "rbh-static-" + VERSION;
// The app itself must be cached. Icons are cached too, but a missing icon never blocks installation.
const CORE = ["./", "index.html", "manifest.webmanifest"];
const EXTRA = ["favicon.ico", "favicon-32.png", "icon-96.png", "icon-192.png", "icon-512.png", "icon-maskable-192.png", "icon-maskable-512.png", "apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(CORE).then(() => Promise.all(EXTRA.map((f) => cache.add(f).catch(() => null)))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("rbh-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Serve from the cache straight away (so it opens instantly, even offline),
   and quietly refresh the cached copy in the background. */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Only the app itself is served from the cache. Any other address falls through to the network,
  // so a mistyped URL still shows the proper "page not found" screen.
  const isPage = req.mode === "navigate" && (url.pathname.endsWith("/") || url.pathname.endsWith("/index.html"));
  if (req.mode === "navigate" && !isPage) return;
  const key = isPage ? "index.html" : req;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(key, { ignoreSearch: isPage });
      const refresh = fetch(isPage ? "index.html" : req, { cache: "no-cache" })
        .then((res) => {
          if (res && res.ok && res.type === "basic") cache.put(key, res.clone());
          return res;
        })
        .catch(() => null);
      if (cached) {
        event.waitUntil(refresh);
        return cached;
      }
      const res = await refresh;
      if (res) return res;
      return isPage
        ? new Response("RBH is offline and hasn't been saved on this device yet. Please reconnect once and reload.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })
        : Response.error();
    })
  );
});
