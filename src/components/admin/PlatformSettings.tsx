import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { getPlatformFees } from '@/lib/payments.functions';
import { updatePlatformFees } from '@/lib/admin-system.functions';
import { resetSystem } from '@/lib/admin-reset.functions';
import { Settings, Save, Loader2, Percent, DollarSign, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function PlatformSettings() {
  const queryClient = useQueryClient();
  const fetchFees = useServerFn(getPlatformFees);
  const doUpdateFees = useServerFn(updatePlatformFees);
  const doResetSystem = useServerFn(resetSystem);

  const { data: fees, isLoading } = useQuery({
    queryKey: ['platform-fees'],
    queryFn: () => fetchFees({}),
  });

  const [depositPercent, setDepositPercent] = useState('2.49');
  const [depositFixed, setDepositFixed] = useState('0.40');
  const [withdrawalFixed, setWithdrawalFixed] = useState('0.80');

  useEffect(() => {
    if (fees) {
      setDepositPercent(fees.deposit.percentage.toString());
      setDepositFixed(fees.deposit.fixed.toString());
      setWithdrawalFixed(fees.withdrawal.fixed.toString());
    }
  }, [fees]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => doUpdateFees({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-fees'] });
      toast.success('Configurações atualizadas com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao atualizar configurações.');
    }
  });

  const resetMutation = useMutation({
    mutationFn: () => doResetSystem({}),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries();
      toast.success(`Sistema resetado! ${data.deletedCount} usuários removidos.`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao resetar o sistema.');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      pix_deposit_fees: {
        percentage: parseFloat(depositPercent),
        fixed: parseFloat(depositFixed)
      },
      pix_withdrawal_fees: {
        fixed: parseFloat(withdrawalFixed)
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="border-2 border-white/5 bg-background rounded-[2.5rem] p-6">
          <CardHeader className="flex flex-row items-center gap-4 pb-8">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <Percent className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-black uppercase tracking-tighter">Taxas de Depósito</h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Configuração de taxas para entradas via Pix</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Porcentagem (%)</Label>
              <Input 
                type="number" 
                step="0.01" 
                value={depositPercent}
                onChange={(e) => setDepositPercent(e.target.value)}
                className="bg-white/5 border-white/10 rounded-2xl h-14 font-bold"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Valor Fixo (R$)</Label>
              <Input 
                type="number" 
                step="0.01" 
                value={depositFixed}
                onChange={(e) => setDepositFixed(e.target.value)}
                className="bg-white/5 border-white/10 rounded-2xl h-14 font-bold"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-white/5 bg-background rounded-[2.5rem] p-6">
          <CardHeader className="flex flex-row items-center gap-4 pb-8">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
              <DollarSign className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <h3 className="text-xl font-black uppercase tracking-tighter">Taxas de Saque</h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Configuração de taxas para retiradas via Pix</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Valor Fixo (R$)</Label>
              <Input 
                type="number" 
                step="0.01" 
                value={withdrawalFixed}
                onChange={(e) => setWithdrawalFixed(e.target.value)}
                className="bg-white/5 border-white/10 rounded-2xl h-14 font-bold"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center gap-6 pt-10 border-t border-white/5">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              variant="outline"
              className="border-red-500/20 text-red-500 hover:bg-red-500/10 hover:text-red-500 px-10 h-16 rounded-2xl text-sm font-black uppercase tracking-[0.2em] transition-all w-full md:w-auto"
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", resetMutation.isPending && "animate-spin")} />
              Resetar Sistema
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-card border-white/10 text-white rounded-[2rem]">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                <AlertTriangle className="text-red-500 w-6 h-6" /> Atenção Máxima
              </AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground font-medium">
                Esta ação irá **apagar permanentemente** todos os usuários, transações, logs e notificações do banco de dados, exceto a conta do administrador proprietário. O saldo da sua carteira também será resetado para zero.
                <br /><br />
                Tem certeza que deseja prosseguir com a limpeza total?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel className="bg-transparent border-white/10 text-white hover:bg-white/5 rounded-xl h-12 text-[10px] font-black uppercase tracking-widest">
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => resetMutation.mutate()}
                className="bg-red-500 text-white hover:bg-red-600 rounded-xl h-12 text-[10px] font-black uppercase tracking-widest"
              >
                Confirmar Limpeza Total
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Button 
          onClick={handleSubmit}
          disabled={updateMutation.isPending}
          className="bg-white text-black hover:bg-white/90 px-10 h-16 rounded-2xl text-sm font-black uppercase tracking-[0.2em] transition-all w-full md:w-auto"
        >
          {updateMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Salvar Alterações
        </Button>
      </div>
    </motion.div>
  );
}
