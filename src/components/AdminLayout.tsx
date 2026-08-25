import { createFileRoute, Outlet, Link, useNavigate, useLocation, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { getProfile, type ProfileWithRole } from '@/lib/settings.functions';
import { getTickets } from '@/lib/support.functions';
import { getAllUsers } from '@/lib/admin-system.functions';

import { useSessionReady } from '@/hooks/useSessionReady';
import { getInitials, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { adminSupabase as supabase } from '@/integrations/supabase/admin-client';
import { checkAdminRole } from '@/lib/admin-auth.functions';
import { 
  LogOut,
  Menu,
  Fingerprint,
  TrendingUp,
  Users,
  MessageSquare,
  History,
  Loader2,
  Settings,
  Bell
} from 'lucide-react';
import { useState, useEffect } from 'react';
import maskPlatformAsset from "@/lib/mask-asset";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

function SidebarContent({ isMobile = false, isSidebarOpen, hasPendingKyc, hasOpenTickets, handleLogout }: { isMobile?: boolean, isSidebarOpen: boolean, hasPendingKyc: boolean, hasOpenTickets: boolean, handleLogout: () => void }) {
  return (
    <div className="flex flex-col h-full bg-card">
      <div className="flex items-center px-6 border-b border-white/5 shrink-0 h-14 md:h-16">
        <Link to="/aylla" className="flex items-center gap-3 overflow-hidden">
          <img src={maskPlatformAsset.url} alt="MaskPay Admin" className={cn("object-contain transition-all", (isSidebarOpen || isMobile) ? "w-8 h-8 min-w-8" : "w-6 h-6 min-w-6")} />
          {(isSidebarOpen || isMobile) && (
            <span className="text-xl font-black tracking-tighter uppercase whitespace-nowrap flex items-center gap-2">
              MaskAdmin
            </span>
          )}
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1 custom-scrollbar">
        <div className={cn("px-3 text-[10px] font-black text-muted-foreground/20 uppercase tracking-[0.2em] mb-3 mt-2", (!isSidebarOpen && !isMobile) && "text-center")}>
          {(isSidebarOpen || isMobile) ? "Sistema" : "•••"}
        </div>
        
        <Link
          to="/aylla"
          activeProps={{ className: "text-white bg-white/5 border border-white/10 shadow-none" }}
          inactiveProps={{ className: "bg-background border-transparent" }}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl text-muted-foreground hover:bg-white/5 hover:text-white transition-all group mb-1 border relative"
        >
          <TrendingUp className="h-5 w-5 min-w-5 group-hover:scale-110 transition-transform" />
          {(isSidebarOpen || isMobile) && <span className="text-xs font-black uppercase tracking-widest">Painel</span>}
        </Link>

        <Link
          to="/aylla"
          search={{ tab: 'users' }}
          activeProps={{ className: "text-white bg-white/5 border border-white/10 shadow-none" }}
          inactiveProps={{ className: "bg-background border-transparent" }}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl text-muted-foreground hover:bg-white/5 hover:text-white transition-all group mb-1 border"
        >
          <Users className="h-5 w-5 min-w-5 group-hover:scale-110 transition-transform" />
          {(isSidebarOpen || isMobile) && <span className="text-xs font-black uppercase tracking-widest">Usuários</span>}
        </Link>

        <Link
          to="/aylla"
          search={{ tab: 'kyc' }}
          activeProps={{ className: "text-white bg-white/5 border border-white/10 shadow-none" }}
          inactiveProps={{ className: "bg-background border-transparent" }}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl text-muted-foreground hover:bg-white/5 hover:text-white transition-all group mb-1 border relative"
        >
          <Fingerprint className="h-5 w-5 min-w-5 group-hover:scale-110 transition-transform" />
          {(isSidebarOpen || isMobile) && <span className="text-xs font-black uppercase tracking-widest">KYC</span>}
          {hasPendingKyc && (
            <span className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
          )}
        </Link>

        <Link
          to="/aylla"
          search={{ tab: 'tickets' }}
          activeProps={{ className: "text-white bg-white/5 border border-white/10 shadow-none" }}
          inactiveProps={{ className: "bg-background border-transparent" }}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl text-muted-foreground hover:bg-white/5 hover:text-white transition-all group mb-1 border relative"
        >
          <MessageSquare className="h-5 w-5 min-w-5 group-hover:scale-110 transition-transform" />
          {(isSidebarOpen || isMobile) && <span className="text-xs font-black uppercase tracking-widest">Suporte</span>}
          {hasOpenTickets && (
            <span className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
          )}
        </Link>

        <Link
          to="/aylla"
          search={{ tab: 'logs' }}
          activeProps={{ className: "text-white bg-white/5 border border-white/10 shadow-none" }}
          inactiveProps={{ className: "bg-background border-transparent" }}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl text-muted-foreground hover:bg-white/5 hover:text-white transition-all group mb-1 border"
        >
          <History className="h-5 w-5 min-w-5 group-hover:scale-110 transition-transform" />
          {(isSidebarOpen || isMobile) && <span className="text-xs font-black uppercase tracking-widest">Logs</span>}
        </Link>

        <Link
          to="/aylla"
          search={{ tab: 'settings' }}
          activeProps={{ className: "text-white bg-white/5 border border-white/10 shadow-none" }}
          inactiveProps={{ className: "bg-background border-transparent" }}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl text-muted-foreground hover:bg-white/5 hover:text-white transition-all group mb-1 border"
        >
          <Settings className="h-5 w-5 min-w-5 group-hover:scale-110 transition-transform" />
          {(isSidebarOpen || isMobile) && <span className="text-xs font-black uppercase tracking-widest">Configurações</span>}
        </Link>

        <Link
          to="/aylla"
          search={{ tab: 'notifications' }}
          activeProps={{ className: "text-white bg-white/5 border border-white/10 shadow-none" }}
          inactiveProps={{ className: "bg-background border-transparent" }}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl text-muted-foreground hover:bg-white/5 hover:text-white transition-all group mb-1 border relative"
        >
          <Bell className="h-5 w-5 min-w-5 group-hover:scale-110 transition-transform" />
          {(isSidebarOpen || isMobile) && <span className="text-xs font-black uppercase tracking-widest">Notificações</span>}
        </Link>

      </nav>

      <div className="p-4 border-t border-white/5 pb-[env(safe-area-inset-bottom)]">
        <Button 
          variant="ghost" 
          className={cn(
            "w-full justify-start text-destructive/50 hover:text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/20 transition-all group rounded-2xl", 
            (!isSidebarOpen && !isMobile) && "px-0 justify-center"
          )}
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5 min-w-5" />
          {(isSidebarOpen || isMobile) && <span className="ml-3 text-xs font-black uppercase tracking-widest text-left">Sair do Sistema</span>}
        </Button>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const sessionReady = useSessionReady();
  const fetchProfile = useServerFn(getProfile);
  const fetchTickets = useServerFn(getTickets);
  const fetchUsers = useServerFn(getAllUsers);
  const [isAdminForce, setIsAdminForce] = useState<boolean | null>(null);

  // Define as as content routes under /admin use this layout, we can safely use useSearch
  const search = useSearch({ from: '/aylla' }) as any;

  const isLoginPage = location.pathname.includes('/aylla/login');
  const OWNER_EMAIL = 'souzaiosoficial@gmail.com';
  const cleanOwnerEmail = OWNER_EMAIL.toLowerCase().trim();

  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const userEmail = session?.user?.email?.toLowerCase().trim();
      const isOwner = userEmail === cleanOwnerEmail;

      try {
        const result = await fetchProfile({});
        return result;
      } catch (err) {
        console.warn("Erro ao buscar perfil administrativo (RPC falhou):", err);
        
        // Fallback robusto para o proprietário mesmo com erro de RPC/Rede
        if (isOwner && session?.user) {
          return {
            id: session.user.id,
            email: session.user.email,
            full_name: session.user.user_metadata['full_name'] || '',
            role: 'admin' as any
          } as ProfileWithRole;
        }
        throw err;
      }
    },
    enabled: sessionReady && isAdminForce === true,
    staleTime: 60000,
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ['admin_tickets'],
    queryFn: () => fetchTickets({}).catch(() => []),
    enabled: sessionReady && isAdminForce === true && !!profile,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['admin_users'],
    queryFn: () => fetchUsers({}).catch(() => []),
    enabled: sessionReady && isAdminForce === true && !!profile,
  });

  const hasOpenTickets = tickets.some((t: any) => t.status === 'Aberto');
  const hasPendingKyc = users.some((u: any) => u.kyc_status === 'pending' || u.verification_status === 'pending_review');

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const checkRole = async () => {
      console.log("AdminLayout checkRole iniciado, path:", location.pathname);
      if (isLoginPage) return;

      const loginAt = typeof window !== 'undefined' ? localStorage.getItem('maskpay_admin_login_at') : null;
      const now = Date.now();
      
      const isFreshLogin = loginAt && (now - parseInt(loginAt)) < 5000;
      
      if (!isFreshLogin) {
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        console.log("Login fresco detectado, ignorando delay de sincronização");
      }

      console.log("AdminLayout: Buscando sessão Supabase...");
      const { data: { session } } = await supabase.auth.getSession();
      const userEmail = session?.user?.email?.toLowerCase().trim();
      const isOwner = userEmail === cleanOwnerEmail;
      
      if (!session?.user) {
        console.log("AdminLayout: Nenhuma sessão encontrada");
        setIsAdminForce(false);
        if (!window.location.pathname.includes('/aylla/login')) {
          window.location.href = '/aylla/login';
        }
        return;
      }

      if (isOwner) {
        console.log("AdminLayout: Proprietário detectado, pulando verificação de role");
        setIsAdminForce(true);
        return;
      }

      // Check if user has admin role
      try {
        const isAdmin = await checkAdminRole({ data: { userId: session.user.id } });
        if (!isAdmin) {
          console.log("AdminLayout: Usuário logado mas não é admin");
          await supabase.auth.signOut();
          setIsAdminForce(false);
          window.location.href = '/aylla/login';
        } else {
          setIsAdminForce(true);
        }
      } catch (error) {
        console.error("Erro ao verificar role admin:", error);
        // Em caso de erro de rede, se for o owner, permitimos o carregamento
        const isOwner = session.user.email?.toLowerCase().trim() === cleanOwnerEmail;
        if (isOwner) {
          setIsAdminForce(true);
        } else {
          setIsAdminForce(false);
          window.location.href = '/aylla/login';
        }
      }
    };
    checkRole();
  }, [location.pathname, isLoginPage]);

  const handleLogout = async () => {
    localStorage.removeItem('maskpay_admin_bypass_session');
    await supabase.auth.signOut();
    window.location.href = '/aylla/login';
  };

  if (isLoginPage) {
    return <Outlet />;
  }

  // Pre-return hook check: Ensure we don't return early before hooks that might run in sub-paths or sub-renders
  if (isAdminForce === null) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isAdminForce === false) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black p-4 text-center">
        <h1 className="text-2xl font-black text-red-500 uppercase mb-4">Acesso Restrito</h1>
        <p className="text-white/60 mb-8 max-w-md">Você não possui permissão para acessar esta área. Se você é um administrador, por favor realize o login novamente.</p>
        <Button 
          onClick={handleLogout}
          className="bg-red-600 hover:bg-red-700 text-white font-bold px-8 h-12 rounded-xl"
        >
          Voltar para o Login
        </Button>
      </div>
    );
  }


  return (
    <div className="flex h-screen bg-background overflow-hidden text-foreground selection:bg-white/10">
      <aside 
        className={cn(
          "bg-card border-r border-white/5 flex flex-col transition-all duration-300 z-50 hidden lg:flex",
          isSidebarOpen ? "w-64" : "w-20"
        )}
      >
        <SidebarContent isSidebarOpen={isSidebarOpen} hasPendingKyc={hasPendingKyc} hasOpenTickets={hasOpenTickets} handleLogout={handleLogout} />
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        <header className="bg-card/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-4 md:px-6 sticky top-0 z-40 shrink-0" style={{ paddingTop: "env(safe-area-inset-top, 0px)", height: "calc(3.5rem + env(safe-area-inset-top, 0px))" }}>
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hidden lg:flex text-muted-foreground/60 hover:text-white rounded-xl"
            >
              <Menu className="h-5 w-5" />
            </Button>

            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="lg:hidden text-muted-foreground/60 hover:text-white rounded-xl"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72 border-white/5 bg-card">
                <SidebarContent isMobile isSidebarOpen={true} hasPendingKyc={hasPendingKyc} hasOpenTickets={hasOpenTickets} handleLogout={handleLogout} />
              </SheetContent>
            </Sheet>

            <h2 className="text-sm font-black uppercase tracking-widest hidden md:block">Sistema Administrativo</h2>
            <img src={maskPlatformAsset.url} alt="MaskPay" className="w-8 h-8 object-contain md:hidden" />
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4 pl-4 border-l border-white/10">
              <div className="text-right hidden sm:block">
                <p className="text-[10px] font-black uppercase tracking-widest text-white leading-none mb-1">SUPORTE MASK</p>
                <p className="text-[8px] text-primary uppercase tracking-tighter font-bold">Administrador</p>
              </div>
              <div className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 p-1 group">
                <img src={maskPlatformAsset.url} alt="Avatar" className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300" />
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-background/50 custom-scrollbar">
          <div className="max-w-7xl mx-auto p-4 md:p-8 w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
