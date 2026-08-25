import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Copy, CheckCircle2, Star } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  getCheckoutProductBySlug,
  createCheckoutPayment,
} from '@/lib/checkout.functions';

export const Route = createFileRoute('/c/$slug')({
  component: PublicCheckoutPage,
});

function PublicCheckoutPage() {
  const { slug } = Route.useParams();
  const fetchProduct = useServerFn(getCheckoutProductBySlug);
  const payFn = useServerFn(createCheckoutPayment);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [pix, setPix] = useState<{
    qrCode: string;
    amount: number;
    productTitle: string;
    theme_color?: string;
  } | null>(null);

  const { data: product, isLoading, error } = useQuery({
    queryKey: ['checkout_public', slug],
    queryFn: () => fetchProduct({ data: { slug } }),
    retry: 1,
  });

  const payMutation = useMutation({
    mutationFn: () =>
      payFn({
        data: {
          slug,
          customer_name: name.trim(),
          customer_email: email.trim(),
          customer_phone: phone.trim(),
        },
      }),
    onSuccess: (res) => {
      setPix({
        qrCode: res.qrCode,
        amount: res.amount,
        productTitle: res.productTitle,
        theme_color: res.theme_color,
      });
      toast.success('Pix gerado! Pague para concluir.');
    },
    onError: (e: any) => toast.error(e?.message || 'Não foi possível gerar o Pix.'),
  });

  const theme = product?.theme_color || pix?.theme_color || '#22c55e';

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-center text-white">
        <h1 className="text-2xl font-black uppercase">Checkout indisponível</h1>
        <p className="mt-2 text-muted-foreground">
          {(error as Error)?.message || 'Produto não encontrado.'}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {product.banner_url && (
        <div className="h-40 w-full overflow-hidden md:h-56">
          <img src={product.banner_url} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      <div className="mx-auto w-full max-w-lg px-4 py-8">
        <div className="mb-8 flex items-center gap-4">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10"
            style={{ backgroundColor: `${theme}22` }}
          >
            {product.icon_url ? (
              <img src={product.icon_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-2xl font-black" style={{ color: theme }}>
                {(product.title || 'P')[0]}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight md:text-2xl">
              {product.title}
            </h1>
            <p className="mt-1 text-2xl font-black" style={{ color: theme }}>
              {Number(product.amount).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}
            </p>
          </div>
        </div>

        {product.description && (
          <p className="mb-8 whitespace-pre-wrap text-sm leading-relaxed text-white/70">
            {product.description}
          </p>
        )}

        {Array.isArray(product.feedbacks) && product.feedbacks.length > 0 && (
          <div className="mb-8 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Feedbacks
            </p>
            {product.feedbacks.map((fb: any, i: number) => (
              <div
                key={i}
                className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white/10">
                  {fb.avatar_url ? (
                    <img src={fb.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-bold">
                      {(fb.name || '?')[0]}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold">{fb.name}</p>
                  <p className="mt-0.5 text-sm text-white/60">{fb.comment}</p>
                  <div className="mt-1 flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className="h-3 w-3 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!pix ? (
          <div className="space-y-4 rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Seus dados
            </p>
            <div>
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Nome completo
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 h-12 rounded-xl border-white/10 bg-white/5"
                placeholder="Seu nome"
              />
            </div>
            <div>
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                E-mail
              </Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 h-12 rounded-xl border-white/10 bg-white/5"
                placeholder="voce@email.com"
              />
            </div>
            <div>
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Telefone / WhatsApp
              </Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 h-12 rounded-xl border-white/10 bg-white/5"
                placeholder="(11) 99999-9999"
              />
            </div>
            <Button
              className="h-14 w-full rounded-2xl text-sm font-black uppercase tracking-widest text-black"
              style={{ backgroundColor: theme }}
              disabled={payMutation.isPending}
              onClick={() => {
                if (!name.trim() || !email.trim() || !phone.trim()) {
                  toast.error('Preencha nome, e-mail e telefone.');
                  return;
                }
                payMutation.mutate();
              }}
            >
              {payMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                `Pagar ${Number(product.amount).toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}`
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-6 rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-6 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10" style={{ color: theme }} />
            <p className="text-sm font-bold">Pague com Pix para concluir</p>
            <div className="mx-auto flex justify-center rounded-2xl bg-white p-4">
              <QRCodeSVG value={pix.qrCode} size={200} />
            </div>
            <p className="text-2xl font-black" style={{ color: theme }}>
              {pix.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
            <Button
              variant="outline"
              className="w-full rounded-xl border-white/10"
              onClick={() => {
                navigator.clipboard.writeText(pix.qrCode);
                toast.success('Código Pix copiado!');
              }}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copiar código Pix
            </Button>
            <p className="text-xs text-muted-foreground">
              Após o pagamento, o valor cai na conta do vendedor automaticamente.
            </p>
          </div>
        )}

        <p className="mt-10 text-center text-[10px] font-bold uppercase tracking-widest text-white/20">
          Powered by MaskPay
        </p>
      </div>
    </div>
  );
}
