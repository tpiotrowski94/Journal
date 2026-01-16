
import React, { useState } from 'react';
import { Trade, TradeStatus, TradeType, NoteEntry } from '../types';
import TradeActionModal from './TradeActionModal';

interface TradeTableProps {
  trades: Trade[];
  onDelete: (id: string) => void;
  onCloseTrade: (id: string, exitPrice: number, exitFees: number, notes?: string, fundingFees?: number) => void;
  onAddToPosition: (id: string, additionalAmount: number, additionalPrice: number, additionalFees: number, newLeverage?: number, fundingFees?: number) => void;
  onEditTrade: (id: string, updatedData: any) => void;
  onAddNote: (id: string, text: string) => void;
  onUpdateNote: (tradeId: string, noteId: string, text: string) => void;
  onDeleteNote: (tradeId: string, noteId: string) => void;
  onExport?: () => void;
  walletBalance: number;
}

const TradeTable: React.FC<TradeTableProps> = ({ 
  trades, onDelete, onCloseTrade, onAddToPosition, onEditTrade, 
  onAddNote, onUpdateNote, onDeleteNote, onExport, walletBalance 
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

      <div className="p-4 md:px-6 md:py-5 border-b border-slate-700 flex justify-between items-center bg-slate-800/80">
        <h2 className="text-lg md:text-xl font-black text-white flex items-center gap-3 uppercase italic tracking-tighter">
          <i className="fas fa-list-ul text-emerald-500"></i> Active & History
        </h2>
        <div className="flex gap-2">
           <button onClick={onExport} className="bg-slate-900 text-slate-300 hover:text-white text-[10px] font-black px-4 py-2 rounded-xl border border-slate-700 uppercase transition-all flex items-center gap-2 shadow-inner">
             <i className="fas fa-download text-emerald-500"></i> JSON
           </button>
        </div>
      </div>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left table-auto">
          <thead>
            <tr className="bg-slate-900/60 text-slate-400 text-[9px] font-black uppercase tracking-widest border-b border-slate-700">
              <th className="px-4 py-4">Type</th>
              <th className="px-4 py-4">Asset</th>
              <th className="px-4 py-4">Conv.</th>
              <th className="px-4 py-4">Entry / Exit</th>
              <th className="px-4 py-4">Total Fees</th>
              <th className="px-4 py-4 text-right">Risk</th>
              <th className="px-4 py-4 text-right">PnL</th>
              <th className="px-4 py-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {trades.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center text-slate-500 text-xs font-black uppercase tracking-[0.3em] opacity-40">
                  No trades recorded
                </td>
              </tr>
            ) : trades.map((trade, idx) => {
              const riskVal = Number(trade.initialRisk) || 0;
              const pnlVal = Number(trade.pnl) || 0;
              const pnlPctVal = Number(trade.pnlPercentage) || 0;
              const feesVal = Number(trade.fees) || 0;
              const fundingVal = Number(trade.fundingFees) || 0;
              const balanceVal = Number(walletBalance) || 1;

              const walletRiskPct = balanceVal > 0
                ? ((riskVal / balanceVal) * 100).toFixed(2)
                : "0.00";

              const conf = trade.confidence || 3;

              // Sort notes by date descending (newest on top)
              const sortedNotes = Array.isArray(trade.notes) 
                ? [...trade.notes].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                : [];

              return (
                <React.Fragment key={trade.id}>
                  <tr className={`${idx % 2 === 0 ? 'bg-transparent' : 'bg-slate-800/30'} hover:bg-slate-700/40 transition-colors group`}>
                    <td className="px-4 py-4 align-top">
                      <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-tight shadow-sm ${trade.type === TradeType.LONG ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                        {trade.type}
                      </span>
                      <div className="text-[8px] text-slate-400 font-bold mt-2 opacity-80 uppercase">{formatTradeDate(trade.date).split(',')[0]}</div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="font-black text-white text-sm md:text-base tracking-tight group-hover:text-emerald-400 transition-colors">{trade.symbol}</div>
                      <div className="text-[10px] text-blue-400 font-black uppercase mt-0.5">
                        {trade.leverage}x <span className="bg-blue-400/10 px-1.5 py-0.5 rounded text-[8px]">{trade.marginMode}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex gap-1 mb-1.5">
                        {[1, 2, 3, 4, 5].map(i => (
                          <div key={i} className={`w-2 h-1.5 rounded-full ${i <= conf ? (conf <= 2 ? 'bg-rose-500' : conf === 3 ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-slate-700'}`} />
                        ))}
                      </div>
                      <div className={`text-[9px] font-black uppercase tracking-tighter ${getConfidenceColor(conf)}`}>
                        {confidenceLabels[conf - 1]}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-col gap-1 leading-none">
                        <div className="font-mono text-[12px] text-slate-100 font-bold whitespace-nowrap">
                          <span className="text-[8px] text-slate-500 uppercase mr-1.5">ENTRY</span>${(Number(trade.entryPrice) || 0).toLocaleString()}
                        </div>
                        <div className="font-mono text-[12px] font-bold whitespace-nowrap">
                          <span className="text-[8px] text-slate-500 uppercase mr-1.5">EXIT</span>
                          {trade.exitPrice !== null ? (
                            <span className="text-slate-100">${Number(trade.exitPrice).toLocaleString()}</span>
                          ) : (
                            <span className="text-blue-400 text-[9px] tracking-widest font-black animate-pulse">ACTIVE POS</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="text-xs font-black text-slate-300 whitespace-nowrap">
                        -${(feesVal + fundingVal).toFixed(2)}
                      </div>
                      <div className="flex flex-col gap-0.5 mt-1">
                        <span className="text-[7px] text-slate-500 uppercase font-black">Trade: ${feesVal.toFixed(2)}</span>
                        <span className="text-[7px] text-amber-500/80 uppercase font-black">Fund: ${fundingVal.toFixed(2)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right align-top">
                      <div className={`font-black text-xs ${!trade.stopLoss ? 'text-rose-500 animate-pulse' : 'text-rose-400'}`}>
                        SL: {!trade.stopLoss ? 'LIQ' : `$${trade.stopLoss}`} <span className="text-[9px] opacity-70">({walletRiskPct}%)</span>
                      </div>
                    </td>
                    <td className={`px-4 py-4 text-right align-top`}>
                      {trade.status === TradeStatus.OPEN ? (
                        <span className="text-[9px] font-black text-blue-400 bg-blue-500/10 border border-blue-500/30 px-2 py-1 rounded-lg uppercase tracking-wider">OPEN</span>
                      ) : (
                        <div className="leading-tight">
                          <div className={`font-black text-base ${pnlVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {pnlVal >= 0 ? '+' : ''}{pnlVal.toFixed(2)}
                          </div>
                          <div className={`text-[10px] font-black uppercase ${pnlVal >= 0 ? 'text-emerald-600/80' : 'text-rose-500'}`}>
                            {(pnlPctVal >= 0 ? '+' : '') + pnlPctVal.toFixed(1) + '%'}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex justify-center items-center gap-1.5">
                        {trade.status === TradeStatus.OPEN && (
                          <button 
                            onClick={() => setModalState({ type: 'EXIT', trade })} 
                            className="bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white px-2 py-1 rounded-lg text-[10px] font-black uppercase transition-all border border-blue-500/20"
                          >
                            Exit
                          </button>
                        )}
                        <button 
                          onClick={() => setModalState({ type: 'LOG', trade })} 
                          className="bg-slate-700/50 text-slate-400 hover:text-emerald-400 p-1.5 rounded-lg transition-colors border border-transparent hover:border-emerald-500/20"
                          title="Add Log Entry"
                        >
                          <i className="fas fa-file-pen text-sm"></i>
                        </button>
                        <button 
                          onClick={() => setModalState({ type: 'EDIT', trade })} 
                          className="text-slate-400 hover:text-white p-1.5 transition-colors"
                          title="Edit Position"
                        >
                          <i className="fas fa-cog text-sm"></i>
                        </button>
                        <button 
                          onClick={() => onDelete(trade.id)} 
                          className="text-slate-500 hover:text-rose-500 p-1.5 transition-colors"
                        >
                          <i className="fas fa-trash-alt text-sm"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr className={`${idx % 2 === 0 ? 'bg-transparent' : 'bg-slate-800/30'} border-b border-slate-700/20`}>
                    <td colSpan={8} className="px-4 pb-6 pt-0">
                       <div className="ml-[4.5rem] mt-2 space-y-3 relative border-l-2 border-slate-700/50 pl-6 py-1">
                          {sortedNotes.length > 0 ? sortedNotes.map((note) => (
                            <div key={note.id} className="relative group/note">
                               <div className="absolute -left-[1.95rem] top-1.5 w-3 h-3 bg-slate-800 border-2 border-slate-600 rounded-full" />
                               <div className="flex flex-col gap-0.5">
                                 <div className="flex justify-between items-center max-w-2xl">
                                    <div className="flex items-center gap-2">
                                       <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">{formatTradeDate(note.date)}</span>
                                       {/* Highlight latest note */}
                                       {note.id === sortedNotes[0].id && (
                                         <span className="text-[7px] bg-emerald-500/10 text-emerald-500 px-1 rounded font-black uppercase">Latest</span>
                                       )}
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover/note:opacity-100 transition-opacity">
                                       <button 
                                          onClick={() => setModalState({ type: 'EDIT_NOTE', trade, extra: { note } })}
                                          className="text-[9px] text-emerald-500 font-black uppercase hover:underline"
                                       >Edit</button>
                                       <button 
                                          onClick={() => onDeleteNote(trade.id, note.id)}
                                          className="text-[9px] text-rose-500 font-black uppercase hover:underline"
                                       >Delete</button>
                                    </div>
                                 </div>
                                 <p className="text-[11px] text-slate-300 font-medium leading-relaxed max-w-2xl whitespace-pre-wrap">{note.text}</p>
                               </div>
                            </div>
                          )) : (
                            <p className="text-[10px] text-slate-600 italic uppercase font-black opacity-40">No entries documented.</p>
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
