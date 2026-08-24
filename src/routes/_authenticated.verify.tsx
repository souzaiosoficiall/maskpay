import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { getProfile, type ProfileWithRole } from '@/lib/settings.functions';
import { submitVerification } from '@/lib/kyc.functions';
import { useSessionReady } from '@/hooks/useSessionReady';
import { useState, useRef } from 'react';
import { 
  Fingerprint, 
  FileText, 
  User, 
  Camera, 
  Check, 
  ArrowRight, 
  ArrowLeft,
  Loader2,
  X,
  Upload,
  Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const Route = createFileRoute('/_authenticated/verify')({
  component: VerifyPage,
});

function VerifyPage() {
  const [step, setStep] = useState(1);
  const [docType, setDocType] = useState<'RG' | 'CNH'>('RG');
  const [files, setFiles] = useState<{
    front: File | null;
    back: File | null;
    selfie: File | null;
  }>({
    front: null,
    back: null,
    selfie: null
  });
  const [previews, setPreviews] = useState<{
    front: string | null;
    back: string | null;
    selfie: string | null;
  }>({
    front: null,
    back: null,
    selfie: null
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const navigate = useNavigate();
  const sessionReady = useSessionReady();
  const queryClient = useQueryClient();
  const fetchProfile = useServerFn(getProfile);
  const doSubmitVerification = useServerFn(submitVerification);

  const { data: profile, isLoading: isProfileLoading, isFetching, isError, refetch, error } = useQuery({
    queryKey: ['profile'],
    queryFn: () => fetchProfile({}),
    enabled: sessionReady,
    refetchOnWindowFocus: true,
    retry: 3,
    retryDelay: 800,
  }) as {
    data: ProfileWithRole | undefined;
    isLoading: boolean;
    isFetching: boolean;
    isError: boolean;
    refetch: () => void;
    error: Error | null;
  };

  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'front' | 'back' | 'selfie') => {
    const file = e.target.files?.[0];
    if (file) {
      setFiles(prev => ({ ...prev, [type]: file }));
      setPreviews(prev => ({ ...prev, [type]: URL.createObjectURL(file) }));
    }
  };

  const uploadFile = async (file: File, path: string) => {
    const { error } = await supabase.storage
      .from('kyc-documents')
      .upload(path, file, { 
        upsert: true,
        cacheControl: '3600'
      });
    
    if (error) throw error;
      
    return path;
  };

  const handleSubmit = async () => {
    if (!files.front || !files.back || !files.selfie) {
      toast.error('Por favor, envie todas as fotos necessárias.');
      return;
    }

    setIsSubmitting(true);
    try {
      const timestamp = Date.now();
      const folder = effectiveProfile?.id && effectiveProfile.id !== 'pending' ? effectiveProfile.id : 'anonymous';
      const frontPath = `${folder}/front_${timestamp}.${files.front.name.split('.').pop()}`;
      const backPath = `${folder}/back_${timestamp}.${files.back.name.split('.').pop()}`;
      const selfiePath = `${folder}/selfie_${timestamp}.${files.selfie.name.split('.').pop()}`;

      await Promise.all([
        uploadFile(files.front, frontPath),
        uploadFile(files.back, backPath),
        uploadFile(files.selfie, selfiePath)
      ]);

      await doSubmitVerification({
        data: {
          documentType: docType,
          frontPath,
          backPath,
          selfiePath
        }
      });

      // Clear profile query to force fresh state on dashboard
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      
      toast.success('Documentos enviados com sucesso! O suporte tem até 24 horas para realizar a liberação da conta.');
      
      // Delay navigation slightly to let state update
      setTimeout(() => {
        navigate({ to: '/dashboard' });
      }, 500);
    } catch (error: any) {
      toast.error('Erro ao enviar documentos: ' + (error.message || 'Erro desconhecido.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  // Wait for session + profile. getProfile is resilient and should always return a row.
  if (!sessionReady || isProfileLoading || (isFetching && !profile)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-8 animate-in fade-in duration-700">
        <div className="relative">
          <div className="w-16 h-16 rounded-3xl border-2 border-white/5 flex items-center justify-center relative z-10 bg-background/50 backdrop-blur-xl">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
          <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full -z-10 animate-pulse"></div>
        </div>
        <div className="text-center space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/90">Carregando verificação...</p>
          <p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/40">Preparando o envio dos documentos</p>
        </div>
      </div>
    );
  }

  // Soft fallback: still show the KYC form even if profile payload is incomplete.
  // Uploads only need an id for the storage path; submitVerification uses the auth userId server-side.
  const effectiveProfile = profile || ({ id: 'pending', verification_status: 'unverified' } as ProfileWithRole);

  return (
    <div className="max-w-3xl mx-auto py-6 md:py-10 px-4 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center gap-3 md:gap-4 mb-8 md:mb-10">
        <Link 
          to="/dashboard"
          className="flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-xl md:rounded-2xl text-muted-foreground hover:text-white border border-white/5 transition-colors shrink-0"
        >
          <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
        </Link>
        <div>
          <h1 className="text-xl md:text-3xl font-black uppercase tracking-tighter">Verificação</h1>
          <p className="text-[9px] md:text-xs font-bold text-muted-foreground uppercase tracking-widest mt-0.5 md:mt-1">Siga as etapas para liberar sua conta</p>
        </div>
      </div>


      <div className="flex items-center justify-between mb-12 relative px-4">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white/5 -translate-y-1/2 z-0"></div>
        {[1, 2, 3].map(s => (
          <div 
            key={s} 
            className={cn(
              "w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs z-10 transition-all border-2",
              step === s ? "bg-white text-black border-white" : 
              step > s ? "bg-white/10 text-white border-white/20" : 
              "bg-background text-muted-foreground/40 border-white/5"
            )}
          >
            {step > s ? <Check className="w-5 h-5" /> : s}
          </div>
        ))}
      </div>

      <Card className="border-white/5 bg-background border-2 rounded-[2rem] md:rounded-[2.5rem] overflow-hidden p-6 md:p-8">
        {step === 1 && (
          <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1 md:space-y-2">
                <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter">Confirme seus dados</h2>
                <p className="text-[9px] md:text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Verifique se as informações abaixo estão corretas.</p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => queryClient.invalidateQueries({ queryKey: ['profile'] })}
                className="text-[8px] md:text-[9px] font-black uppercase tracking-widest border-white/10 hover:bg-white/5 h-8 rounded-xl self-start sm:self-auto"
              >
                Atualizar
              </Button>
            </div>


            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest">Nome Completo</Label>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-bold text-white/80">
                  {profile?.full_name || (
                    <span className="text-destructive animate-pulse">Pendente no Cadastro</span>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest">E-mail</Label>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-bold text-white/80">
                  {profile?.email || 'Não informado'}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest">CPF / CNPJ</Label>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-bold text-white/80">
                  {profile?.document || (
                    <span className="text-destructive animate-pulse">Pendente no Cadastro</span>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest">Telefone</Label>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-bold text-white/80">
                  {profile?.phone || (
                    <span className="text-destructive animate-pulse">Pendente no Cadastro</span>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex gap-3">
              <Fingerprint className="w-5 h-5 text-primary shrink-0" />
              <p className="text-[10px] font-bold text-muted-foreground/60 uppercase leading-relaxed">
                Esses dados são carregados do seu cadastro. Se houver algum erro, entre em contato com o suporte antes de prosseguir.
              </p>
            </div>

            <Button 
              onClick={nextStep}
              className="w-full bg-white text-black hover:bg-white/90 rounded-2xl py-8 h-auto text-xs font-black uppercase tracking-widest gap-3"
            >
              Confirmar e Continuar <ArrowRight className="w-5 h-5" />
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="space-y-2">
              <h2 className="text-xl font-black uppercase tracking-tighter">Documento de Identificação</h2>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Selecione o tipo de documento e envie as fotos.</p>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setDocType('RG')}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all cursor-pointer gap-2",
                  docType === 'RG' ? "bg-white text-black border-white" : "bg-white/5 text-muted-foreground border-white/5 hover:border-white/10"
                )}
              >
                <FileText className="w-6 h-6" />
                <span className="text-[10px] font-black uppercase tracking-widest">RG</span>
              </button>
              <button
                type="button"
                onClick={() => setDocType('CNH')}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all cursor-pointer gap-2",
                  docType === 'CNH' ? "bg-white text-black border-white" : "bg-white/5 text-muted-foreground border-white/5 hover:border-white/10"
                )}
              >
                <FileText className="w-6 h-6" />
                <span className="text-[10px] font-black uppercase tracking-widest">CNH</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Frente do Documento</Label>
                <div 
                  onClick={() => frontInputRef.current?.click()}
                  className={cn(
                    "aspect-video rounded-3xl border-2 border-dashed flex flex-col items-center justify-center gap-4 cursor-pointer transition-all overflow-hidden relative group",
                    previews.front ? "border-white/20" : "border-white/10 hover:border-white/20"
                  )}
                >
                  {previews.front ? (
                    <>
                      <img src={previews.front} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Upload className="w-8 h-8 text-white" />
                      </div>
                    </>
                  ) : (
                    <>
                      <Camera className="w-10 h-10 text-muted-foreground/20" />
                      <span className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest">Enviar Foto</span>
                    </>
                  )}
                </div>
                <input 
                  type="file" 
                  ref={frontInputRef} 
                  className="hidden" 
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, 'front')}
                />
              </div>

              <div className="space-y-4">
                <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Verso do Documento</Label>
                <div 
                  onClick={() => backInputRef.current?.click()}
                  className={cn(
                    "aspect-video rounded-3xl border-2 border-dashed flex flex-col items-center justify-center gap-4 cursor-pointer transition-all overflow-hidden relative group",
                    previews.back ? "border-white/20" : "border-white/10 hover:border-white/20"
                  )}
                >
                  {previews.back ? (
                    <>
                      <img src={previews.back} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Upload className="w-8 h-8 text-white" />
                      </div>
                    </>
                  ) : (
                    <>
                      <Camera className="w-10 h-10 text-muted-foreground/20" />
                      <span className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest">Enviar Foto</span>
                    </>
                  )}
                </div>
                <input 
                  type="file" 
                  ref={backInputRef} 
                  className="hidden" 
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, 'back')}
                />
              </div>
            </div>

            <Button 
              disabled={!files.front || !files.back}
              onClick={nextStep}
              className="w-full bg-white text-black hover:bg-white/90 rounded-2xl py-8 h-auto text-xs font-black uppercase tracking-widest gap-3 disabled:opacity-50"
            >
              Continuar <ArrowRight className="w-5 h-5" />
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="space-y-2">
              <h2 className="text-xl font-black uppercase tracking-tighter">Foto com o Documento</h2>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Segure seu documento ao lado do rosto para a foto final.</p>
            </div>

            <div className="space-y-4">
              <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Selfie com Documento</Label>
              <div 
                onClick={() => selfieInputRef.current?.click()}
                className={cn(
                  "aspect-square rounded-3xl border-2 border-dashed flex flex-col items-center justify-center gap-4 cursor-pointer transition-all overflow-hidden relative group max-w-sm mx-auto",
                  previews.selfie ? "border-white/20" : "border-white/10 hover:border-white/20"
                )}
              >
                {previews.selfie ? (
                  <>
                    <img src={previews.selfie} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Upload className="w-8 h-8 text-white" />
                    </div>
                  </>
                ) : (
                  <>
                    <Camera className="w-10 h-10 text-muted-foreground/20" />
                    <span className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest text-center px-6">Posicione o documento ao lado do seu rosto</span>
                  </>
                )}
              </div>
              <input 
                type="file" 
                ref={selfieInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={(e) => handleFileChange(e, 'selfie')}
              />
            </div>

            <div className="flex gap-4 pt-4">
              <Button 
                variant="outline" 
                onClick={prevStep}
                className="flex-1 rounded-2xl py-8 h-auto text-[10px] font-black uppercase tracking-widest border-white/10 hover:bg-white/5"
              >
                Voltar
              </Button>
              <Button 
                disabled={!files.selfie || isSubmitting}
                onClick={handleSubmit}
                className="flex-[2] bg-white text-black hover:bg-white/90 rounded-2xl py-8 h-auto text-xs font-black uppercase tracking-widest shadow-xl shadow-white/5 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Enviando...
                  </div>
                ) : 'Finalizar Verificação'}
              </Button>
            </div>
          </div>
        )}
      </Card>

      <div className="mt-8 flex items-center justify-center gap-2">
        <Lock className="w-3 h-3 text-muted-foreground/40" />
        <span className="text-[8px] md:text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest">Seus dados estão protegidos por criptografia de ponta a ponta</span>
      </div>
    </div>
  );
}
