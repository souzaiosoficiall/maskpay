import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { savePushSubscription, deletePushSubscription } from "@/lib/push.functions";
import {
  ensurePushServiceWorker,
  getExistingPushSubscription,
  getNotificationPermission,
  getPushSupport,
  isStandalonePWA,
  requestNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  type PushDiagnosticState,
} from "@/lib/push-client";

const VAPID_PUBLIC_KEY = (import.meta as any).env?.["VITE_VAPID_PUBLIC_KEY"] as string | undefined;

export interface PushNotificationsState {
  state: PushDiagnosticState;
  /** Human-readable reason, always set when state isn't "ready"/"checking". */
  reason: string | null;
  isStandalone: boolean;
  permission: NotificationPermission | "unsupported";
  /** True once we've confirmed a subscription exists AND is saved on the backend. */
  isFullyActive: boolean;
  /** Kicks off the permission request + subscription flow (call from a user gesture). */
  activate: () => Promise<void>;
  /** Re-runs the whole verification flow (e.g. after returning to the app). */
  refresh: () => Promise<void>;
}

/**
 * Drives the complete Web Push activation + verification flow described in
 * the audit: detect PWA install -> check platform support -> Service
 * Worker active -> permission -> Push Subscription -> persist on backend.
 *
 * Crucially, this never treats `Notification.permission === "granted"` as
 * "done" — it always verifies a live Push Subscription exists and has been
 * persisted server-side before reporting `state: "ready"`.
 */
export function usePushNotifications(enabled: boolean): PushNotificationsState {
  const [state, setState] = useState<PushDiagnosticState>("checking");
  const [reason, setReason] = useState<string | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");

  const doSave = useServerFn(savePushSubscription);
  const doDelete = useServerFn(deletePushSubscription);
  const runningRef = useRef(false);

  const run = useCallback(
    async (opts: { requestPermission: boolean }) => {
      if (runningRef.current) return;
      runningRef.current = true;

      try {
        const standalone = isStandalonePWA();
        setIsStandalone(standalone);

        if (!standalone) {
          setState("pwa_not_installed");
          setReason("Adicione a MaskPay à Tela de Início para ativar as notificações push.");
          return;
        }

        const support = getPushSupport();
        if (!support.supported) {
          setState("unsupported");
          setReason(
            "Este dispositivo/navegador não suporta notificações push (é necessário iOS 16.4+ com o app na Tela de Início).",
          );
          return;
        }

        if (!VAPID_PUBLIC_KEY) {
          setState("backend_failed");
          setReason("Configuração de push ausente (VITE_VAPID_PUBLIC_KEY). Contate o suporte.");
          return;
        }

        let currentPermission = getNotificationPermission();
        setPermission(currentPermission);

        if (currentPermission === "denied") {
          setState("permission_denied");
          setReason("As notificações estão bloqueadas nas configurações do dispositivo/navegador.");
          return;
        }

        if (currentPermission === "default") {
          if (!opts.requestPermission) {
            setState("permission_default");
            setReason("Notificações ainda não foram solicitadas.");
            return;
          }
          currentPermission = await requestNotificationPermission();
          setPermission(currentPermission);

          if (currentPermission !== "granted") {
            setState(currentPermission === "denied" ? "permission_denied" : "permission_default");
            setReason(
              currentPermission === "denied"
                ? "Você negou a permissão de notificações."
                : "Permissão de notificações não concedida.",
            );
            return;
          }
        }

        // Permission is granted from here on — but that alone proves
        // nothing. Register the SW, make sure it's active, then verify (or
        // create) a real Push Subscription and persist it server-side.
        setState("sw_registering");
        let registration: ServiceWorkerRegistration;
        try {
          registration = await ensurePushServiceWorker();
        } catch (err) {
          setState("sw_failed");
          setReason(err instanceof Error ? err.message : "Falha ao registrar o Service Worker.");
          return;
        }

        setState("subscribing");
        let subscription = await getExistingPushSubscription(registration);
        if (!subscription) {
          try {
            subscription = await subscribeToPush(registration, VAPID_PUBLIC_KEY);
          } catch (err) {
            setState("subscribe_failed");
            setReason(
              err instanceof Error ? err.message : "Falha ao criar a inscrição de Push (Push Subscription).",
            );
            return;
          }
        }

        try {
          await doSave({
            data: {
              endpoint: subscription.endpoint,
              p256dh: subscription.p256dh,
              auth: subscription.auth,
              userAgent: navigator.userAgent,
              platform: standalone ? "pwa" : "web",
            },
          });
        } catch (err) {
          setState("backend_failed");
          setReason(
            err instanceof Error
              ? `Não foi possível salvar a inscrição no servidor: ${err.message}`
              : "Não foi possível salvar a inscrição no servidor.",
          );
          return;
        }

        setState("ready");
        setReason(null);
      } finally {
        runningRef.current = false;
      }
    },
    [doSave],
  );

  const activate = useCallback(async () => {
    await run({ requestPermission: true });
  }, [run]);

  const refresh = useCallback(async () => {
    await run({ requestPermission: false });
  }, [run]);

  useEffect(() => {
    if (!enabled) return;
    void run({ requestPermission: false });

    // Detect the user granting permission from OS/browser settings after a
    // prior denial or ignore, by re-checking whenever the app regains
    // focus — there is no reliable permission-change event, so polling on
    // visibility/focus is the closest reliable signal.
    const onVisible = () => {
      if (document.visibilityState === "visible") void run({ requestPermission: false });
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    // If the SW detects an OS-level pushsubscriptionchange event, re-sync.
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "PUSH_SUBSCRIPTION_CHANGED") void run({ requestPermission: false });
    };
    navigator.serviceWorker?.addEventListener?.("message", onMessage);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      navigator.serviceWorker?.removeEventListener?.("message", onMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return {
    state,
    reason,
    isStandalone,
    permission,
    isFullyActive: state === "ready",
    activate,
    refresh,
  };
}

// Re-exported for components that need to fully opt a user out (e.g. a
// future "disable notifications" setting).
export async function disablePushNotifications(
  doDelete: (opts: { data: { endpoint: string } }) => Promise<unknown>,
): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  if (!registration) return;
  const existing = await getExistingPushSubscription(registration);
  await unsubscribeFromPush(registration);
  if (existing) {
    await doDelete({ data: { endpoint: existing.endpoint } }).catch(() => undefined);
  }
}
