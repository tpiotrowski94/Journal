
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Trade, TradeType, TradeStatus, TradingStats, SyncSettings } from './types';
import TradeForm from './components/TradeForm';
import TradeTable from './components/TradeTable';
import Dashboard from './components/Dashboard';
import Charts from './components/Charts';
import { analyzeTrades } from './services/geminiService';

const STORAGE_KEY = 'crypto_journal_trades';
const SETTINGS_KEY = 'crypto_journal_settings';

const App: React.FC = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [settings, setSettings] = useState<SyncSettings>({
    remoteUrl: '',
    apiKey: '',
    lastSynced: null,
    mode: 'local',
    initialBalance: 1000 // Default initial balance
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error' | 'success'>('idle');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load initial data
  useEffect(() => {
    const savedTrades = localStorage.getItem(STORAGE_KEY);
    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    
    if (savedTrades) setTrades(JSON.parse(savedTrades));
    if (savedSettings) setSettings(JSON.parse(savedSettings));
  }, []);

  // Persistent background save
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
    if (settings.mode === 'cloud' && settings.remoteUrl) {
      autoSyncToCloud();
    }
  }, [trades]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const autoSyncToCloud = async () => {
    if (!settings.remoteUrl) return;
    setSyncStatus('syncing');
    try {
      const response = await fetch(settings.remoteUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': settings.apiKey
        },
        body: JSON.stringify(trades)
      });
      if (response.ok) {
        setSyncStatus('success');
      } else {
        setSyncStatus('error');
      }
    } catch (e) {
      setSyncStatus('error');
    }
  };

  const calculatePnl = (trade: Omit<Trade, 'id' | 'pnl' | 'pnlPercentage'>) => {
    if (trade.status === TradeStatus.OPEN || trade.exitPrice === null) return { pnl: 0, pnlPercentage: 0 };
    
    const isLong = trade.type === TradeType.LONG;
    const pnl = isLong 
      ? (trade.exitPrice - trade.entryPrice) * trade.amount - trade.fees
      : (trade.entryPrice - trade.exitPrice) * trade.amount - trade.fees;
    
    const investedAmount = trade.entryPrice * trade.amount;
    const pnlPercentage = (pnl / investedAmount) * 100;

    return { pnl, pnlPercentage };
  };

  const stats = useMemo<TradingStats>(() => {
    const closedTrades = trades.filter(t => t.status === TradeStatus.CLOSED);
    const totalPnl = closedTrades.reduce((sum, t) => sum + t.pnl, 0);
    const wins = closedTrades.filter(t => t.pnl > 0).length;
    const pnlValues = closedTrades.map(t => t.pnl);

    const initialBalance = settings.initialBalance;
    const currentBalance = initialBalance + totalPnl;
    const totalPnlPercentage = ((currentBalance - initialBalance) / initialBalance) * 100;

    return {
      initialBalance,
      currentBalance,
      totalTrades: trades.length,
      openTrades: trades.filter(t => t.status === TradeStatus.OPEN).length,
      winRate: closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0,
      totalPnl,
      totalPnlPercentage,
      bestTrade: pnlValues.length > 0 ? Math.max(...pnlValues) : 0,
      worstTrade: pnlValues.length > 0 ? Math.min(...pnlValues) : 0
    };
  }, [trades, settings.initialBalance]);

  const handleAddTrade = (newTradeData: Omit<Trade, 'id' | 'pnl' | 'pnlPercentage'>) => {
    const { pnl, pnlPercentage } = calculatePnl(newTradeData);
    const trade: Trade = { ...newTradeData, id: crypto.randomUUID(), pnl, pnlPercentage };
    setTrades([trade, ...trades]);
  };

  const handleCloseTrade = (id: string, exitPrice: number) => {
    setTrades(prev => prev.map(t => {
      if (t.id === id) {
        const updated = { ...t, exitPrice, status: TradeStatus.CLOSED };
        const { pnl, pnlPercentage } = calculatePnl(updated);
        return { ...updated, pnl, pnlPercentage };
      }
      return t;
    }));
  };

  const handleDeleteTrade = (id: string) => {
    if (confirm('Usunąć tę pozycję z historii?')) {
      setTrades(trades.filter(t => t.id !== id));
    }
  };

  const handleAiAnalysis = async () => {
    if (trades.length < 3) {
      alert("Dodaj przynajmniej 3 transakcje dla analizy.");
      return;
    }
    setIsAnalyzing(true);
    const result = await analyzeTrades(trades);
    setAiAnalysis(result);
    setIsAnalyzing(false);
  };

  return (
    <div className="min-h-screen pb-12 bg-[#0f172a] text-slate-200">
      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 w-full max-w-md rounded-3xl p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Terminal Config</h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">Kapitał Początkowy (USDT)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                  <input 
                    type="number" 
                    className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 pl-8 text-white text-lg font-black outline-none focus:ring-2 focus:ring-emerald-500"
                    value={settings.initialBalance}
                    onChange={e => setSettings({...settings, initialBalance: parseFloat(e.target.value) || 0})}
                  />
                </div>
              </div>

              <div className="h-px bg-slate-700/50 my-2"></div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">Metoda Synchronizacji</label>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setSettings({...settings, mode: 'local'})}
                    className={`py-3 rounded-xl text-xs font-black border transition-all uppercase tracking-widest ${settings.mode === 'local' ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-900/40' : 'bg-slate-900 border-slate-700 text-slate-500'}`}
                  >
                    Local Browser
                  </button>
                  <button 
                    onClick={() => setSettings({...settings, mode: 'cloud'})}
                    className={`py-3 rounded-xl text-xs font-black border transition-all uppercase tracking-widest ${settings.mode === 'cloud' ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/40' : 'bg-slate-900 border-slate-700 text-slate-500'}`}
                  >
                    Cloud Sync
                  </button>
                </div>
              </div>
              
              {settings.mode === 'cloud' && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                  <input 
                    type="text" 
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-xs"
                    value={settings.remoteUrl}
                    onChange={e => setSettings({...settings, remoteUrl: e.target.value})}
                    placeholder="API Endpoint URL"
                  />
                  <input 
                    type="password" 
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-xs"
                    value={settings.apiKey}
                    onChange={e => setSettings({...settings, apiKey: e.target.value})}
                    placeholder="Master Key"
                  />
                </div>
              )}
              
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="w-full bg-white text-black py-4 rounded-2xl font-black transition-all mt-4 uppercase tracking-widest text-sm hover:bg-slate-200"
              >
                Zastosuj Zmiany
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <nav className="bg-[#0f172a]/80 backdrop-blur-xl border-b border-slate-800/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl flex items-center justify-center shadow-2xl shadow-emerald-500/20 rotate-3">
              <i className="fas fa-bolt-lightning text-white text-2xl"></i>
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tighter uppercase italic leading-tight">CryptoJournal <span className="text-emerald-500">Pro</span></h1>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Alpha Terminal v2.0</span>
                <div className={`h-1.5 w-1.5 rounded-full ${syncStatus === 'success' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></div>
              </div>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-all flex items-center justify-center"
            >
              <i className="fas fa-sliders text-sm"></i>
            </button>
             <button 
              onClick={() => {
                const data = JSON.stringify({ settings, trades }, null, 2);
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `journal-data-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
              }}
              className="hidden sm:flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-5 py-2 rounded-xl text-xs font-black transition-all border border-slate-700 uppercase tracking-widest"
            >
              <i className="fas fa-download"></i> Backup
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 mt-8">
        <Dashboard stats={stats} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-4 space-y-8">
            <TradeForm onAddTrade={handleAddTrade} />
            
            <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 via-transparent to-transparent pointer-events-none"></div>
              <div className="flex justify-between items-center mb-6 relative z-10">
                <h2 className="text-lg font-black text-white flex items-center gap-3 uppercase italic tracking-tight">
                  <i className="fas fa-brain text-purple-400"></i> AI Intelligence
                </h2>
                <button 
                  onClick={handleAiAnalysis}
                  disabled={isAnalyzing}
                  className="bg-purple-600 hover:bg-purple-500 text-white text-[10px] px-4 py-2 rounded-xl disabled:opacity-50 transition-all font-black uppercase tracking-widest shadow-xl shadow-purple-900/40"
                >
                  {isAnalyzing ? <i className="fas fa-spinner fa-spin mr-2"></i> : null}
                  Analyze
                </button>
              </div>
              
              <div className="min-h-[140px] text-slate-400 text-xs leading-relaxed relative z-10 font-medium italic">
                {aiAnalysis ? (
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-700 text-slate-300">
                    {aiAnalysis}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-28 text-slate-600 text-center">
                    <i className="fas fa-microchip mb-3 text-3xl opacity-20"></i>
                    <p className="uppercase tracking-widest text-[10px] font-black">Waiting for data input</p>
                    <p className="mt-1">Add 3+ trades for strategic feedback</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-8 space-y-8">
            <Charts trades={trades} />
            <TradeTable 
              trades={trades} 
              onDelete={handleDeleteTrade} 
              onCloseTrade={handleCloseTrade}
            />
          </div>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto px-4 mt-16 pb-8 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">© {new Date().getFullYear()} CRYPTO JOURNAL PRO // TERMINAL SYSTEM</p>
          <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">End-to-End Local Encryption Enabled</p>
        </div>
        <div className="flex gap-8">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50 animate-pulse"></div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Storage: Persistence Mode</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Memory: Buffer Ready</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
