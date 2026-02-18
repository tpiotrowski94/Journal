
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
    // Keep ALL Manual trades (no externalId or externalId doesn't match this wallet provider pattern)
    // For HL provider, check if externalId includes address to identify ownership
    const manualTrades = existingTrades.filter(t =>
        !t.externalId || !t.externalId.toLowerCase().includes(addrLower)
    );

    // 2. Separate Incoming trades into Open vs Closed
    const incomingOpen = incomingTrades.filter(t => t.status === TradeStatus.OPEN);
    const incomingClosed = incomingTrades.filter(t => t.status === TradeStatus.CLOSED);

    // 3. Process OPEN Trades
    // STRATEGY: Replace ALL synced open trades for this wallet causing the "ghost position" bug.
    // We strictly trust the API snapshot for open positions.

    // Create full Trade objects for incoming Open positions
    const newOpenTrades: Trade[] = incomingOpen.map(t => ({
        ...t,
        id: crypto.randomUUID(), // New ID for new session (or could try to persist if we had persistent IDs)
        notes: [], // Open positions from API don't have notes unless we merge them... TODO: Preserve notes by externalId match?
        confidence: 3,
        pnl: t.pnl || 0,
        pnlPercentage: 0, // Will be calc by UI or hook
        initialRisk: 0,
        fees: t.fees || 0,
        fundingFees: t.fundingFees || 0
    } as Trade));

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
