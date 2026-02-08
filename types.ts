
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

export enum SyncProvider {
  MANUAL = 'MANUAL',
  HYPERLIQUID = 'HYPERLIQUID'
}

export interface NoteEntry {
  id: string;
  text: string;
  date: string;
}

export interface Trade {
  id: string;
  externalId?: string; 
  symbol: string;
  type: TradeType;
  status: TradeStatus;
  marginMode: MarginMode;
  leverage: number;
  entryPrice: number;
  exitPrice: number | null;
  exitDate?: string | null;
  stopLoss: number | null;
  amount: number;
  fees: number;
  fundingFees: number;
  date: string;
  notes: NoteEntry[];
  pnl: number;
  pnlPercentage: number;
  confidence: number;
  initialRisk: number | null;
  exitFees?: number;
  exitFundingFees?: number;
}

export interface TradingPillar {
  title: string;
  description: string;
  icon: string;
  color: string;
}

export interface Wallet {
  id: string;
  name: string;
  provider: SyncProvider;
  address?: string;
  initialBalance: number;
  balanceAdjustment: number;
  mantra?: string;
  pillars?: TradingPillar[];
  showMantra?: boolean;
  showPillars?: boolean;
  autoSync?: boolean;
  lastSyncAt?: string;
  historyStartDate?: string; // New field for cutoff
}

export interface TradingStats {
  initialBalance: number;
  currentBalance: number;
  totalTrades: number;
  openTrades: number;
  winRate: number;
  totalPnl: number;
  totalPnlPercentage: number;
  totalTradeReturn: number;
  totalTradingFees: number;
  totalFundingFees: number;
  bestTrade: number;
  worstTrade: number;
}

export interface AppState {
  storageMode: 'local' | 'cloud';
  isSynced: boolean;
  lastBackup: string | null;
}
