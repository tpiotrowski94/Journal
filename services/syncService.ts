
import { Trade, TradeType, TradeStatus, MarginMode } from "../types";

export interface SyncResult {
  trades: Partial<Trade>[];
  accountValue: number;
}

export const syncHyperliquidData = async (address: string, historyCutoff?: string): Promise<SyncResult> => {
  // Use user-defined cutoff or default to last 24 hours
  const cutoffTimestamp = historyCutoff ? new Date(historyCutoff).getTime() : (Date.now() - 86400000);

  // 1. Fetch Clearinghouse State (Account Value and Active Positions)
  const stateResponse = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: "clearinghouseState", user: address })
  });
  const state = await stateResponse.json();

  // 2. Fetch User Fills (Transaction History)
  const fillsResponse = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: "userFills", user: address })
  });
  const fills = await fillsResponse.json();

  const syncedTrades: Partial<Trade>[] = [];
  const accountValue = parseFloat(state?.marginSummary?.accountValue || "0");
  const activeSymbols = new Set<string>();

  // Handle Open Positions
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
        date: new Date().toISOString(), // Current sync as open time
        marginMode: pos.leverage?.type === 'cross' ? MarginMode.CROSS : MarginMode.ISOLATED,
        fees: 0,
        fundingFees: parseFloat(pos.cumFunding?.sinceOpen || "0")
      });
    });
  }

  // Handle History with Zero-Crossing Detection
  if (Array.isArray(fills)) {
    const coinGroups: Record<string, any[]> = {};
    fills.forEach(f => {
      if (!coinGroups[f.coin]) coinGroups[f.coin] = [];
      coinGroups[f.coin].push(f);
    });

    Object.entries(coinGroups).forEach(([coin, coinFills]) => {
      const sorted = [...coinFills].sort((a, b) => a.time - b.time);
      let currentBatch: any[] = [];
      let currentNetSize = 0;

      sorted.forEach(fill => {
        const sz = parseFloat(fill.sz);
        const px = parseFloat(fill.px);
        const sideMult = fill.side === 'B' ? 1 : -1;
        const fillSize = sz * sideMult;

        const prevNetSize = currentNetSize;
        currentNetSize += fillSize;

        // Detection of cycle end: hits exactly zero OR changes sign (flip)
        const hitZero = Math.abs(currentNetSize) < 0.00000001;
        const crossedZero = (prevNetSize > 0 && currentNetSize < 0) || (prevNetSize < 0 && currentNetSize > 0);

        currentBatch.push(fill);

        if (hitZero || crossedZero) {
          const endTime = fill.time;
          const startTime = currentBatch[0].time;

          // Only import if the trade ended within our window
          if (endTime >= cutoffTimestamp) {
            const symbol = `${coin}-PERP`;
            // Avoid active overlap
            if (!activeSymbols.has(symbol)) {
              let bVol = 0, bSz = 0, sVol = 0, sSz = 0, feesTotal = 0;

              currentBatch.forEach(f => {
                const fPx = parseFloat(f.px), fSz = parseFloat(f.sz), fFee = parseFloat(f.fee);
                feesTotal += fFee;
                if (f.side === 'B') { bSz += fSz; bVol += (fPx * fSz); }
                else { sSz += fSz; sVol += (fPx * fSz); }
              });

              // Determine type from the first fill of the batch
              const tradeType = currentBatch[0].side === 'B' ? TradeType.LONG : TradeType.SHORT;
              const entryPrice = tradeType === TradeType.LONG ? (bVol / bSz) : (sVol / sSz);
              const exitPrice = tradeType === TradeType.LONG ? (sVol / sSz) : (bVol / bSz);
              const amount = tradeType === TradeType.LONG ? bSz : sSz;

              if (amount > 0 && isFinite(entryPrice) && isFinite(exitPrice)) {
                syncedTrades.push({
                  externalId: `hl-closed-${coin}-${startTime}-${endTime}`,
                  symbol,
                  type: tradeType,
                  entryPrice,
                  exitPrice,
                  amount,
                  fees: feesTotal,
                  date: new Date(startTime).toISOString(),
                  exitDate: new Date(endTime).toISOString(),
                  status: TradeStatus.CLOSED,
                  leverage: 1
                });
              }
            }
          }
          
          // If we crossed zero, the remainder of the fill starts the next batch
          if (crossedZero && !hitZero) {
            currentBatch = [fill]; 
            // The size of the new batch is the remainder of currentNetSize
            // But for simplicity in journaling, we treat flips as separate closures
          } else {
            currentBatch = [];
          }
          currentNetSize = hitZero ? 0 : currentNetSize;
        }
      });
    });
  }

  return { trades: syncedTrades, accountValue };
};
