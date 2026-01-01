
import React, { useState } from 'react';
import { Trade, TradeStatus, TradeType } from '../types';
import TradeActionModal from './TradeActionModal';

interface TradeTableProps {
  trades: Trade[];
  onDelete: (id: string) => void;
  onCloseTrade: (id: string, exitPrice: number, exitFees: number) => void;
  onAddToPosition: (id: string, additionalAmount: number, additionalPrice: number, additionalFees: number, newLeverage?: number) => void;
  onEditTrade: (id: string, updatedData: any) => void;
  onExport?: () => void;
  walletBalance: number;
}

const TradeTable: React.FC<TradeTableProps> = ({ trades, onDelete, onCloseTrade, onAddToPosition, onEditTrade, onExport, walletBalance }) => {
  const [modalState, setModalState] = useState<{ type: 'ADD' | 'EXIT' | 'EDIT', trade: Trade } | null>(null);

  const handleModalConfirm = (data: any) => {
    if (!modalState) return;

    if (modalState.type === 'EXIT') {
      onCloseTrade(modalState.trade.id, data.price, data.fees);
    } else if (modalState.type === 'ADD') {
      onAddToPosition(modalState.trade.id, data.amount, data.price, data.fees, data.leverage);
    } else if (modalState.type === 'EDIT') {
      onEditTrade(modalState.trade.id, data);
    }
    setModalState(null);
  };

  const formatTradeDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const date = d.toISOString().split('T')[0];
      const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      return { date, time };
    } catch (e) {
      return { date: dateStr || '-', time: '' };
    }
  };

  const confidenceLabels = ["Gambling", "Speculation", "Neutral", "Solid Setup", "Strong Signal"];
  const getConfidenceColor = (level: number) => {
    if (level <= 2) return 'text-rose-500';
    if (level === 3) return 'text-amber-500';
    return 'text-emerald-500';
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
          <i className="fas fa-list-ul text-emerald-500"></i> Active & History
        </h2>
        <div className="flex gap-2">
           <button onClick={onExport} className="bg-slate-900 text-slate-400 hover:text-white text-[9px] font-black px-4 py-2 rounded-full border border-slate-700 uppercase transition-all flex items-center gap-2">
             <i className="fas fa-download"></i> Export JSON
           </button>
        </div>
      </div>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-900/40 text-slate-500 text-[9px] font-black uppercase tracking-[0.2em]">
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4">Asset / Mode</th>
              <th className="px-6 py-4">Conviction</th>
              <th className="px-6 py-4">Entry / Exit</th>
              <th className="px-6 py-4">Fees</th>
              <th className="px-6 py-4 text-right">Risk Factor</th>
              <th className="px-6 py-4 text-right">Realized P&L</th>
              <th className="px-6 py-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {trades.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-slate-600 text-[10px] font-black uppercase tracking-widest opacity-30">
                  No trades recorded in this portfolio
                </td>
              </tr>
            ) : trades.map((trade) => {
              const riskVal = Number(trade.initialRisk) || 0;
              const pnlVal = Number(trade.pnl) || 0;
              const pnlPctVal = Number(trade.pnlPercentage) || 0;
              const feesVal = Number(trade.fees) || 0;
              const balanceVal = Number(walletBalance) || 1;

              const rrRatio = riskVal > 0 && trade.status === TradeStatus.CLOSED
                ? (pnlVal / riskVal).toFixed(2) 
                : null;
              
              const walletRiskPct = balanceVal > 0
                ? ((riskVal / balanceVal) * 100).toFixed(2)
                : "0.00";

              const { date, time } = formatTradeDate(trade.date);
              const isNoSL = !trade.stopLoss;
              const conf = trade.confidence || 3;

              return (
                <tr key={trade.id} className="hover:bg-slate-700/20 transition-colors">
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-tighter ${trade.type === TradeType.LONG ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'}`}>
                      {trade.type}
                    </span>
                    <div className="text-[8px] text-slate-500 font-mono mt-1 opacity-60">{date}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-black text-white text-sm tracking-tight">{trade.symbol}</div>
                    <div className="text-[11px] text-blue-400 font-black uppercase tracking-wide">
                      {trade.leverage}x <span className="bg-blue-400/10 px-1 rounded">{trade.marginMode}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-0.5 mb-1">
                      {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className={`w-2 h-1 rounded-full ${i <= conf ? (conf <= 2 ? 'bg-rose-500' : conf === 3 ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-slate-700'}`} />
                      ))}
                    </div>
                    <div className={`text-[9px] font-black uppercase tracking-tighter ${getConfidenceColor(conf)}`}>
                      {confidenceLabels[conf - 1]}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-0.5">
                      <div className="font-mono text-[11px] text-slate-300 font-bold">
                        <span className="text-[8px] text-slate-500 uppercase mr-1">In:</span> ${(Number(trade.entryPrice) || 0).toLocaleString()}
                      </div>
                      <div className="font-mono text-[11px] text-slate-300 font-bold">
                        <span className="text-[8px] text-slate-500 uppercase mr-1">Out:</span> 
                        {trade.exitPrice !== null ? `$${Number(trade.exitPrice).toLocaleString()}` : <span className="text-blue-500 text-[8px] tracking-widest uppercase animate-pulse">Position Open</span>}
                      </div>
                      <div className="text-[8px] text-slate-500 font-black uppercase mt-0.5">
                        Qty: <span className="text-slate-400">{(Number(trade.amount) || 0)}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-[11px] font-bold text-slate-400">
                      {feesVal > 0 ? `-${feesVal.toFixed(2)}` : '0.00'} <span className="text-[8px] text-slate-600">USDT</span>
                    </div>
                    <div className="text-[8px] text-slate-500 uppercase font-black">Total Fees</div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className={`font-black text-[11px] ${isNoSL ? 'text-rose-600 animate-pulse' : 'text-rose-400'}`}>
                      {walletRiskPct}% {isNoSL ? 'LIQ' : ''}
                    </div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase">
                      Risk: ${riskVal.toFixed(2)}
                    </div>
                  </td>
                  <td className={`px-6 py-4 text-right`}>
                    {trade.status === TradeStatus.OPEN ? (
                      <span className="text-[10px] font-black text-blue-400 animate-pulse uppercase tracking-widest border border-blue-400/30 px-2 py-0.5 rounded-full">ACTIVE</span>
                    ) : (
                      <>
                        <div className={`font-black text-sm ${pnlVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {pnlVal >= 0 ? '+' : ''}{pnlVal.toFixed(2)}$
                        </div>
                        <div className={`text-[9px] font-bold uppercase ${pnlVal >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {pnlPctVal.toFixed(2)}%
                        </div>
                        {rrRatio && <div className="text-[9px] font-black text-slate-500 uppercase mt-1">R:R {rrRatio}</div>}
                      </>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col items-center gap-2">
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
                            <button 
                              onClick={() => onDelete(trade.id)} 
                              className="text-slate-600 hover:text-rose-500 transition-colors px-2 flex items-center"
                              title="Delete Active Trade"
                            >
                              <i className="fas fa-trash-alt text-xs"></i>
                            </button>
                          </>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => setModalState({ type: 'EDIT', trade })} 
                              className="bg-slate-700 text-slate-400 hover:text-white px-2 py-1 rounded-lg text-[9px] font-black transition-all"
                            >
                              <i className="fas fa-pencil-alt"></i>
                            </button>
                            <button onClick={() => onDelete(trade.id)} className="text-slate-600 hover:text-rose-500 transition-colors px-2">
                              <i className="fas fa-trash-alt text-xs"></i>
                            </button>
                          </div>
                        )}
                      </div>
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
