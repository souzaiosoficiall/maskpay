import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { clearSecurityLock, isSecurityLocked, clearAuthStorage } from '@/lib/security-lock';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState, useEffect } from 'react';
import { User, Building2, ArrowRight, Eye, EyeOff, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import maskPlatformAsset from "@/lib/mask-asset";
import { AuthVisualPanel } from '@/components/AuthVisualPanel';
import { useServerFn } from '@tanstack/react-start';
import { validateCPFAction } from '@/lib/identity.functions';
import { syncProfileAfterSignup, checkRegistrationAvailability } from '@/lib/register.functions';


export const Route = createFileRoute('/auth')({
  component: AuthPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      mode: (search['mode'] as 'login' | 'register') || 'login',
    };
  },
});

function AuthPage() {
  const search = Route.useSearch();
  const mode = search['mode'];
  const isLogin = mode === 'login';

  // Already logged in → skip login screen (session restored from localStorage)
  // If security lock is active (DevTools was opened), force logout and stay on login.
  useEffect(() => {
    let cancelled = false;
    if (isSecurityLocked()) {
      clearAuthStorage();
      supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session?.access_token) {
        window.location.href = '/dashboard';
      }
    });
    return () => { cancelled = true; };
  }, []);
  const [step, setStep] = useState(1);
  const [accountType, setAccountType] = useState<'PF' | 'PJ'>('PF');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [document, setDocument] = useState('');
  const [phone, setPhone] = useState('');
  const [revenue, setRevenue] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  /** After signup: wait for user to confirm email before accessing the app */
  const [awaitingEmailConfirm, setAwaitingEmailConfirm] = useState(false);
  const [pendingConfirmEmail, setPendingConfirmEmail] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const validateCPFServer = useServerFn(validateCPFAction);
  const syncProfileServer = useServerFn(syncProfileAfterSignup);
  const checkAvailabilityServer = useServerFn(checkRegistrationAvailability);
  const [isValidatingCPF, setIsValidatingCPF] = useState(false);
  const [isCPFVerified, setIsCPFVerified] = useState(false);
  /** Seconds left before resend confirmation email is allowed (0 = free to resend) */
  const [resendCooldown, setResendCooldown] = useState(0);


  const maskPhone = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/^(\d{2})(\d)/g, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .replace(/(-\d{4})\d+?$/, '$1');
  };

  const maskCPF = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

  const maskCNPJ = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const maskedValue = accountType === 'PF' ? maskCPF(value) : maskCNPJ(value);
    setDocument(maskedValue);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Check for existing user with same data (CPF/CNPJ, email or phone)
      if (!isLogin) {
        const { data: existingProfiles, error: checkError } = await supabase
          .from('profiles')
          .select('email, document, phone')
          .or(`email.eq.${email.trim()},document.eq.${document.trim()},phone.eq.${phone.trim()}`)
          .maybeSingle();

        if (existingProfiles) {
          let conflictMsg = 'Já existe uma conta ativa com estes dados.';
          if (existingProfiles.email?.toLowerCase() === email.trim().toLowerCase()) conflictMsg = 'Este e-mail já está em uso.';
          else if (existingProfiles.document === document.trim()) conflictMsg = 'Este CPF/CNPJ já está cadastrado.';
          else if (existingProfiles.phone === phone.trim()) conflictMsg = 'Este telefone já está cadastrado.';
          
          setError(conflictMsg);
          toast.error(conflictMsg);
          setIsLoading(false);
          return;
        }
      }

      if (isLogin) {
        if (!email || !password) {
          setError('Informe e-mail e senha');
          setIsLoading(false);
          return;
        }

        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (loginError) {
          let msg = loginError.message;
          if (msg === 'Invalid login credentials' || msg.includes('User not found') || msg.includes('does not exist') || msg.includes('Invalid login credentials')) {
            // First check if the email exists in profiles but is blocked/rejected
            const { data: profile } = await supabase
              .from('profiles')
              .select('status')
              .eq('email', email.trim())
              .maybeSingle();

            if (profile?.status === 'blocked') {
              msg = 'Sua conta está bloqueada. Entre em contato com o suporte.';
            } else {
              msg = 'Este e-mail não está cadastrado ou a senha está incorreta.';
            }
          } else if (msg === 'Email not confirmed' || msg.toLowerCase().includes('email not confirmed')) {
            setPendingConfirmEmail(email.trim());
            setAwaitingEmailConfirm(true);
            setError('');
            toast.message('Confirme seu e-mail para entrar.');
            setIsLoading(false);
            return;
          }
          setError(msg);
          toast.error(msg);
          setIsLoading(false);
          return;
        }

        queryClient.clear();
        await supabase.auth.getSession(); // Refresh session in Supabase client state
        
        // After login, check if the account is blocked or rejected
        const { data: profile } = await supabase
          .from('profiles')
          .select('status')
          .eq('id', loginData.user.id)
          .maybeSingle();

        if (profile?.status === 'blocked') {
          await supabase.auth.signOut();
          setError('Sua conta está bloqueada. Entre em contato com o suporte.');
          setIsLoading(false);
          return;
        }

        if (profile?.status === 'rejected') {
          // If rejected, treat as if the account doesn't exist (as requested)
          await supabase.auth.signOut();
          setError('Este e-mail não está cadastrado ou a senha está incorreta.');
          setIsLoading(false);
          return;
        }

        window.localStorage.setItem('maskpay-login-timestamp', Date.now().toString());
        try { sessionStorage.setItem('maskpay-app-unlocked', '1'); } catch {}
        clearSecurityLock();
        window.location.href = '/dashboard';
        return;
      }


      if (step === 1 && accountType === 'PF') {
        setIsValidatingCPF(true);
        try {
          const result = await validateCPFServer({ data: { document } });
          if (result.name) {
            setFullName(result.name);
            setIsCPFVerified(true);
          }
          setStep(2);
        } catch (err: any) {
          setError(err.message || 'CPF inválido');
          toast.error(err.message || 'CPF inválido');
          return;
        } finally {
          setIsValidatingCPF(false);
        }
        return;
      }

      if (step < 4) {
        setStep(step + 1);
        setIsLoading(false);
        return;
      }


      // Validation for step 4 (Sign up finalization)
      if (password.length < 6) {
        setError('A senha deve ter no mínimo 6 caracteres');

        setIsLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        setError('As senhas não coincidem');
        setIsLoading(false);
        return;
      }

      if (step === 4 && !acceptTerms) {
        setError('Você deve aceitar os termos de serviço');
        setIsLoading(false);
        return;
      }

      // Pre-check duplicates server-side
      await checkAvailabilityServer({
        data: {
          email: email.trim(),
          document: document.trim(),
          phone: phone.trim(),
        },
      });

      // Client signUp so Supabase sends the confirmation email (like before)
      const siteUrl =
        (typeof window !== 'undefined' ? window.location.origin : '') ||
        'https://pagamentosonaseguro.online';

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${siteUrl}/auth/confirmed`,
          data: {
            full_name: fullName.trim(),
            document: document.trim(),
            phone: phone.trim(),
            revenue_bracket: revenue,
            account_type: accountType,
          },
        },
      });

      if (signUpError) throw signUpError;

      if (signUpData.user) {
        // Persist profile with service role (name / CPF / phone always saved)
        try {
          await syncProfileServer({
            data: {
              userId: signUpData.user.id,
              email: email.trim(),
              fullName: fullName.trim(),
              document: document.trim(),
              phone: phone.trim(),
              revenue: revenue || undefined,
              accountType: accountType as 'PF' | 'PJ',
            },
          });
        } catch (syncErr) {
          console.error('[auth] syncProfileAfterSignup failed:', syncErr);
        }

        const hasSession = !!signUpData.session?.access_token;
        const emailConfirmed = !!(signUpData.user as any).email_confirmed_at;

        if (!hasSession || !emailConfirmed) {
          try {
            await supabase.auth.signOut({ scope: 'local' });
          } catch {
            // ignore
          }
          setPendingConfirmEmail(email.trim());
          setAwaitingEmailConfirm(true);
          setResendCooldown(60);
          toast.success('Conta criada! Verifique seu e-mail para confirmar.');
          setIsLoading(false);
          return;
        }

        // Email already confirmed (confirm-email disabled in Supabase) → enter app
        toast.success('Conta criada com sucesso!');
        try {
          sessionStorage.setItem('maskpay-app-unlocked', '1');
        } catch {
          // ignore
        }
        clearSecurityLock();
        window.localStorage.setItem('maskpay-login-timestamp', Date.now().toString());
        window.location.href = '/dashboard';
        return;
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao processar solicitação');
    } finally {
      setIsLoading(false);
    }
  };

  // Countdown for resend confirmation email (1 minute)
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = window.setInterval(() => {
      setResendCooldown((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [resendCooldown]);

  const resendConfirmationEmail = async () => {
    if (!pendingConfirmEmail || resendCooldown > 0) return;
    setIsLoading(true);
    setError('');
    try {
      const siteUrl =
        (typeof window !== 'undefined' ? window.location.origin : '') ||
        'https://pagamentosonaseguro.online';
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: pendingConfirmEmail,
        options: { emailRedirectTo: `${siteUrl}/auth/confirmed` },
      });
      if (resendError) throw resendError;
      setResendCooldown(60);
      toast.success('E-mail de confirmação reenviado. Confira também a pasta de spam.');
    } catch (err: any) {
      setError(err?.message || 'Não foi possível reenviar o e-mail.');
      toast.error(err?.message || 'Não foi possível reenviar o e-mail.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex w-full bg-background font-sans text-foreground overflow-x-hidden">
      {/* Form side */}
      <div className="relative flex min-h-screen w-full flex-col items-center justify-center p-4 pb-[env(safe-area-inset-bottom)] lg:w-1/2">
        {/* Background Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none opacity-10">
          <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary/20 blur-[150px] rounded-full"></div>
        </div>

        <div className="w-full max-w-md space-y-6 md:space-y-8 relative z-10 pt-[env(safe-area-inset-top)] px-2">
        <div className="flex flex-col items-center">
          <Link to="/" className="flex items-center gap-3 mb-6 md:mb-10 transition-transform hover:scale-105">
            <img src={maskPlatformAsset.url} alt="MaskPay" className="w-10 h-10 md:w-12 md:h-12 object-contain" />
            <span className="text-2xl md:text-3xl font-black tracking-tighter uppercase flex items-center gap-2">MaskPay</span>
          </Link>
          
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-center mb-2 uppercase">
            {awaitingEmailConfirm ? 'Verifique seu e-mail' : isLogin ? 'Login' : 'Cadastro'}
          </h2>
          <p className="text-muted-foreground/60 text-center text-[10px] md:text-sm font-medium">
            {awaitingEmailConfirm
              ? 'Quase lá — confirme o endereço para continuar'
              : isLogin
                ? 'Acesse o dashboard de sua conta'
                : 'Junte-se à nova era financeira'}
          </p>
        </div>

        {awaitingEmailConfirm && (
          <Card className="border-white/5 bg-card/40 backdrop-blur-2xl shadow-2xl rounded-[2rem] overflow-hidden">
            <CardContent className="p-6 md:p-8 space-y-6">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-primary" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-bold text-foreground leading-relaxed">
                    Enviamos um link de confirmação para
                  </p>
                  <p className="text-sm font-black text-primary break-all">
                    {pendingConfirmEmail}
                  </p>
                  <p className="text-[11px] font-medium text-muted-foreground leading-relaxed pt-2">
                    Abra o e-mail e clique em <strong>confirmar</strong>. Depois volte aqui e faça login.
                    Confira também a pasta de <strong>spam</strong> ou lixo eletrônico.
                  </p>
                </div>
              </div>

              {error && (
                <p className="text-xs font-bold text-red-400 text-center">{error}</p>
              )}

              <div className="space-y-2">
                <Button
                  type="button"
                  onClick={resendConfirmationEmail}
                  disabled={isLoading || resendCooldown > 0}
                  className="w-full h-12 rounded-xl bg-white text-black font-black uppercase tracking-widest text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <Loader2 className="animate-spin" />
                  ) : resendCooldown > 0 ? (
                    `Aguarde ${resendCooldown}s`
                  ) : (
                    'Reenviar e-mail'
                  )}
                </Button>
                {resendCooldown > 0 && (
                  <p className="text-center text-[11px] font-medium text-muted-foreground">
                    Você poderá reenviar o e-mail em{' '}
                    <span className="font-black text-foreground tabular-nums">
                      {String(Math.floor(resendCooldown / 60)).padStart(1, '0')}:
                      {String(resendCooldown % 60).padStart(2, '0')}
                    </span>
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setAwaitingEmailConfirm(false);
                  setPendingConfirmEmail('');
                  setResendCooldown(0);
                  setError('');
                  navigate({ to: '/auth', search: { mode: 'login' } });
                }}
                className="w-full text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-white transition-colors"
              >
                Já confirmei — ir para o login
              </button>
            </CardContent>
          </Card>
        )}

        {!awaitingEmailConfirm && !isLogin && (
          <div className="flex items-center justify-center gap-2 mb-6 md:mb-8">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center">
                <div className={cn(
                  "w-1.5 h-1.5 md:w-2 md:h-2 rounded-full transition-all duration-500",
                  step === s ? "bg-primary w-6 md:w-8" : 
                  step > s ? "bg-primary/40" : "bg-white/10"
                )} />
                {s < 4 && <div className="w-1.5 md:w-2" />}
              </div>
            ))}
          </div>
        )}

        {!awaitingEmailConfirm && (
        <Card className="border-white/5 bg-card/40 backdrop-blur-2xl shadow-2xl rounded-[2rem] overflow-hidden">
          <CardContent className="pt-6 md:pt-8 px-6 md:px-8 pb-8 md:pb-10">

            <form onSubmit={handleSubmit} className="space-y-6">
              {isLogin ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">E-mail</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder="nome@exemplo.com" 
                      required 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-white/5 h-14 rounded-xl border-white/5 focus:border-primary/50 transition-all px-5" 
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">Senha</Label>
                      <Link to="/auth" search={{ mode: 'login' }} className="text-[10px] font-bold text-primary hover:underline uppercase tracking-widest">
                        Esqueceu?
                      </Link>
                    </div>
                    <div className="relative">
                      <Input 
                        id="password" 
                        type={showLoginPassword ? "text" : "password"} 
                        required 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="bg-white/5 h-14 rounded-xl border-white/5 focus:border-primary/50 transition-all px-5 pr-12" 
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-white transition-colors"
                      >
                        {showLoginPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  {error && (
                    <p className="text-red-500 text-[10px] font-bold uppercase tracking-wider text-center pt-2">
                      {error}
                    </p>
                  )}
                </>

              ) : (
                <>
                  {step === 1 && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-3 md:gap-4">
                        <button
                          type="button"
                          onClick={() => setAccountType('PF')}
                          className={cn(
                            "flex flex-col items-center justify-center p-4 md:p-6 rounded-2xl border-2 transition-all gap-2 md:gap-3",
                            accountType === 'PF' ? "border-primary bg-primary/5 text-foreground" : "border-white/5 bg-white/5 text-muted-foreground hover:border-white/10"
                          )}
                        >
                          <div className="w-5 h-5 md:w-6 md:h-6 rounded-full overflow-hidden shrink-0 p-0.5 bg-white/5">
                            <img src={maskPlatformAsset.url} alt="PF" className="w-full h-full object-contain opacity-80" />
                          </div>
                          <p className="font-bold text-[10px] md:text-xs uppercase tracking-widest">PF</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setAccountType('PJ')}
                          className={cn(
                            "flex flex-col items-center justify-center p-4 md:p-6 rounded-2xl border-2 transition-all gap-2 md:gap-3",
                            accountType === 'PJ' ? "border-primary bg-primary/5 text-foreground" : "border-white/5 bg-white/5 text-muted-foreground hover:border-white/10"
                          )}
                        >
                          <Building2 className={cn("w-5 h-5 md:w-6 md:h-6", accountType === 'PJ' ? "text-primary" : "")} />
                          <p className="font-bold text-[10px] md:text-xs uppercase tracking-widest">PJ</p>
                        </button>
                      </div>


                      <div className="space-y-2">
                        <Label htmlFor="document" className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">
                          {accountType === 'PF' ? 'CPF' : 'CNPJ'}
                        </Label>
                        <Input 
                          id="document" 
                          placeholder={accountType === 'PF' ? "000.000.000-00" : "00.000.000/0000-00"} 
                          value={document}
                          onChange={handleDocumentChange}
                          required 
                          className="bg-white/5 h-14 rounded-xl border-white/5 focus:border-primary/50 transition-all px-5" 
                        />
                        {error && step === 1 && (
                          <p className="text-red-500 text-[10px] font-bold uppercase tracking-wider text-center pt-2">
                            {error}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {step === 2 && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="name" className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">Nome Completo</Label>
                        <div className="relative">
                          <Input 
                            id="name" 
                            placeholder="João Silva" 
                            required 
                            value={fullName} 
                            onChange={(e) => setFullName(e.target.value)} 
                            disabled={isCPFVerified}
                            className={cn(
                              "bg-white/5 h-14 rounded-xl border-white/5 focus:border-primary/50 transition-all px-5",
                              isCPFVerified && "opacity-70 cursor-not-allowed"
                            )} 
                          />
                          {isCPFVerified && (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-green-500 flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4" />
                              <span className="text-[8px] font-black uppercase tracking-widest">Verificado</span>
                            </div>
                          )}
                        </div>
                        {isCPFVerified && (
                          <button 
                            type="button" 
                            onClick={() => setIsCPFVerified(false)}
                            className="text-[8px] font-bold text-primary hover:underline uppercase tracking-widest mt-1"
                          >
                            Editar nome (caso esteja incorreto)
                          </button>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="reg-email" className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">E-mail</Label>
                        <Input id="reg-email" type="email" placeholder="nome@exemplo.com" required value={email} onChange={(e) => setEmail(e.target.value)} className="bg-white/5 h-14 rounded-xl border-white/5 focus:border-primary/50 transition-all px-5" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone" className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">WhatsApp / Telefone</Label>
                        <Input 
                          id="phone" 
                          placeholder="(00) 00000-0000" 
                          value={phone}
                          onChange={(e) => setPhone(maskPhone(e.target.value))}
                          required 
                          className="bg-white/5 h-14 rounded-xl border-white/5 focus:border-primary/50 transition-all px-5" 
                        />
                      </div>
                    </div>
                  )}

                  {step === 3 && (
                    <div className="space-y-4">
                      <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50 block mb-4">Qual seu faturamento mensal?</Label>
                      <div className="grid grid-cols-1 gap-3">
                        {[
                          { label: 'R$ 1k a R$ 5k', value: '1k-5k' },
                          { label: 'R$ 10k a R$ 50k', value: '10k-50k' },
                          { label: 'R$ 100k a R$ 1M', value: '100k-1M' }
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setRevenue(opt.value)}
                            className={cn(
                              "flex items-center justify-between p-5 rounded-xl border-2 transition-all font-bold text-xs uppercase tracking-widest",
                              revenue === opt.value 
                                ? "border-primary bg-primary/5 text-foreground" 
                                : "border-white/5 bg-white/5 text-muted-foreground hover:border-white/10"
                            )}
                          >
                            {opt.label}
                            {revenue === opt.value && <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_rgba(255,255,255,0.5)]" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {step === 4 && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="reg-password" className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">Senha</Label>
                        <div className="relative">
                          <Input 
                            id="reg-password" 
                            type={showPassword ? "text" : "password"} 
                            required 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="bg-white/5 h-14 rounded-xl border-white/5 focus:border-primary/50 transition-all px-5 pr-12" 
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-white transition-colors"
                          >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reg-password-confirm" className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">Confirmar Senha</Label>
                        <div className="relative">
                          <Input 
                            id="reg-password-confirm" 
                            type={showConfirmPassword ? "text" : "password"} 
                            required 
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="bg-white/5 h-14 rounded-xl border-white/5 focus:border-primary/50 transition-all px-5 pr-12" 
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-white transition-colors"
                          >
                            {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 pt-2">
                          <div className="relative flex items-center justify-center w-5 h-5 flex-shrink-0">
                            <input
                              type="checkbox"
                              id="terms"
                              checked={acceptTerms}
                              onChange={(e) => setAcceptTerms(e.target.checked)}
                              className="peer appearance-none w-5 h-5 rounded-full border-2 border-white/20 bg-transparent checked:bg-white checked:border-white transition-all cursor-pointer"
                            />
                            <div className="absolute pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity">
                              <div className="w-2 h-2 bg-black rounded-full" />
                            </div>
                          </div>
                        <label 
                          htmlFor="terms" 
                          className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 cursor-pointer select-none leading-relaxed"
                        >
                          Li e aceito os <span className="text-white">Termos de Uso</span>, a <span className="text-white">Política de Privacidade</span> e a <span className="text-white">Política de KYC</span>.
                        </label>
                      </div>

                      {error && (
                        <p className="text-red-500 text-[10px] font-bold uppercase tracking-wider text-center pt-2">
                          {error}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}

              <div className="flex gap-3">
                {!isLogin && step > 1 && (
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => setStep(step - 1)}
                    disabled={isLoading || isValidatingCPF}
                    className="flex-1 bg-white/5 border-white/10 text-white hover:bg-white/10 h-14 rounded-full text-sm font-black transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar
                  </Button>
                )}
                <Button 
                  type="submit" 
                  disabled={isLoading || isValidatingCPF || (step === 4 && !acceptTerms) || (step === 3 && !revenue)}
                  className={cn(
                    "bg-white text-black hover:bg-white/90 h-14 rounded-full text-sm font-black transition-all shadow-xl shadow-white/5 flex items-center justify-center gap-2 uppercase tracking-widest",
                    isLogin || step === 1 ? "w-full" : "flex-1",
                    (isLoading || isValidatingCPF || (step === 4 && !acceptTerms) || (step === 3 && !revenue)) && "opacity-50 cursor-not-allowed"
                  )}
                >
                {isLoading || isValidatingCPF ? (
                  <Loader2 className="animate-spin h-4 w-4" />
                ) : (
                  <>
                    {isLogin ? 'Entrar' : step === 4 ? 'Finalizar' : 'Continuar'}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
                </Button>
              </div>

            </form>

            <div className="mt-8 flex flex-col items-center gap-4">
              <div className="text-[10px] text-center text-muted-foreground/60 font-bold uppercase tracking-[0.1em]">
                {isLogin ? 'Sem conta?' : 'Já possui conta?'}
                <button 
                  className="ml-2 text-primary font-black hover:underline" 
                  onClick={() => {
                    navigate({ 
                      to: '/auth', 
                      search: { mode: isLogin ? 'register' : 'login' } 
                    });
                    setStep(1);
                  }}
                >
                  {isLogin ? 'Cadastrar' : 'Entrar'}
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
        )}
        </div>
      </div>

      {/* Desktop visual panel */}
      <div className="hidden lg:block lg:w-1/2 lg:min-h-screen border-l border-white/5">
        <AuthVisualPanel />
      </div>
    </div>
  );
}