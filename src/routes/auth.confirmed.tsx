import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import maskPlatformAsset from '@/lib/mask-asset';
import { clearAuthStorage } from '@/lib/security-lock';

export const Route = createFileRoute('/auth/confirmed')({
  component: EmailConfirmedPage,
});

/**
 * Landing page after the user clicks the confirmation link in the email.
 * Supabase redirects here with ?code=... (PKCE). We finish the exchange,
 * clear the session so they must log in, and show a success screen.
 */
function EmailConfirmedPage() {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [message, setMessage] = useState('Confirmando seu e-mail...');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // PKCE: exchange code from URL for a session (confirms the email)
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        const errorDescription =
          url.searchParams.get('error_description') ||
          url.searchParams.get('error');

        if (errorDescription) {
          if (!cancelled) {
            setStatus('error');
            setMessage(decodeURIComponent(errorDescription.replace(/\+/g, ' ')));
          }
          return;
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            // Maybe detectSessionInUrl already consumed the code
            const { data } = await supabase.auth.getSession();
            if (!data.session) {
              throw error;
            }
          }
        } else {
          // Hash tokens (older flow) or session already established
          const { data } = await supabase.auth.getSession();
          if (!data.session) {
            // Still ok — email may already be confirmed; send user to login
            if (!cancelled) {
              setStatus('ok');
              setMessage('Seu e-mail foi confirmado. Faça login para continuar.');
            }
            return;
          }
        }

        // Email is confirmed. Force login screen (no auto dashboard entry).
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

        // Clean query string from address bar
        try {
          window.history.replaceState({}, '', '/auth/confirmed');
        } catch {
          // ignore
        }

        if (!cancelled) {
          setStatus('ok');
          setMessage('E-mail confirmado com sucesso! Agora entre com seu e-mail e senha.');
        }
      } catch (err: any) {
        console.error('[auth.confirmed]', err);
        if (!cancelled) {
          setStatus('error');
          setMessage(
            err?.message ||
              'Não foi possível confirmar o e-mail. O link pode ter expirado — tente reenviar pelo cadastro/login.',
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen flex w-full items-center justify-center bg-background p-4 pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center">
          <Link to="/" className="flex items-center gap-3 mb-8">
            <img
              src={maskPlatformAsset.url}
              alt="MaskPay"
              className="w-10 h-10 object-contain"
            />
            <span className="text-2xl font-black tracking-tighter uppercase">MaskPay</span>
          </Link>
        </div>

        <Card className="border-white/5 bg-card/40 backdrop-blur-2xl shadow-2xl rounded-[2rem] overflow-hidden">
          <CardContent className="p-8 space-y-6">
            <div className="flex flex-col items-center text-center gap-4">
              {status === 'loading' && (
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
              )}
              {status === 'ok' && (
                <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-primary" />
                </div>
              )}
              {status === 'error' && (
                <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <span className="text-2xl">!</span>
                </div>
              )}

              <h1 className="text-2xl font-black uppercase tracking-tighter">
                {status === 'loading'
                  ? 'Confirmando...'
                  : status === 'ok'
                    ? 'E-mail confirmado'
                    : 'Não foi possível confirmar'}
              </h1>
              <p className="text-sm text-muted-foreground font-medium leading-relaxed">
                {message}
              </p>
            </div>

            {status !== 'loading' && (
              <Button
                asChild
                className="w-full h-12 rounded-xl bg-white text-black font-black uppercase tracking-widest text-xs"
              >
                <Link to="/auth" search={{ mode: 'login' }}>
                  Ir para o login
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
