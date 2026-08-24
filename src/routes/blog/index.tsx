import { createFileRoute, Link } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { ArrowRight, Calendar, Clock, BookOpen, ChevronLeft } from 'lucide-react';
import maskPlatformAsset from "@/lib/mask-asset";
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/blog/')({
  component: BlogPage,
});

function BlogPage() {
  const posts = [
    {
      title: "Como otimizar seu checkout para conversão máxima",
      excerpt: "Descubra as técnicas usadas pelos maiores e-commerces para reduzir o abandono de carrinho.",
      date: "22 Ago, 2026",
      readTime: "5 min",
      author: "Equipe MaskPay",
      category: "E-commerce"
    },
    {
      title: "Segurança em pagamentos: O que esperar em 2027",
      excerpt: "Novas tecnologias de criptografia e IA estão mudando a forma como protegemos transações.",
      date: "20 Ago, 2026",
      readTime: "8 min",
      author: "Tech MaskPay",
      category: "Segurança"
    },
    {
      title: "Venda global: Aceitando pagamentos internacionais",
      excerpt: "Tudo o que você precisa saber para expandir sua operação além das fronteiras do Brasil.",
      date: "15 Ago, 2026",
      readTime: "6 min",
      author: "Equipe MaskPay",
      category: "Expansão"
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <nav className="fixed top-6 left-0 right-0 z-50 flex justify-center px-6">
        <header className="w-full max-w-5xl h-20 flex items-center justify-between px-8 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-full">
          <Link to="/" className="flex items-center gap-3">
            <img src={maskPlatformAsset.url} alt="MaskPay" className="w-10 h-10 object-contain" />
            <span className="text-xl font-black tracking-tight uppercase flex items-center gap-2">
              MaskPay |
            </span>
          </Link>
          <div className="flex items-center gap-6">
             <Link to="/auth" search={{ mode: 'login' }} className="text-[12px] font-bold text-muted-foreground hover:text-white transition-colors uppercase tracking-[0.2em]">Entrar</Link>
             <Button size="sm" className="rounded-full px-8 bg-transparent border border-primary text-primary hover:bg-primary/10 font-bold transition-all uppercase tracking-widest text-[10px] h-11" asChild>
               <Link to="/auth" search={{ mode: 'register' }}>Cadastre-se</Link>
             </Button>
          </div>
        </header>
      </nav>

      <main className="pt-40 pb-20 container px-6 mx-auto max-w-5xl">
        <Link to="/" className="inline-flex items-center gap-2 text-[10px] font-bold text-muted-foreground hover:text-primary transition-colors uppercase tracking-[0.2em] mb-12 group">
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Voltar para o início
        </Link>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-20"
        >
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter uppercase mb-6">Blog <span className="text-primary">MaskPay</span></h1>
          <p className="text-xl text-muted-foreground/60 max-w-2xl">Insights, tecnologia e o futuro dos pagamentos digitais.</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {posts.map((post, i) => (
            <motion.article 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="group cursor-pointer"
            >
              <div className="aspect-video bg-white/5 border border-white/5 rounded-[2rem] mb-6 overflow-hidden relative flex items-center justify-center">
                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <BookOpen className="w-12 h-12 text-muted-foreground/20 group-hover:text-primary/40 transition-colors" />
                <div className="absolute top-6 left-6 px-3 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-[10px] font-bold text-primary uppercase tracking-widest">
                  {post.category}
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-6 text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">
                  <span className="flex items-center gap-2"><Calendar className="w-3 h-3" /> {post.date}</span>
                  <span className="flex items-center gap-2"><Clock className="w-3 h-3" /> {post.readTime}</span>
                </div>
                <h2 className="text-2xl font-bold tracking-tight group-hover:text-primary transition-colors">{post.title}</h2>
                <p className="text-muted-foreground/60 leading-relaxed line-clamp-2">{post.excerpt}</p>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary pt-2 group-hover:gap-4 transition-all">
                  Ler artigo <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </main>
    </div>
  );
}
