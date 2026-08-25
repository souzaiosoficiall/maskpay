import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { toast } from 'sonner';
import { Package, Plus, Pencil, Trash2, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ImagePickerField } from '@/components/ImagePickerField';
import { useSessionReady } from '@/hooks/useSessionReady';
import {
  listMyProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from '@/lib/checkout.functions';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_authenticated/products')({
  component: ProductsPage,
});

const empty = { title: '', description: '', amount: '', icon_url: null as string | null, active: true };

function ProductsPage() {
  const sessionReady = useSessionReady();
  const qc = useQueryClient();
  const fetchList = useServerFn(listMyProducts);
  const doCreate = useServerFn(createProduct);
  const doUpdate = useServerFn(updateProduct);
  const doDelete = useServerFn(deleteProduct);

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['catalog_products'],
    queryFn: () => fetchList({}),
    enabled: sessionReady,
  });

  const save = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(String(form.amount).replace(',', '.'));
      if (!form.title.trim()) throw new Error('Informe o título.');
      if (!amount || amount < 1) throw new Error('Valor mínimo R$ 1,00.');
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        amount,
        icon_url: form.icon_url,
        active: form.active,
      };
      if (editId) return doUpdate({ data: { id: editId, ...payload } });
      return doCreate({ data: payload });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalog_products'] });
      toast.success(editId ? 'Produto atualizado' : 'Produto criado');
      setOpen(false);
      setEditId(null);
      setForm(empty);
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao salvar'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => doDelete({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalog_products'] });
      toast.success('Produto removido');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao remover'),
  });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 pb-28 md:p-8 lg:pb-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-black uppercase tracking-tighter md:text-2xl">
            <Package className="h-6 w-6 text-primary" />
            Produtos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre o que você vende. Depois vincule no Checkout.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditId(null);
            setForm(empty);
            setOpen(true);
          }}
          className="h-11 shrink-0 rounded-2xl px-4 text-[10px] font-black uppercase tracking-widest"
        >
          <Plus className="mr-1.5 h-4 w-4" /> Novo
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-14 text-center">
          <Package className="mx-auto mb-3 h-10 w-10 text-white/20" />
          <p className="font-bold">Nenhum produto</p>
          <p className="mt-1 text-sm text-muted-foreground">Crie o primeiro item do seu catálogo.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((p: any) => (
            <div
              key={p.id}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3.5"
            >
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                {p.icon_url ? (
                  <img src={p.icon_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg font-black text-white/30">
                    {(p.title || '?')[0]}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-bold">{p.title}</p>
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase',
                      p.active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/10 text-muted-foreground',
                    )}
                  >
                    {p.active ? 'Ativo' : 'Off'}
                  </span>
                </div>
                <p className="text-sm font-black text-primary">
                  {Number(p.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
                {p.description && (
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{p.description}</p>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 rounded-xl"
                  onClick={() => {
                    setEditId(p.id);
                    setForm({
                      title: p.title || '',
                      description: p.description || '',
                      amount: String(p.amount ?? ''),
                      icon_url: p.icon_url || null,
                      active: p.active !== false,
                    });
                    setOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 rounded-xl text-red-400"
                  onClick={() => {
                    if (confirm('Remover produto?')) remove.mutate(p.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0a0a0a] p-5 sm:rounded-3xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-black uppercase tracking-tight">
                {editId ? 'Editar produto' : 'Novo produto'}
              </h2>
              <button type="button" onClick={() => setOpen(false)}>
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-4">
              <ImagePickerField
                label="Foto do produto"
                value={form.icon_url}
                onChange={(v) => setForm((f) => ({ ...f, icon_url: v }))}
                aspect="square"
              />
              <div>
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Título
                </Label>
                <Input
                  className="mt-1 h-12 rounded-xl border-white/10 bg-white/5"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Ex: Curso completo"
                />
              </div>
              <div>
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Valor (R$)
                </Label>
                <Input
                  className="mt-1 h-12 rounded-xl border-white/10 bg-white/5"
                  value={form.amount}
                  inputMode="decimal"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, amount: e.target.value.replace(/[^\d,.]/g, '') }))
                  }
                  placeholder="97,00"
                />
              </div>
              <div>
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Descrição
                </Label>
                <textarea
                  className="mt-1 min-h-[90px] w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-primary/40"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Detalhes do produto..."
                />
              </div>
              <label className="flex items-center gap-2 text-xs font-bold">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                  className="accent-primary"
                />
                Produto ativo
              </label>
              <Button
                className="h-12 w-full rounded-2xl text-xs font-black uppercase tracking-widest"
                disabled={save.isPending}
                onClick={() => save.mutate()}
              >
                {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar produto'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
