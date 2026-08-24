/**
 * Server-only helper to read platform fees using an already-authenticated
 * Supabase client or admin client. Used directly inside server function handlers.
 */
export async function fetchPlatformFees(supabase: any) {
  const { data, error } = await supabase
    .from("platform_configs")
    .select("key, value")
    .in("key", ["pix_deposit_fees", "pix_withdrawal_fees"]);

  if (error) {
    console.error("[fetchPlatformFees] Error fetching configs:", error);
    // Return sensible defaults if something goes wrong
    return {
      deposit: { percentage: 2.49, fixed: 0.40 },
      withdrawal: { fixed: 0.80 },
    };
  }

  const fees: any = {};
  data?.forEach((item: any) => {
    fees[item.key] = item.value;
  });

  return {
    deposit: fees.pix_deposit_fees || { percentage: 2.49, fixed: 0.40 },
    withdrawal: fees.pix_withdrawal_fees || { fixed: 0.80 },
  };
}
