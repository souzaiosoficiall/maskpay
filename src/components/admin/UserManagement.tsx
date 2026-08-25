import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Search,
  ChevronRight,
  Unlock,
  Lock,
  Loader2,
  Trash2,
  X
} from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import maskPlatformAsset from "@/lib/mask-asset";

interface UserManagementProps {
  users: any[];
  isLoading: boolean;
  onUpdateStatus: (data: { userId: string, status: 'active' | 'blocked' | 'rejected' }) => void;
  onUpdateBalance: (data: { userId: string, amount: number, type: 'add' | 'set', description: string }) => void;
  onUpdateRoute: (data: { userId: string, route: 'BLACK' | 'WHITE' }) => void | Promise<unknown>;
  onResetPassword: (userId: string) => void;
  onDeleteUser: (userId: string) => void;
  isUpdatingRoute?: boolean;
}

export function UserManagement({ 
  users, 
  isLoading, 
  onUpdateStatus, 
  onUpdateBalance, 
  onUpdateRoute, 
  onResetPassword,
  onDeleteUser,
  isUpdatingRoute = false,
}: UserManagementProps) {
  const [searchUser, setSearchUser] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'pending' | 'active' | 'blocked'>('all');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [routeBusy, setRouteBusy] = useState(false);

  const selectedUser = users.find((u: any) => u.id === selectedUserId);

  const filteredUsers = users.filter((u: any) => {
    const matchesSearch = u.full_name?.toLowerCase().includes(searchUser.toLowerCase()) || 
                         u.email?.toLowerCase().includes(searchUser.toLowerCase());
    const matchesFilter = userFilter === 'all' || 
                         (userFilter === 'pending' && (u.kyc_status === 'pending_review' || u.verification_status === 'pending_review' || u.status === 'pending_review' || u.status === 'pending')) ||
                         (userFilter === 'active' && u.status === 'active') ||
                         (userFilter === 'blocked' && u.status === 'blocked');
    return matchesSearch && matchesFilter;
  });

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'active': case 'accepted': case 'verified':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Ativo</Badge>;
      case 'blocked': case 'rejected':
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Bloqueado</Badge>;
      case 'pending': case 'pending_review':
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Pendente</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Usuários</h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Gerencie as contas e saldos dos usuários.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-3 border-white/5 bg-background border-2 rounded-[2rem] overflow-hidden">
          <CardHeader className="p-6 border-b border-white/5 bg-white/[0.02] flex flex-row items-center justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
              <input 
                placeholder="PESQUISAR USUÁRIO..."
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-[9px] font-black tracking-widest text-white uppercase"
              />
            </div>
            <div className="flex gap-2">
              {['all', 'pending', 'active', 'blocked'].map((f) => (
                <Button 
                  key={f}
                  variant={userFilter === f ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setUserFilter(f as any)}
                  className="text-[8px] font-black uppercase tracking-widest rounded-xl h-8"
                >
                  {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendentes' : f === 'active' ? 'Aceitos' : 'Bloqueados'}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-white/5">
                  <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 px-6">Usuário</TableHead>
                  <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Situação</TableHead>
                  <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Saldo</TableHead>
                  <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Rota</TableHead>
                  <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Cadastro</TableHead>
                  <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 text-right px-6"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((u: any) => (
                  <TableRow key={u.id} className="border-white/5 hover:bg-white/[0.02] transition-colors group">
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 group">
                          <img src={maskPlatformAsset.url} alt="Avatar" className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-black uppercase tracking-tighter text-white truncate">{u.full_name}</span>
                          <span className="text-[9px] text-muted-foreground font-medium truncate">{u.email}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{renderStatusBadge(u.status || 'active')}</TableCell>
                    <TableCell className="text-xs font-bold text-white">
                      {(u.wallets?.[0]?.balance || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[8px] font-black uppercase border-white/10">{u.account_route || 'WHITE'}</Badge>
                    </TableCell>
                    <TableCell className="text-[9px] text-muted-foreground/60 font-bold uppercase">
                      {format(new Date(u.created_at), 'dd/MM/yy')}
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => setSelectedUserId(u.id)}
                        className={cn(
                          "rounded-xl h-8 w-8 p-0 border border-transparent hover:border-white/10",
                          selectedUserId === u.id && "bg-white text-black hover:bg-white"
                        )}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="lg:col-span-1 space-y-6">
          {selectedUser ? (
            <Card className="border-white/5 bg-background border-2 rounded-[2rem] overflow-hidden sticky top-8">
              <CardHeader className="p-6 border-b border-white/5 bg-white/[0.02]">
                <h3 className="text-sm font-black uppercase tracking-tighter">Detalhes da Conta</h3>
                <p className="text-[9px] text-muted-foreground font-black uppercase tracking-widest mt-1">Gerenciamento administrativo</p>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-[9px] font-black uppercase text-muted-foreground/40 tracking-widest">Documento</Label>
                    <p className="text-xs font-bold text-white mt-1">{selectedUser.document || 'Não informado'}</p>
                  </div>
                  <div>
                    <Label className="text-[9px] font-black uppercase text-muted-foreground/40 tracking-widest">Telefone</Label>
                    <p className="text-xs font-bold text-white mt-1">{selectedUser.phone || 'Não informado'}</p>
                  </div>
                  
                  <div className="flex flex-col gap-2 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase text-muted-foreground/40 tracking-widest">Status Geral</span>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter",
                        selectedUser.status === 'active' ? "bg-green-500/20 text-green-500" : 
                        selectedUser.status === 'blocked' ? "bg-red-500/20 text-red-500" :
                        "bg-orange-500/20 text-orange-500"
                      )}>{selectedUser.status === 'rejected' ? 'Recusado' : selectedUser.status}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase text-muted-foreground/40 tracking-widest">Verificação KYC</span>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter",
                        selectedUser.verification_status === 'verified' ? "bg-green-500/20 text-green-500" : 
                        selectedUser.verification_status === 'pending_review' ? "bg-yellow-500/20 text-yellow-500" :
                        "bg-red-500/20 text-red-500"
                      )}>{selectedUser.verification_status || 'Não Iniciado'}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 space-y-3">
                  <Label className="text-[9px] font-black uppercase text-muted-foreground/40 tracking-widest block mb-4">Ações Administrativas</Label>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      size="sm"
                      variant="outline"
                      disabled={routeBusy || isUpdatingRoute}
                      onClick={async () => {
                        const current = (selectedUser.account_route || 'WHITE') as 'WHITE' | 'BLACK';
                        const newRoute = current === 'BLACK' ? 'WHITE' : 'BLACK';
                        setRouteBusy(true);
                        try {
                          await onUpdateRoute({ userId: selectedUser.id, route: newRoute });
                        } catch (err) {
                          console.error("Erro ao atualizar rota:", err);
                        } finally {
                          setRouteBusy(false);
                        }
                      }}
                      className={cn(
                        "rounded-xl text-[8px] font-black uppercase tracking-widest h-10 border-white/5 bg-white/5",
                        selectedUser.account_route === 'BLACK' ? "text-primary border-primary/20" : "text-white"
                      )}
                    >
                      {(routeBusy || isUpdatingRoute) ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                      ) : null}
                      Rota: {selectedUser.account_route || 'WHITE'} (trocar)
                    </Button>
                    <Button 
                      size="sm"
                      variant="outline"
                      onClick={() => onResetPassword(selectedUser.id)}
                      className="rounded-xl text-[8px] font-black uppercase tracking-widest h-10 border-white/5 bg-white/5"
                    >
                      Resetar Senha
                    </Button>
                  </div>

                  {selectedUser.status !== 'active' ? (
                    <Button 
                      className="w-full bg-green-500 hover:bg-green-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest h-12"
                      onClick={() => onUpdateStatus({ userId: selectedUser.id, status: 'active' })}
                    >
                      <Unlock className="w-4 h-4 mr-2" /> Ativar/Desbloquear Conta
                    </Button>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <Button 
                        className="w-full bg-red-500 hover:bg-red-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest h-12"
                        onClick={() => {
                          if (confirm('Deseja realmente BLOQUEAR esta conta? O usuário perderá acesso a quase todas as funções.')) {
                            onUpdateStatus({ userId: selectedUser.id, status: 'blocked' });
                          }
                        }}
                      >
                        <Lock className="w-4 h-4 mr-2" /> Bloquear Conta
                      </Button>
                      <Button 
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest h-12"
                        onClick={() => {
                          if (confirm('Deseja realmente RECUSAR esta conta? O usuário poderá criar uma nova conta com o mesmo e-mail.')) {
                            onUpdateStatus({ userId: selectedUser.id, status: 'rejected' });
                          }
                        }}
                      >
                        <X className="w-4 h-4 mr-2" /> Recusar Conta
                      </Button>
                    </div>
                  )}

                  <Button 
                    className="w-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest h-12"
                    onClick={() => {
                      if (confirm('ATENÇÃO: Deseja realmente REMOVER este usuário permanentemente? Esta ação não pode ser desfeita.')) {
                        onDeleteUser(selectedUser.id);
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Remover Usuário
                  </Button>

                  <div className="pt-6 border-t border-white/5">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground/40 tracking-widest block mb-4">Ajuste de Saldo</Label>
                    <p className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-widest mb-3">
                      Use <span className="text-white/60">Definir</span> para colocar o valor exato (ex: 0,00 zera). Use <span className="text-white/60">Adicionar</span> para somar ao saldo atual.
                    </p>
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        inputMode="decimal"
                        id="balance-amount"
                        placeholder="0,00"
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs font-bold text-white focus:outline-none focus:border-white/20"
                      />
                      <Button 
                        onClick={() => {
                          const input = document.getElementById('balance-amount') as HTMLInputElement;
                          // Accept "0", "0,00", "0.00" — never treat zero as empty
                          const raw = (input.value || '').trim().replace(/\s/g, '').replace(',', '.');
                          if (raw === '') return;
                          const amount = Number(raw);
                          if (Number.isNaN(amount)) return;
                          onUpdateBalance({
                            userId: selectedUser.id,
                            amount,
                            type: 'set',
                            description: 'Definição administrativa de saldo',
                          });
                          input.value = '';
                        }}
                        className="bg-white text-black hover:bg-white/90 rounded-xl h-10 px-4 font-black uppercase text-[9px]"
                      >
                        Definir
                      </Button>
                      <Button 
                        onClick={() => {
                          const input = document.getElementById('balance-amount') as HTMLInputElement;
                          const raw = (input.value || '').trim().replace(/\s/g, '').replace(',', '.');
                          if (raw === '') return;
                          const amount = Number(raw);
                          if (Number.isNaN(amount)) return;
                          onUpdateBalance({
                            userId: selectedUser.id,
                            amount,
                            type: 'add',
                            description: 'Ajuste administrativo',
                          });
                          input.value = '';
                        }}
                        variant="outline"
                        className="border-white/10 bg-white/5 text-white hover:bg-white/10 rounded-xl h-10 px-4 font-black uppercase text-[9px]"
                      >
                        Adicionar
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-white/5 bg-background border-2 rounded-[2rem] p-12 text-center border-dashed opacity-50">
              <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground/20" />
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">Selecione um usuário para ver ações</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}