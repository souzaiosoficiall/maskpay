// MaskPay Service Worker
//
// Scope: "/" — this is the ONLY service worker for the app. It exists to
// receive Web Push events (this is a hard requirement on iOS/iPadOS: Push
// only works while installed as a Home Screen PWA and only through an
// active Service Worker) and to route notification taps back into the app.
//
// It intentionally does NOT implement caching/offline strategies — that
// was out of scope for this change and we don't want to alter existing
// app behavior.

const SW_VERSION = "maskpay-push-v2";

self.addEventListener("install", () => {
  // Activate this SW as soon as it's installed instead of waiting for all
  // tabs to close — push needs to work from the very first app open.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "MaskPay",
    body: "Você tem uma nova notificação.",
    url: "/dashboard",
  };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch (err) {
      // Not JSON — fall back to plain text body.
      payload.body = event.data.text() || payload.body;
    }
  }

  const options = {
    body: payload.body,
    icon: payload.icon || "/icon-192.png",
    badge: payload.badge || "/icon-192.png",
    tag: payload.tag || "maskpay-notification",
    data: {
      url: payload.url || "/dashboard",
      ...(payload.data || {}),
    },
    vibrate: [100, 50, 100],
  };

  event.waitUntil(
    (async () => {
      // Always show system notification
      await self.registration.showNotification(payload.title || "MaskPay", options);

      // Notify any open app windows so the in-app modal can appear in real time
      try {
        const allClients = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        const message = {
          type: "MASKPAY_FOREGROUND_NOTIFICATION",
          id: payload.id || payload.tag || `push-${Date.now()}`,
          title: payload.title || "MaskPay",
          body: payload.body || "",
          description: payload.body || "",
          url: payload.url || "/dashboard",
        };
        for (const client of allClients) {
          try {
            client.postMessage(message);
          } catch {
            // ignore per-client failures
          }
        }
        // Also broadcast for same-origin listeners
        try {
          const bc = new BroadcastChannel("maskpay-notifications");
          bc.postMessage(message);
          bc.close();
        } catch {
          // BroadcastChannel may be unavailable in some SW contexts
        }
      } catch {
        // ignore
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || "/dashboard";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

      for (const client of allClients) {
        try {
          const clientUrl = new URL(client.url);
          if (clientUrl.origin === self.location.origin && "focus" in client) {
            await client.focus();
            if ("navigate" in client) {
              await client.navigate(targetUrl);
            }
            return;
          }
        } catch {
          // Ignore malformed client URLs and keep looking.
        }
      }

      await self.clients.openWindow(targetUrl);
    })(),
  );
});

// If the browser/OS invalidates the current subscription (key rotation,
// user revoked in system settings, etc.) it fires this event so we can
// try to transparently re-subscribe and push the new endpoint to the
// backend. The page-side code also re-verifies on every foreground open,
// this is just an extra safety net while the SW is alive in the background.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const applicationServerKey = event.oldSubscription
          ? event.oldSubscription.options.applicationServerKey
          : null;
        if (!applicationServerKey) return;

        const newSubscription = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });

        const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const client of allClients) {
          client.postMessage({ type: "PUSH_SUBSCRIPTION_CHANGED", subscription: newSubscription.toJSON() });
        }
      } catch (err) {
        // Nothing we can do from here without a signed-in context; the
        // next foreground app open will detect the missing subscription
        // and recreate it.
      }
    })(),
  );
});
