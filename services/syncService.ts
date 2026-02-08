
import { Trade, TradeType, TradeStatus, MarginMode } from "../types";

export interface SyncResult {
  trades: Partial<Trade>[];
  accountValue: number;
}

export const syncHyperliquidData = async (address: string): Promise<SyncResult> => {
  const NOW = Date.now();
  const YESTERDAY = NOW - 86400000;

  // 1. Fetch Clearinghouse State (Active Positions & Equity)
  const stateResponse = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: "clearinghouseState", user: address })
  });
  const state = await stateResponse.json();

  // 2. Fetch User Fills (Trade History)
  const fillsResponse = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: "userFills", user: address })
  });
  const fills = await fillsResponse.json();

  const trades: Partial<Trade>[] = [];
  const accountValue = parseFloat(state?.marginSummary?.accountValue || "0");

  // Process Active Positions
  if (state?.assetPositions) {
    state.assetPositions.forEach((p: any) => {
      const pos = p.position;
      const szi = parseFloat(pos.szi);
      if (szi === 0) return;

      trades.push({
        externalId: `hl-active-${pos.coin}-${address.toLowerCase()}`,
        symbol: `${pos.coin}-PERP`,
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

  // Process Historical Fills (Strictly last 24h)
  if (Array.isArray(fills)) {
    // Filter fills ONLY from the last 24 hours
    const recentFills = fills.filter(f => f.time >= YESTERDAY);
    
    const coinGroups: Record<string, any[]> = {};
    recentFills.forEach(f => {
      if (!coinGroups[f.coin]) coinGroups[f.coin] = [];
      coinGroups[f.coin].push(f);
    });

    Object.entries(coinGroups).forEach(([coin, coinFills]) => {
      // Avoid duplicate with currently active positions
      const isActiveNow = trades.some(t => t.symbol === `${coin}-PERP` && t.status === TradeStatus.OPEN);
      if (isActiveNow) return;

      const sorted = [...coinFills].sort((a, b) => a.time - b.time);
      let totalBuySize = 0, totalBuyVol = 0, totalSellSize = 0, totalSellVol = 0, totalFees = 0;

      sorted.forEach(f => {
        const px = parseFloat(f.px), sz = parseFloat(f.sz), fee = parseFloat(f.fee);
        totalFees += fee;
        if (f.side === 'B') { totalBuySize += sz; totalBuyVol += (px * sz); }
        else { totalSellSize += sz; totalSellVol += (px * sz); }
      });

      // Only import if the trade was actually CLOSED within the 24h window
      const netSize = Math.abs(totalBuySize - totalSellSize);
      if (netSize < 0.000001 && totalBuySize > 0 && totalSellSize > 0) {
        const type = sorted[0].side === 'B' ? TradeType.LONG : TradeType.SHORT;
        const entryPrice = type === TradeType.LONG ? (totalBuyVol / totalBuySize) : (totalSellVol / totalSellSize);
        const exitPrice = type === TradeType.LONG ? (totalSellVol / totalSellSize) : (totalBuyVol / totalBuySize);

        trades.push({
          externalId: `hl-closed-${coin}-${sorted[0].time}-${sorted[sorted.length-1].time}`,
          symbol: `${coin}-PERP`,
          type,
          entryPrice,
          exitPrice,
          amount: type === TradeType.LONG ? totalBuySize : totalSellSize,
          fees: totalFees,
          date: new Date(sorted[0].time).toISOString(),
          exitDate: new Date(sorted[sorted.length - 1].time).toISOString(),
          status: TradeStatus.CLOSED,
          leverage: 1
        });
      }
    });
  }

  return { trades, accountValue };
};
