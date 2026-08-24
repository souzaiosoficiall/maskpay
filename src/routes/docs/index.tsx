import { createFileRoute, Link } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { Code, Terminal, Search, ChevronLeft, BookOpen } from 'lucide-react';
import maskPlatformAsset from "@/lib/mask-asset";
import { useState } from 'react';

export const Route = createFileRoute('/docs/')({
  component: DocsPage,
});

const DOCS_CONTENT = {
  introducao: {
    title: "Introdução",
    content: (
      <>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          Bem-vindo à documentação oficial da MaskPay. API simples, rápida e segura para aceitar pagamentos em minutos.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
          <div className="p-3 rounded-xl bg-white/5 border border-white/5">
            <Terminal className="w-4 h-4 text-primary mb-2" />
            <h3 className="text-sm font-bold mb-1">API Reference</h3>
            <p className="text-[11px] text-muted-foreground leading-relaxed">Endpoints e parâmetros da REST API.</p>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/5">
            <Code className="w-4 h-4 text-primary mb-2" />
            <h3 className="text-sm font-bold mb-1">SDKs</h3>
            <p className="text-[11px] text-muted-foreground leading-relaxed">Node.js, Python, PHP e mais.</p>
          </div>
        </div>
        <h2 className="text-base font-bold mb-3">Exemplo de requisição</h2>
        <div className="bg-[#050505] border border-white/5 rounded-xl p-3 font-mono text-[11px] overflow-x-auto mb-6">
          <pre className="text-muted-foreground whitespace-pre-wrap">{`curl https://api.maskpay.com/v1/payments \\
  -u mask_live_...: \\
  -d amount=17080 \\
  -d currency=brl \\
  -d payment_method=pix`}</pre>
        </div>
      </>
    ),
  },
  autenticacao: {
    title: "Autenticação",
    content: (
      <>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          A API MaskPay usa chaves de API. Gerencie em Dashboard → API.
        </p>
        <h2 className="text-base font-bold mb-3">Chaves de API</h2>
        <ul className="text-sm text-muted-foreground space-y-2 mb-6 list-disc pl-5">
          <li><span className="text-white font-semibold">Public key</span> — identificação no client</li>
          <li><span className="text-white font-semibold">Secret key</span> — apenas no servidor, nunca no front</li>
        </ul>
        <div className="bg-[#050505] border border-white/5 rounded-xl p-3 font-mono text-[11px] overflow-x-auto">
          <pre className="text-muted-foreground whitespace-pre-wrap">{`Authorization: Bearer mask_live_xxxxx`}</pre>
        </div>
      </>
    ),
  },
  ambientes: {
    title: "Ambientes",
    content: (
      <>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          Sandbox para testes e produção para cobranças reais.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-xl border border-white/10 bg-white/[0.03]">
            <p className="text-xs font-black uppercase tracking-widest text-white mb-1">Sandbox</p>
            <p className="text-[11px] text-muted-foreground">Chaves <code className="text-white/80">mask_test_</code>. Sem dinheiro real.</p>
          </div>
          <div className="p-3 rounded-xl border border-white/10 bg-white/[0.03]">
            <p className="text-xs font-black uppercase tracking-widest text-white mb-1">Produção</p>
            <p className="text-[11px] text-muted-foreground">Chaves <code className="text-white/80">mask_live_</code>. Cobranças reais.</p>
          </div>
        </div>
      </>
    ),
  },
  pagamentos: {
    title: "Pagamentos",
    content: (
      <>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          Crie cobranças PIX, consulte status e receba webhooks de confirmação.
        </p>
        <h2 className="text-base font-bold mb-3">Criar cobrança PIX</h2>
        <div className="bg-[#050505] border border-white/5 rounded-xl p-3 font-mono text-[11px] overflow-x-auto mb-4">
          <pre className="text-muted-foreground whitespace-pre-wrap">{`POST /v1/payments
{
  "amount": 5000,
  "currency": "brl",
  "payment_method": "pix",
  "clientReference": "order_123"
}`}</pre>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Resposta inclui <code className="text-white/80">qrCodeText</code> (copia e cola) e id da cobrança.
        </p>
      </>
    ),
  },
  clientes: {
    title: "Clientes",
    content: (
      <>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          Associe pagamentos a clientes para extrato e conciliação.
        </p>
        <div className="bg-[#050505] border border-white/5 rounded-xl p-3 font-mono text-[11px] overflow-x-auto">
          <pre className="text-muted-foreground whitespace-pre-wrap">{`POST /v1/customers
{ "name": "Maria Silva", "email": "maria@email.com" }`}</pre>
        </div>
      </>
    ),
  },
  webhooks: {
    title: "Webhooks",
    content: (
      <>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          A MaskPay notifica seu servidor quando o status do pagamento muda (ex.: PIX pago).
        </p>
        <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5 mb-4">
          <li>Configure a URL no painel ou no payload (<code className="text-white/80">callbackUrl</code>)</li>
          <li>Valide a assinatura quando disponível</li>
          <li>Responda <code className="text-white/80">200 OK</code> rapidamente</li>
        </ul>
      </>
    ),
  },
} as const;

