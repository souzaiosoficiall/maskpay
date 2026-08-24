import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Filter, Download, ArrowUpRight, ArrowDownLeft, Loader2, Inbox } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { getTransactions } from '@/lib/transactions.functions';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const Route = createFileRoute('/_authenticated/transactions')({
  component: TransactionsPage,
});

function TransactionsPage() {
  const fetchTransactions = useServerFn(getTransactions);
  
  const { data: transactions, isLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => fetchTransactions({}),
  });

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed': 
      case 'paid':
      case 'success':
      case 'approved':
        return 'bg-green-500/10 text-green-500';
      case 'pending': 
        return 'bg-yellow-500/10 text-yellow-500';
      case 'failed': 
      case 'rejected':
      case 'error':
        return 'bg-red-500/10 text-red-500';
      case 'cancelled': 
        return 'bg-muted text-muted-foreground';
      default: return 'bg-primary/10 text-primary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed': 
      case 'paid':
      case 'success':
      case 'approved':
        return 'Concluído';
      case 'pending': return 'Pendente';
      case 'failed': 
      case 'rejected':
      case 'error':
        return 'Falhou';
      case 'cancelled': return 'Cancelado';
      default: return status || 'Pendente';
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Movimentações</h1>
          <p className="text-muted-foreground">Histórico completo de todas as movimentações financeiras.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Filter className="mr-2 h-4 w-4" /> Filtrar
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" /> Exportar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por descrição ou ID..." className="pl-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground/20" />
                  </TableCell>
                </TableRow>
              ) : !transactions || transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Inbox className="h-12 w-12 opacity-10" />
                      <p className="text-sm font-bold uppercase tracking-widest">Nenhuma movimentação encontrada</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {tx.created_at ? format(new Date(tx.created_at), "dd MMM, yyyy HH:mm", { locale: ptBR }) : '-'}
                    </TableCell>
                    <TableCell className="font-medium">{tx.description}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-xs uppercase font-bold">
                        {tx.type === 'deposit' ? (
                          <ArrowUpRight className="h-3 w-3 text-green-500" />
                        ) : (
                          <ArrowDownLeft className="h-3 w-3 text-red-500" />
                        )}
                        {tx.type === 'deposit' ? 'Depósito' : tx.type === 'withdrawal' ? 'Saque' : tx.type}
                      </div>
                    </TableCell>
                    <TableCell className={`font-bold ${tx.type === 'deposit' ? 'text-green-500' : 'text-red-500'}`}>
                      {tx.type === 'deposit' ? '+' : '-'} {tx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </TableCell>
                    <TableCell>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold ${getStatusColor(tx.status || 'pending')}`}>
                        {getStatusLabel(tx.status || 'pending')}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">Detalhes</Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
