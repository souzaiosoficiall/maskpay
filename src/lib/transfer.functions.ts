import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Finds a user's wallet and profile info by email for internal transfers.
 */
export const findRecipientByEmail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((email: unknown) => z.string().email().parse(email))
  .handler(async ({ data: email, context }) => {
    const { supabase } = context;
    // We use 'as any' to bypass strict type checking for the 'email' column 
    // which was added via migration but might not be in generated types yet.
    const { data: profile, error } = await (supabase as any)
      .from('profiles')
      .select('id, full_name')
      .eq('email', email)
      .single();

    if (error || !profile) {
      throw new Error("Usuário não encontrado.");
    }

    const { data: wallet, error: walletError } = await (supabase as any)
      .from('wallets')
      .select('id')
      .eq('user_id', profile.id)
      .single();

    if (walletError || !wallet) {
      throw new Error("Carteira do destinatário não encontrada.");
    }

    return {
      walletId: wallet.id,
      fullName: profile.full_name,
      email: email
    };
  });

/**
 * Executes an internal transfer between two users.
 */
export const executeInternalTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => 

    z.object({
      senderWalletId: z.string().uuid(),
      receiverWalletId: z.string().uuid(),
      amount: z.number().positive(),
      description: z.string().optional()
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const admin = supabaseAdmin;
    const { senderWalletId, receiverWalletId, amount, description } = data;

    // We need the IDs for the RPC
    const { data: sender } = await (admin.from('wallets') as any).select('user_id').eq('id', senderWalletId).single();
    const { data: receiver } = await (admin.from('wallets') as any).select('user_id').eq('id', receiverWalletId).single();
    
    if (!sender?.user_id || !receiver?.user_id) throw new Error("Carteira não encontrada");
    
    const { data: receiverProfile } = await (admin.from('profiles') as any).select('email').eq('id', receiver.user_id).single();

    const { error } = await admin.rpc('process_internal_transfer', {
      p_sender_id: sender.user_id,
      p_receiver_email: receiverProfile?.email || '',
      p_amount: amount,
      p_description: description || 'Transferência Interna'
    });

    if (error) {
      throw new Error(error.message);
    }

    return { success: true };
  });
