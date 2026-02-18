
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

    // We only keep 'official' history trades (hl-trade-...). 
    // We explicitly exclude 'hl-active-' trades from history to prevent duplicates if user manually changed status.
    const existingHistory = existingTrades.filter(t =>
        t.externalId &&
        t.externalId.toLowerCase().includes(addrLower) &&
        t.status === TradeStatus.CLOSED &&
        !t.externalId.startsWith('hl-active-')
    );

    const existingHistoryMap = new Map(existingHistory.map(t => [t.externalId, t]));
    const mergedHistory: Trade[] = [...existingHistory];

    // Find potential metadata sources (e.g. active trades that just closed)
    // We use this to preserve notes/confidence when an active trade becomes a history trade.
    const recentActiveTrades = existingTrades.filter(t =>
        t.externalId && t.externalId.startsWith('hl-active-')
    );

    incomingClosed.forEach(inc => {
        if (!inc.externalId) return;

        // Check cutoff
        const tTime = new Date(inc.exitDate || inc.date || 0).getTime();
        if (historyCutoffTime > 0 && tTime < historyCutoffTime) return;

        if (!existingHistoryMap.has(inc.externalId)) {
            // New history trade found

            // Try to find a precursor (active trade) to inherit metadata from
            const precursor = recentActiveTrades.find(p =>
                p.symbol === inc.symbol &&
                p.type === inc.type
                // We could match entry price or time, but Symbol+Type is usually unique enough for distinct active positions
            );

            const { pnl, pnlPercentage } = calculatePnl(inc);
            mergedHistory.push({
                ...inc,
                id: precursor?.id || crypto.randomUUID(), // Keep ID if we can? Or better new? New is safer for history, but maybe notes link to ID? Notes are embedded.
                notes: precursor?.notes || [],
                confidence: precursor?.confidence || 3,
                initialRisk: precursor?.initialRisk || 0,
                pnl,
                pnlPercentage
            } as Trade);
        }
    });

    // 5. Combine everything
    // Manual + New Synced Open + Merged Synced History
    const result = [...manualTrades, ...newOpenTrades, ...mergedHistory];

    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};
