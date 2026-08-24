import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Bell, RefreshCw, Send, CheckCircle2, XCircle, AlertTriangle, HelpCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useSessionReady } from '@/hooks/useSessionReady';
import { getPushBackendStatus, sendTestPush } from '@/lib/push.functions';

function StatusRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'ok' | 'bad' | 'warn' | 'unknown';
}) {
  const icon = {
    ok: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
    bad: <XCircle className="w-4 h-4 text-red-400" />,
    warn: <AlertTriangle className="w-4 h-4 text-amber-400" />,
    unknown: <HelpCircle className="w-4 h-4 text-muted-foreground" />,
  }[tone];

  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
      <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs font-black uppercase tracking-wider text-white">{value}</span>
        {icon}
      </div>
    </div>
  );
}

/**
 * "Área de diagnóstico" required by the audit — shows the true end-to-end
 * state of the push pipeline (PWA, Service Worker, permission, push
 * support, subscription, backend, VAPID) without exposing any secret.
 */
export function NotificationDiagnostics() {
  const sessionReady = useSessionReady();
  const push = usePushNotifications(sessionReady);
  const fetchStatus = useServerFn(getPushBackendStatus);
  const doSendTest = useServerFn(sendTestPush);
  const [sendingTest, setSendingTest] = useState(false);

  const { data: backend, isLoading, refetch } = useQuery({
    queryKey: ['push_backend_status'],
    queryFn: () => fetchStatus({}),
    enabled: sessionReady,
    staleTime: 15000,
  });

  const pwaTone: 'ok' | 'warn' = push.isStandalone ? 'ok' : 'warn';
  const pwaValue = push.isStandalone ? 'OK' : 'NÃO INSTALADO';

  const swTone: 'ok' | 'bad' | 'warn' =
    push.state === 'ready' ? 'ok' : push.state === 'sw_failed' ? 'bad' : 'warn';
  const swValue =
    push.state === 'ready'
      ? 'ATIVO'
      : push.state === 'sw_failed'
        ? 'INDISPONÍVEL'
        : push.isStandalone
          ? 'VERIFICANDO'
          : 'INDISPONÍVEL';

  const permissionValue =
    push.permission === 'granted' ? 'GRANTED' : push.permission === 'denied' ? 'DENIED' : 'DEFAULT';
  const permissionTone: 'ok' | 'bad' | 'warn' =
    push.permission === 'granted' ? 'ok' : push.permission === 'denied' ? 'bad' : 'warn';

  const pushSupportTone: 'ok' | 'bad' = push.state === 'unsupported' ? 'bad' : 'ok';
  const pushSupportValue = push.state === 'unsupported' ? 'NÃO SUPORTADO' : 'SUPORTADO';

  const subscriptionTone: 'ok' | 'bad' | 'warn' =
    push.state === 'ready'
      ? 'ok'
      : push.state === 'subscribe_failed' || push.state === 'backend_failed'
        ? 'bad'
        : 'warn';
  const subscriptionValue =
    push.state === 'ready' ? 'ATIVA' : push.state === 'subscribe_failed' ? 'INVÁLIDA' : 'AUSENTE';

  const backendTone: 'ok' | 'bad' | 'unknown' = isLoading
    ? 'unknown'
    : (backend?.activeCount ?? 0) > 0
      ? 'ok'
      : 'bad';
  const backendValue = isLoading ? '...' : (backend?.activeCount ?? 0) > 0 ? 'OK' : 'ERRO';

  const vapidTone: 'ok' | 'bad' | 'unknown' = isLoading ? 'unknown' : backend?.vapidConfigured ? 'ok' : 'bad';
  const vapidValue = isLoading ? '...' : backend?.vapidConfigured ? 'CONFIGURADO' : 'AUSENTE';

  const handleTestPush = async () => {
    setSendingTest(true);
    try {
      const result = await doSendTest({});
      if (result.delivered > 0) {
        toast.success(`Push de teste enviado (${result.delivered} dispositivo(s)).`);
      } else if (result.attempted === 0) {
        toast.error('Nenhuma inscrição ativa encontrada. Ative as notificações primeiro.');
      } else {
        toast.error(result.errors[0] || 'Falha ao enviar o push de teste.');
      }
      refetch();
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao enviar o push de teste.');
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <Card className="border-white/5 bg-background border-2 rounded-[2.5rem] p-4 md:p-10">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5">
          <Bell className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-black uppercase tracking-tighter">Notificações Push</h3>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Diagnóstico completo do sistema de push
          </p>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl px-6">
        <StatusRow label="PWA" value={pwaValue} tone={pwaTone} />
        <StatusRow label="Service Worker" value={swValue} tone={swTone} />
        <StatusRow label="Permissão" value={permissionValue} tone={permissionTone} />
        <StatusRow label="Push" value={pushSupportValue} tone={pushSupportTone} />
        <StatusRow label="Subscription" value={subscriptionValue} tone={subscriptionTone} />
        <StatusRow label="Backend" value={backendValue} tone={backendTone} />
        <StatusRow label="VAPID" value={vapidValue} tone={vapidTone} />
      </div>

      {push.reason && push.state !== 'ready' && (
        <div className="mt-4 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10">
          <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest leading-relaxed">
            {push.reason}
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        {push.state !== 'ready' && push.state !== 'permission_denied' && (
          <Button
            onClick={() => push.activate()}
            size="sm"
            className="h-10 px-5 rounded-xl gap-2 text-[10px] font-black uppercase tracking-wider"
          >
            <Bell className="w-3.5 h-3.5" />
            Ativar notificações
          </Button>
        )}
        <Button
          onClick={() => { void push.refresh(); refetch(); }}
          variant="outline"
          size="sm"
          className="h-10 px-5 rounded-xl gap-2 text-[10px] font-black uppercase tracking-wider border-white/10"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Verificar novamente
        </Button>
        <Button
          onClick={handleTestPush}
          disabled={sendingTest}
          variant="outline"
          size="sm"
          className="h-10 px-5 rounded-xl gap-2 text-[10px] font-black uppercase tracking-wider border-white/10"
        >
          <Send className="w-3.5 h-3.5" />
          {sendingTest ? 'Testando...' : 'Testar notificação'}
        </Button>
      </div>
    </Card>
  );
}
