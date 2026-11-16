/* WisdomScroll service worker: keeps a copy of the app on the device so it opens offline. */
const SHELL = "wisdomscroll-shell-v1";
const FONTS = "wisdomscroll-fonts-v1";
const FILES = ["./", "index.html", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    const isPage = req.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith("/index.html");
    if (isPage) {
      // Network first, so a new version arrives the moment it is published.
      // The saved copy is used only when there is no connection.
      event.respondWith(
        fetch(req)
          .then((res) => {
            if (res.ok) { const copy = res.clone(); caches.open(SHELL).then((c) => c.put("index.html", copy)); }
            return res;
          })
          .catch(() => caches.match("index.html").then((hit) => hit || caches.match("./")))
      );
      return;
    }
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(SHELL).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
    return;
  }

  // Fonts: serve the saved copy at once and refresh it in the background.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(
      caches.open(FONTS).then((c) => c.match(req).then((hit) => {
        const fresh = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || fresh;
      }))
    );
  }
  // Everything else (AI providers, sync, book covers) goes straight to the network.
});
