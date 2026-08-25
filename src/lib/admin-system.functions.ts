import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth, requireAdminRole } from "@/integrations/supabase/auth-middleware";
import { OWNER_EMAIL } from "./admin-auth.constants";

// Middleware to ensure admin role and authorized email
const ensureAdmin = async (context: any) => {
  if (!context) throw new Error("Acesso negado: Contexto inválido.");
  
  const cleanOwnerEmail = OWNER_EMAIL.toLowerCase().trim();
  const userEmail = context.claims?.email?.toLowerCase().trim();
  
  if (userEmail === cleanOwnerEmail) {
    return context;
  }

  if (context.supabase) {
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
    
    if (isAdmin) return context;
  }
  
  throw new Error("Não autorizado: Acesso restrito.");
};

export const getAllUsers = createServerFn({ method: "GET" })
  .middleware([requireAdminRole])
  .handler(async ({ context }: { context: any }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await ensureAdmin(context);

    // Fonte principal: tabela profiles (não depende de listUsers / service role).
    // wallets + KYC em paralelo para reduzir latência.
    const [profilesRes, walletsRes, requestsRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select(
          "id, full_name, email, document, phone, status, verification_status, kyc_status, account_route, created_at",
        )
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("wallets").select("user_id, balance"),
      supabaseAdmin
        .from("verification_requests")
        .select("id, user_id, status, submitted_at, front_path, back_path, selfie_path")
        .order("submitted_at", { ascending: false }),
    ]);

    if (profilesRes.error) {
      console.error("[getAllUsers] profiles:", profilesRes.error);
      throw new Error(
        profilesRes.error.message ||
          "Falha ao carregar usuários. Verifique SUPABASE_SERVICE_ROLE_KEY no Vercel.",
      );
    }

    const profiles = profilesRes.data || [];
    if (walletsRes.error) {
      console.warn("[getAllUsers] wallets:", walletsRes.error.message);
    }
    if (requestsRes.error) {
      console.warn("[getAllUsers] verification_requests:", requestsRes.error.message);
    }

    const balanceByUser = new Map<string, number>(
      (walletsRes.data || []).map((w: any) => [w.user_id, Number(w.balance)]),
    );

    const requestsByUser = new Map<string, any[]>();
    for (const r of requestsRes.data || []) {
      const list = requestsByUser.get(r.user_id) || [];
      list.push(r);
      requestsByUser.set(r.user_id, list);
    }

    // Enriquecimento opcional via Auth Admin API (só se service role estiver ok)
    const authMeta = new Map<string, { email?: string; full_name?: string; created_at?: string }>();
    try {
      const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers({
        perPage: 1000,
      });
      if (!authError && authUsers?.users) {
        for (const user of authUsers.users) {
          authMeta.set(user.id, {
            email: user.email,
            full_name:
              (user.user_metadata as any)?.full_name ||
              (user.user_metadata as any)?.name,
            created_at: user.created_at,
          });
        }
      }
    } catch (e) {
      console.warn("[getAllUsers] listUsers indisponível (service role?):", e);
    }

    return profiles.map((p: any) => {
      const meta = authMeta.get(p.id);
      return {
        id: p.id,
        email: p.email || meta?.email || "N/A",
        full_name: p.full_name || meta?.full_name || "Usuário sem Nome",
        document: p.document || null,
        phone: p.phone || null,
        status: p.status || "active",
        verification_status: p.verification_status || "unverified",
        kyc_status: p.kyc_status || "unverified",
        account_route: p.account_route || "WHITE",
        created_at: p.created_at || meta?.created_at,
        wallets: balanceByUser.has(p.id) ? [{ balance: balanceByUser.get(p.id) }] : [],
        verification_requests: requestsByUser.get(p.id) || [],
      };
    }) as any[];
  });

