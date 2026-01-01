
import React, { useState, useEffect, useMemo } from 'react';
import { Trade, TradeType, TradeStatus, TradingStats, SyncSettings } from './types';
import TradeForm from './components/TradeForm';
import TradeTable from './components/TradeTable';
import Dashboard from './components/Dashboard';
import Charts from './components/Charts';
import RiskCalculator from './components/RiskCalculator';
import { analyzeTrades } from './services/geminiService';

const STORAGE_KEY = 'crypto_journal_trades';
const SETTINGS_KEY = 'crypto_journal_settings';

const App: React.FC = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [formValues, setFormValues] = useState({ entry: 0, sl: 0 });
  const [settings, setSettings] = useState<SyncSettings>({
    remoteUrl: '',
    apiKey: '',
    lastSynced: null,
    mode: 'local',
    initialBalance: 1000
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    const savedTrades = localStorage.getItem(STORAGE_KEY);
    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    if (savedTrades) setTrades(JSON.parse(savedTrades));
    if (savedSettings) setSettings(JSON.parse(savedSettings));
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
  }, [trades]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const calculatePnl = (trade: Partial<Trade>) => {
    if (!trade.entryPrice || !trade.amount || trade.exitPrice === null) return { pnl: 0, pnlPercentage: 0 };
    const isLong = trade.type === TradeType.LONG;
    const pnl = isLong 
      ? (trade.exitPrice - trade.entryPrice) * trade.amount - (trade.fees || 0)
      : (trade.entryPrice - trade.exitPrice) * trade.amount - (trade.fees || 0);
    const pnlPercentage = (pnl / (trade.entryPrice * trade.amount)) * 100;
    return { pnl, pnlPercentage };
  };

  const calculateInitialRisk = (trade: Partial<Trade>) => {
    if (!trade.entryPrice || !trade.stopLoss || !trade.amount) return null;
    return Math.abs(trade.entryPrice - trade.stopLoss) * trade.amount;
  };

  const stats = useMemo<TradingStats>(() => {
    const closedTrades = trades.filter(t => t.status === TradeStatus.CLOSED);
    const totalPnl = closedTrades.reduce((sum, t) => sum + t.pnl, 0);
    const wins = closedTrades.filter(t => t.pnl > 0).length;
    const currentBalance = settings.initialBalance + totalPnl;
    return {
      initialBalance: settings.initialBalance,
      currentBalance,
      totalTrades: trades.length,
      openTrades: trades.filter(t => t.status === TradeStatus.OPEN).length,
      winRate: closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0,
      totalPnl,
      totalPnlPercentage: ((currentBalance - settings.initialBalance) / settings.initialBalance) * 100,
      bestTrade: closedTrades.length > 0 ? Math.max(...closedTrades.map(t => t.pnl)) : 0,
      worstTrade: closedTrades.length > 0 ? Math.min(...closedTrades.map(t => t.pnl)) : 0
    };
  }, [trades, settings.initialBalance]);

  const handleAddTrade = (newTradeData: Omit<Trade, 'id' | 'pnl' | 'pnlPercentage' | 'initialRisk'>) => {
    const { pnl, pnlPercentage } = calculatePnl(newTradeData as any);
    const initialRisk = calculateInitialRisk(newTradeData as any);
    const trade: Trade = { ...newTradeData, id: crypto.randomUUID(), pnl, pnlPercentage, initialRisk };
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

  const handleAddToPosition = (id: string, additionalAmount: number, additionalPrice: number) => {
    setTrades(prev => prev.map(t => {
      if (t.id === id) {
        const totalAmount = t.amount + additionalAmount;
        const newEntry = ((t.entryPrice * t.amount) + (additionalPrice * additionalAmount)) / totalAmount;
        const initialRisk = calculateInitialRisk({ ...t, entryPrice: newEntry, amount: totalAmount });
        return { ...t, amount: totalAmount, entryPrice: newEntry, initialRisk };
      }
      return t;
    }));
  };

  const handleDeleteTrade = (id: string) => {
    if (confirm('Delete this trade?')) {
      setTrades(trades.filter(t => t.id !== id));
    }
  };

  const handleAiAnalysis = async () => {
    setIsAnalyzing(true);
    setAiAnalysis(await analyzeTrades(trades));
    setIsAnalyzing(false);
  };

  return (
    <div className="min-h-screen pb-12 bg-[#0f172a] text-slate-200">
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 w-full max-w-md rounded-3xl p-8 shadow-2xl">
            <h3 className="text-xl font-black text-white mb-6 uppercase">Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase">Initial Capital</label>
                <input 
                  type="number" 
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white font-bold outline-none"
                  value={settings.initialBalance}
                  onChange={e => setSettings({...settings, initialBalance: parseFloat(e.target.value) || 0})}
                />
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="w-full bg-white text-black py-3 rounded-xl font-black uppercase">Save</button>
            </div>
          </div>
        </div>
      )}

      <nav className="bg-[#0f172a]/80 backdrop-blur-xl border-b border-slate-800/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <i className="fas fa-bolt-lightning text-emerald-500 text-xl"></i>
             <h1 className="text-lg font-black text-white tracking-tighter uppercase italic leading-tight">CryptoJournal <span className="text-emerald-500">Pro</span></h1>
          </div>
          <button onClick={() => setIsSettingsOpen(true)} className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 flex items-center justify-center hover:bg-slate-700 transition-colors">
            <i className="fas fa-gear text-sm"></i>
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 mt-8">
        <Dashboard stats={stats} />
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-6">
            <TradeForm onAddTrade={handleAddTrade} onFormUpdate={setFormValues} />
            <RiskCalculator balance={stats.currentBalance} externalData={formValues} />
            <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-2xl relative overflow-hidden">
               <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-black text-white uppercase italic tracking-tight"><i className="fas fa-brain text-purple-400 mr-2"></i> Performance AI</h2>
                <button onClick={handleAiAnalysis} disabled={isAnalyzing} className="bg-purple-600 hover:bg-purple-500 text-white text-[10px] px-4 py-1.5 rounded-full font-black uppercase transition-all">
                  {isAnalyzing ? 'Analyzing...' : 'Refresh AI'}
                </button>
              </div>
              <div className="text-xs text-slate-400 leading-relaxed italic min-h-[60px]">
                {aiAnalysis || "Click refresh for AI trading psychology insights."}
              </div>
            </div>
          </div>
          
          <div className="lg:col-span-8 space-y-8">
            <TradeTable 
              trades={trades} 
              onDelete={handleDeleteTrade} 
              onCloseTrade={handleCloseTrade} 
              onAddToPosition={handleAddToPosition}
            />
            <Charts trades={trades} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
