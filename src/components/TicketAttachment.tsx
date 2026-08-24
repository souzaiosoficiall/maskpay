import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ImageOff } from 'lucide-react';

const BUCKET = 'ticket-attachments';

/** Extracts the storage object path from either a raw path or a legacy public/sign URL. */
function extractPath(value: string): string {
  if (!value.startsWith('http')) return value.replace(/^\/+/, '');
  const marker = `/${BUCKET}/`;
  const idx = value.indexOf(marker);
  if (idx === -1) return value;
  return value.slice(idx + marker.length).split('?')[0]!;
}

export function TicketAttachment({ url, className }: { url: string; className?: string }) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setSignedUrl(null);
    setFailed(false);

    const path = extractPath(url);

    supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60)
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data?.signedUrl) {
          console.error('Attachment signed URL error:', error);
          setFailed(true);
          return;
        }
        setSignedUrl(data.signedUrl);
      })
      .catch(() => active && setFailed(true));

    return () => {
      active = false;
    };
  }, [url]);

  if (failed) {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
        <ImageOff className="h-3 w-3" /> Anexo indisponível
      </div>
    );
  }

  if (!signedUrl) {
    return (
      <div className="mt-4 flex h-24 items-center justify-center rounded-xl border border-white/10 bg-white/5">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={className ?? 'mt-4 overflow-hidden rounded-xl border border-white/10'}>
      <img
        src={signedUrl}
        alt="Anexo do ticket"
        loading="lazy"
        className="h-auto w-full cursor-pointer transition-opacity hover:opacity-80"
        onClick={() => window.open(signedUrl, '_blank')}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
