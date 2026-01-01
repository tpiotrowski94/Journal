
import React, { useState } from 'react';
import { Trade, TradeStatus, TradeType } from '../types';
import TradeActionModal from './TradeActionModal';

interface TradeTableProps {
  trades: Trade[];
  onDelete: (id: string) => void;
  onCloseTrade: (id: string, exitPrice: number) => void;
  onAddToPosition: (id: string, additionalAmount: number, additionalPrice: number, newLeverage?: number) => void;
  onEditTrade: (id: string, updatedData: any) => void;
  onExport?: () => void;
  walletBalance: number;
}

const TradeTable: React.FC<TradeTableProps> = ({ trades, onDelete, onCloseTrade, onAddToPosition, onEditTrade, onExport, walletBalance }) => {
  const [modalState, setModalState] = useState<{ type: 'ADD' | 'EXIT' | 'EDIT', trade: Trade } | null>(null);

  const handleModalConfirm = (data: any) => {
    if (!modalState) return;

    if (modalState.type === 'EXIT') {
      onCloseTrade(modalState.trade.id, data.price);
    } else if (modalState.type === 'ADD') {
      onAddToPosition(modalState.trade.id, data.amount, data.price, data.leverage);
    } else if (modalState.type === 'EDIT') {
      onEditTrade(modalState.trade.id, data);
    }
    setModalState(null);
  };

  const formatTradeDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      // Ręczne formatowanie, aby uniknąć problemów z lokalnymi ustawieniami
      const date = d.toISOString().split('T')[0];
      const time = d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return { date, time };
    } catch (e) {
      return { date: dateStr, time: '' };
    }
  };

  return (
    <div className="bg-slate-800 rounded-3xl border border-slate-700 overflow-hidden shadow-2xl">
      {modalState && (
        <TradeActionModal 
          trade={modalState.trade}
          type={modalState.type}
          onClose={() => setModalState(null)}
          onConfirm={handleModalConfirm}
        />
      )}

      <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
        <h2 className="text-xl font-black text-white flex items-center gap-3 uppercase italic tracking-tighter">
          <i className="fas fa-list-ul text-emerald-500"></i> Live History & Active
        </h2>
        <div className="flex gap-2">
           <button onClick={onExport} className="bg-slate-900 text-slate-500 hover:text-white text-[9px] font-black px-4 py-2 rounded-full border border-slate-700 uppercase transition-all flex items-center gap-2">
             <i className="fas fa-download"></i> Backup JSON
           </button>
        </div>
      </div>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-900/40 text-slate-500 text-[9px] font-black uppercase tracking-[0.2em]">
              <th className="px-6 py-4">Side</th>
              <th className="px-6 py-4">Asset / Mode</th>
              <th className="px-6 py-4">Entry</th>
              <th className="px-6 py-4">Execution Time</th>
              <th className="px-6 py-4 text-right">Risk %</th>
              <th className="px-6 py-4 text-right">P&L Result</th>
              <th className="px-6 py-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {trades.map((trade) => {
              const rrRatio = trade.initialRisk && trade.status === TradeStatus.CLOSED && trade.initialRisk !== 0
                ? (trade.pnl / trade.initialRisk).toFixed(2) 
                : null;
              
              const walletRiskPct = trade.initialRisk && walletBalance > 0
                ? ((trade.initialRisk / walletBalance) * 100).toFixed(2)
                : '0.00';

              const { date, time } = formatTradeDate(trade.date);

              return (
                <tr key={trade.id} className="hover:bg-slate-700/20 transition-colors">
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-tighter ${trade.type === TradeType.LONG ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'}`}>
                      {trade.type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-black text-white text-sm tracking-tight">{trade.symbol}</div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase">{trade.leverage}x {trade.marginMode}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-mono text-[11px] text-slate-300">${trade.entryPrice.toLocaleString()}</div>
                    <div className="text-[9px] text-slate-600 font-bold uppercase">Size: {trade.amount}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-[10px] text-slate-300 font-bold">{date}</div>
                    <div className="text-[9px] text-emerald-500/60 font-mono uppercase italic">{time}</div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="font-black text-[11px] text-rose-400">{walletRiskPct}%</div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase">${trade.initialRisk?.toFixed(2)}</div>
                  </td>
                  <td className={`px-6 py-4 text-right`}>
                    {trade.status === TradeStatus.OPEN ? (
                      <span className="text-[10px] font-black text-blue-400 animate-pulse uppercase tracking-widest border border-blue-400/30 px-2 py-0.5 rounded-full">ACTIVE</span>
                    ) : (
                      <>
                        <div className={`font-black text-xs ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)} ({trade.pnlPercentage.toFixed(1)}%)
                        </div>
                        {rrRatio && <div className="text-[9px] font-bold text-slate-500 uppercase">R:R {rrRatio}</div>}
                      </>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-2">
                      {trade.status === TradeStatus.OPEN ? (
                        <>
                          <button 
                            onClick={() => setModalState({ type: 'EDIT', trade })} 
                            className="bg-slate-700 text-slate-400 hover:text-white px-2 py-1 rounded-lg text-[9px] font-black transition-all"
                            title="Edit"
                          >
                            <i className="fas fa-pencil-alt"></i>
                          </button>
                          <button 
                            onClick={() => setModalState({ type: 'ADD', trade })} 
                            className="bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white px-2 py-1 rounded-lg text-[9px] font-black transition-all"
                          >
                            ADD
                          </button>
                          <button 
                            onClick={() => setModalState({ type: 'EXIT', trade })} 
                            className="bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white px-2 py-1 rounded-lg text-[9px] font-black transition-all"
                          >
                            EXIT
                          </button>
                        </>
                      ) : (
                        <button onClick={() => onDelete(trade.id)} className="text-slate-600 hover:text-rose-500 transition-colors px-2">
                          <i className="fas fa-trash-alt text-xs"></i>
                        </button>
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
