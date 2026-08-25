import { useState, useEffect } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateTransactionPassword } from '@/lib/settings.functions';

/**
 * Full-screen modal shown once after the account is accepted (verified)
 * and the user still has no 4-digit transaction PIN.
 */
export function SetupTransactionPinModal({ open }: { open: boolean }) {
  const doSet = useServerFn(updateTransactionPassword);
  const queryClient = useQueryClient();
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [saving, setSaving] = useState(false);
  // Hide immediately after successful save while profile refetch settles
  const [completed, setCompleted] = useState(false);

  // Reset local completion when parent re-opens the modal (e.g. new session)
  useEffect(() => {
    if (open) setCompleted(false);
  }, [open]);

  // Prevent background scroll while the blocking PIN modal is visible
  useEffect(() => {
    if (!open || completed) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, completed]);

  if (!open || completed) return null;

  const save = async () => {
    if (pin.length !== 4) {
      toast.error('O PIN deve ter 4 dígitos.');
      return;
    }
    if (pin !== pin2) {
      toast.error('Os PINs não coincidem.');
      return;
    }
    setSaving(true);
    try {
      await doSet({ data: { newPassword: pin, confirmPassword: pin2 } });
      // Optimistic close + cache update so needsPinSetup becomes false immediately
      queryClient.setQueryData(['profile'], (old: any) =>
        old ? { ...old, transaction_password_hash: pin } : old,
      );
      setCompleted(true);
      toast.success('PIN de transação criado com sucesso!');
      // Background refetch to stay in sync with server
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao salvar PIN');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />
      <div className="relative z-10 w-full max-w-md rounded-[2rem] border border-white/10 bg-[#0c0c0c] p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-300">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-16 h-16 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-1">
              Conta aprovada
            </p>
            <h2 className="text-2xl font-black tracking-tighter uppercase">
              Crie seu PIN
            </h2>
            <p className="text-[11px] font-bold text-muted-foreground mt-2 leading-relaxed">
              Defina um PIN de 4 dígitos para confirmar saques e pagamentos via QR Code.
              Você só precisa fazer isso uma vez.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
              PIN (4 dígitos)
            </Label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
              className="bg-white/5 border-white/10 rounded-2xl h-14 text-center text-2xl font-black tracking-[0.5em]"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
              Confirmar PIN
            </Label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin2}
              onChange={(e) => setPin2(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
              className="bg-white/5 border-white/10 rounded-2xl h-14 text-center text-2xl font-black tracking-[0.5em]"
            />
          </div>
        </div>

        <Button
          onClick={save}
          disabled={saving || pin.length !== 4 || pin2.length !== 4}
          className="w-full h-14 rounded-2xl bg-white text-black font-black uppercase tracking-widest text-xs"
        >
          {saving ? <Loader2 className="animate-spin" /> : 'Salvar PIN e continuar'}
        </Button>

        <p className="text-[9px] font-bold text-muted-foreground/50 text-center uppercase tracking-widest">
          Obrigatório para movimentar valores
        </p>
      </div>
    </div>
  );
}
