import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface AdminLogsProps {
  logs: any[];
}

export function AdminLogsTable({ logs }: AdminLogsProps) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-white/5">
            <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 px-6">Data</TableHead>
            <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Admin</TableHead>
            <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Ação</TableHead>
            <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Alvo</TableHead>
            <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 px-6">Detalhes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log: any) => (
            <TableRow key={log.id} className="border-white/5 hover:bg-white/[0.02] transition-colors">
              <TableCell className="px-6 py-4 text-[9px] font-bold text-muted-foreground uppercase">
                {format(new Date(log.created_at), 'dd/MM HH:mm')}
              </TableCell>
              <TableCell className="text-[10px] font-black uppercase text-white">
                {log.profiles?.full_name || 'Admin'}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-[8px] font-black uppercase">
                  {log.action}
                </Badge>
              </TableCell>
              <TableCell className="text-[10px] font-black uppercase text-white">
                {log.target?.full_name || 'Sistema'}
              </TableCell>
              <TableCell className="px-6 text-[9px] text-muted-foreground/60">
                {JSON.stringify(log.details)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
