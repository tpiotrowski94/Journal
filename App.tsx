
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
import { syncHyperliquidData } from './services/syncService';
import { dataService } from './services/dataService';

// Define AIStudio interface to satisfy TypeScript and match global type definition
interface AIStudio {
  hasSelectedApiKey: () => Promise<boolean>;
  openSelectKey: () => Promise<void>;
}

declare global {
  interface Window {
    aistudio?: AIStudio;
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
      setHasApiKey(true);
    }
  };

  const handlePerformAiAnalysis = async () => {
    if (hasApiKey === false) await handleSelectKey();
    setIsAnalyzing(true);
    try {
      const result = await analyzeTrades(trades);
      setAiAnalysis(result);
    } catch (error: any) {
      if (error?.message?.includes("Requested entity was not found.")) {
        setHasApiKey(false);
        if (window.aistudio) await window.aistudio.openSelectKey();
      } else {
        setAiAnalysis("Error generating AI analysis. Check billing.");
      }
    } finally {
      setIsAnalyzing(false);
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
        pillars: [{ title: "Stop Loss", description: "Always have a defined exit", icon: "fa-shield-halved", color: "emerald" }]
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
      setTrades(dataService.loadTrades(activeWalletId));
      setAiAnalysis(null);
    }
  }, [activeWalletId]);

  useEffect(() => {
    if (activeWalletId) dataService.saveTrades(activeWalletId, trades);
  }, [trades, activeWalletId]);

  useEffect(() => {
    if (wallets.length > 0) dataService.saveWallets(wallets);
  }, [wallets]);

  const activeWallet = useMemo(() => wallets.find(w => w.id === activeWalletId), [wallets, activeWalletId]);

  const calculatePnl = useCallback((trade: Partial<Trade>) => {
    const entry = Number(trade.entryPrice) || 0, amount = Number(trade.amount) || 0;
    const exit = trade.exitPrice ?? null, fees = Number(trade.fees) || 0, funding = Number(trade.fundingFees) || 0, lev = Number(trade.leverage) || 1;
    if (entry === 0 || amount === 0 || exit === null) return { pnl: 0, pnlPercentage: 0 };
    const grossPnl = trade.type === TradeType.LONG ? (exit - entry) * amount : (entry - exit) * amount;
    const pnl = grossPnl - fees - funding;
    const margin = (entry * amount) / lev;
    return { pnl: isFinite(pnl) ? pnl : 0, pnlPercentage: margin !== 0 ? (pnl / margin) * 100 : 0 };
  }, []);

  const handleSyncWallet = useCallback(async (isAuto: boolean = false) => {
    if (!activeWallet?.address || activeWallet.provider === SyncProvider.MANUAL) return;
    if (!isAuto) setIsSyncing(true);

    try {
      const { trades: syncedTrades, accountValue } = await syncHyperliquidData(activeWallet.address);
      
      // Update Equity if address is linked
      if (accountValue > 0) {
        handleAdjustCurrentBalance(accountValue);
      }

      const existingIds = new Set(trades.map(t => t.externalId).filter(Boolean));
      const newItems = syncedTrades.filter(st => st.externalId && !existingIds.has(st.externalId));

      if (newItems.length > 0) {
        const imported: Trade[] = newItems.map(pt => {
          const base: Partial<Trade> = {
            ...pt,
            id: crypto.randomUUID(),
            notes: [{ id: crypto.randomUUID(), text: `Synced from Hyperliquid`, date: new Date().toISOString() }],
            confidence: 3,
            marginMode: pt.marginMode || MarginMode.ISOLATED,
          };
          const { pnl, pnlPercentage } = calculatePnl(base);
          return { ...base, pnl, pnlPercentage, initialRisk: (base.entryPrice! * base.amount!) / (base.leverage || 1) } as Trade;
        });
        setTrades(prev => [...imported, ...prev]);
        if (!isAuto) alert(`Sync complete. Imported ${imported.length} trades. Balance updated to $${accountValue.toFixed(2)}`);
      } else if (!isAuto) {
        alert(`Already up to date. Balance updated to $${accountValue.toFixed(2)}`);
      }
      setWallets(prev => prev.map(w => w.id === activeWalletId ? { ...w, lastSyncAt: new Date().toISOString() } : w));
    } catch (err: any) {
      console.error(err);
      if (!isAuto) alert(`Sync failed: ${err.message}`);
    } finally {
      if (!isAuto) setIsSyncing(false);
    }
  }, [activeWallet, trades, calculatePnl, activeWalletId]);

  useEffect(() => {
    let interval: any;
    if (activeWallet?.autoSync && activeWallet?.address) {
      handleSyncWallet(true);
      interval = setInterval(() => handleSyncWallet(true), 300000);
    }
    return () => clearInterval(interval);
  }, [activeWallet?.autoSync, activeWallet?.address, handleSyncWallet]);

  const stats = useMemo<TradingStats>(() => {
    const closed = trades.filter(t => t.status === TradeStatus.CLOSED);
    const totalPnl = closed.reduce((sum, t) => sum + t.pnl, 0);
    const initial = Number(activeWallet?.initialBalance) || 0;
    return {
      initialBalance: initial,
      currentBalance: initial + totalPnl + (activeWallet?.balanceAdjustment || 0),
      totalTrades: trades.length,
      openTrades: trades.filter(t => t.status === TradeStatus.OPEN).length,
      winRate: closed.length > 0 ? (closed.filter(t => t.pnl > 0).length / closed.length) * 100 : 0,
      totalPnl,
      totalPnlPercentage: initial !== 0 ? (totalPnl / initial) * 100 : 0,
      totalTradeReturn: closed.reduce((sum, t) => sum + t.pnlPercentage, 0),
      totalTradingFees: closed.reduce((sum, t) => sum + t.fees, 0),
      totalFundingFees: closed.reduce((sum, t) => sum + t.fundingFees, 0),
      bestTrade: closed.length > 0 ? Math.max(...closed.map(t => t.pnl)) : 0,
      worstTrade: closed.length > 0 ? Math.min(...closed.map(t => t.pnl)) : 0
    };
  }, [trades, activeWallet]);

  const handleAdjustCurrentBalance = (newRealBalance: number) => {
    if (!activeWallet) return;
    const totalPnl = trades.filter(t => t.status === TradeStatus.CLOSED).reduce((sum, t) => sum + t.pnl, 0);
    const newAdjustment = newRealBalance - (activeWallet.initialBalance + totalPnl);
    handleUpdateWallet({ ...activeWallet, balanceAdjustment: newAdjustment });
  };

  const handleUpdateWallet = (w: Wallet) => setWallets(prev => prev.map(old => old.id === w.id ? w : old));
  const handleUpdateInitialBalance = (v: number) => activeWallet && handleUpdateWallet({ ...activeWallet, initialBalance: v });

  return (
    <div className="min-h-screen pb-12 bg-[#0f172a] text-slate-200">
      <nav className="bg-[#0f172a]/80 backdrop-blur-xl border-b border-slate-800/50 sticky top-0 z-50">
        <div className="max-w-[1800px] mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <i className="fas fa-bolt-lightning text-emerald-500 text-xl"></i>
             <h1 className="text-lg font-black text-white uppercase italic tracking-tighter">CryptoJournal <span className="text-emerald-500">Pro</span></h1>
          </div>
          <div className="flex items-center gap-4">
            {activeWallet?.address && (
              <div className="flex items-center gap-3 bg-slate-800/50 px-4 py-2 rounded-xl border border-slate-700">
                <div className="flex flex-col items-end">
                   <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">HL Live Sync</span>
                   <span className="text-[9px] font-mono text-blue-400">{activeWallet.address.slice(0, 6)}...{activeWallet.address.slice(-4)}</span>
                </div>
                <button onClick={() => handleSyncWallet(false)} disabled={isSyncing} className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSyncing ? 'animate-spin bg-blue-600/20 text-blue-400' : 'bg-slate-700 text-slate-300'}`}>
                  <i className="fas fa-sync"></i>
                </button>
              </div>
            )}
            <button onClick={() => setIsSettingsOpen(true)} className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center hover:bg-slate-700 transition-all">
              <i className="fas fa-database text-sm"></i>
            </button>
          </div>
        </div>
      </nav>
      <main className="max-w-[1800px] mx-auto px-4 mt-6">
        <div className="flex justify-between items-center gap-4 mb-4">
          <WalletSwitcher wallets={wallets} activeWalletId={activeWalletId} onSelect={setActiveWalletId} onAdd={() => {
            const name = prompt("Wallet name:"); if (name) {
              const w: Wallet = { id: crypto.randomUUID(), name, provider: SyncProvider.MANUAL, initialBalance: 1000, balanceAdjustment: 0, autoSync: false };
              setWallets([...wallets, w]); setActiveWalletId(w.id);
            }
          }} onDelete={(id) => { if(confirm("Delete?")) { setWallets(wallets.filter(w=>w.id!==id)); if(activeWalletId===id) setActiveWalletId(wallets[0].id); } }} onUpdateWallet={handleUpdateWallet} />
        </div>

        {activeWallet ? (
          <>
            <TradingMantra activeWallet={activeWallet} onUpdateWallet={(data) => handleUpdateWallet({...activeWallet, ...data})} />
            <Dashboard stats={stats} onAdjustBalance={handleAdjustCurrentBalance} onUpdateInitialBalance={handleUpdateInitialBalance} />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-3 space-y-6">
                <TradeForm onAddTrade={(d) => {
                  const trade: Trade = { ...d, id: crypto.randomUUID(), pnl: 0, pnlPercentage: 0, initialRisk: 0 };
                  setTrades([trade, ...trades]);
                }} onFormUpdate={setFormValues} />
                <RiskCalculator balance={stats.currentBalance} externalData={formValues} />
                <DcaCalculator />
                <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-2xl relative group">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-black text-white uppercase italic"><i className="fas fa-brain text-purple-400 mr-2"></i> Trading AI</h2>
                    <button onClick={handlePerformAiAnalysis} disabled={isAnalyzing} className="bg-purple-600 hover:bg-purple-500 text-white text-[10px] px-4 py-1.5 rounded-full font-black uppercase transition-all">
                      {isAnalyzing ? '...' : 'Analyze'}
                    </button>
                  </div>
                  <div className="text-xs text-slate-400 leading-relaxed italic min-h-[60px]">{aiAnalysis || "Insights will appear here."}</div>
                </div>
              </div>
              <div className="lg:col-span-9 space-y-12">
                <TradeTable title="Active Positions" trades={trades.filter(t=>t.status===TradeStatus.OPEN)} status={TradeStatus.OPEN} onDelete={(id)=>setTrades(trades.filter(t=>t.id!==id))} onCloseTrade={(id, p, f, n, fund, d, isT) => {
                   setTrades(trades.map(t => {
                     if (t.id === id) {
                       const updated = { ...t, exitPrice: p, fees: isT ? f : (t.fees + f), fundingFees: isT ? fund : (t.fundingFees + fund), exitDate: d || new Date().toISOString(), status: TradeStatus.CLOSED };
                       const { pnl, pnlPercentage } = calculatePnl(updated);
                       return { ...updated, pnl, pnlPercentage };
                     } return t;
                   }));
                }} onAddToPosition={(id, a, p, f, l, fund) => {
                  setTrades(trades.map(t => t.id === id ? { ...t, amount: t.amount + a, entryPrice: ((t.entryPrice * t.amount) + (p * a)) / (t.amount + a), fees: t.fees + f, fundingFees: t.fundingFees + (fund||0), leverage: l || t.leverage } : t));
                }} onEditTrade={(id, data) => setTrades(trades.map(t => t.id === id ? { ...t, ...data } : t))} onAddNote={(id, text) => setTrades(trades.map(t => t.id === id ? { ...t, notes: [...t.notes, { id: crypto.randomUUID(), text, date: new Date().toISOString() }] } : t))} onUpdateNote={(tId, nId, text) => setTrades(trades.map(t => t.id === tId ? { ...t, notes: t.notes.map(n => n.id === nId ? { ...n, text } : n) } : t))} onDeleteNote={(tId, nId) => setTrades(trades.map(t => t.id === tId ? { ...t, notes: t.notes.filter(n => n.id !== nId) } : t))} walletBalance={stats.currentBalance} accentColor="emerald" icon="fa-fire-alt" />
                <TradeTable title="Trade History" trades={trades.filter(t=>t.status===TradeStatus.CLOSED)} status={TradeStatus.CLOSED} onDelete={(id)=>setTrades(trades.filter(t=>t.id!==id))} onCloseTrade={()=>{}} onAddToPosition={()=>{}} onEditTrade={(id, data) => setTrades(trades.map(t => t.id === id ? { ...t, ...data } : t))} onAddNote={(id, text) => setTrades(trades.map(t => t.id === id ? { ...t, notes: [...t.notes, { id: crypto.randomUUID(), text, date: new Date().toISOString() }] } : t))} onUpdateNote={(tId, nId, text) => setTrades(trades.map(t => t.id === tId ? { ...t, notes: t.notes.map(n => n.id === nId ? { ...n, text } : n) } : t))} onDeleteNote={(tId, nId) => setTrades(trades.map(t => t.id === tId ? { ...t, notes: t.notes.filter(n => n.id !== nId) } : t))} walletBalance={stats.currentBalance} accentColor="blue" icon="fa-history" />
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
          <div className="bg-slate-800 border border-slate-700 w-full max-w-md rounded-3xl p-8 shadow-2xl text-center">
            <h3 className="text-xl font-black text-white mb-6 uppercase tracking-tighter">Backup Center</h3>
            <div className="space-y-4">
              <button onClick={() => {
                const blob = new Blob([JSON.stringify(dataService.exportFullBackup(), null, 2)], { type: "application/json" });
                const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `backup.json`; link.click();
              }} className="w-full bg-slate-900 border border-slate-700 hover:border-blue-500 text-white p-4 rounded-xl text-xs font-black uppercase">Export JSON</button>
              <button onClick={() => fileInputRef.current?.click()} className="w-full bg-slate-900 border border-slate-700 hover:border-emerald-500 text-white p-4 rounded-xl text-xs font-black uppercase">Import JSON</button>
              <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={(e) => {
                 const file = e.target.files?.[0]; if (!file) return;
                 const reader = new FileReader(); reader.onload = (event) => {
                   try { dataService.importFullBackup(JSON.parse(event.target?.result as string)); window.location.reload(); } catch (e) { alert("Invalid file"); }
                 }; reader.readAsText(file);
              }} />
              <button onClick={() => setIsSettingsOpen(false)} className="w-full bg-blue-600 text-white py-4 rounded-xl font-black uppercase text-xs mt-4">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
