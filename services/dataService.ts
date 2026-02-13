
import { Trade, Wallet } from '../types';

const WALLETS_KEY = 'crypto_journal_wallets_list';
const ACTIVE_WALLET_ID_KEY = 'crypto_journal_active_wallet_id';

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
  },

  deleteTrades: (walletId: string) => {
    localStorage.removeItem(`trades_${walletId}`);
  },

  getActiveWalletId: (): string | null => {
    return localStorage.getItem(ACTIVE_WALLET_ID_KEY);
  },

  setActiveWalletId: (id: string) => {
    localStorage.setItem(ACTIVE_WALLET_ID_KEY, id);
  },

  // FULL BACKUP
  exportFullBackup: () => {
    const wallets = dataService.loadWallets();
    const allData: Record<string, any> = {
      wallets,
      activeWalletId: dataService.getActiveWalletId(),
      trades: {}
    };

    wallets.forEach(w => {
      allData.trades[w.id] = dataService.loadTrades(w.id);
    });

    return allData;
  },

  importFullBackup: (data: any) => {
    if (!data.wallets || !Array.isArray(data.wallets)) throw new Error("Invalid backup format");
    
    // Clear old linked data first (optional but safer)
    const oldWallets = dataService.loadWallets();
    oldWallets.forEach(w => localStorage.removeItem(`trades_${w.id}`));

    // Save new data
    dataService.saveWallets(data.wallets);
    if (data.activeWalletId) dataService.setActiveWalletId(data.activeWalletId);
    
    if (data.trades) {
      Object.keys(data.trades).forEach(walletId => {
        dataService.saveTrades(walletId, data.trades[walletId]);
      });
    }
  }
};
