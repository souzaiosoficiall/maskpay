 




 
 
 




import { DevToolsDetector } from '@/components/DevToolsDetector';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { 
  ArrowRight, Shield, Zap, Globe, Wallet, BarChart3, Lock, 
  CheckCircle2, TrendingUp, Users, Activity,
  CreditCard, Smartphone, ChevronRight, ZapIcon, 
  ShieldCheck, Headphones
} from 'lucide-react';
import { motion, useMotionValue, useSpring, useTransform, animate, AnimatePresence, useScroll } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useEffect, useState, useMemo, useCallback } from 'react';
import Lenis from 'lenis';
import { supabase } from '@/integrations/supabase/client';
import { isSecurityLocked, clearAuthStorage } from '@/lib/security-lock';

const coinsAsset = { url: "/assets/coins.png" };
const maskLogoAsset = { url: "/assets/mask_logo.png" };
const utmifyAsset = { url: "/assets/utmify-logo.png" };
const googleAsset = { url: "/assets/google-logo.png" };
const pixCalculatorAsset = { url: "/assets/PIX_SEM_FUNDO.png" };
import { calculateDepositAmounts } from "@/lib/fees-logic";

function Calculator() {
  const [value, setValue] = useState<string>("");
  const [fees, setFees] = useState<{ deposit: { percentage: number; fixed: number }; withdrawal: { fixed: number } }>({
    deposit: { percentage: 2.49, fixed: 0.40 },
    withdrawal: { fixed: 0.80 }
  });

  // Fetch real fees from public endpoint or client-side supabase if public access is allowed
  useEffect(() => {
    const fetchFees = async () => {
      const { data, error } = await import('@/integrations/supabase/client').then(m => 
        m.supabase.from('platform_configs').select('key, value').in('key', ['pix_deposit_fees', 'pix_withdrawal_fees'])
      );
      
      if (data && !error) {
        const newFees: any = {};
        data.forEach((item: any) => {
          newFees[item.key] = item.value;
        });
        setFees({
          deposit: newFees.pix_deposit_fees || { percentage: 2.49, fixed: 0.40 },
          withdrawal: newFees.pix_withdrawal_fees || { fixed: 0.80 }
        });
      }
    };
    fetchFees();
  }, []);
  
  const calculateTotal = (input: string) => {
    const numValue = parseFloat(input.replace(",", ".")) || 0;
    if (numValue === 0) return 0;
    
    // Total a receber = Valor da venda - Taxa de Depósito - Taxa de Saque
    const { netAmount: amountAfterDepositFee } = calculateDepositAmounts(numValue, fees.deposit);
    const totalNet = amountAfterDepositFee - fees.withdrawal.fixed;
    
    return Math.max(0, totalNet);
  };

  const netValue = useMemo(() => calculateTotal(value), [value, fees]);

  return (
    <div id="taxas-simulador" className="flex flex-col md:flex-row items-center justify-center gap-12 w-full max-w-6xl mx-auto py-24 px-6 overflow-hidden">
      <motion.div
        initial={{ opacity: 0, x: -50 }}
        whileInView={{ opacity: 1, x: 0 }}
        whileHover={{ scale: 1.1, rotate: 2 }}
        viewport={{ once: true }}
        transition={{ 
          type: "spring",
          stiffness: 300,
          damping: 20
        }}
        className="w-full md:w-1/2 flex justify-center md:justify-end cursor-pointer"
      >
        <img 
          src={pixCalculatorAsset.url} 
          alt="Calculadora de Taxas" 
          className="w-full max-w-[450px] h-auto object-contain drop-shadow-2xl transition-all duration-300 hover:drop-shadow-[0_20px_40px_rgba(255,255,255,0.1)]"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 50 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="w-full md:w-1/2"
      >
        <div className="bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative overflow-hidden w-full max-w-[500px]">
          <div className="space-y-8 relative z-10">
            <div>
              <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tighter mb-2">DESCUBRA QUANTO VOCÊ VAI RECEBER</h3>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Valor da venda (R$)</label>
                <div className="relative group">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-primary font-black text-xl">R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={value}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^\d,]/g, "");
                      setValue(val);
                    }}
                    className="w-full h-20 bg-white/5 border border-white/10 rounded-2xl pl-16 pr-8 text-2xl font-black text-white focus:outline-none focus:border-primary/50 transition-all placeholder:text-white/10"
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-white/5 space-y-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Total a receber na conta bancária</p>
                <div className="h-24 bg-primary/5 border border-primary/20 rounded-2xl flex items-center px-8 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[50px] -mr-16 -mt-16 rounded-full group-hover:bg-primary/20 transition-all duration-500" />
                  <span className="text-3xl md:text-4xl font-black text-primary relative z-10">
                    R$ {netValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                  <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-1">Taxa Processamento</p>
                  <p className="text-xs font-bold text-white uppercase">{fees.deposit.percentage}% + R$ {fees.deposit.fixed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                  <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-1">Taxa de Saque</p>
                  <p className="text-xs font-bold text-white uppercase">R$ {fees.withdrawal.fixed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} Fixo</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}


export const Route = createFileRoute('/')({
  component: LandingPage,
});

function AnimatedNumber({ value }: { value: number }) {
  const motionValue = useMotionValue(value);
  const springValue = useSpring(motionValue, {
    damping: 30,
    stiffness: 100,
  });
  const displayValue = useTransform(springValue, (latest) => 
    Math.floor(latest).toLocaleString('pt-BR')
  );

  useEffect(() => {
    motionValue.set(value);
  }, [value, motionValue]);

  return <motion.span>{displayValue}</motion.span>;
}

function LandingPage() {
  // If already logged in, skip homepage and go straight to the account (lock screen / dashboard)
  useEffect(() => {
    let cancelled = false;
    if (isSecurityLocked()) {
      clearAuthStorage();
      supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session?.access_token) {
        window.location.replace('/dashboard');
      }
    });
    return () => { cancelled = true; };
  }, []);

  const [revenue, setRevenue] = useState(17080);
  const [view, setView] = useState<'Mensal' | 'Semanal' | 'Diário'>('Mensal');
  const [chartData, setChartData] = useState([
    { label: "JAN", height: 40, active: false },
    { label: "FEV", height: 30, active: false },
    { label: "MAR", height: 85, active: true },
    { label: "ABR", height: 45, active: false },
    { label: "MAI", height: 55, active: false },
    { label: "JUN", height: 40, active: false },
    { label: "JUL", height: 50, active: false },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRevenue(prev => prev + Math.floor(Math.random() * 50) - 10);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const cycleInterval = setInterval(() => {
      setView(current => {
        if (current === 'Mensal') return 'Semanal';
        if (current === 'Semanal') return 'Diário';
        return 'Mensal';
      });
    }, 5000);
    return () => clearInterval(cycleInterval);
  }, []);

  useEffect(() => {
    const labels = {
      'Mensal': ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL"],
      'Semanal': ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"],
      'Diário': ["08h", "10h", "12h", "14h", "16h", "18h", "20h"]
    };

    setChartData(labels[view].map((label, i) => ({
      label,
      height: Math.floor(Math.random() * 70) + 20,
      active: i === 2 || i === 4
    })));
  }, [view]);
  useEffect(() => {
    // Only initialize Lenis on desktop
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isMobile) return;

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      infinite: false,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background selection:bg-primary/20 font-sans text-foreground overflow-x-hidden origin-top">
      <DevToolsDetector />



      {/* Navigation */}
      <div className="fixed left-0 right-0 z-50 flex justify-center px-4 md:px-6 pointer-events-none" style={{ top: "max(0.85rem, calc(env(safe-area-inset-top, 0px) + 0.5rem))" }}>
        <header className="w-full max-w-5xl h-20 flex items-center justify-between px-8 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-full pointer-events-auto">
          <div className="flex-1 md:flex-none flex items-center justify-center md:justify-start">
            <Link to="/" className="flex items-center gap-3">
              <img src={maskLogoAsset.url} alt="MaskPay" className="w-10 h-10 object-contain" />
              <span className="text-xl font-black tracking-tight uppercase">
                <span className="hidden md:inline">MaskPay |</span>
                <span className="md:hidden">MaskPay</span>
              </span>
            </Link>
          </div>
          
          <nav className="hidden md:flex items-center gap-10">
            {['Blog', 'Docs', 'Taxas'].map((item) => {
              if (item === 'Taxas') {
                return (
                  <button 
                    key={item} 
                    onClick={() => document.getElementById('taxas-simulador')?.scrollIntoView({ behavior: 'smooth' })}
                    className="text-[12px] font-bold text-muted-foreground hover:text-white transition-colors uppercase tracking-[0.2em] cursor-pointer"
                  >
                    {item}
                  </button>
                );
              }
              return (
                <Link key={item} to={item === 'Blog' ? '/blog' : '/docs'} className="text-[12px] font-bold text-muted-foreground hover:text-white transition-colors uppercase tracking-[0.2em]">
                  {item}
                </Link>
              );
            })}
          </nav>

          <div className="flex-1 md:flex-none flex items-center justify-end gap-4 md:gap-6">
            <Link 
              to="/auth" 
              search={{ mode: 'login' }}
              className="text-[10px] md:text-[12px] font-bold text-muted-foreground hover:text-white transition-colors uppercase tracking-[0.2em] flex items-center gap-2"
            >
              <Users className="hidden sm:block w-4 h-4" />
              Entrar
            </Link>
            <Button size="sm" className="rounded-full px-4 md:px-8 bg-transparent border border-primary text-primary hover:bg-primary/10 font-bold transition-all uppercase tracking-widest text-[9px] md:text-[10px] h-10 md:h-11 hidden md:flex" asChild>
              <Link to="/auth" search={{ mode: 'register' }}>Cadastre-se</Link>
            </Button>
          </div>

        </header>
      </div>

      <main className="flex-1 pt-24 md:pt-28">
        {/* Mobile Register Button - Sticky Footer */}
        <div className="md:hidden fixed bottom-6 left-0 right-0 z-50 flex justify-center px-6 pointer-events-none">
          <Button size="lg" className="w-full max-w-sm rounded-full bg-primary text-primary-foreground font-black transition-all uppercase tracking-[0.2em] text-[10px] h-14 shadow-2xl shadow-primary/20 pointer-events-auto border-none" asChild>
            <Link to="/auth" search={{ mode: 'register' }}>Cadastre-se agora</Link>
          </Button>
        </div>

        {/* Hero Section */}
        <motion.section 
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="py-24 lg:py-32 relative overflow-x-hidden w-full"
        >

          <div className="container px-4 md:px-6 mx-auto relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div className="text-left space-y-8">
                
                <motion.h1 
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8 }}
                  className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.1]"
                >
                  Venda mais com a <br />
                  <span className="text-primary">MaskPay</span>
                </motion.h1>
                
                <motion.p 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.1 }}
                  className="text-lg text-muted-foreground/60 leading-relaxed max-w-lg"
                >
                  Escale as suas operações sem saque travados. Venda on-line sem complicações.
                </motion.p>
                
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className="flex flex-col sm:flex-row items-center gap-4"
                >
                  <Button size="lg" className="w-full sm:w-auto rounded-full px-10 h-14 text-sm font-bold bg-primary text-primary-foreground hover:scale-105 transition-all uppercase tracking-widest shadow-lg shadow-primary/20" asChild>
                    <Link to="/auth" search={{ mode: 'register' }}>
                      Começar agora <ChevronRight className="ml-2 w-4 h-4" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" className="w-full sm:w-auto rounded-full px-10 h-14 text-sm font-bold border-white/10 hover:bg-white/5 transition-all uppercase tracking-widest" asChild>
                    <a href="https://wa.me/5527997306436?text=Ola!%20Eu%20quero%20falar%20sobre%20o%20gateway%20MASKPAY" target="_blank" rel="noopener noreferrer">Falar com consultor</a>
                  </Button>
                </motion.div>
              </div>

              {/* Animated Chart Component */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1 }}
                className="relative"
              >
                <div className="bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative overflow-hidden aspect-[4/3] flex flex-col justify-between">
                  <div className="flex justify-between items-start relative z-10">
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Fluxo de Receita</p>
                      <h3 className="text-3xl md:text-4xl font-bold tracking-tight">
                        R$<AnimatedNumber value={revenue} />
                      </h3>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 flex items-center gap-2 transition-all duration-500">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{view}</span>
                    </div>
                  </div>

                  <div className="flex items-end justify-between gap-3 h-48 mt-12 relative">
                    {/* Horizontal Grid Lines */}
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none py-2">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="w-full border-t border-white/[0.05]" />
                      ))}
                    </div>

                    {chartData.map((bar, i) => (
                      <div key={`${view}-${i}`} className="flex-1 flex flex-col items-center gap-4 relative z-10 h-full justify-end">
                        <motion.div 
                          layoutId={`bar-${i}`}
                          className={cn(
                            "w-full rounded-t-xl relative min-w-[12px] transition-colors duration-500",
                            bar.active ? "bg-primary shadow-[0_0_30px_rgba(255,255,255,0.1)]" : "bg-white/10 border border-white/5"
                          )}
                          initial={{ height: 0 }}
                          animate={{ 
                            height: `${bar.height}%`,
                          }}
                          transition={{ 
                            type: "spring",
                            damping: 25,
                            stiffness: 120,
                            delay: i * 0.02
                          }}
                        />
                        <motion.span 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-[8px] font-black text-muted-foreground uppercase tracking-widest"
                        >
                          {bar.label}
                        </motion.span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="absolute bottom-4 right-8 text-[8px] font-bold text-muted-foreground/20 uppercase tracking-[0.3em]">
                    AGO 2026
                  </div>
                </div>

                {/* Background Glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-primary/5 blur-[100px] -z-10 rounded-full" />
              </motion.div>
            </div>
          </div>
        </motion.section>


        {/* Features Section */}
        <motion.section 
          initial={{ opacity: 0, y: 150 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
          className="py-24 md:py-32 w-full overflow-hidden"
        >

          <div className="container px-4 md:px-6 mx-auto">

            {/* Carousel Section moved here */}
            <div className="w-full overflow-hidden relative mb-24">
              <div className="flex w-fit animate-marquee gap-8 md:gap-24 items-center px-12">
                {/* First Set */}
                <img src={maskLogoAsset.url} alt="MaskPay" className="h-8 md:h-16 w-auto object-contain opacity-40 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-500" />
                <img src={googleAsset.url} alt="Google" className="h-8 md:h-16 w-auto object-contain opacity-40 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-500" />
                <img src={utmifyAsset.url} alt="Utmify" className="h-8 md:h-16 w-auto object-contain opacity-40 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-500" />
                
                <img src={maskLogoAsset.url} alt="MaskPay" className="h-8 md:h-16 w-auto object-contain opacity-40 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-500" />
                <img src={googleAsset.url} alt="Google" className="h-8 md:h-16 w-auto object-contain opacity-40 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-500" />
                <img src={utmifyAsset.url} alt="Utmify" className="h-8 md:h-16 w-auto object-contain opacity-40 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-500" />

                {/* Duplicate Set for Loop */}
                <img src={maskLogoAsset.url} alt="MaskPay" className="h-8 md:h-16 w-auto object-contain opacity-40 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-500" />
                <img src={googleAsset.url} alt="Google" className="h-8 md:h-16 w-auto object-contain opacity-40 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-500" />
                <img src={utmifyAsset.url} alt="Utmify" className="h-8 md:h-16 w-auto object-contain opacity-40 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-500" />
                
                <img src={maskLogoAsset.url} alt="MaskPay" className="h-8 md:h-16 w-auto object-contain opacity-40 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-500" />
                <img src={googleAsset.url} alt="Google" className="h-8 md:h-16 w-auto object-contain opacity-40 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-500" />
                <img src={utmifyAsset.url} alt="Utmify" className="h-8 md:h-16 w-auto object-contain opacity-40 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-500" />
              </div>
            </div>

            <div className="text-center mb-16 md:mb-24 w-full px-4 overflow-hidden">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 px-4">
                A MaskPay se adapta ao seu negócio
              </h2>
              <p className="text-muted-foreground/60 text-lg">
                Desenvolvido para escalar seu faturamento com total segurança.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { 
                  title: "Aprovação Imediata", 
                  desc: "Nossa tecnologia otimiza cada transação para garantir a maior taxa de aprovação do mercado.",
                  icon: <Zap className="w-5 h-5" />
                },
                { 
                  title: "Checkout de Alta Conversão", 
                  desc: "Checkout transparente e otimizado para mobile, reduzindo o abandono de carrinho drasticamente.",
                  icon: <TrendingUp className="w-5 h-5" />
                },
                { 
                  title: "Suporte 24/7", 
                  desc: "Time especializado pronto para ajudar sua operação a crescer sem interrupções.",
                  icon: <CheckCircle2 className="w-5 h-5" />
                }
              ].map((feature, i) => (
                <div key={i} className="bg-[#0f0f0f] border border-white/10 rounded-[2rem] md:rounded-[2.5rem] p-8 md:p-12 flex flex-col items-start gap-6 md:gap-8 hover:border-white/20 transition-colors">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-primary border border-white/5">
                    {feature.icon}
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-xl md:text-2xl font-bold tracking-tight leading-tight">{feature.title}</h3>
                    <p className="text-muted-foreground/50 text-base md:text-lg leading-relaxed">{feature.desc}</p>

                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>


        {/* Detailed Features (image-21 style) */}
        <motion.section 
          initial={{ opacity: 0, y: 150 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
          className="py-24 border-t border-white/5 bg-black/10"
        >

          <div className="container px-6 mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
              {[
                { 
                  title: "ESCALABILIDADE", 
                  desc: "Processe milhares de transações por segundo sem latência ou interrupções.",
                  icon: <Zap className="w-5 h-5" />
                },
                { 
                  title: "SEGURANÇA", 
                  desc: "Proteção de dados em nível bancário com criptografia de ponta a ponta.",
                  icon: <Lock className="w-5 h-5" />
                },
                { 
                  title: "INTEGRAÇÃO", 
                  desc: "API moderna e intuitiva que permite integração em poucos minutos.",
                  icon: <Globe className="w-5 h-5" />
                }
              ].map((feature, i) => (
                <div key={i} className="flex flex-col items-start gap-6">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-primary border border-white/10">
                    {feature.icon}
                  </div>
                  <div className="space-y-3">
                    <h4 className="text-base font-black uppercase tracking-widest">{feature.title}</h4>
                    <p className="text-muted-foreground/40 text-sm leading-relaxed max-w-xs">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>


        {/* Calculator Section */}
        <Calculator />

        {/* Trust Section */}
        <motion.section 
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="py-40"
        >

          <div className="container px-4 md:px-6 mx-auto text-center">
            <h2 className="text-3xl md:text-6xl font-black tracking-tighter uppercase mb-16 md:mb-24 px-4">
              Feito para <span className="text-muted-foreground/30">grandes</span> operações.
            </h2>
            
            <div className="flex flex-col items-center gap-16">
              {/* Main Visual */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.1, rotate: 2 }}
                whileTap={{ scale: 0.95 }}
                viewport={{ once: true }}
                transition={{ 
                  type: "spring",
                  stiffness: 400,
                  damping: 17
                }}
                className="flex justify-center cursor-pointer"
              >
                <img 
                  src={coinsAsset.url} 
                  alt="Moedas" 
                  className="w-full max-w-[400px] h-auto object-contain drop-shadow-[0_20px_50px_rgba(255,255,255,0.05)] transition-shadow duration-500 hover:drop-shadow-[0_30px_60px_rgba(255,255,255,0.1)]" 
                />
              </motion.div>
            </div>
          </div>
        </motion.section>


        {/* CTA */}
        <motion.section 
          initial={{ opacity: 0, y: 100 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="py-24 md:py-48 relative overflow-hidden bg-white text-black w-full"
        >

          <div className="container px-4 md:px-6 mx-auto text-center relative z-10">
            <h2 className="text-3xl sm:text-4xl md:text-7xl font-black tracking-tighter uppercase mb-8 md:mb-12 leading-tight">
              O PRÓXIMO PASSO DEPENDE <br />DE VOCÊ, VENHA SER MASKPAY
            </h2>
            <Button size="lg" className="w-full sm:w-auto rounded-xl px-16 h-16 md:h-20 text-base md:text-lg font-black bg-black text-white hover:scale-105 transition-all uppercase tracking-widest" asChild>
              <Link to="/auth" search={{ mode: 'register' }}>Criar conta gratuita</Link>
            </Button>
          </div>
        </motion.section>

      </main>

      <footer className="py-20 px-4 md:px-6 bg-background overflow-x-hidden">
        <div className="container mx-auto">
          <div className="relative overflow-hidden bg-card/60 border border-white/10 rounded-[2rem] md:rounded-[4rem] p-8 md:p-24 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)]">
            {/* Watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden select-none w-full max-w-[100vw]">
              <span className="text-[28vw] font-black text-white/[0.03] tracking-tighter leading-none">
                MASKPAY
              </span>
            </div>

            <div className="relative z-10">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-16 mb-24">
                <div className="md:col-span-6 space-y-10">
                  <div className="flex items-center gap-4">
                    <img src={maskLogoAsset.url} alt="MaskPay" className="w-10 h-10 object-contain" />
                    <span className="text-3xl font-black tracking-tighter uppercase flex items-center gap-2">MASKPAY</span>
                  </div>
                  <p className="text-muted-foreground/60 text-lg leading-relaxed max-w-sm">
                    Gateway de pagamento dedicado para você vender mais sem valores travados.
                  </p>
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/5 border border-emerald-500/20 text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Monitoramento ativo 24/7
                  </div>
                </div>

                <div className="md:col-span-3 md:col-start-7 space-y-6">
                  <h4 className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Produto</h4>
                  <nav className="flex flex-col gap-4">
                    <Link to="/docs" className="text-sm font-medium text-muted-foreground/60 hover:text-white transition-colors">Funcionalidades</Link>
                    <Link to="/docs" className="text-sm font-medium text-muted-foreground/60 hover:text-white transition-colors">Documentação</Link>
                    <Link to="/blog" className="text-sm font-medium text-muted-foreground/60 hover:text-white transition-colors">Blog</Link>
                  </nav>
                </div>

                <div className="md:col-span-3 space-y-6">
                  <h4 className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Legal</h4>
                  <nav className="flex flex-col gap-4">
                    <Link to="/legal/privacy" className="text-sm font-medium text-muted-foreground/60 hover:text-white transition-colors">Política de Privacidade</Link>
                    <Link to="/legal/terms" className="text-sm font-medium text-muted-foreground/60 hover:text-white transition-colors">Termos de Uso</Link>
                    <Link to="/auth" search={{ mode: 'login' }} className="text-sm font-medium text-muted-foreground/60 hover:text-white transition-colors">Acesse o dashboard de sua conta</Link>
                  </nav>
                </div>
              </div>

              <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em]">
                <p>© 2026 MASKPAY | TECNOLOGIA E PAGAMENTOS S.A. TODOS OS DIREITOS RESERVADOS.</p>
                <div className="flex items-center gap-6">
                  <span>Brasil</span>
                  <span className="text-white/10">•</span>
                  <span>Pix</span>
                  <span className="text-white/10">•</span>
                  <span>API</span>
                  <span className="text-white/10">•</span>
                  <span>Webhooks</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>

  );
}