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
  Wallet,
  CreditCard,
  Activity,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMemo, useState } from 'react';
import { getTransactionStats, getTransactions } from '@/lib/transactions.functions';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

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
  const [activePeriod, setActivePeriod] = useState('Mês');
  const { toggleTheme, isLight } = useTheme();

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

  const recent = useMemo(() => (transactions || []).slice(0, 8), [transactions]);
  const recentDesktop = useMemo(() => (transactions || []).slice(0, 6), [transactions]);

  const chartData = useMemo(() => {
    const raw = txStats?.chartData?.[activePeriod] || txStats?.chartData?.['Mês'] || [];
    return Array.isArray(raw) ? raw : [];
  }, [txStats, activePeriod]);

  const typeBreakdown = useMemo(() => {
    const list = transactions || [];
    const counts: Record<string, number> = {};
    list.forEach((t: any) => {
      const k = t.type || 'other';
      counts[k] = (counts[k] || 0) + 1;
    });
    const total = list.length || 1;
    return [
      { key: 'deposit', label: 'Depósitos', color: '#22c55e' },
      { key: 'withdrawal', label: 'Saques', color: '#ef4444' },
      { key: 'transfer', label: 'Transferências', color: '#3b82f6' },
      { key: 'payment', label: 'Pagamentos', color: '#a855f7' },
    ].map((row) => ({
      ...row,
      count: counts[row.key] || counts[row.key + '_in'] || counts[row.key + '_out'] || 0,
      pct: Math.round(((counts[row.key] || 0) / total) * 1000) / 10,
    }));
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
    { label: 'Enviar', icon: ArrowUpFromLine, to: '/transfer', lock: true },
    { label: 'Receber', icon: ArrowDownToLine, to: '/deposit', lock: true },
    { label: 'Sacar', icon: ArrowRightLeft, to: '/withdraw', lock: true },
    { label: 'QR Code', icon: QrCode, to: '/pay-qr', lock: true },
  ];

  const kycBanners = (
    <>
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
    </>
  );

  /* ========== MOBILE (unchanged experience) ========== */
  const mobile = (
    <div className="relative z-10 mx-auto w-full max-w-lg space-y-5 pb-4 font-sans lg:hidden">
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

      {kycBanners}

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

      <div className="space-y-3">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-sm font-black uppercase tracking-wider text-white">Transações</h2>
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
                    <p className="truncate text-sm font-semibold text-white">{typeLabel(tx.type)}</p>
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

  /* ========== DESKTOP only — premium panel (mobile untouched) ========== */
  const maxBar = Math.max(...chartData.map((d: any) => Number(d.value) || 0), 1);
  const spark = chartData.slice(-8).map((d: any) => Number(d.value) || 0);
  const sparkMax = Math.max(...spark, 1);
  const sparkPath = (() => {
    if (spark.length < 2) return '';
    const w = 120;
    const h = 36;
    return spark
      .map((v, i) => {
        const x = (i / (spark.length - 1)) * w;
        const y = h - (v / sparkMax) * (h - 4) - 2;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  })();

  const fullName = profile?.full_name || firstName || 'usuário';
  const todayLabel = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const desktop = (
    <div className="relative z-10 hidden w-full font-sans lg:block">
      {/* soft ambient glow */}
      <div className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-white/[0.03] blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-40 h-72 w-72 rounded-full bg-emerald-500/[0.04] blur-3xl" />

      <div className="relative space-y-5">
        {/* Title row */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="text-[13px] font-medium text-muted-foreground">Dashboard</span>
              <span className="inline-flex h-5 items-center rounded-full bg-emerald-500/15 px-2 text-[10px] font-semibold text-emerald-400">
                ao vivo
              </span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Overview</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {greeting}, {fullName} — resumo da sua conta MaskPay
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5 rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
              {['Semana', 'Mês', 'Ano'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setActivePeriod(p)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                    activePeriod === p
                      ? 'bg-white text-black shadow-sm'
                      : 'text-muted-foreground hover:text-white',
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-9 w-9 rounded-xl border border-white/[0.08] bg-white/[0.03] text-muted-foreground hover:text-white"
            >
              {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setHideValues(!hideValues)}
              className="h-9 w-9 rounded-xl border border-white/[0.08] bg-white/[0.03] text-muted-foreground hover:text-white"
            >
              {hideValues ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button
              disabled={!canAccess}
              onClick={() => navigate({ to: '/deposit' })}
              className="h-9 rounded-xl bg-white px-4 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-40"
            >
              Depositar
            </Button>
          </div>
        </div>

        {kycBanners}

        {/* Metric cards with sparklines */}
        <div className="grid grid-cols-3 gap-4">
          <div className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <p className="text-sm font-medium text-white">Saldo disponível</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Capital livre na carteira</p>
            <p className="mt-4 text-[1.75rem] font-semibold tracking-tight text-white tabular-nums">
              {hideValues ? '••••••' : balanceStr}
            </p>
            <div className="mt-3 flex items-end justify-between gap-3">
              <p className="text-xs font-medium text-emerald-400/90">
                {hideValues
                  ? '••••'
                  : `${(txStats?.totalFees ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} em taxas`}
              </p>
              {sparkPath && (
                <svg width="120" height="36" className="opacity-90">
                  <path d={sparkPath} fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <p className="text-sm font-medium text-white">Volume transacionado</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Movimentação no período</p>
            <p className="mt-4 text-[1.75rem] font-semibold tracking-tight text-white tabular-nums">
              {hideValues
                ? '••••'
                : (txStats?.dailyVolume || 0).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
            </p>
            <div className="mt-3 flex items-end justify-between gap-3">
              <p className="text-xs font-medium text-sky-400/90">
                {txStats?.totalTransactions || 0} operações
              </p>
              {sparkPath && (
                <svg width="120" height="36" className="opacity-90">
                  <path d={sparkPath} fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <p className="text-sm font-medium text-white">Total retirado</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Saques concluídos</p>
            <p className="mt-4 text-[1.75rem] font-semibold tracking-tight text-white tabular-nums">
              {hideValues
                ? '••••'
                : (txStats?.totalWithdrawn || 0).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
            </p>
            <div className="mt-3 flex items-end justify-between gap-3">
              <p className="text-xs font-medium text-violet-400/90">
                ticket médio{' '}
                {hideValues
                  ? '••••'
                  : (txStats?.averageTicket || 0).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
              </p>
              {sparkPath && (
                <svg width="120" height="36" className="opacity-90">
                  <path d={sparkPath} fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
            </div>
          </div>
        </div>

        {/* Chart + side panel */}
        <div className="grid grid-cols-12 gap-4">
          <div className="relative col-span-12 overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.04] to-transparent p-5 xl:col-span-8">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-white">Fluxo de receita</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Entradas · {todayLabel} · período {activePeriod.toLowerCase()}
                </p>
              </div>
              <div className="flex gap-2">
                {quickActions.map((action) => {
                  const locked = action.lock && !canAccess;
                  return (
                    <button
                      key={action.label}
                      type="button"
                      disabled={locked}
                      onClick={() => !locked && navigate({ to: action.to as any })}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/[0.06]',
                        locked && 'opacity-40',
                      )}
                    >
                      <action.icon className="h-3.5 w-3.5 text-muted-foreground" />
                      {action.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="h-[280px] w-full">
              {chartData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground/50">
                  Sem dados de gráfico ainda
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="maskpayArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }}
                    />
                    <YAxis hide />
                    <Tooltip
                      cursor={{ stroke: 'rgba(52,211,153,0.35)', strokeWidth: 1 }}
                      contentStyle={{
                        background: '#0c1014',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#34d399"
                      strokeWidth={2.5}
                      fill="url(#maskpayArea)"
                      dot={false}
                      activeDot={{ r: 5, fill: '#34d399', stroke: '#0c1014', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                AVG{' '}
                <span className="font-semibold text-emerald-400">
                  {hideValues
                    ? '••••'
                    : (txStats?.averageTicket || 0).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                </span>
              </span>
              <span>{activePeriod}</span>
            </div>
          </div>

          <div className="col-span-12 space-y-4 xl:col-span-4">
            <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.04] to-transparent p-5">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
              <h2 className="text-sm font-semibold text-white">Métodos</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Canais ativos na conta</p>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/20 px-3 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-xs font-bold text-emerald-400">
                      PIX
                    </span>
                    <div>
                      <p className="text-sm font-medium text-white">PIX</p>
                      <p className="text-[11px] text-muted-foreground">Instantâneo</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-white">
                    {txStats?.totalTransactions ? '100%' : '0%'}
                  </span>
                </div>
                {typeBreakdown.map((row) => (
                  <div
                    key={row.key}
                    className="flex items-center justify-between px-1 text-xs text-muted-foreground"
                  >
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.color }} />
                      {row.label}
                    </span>
                    <span className="font-medium text-white/80">
                      {row.count} · {row.pct}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Transactions table */}
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.04] to-transparent p-5">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Últimas movimentações</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Extrato recente da carteira</p>
            </div>
            <button
              type="button"
              onClick={() => canAccess && navigate({ to: '/transactions' })}
              className="text-xs font-medium text-muted-foreground transition hover:text-white"
            >
              Ver todas →
            </button>
          </div>
          {isLoadingTx && (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/30" />
            </div>
          )}
          {!isLoadingTx && recentDesktop.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground/50">
              Nenhuma transação encontrada.
            </p>
          )}
          {!isLoadingTx && recentDesktop.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-white/[0.05]">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02] text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Tipo</th>
                    <th className="px-4 py-2.5 font-medium">Data</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 text-right font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDesktop.map((tx: any, i: number) => {
                    const { formatted, isOut } = formatAmount(tx.amount, tx.type);
                    return (
                      <tr
                        key={tx.id || i}
                        className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]"
                      >
                        <td className="px-4 py-3 font-medium text-white">{typeLabel(tx.type)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(tx.created_at)}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-[11px] text-muted-foreground">
                            {tx.status || '—'}
                          </span>
                        </td>
                        <td
                          className={cn(
                            'px-4 py-3 text-right font-semibold tabular-nums',
                            isOut ? 'text-red-400' : 'text-emerald-400',
                          )}
                        >
                          {hideValues ? '••••' : `${isOut ? '-' : '+'}${formatted}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {mobile}
      {desktop}
    </>
  );
}
