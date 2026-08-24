// Server-only. Fans a push payload out to every active subscription a user
// has, and reconciles subscription status based on what each push service
// reports back. Never throws — a push failure must never break the caller
// (login, payments, withdrawals, etc keep working regardless).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getVapidConfig, sendWebPush, type PushPayload } from "@/lib/webpush.server";

export interface SendPushSummary {
  attempted: number;
  delivered: number;
  removed: number;
  vapidConfigured: boolean;
  errors: string[];
}

/**
 * Sends `payload` to every active push subscription belonging to `userId`.
 * Subscriptions that the push service reports as gone (404/410) are marked
 * invalid so we stop retrying them; the next foreground app open will
 * re-subscribe automatically.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<SendPushSummary> {
  const summary: SendPushSummary = {
    attempted: 0,
    delivered: 0,
    removed: 0,
    vapidConfigured: false,
    errors: [],
  };

  const vapid = getVapidConfig();
  if (!vapid) {
    summary.errors.push(
      "VAPID não configurado no backend (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY_PKCS8 ausentes).",
    );
    console.error("[push] VAPID env vars missing — cannot send push notifications");
    return summary;
  }
  summary.vapidConfigured = true;

  try {
    const { data: subs, error } = await (supabaseAdmin as any)
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", userId)
      .eq("status", "active");

    if (error) {
      summary.errors.push(error.message);
      console.error("[push] Failed to load subscriptions:", error);
      return summary;
    }

    const rows = (subs || []) as Array<{ id: string; endpoint: string; p256dh: string; auth: string }>;
    summary.attempted = rows.length;

    await Promise.all(
      rows.map(async (row) => {
        const result = await sendWebPush(
          { endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth },
          payload,
          vapid,
        );

        if (result.ok) {
          summary.delivered++;
          await (supabaseAdmin as any)
            .from("push_subscriptions")
            .update({ last_success_at: new Date().toISOString(), last_error: null })
            .eq("id", row.id);
          return;
        }

        if (result.shouldRemove) {
          summary.removed++;
          await (supabaseAdmin as any)
            .from("push_subscriptions")
            .update({ status: "invalid", last_error: result.error || `HTTP ${result.status}` })
            .eq("id", row.id);
          return;
        }

        summary.errors.push(result.error || `HTTP ${result.status}`);
        await (supabaseAdmin as any)
          .from("push_subscriptions")
          .update({ last_error: result.error || `HTTP ${result.status}` })
          .eq("id", row.id);
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido ao enviar push";
    summary.errors.push(message);
    console.error("[push] Unexpected error sending push:", err);
  }

  return summary;
}

function formatBRL(amount: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(amount) || 0);
}

/**
 * Notifies the wallet owner that a PIX deposit was confirmed.
 * Style similar to bank apps: title + amount + origin.
 */
export async function notifyPixDepositConfirmed(
  walletId: string,
  opts?: { amount?: number; origin?: string | null },
): Promise<SendPushSummary | null> {
  try {
    const { data: wallet, error } = await (supabaseAdmin as any)
      .from("wallets")
      .select("user_id")
      .eq("id", walletId)
      .maybeSingle();

    if (error || !wallet?.user_id) {
      console.error("[push] Could not resolve wallet owner for push:", error);
      return null;
    }

    const amount = opts?.amount != null ? Number(opts.amount) : null;
    const origin = (opts?.origin || "").trim() || "PIX";

    const body =
      amount != null && !Number.isNaN(amount)
        ? `Você recebeu ${formatBRL(amount)} de ${origin}.`
        : `Você recebeu um pagamento via ${origin}.`;

    return await sendPushToUser(wallet.user_id, {
      title: "MaskPay | Pagamento recebido",
      body,
      url: "/dashboard",
      tag: "pix-deposit",
      data: {
        type: "pix_deposit",
        walletId,
        amount: amount ?? undefined,
        origin,
      },
    });
  } catch (err) {
    console.error("[push] Unexpected error in notifyPixDepositConfirmed:", err);
    return null;
  }
}
