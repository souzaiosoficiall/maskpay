import { createFileRoute, Link } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import maskPlatformAsset from "@/lib/mask-asset";

export const Route = createFileRoute('/legal/privacy')({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <nav className="h-20 flex items-center px-8 border-b border-white/5">
        <Link to="/" className="flex items-center gap-3">
          <img src={maskPlatformAsset.url} alt="MaskPay" className="w-8 h-8 object-contain" />
          <span className="text-lg font-black tracking-tight uppercase">MaskPay |</span>
        </Link>
      </nav>

      <main className="py-24 container px-6 mx-auto max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Link to="/" className="inline-flex items-center gap-2 text-[10px] font-bold text-muted-foreground hover:text-primary transition-colors uppercase tracking-[0.2em] mb-12 group">
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Voltar para o início
          </Link>
          <h1 className="text-4xl font-black uppercase tracking-tight mb-12">Política de Privacidade</h1>
          <div className="space-y-12 text-muted-foreground/60 leading-relaxed">
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white uppercase tracking-widest">1. Introdução</h2>
              <p>A MaskPay valoriza a sua privacidade. Esta política descreve como coletamos, usamos e protegemos seus dados pessoais ao utilizar nossa infraestrutura de pagamentos.</p>
            </section>
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white uppercase tracking-widest">2. Coleta de Dados</h2>
              <p>Coletamos informações necessárias para o processamento de transações financeiras, incluindo dados cadastrais, informações de pagamento e identificadores técnicos para prevenção de fraude.</p>
            </section>
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white uppercase tracking-widest">3. Segurança</h2>
              <p>Utilizamos padrões de criptografia de nível bancário e conformidade PCI-DSS para garantir que todos os dados sensíveis sejam transmitidos e armazenados com segurança absoluta.</p>
            </section>
            <div className="pt-12 text-[10px] font-bold uppercase tracking-widest">Última atualização: 22 de Agosto de 2026</div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
