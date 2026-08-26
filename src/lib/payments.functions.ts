import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchPlatformFees, getUserPaymentRoute } from "./platform-fees.server";
import { calculateDepositAmounts, calculateWithdrawalAmounts } from "./fees-logic";
import { callEvoPay } from "./evopay-client.server";
import { verifyTransactionPin } from "@/lib/utils";
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
    const { supabase, userId } = context;
    const route = await getUserPaymentRoute(supabase, userId);
    return await fetchPlatformFees(supabase, route);
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

    const paymentRoute = await getUserPaymentRoute(supabase, userId);
    const feesResp = await fetchPlatformFees(supabase, paymentRoute);
    const { feeAmount, netAmount } = calculateDepositAmounts(data.amount, feesResp.deposit);

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
          metadata: { account_route: paymentRoute, fee_route: feesResp.route },
        })
        .select()
        .single();

      if (txError) throw new Error(txError.message);

      // Official EvoPay payload (camelCase) — docs.partners.evopay.cash
      const evoData = await callEvoPay("/pix/", { route: paymentRoute, 
        method: "POST",
        body: {
          amount: Number(data.amount.toFixed(2)),
          callbackUrl: getWebhookUrl(),
          clientReference: String(tx.id),
        },
      });

      const providerId = evoData?.id || evoData?.transactionId || evoData?.transaction_id || null;
      const { emv, qrImageBase64 } = extractPixCodes(evoData);

      // Use service role so provider_id is always saved (RLS can block user client)
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await (supabaseAdmin.from("transactions") as any)
        .update({
          provider_id: providerId,
          metadata: {
            ...((tx as any).metadata || {}),
            provider_raw: evoData,
            clientReference: String(tx.id),
            account_route: paymentRoute,
            fee_route: feesResp.route,
          },
        })
        .eq("id", tx.id);

      if (!emv) {
        console.error("[Audit] EvoPay returned success but no EMV/copy-paste fields:", {
          keys: evoData && typeof evoData === "object" ? Object.keys(evoData) : [],
        });
        throw new Error(
          "A adquirente criou a cobrança, mas não retornou o código Pix. Tente novamente."
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
      throw new Error(err.message || "Erro na resposta da adquirente.");
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
        amount: z.number().min(10, "O valor mínimo para saque é R$ 10,00"),
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

    if (!(await verifyTransactionPin((profile as any)?.transaction_password_hash, data.transactionPassword))) {
      throw new Error("Senha de transação incorreta.");
    }

    const { data: wallet } = await supabase
      .from("wallets")
      .select("id, balance")
      .eq("user_id", userId)
      .single();

    const feesResp = await fetchPlatformFees(supabase, await getUserPaymentRoute(supabase, userId));
    const { feeAmount, payoutAmount, totalDebit } = calculateWithdrawalAmounts(
      data.amount,
      feesResp.withdrawal
    );

    if (payoutAmount <= 0) throw new Error("Valor inválido para saque.");

    // Saque mínimo R$ 10,00 (WHITE e BLACK)
    if (data.amount < 10) {
      throw new Error("O valor mínimo para saque é R$ 10,00.");
    }

    if (!wallet || Number(wallet.balance || 0) < totalDebit) {
      throw new Error(
        `Saldo insuficiente. Necessário R$ ${totalDebit.toFixed(2)} (a taxa de R$ ${feeAmount.toFixed(2)} já está descontada do valor enviado).`
      );
    }

    const { data: tx, error: txError } = await (supabase.from("transactions") as any)
      .insert({
        wallet_id: wallet.id,
        amount: totalDebit,
        fee_amount: feeAmount,
        net_amount: payoutAmount,
        type: "withdrawal",
        status: "pending",
        description: `Saque Pix para chave ${data.pixKey}`,
        metadata: {
          pix_key: data.pixKey,
          pix_type: data.pixKeyType,
          payout: payoutAmount,
          account_route: feesResp.route,
          fee_route: feesResp.route,
        },
      })
      .select()
      .single();

    if (txError) throw new Error(txError.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Debit requested amount from user balance (fee deducted from payout)
    await supabaseAdmin.rpc("adjust_wallet_balance", {
      p_wallet_id: wallet.id,
      p_amount: -totalDebit,
    });

    try {
      // Recipient receives amount minus platform fee (fee is deducted from the amount)
      const paymentRoute = await getUserPaymentRoute(supabase, userId);
      const evoData = await callEvoPay("/pix/cash-out", { route: paymentRoute, 
        method: "POST",
        body: {
          amount: Number(payoutAmount.toFixed(2)),
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
          p_amount: totalDebit,
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
      netAmount: payoutAmount,
      totalDebit,
      feeAmount,
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

    if (!(await verifyTransactionPin((profile as any)?.transaction_password_hash, data.transactionPassword))) {
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

    const feesResp = await fetchPlatformFees(supabase, await getUserPaymentRoute(supabase, userId));
    const { feeAmount, payoutAmount, totalDebit } = calculateWithdrawalAmounts(
      payAmount,
      feesResp.withdrawal,
    );
    if (payoutAmount <= 0) {
      throw new Error("Valor insuficiente após desconto da taxa.");
    }

    const { data: wallet } = await supabase
      .from("wallets")
      .select("id, balance")
      .eq("user_id", userId)
      .single();

    if (!wallet || Number(wallet.balance || 0) < totalDebit) {
      throw new Error(
        `Saldo insuficiente. Necessário R$ ${totalDebit.toFixed(2)}.`
      );
    }

    const { data: tx, error: txError } = await (supabase.from("transactions") as any)
      .insert({
        wallet_id: wallet.id,
        amount: totalDebit,
        fee_amount: feeAmount,
        net_amount: payoutAmount,
        type: "pix_payment",
        status: "pending",
        description: `Pagamento PIX QR${data.merchantName ? ` — ${data.merchantName}` : ""}`,
        metadata: {
          pix_key: pixKey,
          pix_key_type: pixKeyType,
          merchant_name: data.merchantName || null,
          emv: emv || data.emv || null,
          pay_amount: payAmount,
          payout: payoutAmount,
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
      const paymentRoute = await getUserPaymentRoute(supabase, userId);
      const evoData = await callEvoPay("/pix/cash-out", { route: paymentRoute, 
        method: "POST",
        body: {
          amount: Number(payoutAmount.toFixed(2)),
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
      paid: payoutAmount,
      fee: feeAmount,
      totalDebit,
    };
  });


/**
 * Resolve dynamic PIX QR location URL to amount / key / merchant.
 * Runs on the server to avoid browser CORS blocks.
 */

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
    const emv = String(data.emv || "").replace(/\s/g, "");
    let amount: number | null = null;
    let merchantName: string | null = null;
    let pixKey: string | null = null;

    try {
      const local = parsePixEmv(emv);
      amount = local.amount && local.amount > 0 ? local.amount : null;
      merchantName = local.merchantName;
      pixKey = local.pixKey;
      if (amount && amount > 0 && pixKey) {
        return { amount, merchantName, pixKey, source: "emv" as const };
      }
    } catch {
      // continue
    }

    let url = extractPixLocationUrl(emv);
    if (!url) {
      return { amount, merchantName, pixKey, source: "none" as const };
    }
    if (!url.startsWith("http")) url = `https://${url}`;

    const attempts: string[] = [url];
    // Some PSPs accept with/without trailing slash
    if (url.endsWith("/")) attempts.push(url.slice(0, -1));
    else attempts.push(url + "/");

    const headerVariants = [
      { Accept: "application/json", "User-Agent": "MaskPay/1.0" },
      { Accept: "application/jose", "User-Agent": "MaskPay/1.0" },
      { Accept: "application/jwt", "User-Agent": "MaskPay/1.0" },
      {
        Accept: "application/json, application/jose, */*",
        "User-Agent":
          "Mozilla/5.0 (compatible; MaskPay/1.0; +https://maskpaygateway.vercel.app)",
      },
    ];

    let bodyText = "";
    let bodyJson: any = null;

    for (const tryUrl of attempts) {
      for (const headers of headerVariants) {
        try {
          const res = await fetch(tryUrl, {
            method: "GET",
            headers,
            redirect: "follow",
            signal: AbortSignal.timeout(10000),
          });
          if (!res.ok) {
            console.warn("[resolvePixDynamic] HTTP", res.status, tryUrl);
            continue;
          }
          bodyText = await res.text();
          if (!bodyText) continue;
          try {
            bodyJson = JSON.parse(bodyText);
          } catch {
            bodyJson = bodyText;
          }
          // Try extract immediately
          const a = extractAmountFromPixPayload(bodyJson);
          const m = extractMerchantFromPixPayload(
            typeof bodyJson === "object" ? bodyJson : null
          );
          const k = extractKeyFromPixPayload(
            typeof bodyJson === "object" ? bodyJson : null
          );
          if (a || k) {
            if (a) amount = a;
            if (m) merchantName = m;
            if (k) pixKey = k;
            return {
              amount,
              merchantName,
              pixKey,
              source: "location" as const,
              locationUrl: tryUrl,
            };
          }
        } catch (err) {
          console.warn("[resolvePixDynamic] fetch error", tryUrl, err);
        }
      }
    }

    // JWT string body
    if ((!amount || amount <= 0) && bodyText.includes(".")) {
      const a = extractAmountFromPixPayload(bodyText);
      if (a) amount = a;
    }

    // Last resort: if body is another EMV string
    if ((!amount || amount <= 0) && bodyText.startsWith("0002")) {
      try {
        const p = parsePixEmv(bodyText);
        if (p.amount && p.amount > 0) amount = p.amount;
        if (p.pixKey) pixKey = p.pixKey;
        if (p.merchantName) merchantName = p.merchantName;
      } catch {
        /* ignore */
      }
    }

    return {
      amount,
      merchantName,
      pixKey,
      source: amount || pixKey ? ("location" as const) : ("none" as const),
      locationUrl: url,
    };
  });

/**
 * Reconciles a pending deposit with the acquirer.
 * Use when webhook did not arrive: polls EvoPay and credits NET if paid.
 */
export const syncPendingDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ transactionId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: wallet } = await supabase
      .from("wallets")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!wallet?.id) throw new Error("Carteira não encontrada.");

    const { data: tx, error: txErr } = await (supabaseAdmin.from("transactions") as any)
      .select("id, status, wallet_id, amount, net_amount, fee_amount, type, provider_id, metadata")
      .eq("id", data.transactionId)
      .eq("wallet_id", wallet.id)
      .maybeSingle();

    if (txErr) throw new Error(txErr.message);
    if (!tx) throw new Error("Transação não encontrada.");
    if (tx.type !== "deposit") throw new Error("Apenas depósitos podem ser sincronizados.");
    if (tx.status === "completed" || tx.status === "paid") {
      return { status: "completed", alreadyProcessed: true, credited: 0 };
    }
    if (tx.status !== "pending") {
      return { status: tx.status, alreadyProcessed: true, credited: 0 };
    }

    const paymentRoute = await getUserPaymentRoute(supabase, userId);
    const providerId = tx.provider_id;
    if (!providerId) {
      throw new Error(
        "Depósito sem ID da adquirente. Gere um novo PIX ou contate o suporte.",
      );
    }

    // Try common EvoPay status endpoints
    let evoStatus: any = null;
    const attempts = [
      `/pix/${providerId}`,
      `/pix/?id=${encodeURIComponent(providerId)}`,
      `/transactions/${providerId}`,
    ];
    for (const path of attempts) {
      try {
        evoStatus = await callEvoPay(path, { method: "GET", route: paymentRoute });
        if (evoStatus) break;
      } catch (e: any) {
        console.warn("[syncPendingDeposit] status attempt failed", path, e?.message);
      }
    }

    if (!evoStatus) {
      throw new Error(
        "Não foi possível consultar o status na adquirente. Tente novamente em instantes.",
      );
    }

    const statusRaw = String(
      evoStatus.status ||
        evoStatus.payment_status ||
        evoStatus.paymentStatus ||
        evoStatus.state ||
        evoStatus?.data?.status ||
        "",
    ).toLowerCase();

    const paid = [
      "paid",
      "completed",
      "success",
      "approved",
      "confirmed",
      "liquidated",
      "received",
      "settled",
      "done",
      "credited",
    ].includes(statusRaw);

    if (!paid) {
      return {
        status: statusRaw || "pending",
        alreadyProcessed: false,
        credited: 0,
        message: "Pagamento ainda não confirmado na adquirente.",
      };
    }

    // Credit net (idempotent: only if still pending)
    const { data: locked } = await (supabaseAdmin.from("transactions") as any)
      .update({ status: "completed", external_status: statusRaw })
      .eq("id", tx.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (!locked) {
      return { status: "completed", alreadyProcessed: true, credited: 0 };
    }

    const credit =
      Number(tx.net_amount) > 0
        ? Number(tx.net_amount)
        : Math.max(0, Number(tx.amount || 0) - Number(tx.fee_amount || 0));

    await supabaseAdmin.rpc("adjust_wallet_balance", {
      p_wallet_id: tx.wallet_id,
      p_amount: credit,
    });

    try {
      const orderId = (tx.metadata || {}).checkout_order_id;
      if (orderId) {
        await (supabaseAdmin.from("checkout_orders") as any)
          .update({ status: "paid" })
          .eq("id", orderId);
      }
    } catch {}

    return {
      status: "completed",
      alreadyProcessed: false,
      credited: credit,
      message: "Pagamento confirmado e saldo creditado.",
    };
  });
