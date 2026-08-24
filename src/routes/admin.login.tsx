import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { adminLoginBypass, checkAdminRole } from '@/lib/admin-auth.functions';
import maskPlatformAsset from "@/lib/mask-asset";

export const Route = createFileRoute('/admin/login')({
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Submit detectado via handleLogin!", { email: email.trim() });
    
    if (isLoading) return;

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || !password) {
      const msg = 'Informe um e-mail válido e a senha.';
      setError(msg);
      toast.error(msg);
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      console.log("Tentando login Supabase padrão...");
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (!signInError && signInData.session) {
        const isAdmin = await checkAdminRole({
          data: { userId: signInData.session.user.id },
        });
        if (!isAdmin) {
          await supabase.auth.signOut();
          throw new Error('Esta conta não possui acesso administrativo.');
        }

        console.log("Login administrativo confirmado, guardando timestamp...");
        localStorage.setItem('maskpay_admin_login_at', Date.now().toString());
        toast.success('Bem-vindo, Administrador.');
        
        await queryClient.resetQueries({ queryKey: ['admin_users'] });
        await queryClient.resetQueries({ queryKey: ['profile'] });
        
        console.log("Redirecionando para /admin...");
        window.location.href = '/admin';
        return;
      }

      console.log("Tentando bypass...");
      const result = await adminLoginBypass({
        data: {
          email: cleanEmail,
          password,
        }
      });

      const session = (result as any)?.session;
      if (!session?.access_token) {
        throw new Error("Credenciais inválidas ou conta não encontrada.");
      }

      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });

      if (setSessionError) throw setSessionError;

      const { data: { session: activeSession } } = await supabase.auth.getSession();
      if (!activeSession?.user) {
        throw new Error('Não foi possível confirmar a sessão administrativa.');
      }

      const isAdmin = await checkAdminRole({
        data: { userId: activeSession.user.id },
      });
      if (!isAdmin) {
        await supabase.auth.signOut();
        throw new Error('Esta conta não possui acesso administrativo.');
      }

      console.log("Bypass OK, persistindo sessão e timestamp...");
      localStorage.setItem('maskpay_admin_login_at', Date.now().toString());
      toast.success('Bem-vindo, Administrador.');
      await queryClient.resetQueries({ queryKey: ['admin_users'] });
      await queryClient.resetQueries({ queryKey: ['profile'] });
      
      console.log("Redirecionando para /admin (via bypass)...");
      window.location.href = '/admin';

    } catch (err: any) {
      console.error("Erro no login:", err);
      let msg = err.message || "Erro ao entrar.";
      if (msg.includes('Invalid login credentials') || msg.includes('Email not confirmed')) {
        msg = 'E-mail ou senha incorretos.';
      }
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[440px] space-y-8">
        <div className="flex flex-col items-center space-y-6">
          <Link to="/" className="flex flex-col items-center gap-4">
            <img src={maskPlatformAsset.url} alt="Logo" className="w-20 h-20" />
            <span className="text-3xl font-black uppercase text-white">MaskPay</span>
          </Link>
          <h2 className="text-2xl font-black uppercase text-white">Administrador</h2>
        </div>

        <Card className="border-white/5 bg-card/40 backdrop-blur-2xl">
          <CardContent className="pt-8 px-8 pb-10">
            <form 
              onSubmit={(e) => {
                console.log("SUBMIT_EVENT_FIRED");
                handleLogin(e);
              }} 
              className="space-y-6"
            >
              <div className="space-y-2">
                <Label className="text-white">E-mail</Label>
                <Input 
                  type="email" 
                  autoComplete="email"
                  required 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-white/5 h-14 text-white placeholder:text-white/20 border-white/10 focus:border-red-500/50" 
                  placeholder="Seu e-mail administrativo"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-white">Senha</Label>
                <Input 
                  type="password"
                  autoComplete="current-password"
                  required 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-white/5 h-14 text-white placeholder:text-white/20 border-white/10 focus:border-red-500/50" 
                  placeholder="Sua senha"
                />
              </div>

              {error && <p className="text-red-500 text-xs font-bold uppercase">{error}</p>}

              <Button
                type="submit"
                disabled={isLoading}
                onClick={() => console.log("BUTTON_CLICKED")}
                className="w-full bg-red-600 hover:bg-red-700 h-14 font-black uppercase tracking-widest text-white rounded-md flex items-center justify-center transition-all shadow-[0_0_20px_rgba(220,38,38,0.2)] active:scale-[0.98]"
              >
                {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Entrar no Sistema'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}