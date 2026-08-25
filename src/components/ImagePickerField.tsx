import { useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { fileToCompressedDataUrl } from '@/lib/image-upload';
import { cn } from '@/lib/utils';

type Props = {
  label: string;
  value?: string | null;
  onChange: (dataUrl: string | null) => void;
  aspect?: 'square' | 'banner';
  className?: string;
};

export function ImagePickerField({ label, value, onChange, aspect = 'square', className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file?: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const max = aspect === 'banner' ? 1600 : 800;
      const url = await fileToCompressedDataUrl(file, max, 0.85);
      onChange(url);
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao carregar imagem.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border border-dashed border-white/15 bg-white/[0.03]',
          aspect === 'banner' ? 'h-32' : 'h-28 w-28',
        )}
      >
        {value ? (
          <>
            <img src={value} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(null)}
              className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground hover:text-white"
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <ImagePlus className="h-6 w-6" />
                <span className="text-[10px] font-bold uppercase tracking-wide">Galeria</span>
              </>
            )}
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </div>
      {value && (
        <button
          type="button"
          className="text-[10px] font-bold uppercase tracking-widest text-primary"
          onClick={() => inputRef.current?.click()}
        >
          Trocar imagem
        </button>
      )}
    </div>
  );
}
