import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import {
  getAllNotifications,
  createNotification,
  deleteNotification,
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
  Loader2,
  AlertCircle,
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
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export function NotificationManagement() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const fetchAll = useServerFn(getAllNotifications);
  const doCreate = useServerFn(createNotification);
  const doDelete = useServerFn(deleteNotification);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['admin_notifications'],
    queryFn: () => fetchAll({}),
  });

  const createMutation = useMutation({
    mutationFn: (data: { title: string; description: string }) => doCreate({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_notifications'] });
      toast.success('Notificação enviada com sucesso!');
      setTitle('');
      setDescription('');
      setIsDialogOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao enviar notificação.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => doDelete({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_notifications'] });
      toast.success('Notificação removida.');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao remover notificação.');
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) {
      toast.error('Preencha todos os campos.');
      return;
    }
    createMutation.mutate({ title, description });
  };

  const handleDelete = (id: string, notifTitle: string) => {
    if (
      !confirm(
        `Remover o aviso "${notifTitle}"?\nEle deixará de aparecer para os usuários.`,
      )
    ) {
      return;
    }
    deleteMutation.mutate(id);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-black uppercase tracking-tighter sm:text-2xl">
            Notificações Real-time
          </h2>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Gerencie avisos e comunicados em tempo real para os usuários.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="shrink-0 rounded-2xl bg-white px-6 py-6 text-xs font-black uppercase tracking-widest text-black transition-all hover:bg-white/90 hover:scale-105 active:scale-95">
              <Plus className="mr-2 h-4 w-4" /> Nova Notificação
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg rounded-[2.5rem] border-white/5 bg-card">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase tracking-tighter">
                Nova Notificação
              </DialogTitle>
              <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                Esta notificação será enviada para todos os usuários online imediatamente.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-6 py-4">
              <div className="space-y-2">
                <label className="px-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Assunto
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Manutenção Programada"
                  className="rounded-2xl border-white/10 bg-background px-6 py-6 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="px-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Descrição
                </label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descreva o aviso detalhadamente..."
                  className="min-h-[150px] resize-none rounded-2xl border-white/10 bg-background p-6 text-sm"
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
                  className="rounded-2xl bg-white px-8 text-[10px] font-black uppercase tracking-widest text-black hover:bg-white/90"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Enviar Notificação'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : notifications.length === 0 ? (
          <Card className="flex flex-col items-center justify-center border-dashed border-white/5 bg-card py-20 text-center">
            <Bell className="mb-4 h-12 w-12 text-muted-foreground/20" />
            <p className="text-sm font-black uppercase tracking-widest text-muted-foreground/40">
              Nenhuma notificação enviada ainda.
            </p>
          </Card>
        ) : (
          notifications.map((notif: any) => {
            const isExpanded = expandedId === notif.id;
            const desc = notif.description || '';
            const isLong = desc.length > 120;

            return (
              <Card
                key={notif.id}
                className={cn(
                  'border-white/5 bg-card transition-all hover:border-white/10',
                  !notif.is_active && 'opacity-60',
                )}
              >
                <CardContent className="p-4 sm:p-5">
                  {/* Top row: icon + title + always-visible delete */}
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                        notif.is_active
                          ? 'bg-white/5 text-white'
                          : 'bg-red-500/10 text-red-500',
                      )}
                    >
                      {notif.is_active ? (
                        <Bell className="h-5 w-5" />
                      ) : (
                        <AlertCircle className="h-5 w-5" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="break-words text-sm font-black uppercase tracking-tight text-white sm:text-base">
                          {notif.title}
                        </h3>
                        {notif.is_active ? (
                          <span className="shrink-0 rounded-full bg-green-500/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-green-500">
                            Ativa
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-muted-foreground">
                            Desativada
                          </span>
                        )}
                      </div>

                      <p
                        className={cn(
                          'mt-1.5 break-all text-xs font-medium leading-relaxed text-muted-foreground/80',
                          !isExpanded && 'line-clamp-2',
                        )}
                      >
                        {desc}
                      </p>

                      {isLong && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedId(isExpanded ? null : notif.id)
                          }
                          className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/50 hover:text-white"
                        >
                          {isExpanded ? 'Ver menos' : 'Ver mais'}
                        </button>
                      )}

                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/40">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {notif.created_at
                            ? format(
                                new Date(notif.created_at),
                                "dd MMM yyyy 'às' HH:mm",
                                { locale: ptBR },
                              )
                            : '—'}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {notif.profiles?.full_name || 'Admin'}
                        </span>
                      </div>
                    </div>

                    {/* Delete always visible, never pushed off-screen */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(notif.id, notif.title)}
                      disabled={deleteMutation.isPending}
                      title="Excluir aviso"
                      className="h-10 w-10 shrink-0 rounded-xl border border-transparent text-destructive/50 transition-all hover:border-destructive/20 hover:bg-destructive/10 hover:text-destructive"
                    >
                      {deleteMutation.isPending &&
                      deleteMutation.variables === notif.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
