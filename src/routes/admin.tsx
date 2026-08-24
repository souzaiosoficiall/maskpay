import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/integrations/supabase/client';

export const Route = createFileRoute('/admin')({
  beforeLoad: async ({ location }) => {
    if (location.pathname === '/admin/login') return;
    
    if (typeof window !== 'undefined') {
      const { data: { session } } = await supabase.auth.getSession();
      const OWNER_EMAIL = 'souzaiosoficial@gmail.com';
      const cleanOwnerEmail = OWNER_EMAIL.toLowerCase().trim();
      const userEmail = session?.user?.email?.toLowerCase().trim();
      const isOwner = userEmail === cleanOwnerEmail;

      if (!session && !isOwner) {
        console.log("AdminRoute: Sem sessão, redirecionando para login");
        throw redirect({ to: '/admin/login' });
      }
    }
  },
  component: AdminLayout,
});