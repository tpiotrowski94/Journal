
import { Trade, TradeType, TradeStatus, MarginMode } from "../types";

export interface SyncResult {
  trades: Partial<Trade>[];
  accountValue: number;
}

export const syncHyperliquidData = async (address: string, historyCutoff?: string): Promise<SyncResult> => {
  const cutoffTimestamp = historyCutoff ? new Date(historyCutoff).getTime() : 0;

  // 1. Fetch Clearinghouse State (Active Positions & Equity)
  const stateResponse = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: "clearinghouseState", user: address })
  });
  const state = await stateResponse.json();

  // 2. Fetch User Fills (Trade History - max 2000)
  const fillsResponse = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: "userFills", user: address })
  });
  const fills = await fillsResponse.json();

  const syncedTrades: Partial<Trade>[] = [];
  const accountValue = parseFloat(state?.marginSummary?.accountValue || "0");
  const activeSymbols = new Set<string>();

  // Process Active Positions
  if (state?.assetPositions) {
    state.assetPositions.forEach((p: any) => {
      const pos = p.position;
      const szi = parseFloat(pos.szi);
      if (szi === 0) return;

      const symbol = `${pos.coin}-PERP`;
      activeSymbols.add(symbol);

      syncedTrades.push({
        externalId: `hl-active-${symbol}-${address.toLowerCase()}`,
        symbol: symbol,
        type: szi > 0 ? TradeType.LONG : TradeType.SHORT,
        entryPrice: parseFloat(pos.entryPx),
        amount: Math.abs(szi),
        leverage: parseFloat(pos.leverage?.value || "1"),
        status: TradeStatus.OPEN,
        date: new Date().toISOString(),
        marginMode: pos.leverage?.type === 'cross' ? MarginMode.CROSS : MarginMode.ISOLATED,
        fees: 0,
        fundingFees: parseFloat(pos.cumFunding?.sinceOpen || "0")
      });
    });
  }

  // Process Historical Fills (group all, then filter by exit time)
  if (Array.isArray(fills)) {
    const coinGroups: Record<string, any[]> = {};
    fills.forEach(f => {
      const symbol = `${f.coin}-PERP`;
      // We process fills even for active symbols to find previously closed cycles of the same coin
      if (!coinGroups[f.coin]) coinGroups[f.coin] = [];
      coinGroups[f.coin].push(f);
    });

    Object.entries(coinGroups).forEach(([coin, coinFills]) => {
      // Sort fills by time ascending to reconstruct trades
      const sorted = [...coinFills].sort((a, b) => a.time - b.time);
      
      let currentBatch: any[] = [];
      let runningSize = 0;

      sorted.forEach(fill => {
        const sz = parseFloat(fill.sz);
        const sideMultiplier = fill.side === 'B' ? 1 : -1;
        
        currentBatch.push(fill);
        runningSize += (sz * sideMultiplier);

        // If runningSize returns to ~0, a position cycle has been completed
        if (Math.abs(runningSize) < 0.000001 && currentBatch.length > 0) {
          const lastFillTime = currentBatch[currentBatch.length - 1].time;
          
          // CRITICAL: Filter by historyCutoff only at the end of a completed cycle
          if (lastFillTime >= cutoffTimestamp) {
            let totalBuySize = 0, totalBuyVol = 0, totalSellSize = 0, totalSellVol = 0, totalFees = 0;

            currentBatch.forEach(f => {
              const px = parseFloat(f.px), sz = parseFloat(f.sz), fee = parseFloat(f.fee);
              totalFees += fee;
              if (f.side === 'B') { totalBuySize += sz; totalBuyVol += (px * sz); }
              else { totalSellSize += sz; totalSellVol += (px * sz); }
            });

            const type = currentBatch[0].side === 'B' ? TradeType.LONG : TradeType.SHORT;
            const entryPrice = type === TradeType.LONG ? (totalBuyVol / totalBuySize) : (totalSellVol / totalSellSize);
            const exitPrice = type === TradeType.LONG ? (totalSellVol / totalSellSize) : (totalBuyVol / totalBuySize);

            syncedTrades.push({
              externalId: `hl-closed-${coin}-${currentBatch[0].time}-${lastFillTime}`,
              symbol: `${coin}-PERP`,
              type,
              entryPrice,
              exitPrice,
              amount: type === TradeType.LONG ? totalBuySize : totalSellSize,
              fees: totalFees,
              date: new Date(currentBatch[0].time).toISOString(),
              exitDate: new Date(lastFillTime).toISOString(),
              status: TradeStatus.CLOSED,
              leverage: 1
            });
          }
          currentBatch = [];
          runningSize = 0;
        }
      });
    });
  }

  return { trades: syncedTrades, accountValue };
};
