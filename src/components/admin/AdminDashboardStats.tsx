import { 
  Users, 
  TrendingUp, 
  Fingerprint, 
  MessageSquare, 
  ShieldAlert 
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface AdminDashboardStatsProps {
  usersCount: number;
  kycPendingCount: number;
  ticketsOpenCount: number;
  blockedAccountsCount: number;
  onTabChange: (tab: 'users' | 'kyc' | 'tickets') => void;
}

export function AdminDashboardStats({
  usersCount,
  kycPendingCount,
  ticketsOpenCount,
  blockedAccountsCount,
  onTabChange
}: AdminDashboardStatsProps) {
  return (
    <div className="grid gap-4 md:gap-6 grid-cols-2 lg:grid-cols-4">
      <Card 
        className="border-white/5 bg-background border-2 rounded-[1.5rem] md:rounded-[2rem] p-4 md:p-6 hover:border-white/10 transition-all cursor-pointer" 

        onClick={() => onTabChange('users')}
      >
        <div className="flex justify-between items-start mb-4">
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/5">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <Badge className="bg-green-500/10 text-green-500 border-green-500/20 text-[8px] font-black">
            +{Math.round(usersCount * 0.1)}%
          </Badge>
        </div>
        <div className="text-xl md:text-3xl font-black tracking-tighter text-white">{usersCount}</div>
        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mt-1">Usuários Totais</p>
      </Card>
      
      <Card 
        className="border-white/5 bg-background border-2 rounded-[1.5rem] md:rounded-[2rem] p-4 md:p-6 hover:border-white/10 transition-all cursor-pointer" 

        onClick={() => onTabChange('kyc')}
      >
        <div className="flex justify-between items-start mb-4">
          <div className="w-10 h-10 rounded-xl bg-yellow-500/5 flex items-center justify-center border border-yellow-500/10">
            <Fingerprint className="h-5 w-5 text-yellow-500" />
          </div>
        </div>
        <div className="text-xl md:text-3xl font-black tracking-tighter text-white">{kycPendingCount}</div>
        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mt-1">KYC Pendentes</p>
      </Card>

      <Card 
        className="border-white/5 bg-background border-2 rounded-[1.5rem] md:rounded-[2rem] p-4 md:p-6 hover:border-white/10 transition-all cursor-pointer" 
        onClick={() => onTabChange('tickets')}
      >
        <div className="flex justify-between items-start mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/5 flex items-center justify-center border border-blue-500/10">
            <MessageSquare className="h-5 w-5 text-blue-500" />
          </div>
        </div>
        <div className="text-xl md:text-3xl font-black tracking-tighter text-white">{ticketsOpenCount}</div>
        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mt-1">Tickets Abertos</p>
      </Card>

      <Card className="border-white/5 bg-background border-2 rounded-[1.5rem] md:rounded-[2rem] p-4 md:p-6 hover:border-white/10 transition-all">
        <div className="flex justify-between items-start mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/5 flex items-center justify-center border border-red-500/10">
            <ShieldAlert className="h-5 w-5 text-red-500" />
          </div>
        </div>
        <div className="text-xl md:text-3xl font-black tracking-tighter text-white">{blockedAccountsCount}</div>
        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mt-1">Contas Bloqueadas</p>
      </Card>
    </div>
  );
}
