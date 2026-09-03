const CACHE_NAME = "fasobar-shell-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request));
});

// --- Notifications push -----------------------------------------------------
// Reçues même app fermée : le navigateur réveille ce service worker pour
// afficher la notification, indépendamment de tout onglet FasoBar ouvert.

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || "FasoBar";
  const options = {
    body: payload.body || "",
    icon: "/brand/fasobar-icon-192.png",
    badge: "/brand/fasobar-icon-192.png",
    tag: payload.tag || undefined,
    data: { href: payload.href || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = (event.notification.data && event.notification.data.href) || "/";

  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clientsList) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(href);
            } catch {
              // ignore, la fenêtre reste focus même si la navigation échoue
            }
          }
          return;
        }
      }
      await self.clients.openWindow(href);
    })(),
  );
});
