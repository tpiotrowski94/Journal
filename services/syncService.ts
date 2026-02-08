
import { Trade, TradeType, TradeStatus, MarginMode } from "../types";

export const syncHyperliquidFills = async (address: string): Promise<Partial<Trade>[]> => {
  const response = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: "userFills", user: address })
  });

  const fills = await response.json();
  if (!Array.isArray(fills)) return [];

  // Sort by time ascending to process history correctly
  const sortedFills = [...fills].sort((a, b) => a.time - b.time);
  
  const tradesMap: Record<string, Partial<Trade>> = {};
  
  // Logic: Group fills into "Trades" by coin until position is closed or we reach the end
  // For simplicity in a journal, we group recent fills of the same coin into one entry
  // A professional implementation would track net size, but here we group by 'order hash' or 'time windows'
  
  const consolidated: Partial<Trade>[] = [];

  // Grouping by coin + side for recent activity
  const coinGroups: Record<string, any[]> = {};
  sortedFills.forEach(fill => {
    if (!coinGroups[fill.coin]) coinGroups[fill.coin] = [];
    coinGroups[fill.coin].push(fill);
  });

  Object.entries(coinGroups).forEach(([coin, fills]) => {
    // Basic heuristic: last 20 fills for this coin represent the current/last trade
    // In a real app, you'd match B and S to find closed cycles.
    const entryFills = fills.filter(f => f.side === fills[0].side);
    const exitFills = fills.filter(f => f.side !== fills[0].side);

    const totalEntrySize = entryFills.reduce((sum, f) => sum + parseFloat(f.sz), 0);
    const avgEntryPx = entryFills.reduce((sum, f) => sum + (parseFloat(f.px) * parseFloat(f.sz)), 0) / totalEntrySize;
    const totalFees = fills.reduce((sum, f) => sum + parseFloat(f.fee), 0);

    let trade: Partial<Trade> = {
      externalId: `${coin}-${fills[0].time}`,
      symbol: `${coin}-PERP`,
      type: fills[0].side === 'B' ? TradeType.LONG : TradeType.SHORT,
      entryPrice: avgEntryPx,
      amount: totalEntrySize,
      fees: totalFees,
      date: new Date(fills[0].time).toISOString(),
      leverage: 1, // HL doesn't return leverage in fills, defaulting to 1
      status: TradeStatus.OPEN
    };

    if (exitFills.length > 0) {
      const totalExitSize = exitFills.reduce((sum, f) => sum + parseFloat(f.sz), 0);
      const avgExitPx = exitFills.reduce((sum, f) => sum + (parseFloat(f.px) * parseFloat(f.sz)), 0) / totalExitSize;
      
      trade.exitPrice = avgExitPx;
      trade.exitDate = new Date(exitFills[exitFills.length - 1].time).toISOString();
      // If exit size is close to entry size, consider it closed
      if (Math.abs(totalExitSize - totalEntrySize) / totalEntrySize < 0.05) {
        trade.status = TradeStatus.CLOSED;
      }
    }

    consolidated.push(trade);
  });

  return consolidated;
};
