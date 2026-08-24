import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const updateLastAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const now = new Date().toISOString();
    
    // Update profile with last access (metadata JSON field)
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ 
        updated_at: now 
      } as any)
      .eq('id', userId);

    if (error) {
      console.error("[updateLastAccess] Error:", error);
      return { success: false };
    }

    return { success: true };
  });
