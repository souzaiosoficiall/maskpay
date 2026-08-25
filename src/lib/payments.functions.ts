import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchPlatformFees } from "./platform-fees.server";
import { calculateDepositAmounts, calculateWithdrawalAmounts } from "./fees-logic";
import { callEvoPay } from "./evopay-client.server";
import {
  parsePixEmv,
  guessPixKeyType,
  extractPixLocationUrl,
  extractAmountFromPixPayload,
  extractMerchantFromPixPayload,
  extractKeyFromPixPayload,
} from "./pix-emv";

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
function extractPixCodes(evoData: any): {
  emv: string | null;
  qrImageBase64: string | null;
} {
  if (!evoData || typeof evoData !== "object") {
    return { emv: null, qrImageBase64: null };
  }
  // EMV / copia-e-cola (must be the PIX payload string, NOT base64 image)
  const emv =
    evoData.qrCodeText ||
    evoData.brCode ||
    evoData.emv ||
    evoData.pixCopyPaste ||
    evoData.pix_copy_paste ||
    evoData.copy_paste ||
    evoData.copyPaste ||
    evoData.payload ||
    (typeof evoData.qrCode === "string" && evoData.qrCode.startsWith("00020")
      ? evoData.qrCode
      : null) ||
    null;

  const qrImageBase64 =
    evoData.qrCodeBase64 ||
    evoData.qrCodeImage ||
    evoData.pix_qrcode_base64 ||
    null;

  return { emv: emv || null, qrImageBase64: qrImageBase64 || null };
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
      const { emv, qrImageBase64 } = extractPixCodes(evoData);

      await (supabase.from("transactions") as any)
        .update({
          provider_id: providerId,
          metadata: { provider_raw: evoData, clientReference: String(tx.id) },
        })
        .eq("id", tx.id);

      if (!emv) {
        console.error("[Audit] EvoPay returned success but no EMV/copy-paste fields:", {
          keys: evoData && typeof evoData === "object" ? Object.keys(evoData) : [],
        });
        throw new Error(
          "A adquirente criou a cobrança, mas não retornou o código Pix. Verifique os logs do servidor."
        );
      }

      return {
        // Always EMV string for QRCodeSVG + copy-paste
        qrCode: emv,
        copyPaste: emv,
        qrImageBase64: qrImageBase64,
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


/**
 * Pay a scanned PIX QR Code using wallet balance.
 * Debits (amount + withdrawal fixed fee). Recipient receives `amount`.
 * Platform keeps the fixed fee (default R$ 0,80).
 */
export const payPixQrCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        amount: z.number().min(0.01, "Valor inválido"),
        pixKey: z.string().min(1, "Chave PIX não encontrada no QR"),
        pixKeyType: z.string().optional(),
        merchantName: z.string().optional(),
        emv: z.string().optional(),
        transactionPassword: z.string().length(4),
      })
      .parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await (supabase.from("profiles") as any)
      .select("transaction_password_hash, verification_status, role")
      .eq("id", userId)
      .single();

    if ((profile as any)?.transaction_password_hash !== data.transactionPassword) {
      throw new Error("Senha de transação incorreta.");
    }

    if (
      (profile as any)?.role !== "admin" &&
      (profile as any)?.verification_status !== "verified"
    ) {
      throw new Error("Complete a verificação de identidade para pagar via QR Code.");
    }

    // Resolve PIX key from EMV / copia-e-cola when needed
    let pixKey = String(data.pixKey || "").trim();
    let pixKeyType = data.pixKeyType || "random";
    let payAmount = Number(data.amount);
    const emv = String(data.emv || "").trim();

    const tryParse = (payload: string) => {
      try {
        return parsePixEmv(payload);
      } catch {
        return null;
      }
    };

    if (emv.startsWith("0002")) {
      const p = tryParse(emv);
      if (p?.pixKey) {
        pixKey = p.pixKey;
        pixKeyType = guessPixKeyType(p.pixKey);
      }
      if ((!payAmount || payAmount <= 0) && p?.amount && p.amount > 0) {
        payAmount = p.amount;
      }
    }
    if (pixKey.startsWith("0002")) {
      const p = tryParse(pixKey);
      if (p?.pixKey) {
        pixKey = p.pixKey;
        pixKeyType = guessPixKeyType(p.pixKey);
      } else {
        // Dynamic QR without embedded key — cannot cash-out without a real key
        throw new Error(
          "Este PIX dinâmico não contém chave do recebedor. Peça um QR estático ou a chave PIX (CPF/e-mail/telefone/aleatória)."
        );
      }
      if ((!payAmount || payAmount <= 0) && p?.amount && p.amount > 0) {
        payAmount = p.amount;
      }
    }

    if (!pixKey) {
      throw new Error("Chave PIX não encontrada no código.");
    }
    if (!payAmount || payAmount <= 0) {
      throw new Error("Informe o valor do pagamento.");
    }

    const feesResp = await fetchPlatformFees(supabase);
    const feeAmount = Number(feesResp.withdrawal?.fixed ?? 0.8);
    const totalDebit = Math.round((payAmount + feeAmount) * 100) / 100;

    const { data: wallet } = await supabase
      .from("wallets")
      .select("id, balance")
      .eq("user_id", userId)
      .single();

    if (!wallet || Number(wallet.balance || 0) < totalDebit) {
      throw new Error(
        `Saldo insuficiente. Necessário ${totalDebit.toFixed(2)} (valor + taxa de R$ ${feeAmount.toFixed(2)}).`
      );
    }

    const { data: tx, error: txError } = await (supabase.from("transactions") as any)
      .insert({
        wallet_id: wallet.id,
        amount: totalDebit,
        fee_amount: feeAmount,
        net_amount: payAmount,
        type: "pix_payment",
        status: "pending",
        description: `Pagamento PIX QR${data.merchantName ? ` — ${data.merchantName}` : ""}`,
        metadata: {
          pix_key: pixKey,
          pix_key_type: pixKeyType,
          merchant_name: data.merchantName || null,
          emv: emv || data.emv || null,
          pay_amount: payAmount,
        },
      })
      .select()
      .single();

    if (txError) throw new Error(txError.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("adjust_wallet_balance", {
      p_wallet_id: wallet.id,
      p_amount: -totalDebit,
    });

    try {
      const evoData = await callEvoPay("/pix/cash-out", {
        method: "POST",
        body: {
          amount: Number(payAmount.toFixed(2)),
          pixKey,
          pixKeyType,
          clientReference: String(tx.id),
          callbackUrl: getWebhookUrl(),
        },
      });

      if (evoData) {
        await (supabase.from("transactions") as any)
          .update({
            status: "completed",
            provider_id: evoData.id || evoData.transactionId || evoData.transaction_id,
            metadata: { ...((tx as any).metadata || {}), provider_raw: evoData },
          } as any)
          .eq("id", tx.id);
      } else {
        await (supabase.from("transactions") as any)
          .update({ status: "completed" } as any)
          .eq("id", tx.id);
      }
    } catch (err: any) {
      console.error("Pay QR Audit Failure:", err);
      try {
        await supabaseAdmin.rpc("adjust_wallet_balance", {
          p_wallet_id: wallet.id,
          p_amount: totalDebit,
        });
        await (supabase.from("transactions") as any)
          .update({ status: "failed", metadata: { error: err.message } } as any)
          .eq("id", tx.id);
      } catch (refundErr) {
        console.error("Failed to refund after pay-qr error:", refundErr);
      }
      throw new Error(err.message || "Falha ao processar pagamento PIX.");
    }

    return {
      success: true,
      transactionId: tx.id,
      paid: payAmount,
      fee: feeAmount,
      totalDebit,
    };
  });


