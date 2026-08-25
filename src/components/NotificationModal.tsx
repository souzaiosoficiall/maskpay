import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Bell, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: (dontShowAgain: boolean) => void;
  title: string;
  description: string;
}

/**
 * System announcement panel — slides up from the bottom, straight edges,
 * readable scroll for long messages.
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

  // Enter / exit animation
  useEffect(() => {
    if (isOpen) {
      setDontShowAgain(false);
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
  }, [isOpen]);

  // Lock body scroll while open
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
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Fechar aviso"
        className={cn(
          'absolute inset-0 bg-black/70 backdrop-blur-[2px] transition-opacity duration-300',
          visible ? 'opacity-100' : 'opacity-0',
        )}
        onClick={handleDismiss}
      />

      {/* Panel — full width on mobile bottom sheet, centered card on desktop */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sys-notif-title"
        className={cn(
          'relative z-10 flex w-full max-w-lg flex-col border border-white/10 bg-[#0c0c0c] shadow-2xl',
          // Straight edges (slight radius only on top corners for mobile sheet)
          'rounded-none sm:rounded-sm',
          'max-h-[min(88vh,640px)]',
          'transition-all duration-300 ease-out',
          visible
            ? 'translate-y-0 opacity-100'
            : 'translate-y-full opacity-0 sm:translate-y-8',
        )}
      >
        {/* Top accent line */}
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-white/80 to-transparent" />

        {/* Header */}
        <div className="flex shrink-0 items-start gap-3 border-b border-white/10 px-5 py-4 sm:px-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-white/15 bg-white text-black">
            <Bell className="h-4 w-4" strokeWidth={2.25} />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">
              Comunicado oficial
            </p>
            <h2
              id="sys-notif-title"
              className="mt-1 text-base font-semibold tracking-tight text-white sm:text-lg"
            >
              Aviso do sistema
            </h2>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="flex h-9 w-9 shrink-0 items-center justify-center border border-white/10 text-white/50 transition-colors hover:border-white/25 hover:bg-white/5 hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body — scrollable for long content */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6 custom-scrollbar">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-white sm:text-[15px]">
            {title}
          </h3>
          <div className="mt-3 space-y-3 border-l-2 border-white/20 pl-4 text-[13px] leading-relaxed text-white/70 sm:text-sm">
            {(description || '')
              .split('\n')
              .filter((line) => line.length > 0 || description.includes('\n\n'))
              .map((line, i) => (
                <p key={i} className={line.trim() === '' ? 'h-2' : 'break-words'}>
                  {line.trim() === '' ? '\u00A0' : line}
                </p>
              ))}
            {!description?.trim() && (
              <p className="text-white/40 italic">Sem mensagem adicional.</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 space-y-3 border-t border-white/10 px-5 py-4 sm:px-6">
          <label
            htmlFor="dontShowAgain"
            className="flex cursor-pointer items-center gap-3 border border-white/10 bg-white/[0.02] px-3 py-3 transition-colors hover:bg-white/[0.04]"
          >
            <Checkbox
              id="dontShowAgain"
              checked={dontShowAgain}
              onCheckedChange={(checked) => setDontShowAgain(!!checked)}
              className="h-4 w-4 rounded-none border-white/30 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-black"
            />
            <span className="text-[11px] font-medium uppercase tracking-wider text-white/55">
              Não mostrar este aviso novamente
            </span>
          </label>

          <Button
            type="button"
            onClick={handleDismiss}
            className="h-11 w-full rounded-none bg-white text-[11px] font-bold uppercase tracking-[0.18em] text-black hover:bg-white/90"
          >
            Entendi
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
