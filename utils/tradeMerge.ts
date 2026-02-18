
import { Trade, TradeStatus, SyncProvider } from '../types';
import { SyncResult } from '../services/syncService';
import { calculatePnl } from './tradeCalculations';

export const mergeTrades = (
    existingTrades: Trade[],
    syncResult: SyncResult,
    walletAddress: string,
    historyCutoffTime: number = 0
): Trade[] => {
    const addrLower = walletAddress.trim().toLowerCase();
    const incomingTrades = syncResult.trades;

    // 1. Separate Manual trades vs Synced trades
    // CRITICAL FIX: Only treat trades with NO externalId as "Manual".
    // Any trade that HAS an externalId but doesn't match the current wallet address is "Leaked Data" and MUST BE PURGED.
    const manualTrades = existingTrades.filter(t => !t.externalId);

    // Trades that DO have an externalId are processed below (either updated or replaced).
    // If they don't match the current wallet (addrLower), they are simply ignored/dropped here,
    // which effectively deletes them from the state. This fixes the "Ghost Position" bug.

    // 2. Separate Incoming trades into Open vs Closed
    const incomingOpen = incomingTrades.filter(t => t.status === TradeStatus.OPEN);
    const incomingClosed = incomingTrades.filter(t => t.status === TradeStatus.CLOSED);

    // 3. Process OPEN Trades
    // STRATEGY: Replace ALL synced open trades for this wallet causing the "ghost position" bug.
    // We strictly trust the API snapshot for open positions.

    // Map existing OPEN trades for state preservation (Notes, Confidence)
    const existingOpenMap = new Map(
        existingTrades
            .filter(t => t.status === TradeStatus.OPEN && t.externalId)
            .map(t => [t.externalId, t])
    );

    // Create full Trade objects for incoming Open positions
    const newOpenTrades: Trade[] = incomingOpen.map(t => {
        const existing = t.externalId ? existingOpenMap.get(t.externalId) : undefined;

        return {
            ...t,
            // Preserve ID if exists to reduce UI flicker, else new
            id: existing?.id || crypto.randomUUID(),
            // Preserve user-editable fields
            notes: existing?.notes || [],
            confidence: existing?.confidence || 3, // Default to 3 if new
            initialRisk: existing?.initialRisk || 0,

            // API Data is master for these:
            pnl: t.pnl || 0,
            pnlPercentage: 0, // Will be calc by UI or hook
            fees: t.fees || 0,
            fundingFees: t.fundingFees || 0
        } as Trade;
    });

    // OPTIONAL: Restore notes for open trades if matched by Symbol/Side
    // (Left simple for now: "Ghost fix" priority > "Notes persistence on open positions" priority)

    // 4. Process CLOSED Trades
    // STRATEGY: Merge history, deduplicate by externalId

    const existingHistory = existingTrades.filter(t =>
        t.externalId && t.externalId.toLowerCase().includes(addrLower) && t.status === TradeStatus.CLOSED
    );

    const existingHistoryMap = new Map(existingHistory.map(t => [t.externalId, t]));
    const mergedHistory: Trade[] = [...existingHistory];

    incomingClosed.forEach(inc => {
        if (!inc.externalId) return;

        // Check cutoff
        const tTime = new Date(inc.exitDate || inc.date || 0).getTime();
        if (historyCutoffTime > 0 && tTime < historyCutoffTime) return;

        if (!existingHistoryMap.has(inc.externalId)) {
            // New history trade found
            const { pnl, pnlPercentage } = calculatePnl(inc);
            mergedHistory.push({
                ...inc,
                id: crypto.randomUUID(),
                notes: [{ id: crypto.randomUUID(), text: 'Imported history', date: new Date().toISOString() }],
                confidence: 3,
                pnl,
                pnlPercentage,
                initialRisk: 0
            } as Trade);
        }
    });

    // 5. Combine everything
    // Manual + New Synced Open + Merged Synced History
    const result = [...manualTrades, ...newOpenTrades, ...mergedHistory];

    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};
