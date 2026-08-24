import { createFileRoute, Outlet, useNavigate, useLocation } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useEffect } from 'react';
import { getProfile, type ProfileWithRole } from '@/lib/settings.functions';
import { updateLastAccess } from '@/lib/auth-session.functions';
import { useSessionReady } from '@/hooks/useSessionReady';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';

export const Route = createFileRoute('/_authenticated')({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const sessionReady = useSessionReady();
  const fetchProfile = useServerFn(getProfile);
  const doUpdateLastAccess = useServerFn(updateLastAccess);

  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => fetchProfile({}),
    enabled: sessionReady,
  }) as { data: ProfileWithRole | undefined; isLoading: boolean };

  useEffect(() => {
    if (!sessionReady) return;
    
    // Update server-side access time
    doUpdateLastAccess({});
    
    // Update client-side local session expiry logic
    const lastLogin = window.localStorage.getItem('maskpay-login-timestamp');
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;

    if (lastLogin && (now - parseInt(lastLogin)) > twentyFourHours) {
      console.log("[AuthenticatedLayout] Session expired (>24h). Logging out.");
      supabase.auth.signOut().then(() => {
        window.localStorage.removeItem('maskpay-login-timestamp');
        window.location.href = '/auth?mode=login';
      });
      return;
    }

    // Update the timestamp on every active access
    window.localStorage.setItem('maskpay-login-timestamp', now.toString());
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
      const allowedPaths = ['/dashboard', '/support', '/verify', '/settings'];
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

  return <DashboardLayout />;
}