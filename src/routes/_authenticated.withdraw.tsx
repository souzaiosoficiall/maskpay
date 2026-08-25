import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Wallet, ArrowRight, Loader2, Lock } from 'lucide-react';
import { useServerFn } from '@tanstack/react-start';
import { requestPixWithdrawal, getPlatformFees } from '@/lib/payments.functions';
import { getProfile, updateTransactionPassword } from '@/lib/settings.functions';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useSessionReady } from '@/hooks/useSessionReady';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";


export const Route = createFileRoute('/_authenticated/withdraw')({
  component: WithdrawPage,
});


function WithdrawPage() {
  const [amount, setAmount] = useState('');
  const [pixType, setPixType] = useState('cpf');
  const [pixKey, setPixKey] = useState('');
  const [transactionPassword, setTransactionPassword] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const sessionReady = useSessionReady();
  const fetchProfile = useServerFn(getProfile);
  const fetchFees = useServerFn(getPlatformFees);

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => fetchProfile({}),
    enabled: sessionReady,
  });

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

  const withdrawFn = useServerFn(requestPixWithdrawal);

  const { data: fees } = useQuery({
    queryKey: ['platform-fees'],
    queryFn: () => fetchFees({}),
    enabled: sessionReady
  });

  const calculatedFee = useMemo(() => {
    if (!fees || !amount || isNaN(parseFloat(amount))) return 0;
    return Number(fees.withdrawal.fixed || 0);
  }, [fees, amount]);

  // Recipient receives the full amount; fee is extra debit from the user
  const payoutAmount = useMemo(() => {
    if (!amount || isNaN(parseFloat(amount))) return 0;
    return parseFloat(amount);
  }, [amount]);

  const totalDebit = useMemo(() => {
    return Math.round((payoutAmount + calculatedFee) * 100) / 100;
  }, [payoutAmount, calculatedFee]);

  const netAmount = payoutAmount; // compat for any leftover refs



  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Informe um valor válido para o saque.');
      return;
    }

    if (!pixKey) {
      toast.error('Informe a chave Pix de destino.');
      return;
    }

    if ((wallet?.balance || 0) < totalDebit) {
      toast.error('Saldo insuficiente.');
      return;
    }

    setShowConfirm(true);
  };

  const handleConfirmWithdraw = async () => {
    if (transactionPassword.length !== 4) {
      toast.error('Informe sua senha de 4 dígitos.');
      return;
    }

    setLoading(true);
    try {
      await withdrawFn({
        data: {
          amount: parseFloat(amount),
          pixKeyType: pixType,
          pixKey: pixKey,
          transactionPassword
        }
      });
      
      toast.success('Solicitação de retirada enviada com sucesso!');
      setAmount('');
      setPixKey('');
      setTransactionPassword('');
      setShowConfirm(false);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao processar a retirada.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-10 pb-16 font-sans">
      <div>
        <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Retirada |</h1>
        <p className="text-muted-foreground font-semibold text-base">Transfira o saldo da sua conta para sua chave Pix.</p>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Saldo Disponível */}
        <Card className="border-white/5 bg-background border-2 rounded-[2rem] p-2">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <span className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">Saldo disponível</span>
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/5">
              <Wallet className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black tracking-tighter">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(wallet?.balance || 0)}
            </div>
          </CardContent>
        </Card>

        {/* Formulário de Retirada */}
        <Card className="border-white/5 bg-background border-2 rounded-[2.5rem] p-4 md:p-8">
          <form onSubmit={handlePreSubmit} className="space-y-8">
            <div className="space-y-6">
              <h2 className="text-xl font-black uppercase tracking-tight">Dados da Transferência</h2>
              <p className="text-sm text-muted-foreground font-bold uppercase tracking-widest">Preencha sua chave pix para saque de saldo</p>


              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pixKey" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Chave Pix</Label>
                  <Input 
                    id="pixKey"
                    value={pixKey}
                    onChange={(e) => setPixKey(e.target.value)}
                    placeholder="123.456.789-00"
                    className="bg-white/5 border-white/10 rounded-2xl h-14 font-bold placeholder:text-muted-foreground/20 focus:border-white/20 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Valor (R$)</Label>
                  <Input 
                    id="amount"
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="R$ 0,00"
                           className="bg-white/5 border-white/10 rounded-2xl h-14 font-bold placeholder:text-muted-foreground/20 focus:border-white/20 transition-all"
                         />
                       </div>

                       {parseFloat(amount) > 0 && (
                         <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2">
                           <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                             <span>Taxa de saque</span>
                             <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculatedFee)}</span>
                           </div>
                           <div className="flex justify-between text-xs font-black uppercase tracking-widest text-white">
                             <span>Valor a receber</span>
                             <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalDebit)}</span>
                           </div>
                         </div>
                       )}
                     </div>
                   </div>

            <Button 
              type="submit" 
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-black h-16 rounded-2xl text-sm font-black uppercase tracking-[0.2em] shadow-lg shadow-primary/20 transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...
                </>
              ) : (
                <>Transferir <ArrowRight className="ml-2 h-4 w-4" /></>
              )}
            </Button>
          </form>
        </Card>
      </div>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="bg-background border-white/5 rounded-[2.5rem] p-8 max-w-md">
          <DialogHeader className="space-y-4">
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-center">Confirmar Saque</DialogTitle>
            <DialogDescription className="text-sm font-bold text-muted-foreground uppercase tracking-widest text-center leading-relaxed">
              Confirme os dados da sua retirada. O valor será enviado para a chave Pix informada.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 my-8">
            <div className="p-6 rounded-[2rem] bg-white/5 border border-white/5 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Valor Bruto</span>
                <span className="text-lg font-black text-white">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(amount) || 0)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Taxa</span>
                <span className="text-lg font-black text-red-500">-{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculatedFee)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Destinatário recebe</span>
                <span className="text-lg font-black text-green-500">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(payoutAmount)}</span>
              </div>
              <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total debitado</span>
                <span className="text-xl font-black text-white">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalDebit)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Saldo após o saque</span>
                <span className="text-lg font-black text-white">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.max(0, (wallet?.balance || 0) - totalDebit))}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="txPass" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Senha de Transação (4 dígitos)</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  id="txPass"
                  type="password"
                  maxLength={4}
                  value={transactionPassword}
                  onChange={(e) => setTransactionPassword(e.target.value.replace(/\D/g, ''))}
                  placeholder="****"
                  className="bg-white/5 border-white/10 rounded-2xl h-14 pl-12 font-black text-xl tracking-[0.5em] focus:border-white/20 transition-all text-center"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col gap-3 sm:flex-col">
            <Button 
              onClick={handleConfirmWithdraw}
              disabled={loading || transactionPassword.length !== 4}
              className="w-full bg-primary hover:bg-primary/90 text-black h-16 rounded-2xl text-sm font-black uppercase tracking-[0.2em] transition-all"
            >
              {loading ? <Loader2 className="animate-spin" /> : "Confirmar e Sacar"}
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => setShowConfirm(false)}
              className="w-full text-muted-foreground hover:text-white text-[10px] font-black uppercase tracking-widest transition-all"
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}