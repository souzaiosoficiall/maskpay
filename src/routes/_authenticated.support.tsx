import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { MessageSquare, Plus, Search, Filter, History, Clock, Send, Paperclip, X, User as UserIcon, Shield, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createTicket, getTickets, getTicketMessages, sendTicketMessage } from '@/lib/support.functions';
import { useServerFn } from '@tanstack/react-start';
import { useSessionReady } from '@/hooks/useSessionReady';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { TicketAttachment } from '@/components/TicketAttachment';

export const Route = createFileRoute('/_authenticated/support')({
  component: SupportPage,
});

function SupportPage() {
  const [activeTab, setActiveTab] = useState<'Aberto' | 'Resolvido'>('Aberto');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [newTicketStep, setNewTicketStep] = useState<1 | 2>(1);
  const [subject, setSubject] = useState<'Conta' | 'Financeiro' | 'Sugestão'>('Conta');
  const [message, setMessage] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const modalFileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const sessionReady = useSessionReady();
  const fetchTickets = useServerFn(getTickets);
  const fetchMessages = useServerFn(getTicketMessages);
  const doCreateTicket = useServerFn(createTicket);
  const doSendMessage = useServerFn(sendTicketMessage);

  const { data: tickets = [], isLoading: isLoadingTickets } = useQuery({
    queryKey: ['tickets'],
    queryFn: () => fetchTickets({}),
    enabled: sessionReady,
  });

  const { data: messages = [], isLoading: isLoadingMessages } = useQuery({
    queryKey: ['ticket_messages', selectedTicketId],
    queryFn: () => fetchMessages({ data: selectedTicketId! }),
    refetchInterval: 8000,

    enabled: sessionReady && !!selectedTicketId,
  });

  const selectedTicket = tickets.find((t: any) => t.id === selectedTicketId);

  const filteredTickets = useMemo(() => 
    tickets.filter((t: any) => 
      t.status === activeTab && 
      (t.subject.toLowerCase().includes(searchQuery.toLowerCase()) || 
       t.id.toLowerCase().includes(searchQuery.toLowerCase()))
    ),
  [tickets, activeTab, searchQuery]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAttachment(file);
    setAttachmentUrl(URL.createObjectURL(file));
  };

  const uploadFile = async (file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `${currentUser?.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('ticket-attachments')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error details:', uploadError);
      const errorMsg = typeof uploadError === 'object' ? JSON.stringify(uploadError) : String(uploadError);
      throw new Error(`Falha no upload: ${errorMsg}`);
    }

    // Bucket is private: store the object path and resolve signed URLs at render time.
    return filePath;
  };

  const createTicketMutation = useMutation({
    mutationFn: async () => {
      setIsUploading(true);
      let finalUrl = undefined;
      if (attachment) {
        finalUrl = await uploadFile(attachment);
      }
      
      return doCreateTicket({
        data: {
          subject,
          message,
          attachmentUrl: finalUrl
        }
      });
    },
    onSuccess: (newTicket) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      setIsModalOpen(false);
      resetForm();
      toast.success('Ticket aberto com sucesso!');
      setIsUploading(false);
      if (newTicket?.id) {
        setSelectedTicketId(newTicket.id);
      }
    },
    onError: (err: any) => {
      toast.error('Erro ao abrir ticket: ' + (err.message || 'Erro inesperado ao processar o ticket.'));
      console.error('Create ticket error:', err);
      setIsUploading(false);
    }
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      setIsUploading(true);
      let finalUrl = undefined;
      if (attachment) {
        finalUrl = await uploadFile(attachment);
      }
      
      return doSendMessage({
        data: {
          ticketId: selectedTicketId!,
          content,
          attachmentUrl: finalUrl
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket_messages', selectedTicketId] });
      setMessage('');
      setAttachment(null);
      setAttachmentUrl(null);
      setIsUploading(false);
    },
    onError: (err: any) => {
      toast.error('Erro ao enviar mensagem: ' + err.message);
      setIsUploading(false);
    }
  });

  const resetForm = () => {
    setNewTicketStep(1);
    setSubject('Conta');
    setMessage('');
    setAttachment(null);
    setAttachmentUrl(null);
  };

  const [currentUser, setCurrentUser] = useState<any>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user));
  }, []);

  return (
    <div className="space-y-10 pb-16 font-sans">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Suporte |</h1>
          <p className="text-muted-foreground font-semibold text-base">Estamos aqui para ajudar você a escalar sua operação.</p>
        </div>
        <Button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-white text-black hover:bg-white/90 rounded-2xl px-8 h-12 text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-white/5"
        >
          <Plus className="mr-2 h-4 w-4" /> Novo Ticket
        </Button>
      </div>

      <div className="flex gap-4">
        <button 
          onClick={() => setActiveTab('Aberto')}
          className={cn(
            "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
            activeTab === 'Aberto' ? "bg-white/10 text-white border-white/20" : "text-muted-foreground border-transparent hover:text-white"
          )}
        >
          Abertos
        </button>
        <button 
          onClick={() => setActiveTab('Resolvido')}
          className={cn(
            "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
            activeTab === 'Resolvido' ? "bg-white/10 text-white border-white/20" : "text-muted-foreground border-transparent hover:text-white"
          )}
        >
          Resolvidos
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border-white/5 bg-background border-2 rounded-[2.5rem] overflow-hidden">
          <CardHeader className="p-6 border-b border-white/5">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
              <input 
                placeholder="BUSCAR TICKETS..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-[9px] font-black tracking-widest text-white uppercase"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0 max-h-[600px] overflow-y-auto custom-scrollbar">
            {filteredTickets.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground/40 text-xs font-black uppercase tracking-widest">
                Nenhum ticket encontrado
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {filteredTickets.map((t: any) => (
                  <button 
                    key={t.id}
                    onClick={() => setSelectedTicketId(t.id)}
                    className={cn(
                      "w-full text-left p-6 transition-colors hover:bg-white/[0.02] group",
                      selectedTicketId === t.id && "bg-white/[0.04]"
                    )}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest">{format(new Date(t.created_at), 'dd MMM, HH:mm', { locale: ptBR })}</span>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border",
                        t.status === 'Resolvido' ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-blue-500/10 text-blue-500 border-blue-500/20"
                      )}>
                        {t.status === 'Resolvido' ? 'RESOLVIDO' : t.status}
                      </span>
                    </div>
                    <p className="text-xs font-black uppercase tracking-tighter text-white group-hover:text-primary transition-colors">{t.subject}</p>
                    <p className="text-[10px] text-muted-foreground truncate mt-1">Clique para ver a conversa</p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-white/5 bg-background border-2 rounded-[2.5rem] overflow-hidden flex flex-col min-h-[600px]">
          {selectedTicket ? (
            <>
              <CardHeader className="p-6 border-b border-white/5 bg-white/[0.02]">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-tighter">{selectedTicket.subject}</h2>
                    <p className="text-[9px] text-muted-foreground font-black uppercase tracking-widest">Ticket ID: {selectedTicket.id.slice(0, 8)}</p>
                  </div>
                  {selectedTicket.status === 'Aberto' && (
                    <span className="flex items-center gap-2 text-[9px] font-black text-blue-500 uppercase tracking-widest">
                      <Clock className="w-3 h-3" /> Aguardando resposta
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6">
                {messages.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center opacity-20 py-12">
                    <MessageSquare className="w-12 h-12 mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma mensagem nesta conversa</p>
                  </div>
                ) : messages.map((m: any) => {
                  const isBot = m.user_id === null;
                  const isSupport = isBot || (m.metadata?.sender_name === 'SUPORTE MASK');
                  
                  // IN CLIENT VIEW:
                  // Client/User messages = RIGHT
                  // Support/Admin messages = LEFT
                  const isRightSide = !isSupport;

                  return (
                    <div 
                      key={m.id}
                      className={cn(
                        "flex flex-col max-w-[85%] gap-2",
                        isRightSide ? "self-end items-end" : "self-start items-start"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {!isRightSide ? (
                          <>
                            <Shield className={cn("w-3 h-3", isBot ? "text-primary/60" : "text-primary")} />
                            <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">
                              SUPORTE MASK • {format(new Date(m.created_at), 'HH:mm')}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">
                              {currentUser?.user_metadata?.full_name || 'Você'} • {format(new Date(m.created_at), 'HH:mm')}
                            </span>
                            <UserIcon className="w-3 h-3 text-muted-foreground" />
                          </>
                        )}
                      </div>
                      <div className={cn(
                        "p-4 rounded-3xl text-sm font-medium border shadow-sm transition-all",
                        isRightSide 
                          ? "bg-primary/10 border-primary/20 rounded-tr-none text-white ring-1 ring-primary/20"
                          : "bg-white/5 border-white/10 rounded-tl-none text-white/90" 
                      )}>
                        {m.message}
                        {m.attachment_path && (
                          <TicketAttachment url={m.attachment_path} className="mt-2" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
              {selectedTicket.status === 'Aberto' ? (
                <div className="p-6 border-t border-white/5 bg-white/[0.01]">
                  <div className="flex flex-col gap-4">
                    {attachmentUrl && (
                      <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-white/10">
                        <img src={attachmentUrl} className="w-full h-full object-cover" />
                        <button 
                          onClick={() => { setAttachment(null); setAttachmentUrl(null); }}
                          className="absolute top-1 right-1 bg-black/50 p-1 rounded-full text-white hover:bg-black transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <input 
                          type="text"
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder="DIGITE SUA MENSAGEM..."
                          className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-6 pr-12 text-[10px] font-black tracking-widest text-white placeholder:text-muted-foreground/20 focus:outline-none focus:border-white/20 transition-all uppercase"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              if (message.trim()) sendMessageMutation.mutate(message);
                            }
                          }}
                        />
                        <button 
                          onClick={() => chatFileInputRef.current?.click()}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-white transition-colors cursor-pointer"
                        >
                          <Paperclip className="w-5 h-5" />
                        </button>
                        <input 
                          type="file"
                          ref={chatFileInputRef}
                          className="hidden"
                          accept="image/*"
                          onChange={handleFileUpload}
                        />
                      </div>
                      <Button 
                        disabled={!message.trim() || isUploading}
                        onClick={() => sendMessageMutation.mutate(message)}
                        className="h-14 w-14 rounded-2xl bg-white text-black hover:bg-white/90 p-0 flex items-center justify-center shrink-0 shadow-lg shadow-white/5"
                      >
                        <Send className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-12 border-t border-white/5 bg-white/[0.01] flex flex-col items-center justify-center text-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20">
                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-tighter text-white">Ticket Finalizado</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                      {format(new Date((selectedTicket.updated_at || selectedTicket.created_at) as string), "dd/MM/yyyy 'ÀS' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-muted-foreground/20">
              <MessageSquare className="w-16 h-16 mb-6 opacity-10" />
              <p className="text-xs font-black uppercase tracking-[0.2em]">Selecione um ticket para visualizar a conversa</p>
            </div>
          )}
        </Card>
      </div>

      {/* New Ticket Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-card border-2 border-white/5 rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tighter">Novo Ticket</h2>
                  <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mt-1">Passo {newTicketStep} de 2</p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8">
                {newTicketStep === 1 ? (
                  <div className="space-y-6">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Selecione o Assunto</label>
                    <div className="grid grid-cols-1 gap-3">
                      {['Conta', 'Financeiro', 'Sugestão'].map((sub) => (
                        <button
                          key={sub}
                          onClick={() => { setSubject(sub as any); setNewTicketStep(2); }}
                          className={cn(
                            "w-full text-left p-6 rounded-2xl border transition-all flex items-center justify-between group",
                            subject === sub ? "bg-primary/10 border-primary/40 text-white" : "bg-white/5 border-white/10 text-muted-foreground hover:border-white/20"
                          )}
                        >
                          <span className="text-xs font-black uppercase tracking-widest">{sub}</span>
                          <div className={cn(
                            "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                            subject === sub ? "border-primary bg-primary text-black" : "border-white/10 group-hover:border-white/20"
                          )}>
                            {subject === sub && <div className="w-2 h-2 rounded-full bg-black" />}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-4">Sua Mensagem</label>
                      <textarea 
                        autoFocus
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="DESCREVA O PROBLEMA OU SUGESTÃO EM DETALHES..."
                        className="w-full bg-white/5 border border-white/10 rounded-[2rem] p-6 text-[10px] font-black tracking-widest text-white placeholder:text-muted-foreground/20 focus:outline-none focus:border-white/20 transition-all uppercase min-h-[160px] resize-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-4">Anexos (Opcional)</label>
                      {attachmentUrl ? (
                        <div className="relative w-full h-32 rounded-2xl overflow-hidden border border-white/10 group">
                          <img src={attachmentUrl} className="w-full h-full object-cover" />
                          <button 
                            onClick={() => { setAttachment(null); setAttachmentUrl(null); }}
                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-black text-[10px] uppercase tracking-widest"
                          >
                            Remover Imagem
                          </button>
                        </div>
                      ) : (
                        <>
                          <button 
                            type="button"
                            onClick={() => modalFileInputRef.current?.click()}
                            className="w-full h-32 rounded-2xl border-2 border-dashed border-white/5 bg-white/[0.02] flex flex-col items-center justify-center text-muted-foreground hover:bg-white/[0.04] hover:border-white/10 transition-all group"
                          >
                            <Paperclip className="w-6 h-6 mb-2 group-hover:scale-110 transition-transform" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Clique para anexar imagem</span>
                          </button>
                          <input 
                            type="file"
                            ref={modalFileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileUpload}
                          />
                        </>
                      )}
                    </div>

                    <div className="flex gap-4 pt-4">
                      <Button 
                        variant="outline"
                        onClick={() => setNewTicketStep(1)}
                        className="flex-1 h-14 rounded-2xl border-white/10 text-xs font-black uppercase tracking-widest hover:bg-white/5"
                      >
                        Voltar
                      </Button>
                      <Button 
                        disabled={!message.trim() || isUploading}
                        onClick={() => createTicketMutation.mutate()}
                        className="flex-[2] h-14 rounded-2xl bg-white text-black hover:bg-white/90 text-xs font-black uppercase tracking-widest shadow-lg shadow-white/5"
                      >
                        {isUploading ? 'ENVIANDO...' : 'ABRIR TICKET'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
