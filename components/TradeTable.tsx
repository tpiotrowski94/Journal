
import React from 'react';
import { Trade, TradeStatus } from '../types';

interface TradeTableProps {
  trades: Trade[];
  onDelete: (id: string) => void;
  onCloseTrade: (id: string, exitPrice: number) => void;
  onAddToPosition: (id: string, additionalAmount: number, additionalPrice: number) => void;
  onExport?: () => void;
}

const TradeTable: React.FC<TradeTableProps> = ({ trades, onDelete, onCloseTrade, onAddToPosition, onExport }) => {
  const handleCloseClick = (id: string) => {
    const price = prompt("Enter Exit Price:");
    if (price && !isNaN(parseFloat(price))) {
      onCloseTrade(id, parseFloat(price));
    }
  };

  const handleAddClick = (id: string) => {
    const price = prompt("Entry Price of new batch:");
    const amount = prompt("Amount of new batch:");
    if (price && amount && !isNaN(parseFloat(price)) && !isNaN(parseFloat(amount))) {
      onAddToPosition(id, parseFloat(amount), parseFloat(price));
    }
  };

  return (
    <div className="bg-slate-800 rounded-3xl border border-slate-700 overflow-hidden shadow-2xl">
      <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
        <h2 className="text-xl font-black text-white flex items-center gap-3 uppercase italic tracking-tighter">
          <i className="fas fa-layer-group text-emerald-500"></i> Operation History
        </h2>
        <div className="flex gap-2">
           <button onClick={onExport} className="bg-slate-900 text-slate-500 hover:text-white text-[9px] font-black px-4 py-2 rounded-full border border-slate-700 uppercase transition-all">Export JSON</button>
        </div>
      </div>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-900/40 text-slate-500 text-[9px] font-black uppercase tracking-[0.2em]">
              <th className="px-6 py-4">Status / Confidence</th>
              <th className="px-6 py-4">Asset</th>
              <th className="px-6 py-4 text-right">Risk (SL)</th>
              <th className="px-6 py-4 text-right">P&L / R:R</th>
              <th className="px-6 py-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {trades.map((trade) => {
              const rrRatio = trade.initialRisk && trade.status === TradeStatus.CLOSED 
                ? (trade.pnl / trade.initialRisk).toFixed(2) 
                : null;

              return (
                <tr key={trade.id} className="hover:bg-slate-700/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-1 w-20">
                        {[1, 2, 3, 4, 5].map(lvl => (
                          <div key={lvl} className={`h-1.5 flex-1 rounded-full ${trade.confidence >= lvl ? (trade.confidence <= 2 ? 'bg-rose-500' : trade.confidence === 3 ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-slate-700'}`} />
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-black uppercase ${trade.status === 'OPEN' ? 'text-blue-400' : 'text-slate-500'}`}>
                          {trade.status}
                        </span>
                        <span className="text-[9px] text-slate-600 font-bold">{trade.date}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-black text-white text-sm tracking-tight">{trade.symbol}</div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase">{trade.type} • Vol: {trade.amount}</div>
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-[11px]">
                    <div className="text-slate-300">@{trade.entryPrice.toLocaleString()}</div>
                    <div className="text-rose-500/60">Risk: ${trade.initialRisk?.toFixed(2) || 'N/A'}</div>
                  </td>
                  <td className={`px-6 py-4 text-right`}>
                    <div className={`font-black text-xs ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {trade.status === 'OPEN' ? '--' : `${trade.pnl.toFixed(2)} (${trade.pnlPercentage.toFixed(1)}%)`}
                    </div>
                    {rrRatio && (
                      <div className="text-[10px] font-bold text-slate-500 uppercase">R:R {rrRatio}</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-2">
                      {trade.status === 'OPEN' ? (
                        <>
                          <button onClick={() => handleAddClick(trade.id)} className="bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white px-2 py-1 rounded-lg text-[9px] font-black transition-all">ADD</button>
                          <button onClick={() => handleCloseClick(trade.id)} className="bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white px-2 py-1 rounded-lg text-[9px] font-black transition-all">EXIT</button>
                        </>
                      ) : (
                        <button onClick={() => onDelete(trade.id)} className="text-slate-600 hover:text-rose-500 transition-colors px-2"><i className="fas fa-trash-alt text-xs"></i></button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TradeTable;
