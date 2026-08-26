import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent } from '@/components/ui/card';
import { User, Shield, Lock, CreditCard, ChevronRight, Save, Loader2, KeyRound, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { getProfile, updateAccessPassword, updateTransactionPassword } from '@/lib/settings.functions';
import { useSessionReady } from '@/hooks/useSessionReady';
import { maskEmail, maskPhone, maskDocument, getInitials, cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import maskPlatformAsset from "@/lib/mask-asset";
import { NotificationDiagnostics } from '@/components/NotificationDiagnostics';
import { formatAppError } from '@/lib/utils';

export const Route = createFileRoute('/_authenticated/settings')({
  component: SettingsPage,
});

function SettingsPage() {
  const sessionReady = useSessionReady();
  const queryClient = useQueryClient();
  const fetchProfile = useServerFn(getProfile);
  const doUpdateAccessPassword = useServerFn(updateAccessPassword);
  const doUpdateTransactionPassword = useServerFn(updateTransactionPassword);

  const [compactLayout, setCompactLayout] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('maskpay-layout-compact') === '1';
      setCompactLayout(saved);
      document.documentElement.classList.toggle('layout-compact', saved);
    } catch {}
  }, []);

  const toggleCompactLayout = (on: boolean) => {
    setCompactLayout(on);
    try {
      window.localStorage.setItem('maskpay-layout-compact', on ? '1' : '0');
      document.documentElement.classList.toggle('layout-compact', on);
    } catch {}
  };


  const [activeSection, setActiveSection] = useState<'main' | 'security' | 'notifications'>('main');
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);

  // Form states for modals
  const [accessForm, setAccessForm] = useState({ current: '', new: '', confirm: '' });
  const [transactionForm, setTransactionForm] = useState({ new: '', confirm: '' });

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => fetchProfile({}),
    enabled: sessionReady,
  });

  const accessMutation = useMutation({
    mutationFn: (data: typeof accessForm) => doUpdateAccessPassword({
      data: {
        currentPassword: data.current,
        newPassword: data.new,
        confirmPassword: data.confirm
      }
    }),
    onSuccess: () => {
      toast.success('Senha de acesso alterada com sucesso!');
      setIsAccessModalOpen(false);
      setAccessForm({ current: '', new: '', confirm: '' });
    },
    onError: (err: any) => {
      toast.error(formatAppError(err, 'Erro ao alterar senha de acesso.'));
    }
  });

  const transactionMutation = useMutation({
    mutationFn: (data: typeof transactionForm) => doUpdateTransactionPassword({
      data: {
        newPassword: data.new,
        confirmPassword: data.confirm
      }
    }),
    onSuccess: () => {
      toast.success('Senha de transação configurada com sucesso!');
      setIsTransactionModalOpen(false);
      setTransactionForm({ new: '', confirm: '' });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err: any) => {
      toast.error(formatAppError(err, 'Erro ao configurar senha de transação.'));
    }
  });

  if (isLoading || !sessionReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Carregando perfil...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-16 font-sans relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Configurações</h1>
        <p className="text-muted-foreground font-semibold text-base">Gerencie as preferências da sua conta e segurança.</p>
      </motion.div>

      {/* Profile Top Section */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Card className="border-white/5 bg-background border-2 rounded-[2.5rem] p-6 md:p-10">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <Avatar className="w-24 h-24 rounded-[2.5rem] border-2 border-white/10 ring-8 ring-white/[0.02] bg-white/5 p-4 group">
              <AvatarImage src={maskPlatformAsset.url} className="object-contain group-hover:scale-110 transition-transform duration-300" />
              <AvatarFallback className="bg-white/5 text-3xl font-black text-white uppercase">
                {getInitials(profile?.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="text-center md:text-left space-y-2">
              <h2 className="text-3xl font-black uppercase tracking-tighter">
                {(profile?.full_name || '').trim() || 'Usuário'}
              </h2>
              <div className="flex flex-wrap justify-center md:justify-start gap-3">
                <span className="px-4 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] font-black uppercase tracking-widest">
                  Conta {profile?.verification_status === 'verified' ? 'Verificada' : 'Pendente'}
                </span>
                <span className="px-4 py-1.5 rounded-full bg-white/5 text-muted-foreground border border-white/10 text-[10px] font-black uppercase tracking-widest">
                  ID: #{profile?.id.substring(0, 8)}
                </span>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      <AnimatePresence mode="wait">
        {activeSection === 'main' ? (
          <motion.div
            key="main"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-8"
          >
            {/* Informações Pessoais */}
            <Card className="border-white/5 bg-background border-2 rounded-[2.5rem] p-4 md:p-10">
              <div className="flex items-center gap-4 mb-10">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tighter">Informações Pessoais</h3>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Dados básicos da sua conta</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">E-mail</Label>
                  <div className="bg-white/5 border border-white/10 rounded-2xl h-16 flex items-center px-6 font-bold text-white break-all">
                    {profile?.email ? maskEmail(profile.email) : 'Não informado'}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">WhatsApp / Telefone</Label>
                  <div className="bg-white/5 border border-white/10 rounded-2xl h-16 flex items-center px-6 font-bold text-white">
                    {profile?.phone?.trim() ? maskPhone(profile.phone) : 'Não informado'}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">CPF / CNPJ</Label>
                  <div className="bg-white/5 border border-white/10 rounded-2xl h-16 flex items-center px-6 font-bold text-white">
                    {profile?.document?.trim() ? maskDocument(profile.document) : 'Não informado'}
                  </div>
                </div>
              </div>
              
              <div className="mt-10 p-6 rounded-[2rem] bg-primary/5 border border-primary/10">
                <p className="text-[9px] font-bold text-primary uppercase tracking-widest leading-relaxed">
                  * Por motivos de segurança, a alteração de dados sensíveis deve ser solicitada via ticket de suporte.
                </p>
              </div>
            </Card>


            {/* Layout compacto — fica em Configurações (geral), não em Notificações */}
            <Card className="border-white/5 bg-background border-2 rounded-[2.5rem] p-6 md:p-8">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <h3 className="text-lg font-black uppercase tracking-tighter">Layout compacto</h3>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-relaxed">
                    Reduz botões, espaçamentos e tipografia — ideal para celular.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleCompactLayout(!compactLayout)}
                  className={cn(
                    "relative h-8 w-14 rounded-full transition-colors shrink-0",
                    compactLayout ? "bg-white" : "bg-white/10"
                  )}
                  aria-label="Alternar layout compacto"
                >
                  <span
                    className={cn(
                      "absolute top-1 left-1 h-6 w-6 rounded-full transition-transform",
                      compactLayout ? "translate-x-6 bg-black" : "translate-x-0 bg-white/80"
                    )}
                  />
                </button>
              </div>
            </Card>

            {/* Notificações Menu Item */}

            <button 
              onClick={() => setActiveSection('notifications')}
              className="w-full text-left group"
            >
              <Card className="border-white/5 bg-background border-2 rounded-[2.5rem] p-8 transition-all group-hover:border-white/20 group-hover:bg-white/[0.02]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-[1.5rem] bg-white/5 flex items-center justify-center border border-white/5 group-hover:scale-110 transition-transform">
                      <Bell className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black uppercase tracking-tighter">Notificações</h3>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Alertas push e avisos do celular</p>
                    </div>
                  </div>
                  <ChevronRight className="w-6 h-6 text-muted-foreground/20 group-hover:text-white transition-colors" />
                </div>
              </Card>
            </button>

            {/* Segurança Menu Item */}
            <button 
              onClick={() => setActiveSection('security')}
              className="w-full text-left group"
            >
              <Card className="border-white/5 bg-background border-2 rounded-[2.5rem] p-8 transition-all group-hover:border-white/20 group-hover:bg-white/[0.02]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-[1.5rem] bg-white/5 flex items-center justify-center border border-white/5 group-hover:scale-110 transition-transform">
                      <Shield className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black uppercase tracking-tighter">Segurança</h3>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Senhas, MFA e Proteção</p>
                    </div>
                  </div>
                  <ChevronRight className="w-6 h-6 text-muted-foreground/20 group-hover:text-white transition-colors" />
                </div>
              </Card>
            </button>
          </motion.div>
        ) : activeSection === 'notifications' ? (
          <motion.div
            key="notifications"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="flex items-center justify-between mb-4">
              <Button 
                variant="ghost" 
                onClick={() => setActiveSection('main')}
                className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-white transition-all p-0"
              >
                ← Voltar para Geral
              </Button>
            </div>
            
            <NotificationDiagnostics />
          </motion.div>
        ) : (
          <motion.div
            key="security"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="flex items-center justify-between mb-4">
              <Button 
                variant="ghost" 
                onClick={() => setActiveSection('main')}
                className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-white transition-all p-0"
              >
                ← Voltar para Geral
              </Button>
            </div>

            <Card className="border-white/5 bg-background border-2 rounded-[2.5rem] p-4 md:p-10">
              <div className="flex items-center gap-4 mb-10">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tighter">Segurança da Conta</h3>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Gerencie suas chaves de acesso</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Access Password */}
                <button 
                  onClick={() => setIsAccessModalOpen(true)}
                  className="w-full group"
                >
                  <div className="flex items-center justify-between p-8 rounded-[2rem] bg-white/5 border border-white/5 hover:border-white/20 hover:bg-white/[0.08] transition-all text-left">
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5">
                        <Lock className="w-5 h-5 text-muted-foreground group-hover:text-white transition-colors" />
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-white">Senha de Acesso</p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight mt-1">Utilizada para entrar na conta (mínimo 6 caracteres)</p>
                      </div>
                    </div>
                    <Button variant="ghost" className="rounded-xl h-10 text-[9px] font-black uppercase tracking-widest border border-white/10 group-hover:bg-white group-hover:text-black">Alterar</Button>
                  </div>
                </button>

                {/* Transaction Password */}
                <button 
                  onClick={() => setIsTransactionModalOpen(true)}
                  className="w-full group"
                >
                  <div className="flex items-center justify-between p-8 rounded-[2rem] bg-white/5 border border-white/5 hover:border-white/20 hover:bg-white/[0.08] transition-all text-left">
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5">
                        <KeyRound className="w-5 h-5 text-muted-foreground group-hover:text-white transition-colors" />
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-white">Senha de Transação</p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight mt-1">Confirmar operações sensíveis (4 dígitos)</p>
                      </div>
                    </div>
                    <Button variant="ghost" className="rounded-xl h-10 text-[9px] font-black uppercase tracking-widest border border-white/10 group-hover:bg-white group-hover:text-black">
                      {profile?.transaction_password_hash ? 'Alterar' : 'Configurar'}
                    </Button>
                  </div>
                </button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <Dialog open={isAccessModalOpen} onOpenChange={setIsAccessModalOpen}>
        <DialogContent className="bg-background border-white/10 rounded-[2.5rem] max-w-md p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter">Alterar Senha de Acesso</DialogTitle>
            <DialogDescription className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-2">
              A senha deve conter no mínimo 6 caracteres.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Senha Atual</Label>
              <Input 
                type="password" 
                value={accessForm.current}
                onChange={(e) => setAccessForm({...accessForm, current: e.target.value})}
                className="bg-white/5 border-white/10 rounded-2xl h-14 font-bold px-5"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Nova Senha (mínimo 6 caracteres)</Label>
              <Input 
                type="password" 
                value={accessForm.new}
                onChange={(e) => setAccessForm({...accessForm, new: e.target.value})}
                className="bg-white/5 border-white/10 rounded-2xl h-14 font-bold px-5"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Confirmar Nova Senha</Label>
              <Input 
                type="password" 
                value={accessForm.confirm}
                onChange={(e) => setAccessForm({...accessForm, confirm: e.target.value})}
                className="bg-white/5 border-white/10 rounded-2xl h-14 font-bold px-5"
              />
            </div>

          </div>
          <DialogFooter>
            <Button 
              onClick={() => accessMutation.mutate(accessForm)} 
              disabled={accessMutation.isPending || accessForm.new.length < 6 || accessForm.new !== accessForm.confirm}
              className="w-full bg-white text-black hover:bg-white/90 rounded-2xl h-14 text-xs font-black uppercase tracking-widest transition-all"
            >
              {accessMutation.isPending ? <Loader2 className="animate-spin h-4 w-4" /> : 'Atualizar Senha'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isTransactionModalOpen} onOpenChange={setIsTransactionModalOpen}>
        <DialogContent className="bg-background border-white/10 rounded-[2.5rem] max-w-md p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter">Senha de Transação</DialogTitle>
            <DialogDescription className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-2">
              Esta senha de 4 dígitos será usada para confirmar saques e transferências.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Nova Senha (4 dígitos)</Label>
              <Input 
                type="password" 
                maxLength={4}
                value={transactionForm.new}
                onChange={(e) => setTransactionForm({...transactionForm, new: e.target.value.replace(/\D/g, '')})}
                className="bg-white/5 border-white/10 rounded-2xl h-14 font-bold text-center text-xl tracking-[0.8em]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Confirmar Nova Senha</Label>
              <Input 
                type="password" 
                maxLength={4}
                value={transactionForm.confirm}
                onChange={(e) => setTransactionForm({...transactionForm, confirm: e.target.value.replace(/\D/g, '')})}
                className="bg-white/5 border-white/10 rounded-2xl h-14 font-bold text-center text-xl tracking-[0.8em]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              onClick={() => transactionMutation.mutate(transactionForm)} 
              disabled={transactionMutation.isPending || transactionForm.new.length !== 4 || transactionForm.new !== transactionForm.confirm}
              className="w-full bg-white text-black hover:bg-white/90 rounded-2xl h-14 text-xs font-black uppercase tracking-widest transition-all"
            >
              {transactionMutation.isPending ? <Loader2 className="animate-spin h-4 w-4" /> : 'Salvar Senha de Transação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}