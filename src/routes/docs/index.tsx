import { createFileRoute, Link } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { Code, Book, Terminal, Globe, Shield, Zap, Search, ChevronLeft } from 'lucide-react';
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
        <p className="text-lg text-muted-foreground/60 leading-relaxed mb-12">
          Bem-vindo à documentação oficial da MaskPay. Nossa API foi projetada para ser simples, rápida e segura, permitindo que você aceite pagamentos em minutos.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          <div className="p-6 rounded-[1.5rem] bg-white/5 border border-white/5 hover:border-white/10 transition-colors group cursor-pointer no-underline block">
            <Terminal className="w-6 h-6 text-primary mb-4" />
            <h3 className="text-lg font-bold mb-2">API Reference</h3>
            <p className="text-xs text-muted-foreground/40 leading-relaxed">Consulte todos os endpoints e parâmetros da nossa REST API.</p>
          </div>
          <div className="p-6 rounded-[1.5rem] bg-white/5 border border-white/5 hover:border-white/10 transition-colors group cursor-pointer no-underline block">
            <Code className="w-6 h-6 text-primary mb-4" />
            <h3 className="text-lg font-bold mb-2">SDKs</h3>
            <p className="text-xs text-muted-foreground/40 leading-relaxed">Bibliotecas para Node.js, Python, PHP e muito mais.</p>
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-6">Exemplo de Requisição</h2>
        <div className="bg-[#050505] border border-white/5 rounded-2xl p-6 font-mono text-sm overflow-x-auto mb-12">
          <pre className="text-muted-foreground/80">
            <code>{`curl https://api.maskpay.com/v1/payments \\
  -u mask_live_...: \\
  -d amount=17080 \\
  -d currency=brl \\
  -d payment_method=pix`}</code>
          </pre>
        </div>
      </>
    )
  },
  autenticacao: {
    title: "Autenticação",
    content: (
      <>
        <p className="text-lg text-muted-foreground/60 leading-relaxed mb-12">
          A API da MaskPay utiliza chaves de API para autenticar as requisições. Você pode gerenciar suas chaves de API no Dashboard.
        </p>
        <h2 className="text-2xl font-bold mb-6">Chaves de API</h2>
        <p className="text-muted-foreground/60 mb-6">
          Suas chaves de API têm o prefixo <code className="text-primary">mask_live_</code> para produção e <code className="text-primary">mask_test_</code> para o ambiente de testes.
        </p>
        <div className="bg-[#050505] border border-white/5 rounded-2xl p-6 font-mono text-sm overflow-x-auto mb-12">
          <pre className="text-muted-foreground/80">
            <code>{`Authorization: Bearer mask_live_YOUR_SECRET_KEY`}</code>
          </pre>
        </div>
      </>
    )
  },
  ambientes: {
    title: "Ambientes (Sandbox)",
    content: (
      <>
        <p className="text-lg text-muted-foreground/60 leading-relaxed mb-12">
          Oferecemos um ambiente de Sandbox completo para que você possa testar sua integração sem processar transações reais.
        </p>
        <h2 className="text-2xl font-bold mb-6">Mudando de Ambiente</h2>
        <p className="text-muted-foreground/60 mb-6">
          Para utilizar o Sandbox, basta trocar sua chave de API para uma chave com o prefixo <code className="text-primary">mask_test_</code>. Nenhuma outra mudança na URL ou nos parâmetros é necessária.
        </p>
      </>
    )
  },
  pagamentos: {
    title: "Pagamentos",
    content: (
      <>
        <p className="text-lg text-muted-foreground/60 leading-relaxed mb-12">
          Crie e gerencie pagamentos de forma simples. Suportamos Pix, Cartão de Crédito e Boleto.
        </p>
        <h2 className="text-2xl font-bold mb-6">Criando um Pagamento</h2>
        <div className="bg-[#050505] border border-white/5 rounded-2xl p-6 font-mono text-sm overflow-x-auto mb-12">
          <pre className="text-muted-foreground/80">
            <code>{`POST /v1/payments
{
  "amount": 10000,
  "currency": "brl",
  "description": "Venda de Produto",
  "payment_method": "pix"
}`}</code>
          </pre>
        </div>
      </>
    )
  },
  clientes: {
    title: "Clientes",
    content: (
      <>
        <p className="text-lg text-muted-foreground/60 leading-relaxed mb-12">
          Gerencie os dados dos seus clientes para facilitar pagamentos recorrentes e checkout express.
        </p>
      </>
    )
  },
  assinaturas: {
    title: "Assinaturas",
    content: (
      <>
        <p className="text-lg text-muted-foreground/60 leading-relaxed mb-12">
          Implemente cobranças recorrentes com facilidade. Ideal para SaaS, clubes de assinatura e serviços mensais.
        </p>
      </>
    )
  },
  webhooks: {
    title: "Webhooks",
    content: (
      <>
        <p className="text-lg text-muted-foreground/60 leading-relaxed mb-12">
          Receba notificações em tempo real sobre eventos que ocorrem na sua conta, como pagamentos confirmados ou reembolsos.
        </p>
      </>
    )
  }
};

