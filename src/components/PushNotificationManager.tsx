import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { markPushPromptDismissed, wasPushPromptRecentlyDismissed } from '@/lib/push-client';
import { useSessionReady } from '@/hooks/useSessionReady';

/**
 * Mounted once inside the authenticated shell.
 * - Silently verifies SW + Push Subscription + backend save on every open.
 * - If permission is already granted, re-syncs subscription without requiring
 *   the user to open Configurações › Notificações.
 * - Banner only when permission is still "default".
 */
export function PushNotificationManager() {
  const sessionReady = useSessionReady();
  const push = usePushNotifications(sessionReady);
  const [dismissed, setDismissed] = useState(() => wasPushPromptRecentlyDismissed());
  const [activating, setActivating] = useState(false);

  // Permission already granted → ensure subscription is saved (no need to "test" in settings)
  useEffect(() => {
    if (!sessionReady) return;
    if (push.permission !== 'granted') return;
    if (push.isFullyActive) return;
    void push.refresh();
  }, [sessionReady, push.permission, push.isFullyActive, push.state, push.refresh]);

  // Show banner on PWA and on regular HTTPS browser (Chrome/Edge support web push in tabs)
  const showBanner = push.state === 'permission_default' && !dismissed;

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
