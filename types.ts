
export enum TradeType {
  LONG = 'LONG',
  SHORT = 'SHORT'
}

export enum TradeStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED'
}

export enum MarginMode {
  ISOLATED = 'ISOLATED',
  CROSS = 'CROSS'
}

export interface NoteEntry {
  id: string;
  text: string;
  date: string;
}

export interface Trade {
  id: string;
  symbol: string;
  type: TradeType;
  status: TradeStatus;
  marginMode: MarginMode;
  leverage: number;
  entryPrice: number;
  exitPrice: number | null;
  stopLoss: number | null;
  amount: number;
  fees: number;
  date: string;
  notes: NoteEntry[];
  pnl: number;
  pnlPercentage: number;
  confidence: number;
  initialRisk: number | null;
}

export interface Wallet {
  id: string;
  name: string;
  initialBalance: number;
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

export interface AppState {
  storageMode: 'local' | 'cloud';
  isSynced: boolean;
  lastBackup: string | null;
}
