/**
 * Supabase client isolado para o painel admin.
 * Usa storageKey diferente do app do usuário para as duas sessões
 * poderem coexistir em abas diferentes sem se sobrescreverem.
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }
    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function createAdminSupabaseClient() {
  const SUPABASE_URL =
    import.meta.env['VITE_SUPABASE_URL'] ||
    process.env['SUPABASE_URL'] ||
    'https://oxgnuxtjqrvxcwtkrcvs.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY =
    import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] ||
    import.meta.env['VITE_SUPABASE_ANON_KEY'] ||
    process.env['SUPABASE_PUBLISHABLE_KEY'] ||
    '';

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('Missing Supabase env for admin client');
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
    },
    auth: {
      // Isolation from user session (maskpay-auth-session)
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      persistSession: true,
      storageKey: 'maskpay-admin-auth-session',
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });
}

let _admin: ReturnType<typeof createAdminSupabaseClient> | undefined;

export const adminSupabase = new Proxy({} as ReturnType<typeof createAdminSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_admin) _admin = createAdminSupabaseClient();
    return Reflect.get(_admin, prop, receiver);
  },
});