/**
 * Resolve dynamic PIX QR location URL to amount / key / merchant.
 * Runs on the server to avoid browser CORS blocks.
 */
export const resolvePixDynamic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ emv: z.string().min(20) }).parse(data)
  )
  .handler(async ({ data }) => {
    const emv = data.emv.replace(/\s/g, "");
    let amount: number | null = null;
    let merchantName: string | null = null;
    let pixKey: string | null = null;

    // 1) Try local EMV parse first
    try {
      const local = parsePixEmv(emv);
      amount = local.amount;
      merchantName = local.merchantName;
      pixKey = local.pixKey;
      if (amount && amount > 0 && pixKey) {
        return { amount, merchantName, pixKey, source: "emv" as const };
      }
    } catch {
      // continue
    }

    const url = extractPixLocationUrl(emv);
    if (!url) {
      return { amount, merchantName, pixKey, source: "none" as const };
    }

    // 2) Fetch location (BACEN-style dynamic charge)
    const headersList = [
      { Accept: "application/json" },
      { Accept: "application/jose" },
      { Accept: "application/jwt" },
      { Accept: "*/*" },
    ];

    let bodyText = "";
    let bodyJson: any = null;

    for (const headers of headersList) {
      try {
        const res = await fetch(url, {
          method: "GET",
          headers: {
            ...headers,
            "User-Agent": "MaskPay/1.0",
          },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) continue;
        bodyText = await res.text();
        if (!bodyText) continue;
        try {
          bodyJson = JSON.parse(bodyText);
        } catch {
          bodyJson = bodyText;
        }
        break;
      } catch (err) {
        console.warn("[resolvePixDynamic] fetch failed", url, err);
      }
    }

    if (bodyJson != null) {
      const a = extractAmountFromPixPayload(bodyJson);
      const m = extractMerchantFromPixPayload(bodyJson);
      const k = extractKeyFromPixPayload(bodyJson);
      if (a) amount = a;
      if (m) merchantName = m;
      if (k) pixKey = k;
    }

    // JWT compact string
    if ((!amount || amount <= 0) && typeof bodyText === "string" && bodyText.includes(".")) {
      const a = extractAmountFromPixPayload(bodyText);
      if (a) amount = a;
    }

    return {
      amount,
      merchantName,
      pixKey,
      source: amount || pixKey ? ("location" as const) : ("none" as const),
      locationUrl: url,
    };
  });
