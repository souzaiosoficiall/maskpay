import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Search, UserPlus, Filter, MoreVertical, Mail, Phone, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import maskPlatformAsset from "@/lib/mask-asset";

export const Route = createFileRoute('/_authenticated/customers')({
  component: CustomersPage,
});

function CustomersPage() {
  const customers = [
    { id: '1', name: 'Carlos Alberto', email: 'carlos@exemplo.com', phone: '(11) 99999-9999', status: 'Ativo', joined: '12 Jul, 2026' },
    { id: '2', name: 'Maria Oliveira', email: 'maria@exemplo.com', phone: '(21) 98888-8888', status: 'Ativo', joined: '05 Ago, 2026' },
    { id: '3', name: 'João Souza', email: 'joao@exemplo.com', phone: '(31) 97777-7777', status: 'Pendente', joined: '20 Ago, 2026' },
    { id: '4', name: 'Ana Pereira', email: 'ana@exemplo.com', phone: '(41) 96666-6666', status: 'Inativo', joined: '15 Mai, 2026' },
    { id: '5', name: 'Roberto Silva', email: 'roberto@exemplo.com', phone: '(51) 95555-5555', status: 'Ativo', joined: '01 Jan, 2026' },
  ];

  return (
    <div className="space-y-10 pb-16 font-sans">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Clientes</h1>
          <p className="text-muted-foreground font-semibold text-base">Gerencie sua base de clientes e visualize o histórico de cada um.</p>
        </div>
        <Button className="bg-white text-black hover:bg-white/90 rounded-2xl px-8 h-12 text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-white/5">
          <UserPlus className="mr-2 h-4 w-4" /> Novo Cliente
        </Button>
      </div>

      <Card className="border-white/5 bg-background border-2 rounded-[2.5rem] overflow-hidden">
        <CardHeader className="p-8 border-b border-white/5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="relative group min-w-[300px] w-full lg:w-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 group-hover:text-white/60 transition-colors" />
              <input 
                type="text"
                placeholder="BUSCAR POR NOME OU E-MAIL..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-[10px] font-black tracking-widest text-white placeholder:text-muted-foreground/20 focus:outline-none focus:border-white/20 transition-all uppercase"
              />
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={() => toast.info('Filtrando por status...')}
                className="flex items-center gap-2 bg-background border border-white/5 px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-white hover:bg-white/5 transition-all border-dashed cursor-pointer"
              >
                <Filter className="w-4 h-4" /> Status: Todos
              </button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.02]">
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground border-b border-white/5">Cliente</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground border-b border-white/5">Contato</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground border-b border-white/5">Membro desde</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground border-b border-white/5 text-center">Status</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground border-b border-white/5 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {customers.map((c) => (
                  <tr key={c.id} className="group hover:bg-white/[0.01] transition-colors">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center overflow-hidden p-1 group">
                          <img src={maskPlatformAsset.url} alt="Avatar" className="w-full h-full object-contain group-hover:scale-110 transition-opacity transition-transform duration-300" />
                        </div>
                        <span className="text-sm font-black uppercase tracking-tighter text-white/90">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
                          <Mail className="w-3 h-3 opacity-30" /> {c.email}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
                          <Phone className="w-3 h-3 opacity-30" /> {c.phone}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-[10px] font-black text-white/60 uppercase tracking-widest">
                        <Calendar className="w-3 h-3" /> {c.joined}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <span className={cn(
                        "px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.1em] border",
                        c.status === 'Ativo' ? "bg-green-500/10 text-green-500 border-green-500/20" : 
                        c.status === 'Pendente' ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" : 
                        "bg-red-500/10 text-red-500 border-red-500/20"
                      )}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <button className="text-muted-foreground hover:text-white transition-colors cursor-pointer">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}