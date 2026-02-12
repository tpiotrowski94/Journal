
import { Trade, TradeType, TradeStatus, MarginMode } from "../types";

export interface SyncResult {
  trades: Partial<Trade>[];
  accountValue: number;
}

export const syncHyperliquidData = async (address: string, historyCutoff?: string): Promise<SyncResult> => {
  const userAddr = address.trim().toLowerCase();
  
  // Cutoff handling:
  // Jeśli podano historyCutoff, używamy go. Jeśli nie, domyślnie 30 dni wstecz.
  // Upewniamy się, że timestamp jest liczbą.
  let cutoffTimestamp = Date.now() - (86400000 * 30);
  if (historyCutoff) {
    const parsed = new Date(historyCutoff).getTime();
    if (!isNaN(parsed)) {
      cutoffTimestamp = parsed;
    }
  }

  const [webDataResponse, midsResponse] = await Promise.all([
    fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: "webData2", user: userAddr })
    }),
    fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: "allMids" })
    })
  ]);
  
  if (!webDataResponse.ok) throw new Error("Failed to fetch HL data");
  
  const data = await webDataResponse.json();
  
  // Zabezpieczenie przed błędem null w allMids
  let mids: Record<string, any> = {};
  try {
    if (midsResponse.ok) {
      const json = await midsResponse.json();
      if (json) mids = json;
    }
  } catch (e) {
    console.warn("Failed to load mids", e);
  }

  // 1. OBLICZANIE WARTOŚCI KONTA
  const clearinghouse = data?.clearinghouseState || {};
  const marginSummary = clearinghouse.marginSummary || {};
  const crossMarginSummary = clearinghouse.crossMarginSummary || {};

  // FIX: Wcześniej używano Math.max z totalMarginEquity. 
  const marginAccountValue = parseFloat(marginSummary.accountValue || "0");
  const crossAccountValue = parseFloat(crossMarginSummary.accountValue || "0");
  
  let perpEquity = marginAccountValue || crossAccountValue;

  let spotValue = 0;
  if (data?.spotState?.balances) {
    data.spotState.balances.forEach((b: any) => {
      const balance = parseFloat(b.total || "0");
      if (balance > 0) {
        if (b.coin === 'USDC' || b.coin === 'USDT' || b.coin === 'USD') {
          spotValue += balance;
        } else {
          // Safe access to mids
          const coinPrice = mids[b.coin] || mids[`${b.coin}-SPOT`] || "0";
          const price = parseFloat(coinPrice);
          if (price > 0) {
            spotValue += (balance * price);
          }
        }
      }
    });
  }
  
  const totalAccountValue = perpEquity + spotValue;

  // 2. PRZETWARZANIE HISTORII TRANSAKCJI
  const fillsResponse = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: "userFills", user: userAddr })
  });
  const fills = await fillsResponse.json();

  const syncedTrades: Partial<Trade>[] = [];
  const activeSymbols = new Set<string>();
  const leverageMap = new Map<string, { leverage: number, marginMode: MarginMode }>();

  // A. Aktywne pozycje
  if (clearinghouse.assetPositions) {
    clearinghouse.assetPositions.forEach((p: any) => {
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

  // B. Historia
  if (Array.isArray(fills)) {
    const coinGroups: Record<string, any[]> = {};
    fills.forEach(f => {
      if (!coinGroups[f.coin]) coinGroups[f.coin] = [];
      coinGroups[f.coin].push(f);
    });

    Object.entries(coinGroups).forEach(([coin, coinFills]) => {
      const sorted = [...coinFills].sort((a, b) => a.time - b.time);
      
      let currentPositionSize = 0;
      let currentBatch: any[] = [];
      
      sorted.forEach((fill) => {
        // DETEKCJA SIEROT (Orphans)
        const hasRealizedPnl = parseFloat(fill.closedPnl || "0") !== 0;
        const isStartOfBatch = currentBatch.length === 0 && Math.abs(currentPositionSize) < 0.000001;

        if (isStartOfBatch && hasRealizedPnl) {
           return;
        }

        const sz = parseFloat(fill.sz);
        const sideMult = fill.side === 'B' ? 1 : -1;
        const tradeSize = sz * sideMult;
        
        const prevPositionSize = currentPositionSize;
        const nextPositionSize = currentPositionSize + tradeSize;
        
        const isFlip = (prevPositionSize > 0 && nextPositionSize < 0) || (prevPositionSize < 0 && nextPositionSize > 0);
        const isClose = Math.abs(nextPositionSize) < 0.000001;

        currentBatch.push(fill);
        currentPositionSize = nextPositionSize;

        if (isClose || isFlip) {
          const endTime = fill.time;
          if (currentBatch.length === 0) return;

          const startTime = currentBatch[0].time;

          // Ścisłe przestrzeganie cutoffTimestamp
          if (endTime >= cutoffTimestamp) {
            const symbol = `${coin}-PERP`;
            
            // Ignorujemy, jeśli symbol jest obecnie aktywny (nie dublujemy active positions historią z ostatnich minut)
            if (!activeSymbols.has(symbol) || endTime < (Date.now() - 60000)) {
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
          if (isClose) {
             currentPositionSize = 0;
          }
        }
      });
    });
  }
  
  return { 
    trades: syncedTrades, 
    accountValue: totalAccountValue 
  };
};
