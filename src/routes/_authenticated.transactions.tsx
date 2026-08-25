import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Filter, Download, ArrowUpRight, ArrowDownLeft, Loader2, Inbox } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useMemo, useState } from 'react';
import { getTransactions } from '@/lib/transactions.functions';
import { getProfile } from '@/lib/settings.functions';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TransactionReceiptModal, type ReceiptTransaction } from '@/components/TransactionReceiptModal';
import { useSessionReady } from '@/hooks/useSessionReady';

export const Route = createFileRoute('/_authenticated/transactions')({
  component: TransactionsPage,
});

function TransactionsPage() {
  const sessionReady = useSessionReady();
  const fetchTransactions = useServerFn(getTransactions);
  const fetchProfile = useServerFn(getProfile);
  const [selected, setSelected] = useState<ReceiptTransaction | null>(null);
  const [search, setSearch] = useState('');

  const { data: transactions, isLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => fetchTransactions({}),
    enabled: sessionReady,
  });

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => fetchProfile({}),
    enabled: sessionReady,
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    const list = transactions || [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((tx: any) => {
      const blob = `${tx.description || ''} ${tx.type || ''} ${tx.status || ''} ${tx.id || ''}`.toLowerCase();
      return blob.includes(q);
    });
  }, [transactions, search]);

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
      default:
        return 'bg-primary/10 text-primary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'paid':
      case 'success':
      case 'approved':
        return 'Concluído';
      case 'pending':
        return 'Pendente';
      case 'failed':
      case 'rejected':
      case 'error':
        return 'Falhou';
      case 'cancelled':
        return 'Cancelado';
      default:
        return status || 'Pendente';
    }
  };

  return (
    <div className="space-y-8 p-4 pb-28 md:p-0 lg:pb-0">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Movimentações</h1>
          <p className="text-muted-foreground">
            Histórico completo de todas as movimentações financeiras.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" type="button" disabled>
            <Filter className="mr-2 h-4 w-4" /> Filtrar
          </Button>
          <Button variant="outline" type="button" disabled>
            <Download className="mr-2 h-4 w-4" /> Exportar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por descrição, tipo ou status..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
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
                  <TableCell colSpan={6} className="h-40 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                  </TableCell>
                </TableRow>
              ) : !filtered || filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Inbox className="h-12 w-12 opacity-10" />
                      <p className="text-sm font-bold uppercase tracking-widest">
                        Nenhuma movimentação encontrada
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((tx: any) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {tx.created_at
                        ? format(new Date(tx.created_at), 'dd MMM, yyyy HH:mm', { locale: ptBR })
                        : '—'}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate font-medium">
                      {tx.description || '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-xs font-bold uppercase">
                        {tx.type === 'deposit' ? (
                          <ArrowUpRight className="h-3 w-3 text-green-500" />
                        ) : (
                          <ArrowDownLeft className="h-3 w-3 text-red-500" />
                        )}
                        {tx.type === 'deposit'
                          ? 'Depósito'
                          : tx.type === 'withdrawal'
                            ? 'Saque'
                            : tx.type}
                      </div>
                    </TableCell>
                    <TableCell
                      className={`font-bold ${tx.type === 'deposit' ? 'text-green-500' : 'text-red-500'}`}
                    >
                      {tx.type === 'deposit' ? '+' : '-'}{' '}
                      {Number(tx.amount).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${getStatusColor(tx.status || 'pending')}`}
                      >
                        {getStatusLabel(tx.status || 'pending')}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" type="button" onClick={() => setSelected(tx)}>
                        Detalhes
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TransactionReceiptModal
        open={!!selected}
        onClose={() => setSelected(null)}
        tx={selected}
        accountName={(profile as any)?.full_name || (profile as any)?.email || null}
      />
    </div>
  );
}
