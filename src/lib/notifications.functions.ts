import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const notificationSchema = z.object({
  title: z.string().min(1, "O título é obrigatório"),
  description: z.string().min(1, "A descrição é obrigatória"),
  target_type: z.enum(["all", "user", "group"]).default("all"),
});

export const createNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => notificationSchema.parse(data))
  .handler(async ({ data: input, context }) => {
    const { userId, supabase } = context as { userId: string; supabase: any };

    // Verify if user is admin
    const { data: roleData } = await (supabase as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      throw new Error("Não autorizado");
    }

    const { data, error } = await (supabase as any)
      .from("notifications")
      .insert({
        title: input.title,
        description: input.description,
        target_type: input.target_type,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  });

export const dismissNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ notification_id: z.string() }).parse(data))
  .handler(async ({ data: input, context }) => {
    const { userId, supabase } = context as { userId: string; supabase: any };

    const { data, error } = await (supabase as any)
      .from("notification_dismissals")
      .upsert({
        notification_id: input.notification_id,
        user_id: userId,
        dismissed_at: new Date().toISOString(),
      }, { onConflict: 'notification_id,user_id' })
      .select()
      .single();

    if (error) throw error;
    return data;
  });

export const getActiveNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context as { userId: string; supabase: any };

    // Get active notifications that the user hasn't dismissed
    const { data, error } = await (supabase as any)
      .from("notifications")
      .select(`
        *,
        notification_dismissals (user_id)
      `)
      .eq("is_active", true);

    if (error) throw error;
    
    // Filter notifications where user_id in notification_dismissals matches current user
    const filtered = (data || []).filter((n: any) => {
      const dismissals = n.notification_dismissals || [];
      return !dismissals.some((d: any) => d.user_id === userId);
    });

    return filtered;
  });

export const deleteNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data: input, context }) => {
    const { userId, supabase } = context as { userId: string; supabase: any };

    // Verify if user is admin
    const { data: roleData } = await (supabase as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      throw new Error("Não autorizado");
    }

    const { error } = await (supabase as any)
      .from("notifications")
      .update({ is_active: false })
      .eq("id", input.id);

    if (error) throw error;
    return { success: true };
  });

export const getAllNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context as { userId: string; supabase: any };

    // Verify if user is admin
    const { data: roleData } = await (supabase as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      throw new Error("Não autorizado");
    }

    const { data, error } = await (supabase as any)
      .from("notifications")
      .select(`
        *,
        profiles (full_name)
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  });
