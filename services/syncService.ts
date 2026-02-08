
import { Trade, TradeType, TradeStatus, MarginMode } from "../types";

export interface SyncResult {
  trades: Partial<Trade>[];
  accountValue: number;
}

export const syncHyperliquidData = async (address: string, historyCutoff?: string): Promise<SyncResult> => {
  // Default: last 24h if no cutoff provided
  const cutoffTimestamp = historyCutoff ? new Date(historyCutoff).getTime() : (Date.now() - 86400000);

  // 1. Fetch Clearinghouse State (Active Positions)
  const stateResponse = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: "clearinghouseState", user: address })
  });
  const state = await stateResponse.json();

  // 2. Fetch User Fills (Full History)
  const fillsResponse = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: "userFills", user: address })
  });
  const fills = await fillsResponse.json();

  const syncedTrades: Partial<Trade>[] = [];
  const accountValue = parseFloat(state?.marginSummary?.accountValue || "0");
  const activeSymbols = new Set<string>();

  // Process Active Positions (Exchange Truth)
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

  // Process Historical Fills using "Net Zero" reconstruction
  if (Array.isArray(fills)) {
    const coinGroups: Record<string, any[]> = {};
    fills.forEach(f => {
      if (!coinGroups[f.coin]) coinGroups[f.coin] = [];
      coinGroups[f.coin].push(f);
    });

    Object.entries(coinGroups).forEach(([coin, coinFills]) => {
      const sorted = [...coinFills].sort((a, b) => a.time - b.time);
      let currentBatch: any[] = [];
      let netSize = 0;

      sorted.forEach(fill => {
        const sz = parseFloat(fill.sz);
        const px = parseFloat(fill.px);
        const sideMult = fill.side === 'B' ? 1 : -1;
        
        currentBatch.push(fill);
        netSize += (sz * sideMult);

        // A cycle is closed when netSize returns to zero
        if (Math.abs(netSize) < 0.00000001 && currentBatch.length > 0) {
          const endTime = currentBatch[currentBatch.length - 1].time;
          const startTime = currentBatch[0].time;
          
          if (endTime >= cutoffTimestamp) {
            const symbol = `${coin}-PERP`;
            if (!activeSymbols.has(symbol)) {
              let buyVol = 0, buySize = 0, sellVol = 0, sellSize = 0, totalFees = 0;
              
              currentBatch.forEach(f => {
                const fPx = parseFloat(f.px), fSz = parseFloat(f.sz), fFee = parseFloat(f.fee);
                totalFees += fFee;
                if (f.side === 'B') { buySize += fSz; buyVol += (fPx * fSz); }
                else { sellSize += fSz; sellVol += (fPx * fSz); }
              });

              const type = currentBatch[0].side === 'B' ? TradeType.LONG : TradeType.SHORT;
              const entryPrice = type === TradeType.LONG ? (buyVol / buySize) : (sellVol / sellSize);
              const exitPrice = type === TradeType.LONG ? (sellVol / sellSize) : (buyVol / buySize);

              syncedTrades.push({
                externalId: `hl-closed-${coin}-${startTime}-${endTime}`,
                symbol: symbol,
                type,
                entryPrice,
                exitPrice,
                amount: type === TradeType.LONG ? buySize : sellSize,
                fees: totalFees,
                date: new Date(startTime).toISOString(),
                exitDate: new Date(endTime).toISOString(),
                status: TradeStatus.CLOSED,
                leverage: 1 // History usually doesn't need leverage for PnL
              });
            }
          }
          currentBatch = [];
          netSize = 0;
        }
      });
    });
  }

  return { trades: syncedTrades, accountValue };
};
