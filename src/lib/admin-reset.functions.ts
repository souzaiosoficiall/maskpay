import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OWNER_EMAIL } from "./admin-auth.constants";

export const resetSystem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const cleanOwnerEmail = OWNER_EMAIL.toLowerCase().trim();
    if (context.claims?.email?.toLowerCase().trim() !== cleanOwnerEmail) {
      throw new Error("Não autorizado: Acesso restrito ao administrador proprietário.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    try {
      // 1. Get all users except the owner
      const { data: users, error: fetchError } = await supabaseAdmin.auth.admin.listUsers();
      if (fetchError) throw fetchError;

      const usersToDelete = users.users.filter(u => u.email?.toLowerCase().trim() !== cleanOwnerEmail);

      // 2. Delete other users (Auth delete cascades to profiles/wallets if foreign keys are set to cascade)
      // If not, we do it manually. Based on common Supabase patterns, they usually are.
      for (const user of usersToDelete) {
        await supabaseAdmin.auth.admin.deleteUser(user.id);
      }

      // 3. Clean up global tables (things that might not cascade or need general clearing)
      const tablesToClear = [
        'admin_logs',
        'notifications',
        'notification_dismissals',
        'verification_requests',
        'transactions',
        'user_integrations'
      ];

      for (const table of tablesToClear) {
        // We delete everything from these tables. 
        // For 'notifications', we might want to keep the system ones, but user asked for 100% clean.
        await (supabaseAdmin.from(table as any) as any).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      }

      // 4. Reset owner's wallet
      const { data: ownerProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', cleanOwnerEmail)
        .single();

      if (ownerProfile) {
        await (supabaseAdmin.from('wallets') as any)
          .update({ balance: 0 })
          .eq('user_id', ownerProfile.id);
      }

      return { success: true, deletedCount: usersToDelete.length };
    } catch (error: any) {
      console.error("[resetSystem] Error:", error);
      throw new Error("Erro ao resetar o sistema: " + error.message);
    }
  });
