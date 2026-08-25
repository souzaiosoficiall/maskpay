import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Download, X } from 'lucide-react';
import { useRef } from 'react';
import { toast } from 'sonner';
import maskPlatformAsset from '@/lib/mask-asset';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ReceiptTransaction = {
  id: string;
  created_at?: string | null;
  amount: number;
  fee_amount?: number | null;
  net_amount?: number | null;
  type?: string | null;
  status?: string | null;
  description?: string | null;
  provider_id?: string | null;
  metadata?: any;
};

type Props = {
  open: boolean;
  onClose: () => void;
  tx: ReceiptTransaction | null;
  /** Nome do usuário logado (conta MaskPay) */
  accountName?: string | null;
};

function statusLabel(status?: string | null) {
  switch ((status || '').toLowerCase()) {
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
    case 'canceled':
      return 'Cancelado';
    default:
      return status || 'Pendente';
  }
}

function statusStyle(status?: string | null) {
  switch ((status || '').toLowerCase()) {
    case 'completed':
    case 'paid':
    case 'success':
    case 'approved':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'pending':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'failed':
    case 'rejected':
    case 'error':
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200';
  }
}

export function TransactionReceiptModal({ open, onClose, tx, accountName }: Props) {
  const receiptRef = useRef<HTMLDivElement>(null);
  if (!open || !tx) return null;

  const meta = (tx.metadata && typeof tx.metadata === 'object' ? tx.metadata : {}) as Record<
    string,
    any
  >;
  const isDeposit = tx.type === 'deposit';
  const isWithdraw = tx.type === 'withdrawal' || tx.type === 'withdraw';

  const title = isDeposit
    ? 'Comprovante de Recebimento via Pix'
    : isWithdraw
      ? 'Comprovante de Saque via Pix'
      : 'Comprovante de Transação';

  // Destino: quem recebe
  const destName = isDeposit
    ? accountName || meta.merchant_name || 'Conta MaskPay'
    : meta.pix_key ||
      meta.pixKey ||
      meta.destination ||
      meta.destination_name ||
      meta.customer_name ||
      'Destinatário Pix';

  const destMethod = 'PIX';

  // Origem
  const originName = isDeposit
    ? meta.customer_name || meta.payerName || meta.payer_name || 'Pagador Pix'
    : accountName || 'Conta MaskPay';

  const originBank = isDeposit
    ? 'MaskPay · Infraestrutura de Pagamentos'
    : meta.bank_name || 'Instituição de pagamento';

  const when = tx.created_at
    ? format(new Date(tx.created_at), "dd/MM/yyyy - HH:mm:ss", { locale: ptBR })
    : '—';

  const txId = String(tx.provider_id || meta.clientReference || tx.id).slice(0, 24);

  const handleDownload = async () => {
    try {
      // Impressão / salvar como PDF pelo navegador
      const node = receiptRef.current;
      if (!node) return;
      const printWindow = window.open('', '_blank', 'width=420,height=720');
      if (!printWindow) {
        toast.error('Permita pop-ups para baixar o comprovante.');
        return;
      }
      printWindow.document.write(`<!DOCTYPE html><html><head><title>Comprovante</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 24px; background: #fff; color: #0f172a; }
          img { max-width: 100%; }
        </style></head><body>${node.innerHTML}</body></html>`);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 300);
      toast.success('Use “Salvar como PDF” na impressão');
    } catch {
      toast.error('Não foi possível gerar o download.');
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[94vh] w-full max-w-[400px] flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Comprovante</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5" ref={receiptRef}>
          {/* Brand */}
          <div className="mb-5 flex items-center gap-2.5">
            <img src={maskPlatformAsset.url} alt="MaskPay" className="h-9 w-9 object-contain" />
            <span className="text-lg font-black tracking-tight text-slate-900">MaskPay</span>
          </div>

          {/* Banner soft */}
          <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-indigo-600 px-4 py-4 text-white">
            <p className="text-[11px] font-semibold leading-snug opacity-95">
              Comprovante digital da sua movimentação na MaskPay.
            </p>
          </div>

          <h2 className="text-[15px] font-bold text-slate-800">{title}</h2>

          <div className="mt-4">
            <p className="text-xs font-medium text-slate-400">Valor</p>
            <p className="text-3xl font-black tracking-tight text-violet-600">
              {Number(tx.amount).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Transação gerada em {when}
            </p>
            {typeof tx.fee_amount === 'number' && tx.fee_amount > 0 && (
              <p className="mt-0.5 text-xs text-slate-400">
                Taxa: {Number(tx.fee_amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                {typeof tx.net_amount === 'number' && tx.net_amount > 0 && (
                  <> · Líquido: {Number(tx.net_amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</>
                )}
              </p>
            )}
          </div>

          <hr className="my-5 border-slate-100" />

          <div className="space-y-4">
            <div>
              <p className="text-sm font-bold text-violet-600">Destino</p>
              <p className="mt-2 text-xs text-slate-400">Nome</p>
              <p className="text-sm font-semibold text-slate-900">{destName}</p>
              <p className="mt-2 text-xs text-slate-400">Método</p>
              <p className="text-sm font-semibold text-slate-900">{destMethod}</p>
            </div>

            <div>
              <p className="text-sm font-bold text-violet-600">Origem</p>
              <p className="mt-2 text-xs text-slate-400">Nome</p>
              <p className="text-sm font-semibold text-slate-900">{originName}</p>
              <p className="mt-2 text-xs text-slate-400">Instituição</p>
              <p className="text-sm font-semibold text-slate-900">{originBank}</p>
              <p className="mt-2 text-xs text-slate-400">Status</p>
              <span
                className={cn(
                  'mt-1 inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold',
                  statusStyle(tx.status),
                )}
              >
                {statusLabel(tx.status)}
              </span>
            </div>
          </div>

          <hr className="my-5 border-slate-100" />

          <div>
            <p className="text-xs text-slate-400">ID da transação</p>
            <p className="mt-0.5 break-all font-mono text-sm font-medium text-slate-700">{txId}</p>
            {tx.description && (
              <>
                <p className="mt-3 text-xs text-slate-400">Descrição</p>
                <p className="text-sm text-slate-700">{tx.description}</p>
              </>
            )}
          </div>
        </div>

        <div className="border-t border-slate-100 p-4">
          <Button
            className="h-12 w-full rounded-2xl bg-violet-600 text-sm font-bold text-white hover:bg-violet-700"
            onClick={handleDownload}
          >
            <Download className="mr-2 h-4 w-4" />
            Baixar comprovante
          </Button>
        </div>
      </div>
    </div>
  );
}
