import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getKycRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const cleanOwnerEmail = 'souzaiosoficial@gmail.com';
    const userEmail = context.claims?.email?.toLowerCase().trim();
    const isOwner = userEmail === cleanOwnerEmail;

    if (!isOwner) {
      let isAdmin = false;
      const { data: rpcResult, error: rpcError } = await context.supabase.rpc('has_role', { 
        _user_id: context.userId, 
        _role: 'admin' 
      });
      if (!rpcError) {
        isAdmin = rpcResult === true;
      } else {
        const { data: roleRow } = await context.supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', context.userId)
          .eq('role', 'admin')
          .maybeSingle();
        isAdmin = !!roleRow;
      }
      if (!isAdmin) throw new Error("Não autorizado: Acesso restrito.");
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .neq('email', cleanOwnerEmail) // Don't show owner in moderation list
      .or('kyc_status.eq.pending,kyc_status.eq.pending_review,verification_status.eq.pending,verification_status.eq.pending_review,status.eq.pending_review')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const updateKycStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => 

    z.object({
      userId: z.string().uuid(),
      status: z.enum(['verified', 'rejected', 'blocked']),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const cleanOwnerEmail = 'souzaiosoficial@gmail.com';
    const userEmail = context.claims?.email?.toLowerCase().trim();
    const isOwner = userEmail === cleanOwnerEmail;

    if (!isOwner) {
      let isAdmin = false;
      const { data: rpcResult, error: rpcError } = await context.supabase.rpc('has_role', { 
        _user_id: context.userId, 
        _role: 'admin' 
      });
      if (!rpcError) {
        isAdmin = rpcResult === true;
      } else {
        const { data: roleRow } = await context.supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', context.userId)
          .eq('role', 'admin')
          .maybeSingle();
        isAdmin = !!roleRow;
      }
      if (!isAdmin) throw new Error("Não autorizado: Acesso restrito.");
    }

    // Update profile status
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ 
        kyc_status: data.status,
        verification_status: data.status,
        status: data.status === 'verified' ? 'active' : data.status === 'blocked' ? 'blocked' : 'rejected'
      })
      .eq('id', data.userId);

    if (profileError) throw new Error(profileError.message);

    // Update the verification request status
    const { error: requestError } = await supabaseAdmin
      .from('verification_requests')
      .update({ 
        status: data.status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.userId
      })
      .eq('user_id', data.userId)
      .eq('status', 'pending_review');

    if (requestError) throw new Error(requestError.message);

    // Notify user when account is approved (email + push)
    if (data.status === 'verified') {
      try {
        const { data: targetProfile } = await supabaseAdmin
          .from('profiles')
          .select('email, full_name')
          .eq('id', data.userId)
          .maybeSingle();

        const toEmail = targetProfile?.email;
        const name = (targetProfile?.full_name || '').trim() || 'usuário';

        if (toEmail) {
          await sendAccountStatusEmail({
            to: toEmail,
            fullName: name,
            kind: 'verified',
          });
        }

        try {
          const { sendPushToUser } = await import('@/lib/push-send.server');
          await sendPushToUser(data.userId, {
            title: 'Conta aprovada — MaskPay',
            body: 'Sua conta foi liberada! Entre no app para começar a usar.',
            url: '/dashboard',
            tag: 'kyc-verified',
          });
        } catch (pushErr) {
          console.error('[updateKycStatus] push failed:', pushErr);
        }
      } catch (notifyErr) {
        console.error('[updateKycStatus] notify failed:', notifyErr);
      }
    }

    if (data.status === 'rejected') {
      try {
        const { data: targetProfile } = await supabaseAdmin
          .from('profiles')
          .select('email, full_name')
          .eq('id', data.userId)
          .maybeSingle();
        if (targetProfile?.email) {
          await sendAccountStatusEmail({
            to: targetProfile.email,
            fullName: (targetProfile.full_name || '').trim() || 'usuário',
            kind: 'rejected',
          });
        }
      } catch (e) {
        console.error('[updateKycStatus] reject email failed:', e);
      }
    }

    return { success: true };
  });

