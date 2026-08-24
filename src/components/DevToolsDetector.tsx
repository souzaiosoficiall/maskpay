import { useEffect, useState } from 'react';

export function DevToolsDetector() {
  const [isDetected, setIsDetected] = useState(false);

  useEffect(() => {
    // 1. Context Menu blocking
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // 2. Keyboard shortcuts blocking (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.ctrlKey && e.key === 'u')
      ) {
        e.preventDefault();
        triggerProtection();
      }
    };

    const triggerProtection = () => {
      setIsDetected(true);
      // Try to open the security video in a new tab if allowed
      try {
        window.open('https://www.youtube.com/watch?v=kYJjYy_PmqA', '_blank');
      } catch (e) {
        console.error('Popup blocked');
      }
    };

    // 3. Detect DevTools via debugger / timing (casual inspection)
    let checkInterval: any;
    
    // Skip debugger detection in development environment to allow debugging
    const detect = () => {
      if (import.meta.env.DEV) return;
      
      const start = new Date().getTime();
      debugger;
      const end = new Date().getTime();
      if (end - start > 100) {
        triggerProtection();
      }

      // 2. Window dimension check (casual check for panel opening)
      // We use a safe threshold to avoid false positives on zoom or small screens
      const threshold = 160;
      const widthDiff = window.outerWidth - window.innerWidth > threshold;
      const heightDiff = window.outerHeight - window.innerHeight > threshold;
      
      if (widthDiff || heightDiff) {
        // Only trigger if not a mobile device to avoid false positives on orientation change
        if (!/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
          triggerProtection();
        }
      }
    };

    // Verificação periódica (intervalo maior para não pesar na performance)
    if (!import.meta.env.DEV) {
      checkInterval = setInterval(detect, 5000);
    }

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
      clearInterval(checkInterval);
    };
  }, []);

  if (!isDetected) return null;

  return (
    <div className="fixed inset-0 z-[999999] bg-black flex flex-col items-center justify-center p-6 text-center select-none">
      <div className="max-w-md space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="w-24 h-24 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-12 h-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        
        <div className="space-y-4">
          <h1 className="text-3xl font-black uppercase tracking-tighter text-white">Acesso Restrito</h1>
          <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs leading-relaxed">
            Tentativa de inspeção detectada. Por motivos de segurança, esta sessão foi interrompida.
          </p>
        </div>

        <div className="pt-8">
          <button 
            onClick={() => window.location.href = '/'}
            className="inline-flex items-center justify-center rounded-full bg-white px-10 py-4 text-sm font-black text-black transition-all hover:scale-105 uppercase tracking-widest shadow-xl cursor-pointer"
          >
            Voltar para o Início
          </button>
        </div>
        
        <div className="pt-12 opacity-20">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em]">MaskPay Security System</p>
        </div>
      </div>
    </div>
  );
}
