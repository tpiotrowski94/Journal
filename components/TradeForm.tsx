
import React, { useState, useEffect } from 'react';
import { Trade, TradeType, TradeStatus } from '../types';

interface TradeFormProps {
  onAddTrade: (trade: Omit<Trade, 'id' | 'pnl' | 'pnlPercentage' | 'initialRisk'>) => void;
  onFormUpdate: (data: { entry: number; sl: number }) => void;
}

const TradeForm: React.FC<TradeFormProps> = ({ onAddTrade, onFormUpdate }) => {
  const [isOpenPosition, setIsOpenPosition] = useState(false);
  const [formData, setFormData] = useState({
    symbol: 'BTC/USDT',
    type: TradeType.LONG,
    entryPrice: '',
    exitPrice: '',
    stopLoss: '',
    amount: '',
    fees: '0',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    confidence: 3
  });

  useEffect(() => {
    onFormUpdate({
      entry: parseFloat(formData.entryPrice) || 0,
      sl: parseFloat(formData.stopLoss) || 0
    });
  }, [formData.entryPrice, formData.stopLoss]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.symbol || !formData.entryPrice || !formData.amount) return;

    onAddTrade({
      symbol: formData.symbol.toUpperCase(),
      type: formData.type,
      status: isOpenPosition ? TradeStatus.OPEN : TradeStatus.CLOSED,
      entryPrice: parseFloat(formData.entryPrice),
      exitPrice: isOpenPosition ? null : parseFloat(formData.exitPrice),
      stopLoss: formData.stopLoss ? parseFloat(formData.stopLoss) : null,
      amount: parseFloat(formData.amount),
      fees: parseFloat(formData.fees) || 0,
      date: formData.date,
      notes: formData.notes,
      confidence: formData.confidence
    });

    setFormData({
      ...formData,
      entryPrice: '',
      exitPrice: '',
      stopLoss: '',
      amount: '',
      notes: ''
    });
  };

  const confidenceLabels = ["Gambling", "Speculative", "Neutral", "Solid Setup", "High Conviction"];

  return (
    <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-2xl">
      <h2 className="text-xl font-black mb-6 text-white flex items-center gap-2 uppercase italic tracking-tighter">
        <i className="fas fa-terminal text-emerald-500"></i> Exec Terminal
      </h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-[9px] font-black text-slate-500 mb-2 uppercase tracking-widest flex justify-between">
            <span>Confidence Level</span>
            <span className="text-emerald-500">{confidenceLabels[formData.confidence - 1]}</span>
          </label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setFormData({ ...formData, confidence: level })}
                className={`flex-1 h-2 rounded-full transition-all ${
                  formData.confidence >= level 
                    ? (formData.confidence <= 2 ? 'bg-rose-500' : formData.confidence === 3 ? 'bg-amber-500' : 'bg-emerald-500')
                    : 'bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Asset</label>
            <input
              type="text"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-sm"
              value={formData.symbol}
              onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Side</label>
            <select
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none font-bold text-sm"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as TradeType })}
            >
              <option value={TradeType.LONG}>LONG ↑</option>
              <option value={TradeType.SHORT}>SHORT ↓</option>
            </select>
          </div>

          <div>
            <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Size (Units)</label>
            <input
              type="number"
              step="any"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none font-bold text-sm"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Entry</label>
            <input
              type="number"
              step="any"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none font-bold text-sm"
              value={formData.entryPrice}
              onChange={(e) => setFormData({ ...formData, entryPrice: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Stop Loss</label>
            <input
              type="number"
              step="any"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none font-bold text-sm"
              value={formData.stopLoss}
              onChange={(e) => setFormData({ ...formData, stopLoss: e.target.value })}
            />
          </div>
          <div className={isOpenPosition ? 'opacity-30' : ''}>
            <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Exit</label>
            <input
              type="number"
              step="any"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none font-bold text-sm"
              value={formData.exitPrice}
              onChange={(e) => setFormData({ ...formData, exitPrice: e.target.value })}
              disabled={isOpenPosition}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 bg-blue-500/5 rounded-2xl border border-blue-500/10">
          <input 
            type="checkbox" 
            id="open_pos_check"
            checked={isOpenPosition}
            onChange={(e) => setIsOpenPosition(e.target.checked)}
            className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-blue-600"
          />
          <label htmlFor="open_pos_check" className="text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer flex-1">
            Keep as Open Position
          </label>
        </div>

        <button
          type="submit"
          className={`w-full ${isOpenPosition ? 'bg-blue-600' : 'bg-emerald-600'} text-white font-black py-4 rounded-2xl transition-all shadow-xl uppercase tracking-[0.2em] text-xs hover:brightness-110`}
        >
          {isOpenPosition ? 'Launch Position' : 'Log Closed Trade'}
        </button>
      </form>
    </div>
  );
};

export default TradeForm;
