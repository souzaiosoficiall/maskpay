import { createFileRoute } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Key, 
  Plus, 
  Trash2, 
  Shield, 
  Eye, 
  Copy, 
  RefreshCw, 
  ExternalLink, 
  CheckCircle2,
  Lock,
  EyeOff,
  Settings2,
  X
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useSessionReady } from '@/hooks/useSessionReady';

const utmifyLogo = { url: "/assets/utmify-logo.png" };
const googleAnalyticsLogo = { url: "/assets/google-logo.png" };
import { 
  getUserIntegrations, 
  saveIntegration, 
  deleteIntegration 
} from '@/lib/integrations.functions';
import {
  listApiKeys,
  createApiKey,
  revokeApiKey,
} from '@/lib/api-keys.functions';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute('/_authenticated/api-keys')({
  component: ApiKeysPage,
});

function ApiKeysPage() {
  const queryClient = useQueryClient();
  const sessionReady = useSessionReady();
  const fetchUserIntegrations = useServerFn(getUserIntegrations);
  const saveUserIntegration = useServerFn(saveIntegration);
  const removeUserIntegration = useServerFn(deleteIntegration);
  const fetchApiKeys = useServerFn(listApiKeys);
  const doCreateApiKey = useServerFn(createApiKey);
  const doRevokeApiKey = useServerFn(revokeApiKey);

  const [freshClientId, setFreshClientId] = useState('');
  const [freshSecret, setFreshSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Modal State
  const [activeModal, setActiveModal] = useState<'utmify' | 'google' | null>(null);
  const [tokenValue, setTokenValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Fetch Integrations
  const { data: userIntegrations = [] } = useQuery({
    queryKey: ['userIntegrations'],
    queryFn: () => fetchUserIntegrations(),
    enabled: sessionReady,
    retry: false,
  });

  const { data: apiKeys = [], isLoading: loadingKeys } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => fetchApiKeys({}),
    enabled: sessionReady,
    staleTime: 15_000,
  });

  const saveMutation = useMutation({
    mutationFn: saveUserIntegration,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userIntegrations'] });
      toast.success('Integração salva com sucesso!');
      setActiveModal(null);
      setTokenValue('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao salvar integração');
    },
    onSettled: () => setIsSaving(false)
  });

  const deleteMutation = useMutation({
    mutationFn: removeUserIntegration,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userIntegrations'] });
      toast.success('Integração removida!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao remover integração');
    }
  });

  const generateCredentials = async () => {
    setIsGenerating(true);
    setFreshSecret('');
    setFreshClientId('');
    try {
      const result = await doCreateApiKey({ data: {} });
      setFreshClientId(result.clientId);
      setFreshSecret(result.secret);
      setShowSecret(true);
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast.success('Credenciais geradas! Copie o Secret agora — ele não será mostrado de novo.');
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao gerar chaves de API');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Revogar esta chave? Integrações que a usam deixarão de funcionar.')) return;
    try {
      await doRevokeApiKey({ data: { id } });
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast.success('Chave revogada.');
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao revogar chave');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const isConnected = (provider: string) => {
    return userIntegrations.some((int: any) => int.provider === provider);
  };

  const handleSave = () => {
    if (!tokenValue.trim()) {
      toast.error('Por favor, insira o valor solicitado.');
      return;
    }

    setIsSaving(true);
    const provider = activeModal!;
    const config = provider === 'utmify' ? { token: tokenValue } : { googleId: tokenValue };
    
    saveMutation.mutate({ data: { provider, config } });
  };

  const handleOpenModal = (provider: 'utmify' | 'google') => {
    // Always start empty — listed tokens are masked; user must re-enter to update
    setTokenValue('');
    setActiveModal(provider);
  };

  const handleDelete = (provider: string) => {
    if (confirm(`Tem certeza que deseja remover a integração com ${provider === 'utmify' ? 'Utmify' : 'Google Analytics'}?`)) {
      deleteMutation.mutate({ data: { provider } });
    }
  };

  const integrations = [
    {
      id: 'utmify',
      name: 'Utmify',
      description: 'Rastreamento avançado de UTMs e conversões via Token.',
      logo: utmifyLogo.url,
      color: 'bg-white/5',
      label: 'Token de API'
    },
    {
      id: 'google',
      name: 'Google Analytics',
      description: 'Monitore tráfego e conversões via Google ID.',
      logo: googleAnalyticsLogo.url,
      color: 'bg-white/5',
      label: 'Google ID (Mensuração)'
    }
  ];

  return (
    <div className="space-y-10 pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">API & Integrações |</h1>
          <p className="text-muted-foreground font-medium">Gerencie suas credenciais de acesso e conecte ferramentas externas.</p>
        </div>
      </div>

      {/* API Credentials Section */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-1 bg-white rounded-full"></div>
          <h2 className="text-xl font-black uppercase tracking-widest">Credenciais da API</h2>
        </div>
        
        <Card className="bg-card border-white/5 overflow-hidden">
          <CardHeader className="border-b border-white/5 bg-white/[0.02]">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Lock className="w-4 h-4" /> Acesso de Desenvolvedor
            </CardTitle>
            <CardDescription className="text-[10px] uppercase font-bold tracking-tighter opacity-50">
              Utilize estas chaves para integrar o MaskPay ao seu sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-8 space-y-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Client ID</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Key className="h-4 w-4 text-white/20 group-hover:text-white/40 transition-colors" />
                  </div>
                  <input 
                    type="text" 
                    readOnly 
                    value={freshClientId || '••••••••••••••••'} 
                    className="w-full bg-background border border-white/10 rounded-2xl py-4 pl-12 pr-12 text-sm font-mono tracking-wider focus:outline-none focus:border-white/20 transition-all text-white/80"
                  />
                  {freshClientId && (
                    <button 
                      onClick={() => copyToClipboard(freshClientId, 'Client ID')}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-muted-foreground hover:text-white transition-colors"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Secret</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Shield className="h-4 w-4 text-white/20 group-hover:text-white/40 transition-colors" />
                  </div>
                  <input 
                    type={showSecret ? "text" : "password"} 
                    readOnly 
                    value={freshSecret || '••••••••••••••••••••••••••••'} 
                    className="w-full bg-background border border-white/10 rounded-2xl py-4 pl-12 pr-24 text-sm font-mono tracking-wider focus:outline-none focus:border-white/20 transition-all text-white/80"
                  />
                  {freshSecret && (
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center gap-3">
                      <button 
                        onClick={() => setShowSecret(!showSecret)}
                        className="text-muted-foreground hover:text-white transition-colors"
                      >
                        {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <button 
                        onClick={() => copyToClipboard(freshSecret, 'Secret')}
                        className="text-muted-foreground hover:text-white transition-colors"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-center pt-4">
              <Button 
                onClick={generateCredentials}
                disabled={isGenerating}
                className="bg-white text-black hover:bg-white/90 rounded-2xl px-8 py-6 text-xs font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
              >
                {isGenerating ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                {freshClientId ? 'Gerar nova chave' : 'Gerar Minhas Credenciais'}
              </Button>
            </div>

            {freshSecret && (
              <p className="text-center text-[11px] font-medium text-amber-400/90">
                Secret visível apenas agora. Copie e guarde em local seguro.
              </p>
            )}

            <div className="space-y-3 pt-2 border-t border-white/5">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Chaves ativas {loadingKeys ? '…' : `(${(apiKeys as any[]).length})`}
              </p>
              {(apiKeys as any[]).length === 0 && !loadingKeys && (
                <p className="text-xs text-muted-foreground">Nenhuma chave gerada ainda.</p>
              )}
              {(apiKeys as any[]).map((k: any) => (
                <div
                  key={k.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-sm text-white/90 truncate">{k.clientId}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Criada em {k.createdAt ? new Date(k.createdAt).toLocaleString('pt-BR') : '—'}
                      {k.lastUsedAt ? ` · Último uso ${new Date(k.lastUsedAt).toLocaleString('pt-BR')}` : ''}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRevoke(k.id)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Revogar
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Integrations Section */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-1 bg-white rounded-full"></div>
          <h2 className="text-xl font-black uppercase tracking-widest">Integrações Disponíveis</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {integrations.map((integration) => {
            const connected = isConnected(integration.id);
            return (
              <Card key={integration.id} className="bg-card border-white/5 group hover:border-white/10 transition-all">
                <CardContent className="p-8">
                  <div className="flex items-start justify-between mb-6">
                    <div className={`w-16 h-16 rounded-2xl ${integration.color} flex items-center justify-center overflow-hidden p-3`}>
                      <img src={integration.logo} alt={integration.name} className="w-full h-full object-contain" />
                    </div>
                    {connected ? (
                      <div className="flex items-center gap-2 bg-green-500/10 text-green-500 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                        <CheckCircle2 className="w-3 h-3" /> Conectado
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 bg-white/5 text-white/40 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                        Pendente
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 mb-8">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-black uppercase tracking-tighter">{integration.name} |</h3>
                      {connected && (
                        <button 
                          onClick={() => handleDelete(integration.id)}
                          className="text-red-500/50 hover:text-red-500 transition-colors"
                          title="Remover Integração"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground font-medium leading-relaxed">
                      {integration.description}
                    </p>
                  </div>
                  <Button 
                    onClick={() => handleOpenModal(integration.id as 'utmify' | 'google')}
                    className="w-full bg-background border border-white/10 hover:bg-white/5 hover:border-white/20 text-white rounded-2xl py-6 text-[10px] font-black uppercase tracking-[0.2em] transition-all group-hover:scale-[1.02] cursor-pointer"
                  >
                    {connected ? 'Editar Configuração' : 'Configurar Conexão'} <Settings2 className="ml-2 h-3 w-3" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Integration Modal */}
      <Dialog open={activeModal !== null} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="bg-card border-white/10 text-white sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tighter">
              Configurar {activeModal === 'utmify' ? 'Utmify' : 'Google Analytics'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Insira as informações necessárias para ativar a integração.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="token" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {activeModal === 'utmify' ? 'Token de API Utmify' : 'Google Measurement ID (G-XXXXX)'}
              </Label>
              <Input
                id="token"
                placeholder={activeModal === 'utmify' ? "Insira seu token..." : "G-XXXXXXXXXX"}
                value={tokenValue}
                onChange={(e) => setTokenValue(e.target.value)}
                className="bg-background border-white/10 text-white rounded-xl py-6 focus:ring-white/20"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActiveModal(null)}
              className="bg-transparent border-white/10 text-white hover:bg-white/5 rounded-xl px-6 py-6 text-[10px] font-black uppercase tracking-widest"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-white text-black hover:bg-white/90 rounded-xl px-8 py-6 text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
            >
              {isSaving ? 'Salvando...' : 'Salvar Integração'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Safety Alert */}
      <Card className="bg-white/5 border-dashed border-white/10">
        <CardContent className="py-10 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
            <Shield className="h-6 w-6 text-white/40" />
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-black uppercase tracking-widest">Protocolo de Segurança</h4>
            <p className="text-xs text-muted-foreground max-w-lg mx-auto leading-loose font-medium">
              Suas chaves de API garantem acesso total à sua conta. Nunca as compartilhe em repositórios públicos, fóruns ou com terceiros não autorizados. Recomendamos a rotação das chaves a cada 90 dias.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
