// Client-side Supabase client. Session must survive tab/app close via localStorage.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { brokeredPreviewStorage } from './previewAuthStorage';

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

/**
 * Always persist to localStorage synchronously so the session survives
 * closing the tab / PWA. The Lovable preview broker is only used as a
 * best-effort mirror when embedded in the editor iframe.
 */
function createAuthStorage() {
  if (typeof window === 'undefined') return undefined;

  const broker = brokeredPreviewStorage();
  if (broker === localStorage || !broker) {
    return localStorage;
  }

  return {
    getItem: (key: string) => {
      const local = localStorage.getItem(key);
      if (local != null) return local;
      return (broker as Storage).getItem?.(key) ?? null;
    },
    setItem: (key: string, value: string) => {
      localStorage.setItem(key, value);
      try {
        (broker as Storage).setItem?.(key, value);
      } catch {
        // ignore broker errors
      }
    },
    removeItem: (key: string) => {
      localStorage.removeItem(key);
      try {
        (broker as Storage).removeItem?.(key);
      } catch {
        // ignore
      }
    },
  };
}

function createSupabaseClient() {
  const SUPABASE_URL =
    import.meta.env['VITE_SUPABASE_URL'] ||
    process.env['SUPABASE_URL'] ||
    'https://oxgnuxtjqrvxcwtkrcvs.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY =
    import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] ||
    import.meta.env['VITE_SUPABASE_ANON_KEY'] ||
    process.env['SUPABASE_PUBLISHABLE_KEY'] ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94Z251eHRqcXJ2eGN3dGtyY3ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MzkxOTQsImV4cCI6MjEwMzExNTE5NH0.qYJsDMJv-8B3ONZe2FAEtxDk1XIHygp5priof8gvjlU';

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ['SUPABASE_URL'] : []),
      ...(!SUPABASE_PUBLISHABLE_KEY ? ['SUPABASE_PUBLISHABLE_KEY'] : []),
    ];
    throw new Error(
      `Missing Supabase environment variable(s): ${missing.join(', ')}. Connect Supabase in Lovable Cloud.`,
    );
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
    },
    auth: {
      storage: createAuthStorage(),
      persistSession: true,
      storageKey: 'maskpay-auth-session',
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
