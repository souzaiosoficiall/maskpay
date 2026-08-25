import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Copy, CheckCircle2, Star, ShieldCheck, Lock } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getCheckoutBySlug, createCheckoutPayment } from '@/lib/checkout.functions';

export const Route = createFileRoute('/c/$slug')({
  component: PublicCheckoutPage,
});

function PublicCheckoutPage() {
  const { slug } = Route.useParams();
  const fetchCheckout = useServerFn(getCheckoutBySlug);
  const payFn = useServerFn(createCheckoutPayment);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [pix, setPix] = useState<{ qrCode: string; amount: number; productTitle: string } | null>(
    null,
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ['checkout_public_v2', slug],
    queryFn: () => fetchCheckout({ data: { slug } }),
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
      setPix({ qrCode: res.qrCode, amount: res.amount, productTitle: res.productTitle });
      toast.success('Pix gerado com sucesso');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao gerar Pix'),
  });

  const theme = data?.theme_color || '#6366f1';
  const product = data?.product;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07070a]">
        <Loader2 className="h-8 w-8 animate-spin text-white/60" />
      </div>
    );
  }

  if (error || !data || !product) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#07070a] px-6 text-center text-white">
        <h1 className="text-xl font-black uppercase tracking-tight">Checkout indisponível</h1>
        <p className="mt-2 max-w-sm text-sm text-white/50">
          {(error as Error)?.message || 'Esta página não existe ou foi desativada.'}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07070a] text-white">
      {/* Hero banner */}
      <div className="relative">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background: `radial-gradient(ellipse at top, ${theme}55 0%, transparent 55%)`,
          }}
        />
        {data.banner_url ? (
          <div className="relative h-44 overflow-hidden md:h-56">
            <img src={data.banner_url} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#07070a] via-[#07070a]/40 to-transparent" />
          </div>
        ) : (
          <div className="h-24 md:h-32" />
        )}
      </div>

      <div className="relative mx-auto -mt-10 w-full max-w-md px-4 pb-16">
        <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0c0c10]/95 shadow-2xl shadow-black/50 backdrop-blur-xl">
          {/* Product header */}
          <div className="border-b border-white/5 p-6">
            <div className="flex gap-4">
              <div
                className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/10 shadow-lg"
                style={{ boxShadow: `0 8px 24px ${theme}33` }}
              >
                {product.icon_url ? (
                  <img src={product.icon_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center text-2xl font-black"
                    style={{ backgroundColor: `${theme}22`, color: theme }}
                  >
                    {(product.title || 'P')[0]}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                  Checkout seguro
                </p>
                <h1 className="mt-1 text-lg font-black leading-tight tracking-tight md:text-xl">
                  {product.title}
                </h1>
                <p className="mt-2 text-2xl font-black tracking-tight" style={{ color: theme }}>
                  {Number(product.amount).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </p>
              </div>
            </div>
            {(data.description || product.description) && (
              <p className="mt-4 text-sm leading-relaxed text-white/60">
                {data.description || product.description}
              </p>
            )}
          </div>

          {/* Feedbacks */}
          {Array.isArray(data.feedbacks) && data.feedbacks.length > 0 && (
            <div className="space-y-3 border-b border-white/5 p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                Quem já comprou
              </p>
              {data.feedbacks.map((fb: any, i: number) => (
                <div
                  key={i}
                  className="flex gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3.5"
                >
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white/10">
                    {fb.avatar_url ? (
                      <img src={fb.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-black">
                        {(fb.name || '?')[0]}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold">{fb.name}</p>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                    </div>
                    <p className="mt-0.5 text-sm leading-snug text-white/55">{fb.comment}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Form / Pix */}
          <div className="p-6">
            {!pix ? (
              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                  Finalize sua compra
                </p>
                <div>
                  <Label className="text-[10px] font-black uppercase tracking-widest text-white/40">
                    Nome completo
                  </Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1.5 h-12 rounded-xl border-white/10 bg-white/[0.04] focus-visible:ring-0"
                    placeholder="Como no documento"
                  />
                </div>
                <div>
                  <Label className="text-[10px] font-black uppercase tracking-widest text-white/40">
                    E-mail
                  </Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1.5 h-12 rounded-xl border-white/10 bg-white/[0.04]"
                    placeholder="voce@email.com"
                  />
                </div>
                <div>
                  <Label className="text-[10px] font-black uppercase tracking-widest text-white/40">
                    WhatsApp
                  </Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1.5 h-12 rounded-xl border-white/10 bg-white/[0.04]"
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <Button
                  className="h-14 w-full rounded-2xl text-sm font-black uppercase tracking-widest text-white shadow-lg"
                  style={{
                    background: `linear-gradient(135deg, ${theme}, ${theme}cc)`,
                    boxShadow: `0 12px 32px ${theme}44`,
                  }}
                  disabled={payMutation.isPending}
                  onClick={() => {
                    if (!name.trim() || !email.trim() || !phone.trim()) {
                      toast.error('Preencha nome, e-mail e telefone');
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
                <div className="flex items-center justify-center gap-4 pt-1 text-[10px] font-bold uppercase tracking-wider text-white/30">
                  <span className="flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Pix seguro
                  </span>
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" /> Dados protegidos
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-5 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: `${theme}22` }}>
                  <CheckCircle2 className="h-6 w-6" style={{ color: theme }} />
                </div>
                <div>
                  <p className="font-black uppercase tracking-tight">Pague com Pix</p>
                  <p className="mt-1 text-sm text-white/50">Escaneie o QR ou copie o código</p>
                </div>
                <div className="mx-auto inline-flex rounded-2xl bg-white p-4 shadow-xl">
                  <QRCodeSVG value={pix.qrCode} size={200} level="M" />
                </div>
                <p className="text-3xl font-black tracking-tight" style={{ color: theme }}>
                  {pix.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
                <Button
                  variant="outline"
                  className="h-12 w-full rounded-xl border-white/10 bg-white/5"
                  onClick={() => {
                    navigator.clipboard.writeText(pix.qrCode);
                    toast.success('Código Pix copiado');
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar código Pix
                </Button>
                <p className="text-xs text-white/35">
                  A confirmação é automática após o pagamento.
                </p>
              </div>
            )}
          </div>
        </div>

        <p className="mt-8 text-center text-[10px] font-bold uppercase tracking-[0.25em] text-white/20">
          Powered by MaskPay
        </p>
      </div>
    </div>
  );
}
