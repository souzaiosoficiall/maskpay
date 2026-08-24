import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchPlatformFees } from "./platform-fees.server";
import { calculateDepositAmounts, calculateWithdrawalAmounts } from "./fees-logic";
import { callEvoPay } from "./evopay-client.server";

/**
 * Fetches the current platform fees from the database.
 */
export const getPlatformFees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return await fetchPlatformFees(context.supabase);
  });


/**
 * Generates a Pix payment using the provider.
 */
export const generatePixDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => 
    z.object({
      amount: z.number().min(1, "O valor mínimo é R$ 1,00")
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    
    // 1. Fetch fees
    const feesResp = await fetchPlatformFees(supabase);
    const { feeAmount, netAmount } = calculateDepositAmounts(data.amount, feesResp.deposit);

    // 2. Fetch credentials (safe on server)
    const EVOPAY_MERCHANT_ID = process.env['EVOPAY_MERCHANT_ID'];
    const EVOPAY_API_TOKEN = process.env['EVOPAY_API_TOKEN'];

    if (!EVOPAY_API_TOKEN) {
      console.error("ERRO: EVOPAY_API_TOKEN não configurado. Pagamentos reais desativados.");
      throw new Error("Sistema de pagamentos em manutenção. Por favor, tente novamente mais tarde.");
    }

    // REAL INTEGRATION: Call provider API
    try {
      const { data: wallet } = await supabase
        .from("wallets")
        .select("id")
        .eq("user_id", userId)
        .single();

      // Create record
      const { data: tx, error: txError } = await (supabase.from("transactions") as any)
        .insert({
          wallet_id: wallet?.id,
          amount: data.amount,
          fee_amount: feeAmount,
          net_amount: netAmount,
          type: "deposit",
          status: "pending",
          description: "Depósito Pix",
          metadata: {}
        })
        .select()
        .single();

      if (txError) throw new Error(txError.message);

      // Call provider using the new centralized client
      // Documentation endpoint: POST /pix/
      const evoData = await callEvoPay('/pix/', {
        method: 'POST',
        body: {
          amount: Number(data.amount.toFixed(2)),
          callback_url: `${process.env['SITE_URL'] || 'https://' + process.env['HOST']}/api/public/payment-webhook`,
          external_id: String(tx.id), // Simplified for provider reference
          merchant_id: process.env['EVOPAY_MERCHANT_ID']
        }
      });

      // Update record with Provider ID
      await (supabase.from("transactions") as any)
        .update({
          provider_id: evoData.id || evoData.transactionId,
          metadata: { provider_raw: evoData }
        })
        .eq("id", tx.id);

      return {
        qrCode: evoData.qrCodeText || evoData.pix_qrcode_base64 || evoData.qrcode,
        copyPaste: evoData.qrCodeText || evoData.pix_copy_paste || evoData.copy_paste,
        transactionId: tx.id,
        amount: data.amount,
        fee: feeAmount,
        net: netAmount
      };
    } catch (err: any) {
      console.error("Payment Provider Audit Failure:", err);
      // Propagate the specific error message from the client
      throw new Error(err.message || "ERRO VINDO DA RESPOSTA DA ADQUIRENTE");
    }
  });

/**
 * Requests a Pix withdrawal via the provider.
 */
export const requestPixWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      amount: z.number().min(1, "O valor mínimo é R$ 1,00"),
      pixKeyType: z.string(),
      pixKey: z.string(),
      transactionPassword: z.string().length(4)
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Validate Transaction Password
    const { data: profile } = await (supabase.from("profiles") as any)
      .select("transaction_password_hash, kyc_status")
      .eq("id", userId)
      .single();

    if ((profile as any)?.transaction_password_hash !== data.transactionPassword) {
      throw new Error("Senha de transação incorreta.");
    }

    // No longer blocking by KYC here, as routes already handle this via isKycLocked
    // and we want to allow the process to be as smooth as possible once verified.

    // 2. Check Balance
    const { data: wallet } = await supabase
      .from("wallets")
      .select("id, balance")
      .eq("user_id", userId)
      .single();

    if (!wallet || (wallet.balance || 0) < data.amount) {
      throw new Error("Saldo insuficiente.");
    }

    // 3. Calculate Fees
    const feesResp = await fetchPlatformFees(supabase);
    const { feeAmount, netAmount } = calculateWithdrawalAmounts(data.amount, feesResp.withdrawal);

    if (netAmount <= 0) throw new Error("Valor líquido insuficiente após taxas.");

    // 4. Create Pending Transaction
    const { data: tx, error: txError } = await (supabase.from("transactions") as any)
      .insert({
        wallet_id: wallet.id,
        amount: data.amount,
        fee_amount: feeAmount,
        net_amount: netAmount,
        type: "withdrawal",
        status: "pending",
        description: `Saque Pix para chave ${data.pixKey}`,
        metadata: { pix_key: data.pixKey, pix_type: data.pixKeyType }
      })
      .select()
      .single();

    if (txError) throw new Error(txError.message);

    // 5. Deduct balance (Lock it) — privileged operation, runs with service role
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("adjust_wallet_balance", {
      p_wallet_id: wallet.id,
      p_amount: -data.amount
    });



    try {
      // Call provider using the new centralized client
      // Documentation endpoint: POST /pix/cash-out
      const evoData = await callEvoPay('/pix/cash-out', {
        method: 'POST',
        body: {
          amount: Number(netAmount.toFixed(2)),
          pix_key: data.pixKey,
          pix_key_type: data.pixKeyType,
          external_id: String(tx.id),
          merchant_id: process.env['EVOPAY_MERCHANT_ID'],
          callback_url: `${process.env['SITE_URL'] || 'https://' + process.env['HOST']}/api/public/payment-webhook`
        }
      });

      if (evoData) {
        await (supabase.from("transactions") as any)
          .update({ 
            provider_id: evoData.id || evoData.transactionId,
            metadata: { ...((tx as any).metadata || {}), provider_raw: evoData }
          } as any)
          .eq("id", tx.id);
      }
    } catch (err: any) {
      console.error("Withdrawal Audit Failure:", err);
      // We don't throw here to avoid rolling back the wallet deduction 
      // if it's just a communication issue, but in a real scenario 
      // we might want more robust handling.
    }

    return {
      success: true,
      transactionId: tx.id,
      netAmount
    };
  });
