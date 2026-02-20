
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Trade, TradeStatus, Wallet, TradingStats } from '../types';
import { dataService } from '../services/dataService';
import { calculatePnl, filterTradesByDate } from '../utils/tradeCalculations';

export const useTradeManager = (activeWalletId: string, wallets: Wallet[]) => {
    const [trades, setTrades] = useState<Trade[]>([]);

    const activeWallet = wallets.find(w => w.id === activeWalletId);

    // Load trades when wallet changes
    useEffect(() => {
        if (!activeWalletId) return;

        // Prevent redundant loading if we already have data for this wallet in memory
        // unless it's the specific first mount or explicit change
        // Actually, we must allow it to run if activeWalletId changes.
        // But we want to avoid it running if just balance changes (render).
        // The dependency array handles that. 
        // But to be extra safe against race conditions/strict mode:

        let raw = dataService.loadTrades(activeWalletId);

        // Sanitize: Remove leaked trades that don't belong to this wallet
        if (activeWallet?.address) {
            const addrLower = activeWallet.address.trim().toLowerCase();
            raw = raw.filter(t => {
                if (!t.externalId) return true; // Keep manual trades
                return t.externalId.toLowerCase().includes(addrLower);
            });
        }
        const filtered = filterTradesByDate(raw, activeWallet?.historyStartDate);

        // Simple dedup before setting state
        const unique = Array.from(new Map(filtered.map(t => [t.id, t])).values());

        // FIX: Recalculate PnL for all closed trades to ensure consistency and fix any past data corruption
        // (e.g. double fee subtraction). We ONLY recalculate if we have a valid non-zero exit price.
        const validated = unique.map(t => {
            if (t.status === TradeStatus.CLOSED && t.entryPrice && t.amount && t.exitPrice && t.exitPrice > 0) {
                const { pnl, pnlPercentage } = calculatePnl(t);
                return { ...t, pnl, pnlPercentage };
            }
            return t;
        });

        setTrades(validated);

    }, [activeWalletId, activeWallet?.historyStartDate]);

    const saveTrades = useCallback((newTrades: Trade[]) => {
        // Enforce uniqueness
        const unique = Array.from(new Map(newTrades.map(t => [t.id, t])).values());
        setTrades(unique);
        if (activeWalletId) {
            dataService.saveTrades(activeWalletId, unique);
        }
    }, [activeWalletId]);

    const addTrade = useCallback((tradeData: Partial<Trade>) => {
        const { pnl, pnlPercentage } = calculatePnl(tradeData);
        const newTrade: Trade = {
            ...tradeData,
            id: crypto.randomUUID(),
            pnl,
            pnlPercentage,
            initialRisk: 0,
            notes: tradeData.notes || []
        } as Trade;

        saveTrades([newTrade, ...trades]);
    }, [trades, saveTrades]);

    const updateTrade = useCallback((id: string, data: Partial<Trade>) => {
        const updated = trades.map(t => {
            if (t.id === id) {
                const merged = { ...t, ...data };
                // Recalculate PnL if critical fields changed
                const { pnl, pnlPercentage } = calculatePnl(merged);
                return { ...merged, pnl, pnlPercentage };
            }
            return t;
        });
        saveTrades(updated);
    }, [trades, saveTrades]);

    const deleteTrade = useCallback((id: string) => {
        const updated = trades.filter(t => t.id !== id);
        saveTrades(updated);
    }, [trades, saveTrades]);

    // Stats Calculation
    const stats: TradingStats = useMemo(() => {
        const initial = activeWallet?.initialBalance || 0;
        const adjustment = activeWallet?.balanceAdjustment || 0;
        const closedTrades = trades.filter(t => t.status === TradeStatus.CLOSED);

        const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
        const wins = closedTrades.filter(t => t.pnl > 0).length;
        const totalFees = trades.reduce((sum, t) => sum + (t.fees || 0), 0);
        const totalFunding = trades.reduce((sum, t) => sum + (t.fundingFees || 0), 0);

        // Floating PnL removed from stats logic mostly, but used for ROI calculation
        const openTrades = trades.filter(t => t.status === TradeStatus.OPEN);
        const floatingPnl = openTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);

        return {
            initialBalance: initial,
            currentBalance: initial + totalPnl + adjustment, // Simplified Ledger Balance
            totalTrades: trades.length,
            openTrades: openTrades.length,
            winRate: closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0,
            totalPnl,
            totalPnlPercentage: initial > 0 ? (totalPnl / initial) * 100 : 0,
            totalTradeReturn: closedTrades.reduce((sum, t) => sum + (t.pnlPercentage || 0), 0),
            totalTradingFees: totalFees,
            totalFundingFees: totalFunding,
            bestTrade: closedTrades.length > 0 ? Math.max(...closedTrades.map(t => t.pnl)) : 0,
            worstTrade: closedTrades.length > 0 ? Math.min(...closedTrades.map(t => t.pnl)) : 0,
            totalFloatingPnl: floatingPnl // Still kept in stats for Dashboard to use in Equity Calc if needed, but not displayed as card
        };
    }, [trades, activeWallet]);

    return {
        trades,
        setTrades, // Exposed for SyncHook
        saveTrades,
        addTrade,
        updateTrade,
        deleteTrade,
        stats
    };
};
