/**
 * Server-only helper to read platform fees using an already-authenticated
 * Supabase client or admin client. Supports WHITE (default) and BLACK routes.
 */

export type FeeRoute = "WHITE" | "BLACK";

export async function fetchPlatformFees(
  supabase: any,
  route: FeeRoute = "WHITE",
) {
  const isBlack = route === "BLACK";

  const { data, error } = await supabase
    .from("platform_configs")
    .select("key, value")
    .in("key", [
      "pix_deposit_fees",
      "pix_withdrawal_fees",
      "pix_deposit_fees_black",
      "pix_withdrawal_fees_black",
    ]);

  if (error) {
    console.error("[fetchPlatformFees] Error fetching configs:", error);
    return { ...defaultFees(isBlack), route: isBlack ? "BLACK" : "WHITE" };
  }

  const fees: Record<string, any> = {};
  data?.forEach((item: any) => {
    fees[item.key] = item.value;
  });

  if (isBlack) {
    return {
      deposit: fees.pix_deposit_fees_black || defaultFees(true).deposit,
      withdrawal: fees.pix_withdrawal_fees_black || defaultFees(true).withdrawal,
      route: "BLACK" as const,
    };
  }

  return {
    deposit: fees.pix_deposit_fees || defaultFees(false).deposit,
    withdrawal: fees.pix_withdrawal_fees || defaultFees(false).withdrawal,
    route: "WHITE" as const,
  };
}

function defaultFees(black: boolean) {
  if (black) {
    // BLACK: 7,90% + R$ 1,00 recebimento | R$ 1,00 fixo saque
    return {
      deposit: { percentage: 7.9, fixed: 1.0 },
      withdrawal: { fixed: 1.0 },
    };
  }
  return {
    deposit: { percentage: 2.49, fixed: 0.4 },
    withdrawal: { fixed: 0.8 },
  };
}

/** Resolve account_route from profiles (default WHITE). */
export async function getUserPaymentRoute(
  supabase: any,
  userId: string,
): Promise<FeeRoute> {
  try {
    const { data } = await supabase
      .from("profiles")
      .select("account_route")
      .eq("id", userId)
      .maybeSingle();
    const r = String((data as any)?.account_route || "WHITE").toUpperCase();
    return r === "BLACK" ? "BLACK" : "WHITE";
  } catch {
    return "WHITE";
  }
}
