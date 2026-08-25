import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router';
import { 
  TrendingUp, 
  Users, 
  Fingerprint, 
  MessageSquare, 
  History,
  Loader2,
  Settings,
  Bell
} from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTickets, getTicketMessages, sendTicketMessage, resolveTicket } from '@/lib/support.functions';
import { updateKycStatus } from '@/lib/admin.functions';
import { 
  getAllUsers, 
  updateUserStatus, 
  updateBalance, 
  updateAccountRoute, 
  resetUserPassword,
  getAdminLogs,
  deleteUser
} from '@/lib/admin-system.functions';
import { getAdminFinancialStats } from '@/lib/admin-financial.functions';
import { useServerFn } from '@tanstack/react-start';
import { useSessionReady } from '@/hooks/useSessionReady';
import { cn } from '@/lib/utils';
import maskPlatformAsset from "@/lib/mask-asset";
import { toast } from 'sonner';
import { AdminLogsTable } from '@/components/admin/AdminLogsTable';
import { KycModerationView } from '@/components/admin/KycModerationView';
import { AdminDashboardStats } from '@/components/admin/AdminDashboardStats';
import { UserManagement } from '@/components/admin/UserManagement';
import { SupportCenter } from '@/components/admin/SupportCenter';
import { PlatformSettings } from '@/components/admin/PlatformSettings';
import { NotificationManagement } from '@/components/admin/NotificationManagement';

export const Route = createFileRoute('/aylla/')({
  component: AdminPage,
});

