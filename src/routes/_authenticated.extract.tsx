import { createFileRoute } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useState, useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  Download, 
  Search, 
  Filter, 
  Calendar,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const Route = createFileRoute('/_authenticated/extract')({
  component: ExtractPage,
});

function ExtractPage() {
  const [activeTab, setActiveTab] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any>(null);

  const tabs = ['Todos', 'Sucesso', 'Pendente', 'Falha'];

  // Fetched in useEffect below
  const [userWalletId, setUserWalletId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch current user's wallet
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        const { data: walletData, error: walletError } = await supabase
          .from('wallets')
          .select('*')
          .eq('user_id', user.id)
          .single();
        
        if (walletError || !walletData) throw new Error("Carteira não encontrada");
        
        setWallet(walletData);
        setUserWalletId(walletData.id);

        // Fetch real transactions for this wallet
        const { data: txData, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('wallet_id', walletData.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setTransactions(txData || []);
      } catch (error: any) {
        toast.error('Erro ao carregar extrato: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesTab = 
        activeTab === 'Todos' || 
        (activeTab === 'Sucesso' && t.status === 'completed') ||
        (activeTab === 'Pendente' && t.status === 'pending') ||
        (activeTab === 'Falha' && t.status === 'failed');
      
      const matchesSearch = 
        !searchTerm || 
        (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.type && t.type.toLowerCase().includes(searchTerm.toLowerCase()));

      return matchesTab && matchesSearch;
    });
  }, [transactions, activeTab, searchTerm]);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Sucesso';
      case 'pending': return 'Pendente';
      case 'failed': return 'Falha';
      default: return status;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'cash_in': return 'Depósito';
      case 'cash_out': return 'Saque';
      case 'transfer_in': return 'Transferência Recebida';
      case 'transfer_out': return 'Transferência Enviada';
      default: return type.replace('_', ' ');
    }
  };

  return (
    <div className="space-y-10 pb-16 font-sans relative z-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Extrato |</h1>
          <p className="text-muted-foreground font-semibold text-base">Histórico real de todas as movimentações da sua conta.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button className="bg-white text-black hover:bg-white/90 rounded-2xl px-6 h-12 text-xs font-black uppercase tracking-widest transition-all">
            <Download className="mr-2 h-4 w-4" /> Exportar CSV
          </Button>
        </div>
      </div>

      <Card className="border-white/5 bg-background border-2 rounded-[2.5rem] overflow-hidden">
        <CardHeader className="p-8 border-b border-white/5 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex gap-2 bg-white/5 p-2 rounded-2xl border border-white/5 w-fit">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-8 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all border border-transparent cursor-pointer",
                    activeTab === tab 
                      ? "bg-white text-black" 
                      : "text-muted-foreground hover:text-white hover:bg-white/5"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative group min-w-[250px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 group-hover:text-white/60 transition-colors" />
                <input 
                  type="text"
                  placeholder="BUSCAR TRANSAÇÃO..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-[10px] font-black tracking-widest text-white placeholder:text-muted-foreground/20 focus:outline-none focus:border-white/20 transition-all uppercase"
                />
              </div>
              
              <button 
                onClick={() => toast.info('Abrindo filtro de período...')}
                className="flex items-center gap-2 bg-background border border-white/5 px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-white hover:bg-white/5 transition-all border-dashed cursor-pointer"
              >
                <Calendar className="w-4 h-4" /> Período
              </button>
              
              <button 
                onClick={() => toast.info('Abrindo filtros avançados...')}
                className="flex items-center justify-center bg-background border border-white/5 w-12 h-12 rounded-2xl text-muted-foreground hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              >
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.02]">
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground border-b border-white/5">Data / Hora</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground border-b border-white/5">Descrição</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground border-b border-white/5">Tipo</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground border-b border-white/5 text-right">Valor</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground border-b border-white/5 text-center">Situação</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground border-b border-white/5 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <Loader2 className="h-8 w-8 text-primary animate-spin" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Carregando movimentações...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-8 py-20 text-center text-muted-foreground">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em]">Nenhuma movimentação encontrada.</span>
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((t) => (
                    <tr key={t.id} className="group hover:bg-white/[0.01] transition-colors">
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-white/90">
                            {format(new Date(t.created_at), 'dd MMM, yyyy', { locale: ptBR })}
                          </span>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">
                            {format(new Date(t.created_at), 'HH:mm')}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="text-sm font-black uppercase tracking-tighter text-white/80">{t.description || 'Sem descrição'}</span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center border",
                            t.type.includes('in') ? "bg-green-500/10 border-green-500/20" : "bg-red-500/10 border-red-500/20"
                          )}>
                            {t.type.includes('in') ? (
                              <ArrowDownLeft className={cn("w-4 h-4", t.type.includes('in') ? "text-green-500" : "text-red-500")} />
                            ) : (
                              <ArrowUpRight className={cn("w-4 h-4", t.type.includes('in') ? "text-green-500" : "text-red-500")} />
                            )}
                          </div>
                          <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">{getTypeLabel(t.type)}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <span className={cn(
                          "text-sm font-black",
                          t.type.includes('in') ? "text-green-500" : "text-white"
                        )}>
                          {t.type.includes('in') ? '+' : '-'} R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex justify-center">
                          <span className={cn(
                            "px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.1em] border",
                            t.status === 'completed' ? "bg-green-500/10 text-green-500 border-green-500/20" : 
                            t.status === 'pending' ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" : 
                            "bg-red-500/10 text-red-500 border-red-500/20"
                          )}>
                            {getStatusLabel(t.status)}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-center">
                        <button className="text-muted-foreground hover:text-white transition-colors">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {!loading && filteredTransactions.length > 0 && (
            <div className="p-8 border-t border-white/5 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Mostrando {filteredTransactions.length} movimentações</span>
              <div className="flex items-center gap-4">
                <button className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-muted-foreground hover:text-white transition-all border border-white/5 disabled:opacity-30" disabled>
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2">
                  <button className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center text-[10px] font-black">1</button>
                </div>
                <button className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-muted-foreground hover:text-white transition-all border border-white/5 disabled:opacity-30" disabled>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
