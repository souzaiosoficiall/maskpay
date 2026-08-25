import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: (dontShowAgain: boolean) => void;
  title: string;
  description: string;
}

/**
 * Centered system announcement — soft rounded card, subject on top,
 * message below, round toggle for "don't show again".
 */
export function NotificationModal({
  isOpen,
  onClose,
  title,
  description,
}: NotificationModalProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setDontShowAgain(false);
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  const handleDismiss = () => onClose(dontShowAgain);

  const panel = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Fechar aviso"
        className={cn(
          'absolute inset-0 bg-black/65 backdrop-blur-sm transition-opacity duration-300',
          visible ? 'opacity-100' : 'opacity-0',
        )}
        onClick={handleDismiss}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sys-notif-title"
        className={cn(
          'relative z-10 flex w-full max-w-[400px] flex-col overflow-hidden',
          'rounded-[1.75rem] border border-white/10 bg-[#111] shadow-2xl',
          'max-h-[min(82vh,560px)]',
          'transition-all duration-300 ease-out',
          visible
            ? 'translate-y-0 scale-100 opacity-100'
            : 'translate-y-4 scale-95 opacity-0',
        )}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/[0.06] to-transparent" />

        <div className="relative flex shrink-0 items-center gap-3 px-5 pb-3 pt-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-black shadow-md">
            <Bell className="h-4 w-4" strokeWidth={2.25} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
              Aviso do sistema
            </p>
            <p className="text-[11px] font-medium text-white/55">Comunicado oficial</p>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-2 custom-scrollbar">
          <h2
            id="sys-notif-title"
            className="text-lg font-bold leading-snug tracking-tight text-white sm:text-xl"
          >
            {title}
          </h2>

          <div className="mt-3 space-y-2.5 text-[13px] leading-relaxed text-white/65 sm:text-sm">
            {(description || '')
              .split('\n')
              .map((line, i) => (
                <p key={i} className="break-words">
                  {line.trim() === '' ? '\u00A0' : line}
                </p>
              ))}
            {!description?.trim() && (
              <p className="italic text-white/35">Sem mensagem adicional.</p>
            )}
          </div>
        </div>

        <div className="relative shrink-0 space-y-3 border-t border-white/8 px-5 pb-5 pt-4">
          <button
            type="button"
            onClick={() => setDontShowAgain((v) => !v)}
            className="flex w-full items-center gap-3 rounded-2xl px-1 py-1 text-left transition-colors hover:bg-white/[0.03]"
          >
            <span
              className={cn(
                'relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200',
                dontShowAgain
                  ? 'border-white bg-white'
                  : 'border-white/30 bg-transparent',
              )}
              aria-hidden
            >
              {dontShowAgain && (
                <span className="h-2.5 w-2.5 rounded-full bg-black" />
              )}
            </span>
            <span className="text-[12px] font-medium text-white/60">
              Não mostrar este aviso novamente
            </span>
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            className="flex h-12 w-full items-center justify-center rounded-full bg-white text-[12px] font-bold uppercase tracking-[0.14em] text-black transition-transform active:scale-[0.98] hover:bg-white/90"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
