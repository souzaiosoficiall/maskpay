import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Loader2, Fingerprint } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { getKycRequestAdmin } from '@/lib/admin.functions';
import { useSessionReady } from '@/hooks/useSessionReady';
import { supabase } from '@/integrations/supabase/client';

interface KycModerationProps {
  userId: string | null;
  kycRequests?: any[];
  onSelectKyc?: (id: string | null) => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string, type: 'reject' | 'delete') => void;
}

export function KycModerationView({ 
  userId, 
  kycRequests, 
  onSelectKyc, 
  onApprove, 
  onReject 
}: KycModerationProps) {
  const fetchKycRequest = useServerFn(getKycRequestAdmin);
  const sessionReady = useSessionReady();
  
  const { data: request, isLoading } = useQuery({
    queryKey: ['kyc_request', userId],
    queryFn: async () => {
      const res = await fetchKycRequest({ data: userId! });
      console.log('KYC Request Response:', res);
      return res;
    },
    enabled: sessionReady && !!userId,
    staleTime: 15_000,
    refetchOnMount: 'always'
  });

  const getSignedUrl = async (path: string) => {
    const { data, error } = await supabase.storage
      .from('kyc-documents')
      .createSignedUrl(path, 3600);
    if (error) return null;
    return data.signedUrl;
  };

  if (!userId) {
    return (
      <div className="flex flex-col lg:flex-row gap-6 h-full min-h-[500px]">
        <div className="w-full lg:w-1/3 border-b lg:border-b-0 lg:border-r border-white/5 pb-6 lg:pb-0 lg:pr-6 overflow-y-auto max-h-[400px] lg:max-h-[600px] custom-scrollbar">
          <div className="space-y-1">
            {kycRequests?.map((k: any) => (
              <button 
                key={k.id}
                onClick={() => onSelectKyc?.(k.id)}
                className="w-full text-left p-4 md:p-6 transition-colors hover:bg-white/[0.02] group rounded-2xl border border-transparent hover:border-white/5"
              >
                <p className="text-xs font-black uppercase tracking-tighter text-white">{k.full_name}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1 uppercase font-bold tracking-wider">{k.email}</p>
              </button>
            ))}
            {(!kycRequests || kycRequests.length === 0) && (
              <div className="p-12 text-center text-muted-foreground/20 text-[10px] font-black uppercase tracking-widest">
                Sem solicitações pendentes
              </div>
            )}
          </div>
        </div>
        <div className="hidden lg:flex flex-1 flex-col items-center justify-center p-12 text-center opacity-10">
          <Fingerprint className="w-16 h-16 mb-6" />
          <p className="text-[10px] font-black uppercase tracking-widest text-white">Selecione uma solicitação para analisar</p>
        </div>
        <div className="lg:hidden p-8 text-center opacity-20">
          <p className="text-[10px] font-black uppercase tracking-widest">Toque em um usuário acima para moderar</p>
        </div>
      </div>
    );
  }


  if (isLoading) return <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  if (!request) return (
    <div className="py-20 text-center space-y-4">
      <Fingerprint className="w-12 h-12 mx-auto text-muted-foreground/20" />
      <div className="text-muted-foreground text-[10px] font-black uppercase tracking-widest">
        Nenhum documento encontrado para análise
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500 min-h-[500px]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b border-white/5 pb-6">
        <div>
          <h3 className="text-sm font-black uppercase tracking-tighter text-white">Análise de KYC</h3>
          <p className="text-[9px] text-muted-foreground font-black uppercase tracking-widest mt-1">Analisando documentos de {userId}</p>
        </div>
        <div className="flex w-full sm:w-auto gap-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => onSelectKyc?.(null)}
            className="rounded-xl mr-auto sm:mr-4 text-[9px] font-black uppercase tracking-widest"
          >
            Voltar
          </Button>
          <Button 
            variant="destructive" 
            size="sm"
            onClick={() => {
              if (confirm('Recusar esta conta? O usuário poderá tentar novamente.')) {
                onReject?.(userId, 'reject');
              } else if (confirm('Deletar este usuário permanentemente?')) {
                onReject?.(userId, 'delete');
              }
            }}
            className="rounded-xl text-[9px] font-black uppercase tracking-widest h-9 px-4 sm:h-10 sm:px-6"
          >
            Recusar
          </Button>
          <Button 
            variant="default" 
            size="sm"
            onClick={() => onApprove?.(userId)}
            className="bg-green-500 hover:bg-green-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest h-9 px-4 sm:h-10 sm:px-6"
          >
            Aprovar
          </Button>
        </div>
      </div>

      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Frente do Documento', path: request.front_path || '' },
          { label: 'Verso do Documento', path: request.back_path || '' },
          { label: 'Selfie com Documento', path: request.selfie_path || '' }
        ].map((doc, i) => (
          <KycImageItem key={i} label={doc.label} path={doc.path} getSignedUrl={getSignedUrl} />
        ))}
      </div>
    </div>
  );
}

function KycImageItem({ label, path, getSignedUrl }: { label: string, path: string, getSignedUrl: (path: string) => Promise<string | null> }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    getSignedUrl(path).then(setUrl);
  }, [path]);

  return (
    <div className="space-y-4">
      <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{label}</Label>
      <div className="aspect-square rounded-3xl border border-white/10 overflow-hidden bg-white/5 group relative">
        {url ? (
          <img 
            src={url} 
            className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform" 
            onClick={() => window.open(url, '_blank')}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}