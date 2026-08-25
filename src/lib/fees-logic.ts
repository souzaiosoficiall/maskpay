/**
 * Taxas da plataforma — SEMPRE descontam do valor (nunca somam por cima).
 *
 * Depósito:
 *   taxa = amount * % + fixo
 *   crédito na carteira = amount - taxa
 *
 * Saque / Pagar QR:
 *   taxa = fixo
 *   debitado da carteira = amount (valor informado)
 *   destinatário recebe = amount - taxa
 */

export interface PlatformFees {
  deposit: {
    percentage: number;
    fixed: number;
  };
  withdrawal: {
    fixed: number;
  };
}

/** Depósito: taxa descontada do valor pago. */
export function calculateDepositAmounts(amount: number, fees: PlatformFees["deposit"]) {
  const percentageFee = (amount * fees.percentage) / 100;
  const totalFee = Math.round((percentageFee + fees.fixed) * 100) / 100;
  const netAmount = Math.round((amount - totalFee) * 100) / 100;

  return {
    feeAmount: totalFee,
    netAmount: Math.max(0, netAmount),
  };
}

/**
 * Saque / PIX externo:
 * - totalDebit = valor informado (sai da carteira)
 * - feeAmount = taxa fixa (descontada do valor)
 * - payoutAmount = o que o destinatário realmente recebe (amount - fee)
 */
export function calculateWithdrawalAmounts(amount: number, fees: PlatformFees["withdrawal"]) {
  const gross = Math.round(Number(amount) * 100) / 100;
  const feeAmount = Math.round(Number(fees.fixed || 0) * 100) / 100;
  const payoutAmount = Math.round((gross - feeAmount) * 100) / 100;
  const totalDebit = gross;

  return {
    feeAmount,
    netAmount: Math.max(0, payoutAmount),
    payoutAmount: Math.max(0, payoutAmount),
    totalDebit,
  };
}
