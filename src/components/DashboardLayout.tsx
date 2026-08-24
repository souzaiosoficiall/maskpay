import { createFileRoute, Outlet, Link, useNavigate, useLocation } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { getProfile, type ProfileWithRole } from '@/lib/settings.functions';
import { NotificationManager } from './NotificationManager';
import { PwaPrompt } from './PwaPrompt';
import { PushNotificationManager } from './PushNotificationManager';
import { useSessionReady } from '@/hooks/useSessionReady';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  ArrowLeftRight, 
  Webhook, 
  Settings, 
  LogOut,
  Menu,
  FileCode2,
  Receipt,
  MessageSquare,
  Lock,
  X,
  Fingerprint,
  ChevronDown
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import maskPlatformAsset from "@/lib/mask-asset";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export default function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isTransferMenuOpen, setIsTransferMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const sessionReady = useSessionReady();
  const fetchProfile = useServerFn(getProfile);

  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => fetchProfile({}),
    enabled: sessionReady,
    staleTime: 5000,
  }) as { data: ProfileWithRole | undefined; isLoading: boolean };

  const isKycLocked = !sessionReady || isProfileLoading || !profile || profile.verification_status !== 'verified';

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const menuItems = [
    { icon: Webhook, label: 'Movimentações', to: '/transactions' },
    { icon: Receipt, label: 'Taxas', to: '/rates' },
    { icon: FileCode2, label: 'API', to: '/api-keys' },
  ];

  const SidebarContent = ({ isMobile = false }) => (
    <div className="flex flex-col h-full bg-card">
      <div className="h-16 flex items-center px-6 border-b border-white/5 shrink-0">
        <Link to="/" className="flex items-center gap-3 overflow-hidden">
          <img src={maskPlatformAsset.url} alt="MaskPay" className={cn("object-contain transition-all", (isSidebarOpen || isMobile) ? "w-8 h-8 min-w-8" : "w-6 h-6 min-w-6")} />
          {(isSidebarOpen || isMobile) && (
            <span className="text-xl font-black tracking-tighter uppercase whitespace-nowrap flex items-center gap-2">
              MaskPay |
            </span>
          )}
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1 custom-scrollbar">
        <div className={cn("px-3 text-[10px] font-black text-muted-foreground/20 uppercase tracking-[0.2em] mb-3 mt-2", (!isSidebarOpen && !isMobile) && "text-center")}>
          {(isSidebarOpen || isMobile) ? "Gerenciamento" : "•••"}
        </div>
        
        <Link
          to="/dashboard"
          activeProps={{ className: "text-white bg-white/5 border border-white/10 shadow-none" }}
          inactiveProps={{ className: "bg-background border-transparent" }}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl text-muted-foreground hover:bg-white/5 hover:text-white transition-all group mb-1 border border-transparent bg-background"
        >
          <LayoutDashboard className="h-5 w-5 min-w-5 group-hover:scale-110 transition-transform" />
          {(isSidebarOpen || isMobile) && <span className="text-xs font-black uppercase tracking-widest">Página Inicial</span>}
        </Link>

        <div className="space-y-1">
          <button
            onClick={() => !isKycLocked && setIsTransferMenuOpen(!isTransferMenuOpen)}
            disabled={isKycLocked && profile?.role !== 'admin'}
            className={cn(
              "w-full flex items-center justify-between px-4 py-3 rounded-2xl text-muted-foreground hover:bg-white/5 hover:text-white transition-all group mb-1 border border-transparent bg-background cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
              isTransferMenuOpen && "text-white"
            )}
          >
            <div className="flex items-center gap-3">
              <ArrowLeftRight className="h-5 w-5 min-w-5 group-hover:scale-110 transition-transform" />
              {(isSidebarOpen || isMobile) && <span className="text-xs font-black uppercase tracking-widest">Transferências</span>}
            </div>
            {(isSidebarOpen || isMobile) && (
              <div className="flex items-center gap-2">
                {isKycLocked && profile?.role !== 'admin' && <Lock className="h-3 w-3 text-muted-foreground/40" />}
                <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isTransferMenuOpen && "rotate-180")} />
              </div>
            )}
          </button>
          
          <div className={cn(
            "overflow-hidden transition-all duration-300 ease-in-out pl-4",
            isTransferMenuOpen ? "max-h-40 opacity-100 mb-2" : "max-h-0 opacity-0"
          )}>
            {['Saque', 'Depositar', 'Transferência'].map((label, idx) => {
              const to = idx === 0 ? '/withdraw' : idx === 1 ? '/deposit' : '/transfer';
              const isLocked = isKycLocked; // Everything in transfers is locked if KYC is not verified
              return (
                <Link
                  key={label}
                  to={to}
                  disabled={!!isLocked && profile?.role !== 'admin'}
                  activeProps={{ className: "text-white bg-white/5 border border-white/10" }}
                  inactiveProps={{ className: "text-muted-foreground/60 border-transparent" }}
                  className={cn(
                    "flex items-center justify-between px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:text-white transition-all rounded-xl border mb-1",
                    isLocked && profile?.role !== 'admin' && "opacity-50 cursor-not-allowed pointer-events-none"
                  )}
                >
                  <span>{label}</span>
                  {isLocked && profile?.role !== 'admin' && <Lock className="h-3 w-3 text-muted-foreground/40" />}
                </Link>
              );
            })}
          </div>
        </div>

        {menuItems.map((item) => {
          const isLocked = isKycLocked && profile?.role !== 'admin';
          return (
            <Link
              key={item.label}
              to={item.to as any}
              disabled={!!isLocked}
              activeProps={{ className: "text-white bg-white/5 border border-white/10 shadow-none" }}
              inactiveProps={{ className: "bg-background border-transparent" }}
              className={cn(
                "flex items-center justify-between px-4 py-3 rounded-2xl text-muted-foreground hover:bg-white/5 hover:text-white transition-all group mb-1 border",
                isLocked && "opacity-50 cursor-not-allowed pointer-events-none"
              )}
            >
              <div className="flex items-center gap-3">
                <item.icon className="h-5 w-5 min-w-5 group-hover:scale-110 transition-transform" />
                {(isSidebarOpen || isMobile) && <span className="text-xs font-black uppercase tracking-widest">{item.label}</span>}
              </div>
              {(isSidebarOpen || isMobile) && isLocked && <Lock className="h-3 w-3 text-muted-foreground/40" />}
            </Link>
          );
        })}
        
        <div className="pt-8 pb-3">
          <div className={cn("px-3 text-[10px] font-black text-muted-foreground/20 uppercase tracking-[0.2em]", (!isSidebarOpen && !isMobile) && "text-center")}>
            {(isSidebarOpen || isMobile) ? "Configuração" : "•••"}
          </div>
        </div>

        <Link
          to="/support"
          activeProps={{ className: "text-white bg-white/5 border border-white/10 shadow-none" }}
          inactiveProps={{ className: "bg-background border-transparent" }}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl text-muted-foreground hover:bg-white/5 hover:text-white transition-all group mb-1 border border-transparent bg-background"
        >
          <MessageSquare className="h-5 w-5 min-w-5" />
          {(isSidebarOpen || isMobile) && <span className="text-xs font-black uppercase tracking-widest">Suporte</span>}
        </Link>

        <Link
          to="/settings"
          disabled={!!isKycLocked && profile?.role !== 'admin'}
          activeProps={{ className: "text-white bg-white/5 border border-white/10 shadow-none" }}
          inactiveProps={{ className: "bg-background border-transparent" }}
          className={cn(
            "flex items-center justify-between px-4 py-3 rounded-2xl text-muted-foreground hover:bg-white/5 hover:text-white transition-all group mb-1 border",
            isKycLocked && profile?.role !== 'admin' && "opacity-50 cursor-not-allowed pointer-events-none"
          )}
        >
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5 min-w-5" />
            {(isSidebarOpen || isMobile) && <span className="text-xs font-black uppercase tracking-widest">Ajustes</span>}
          </div>
          {(isSidebarOpen || isMobile) && isKycLocked && profile?.role !== 'admin' && <Lock className="h-3 w-3 text-muted-foreground/40" />}
        </Link>
      </nav>

      <div className="p-4 border-t border-white/5 pb-[env(safe-area-inset-bottom)]">
        <Button 
          variant="ghost" 
          className={cn(
            "w-full justify-start text-destructive/50 hover:text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/20 transition-all group rounded-2xl", 
            (!isSidebarOpen && !isMobile) && "px-0 justify-center"
          )}
          onClick={() => navigate({ to: '/' })}
        >
          <LogOut className="h-5 w-5 min-w-5" />
          {(isSidebarOpen || isMobile) && <span className="ml-3 text-xs font-black uppercase tracking-widest">Sair</span>}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden text-foreground selection:bg-white/10">
      {/* Desktop Sidebar */}
      <aside 
        className={cn(
          "bg-card border-r border-white/5 flex flex-col transition-all duration-300 z-50 hidden lg:flex",
          isSidebarOpen ? "w-64" : "w-20"
        )}
      >
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        <header className="h-16 bg-card/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-6 sticky top-0 z-40 shrink-0">
          <div className="flex items-center gap-4">
            {/* Desktop Toggle */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hidden lg:flex text-muted-foreground/60 hover:text-white rounded-xl"
            >
              <Menu className="h-5 w-5" />
            </Button>
            
            {/* Mobile Drawer Trigger */}
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
                <SidebarContent isMobile />
              </SheetContent>
            </Sheet>

            <img src={maskPlatformAsset.url} alt="MaskPay" className="w-8 h-8 object-contain lg:hidden" />
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4 pl-4 border-l border-white/10">
              <div className="text-right hidden sm:block">
                <p className="text-[10px] font-black uppercase tracking-widest text-white leading-none mb-1">{profile?.full_name || ''}</p>
                <div className="flex items-center justify-end gap-1.5">
                   <div className={cn("w-1 h-1 rounded-full", profile?.verification_status === 'verified' ? "bg-green-500" : "bg-yellow-500")} />
                   <p className="text-[8px] text-muted-foreground/40 uppercase tracking-tighter font-bold">
                    {profile?.verification_status === 'verified' ? 'Verificado' : 'Aguardando'}
                  </p>
                </div>
              </div>
              <div className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 p-1 group">
                <img src={maskPlatformAsset.url} alt="Avatar" className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300" />
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-background/50 custom-scrollbar">
          <PwaPrompt />
          <PushNotificationManager />
          <div className="max-w-7xl mx-auto p-4 md:p-8 w-full">
            <NotificationManager />
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
