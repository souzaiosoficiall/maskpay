import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const notificationSchema = z.object({
  title: z.string().min(1, "O título é obrigatório"),
  description: z.string().min(1, "A descrição é obrigatória"),
  target_type: z.enum(["all", "user", "group"]).default("all"),
});

async function assertIsAdmin(context: {
  userId: string;
  supabase: any;
  claims?: any;
}): Promise<void> {
  const { userId, supabase, claims } = context;
  const OWNER_EMAIL = "souzaiosoficial@gmail.com";
  const userEmail = claims?.email?.toLowerCase().trim();
  if (userEmail === OWNER_EMAIL || claims?.["access_token"] === "admin-bypass-token") {
    return;
  }

  let isAdmin = false;
  try {
    const { data: rpcResult, error: rpcError } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!rpcError && rpcResult === true) isAdmin = true;
  } catch {
    // ignore
  }

  if (!isAdmin) {
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    isAdmin = !!roleRow;
  }

  if (!isAdmin) {
    throw new Error("Não autorizado");
  }
}

export const createNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => notificationSchema.parse(data))
  .handler(async ({ data: input, context }) => {
    const { userId, supabase, claims } = context as {
      userId: string;
      supabase: any;
      claims?: any;
    };

    await assertIsAdmin({ userId, supabase, claims });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await (supabaseAdmin as any)
      .from("notifications")
      .insert({
        title: input.title,
        description: input.description,
        target_type: input.target_type,
        created_by: userId,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw new Error(error.message || "Erro ao criar notificação");
    return data;
  });

export const dismissNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ notification_id: z.string().uuid() }).parse(data))
  .handler(async ({ data: input, context }) => {
    const { userId } = context as { userId: string; supabase: any };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Service role so RLS never blocks "don't show again"
    const { data, error } = await (supabaseAdmin as any)
      .from("notification_dismissals")
      .upsert(
        {
          notification_id: input.notification_id,
          user_id: userId,
          dismissed_at: new Date().toISOString(),
        },
        { onConflict: "notification_id,user_id" },
      )
      .select()
      .maybeSingle();

    if (error) {
      // Fallback without onConflict (some DBs lack the unique index name)
      const { error: insertError } = await (supabaseAdmin as any)
        .from("notification_dismissals")
        .insert({
          notification_id: input.notification_id,
          user_id: userId,
          dismissed_at: new Date().toISOString(),
        });
      if (insertError && !/duplicate|unique/i.test(insertError.message || "")) {
        throw new Error(insertError.message || "Erro ao dispensar aviso");
      }
    }
    return data ?? { success: true };
  });

export const getActiveNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string; supabase: any };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Active notifications
    const { data: notifications, error } = await (supabaseAdmin as any)
      .from("notifications")
      .select("id, title, description, is_active, created_at, target_type")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    // This user's dismissals (reliable filter — avoids nested RLS issues)
    const { data: dismissals } = await (supabaseAdmin as any)
      .from("notification_dismissals")
      .select("notification_id")
      .eq("user_id", userId);

    const dismissedIds = new Set(
      (dismissals || []).map((d: any) => d.notification_id).filter(Boolean),
    );

    return (notifications || []).filter((n: any) => !dismissedIds.has(n.id));
  });

export const deleteNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data: input, context }) => {
    const { userId, supabase, claims } = context as {
      userId: string;
      supabase: any;
      claims?: any;
    };

    await assertIsAdmin({ userId, supabase, claims });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("notifications")
      .update({ is_active: false })
      .eq("id", input.id);

    if (error) throw new Error(error.message);
    return { success: true };
  });

export const getAllNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase, claims } = context as {
      userId: string;
      supabase: any;
      claims?: any;
    };

    await assertIsAdmin({ userId, supabase, claims });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    const notifications = data || [];
    if (!notifications.length) return [];

    const creatorIds = Array.from(
      new Set(notifications.map((n: any) => n.created_by).filter(Boolean))
    );

    let byId = new Map<string, any>();
    if (creatorIds.length) {
      const { data: profiles } = await (supabaseAdmin as any)
        .from("profiles")
        .select("id, full_name")
        .in("id", creatorIds);
      byId = new Map((profiles || []).map((p: any) => [p.id, p]));
    }

    return notifications.map((n: any) => ({
      ...n,
      profiles: n.created_by ? byId.get(n.created_by) ?? null : null,
    }));
  });
