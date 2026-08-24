import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchPlatformFees } from "./platform-fees.server";
import { calculateDepositAmounts, calculateWithdrawalAmounts } from "./fees-logic";
import { callEvoPay } from "./evopay-client.server";

/**
 * Builds the public webhook URL for EvoPay callbacks.
 */
function getWebhookUrl(): string {
  const siteUrl = process.env["SITE_URL"];
  const host = process.env["HOST"];
  const vercel = process.env["VERCEL_URL"];
  let base: string | null = null;
  if (siteUrl) base = siteUrl;
  else if (host) base = `https://${host}`;
  else if (vercel) base = `https://${vercel}`;
  if (!base) {
    console.warn("[Audit] SITE_URL/HOST/VERCEL_URL not set — callbackUrl may be invalid");
    return "https://localhost/api/public/payment-webhook";
  }
  return `${String(base).replace(/\/$/, "")}/api/public/payment-webhook`;
}

/**
 * Extracts QR / copia-e-cola from heterogeneous EvoPay response shapes.
 */
function extractPixCodes(evoData: any): { qrCode: string | null; copyPaste: string | null } {
  if (!evoData || typeof evoData !== "object") {
    return { qrCode: null, copyPaste: null };
  }
  const copyPaste =
    evoData.qrCodeText ||
    evoData.qrCode ||
    evoData.brCode ||
    evoData.emv ||
    evoData.pixCopyPaste ||
    evoData.pix_copy_paste ||
    evoData.copy_paste ||
    evoData.copyPaste ||
    evoData.payload ||
    null;

  const qrCode =
    evoData.qrCodeBase64 ||
    evoData.qrCodeImage ||
    evoData.pix_qrcode_base64 ||
    evoData.qrcode ||
    evoData.qrCode ||
    copyPaste;

  return { qrCode: qrCode || null, copyPaste: copyPaste || null };
}

/**
 * Fetches the current platform fees from the database.
 */
export const getPlatformFees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return await fetchPlatformFees(context.supabase);
  });

/**
 * Generates a Pix payment using the provider (EvoPay POST /v1/pix/).
 * Official fields: amount (number BRL), callbackUrl, clientReference.
 * @see https://docs.partners.evopay.cash/pt/guide/authentication
 */
export const generatePixDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        amount: z.number().min(1, "O valor mínimo é R$ 1,00"),
      })
      .parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const feesResp = await fetchPlatformFees(supabase);
    const { feeAmount, netAmount } = calculateDepositAmounts(data.amount, feesResp.deposit);

    const EVOPAY_API_TOKEN = process.env["EVOPAY_API_TOKEN"];
    if (!EVOPAY_API_TOKEN) {
      console.error("ERRO: EVOPAY_API_TOKEN não configurado. Pagamentos reais desativados.");
      throw new Error("Sistema de pagamentos em manutenção. Por favor, tente novamente mais tarde.");
    }

    try {
      const { data: wallet } = await supabase
        .from("wallets")
        .select("id")
        .eq("user_id", userId)
        .single();

      const { data: tx, error: txError } = await (supabase.from("transactions") as any)
        .insert({
          wallet_id: wallet?.id,
          amount: data.amount,
          fee_amount: feeAmount,
          net_amount: netAmount,
          type: "deposit",
          status: "pending",
          description: "Depósito Pix",
          metadata: {},
        })
        .select()
        .single();

      if (txError) throw new Error(txError.message);

      // Official EvoPay payload (camelCase) — docs.partners.evopay.cash
      const evoData = await callEvoPay("/pix/", {
        method: "POST",
        body: {
          amount: Number(data.amount.toFixed(2)),
          callbackUrl: getWebhookUrl(),
          clientReference: String(tx.id),
        },
      });

      const providerId = evoData?.id || evoData?.transactionId || evoData?.transaction_id || null;
      const { qrCode, copyPaste } = extractPixCodes(evoData);

      await (supabase.from("transactions") as any)
        .update({
          provider_id: providerId,
          metadata: { provider_raw: evoData, clientReference: String(tx.id) },
        })
        .eq("id", tx.id);

      if (!copyPaste && !qrCode) {
        console.error("[Audit] EvoPay returned success but no QR/copy-paste fields:", evoData);
        throw new Error(
          "A adquirente criou a cobrança, mas não retornou o QR Code. Verifique o formato da resposta nos logs."
        );
      }

      return {
        qrCode: qrCode || copyPaste,
        copyPaste: copyPaste || qrCode,
        transactionId: tx.id,
        providerId,
        amount: data.amount,
        fee: feeAmount,
        net: netAmount,
      };
    } catch (err: any) {
      console.error("Payment Provider Audit Failure:", err);
      throw new Error(err.message || "ERRO VINDO DA RESPOSTA DA ADQUIRENTE");
    }
  });

