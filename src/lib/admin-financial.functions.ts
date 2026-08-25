import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OWNER_EMAIL } from "./admin-auth.constants";

const ensureAdmin = async (context: any) => {
  if (!context) throw new Error("Acesso negado: Contexto inválido.");
  const cleanOwnerEmail = OWNER_EMAIL.toLowerCase().trim();
  const userEmail = context.claims?.email?.toLowerCase().trim();
  if (userEmail === cleanOwnerEmail) return context;
  
  if (context.supabase) {
    let isAdmin = false;
    const { data: rpcResult, error: rpcError } = await context.supabase.rpc('has_role', { 
      _user_id: context.userId, 
      _role: 'admin' 
    });
    
    if (!rpcError) {
      isAdmin = rpcResult === true;
    } else {
      const { data: roleRow } = await context.supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', context.userId)
        .eq('role', 'admin')
        .maybeSingle();
      isAdmin = !!roleRow;
    }
    
    if (isAdmin) return context;
  }
  throw new Error("Não autorizado.");
};

export const getAdminFinancialStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [depositsRes, walletsRes] = await Promise.all([
      supabaseAdmin
        .from('transactions')
        .select('amount')
        .eq('type', 'deposit')
        .in('status', ['completed', 'paid', 'success', 'approved']),
      supabaseAdmin.from('wallets').select('balance'),
    ]);

    const totalVolume =
      depositsRes.data?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;
    const balanceInCustody =
      walletsRes.data?.reduce((acc, curr) => acc + Number(curr.balance), 0) || 0;

    return {
      totalVolume,
      balanceInCustody
    };
  });
