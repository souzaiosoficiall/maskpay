import { useEffect, useState } from 'react';
import { adminSupabase } from '@/integrations/supabase/admin-client';
import { isSecurityLocked, clearAuthStorage } from '@/lib/security-lock';

/**
 * True once the isolated admin session (maskpay-admin-auth-session) has been restored.
 * Must be used on /aylla routes — do NOT use the regular useSessionReady there,
 * because that hook reads the user app session (maskpay-auth-session).
 */
export function useAdminSessionReady() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    if (isSecurityLocked()) {
      clearAuthStorage();
      setReady(false);
      adminSupabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    }

    adminSupabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (isSecurityLocked()) {
        setReady(false);
        return;
      }
      setReady(!!data.session?.access_token);
    }).catch(() => {
      if (mounted) setReady(false);
    });

    const { data: sub } = adminSupabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setReady(!!session?.access_token);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return ready;
}
