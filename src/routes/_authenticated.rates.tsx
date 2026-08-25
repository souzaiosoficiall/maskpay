import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Wallet, Smartphone, Info, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { getPlatformFees } from '@/lib/payments.functions';

export const Route = createFileRoute('/_authenticated/rates')({
  component: RatesPage,
});

function RatesPage() {
  const fetchFees = useServerFn(getPlatformFees);

  const { data: fees, isLoading } = useQuery({
    queryKey: ['platform-fees'],
    queryFn: () => fetchFees({}),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const rates = [
    { 
      title: 'PIX', 
      rate: fees?.deposit.percentage ? `${fees.deposit.percentage}%` : '2.49%', 
      fixed: `R$ ${fees?.deposit.fixed?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,40'}`, 
      icon: Wallet, 
      description: 'Liberação instantânea' 
    },
    { 
      title: 'Saque PIX', 
      rate: 'R$ 0,80', 
      fixed: `R$ ${fees?.withdrawal.fixed?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,80'}`, 
      icon: Wallet, 
      description: 'Taxa fixa por retirada' 
    },
  ];

  return (
    <div className="space-y-10 pb-16 font-sans">
      <div>
        <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Taxas</h1>
        <p className="text-muted-foreground font-semibold text-base">Visualize as taxas aplicadas em cada modalidade de pagamento.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {rates.map((item, i) => (
          <Card key={i} className="border-white/5 bg-background border-2 rounded-[2rem] p-2 hover:border-white/20 transition-all group">
            <CardHeader className="flex flex-row items-center justify-between pb-6">
              <span className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground group-hover:text-white transition-colors">{item.title}</span>
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 group-hover:scale-110 transition-transform">
                <item.icon className="h-5 w-5 text-muted-foreground group-hover:text-white" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-1">
                <div className="text-3xl font-black tracking-tighter">{item.rate}</div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  {item.title === 'Saque PIX' ? 'Por transação' : `+ ${item.fixed} por transação`}
                </div>
              </div>
              <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-tight leading-relaxed">
                {item.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-white/5 bg-white/[0.02] border-2 border-dashed rounded-[2rem] p-6">
        <CardContent className="flex items-start gap-4 p-0">
          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center shrink-0">
            <Info className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase tracking-widest text-white">Sobre o Recebimento</h4>
            <p className="text-xs text-muted-foreground/60 leading-relaxed font-medium">
              Em todas as operações a taxa é descontada do valor: no depósito você recebe o líquido; no saque o destinatário recebe o valor menos a taxa. O saldo fica disponível para saque conforme o prazo de liberação de cada método.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}