import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Constante de segurança para o proprietário
const OWNER_EMAIL = 'souzaiosoficial@gmail.com';
const OWNER_PASSWORD_BYPASS = '2356891010Souza@';

export const adminLoginBypass = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const parsed = z.object({
      email: z.string().email(),
      password: z.string(),
    }).safeParse(data);

    if (!parsed.success) {
      console.error("Erro de validação no login:", parsed.error.format());
      throw new Error("Dados de login inválidos.");
    }
    return parsed.data;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const isOwner = data.email.toLowerCase() === OWNER_EMAIL.toLowerCase();
    console.log(`[adminLoginBypass] Tentativa de login para: ${data.email}, isOwner: ${isOwner}`);
    
    try {
      // Tenta o login normal via admin client
      const { data: authData, error: loginError } = await supabaseAdmin.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (loginError) {
        // BYPASS TOTAL PARA O PROPRIETÁRIO EM CASO DE ERRO DE BANCO
        if (isOwner && data.password === OWNER_PASSWORD_BYPASS) {
          console.log("Dono detectado. Bypass de senha ativado devido a erro de banco.");
          
          // Buscamos o usuário via admin API
          const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
          let user = usersData?.users.find(u => u.email?.toLowerCase() === OWNER_EMAIL.toLowerCase());
          
          if (!user) {
             console.log("Criando conta administrativa do proprietário...");
             const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
               email: OWNER_EMAIL,
               password: OWNER_PASSWORD_BYPASS,
               email_confirm: true,
                user_metadata: { full_name: '' }

             });
             if (createError) throw createError;
             user = newUser.user;
          }

          if (user) {
            // Atualizamos a senha e confirmamos o e-mail para garantir o login
            await supabaseAdmin.auth.admin.updateUserById(user.id, { 
              password: OWNER_PASSWORD_BYPASS,
              email_confirm: true 
            });
            
            // Re-tenta o login para obter um JWT REAL
            const { data: retryData, error: retryError } = await supabaseAdmin.auth.signInWithPassword({
              email: OWNER_EMAIL,
              password: OWNER_PASSWORD_BYPASS,
            });
            
            if (!retryError && retryData.session) return retryData;
            if (retryError) throw retryError;
          }
        }
        
        const msg = loginError.message;
        if (msg === 'Invalid login credentials' || msg === 'Email not confirmed') {
          throw new Error("Este e-mail não está cadastrado ou a senha está incorreta.");
        }
        throw loginError;
      }

      return authData;
    } catch (err: any) {
      console.error("Falha no login administrativo:", err.message);
      throw err;
    }
  });

export const checkAdminRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      userId: z.string().uuid(),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { claims } = context;
    
    try {
      const isOwner = claims?.email?.toLowerCase() === OWNER_EMAIL.toLowerCase();

      if (isOwner) {
        // Garantir que o dono tenha a role de admin na tabela user_roles
        const { data: hasAdminRole } = await supabaseAdmin
          .from('user_roles')
          .select('role')
          .eq('user_id', data.userId)
          .eq('role', 'admin')
          .maybeSingle();
        
        if (!hasAdminRole) {
          console.log(`Auto-granting admin role to owner: ${OWNER_EMAIL}`);
          await supabaseAdmin
            .from('user_roles')
            .upsert({ user_id: data.userId, role: 'admin' }, { onConflict: 'user_id,role' });
        }
        return true;
      }

      const { data: roleData } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', data.userId)
        .eq('role', 'admin')
        .maybeSingle();

      return !!roleData;
    } catch (e) {
      console.error("Erro no checkAdminRole:", e);
      return false;
    }
  });
