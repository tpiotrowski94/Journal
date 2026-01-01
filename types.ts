
export enum TradeType {
  LONG = 'LONG',
  SHORT = 'SHORT'
}

export interface Trade {
  id: string;
  symbol: string;
  type: TradeType;
  entryPrice: number;
  exitPrice: number;
  amount: number;
  fees: number;
  date: string;
  notes: string;
  pnl: number;
  pnlPercentage: number;
}

export interface TradingStats {
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  bestTrade: number;
  worstTrade: number;
  avgPnl: number;
}

export interface SyncSettings {
  remoteUrl: string;
  apiKey: string;
  lastSynced: string | null;
  mode: 'local' | 'cloud';
}
