import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OWNER_EMAIL } from "./admin-auth.constants";

const ensureAdmin = async (context: any) => {
  if (!context) throw new Error("Acesso negado: Contexto inválido.");
  if (context.claims?.email?.toLowerCase() === OWNER_EMAIL.toLowerCase()) return context;
  if (context.supabase) {
    const { data: isAdmin } = await context.supabase.rpc('has_role', { 
      _user_id: context.userId, 
      _role: 'admin' 
    });
    if (isAdmin) return context;
  }
  throw new Error("Não autorizado.");
};

export const getAdminFinancialStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Total Volume (All successful deposits)
    const { data: deposits } = await supabaseAdmin
      .from('transactions')
      .select('amount')
      .eq('type', 'deposit')
      .in('status', ['completed', 'paid', 'success', 'approved']);
    
    const totalVolume = deposits?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;

    // 2. Balance in Custody (Sum of all user wallets)
    const { data: wallets } = await supabaseAdmin
      .from('wallets')
      .select('balance');
    
    const balanceInCustody = wallets?.reduce((acc, curr) => acc + Number(curr.balance), 0) || 0;

    return {
      totalVolume,
      balanceInCustody
    };
  });
