import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  userAgent: z.string().optional(),
  platform: z.string().optional(),
});

/**
 * Persists (or refreshes) a Push Subscription for the authenticated user.
 * Upserts by endpoint so re-registering on every app open never creates
 * duplicate rows.
 */
export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => subscriptionSchema.parse(data))
  .handler(async ({ data: input, context }) => {
    const { userId } = context as { userId: string };

    const { data, error } = await (supabaseAdmin as any)
      .from("push_subscriptions")
      .upsert(
        {
          user_id: userId,
          endpoint: input.endpoint,
          p256dh: input.p256dh,
          auth: input.auth,
          user_agent: input.userAgent || null,
          platform: input.platform || "web",
          status: "active",
          last_error: null,
        },
        { onConflict: "endpoint" },
      )
      .select("id, status")
      .single();

    if (error) throw new Error(`Falha ao salvar a inscrição de push: ${error.message}`);
    return data;
  });

/**
 * Removes a subscription (e.g. the user revoked permission or the SW
 * unsubscribed it). Only ever touches rows owned by the caller.
 */
export const deletePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ endpoint: z.string().url() }).parse(data))
  .handler(async ({ data: input, context }) => {
    const { userId } = context as { userId: string };

    const { error } = await (supabaseAdmin as any)
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", input.endpoint)
      .eq("user_id", userId);

    if (error) throw new Error(`Falha ao remover a inscrição de push: ${error.message}`);
    return { success: true };
  });

/**
 * Server-side half of the diagnostics panel: whether VAPID is configured
 * and how many active/invalid subscriptions this user currently has.
 * Never returns secrets.
 */
export const getPushBackendStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };

    const vapidConfigured = Boolean(
      process.env["VAPID_PUBLIC_KEY"] && process.env["VAPID_PRIVATE_KEY_PKCS8"],
    );

    const { data, error } = await (supabaseAdmin as any)
      .from("push_subscriptions")
      .select("id, status, endpoint, created_at, last_success_at, last_error")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    // A tabela pode ainda não existir no banco (migração não aplicada).
    // Nesse caso devolvemos um diagnóstico em vez de derrubar a tela.
    const tableMissing =
      !!error && /schema cache|does not exist|relation .* does not exist/i.test(error.message);

    if (error && !tableMissing) {
      throw new Error(`Falha ao consultar diagnóstico de push: ${error.message}`);
    }

    const rows = (data || []) as any[];
    return {
      vapidConfigured,
      tableMissing,
      activeCount: rows.filter((r) => r.status === "active").length,
      invalidCount: rows.filter((r) => r.status === "invalid").length,

      subscriptions: rows.map((r) => ({
        id: r.id,
        status: r.status,
        endpointHost: safeHost(r.endpoint),
        createdAt: r.created_at,
        lastSuccessAt: r.last_success_at,
        lastError: r.last_error,
      })),
    };
  });

/**
 * Sends a harmless test push to every active subscription of the current
 * user. Used by the in-app diagnostics panel to verify true end-to-end
 * delivery (permission "granted" is not proof push actually arrives).
 */
export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    const { sendPushToUser } = await import("@/lib/push-send.server");

    return sendPushToUser(userId, {
      title: "MaskPay",
      body: "Notificação de teste — se você viu isso, o Push está funcionando!",
      url: "/dashboard",
      tag: "test-push",
    });
  });

function safeHost(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    return "desconhecido";
  }
}
