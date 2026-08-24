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

export const registerUser = createServerFn({ method: "POST" })
  .validator((data: unknown) => registerSchema.parse(data))
  .handler(async ({ data: input }) => {
    const email = input.email.trim().toLowerCase();
    const document = input.document.trim();
    const phone = input.phone.trim();
    const fullName = input.fullName.trim();
    const OWNER_EMAIL = "souzaiosoficial@gmail.com";
    const isOwner = email === OWNER_EMAIL.toLowerCase();

    const { data: byEmail } = await supabaseAdmin.from("profiles").select("id").eq("email", email).limit(1);
    if (byEmail && byEmail.length) throw new Error("Este e-mail já está em uso.");
    const { data: byDoc } = await supabaseAdmin.from("profiles").select("id").eq("document", document).limit(1);
    if (byDoc && byDoc.length) throw new Error("Este CPF/CNPJ já está cadastrado.");
    const { data: byPhone } = await supabaseAdmin.from("profiles").select("id").eq("phone", phone).limit(1);
    if (byPhone && byPhone.length) throw new Error("Este telefone já está cadastrado.");

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
        account_route: "WHITE",
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

    return { success: true, email };
  });
