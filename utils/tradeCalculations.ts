
import { Trade, TradeType } from '../types';

export const calculatePnl = (trade: Partial<Trade>): { pnl: number, pnlPercentage: number } => {
    const entry = Number(trade.entryPrice) || 0;
    const amount = Number(trade.amount) || 0;
    const exit = trade.exitPrice ?? null;
    const fees = Number(trade.fees) || 0;
    const funding = Number(trade.fundingFees) || 0;
    const lev = Number(trade.leverage) || 1;
    const exitFees = Number(trade.exitFees) || 0;
    const exitFunding = Number(trade.exitFundingFees) || 0;

    // Priority 1: Use grossPnl if provided (from Sync Service)
    if (trade.grossPnl !== undefined) {
        const netPnl = trade.grossPnl - fees - funding - exitFees - exitFunding;
        const margin = (entry * amount) / lev;
        return {
            pnl: isFinite(netPnl) ? netPnl : 0,
            pnlPercentage: margin !== 0 ? (netPnl / margin) * 100 : 0
        };
    }

    // Priority 2: Calculate from prices
    // If exit is missing or 0, we can't calculate from price reliably.
    // Return 0 to avoid massive "ghost losses" like -1000%
    if (exit === null || exit <= 0) return { pnl: 0, pnlPercentage: 0 };

    const grossPnl = trade.type === TradeType.LONG ? (exit - entry) * amount : (entry - exit) * amount;
    const netPnl = grossPnl - fees - funding - exitFees - exitFunding;
    const margin = (entry * amount) / lev;

    return {
        pnl: isFinite(netPnl) ? netPnl : 0,
        pnlPercentage: margin !== 0 ? (netPnl / margin) * 100 : 0
    };
};

export const filterTradesByDate = (trades: Trade[], historyStartDate?: string): Trade[] => {
    if (!historyStartDate) return trades;

    const cutOff = new Date(historyStartDate).getTime();
    if (isNaN(cutOff) || cutOff <= 0) return trades;

    return trades.filter(t => {
        if (t.externalId) {
            const tradeTime = new Date(t.exitDate || t.date).getTime();
            if (tradeTime < cutOff) {
                return false;
            }
        }
        return true;
    });
};
