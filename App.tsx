
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Trade, TradeType, TradeStatus, MarginMode, SyncProvider, TradingStats, Wallet, PerformanceMetric } from './types';
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

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
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
  const syncOperationRef = useRef<string | null>(null);

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

  const calculatePnl = useCallback((trade: Partial<Trade>) => {
    const entry = Number(trade.entryPrice) || 0, amount = Number(trade.amount) || 0;
    const exit = trade.exitPrice ?? null, fees = Number(trade.fees) || 0, funding = Number(trade.fundingFees) || 0, lev = Number(trade.leverage) || 1;
    if (entry === 0 || amount === 0 || exit === null) return { pnl: 0, pnlPercentage: 0 };
    const grossPnl = trade.type === TradeType.LONG ? (exit - entry) * amount : (entry - exit) * amount;
    const pnl = grossPnl - fees - funding;
    // ROE = Return on Equity (Margin based on leverage)
    const margin = (entry * amount) / lev;
    return { pnl: isFinite(pnl) ? pnl : 0, pnlPercentage: margin !== 0 ? (pnl / margin) * 100 : 0 };
  }, []);

  const handleSyncWallet = useCallback(async (isAuto: boolean = false) => {
    const currentId = dataService.getActiveWalletId();
    if (!currentId) return;

    const wallet = dataService.loadWallets().find(w => w.id === currentId);
    if (!wallet?.address || wallet.provider === SyncProvider.MANUAL || isSyncing) return;
    
    syncOperationRef.current = currentId;
    if (!isAuto) setIsSyncing(true);

    try {
      const { trades: syncedTrades, accountValue } = await syncHyperliquidData(wallet.address, wallet.historyStartDate);
      
      if (dataService.getActiveWalletId() !== currentId) return;

      let finalTradesList: Trade[] = [];

      setTrades(prevTrades => {
        if (dataService.getActiveWalletId() !== currentId) return prevTrades;

        const providerPrefix = `hl-active-`;
        const addressSuffix = wallet.address!.toLowerCase();
        
        let base = prevTrades.filter(t => {
           if (t.status === TradeStatus.OPEN && t.externalId?.startsWith(providerPrefix)) {
             return !t.externalId.endsWith(addressSuffix);
           }
           return true;
        });

        const existingIds = new Set(base.filter(t => t.status === TradeStatus.CLOSED).map(t => t.externalId));
        const newItems: Trade[] = [];

        syncedTrades.forEach(st => {
          if (st.status === TradeStatus.OPEN) {
            newItems.push({
              ...st,
              id: crypto.randomUUID(),
              notes: [{ id: crypto.randomUUID(), text: `Live position`, date: new Date().toISOString() }],
              confidence: 3, pnl: 0, pnlPercentage: 0, initialRisk: 0
            } as Trade);
          } else if (st.status === TradeStatus.CLOSED) {
            if (!existingIds.has(st.externalId)) {
              const { pnl, pnlPercentage } = calculatePnl(st);
              newItems.push({
                ...st,
                id: crypto.randomUUID(),
                notes: [{ id: crypto.randomUUID(), text: `Imported history`, date: st.exitDate || new Date().toISOString() }],
                pnl, pnlPercentage, initialRisk: 0
              } as Trade);
            }
          }
        });

        finalTradesList = [...newItems, ...base];
        return finalTradesList;
      });

      if (accountValue > 0) {
        setWallets(prev => prev.map(w => {
          if (w.id === currentId) {
            const isFresh = w.initialBalance === 1000 && w.balanceAdjustment === 0 && finalTradesList.filter(t=>t.status===TradeStatus.CLOSED).length === 0;
            const targetInitial = isFresh ? accountValue : w.initialBalance;
            const closedPnL = finalTradesList.filter(t => t.status === TradeStatus.CLOSED).reduce((sum, t) => sum + (t.pnl || 0), 0);
            const neededAdjustment = accountValue - (targetInitial + closedPnL);
            return { ...w, initialBalance: targetInitial, balanceAdjustment: neededAdjustment, lastSyncAt: new Date().toISOString() };
          }
          return w;
        }));
      }

    } catch (err) {
      console.error("Sync Process Error:", err);
    } finally {
      setIsSyncing(false);
      syncOperationRef.current = null;
    }
  }, [calculatePnl, isSyncing]);

  useEffect(() => {
    const loadedWallets = dataService.loadWallets();
    const savedActiveId = dataService.getActiveWalletId();

    if (loadedWallets.length > 0) {
      setWallets(loadedWallets);
      const startId = (savedActiveId && loadedWallets.find(w => w.id === savedActiveId)) ? savedActiveId : loadedWallets[0].id;
      setActiveWalletId(startId);
      dataService.setActiveWalletId(startId);
      setTrades(dataService.loadTrades(startId));
    } else {
      const defaultWallet: Wallet = { 
        id: crypto.randomUUID(), name: 'Portfolio 1', provider: SyncProvider.MANUAL,
        initialBalance: 1000, balanceAdjustment: 0, autoSync: false, preferredMetric: PerformanceMetric.ROE
      };
      setWallets([defaultWallet]);
      dataService.saveWallets([defaultWallet]);
      setActiveWalletId(defaultWallet.id);
      dataService.setActiveWalletId(defaultWallet.id);
    }
  }, []);

  useEffect(() => {
    const wallet = wallets.find(w => w.id === activeWalletId);
    if (wallet?.autoSync && wallet?.address) {
      handleSyncWallet(true);
    }
  }, [activeWalletId, wallets.find(w => w.id === activeWalletId)?.autoSync, handleSyncWallet]);

  useEffect(() => {
    if (activeWalletId) {
      dataService.saveTrades(activeWalletId, trades);
    }
  }, [trades, activeWalletId]);

  useEffect(() => {
    if (wallets.length > 0) dataService.saveWallets(wallets);
  }, [wallets]);

  const activeWallet = useMemo(() => wallets.find(w => w.id === activeWalletId), [wallets, activeWalletId]);

  const stats = useMemo<TradingStats>(() => {
    const closed = trades.filter(t => t.status === TradeStatus.CLOSED);
    const totalPnl = closed.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const initial = Number(activeWallet?.initialBalance) || 0;
    const current = initial + totalPnl + (activeWallet?.balanceAdjustment || 0);
    return {
      initialBalance: initial,
      currentBalance: isFinite(current) ? current : initial,
      totalTrades: trades.length,
      openTrades: trades.filter(t => t.status === TradeStatus.OPEN).length,
      winRate: closed.length > 0 ? (closed.filter(t => t.pnl > 0).length / closed.length) * 100 : 0,
      totalPnl,
      totalPnlPercentage: initial > 0 ? (totalPnl / initial) * 100 : 0,
      totalTradeReturn: closed.reduce((sum, t) => sum + (t.pnlPercentage || 0), 0),
      totalTradingFees: closed.reduce((sum, t) => sum + (t.fees || 0), 0),
      totalFundingFees: closed.reduce((sum, t) => sum + (t.fundingFees || 0), 0),
      bestTrade: closed.length > 0 ? Math.max(...closed.map(t => t.pnl)) : 0,
      worstTrade: closed.length > 0 ? Math.min(...closed.map(t => t.pnl)) : 0
    };
  }, [trades, activeWallet]);

  const handleAdjustCurrentBalance = (newRealBalance: number) => {
    if (!activeWallet) return;
    const totalPnl = trades.filter(t => t.status === TradeStatus.CLOSED).reduce((sum, t) => sum + (t.pnl || 0), 0);
    const newAdjustment = newRealBalance - (activeWallet.initialBalance + totalPnl);
    setWallets(prev => prev.map(w => w.id === activeWallet.id ? { ...w, balanceAdjustment: newAdjustment } : w));
  };

  const handleUpdateWallet = (w: Wallet) => setWallets(prev => prev.map(old => old.id === w.id ? w : old));
  const handleUpdateInitialBalance = (v: number) => {
    if (!activeWallet) return;
    const currentEquity = activeWallet.initialBalance + activeWallet.balanceAdjustment;
    handleUpdateWallet({ ...activeWallet, initialBalance: v, balanceAdjustment: currentEquity - v });
  };

  return (
    <div className="min-h-screen pb-12 bg-[#0f172a] text-slate-200">
      <nav className="bg-[#0f172a]/80 backdrop-blur-xl border-b border-slate-800/50 sticky top-0 z-50">
        <div className="max-w-[1800px] mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <i className="fas fa-bolt-lightning text-emerald-500 text-xl"></i>
             <h1 className="text-lg font-black text-white uppercase italic tracking-tighter leading-none">CryptoJournal <span className="text-emerald-500">Pro</span></h1>
          </div>
          <div className="flex items-center gap-4">
            {activeWallet?.address && (
              <div className="flex items-center gap-3 bg-slate-800/50 px-4 py-2 rounded-xl border border-slate-700">
                <div className="flex flex-col items-end">
                   <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest leading-tight">HL Connector</span>
                   <span className="text-[9px] font-mono text-blue-400 leading-none">{activeWallet.address.slice(0, 6)}...{activeWallet.address.slice(-4)}</span>
                </div>
                <button onClick={() => handleSyncWallet(false)} disabled={isSyncing} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isSyncing ? 'animate-spin bg-blue-600/20 text-blue-400' : 'bg-slate-700 text-slate-300 hover:text-white'}`}>
                  <i className="fas fa-sync"></i>
                </button>
              </div>
            )}
            <button onClick={() => setIsSettingsOpen(true)} className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center hover:bg-slate-700 transition-all">
              <i className="fas fa-database text-sm text-slate-400"></i>
            </button>
          </div>
        </div>
      </nav>
      <main className="max-w-[1800px] mx-auto px-4 mt-6">
        <div className="flex justify-between items-center gap-4 mb-4">
          <WalletSwitcher wallets={wallets} activeWalletId={activeWalletId} onSelect={(id) => {
            dataService.setActiveWalletId(id);
            setActiveWalletId(id);
            setTrades(dataService.loadTrades(id));
            setAiAnalysis(null);
          }} onAdd={() => {
            const name = prompt("Portfolio name:"); if (name) {
              const w: Wallet = { id: crypto.randomUUID(), name, provider: SyncProvider.MANUAL, initialBalance: 1000, balanceAdjustment: 0, autoSync: false, preferredMetric: PerformanceMetric.ROE };
              const newList = [...wallets, w]; setWallets(newList); dataService.saveWallets(newList);
              setActiveWalletId(w.id); dataService.setActiveWalletId(w.id); setTrades([]);
            }
          }} onDelete={(id) => { if(confirm("Delete this portfolio?")) { const filtered = wallets.filter(w=>w.id!==id); setWallets(filtered); dataService.saveWallets(filtered); if(activeWalletId===id) { const next = filtered[0]?.id || ''; setActiveWalletId(next); dataService.setActiveWalletId(next); setTrades(next ? dataService.loadTrades(next) : []); } } }} onUpdateWallet={handleUpdateWallet} />
        </div>

        {activeWallet ? (
          <>
            <TradingMantra activeWallet={activeWallet} onUpdateWallet={(data) => handleUpdateWallet({...activeWallet, ...data})} />
            <Dashboard 
              stats={stats} 
              onAdjustBalance={handleAdjustCurrentBalance} 
              onUpdateInitialBalance={handleUpdateInitialBalance} 
            />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-3 space-y-6">
                <TradeForm onAddTrade={(d) => {
                  setTrades(prev => {
                     if (d.status === TradeStatus.OPEN && prev.some(t => t.symbol === d.symbol && t.status === TradeStatus.OPEN)) {
                       alert(`An active position for ${d.symbol} already exists.`);
                       return prev;
                     }
                     const trade: Trade = { ...d, id: crypto.randomUUID(), pnl: 0, pnlPercentage: 0, initialRisk: 0 };
                     return [trade, ...prev];
                  });
                }} onFormUpdate={setFormValues} />
                <RiskCalculator balance={stats.currentBalance} externalData={formValues} />
                <DcaCalculator />
                <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-2xl relative group overflow-hidden">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-all"></div>
                  <div className="flex justify-between items-center mb-4 relative z-10">
                    <h2 className="text-lg font-black text-white uppercase italic tracking-tighter"><i className="fas fa-brain text-purple-400 mr-2"></i> Psychological AI</h2>
                    <button onClick={async () => {
                      if (hasApiKey === false) await handleSelectKey();
                      setIsAnalyzing(true);
                      try { const result = await analyzeTrades(trades); setAiAnalysis(result); } 
                      catch (error) { setAiAnalysis("Analysis failed."); } finally { setIsAnalyzing(false); }
                    }} disabled={isAnalyzing} className="bg-purple-600 hover:bg-purple-500 text-white text-[10px] px-4 py-1.5 rounded-full font-black uppercase transition-all disabled:opacity-50">
                      {isAnalyzing ? '...' : 'Analyze'}
                    </button>
                  </div>
                  <div className="text-xs text-slate-400 leading-relaxed italic min-h-[60px] relative z-10 whitespace-pre-wrap">{aiAnalysis || "Get behavior insights based on your recent trading history."}</div>
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
                }} onEditTrade={(id, data) => setTrades(trades.map(t => {
                  if (t.id === id) {
                    const updated = { ...t, ...data };
                    const { pnl, pnlPercentage } = calculatePnl(updated);
                    return { ...updated, pnl, pnlPercentage };
                  }
                  return t;
                }))} onAddNote={(id, text) => setTrades(trades.map(t => t.id === id ? { ...t, notes: [...t.notes, { id: crypto.randomUUID(), text, date: new Date().toISOString() }] } : t))} onUpdateNote={(tId, nId, text) => setTrades(trades.map(t => t.id === tId ? { ...t, notes: t.notes.map(n => n.id === nId ? { ...n, text } : n) } : t))} onDeleteNote={(tId, nId) => setTrades(trades.map(t => t.id === tId ? { ...t, notes: t.notes.filter(n => n.id !== nId) } : t))} walletBalance={stats.currentBalance} accentColor="emerald" icon="fa-fire-alt" />
                <TradeTable title="Trade History" trades={trades.filter(t=>t.status===TradeStatus.CLOSED)} status={TradeStatus.CLOSED} onDelete={(id)=>setTrades(trades.filter(t=>t.id!==id))} onCloseTrade={()=>{}} onAddToPosition={()=>{}} onEditTrade={(id, data) => {
                  setTrades(trades.map(t => {
                    if (t.id === id) {
                      const updated = { ...t, ...data };
                      const { pnl, pnlPercentage } = calculatePnl(updated);
                      return { ...updated, pnl, pnlPercentage };
                    }
                    return t;
                  }));
                }} onAddNote={(id, text) => setTrades(trades.map(t => t.id === id ? { ...t, notes: [...t.notes, { id: crypto.randomUUID(), text, date: new Date().toISOString() }] } : t))} onUpdateNote={(tId, nId, text) => setTrades(trades.map(t => t.id === tId ? { ...t, notes: t.notes.map(n => n.id === nId ? { ...n, text } : n) } : t))} onDeleteNote={(tId, nId) => setTrades(trades.map(t => t.id === tId ? { ...t, notes: t.notes.filter(n => n.id !== nId) } : t))} walletBalance={stats.currentBalance} accentColor="blue" icon="fa-history" />
                <PnLCalendar trades={trades} portfolioEquity={stats.currentBalance} />
                <Charts trades={trades} initialBalance={stats.initialBalance} />
              </div>
            </div>
          </>
        ) : (
          <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
             <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
             <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Syncing portfolios...</p>
          </div>
        )}
      </main>
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[300] flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 w-full max-w-md rounded-3xl p-8 shadow-2xl text-center">
            <h3 className="text-xl font-black text-white mb-6 uppercase tracking-tighter">Journal Vault</h3>
            <div className="space-y-4">
              <button onClick={() => {
                const blob = new Blob([JSON.stringify(dataService.exportFullBackup(), null, 2)], { type: "application/json" });
                const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `crypto_backup_${new Date().toISOString().slice(0,10)}.json`; link.click();
              }} className="w-full bg-slate-900 border border-slate-700 hover:border-blue-500 text-white p-4 rounded-xl text-xs font-black uppercase transition-all">Download All Data</button>
              <button onClick={() => fileInputRef.current?.click()} className="w-full bg-slate-900 border border-slate-700 hover:border-emerald-500 text-white p-4 rounded-xl text-xs font-black uppercase transition-all">Upload Data</button>
              <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={(e) => {
                 const file = e.target.files?.[0]; if (!file) return;
                 const reader = new FileReader(); reader.onload = (event) => {
                   try { dataService.importFullBackup(JSON.parse(event.target?.result as string)); window.location.reload(); } catch (e) { alert("Corrupted backup file."); }
                 }; reader.readAsText(file);
              }} />
              <button onClick={() => setIsSettingsOpen(false)} className="w-full bg-blue-600 text-white py-4 rounded-xl font-black uppercase text-xs mt-4 hover:bg-blue-500 transition-all">Dismiss</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
