
import { Trade, TradeType, TradeStatus, MarginMode } from "../types";

export interface SyncResult {
  trades: Partial<Trade>[];
  accountValue: number;
}

export const syncHyperliquidData = async (address: string, historyCutoff?: string): Promise<SyncResult> => {
  const cutoffTimestamp = historyCutoff ? new Date(historyCutoff).getTime() : (Date.now() - 86400000);

  // 1. Fetch State
  const stateResponse = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: "clearinghouseState", user: address })
  });
  const state = await stateResponse.json();

  // 2. Fetch Fills
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
        symbol,
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

  // Robust Reconstruction with Initial State Discard
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
      let hasHitZero = false; 

      // We need to find the first time the position was FLAT to start a reliable reconstruction
      // Since we don't know the state BEFORE the first fill in history, we must wait for a zero-cross.
      
      sorted.forEach(fill => {
        const sz = parseFloat(fill.sz);
        const sideMult = fill.side === 'B' ? 1 : -1;
        const fillSize = sz * sideMult;

        // If we haven't hit zero yet, we just track the net size but don't start a batch
        if (!hasHitZero) {
          currentNetSize += fillSize;
          if (Math.abs(currentNetSize) < 0.000001) {
            hasHitZero = true; // Found a clean starting point for the NEXT trade
            currentNetSize = 0;
          }
          return;
        }

        // Now we are in a 'Clean' state, we can start recording
        if (currentBatch.length === 0) {
          if (Math.abs(fillSize) < 0.000001) return; // Skip dust
        }

        currentBatch.push(fill);
        currentNetSize += fillSize;

        if (Math.abs(currentNetSize) < 0.000001 && currentBatch.length > 0) {
          const endTime = fill.time;
          const startTime = currentBatch[0].time;

          if (endTime >= cutoffTimestamp) {
            const symbol = `${coin}-PERP`;
            if (!activeSymbols.has(symbol)) {
              let bVol = 0, bSz = 0, sVol = 0, sSz = 0, feesTotal = 0;
              currentBatch.forEach(f => {
                const fPx = parseFloat(f.px), fSz = parseFloat(f.sz), fFee = parseFloat(f.fee);
                feesTotal += fFee;
                if (f.side === 'B') { bSz += fSz; bVol += (fPx * fSz); }
                else { sSz += fSz; sVol += (fPx * fSz); }
              });

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
          currentBatch = [];
          currentNetSize = 0;
        }
      });
    });
  }

  return { trades: syncedTrades, accountValue };
};
