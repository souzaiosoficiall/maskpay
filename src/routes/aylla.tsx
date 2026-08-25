import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import AdminLayout from '@/components/AdminLayout';
import { adminSupabase as supabase } from '@/integrations/supabase/admin-client';

export const Route = createFileRoute('/aylla')({
  beforeLoad: async ({ location }) => {
    if (location.pathname === '/aylla/login') return;

    if (typeof window !== 'undefined') {
      const { data: { session } } = await supabase.auth.getSession();
      const OWNER_EMAIL = 'souzaiosoficial@gmail.com';
      const cleanOwnerEmail = OWNER_EMAIL.toLowerCase().trim();
      const userEmail = session?.user?.email?.toLowerCase().trim();
      const isOwner = userEmail === cleanOwnerEmail;

      if (!session && !isOwner) {
        console.log("AdminRoute: Sem sessão, redirecionando para login");
        throw redirect({ to: '/aylla/login' });
      }
    }
  },
  component: AdminLayout,
});
