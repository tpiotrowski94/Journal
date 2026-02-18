
import { Trade, TradeType, TradeStatus, MarginMode } from "../types";

export interface SyncResult {
  trades: Partial<Trade>[];
  accountValue: number;
}

export const syncHyperliquidData = async (address: string, historyCutoff?: string): Promise<SyncResult> => {
  const userAddr = address.trim().toLowerCase();

  if (!userAddr) {
    throw new Error("Wallet address is required");
  }

  // Cutoff handling
  let cutoffTimestamp = 0;
  if (historyCutoff) {
    const parsed = new Date(historyCutoff).getTime();
    if (!isNaN(parsed) && parsed > 0) {
      cutoffTimestamp = parsed;
    }
  }

  // Pobieranie danych (równolegle dla wydajności)
  const webDataPromise = fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: "webData2", user: userAddr })
  });

  const midsPromise = fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: "allMids" })
  });

  const fillsPromise = fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: "userFills", user: userAddr })
  });

  // Oczekujemy na kluczowe dane
  const [webDataResponse, fillsResponse] = await Promise.all([webDataPromise, fillsPromise]);

  if (!webDataResponse.ok) throw new Error(`HL API Error: ${webDataResponse.statusText}`);
  const data = await webDataResponse.json();

  let mids: Record<string, any> = {};
  try {
    const midsResponse = await midsPromise;
    if (midsResponse.ok) mids = await midsResponse.json();
  } catch (e) {
    console.warn("Failed to fetch mids", e);
  }

  // 1. OBLICZANIE WARTOŚCI KONTA
  const clearinghouse = data?.clearinghouseState || {};
  const marginSummary = clearinghouse.marginSummary || {};
  const crossMarginSummary = clearinghouse.crossMarginSummary || {};

  const marginAccountValue = parseFloat(marginSummary.accountValue) || 0;
  const crossAccountValue = parseFloat(crossMarginSummary.accountValue) || 0;
  const perpEquity = Math.max(marginAccountValue, crossAccountValue);

  let spotValue = 0;
  if (data?.spotState?.balances) {
    data.spotState.balances.forEach((b: any) => {
      const balance = parseFloat(b.total || "0");
      if (balance > 0) {
        if (['USDC', 'USDT', 'USD'].includes(b.coin)) {
          spotValue += balance;
        } else {
          const coinPrice = mids[b.coin] || mids[`${b.coin}-SPOT`] || "0";
          spotValue += (balance * parseFloat(coinPrice));
        }
      }
    });
  }

  const totalAccountValue = perpEquity + spotValue;

  // 2. PRZETWARZANIE HISTORII TRANSAKCJI
  if (!fillsResponse.ok) {
    return { trades: [], accountValue: totalAccountValue };
  }

  const fills = await fillsResponse.json();
  const syncedTrades: Partial<Trade>[] = [];
  const leverageMap = new Map<string, { leverage: number, marginMode: MarginMode }>();

  // A. Mapa aktualnych ustawień (dźwignia)
  if (clearinghouse.assetPositions) {
    clearinghouse.assetPositions.forEach((p: any) => {
      const pos = p.position;
      const coin = pos.coin;
      const levValue = parseFloat(pos.leverage?.value || "1");
      const mode = pos.leverage?.type === 'cross' ? MarginMode.CROSS : MarginMode.ISOLATED;
      leverageMap.set(coin, { leverage: levValue, marginMode: mode });
    });
  }

  // B. Grupowanie fills po coinie
  const coinGroups: Record<string, any[]> = {};
  if (Array.isArray(fills)) {
    fills.forEach(f => {
      if (!coinGroups[f.coin]) coinGroups[f.coin] = [];
      coinGroups[f.coin].push(f);
    });
  }

  // C. Przetwarzanie fills per coin
  Object.entries(coinGroups).forEach(([coin, coinFills]) => {
    // Sortujemy od najstarszych do najnowszych
    const sorted = [...coinFills].sort((a, b) => a.time - b.time);

    let currentQty = 0;
    let currentBatch: any[] = [];
    let accumulatedClosedPnl = 0; // PnL z pola closedPnl API

    // Zmienne do śledzenia "Active" pozycji z historii
    let activeEntryVol = 0;
    let activeEntrySz = 0;

    sorted.forEach((fill, index) => {
      const fillSz = parseFloat(fill.sz);
      const fillPx = parseFloat(fill.px);
      const sideMult = fill.side === 'B' ? 1 : -1;
      const signedSz = fillSz * sideMult;

      // Czy ten fill zamyka pozycję? (closedPnl != 0 lub redukuje size)
      const rawClosedPnl = parseFloat(fill.closedPnl || "0");

      // Wykrywanie startu nowej pozycji (gdy poprzednia była 0)
      const isStart = Math.abs(currentQty) < 0.000001;

      // Wykrywanie FLIP (zmiana znaku pozycji, np. z 10 na -10)
      // Modyfikacja: Jeśli isStart (czyli quantity ~0), nie możemy mieć flipa.
      const nextQty = currentQty + signedSz;
      const isFlip = !isStart && ((currentQty > 0 && nextQty < 0) || (currentQty < 0 && nextQty > 0));

      // Jeśli to start, czyścimy batch
      if (isStart) {
        currentBatch = [];
        accumulatedClosedPnl = 0;
        activeEntryVol = 0;
        activeEntrySz = 0;
      }

      // Logika średniej ceny wejścia dla trwającej pozycji
      // Jeśli powiększamy pozycję (lub otwieramy), dodajemy do średniej
      const isIncreasingPosition = isStart || (currentQty > 0 && signedSz > 0) || (currentQty < 0 && signedSz < 0);
      if (isIncreasingPosition) {
        activeEntrySz += fillSz;
        activeEntryVol += (fillSz * fillPx);
      }

      currentBatch.push(fill);
      accumulatedClosedPnl += rawClosedPnl;

      // MOMENT ZAMKNIĘCIA (całkowitego lub flip)
      // Pozycja zamknięta jeśli nextQty jest ~0 LUB nastąpił flip
      const isClosed = Math.abs(nextQty) < 0.000001 || isFlip;

      if (isClosed) {
        const endTime = fill.time;
        // Sprawdzamy datę odcięcia
        if (endTime >= cutoffTimestamp) {
          const startTime = currentBatch[0].time;
          const symbol = `${coin}-PERP`;

          // Obliczamy parametry wsadu
          let feesTotal = 0;
          let totalBuyVol = 0, totalBuySz = 0;
          let totalSellVol = 0, totalSellSz = 0;

          currentBatch.forEach(f => {
            feesTotal += parseFloat(f.fee || "0");
            const fSz = parseFloat(f.sz);
            const fPx = parseFloat(f.px);
            if (f.side === 'B') {
              totalBuySz += fSz;
              totalBuyVol += (fSz * fPx);
            } else {
              totalSellSz += fSz;
              totalSellVol += (fSz * fPx);
            }
          });

          // Ustalanie kierunku transakcji na podstawie pierwszego filla
          const firstFillSide = currentBatch[0].side;
          const tradeType = firstFillSide === 'B' ? TradeType.LONG : TradeType.SHORT;

          // Obliczanie średnich cen (ważone wolumenem)
          let entryPrice = 0;
          let exitPrice = 0;
          let amount = 0;

          if (tradeType === TradeType.LONG) {
            entryPrice = totalBuySz > 0 ? totalBuyVol / totalBuySz : 0;
            exitPrice = totalSellSz > 0 ? totalSellVol / totalSellSz : 0;
            amount = totalBuySz; // Przybliżona wielkość pozycji
          } else {
            entryPrice = totalSellSz > 0 ? totalSellVol / totalSellSz : 0;
            exitPrice = totalBuySz > 0 ? totalBuyVol / totalBuySz : 0;
            amount = totalSellSz;
          }

          // Jeśli to FLIP, to amount w batchu może być mylące (zawiera zamknięcie + otwarcie w drugą stronę).
          // W prostym ujęciu, bierzemy size otwierający.
          if (isFlip) {
            // Jeśli flip, to batch zawiera mix. Użyjmy activeEntrySz jako bazy wielkości
            amount = activeEntrySz;
          }

          // Dźwignia z mapy (aktualna) lub domyślna
          const settings = leverageMap.get(coin) || { leverage: 10, marginMode: MarginMode.ISOLATED };

          // Finalny PnL transakcji
          // Używamy accumulatedClosedPnl jako bazy (Gross PnL z API)
          // App.tsx odejmuje fees, więc trade.pnl = accumulatedClosedPnl

          // PREVENT DUPLICATE/ZERO-PNL GHOST TRADES
          // Only push if we have meaningful amount AND (pnl != 0 or entry != exit)
          // Also, if PnL is exactly 0 and fees are 0, it might be a ghost or dust.
          const isDust = amount < 0.00001; // Filter extreme dust
          const isGhost = accumulatedClosedPnl === 0 && Math.abs(entryPrice - exitPrice) < 0.00000001;

          if (amount > 0 && !isDust && !isGhost) {
            syncedTrades.push({
              externalId: `hl-trade-${userAddr}-${coin}-${startTime}-${endTime}`,
              symbol,
              type: tradeType,
              status: TradeStatus.CLOSED,
              entryPrice,
              exitPrice,
              amount,
              leverage: settings.leverage,
              marginMode: settings.marginMode,
              fees: feesTotal,
              fundingFees: 0, // Funding jest często osobno w HL, tutaj uproszczenie
              pnl: accumulatedClosedPnl, // To jest Gross PnL z API (App odejmie fees)
              date: new Date(startTime).toISOString(),
              exitDate: new Date(endTime).toISOString(),
              confidence: 3
            });
          }
        }


        // Reset po zamknięciu
        currentBatch = [];
        accumulatedClosedPnl = 0;
        activeEntryVol = 0;
        activeEntrySz = 0;

        // Jeśli to był FLIP, musimy "rozpocząć" nową pozycję z resztki tego filla
        if (isFlip) {
          // Pozostała wielkość
          const remainingSz = Math.abs(nextQty);
          // Ten fill był częściowo zamykający, częściowo otwierający.
          // Dodajemy go jako start nowego batcha (wirtualnie)
          currentBatch.push({
            ...fill,
            sz: remainingSz.toString(), // Traktujemy jakby to był nowy fill o wielkości reszty
            closedPnl: "0" // PnL został już skonsumowany w zamknięciu poprzedniej
          });

          activeEntrySz = remainingSz;
          activeEntryVol = remainingSz * fillPx;
        }
      }

      currentQty = nextQty;
    });

    // Po przejściu historii, jeśli currentQty != 0, mamy otwartą pozycję.
    // Pobieramy ją z 'assetPositions' w clearinghouse (sekcja A), więc tutaj nie musimy jej tworzyć,
    // chyba że chcemy połączyć historię z aktywną pozycją. 
    // Obecna implementacja w App.tsx łączy je po ID, ale HL active positions są pobierane w sekcji A syncService.
    // Więc tutaj ignorujemy "ogon" historii.
  });

  // Dodajemy aktywne pozycje (pobrane z sekcji A na początku)
  if (clearinghouse.assetPositions) {
    clearinghouse.assetPositions.forEach((p: any) => {
      const pos = p.position;
      const coin = pos.coin;
      const szi = parseFloat(pos.szi);
      if (szi !== 0) {
        const symbol = `${coin}-PERP`;
        const levValue = parseFloat(pos.leverage?.value || "1");
        const mode = pos.leverage?.type === 'cross' ? MarginMode.CROSS : MarginMode.ISOLATED;

        syncedTrades.push({
          externalId: `hl-active-${symbol}-${userAddr}`,
          symbol,
          type: szi > 0 ? TradeType.LONG : TradeType.SHORT,
          entryPrice: parseFloat(pos.entryPx),
          amount: Math.abs(szi),
          leverage: levValue,
          status: TradeStatus.OPEN,
          date: new Date().toISOString(), // Data orientacyjna dla sortowania, w idealnym świecie bierzemy z historii
          marginMode: mode,
          fees: 0,
          fundingFees: parseFloat(pos.cumFunding?.sinceOpen || "0"),
          pnl: parseFloat(pos.unrealizedPnl || "0")
        });
      }
    });
  }

  return {
    trades: syncedTrades,
    accountValue: totalAccountValue
  };
};
