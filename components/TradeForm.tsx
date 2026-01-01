
import React, { useState } from 'react';
import { Trade, TradeType, TradeStatus } from '../types';

interface TradeFormProps {
  onAddTrade: (trade: Omit<Trade, 'id' | 'pnl' | 'pnlPercentage'>) => void;
}

const TradeForm: React.FC<TradeFormProps> = ({ onAddTrade }) => {
  const [isOpenPosition, setIsOpenPosition] = useState(false);
  const [formData, setFormData] = useState({
    symbol: 'BTC/USDT',
    type: TradeType.LONG,
    entryPrice: '',
    exitPrice: '',
    amount: '',
    fees: '0',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.symbol || !formData.entryPrice || !formData.amount) return;
    if (!isOpenPosition && !formData.exitPrice) return;

    let symbol = formData.symbol.toUpperCase();
    if (!symbol.includes('/')) symbol += '/USDT';

    onAddTrade({
      symbol,
      type: formData.type,
      status: isOpenPosition ? TradeStatus.OPEN : TradeStatus.CLOSED,
      entryPrice: parseFloat(formData.entryPrice),
      exitPrice: isOpenPosition ? null : parseFloat(formData.exitPrice),
      amount: parseFloat(formData.amount),
      fees: parseFloat(formData.fees) || 0,
      date: formData.date,
      notes: formData.notes
    });

    setFormData({
      ...formData,
      entryPrice: '',
      exitPrice: '',
      amount: '',
      notes: ''
    });
  };

  return (
    <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <i className="fas fa-bitcoin-sign text-6xl text-emerald-500"></i>
      </div>
      
      <h2 className="text-xl font-black mb-6 text-white flex items-center gap-2 relative z-10">
        <i className="fas fa-plus-circle text-emerald-500"></i> OTWÓRZ POZYCJĘ
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase tracking-widest">Para walutowa</label>
            <div className="flex gap-2 mb-2">
              {['BTC/USDT', 'ETH/USDT'].map(pair => (
                <button 
                  key={pair}
                  type="button"
                  onClick={() => setFormData({...formData, symbol: pair})}
                  className={`text-[10px] px-3 py-1 rounded-full border transition-all ${formData.symbol === pair ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}
                >
                  {pair}
                </button>
              ))}
            </div>
            <input
              type="text"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none font-bold"
              value={formData.symbol}
              onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase tracking-widest">Kierunek</label>
            <select
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none font-bold"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as TradeType })}
            >
              <option value={TradeType.LONG}>LONG ↑</option>
              <option value={TradeType.SHORT}>SHORT ↓</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase tracking-widest">Ilość (Size)</label>
            <input
              type="number"
              step="any"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none font-bold"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-xl border border-slate-700/50">
          <input 
            type="checkbox" 
            id="open_pos"
            checked={isOpenPosition}
            onChange={(e) => setIsOpenPosition(e.target.checked)}
            className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-emerald-600 focus:ring-emerald-500"
          />
          <label htmlFor="open_pos" className="text-sm font-bold text-slate-300 cursor-pointer flex-1">
            Pozycja nadal otwarta (Active)
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase tracking-widest">Cena Wejścia</label>
            <input
              type="number"
              step="any"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none font-bold"
              value={formData.entryPrice}
              onChange={(e) => setFormData({ ...formData, entryPrice: e.target.value })}
              required
            />
          </div>
          <div className={isOpenPosition ? 'opacity-30 pointer-events-none' : ''}>
            <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase tracking-widest">Cena Wyjścia</label>
            <input
              type="number"
              step="any"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none font-bold"
              value={formData.exitPrice}
              onChange={(e) => setFormData({ ...formData, exitPrice: e.target.value })}
              required={!isOpenPosition}
              disabled={isOpenPosition}
              placeholder={isOpenPosition ? "Aktywna..." : "Cena"}
            />
          </div>
        </div>

        <button
          type="submit"
          className={`w-full ${isOpenPosition ? 'bg-blue-600 hover:bg-blue-500' : 'bg-emerald-600 hover:bg-emerald-500'} text-white font-black py-4 rounded-xl transition-all shadow-xl active:scale-95 uppercase tracking-widest text-sm`}
        >
          {isOpenPosition ? 'Uruchom Trade' : 'Zapisz Zamknięty Trade'}
        </button>
      </form>
    </div>
  );
};

export default TradeForm;
