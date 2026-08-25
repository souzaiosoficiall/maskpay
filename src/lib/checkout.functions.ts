import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchPlatformFees, getUserPaymentRoute } from "./platform-fees.server";
import { calculateDepositAmounts } from "./fees-logic";
import { callEvoPay } from "./evopay-client.server";

function getWebhookUrl(): string {
  const siteUrl = process.env["SITE_URL"];
  const host = process.env["HOST"];
  const vercel = process.env["VERCEL_URL"];
  let base: string | null = null;
  if (siteUrl) base = siteUrl;
  else if (host) base = `https://${host}`;
  else if (vercel) base = `https://${vercel}`;
  if (!base) return "https://localhost/api/public/payment-webhook";
  return `${String(base).replace(/\/$/, "")}/api/public/payment-webhook`;
}

function extractPixCodes(evoData: any): { emv: string | null; qrImageBase64: string | null } {
  if (!evoData || typeof evoData !== "object") return { emv: null, qrImageBase64: null };
  const emv =
    evoData.qrCodeText ||
    evoData.brCode ||
    evoData.emv ||
    evoData.pixCopyPaste ||
    evoData.pix_copy_paste ||
    evoData.copy_paste ||
    evoData.copyPaste ||
    evoData.payload ||
    (typeof evoData.qrCode === "string" && String(evoData.qrCode).startsWith("00020")
      ? evoData.qrCode
      : null) ||
    null;
  const qrImageBase64 =
    evoData.qrCodeBase64 || evoData.qrCodeImage || evoData.pix_qrcode_base64 || null;
  return { emv: emv || null, qrImageBase64: qrImageBase64 || null };
}

const feedbackSchema = z.object({
  name: z.string().min(1).max(80),
  avatar_url: z.string().max(500).optional().default(""),
  comment: z.string().min(1).max(500),
});

