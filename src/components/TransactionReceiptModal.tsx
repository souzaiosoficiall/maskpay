import { X } from 'lucide-react';
import maskPlatformAsset from '@/lib/mask-asset';
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
  accountName?: string | null;
};

function isPaidStatus(status?: string | null) {
  const s = (status || '').toLowerCase();
  return ['completed', 'paid', 'success', 'approved'].includes(s);
}

function statusLabel(status?: string | null) {
  if (isPaidStatus(status)) return 'Concluído';
  const s = (status || '').toLowerCase();
  if (['failed', 'rejected', 'error'].includes(s)) return 'Falhou';
  if (['cancelled', 'canceled'].includes(s)) return 'Cancelado';
  return 'Pendente';
}

export function TransactionReceiptModal({ open, onClose, tx, accountName }: Props) {
  if (!open || !tx) return null;

  const meta = (tx.metadata && typeof tx.metadata === 'object' ? tx.metadata : {}) as Record<
    string,
    any
  >;
  const isDeposit = tx.type === 'deposit';
  const paid = isPaidStatus(tx.status);

  // Quem paga
  const payerName = isDeposit
    ? meta.customer_name ||
      meta.payerName ||
      meta.payer_name ||
      meta.origin ||
      'Pagador Pix'
    : accountName || 'Conta MaskPay';

  // Quem recebe — fixo conforme pedido
  const receiverName = 'MaskPay - Gateway de pagamentos';

  const when = tx.created_at
    ? new Date(tx.created_at).toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).replace(',', ' às')
    : '—';

  const txId = String(tx.provider_id || meta.clientReference || tx.id).slice(0, 28);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-black/75 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div className="relative z-10 mb-0 w-full max-w-[380px] overflow-hidden rounded-t-[1.75rem] border border-white/10 bg-[#0a0a0a] shadow-2xl sm:mb-0 sm:rounded-[1.75rem]">
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-20 rounded-full p-2 text-white/40 hover:bg-white/5 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Receipt body */}
        <div className="relative px-7 pb-8 pt-10">
          {/* Watermark logo */}
          <img
            src={maskPlatformAsset.url}
            alt=""
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 select-none object-contain opacity-[0.06]"
          />

          <div className="relative z-10">
            {/* Logo central */}
            <div className="flex flex-col items-center">
              <img
                src={maskPlatformAsset.url}
                alt="MaskPay"
                className="h-14 w-14 object-contain"
              />
              <p className="mt-3 text-base font-black tracking-tight text-white">MaskPay</p>
              <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">
                Comprovante de pagamento
              </p>
            </div>

            {/* Status */}
            <div className="mt-6 flex justify-center">
              <span
                className={cn(
                  'rounded-full border px-3.5 py-1 text-[11px] font-black uppercase tracking-widest',
                  paid
                    ? 'border-white/25 bg-white text-black'
                    : 'border-white/20 bg-transparent text-white/70',
                )}
              >
                {statusLabel(tx.status)}
              </span>
            </div>

            {/* Valor */}
            <div className="mt-7 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">Valor</p>
              <p className="mt-1 text-3xl font-black tracking-tight text-white">
                {Number(tx.amount).toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </p>
            </div>

            <div className="my-7 h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />

            {/* Dados */}
            <div className="space-y-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
                  Quem está pagando
                </p>
                <p className="mt-1.5 text-sm font-semibold text-white">{payerName}</p>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
                  Quem recebe
                </p>
                <p className="mt-1.5 text-sm font-semibold text-white">{receiverName}</p>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
                  Data e hora
                </p>
                <p className="mt-1.5 text-sm font-semibold text-white">{when}</p>
                <p className="mt-0.5 text-[11px] text-white/35">Horário de São Paulo (BRT)</p>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
                  Tipo
                </p>
                <p className="mt-1.5 text-sm font-semibold text-white">
                  {isDeposit ? 'Recebimento Pix' : tx.type === 'withdrawal' ? 'Saque Pix' : 'Transação'}
                </p>
              </div>

              {tx.description && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
                    Descrição
                  </p>
                  <p className="mt-1.5 text-sm text-white/80">{tx.description}</p>
                </div>
              )}

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
                  ID da transação
                </p>
                <p className="mt-1.5 break-all font-mono text-xs text-white/55">{txId}</p>
              </div>
            </div>

            <p className="mt-8 text-center text-[10px] leading-relaxed text-white/25">
              Documento digital · Capture a tela para guardar
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
