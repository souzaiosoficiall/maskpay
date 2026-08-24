import { useState } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { markPushPromptDismissed, wasPushPromptRecentlyDismissed } from '@/lib/push-client';
import { useSessionReady } from '@/hooks/useSessionReady';

/**
 * Mounted once inside the authenticated shell. Silently runs the full
 * verification flow (SW active? subscription valid? saved on backend?) on
 * every app open, and only surfaces UI when there's something the user can
 * actually act on: granting notification permission.
 *
 * Every other outcome (not installed as PWA, unsupported device, denied
 * permission, SW/backend failures) is intentionally NOT nagged about here —
 * it's surfaced instead in Configurações › Notificações (NotificationDiagnostics),
 * so we never spam the user but the real state is always inspectable.
 */
export function PushNotificationManager() {
  const sessionReady = useSessionReady();
  const push = usePushNotifications(sessionReady);
  const [dismissed, setDismissed] = useState(() => wasPushPromptRecentlyDismissed());
  const [activating, setActivating] = useState(false);

  const showBanner = push.state === 'permission_default' && push.isStandalone && !dismissed;

  const handleActivate = async () => {
    setActivating(true);
    try {
      await push.activate();
    } finally {
      setActivating(false);
    }
  };

  const handleDismiss = () => {
    markPushPromptDismissed();
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-card border-b border-primary/20 overflow-hidden relative z-10"
        >
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                <Bell className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="flex flex-col min-w-0">
                <p className="text-[10px] md:text-[11px] font-black uppercase tracking-wider text-white leading-tight">
                  Ative as notificações
                </p>
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight leading-tight truncate">
                  Saiba na hora quando um PIX cair na sua conta.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                onClick={handleActivate}
                disabled={activating}
                size="sm"
                className="h-8 px-3 rounded-lg gap-1.5 text-[10px] font-black uppercase tracking-wider"
              >
                {activating ? 'Ativando...' : 'Ativar'}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDismiss}
                className="w-8 h-8 rounded-lg hover:bg-white/5 text-muted-foreground/40 hover:text-white"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