/**
 * Requests a Pix withdrawal via the provider (EvoPay cash-out).
 * Uses camelCase fields consistent with the rest of the EvoPay API.
 */
export const requestPixWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        amount: z.number().min(1, "O valor mínimo é R$ 1,00"),
        pixKeyType: z.string(),
        pixKey: z.string(),
        transactionPassword: z.string().length(4),
      })
      .parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await (supabase.from("profiles") as any)
      .select("transaction_password_hash, kyc_status")
      .eq("id", userId)
      .single();

    if ((profile as any)?.transaction_password_hash !== data.transactionPassword) {
      throw new Error("Senha de transação incorreta.");
    }

    const { data: wallet } = await supabase
      .from("wallets")
      .select("id, balance")
      .eq("user_id", userId)
      .single();

    if (!wallet || (wallet.balance || 0) < data.amount) {
      throw new Error("Saldo insuficiente.");
    }

    const feesResp = await fetchPlatformFees(supabase);
    const { feeAmount, netAmount } = calculateWithdrawalAmounts(data.amount, feesResp.withdrawal);

    if (netAmount <= 0) throw new Error("Valor líquido insuficiente após taxas.");

    const { data: tx, error: txError } = await (supabase.from("transactions") as any)
      .insert({
        wallet_id: wallet.id,
        amount: data.amount,
        fee_amount: feeAmount,
        net_amount: netAmount,
        type: "withdrawal",
        status: "pending",
        description: `Saque Pix para chave ${data.pixKey}`,
        metadata: { pix_key: data.pixKey, pix_type: data.pixKeyType },
      })
      .select()
      .single();

    if (txError) throw new Error(txError.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("adjust_wallet_balance", {
      p_wallet_id: wallet.id,
      p_amount: -data.amount,
    });

    try {
      // camelCase aligned with EvoPay style; amount is the net payout
      const evoData = await callEvoPay("/pix/cash-out", {
        method: "POST",
        body: {
          amount: Number(netAmount.toFixed(2)),
          pixKey: data.pixKey,
          pixKeyType: data.pixKeyType,
          clientReference: String(tx.id),
          callbackUrl: getWebhookUrl(),
        },
      });

      if (evoData) {
        await (supabase.from("transactions") as any)
          .update({
            provider_id: evoData.id || evoData.transactionId || evoData.transaction_id,
            metadata: { ...((tx as any).metadata || {}), provider_raw: evoData },
          } as any)
          .eq("id", tx.id);
      }
    } catch (err: any) {
      console.error("Withdrawal Audit Failure:", err);
      // Refund locked balance if provider rejected the cash-out
      try {
        await supabaseAdmin.rpc("adjust_wallet_balance", {
          p_wallet_id: wallet.id,
          p_amount: data.amount,
        });
        await (supabase.from("transactions") as any)
          .update({ status: "failed", metadata: { error: err.message } } as any)
          .eq("id", tx.id);
      } catch (refundErr) {
        console.error("Failed to refund after withdrawal error:", refundErr);
      }
      throw new Error(err.message || "Falha ao solicitar saque na adquirente.");
    }

    return {
      success: true,
      transactionId: tx.id,
      netAmount,
    };
  });
