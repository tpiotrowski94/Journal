
import React, { useState, useEffect } from 'react';
import { Trade, TradeType, TradeStatus, MarginMode, NoteEntry } from '../types';

interface TradeFormProps {
  onAddTrade: (trade: Omit<Trade, 'id' | 'pnl' | 'pnlPercentage' | 'initialRisk'>) => void;
  onFormUpdate: (data: { entry: number; sl: number }) => void;
}

const TradeForm: React.FC<TradeFormProps> = ({ onAddTrade, onFormUpdate }) => {
  const getNowISO = () => {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - tzOffset).toISOString().slice(0, 19);
  };

  const [formData, setFormData] = useState({
    symbol: 'BTC-PERP',
    type: TradeType.LONG,
    marginMode: MarginMode.ISOLATED,
    leverage: 10,
    entryPrice: '',
    exitPrice: '',
    stopLoss: '',
    amount: '',
    fees: '0',
    fundingFees: '0',
    date: getNowISO(),
    notes: '',
    confidence: 3
  });

  const cleanNumericInput = (val: string) => {
    return val.replace(/,/g, '').replace(/\s/g, '');
  };

  useEffect(() => {
    onFormUpdate({
      entry: parseFloat(formData.entryPrice) || 0,
      sl: parseFloat(formData.stopLoss) || 0
    });
  }, [formData.entryPrice, formData.stopLoss]);

  const refreshDate = () => {
    setFormData(prev => ({ ...prev, date: getNowISO() }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.symbol || !formData.entryPrice || !formData.amount) return;

    const isActuallyOpen = formData.exitPrice.trim() === '';
    const now = getNowISO();
    
    const initialNotes: NoteEntry[] = formData.notes.trim() 
      ? [{ id: crypto.randomUUID(), text: formData.notes, date: now }]
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
      fundingFees: parseFloat(formData.fundingFees) || 0,
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
      fundingFees: '0',
      notes: '',
      date: getNowISO()
    });
  };

  const isPositionOpen = formData.exitPrice.trim() === '';
  const confidenceLabels = ["Gambling", "Speculation", "Neutral", "Solid Setup", "Strong Signal"];

  return (
    <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-2xl">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-black text-white flex items-center gap-2 uppercase italic tracking-tighter leading-none">
          <i className="fas fa-plus-circle text-blue-500"></i> New Position
        </h2>
      </div>

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
               <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Ticker</label>
               <input
                type="text"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none font-bold text-sm uppercase"
                value={formData.symbol}
                onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                placeholder="BTC-PERP"
                required
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest">Date</label>
                <button type="button" onClick={refreshDate} className="text-[8px] font-black text-blue-500 hover:text-blue-400 uppercase tracking-tighter">
                   Now
                </button>
              </div>
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
              <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Side</label>
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
              <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Margin</label>
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
                type="text"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none font-bold text-sm"
                value={formData.entryPrice}
                onChange={(e) => setFormData({ ...formData, entryPrice: cleanNumericInput(e.target.value) })}
                placeholder="0.00"
                required
              />
            </div>
            <div>
              <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Amount (Units)</label>
              <input
                type="text"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none font-bold text-sm"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: cleanNumericInput(e.target.value) })}
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
              <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Fees</label>
              <input
                type="number"
                step="any"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-rose-400 outline-none font-bold text-sm"
                value={formData.fees}
                onChange={(e) => setFormData({ ...formData, fees: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Setup Notes</label>
          <textarea
            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none font-medium text-xs h-16 resize-none"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Describe your reasoning..."
          ></textarea>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[9px] font-black text-rose-400 mb-1 uppercase tracking-widest">Stop Loss</label>
            <input
              type="text"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-rose-500 outline-none font-bold text-xs"
              value={formData.stopLoss}
              onChange={(e) => setFormData({ ...formData, stopLoss: cleanNumericInput(e.target.value) })}
            />
          </div>
          <div>
            <label className="block text-[9px] font-black text-blue-400 mb-1 uppercase tracking-widest">Exit Price (History)</label>
            <input
              type="text"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-blue-400 outline-none font-bold text-xs"
              value={formData.exitPrice}
              onChange={(e) => setFormData({ ...formData, exitPrice: cleanNumericInput(e.target.value) })}
            />
          </div>
        </div>

        <button
          type="submit"
          className={`w-full ${isPositionOpen ? 'bg-blue-600' : 'bg-emerald-600'} text-white font-black py-4 rounded-2xl transition-all shadow-xl uppercase tracking-[0.2em] text-xs hover:brightness-110`}
        >
          {isPositionOpen ? 'Open Position' : 'Log Historical Trade'}
        </button>
      </form>
    </div>
  );
};

export default TradeForm;