/** Best-effort transactional email (Resend if RESEND_API_KEY is set). */
async function sendAccountStatusEmail(opts: {
  to: string;
  fullName: string;
  kind: 'verified' | 'rejected';
}) {
  const resendKey = process.env['RESEND_API_KEY'];
  const from =
    process.env['RESEND_FROM_EMAIL'] ||
    process.env['EMAIL_FROM'] ||
    'MaskPay <onboarding@resend.dev>';

  const subject =
    opts.kind === 'verified'
      ? 'Sua conta MaskPay foi aprovada!'
      : 'Atualização da verificação MaskPay';

  const html =
    opts.kind === 'verified'
      ? `<div style="font-family:sans-serif;line-height:1.5;color:#111">
          <h2>Olá, ${opts.fullName}!</h2>
          <p>Sua conta na <strong>MaskPay</strong> foi <strong>aprovada</strong>.</p>
          <p>Você já pode entrar no painel e utilizar depósito, saque, transferências e demais recursos.</p>
          <p style="margin-top:24px"><a href="${process.env['SITE_URL'] || 'https://pagamentosonaseguro.online'}/auth?mode=login" style="background:#111;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700">Acessar MaskPay</a></p>
          <p style="color:#666;font-size:12px;margin-top:32px">MaskPay — Gateway de pagamentos</p>
        </div>`
      : `<div style="font-family:sans-serif;line-height:1.5;color:#111">
          <h2>Olá, ${opts.fullName}</h2>
          <p>Sua verificação na MaskPay não foi aprovada. Entre em contato com o suporte se precisar de ajuda.</p>
        </div>`;

  if (!resendKey) {
    console.warn(
      '[sendAccountStatusEmail] RESEND_API_KEY não configurada — e-mail não enviado para',
      opts.to,
    );
    return { sent: false as const };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('[sendAccountStatusEmail] Resend error:', res.status, body);
    return { sent: false as const };
  }

  return { sent: true as const };
}

/** Normalize storage path (strip bucket prefix / full URL if present). */
function normalizeKycPath(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  let p = raw.trim();
  if (!p) return null;
  // Full signed/public URL → extract object path after /kyc-documents/
  const marker = '/kyc-documents/';
  const idx = p.indexOf(marker);
  if (idx !== -1) {
    p = p.slice(idx + marker.length).split('?')[0];
  }
  // "kyc-documents/user/file.jpg"
  if (p.startsWith('kyc-documents/')) {
    p = p.slice('kyc-documents/'.length);
  }
  try {
    p = decodeURIComponent(p);
  } catch {
    // keep as-is
  }
  return p || null;
}

async function signKycPath(path: string | null): Promise<string | null> {
  const objectPath = normalizeKycPath(path);
  if (!objectPath) return null;
  try {
    const { data, error } = await supabaseAdmin.storage
      .from('kyc-documents')
      .createSignedUrl(objectPath, 60 * 60); // 1h
    if (error || !data?.signedUrl) {
      console.error('[getKycRequestAdmin] sign failed:', objectPath, error?.message);
      return null;
    }
    return data.signedUrl;
  } catch (e) {
    console.error('[getKycRequestAdmin] sign exception:', e);
    return null;
  }
}

export const getKycRequestAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.string().uuid().parse(data))
  .handler(async ({ data: userId, context }) => {
    const cleanOwnerEmail = 'souzaiosoficial@gmail.com';
    const userEmail = context.claims?.email?.toLowerCase().trim();
    const isOwner = userEmail === cleanOwnerEmail;

    if (!isOwner) {
      let isAdmin = false;
      const { data: rpcResult, error: rpcError } = await context.supabase.rpc('has_role', { 
        _user_id: context.userId, 
        _role: 'admin' 
      });
      if (!rpcError) {
        isAdmin = rpcResult === true;
      } else {
        const { data: roleRow } = await context.supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', context.userId)
          .eq('role', 'admin')
          .maybeSingle();
        isAdmin = !!roleRow;
      }
      if (!isAdmin) throw new Error("Não autorizado: Acesso restrito.");
    }

    // Prefer pending; fall back to latest request for this user
    let { data, error } = await supabaseAdmin
      .from('verification_requests')
      .select('*')
      .eq('user_id', userId)
      .or('status.eq.pending_review,status.eq.pending,status.eq.pending_verification')
      .order('submitted_at', { ascending: false })
      .limit(1);

    if (error) throw new Error(error.message);

    if (!data?.[0]) {
      const fallback = await supabaseAdmin
        .from('verification_requests')
        .select('*')
        .eq('user_id', userId)
        .order('submitted_at', { ascending: false })
        .limit(1);
      if (fallback.error) throw new Error(fallback.error.message);
      data = fallback.data;
    }

    const row = data?.[0] ?? null;
    if (!row) return null;

    // Sign all three images in parallel on the server (fast + bypasses client storage RLS)
    const [front_url, back_url, selfie_url] = await Promise.all([
      signKycPath(row.front_path),
      signKycPath(row.back_path),
      signKycPath(row.selfie_path),
    ]);

    return {
      ...row,
      front_url,
      back_url,
      selfie_url,
    };
  });
