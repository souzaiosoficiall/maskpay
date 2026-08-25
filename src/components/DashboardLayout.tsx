import { Outlet, Link, useNavigate, useLocation } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { getProfile, type ProfileWithRole } from '@/lib/settings.functions';
import { NotificationManager } from './NotificationManager';
import { PwaPrompt } from './PwaPrompt';
import { PushNotificationManager } from './PushNotificationManager';
import { useSessionReady } from '@/hooks/useSessionReady';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Webhook,
  Settings,
  ShoppingBag,
  Package,
  LogOut,
  FileCode2,
  BookOpen,
  Receipt,
  MessageSquare,
  Lock,
  X,
  ChevronDown,
  QrCode,
  Home,
  Wallet,
  MoreHorizontal,
  ArrowDownToLine,
  ArrowUpFromLine,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import maskPlatformAsset from '@/lib/mask-asset';
import { supabase } from '@/integrations/supabase/client';

export default function DashboardLayout() {
  const { isLight } = useTheme();
  const [isTransferMenuOpen, setIsTransferMenuOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const sessionReady = useSessionReady();
  const fetchProfile = useServerFn(getProfile);
  const queryClient = useQueryClient();
  const prevVerifiedRef = useRef<boolean | null>(null);
  const reloadingRef = useRef(false);

  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => fetchProfile({}),
    enabled: sessionReady,
    staleTime: 5_000,
    // Poll while waiting for admin approval so unlock happens without logout
    refetchInterval: (q) => {
      const p = q.state.data as ProfileWithRole | undefined;
      if (!p) return 8_000;
      if (p.role === 'admin' || p.verification_status === 'verified') return 30_000;
      return 8_000;
    },
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  }) as { data: ProfileWithRole | undefined; isLoading: boolean };

  // Locked by default until profile loads AND admin verified the account.
  const canAccess =
    !!profile &&
    (profile.role === 'admin' || profile.verification_status === 'verified');
  const isKycLocked = !canAccess;

  // Realtime: when admin updates profiles row, refresh + soft reload once on verify
  useEffect(() => {
    if (!sessionReady || !profile?.id) return;

    const channel = supabase
      .channel(`profile-live-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${profile.id}`,
        },
        async () => {
          await queryClient.invalidateQueries({ queryKey: ['profile'] });
          await queryClient.refetchQueries({ queryKey: ['profile'] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionReady, profile?.id, queryClient]);

  // When verification flips to verified, force a full reload so UI/nav unlock without logout
  useEffect(() => {
    if (!profile) return;
    const isVerified =
      profile.role === 'admin' || profile.verification_status === 'verified';

    if (prevVerifiedRef.current === null) {
      prevVerifiedRef.current = isVerified;
      return;
    }

    if (!prevVerifiedRef.current && isVerified && !reloadingRef.current) {
      reloadingRef.current = true;
      queryClient.invalidateQueries().finally(() => {
        // Soft full reload keeps the session; unlocks menus and refreshes name/data
        window.location.reload();
      });
      return;
    }

    prevVerifiedRef.current = isVerified;
  }, [profile, queryClient]);

  useEffect(() => {
    setIsMoreOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMoreOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMoreOpen]);

  const logout = async () => {
    try {
      window.localStorage.removeItem('maskpay-login-timestamp');
      try {
        sessionStorage.removeItem('maskpay-app-unlocked');
      } catch {}
      await supabase.auth.signOut({ scope: 'local' });
    } catch {}
    window.location.href = '/auth?mode=login';
  };

  const path = location.pathname;
  const isActive = (to: string) => path === to || path.startsWith(to + '/');

  const go = (to: string, locked = false) => {
    if (locked && !canAccess) return;
    navigate({ to: to as any });
  };

  const moreItems = [
    { label: 'Checkout', to: '/checkout', icon: ShoppingBag, lock: true },
    { label: 'Produtos', to: '/products', icon: Package, lock: true },
    { label: 'Depositar', to: '/deposit', icon: ArrowDownToLine, lock: true },
    { label: 'Sacar', to: '/withdraw', icon: ArrowUpFromLine, lock: true },
    { label: 'Transferir', to: '/transfer', icon: ArrowLeftRight, lock: true },
    { label: 'Taxas', to: '/rates', icon: Receipt, lock: true },
    { label: 'API', to: '/api-keys', icon: FileCode2, lock: true },
    { label: 'Documentação', to: '/docs', icon: BookOpen, lock: false },
    { label: 'Suporte', to: '/support', icon: MessageSquare, lock: false },
    { label: 'Ajustes', to: '/settings', icon: Settings, lock: true },
  ];

  /** Desktop sidebar (kept for large screens) */
  const DesktopNav = () => (
    <aside
      data-dash-sidebar
      className="dash-sidebar hidden lg:flex w-[248px] shrink-0 flex-col border-r border-border bg-background text-foreground transition-colors"
    >
      <div className="flex h-16 items-center gap-3 border-b border-border px-6">
        <img src={maskPlatformAsset.url} alt="" className="h-8 w-8 object-contain" />
        <span className="text-base font-semibold tracking-tight text-foreground">MaskPay</span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3 custom-scrollbar">
        <Link
          to="/dashboard"
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors',
            isActive('/dashboard')
              ? 'dash-nav-active border border-border bg-secondary text-foreground'
              : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground',
          )}
        >
          <LayoutDashboard className="h-5 w-5" />
          Início
        </Link>

        <button
          type="button"
          onClick={() => canAccess && setIsTransferMenuOpen(!isTransferMenuOpen)}
          className={cn(
            'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors',
            'text-muted-foreground hover:bg-secondary/80 hover:text-foreground',
            !canAccess && 'opacity-50',
          )}
        >
          <span className="flex items-center gap-3">
            <ArrowLeftRight className="h-5 w-5" />
            Transferências
          </span>
          <ChevronDown
            className={cn('h-4 w-4 transition-transform', isTransferMenuOpen && 'rotate-180')}
          />
        </button>
        {isTransferMenuOpen && canAccess && (
          <div className="mb-2 space-y-1 pl-4">
            {[
              { label: 'Saque', to: '/withdraw' },
              { label: 'Pagar QRcode', to: '/pay-qr' },
              { label: 'Depositar', to: '/deposit' },
              { label: 'Transferência', to: '/transfer' },
            ].map((item) => (
              <button
                key={item.to}
                type="button"
                onClick={() => go(item.to)}
                className={cn(
                  'block w-full rounded-lg px-3 py-2 text-left text-[12px] font-medium',
                  'text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        {[
          { label: 'Movimentações', to: '/transactions', icon: Webhook, lock: true },
          { label: 'Checkout', to: '/checkout', icon: ShoppingBag, lock: true },
          { label: 'Produtos', to: '/products', icon: Package, lock: true },
          { label: 'Taxas', to: '/rates', icon: Receipt, lock: true },
          { label: 'API', to: '/api-keys', icon: FileCode2, lock: true },
          { label: 'Documentação', to: '/docs', icon: BookOpen, lock: false },
          { label: 'Suporte', to: '/support', icon: MessageSquare, lock: false },
          { label: 'Ajustes', to: '/settings', icon: Settings, lock: true },
        ].map((item) => {
          const locked = item.lock && !canAccess;
          return (
            <button
              key={item.to}
              type="button"
              onClick={() => go(item.to, item.lock)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors',
                isActive(item.to)
                  ? 'dash-nav-active border border-border bg-secondary text-foreground'
                  : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground',
                locked && 'cursor-not-allowed opacity-50',
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
              {locked && <Lock className="ml-auto h-3 w-3 opacity-40" />}
            </button>
          );
        })}
      </nav>
      <div className="border-t border-border p-4">
        <Button
          variant="ghost"
          className="w-full justify-start rounded-2xl text-destructive/60 hover:bg-destructive/10 hover:text-destructive"
          onClick={logout}
        >
          <LogOut className="mr-3 h-5 w-5" />
          <span className="text-xs font-black uppercase tracking-widest">Sair</span>
        </Button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background text-foreground selection:bg-primary/10">
      <DesktopNav />

      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* Compact top bar (mobile) */}
        <header
          className="flex shrink-0 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur-md lg:hidden"
          style={{
            paddingTop: 'env(safe-area-inset-top, 0px)',
            height: 'calc(3.25rem + env(safe-area-inset-top, 0px))',
          }}
        >
          <div className="flex items-center gap-2.5">
            <img src={maskPlatformAsset.url} alt="" className="h-7 w-7 object-contain" />
            <span className="text-sm font-black uppercase tracking-[0.12em]">MaskPay</span>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-full p-2 text-muted-foreground/50 hover:bg-white/5 hover:text-white"
            aria-label="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </header>

        <main
          className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:pb-6 lg:px-4 lg:pt-5"
        >
          <PwaPrompt />
          <PushNotificationManager />
          <div className="mx-auto w-full max-w-7xl p-4 md:p-6 lg:max-w-none lg:px-6 lg:py-6 xl:px-8">
            {!path.startsWith('/verify') && <NotificationManager />}
            <Outlet />
          </div>
        </main>

        {/* Bottom navigation — mobile / tablet */}
        <nav
          className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#0a0a0a]/95 backdrop-blur-xl lg:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <div className="relative mx-auto flex h-[4.25rem] max-w-lg items-end justify-between px-2 pb-1.5">
            <BottomItem
              label="Início"
              active={isActive('/dashboard')}
              onClick={() => go('/dashboard')}
              icon={<Home className="h-5 w-5" />}
            />
            <BottomItem
              label="Extrato"
              active={isActive('/transactions')}
              onClick={() => go('/transactions', true)}
              locked={!canAccess}
              icon={<Webhook className="h-5 w-5" />}
            />

            {/* Center QR — elevated like the reference app */}
            <div className="relative -top-5 flex w-[4.5rem] flex-col items-center">
              <button
                type="button"
                onClick={() => go('/pay-qr', true)}
                disabled={!canAccess}
                className={cn(
                  'theme-qr-fab flex h-14 w-14 items-center justify-center rounded-full border-4 border-background bg-white text-black shadow-[0_8px_24px_rgba(255,255,255,0.15)] transition-transform active:scale-95',
                  !canAccess && 'opacity-40',
                )}
                aria-label="Pagar com QR Code"
              >
                <QrCode className="h-6 w-6" strokeWidth={2.25} />
              </button>
              <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                QR Code
              </span>
            </div>

            <BottomItem
              label="Carteira"
              active={isActive('/deposit') || isActive('/withdraw') || isActive('/wallet')}
              onClick={() => go('/deposit', true)}
              locked={!canAccess}
              icon={<Wallet className="h-5 w-5" />}
            />
            <BottomItem
              label="Mais"
              active={isMoreOpen || isActive('/settings')}
              onClick={() => setIsMoreOpen(true)}
              icon={<MoreHorizontal className="h-5 w-5" />}
            />
          </div>
        </nav>

        {/* "Mais" bottom sheet */}
        <AnimatePresence>
          {isMoreOpen && (
            <>
              <motion.button
                type="button"
                aria-label="Fechar"
                className="fixed inset-0 z-[60] bg-black/70 lg:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMoreOpen(false)}
              />
              <motion.div
                className="fixed inset-x-0 bottom-0 z-[70] rounded-t-3xl border border-white/10 bg-[#0c0c0c] lg:hidden"
                style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              >
                <div className="flex justify-center pt-3">
                  <div className="h-1 w-10 rounded-full bg-white/20" />
                </div>
                <div className="flex items-center justify-between px-5 pb-2 pt-3">
                  <h3 className="text-sm font-black uppercase tracking-widest text-white">Menu</h3>
                  <button
                    type="button"
                    onClick={() => setIsMoreOpen(false)}
                    className="rounded-full p-2 text-muted-foreground hover:bg-white/5 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2 px-4 pb-4">
                  {moreItems.map((item) => {
                    const locked = item.lock && !canAccess;
                    return (
                      <button
                        key={item.to}
                        type="button"
                        disabled={locked}
                        onClick={() => {
                          if (locked) return;
                          setIsMoreOpen(false);
                          navigate({ to: item.to as any });
                        }}
                        className={cn(
                          'flex flex-col items-center gap-2 rounded-2xl border border-white/5 bg-white/[0.03] px-2 py-3 transition-colors hover:bg-white/[0.06]',
                          locked && 'opacity-40',
                        )}
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5">
                          <item.icon className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-center text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="border-t border-white/5 px-4 py-3">
                  <Button
                    variant="ghost"
                    className="w-full justify-center rounded-2xl text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
                    onClick={logout}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Sair da conta</span>
                  </Button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function BottomItem({
  label,
  icon,
  active,
  onClick,
  locked,
}: {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick: () => void;
  locked?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-[4.25rem] flex-col items-center gap-1 py-1 transition-colors',
        active ? 'text-white' : 'text-muted-foreground/50',
        locked && 'opacity-40',
      )}
    >
      <span
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-2xl transition-colors',
          active && 'bg-white/10',
        )}
      >
        {icon}
      </span>
      <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}
