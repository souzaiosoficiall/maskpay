import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Loader2,
  Copy,
  CheckCircle2,
  Star,
  ShieldCheck,
  Lock,
  Banknote,
  Info,
  BadgeCheck,
  Clock,
} from 'lucide-react';
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

  const theme = data?.theme_color || '#e11d48';
  const product = data?.product;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050508]">
        <Loader2 className="h-8 w-8 animate-spin text-white/50" />
      </div>
    );
  }

  if (error || !data || !product) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#050508] px-6 text-center text-white">
        <h1 className="text-xl font-black uppercase tracking-tight">Checkout indisponível</h1>
        <p className="mt-2 max-w-sm text-sm text-white/50">
          {(error as Error)?.message || 'Esta página não existe ou foi desativada.'}
        </p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#050508] text-white">
      {/* Ambient background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 20% -10%, ${theme}33 0%, transparent 50%),
            radial-gradient(ellipse 60% 40% at 90% 80%, ${theme}14 0%, transparent 45%)
          `,
        }}
      />
      {data.banner_url && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-56 opacity-30 md:h-72">
          <img src={data.banner_url} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#050508]/60 to-[#050508]" />
        </div>
      )}

      {/* Layout: shifted left on desktop, form + security panel */}
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-4 py-10 md:px-8 lg:px-10">
        <div className="grid w-full items-start gap-8 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:justify-start lg:gap-12 xl:grid-cols-[minmax(0,440px)_minmax(280px,360px)] xl:justify-start">
          {/* Checkout card — left */}
          <div className="w-full max-w-[440px] justify-self-start overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0c0c12]/92 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
            <div className="border-b border-white/5 p-6 md:p-7">
              <div className="flex gap-4">
                <div
                  className="h-[4.25rem] w-[4.25rem] shrink-0 overflow-hidden rounded-2xl border border-white/10"
                  style={{ boxShadow: `0 10px 28px ${theme}40` }}
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
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/35">
                    Checkout seguro
                  </p>
                  <h1 className="mt-1 text-lg font-black leading-snug tracking-tight md:text-xl">
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
                <p className="mt-4 text-sm leading-relaxed text-white/55">
                  {data.description || product.description}
                </p>
              )}
            </div>

            {Array.isArray(data.feedbacks) && data.feedbacks.length > 0 && (
              <div className="space-y-3 border-b border-white/5 px-6 py-5 md:px-7">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35">
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
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold">{fb.name}</p>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star key={s} className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                          ))}
                        </div>
                      </div>
                      <p className="mt-0.5 text-sm leading-snug text-white/50">{fb.comment}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="p-6 md:p-7">
              {!pix ? (
                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35">
                    Finalize sua compra
                  </p>
                  <div>
                    <Label className="text-[10px] font-black uppercase tracking-widest text-white/40">
                      Nome completo
                    </Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1.5 h-12 rounded-xl border-white/10 bg-white/[0.04] text-white placeholder:text-white/25 focus-visible:ring-1 focus-visible:ring-white/20"
                      placeholder="Ex: Ana Paula Ferreira"
                      autoComplete="name"
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
                      className="mt-1.5 h-12 rounded-xl border-white/10 bg-white/[0.04] text-white placeholder:text-white/25"
                      placeholder="Ex: ana.ferreira@gmail.com"
                      autoComplete="email"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] font-black uppercase tracking-widest text-white/40">
                      WhatsApp
                    </Label>
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="mt-1.5 h-12 rounded-xl border-white/10 bg-white/[0.04] text-white placeholder:text-white/25"
                      placeholder="Ex: (11) 98765-4321"
                      autoComplete="tel"
                    />
                  </div>
                  <Button
                    className="h-14 w-full rounded-2xl text-sm font-black uppercase tracking-widest text-white"
                    style={{
                      background: `linear-gradient(135deg, ${theme}, ${theme}b8)`,
                      boxShadow: `0 14px 36px ${theme}44`,
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
                  <div className="flex items-center justify-center gap-5 pt-1 text-[10px] font-bold uppercase tracking-wider text-white/30">
                    <span className="flex items-center gap-1.5">
                      <Lock className="h-3 w-3" /> Pix seguro
                    </span>
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="h-3 w-3" /> Dados protegidos
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-5 text-center">
                  <div
                    className="mx-auto flex h-12 w-12 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${theme}22` }}
                  >
                    <CheckCircle2 className="h-6 w-6" style={{ color: theme }} />
                  </div>
                  <div>
                    <p className="font-black uppercase tracking-tight">Pague com Pix</p>
                    <p className="mt-1 text-sm text-white/45">Escaneie o QR ou copie o código</p>
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

          {/* Security / trust panel — right (desktop), below on mobile */}
          <aside className="w-full max-w-[440px] space-y-4 lg:max-w-none lg:pt-2">
            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md md:p-6">
              <div className="mb-4 flex items-center gap-2">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${theme}22` }}
                >
                  <ShieldCheck className="h-4.5 w-4.5" style={{ color: theme }} />
                </div>
                <h2 className="text-sm font-black uppercase tracking-wide">Pagamento seguro</h2>
              </div>
              <ul className="space-y-3.5 text-sm leading-relaxed text-white/55">
                <li className="flex gap-3">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" style={{ color: theme }} />
                  <span>
                    Transação via <strong className="text-white/80">Pix</strong>, com criptografia e
                    liquidação em tempo real.
                  </span>
                </li>
                <li className="flex gap-3">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-white/40" />
                  <span>
                    Seus dados são usados apenas para processar o pedido. Não armazenamos senha do
                    banco.
                  </span>
                </li>
                <li className="flex gap-3">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-white/40" />
                  <span>
                    Após o pagamento, a confirmação costuma ser <strong className="text-white/80">instantânea</strong>.
                  </span>
                </li>
              </ul>
            </div>

            <div className="rounded-[1.5rem] border border-amber-500/20 bg-amber-500/[0.06] p-5 md:p-6">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15">
                  <Info className="h-4 w-4 text-amber-300" />
                </div>
                <h2 className="text-sm font-black uppercase tracking-wide text-amber-100">
                  Aviso sobre MED
                </h2>
              </div>
              <div className="space-y-3 text-sm leading-relaxed text-amber-100/70">
                <p>
                  Em alguns bancos pode aparecer um alerta de <strong className="text-amber-50">MED</strong>{' '}
                  (Mecanismo Especial de Devolução) ou aviso de segurança ao pagar Pix.
                </p>
                <p>
                  Isso é <strong className="text-amber-50">normal</strong> e faz parte da proteção do
                  próprio banco. Você pode seguir com o pagamento com tranquilidade.
                </p>
                <p className="flex gap-2 text-amber-100/80">
                  <Banknote className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                  Confira o valor e o destinatário, confirme o Pix e pronto — o pedido é liberado
                  automaticamente.
                </p>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-white/8 bg-white/[0.02] px-5 py-4 text-center text-[11px] leading-relaxed text-white/35 md:text-left">
              Ambiente de pagamento protegido. Em caso de dúvida, fale com o vendedor antes de
              concluir.
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
