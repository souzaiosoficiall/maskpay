import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getUserIntegrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data, error } = await supabase
      .from("user_integrations" as any)
      .select("*")
      .eq("user_id", userId);

    if (error) {
      console.error("Erro ao buscar integrações:", error);
      return [];
    }

    return data || [];
  });

export const saveIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({
      provider: z.enum(["utmify", "google"]),
      config: z.record(z.any()),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { error } = await (supabase.from("user_integrations" as any) as any)
      .upsert({
        user_id: userId,
        provider: data.provider,
        config: data.config,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,provider' });

    if (error) {
      console.error("Erro ao salvar integração:", error);
      throw new Error("Falha ao salvar a integração.");
    }

    return { success: true };
  });

export const deleteIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({
      provider: z.string(),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { error } = await supabase
      .from("user_integrations" as any)
      .delete()
      .eq("user_id", userId)
      .eq("provider", data.provider);

    if (error) {
      console.error("Erro ao deletar integração:", error);
      throw new Error("Falha ao remover a integração.");
    }

    return { success: true };
  });
