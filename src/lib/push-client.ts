// Client-only helpers for the Web Push flow. Deliberately conservative:
// every check is a real feature/API detection, never a guess, so we never
// tell the user "notifications ativadas" when they aren't really working.

export type PushDiagnosticState =
  | "checking"
  | "pwa_not_installed"
  | "unsupported"
  | "permission_default"
  | "permission_denied"
  | "sw_registering"
  | "sw_failed"
  | "subscribing"
  | "subscribe_failed"
  | "backend_failed"
  | "ready";

const SW_PATH = "/sw.js";
const SW_SCOPE = "/";

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isAppleTouch = /iphone|ipad|ipod/i.test(ua);
  // iPadOS 13+ reports as "MacIntel" with touch support — distinguish
  // from a real Mac by checking for touch points.
  const isIPadOsDesktopUa =
    navigator.platform === "MacIntel" && "maxTouchPoints" in navigator && navigator.maxTouchPoints > 1;
  return isAppleTouch || isIPadOsDesktopUa;
}

/**
 * Reliable check for "running as an installed PWA / added to Home Screen".
 * Uses only real, documented signals — never invents a detection method.
 *  - display-mode: standalone/minimal-ui/fullscreen media query (most browsers)
 *  - navigator.standalone (iOS Safari's own installed-PWA flag)
 *  - Android TWA referrer marker
 */
export function isStandalonePWA(): boolean {
  if (typeof window === "undefined") return false;

  const displayModeStandalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: minimal-ui)").matches ||
    window.matchMedia?.("(display-mode: fullscreen)").matches;

  const iosStandalone = (window.navigator as any).standalone === true;
  const androidTwa = document.referrer?.startsWith("android-app://") ?? false;

  return Boolean(displayModeStandalone || iosStandalone || androidTwa);
}

export interface PushSupport {
  serviceWorker: boolean;
  pushManager: boolean;
  notification: boolean;
  supported: boolean;
}

export function getPushSupport(): PushSupport {
  const serviceWorker = typeof navigator !== "undefined" && "serviceWorker" in navigator;
  const pushManager = typeof window !== "undefined" && "PushManager" in window;
  const notification = typeof window !== "undefined" && "Notification" in window;
  return {
    serviceWorker,
    pushManager,
    notification,
    supported: serviceWorker && pushManager && notification,
  };
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

/**
 * Registers (or reuses) the single push Service Worker and resolves once
 * it is actually active — not merely "registered". Also defensively
 * unregisters any stray registrations from a different script/scope so we
 * never end up with duplicate Service Workers fighting over push events.
 */
export async function ensurePushServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service Worker não é suportado neste navegador/ambiente.");
  }

  const existingRegistrations = await navigator.serviceWorker.getRegistrations();
  for (const reg of existingRegistrations) {
    const scriptUrl = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || "";
    if (reg.scope === new URL(SW_SCOPE, window.location.origin).href && !scriptUrl.endsWith(SW_PATH)) {
      // A different, stale service worker owns this scope — remove it so
      // it can't shadow push events intended for our SW.
      await reg.unregister().catch(() => undefined);
    }
  }

  const registration = await navigator.serviceWorker.register(SW_PATH, { scope: SW_SCOPE });
  await navigator.serviceWorker.ready;

  if (!registration.active) {
    // Give the browser one more tick to finish activating.
    await new Promise<void>((resolve) => {
      const check = () => (registration.active ? resolve() : setTimeout(check, 100));
      check();
    });
  }

  return registration;
}

export interface RawPushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

function toRawSubscription(sub: PushSubscription): RawPushSubscription {
  const json = sub.toJSON();
  const keys = json.keys || {};
  if (!json.endpoint || !keys["p256dh"] || !keys["auth"]) {
    throw new Error("Push Subscription incompleta retornada pelo navegador.");
  }
  return { endpoint: json.endpoint, p256dh: keys["p256dh"], auth: keys["auth"] };
}

/**
 * Returns the existing Push Subscription for this SW registration, if any.
 * Does NOT create one — use `subscribeToPush` for that.
 */
export async function getExistingPushSubscription(
  registration: ServiceWorkerRegistration,
): Promise<RawPushSubscription | null> {
  const sub = await registration.pushManager.getSubscription();
  return sub ? toRawSubscription(sub) : null;
}

/**
 * Creates a brand new Push Subscription. Assumes Notification.permission
 * is already "granted" — call requestNotificationPermission first.
 */
export async function subscribeToPush(
  registration: ServiceWorkerRegistration,
  vapidPublicKey: string,
): Promise<RawPushSubscription> {
  const sub = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey).buffer as ArrayBuffer,
  });
  return toRawSubscription(sub);
}

export async function unsubscribeFromPush(registration: ServiceWorkerRegistration): Promise<void> {
  const sub = await registration.pushManager.getSubscription();
  if (sub) await sub.unsubscribe();
}

/**
 * Requests notification permission. Must be called from a user gesture on
 * most browsers, or right after the user opts in via our own UI — never
 * fired silently on first paint.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied";
  return Notification.requestPermission();
}

const DISMISS_KEY = "maskpay_push_prompt_dismissed_at";
const DISMISS_COOLDOWN_MS = 1000 * 60 * 60 * 24 * 3; // 3 days

export function wasPushPromptRecentlyDismissed(): boolean {
  if (typeof window === "undefined") return false;
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const dismissedAt = Number(raw);
  if (Number.isNaN(dismissedAt)) return false;
  return Date.now() - dismissedAt < DISMISS_COOLDOWN_MS;
}

export function markPushPromptDismissed(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DISMISS_KEY, String(Date.now()));
}
