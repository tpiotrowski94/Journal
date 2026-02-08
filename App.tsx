
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Trade, TradeType, TradeStatus, MarginMode, SyncProvider, TradingStats, Wallet, AppState } from './types';
import TradeForm from './components/TradeForm';
import TradeTable from './components/TradeTable';
import Dashboard from './components/Dashboard';
import Charts from './components/Charts';
import PnLCalendar from './components/PnLCalendar';
import RiskCalculator from './components/RiskCalculator';
import DcaCalculator from './components/DcaCalculator';
import WalletSwitcher from './components/WalletSwitcher';
import TradingMantra from './components/TradingMantra'; 
import { analyzeTrades } from './services/geminiService';
import { syncHyperliquidFills } from './services/syncService';
import { dataService } from './services/dataService';

// Define AIStudio interface to satisfy TypeScript and provide correct global types
interface AIStudio {
  hasSelectedApiKey: () => Promise<boolean>;
  openSelectKey: () => Promise<void>;
}

declare global {
  interface Window {
    aistudio: AIStudio;
  }
}

const App: React.FC = () => {
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [activeWalletId, setActiveWalletId] = useState<string>('');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [formValues, setFormValues] = useState({ entry: 0, sl: 0 });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [appState, setAppState] = useState<AppState>({
    storageMode: 'local',
    isSynced: true,
    lastBackup: localStorage.getItem('last_backup_date')
  });

  // Check API Key on mount for AI features only
  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      } else {
        setHasApiKey(true);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      // Assume the key selection was successful after triggering the dialog to avoid race condition
      setHasApiKey(true);
    }
  };

  // Load data on start
  useEffect(() => {
    const loadedWallets = dataService.loadWallets();
    const savedActiveId = dataService.getActiveWalletId();

    if (loadedWallets.length > 0) {
      setWallets(loadedWallets);
      if (savedActiveId && loadedWallets.find(w => w.id === savedActiveId)) {
        setActiveWalletId(savedActiveId);
      } else {
        setActiveWalletId(loadedWallets[0].id);
      }
    } else {
      const defaultWallet: Wallet = { 
        id: crypto.randomUUID(), 
        name: 'Main Wallet', 
        provider: SyncProvider.MANUAL,
        initialBalance: 1000, 
        balanceAdjustment: 0,
        autoSync: false,
        mantra: "Patience is the key to profit.",
        pillars: [
          { title: "Stop Loss", description: "Always have a defined exit", icon: "fa-shield-halved", color: "emerald" }
        ]
      };
      setWallets([defaultWallet]);
      dataService.saveWallets([defaultWallet]);
      setActiveWalletId(defaultWallet.id);
      dataService.setActiveWalletId(defaultWallet.id);
    }
  }, []);

  useEffect(() => {
    if (activeWalletId) {
      dataService.setActiveWalletId(activeWalletId);
      const loaded = dataService.loadTrades(activeWalletId);
      setTrades(loaded);
      setAiAnalysis(null);
    }
  }, [activeWalletId]);

  useEffect(() => {
    if (activeWalletId && trades.length >= 0) {
      dataService.saveTrades(activeWalletId, trades);
    }
  }, [trades, activeWalletId]);

  useEffect(() => {
    if (wallets.length > 0) {
      dataService.saveWallets(wallets);
    }
  }, [wallets]);

  const activeWallet = useMemo(() => 
    wallets.find(w => w.id === activeWalletId)
  , [wallets, activeWalletId]);

  const calculatePnl = useCallback((trade: Partial<Trade>) => {
    const entry = Number(trade.entryPrice) || 0;
    const amount = Number(trade.amount) || 0;
    const exit = (trade.exitPrice !== null && trade.exitPrice !== undefined) ? Number(trade.exitPrice) : null;
    const tradingFees = Number(trade.fees) || 0;
    const fundingFees = Number(trade.fundingFees) || 0;
    const leverage = Number(trade.leverage) || 1;

    if (entry === 0 || amount === 0 || exit === null) return { pnl: 0, pnlPercentage: 0 };
    
    const isLong = trade.type === TradeType.LONG;
    const grossPnl = isLong 
      ? (exit - entry) * amount
      : (entry - exit) * amount;
    
    const pnl = grossPnl - tradingFees - fundingFees;
    const margin = (entry * amount) / leverage;
    const pnlPercentage = margin !== 0 ? (pnl / margin) * 100 : 0;
    
    return { 
      pnl: isFinite(pnl) ? pnl : 0, 
      pnlPercentage: isFinite(pnlPercentage) ? pnlPercentage : 0 
    };
  }, []);

  const handleSyncWallet = useCallback(async (isAuto: boolean = false) => {
    if (!activeWallet?.address || activeWallet.provider === SyncProvider.MANUAL) return;
    if (!isAuto) setIsSyncing(true);

    try {
      console.log(`[SYNC] Fetching Hyperliquid fills for: ${activeWallet.address}`);
      const parsedResults = await syncHyperliquidFills(activeWallet.address);
      
      const existingExternalIds = new Set(trades.map(t => t.externalId).filter(Boolean));
      const newUniqueParsed = parsedResults.filter(pt => pt.externalId && !existingExternalIds.has(pt.externalId));

      if (newUniqueParsed.length > 0) {
        const importedTrades: Trade[] = newUniqueParsed.map(pt => {
          const hasExit = pt.exitPrice !== null && pt.exitPrice !== undefined && pt.exitPrice > 0;
          const baseTrade: Partial<Trade> = {
            ...pt,
            id: crypto.randomUUID(),
            status: hasExit ? TradeStatus.CLOSED : TradeStatus.OPEN,
            notes: [{ id: crypto.randomUUID(), text: `Auto-Synced from Hyperliquid`, date: new Date().toISOString() }],
            fundingFees: pt.fundingFees || 0,
            confidence: 3,
            leverage: pt.leverage || 1,
            marginMode: MarginMode.ISOLATED,
          };
          const { pnl, pnlPercentage } = calculatePnl(baseTrade);
          const initialRisk = (baseTrade.entryPrice! * baseTrade.amount!) / baseTrade.leverage!;
          
          return { 
            ...baseTrade, 
            pnl, 
            pnlPercentage, 
            initialRisk: isFinite(initialRisk) ? initialRisk : 0 
          } as Trade;
        });

        setTrades(prev => [...importedTrades, ...prev]);
        if (!isAuto) alert(`Successfully imported ${importedTrades.length} new trades.`);
      } else if (!isAuto) {
        alert("Portfolio is up to date.");
      }
      
      setWallets(prev => prev.map(w => w.id === activeWalletId ? { ...w, lastSyncAt: new Date().toISOString() } : w));
      
    } catch (err: any) {
      console.error("Sync Error:", err);
      if (!isAuto) alert(`Sync failed: ${err.message || "Unknown error"}`);
    } finally {
      if (!isAuto) setIsSyncing(false);
    }
  }, [activeWallet, trades, calculatePnl, activeWalletId]);

  // AUTO-SYNC EFFECT: Every 5 minutes
  useEffect(() => {
    let interval: any;
    if (activeWallet?.autoSync && activeWallet?.address && activeWallet.provider !== SyncProvider.MANUAL) {
      handleSyncWallet(true);
      interval = setInterval(() => handleSyncWallet(true), 300000);
    }
    return () => clearInterval(interval);
  }, [activeWallet?.autoSync, activeWallet?.address, handleSyncWallet]);

  const handleUpdateWallet = (updatedWallet: Wallet) => {
    setWallets(prev => prev.map(w => w.id === updatedWallet.id ? updatedWallet : w));
  };

  const handleAddTrade = (newTradeData: Omit<Trade, 'id' | 'pnl' | 'pnlPercentage' | 'initialRisk'>) => {
    const entry = Number(newTradeData.entryPrice) || 0;
    const amount = Number(newTradeData.amount) || 0;
    const leverage = Number(newTradeData.leverage) || 1;
    const sl = newTradeData.stopLoss !== null ? Number(newTradeData.stopLoss) : null;
    
    let initialRisk = 0;
    if (entry > 0 && amount > 0) {
      initialRisk = sl && sl > 0 ? Math.abs(entry - sl) * amount : (entry * amount) / leverage;
    }

    const { pnl, pnlPercentage } = calculatePnl(newTradeData as any);
    const trade: Trade = { 
      ...newTradeData, 
      id: crypto.randomUUID(), 
      pnl: Number(pnl) || 0, 
      pnlPercentage: Number(pnlPercentage) || 0, 
      initialRisk: isFinite(initialRisk) ? initialRisk : 0 
    };
    setTrades([trade, ...trades]);
  };

  const stats = useMemo<TradingStats>(() => {
    const closedTrades = trades.filter(t => t.status === TradeStatus.CLOSED);
    const totalPnl = closedTrades.reduce((sum, t) => sum + (Number(t.pnl) || 0), 0);
    const totalTradingFees = closedTrades.reduce((sum, t) => sum + (Number(t.fees) || 0), 0);
    const totalFundingFees = closedTrades.reduce((sum, t) => sum + (Number(t.fundingFees) || 0), 0);
    const wins = closedTrades.filter(t => (Number(t.pnl) || 0) > 0).length;
    
    const initialBalance = Number(activeWallet?.initialBalance) || 0;
    const currentBalance = initialBalance + totalPnl + (activeWallet?.balanceAdjustment || 0);
    
    return {
      initialBalance,
      currentBalance: isFinite(currentBalance) ? currentBalance : initialBalance,
      totalTrades: trades.length,
      openTrades: trades.filter(t => t.status === TradeStatus.OPEN).length,
      winRate: closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0,
      totalPnl: isFinite(totalPnl) ? totalPnl : 0,
      totalPnlPercentage: initialBalance !== 0 ? (totalPnl / initialBalance) * 100 : 0,
      totalTradeReturn: closedTrades.reduce((sum, t) => sum + (Number(t.pnlPercentage) || 0), 0),
      totalTradingFees,
      totalFundingFees,
      bestTrade: closedTrades.length > 0 ? Math.max(...closedTrades.map(t => Number(t.pnl) || 0)) : 0,
      worstTrade: closedTrades.length > 0 ? Math.min(...closedTrades.map(t => Number(t.pnl) || 0)) : 0
    };
  }, [trades, activeWallet]);

  const handleAdjustCurrentBalance = (newRealBalance: number) => {
    if (!activeWallet) return;
    const closedTrades = trades.filter(t => t.status === TradeStatus.CLOSED);
    const totalPnl = closedTrades.reduce((sum, t) => sum + (Number(t.pnl) || 0), 0);
    const newAdjustment = newRealBalance - (activeWallet.initialBalance + totalPnl);
    handleUpdateWallet({ ...activeWallet, balanceAdjustment: newAdjustment });
  };

  const handleUpdateInitialBalance = (newInitial: number) => {
    if (!activeWallet) return;
    handleUpdateWallet({ ...activeWallet, initialBalance: newInitial });
  };

  const handleAddWallet = () => {
    const name = prompt("Enter wallet name:");
    if (!name) return;
    const newWallet: Wallet = { 
      id: crypto.randomUUID(), 
      name, 
      provider: SyncProvider.MANUAL,
      initialBalance: 1000, 
      balanceAdjustment: 0, 
      autoSync: false 
    };
    setWallets([...wallets, newWallet]);
    setActiveWalletId(newWallet.id);
  };

  const handleDeleteWallet = (id: string) => {
    if (wallets.length <= 1) return alert("At least one wallet is required.");
    if (confirm("Permanently delete this wallet?")) {
      const newWallets = wallets.filter(w => w.id !== id);
      setWallets(newWallets);
      localStorage.removeItem(`trades_${id}`);
      if (activeWalletId === id) setActiveWalletId(newWallets[0].id);
    }
  };

  const openTrades = useMemo(() => trades.filter(t => t.status === TradeStatus.OPEN), [trades]);
  const closedTrades = useMemo(() => trades.filter(t => t.status === TradeStatus.CLOSED), [trades]);

  return (
    <div className="min-h-screen pb-12 bg-[#0f172a] text-slate-200">
      <nav className="bg-[#0f172a]/80 backdrop-blur-xl border-b border-slate-800/50 sticky top-0 z-50">
        <div className="max-w-[1800px] mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <i className="fas fa-bolt-lightning text-emerald-500 text-xl"></i>
             <h1 className="text-lg font-black text-white tracking-tighter uppercase italic leading-tight">CryptoJournal <span className="text-emerald-500">Pro</span></h1>
          </div>
          <div className="flex items-center gap-4">
            {activeWallet?.address && activeWallet.provider !== SyncProvider.MANUAL && (
              <div className="flex items-center gap-3 bg-slate-800/50 px-4 py-2 rounded-xl border border-slate-700">
                <div className="flex flex-col items-end">
                   <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">HL Live Sync</span>
                   <span className="text-[9px] font-mono text-blue-400">{activeWallet.address.slice(0, 6)}...{activeWallet.address.slice(-4)}</span>
                </div>
                <button 
                  onClick={() => handleSyncWallet(false)} 
                  disabled={isSyncing}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isSyncing ? 'bg-blue-600/20 text-blue-400' : 'bg-slate-700 text-slate-300 hover:text-white'}`}
                >
                  <i className={`fas fa-sync ${isSyncing ? 'animate-spin' : ''}`}></i>
                </button>
              </div>
            )}
            <button onClick={() => setIsSettingsOpen(true)} className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 flex items-center justify-center hover:bg-slate-700 transition-all active:scale-95">
              <i className="fas fa-database text-sm"></i>
            </button>
          </div>
        </div>
      </nav>
      <main className="max-w-[1800px] mx-auto px-4 mt-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <WalletSwitcher 
            wallets={wallets} 
            activeWalletId={activeWalletId} 
            onSelect={setActiveWalletId} 
            onAdd={handleAddWallet} 
            onDelete={handleDeleteWallet} 
            onUpdateWallet={handleUpdateWallet}
          />
          {appState.lastBackup && (
            <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-800/50 px-4 py-2 rounded-full border border-slate-700">
              Backup: <span className="text-slate-300 ml-1">{appState.lastBackup}</span>
            </div>
          )}
        </div>

        {activeWallet ? (
          <>
            <TradingMantra 
              activeWallet={activeWallet} 
              onUpdateWallet={(data) => handleUpdateWallet({...activeWallet, ...data})} 
            />

            <Dashboard 
              stats={stats} 
              onAdjustBalance={handleAdjustCurrentBalance} 
              onUpdateInitialBalance={handleUpdateInitialBalance} 
            />
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-3 xl:col-span-3 space-y-6">
                <TradeForm onAddTrade={handleAddTrade} onFormUpdate={setFormValues} />
                <RiskCalculator balance={stats.currentBalance} externalData={formValues} />
                <DcaCalculator />
                <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-2xl relative overflow-hidden group">
                   <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-all"></div>
                   <div className="flex justify-between items-center mb-4 relative z-10">
                    <h2 className="text-lg font-black text-white uppercase italic tracking-tight"><i className="fas fa-brain text-purple-400 mr-2"></i> Trading AI</h2>
                    <div className="flex gap-2">
                       {hasApiKey === false && (
                         <button onClick={handleSelectKey} className="text-[8px] font-black text-blue-400 hover:text-white uppercase">Set Key</button>
                       )}
                       <button onClick={async () => {
                        if (hasApiKey === false) return handleSelectKey();
                        setIsAnalyzing(true);
                        setAiAnalysis(await analyzeTrades(trades));
                        setIsAnalyzing(false);
                      }} disabled={isAnalyzing} className="bg-purple-600 hover:bg-purple-500 text-white text-[10px] px-4 py-1.5 rounded-full font-black uppercase transition-all disabled:opacity-50">
                        {isAnalyzing ? '...' : 'Analyze'}
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 leading-relaxed italic min-h-[60px] relative z-10">
                    {aiAnalysis || "Click analyze to get performance insights from Gemini Pro."}
                  </div>
                </div>
              </div>
              <div className="lg:col-span-9 xl:col-span-9 space-y-12">
                <TradeTable 
                  title="Active Positions" 
                  trades={openTrades} 
                  status={TradeStatus.OPEN}
                  onDelete={(id) => setTrades(prev => prev.filter(t => t.id !== id))} 
                  onCloseTrade={(id, price, fees, notes, funding, date, isTotal) => {
                     setTrades(prev => prev.map(t => {
                       if (t.id === id) {
                         const finalFees = isTotal ? Number(fees) : (Number(t.fees) || 0) + (Number(fees) || 0);
                         const finalFunding = isTotal ? Number(funding) : (Number(t.fundingFees) || 0) + (Number(funding) || 0);
                         const updated: Trade = { 
                           ...t, 
                           exitPrice: price, 
                           fees: finalFees, 
                           fundingFees: finalFunding, 
                           exitDate: date || new Date().toISOString(),
                           status: TradeStatus.CLOSED,
                           notes: notes ? [...t.notes, { id: crypto.randomUUID(), text: `CLOSED: ${notes}`, date: new Date().toISOString() }] : t.notes
                         };
                         const { pnl, pnlPercentage } = calculatePnl(updated);
                         return { ...updated, pnl, pnlPercentage };
                       }
                       return t;
                     }));
                  }} 
                  onAddToPosition={(id, addAmt, addPx, addFees, newLev, addFund) => {
                    setTrades(prev => prev.map(t => {
                      if (t.id === id) {
                        const totalAmount = t.amount + addAmt;
                        const newEntry = ((t.entryPrice * t.amount) + (addPx * addAmt)) / totalAmount;
                        return { 
                          ...t, 
                          amount: totalAmount, 
                          entryPrice: newEntry, 
                          fees: (t.fees || 0) + addFees, 
                          fundingFees: (t.fundingFees || 0) + (addFund || 0),
                          leverage: newLev || t.leverage
                        };
                      }
                      return t;
                    }));
                  }} 
                  onEditTrade={(id, data) => setTrades(prev => prev.map(t => t.id === id ? { ...t, ...data } : t))} 
                  onAddNote={(id, text) => setTrades(prev => prev.map(t => t.id === id ? { ...t, notes: [...t.notes, { id: crypto.randomUUID(), text, date: new Date().toISOString() }] } : t))} 
                  onUpdateNote={(tId, nId, text) => setTrades(prev => prev.map(t => t.id === tId ? { ...t, notes: t.notes.map(n => n.id === nId ? { ...n, text } : n) } : t))} 
                  onDeleteNote={(tId, nId) => setTrades(prev => prev.map(t => t.id === tId ? { ...t, notes: t.notes.filter(n => n.id !== nId) } : t))} 
                  walletBalance={stats.currentBalance} 
                  accentColor="emerald"
                  icon="fa-fire-alt"
                />
                <TradeTable 
                  title="Trade History" 
                  trades={closedTrades} 
                  status={TradeStatus.CLOSED}
                  onDelete={(id) => setTrades(prev => prev.filter(t => t.id !== id))} 
                  onCloseTrade={() => {}} 
                  onAddToPosition={() => {}} 
                  onEditTrade={(id, data) => setTrades(prev => prev.map(t => t.id === id ? { ...t, ...data } : t))} 
                  onAddNote={(id, text) => setTrades(prev => prev.map(t => t.id === id ? { ...t, notes: [...t.notes, { id: crypto.randomUUID(), text, date: new Date().toISOString() }] } : t))} 
                  onUpdateNote={(tId, nId, text) => setTrades(prev => prev.map(t => t.id === tId ? { ...t, notes: t.notes.map(n => n.id === nId ? { ...n, text } : n) } : t))} 
                  onDeleteNote={(tId, nId) => setTrades(prev => prev.map(t => t.id === tId ? { ...t, notes: t.notes.filter(n => n.id !== nId) } : t))} 
                  walletBalance={stats.currentBalance} 
                  accentColor="blue"
                  icon="fa-history"
                />
                <PnLCalendar trades={trades} />
                <Charts trades={trades} initialBalance={stats.initialBalance} />
              </div>
            </div>
          </>
        ) : (
          <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
             <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
             <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Loading Portfolio...</p>
          </div>
        )}
      </main>

      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[300] flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 w-full max-w-md rounded-3xl p-8 shadow-2xl">
            <h3 className="text-xl font-black text-white mb-6 uppercase tracking-tighter flex items-center gap-3">
              <i className="fas fa-database text-blue-400"></i> Backup Center
            </h3>
            <div className="space-y-4">
              <button 
                onClick={() => {
                   const data = dataService.exportFullBackup();
                   const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                   const url = URL.createObjectURL(blob);
                   const link = document.createElement('a');
                   link.href = url;
                   link.download = `crypto_journal_backup_${new Date().toISOString().split('T')[0]}.json`;
                   link.click();
                }}
                className="w-full bg-slate-900 border border-slate-700 hover:border-blue-500 text-white p-4 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-3"
              >
                Export JSON
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-slate-900 border border-slate-700 hover:border-emerald-500 text-white p-4 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-3"
              >
                Import JSON
              </button>
              <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={(e) => {
                 const file = e.target.files?.[0];
                 if (!file) return;
                 const reader = new FileReader();
                 reader.onload = (event) => {
                   try {
                     const json = JSON.parse(event.target?.result as string);
                     dataService.importFullBackup(json);
                     window.location.reload();
                   } catch (e) { alert("Invalid file format."); }
                 };
                 reader.readAsText(file);
              }} />
              <button onClick={() => setIsSettingsOpen(false)} className="w-full bg-blue-600 text-white py-4 rounded-xl font-black uppercase text-xs mt-4">Close Settings</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
