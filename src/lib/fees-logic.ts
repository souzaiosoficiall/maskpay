/**
 * Centralized fee calculation logic to ensure consistency across the platform.
 *
 * Deposit: platform TAKES fee from the incoming amount (user receives net).
 *   fee = amount * 2.49% + R$ 0,40
 *   credit to wallet = amount - fee
 *
 * Withdrawal / Pay QR: platform TAKES fixed fee from the user's balance.
 *   Recipient receives the FULL requested amount.
 *   User is debited amount + R$ 0,80.
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

/**
 * Deposit: fee is subtracted from the paid amount. User receives net.
 */
export function calculateDepositAmounts(amount: number, fees: PlatformFees['deposit']) {
  const percentageFee = (amount * fees.percentage) / 100;
  const totalFee = Math.round((percentageFee + fees.fixed) * 100) / 100;
  const netAmount = Math.round((amount - totalFee) * 100) / 100;

  return {
    feeAmount: totalFee,
    netAmount: Math.max(0, netAmount),
  };
}

/**
 * Withdrawal / external PIX pay:
 * - `payoutAmount` = what the recipient receives (full amount)
 * - `feeAmount` = platform fee (R$ 0,80 fixed)
 * - `totalDebit` = what is removed from the user's wallet (amount + fee)
 */
export function calculateWithdrawalAmounts(amount: number, fees: PlatformFees['withdrawal']) {
  const feeAmount = Math.round(Number(fees.fixed || 0) * 100) / 100;
  const payoutAmount = Math.round(Number(amount) * 100) / 100;
  const totalDebit = Math.round((payoutAmount + feeAmount) * 100) / 100;

  return {
    feeAmount,
    /** @deprecated use payoutAmount — kept for compatibility */
    netAmount: payoutAmount,
    payoutAmount,
    totalDebit,
  };
}
