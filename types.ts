
export enum TradeType {
  LONG = 'LONG',
  SHORT = 'SHORT'
}

export enum TradeStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED'
}

export interface Trade {
  id: string;
  symbol: string;
  type: TradeType;
  status: TradeStatus;
  entryPrice: number;
  exitPrice: number | null;
  amount: number;
  fees: number;
  date: string;
  notes: string;
  pnl: number;
  pnlPercentage: number;
}

export interface TradingStats {
  initialBalance: number;
  currentBalance: number;
  totalTrades: number;
  openTrades: number;
  winRate: number;
  totalPnl: number;
  totalPnlPercentage: number;
  bestTrade: number;
  worstTrade: number;
}

export interface SyncSettings {
  remoteUrl: string;
  apiKey: string;
  lastSynced: string | null;
  mode: 'local' | 'cloud';
  initialBalance: number;
}
