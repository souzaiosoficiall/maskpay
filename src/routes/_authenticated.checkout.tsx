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
  Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ImagePickerField } from '@/components/ImagePickerField';
import { cn } from '@/lib/utils';
import { useSessionReady } from '@/hooks/useSessionReady';
import {
  listMyProducts,
  listMyCheckoutPages,
  createCheckoutPage,
  updateCheckoutPage,
  deleteCheckoutPage,
} from '@/lib/checkout.functions';

export const Route = createFileRoute('/_authenticated/checkout')({
  component: CheckoutPagesPage,
});

type Feedback = { name: string; avatar_url: string; comment: string };

const emptyForm = {
  product_id: '',
  theme_color: '#6366f1',
  banner_url: null as string | null,
  description: '',
  feedbacks: [] as Feedback[],
  active: true,
};

function CheckoutPagesPage() {
  const sessionReady = useSessionReady();
  const qc = useQueryClient();
  const fetchPages = useServerFn(listMyCheckoutPages);
  const fetchProducts = useServerFn(listMyProducts);
  const doCreate = useServerFn(createCheckoutPage);
  const doUpdate = useServerFn(updateCheckoutPage);
  const doDelete = useServerFn(deleteCheckoutPage);

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [fb, setFb] = useState<Feedback>({ name: '', avatar_url: '', comment: '' });

  const { data: pages = [], isLoading } = useQuery({
    queryKey: ['checkout_pages'],
    queryFn: () => fetchPages({}),
    enabled: sessionReady,
  });

  const { data: products = [], isLoading: isLoadingProducts, isFetched: productsFetched } = useQuery({
    queryKey: ['catalog_products'],
    queryFn: () => fetchProducts({}),
    enabled: sessionReady,
  });

  const origin = useMemo(
    () => (typeof window !== 'undefined' ? window.location.origin : ''),
    [],
  );

  const save = useMutation({
    mutationFn: async () => {
      if (!form.product_id) throw new Error('Selecione um produto.');
      const payload = {
        product_id: form.product_id,
        theme_color: form.theme_color,
        banner_url: form.banner_url,
        description: form.description,
        feedbacks: form.feedbacks,
        active: form.active,
      };
      if (editId) return doUpdate({ data: { id: editId, ...payload } });
      return doCreate({ data: payload });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['checkout_pages'] });
      toast.success(editId ? 'Checkout atualizado' : 'Checkout criado');
      setOpen(false);
      setEditId(null);
      setForm(emptyForm);
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao salvar'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => doDelete({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['checkout_pages'] });
      toast.success('Checkout removido');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro'),
  });

  const openCreate = () => {
    if (isLoadingProducts || !productsFetched) {
      toast.message('Carregando produtos...');
      return;
    }
    if (!products.length) {
      toast.error('Cadastre um produto antes de criar o checkout.');
      return;
    }
    setEditId(null);
    setForm({ ...emptyForm, product_id: products[0]?.id || '' });
    setOpen(true);
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 pb-28 md:p-8 lg:pb-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-black uppercase tracking-tighter md:text-2xl">
            <ShoppingBag className="h-6 w-6 text-primary" />
            Checkout
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Escolha o produto, tema, banner e feedbacks. Gere o link de pagamento.
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="h-11 shrink-0 rounded-2xl px-4 text-[10px] font-black uppercase tracking-widest"
        >
          <Plus className="mr-1.5 h-4 w-4" /> Novo
        </Button>
      </div>

      {productsFetched && !isLoadingProducts && !products.length && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm">
          <p className="font-bold text-amber-200">Cadastre produtos primeiro</p>
          <p className="mt-1 text-xs text-amber-200/70">
            Crie pelo menos um item em Produtos para vincular ao checkout.
          </p>
          <Link to="/products" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary">
            <Package className="h-3.5 w-3.5" /> Ir para Produtos
          </Link>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : pages.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-14 text-center">
          <ShoppingBag className="mx-auto mb-3 h-10 w-10 text-white/20" />
          <p className="font-bold">Nenhum checkout</p>
          <p className="mt-1 text-sm text-muted-foreground">Crie uma página de pagamento personalizada.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pages.map((p: any) => (
            <div
              key={p.id}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
            >
              <div className="flex items-start gap-3">
                <div
                  className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10"
                  style={{ backgroundColor: `${p.theme_color || '#6366f1'}22` }}
                >
                  {p.product?.icon_url ? (
                    <img src={p.product.icon_url} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black uppercase tracking-tight">
                    {p.product?.title || 'Produto'}
                  </p>
                  <p className="text-sm font-bold text-primary">
                    {Number(p.product?.amount || 0).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </p>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">
                    {origin}/c/{p.slug}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 rounded-xl border-white/10 text-[10px] font-bold uppercase"
                  onClick={() => {
                    navigator.clipboard.writeText(`${origin}/c/${p.slug}`);
                    toast.success('Link copiado');
                  }}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" /> Link
                </Button>
                <Button size="sm" variant="outline" className="h-9 rounded-xl border-white/10 text-[10px] font-bold uppercase" asChild>
                  <a href={`/c/${p.slug}`} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-1 h-3.5 w-3.5" /> Abrir
                  </a>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 rounded-xl border-white/10 text-[10px] font-bold uppercase"
                  onClick={() => {
                    setEditId(p.id);
                    setForm({
                      product_id: p.product_id || p.product?.id || '',
                      theme_color: p.theme_color || '#6366f1',
                      banner_url: p.banner_url || null,
                      description: p.description || '',
                      feedbacks: Array.isArray(p.feedbacks) ? p.feedbacks : [],
                      active: p.active !== false,
                    });
                    setOpen(true);
                  }}
                >
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 rounded-xl border-red-500/20 text-[10px] font-bold uppercase text-red-400"
                  onClick={() => {
                    if (confirm('Remover checkout?')) remove.mutate(p.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0a0a0a] p-5 sm:rounded-3xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-black uppercase tracking-tight">
                {editId ? 'Editar checkout' : 'Novo checkout'}
              </h2>
              <button type="button" onClick={() => setOpen(false)}>
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Produto
                </Label>
                <select
                  className="mt-1 h-12 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm outline-none"
                  value={form.product_id}
                  onChange={(e) => setForm((f) => ({ ...f, product_id: e.target.value }))}
                >
                  <option value="">Selecione...</option>
                  {products.map((pr: any) => (
                    <option key={pr.id} value={pr.id} className="bg-[#111]">
                      {pr.title} —{' '}
                      {Number(pr.amount).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Cor do tema
                </Label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={form.theme_color}
                    onChange={(e) => setForm((f) => ({ ...f, theme_color: e.target.value }))}
                    className="h-12 w-14 cursor-pointer rounded-xl border border-white/10 bg-transparent"
                  />
                  <Input
                    value={form.theme_color}
                    onChange={(e) => setForm((f) => ({ ...f, theme_color: e.target.value }))}
                    className="h-12 rounded-xl border-white/10 bg-white/5"
                  />
                </div>
              </div>

              <ImagePickerField
                label="Banner do checkout"
                value={form.banner_url}
                onChange={(v) => setForm((f) => ({ ...f, banner_url: v }))}
                aspect="banner"
              />

              <div>
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Descrição na página
                </Label>
                <textarea
                  className="mt-1 min-h-[88px] w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-primary/40"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Texto que o cliente verá no checkout..."
                />
              </div>

              <div className="rounded-2xl border border-white/10 p-3">
                <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <Star className="h-3.5 w-3.5" /> Feedbacks
                </p>
                <div className="mb-2 space-y-2">
                  {form.feedbacks.map((item, i) => (
                    <div key={i} className="flex gap-2 rounded-xl bg-white/5 p-2.5 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.comment}</p>
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
                    className="h-10 rounded-xl border-white/10 bg-white/5"
                    value={fb.name}
                    onChange={(e) => setFb((d) => ({ ...d, name: e.target.value }))}
                  />
                  <ImagePickerField
                    label="Avatar do feedback (opcional)"
                    value={fb.avatar_url || null}
                    onChange={(v) => setFb((d) => ({ ...d, avatar_url: v || '' }))}
                    aspect="square"
                  />
                  <Input
                    placeholder="Comentário"
                    className="h-10 rounded-xl border-white/10 bg-white/5"
                    value={fb.comment}
                    onChange={(e) => setFb((d) => ({ ...d, comment: e.target.value }))}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-xl"
                    onClick={() => {
                      if (!fb.name.trim() || !fb.comment.trim()) {
                        toast.error('Nome e comentário obrigatórios');
                        return;
                      }
                      setForm((f) => ({ ...f, feedbacks: [...f.feedbacks, { ...fb }] }));
                      setFb({ name: '', avatar_url: '', comment: '' });
                    }}
                  >
                    Adicionar feedback
                  </Button>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-bold">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                  className="accent-primary"
                />
                Checkout ativo
              </label>

              <Button
                className="h-12 w-full rounded-2xl text-xs font-black uppercase tracking-widest"
                disabled={save.isPending}
                onClick={() => save.mutate()}
              >
                {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar checkout'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
