import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";


/**
 * serverFn to process a financial transaction.
 * This handles basic validation and ledger entry.
 * In a real app, this would be much more complex with database locks and atomicity.
 */
export const processTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => 

    z.object({
      walletId: z.string().uuid(),
      type: z.enum(['cash_in', 'cash_out', 'transfer_in', 'transfer_out', 'fee']),
      amount: z.number().positive(),
      description: z.string().optional(),
      referenceId: z.string().uuid().optional(),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const admin = supabaseAdmin;


    // Note: In Lovable Cloud, we should use context.supabase if authenticated.
    // For this prototype, we'll demonstrate the structure.
    
    const { walletId, type, amount, description, referenceId } = data;

    // 1. Validate balance for cash_out/transfer_out
    if (type === 'cash_out' || type === 'transfer_out') {
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('balance')
        .eq('id', walletId)
        .single();

      if (walletError || !wallet) {
        throw new Error("Carteira não encontrada");
      }

      if ((wallet.balance || 0) < amount) {
        throw new Error("Saldo insuficiente");
      }
    }

    // 2. Insert transaction record
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        wallet_id: walletId,
        type,
        amount,
        description: description ?? null,
        reference_id: referenceId ?? null,
        status: 'pending'
      })
      .select()
      .single();

    if (txError) {
      throw new Error(`Erro ao criar transação: ${txError.message}`);
    }

    // 3. Update wallet balance (In a real system, use a DB trigger or RPC for atomicity)
    const balanceAdjustment = (type === 'cash_in' || type === 'transfer_in') ? amount : -amount;
    
    const { error: updateError } = await admin.rpc('adjust_wallet_balance', {
      p_wallet_id: walletId,
      p_amount: balanceAdjustment
    });

    if (updateError) {
      // If balance adjustment fails, mark transaction as failed
      await supabase
        .from('transactions')
        .update({ status: 'failed' })
        .eq('id', transaction.id);
      
      throw new Error(`Erro ao atualizar saldo: ${updateError.message}`);
    }

    // 4. Mark transaction as completed
    const { data: completedTx } = await supabase
      .from('transactions')
      .update({ status: 'completed' })
      .eq('id', transaction.id)
      .select()
      .single();

    return completedTx;
  });

/**
 * serverFn to generate a new API Key
 */
export const generateApiKey = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ name: z.string().min(3) }).parse(data))
  .handler(async ({ data }) => {
    // Simulated key generation for the demo
    const key = `mask_live_${Math.random().toString(36).substring(2, 15)}`;
    
    // In a real app, hash the key and store it
    // For now, we return the clear key to the user (once only)
    return { key, name: data.name };
  });