function slugify(title: string) {
  const base = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || "produto"}-${suffix}`;
}

export type CheckoutFeedback = z.infer<typeof feedbackSchema>;

export const listMyCheckoutProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await (supabase.from("checkout_products") as any)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []) as any[];
  });

export const createCheckoutProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        title: z.string().min(2).max(120),
        description: z.string().max(2000).optional().default(""),
        amount: z.number().min(1),
        theme_color: z.string().min(4).max(20).optional().default("#22c55e"),
        banner_url: z.string().max(1000).optional().nullable(),
        icon_url: z.string().max(1000).optional().nullable(),
        feedbacks: z.array(feedbackSchema).max(20).optional().default([]),
        active: z.boolean().optional().default(true),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const slug = slugify(data.title);
    const { data: row, error } = await (supabase.from("checkout_products") as any)
      .insert({
        user_id: userId,
        slug,
        title: data.title,
        description: data.description || "",
        amount: data.amount,
        theme_color: data.theme_color || "#22c55e",
        banner_url: data.banner_url || null,
        icon_url: data.icon_url || null,
        feedbacks: data.feedbacks || [],
        active: data.active ?? true,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateCheckoutProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().min(2).max(120).optional(),
        description: z.string().max(2000).optional(),
        amount: z.number().min(1).optional(),
        theme_color: z.string().min(4).max(20).optional(),
        banner_url: z.string().max(1000).optional().nullable(),
        icon_url: z.string().max(1000).optional().nullable(),
        feedbacks: z.array(feedbackSchema).max(20).optional(),
        active: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, ...rest } = data;
    const updates: any = { updated_at: new Date().toISOString() };
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined) updates[k] = v;
    }
    const { data: row, error } = await (supabase.from("checkout_products") as any)
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteCheckoutProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await (supabase.from("checkout_products") as any)
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

/** Public: load product by slug (no auth). */
export const getCheckoutProductBySlug = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ slug: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await (supabaseAdmin.from("checkout_products") as any)
      .select(
        "id, slug, title, description, amount, theme_color, banner_url, icon_url, feedbacks, active, user_id",
      )
      .eq("slug", data.slug)
      .eq("active", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Produto não encontrado ou inativo.");
    // Don't expose merchant user_id to client unnecessarily — keep for payment server-side only via re-fetch
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      amount: Number(row.amount),
      theme_color: row.theme_color,
      banner_url: row.banner_url,
      icon_url: row.icon_url,
      feedbacks: Array.isArray(row.feedbacks) ? row.feedbacks : [],
    };
  });

/**
 * Public checkout payment: creates order + Pix charge credited to merchant wallet.
 */
export const createCheckoutPayment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        slug: z.string().min(1),
        customer_name: z.string().min(2).max(120),
        customer_email: z.string().email().max(200),
        customer_phone: z.string().min(8).max(30),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: product, error: pErr } = await (supabaseAdmin.from("checkout_products") as any)
      .select("*")
      .eq("slug", data.slug)
      .eq("active", true)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!product) throw new Error("Produto não encontrado ou inativo.");

    const merchantId = product.user_id as string;
    const amount = Number(product.amount);
    if (!amount || amount < 1) throw new Error("Valor do produto inválido.");

    const paymentRoute = await getUserPaymentRoute(supabaseAdmin, merchantId);
    const feesResp = await fetchPlatformFees(supabaseAdmin, paymentRoute);
    const { feeAmount, netAmount } = calculateDepositAmounts(amount, feesResp.deposit);

    const { data: wallet, error: wErr } = await supabaseAdmin
      .from("wallets")
      .select("id")
      .eq("user_id", merchantId)
      .maybeSingle();
    if (wErr || !wallet?.id) throw new Error("Carteira do vendedor não encontrada.");

    const { data: order, error: oErr } = await (supabaseAdmin.from("checkout_orders") as any)
      .insert({
        product_id: product.id,
        merchant_user_id: merchantId,
        customer_name: data.customer_name,
        customer_email: data.customer_email,
        customer_phone: data.customer_phone,
        amount,
        status: "pending",
        metadata: { product_title: product.title, slug: product.slug },
      })
      .select()
      .single();
    if (oErr) throw new Error(oErr.message);

    const { data: tx, error: txError } = await (supabaseAdmin.from("transactions") as any)
      .insert({
        wallet_id: wallet.id,
        amount,
        fee_amount: feeAmount,
        net_amount: netAmount,
        type: "deposit",
        status: "pending",
        description: `Checkout: ${product.title} — ${data.customer_name}`,
        metadata: {
          account_route: paymentRoute,
          fee_route: feesResp.route,
          checkout_order_id: order.id,
          checkout_product_id: product.id,
          customer_name: data.customer_name,
          customer_email: data.customer_email,
          customer_phone: data.customer_phone,
          source: "checkout",
        },
      })
      .select()
      .single();
    if (txError) throw new Error(txError.message);

    await (supabaseAdmin.from("checkout_orders") as any)
      .update({ transaction_id: tx.id })
      .eq("id", order.id);

    const evoData = await callEvoPay("/pix/", {
      route: paymentRoute,
      method: "POST",
      body: {
        amount: Number(amount.toFixed(2)),
        callbackUrl: getWebhookUrl(),
        clientReference: String(tx.id),
      },
    });

    const providerId = evoData?.id || evoData?.transactionId || evoData?.transaction_id || null;
    const { emv, qrImageBase64 } = extractPixCodes(evoData);

    await (supabaseAdmin.from("transactions") as any)
      .update({
        provider_id: providerId,
        metadata: {
          ...(tx.metadata || {}),
          provider_raw: evoData,
          clientReference: String(tx.id),
        },
      })
      .eq("id", tx.id);

    if (!emv) {
      throw new Error("A adquirente não retornou o código Pix. Tente novamente.");
    }

    return {
      orderId: order.id,
      transactionId: tx.id,
      amount,
      feeAmount,
      netAmount,
      qrCode: emv,
      copyPaste: emv,
      qrImageBase64: qrImageBase64 || null,
      productTitle: product.title,
      theme_color: product.theme_color,
    };
  });
