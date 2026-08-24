import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/integrations/supabase/client';

export const Route = createFileRoute('/admin')({
  beforeLoad: async ({ location }) => {
    if (location.pathname === '/admin/login') return;
    
    // No lado do cliente, verificamos se há um token básico no localStorage ou sessão
    if (typeof window !== 'undefined') {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw redirect({ to: '/admin/login' });
      }
    }
  },
  component: AdminLayout,
});