
import React, { useState, useEffect } from 'react';

interface RiskCalculatorProps {
  balance: number;
  externalData?: { entry: number; sl: number };
}

const RiskCalculator: React.FC<RiskCalculatorProps> = ({ balance, externalData }) => {
  const [riskPct, setRiskPct] = useState(1);
  const [entryPrice, setEntryPrice] = useState(0);
  const [stopLoss, setStopLoss] = useState(0);
  const [result, setResult] = useState<{ positionSize: number; lossAmount: number } | null>(null);

  useEffect(() => {
    if (externalData?.entry) setEntryPrice(externalData.entry);
    if (externalData?.sl) setStopLoss(externalData.sl);
  }, [externalData]);

  useEffect(() => {
    if (entryPrice > 0 && stopLoss > 0 && entryPrice !== stopLoss) {
      const lossAmount = balance * (riskPct / 100);
      const priceDiffPct = Math.abs(entryPrice - stopLoss) / entryPrice;
      const positionSize = lossAmount / priceDiffPct;
      setResult({ positionSize, lossAmount });
    } else {
      setResult(null);
    }
  }, [riskPct, entryPrice, stopLoss, balance]);

  return (
    <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 p-3">
         <div className="text-[8px] font-black bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded-full uppercase tracking-tighter">Live Calculator</div>
      </div>
      <h2 className="text-lg font-black text-white mb-4 uppercase italic tracking-tight">
        <i className="fas fa-calculator text-amber-500 mr-2"></i> Risk Sizer
      </h2>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Risk (%)</label>
            <input 
              type="number" 
              value={riskPct} 
              onChange={e => setRiskPct(parseFloat(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white text-sm font-bold outline-none"
            />
          </div>
          <div>
            <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Max Loss ($)</label>
            <div className="p-2 bg-slate-900 border border-slate-700 rounded-xl text-amber-500 font-bold text-sm">
              ${(balance * (riskPct / 100)).toFixed(2)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Entry Price</label>
            <input 
              type="number" 
              value={entryPrice || ''}
              onChange={e => setEntryPrice(parseFloat(e.target.value))}
              placeholder="0.00"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white text-sm font-bold outline-none"
            />
          </div>
          <div>
            <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Stop Loss</label>
            <input 
              type="number" 
              value={stopLoss || ''}
              onChange={e => setStopLoss(parseFloat(e.target.value))}
              placeholder="0.00"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white text-sm font-bold outline-none"
            />
          </div>
        </div>

        {result && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Position Size Needed</p>
            <p className="text-2xl font-black text-white">${result.positionSize.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            <p className="text-[9px] text-slate-400 mt-1 uppercase">Approx. Units: {(result.positionSize / entryPrice).toFixed(4)}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RiskCalculator;
