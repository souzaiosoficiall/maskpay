import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Search,
  MessageSquare,
  X,
  Fingerprint,
  Send,
  Loader2,
  Paperclip,
  CheckCircle2
} from 'lucide-react';
import { useState, useRef } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import maskPlatformAsset from "@/lib/mask-asset";
import { TicketAttachment } from '@/components/TicketAttachment';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

interface SupportCenterProps {
  tickets: any[];
  isLoading: boolean;
  messages: any[];
  selectedTicketId: string | null;
  onSelectTicket: (id: string | null) => void;
  onResolveTicket: (id: string) => void;
  onSendMessage: (content: string, attachmentUrl?: string) => void;
}

export function SupportCenter({
  tickets,
  isLoading,
  messages,
  selectedTicketId,
  onSelectTicket,
  onResolveTicket,
  onSendMessage
}: SupportCenterProps) {
  const [searchTicket, setSearchTicket] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const selectedTicket = tickets.find((t: any) => t.id === selectedTicketId);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachment(file);
    setAttachmentUrl(URL.createObjectURL(file));
  };

  const uploadFile = async (file: File) => {
    const { supabase } = await import('@/integrations/supabase/client');
    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `support-attachments/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('ticket-attachments')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Admin upload error details:', uploadError);
      const errorMsg = typeof uploadError === 'object' ? JSON.stringify(uploadError) : String(uploadError);
      throw new Error(errorMsg);
    }

    // Bucket is private: store the object path, signed URLs are resolved at render time.
    return filePath;
  };

  const handleSend = async () => {
    if (!replyMessage.trim() && !attachment) return;
    
    setIsUploading(true);
    try {
      let finalUrl = undefined;
      if (attachment) {
        finalUrl = await uploadFile(attachment);
      }
      onSendMessage(replyMessage, finalUrl);
      setReplyMessage('');
      setAttachment(null);
      setAttachmentUrl(null);
    } catch (error: any) {
      const { toast } = await import('sonner');
      toast.error('Erro ao enviar mensagem: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
      <Card className="lg:col-span-1 border-white/5 bg-background border-2 rounded-[2rem] overflow-hidden">
        <CardHeader className="p-6 border-b border-white/5">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
            <input 
              placeholder="FILTRAR TICKETS..."
              value={searchTicket}
              onChange={(e) => setSearchTicket(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-[9px] font-black tracking-widest text-white uppercase"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 max-h-[600px] overflow-y-auto custom-scrollbar">
          <div className="divide-y divide-white/5">
            {tickets.filter((t: any) => 
              t.subject.toLowerCase().includes(searchTicket.toLowerCase()) || 
              t.profiles?.full_name?.toLowerCase().includes(searchTicket.toLowerCase()) ||
              t.profiles?.email?.toLowerCase().includes(searchTicket.toLowerCase())
            ).map((t: any) => (
              <button 
                key={t.id}
                onClick={() => onSelectTicket(t.id)}
                className={cn(
                  "w-full text-left p-6 transition-colors hover:bg-white/[0.02] group",
                  selectedTicketId === t.id && "bg-white/[0.04]"
                )}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest">{format(new Date(t.created_at), 'dd MMM, HH:mm', { locale: ptBR })}</span>
                  <Badge className={cn(
                    "text-[8px] font-black uppercase tracking-widest",
                    t.status === 'Resolvido' ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-blue-500/10 text-blue-500 border-blue-500/20"
                  )}>
                    {t.status === 'Resolvido' ? 'RESOLVIDO' : t.status}
                  </Badge>
                </div>
                <p className="text-xs font-black uppercase tracking-tighter text-white">{t.subject}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1 uppercase font-bold tracking-wider">{t.profiles?.full_name || 'Usuário'}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2 border-white/5 bg-background border-2 rounded-[2rem] overflow-hidden flex flex-col min-h-[600px]">
        {selectedTicket ? (
          <>
            <CardHeader className="p-6 border-b border-white/5 bg-white/[0.02] flex flex-row items-center justify-between">
              <div>
                <h2 className="text-sm font-black uppercase tracking-tighter">{selectedTicket.subject}</h2>
                <p className="text-[9px] text-muted-foreground font-black uppercase tracking-widest">{selectedTicket.profiles?.full_name} | {selectedTicket.profiles?.email}</p>
              </div>
              <div className="flex gap-2">
                {selectedTicket.status === 'Aberto' && (
                  <Button 
                    size="sm"
                    onClick={() => onResolveTicket(selectedTicket.id)}
                    className="bg-green-500 hover:bg-green-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest"
                  >
                    Marcar como Resolvido
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => onSelectTicket(null)} className="rounded-xl"><X className="w-4 h-4" /></Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6">
              {messages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-20 py-12">
                  <MessageSquare className="w-12 h-12 mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma mensagem encontrada</p>
                </div>
              ) : messages.map((m: any) => {
                const isBot = m.user_id === null;
                const isSupport = isBot || (m.metadata?.sender_name === 'SUPORTE MASK');
                
                // IN ADMIN VIEW:
                // Support/Admin messages = RIGHT
                // Client/User messages = LEFT
                const isRightSide = isSupport;

                return (
                  <div 
                    key={m.id}
                    className={cn(
                      "flex flex-col max-w-[85%] gap-2",
                      isRightSide ? "self-end items-end" : "self-start items-start"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {!isRightSide && (
                        <Avatar className="w-5 h-5 rounded-md border border-white/10 bg-white/5 p-0.5">
                          <AvatarImage src={maskPlatformAsset.url} className="object-contain opacity-50" />
                          <AvatarFallback className="text-[6px]">USR</AvatarFallback>
                        </Avatar>
                      )}
                      <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">
                        {isSupport ? "SUPORTE MASK" : (selectedTicket.profiles?.full_name || 'CLIENTE')} • {format(new Date(m.created_at), 'HH:mm')}
                      </span>
                      {isRightSide && (
                        <Avatar className="w-5 h-5 rounded-md border border-white/10 bg-white/5 p-0.5">
                          <AvatarImage src={maskPlatformAsset.url} className="object-contain" />
                          <AvatarFallback className="text-[6px]">ADM</AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                    <div className={cn(
                      "p-4 rounded-2xl text-xs font-medium border shadow-sm transition-all",
                      isRightSide 
                        ? "bg-primary/10 border-primary/20 rounded-tr-none text-white ring-1 ring-primary/20" 
                        : "bg-white/5 border-white/10 rounded-tl-none text-white/90"
                    )}>
                      {m.message}
                      {m.attachment_path && (
                        <TicketAttachment
                          url={m.attachment_path}
                          className="mt-4 rounded-xl overflow-hidden border border-white/10 max-w-[200px]"
                        />
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
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        placeholder="DIGITE A RESPOSTA..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-base md:text-sm font-bold tracking-wide text-white focus:outline-none"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                      />
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-white transition-colors cursor-pointer"
                      >
                        <Paperclip className="w-5 h-5" />
                      </button>
                      <input 
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileUpload}
                      />
                    </div>
                    <Button 
                      onClick={handleSend}
                      disabled={(!replyMessage.trim() && !attachment) || isUploading}
                      className="h-14 w-14 rounded-xl bg-white text-black hover:bg-white/90 shadow-lg shadow-white/5 flex items-center justify-center shrink-0"
                    >
                      {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
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
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center opacity-10">
            <MessageSquare className="w-16 h-16 mb-6" />
            <p className="text-[10px] font-black uppercase tracking-widest">Selecione um ticket</p>
          </div>
        )}
      </Card>
    </div>
  );
}