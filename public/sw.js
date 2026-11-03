// Mix Print Design service worker: small and safe.
// - Caches only static files (Next.js build files, icons, logos, fonts) and the offline page.
// - Pages, prices, orders, Admin, API, login and affiliate data are NEVER cached: they always come live from the
//   website. When there is no internet, page visits show the offline page instead.
const CACHE = "mixprint-static-v1";
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/icon-192.png", "/icon-512.png", "/brand/mix-print-design-icon.png", "/brand/logo-light.svg", "/brand/logo-dark.svg"];

// Never touched by the service worker: always straight to the network.
const LIVE_ONLY = [/^\/admin/, /^\/api\//, /^\/login/, /^\/register/, /^\/account/, /^\/forgot-password/, /^\/cart/, /^\/order/, /^\/track/, /^\/affiliate/, /^\/r\//, /^\/design-approval/, /^\/media\//];

// Static files that never change at the same address.
const isStatic = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  url.pathname.startsWith("/brand/") ||
  /^\/(icon[^/]*|apple-icon[^/]*|favicon\.ico)$/.test(url.pathname) ||
  /\.(woff2?|ttf|otf)$/.test(url.pathname);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("mixprint-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (LIVE_ONLY.some((re) => re.test(url.pathname))) return;

  // Pages: always live; only when offline, the offline page.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Static files: from the cache when we have them, otherwise fetched and kept.
  if (isStatic(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok && response.type === "basic") {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
  // Everything else (data, images, prices): the browser handles it normally, live.
});
