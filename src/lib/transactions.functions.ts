import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // 1. Get user's wallet ID
    const { data: wallet } = await supabase
      .from("wallets")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (!wallet) return [];

    // 2. Fetch transactions for this wallet
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("wallet_id", wallet.id)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return data || [];
  });

export const getTransactionStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: wallet } = await supabase
      .from("wallets")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (!wallet) return { dailyVolume: 0, averageTicket: 0, totalTransactions: 0, totalFees: 0, totalWithdrawn: 0 };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Daily Volume (Deposits today)
    const { data: dailyData } = await supabase
      .from("transactions")
      .select("amount")
      .eq("wallet_id", wallet.id)
      .eq("type", "deposit")
      .in("status", ["completed", "paid", "success", "approved"])
      .gte("created_at", today.toISOString());

    const dailyVolume = dailyData?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;

    // 2. Average Ticket & Total Transactions
    const { data: allTimeDeposits } = await supabase
      .from("transactions")
      .select("amount, fee_amount")
      .eq("wallet_id", wallet.id)
      .eq("type", "deposit")
      .in("status", ["completed", "paid", "success", "approved"]);

    const totalTransactions = allTimeDeposits?.length || 0;
    const totalVolume = allTimeDeposits?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;
    const averageTicket = totalTransactions > 0 ? totalVolume / totalTransactions : 0;
    const totalFees = allTimeDeposits?.reduce((acc, curr) => acc + Number(curr.fee_amount || 0), 0) || 0;

    // 3. Total Withdrawn
    const { data: withdrawalData } = await supabase
      .from("transactions")
      .select("amount")
      .eq("wallet_id", wallet.id)
      .eq("type", "withdrawal")
      .in("status", ["completed", "paid", "success", "approved"]);
    
    const totalWithdrawn = withdrawalData?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;

    return {
      dailyVolume,
      averageTicket,
      totalTransactions,
      totalFees,
      totalWithdrawn,
      chartData: await (await import("./transactions-stats.server")).getChartStats(wallet.id, supabase),
    };
  });
