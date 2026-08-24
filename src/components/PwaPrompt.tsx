import { useState, useEffect } from 'react';
import { Bell, X, Share, PlusSquare, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

export function PwaPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(ios);

    // Check if already in standalone mode (installed app)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                       (window.navigator as any).standalone ||
                       document.referrer.includes('android-app://');

    if (isStandalone) return;

    const dismissed = localStorage.getItem('pwa_prompt_dismissed');
    if (!dismissed) setShowPrompt(true);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    const onInstalled = () => {
      setShowPrompt(false);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (choice?.outcome === 'accepted') setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa_prompt_dismissed', 'true');
  };


  return (
    <AnimatePresence>
      {showPrompt && (
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
                  Adicione nosso site à tela inicial!
                </p>
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight leading-tight truncate">
                  {isIOS 
                    ? "Toque em 'Compartilhar' e depois em 'Adicionar à Tela de Início'" 
                    : "Receba notificações e acesse mais rápido como um aplicativo."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isIOS && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10 hidden sm:flex">
                  <Share className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[9px] font-black uppercase text-muted-foreground">+</span>
                  <PlusSquare className="w-3 h-3 text-muted-foreground" />
                </div>
              )}
              {!isIOS && deferredPrompt && (
                <Button
                  onClick={handleInstall}
                  size="sm"
                  className="h-8 px-3 rounded-lg gap-1.5 text-[10px] font-black uppercase tracking-wider"
                >
                  <Download className="w-3.5 h-3.5" />
                  Instalar
                </Button>
              )}
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
