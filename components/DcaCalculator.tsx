
import React, { useState, useEffect } from 'react';
import { TradeType, MarginMode } from '../types';

const DcaCalculator: React.FC = () => {
  const [type, setType] = useState<TradeType>(TradeType.SHORT);
  const [marginMode, setMarginMode] = useState<MarginMode>(MarginMode.ISOLATED);
  
  // Dane obecnej pozycji
  const [currentEntry, setCurrentEntry] = useState<string>('');
  const [currentSize, setCurrentSize] = useState<string>(''); // Notional Value ($)
  const [currentMargin, setCurrentMargin] = useState<string>(''); // Początkowy Margin ($)
  const [tradingFees, setTradingFees] = useState<string>('0'); // Suma prowizji (zawsze +)
  const [accruedFunding, setAccruedFunding] = useState<string>('0'); // Funding (może być -)
  
  // Dane dla DCA
  const [addPrice, setAddPrice] = useState<string>('');
  const [addSize, setAddSize] = useState<string>(''); 
  const [addMargin, setAddMargin] = useState<string>(''); 
  
  // Saldo dla Cross
  const [walletBalance, setWalletBalance] = useState<string>('');
  
  // MMR (Maintenance Margin Rate)
  const [mmr, setMmr] = useState<number>(0.5); 

  const [results, setResults] = useState<{
    current: { liq: number; dist: number; entry: number; size: number; effMargin: number };
    projected: { liq: number; dist: number; entry: number; size: number; effMargin: number } | null;
  } | null>(null);

  useEffect(() => {
    const calculateLiq = (entry: number, size: number, margin: number, fees: number, funding: number, mode: MarginMode, wallet: number) => {
      if (entry <= 0 || size <= 0) return null;
      
      const units = size / entry;
      const mmrDec = mmr / 100;
      
      // Effective Margin = Zabezpieczenie - Prowizje - Funding
      // Jeśli funding jest ujemny (zysk), to "- (-funding)" doda go do marginu.
      const effectiveMargin = (mode === MarginMode.CROSS ? wallet : margin) - fees - funding;
      
      let liq = 0;
      if (type === TradeType.LONG) {
        liq = (size - effectiveMargin) / (units * (1 - mmrDec));
      } else {
        liq = (size + effectiveMargin) / (units * (1 + mmrDec));
      }

      const distance = type === TradeType.LONG 
        ? ((entry - liq) / entry) * 100 
        : ((liq - entry) / entry) * 100;

      return { liq: Math.max(0, liq), dist: distance, entry, size, effMargin: effectiveMargin };
    };

    const cEntry = parseFloat(currentEntry);
    const cSize = parseFloat(currentSize);
    const cMarg = parseFloat(currentMargin) || 0;
    const cFees = parseFloat(tradingFees) || 0;
    const cFunding = parseFloat(accruedFunding) || 0;
    const wallet = parseFloat(walletBalance) || 0;

    const currentLiq = calculateLiq(cEntry, cSize, cMarg, cFees, cFunding, marginMode, wallet);

    if (currentLiq) {
      const aPrice = parseFloat(addPrice);
      const aSize = parseFloat(addSize);
      const aMarg = parseFloat(addMargin) || 0;

      let projectedLiq = null;
      if (!isNaN(aPrice) && !isNaN(aSize) && aPrice > 0) {
        const totalSize = cSize + aSize;
        const totalUnits = (cSize / cEntry) + (aSize / aPrice);
        const newEntry = totalSize / totalUnits;
        const totalInitialMargin = cMarg + aMarg;
        
        projectedLiq = calculateLiq(newEntry, totalSize, totalInitialMargin, cFees, cFunding, marginMode, wallet);
      }

      setResults({ current: currentLiq, projected: projectedLiq });
    } else {
      setResults(null);
    }
  }, [type, marginMode, currentEntry, currentSize, currentMargin, tradingFees, accruedFunding, addPrice, addSize, addMargin, walletBalance, mmr]);

  const fundingValue = parseFloat(accruedFunding) || 0;

  return (
    <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-2xl relative overflow-hidden flex flex-col gap-5">
      {/* Header */}
      <div className="flex justify-between items-center relative z-10">
        <h2 className="text-lg font-black text-white uppercase italic tracking-tight">
          <i className="fas fa-shield-halved text-blue-400 mr-2"></i> Liquidation Radar
        </h2>
        <div className="flex flex-col items-end gap-1 scale-90 origin-right">
          <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-700">
            <button onClick={() => setType(TradeType.LONG)} className={`px-3 py-1 text-[10px] font-black rounded-md transition-all ${type === TradeType.LONG ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}>LONG</button>
            <button onClick={() => setType(TradeType.SHORT)} className={`px-3 py-1 text-[10px] font-black rounded-md transition-all ${type === TradeType.SHORT ? 'bg-rose-600 text-white' : 'text-slate-500'}`}>SHORT</button>
          </div>
          <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-700 mt-1">
            <button onClick={() => setMarginMode(MarginMode.ISOLATED)} className={`px-3 py-1 text-[10px] font-black rounded-md transition-all ${marginMode === MarginMode.ISOLATED ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>ISO</button>
            <button onClick={() => setMarginMode(MarginMode.CROSS)} className={`px-3 py-1 text-[10px] font-black rounded-md transition-all ${marginMode === MarginMode.CROSS ? 'bg-purple-600 text-white' : 'text-slate-500'}`}>CROSS</button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Tryb Cross - Equity */}
        {marginMode === MarginMode.CROSS && (
          <div className="p-3 bg-purple-500/5 border border-purple-500/20 rounded-2xl">
            <label className="block text-[8px] font-black text-purple-400 mb-1 uppercase tracking-widest text-center">Wallet Equity ($) - Total Assets</label>
            <input type="number" value={walletBalance} onChange={e => setWalletBalance(e.target.value)} placeholder="0.00" className="w-full bg-slate-900 border border-purple-500/30 rounded-xl p-2 text-purple-400 text-xs font-mono font-black text-center outline-none" />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block text-[7px] font-black text-slate-500 uppercase">Entry Price $</label>
            <input type="number" value={currentEntry} onChange={e => setCurrentEntry(e.target.value)} placeholder="0.00" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white text-xs font-mono font-black outline-none" />
          </div>
          <div className="space-y-1">
            <label className="block text-[7px] font-black text-slate-500 uppercase">Size (Notional $)</label>
            <input type="number" value={currentSize} onChange={e => setCurrentSize(e.target.value)} placeholder="0.00" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white text-xs font-mono font-black outline-none" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <label className="block text-[7px] font-black text-slate-500 uppercase">Margin $</label>
            <input type="number" value={currentMargin} onChange={e => setCurrentMargin(e.target.value)} disabled={marginMode === MarginMode.CROSS} placeholder="0" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-emerald-500 text-xs font-mono font-black outline-none disabled:opacity-20" />
          </div>
          <div className="space-y-1">
            <label className="block text-[7px] font-black text-slate-500 uppercase">Fees $</label>
            <input type="number" value={tradingFees} onChange={e => setTradingFees(e.target.value)} placeholder="0" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-slate-400 text-xs font-mono font-black outline-none" />
          </div>
          <div className="space-y-1">
            <label className={`block text-[7px] font-black uppercase ${fundingValue > 0 ? 'text-amber-500' : fundingValue < 0 ? 'text-emerald-500' : 'text-slate-500'}`}>Funding $</label>
            <input 
              type="number" 
              value={accruedFunding} 
              onChange={e => setAccruedFunding(e.target.value)} 
              placeholder="0" 
              className={`w-full bg-slate-900 border rounded-xl p-2 text-xs font-mono font-black outline-none transition-colors ${fundingValue > 0 ? 'border-amber-500/30 text-amber-500' : fundingValue < 0 ? 'border-emerald-500/30 text-emerald-500' : 'border-slate-700 text-slate-400'}`} 
            />
          </div>
        </div>
        <p className="text-[6px] text-slate-600 uppercase font-black text-center mt-[-8px]">
           Zapłacone: (+), Bonus: (-)
        </p>

        {/* DCA Section */}
        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-700 border-dashed"></div></div>
          <div className="relative flex justify-center"><span className="bg-slate-800 px-3 text-[8px] font-black text-blue-400 uppercase tracking-widest">Average Down (DCA)</span></div>
        </div>

        <div className="grid grid-cols-3 gap-2 p-3 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
          <div className="space-y-1">
            <label className="block text-[7px] font-black text-blue-400/60 uppercase text-center">Add Price</label>
            <input type="number" value={addPrice} onChange={e => setAddPrice(e.target.value)} placeholder="0.00" className="w-full bg-slate-900 border border-blue-500/20 rounded-xl p-2 text-blue-400 text-xs font-mono font-black text-center outline-none" />
          </div>
          <div className="space-y-1">
            <label className="block text-[7px] font-black text-blue-400/60 uppercase text-center">Add Size $</label>
            <input type="number" value={addSize} onChange={e => setAddSize(e.target.value)} placeholder="0.00" className="w-full bg-slate-900 border border-blue-500/20 rounded-xl p-2 text-blue-400 text-xs font-mono font-black text-center outline-none" />
          </div>
          <div className="space-y-1">
            <label className="block text-[7px] font-black text-blue-400/60 uppercase text-center">Add Marg $</label>
            <input type="number" value={addMargin} onChange={e => setAddMargin(e.target.value)} disabled={marginMode === MarginMode.CROSS} className="w-full bg-slate-900 border border-blue-500/20 rounded-xl p-2 text-emerald-500 text-xs font-mono font-black text-center outline-none disabled:opacity-20" />
          </div>
        </div>

        {/* Results */}
        {results && (
          <div className="space-y-3 animate-in fade-in duration-300">
            {/* CURRENT LIQ CARD */}
            <div className="bg-slate-900/50 p-3 rounded-2xl border border-slate-700 relative group transition-all hover:border-slate-600">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1">Live Liquidation ({type})</p>
                  <p className={`text-2xl font-mono font-black ${type === TradeType.SHORT ? 'text-rose-400' : 'text-emerald-400'} tracking-tighter`}>
                    ${results.current.liq.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[7px] font-black text-slate-500 uppercase mb-1">Dystans</p>
                  <p className={`text-sm font-mono font-black ${results.current.dist < 10 ? 'text-rose-500' : 'text-slate-300'}`}>{results.current.dist.toFixed(2)}%</p>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-800/50 flex justify-between items-center">
                 <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest italic">Actual Effective Collateral:</span>
                 <span className={`text-[10px] font-mono font-black ${results.current.effMargin >= (parseFloat(currentMargin) || 0) ? 'text-emerald-500' : 'text-amber-500'}`}>
                   ${results.current.effMargin.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                 </span>
              </div>
            </div>

            {/* PROJECTED DCA CARD */}
            {results.projected && (
              <div className="bg-blue-600/10 p-4 rounded-2xl border border-blue-500/30 relative overflow-hidden shadow-lg shadow-blue-500/5">
                <div className="absolute top-0 right-0 bg-blue-600 text-[8px] font-black px-3 py-1 rounded-bl-xl text-white uppercase tracking-tighter">Target DCA</div>
                
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div>
                    <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">New Entry</p>
                    <p className="text-xs font-mono font-black text-white">${results.projected.entry.toLocaleString(undefined, { maximumFractionDigits: 4 })}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Size $</p>
                    <p className="text-xs font-mono font-black text-white">${results.projected.size.toLocaleString()}</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-blue-500/20 text-center">
                  <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Projected Liquidation</p>
                  <p className={`text-3xl font-mono font-black ${type === TradeType.SHORT ? 'text-rose-500' : 'text-emerald-500'} tracking-tighter`}>
                    ${results.projected.liq.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-between items-center opacity-40 hover:opacity-100 transition-opacity mt-2">
           <div className="flex items-center gap-2">
              <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest">MMR %:</span>
              <input type="number" step="0.1" value={mmr} onChange={e => setMmr(parseFloat(e.target.value) || 0)} className="w-8 bg-transparent border-b border-slate-700 text-[10px] text-slate-400 font-bold outline-none text-center" />
           </div>
           <p className="text-[7px] font-black text-slate-600 italic uppercase">Exchange Grade Calculator</p>
        </div>
      </div>
    </div>
  );
};

export default DcaCalculator;
