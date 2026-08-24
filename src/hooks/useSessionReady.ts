import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isSecurityLocked, clearAuthStorage } from '@/lib/security-lock';

/**
 * True once a persisted session with access_token has been restored.
 * False while restoring or when logged out.
 */
export function useSessionReady() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    if (isSecurityLocked()) {
      clearAuthStorage();
      setReady(false);
      supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (isSecurityLocked()) {
        setReady(false);
        return;
      }
      const has = !!data.session?.access_token;
      setReady(has);
      if (has) {
        try {
          if (!window.localStorage.getItem('maskpay-login-timestamp')) {
            window.localStorage.setItem('maskpay-login-timestamp', String(Date.now()));
          }
        } catch {
          // ignore
        }
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      const has = !!session?.access_token;
      setReady(has);

      if (has && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
        try {
          window.localStorage.setItem('maskpay-login-timestamp', String(Date.now()));
        } catch {
          // ignore
        }
      }

      if (event === 'SIGNED_OUT') {
        try {
          window.localStorage.removeItem('maskpay-login-timestamp');
        } catch {
          // ignore
        }
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return ready;
}
