
import React, { useState } from 'react';
import { Trade, TradeType } from '../types';

interface TradeFormProps {
  onAddTrade: (trade: Omit<Trade, 'id' | 'pnl' | 'pnlPercentage'>) => void;
}

const TradeForm: React.FC<TradeFormProps> = ({ onAddTrade }) => {
  const [formData, setFormData] = useState({
    symbol: '',
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
    if (!formData.symbol || !formData.entryPrice || !formData.exitPrice || !formData.amount) return;

    onAddTrade({
      symbol: formData.symbol.toUpperCase(),
      type: formData.type,
      entryPrice: parseFloat(formData.entryPrice),
      exitPrice: parseFloat(formData.exitPrice),
      amount: parseFloat(formData.amount),
      fees: parseFloat(formData.fees) || 0,
      date: formData.date,
      notes: formData.notes
    });

    setFormData({
      symbol: '',
      type: TradeType.LONG,
      entryPrice: '',
      exitPrice: '',
      amount: '',
      fees: '0',
      date: new Date().toISOString().split('T')[0],
      notes: ''
    });
  };

  return (
    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl">
      <h2 className="text-xl font-bold mb-4 text-emerald-400 flex items-center gap-2">
        <i className="fas fa-plus-circle"></i> Nowa Pozycja
      </h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-tighter">Symbol (np. BTC/USDT)</label>
          <input
            type="text"
            placeholder="BTC/USDT"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
            value={formData.symbol}
            onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-tighter">Typ</label>
          <select
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as TradeType })}
          >
            <option value={TradeType.LONG}>Long (Kupno)</option>
            <option value={TradeType.SHORT}>Short (Sprzedaż)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-tighter">Cena Wejścia</label>
          <input
            type="number"
            step="any"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
            value={formData.entryPrice}
            onChange={(e) => setFormData({ ...formData, entryPrice: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-tighter">Cena Wyjścia</label>
          <input
            type="number"
            step="any"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
            value={formData.exitPrice}
            onChange={(e) => setFormData({ ...formData, exitPrice: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-tighter">Ilość</label>
          <input
            type="number"
            step="any"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-tighter">Opłaty (USDT)</label>
          <input
            type="number"
            step="any"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
            value={formData.fees}
            onChange={(e) => setFormData({ ...formData, fees: e.target.value })}
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-tighter">Data</label>
          <input
            type="date"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-tighter">Notatki / Dlaczego wszedłeś?</label>
          <textarea
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-emerald-500 outline-none h-20 resize-none"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Opisz swój powód wejścia w pozycję..."
          />
        </div>
        <div className="md:col-span-2">
          <button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg transition-colors shadow-lg active:transform active:scale-95"
          >
            Zapisz Transakcję
          </button>
        </div>
      </form>
    </div>
  );
};

export default TradeForm;
