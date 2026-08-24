import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { 
  BarChart3, 
  CreditCard, 
  ArrowRightLeft, 
  Calculator, 
  Download,
  Loader2,
  Inbox
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { getTransactionStats } from '@/lib/transactions.functions';

export const Route = createFileRoute('/_authenticated/webhooks')({
  component: GeneralMovementsPage,
});

function GeneralMovementsPage() {
  const fetchStats = useServerFn(getTransactionStats);
  
  const { data: txStats, isLoading } = useQuery({
    queryKey: ['transaction-stats'],
    queryFn: () => fetchStats({}),
  });

  const stats = [
    { 
      label: 'Volume Transacional', 
      value: (txStats?.dailyVolume || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 
      icon: BarChart3 
    },
    { 
      label: 'Ticket Médio', 
      value: (txStats?.averageTicket || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 
      icon: CreditCard 
    },
    { 
      label: 'Total de transações', 
      value: (txStats?.totalTransactions || 0).toString(), 
      icon: ArrowRightLeft 
    },
    { 
      label: 'Descontos em Taxas', 
      value: (txStats?.totalFees || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 
      icon: Calculator 
    },
    { 
      label: 'Total Retirado', 
      value: (txStats?.totalWithdrawn || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 
      icon: Download 
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground/20" />
      </div>
    );
  }

  const hasNoData = !txStats || txStats.totalTransactions === 0;

  return (
    <div className="space-y-10 pb-16 font-sans">
      <div>
        <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Movimentações Gerais |</h1>
        <p className="text-muted-foreground font-semibold text-base">Visualize o detalhamento das suas operações financeiras.</p>
      </div>

      {hasNoData ? (
        <Card className="border-white/5 bg-background border-2 rounded-[2rem] p-20 flex flex-col items-center justify-center text-center">
          <Inbox className="w-16 h-16 text-muted-foreground/20 mb-6" />
          <h2 className="text-xl font-black uppercase tracking-widest text-white mb-2">Nenhuma movimentação encontrada</h2>
          <p className="text-muted-foreground text-sm font-semibold uppercase tracking-widest">
            Não existem registros de transações para esta conta até o momento.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {stats.map((stat, i) => (
            <Card key={i} className="border-white/5 bg-background border-2 rounded-[2rem] transition-all hover:border-white/20 group p-2">
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
                  {stat.value}
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
      )}
    </div>
  );
}