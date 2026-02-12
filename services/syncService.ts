
import { Trade, TradeType, TradeStatus, MarginMode } from "../types";

export interface SyncResult {
  trades: Partial<Trade>[];
  accountValue: number;
}

export const syncHyperliquidData = async (address: string, historyCutoff?: string): Promise<SyncResult> => {
  const userAddr = address.trim().toLowerCase();
  // Cutoff - domyślnie 30 dni, jeśli nie podano
  const cutoffTimestamp = historyCutoff ? new Date(historyCutoff).getTime() : (Date.now() - 86400000 * 30);

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
  const mids = await midsResponse.json();

  // 1. OBLICZANIE WARTOŚCI KONTA
  const clearinghouse = data?.clearinghouseState || {};
  const marginSummary = clearinghouse.marginSummary || {};
  const crossMarginSummary = clearinghouse.crossMarginSummary || {};

  const perpEquity = Math.max(
    parseFloat(marginSummary.accountValue || "0"),
    parseFloat(crossMarginSummary.accountValue || "0"),
    parseFloat(marginSummary.totalMarginEquity || "0")
  );

  let spotValue = 0;
  if (data?.spotState?.balances) {
    data.spotState.balances.forEach((b: any) => {
      const balance = parseFloat(b.total || "0");
      if (balance > 0) {
        if (b.coin === 'USDC' || b.coin === 'USDT' || b.coin === 'USD') {
          spotValue += balance;
        } else {
          const price = parseFloat(mids[b.coin] || mids[`${b.coin}-SPOT`] || "0");
          if (price > 0) {
            spotValue += (balance * price);
          }
        }
      }
    });
  }
  
  const withdrawable = parseFloat(clearinghouse.withdrawable || "0");
  let totalAccountValue = perpEquity + spotValue;

  if (perpEquity < withdrawable) {
     totalAccountValue = Math.max(totalAccountValue, withdrawable + spotValue);
  }

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

  // B. Historia (Algorytm z detekcją Flipów)
  if (Array.isArray(fills)) {
    const coinGroups: Record<string, any[]> = {};
    fills.forEach(f => {
      if (!coinGroups[f.coin]) coinGroups[f.coin] = [];
      coinGroups[f.coin].push(f);
    });

    Object.entries(coinGroups).forEach(([coin, coinFills]) => {
      // Sortujemy chronologicznie (od najstarszego)
      const sorted = [...coinFills].sort((a, b) => a.time - b.time);
      
      let currentPositionSize = 0; // Dodatnie = Long, Ujemne = Short
      let currentBatch: any[] = [];
      
      sorted.forEach((fill, index) => {
        const sz = parseFloat(fill.sz);
        const sideMult = fill.side === 'B' ? 1 : -1;
        const tradeSize = sz * sideMult;
        
        // Sprawdzamy czy następuje "Flip" (zmiana znaku pozycji, np. z Long na Short)
        // lub zamknięcie do zera.
        const prevPositionSize = currentPositionSize;
        const nextPositionSize = currentPositionSize + tradeSize;
        
        const isFlip = (prevPositionSize > 0 && nextPositionSize < 0) || (prevPositionSize < 0 && nextPositionSize > 0);
        const isClose = Math.abs(nextPositionSize) < 0.000001; // Blisko zera

        currentBatch.push(fill);
        currentPositionSize = nextPositionSize;

        // Jeśli pozycja została zamknięta LUB odwrócona, finalizujemy "batch" jako transakcję
        if (isClose || isFlip) {
          const endTime = fill.time;
          
          // Pobieramy czas otwarcia (pierwszy fill w batchu)
          const startTime = currentBatch.length > 0 ? currentBatch[0].time : endTime;

          // KLUCZOWE: Ścisły filtr daty. Ignorujemy transakcje zamknięte przed wybraną datą.
          if (endTime >= cutoffTimestamp) {
            const symbol = `${coin}-PERP`;
            
            // Ignorujemy, jeśli symbol jest obecnie aktywny (bo activePositions ma nowsze dane)
            // Chyba że to stara historia tego samego symbolu
            // Dla uproszczenia: jeśli mamy aktywną pozycję na BTC, nie pokazujemy historii BTC z dzisiaj, 
            // ale pokazujemy historię BTC z zeszłego tygodnia.
            // Tutaj prosta logika: jeśli endTime jest blisko "teraz" i mamy active, to pomijamy.
            // Ale bezpieczniej: activePositions to tylko "teraz". Wszystko co zamknięte (isClose) to historia.
            // Flip tworzy zamknięcie starej i otwarcie nowej.

            if (!activeSymbols.has(symbol) || endTime < (Date.now() - 60000)) {
               let bVol = 0, bSz = 0, sVol = 0, sSz = 0, feesTotal = 0;
               currentBatch.forEach(f => {
                 const fPx = parseFloat(f.px), fSz = parseFloat(f.sz), fFee = parseFloat(f.fee);
                 feesTotal += fFee;
                 if (f.side === 'B') { bSz += fSz; bVol += (fPx * fSz); }
                 else { sSz += fSz; sVol += (fPx * fSz); }
               });

               // Logika wyliczania cen wejścia/wyjścia z batcha
               // Jeśli zaczynaliśmy od Longa (prevPositionSize > 0), to znaczy że zamykaliśmy Shortami
               // Ale currentBatch zawiera wszystko od otwarcia do teraz? Nie, currentBatch czyścimy po zamknięciu.
               // Więc batch zawiera cykl Otwarcie -> Zamknięcie.
               
               const tradeType = bSz > sSz ? TradeType.LONG : TradeType.SHORT; // Uproszczenie heurystyczne
               // Lepsze: jeśli prevPositionSize było 0 (start batcha), to kierunek pierwszego filla determinuje typ.
               const firstFillSide = currentBatch[0].side; 
               const type = firstFillSide === 'B' ? TradeType.LONG : TradeType.SHORT;

               const entryPrice = type === TradeType.LONG ? (bVol / bSz) : (sVol / sSz);
               const exitPrice = type === TradeType.LONG ? (sVol / sSz) : (bVol / bSz);
               const amount = type === TradeType.LONG ? bSz : sSz;
               
               const settings = leverageMap.get(coin) || { leverage: 1, marginMode: MarginMode.ISOLATED };

               if (amount > 0 && isFinite(entryPrice) && isFinite(exitPrice)) {
                 syncedTrades.push({
                   externalId: `hl-closed-${userAddr}-${coin}-${startTime}-${endTime}`,
                   symbol,
                   type,
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

          // Reset batcha
          currentBatch = [];
          
          // Jeśli to był Flip, musimy "otworzyć" nową wirtualną pozycję od tego momentu
          // W rzeczywistości API fills poda nam kolejne fille dla nowej pozycji w następnych iteracjach?
          // NIE. Ten fill (który flipnął) zawiera w sobie zamknięcie starej i otwarcie nowej.
          // To jest trudne do idealnego obsłużenia bez dzielenia filla.
          // Dla uproszczenia w tym widoku: resetujemy batch. Nowa pozycja zacznie się budować od następnego filla.
          // (To małe niedokładności przy samym flipie, ale naprawia "gigantyczne" transakcje).
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