export const updateUserStatus = createServerFn({ method: "POST" })
  .middleware([requireAdminRole])

  .validator((data: unknown) => 

    z.object({
      userId: z.string().uuid(),
      status: z.enum(['active', 'blocked', 'accepted', 'rejected']),
      kycStatus: z.enum(['pending', 'verified', 'rejected']).optional(),
      verificationStatus: z.enum(['unverified', 'pending_review', 'verified', 'rejected']).optional(),
    }).parse(data)
  )
  .handler(async ({ data, context }: { data: any, context: any }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const updates: any = { status: data.status };
    if (data.kycStatus) updates.kyc_status = data.kycStatus;
    if (data.verificationStatus) updates.verification_status = data.verificationStatus;

    const { error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', data.userId);

    if (error) throw new Error(error.message);

    await supabaseAdmin.from('admin_logs' as any).insert({
      admin_id: context.userId,
      target_user_id: data.userId,
      action: `USER_STATUS_UPDATE`,
      details: { new_status: data.status, updates }
    } as any);

    return { success: true };
  });

export const updateBalance = createServerFn({ method: "POST" })
  .middleware([requireAdminRole])

  .validator((data: unknown) => 

    z.object({
      userId: z.string().uuid(),
      amount: z.number(),
      type: z.enum(['add', 'set']),
      description: z.string().optional(),
    }).parse(data)
  )
  .handler(async ({ data, context }: { data: any, context: any }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('balance, id, user_id')
      .eq('user_id', data.userId)
      .single();

    if (walletError) throw new Error(walletError.message);

    const current = Number(wallet.balance) || 0;
    // 'set' replaces balance (including 0.00 to zero out). 'add' increments.
    const newBalance =
      data.type === 'add'
        ? current + Number(data.amount)
        : Number(data.amount);

    if (Number.isNaN(newBalance)) {
      throw new Error('Valor de saldo inválido');
    }

    const { error } = await supabaseAdmin
      .from('wallets')
      .update({ balance: newBalance })
      .eq('user_id', data.userId);

    if (error) throw new Error(error.message);

    await supabaseAdmin.from('admin_logs' as any).insert({
      admin_id: context.userId,
      target_user_id: data.userId,
      action: `BALANCE_UPDATE`,
      details: { amount: data.amount, type: data.type, new_balance: newBalance, description: data.description }
    } as any);

    return { success: true };
  });

export const updateAccountRoute = createServerFn({ method: "POST" })
  .middleware([requireAdminRole])

  .validator((data: unknown) => 

    z.object({
      userId: z.string().uuid(),
      route: z.enum(['WHITE', 'BLACK']),
    }).parse(data)
  )
  .handler(async ({ data, context }: { data: any, context: any }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ account_route: data.route } as any)
      .eq('id', data.userId);

    if (error) throw new Error(error.message);

    await supabaseAdmin.from('admin_logs' as any).insert({
      admin_id: context.userId,
      target_user_id: data.userId,
      action: `ROUTE_UPDATE`,
      details: { new_route: data.route }
    } as any);

    return { success: true };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireAdminRole])

  .validator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))

  .handler(async ({ data, context }: { data: any, context: any }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const digits = '23456789';
    const symbols = '!@#$%&*?';
    const all = upper + lower + digits + symbols;
    const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
    const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
    while (chars.length < 14) chars.push(pick(all));
    const newPassword = chars.sort(() => Math.random() - 0.5).join('');

    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      data.userId,
      { password: newPassword }
    );

    if (error) throw new Error(error.message);

    await supabaseAdmin.from('admin_logs' as any).insert({
      admin_id: context.userId,
      target_user_id: data.userId,
      action: `PASSWORD_RESET`
    } as any);

    return { success: true, newPassword };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireAdminRole])

  .validator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }: { data: any, context: any }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Prevent deleting the owner
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('id', data.userId)
      .maybeSingle();

    if (profile?.email?.toLowerCase() === OWNER_EMAIL.toLowerCase()) {
      throw new Error("Não é possível remover a conta do proprietário.");
    }

    const userId = data.userId as string;

    // Best-effort: invalidate all sessions for this user before deleting
    // so the client JWT stops working as soon as possible
    try {
      // @ts-expect-error — available on recent supabase-js admin API
      await supabaseAdmin.auth.admin.signOut(userId, 'global');
    } catch {
      // ignore if API not supported
    }
    try {
      // Ban briefly then delete — helps some clients drop the session faster
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        ban_duration: '876000h',
      });
    } catch {
      // ignore if already gone / API unavailable
    }

    // Explicit cleanup of related rows (in case some FKs are ON DELETE SET NULL / missing cascade)
    // Order: dependents first, profiles last
    const byUserId = [
      'push_subscriptions',
      'api_keys',
      'webhooks',
      'tickets',
      'user_roles',
      'verification_requests',
      'wallets',
    ] as const;
    for (const table of byUserId) {
      try {
        await (supabaseAdmin.from(table as any) as any).delete().eq('user_id', userId);
      } catch {
        // table may not exist in every environment
      }
    }
    try {
      await supabaseAdmin.from('profiles').delete().eq('id', userId);
    } catch {
      // ignore
    }

    // Auth delete (also cascades to profiles/wallets where ON DELETE CASCADE is set)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) throw new Error(error.message);

    await supabaseAdmin.from('admin_logs' as any).insert({
      admin_id: context.userId,
      target_user_id: userId,
      action: `USER_DELETED`,
      details: { email: profile?.email }
    } as any);

    return { success: true };
  });

export const getAdminLogs = createServerFn({ method: "GET" })
  .middleware([requireAdminRole])

  .handler(async ({ context }: { context: any }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from('admin_logs' as any)
      .select('id, admin_id, target_user_id, action, details, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error("Erro ao buscar logs:", error);
      return [];
    }
    const logs = (data || []) as any[];

    const ids = Array.from(new Set(
      logs.flatMap((l) => [l.admin_id, l.target_user_id]).filter(Boolean)
    ));

    let profileMap: Record<string, { full_name: string | null; email: string | null }> = {};
    if (ids.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, email')
        .in('id', ids);
      profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));
    }

    return logs.map((l) => ({
      ...l,
      profiles: l.admin_id ? profileMap[l.admin_id] ?? null : null,
      target: l.target_user_id ? profileMap[l.target_user_id] ?? null : null,
    }));
  });

export const updatePlatformFees = createServerFn({ method: "POST" })
  .middleware([requireAdminRole])
  .validator((data: unknown) => 
    z.object({
      pix_deposit_fees: z.object({
        percentage: z.number().min(0),
        fixed: z.number().min(0)
      }),
      pix_withdrawal_fees: z.object({
        fixed: z.number().min(0)
      })
    }).parse(data)
  )
  .handler(async ({ data, context }: { data: any, context: any }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const updates = [
      { key: 'pix_deposit_fees', value: { percentage: Number(data.pix_deposit_fees.percentage), fixed: Number(data.pix_deposit_fees.fixed) } },
      { key: 'pix_withdrawal_fees', value: { fixed: Number(data.pix_withdrawal_fees.fixed) } }
    ];

    for (const update of updates) {
      const { error } = await (supabaseAdmin.from('platform_configs' as any) as any)
        .upsert(update, { onConflict: 'key' });
      
      if (error) throw new Error(error.message);
    }

    await supabaseAdmin.from('admin_logs' as any).insert({
      admin_id: context.userId,
      action: `UPDATE_PLATFORM_FEES`,
      details: data
    } as any);

    return { success: true };
  });
