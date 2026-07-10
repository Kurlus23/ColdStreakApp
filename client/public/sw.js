const CACHE_NAME = "coldstreak-v10";
const OFFLINE_URL = "/offline.html";

// Assets to pre-cache on install so they're instant on first use
const PRECACHE_ASSETS = [
  OFFLINE_URL,
  "/intro.mp4",
];

// Install — pre-cache critical assets including the intro video
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(
        PRECACHE_ASSETS.map((url) =>
          fetch(url, { cache: "no-store" })
            .then((res) => { if (res.ok) cache.put(url, res); })
            .catch(() => {})
        )
      )
    )
  );
  self.skipWaiting();
});

// Activate — clear old caches
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network first with offline fallback
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;

  const url = new URL(e.request.url);

  // Skip non-same-origin requests
  if (url.origin !== location.origin) return;

  // Skip the mockup preview sandbox entirely (dev-only canvas previews)
  if (url.pathname.startsWith("/__mockup")) return;

  // API: network only, empty fallback
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ error: "offline" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    return;
  }

  // Navigation: network first, offline page fallback
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(e.request);
          if (cached) return cached;
          const offline = await caches.match(OFFLINE_URL);
          return offline || new Response("You are offline", { status: 503 });
        })
    );
    return;
  }

  // Static assets: cache first, network fallback
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((res) => {
        if (res.ok && res.status < 400) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});

// Push — show notification (streak reminder, mood check-in, etc.)
self.addEventListener("push", (e) => {
  let data = { title: "ColdStreak 🧊", body: "Don't let your streak expire!", url: "/", tag: "streak-reminder" };
  try { if (e.data) data = { ...data, ...e.data.json() }; } catch {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-72.png",
      tag: data.tag || "streak-reminder",
      renotify: true,
      data: { url: data.url },
    })
  );
});

// Notification click — open or focus the app
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const targetUrl = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.postMessage({ type: "notification-navigate", url: targetUrl });
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