function AdminPage() {
  const { mutate: runMigration } = useMutation({
    mutationFn: async () => {
      const { migrateAdminData } = await import('@/lib/migration-helper.functions');
      return migrateAdminData({});
    }
  });

  useEffect(() => {
    // Executa a migração de dados apenas uma vez por sessão do navegador
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem('admin_migration_done')) return;
    sessionStorage.setItem('admin_migration_done', '1');
    runMigration();
  }, []);




  const navigate = useNavigate();
  const search = useSearch({ from: '/aylla/' }) as any;
  const initialTab = search.tab || 'dashboard';
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'tickets' | 'kyc' | 'logs' | 'settings' | 'notifications'>(initialTab);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedKycId, setSelectedKycId] = useState<string | null>(null);
  
  // Sincroniza a aba ativa com a URL para permitir navegação direta do sidebar
  useEffect(() => {
    if (search.tab && search.tab !== activeTab) {
      setActiveTab(search.tab);
    }
  }, [search.tab]);


  
  const queryClient = useQueryClient();
  const sessionReady = useSessionReady();
  
  const fetchUsers = useServerFn(getAllUsers);
  const fetchTickets = useServerFn(getTickets);
  const fetchMessages = useServerFn(getTicketMessages);
  const doSendMessage = useServerFn(sendTicketMessage);
  const doResolveTicket = useServerFn(resolveTicket);
  const doUpdateKyc = useServerFn(updateKycStatus);
  const doUpdateUserStatus = useServerFn(updateUserStatus);
  const doUpdateBalance = useServerFn(updateBalance);
  const doUpdateRoute = useServerFn(updateAccountRoute);
  const doResetPassword = useServerFn(resetUserPassword);
  const fetchLogs = useServerFn(getAdminLogs);
  const doDeleteUser = useServerFn(deleteUser);
  const fetchFinancialStats = useServerFn(getAdminFinancialStats);

  const { data: users = [], isLoading: isLoadingUsers, isError: isUsersError, error: usersError, refetch: refetchUsers } = useQuery({
    queryKey: ['admin_users'],
    queryFn: () => fetchUsers({}),
    retry: 1,
    enabled: sessionReady,
    staleTime: 20_000,
    refetchOnMount: true,
  });

  const { data: tickets = [], isLoading: isLoadingTickets, refetch: refetchTickets } = useQuery({
    queryKey: ['admin_tickets'],
    queryFn: () => fetchTickets({}),
    retry: 1,
    enabled: sessionReady,
    staleTime: 20_000,
    refetchOnMount: true,
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['admin_logs'],
    queryFn: () => fetchLogs({}),
    enabled: sessionReady && activeTab === 'logs',
    staleTime: 20_000,
  });

  const { data: financialStats = { totalVolume: 0, balanceInCustody: 0 } } = useQuery({
    queryKey: ['admin_financial_stats'],
    queryFn: () => fetchFinancialStats({}),
    enabled: sessionReady && activeTab === 'dashboard',
    staleTime: 20_000,
    refetchOnMount: true,
  });

  useEffect(() => {
    if (isUsersError && usersError) {
      toast.error(
        (usersError as Error)?.message ||
          'Falha ao carregar usuários. Confira SUPABASE_SERVICE_ROLE_KEY no Vercel.',
      );
    }
  }, [isUsersError, usersError]);

  const hasOpenTickets = useMemo(() =>
    tickets.some((t: any) => t.status === 'Aberto'),
  [tickets]);

  const kycPendingCount = useMemo(() => 
    users.filter(u => 
      u.kyc_status === 'pending_review' || 
      u.verification_status === 'pending_review' || 
      u.status === 'pending_review'
    ).length,
  [users]);

  const { data: messages = [] } = useQuery({
    queryKey: ['ticket_messages', selectedTicketId],
    queryFn: () => fetchMessages({ data: selectedTicketId! }),
    refetchInterval: 8000,
    staleTime: 5000,
    enabled: sessionReady && !!selectedTicketId,
  });

  // Mutations
  const updateRouteMutation = useMutation({
    mutationFn: (data: { userId: string; route: 'WHITE' | 'BLACK' }) => doUpdateRoute({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_users'] });
      toast.success('Rota da conta atualizada! As taxas e o adquirente passam a valer na próxima transação.');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Falha ao atualizar a rota da conta.');
    },
  });

    const updateUserStatusMutation = useMutation({
    mutationFn: (data: any) => doUpdateUserStatus({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_users'] });
      toast.success('Status do usuário atualizado!');
    }
  });

  const updateBalanceMutation = useMutation({
    mutationFn: (data: any) => doUpdateBalance({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_users'] });
      toast.success('Saldo atualizado com sucesso!');
    }
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (userId: string) => doResetPassword({ data: { userId } }),
    onSuccess: (res: any) => {
      alert(`Senha resetada com sucesso! Nova senha: ${res.newPassword}. Por favor, anote-a.`);
      toast.success('Senha resetada!');
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => doDeleteUser({ data: { userId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_users'] });
      toast.success('Usuário removido permanentemente!');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao remover usuário.');
    }
  });

  const kycMutation = useMutation({
    mutationFn: (data: { userId: string, status: 'verified' | 'rejected' | 'blocked' }) => doUpdateKyc({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_users'] });
      queryClient.invalidateQueries({ queryKey: ['kyc_request'] });
      toast.success('Status KYC atualizado!');
    }
  });

  const resolveMutation = useMutation({
    mutationFn: (ticketId: string) => doResolveTicket({ data: ticketId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_tickets'] });
      queryClient.invalidateQueries({ queryKey: ['ticket_messages'] });
      toast.success('Ticket marcado como resolvido!');
    }
  });

  const sendMessageMutation = useMutation({
    mutationFn: (args: { content: string, attachmentUrl?: string | null }) => doSendMessage({ data: { ticketId: selectedTicketId!, content: args.content, attachmentUrl: args.attachmentUrl || undefined } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket_messages', selectedTicketId] });
    },
    onError: () => toast.error('Erro ao enviar mensagem.')
  });

  if (isLoadingUsers || isLoadingTickets) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-center mb-6 md:mb-8 overflow-x-auto pb-2 scrollbar-hide lg:hidden">
        <div className="flex bg-white/5 border border-white/10 p-1 rounded-2xl min-w-max">
          {[
            { id: 'dashboard', label: 'Painel', icon: TrendingUp },
            { id: 'users', label: 'Usuários', icon: Users },
            { id: 'kyc', label: 'KYC', icon: Fingerprint },
            { id: 'tickets', label: 'Suporte', icon: MessageSquare },
            { id: 'notifications', label: 'Notificações', icon: Bell },
            { id: 'logs', label: 'Logs', icon: History },
            { id: 'settings', label: 'Ajustes', icon: Settings }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-4 md:px-6 py-2 md:py-2.5 rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-widest transition-all relative",
                activeTab === tab.id 
                  ? "bg-white text-black shadow-lg" 
                  : "text-muted-foreground hover:text-white hover:bg-white/5"
              )}
            >
              <tab.icon className="w-3 h-3 md:w-3.5 md:h-3.5" />
              {tab.label}
              {tab.id === 'kyc' && kycPendingCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#0A0A0A] animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
              )}
              {tab.id === 'tickets' && hasOpenTickets && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#0A0A0A] animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
              )}
            </button>
          ))}
        </div>
      </div>


      {activeTab === 'dashboard' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter">Painel Administrativo</h1>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Visão geral do sistema e moderação.</p>
          </div>

          <AdminDashboardStats 
            usersCount={users.length}
            kycPendingCount={kycPendingCount}
            ticketsOpenCount={tickets.filter((t: any) => t.status === 'Aberto').length}
            blockedAccountsCount={users.filter(u => u.status === 'blocked').length}
            onTabChange={(tab) => setActiveTab(tab)}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-6 rounded-[2.5rem] border-2 border-white/5 bg-background">
              <h2 className="text-lg font-black uppercase tracking-tighter mb-6">Últimas Atividades</h2>
              <div className="space-y-4">
                {users.slice(0, 5).map((u, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center overflow-hidden p-1.5 group">
                        <img src={maskPlatformAsset.url} className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-white">{u.full_name}</p>
                        <p className="text-[8px] font-bold text-muted-foreground uppercase">{u.email}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 rounded-[2.5rem] border-2 border-white/5 bg-background">
              <h2 className="text-lg font-black uppercase tracking-tighter mb-6">Financeiro</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/5">
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2">Volume Total</p>
                  <p className="text-xl font-black tracking-tighter text-white">
                    {financialStats.totalVolume.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
                <div className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/5">
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2">Saldo em Custódia</p>
                  <p className="text-xl font-black tracking-tighter text-white">
                    {financialStats.balanceInCustody.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <UserManagement 
          users={users} 
          isLoading={isLoadingUsers}
          onUpdateStatus={(data) => updateUserStatusMutation.mutate(data)}
          onUpdateBalance={(data) => updateBalanceMutation.mutate(data)}
          onUpdateRoute={(data) => updateRouteMutation.mutateAsync(data)}
          isUpdatingRoute={updateRouteMutation.isPending}
          onResetPassword={(userId) => resetPasswordMutation.mutate(userId)}
          onDeleteUser={(userId) => deleteUserMutation.mutate(userId)}
        />
      )}

      {activeTab === 'kyc' && (
        <KycModerationView 
          kycRequests={users.filter(u => u.kyc_status === 'pending_review' || u.verification_status === 'pending_review' || u.status === 'pending_review')}
          userId={selectedKycId}
          onSelectKyc={setSelectedKycId}
          onApprove={(id: string) => kycMutation.mutate({ userId: id, status: 'verified' })}
          onReject={(id: string, type: 'reject' | 'delete') => {
            if (type === 'delete') {
              deleteUserMutation.mutate(id);
            } else {
              kycMutation.mutate({ userId: id, status: 'rejected' });
            }
          }}
        />
      )}

      {activeTab === 'tickets' && (
        <SupportCenter 
          tickets={tickets}
          isLoading={isLoadingTickets}
          messages={messages}
          selectedTicketId={selectedTicketId}
          onSelectTicket={setSelectedTicketId}
          onResolveTicket={(id) => resolveMutation.mutate(id)}
          onSendMessage={(content, attachmentUrl) => sendMessageMutation.mutate({ content, attachmentUrl: attachmentUrl || null })}
        />
      )}

      {activeTab === 'logs' && (
        <AdminLogsTable logs={logs} />
      )}

      {activeTab === 'notifications' && (
        <NotificationManagement />
      )}

      {activeTab === 'settings' && (
        <PlatformSettings />
      )}
    </div>
  );
}
