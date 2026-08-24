import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(2),
  document: z.string().min(11),
  phone: z.string().min(8),
  revenue: z.string().optional(),
  accountType: z.enum(["PF", "PJ"]),
});

/**
 * Server-side registration:
 * - Creates the Auth user with email already confirmed (no confirmation email).
 * - Upserts profile + wallet with service role (bypasses RLS).
 * - Returns success so the client can signInWithPassword and start a session.
 */
export const registerUser = createServerFn({ method: "POST" })
  .validator((data: unknown) => registerSchema.parse(data))
  .handler(async ({ data: input }) => {
    const email = input.email.trim().toLowerCase();
    const document = input.document.trim();
    const phone = input.phone.trim();
    const fullName = input.fullName.trim();
    const OWNER_EMAIL = "souzaiosoficial@gmail.com";
    const isOwner = email === OWNER_EMAIL.toLowerCase();

    // Duplicate checks (profiles)
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id, email, document, phone")
      .or(`email.eq.${email},document.eq.${document},phone.eq.${phone}`)
      .limit(5);

    if (existing && existing.length > 0) {
      const hit = existing[0] as any;
      if (hit.email?.toLowerCase() === email) {
        throw new Error("Este e-mail já está em uso.");
      }
      if (hit.document === document) {
        throw new Error("Este CPF/CNPJ já está cadastrado.");
      }
      if (hit.phone === phone) {
        throw new Error("Este telefone já está cadastrado.");
      }
      throw new Error("Já existe uma conta ativa com estes dados.");
    }

    // Create auth user already confirmed — no confirmation email is sent.
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        document,
        phone,
        revenue_bracket: input.revenue || null,
        account_type: input.accountType,
      },
    });

    if (createError || !created?.user) {
      const msg = createError?.message || "Falha ao criar conta.";
      if (/already|registered|exists/i.test(msg)) {
        throw new Error("Este e-mail já está em uso.");
      }
      throw new Error(msg);
    }

    const userId = created.user.id;

    // Profile — must exist for admin list and KYC flow
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        email,
        full_name: fullName,
        document,
        phone,
        // unverified until the user actually submits documents
        kyc_status: isOwner ? "verified" : "unverified",
        verification_status: isOwner ? "verified" : "unverified",
        status: "active",
        account_route: "WHITE",
      } as any,
      { onConflict: "id" },
    );

    if (profileError) {
      console.error("[registerUser] profile upsert error:", profileError);
    }

    // Wallet (unique is typically user_id + currency)
    const { data: existingWallet } = await supabaseAdmin
      .from("wallets")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!existingWallet) {
      const { error: walletError } = await supabaseAdmin.from("wallets").insert({
        user_id: userId,
        balance: 0,
        currency: "BRL",
      } as any);

      if (walletError) {
        console.error("[registerUser] wallet insert error:", walletError);
      }
    }

    return {
      success: true,
      email,
    };
  });
