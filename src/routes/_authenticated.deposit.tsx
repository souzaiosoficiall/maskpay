import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { Wallet, ArrowRight, Loader2, Copy, CheckCircle2, QrCode } from 'lucide-react';
import { useServerFn } from '@tanstack/react-start';
import { generatePixDeposit, getPlatformFees, syncPendingDeposit } from '@/lib/payments.functions';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import { getProfile } from '@/lib/settings.functions';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useSessionReady } from '@/hooks/useSessionReady';
import { formatAppError } from '@/lib/utils';


export const Route = createFileRoute('/_authenticated/deposit')({
  component: DepositPage,
});


function DepositPage() {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [pixData, setPixData] = useState<{ qrCode: string; copyPaste: string; fee: number; net: number; transactionId?: string } | null>(null);
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

  const depositFn = useServerFn(generatePixDeposit);
  const pollSync = useServerFn(syncPendingDeposit);

  const { data: fees } = useQuery({
    queryKey: ['platform-fees'],
    queryFn: () => fetchFees({}),
    enabled: sessionReady
  });

  const calculatedFee = useMemo(() => {
    if (!fees || !amount || isNaN(parseFloat(amount))) return 0;
    const val = parseFloat(amount);
    const percentage = fees.deposit.percentage || 0;
    const fixed = fees.deposit.fixed || 0;
    return (val * percentage) / 100 + fixed;
  }, [fees, amount]);

  const netAmount = useMemo(() => {
    if (!amount || isNaN(parseFloat(amount))) return 0;
    return Math.max(0, parseFloat(amount) - calculatedFee);
  }, [amount, calculatedFee]);



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Informe um valor válido para o depósito.');
      return;
    }

    setLoading(true);
    try {
      const result = await depositFn({
        data: {
          amount: parseFloat(amount)
        }
      });
      
      setPixData({
        qrCode: result.qrCode,
        copyPaste: result.copyPaste,
        fee: result.fee,
        net: result.net,
        transactionId: result.transactionId,
      });
      
      toast.success('Pagamento gerado com sucesso!');
    } catch (error: any) {
      toast.error(formatAppError(error, 'Erro ao gerar o pagamento.'));
    } finally {
      setLoading(false);
    }
  };

  const copyPixCode = useCallback(() => {
    if (pixData) {
      navigator.clipboard.writeText(pixData.copyPaste);
      toast.success('Pix copiado!');
    }
  }, [pixData]);


  // Fallback: if webhook fails, poll acquirer and credit when paid
  useEffect(() => {
    if (!pixData?.transactionId || !sessionReady) return;
    const syncFn = syncPendingDeposit; // bound below via useServerFn
    let stopped = false;
    const tick = async () => {
      try {
        const res = await pollSync({ data: { transactionId: pixData.transactionId! } });
        if (stopped) return;
        if (res?.status === 'completed' && !res.alreadyProcessed) {
          toast.success(
            res.credited
              ? `Pagamento confirmado! +${Number(res.credited).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} creditados.`
              : 'Pagamento confirmado!',
          );
          setPixData(null);
        } else if (res?.status === 'completed' && res.alreadyProcessed) {
          toast.success('Pagamento já estava confirmado.');
          setPixData(null);
        }
      } catch (e) {
        // silent — webhook may still arrive
      }
    };
    tick();
    const id = setInterval(tick, 10_000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [pixData?.transactionId, sessionReady]);

  return (
    <div className="max-w-3xl mx-auto space-y-6 md:space-y-10 pb-12 md:pb-16 font-sans relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-2xl md:text-4xl font-black tracking-tighter uppercase mb-2">Adicionar valor |</h1>
        <p className="text-muted-foreground font-semibold text-base">Adicione saldo à sua conta via Pix de forma instantânea.</p>
      </motion.div>

      <div className="grid grid-cols-1 gap-8">
        {/* Saldo Atual */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card className="border-white/5 bg-background border-2 rounded-2xl md:rounded-[2rem] p-2">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <span className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">Saldo atual</span>
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
        </motion.div>

        {/* Formulário de Depósito */}
        <AnimatePresence mode="wait">
          {!pixData ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.4 }}
            >
              <Card className="border-white/5 bg-background border-2 rounded-2xl md:rounded-[2.5rem] p-3 md:p-8">
                <form onSubmit={handleSubmit} className="space-y-8">
                  <div className="space-y-6">
                    <h2 className="text-xl font-black uppercase tracking-tight">Dados do Depósito</h2>
                    <p className="text-sm text-muted-foreground font-bold uppercase tracking-widest">Informe o valor que deseja adicionar ao seu saldo</p>

                    <div className="space-y-4">
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
                        <motion.div 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2"
                        >
                          <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            <span>Taxa (descontada do depósito)</span>
                            <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculatedFee)}</span>
                          </div>
                          <div className="flex justify-between text-xs font-black uppercase tracking-widest text-white">
                            <span>Você recebe na carteira</span>
                            <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(netAmount)}</span>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-16 rounded-2xl text-sm font-black uppercase tracking-[0.2em] shadow-lg shadow-primary/20 transition-all cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando...
                      </>
                    ) : (
                      <>Gerar Pagamento <ArrowRight className="ml-2 h-4 w-4" /></>
                    )}
                  </Button>
                </form>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="pix"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.5 }}
            >
              <Card className="border-white/5 bg-background border-2 rounded-2xl md:rounded-[2.5rem] p-3 md:p-8">
                <div className="flex flex-col items-center space-y-8">
                  <div className="text-center space-y-2">
                    <h2 className="text-xl font-black uppercase tracking-tight">Pagamento Gerado</h2>
                    <p className="text-sm text-muted-foreground font-bold uppercase tracking-widest">Escaneie o QR Code ou copie o código Pix abaixo</p>
                    {pixData && (
                      <div className="mt-4 p-4 rounded-2xl bg-white/5 border border-white/5 inline-block mx-auto">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Valor Total</p>
                        <p className="text-2xl font-black text-white">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pixData.fee + pixData.net)}</p>
                      </div>
                    )}
                  </div>

                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, type: 'spring' }}
                    className="bg-white p-6 rounded-[2rem] shadow-[0_0_50px_rgba(255,255,255,0.05)] border-8 border-white/5"
                  >
                    {pixData.qrCode && pixData.qrCode.startsWith('00020') ? (
                      <QRCodeSVG 
                        value={pixData.qrCode} 
                        size={180}
                        level="M"
                        includeMargin={false}
                      />
                    ) : (
                      <div className="w-[180px] h-[180px] flex items-center justify-center text-xs text-black font-bold text-center p-4">
                        Use o código copia e cola abaixo
                      </div>
                    )}
                  </motion.div>

                  <div className="w-full space-y-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Código Pix Copia e Cola</Label>
                      <div className="relative group">
                        <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-mono text-[10px] break-all pr-12 text-muted-foreground/60">
                          {pixData.copyPaste}
                        </div>
                        <button 
                          onClick={copyPixCode}
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors text-white cursor-pointer"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <Button 
                      onClick={copyPixCode}
                      className="w-full bg-white text-black hover:bg-white/90 h-16 rounded-2xl text-sm font-black uppercase tracking-[0.2em] transition-all cursor-pointer"
                    >
                      <Copy className="mr-2 h-4 w-4" /> Copiar Pix
                    </Button>
                    
                    <Button 
                      variant="ghost"
                      onClick={() => setPixData(null)}
                      className="w-full text-muted-foreground hover:text-white text-[10px] font-black uppercase tracking-widest cursor-pointer"
                    >
                      Gerar novo pagamento
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 text-green-500 bg-green-500/10 px-6 py-3 rounded-full border border-green-500/20">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Aguardando pagamento...</span>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}