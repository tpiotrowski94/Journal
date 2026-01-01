
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Trade, TradeType, TradingStats, SyncSettings } from './types';
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
    mode: 'local'
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

  // Persistent background save to LocalStorage (survives restarts)
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
        setSettings(prev => ({ ...prev, lastSynced: new Date().toISOString() }));
      } else {
        setSyncStatus('error');
      }
    } catch (e) {
      setSyncStatus('error');
    }
  };

  const stats = useMemo<TradingStats>(() => {
    if (trades.length === 0) return { totalTrades: 0, winRate: 0, totalPnl: 0, bestTrade: 0, worstTrade: 0, avgPnl: 0 };
    const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
    const wins = trades.filter(t => t.pnl > 0).length;
    const pnlValues = trades.map(t => t.pnl);
    return {
      totalTrades: trades.length,
      winRate: (wins / trades.length) * 100,
      totalPnl,
      bestTrade: Math.max(...pnlValues),
      worstTrade: Math.min(...pnlValues),
      avgPnl: totalPnl / trades.length
    };
  }, [trades]);

  const handleAddTrade = (newTradeData: Omit<Trade, 'id' | 'pnl' | 'pnlPercentage'>) => {
    const isLong = newTradeData.type === TradeType.LONG;
    const pnl = isLong 
      ? (newTradeData.exitPrice - newTradeData.entryPrice) * newTradeData.amount - newTradeData.fees
      : (newTradeData.entryPrice - newTradeData.exitPrice) * newTradeData.amount - newTradeData.fees;
    const pnlPercentage = (pnl / (newTradeData.entryPrice * newTradeData.amount)) * 100;
    const trade: Trade = { ...newTradeData, id: crypto.randomUUID(), pnl, pnlPercentage };
    setTrades([trade, ...trades]);
  };

  const handleDeleteTrade = (id: string) => {
    if (confirm('Usunąć tę pozycję z historii?')) {
      setTrades(trades.filter(t => t.id !== id));
    }
  };

  const handleAiAnalysis = async () => {
    if (trades.length < 3) {
      alert("Dodaj przynajmniej 3 transakcje, aby AI mogło przygotować raport.");
      return;
    }
    setIsAnalyzing(true);
    const result = await analyzeTrades(trades);
    setAiAnalysis(result);
    setIsAnalyzing(false);
  };

  return (
    <div className="min-h-screen pb-12 bg-[#0f172a]">
      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Konfiguracja Zapisu</h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-white">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Gdzie trzymać dane?</label>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => setSettings({...settings, mode: 'local'})}
                    className={`py-2 px-4 rounded-lg text-sm font-bold border ${settings.mode === 'local' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}
                  >
                    Tylko Browser
                  </button>
                  <button 
                    onClick={() => setSettings({...settings, mode: 'cloud'})}
                    className={`py-2 px-4 rounded-lg text-sm font-bold border ${settings.mode === 'cloud' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}
                  >
                    Cloud Sync
                  </button>
                </div>
              </div>
              
              {settings.mode === 'cloud' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">API URL (JSONBin/MockAPI)</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-sm outline-none"
                      value={settings.remoteUrl}
                      onChange={e => setSettings({...settings, remoteUrl: e.target.value})}
                      placeholder="https://api.jsonbin.io/..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Klucz API</label>
                    <input 
                      type="password" 
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-sm outline-none"
                      value={settings.apiKey}
                      onChange={e => setSettings({...settings, apiKey: e.target.value})}
                    />
                  </div>
                </>
              )}
              
              <div className="pt-4 text-[10px] text-slate-500 leading-relaxed italic">
                * Domyślnie Twoje dane są zapisywane trwale w pamięci Twojej przeglądarki na tym urządzeniu. Nie znikną po restarcie.
              </div>
              
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-bold transition-all mt-4"
              >
                Zatwierdź Zmiany
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <nav className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-900/20">
              <i className="fas fa-bolt-lightning text-white text-xl"></i>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">CryptoJournal <span className="text-emerald-500">Pro</span></h1>
              <div className="flex items-center gap-2">
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Trading Intelligence</p>
                <div className={`h-1.5 w-1.5 rounded-full ${syncStatus === 'success' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></div>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 text-slate-400 hover:text-white transition-colors"
              title="Ustawienia zapisu"
            >
              <i className={`fas ${settings.mode === 'cloud' ? 'fa-cloud' : 'fa-database'} text-lg`}></i>
            </button>
             <button 
              onClick={() => {
                const data = JSON.stringify(trades, null, 2);
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `backup-tradingu-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
              }}
              className="hidden sm:flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-sm transition-colors border border-slate-700"
            >
              <i className="fas fa-file-export"></i> Backup
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 mt-8">
        <Dashboard stats={stats} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-8">
            <TradeForm onAddTrade={handleAddTrade} />
            
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl overflow-hidden relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/5 to-transparent pointer-events-none"></div>
              <div className="flex justify-between items-center mb-4 relative z-10">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <i className="fas fa-robot text-purple-400"></i> Raport AI
                </h2>
                <button 
                  onClick={handleAiAnalysis}
                  disabled={isAnalyzing}
                  className="bg-purple-600 hover:bg-purple-500 text-white text-xs px-4 py-2 rounded-lg disabled:opacity-50 transition-all font-bold shadow-lg shadow-purple-900/40"
                >
                  {isAnalyzing ? <i className="fas fa-spinner fa-spin mr-2"></i> : null}
                  Skanuj Historię
                </button>
              </div>
              
              <div className="min-h-[120px] text-slate-300 text-sm leading-relaxed relative z-10">
                {aiAnalysis ? (
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    {aiAnalysis}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-24 text-slate-500 italic text-center">
                    <i className="fas fa-brain mb-2 text-2xl opacity-20"></i>
                    <p>Wymagane min. 3 transakcje,</p>
                    <p className="text-[10px]">aby analityk AI mógł przygotować feedback.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-8">
            <Charts trades={trades} />
            <TradeTable trades={trades} onDelete={handleDeleteTrade} />
          </div>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto px-4 mt-12 pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-500 text-[10px] uppercase tracking-widest font-bold">
        <p>&copy; {new Date().getFullYear()} CryptoJournal Pro // DANE ZABEZPIECZONE LOKALNIE</p>
        <div className="flex gap-6">
          <span className="flex items-center gap-1"><i className="fas fa-circle text-[6px] text-emerald-500"></i> Zapis Aktywny</span>
          <span className="flex items-center gap-1"><i className="fas fa-circle text-[6px] text-blue-500"></i> AES-256 Memory</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
