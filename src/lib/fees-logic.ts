/**
 * Centralized fee calculation logic to ensure consistency across the platform.
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
 * Calculates the deposit fee and net amount.
 * Formula: fee = (amount * percentage / 100) + fixed
 */
export function calculateDepositAmounts(amount: number, fees: PlatformFees['deposit']) {
  const percentageFee = (amount * fees.percentage) / 100;
  // Round to 2 decimal places to avoid floating point issues
  const totalFee = Math.round((percentageFee + fees.fixed) * 100) / 100;
  const netAmount = Math.round((amount - totalFee) * 100) / 100;

  return {
    feeAmount: totalFee,
    netAmount: Math.max(0, netAmount)
  };
}

/**
 * Calculates the withdrawal fee and net amount.
 */
export function calculateWithdrawalAmounts(amount: number, fees: PlatformFees['withdrawal']) {
  const totalFee = fees.fixed;
  const netAmount = Math.round((amount - totalFee) * 100) / 100;

  return {
    feeAmount: totalFee,
    netAmount: Math.max(0, netAmount)
  };
}