function DocsPage() {
  const [activeSection, setActiveSection] = useState<keyof typeof DOCS_CONTENT>('introducao');

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
      <nav className="h-20 flex items-center justify-between px-8 bg-black/40 border-b border-white/5 backdrop-blur-xl sticky top-0 z-50">
        <Link to="/" className="flex items-center gap-3">
          <img src={maskPlatformAsset.url} alt="MaskPay" className="w-8 h-8 object-contain" />
          <span className="text-lg font-black tracking-tight uppercase flex items-center gap-2">
            MaskPay | Docs
          </span>
        </Link>
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/5 text-xs text-muted-foreground">
            <Search className="w-3 h-3" />
            <span>Buscar documentação...</span>
          </div>
          <Link to="/auth" search={{ mode: 'login' }} className="text-xs font-bold uppercase tracking-widest hover:text-primary transition-colors">Acessar API Keys</Link>
        </div>
      </nav>

      <div className="flex-1 flex container mx-auto px-6">
        <aside className="w-64 py-12 hidden lg:block border-r border-white/5 pr-8">
          <nav className="space-y-8">
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 mb-4">Primeiros Passos</h4>
              <ul className="space-y-3 text-sm font-medium">
                <li>
                  <button 
                    onClick={() => setActiveSection('introducao')}
                    className={`transition-colors text-left w-full ${activeSection === 'introducao' ? 'text-primary' : 'text-muted-foreground/60 hover:text-white'}`}
                  >
                    Introdução
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => setActiveSection('autenticacao')}
                    className={`transition-colors text-left w-full ${activeSection === 'autenticacao' ? 'text-primary' : 'text-muted-foreground/60 hover:text-white'}`}
                  >
                    Autenticação
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => setActiveSection('ambientes')}
                    className={`transition-colors text-left w-full ${activeSection === 'ambientes' ? 'text-primary' : 'text-muted-foreground/60 hover:text-white'}`}
                  >
                    Ambientes (Sandbox)
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 mb-4">Recursos API</h4>
              <ul className="space-y-3 text-sm font-medium">
                <li>
                  <button 
                    onClick={() => setActiveSection('pagamentos')}
                    className={`transition-colors text-left w-full ${activeSection === 'pagamentos' ? 'text-primary' : 'text-muted-foreground/60 hover:text-white'}`}
                  >
                    Pagamentos
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => setActiveSection('clientes')}
                    className={`transition-colors text-left w-full ${activeSection === 'clientes' ? 'text-primary' : 'text-muted-foreground/60 hover:text-white'}`}
                  >
                    Clientes
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => setActiveSection('assinaturas')}
                    className={`transition-colors text-left w-full ${activeSection === 'assinaturas' ? 'text-primary' : 'text-muted-foreground/60 hover:text-white'}`}
                  >
                    Assinaturas
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => setActiveSection('webhooks')}
                    className={`transition-colors text-left w-full ${activeSection === 'webhooks' ? 'text-primary' : 'text-muted-foreground/60 hover:text-white'}`}
                  >
                    Webhooks
                  </button>
                </li>
              </ul>
            </div>
          </nav>
        </aside>

        <main className="flex-1 py-12 lg:pl-12 max-w-3xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="prose prose-invert prose-maskpay"
            >
              <Link to="/" className="inline-flex items-center gap-2 text-[10px] font-bold text-muted-foreground hover:text-primary transition-colors uppercase tracking-[0.2em] mb-8 group no-underline">
                <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                Voltar para o início
              </Link>
              <h1 className="text-4xl font-black tracking-tight uppercase mb-8">{DOCS_CONTENT[activeSection].title}</h1>
              {DOCS_CONTENT[activeSection].content}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}