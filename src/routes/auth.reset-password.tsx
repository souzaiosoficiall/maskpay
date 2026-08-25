import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Loader2, Eye, EyeOff, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import maskPlatformAsset from '@/lib/mask-asset';
import { clearAuthStorage } from '@/lib/security-lock';

export const Route = createFileRoute('/auth/reset-password')({
  component: ResetPasswordPage,
});

/**
 * Landing after the user clicks the recovery link in the email.
 * Supabase redirects here with ?code=... (PKCE) or hash tokens.
 * We establish a recovery session, let them set a new password, then force login.
 */
function ResetPasswordPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<'loading' | 'form' | 'done' | 'error'>('loading');
  const [message, setMessage] = useState('Validando link de recuperação…');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    try {
      sessionStorage.setItem('maskpay-password-recovery', '1');
    } catch {
      // ignore
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        try {
          sessionStorage.setItem('maskpay-password-recovery', '1');
        } catch {
          // ignore
        }
        if (!cancelled) {
          setPhase('form');
          setMessage('');
        }
      }
    });

    (async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        const errorDescription =
          url.searchParams.get('error_description') ||
          url.searchParams.get('error');
        const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
        const hashType = hashParams.get('type');
        const hashError = hashParams.get('error_description') || hashParams.get('error');

        if (errorDescription || hashError) {
          if (!cancelled) {
            setPhase('error');
            setMessage(
              decodeURIComponent((errorDescription || hashError || '').replace(/\+/g, ' ')),
            );
          }
          return;
        }

        // PKCE recovery: exchange code for session
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            const { data } = await supabase.auth.getSession();
            if (!data.session) throw error;
          }
        } else {
          // Hash fragment / already-parsed session
          let session = (await supabase.auth.getSession()).data.session;
          if (!session) {
            await new Promise((r) => setTimeout(r, 600));
            session = (await supabase.auth.getSession()).data.session;
          }
          // Allow form if recovery flag was set from auth event even without waiting forever
          if (!session && sessionStorage.getItem('maskpay-password-recovery') !== '1') {
            if (!cancelled) {
              setPhase('error');
              setMessage(
                'Link inválido ou expirado. Solicite um novo e-mail de redefinição.',
              );
            }
            return;
          }
          if (!session) {
            // last wait for detectSessionInUrl
            await new Promise((r) => setTimeout(r, 800));
            session = (await supabase.auth.getSession()).data.session;
            if (!session) {
              if (!cancelled) {
                setPhase('error');
                setMessage(
                  'Link inválido ou expirado. Solicite um novo e-mail de redefinição.',
                );
              }
              return;
            }
          }
        }

        if (!cancelled) {
          setPhase('form');
          setMessage('');
          try {
            window.history.replaceState({}, '', '/auth/reset-password');
          } catch {
            // ignore
          }
        }
      } catch (e: any) {
        console.error('[reset-password]', e);
        if (!cancelled) {
          setPhase('error');
          setMessage(
            e?.message ||
              'Não foi possível validar o link. Solicite um novo e-mail de redefinição.',
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      toast.error('As senhas não coincidem.');
      return;
    }

    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Sessão de recuperação expirada. Solicite um novo link.');
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      // End recovery session — user must log in with the new password
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        // ignore
      }
      try {
        clearAuthStorage();
      } catch {
        // ignore
      }
      try {
        sessionStorage.removeItem('maskpay-app-unlocked');
      } catch {
        // ignore
      }

      try {
        sessionStorage.removeItem('maskpay-password-recovery');
      } catch {
        // ignore
      }
      setPhase('done');
      toast.success('Senha alterada com sucesso!');
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao atualizar a senha.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex w-full items-center justify-center bg-background px-4 py-10 font-sans text-foreground">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center">
          <Link to="/" className="flex items-center gap-3 mb-6 transition-transform hover:scale-105">
            <img
              src={maskPlatformAsset.url}
              alt="MaskPay"
              className="w-10 h-10 object-contain"
            />
            <span className="text-2xl font-black tracking-tighter uppercase">MaskPay</span>
          </Link>
          <h1 className="text-3xl font-black tracking-tight uppercase">
            {phase === 'done' ? 'Senha atualizada' : 'Nova senha'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground font-medium">
            {phase === 'done'
              ? 'Use a nova senha para entrar na sua conta.'
              : 'Defina uma senha segura para acessar a plataforma.'}
          </p>
        </div>

        <Card className="border-white/5 bg-card/40 backdrop-blur-2xl shadow-2xl rounded-[2rem] overflow-hidden">
          <CardContent className="p-6 md:p-8 space-y-6">
            {phase === 'loading' && (
              <div className="flex flex-col items-center gap-4 py-10">
                <Loader2 className="h-8 w-8 animate-spin text-white/70" />
                <p className="text-sm font-medium text-muted-foreground">{message}</p>
              </div>
            )}

            {phase === 'error' && (
              <div className="space-y-6 text-center py-4">
                <p className="text-sm font-medium text-red-400 leading-relaxed">{message}</p>
                <Button
                  onClick={() =>
                    navigate({ to: '/auth', search: { mode: 'forgot' as any } })
                  }
                  className="w-full h-12 rounded-xl bg-white text-black font-black uppercase tracking-widest text-xs"
                >
                  Solicitar novo link
                </Button>
                <Link
                  to="/auth"
                  search={{ mode: 'login' }}
                  className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-white"
                >
                  Voltar ao login
                </Link>
              </div>
            )}

            {phase === 'form' && (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="flex flex-col items-center text-center gap-2 mb-2">
                  <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <ShieldCheck className="w-7 h-7 text-primary" />
                  </div>
                  <p className="text-[11px] font-medium text-muted-foreground leading-relaxed">
                    Link validado. Escolha uma nova senha com no mínimo 6 caracteres.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">
                    Nova senha
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPw ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-white/5 h-14 rounded-xl border-white/5 focus:border-primary/50 px-5 pr-12"
                      autoFocus
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/50"
                      aria-label="Mostrar senha"
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">
                    Confirmar senha
                  </Label>
                  <div className="relative">
                    <Input
                      type={showConfirm ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className="bg-white/5 h-14 rounded-xl border-white/5 focus:border-primary/50 px-5 pr-12"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/50"
                      aria-label="Mostrar confirmação"
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={saving || password.length < 6 || confirm.length < 6}
                  className="w-full h-14 rounded-2xl bg-white text-black font-black uppercase tracking-widest text-xs disabled:opacity-50"
                >
                  {saving ? <Loader2 className="animate-spin" /> : 'Salvar nova senha'}
                </Button>
              </form>
            )}

            {phase === 'done' && (
              <div className="flex flex-col items-center text-center gap-4 py-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
                <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                  Sua senha foi redefinida com sucesso. Faça login com a nova senha para continuar.
                </p>
                <Button
                  onClick={() => navigate({ to: '/auth', search: { mode: 'login' } })}
                  className="w-full h-12 rounded-xl bg-white text-black font-black uppercase tracking-widest text-xs"
                >
                  Ir para o login
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
