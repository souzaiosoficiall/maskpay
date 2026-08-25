import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Card, CardContent } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Badge } from '@/components/ui/badge';
import { getProfile } from '@/lib/settings.functions';
import { supabase } from '@/integrations/supabase/client';
import { useSessionReady } from '@/hooks/useSessionReady';
import {
  Lock,
  ArrowRightLeft,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Fingerprint,
  AlertCircle,
  Clock,
  Loader2,
  ArrowUpRight,
  ArrowDownLeft,
  QrCode,
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMemo, useState } from 'react';
import { getTransactionStats, getTransactions } from '@/lib/transactions.functions';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardPage,
});

function DashboardPage() {
  const sessionReady = useSessionReady();
  const navigate = useNavigate();
  const fetchProfile = useServerFn(getProfile);
  const fetchStats = useServerFn(getTransactionStats);
  const fetchTx = useServerFn(getTransactions);

  const { data: profile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => fetchProfile({}),
    enabled: sessionReady,
    staleTime: 15_000,
  });

  const isKycLocked =
    !!profile && profile.role !== 'admin' && profile.verification_status !== 'verified';
  const canAccess = !isKycLocked || profile?.role === 'admin';

  const showUnverifiedBanner =
    !isLoadingProfile &&
    !!profile &&
    profile.role !== 'admin' &&
    (profile.verification_status === 'unverified' ||
      profile.verification_status === null ||
      profile.verification_status === undefined ||
      profile.verification_status === '');

  const { data: wallet } = useQuery({
    queryKey: ['wallet', profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('wallets')
        .select('id, balance')
        .eq('user_id', profile!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!profile?.id,
  });

  const { data: txStats } = useQuery({
    queryKey: ['transaction-stats', profile?.id],
    queryFn: () => fetchStats({}),
    enabled: !!profile?.id,
  });

  const { data: transactions, isLoading: isLoadingTx } = useQuery({
    queryKey: ['transactions-recent', profile?.id],
    queryFn: () => fetchTx({}),
    enabled: !!profile?.id,
    staleTime: 20_000,
  });

  const [hideValues, setHideValues] = useState(false);
  const { theme, toggleTheme, isLight } = useTheme();

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Bom dia';
    if (hour >= 12 && hour < 18) return 'Boa tarde';
    return 'Boa noite';
  }, []);

  const firstName = profile?.full_name?.split(' ')[0] || '';

  const balanceStr = (wallet?.balance || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  const recent = useMemo(() => {
    return (transactions || []).slice(0, 8);
  }, [transactions]);

  const formatAmount = (amount: number, type?: string) => {
    const n = Number(amount) || 0;
    const formatted = n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const isOut = type === 'withdrawal' || type === 'transfer_out' || type === 'payment';
    return { formatted, isOut };
  };

  const typeLabel = (type?: string) => {
    switch (type) {
      case 'deposit':
        return 'Depósito';
      case 'withdrawal':
        return 'Saque';
      case 'transfer':
      case 'transfer_in':
        return 'Transferência';
      case 'transfer_out':
        return 'Envio';
      case 'payment':
        return 'Pagamento';
      default:
        return type || 'Movimentação';
    }
  };

  const formatDate = (iso?: string) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const quickActions = [
    {
      label: 'Enviar',
      icon: ArrowUpFromLine,
      to: '/transfer',
      lock: true,
    },
    {
      label: 'Receber',
      icon: ArrowDownToLine,
      to: '/deposit',
      lock: true,
    },
    {
      label: 'Sacar',
      icon: ArrowRightLeft,
      to: '/withdraw',
      lock: true,
    },
    {
      label: 'QR Code',
      icon: QrCode,
      to: '/pay-qr',
      lock: true,
    },
  ];

  return (
    <div className="relative z-10 mx-auto w-full max-w-lg space-y-5 pb-4 font-sans lg:max-w-3xl">
      {/* Greeting */}
      <div className="flex items-start justify-between gap-3 pt-1">
        <div>
          <p className="text-[11px] font-medium text-muted-foreground">
            {greeting}
            {firstName ? ',' : ''}
          </p>
          <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">
            {firstName || 'MaskPay'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            title={isLight ? 'Tema escuro' : 'Tema claro'}
            className="h-10 w-10 rounded-full border border-white/10 bg-white/5 text-muted-foreground hover:text-white"
          >
            {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setHideValues(!hideValues)}
            title={hideValues ? 'Mostrar saldo' : 'Ocultar saldo'}
            className="h-10 w-10 rounded-full border border-white/10 bg-white/5 text-muted-foreground hover:text-white"
          >
            {hideValues ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {isLoadingProfile && !profile && (
        <div className="flex h-36 items-center justify-center rounded-3xl border border-white/5 bg-white/5">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/30" />
        </div>
      )}

      {/* KYC banners */}
      {showUnverifiedBanner && (
        <Card className="overflow-hidden rounded-3xl border-2 border-red-500/20 bg-red-500/10">
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10">
                <Fingerprint className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-tight text-white">
                  Verificação pendente
                </h3>
                <p className="mt-0.5 text-[10px] font-medium leading-relaxed text-red-400/80">
                  Envie seus documentos para liberar a plataforma.
                </p>
              </div>
            </div>
            <Button
              onClick={() => navigate({ to: '/verify' })}
              className="shrink-0 rounded-2xl bg-red-500 px-5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-red-600"
            >
              Verificar agora
            </Button>
          </CardContent>
        </Card>
      )}

      {(profile?.verification_status === 'pending_review' ||
        profile?.verification_status === 'pending') && (
        <Card className="overflow-hidden rounded-3xl border-2 border-blue-500/20 bg-blue-500/5">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10">
                <Clock className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-tight text-white">
                  Em análise
                </h3>
                <p className="mt-0.5 text-[10px] font-medium text-blue-400/70">
                  Liberação em até 24h.
                </p>
              </div>
            </div>
            <Badge className="rounded-xl border-blue-500/20 bg-blue-500/10 text-[9px] font-black uppercase tracking-widest text-blue-400">
              Pendente
            </Badge>
          </CardContent>
        </Card>
      )}

      {profile?.verification_status === 'rejected' && (
        <Card className="overflow-hidden rounded-3xl border-2 border-red-500 bg-red-500/10">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="h-6 w-6 text-red-500" />
            <div>
              <h3 className="text-xs font-black uppercase text-white">Conta bloqueada</h3>
              <p className="text-[10px] font-medium text-red-400">Verificação recusada.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Balance card — hero */}
      <div className="theme-hero-card relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-white via-white to-white/85 p-5 text-black shadow-[0_20px_50px_-20px_rgba(255,255,255,0.25)] sm:p-6">
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-black/5" />
        <div className="pointer-events-none absolute -bottom-10 left-1/3 h-24 w-24 rounded-full bg-black/5" />

        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-black/45">
              Saldo disponível
            </p>
            <p className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              {hideValues ? '••••••' : balanceStr}
            </p>
            {txStats && (
              <p className="mt-2 text-[11px] font-medium text-black/40">
                {txStats.totalTransactions || 0} transações · ticket médio{' '}
                {hideValues
                  ? '••••'
                  : (txStats.averageTicket || 0).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
              </p>
            )}
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black/5">
            <img src="/assets/mask_logo.png" alt="" className="h-6 w-6 object-contain opacity-80" />
          </div>
        </div>

        <div className="relative mt-5 flex gap-2">
          <Button
            disabled={!canAccess}
            onClick={() => navigate({ to: '/deposit' })}
            className="h-10 flex-1 rounded-2xl bg-black text-[11px] font-black uppercase tracking-widest text-white hover:bg-black/85 disabled:opacity-40"
          >
            Adicionar
          </Button>
          <Button
            disabled={!canAccess}
            onClick={() => navigate({ to: '/withdraw' })}
            variant="outline"
            className="h-10 flex-1 rounded-2xl border-black/15 bg-transparent text-[11px] font-black uppercase tracking-widest text-black hover:bg-black/5 disabled:opacity-40"
          >
            Sacar
          </Button>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {quickActions.map((action) => {
          const locked = action.lock && !canAccess;
          return (
            <button
              key={action.label}
              type="button"
              disabled={locked}
              onClick={() => !locked && navigate({ to: action.to as any })}
              className={cn(
                'flex flex-col items-center gap-2 rounded-2xl border border-white/5 bg-white/[0.03] px-1 py-3 transition-colors hover:bg-white/[0.06] active:scale-[0.98]',
                locked && 'opacity-40',
              )}
            >
              <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white/5">
                <action.icon className="h-4 w-4 text-white" />
                {locked && (
                  <Lock className="absolute -right-0.5 -top-0.5 h-3 w-3 text-muted-foreground" />
                )}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {action.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Recent transactions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-sm font-black uppercase tracking-wider text-white">
            Transações
          </h2>
          <button
            type="button"
            onClick={() => canAccess && navigate({ to: '/transactions' })}
            className="flex items-center gap-0.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-white"
          >
            Ver todas
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="overflow-hidden rounded-3xl border border-white/5 bg-white/[0.02]">
          {isLoadingTx && (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/30" />
            </div>
          )}

          {!isLoadingTx && recent.length === 0 && (
            <div className="px-4 py-10 text-center text-[11px] font-medium text-muted-foreground/50">
              Nenhuma movimentação ainda
            </div>
          )}

          {!isLoadingTx &&
            recent.map((tx: any, i: number) => {
              const { formatted, isOut } = formatAmount(tx.amount, tx.type);
              return (
                <div
                  key={tx.id || i}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3.5',
                    i < recent.length - 1 && 'border-b border-white/5',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                      isOut ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400',
                    )}
                  >
                    {isOut ? (
                      <ArrowUpRight className="h-4 w-4" />
                    ) : (
                      <ArrowDownLeft className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">
                      {typeLabel(tx.type)}
                    </p>
                    <p className="text-[10px] font-medium text-muted-foreground">
                      {formatDate(tx.created_at)}
                      {tx.status ? ` · ${tx.status}` : ''}
                    </p>
                  </div>
                  <p
                    className={cn(
                      'shrink-0 text-sm font-bold',
                      isOut ? 'text-red-400' : 'text-emerald-400',
                    )}
                  >
                    {hideValues ? '••••' : `${isOut ? '-' : '+'}${formatted}`}
                  </p>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
