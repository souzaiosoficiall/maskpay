import { createFileRoute, useNavigate, useLocation } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useEffect, useState, useCallback } from 'react';
import { getProfile, type ProfileWithRole } from '@/lib/settings.functions';
import { updateLastAccess } from '@/lib/auth-session.functions';
import { useSessionReady } from '@/hooks/useSessionReady';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { AppLockScreen, isAppUnlocked, markAppUnlocked } from '@/components/AppLockScreen';

export const Route = createFileRoute('/_authenticated')({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const sessionReady = useSessionReady();
  const fetchProfile = useServerFn(getProfile);
  const doUpdateLastAccess = useServerFn(updateLastAccess);

  // Lock screen: require Face ID once per browser session (sessionStorage)
  const [unlocked, setUnlocked] = useState(() => {
    if (typeof window === 'undefined') return false;
    return isAppUnlocked();
  });

  const handleUnlocked = useCallback(() => {
    markAppUnlocked();
    setUnlocked(true);
  }, []);

  // Re-lock when the PWA returns from background after being hidden for a while
  useEffect(() => {
    let hiddenAt: number | null = null;
    const RELOCK_AFTER_MS = 60_000; // 1 min in background → ask Face ID again

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt && Date.now() - hiddenAt > RELOCK_AFTER_MS) {
        setUnlocked(false);
        try {
          sessionStorage.removeItem('maskpay-app-unlocked');
        } catch {
          // ignore
        }
      }
      hiddenAt = null;
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => fetchProfile({}),
    enabled: sessionReady,
  }) as { data: ProfileWithRole | undefined; isLoading: boolean };

  useEffect(() => {
    if (!sessionReady) return;

    // Confirm session still exists in storage (do not force logout just because profile is slow)
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return;
      doUpdateLastAccess({}).catch(() => undefined);

      const lastAccess = window.localStorage.getItem('maskpay-login-timestamp');
      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;

      // Only expire after 24h WITHOUT opening the app
      if (lastAccess) {
        const elapsed = now - parseInt(lastAccess, 10);
        if (!Number.isNaN(elapsed) && elapsed > twentyFourHours) {
          console.log('[AuthenticatedLayout] Session expired (>24h inactivity).');
          supabase.auth.signOut().then(() => {
            window.localStorage.removeItem('maskpay-login-timestamp');
            try {
              sessionStorage.removeItem('maskpay-app-unlocked');
            } catch {
              // ignore
            }
            window.location.href = '/auth?mode=login';
          });
          return;
        }
      }

      window.localStorage.setItem('maskpay-login-timestamp', String(now));
    });
  }, [sessionReady, location.pathname, doUpdateLastAccess]);

  useEffect(() => {
    if (!sessionReady || isProfileLoading || !profile) return;
    
    // Se a conta estiver bloqueada ou recusada, força logout e volta para a home
    if (profile.status === 'blocked' || profile.status === 'rejected') {
      console.log(`[AuthenticatedLayout] Account ${profile.status}. Force logout and redirect.`);
      supabase.auth.signOut().then(() => {
        window.location.href = '/';
      });
      return;
    }

    // Se o perfil existe mas não é admin, verifica se a conta está verificada
    if (profile.role !== 'admin') {
      const isVerified = profile.verification_status === 'verified';
      const isPending = profile.verification_status === 'pending' || profile.verification_status === 'pending_review';
      
      // Permitir acesso APENAS a rotas essenciais se não estiver verificado
      const allowedPaths = ['/dashboard', '/support', '/verify'];
      const currentPath = location.pathname;
      
      const isAllowed = allowedPaths.some(path => currentPath === path || currentPath.startsWith(path + '/'));

      // Se não estiver verificado e não for uma rota permitida, volta pro dashboard
      if (!isVerified && !isAllowed) {
        console.log(`[AuthenticatedLayout] Access denied to ${currentPath} (KYC pending). Redirecting to dashboard.`);
        navigate({ to: '/dashboard', replace: true });
        return;
      }

      // Se já enviou documentos (pending), não pode acessar /verify de novo
      if (isPending && currentPath.startsWith('/verify')) {
        console.log(`[AuthenticatedLayout] Verification already pending. Redirecting to dashboard.`);
        navigate({ to: '/dashboard', replace: true });
        return;
      }
    }
  }, [profile, isProfileLoading, sessionReady, location.pathname, navigate]);

  // Show lock screen until Face ID succeeds (only when we know there is a session)
  if (sessionReady && !unlocked) {
    return <AppLockScreen onUnlocked={handleUnlocked} />;
  }

  return <DashboardLayout />;
}
