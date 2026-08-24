import { createFileRoute, Link } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wallet, ArrowDownCircle, ArrowUpCircle, History, AlertCircle } from 'lucide-react';
import { useState } from 'react';

export const Route = createFileRoute('/_authenticated/wallet')({
  component: WalletPage,
});

function WalletPage() {
  const [amount, setAmount] = useState('');

  return (
    <div className="space-y-10 pb-16 font-sans max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Carteira</h1>
          <p className="text-muted-foreground font-semibold text-base">Gerencie seus saldos e ativos digitais com segurança.</p>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <Card className="border-white/5 bg-background border-2 rounded-[2.5rem] p-2 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-6">
            <div className="space-y-1">
              <span className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">Saldo em Conta</span>
              <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Disponível para transações e saques</CardDescription>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5">
              <Wallet className="h-6 w-6 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="text-5xl font-black tracking-tighter">R$ 12.450,00</div>
            <div className="flex gap-4">
              <Link to="/deposit" className="flex-1">
                <Button className="w-full bg-white text-black hover:bg-white/90 h-14 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
                  <ArrowUpCircle className="mr-2 h-4 w-4" /> Adicionar Valor
                </Button>
              </Link>
              <Link to="/withdraw" className="flex-1">
                <Button variant="outline" className="w-full border-white/5 bg-white/5 hover:bg-white/10 text-white h-14 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
                  <ArrowDownCircle className="mr-2 h-4 w-4" /> Sacar Saldo
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/5 bg-background border-2 rounded-[2.5rem] p-4 md:p-8">
          <CardHeader className="px-0 pt-0 pb-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-white" />
              <CardTitle className="text-xl font-black uppercase tracking-tight">Transferência Rápida</CardTitle>
            </div>
            <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mt-1">Envie dinheiro para outra conta MaskPay instantaneamente</CardDescription>
          </CardHeader>
          <CardContent className="px-0 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="dest" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Carteira de Destino (ID)</Label>
              <Input 
                id="dest" 
                placeholder="EX: 550E8400-E29B-41D4-A716-446655440000" 
                className="bg-white/5 border-white/10 rounded-2xl h-14 font-bold placeholder:text-muted-foreground/20 focus:border-white/20 transition-all uppercase text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Valor (R$)</Label>
              <Input 
                id="amount" 
                type="number" 
                value={amount} 
                onChange={(e) => setAmount(e.target.value)} 
                placeholder="R$ 0,00" 
                className="bg-white/5 border-white/10 rounded-2xl h-14 font-bold placeholder:text-muted-foreground/20 focus:border-white/20 transition-all"
              />
            </div>
            <Button className="w-full bg-white text-black hover:bg-white/90 h-16 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all mt-4">
              Enviar Agora
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/5 bg-background border-2 rounded-[2.5rem] overflow-hidden">
        <CardHeader className="p-8 border-b border-white/5">
          <div className="flex items-center gap-3">
            <History className="h-5 w-5 text-white" />
            <CardTitle className="text-xl font-black uppercase tracking-tight">Histórico da Carteira</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
           <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/20 space-y-4">
            <div className="w-16 h-16 rounded-full border-4 border-dashed border-white/5 flex items-center justify-center animate-spin-slow">
              <History className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest">Nenhuma movimentação recente encontrada</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
