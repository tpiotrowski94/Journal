
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Trade, TradeType, TradeStatus, MarginMode, SyncProvider, TradingStats, Wallet, PerformanceMetric, NoteEntry } from './types';
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
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Funkcja pomocnicza do natychmiastowego czyszczenia starych transakcji przy ładowaniu
  const loadAndPruneTrades = useCallback((walletId: string, currentWallets: Wallet[]) => {
    const rawTrades = dataService.loadTrades(walletId);
    const wallet = currentWallets.find(w => w.id === walletId);
    
    if (!wallet?.historyStartDate) {
      return rawTrades;
    }

    const cutoff = new Date(wallet.historyStartDate).getTime();
    if (isNaN(cutoff) || cutoff <= 0) {
      return rawTrades;
    }

    // Natychmiastowe filtrowanie przy odczycie z dysku
    return rawTrades.filter(t => {
      // Jeśli to transakcja importowana (ma externalId) i jest starsza niż cutoff -> usuń
      if (t.externalId) {
        const tradeTime = new Date(t.exitDate || t.date).getTime();
        if (tradeTime < cutoff) {
          return false;
        }
      }
      return true;
    });
  }, []);

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

    const loadedWallets = dataService.loadWallets();
    if (loadedWallets.length > 0) {
      setWallets(loadedWallets);
      const activeId = dataService.getActiveWalletId() || loadedWallets[0].id;
      setActiveWalletId(activeId);
      // Używamy loadAndPrune zamiast surowego loadTrades
      setTrades(loadAndPruneTrades(activeId, loadedWallets));
    } else {
      const defaultWallet: Wallet = {
        id: crypto.randomUUID(),
        name: 'Main Portfolio',
        provider: SyncProvider.MANUAL,
        initialBalance: 0,
        balanceAdjustment: 0
      };
      setWallets([defaultWallet]);
      setActiveWalletId(defaultWallet.id);
      dataService.saveWallets([defaultWallet]);
      dataService.setActiveWalletId(defaultWallet.id);
    }
  }, [loadAndPruneTrades]);

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
    const currentId = dataService.getActiveWalletId();
    if (!currentId) return;

    const wallet = wallets.find(w => w.id === currentId);
    if (!wallet?.address || wallet.provider === SyncProvider.MANUAL || isSyncing) return;
    
    if (!isAuto) setIsSyncing(true);

    try {
      const { trades: syncedTrades, accountValue } = await syncHyperliquidData(wallet.address, wallet.historyStartDate);
      const addrLower = wallet.address.trim().toLowerCase();

      let pruneCutoffTime = 0;
      if (wallet.historyStartDate) {
        const parsed = new Date(wallet.historyStartDate).getTime();
        if (!isNaN(parsed) && parsed > 0) pruneCutoffTime = parsed;
      }

      setTrades(prevTrades => {
        // --- ETAP 1: FILTERING (Sanity Check dla nowych danych) ---
        const validNewTrades = syncedTrades.filter(t => {
           if (!pruneCutoffTime) return true;
           const tTime = new Date(t.exitDate || t.date || 0).getTime();
           return tTime >= pruneCutoffTime;
        });

        // Mapa nowych transakcji
        const incomingMap = new Map(validNewTrades.map(t => [t.externalId, t]));
        
        const mergedTrades: Trade[] = [];
        const processedExternalIds = new Set<string>();

        // --- ETAP 2: PRZETWARZANIE LOKALNEGO STANU ---
        prevTrades.forEach(t => {
           // A. Transakcje ręczne -> ZACHOWAJ BEZWARUNKOWO
           if (!t.externalId) {
             mergedTrades.push(t);
             return;
           }

           // GLOBAL PRUNING CHECK
           if (pruneCutoffTime > 0) {
              const tradeTime = new Date(t.exitDate || t.date).getTime();
              if (tradeTime < pruneCutoffTime) {
                return; // DROP IT
              }
           }

           // B. Transakcje z innego portfela -> ZACHOWAJ
           if (!t.externalId.toLowerCase().includes(addrLower)) {
             mergedTrades.push(t);
             return;
           }

           // C. Transakcje HL z tego portfela
           const incomingTrade = incomingMap.get(t.externalId);

           if (incomingTrade) {
             let finalLeverage = incomingTrade.leverage || t.leverage || 1;
             const { pnl, pnlPercentage } = calculatePnl({ ...incomingTrade, leverage: finalLeverage });
             
             mergedTrades.push({
               ...t, 
               ...incomingTrade,
               leverage: finalLeverage,
               pnl,
               pnlPercentage
             } as Trade);
             
             processedExternalIds.add(t.externalId);
           } else {
             if (t.status === TradeStatus.OPEN) {
                return; // Live open pos not in API anymore -> Gone
             } else {
                mergedTrades.push(t);
                processedExternalIds.add(t.externalId);
             }
           }
        });

        // --- ETAP 3: DODAWANIE NOWYCH ---
        validNewTrades.forEach(st => {
           if (st.externalId && !processedExternalIds.has(st.externalId)) {
              const { pnl, pnlPercentage } = calculatePnl(st);
              const noteDate = st.exitDate || st.date || new Date().toISOString();
              const defaultNoteText = st.status === TradeStatus.OPEN ? 'Live position from HL' : 'Imported history';

              mergedTrades.push({
                ...st,
                id: crypto.randomUUID(),
                notes: [{ id: crypto.randomUUID(), text: defaultNoteText, date: noteDate }],
                confidence: 3,
                pnl,
                pnlPercentage,
                initialRisk: 0
              } as Trade);
           }
        });

        mergedTrades.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const finalTradeList = mergedTrades;
        dataService.saveTrades(currentId, finalTradeList);

        // --- ETAP 4: AKTUALIZACJA SALDA ---
        if (accountValue >= 0) {
            setWallets(prev => {
                const currentW = prev.find(w => w.id === currentId);
                if (!currentW) return prev;

                const visibleTotalPnl = finalTradeList
                    .filter(t => t.status === TradeStatus.CLOSED)
                    .reduce((sum, t) => sum + (t.pnl || 0), 0);

                const calculatedInitial = accountValue - visibleTotalPnl;

                // Sprawdzamy, czy zmiana jest istotna, aby unikać zbędnych re-renderów
                // (np. różnica mniejsza niż 1 cent jest ignorowana, chyba że to pierwsze ustawienie)
                const isDiff = Math.abs(currentW.initialBalance - calculatedInitial) > 0.01;

                if (isDiff || currentW.balanceAdjustment !== 0) {
                    const newWallets = prev.map(w => {
                        if (w.id === currentId) {
                            return {
                                ...w,
                                initialBalance: calculatedInitial,
                                balanceAdjustment: 0,
                                lastSyncAt: new Date().toISOString()
                            };
                        }
                        return w;
                    });
                    dataService.saveWallets(newWallets);
                    return newWallets;
                }
                return prev;
            });
        }

        return finalTradeList;
      });

    } catch (error) {
      console.error("Sync error:", error);
    } finally {
      setIsSyncing(false);
    }
  }, [wallets, isSyncing, calculatePnl]);

  const activeWallet = wallets.find(w => w.id === activeWalletId);
  const autoSyncEnabled = activeWallet?.autoSync && activeWallet?.provider === SyncProvider.HYPERLIQUID;

  useEffect(() => {
    if (!autoSyncEnabled) return;
    handleSyncWallet(true);
    const timer = setInterval(() => { handleSyncWallet(true); }, 15000);
    return () => clearInterval(timer);
  }, [autoSyncEnabled, handleSyncWallet]);

  const stats: TradingStats = useMemo(() => {
    const activeWallet = wallets.find(w => w.id === activeWalletId);
    const initial = activeWallet?.initialBalance || 0;
    const adjustment = activeWallet?.balanceAdjustment || 0;
    const closedTrades = trades.filter(t => t.status === TradeStatus.CLOSED);
    const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalFees = trades.reduce((sum, t) => sum + (t.fees || 0), 0);
    const totalFunding = trades.reduce((sum, t) => sum + (t.fundingFees || 0), 0);
    const wins = closedTrades.filter(t => t.pnl > 0).length;

    return {
      initialBalance: initial,
      currentBalance: initial + totalPnl + adjustment,
      totalTrades: trades.length,
      openTrades: trades.filter(t => t.status === TradeStatus.OPEN).length,
      winRate: closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0,
      totalPnl,
      totalPnlPercentage: initial > 0 ? (totalPnl / initial) * 100 : 0,
      totalTradeReturn: closedTrades.reduce((sum, t) => sum + (t.pnlPercentage || 0), 0),
      totalTradingFees: totalFees,
      totalFundingFees: totalFunding,
      bestTrade: closedTrades.length > 0 ? Math.max(...closedTrades.map(t => t.pnl)) : 0,
      worstTrade: closedTrades.length > 0 ? Math.min(...closedTrades.map(t => t.pnl)) : 0,
    };
  }, [trades, wallets, activeWalletId]);

  const handleUpdateWallet = (data: Partial<Wallet>) => {
    const updated = wallets.map(w => w.id === activeWalletId ? { ...w, ...data } : w);
    setWallets(updated);
    dataService.saveWallets(updated);
  };

  const handleAddTrade = (tradeData: Omit<Trade, 'id' | 'pnl' | 'pnlPercentage' | 'initialRisk'>) => {
    const { pnl, pnlPercentage } = calculatePnl(tradeData);
    const newTrade: Trade = { ...tradeData, id: crypto.randomUUID(), pnl, pnlPercentage, initialRisk: 0, notes: tradeData.notes || [] };
    const updated = [newTrade, ...trades];
    setTrades(updated);
    dataService.saveTrades(activeWalletId, updated);
  };

  const handleExportBackup = () => {
    const data = dataService.exportFullBackup();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cryptojournal_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        dataService.importFullBackup(json);
        window.location.reload();
      } catch (err) {
        alert('Failed to import backup: Invalid file format.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-300 font-sans">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleImportBackup} 
        className="hidden" 
        accept=".json"
      />

      <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-8">
        <header className="flex flex-col gap-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-xl shadow-blue-600/20">
                <i className="fas fa-terminal text-xl text-white"></i>
              </div>
              <div>
                <h1 className="text-2xl font-black text-white uppercase italic tracking-tighter">CryptoJournal <span className="text-blue-500">Pro</span></h1>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Multi-Wallet Terminal</p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <button 
                onClick={() => fileInputRef.current?.click()} 
                className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-[10px] font-black uppercase text-slate-400 flex items-center gap-2 transition-all hover:bg-slate-700 hover:text-white"
              >
                <i className="fas fa-file-import"></i> Import
              </button>
              <button 
                onClick={handleExportBackup} 
                className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-[10px] font-black uppercase text-slate-400 flex items-center gap-2 transition-all hover:bg-slate-700 hover:text-white"
              >
                <i className="fas fa-file-export"></i> Backup
              </button>
              
              <div className="h-6 w-px bg-slate-800 mx-1 hidden md:block"></div>

              <button onClick={async () => {
                setIsAnalyzing(true);
                try { const res = await analyzeTrades(trades); setAiAnalysis(res); } 
                finally { setIsAnalyzing(false); }
              }} disabled={isAnalyzing} className="px-5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-[10px] font-black uppercase text-blue-400 flex items-center gap-2 transition-all hover:bg-slate-700">
                <i className={`fas ${isAnalyzing ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}`}></i> AI Analysis
              </button>
              <button onClick={() => handleSyncWallet()} disabled={isSyncing} className="px-5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-[10px] font-black uppercase text-emerald-400 flex items-center gap-2 transition-all hover:bg-slate-700">
                <i className={`fas ${isSyncing ? 'fa-sync fa-spin' : 'fa-rotate'}`}></i> Sync Wallet
              </button>
            </div>
          </div>

          <div className="border-b border-slate-800/50 pb-6">
            <WalletSwitcher 
              wallets={wallets} activeWalletId={activeWalletId} 
              onSelect={(id) => { 
                setActiveWalletId(id); 
                dataService.setActiveWalletId(id); 
                // Kluczowa zmiana: Ładujemy i od razu filtrujemy (prune) transakcje, 
                // aby nie było skoku salda przed syncem
                setTrades(loadAndPruneTrades(id, wallets)); 
                setAiAnalysis(null); 
              }} 
              onAdd={() => {
                const nw: Wallet = { id: crypto.randomUUID(), name: 'New Portfolio', provider: SyncProvider.MANUAL, initialBalance: 0, balanceAdjustment: 0 };
                const updated = [...wallets, nw]; setWallets(updated); dataService.saveWallets(updated);
              }}
              onDelete={(id) => {
                if (wallets.length === 1) return;
                const updated = wallets.filter(w => w.id !== id); setWallets(updated); dataService.saveWallets(updated);
                if (activeWalletId === id) setActiveWalletId(updated[0].id);
              }}
              onUpdateWallet={handleUpdateWallet}
            />
          </div>
        </header>

        {wallets.find(w => w.id === activeWalletId) && (
          <>
            <TradingMantra activeWallet={wallets.find(w => w.id === activeWalletId)!} onUpdateWallet={handleUpdateWallet} />
            <Dashboard 
              stats={stats} 
              onAdjustBalance={(val) => {
                const w = wallets.find(w => w.id === activeWalletId);
                if (w) {
                  const needed = val - (w.initialBalance + stats.totalPnl);
                  handleUpdateWallet({ balanceAdjustment: needed });
                }
              }} 
              onUpdateInitialBalance={(val) => handleUpdateWallet({ initialBalance: val })}
              isLive={wallets.find(w => w.id === activeWalletId)?.provider !== SyncProvider.MANUAL}
            />

            {aiAnalysis && (
              <div className="bg-blue-600/5 border border-blue-500/20 p-6 rounded-3xl relative animate-in fade-in slide-in-from-top-4 duration-500">
                <button onClick={() => setAiAnalysis(null)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><i className="fas fa-times"></i></button>
                <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2"><i className="fas fa-brain"></i> AI Performance Review</h3>
                <p className="text-sm text-slate-300 leading-relaxed italic whitespace-pre-wrap">{aiAnalysis}</p>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-4 space-y-8">
                <TradeForm onAddTrade={handleAddTrade} onFormUpdate={setFormValues} />
                <RiskCalculator balance={stats.currentBalance} externalData={formValues} />
                <DcaCalculator />
              </div>

              <div className="lg:col-span-8 space-y-8">
                <TradeTable 
                  title="Active Positions" trades={trades.filter(t => t.status === TradeStatus.OPEN)} status={TradeStatus.OPEN}
                  onDelete={(id) => { const u = trades.filter(t => t.id !== id); setTrades(u); dataService.saveTrades(activeWalletId, u); }}
                  onCloseTrade={(id, p, f, n, fund, d) => {
                    const u = trades.map(t => t.id === id ? { ...t, exitPrice: p, fees: t.fees + f, fundingFees: t.fundingFees + (fund||0), exitDate: d, status: TradeStatus.CLOSED, notes: n ? [...t.notes, {id: crypto.randomUUID(), text: n, date: new Date().toISOString()}] : t.notes } : t);
                    const final = u.map(t => t.id === id ? { ...t, ...calculatePnl(t) } : t);
                    setTrades(final); dataService.saveTrades(activeWalletId, final);
                  }}
                  onAddToPosition={(id, am, p, f, l, fund) => {
                    const u = trades.map(t => t.id === id ? { ...t, amount: t.amount + am, entryPrice: ((t.entryPrice * t.amount) + (p * am)) / (t.amount + am), fees: t.fees + f, fundingFees: t.fundingFees + (fund||0), leverage: l || t.leverage } : t);
                    setTrades(u); dataService.saveTrades(activeWalletId, u);
                  }}
                  onEditTrade={(id, data) => {
                    const u = trades.map(t => t.id === id ? { ...t, ...data } : t).map(t => t.id === id ? { ...t, ...calculatePnl(t) } : t);
                    setTrades(u); dataService.saveTrades(activeWalletId, u);
                  }}
                  onAddNote={(id, text) => {
                    const u = trades.map(t => t.id === id ? { ...t, notes: [...t.notes, { id: crypto.randomUUID(), text, date: new Date().toISOString() }] } : t);
                    setTrades(u); dataService.saveTrades(activeWalletId, u);
                  }}
                  onUpdateNote={(tId, nId, text) => {
                    const u = trades.map(t => t.id === tId ? { ...t, notes: t.notes.map(n => n.id === nId ? { ...n, text } : n) } : t);
                    setTrades(u); dataService.saveTrades(activeWalletId, u);
                  }}
                  onDeleteNote={(tId, nId) => {
                    const u = trades.map(t => t.id === tId ? { ...t, notes: t.notes.filter(n => n.id !== nId) } : t);
                    setTrades(u); dataService.saveTrades(activeWalletId, u);
                  }}
                  walletBalance={stats.currentBalance} accentColor="blue" icon="fa-bolt"
                />

                <TradeTable 
                  title="Trade History" trades={trades.filter(t => t.status === TradeStatus.CLOSED)} status={TradeStatus.CLOSED}
                  onDelete={(id) => { const u = trades.filter(t => t.id !== id); setTrades(u); dataService.saveTrades(activeWalletId, u); }}
                  onCloseTrade={()=>{}} onAddToPosition={()=>{}} onEditTrade={(id, data) => {
                    const u = trades.map(t => t.id === id ? { ...t, ...data } : t).map(t => t.id === id ? { ...t, ...calculatePnl(t) } : t);
                    setTrades(u); dataService.saveTrades(activeWalletId, u);
                  }}
                  onAddNote={(id, text) => {
                    const u = trades.map(t => t.id === id ? { ...t, notes: [...t.notes, { id: crypto.randomUUID(), text, date: new Date().toISOString() }] } : t);
                    setTrades(u); dataService.saveTrades(activeWalletId, u);
                  }}
                  onUpdateNote={(tId, nId, text) => {
                    const u = trades.map(t => t.id === tId ? { ...t, notes: t.notes.map(n => n.id === nId ? { ...n, text } : n) } : t);
                    setTrades(u); dataService.saveTrades(activeWalletId, u);
                  }}
                  onDeleteNote={(tId, nId) => {
                    const u = trades.map(t => t.id === tId ? { ...t, notes: t.notes.filter(n => n.id !== nId) } : t);
                    setTrades(u); dataService.saveTrades(activeWalletId, u);
                  }}
                  walletBalance={stats.currentBalance} accentColor="emerald" icon="fa-history"
                  onExport={handleExportBackup}
                />
                
                <Charts trades={trades} initialBalance={stats.initialBalance + (wallets.find(w => w.id === activeWalletId)?.balanceAdjustment || 0)} />
                <PnLCalendar trades={trades} portfolioEquity={stats.initialBalance} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default App;
