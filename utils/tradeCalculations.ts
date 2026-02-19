
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

    if (entry === 0 || amount === 0 || exit === null) return { pnl: 0, pnlPercentage: 0 };

    // Jeśli trade ma już PnL z API (Hyperliquid sync), użyj go jako bazy gross PnL
    // W przeciwnym razie oblicz ze średniej
    let grossPnl = 0;
    if (trade.grossPnl !== undefined) {
        grossPnl = trade.grossPnl;
    } else {
        grossPnl = trade.type === TradeType.LONG ? (exit - entry) * amount : (entry - exit) * amount;
    }

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
