import { createFileRoute, useNavigate, useLocation } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useEffect, useState, useCallback, useRef } from 'react';
import { getProfile, type ProfileWithRole } from '@/lib/settings.functions';
import { updateLastAccess } from '@/lib/auth-session.functions';
import { useSessionReady } from '@/hooks/useSessionReady';
import { supabase } from '@/integrations/supabase/client';
import { isSecurityLocked, clearAuthStorage } from '@/lib/security-lock';
import DashboardLayout from '@/components/DashboardLayout';
import { AppLockScreen, isAppUnlocked, markAppUnlocked, clearAppUnlock } from '@/components/AppLockScreen';
import { SetupTransactionPinModal } from '@/components/SetupTransactionPinModal';

export const Route = createFileRoute('/_authenticated')({
  component: AuthenticatedLayout,
});

/** Full local wipe + redirect to homepage (used when account was deleted by admin). */
function forceLogoutToHome() {
  try {
    clearAuthStorage();
  } catch {
    // ignore
  }
  try {
    clearAppUnlock();
  } catch {
    // ignore
  }
  try {
    window.localStorage.removeItem('maskpay-login-timestamp');
    window.localStorage.removeItem('maskpay-webauthn-credential-id');
  } catch {
    // ignore
  }
  supabase.auth.signOut({ scope: 'local' }).finally(() => {
    window.location.replace('/');
  });
}

function isAccountDeletedError(err: unknown): boolean {
  const msg = String((err as any)?.message || err || '');
  return (
    msg.includes('ACCOUNT_DELETED') ||
    msg.includes('User from sub claim in JWT does not exist') ||
    msg.includes('user_not_found') ||
    /user not found/i.test(msg)
  );
}

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const sessionReady = useSessionReady();
  const loggingOutRef = useRef(false);

  const forceOut = useCallback(() => {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    forceLogoutToHome();
  }, []);

  // DevTools lock: never allow authenticated routes while lock is active
  useEffect(() => {
    if (!isSecurityLocked()) return;
    clearAuthStorage();
    supabase.auth.signOut({ scope: 'local' }).then(() => {
      window.location.replace('/');
    }).catch(() => {
      window.location.replace('/');
    });
  }, []);

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

  // Must pass server-side auth check before Face ID / dashboard (catches admin-deleted users)
  const [authValidated, setAuthValidated] = useState(false);

  const {
    data: profile,
    isLoading: isProfileLoading,
    isError: isProfileError,
    error: profileError,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: ['profile'],
    // Only fetch profile after we know the Auth user still exists
    queryFn: () => fetchProfile({}),
    enabled: sessionReady && authValidated,
    // Keep profile fresh so admin delete/block is detected quickly
    staleTime: 15_000,
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: (failureCount, err) => {
      // Never retry deleted-account errors
      if (isAccountDeletedError(err)) return false;
      return failureCount < 2;
    },
  }) as {
    data: ProfileWithRole | undefined;
    isLoading: boolean;
    isError: boolean;
    error: unknown;
    refetch: () => void;
  };

  // Server-side validation: JWT may still be valid after admin deleteUser.
  // getUser() hits Auth API and fails when the user no longer exists.
  // Re-runs on route change, tab focus and on a short interval so kick is fast.
  useEffect(() => {
    if (!sessionReady) return;

    let cancelled = false;
    let firstRun = true;

    const validateAuth = async () => {
      if (cancelled || loggingOutRef.current) return;

      const { data: sessionData } = await supabase.auth.getSession();
      if (cancelled) return;

      if (!sessionData.session) {
        forceOut();
        return;
      }

      // Always hit the Auth API — local JWT can outlive a deleted/blocked account
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (cancelled) return;

      if (userError || !userData?.user) {
        console.log('[AuthenticatedLayout] Auth user missing (deleted?). Forcing logout.');
        forceOut();
        return;
      }

      // On first successful validation only: update last access + inactivity window
      if (firstRun) {
        firstRun = false;
        doUpdateLastAccess({}).catch(() => undefined);

        const lastAccess = window.localStorage.getItem('maskpay-login-timestamp');
        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000;

        if (lastAccess) {
          const elapsed = now - parseInt(lastAccess, 10);
          if (!Number.isNaN(elapsed) && elapsed > twentyFourHours) {
            console.log('[AuthenticatedLayout] Session expired (>24h inactivity).');
            forceOut();
            return;
          }
        }

        window.localStorage.setItem('maskpay-login-timestamp', String(now));
        if (!cancelled) setAuthValidated(true);
      }
    };

    // Immediate check (blocks Face ID / dashboard until we know the account still exists)
    setAuthValidated(false);
    validateAuth();

    // Re-validate when the PWA/tab becomes visible again
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        validateAuth();
        try {
          refetchProfile();
        } catch {
          // ignore
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    // Short polling while the user stays on authenticated routes
    const intervalId = window.setInterval(() => {
      validateAuth();
    }, 25_000);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(intervalId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- refetchProfile is stable; avoid re-binding interval
  }, [sessionReady, location.pathname, doUpdateLastAccess, forceOut]);

  // Profile fetch failed because account was deleted by admin
  useEffect(() => {
    if (!sessionReady || isProfileLoading) return;
    if (isProfileError && isAccountDeletedError(profileError)) {
      console.log('[AuthenticatedLayout] ACCOUNT_DELETED from getProfile. Forcing logout.');
      forceOut();
    }
  }, [sessionReady, isProfileLoading, isProfileError, profileError, forceOut]);

  useEffect(() => {
    if (!sessionReady || isProfileLoading || !profile) return;
    
    // Se a conta estiver bloqueada ou recusada, força logout e volta para a home
    if (profile.status === 'blocked' || profile.status === 'rejected') {
      console.log(`[AuthenticatedLayout] Account ${profile.status}. Force logout and redirect.`);
      forceOut();
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
  }, [profile, isProfileLoading, sessionReady, location.pathname, navigate, forceOut]);

  // Wait for server-side auth validation (blocks Face ID on deleted accounts)
  if (sessionReady && !authValidated) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  // Profile says account was deleted
  if (sessionReady && isProfileError && isAccountDeletedError(profileError)) {
    return null;
  }

  // Show lock screen until Face ID succeeds (only when we know there is a live session)
  if (sessionReady && authValidated && !unlocked) {
    return <AppLockScreen onUnlocked={handleUnlocked} />;
  }

  // After account is accepted (verified), force 4-digit PIN setup once
  const needsPinSetup =
    !!profile &&
    profile.role !== 'admin' &&
    profile.verification_status === 'verified' &&
    !profile.transaction_password_hash;

  return (
    <>
      <DashboardLayout />
      <SetupTransactionPinModal open={needsPinSetup} />
    </>
  );
}
