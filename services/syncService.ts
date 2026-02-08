
import { Trade, TradeType, TradeStatus, MarginMode } from "../types";

export interface SyncResult {
  trades: Partial<Trade>[];
  accountValue: number;
}

export const syncHyperliquidData = async (address: string): Promise<SyncResult> => {
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
      const szi = parseFloat(pos.szi); // signed size
      if (szi === 0) return;

      trades.push({
        externalId: `hl-open-${pos.coin}-${address}`,
        symbol: `${pos.coin}-PERP`,
        type: szi > 0 ? TradeType.LONG : TradeType.SHORT,
        entryPrice: parseFloat(pos.entryPx),
        amount: Math.abs(szi),
        leverage: parseFloat(pos.leverage?.value || "1"),
        status: TradeStatus.OPEN,
        date: new Date().toISOString(), // Current state doesn't have start date, fills will update this if matched
        marginMode: pos.leverage?.type === 'cross' ? MarginMode.CROSS : MarginMode.ISOLATED,
        fees: 0, // Current fees on open pos are hard to isolate without fill history
        fundingFees: parseFloat(pos.cumFunding?.sinceOpen || "0")
      });
    });
  }

  // Process Historical Fills (Last 24h)
  if (Array.isArray(fills)) {
    const yesterday = Date.now() - 86400000;
    const recentFills = fills.filter(f => f.time >= yesterday);
    
    // Group fills by coin to find closed trades
    const coinGroups: Record<string, any[]> = {};
    recentFills.forEach(f => {
      if (!coinGroups[f.coin]) coinGroups[f.coin] = [];
      coinGroups[f.coin].push(f);
    });

    Object.entries(coinGroups).forEach(([coin, coinFills]) => {
      // If we already have an open trade for this coin, we'll just skip adding it as closed
      const isOpen = trades.some(t => t.symbol === `${coin}-PERP`);
      if (isOpen) return;

      const sorted = [...coinFills].sort((a, b) => a.time - b.time);
      let totalBuySize = 0, totalBuyVol = 0, totalSellSize = 0, totalSellVol = 0, totalFees = 0;

      sorted.forEach(f => {
        const px = parseFloat(f.px), sz = parseFloat(f.sz), fee = parseFloat(f.fee);
        totalFees += fee;
        if (f.side === 'B') { totalBuySize += sz; totalBuyVol += (px * sz); }
        else { totalSellSize += sz; totalSellVol += (px * sz); }
      });

      const type = sorted[0].side === 'B' ? TradeType.LONG : TradeType.SHORT;
      const entryPrice = type === TradeType.LONG ? (totalBuyVol / totalBuySize) : (totalSellVol / totalSellSize);
      const exitPrice = type === TradeType.LONG ? (totalSellVol / totalSellSize) : (totalBuyVol / totalBuySize);

      trades.push({
        externalId: `hl-closed-${coin}-${sorted[0].time}`,
        symbol: `${coin}-PERP`,
        type,
        entryPrice,
        exitPrice: exitPrice || null,
        amount: type === TradeType.LONG ? totalBuySize : totalSellSize,
        fees: totalFees,
        date: new Date(sorted[0].time).toISOString(),
        exitDate: new Date(sorted[sorted.length - 1].time).toISOString(),
        status: TradeStatus.CLOSED,
        leverage: 1 // Default for history
      });
    });
  }

  return { trades, accountValue };
};
