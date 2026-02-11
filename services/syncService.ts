
import { Trade, TradeType, TradeStatus, MarginMode } from "../types";

export interface SyncResult {
  trades: Partial<Trade>[];
  accountValue: number;
}

export const syncHyperliquidData = async (address: string, historyCutoff?: string): Promise<SyncResult> => {
  const userAddr = address.toLowerCase();
  // Zwiększamy domyślny lookback do 30 dni dla nowych portfeli, aby złapać historię
  const cutoffTimestamp = historyCutoff ? new Date(historyCutoff).getTime() : (Date.now() - 86400000 * 30);

  const stateResponse = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: "clearinghouseState", user: address })
  });
  const state = await stateResponse.json();

  const fillsResponse = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: "userFills", user: address })
  });
  const fills = await fillsResponse.json();

  const syncedTrades: Partial<Trade>[] = [];
  const accountValue = parseFloat(state?.marginSummary?.accountValue || "0");
  const activeSymbols = new Set<string>();
  const leverageMap = new Map<string, { leverage: number, marginMode: MarginMode }>();

  if (state?.assetPositions) {
    state.assetPositions.forEach((p: any) => {
      const pos = p.position;
      const coin = pos.coin;
      const symbol = `${coin}-PERP`;
      const levValue = parseFloat(pos.leverage?.value || "1");
      const mode = pos.leverage?.type === 'cross' ? MarginMode.CROSS : MarginMode.ISOLATED;
      leverageMap.set(coin, { leverage: levValue, marginMode: mode });

      const szi = parseFloat(pos.szi);
      if (szi !== 0) {
        activeSymbols.add(symbol);
        syncedTrades.push({
          externalId: `hl-active-${symbol}-${userAddr}`,
          symbol,
          type: szi > 0 ? TradeType.LONG : TradeType.SHORT,
          entryPrice: parseFloat(pos.entryPx),
          amount: Math.abs(szi),
          leverage: levValue,
          status: TradeStatus.OPEN,
          date: new Date().toISOString(),
          marginMode: mode,
          fees: 0,
          fundingFees: parseFloat(pos.cumFunding?.sinceOpen || "0")
        });
      }
    });
  }

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
        const sideMult = fill.side === 'B' ? 1 : -1;
        currentBatch.push(fill);
        currentNetSize += (sz * sideMult);

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
              const settings = leverageMap.get(coin) || { leverage: 1, marginMode: MarginMode.ISOLATED };

              if (amount > 0 && isFinite(entryPrice) && isFinite(exitPrice)) {
                syncedTrades.push({
                  externalId: `hl-closed-${userAddr}-${coin}-${startTime}-${endTime}`,
                  symbol,
                  type: tradeType,
                  entryPrice,
                  exitPrice,
                  amount,
                  fees: feesTotal,
                  fundingFees: 0,
                  date: new Date(startTime).toISOString(),
                  exitDate: new Date(endTime).toISOString(),
                  status: TradeStatus.CLOSED,
                  leverage: settings.leverage,
                  marginMode: settings.marginMode,
                  confidence: 3
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
