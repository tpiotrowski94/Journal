
import React from 'react';
import { Trade, TradeType } from '../types';

interface TradeTableProps {
  trades: Trade[];
  onDelete: (id: string) => void;
}

const TradeTable: React.FC<TradeTableProps> = ({ trades, onDelete }) => {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
      <div className="p-4 border-b border-slate-700 flex justify-between items-center">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <i className="fas fa-history text-emerald-400"></i> Historia Handlu
        </h2>
        <span className="text-sm text-slate-400">{trades.length} Pozycji</span>
      </div>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-900/50 text-slate-400 text-xs uppercase tracking-wider">
              <th className="px-6 py-4">Data</th>
              <th className="px-6 py-4">Asset</th>
              <th className="px-6 py-4">Typ</th>
              <th className="px-6 py-4">Cena</th>
              <th className="px-6 py-4">Ilość</th>
              <th className="px-6 py-4">P&L</th>
              <th className="px-6 py-4">Akcja</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {trades.map((trade) => (
              <tr key={trade.id} className="hover:bg-slate-700/30 transition-colors group">
                <td className="px-6 py-4 text-sm whitespace-nowrap">{trade.date}</td>
                <td className="px-6 py-4 font-bold text-white whitespace-nowrap">{trade.symbol}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-[10px] font-bold ${trade.type === TradeType.LONG ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-500/30' : 'bg-rose-900/40 text-rose-400 border border-rose-500/30'}`}>
                    {trade.type}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm whitespace-nowrap">
                  <div className="text-slate-300">{trade.entryPrice.toLocaleString()}</div>
                  <div className="text-slate-500 text-xs">→ {trade.exitPrice.toLocaleString()}</div>
                </td>
                <td className="px-6 py-4 text-sm whitespace-nowrap">{trade.amount}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className={`font-bold ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)} USDT
                  </div>
                  <div className={`text-xs ${trade.pnl >= 0 ? 'text-emerald-500/70' : 'text-rose-500/70'}`}>
                    ({trade.pnlPercentage.toFixed(2)}%)
                  </div>
                </td>
                <td className="px-6 py-4">
                  <button 
                    onClick={() => onDelete(trade.id)}
                    className="text-slate-500 hover:text-rose-400 transition-colors"
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </td>
              </tr>
            ))}
            {trades.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                  Brak transakcji. Dodaj swoją pierwszą pozycję.
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
