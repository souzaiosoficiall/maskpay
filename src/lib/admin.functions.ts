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

    return { success: true };
  });

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