const NAV = [
  { group: 'Primeiros passos', items: [
    { id: 'introducao', label: 'Introdução' },
    { id: 'autenticacao', label: 'Autenticação' },
    { id: 'ambientes', label: 'Ambientes' },
  ]},
  { group: 'Recursos API', items: [
    { id: 'pagamentos', label: 'Pagamentos' },
    { id: 'clientes', label: 'Clientes' },
    { id: 'webhooks', label: 'Webhooks' },
  ]},
] as const;

function DocsPage() {
  const [activeSection, setActiveSection] = useState<keyof typeof DOCS_CONTENT>('introducao');

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
      <nav
        className="flex items-center justify-between px-4 md:px-6 bg-background border-b border-white/5 sticky top-0 z-50"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)', height: 'calc(3.25rem + env(safe-area-inset-top, 0px))' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-white transition-colors shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <span className="text-white/20 hidden sm:inline">|</span>
          <div className="flex items-center gap-2 min-w-0">
            <img src={maskPlatformAsset.url} alt="" className="w-6 h-6 object-contain shrink-0" />
            <span className="text-xs font-black tracking-widest uppercase truncate">MaskPay Docs</span>
          </div>
        </div>
        <Link
          to="/api-keys"
          className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-white transition-colors shrink-0"
        >
          API Keys
        </Link>
      </nav>

      <div className="flex-1 flex w-full max-w-5xl mx-auto px-3 md:px-4 pb-10">
        <aside className="w-44 py-5 hidden md:block border-r border-white/5 pr-4 shrink-0">
          <nav className="space-y-5">
            {NAV.map((g) => (
              <div key={g.group}>
                <h4 className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground/50 mb-2">
                  {g.group}
                </h4>
                <ul className="space-y-1">
                  {g.items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setActiveSection(item.id)}
                        className={`w-full text-left text-xs font-semibold py-1.5 px-2 rounded-lg transition-colors ${
                          activeSection === item.id
                            ? 'bg-white/10 text-white'
                            : 'text-muted-foreground hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* Mobile section tabs */}
        <div className="md:hidden w-full">
          <div className="flex gap-1 overflow-x-auto py-3 -mx-1 px-1">
            {NAV.flatMap((g) => g.items).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={`shrink-0 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full border transition-colors ${
                  activeSection === item.id
                    ? 'bg-white text-black border-white'
                    : 'border-white/10 text-muted-foreground'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <main className="pt-1 pb-8">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4 text-muted-foreground" />
              <h1 className="text-lg font-black tracking-tight uppercase">
                {DOCS_CONTENT[activeSection].title}
              </h1>
            </div>
            {DOCS_CONTENT[activeSection].content}
          </main>
        </div>

        <main className="hidden md:block flex-1 py-5 pl-6 min-w-0 overflow-x-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
            >
              <h1 className="text-xl font-black tracking-tight uppercase mb-4">
                {DOCS_CONTENT[activeSection].title}
              </h1>
              {DOCS_CONTENT[activeSection].content}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
