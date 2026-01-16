
import React, { useState } from 'react';
import { Trade, TradeStatus, TradeType, NoteEntry } from '../types';
import TradeActionModal from './TradeActionModal';

interface TradeTableProps {
  title: string;
  trades: Trade[];
  status: TradeStatus;
  onDelete: (id: string) => void;
  onCloseTrade: (id: string, exitPrice: number, exitFees: number, notes?: string, fundingFees?: number) => void;
  onAddToPosition: (id: string, additionalAmount: number, additionalPrice: number, additionalFees: number, newLeverage?: number, fundingFees?: number) => void;
  onEditTrade: (id: string, updatedData: any) => void;
  onAddNote: (id: string, text: string) => void;
  onUpdateNote: (tradeId: string, noteId: string, text: string) => void;
  onDeleteNote: (tradeId: string, noteId: string) => void;
  onExport?: () => void;
  walletBalance: number;
  accentColor?: string;
  icon?: string;
}

const TradeTable: React.FC<TradeTableProps> = ({ 
  title, trades, status, onDelete, onCloseTrade, onAddToPosition, onEditTrade, 
  onAddNote, onUpdateNote, onDeleteNote, onExport, walletBalance, accentColor = 'emerald', icon = 'fa-bolt'
}) => {
  const [modalState, setModalState] = useState<{ 
    type: 'ADD' | 'EXIT' | 'EDIT' | 'LOG' | 'EDIT_NOTE', 
    trade: Trade,
    extra?: { note?: NoteEntry }
  } | null>(null);

  const handleModalConfirm = (data: any) => {
    if (!modalState) return;

    if (modalState.type === 'EXIT') {
      onCloseTrade(modalState.trade.id, data.price, data.fees, data.notes, data.fundingFees);
    } else if (modalState.type === 'ADD') {
      onAddToPosition(modalState.trade.id, data.amount, data.price, data.fees, data.leverage, data.fundingFees);
    } else if (modalState.type === 'EDIT') {
      onEditTrade(modalState.trade.id, data);
    } else if (modalState.type === 'LOG') {
      onAddNote(modalState.trade.id, data.text);
    } else if (modalState.type === 'EDIT_NOTE' && modalState.extra?.note) {
      onUpdateNote(modalState.trade.id, modalState.extra.note.id, data.text);
    }
    setModalState(null);
  };

  const formatTradeDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
    } catch (e) {
      return dateStr || '-';
    }
  };

  const confidenceLabels = ["Gambling", "Speculation", "Neutral", "Solid Setup", "Strong Signal"];
  const getConfidenceColor = (level: number) => {
    if (level <= 2) return 'text-rose-400';
    if (level === 3) return 'text-amber-400';
    return 'text-emerald-400';
  };

  const colorClasses = {
    emerald: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/5',
    blue: 'text-blue-400 border-blue-500/30 bg-blue-500/5',
    slate: 'text-slate-400 border-slate-700 bg-slate-800/50'
  }[accentColor] || 'text-emerald-500 border-emerald-500/30 bg-emerald-500/5';

  const iconColor = {
    emerald: 'text-emerald-500',
    blue: 'text-blue-400',
    slate: 'text-slate-500'
  }[accentColor] || 'text-emerald-500';

  return (
    <div className="bg-[#1e293b] rounded-3xl border border-slate-700 overflow-hidden shadow-2xl">
      {modalState && (
        <TradeActionModal 
          trade={modalState.trade}
          type={modalState.type}
          extra={modalState.extra}
          onClose={() => setModalState(null)}
          onConfirm={handleModalConfirm}
        />
      )}

      {/* Header Section */}
      <div className="p-5 md:px-7 border-b border-slate-700 bg-slate-800/40 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${colorClasses}`}>
             <i className={`fas ${icon} text-lg`}></i>
          </div>
          <div>
            <h2 className="text-lg font-black text-white uppercase italic tracking-tighter leading-none">{title}</h2>
            <div className="flex items-center gap-2 mt-1.5">
               <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total Entries:</span>
               <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${colorClasses}`}>{trades.length}</span>
            </div>
          </div>
        </div>
        
        {onExport && (
          <button onClick={onExport} className="bg-slate-900 text-slate-400 hover:text-white text-[9px] font-black px-4 py-2 rounded-xl border border-slate-700 uppercase transition-all flex items-center gap-2">
            <i className="fas fa-file-export"></i> Backup History
          </button>
        )}
      </div>

      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left table-auto">
          <thead>
            <tr className="bg-slate-900/40 text-slate-500 text-[9px] font-black uppercase tracking-widest border-b border-slate-700">
              <th className="px-6 py-4">Side / Date</th>
              <th className="px-6 py-4">Asset</th>
              <th className="px-6 py-4">Conf.</th>
              <th className="px-6 py-4">Execution (USDT)</th>
              <th className="px-6 py-4">Costs</th>
              <th className="px-6 py-4 text-right">Risk/SL</th>
              <th className="px-6 py-4 text-right">Result</th>
              <th className="px-6 py-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {trades.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-16 text-center text-slate-600 text-[10px] font-black uppercase tracking-[0.4em] italic opacity-40">
                  Section Empty
                </td>
              </tr>
            ) : trades.map((trade, idx) => {
              const riskVal = Number(trade.initialRisk) || 0;
              const pnlVal = Number(trade.pnl) || 0;
              const pnlPctVal = Number(trade.pnlPercentage) || 0;
              const feesVal = Number(trade.fees) || 0;
              const fundingVal = Number(trade.fundingFees) || 0;
              const balanceVal = Number(walletBalance) || 1;

              const walletRiskPct = balanceVal > 0 ? ((riskVal / balanceVal) * 100).toFixed(2) : "0.00";
              const conf = trade.confidence || 3;

              const sortedNotes = Array.isArray(trade.notes) 
                ? [...trade.notes].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                : [];

              return (
                <React.Fragment key={trade.id}>
                  <tr className={`${idx % 2 === 0 ? 'bg-transparent' : 'bg-slate-800/20'} hover:bg-slate-700/30 transition-colors group border-b border-slate-800/50`}>
                    <td className="px-6 py-5 align-top">
                      <div className={`text-[9px] font-black px-2 py-0.5 rounded inline-block uppercase tracking-tight shadow-sm ${trade.type === TradeType.LONG ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
                        {trade.type}
                      </div>
                      <div className="text-[8px] text-slate-500 font-bold mt-2 uppercase leading-none opacity-60">{formatTradeDate(trade.date)}</div>
                    </td>
                    <td className="px-6 py-5 align-top">
                      <div className="font-black text-white text-sm tracking-tight group-hover:text-blue-400 transition-colors">{trade.symbol}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] text-blue-500 font-black uppercase">{trade.leverage}x</span>
                        <span className="bg-slate-900 px-1.5 py-0.5 rounded text-[8px] font-black text-slate-500 uppercase border border-slate-700">{trade.marginMode}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 align-top">
                      <div className="flex gap-1 mb-1.5">
                        {[1, 2, 3, 4, 5].map(i => (
                          <div key={i} className={`w-2 h-1 rounded-full ${i <= conf ? (conf <= 2 ? 'bg-rose-500' : conf === 3 ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-slate-700'}`} />
                        ))}
                      </div>
                      <div className={`text-[9px] font-black uppercase tracking-tighter ${getConfidenceColor(conf)}`}>
                        {confidenceLabels[conf - 1]}
                      </div>
                    </td>
                    <td className="px-6 py-5 align-top">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                           <span className="text-[7px] w-8 text-slate-600 font-black uppercase">Entry</span>
                           <span className="font-mono text-[11px] text-slate-200 font-bold">${(Number(trade.entryPrice) || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                           <span className="text-[7px] w-8 text-slate-600 font-black uppercase">Exit</span>
                           {trade.exitPrice !== null ? (
                             <span className="font-mono text-[11px] text-blue-400 font-bold">${Number(trade.exitPrice).toLocaleString()}</span>
                           ) : (
                             <span className="text-emerald-500 text-[8px] font-black uppercase tracking-widest animate-pulse">Running</span>
                           )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 align-top">
                      <div className="text-[11px] font-black text-slate-400">
                        ${(feesVal + fundingVal).toFixed(2)}
                      </div>
                      <div className="mt-1 space-y-0.5 opacity-60">
                        <div className="text-[7px] text-slate-500 uppercase font-black">Fee: ${feesVal.toFixed(2)}</div>
                        <div className={`text-[7px] uppercase font-black ${fundingVal >= 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                          Fund: {fundingVal >= 0 ? '+' : ''}{fundingVal.toFixed(2)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right align-top">
                      <div className={`font-black text-[11px] ${!trade.stopLoss ? 'text-rose-500' : 'text-slate-300'}`}>
                        {trade.stopLoss ? `$${trade.stopLoss}` : 'NO SL'}
                      </div>
                      <div className="text-[8px] font-black text-rose-500/50 uppercase mt-1">Risk: ${riskVal.toFixed(0)}</div>
                    </td>
                    <td className={`px-6 py-5 text-right align-top`}>
                      {trade.status === TradeStatus.OPEN ? (
                        <div className="flex flex-col items-end">
                          <span className="text-[8px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-widest">Active</span>
                        </div>
                      ) : (
                        <div className="leading-none flex flex-col items-end">
                          <div className={`font-black text-sm ${pnlVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {pnlVal >= 0 ? '+' : ''}{pnlVal.toFixed(2)} $
                          </div>
                          <div className={`text-[10px] font-black uppercase mt-1 ${pnlVal >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {(pnlPctVal >= 0 ? '+' : '') + pnlPctVal.toFixed(1) + '%'}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-5 align-top">
                      <div className="flex justify-center items-center gap-1">
                        {trade.status === TradeStatus.OPEN ? (
                          <>
                            <button 
                              onClick={() => setModalState({ type: 'EXIT', trade })} 
                              className="bg-blue-600 text-white hover:bg-blue-500 px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all shadow-lg shadow-blue-500/20"
                            >
                              Exit
                            </button>
                            <button 
                              onClick={() => setModalState({ type: 'ADD', trade })} 
                              className="bg-slate-700 text-slate-300 hover:text-white px-2 py-1 rounded-lg text-[9px] font-black uppercase transition-all border border-slate-600"
                            >
                              Add
                            </button>
                          </>
                        ) : null}
                        <button 
                          onClick={() => setModalState({ type: 'LOG', trade })} 
                          className="text-slate-600 hover:text-emerald-400 p-1.5 transition-colors"
                          title="Add Note"
                        >
                          <i className="fas fa-edit text-xs"></i>
                        </button>
                        <button 
                          onClick={() => setModalState({ type: 'EDIT', trade })} 
                          className="text-slate-600 hover:text-blue-400 p-1.5 transition-colors"
                          title="Settings"
                        >
                          <i className="fas fa-cog text-xs"></i>
                        </button>
                        <button 
                          onClick={() => { if(confirm("Delete this trade?")) onDelete(trade.id); }} 
                          className="text-slate-700 hover:text-rose-500 p-1.5 transition-colors"
                        >
                          <i className="fas fa-trash text-xs"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                  
                  {/* Notes Row */}
                  <tr className={`${idx % 2 === 0 ? 'bg-transparent' : 'bg-slate-800/20'}`}>
                    <td colSpan={8} className="px-6 pb-5 pt-2">
                       <div className="ml-6 space-y-2 relative border-l-2 border-slate-700/50 pl-6 py-1">
                          {sortedNotes.length > 0 ? sortedNotes.map((note) => (
                            <div key={note.id} className="relative group/note flex flex-col gap-0.5 mb-2">
                               <div className="absolute -left-[1.85rem] top-1.5 w-2 h-2 bg-slate-700 rounded-full border-2 border-[#1e293b]" />
                               <div className="flex items-center gap-3">
                                  <span className="text-[7px] font-black text-slate-600 uppercase tracking-tighter">{formatTradeDate(note.date)}</span>
                                  <div className="flex gap-3 opacity-0 group-hover/note:opacity-100 transition-opacity">
                                     <button onClick={() => setModalState({ type: 'EDIT_NOTE', trade, extra: { note } })} className="text-[7px] text-blue-500 font-black uppercase">Edit</button>
                                     <button onClick={() => onDeleteNote(trade.id, note.id)} className="text-[7px] text-rose-500 font-black uppercase">Delete</button>
                                  </div>
                               </div>
                               <p className="text-[10px] text-slate-400 font-medium leading-relaxed max-w-3xl whitespace-pre-wrap">{note.text}</p>
                            </div>
                          )) : (
                            <p className="text-[8px] text-slate-600 italic uppercase font-black opacity-30">Journal logs empty.</p>
                          )}
                       </div>
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TradeTable;
