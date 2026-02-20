
import React, { useState, useEffect, useRef } from 'react';
import { TradeType, TradeStatus, SyncProvider, Trade } from './types';
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
import { calculatePnl } from './utils/tradeCalculations';
import { mergeTrades } from './utils/tradeMerge';
import { useWalletManager } from './hooks/useWalletManager';
import { useTradeManager } from './hooks/useTradeManager';

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
  const [formValues, setFormValues] = useState({ entry: 0, sl: 0 });
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    wallets, activeWalletId, activeWallet,
    updateWallet, addWallet, deleteWallet, setActiveWalletId,
    addTransfer, deleteTransfer
  } = useWalletManager();

  const {
    trades, setTrades, saveTrades,
    addTrade, updateTrade, deleteTrade, stats
  } = useTradeManager(activeWalletId, wallets);

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

  // Fix for Stale Async Closure: Track activeWalletId in a Ref
  const activeWalletIdRef = useRef(activeWalletId);
  useEffect(() => {
    activeWalletIdRef.current = activeWalletId;
  }, [activeWalletId]);

  // Fix for "Edit Race Condition":
  // If user edits a trade (Note/Confidence) while Sync is in progress (awaiting API),
  // the closure would remember the OLD trades and overwrite the user's edit with the sync result.
  // We must access the LATEST trades state at the moment of MERGE.
  const tradesRef = useRef(trades);
  useEffect(() => {
    tradesRef.current = trades;
  }, [trades]);

  const handleSyncWallet = async (isAuto: boolean = false) => {
    // Capture the wallet ID at the start of the operation
    const currentSyncWalletId = activeWallet?.id;

    if (!activeWallet?.address || activeWallet.provider === SyncProvider.MANUAL || isSyncing) return;

    // Safety check: if no wallet is selected or ID is missing
    if (!currentSyncWalletId) return;

    if (!isAuto) setIsSyncing(true);

    try {
      const syncResult = await syncHyperliquidData(activeWallet.address, activeWallet.historyStartDate);

      // CRITICAL CHECK: Before applying any state changes, ensure we are still on the same wallet!
      if (activeWalletIdRef.current !== currentSyncWalletId) {
        console.warn(`Sync aborted: User switched from ${currentSyncWalletId} to ${activeWalletIdRef.current}`);
        return; // Abort: The user switched wallets while we were fetching
      }


      // Update Balance Logic
      // CurrentValue = Initial + PnL + Adjustment
      // We want to update Initial/Adjustment so that Stats.CurrentValue matches AccountValue

      const visibleTotalPnl = stats.totalPnl;
      // Note: stats.totalPnl might be slightly stale if calculated in memo, 
      // but mergeTrades is about to update trades.
      // Ideally we would calc PnL after merge. 
      // Simplified: We accept slight diff or do it after state update (useEffect).
      // For now, let's keep it simple: strict sync of trades first.

      let historyCutoff = 0;
      if (activeWallet.historyStartDate) {
        const parsed = new Date(activeWallet.historyStartDate).getTime();
        if (!isNaN(parsed) && parsed > 0 && parsed < (Date.now() + 86400000)) {
          historyCutoff = parsed;
        }
      }

      // Merge Logic (The Fix using Ref for latest state)
      // Use tradesRef.current instead of 'trades' to include any edits made during the await
      const mergedTrades = mergeTrades(tradesRef.current, syncResult, activeWallet.address, historyCutoff);
      saveTrades(mergedTrades);

      // We need to re-calculate PnL sum for balance reconciliation immediately
      const closedPnl = mergedTrades
        .filter(t => t.status === TradeStatus.CLOSED)
        .reduce((sum, t) => sum + (t.pnl || 0), 0);

      // Reconciliation
      const accountValue = syncResult.accountValue;

      // Net transfers: deposits and withdrawals shift the capital base
      const walletTransfers = activeWallet.transfers || [];
      const netTransfers = walletTransfers.reduce((sum: number, t: { type: string; amount: number }) =>
        t.type === 'DEPOSIT' ? sum + t.amount : sum - t.amount, 0
      );

      if (accountValue >= 0) {
        let newInitial = activeWallet.initialBalance;
        let newAdjustment = activeWallet.balanceAdjustment;

        if (activeWallet.initialBalance <= 0) {
          newInitial = accountValue - closedPnl - netTransfers;
          newAdjustment = 0;
        } else {
          newAdjustment = accountValue - activeWallet.initialBalance - closedPnl - netTransfers;
        }

        if (Math.abs(activeWallet.initialBalance - newInitial) > 0.01 ||
          Math.abs(activeWallet.balanceAdjustment - newAdjustment) > 0.01) {

          updateWallet(activeWalletId, {
            initialBalance: newInitial,
            balanceAdjustment: newAdjustment,
            lastSyncAt: new Date().toISOString()
          });
        }
      }

      // Merge HL-detected transfers (deposits/withdrawals) into wallet
      // Deduplication: skip any that already exist by id
      if (syncResult.detectedTransfers && syncResult.detectedTransfers.length > 0) {
        const existingIds = new Set((activeWallet.transfers || []).map(t => t.id));
        const newTransfers = syncResult.detectedTransfers.filter(t => !existingIds.has(t.id));
        if (newTransfers.length > 0) {
          newTransfers.forEach(t => addTransfer(activeWalletId, t));
          console.log(`[HL Sync] Auto-imported ${newTransfers.length} transfer(s)`);
        }
      }

    } catch (error) {
      console.error("Sync error:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  const autoSyncEnabled = activeWallet?.autoSync && activeWallet?.provider === SyncProvider.HYPERLIQUID;

  // Fix for Stale Closure in Interval: Always point to the latest version of the function
  const handleSyncWalletRef = useRef(handleSyncWallet);
  useEffect(() => {
    handleSyncWalletRef.current = handleSyncWallet;
  }); // Updates on every render

  useEffect(() => {
    if (!autoSyncEnabled) return;

    // Initial call
    handleSyncWalletRef.current(true);

    const timer = setInterval(() => {
      // Always call the latest version
      handleSyncWalletRef.current(true);
    }, 5000);

    return () => clearInterval(timer);
  }, [autoSyncEnabled, activeWalletId]);

  const handleExportBackup = () => {
    // Re-use logic or move to utils
    // Using simple inline for now as it relies on simple JSON stringify
    const data = { wallets, trades }; // Simple dump
    // Or call dataService if exposed
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

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-300 font-sans">
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
              <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-[10px] font-black uppercase text-slate-400 flex items-center gap-2 transition-all hover:bg-slate-700 hover:text-white"><i className="fas fa-file-import"></i> Import</button>
              <button onClick={handleExportBackup} className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-[10px] font-black uppercase text-slate-400 flex items-center gap-2 transition-all hover:bg-slate-700 hover:text-white"><i className="fas fa-file-export"></i> Backup</button>
              <div className="h-6 w-px bg-slate-800 mx-1 hidden md:block"></div>
              <button onClick={async () => { setIsAnalyzing(true); try { const res = await analyzeTrades(trades); setAiAnalysis(res); } finally { setIsAnalyzing(false); } }} disabled={isAnalyzing} className="px-5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-[10px] font-black uppercase text-blue-400 flex items-center gap-2 transition-all hover:bg-slate-700"><i className={`fas ${isAnalyzing ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}`}></i> AI Analysis</button>
              <button onClick={() => handleSyncWallet()} disabled={isSyncing} className="px-5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-[10px] font-black uppercase text-emerald-400 flex items-center gap-2 transition-all hover:bg-slate-700"><i className={`fas ${isSyncing ? 'fa-sync fa-spin' : 'fa-rotate'}`}></i> {autoSyncEnabled ? 'Auto-Sync Active (5s)' : 'Sync Wallet'}</button>
            </div>
          </div>

          <div className="border-b border-slate-800/50 pb-6">
            <WalletSwitcher
              wallets={wallets} activeWalletId={activeWalletId}
              onSelect={(id) => { setActiveWalletId(id); setAiAnalysis(null); }}
              onAdd={() => addWallet({ id: crypto.randomUUID(), name: 'New Portfolio', provider: SyncProvider.MANUAL, initialBalance: 0, balanceAdjustment: 0 })}
              onDelete={deleteWallet}
              onUpdateWallet={updateWallet} // Fixed prop name to match component interface if needed, but assuming WalletSwitcher takes (id, data) or wrapper
            />
          </div>
        </header>

        {activeWallet && (
          <>
            <TradingMantra activeWallet={activeWallet} onUpdateWallet={(data) => updateWallet(activeWalletId, data)} />
            <Dashboard
              stats={stats}
              transfers={activeWallet.transfers || []}
              onAdjustBalance={(val) => {
                const netTransfers = (activeWallet.transfers || []).reduce((sum, t) =>
                  t.type === 'DEPOSIT' ? sum + t.amount : sum - t.amount, 0);
                const needed = val - (activeWallet.initialBalance + stats.totalPnl + netTransfers);
                updateWallet(activeWalletId, { balanceAdjustment: needed });
              }}
              onUpdateInitialBalance={(val) => updateWallet(activeWalletId, { initialBalance: val })}
              onAddTransfer={(t) => addTransfer(activeWalletId, t)}
              onDeleteTransfer={(id) => deleteTransfer(activeWalletId, id)}
              isLive={activeWallet.provider !== SyncProvider.MANUAL}
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
                <TradeForm onAddTrade={addTrade} onFormUpdate={setFormValues} />
                <RiskCalculator balance={stats.currentBalance} externalData={formValues} />
                <DcaCalculator />
              </div>

              <div className="lg:col-span-8 space-y-8">
                <TradeTable
                  title="Active Positions" trades={trades.filter(t => t.status === TradeStatus.OPEN)} status={TradeStatus.OPEN}
                  onDelete={deleteTrade}
                  onCloseTrade={(id, p, f, n, fund, d) => {
                    const trade = trades.find(t => t.id === id);
                    if (trade) updateTrade(id, {
                      exitPrice: p, fees: trade.fees + f, fundingFees: trade.fundingFees + (fund || 0),
                      exitDate: d, status: TradeStatus.CLOSED,
                      notes: n ? [...trade.notes, { id: crypto.randomUUID(), text: n, date: new Date().toISOString() }] : trade.notes
                    });
                  }}
                  onAddToPosition={(id, am, p, f, l, fund) => {
                    const trade = trades.find(t => t.id === id);
                    if (trade) updateTrade(id, {
                      amount: trade.amount + am,
                      entryPrice: ((trade.entryPrice * trade.amount) + (p * am)) / (trade.amount + am),
                      fees: trade.fees + f, fundingFees: trade.fundingFees + (fund || 0),
                      leverage: l || trade.leverage
                    });
                  }}
                  onEditTrade={(id, data) => updateTrade(id, data)}
                  onAddNote={(id, text) => {
                    const trade = trades.find(t => t.id === id);
                    if (trade) updateTrade(id, { notes: [...trade.notes, { id: crypto.randomUUID(), text, date: new Date().toISOString() }] });
                  }}
                  onUpdateNote={(tId, nId, text) => {
                    const trade = trades.find(t => t.id === tId);
                    if (trade) updateTrade(tId, { notes: trade.notes.map(n => n.id === nId ? { ...n, text } : n) });
                  }}
                  onDeleteNote={(tId, nId) => {
                    const trade = trades.find(t => t.id === tId);
                    if (trade) updateTrade(tId, { notes: trade.notes.filter(n => n.id !== nId) });
                  }}
                  walletBalance={stats.currentBalance} accentColor="blue" icon="fa-bolt"
                />

                <TradeTable
                  title="Trade History" trades={trades.filter(t => t.status === TradeStatus.CLOSED)} status={TradeStatus.CLOSED}
                  onDelete={deleteTrade}
                  onCloseTrade={() => { }} onAddToPosition={() => { }}
                  onEditTrade={(id, data) => updateTrade(id, data)}
                  onAddNote={(id, text) => {
                    const trade = trades.find(t => t.id === id);
                    if (trade) updateTrade(id, { notes: [...trade.notes, { id: crypto.randomUUID(), text, date: new Date().toISOString() }] });
                  }}
                  onUpdateNote={(tId, nId, text) => {
                    const trade = trades.find(t => t.id === tId);
                    if (trade) updateTrade(tId, { notes: trade.notes.map(n => n.id === nId ? { ...n, text } : n) });
                  }}
                  onDeleteNote={(tId, nId) => {
                    const trade = trades.find(t => t.id === tId);
                    if (trade) updateTrade(tId, { notes: trade.notes.filter(n => n.id !== nId) });
                  }}
                  walletBalance={stats.currentBalance} accentColor="emerald" icon="fa-history"
                  onExport={handleExportBackup}
                />

                <Charts trades={trades} initialBalance={stats.initialBalance + (activeWallet.balanceAdjustment || 0)} transfers={activeWallet.transfers || []} />

                <PnLCalendar trades={trades} portfolioEquity={stats.currentBalance} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default App;
