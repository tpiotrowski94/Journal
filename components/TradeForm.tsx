
import React, { useState, useEffect } from 'react';
import { Trade, TradeType, TradeStatus, MarginMode, NoteEntry } from '../types';

interface TradeFormProps {
  onAddTrade: (trade: Omit<Trade, 'id' | 'pnl' | 'pnlPercentage' | 'initialRisk'>) => void;
  onFormUpdate: (data: { entry: number; sl: number }) => void;
}

const TradeForm: React.FC<TradeFormProps> = ({ onAddTrade, onFormUpdate }) => {
  const getNowISO = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 19);
  };

  const [formData, setFormData] = useState({
    symbol: 'BTC/USDT',
    type: TradeType.LONG,
    marginMode: MarginMode.ISOLATED,
    leverage: 10,
    entryPrice: '',
    exitPrice: '',
    stopLoss: '',
    amount: '',
    fees: '0',
    date: getNowISO(),
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

    const isActuallyOpen = formData.exitPrice.trim() === '';
    
    // Create initial note if provided
    const initialNotes: NoteEntry[] = formData.notes.trim() 
      ? [{ id: crypto.randomUUID(), text: formData.notes, date: getNowISO() }]
      : [];

    onAddTrade({
      symbol: formData.symbol.toUpperCase(),
      type: formData.type,
      marginMode: formData.marginMode,
      leverage: Number(formData.leverage) || 1,
      status: isActuallyOpen ? TradeStatus.OPEN : TradeStatus.CLOSED,
      entryPrice: parseFloat(formData.entryPrice) || 0,
      exitPrice: isActuallyOpen ? null : parseFloat(formData.exitPrice),
      stopLoss: formData.stopLoss ? parseFloat(formData.stopLoss) : null,
      amount: parseFloat(formData.amount) || 0,
      fees: parseFloat(formData.fees) || 0,
      date: formData.date,
      notes: initialNotes,
      confidence: formData.confidence
    });

    setFormData({
      ...formData,
      entryPrice: '',
      exitPrice: '',
      stopLoss: '',
      amount: '',
      fees: '0',
      notes: '',
      date: getNowISO()
    });
  };

  const isPositionOpen = formData.exitPrice.trim() === '';
  const confidenceLabels = ["Gambling", "Speculation", "Neutral", "Solid Setup", "Strong Signal"];

  return (
    <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-2xl">
      <h2 className="text-xl font-black mb-6 text-white flex items-center gap-2 uppercase italic tracking-tighter">
        <i className="fas fa-terminal text-emerald-500"></i> Execution Terminal
      </h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-[9px] font-black text-slate-500 mb-2 uppercase tracking-widest flex justify-between">
            <span>Confidence Level</span>
            <span className="text-emerald-500 font-black">{confidenceLabels[formData.confidence - 1]}</span>
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

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
               <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Trading Pair</label>
               <input
                type="text"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-sm uppercase"
                value={formData.symbol}
                onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Execution Date</label>
              <input
                type="datetime-local"
                step="1"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none font-bold text-[10px] uppercase"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Trade Side</label>
              <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-700">
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, type: TradeType.LONG})}
                  className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${formData.type === TradeType.LONG ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500'}`}
                >LONG</button>
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, type: TradeType.SHORT})}
                  className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${formData.type === TradeType.SHORT ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-500'}`}
                >SHORT</button>
              </div>
            </div>
            <div>
              <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Margin Mode</label>
              <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-700">
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, marginMode: MarginMode.ISOLATED})}
                  className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${formData.marginMode === MarginMode.ISOLATED ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}
                >ISO</button>
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, marginMode: MarginMode.CROSS})}
                  className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${formData.marginMode === MarginMode.CROSS ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}
                >CROSS</button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Entry Price</label>
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
              <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Amount (Units)</label>
              <input
                type="number"
                step="any"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none font-bold text-sm"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Leverage</label>
              <input
                type="number"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none font-bold text-sm"
                value={formData.leverage}
                onChange={(e) => setFormData({ ...formData, leverage: Number(e.target.value) })}
                required
              />
            </div>
            <div>
              <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Opening Fees</label>
              <input
                type="number"
                step="any"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none font-bold text-sm"
                value={formData.fees}
                onChange={(e) => setFormData({ ...formData, fees: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">First Log Entry</label>
          <textarea
            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none font-medium text-xs h-20 resize-none focus:ring-1 focus:ring-blue-500/50"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Setup description..."
          ></textarea>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest text-rose-400">Stop Loss</label>
            <input
              type="number"
              step="any"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-rose-500 outline-none font-bold text-xs"
              value={formData.stopLoss}
              onChange={(e) => setFormData({ ...formData, stopLoss: e.target.value })}
              placeholder="SL"
            />
          </div>
          <div>
            <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest text-blue-400">Exit (History)</label>
            <input
              type="number"
              step="any"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-blue-400 outline-none font-bold text-xs"
              value={formData.exitPrice}
              onChange={(e) => setFormData({ ...formData, exitPrice: e.target.value })}
              placeholder="Exit"
            />
          </div>
        </div>

        <button
          type="submit"
          className={`w-full ${isPositionOpen ? 'bg-blue-600 shadow-blue-600/20' : 'bg-emerald-600 shadow-emerald-600/20'} text-white font-black py-4 rounded-2xl transition-all shadow-xl uppercase tracking-[0.2em] text-xs hover:brightness-110`}
        >
          {isPositionOpen ? 'Execute Open Position' : 'Log Closed Trade'}
        </button>
      </form>
    </div>
  );
};

export default TradeForm;
