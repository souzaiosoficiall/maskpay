import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Badge } from '@/components/ui/badge';

import { getProfile } from '@/lib/settings.functions';
import { supabase } from '@/integrations/supabase/client';
import { useSessionReady } from '@/hooks/useSessionReady';
import { useNavigate } from '@tanstack/react-router';

import { 
  Wallet, 
  Lock,
  BarChart3,
  CreditCard,
  ArrowRightLeft,
  Calculator,
  Download,
  Eye,
  EyeOff,
  ChevronDown,
  Activity,
  Fingerprint,
  AlertCircle,
  Clock,
  Loader2,
  TrendingUp,
  ArrowUpRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useMemo } from 'react';
import { getTransactionStats } from '@/lib/transactions.functions';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardPage,
});



function DashboardPage() {
  const sessionReady = useSessionReady();
  const navigate = useNavigate();
  const fetchProfile = useServerFn(getProfile);

  const { data: profile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => fetchProfile({}),
    enabled: sessionReady,
    staleTime: 15_000,
  });
  
  const isKycLocked = !sessionReady || isLoadingProfile || (profile && profile.verification_status !== 'verified');

  const { data: wallet } = useQuery({
    queryKey: ['wallet', profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('wallets')
        .select('id, balance')
        .eq('user_id', profile!.id)
        .single();
      return data;
    },
    enabled: !!profile?.id,
  });


  const fetchStats = useServerFn(getTransactionStats);
  const { data: txStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['transaction-stats', profile?.id],
    queryFn: () => fetchStats({}),
    enabled: !!profile?.id,
  });

  const [hideValues, setHideValues] = useState(false);
  const [activePeriod, setActivePeriod] = useState('Ano');
  const [filterOption, setFilterOption] = useState('Hoje');

  const chartData = useMemo(() => {
    if (!txStats?.chartData) return [];
    return txStats.chartData[activePeriod] || [];
  }, [txStats, activePeriod]);

  const stats = useMemo(() => {
    return [
      { 
        label: 'Saldo', 
        value: (wallet?.balance || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 
        icon: Wallet 
      },
      { 
        label: 'Ticket Médio', 
        value: (txStats?.averageTicket || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 
        icon: CreditCard 
      },
      { 
        label: 'Total de Transações', 
        value: (txStats?.totalTransactions || 0).toString(), 
        icon: ArrowRightLeft 
      },
    ];
  }, [txStats, wallet?.balance]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Bom dia';
    if (hour >= 12 && hour < 18) return 'Boa tarde';
    return 'Boa noite';
  }, []);

  const firstName = profile?.full_name?.split(' ')[0] || '';

  return (
    <div className="space-y-6 md:space-y-10 pb-16 font-sans relative z-10 w-full overflow-hidden">
      <div className="animate-in fade-in slide-in-from-left duration-700">
        <h2 className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-primary mb-2">
          {greeting}, {firstName}!
        </h2>
      </div>

      {isLoadingProfile && !profile && (
        <Card className="border-white/5 bg-white/5 rounded-[2rem] overflow-hidden border-2 animate-pulse">
          <CardContent className="p-6 h-24 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/20" />
          </CardContent>
        </Card>
      )}

      {(profile?.verification_status === 'unverified' || !profile?.verification_status) && profile?.role !== 'admin' && (
        <Card className="border-red-500/20 bg-red-500/10 rounded-[2rem] overflow-hidden border-2 shadow-lg shadow-red-500/5">
          <CardContent className="p-5 md:p-6 flex flex-col md:flex-row items-center justify-between gap-5 md:gap-6">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/20 shrink-0">
                <Fingerprint className="w-5 h-5 md:w-6 md:h-6 text-red-500" />
              </div>
              <div>
                <h3 className="text-xs md:text-sm font-black uppercase tracking-tighter text-white">Verificação pendente</h3>
                <p className="text-[9px] md:text-[10px] font-bold text-red-500/60 uppercase tracking-widest mt-0.5 md:mt-1 leading-relaxed">Você ainda não realizou sua verificação de identidade. Envie seus documentos agora para liberar todas as funcionalidades da plataforma.</p>
              </div>
            </div>
            <Button 
              onClick={() => navigate({ to: '/verify' })}
              className="bg-red-500 text-white hover:bg-red-600 rounded-xl px-6 py-2 text-[8px] font-black uppercase tracking-widest shrink-0"
            >
              Começar Verificação
            </Button>
          </CardContent>
        </Card>
      )}

      {(profile?.verification_status === 'pending_review' || profile?.verification_status === 'pending') && (
        <Card className="border-blue-500/20 bg-blue-500/5 rounded-[2rem] overflow-hidden border-2">
          <CardContent className="p-5 md:p-6 flex flex-col md:flex-row items-center justify-between gap-5 md:gap-6">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shrink-0">
                <Clock className="w-5 h-5 md:w-6 md:h-6 text-blue-500" />
              </div>
              <div>
                <h3 className="text-xs md:text-sm font-black uppercase tracking-tighter text-white">Verificação em análise</h3>
                <p className="text-[9px] md:text-[10px] font-bold text-blue-500/60 uppercase tracking-widest mt-0.5 md:mt-1 leading-relaxed">Estamos analisando seus documentos. O suporte tem até 24 horas para realizar a liberação.</p>
              </div>
            </div>
            <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 rounded-xl px-4 py-2 text-[8px] font-black uppercase tracking-widest shrink-0">
              Em análise
            </Badge>
          </CardContent>
        </Card>
      )}

      {profile?.verification_status === 'rejected' && (
        <Card className="border-red-500 bg-red-500/10 rounded-[2rem] overflow-hidden border-2">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 flex items-center justify-center border border-red-500/30">
              <AlertCircle className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-tighter text-white">Conta Bloqueada</h3>
              <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mt-1">Sua verificação foi recusada e sua conta foi bloqueada permanentemente.</p>
            </div>
          </CardContent>
        </Card>
      )}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl md:text-4xl font-black tracking-tighter uppercase mb-2">Movimentações Gerais</h1>
          <p className="text-muted-foreground font-semibold text-xs md:text-base">Visualize o detalhamento das suas operações financeiras.</p>
        </div>
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center gap-2 md:gap-3 bg-background border border-white/5 px-4 md:px-6 py-2.5 md:py-3 rounded-2xl text-[10px] md:text-sm font-black uppercase tracking-widest cursor-pointer hover:bg-white/5 transition-colors outline-none">
                {filterOption} <ChevronDown className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-background border-white/5 rounded-2xl min-w-[150px]">
              {['Hoje', 'Ontem', 'Últimos 7 dias', 'Últimos 30 dias'].map((opt) => (
                <DropdownMenuItem 
                  key={opt}
                  onClick={() => setFilterOption(opt)}
                  className="text-[10px] font-black uppercase tracking-widest p-4 cursor-pointer focus:bg-white/5 focus:text-white"
                >
                  {opt}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setHideValues(!hideValues)}
            className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-background text-muted-foreground hover:text-white border border-white/5"
          >
            {hideValues ? <EyeOff className="w-4 h-4 md:w-5 md:h-5" /> : <Eye className="w-4 h-4 md:w-5 md:h-5" />}
          </Button>
        </div>
      </div>


      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat, i) => (
          <Card key={i} className={cn("border-white/5 bg-background border-2 rounded-[2rem] transition-all hover:border-white/20 group p-2")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
              <span className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground group-hover:text-white transition-colors">
                {stat.label}
              </span>
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 group-hover:scale-110 transition-transform">
                <stat.icon className="h-5 w-5 text-muted-foreground group-hover:text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black tracking-tighter mb-4">
                {hideValues ? '••••••••' : stat.value}
              </div>
              <div className="flex gap-2">
                {[1, 2, 3].map(dot => (
                  <div key={dot} className={cn("w-1.5 h-1.5 rounded-full", i % 2 === 0 ? "bg-white" : "bg-white/20")} />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-white/5 bg-background border-2 rounded-[2.5rem] overflow-hidden p-2 md:p-4">
        <CardHeader className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-8 md:pb-12 pt-4 px-4 md:px-6">
          <div>
            <CardTitle className="text-xl md:text-2xl font-black uppercase tracking-tighter">Fluxo de Receita</CardTitle>
            <p className="text-[10px] md:text-sm font-bold text-muted-foreground uppercase tracking-widest mt-2">Visualize o desempenho das suas vendas em tempo real</p>
          </div>
          <div className="flex w-full lg:w-auto gap-1 bg-white/5 p-1.5 rounded-2xl border border-white/5">
            {['Semana', 'Mês', 'Ano'].map((period) => (
              <button
                key={period}
                onClick={() => setActivePeriod(period)}
                className={cn(
                  "flex-1 lg:flex-none px-4 md:px-8 py-2 md:py-2.5 text-[9px] md:text-xs font-black uppercase tracking-widest rounded-xl transition-all border border-transparent cursor-pointer",
                  activePeriod === period 
                    ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.1)]" 
                    : "text-muted-foreground hover:text-white hover:bg-white/5"
                )}
              >
                {period}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="px-0 md:px-2">
          <div className="h-[450px] md:h-[400px] w-[105%] md:w-full -ml-[2.5%] md:ml-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="white" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="white" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="6 6" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: 'rgba(255,255,255,0.2)', fontSize: 11, fontWeight: 900}}
                  dy={15}
                />
                <YAxis hide />
                <Tooltip 
                  cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }}
                  contentStyle={{ 
                    backgroundColor: 'oklch(var(--card))', 
                    border: '2px solid rgba(255,255,255,0.1)',
                    borderRadius: '20px',
                    padding: '12px 20px'
                  }}
                  itemStyle={{ color: 'white', fontWeight: 900, textTransform: 'uppercase', fontSize: '12px' }}
                  labelStyle={{ color: 'rgba(255,255,255,0.4)', fontWeight: 900, marginBottom: '4px', fontSize: '10px' }}
                />
            <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="white" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorValue)" 
                  animationDuration={800}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
