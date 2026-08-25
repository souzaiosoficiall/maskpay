import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const siteUrl = () =>
  process.env["SITE_URL"] ||
  process.env["VITE_SITE_URL"] ||
  "https://pagamentosonaseguro.online";

/**
 * Request a password reset for an email.
 * Always returns success (anti-enumeration). Prefer branded Resend email
 * when RESEND_API_KEY is set; otherwise uses Supabase Auth recovery mail.
 */
export const requestPasswordReset = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ email: z.string().email() }).parse(data),
  )
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const redirectTo = `${siteUrl().replace(/\/$/, "")}/auth/reset-password`;

    try {
      // Generate recovery link (works even if user must not be revealed)
      const { data: linkData, error: linkError } =
        await supabaseAdmin.auth.admin.generateLink({
          type: "recovery",
          email,
          options: { redirectTo },
        });

      if (linkError || !linkData) {
        // Fallback: Supabase Auth recovery e-mail (uses project SMTP templates)
        await sendSupabaseRecoveryEmail(email, redirectTo);
        return {
          success: true as const,
          message:
            "Se este e-mail estiver cadastrado, você receberá um link para redefinir a senha.",
        };
      }

      const actionLink =
        (linkData as any)?.properties?.action_link ||
        (linkData as any)?.action_link ||
        null;

      if (actionLink) {
        const sent = await sendPasswordResetEmail({
          to: email,
          actionLink,
          fullName:
            (linkData as any)?.user?.user_metadata?.full_name ||
            (linkData as any)?.user?.user_metadata?.name ||
            "",
        });
        if (!sent) {
          // Resend unavailable — Supabase default recovery mail
          await sendSupabaseRecoveryEmail(email, redirectTo);
        }
      } else {
        await sendSupabaseRecoveryEmail(email, redirectTo);
      }
    } catch (e) {
      console.error("[requestPasswordReset]", e);
      try {
        await sendSupabaseRecoveryEmail(email, redirectTo);
      } catch {
        // ignore
      }
    }

    return {
      success: true as const,
      message:
        "Se este e-mail estiver cadastrado, você receberá um link para redefinir a senha.",
    };
  });

/** Uses the project's Supabase Auth / SMTP to deliver the recovery e-mail. */
async function sendSupabaseRecoveryEmail(email: string, redirectTo: string) {
  const url = process.env["SUPABASE_URL"];
  const anon =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ||
    process.env["SUPABASE_ANON_KEY"];
  if (!url || !anon) {
    console.error("[sendSupabaseRecoveryEmail] missing SUPABASE_URL / anon key");
    return;
  }
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  if (error) {
    console.error("[sendSupabaseRecoveryEmail]", error.message);
  }
}

async function sendPasswordResetEmail(opts: {
  to: string;
  actionLink: string;
  fullName?: string;
}): Promise<boolean> {
  const resendKey = process.env["RESEND_API_KEY"];
  const from =
    process.env["RESEND_FROM_EMAIL"] ||
    process.env["EMAIL_FROM"] ||
    "MaskPay <onboarding@resend.dev>";

  if (!resendKey) {
    console.warn(
      "[sendPasswordResetEmail] RESEND_API_KEY ausente — usando e-mail padrão do Supabase.",
    );
    return false;
  }

  const name = (opts.fullName || "").trim() || "tudo bem";
  const html = buildResetEmailHtml({
    name,
    actionLink: opts.actionLink,
  });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject: "Redefinir sua senha — MaskPay",
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[sendPasswordResetEmail] Resend error:", res.status, body);
    return false;
  }
  return true;
}

function buildResetEmailHtml(opts: { name: string; actionLink: string }): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Redefinir senha — MaskPay</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0a0a0a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:480px;background:#111;border:1px solid #222;border-radius:24px;overflow:hidden;">
          <tr>
            <td style="padding:32px 32px 16px;text-align:center;">
              <div style="display:inline-block;width:48px;height:48px;border-radius:14px;background:#1a1a1a;border:1px solid #333;line-height:48px;font-size:22px;color:#fff;font-weight:800;">M</div>
              <h1 style="margin:16px 0 0;font-size:22px;letter-spacing:-0.04em;color:#fff;font-weight:800;text-transform:uppercase;">MaskPay</h1>
              <p style="margin:8px 0 0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#888;font-weight:700;">Segurança da conta</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 8px;">
              <p style="margin:0;color:#ddd;font-size:15px;line-height:1.6;">
                Olá${opts.name && opts.name !== "tudo bem" ? `, <strong style="color:#fff">${escapeHtml(opts.name)}</strong>` : ""},
              </p>
              <p style="margin:16px 0 0;color:#aaa;font-size:14px;line-height:1.6;">
                Recebemos um pedido para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova senha. O link é válido por tempo limitado.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:28px 32px;">
              <a href="${escapeAttr(opts.actionLink)}"
                 style="display:inline-block;background:#fff;color:#000;text-decoration:none;font-weight:800;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;padding:16px 28px;border-radius:999px;">
                Criar nova senha
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 28px;">
              <p style="margin:0;color:#666;font-size:12px;line-height:1.5;">
                Se você não solicitou esta alteração, ignore este e-mail. Sua senha permanecerá a mesma.
              </p>
              <p style="margin:16px 0 0;color:#444;font-size:11px;line-height:1.5;word-break:break-all;">
                Se o botão não funcionar, copie e cole este link no navegador:<br/>
                <span style="color:#777;">${escapeHtml(opts.actionLink)}</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #1f1f1f;text-align:center;">
              <p style="margin:0;color:#555;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;">
                MaskPay · Gateway de pagamentos
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, "&#39;");
}
