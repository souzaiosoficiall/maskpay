import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Wallet, ArrowRight, Loader2, CheckCircle2, User, Mail, Search } from 'lucide-react';
import { useServerFn } from '@tanstack/react-start';
import { useQuery } from '@tanstack/react-query';
import { useSessionReady } from '@/hooks/useSessionReady';
import { getProfile } from '@/lib/settings.functions';
import { findRecipientByEmail, executeInternalTransfer } from '@/lib/transfer.functions';
import { motion, AnimatePresence } from 'framer-motion';
import maskPlatformAsset from "@/lib/mask-asset";
import { formatAppError } from '@/lib/utils';

export const Route = createFileRoute('/_authenticated/transfer')({
  component: TransferPage,
});

function TransferPage() {
  const [step, setStep] = useState(1); // 1: Find recipient, 2: Amount & Summary, 3: Success
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [recipient, setRecipient] = useState<{ walletId: string, fullName: string, email: string } | null>(null);
  const navigate = useNavigate();

  const sessionReady = useSessionReady();
  const fetchProfile = useServerFn(getProfile);

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
        .select('id')
        .eq('user_id', profile!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!profile?.id,
  });

  const senderWalletId = wallet?.id;

  const findUserFn = useServerFn(findRecipientByEmail);
  const transferFn = useServerFn(executeInternalTransfer);

  const handleFindUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      const result = await findUserFn({ data: email });
      setRecipient(result);
      setStep(2);
    } catch (error: any) {
      toast.error(formatAppError(error, 'Usuário não encontrado.'));
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient || !amount) return;

    setLoading(true);
    try {
      await transferFn({
        data: {
          senderWalletId: senderWalletId!,
          receiverWalletId: recipient.walletId,
          amount: parseFloat(amount),
          description: description || 'Transferência Interna MaskPay'
        }
      });
      setStep(3);
      toast.success('Transferência realizada com sucesso!');
    } catch (error: any) {
      toast.error(formatAppError(error, 'Erro ao realizar transferência.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-10 pb-16 font-sans relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Transferência Interna |</h1>
        <p className="text-muted-foreground font-semibold text-base">Envie valores instantaneamente para outros usuários MaskPay.</p>
      </motion.div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.4 }}
          >
            <Card className="border-white/5 bg-background border-2 rounded-[2.5rem] p-4 md:p-8">
              <form onSubmit={handleFindUser} className="space-y-8">
                <div className="space-y-6">
                  <h2 className="text-xl font-black uppercase tracking-tight">Destinatário</h2>
                  <p className="text-sm text-muted-foreground font-bold uppercase tracking-widest">Informe o e-mail da conta que receberá o valor</p>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">E-mail do Destinatário</Label>
                      <div className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                        <Input 
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="exemplo@email.com"
                          className="bg-white/5 border-white/10 rounded-2xl h-14 pl-12 font-bold placeholder:text-muted-foreground/20 focus:border-white/20 transition-all"
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-16 rounded-2xl text-sm font-black uppercase tracking-[0.2em] shadow-lg shadow-primary/20 transition-all cursor-pointer"
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <>Continuar <ArrowRight className="ml-2 h-4 w-4" /></>
                  )}
                </Button>
              </form>
            </Card>
          </motion.div>
        )}

        {step === 2 && recipient && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.4 }}
          >
            <Card className="border-white/5 bg-background border-2 rounded-[2.5rem] p-4 md:p-8">
              <form onSubmit={handleTransfer} className="space-y-8">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black uppercase tracking-tight">Confirmar Transferência</h2>
                    <Button 
                      variant="ghost" 
                      onClick={() => setStep(1)} 
                      className="text-[10px] font-black uppercase tracking-widest text-muted-foreground"
                    >
                      Alterar Destinatário
                    </Button>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 overflow-hidden p-2 group">
                        <img src={maskPlatformAsset.url} alt="User" className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Recebedor</p>
                        <p className="text-lg font-black uppercase tracking-tight">{recipient.fullName}</p>
                        <p className="text-xs text-muted-foreground/60">{recipient.email}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="amount" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Valor a enviar (R$)</Label>
                      <Input 
                        id="amount"
                        type="number"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="R$ 0,00"
                        className="bg-white/5 border-white/10 rounded-2xl h-14 font-bold placeholder:text-muted-foreground/20 focus:border-white/20 transition-all"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Descrição (Opcional)</Label>
                      <Input 
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Ex: Pagamento serviço"
                        className="bg-white/5 border-white/10 rounded-2xl h-14 font-bold placeholder:text-muted-foreground/20 focus:border-white/20 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                    <div className="flex justify-between items-center mb-6 px-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Taxa de operação</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-green-500">Grátis</span>
                    </div>
                    <Button 
                    type="submit" 
                    disabled={loading || !senderWalletId}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-16 rounded-2xl text-sm font-black uppercase tracking-[0.2em] shadow-lg shadow-primary/20 transition-all cursor-pointer"
                    >
                    {loading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <>Confirmar e Enviar <CheckCircle2 className="ml-2 h-4 w-4" /></>
                    )}
                    </Button>
                </div>
              </form>
            </Card>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="border-white/5 bg-background border-2 rounded-[2.5rem] p-8 md:p-12 text-center">
              <div className="flex flex-col items-center space-y-6">
                <div className="w-20 h-20 rounded-[2rem] bg-green-500/10 flex items-center justify-center border border-green-500/20">
                  <CheckCircle2 className="h-10 w-10 text-green-500" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-black uppercase tracking-tighter">Transferência Concluída</h2>
                  <p className="text-muted-foreground font-semibold">O valor de R$ {parseFloat(amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} foi enviado para {recipient?.fullName}.</p>
                </div>
                
                <div className="w-full pt-8 space-y-3">
                  <Button 
                    onClick={() => navigate({ to: '/extract' })}
                    className="w-full bg-white text-black hover:bg-white/90 h-16 rounded-2xl text-sm font-black uppercase tracking-[0.2em] transition-all cursor-pointer"
                  >
                    Ver Comprovante no Extrato
                  </Button>
                  <Button 
                    variant="ghost"
                    onClick={() => {
                        setStep(1);
                        setEmail('');
                        setAmount('');
                        setRecipient(null);
                    }}
                    className="w-full text-muted-foreground hover:text-white text-[10px] font-black uppercase tracking-widest cursor-pointer"
                  >
                    Nova Transferência
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
