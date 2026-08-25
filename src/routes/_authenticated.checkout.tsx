import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  ShoppingBag,
  Plus,
  Trash2,
  Copy,
  ExternalLink,
  Loader2,
  Pencil,
  X,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  listMyCheckoutProducts,
  createCheckoutProduct,
  updateCheckoutProduct,
  deleteCheckoutProduct,
} from '@/lib/checkout.functions';
import { useSessionReady } from '@/hooks/useSessionReady';

export const Route = createFileRoute('/_authenticated/checkout')({
  component: CheckoutManagerPage,
});

type Feedback = { name: string; avatar_url: string; comment: string };

const emptyForm = {
  title: '',
  description: '',
  amount: '',
  theme_color: '#22c55e',
  banner_url: '',
  icon_url: '',
  feedbacks: [] as Feedback[],
  active: true,
};

function CheckoutManagerPage() {
  const sessionReady = useSessionReady();
  const queryClient = useQueryClient();
  const fetchList = useServerFn(listMyCheckoutProducts);
  const doCreate = useServerFn(createCheckoutProduct);
  const doUpdate = useServerFn(updateCheckoutProduct);
  const doDelete = useServerFn(deleteCheckoutProduct);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [fbDraft, setFbDraft] = useState<Feedback>({ name: '', avatar_url: '', comment: '' });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['checkout_products'],
    queryFn: () => fetchList({}),
    enabled: sessionReady,
  });

  const origin = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return window.location.origin;
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(String(form.amount).replace(',', '.'));
      if (!form.title.trim()) throw new Error('Informe o título.');
      if (!amount || amount < 1) throw new Error('Valor mínimo R$ 1,00.');
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        amount,
        theme_color: form.theme_color || '#22c55e',
        banner_url: form.banner_url.trim() || null,
        icon_url: form.icon_url.trim() || null,
        feedbacks: form.feedbacks,
        active: form.active,
      };
      if (editingId) {
        return doUpdate({ data: { id: editingId, ...payload } });
      }
      return doCreate({ data: payload });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkout_products'] });
      toast.success(editingId ? 'Produto atualizado!' : 'Produto criado!');
      setFormOpen(false);
      setEditingId(null);
      setForm({ ...emptyForm });
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao salvar produto.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => doDelete({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkout_products'] });
      toast.success('Produto removido.');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao remover.'),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setFormOpen(true);
  };

  const openEdit = (p: any) => {
    setEditingId(p.id);
    setForm({
      title: p.title || '',
      description: p.description || '',
      amount: String(p.amount ?? ''),
      theme_color: p.theme_color || '#22c55e',
      banner_url: p.banner_url || '',
      icon_url: p.icon_url || '',
      feedbacks: Array.isArray(p.feedbacks) ? p.feedbacks : [],
      active: p.active !== false,
    });
    setFormOpen(true);
  };

  const copyLink = (slug: string) => {
    const url = `${origin}/c/${slug}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success('Link copiado!'),
      () => toast.error('Não foi possível copiar.'),
    );
  };

  const addFeedback = () => {
    if (!fbDraft.name.trim() || !fbDraft.comment.trim()) {
      toast.error('Nome e comentário do feedback são obrigatórios.');
      return;
    }
    setForm((f) => ({
      ...f,
      feedbacks: [...f.feedbacks, { ...fbDraft }],
    }));
    setFbDraft({ name: '', avatar_url: '', comment: '' });
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 p-4 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-black uppercase tracking-tighter md:text-3xl">
            <ShoppingBag className="h-7 w-7 text-primary" />
            Checkout
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie páginas de pagamento com tema, banner e feedbacks. Só no desktop no menu lateral.
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="h-12 rounded-2xl px-6 text-xs font-black uppercase tracking-widest"
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo produto
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : products.length === 0 && !formOpen ? (
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.02] p-12 text-center">
          <ShoppingBag className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
          <p className="font-bold text-white">Nenhum produto ainda</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Crie seu primeiro checkout e compartilhe o link com seus clientes.
          </p>
          <Button onClick={openCreate} className="mt-6 rounded-xl">
            Criar produto
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {products.map((p: any) => (
            <div
              key={p.id}
              className="flex flex-col gap-4 rounded-[1.5rem] border border-white/10 bg-white/[0.02] p-5 md:flex-row md:items-center md:justify-between"
            >
              <div className="flex min-w-0 items-start gap-4">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10"
                  style={{ backgroundColor: `${p.theme_color || '#22c55e'}22` }}
                >
                  {p.icon_url ? (
                    <img src={p.icon_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ShoppingBag className="h-5 w-5" style={{ color: p.theme_color }} />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-base font-black uppercase tracking-tight">
                      {p.title}
                    </h3>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[9px] font-black uppercase',
                        p.active ? 'bg-green-500/15 text-green-400' : 'bg-white/10 text-muted-foreground',
                      )}
                    >
                      {p.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-bold text-primary">
                    {Number(p.amount).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {origin}/c/{p.slug}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl border-white/10"
                  onClick={() => copyLink(p.slug)}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" /> Link
                </Button>
                <Button size="sm" variant="outline" className="rounded-xl border-white/10" asChild>
                  <a href={`/c/${p.slug}`} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-1 h-3.5 w-3.5" /> Abrir
                  </a>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl border-white/10"
                  onClick={() => openEdit(p)}
                >
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl border-red-500/20 text-red-400"
                  onClick={() => {
                    if (confirm('Remover este produto?')) deleteMutation.mutate(p.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 md:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[2rem] border border-white/10 bg-[#0a0a0a] p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-black uppercase tracking-tighter">
                {editingId ? 'Editar produto' : 'Novo produto'}
              </h2>
              <button type="button" onClick={() => setFormOpen(false)} className="text-muted-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Título
                </Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="mt-1 h-12 rounded-xl border-white/10 bg-white/5"
                  placeholder="Ex: Mentoria VIP"
                />
              </div>
              <div>
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Valor (R$)
                </Label>
                <Input
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value.replace(/[^\d,.]/g, '') }))}
                  className="mt-1 h-12 rounded-xl border-white/10 bg-white/5"
                  placeholder="97,00"
                  inputMode="decimal"
                />
              </div>
              <div>
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Descrição
                </Label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="mt-1 min-h-[88px] w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-primary/40"
                  placeholder="O que o cliente está comprando..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Cor do tema
                  </Label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="color"
                      value={form.theme_color}
                      onChange={(e) => setForm((f) => ({ ...f, theme_color: e.target.value }))}
                      className="h-12 w-12 cursor-pointer rounded-lg border border-white/10 bg-transparent"
                    />
                    <Input
                      value={form.theme_color}
                      onChange={(e) => setForm((f) => ({ ...f, theme_color: e.target.value }))}
                      className="h-12 rounded-xl border-white/10 bg-white/5"
                    />
                  </div>
                </div>
                <div className="flex items-end">
                  <label className="flex h-12 w-full cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-bold">
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                      className="accent-primary"
                    />
                    Produto ativo
                  </label>
                </div>
              </div>
              <div>
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  URL do banner
                </Label>
                <Input
                  value={form.banner_url}
                  onChange={(e) => setForm((f) => ({ ...f, banner_url: e.target.value }))}
                  className="mt-1 h-12 rounded-xl border-white/10 bg-white/5"
                  placeholder="https://..."
                />
              </div>
              <div>
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  URL do ícone
                </Label>
                <Input
                  value={form.icon_url}
                  onChange={(e) => setForm((f) => ({ ...f, icon_url: e.target.value }))}
                  className="mt-1 h-12 rounded-xl border-white/10 bg-white/5"
                  placeholder="https://..."
                />
              </div>

              <div className="rounded-2xl border border-white/10 p-4">
                <p className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <Star className="h-3.5 w-3.5" /> Feedbacks
                </p>
                <div className="mb-3 space-y-2">
                  {form.feedbacks.map((fb, i) => (
                    <div
                      key={i}
                      className="flex items-start justify-between gap-2 rounded-xl bg-white/5 p-3 text-sm"
                    >
                      <div>
                        <p className="font-bold">{fb.name}</p>
                        <p className="text-muted-foreground">{fb.comment}</p>
                      </div>
                      <button
                        type="button"
                        className="text-red-400"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            feedbacks: f.feedbacks.filter((_, j) => j !== i),
                          }))
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <Input
                    placeholder="Nome"
                    value={fbDraft.name}
                    onChange={(e) => setFbDraft((d) => ({ ...d, name: e.target.value }))}
                    className="h-10 rounded-xl border-white/10 bg-white/5"
                  />
                  <Input
                    placeholder="URL do avatar (opcional)"
                    value={fbDraft.avatar_url}
                    onChange={(e) => setFbDraft((d) => ({ ...d, avatar_url: e.target.value }))}
                    className="h-10 rounded-xl border-white/10 bg-white/5"
                  />
                  <Input
                    placeholder="Comentário"
                    value={fbDraft.comment}
                    onChange={(e) => setFbDraft((d) => ({ ...d, comment: e.target.value }))}
                    className="h-10 rounded-xl border-white/10 bg-white/5"
                  />
                  <Button type="button" variant="outline" className="w-full rounded-xl" onClick={addFeedback}>
                    Adicionar feedback
                  </Button>
                </div>
              </div>

              <Button
                className="h-12 w-full rounded-2xl text-xs font-black uppercase tracking-widest"
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : editingId ? (
                  'Salvar alterações'
                ) : (
                  'Criar produto'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
