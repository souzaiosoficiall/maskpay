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
  accountRoute: z.enum(["WHITE", "BLACK"]).optional(),
});

export const registerUser = createServerFn({ method: "POST" })
  .validator((data: unknown) => registerSchema.parse(data))
  .handler(async ({ data: input }) => {
    const email = input.email.trim().toLowerCase();
    const document = input.document.trim();
    const phone = input.phone.trim();
    const fullName = input.fullName.trim();
    const accountRoute = input.accountRoute === "BLACK" ? "BLACK" : "WHITE";
    const OWNER_EMAIL = "souzaiosoficial@gmail.com";
    const isOwner = email === OWNER_EMAIL.toLowerCase();

    const { data: byEmail } = await supabaseAdmin.from("profiles").select("id").eq("email", email).limit(1);
    if (byEmail && byEmail.length) throw new Error("Este e-mail já está em uso.");
    const { data: byDoc } = await supabaseAdmin.from("profiles").select("id").eq("document", document).limit(1);
    if (byDoc && byDoc.length) throw new Error("Este CPF/CNPJ já está cadastrado.");
    const { data: byPhone } = await supabaseAdmin.from("profiles").select("id").eq("phone", phone).limit(1);
    if (byPhone && byPhone.length) throw new Error("Este telefone já está cadastrado.");

    // Do NOT auto-confirm — client signUp must send the confirmation email.
    // This server path is kept for admin/tools; app signup uses signUp + syncProfileAfterSignup.
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: false,
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
      if (/already|registered|exists/i.test(msg)) throw new Error("Este e-mail já está em uso.");
      throw new Error(msg);
    }

    const userId = created.user.id;

    await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        email,
        full_name: fullName,
        document,
        phone,
        kyc_status: isOwner ? "verified" : "unverified",
        verification_status: isOwner ? "verified" : "unverified",
        status: "active",
        account_route: accountRoute,
      } as any,
      { onConflict: "id" },
    );

    const { data: existingWallet } = await supabaseAdmin
      .from("wallets")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!existingWallet) {
      await supabaseAdmin.from("wallets").insert({
        user_id: userId,
        balance: 0,
        currency: "BRL",
      } as any);
    }

    return { success: true, email, userId };
  });

/** Called right after client signUp so profile is saved with service role (bypasses RLS). */
export const syncProfileAfterSignup = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        email: z.string().email(),
        fullName: z.string().min(2),
        document: z.string().min(11),
        phone: z.string().min(8),
        revenue: z.string().optional(),
        accountType: z.enum(["PF", "PJ"]).optional(),
        accountRoute: z.enum(["WHITE", "BLACK"]).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data: input }) => {
    const email = input.email.trim().toLowerCase();
    const fullName = input.fullName.trim();
    const document = input.document.trim();
    const phone = input.phone.trim();
    const accountRoute = input.accountRoute === "BLACK" ? "BLACK" : "WHITE";
    const OWNER_EMAIL = "souzaiosoficial@gmail.com";
    const isOwner = email === OWNER_EMAIL.toLowerCase();

    // Keep Auth metadata in sync (helps getProfile recovery)
    try {
      await supabaseAdmin.auth.admin.updateUserById(input.userId, {
        user_metadata: {
          full_name: fullName,
          document,
          phone,
          revenue_bracket: input.revenue || null,
          account_type: input.accountType || null,
          account_route: accountRoute,
        },
      });
    } catch (e) {
      console.error("[syncProfileAfterSignup] updateUserById failed:", e);
    }

    const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
      {
        id: input.userId,
        email,
        full_name: fullName,
        document,
        phone,
        kyc_status: isOwner ? "verified" : "unverified",
        verification_status: isOwner ? "verified" : "unverified",
        status: "active",
        account_route: accountRoute,
      } as any,
      { onConflict: "id" },
    );

    if (profileError) {
      console.error("[syncProfileAfterSignup] profile upsert:", profileError);
      throw new Error(profileError.message || "Falha ao salvar perfil.");
    }

    const { data: existingWallet } = await supabaseAdmin
      .from("wallets")
      .select("id")
      .eq("user_id", input.userId)
      .maybeSingle();

    if (!existingWallet) {
      await supabaseAdmin.from("wallets").insert({
        user_id: input.userId,
        balance: 0,
        currency: "BRL",
      } as any);
    }

    return { success: true };
  });

/** Pre-check duplicates before client signUp (optional, used by auth form). */
export const checkRegistrationAvailability = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        email: z.string().email(),
        document: z.string().min(11),
        phone: z.string().min(8),
      })
      .parse(data),
  )
  .handler(async ({ data: input }) => {
    const email = input.email.trim().toLowerCase();
    const document = input.document.trim();
    const phone = input.phone.trim();

    const { data: byEmail } = await supabaseAdmin.from("profiles").select("id").eq("email", email).limit(1);
    if (byEmail && byEmail.length) throw new Error("Este e-mail já está em uso.");
    const { data: byDoc } = await supabaseAdmin.from("profiles").select("id").eq("document", document).limit(1);
    if (byDoc && byDoc.length) throw new Error("Este CPF/CNPJ já está cadastrado.");
    const { data: byPhone } = await supabaseAdmin.from("profiles").select("id").eq("phone", phone).limit(1);
    if (byPhone && byPhone.length) throw new Error("Este telefone já está cadastrado.");

    return { ok: true };
  });
