/**
 * Server-only helpers for transaction chart aggregation.
 * Kept out of *.functions.ts because server-fn splitting removes
 * runtime siblings from those modules.
 */
export async function getChartStats(walletId: string, supabase: any) {
  const periods = ['Semana', 'Mês', 'Ano'];
  const stats: Record<string, any[]> = {};

  for (const period of periods) {
    let days = 7;
    if (period === 'Mês') days = 30;
    if (period === 'Ano') days = 365;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from("transactions")
      .select("amount, created_at")
      .eq("wallet_id", walletId)
      .eq("type", "deposit")
      .in("status", ["completed", "paid", "success", "approved"])
      .gte("created_at", startDate.toISOString());

    const groupedData: Record<string, number> = {};

    if (period === 'Semana') {
      const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        groupedData[dayNames[d.getDay()] as string] = 0;
      }
      data?.forEach((tx: any) => {
        const day = dayNames[new Date(tx.created_at).getDay()] as string;
        if (groupedData[day] !== undefined) groupedData[day] += Number(tx.amount);
      });
      stats[period] = Object.entries(groupedData).map(([name, value]) => ({ name, value }));
    } else if (period === 'Mês') {
      for (let i = 1; i <= 4; i++) groupedData[`S${i}`] = 0;
      data?.forEach((tx: any) => {
        const date = new Date(tx.created_at);
        const dayOfMonth = date.getDate();
        const week = Math.min(Math.ceil(dayOfMonth / 7), 4);
        const key = `S${week}`;
        groupedData[key] = (groupedData[key] || 0) + Number(tx.amount);
      });
      stats[period] = Object.entries(groupedData).map(([name, value]) => ({ name, value }));
    } else {
      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      monthNames.forEach(m => groupedData[m] = 0);
      data?.forEach((tx: any) => {
        const month = monthNames[new Date(tx.created_at).getMonth()] as string;
        groupedData[month] = (groupedData[month] || 0) + Number(tx.amount);
      });
      stats[period] = Object.entries(groupedData).map(([name, value]) => ({ name, value }));
    }
  }

  return stats;
}
