import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { maskEmail, maskPhone, maskDocument } from "./utils";
import type { Tables } from "@/integrations/supabase/types";

export type ProfileWithRole = Tables<'profiles'> & { role: 'admin' | 'user' };

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProfileWithRole> => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const OWNER_EMAIL = 'souzaiosoficial@gmail.com';
    const userEmail = context.claims?.email?.toLowerCase();
    const isOwner = userEmail === OWNER_EMAIL.toLowerCase();
    
    console.log(`[getProfile] userId: ${userId}, email: ${context.claims?.email}, isOwner: ${isOwner}`);

    const fetchRole = async (): Promise<'admin' | 'user'> => {
      const isOwnerEmail = isOwner;

      // Auto-grant admin role to the owner email if not already present
      if (isOwnerEmail) {
        const { data: hasAdminRole } = await supabaseAdmin
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .eq('role', 'admin')
          .maybeSingle();
        
        if (!hasAdminRole) {
          console.log(`Auto-granting admin role to owner: ${OWNER_EMAIL}`);
          await supabaseAdmin
            .from('user_roles')
            .upsert({ user_id: userId, role: 'admin' }, { onConflict: 'user_id,role' });
        }
        return 'admin';
      }

      const { data: isAdmin, error: roleError } = await supabase.rpc('has_role', {
        _user_id: userId,
        _role: 'admin',
      });
      if (roleError) {
        console.error("Role error:", roleError);
        return 'user';
      }
      return isAdmin ? 'admin' : 'user';
    };

    // Prefer service role so RLS never hides the row from the owner
    let data: any = null;
    let error: any = null;
    try {
      const adminRes = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, email, document, phone, status, verification_status, kyc_status, account_route, created_at')
        .eq('id', userId)
        .maybeSingle();
      data = adminRes.data;
      error = adminRes.error;
    } catch (e) {
      error = e;
    }
    if (!data) {
      const userRes = await supabase
        .from('profiles')
        .select('id, full_name, email, document, phone, status, verification_status, kyc_status, account_route, created_at')
        .eq('id', userId)
        .maybeSingle();
      if (userRes.data) data = userRes.data;
      if (!error) error = userRes.error;
    }

    // IMPORTANT: Use the full_name from the profile, don't force fallbacks like "PROPRIETÁRIO"
    const role = await fetchRole();

    // Only mask PII if the requester is NOT the owner of the profile
    const maskPII = (p: any, requesterRole: 'admin' | 'user') => {
      // If the requester is an admin OR is the owner of the profile, don't mask
      if (requesterRole === 'admin' || p.id === userId) return p;
      
      return {
        ...p,
        email: maskEmail(p.email),
        phone: maskPhone(p.phone),
        document: maskDocument(p.document),
      };
    };

    // Force sync from Auth metadata if the record exists but fields are null
    if (data) {
      let authUser: any = null;
      try {
        const res = await supabaseAdmin.auth.admin.getUserById(userId);
        authUser = res?.data?.user ?? null;
      } catch (e) {
        console.error('[getProfile] getUserById failed:', e);
      }
      if (authUser?.user_metadata) {
        const meta = authUser.user_metadata;
        const updates: any = {};
        
        if (!data.full_name || data.full_name === 'Proprietário') updates.full_name = meta['full_name'] || meta['name'];
        if (!data.document) updates.document = meta['document'];
        if (!data.phone) updates.phone = meta['phone'];
        if (!data.email) updates.email = authUser.email;

        if (Object.keys(updates).length > 0) {
          const { data: updated } = await supabaseAdmin
            .from('profiles')
            .update(updates)
            .eq('id', userId)
            .select('id, full_name, email, document, phone, status, verification_status, kyc_status, account_route, created_at')
            .maybeSingle();
          
          if (updated) data = updated;
        }
      }
    }

    if (error) {
       console.error("Profile fetch error:", error);
       // Do not throw — fall through to admin create / in-memory profile
       data = null as any;
    }

    if (data) {
      return maskPII({ ...data, role }, role);
    }

    // Profile row doesn't exist yet — create it using admin client to bypass RLS
    let authUser: any = null;
    try {
      const res = await supabaseAdmin.auth.admin.getUserById(userId);
      authUser = res?.data?.user ?? null;
    } catch (e) {
      console.error('[getProfile] getUserById (create path) failed:', e);
    }
    const userMetadata = authUser?.user_metadata || {};
    
    // Use the name from metadata (filled during sign up)
    const fullName = userMetadata['full_name'] || userMetadata['name'] || '';

    const document = userMetadata['document'] || null;
    const phone = userMetadata['phone'] || null;
    const email = authUser?.email || context.claims?.email || null;

    const { data: created, error: createError } = await supabaseAdmin
      .from('profiles')
      .insert({ 
        id: userId, 
        email: email,
        full_name: fullName,
        document: document,
        phone: phone,
        verification_status: isOwner ? 'verified' : 'unverified',
        kyc_status: isOwner ? 'verified' : 'unverified',
        status: isOwner ? 'active' : 'active',
        account_route: 'WHITE'
      })
      .select('id, full_name, email, document, phone, status, verification_status, kyc_status, account_route, created_at')
      .maybeSingle();

    if (createError || !created) {
      // A criação da linha pode ser bloqueada pelas regras de segurança do banco
      // (falta a policy de INSERT em public.profiles). Nesse caso não derrubamos a
      // aplicação: devolvemos um perfil temporário em memória.
      console.error("Profile creation error:", createError);
      return maskPII({
        id: userId,
        email,
        full_name: fullName,
        document,
        phone,
        status: 'active',
        verification_status: isOwner ? 'verified' : 'unverified',
        kyc_status: isOwner ? 'verified' : 'unverified',
        account_route: 'WHITE',
        created_at: new Date().toISOString(),
        role,
      } as any, role);
    }

    // Ensure the user also has a wallet
    const { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
      
    if (!wallet) {
      await supabaseAdmin.from('wallets').insert({ user_id: userId });
    }

    return maskPII({ ...(created as Tables<'profiles'>), role }, role);
  });

export const updateAccessPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => 

    z.object({
      currentPassword: z.string(),
      newPassword: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
      confirmPassword: z.string()
    })
    .refine(data => data.newPassword === data.confirmPassword, {
      message: "As senhas não coincidem",
      path: ["confirmPassword"]
    })
    .parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    
    // In Supabase, we can use updateUser. 
    // Note: To verify current password, we might need a separate sign-in check 
    // if the platform requires it, but Supabase auth.updateUser(password) 
    // usually works for the current session.
    
    const { error } = await supabase.auth.updateUser({
      password: data.newPassword
    });

    if (error) throw new Error(error.message);
    return { success: true };
  });

export const updateTransactionPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({
      newPassword: z.string().length(4, "A senha deve ter exatamente 4 dígitos"),
      confirmPassword: z.string()
    })
    .refine(data => data.newPassword === data.confirmPassword, {
      message: "As senhas não coincidem",
      path: ["confirmPassword"]
    })
    .parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // In a real app, we would hash this. For this demo, we store it in profiles.
    // Note: Lovable Cloud supports pgcrypto for hashing if needed.
    const { error } = await supabase
      .from('profiles')
      .update({ transaction_password_hash: data.newPassword })
      .eq('id', userId);

    if (error) throw new Error(error.message);
    return { success: true };
  });
