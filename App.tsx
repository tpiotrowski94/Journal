
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Trade, TradeType, TradeStatus, TradingStats, Wallet, AppState, NoteEntry } from './types';
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
import { dataService } from './services/dataService';

const App: React.FC = () => {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [activeWalletId, setActiveWalletId] = useState<string>('');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [formValues, setFormValues] = useState({ entry: 0, sl: 0 });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [appState, setAppState] = useState<AppState>({
    storageMode: 'local',
    isSynced: true,
    lastBackup: localStorage.getItem('last_backup_date')
  });

  // Załadowanie portfeli przy starcie
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
        name: 'Main Portfolio', 
        initialBalance: 1000, 
        balanceAdjustment: 0,
        mantra: "Gram cierpliwie, czekając na płynność i potwierdzenia. Ten portfel służy do systematycznego budowania kapitału.",
        pillars: [
          { title: "Zawsze SL", description: "Brak stop lossa = brak portfela", icon: "fa-check-double", color: "emerald" },
          { title: "Weekend Warning", description: "Niska dźwignia w soboty i niedziele", icon: "fa-calendar-minus", color: "amber" },
          { title: "A+ Only", description: "Tylko wybrane, czyste setupy", icon: "fa-brain", color: "blue" }
        ]
      };
      const initialWallets = [defaultWallet];
      setWallets(initialWallets);
      dataService.saveWallets(initialWallets);
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

  const calculatePnl = (trade: Partial<Trade>) => {
    const entry = Number(trade.entryPrice) || 0;
    const amount = Number(trade.amount) || 0;
    const exit = trade.exitPrice !== null ? Number(trade.exitPrice) : null;
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
  };

  const calculateInitialRisk = (trade: Partial<Trade>) => {
    const entry = Number(trade.entryPrice) || 0;
    const amount = Number(trade.amount) || 0;
    const leverage = Number(trade.leverage) || 1;
    const sl = trade.stopLoss !== null ? Number(trade.stopLoss) : null;

    if (entry === 0 || amount === 0) return 0;
    
    let risk = 0;
    if (sl && sl > 0) {
      risk = Math.abs(entry - sl) * amount;
    } else {
      risk = (entry * amount) / leverage;
    }
    return isFinite(risk) ? risk : 0;
  };

  const stats = useMemo<TradingStats>(() => {
    const closedTrades = trades.filter(t => t.status === TradeStatus.CLOSED);
    const totalPnl = closedTrades.reduce((sum, t) => sum + (Number(t.pnl) || 0), 0);
    const totalTradingFees = closedTrades.reduce((sum, t) => sum + (Number(t.fees) || 0), 0);
    const totalFundingFees = closedTrades.reduce((sum, t) => sum + (Number(t.fundingFees) || 0), 0);
    
    const totalTradeReturn = closedTrades.reduce((sum, t) => sum + (Number(t.pnlPercentage) || 0), 0);
    const wins = closedTrades.filter(t => (Number(t.pnl) || 0) > 0).length;
    
    const initialBalance = Number(activeWallet?.initialBalance) || 0;
    const adjustment = Number(activeWallet?.balanceAdjustment) || 0;
    
    const currentBalance = initialBalance + totalPnl + adjustment;
    
    return {
      initialBalance,
      currentBalance: isFinite(currentBalance) ? currentBalance : initialBalance,
      totalTrades: trades.length,
      openTrades: trades.filter(t => t.status === TradeStatus.OPEN).length,
      winRate: closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0,
      totalPnl: isFinite(totalPnl) ? totalPnl : 0,
      totalPnlPercentage: initialBalance !== 0 ? (totalPnl / initialBalance) * 100 : 0,
      totalTradeReturn: isFinite(totalTradeReturn) ? totalTradeReturn : 0,
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
    setWallets(prev => prev.map(w => w.id === activeWalletId ? { ...w, balanceAdjustment: newAdjustment } : w));
  };

  const handleUpdateInitialBalance = (newInitial: number) => {
    if (!activeWallet) return;
    setWallets(prev => prev.map(w => w.id === activeWalletId ? { ...w, initialBalance: newInitial } : w));
  };

  const handleUpdateWalletRules = (updatedWalletData: Partial<Wallet>) => {
    if (!activeWalletId) return;
    setWallets(prev => prev.map(w => w.id === activeWalletId ? { ...w, ...updatedWalletData } : w));
  };

  const handleAddTrade = (newTradeData: Omit<Trade, 'id' | 'pnl' | 'pnlPercentage' | 'initialRisk'>) => {
    const initialRisk = calculateInitialRisk(newTradeData as any);
    const { pnl, pnlPercentage } = calculatePnl(newTradeData as any);
    const trade: Trade = { 
      ...newTradeData, 
      id: crypto.randomUUID(), 
      pnl: Number(pnl) || 0, 
      pnlPercentage: Number(pnlPercentage) || 0, 
      initialRisk: Number(initialRisk) || 0 
    };
    setTrades([trade, ...trades]);
  };

  const handleCloseTrade = (id: string, exitPrice: number, exitFees: number, updatedNotes?: string, exitFundingFees: number = 0, customExitDate?: string, isTotalFees: boolean = false) => {
    setTrades(prev => prev.map(t => {
      if (t.id === id) {
        const finalFees = isTotalFees ? Number(exitFees) : (Number(t.fees) || 0) + (Number(exitFees) || 0);
        const finalFunding = isTotalFees ? Number(exitFundingFees) : (Number(t.fundingFees) || 0) + (Number(exitFundingFees) || 0);
        
        const newNotes = [...t.notes];
        if (updatedNotes?.trim()) {
           newNotes.push({ id: crypto.randomUUID(), text: `EXIT: ${updatedNotes}`, date: new Date().toISOString() });
        }
        
        const updated: Trade = { 
          ...t, 
          exitPrice: Number(exitPrice), 
          fees: finalFees, 
          fundingFees: finalFunding, 
          exitFees: isTotalFees ? undefined : Number(exitFees),
          exitFundingFees: isTotalFees ? undefined : Number(exitFundingFees),
          exitDate: customExitDate || new Date().toISOString(),
          status: TradeStatus.CLOSED, 
          notes: newNotes 
        };
        
        const { pnl, pnlPercentage } = calculatePnl(updated);
        return { 
          ...updated, 
          pnl: isFinite(pnl) ? pnl : 0, 
          pnlPercentage: isFinite(pnlPercentage) ? pnlPercentage : 0 
        };
      }
      return t;
    }));
  };

  const handleAddToPosition = (id: string, additionalAmount: number, additionalPrice: number, additionalFees: number, newLeverage?: number, additionalFundingFees: number = 0) => {
    setTrades(prev => prev.map(t => {
      if (t.id === id) {
        const currentAmount = Number(t.amount) || 0;
        const currentEntry = Number(t.entryPrice) || 0;
        const currentFees = Number(t.fees) || 0;
        const currentFunding = Number(t.fundingFees) || 0;
        const addAmount = Number(additionalAmount) || 0;
        const addPrice = Number(additionalPrice) || 0;
        const totalAmount = currentAmount + addAmount;
        const totalFees = currentFees + (Number(additionalFees) || 0);
        const totalFunding = currentFunding + (Number(additionalFundingFees) || 0);
        const newEntry = totalAmount !== 0 ? ((currentEntry * currentAmount) + (addPrice * addAmount)) / totalAmount : currentEntry;
        const leverage = newLeverage !== undefined ? Number(newLeverage) : (Number(t.leverage) || 1);
        const updatedPartial = { ...t, amount: totalAmount, entryPrice: newEntry, fees: totalFees, fundingFees: totalFunding, leverage };
        const initialRisk = calculateInitialRisk(updatedPartial);
        return { ...updatedPartial, initialRisk: isFinite(initialRisk) ? initialRisk : 0 };
      }
      return t;
    }));
  };

  const handleEditTrade = (id: string, updatedData: any) => {
    setTrades(prev => prev.map(t => {
      if (t.id === id) {
        const updated = { 
          ...t, 
          ...updatedData,
          entryPrice: Number(updatedData.entryPrice) || 0,
          exitPrice: updatedData.exitPrice !== undefined ? (updatedData.exitPrice === null ? null : Number(updatedData.exitPrice)) : t.exitPrice,
          amount: Number(updatedData.amount) || 0,
          fees: Number(updatedData.fees) || 0,
          fundingFees: Number(updatedData.fundingFees) || 0,
          leverage: Number(updatedData.leverage) || 1,
          stopLoss: updatedData.stopLoss ? Number(updatedData.stopLoss) : null
        };
        const initialRisk = calculateInitialRisk(updated);
        const { pnl, pnlPercentage } = calculatePnl(updated);
        return { ...updated, initialRisk: isFinite(initialRisk) ? initialRisk : 0, pnl: isFinite(pnl) ? pnl : 0, pnlPercentage: isFinite(pnlPercentage) ? pnlPercentage : 0 };
      }
      return t;
    }));
  };

  const handleUpdateNote = (tradeId: string, noteId: string, newText: string) => {
    setTrades(prev => prev.map(t => t.id === tradeId ? { ...t, notes: t.notes.map(n => n.id === noteId ? { ...n, text: newText } : n) } : t));
  };

  const handleDeleteNote = (tradeId: string, noteId: string) => {
    if (!confirm("Czy na pewno chcesz usunąć ten wpis?")) return;
    setTrades(prev => prev.map(t => t.id === tradeId ? { ...t, notes: t.notes.filter(n => n.id !== noteId) } : t));
  };

  const handleAddNote = (id: string, text: string) => {
    setTrades(prev => prev.map(t => t.id === id ? { ...t, notes: [...(Array.isArray(t.notes) ? t.notes : []), { id: crypto.randomUUID(), text, date: new Date().toISOString() }] } : t));
  };

  const handleDeleteTrade = (id: string) => {
    setTrades(prev => prev.filter(t => t.id !== id));
  };

  const handleAddWallet = () => {
    const name = prompt("Nazwa portfela:");
    if (!name) return;
    const balanceStr = prompt("Kapitał początkowy (USDT):", "1000");
    if (balanceStr === null) return;
    const balance = parseFloat(balanceStr) || 0;
    const newWallet: Wallet = { id: crypto.randomUUID(), name, initialBalance: balance, balanceAdjustment: 0 };
    setWallets([...wallets, newWallet]);
    setActiveWalletId(newWallet.id);
  };

  const handleDeleteWallet = (id: string) => {
    if (wallets.length <= 1) return alert("Musisz mieć przynajmniej jeden portfel.");
    if (confirm("Usunąć ten portfel wraz z całą historią?")) {
      const newWallets = wallets.filter(w => w.id !== id);
      setWallets(newWallets);
      localStorage.removeItem(`trades_${id}`);
      if (activeWalletId === id) setActiveWalletId(newWallets[0].id);
    }
  };

  const handleAiAnalysis = async () => {
    setIsAnalyzing(true);
    setAiAnalysis(await analyzeTrades(trades));
    setIsAnalyzing(false);
  };

  const handleExport = () => {
    const dataStr = JSON.stringify({ wallet: activeWallet, trades }, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `journal_${activeWallet?.name.toLowerCase().replace(/\s/g, '_')}.json`;
    link.click();
    const now = new Date().toLocaleString();
    localStorage.setItem('last_backup_date', now);
    setAppState(prev => ({ ...prev, lastBackup: now }));
  };

  const handleFullBackupExport = () => {
    const data = dataService.exportFullBackup();
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `full_trading_system_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    const now = new Date().toLocaleString();
    localStorage.setItem('last_backup_date', now);
    setAppState(prev => ({ ...prev, lastBackup: now }));
  };

  const handleFullImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (confirm("To zastąpi WSZYSTKIE aktualne portfele i dane. Kontynuować?")) {
          dataService.importFullBackup(json);
          window.location.reload(); 
        }
      } catch (err) { alert("Nieprawidłowy plik kopii zapasowej."); }
    };
    reader.readAsText(file);
  };

  const openTrades = useMemo(() => trades.filter(t => t.status === TradeStatus.OPEN), [trades]);
  const closedTrades = useMemo(() => trades.filter(t => t.status === TradeStatus.CLOSED), [trades]);

  return (
    <div className="min-h-screen pb-12 bg-[#0f172a] text-slate-200">
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 w-full max-w-md rounded-3xl p-8 shadow-2xl">
            <h3 className="text-xl font-black text-white mb-6 uppercase tracking-tighter flex items-center gap-3">
              <i className="fas fa-database text-blue-400"></i> Konfiguracja Systemu
            </h3>
            <div className="space-y-6">
              <div className="p-4 bg-slate-900 rounded-2xl border border-slate-700">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-black text-slate-500 uppercase">Tryb Przechowywania</span>
                  <span className="text-[10px] font-black bg-blue-500/10 text-blue-400 px-2 py-1 rounded-full uppercase">Local Storage</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">System działa w trybie offline. Twoje dane nigdy nie opuszczają tego urządzenia.</p>
              </div>
              <div className="pt-4 border-t border-slate-700 space-y-3">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Backup i Przywracanie</h4>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={handleFullBackupExport} className="bg-slate-900 border border-slate-700 hover:border-blue-500/50 text-white p-3 rounded-xl text-[10px] font-black uppercase transition-all flex flex-col items-center gap-2">
                    <i className="fas fa-cloud-download-alt text-blue-400 text-lg"></i> Eksportuj Wszystko
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="bg-slate-900 border border-slate-700 hover:border-emerald-500/50 text-white p-3 rounded-xl text-[10px] font-black uppercase transition-all flex flex-col items-center gap-2">
                    <i className="fas fa-upload text-emerald-400 text-lg"></i> Przywróć System
                  </button>
                  <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFullImport} />
                </div>
              </div>
              <div className="pt-4 border-t border-slate-700">
                <button onClick={() => setIsSettingsOpen(false)} className="w-full bg-blue-600 text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-blue-600/20">Zamknij</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <nav className="bg-[#0f172a]/80 backdrop-blur-xl border-b border-slate-800/50 sticky top-0 z-50">
        <div className="max-w-[1800px] mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <i className="fas fa-bolt-lightning text-emerald-500 text-xl"></i>
             <h1 className="text-lg font-black text-white tracking-tighter uppercase italic leading-tight">CryptoJournal <span className="text-emerald-500">Pro</span></h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSettingsOpen(true)} className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 flex items-center justify-center hover:bg-slate-700 transition-all active:scale-95">
              <i className="fas fa-cog text-sm"></i>
            </button>
          </div>
        </div>
      </nav>
      <main className="max-w-[1800px] mx-auto px-4 mt-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <WalletSwitcher wallets={wallets} activeWalletId={activeWalletId} onSelect={setActiveWalletId} onAdd={handleAddWallet} onDelete={handleDeleteWallet} />
          {appState.lastBackup && (
            <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-800/50 px-4 py-2 rounded-full border border-slate-700">
              Ostatni Backup: <span className="text-slate-300 ml-1">{appState.lastBackup}</span>
            </div>
          )}
        </div>

        {activeWallet ? (
          <>
            <TradingMantra 
              activeWallet={activeWallet} 
              onUpdateWallet={handleUpdateWalletRules} 
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
                    <button onClick={handleAiAnalysis} disabled={isAnalyzing} className="bg-purple-600 hover:bg-purple-500 text-white text-[10px] px-4 py-1.5 rounded-full font-black uppercase transition-all disabled:opacity-50">
                      {isAnalyzing ? '...' : 'Analizuj'}
                    </button>
                  </div>
                  <div className="text-xs text-slate-400 leading-relaxed italic min-h-[60px] relative z-10">
                    {aiAnalysis || "Kliknij 'Analizuj', aby otrzymać feedback psychologiczny od AI na podstawie Twojej aktywności."}
                  </div>
                </div>
              </div>
              <div className="lg:col-span-9 xl:col-span-9 space-y-12">
                <TradeTable 
                  title="Active Positions" 
                  trades={openTrades} 
                  status={TradeStatus.OPEN}
                  onDelete={handleDeleteTrade} 
                  onCloseTrade={handleCloseTrade} 
                  onAddToPosition={handleAddToPosition} 
                  onEditTrade={handleEditTrade} 
                  onAddNote={handleAddNote} 
                  onUpdateNote={handleUpdateNote} 
                  onDeleteNote={handleDeleteNote} 
                  walletBalance={stats.currentBalance} 
                  accentColor="emerald"
                  icon="fa-fire-alt"
                />
                <TradeTable 
                  title="Trade History" 
                  trades={closedTrades} 
                  status={TradeStatus.CLOSED}
                  onDelete={handleDeleteTrade} 
                  onCloseTrade={handleCloseTrade} 
                  onAddToPosition={handleAddToPosition} 
                  onEditTrade={handleEditTrade} 
                  onAddNote={handleAddNote} 
                  onUpdateNote={handleUpdateNote} 
                  onDeleteNote={handleDeleteNote} 
                  walletBalance={stats.currentBalance} 
                  onExport={handleExport}
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
             <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Inicjalizacja Portfela...</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
