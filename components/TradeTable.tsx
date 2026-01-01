
import React from 'react';
import { Trade, TradeType, TradeStatus } from '../types';

interface TradeTableProps {
  trades: Trade[];
  onDelete: (id: string) => void;
  onCloseTrade: (id: string, exitPrice: number) => void;
}

const TradeTable: React.FC<TradeTableProps> = ({ trades, onDelete, onCloseTrade }) => {
  const handleCloseClick = (id: string) => {
    const price = prompt("Podaj cenę wyjścia (Exit Price):");
    if (price && !isNaN(parseFloat(price))) {
      onCloseTrade(id, parseFloat(price));
    }
  };

  return (
    <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl">
      <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
        <h2 className="text-xl font-black text-white flex items-center gap-3 uppercase tracking-tight">
          <i className="fas fa-list-ul text-emerald-500"></i> Dziennik Pokładowy
        </h2>
        <div className="flex gap-2">
          <span className="bg-blue-500/10 text-blue-400 text-[10px] font-black px-3 py-1 rounded-full border border-blue-500/20 uppercase">
            {trades.filter(t => t.status === TradeStatus.OPEN).length} OPEN
          </span>
          <span className="bg-slate-900 text-slate-400 text-[10px] font-black px-3 py-1 rounded-full border border-slate-700 uppercase">
            {trades.length} TOTAL
          </span>
        </div>
      </div>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-900/40 text-slate-500 text-[10px] font-black uppercase tracking-widest">
              <th className="px-6 py-4">Status / Data</th>
              <th className="px-6 py-4">Instrument</th>
              <th className="px-6 py-4">Typ</th>
              <th className="px-6 py-4 text-right">Entry / Exit</th>
              <th className="px-6 py-4 text-right">P&L ($)</th>
              <th className="px-6 py-4 text-right">P&L (%)</th>
              <th className="px-6 py-4 text-center">Akcje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {trades.map((trade) => (
              <tr key={trade.id} className="hover:bg-slate-700/20 transition-colors group">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2 mb-1">
                    {trade.status === TradeStatus.OPEN ? (
                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-slate-600"></span>
                    )}
                    <span className={`text-[10px] font-black uppercase ${trade.status === TradeStatus.OPEN ? 'text-blue-400' : 'text-slate-500'}`}>
                      {trade.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-bold">{trade.date}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="font-black text-white tracking-tight">{trade.symbol}</div>
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Size: {trade.amount}</div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black tracking-widest border ${trade.type === TradeType.LONG ? 'bg-emerald-900/30 text-emerald-400 border-emerald-500/20' : 'bg-rose-900/30 text-rose-400 border-rose-500/20'}`}>
                    {trade.type}
                  </span>
                </td>
                <td className="px-6 py-4 text-right font-mono text-xs">
                  <div className="text-slate-300">{trade.entryPrice.toLocaleString()}</div>
                  <div className="text-slate-500">{trade.status === TradeStatus.OPEN ? '---' : trade.exitPrice?.toLocaleString()}</div>
                </td>
                <td className={`px-6 py-4 text-right font-black text-sm ${trade.status === TradeStatus.OPEN ? 'text-slate-600' : (trade.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400')}`}>
                  {trade.status === TradeStatus.OPEN ? 'WAITING' : `${trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}`}
                </td>
                <td className={`px-6 py-4 text-right font-black text-sm ${trade.status === TradeStatus.OPEN ? 'text-slate-600' : (trade.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400')}`}>
                  {trade.status === TradeStatus.OPEN ? '0.00%' : `${trade.pnl >= 0 ? '+' : ''}${trade.pnlPercentage.toFixed(2)}%`}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-center gap-3">
                    {trade.status === TradeStatus.OPEN && (
                      <button 
                        onClick={() => handleCloseClick(trade.id)}
                        className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black px-3 py-1 rounded-lg transition-all"
                      >
                        CLOSE
                      </button>
                    )}
                    <button 
                      onClick={() => onDelete(trade.id)}
                      className="text-slate-600 hover:text-rose-500 transition-colors"
                    >
                      <i className="fas fa-trash-alt"></i>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {trades.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-20 text-center">
                  <div className="flex flex-col items-center opacity-20">
                    <i className="fas fa-box-open text-5xl mb-4"></i>
                    <p className="text-xs font-black uppercase tracking-widest">Brak zapisanych operacji</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TradeTable;
