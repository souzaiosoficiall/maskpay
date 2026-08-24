import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { 
  getAllNotifications, 
  createNotification, 
  deleteNotification 
} from '@/lib/notifications.functions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { 
  Bell, 
  Plus, 
  Trash2, 
  Clock, 
  User, 
  CheckCircle2, 
  XCircle,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function NotificationManagement() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  
  const queryClient = useQueryClient();
  const fetchAll = useServerFn(getAllNotifications);
  const doCreate = useServerFn(createNotification);
  const doDelete = useServerFn(deleteNotification);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['admin_notifications'],
    queryFn: () => fetchAll({}),
  });

  const createMutation = useMutation({
    mutationFn: (data: { title: string, description: string }) => doCreate({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_notifications'] });
      toast.success('Notificação enviada com sucesso!');
      setTitle('');
      setDescription('');
      setIsDialogOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao enviar notificação.');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => doDelete({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_notifications'] });
      toast.success('Notificação removida.');
    }
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) {
      toast.error('Preencha todos os campos.');
      return;
    }
    createMutation.mutate({ title, description });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tighter">Notificações Real-time</h2>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
            Gerencie avisos e comunicados em tempo real para os usuários.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-white text-black hover:bg-white/90 rounded-2xl px-6 py-6 text-xs font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95">
              <Plus className="w-4 h-4 mr-2" /> Nova Notificação
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-white/5 rounded-[2.5rem] max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase tracking-tighter">Nova Notificação</DialogTitle>
              <DialogDescription className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60">
                Esta notificação será enviada para todos os usuários online imediatamente.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-6 py-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Assunto</label>
                <Input 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Manutenção Programada"
                  className="bg-background border-white/10 rounded-2xl py-6 px-6 text-sm focus:ring-primary/20 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Descrição</label>
                <Textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descreva o aviso detalhadamente..."
                  className="bg-background border-white/10 rounded-2xl p-6 text-sm min-h-[150px] focus:ring-primary/20 transition-all resize-none"
                />
              </div>
              <DialogFooter className="pt-4">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => setIsDialogOpen(false)}
                  className="rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/5"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending}
                  className="bg-white text-black hover:bg-white/90 rounded-2xl px-8 text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105"
                >
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar Notificação'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : notifications.length === 0 ? (
          <Card className="bg-card border-white/5 border-dashed py-20 flex flex-col items-center justify-center text-center">
            <Bell className="w-12 h-12 text-muted-foreground/20 mb-4" />
            <p className="text-sm font-black uppercase tracking-widest text-muted-foreground/40">Nenhuma notificação enviada ainda.</p>
          </Card>
        ) : (
          notifications.map((notif: any) => (
            <Card key={notif.id} className={cn("bg-card border-white/5 group hover:border-white/10 transition-all overflow-hidden", !notif.is_active && "opacity-50")}>
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", notif.is_active ? "bg-white/5 text-white" : "bg-red-500/10 text-red-500")}>
                        {notif.is_active ? <Bell className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                      </div>
                      <div>
                        <h3 className="text-base font-black uppercase tracking-tight flex items-center gap-2">
                          {notif.title}
                          {notif.is_active ? (
                            <span className="flex items-center gap-1 bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest">
                              Ativa
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 bg-white/5 text-muted-foreground px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest">
                              Desativada
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-muted-foreground/80 font-medium line-clamp-2 mt-1">
                          {notif.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-8 md:px-6 md:border-x border-white/5">
                    <div className="space-y-1">
                      <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/40 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Data de Envio
                      </p>
                      <p className="text-[10px] font-black uppercase text-white/60">
                        {format(new Date(notif.created_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/40 flex items-center gap-1">
                        <User className="w-3 h-3" /> Responsável
                      </p>
                      <p className="text-[10px] font-black uppercase text-white/60">
                        {notif.profiles?.full_name || 'Admin'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    {notif.is_active && (
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => deleteMutation.mutate(notif.id)}
                        disabled={deleteMutation.isPending}
                        className="h-12 w-12 rounded-2xl text-destructive/40 hover:text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/10 transition-all"
                      >
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
