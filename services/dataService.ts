
import { Trade, Wallet } from '../types';

const WALLETS_KEY = 'crypto_journal_wallets_list';
const ACTIVE_WALLET_ID_KEY = 'crypto_journal_active_wallet_id';

// To jest miejsce, gdzie w przyszłości dodasz: 
// const API_URL = '/api/trades';

export const dataService = {
  // WALLETS
  loadWallets: (): Wallet[] => {
    const saved = localStorage.getItem(WALLETS_KEY);
    return saved ? JSON.parse(saved) : [];
  },
  
  saveWallets: (wallets: Wallet[]) => {
    localStorage.setItem(WALLETS_KEY, JSON.stringify(wallets));
  },

  // TRADES
  loadTrades: (walletId: string): Trade[] => {
    const saved = localStorage.getItem(`trades_${walletId}`);
    return saved ? JSON.parse(saved) : [];
  },

  saveTrades: (walletId: string, trades: Trade[]) => {
    localStorage.setItem(`trades_${walletId}`, JSON.stringify(trades));
    // TUTAJ W PRZYSZŁOŚCI:
    // fetch('/api/save', { method: 'POST', body: JSON.stringify({ walletId, trades }) });
  },

  getActiveWalletId: (): string | null => {
    return localStorage.getItem(ACTIVE_WALLET_ID_KEY);
  },

  setActiveWalletId: (id: string) => {
    localStorage.setItem(ACTIVE_WALLET_ID_KEY, id);
  }
};
