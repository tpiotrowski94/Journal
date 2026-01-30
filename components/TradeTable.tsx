
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
  accentColor?: 'emerald' | 'blue' | 'slate';
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
  
  const colorStyles = {
    emerald: {
      border: 'border-emerald-500/30',
      bg: 'bg-emerald-500/5',
      icon: 'text-emerald-500',
      badge: 'bg-emerald-500 text-white'
    },
    blue: {
      border: 'border-blue-500/30',
      bg: 'bg-blue-500/5',
      icon: 'text-blue-400',
      badge: 'bg-blue-500 text-white'
    },
    slate: {
      border: 'border-slate-700',
      bg: 'bg-slate-800/50',
      icon: 'text-slate-400',
      badge: 'bg-slate-700 text-slate-300'
    }
  }[accentColor];

  const isOpenTable = status === TradeStatus.OPEN;

  return (
    <div className="space-y-4">
      {modalState && (
        <TradeActionModal 
          trade={modalState.trade}
          type={modalState.type}
          extra={modalState.extra}
          onClose={() => setModalState(null)}
          onConfirm={handleModalConfirm}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border shadow-lg ${colorStyles.border} ${colorStyles.bg}`}>
            <i className={`fas ${icon} ${colorStyles.icon} text-lg`}></i>
          </div>
          <div>
            <h2 className="text-lg font-black text-white uppercase italic tracking-tighter leading-none">{title}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Records:</span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${colorStyles.badge}`}>{trades.length}</span>
            </div>
          </div>
        </div>
        {onExport && (
          <button onClick={onExport} className="bg-slate-800 text-slate-400 hover:text-white text-[9px] font-black px-4 py-2 rounded-xl border border-slate-700 uppercase transition-all flex items-center gap-2">
            <i className="fas fa-file-export"></i> Backup
          </button>
        )}
      </div>

      <div className="bg-[#1e293b] rounded-3xl border border-slate-700 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left table-auto">
            <thead>
              <tr className="bg-slate-900/40 text-slate-500 text-[9px] font-black uppercase tracking-widest border-b border-slate-700">
                <th className="px-6 py-4">Market / Side</th>
                <th className="px-6 py-4">Position Exposure</th>
                <th className="px-6 py-4">Execution Prices</th>
                <th className="px-6 py-4">Operational Costs</th>
                <th className="px-6 py-4 text-right">{isOpenTable ? 'Stop Loss / Risk' : 'Outcome & PnL'}</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {trades.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-600 text-[10px] font-black uppercase tracking-[0.4em] italic opacity-30">
                    No records in this section
                  </td>
                </tr>
              ) : trades.map((trade, idx) => {
                const entryVal = Number(trade.entryPrice) || 0;
                const amountVal = Number(trade.amount) || 0;
                const leverageVal = Number(trade.leverage) || 1;
                const notionalVal = entryVal * amountVal;
                const marginVal = notionalVal / leverageVal;

                const riskVal = Number(trade.initialRisk) || 0;
                const pnlVal = Number(trade.pnl) || 0;
                const pnlPctVal = Number(trade.pnlPercentage) || 0;
                const feesVal = Number(trade.fees) || 0;
                const fundingVal = Number(trade.fundingFees) || 0;
                const conf = trade.confidence || 3;

                const sortedNotes = Array.isArray(trade.notes) 
                  ? [...trade.notes].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  : [];

                return (
                  <React.Fragment key={trade.id}>
                    <tr className={`${idx % 2 === 0 ? 'bg-transparent' : 'bg-slate-800/20'} hover:bg-slate-700/30 transition-colors group border-b border-slate-800/50`}>
                      <td className="px-6 py-5 align-top">
                        <div className="font-black text-white text-sm tracking-tight group-hover:text-blue-400 transition-colors flex items-center gap-2">
                           {trade.symbol}
                           <div className={`text-[7px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-tight ${trade.type === TradeType.LONG ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
                            {trade.type}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="text-[9px] text-blue-500 font-black uppercase">{trade.leverage}x</span>
                          <span className="bg-slate-900 px-1.5 py-0.5 rounded text-[8px] font-black text-slate-500 uppercase border border-slate-700">{trade.marginMode}</span>
                        </div>
                        
                        {/* Confidence Indicator in first column */}
                        <div className="mt-3 flex items-center gap-2">
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map(i => (
                              <div key={i} className={`w-1.5 h-1 rounded-full ${i <= conf ? (conf <= 2 ? 'bg-rose-500' : conf === 3 ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-slate-700'}`} />
                            ))}
                          </div>
                          <span className="text-[7px] font-black text-slate-500 uppercase tracking-tighter">{confidenceLabels[conf-1]}</span>
                        </div>
                      </td>
                      
                      <td className="px-6 py-5 align-top">
                        <div className="flex flex-col">
                           <div className="text-white font-black text-[13px] tracking-tighter">
                             ${notionalVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                           </div>
                           <div className="text-[10px] text-slate-400 font-bold mt-0.5 flex items-center gap-1">
                             <i className="fas fa-coins text-[8px] text-slate-600"></i>
                             {amountVal.toLocaleString(undefined, { maximumFractionDigits: 8 })} <span className="text-[8px] text-slate-500">{trade.symbol.split('/')[0]}</span>
                           </div>
                           <div className="mt-2 flex items-center gap-1.5">
                             <span className="text-[7px] font-black text-slate-600 uppercase">Est. Margin:</span>
                             <span className="text-[9px] font-black text-emerald-500/80">${marginVal.toFixed(2)}</span>
                           </div>
                        </div>
                      </td>

                      <td className="px-6 py-5 align-top">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                             <span className="text-[7px] w-8 text-slate-600 font-black uppercase">Avg In</span>
                             <span className="font-mono text-[11px] text-slate-200 font-bold">${entryVal.toLocaleString()}</span>
                          </div>
                          {!isOpenTable && (
                            <div className="flex items-center gap-2">
                               <span className="text-[7px] w-8 text-slate-600 font-black uppercase">Exit</span>
                               <span className="font-mono text-[11px] text-blue-400 font-bold">${Number(trade.exitPrice).toLocaleString()}</span>
                            </div>
                          )}
                          <div className="text-[8px] text-slate-500 font-bold uppercase mt-1 opacity-60">
                             {formatTradeDate(trade.date)}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-5 align-top">
                        <div className="text-[11px] font-black text-slate-400">
                          ${(feesVal + fundingVal).toFixed(2)}
                        </div>
                        <div className="mt-1 space-y-0.5">
                          <div className="text-[7px] text-slate-500 uppercase font-black opacity-60">Fees: ${feesVal.toFixed(2)}</div>
                          <div className={`text-[7px] uppercase font-black flex items-center gap-1 ${fundingVal > 0 ? 'text-amber-500' : fundingVal < 0 ? 'text-emerald-500' : 'text-slate-500'}`}>
                            Fund: {fundingVal > 0 ? '+' : ''}{fundingVal.toFixed(2)} 
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-5 text-right align-top">
                        {isOpenTable ? (
                          <>
                            <div className={`font-black text-[12px] ${!trade.stopLoss ? 'text-rose-500' : 'text-slate-300'}`}>
                              {trade.stopLoss ? `$${trade.stopLoss}` : 'NO SL'}
                            </div>
                            <div className="text-[8px] font-black text-rose-500/70 uppercase mt-1">Risked: ${riskVal.toFixed(0)}</div>
                            <div className="mt-2">
                              <span className="text-[8px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-widest">Active</span>
                            </div>
                          </>
                        ) : (
                          <div className="leading-none flex flex-col items-end">
                            <div className={`font-black text-[15px] ${pnlVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {pnlVal >= 0 ? '+' : ''}{pnlVal.toFixed(2)} $
                            </div>
                            <div className={`text-[10px] font-black uppercase mt-1.5 ${pnlVal >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {(pnlPctVal >= 0 ? '+' : '') + pnlPctVal.toFixed(1) + '%'} ROE
                            </div>
                          </div>
                        )}
                      </td>
                      
                      <td className="px-6 py-5 align-top">
                        <div className="flex justify-center items-center gap-1.5">
                          {trade.status === TradeStatus.OPEN ? (
                            <>
                              <button 
                                onClick={() => setModalState({ type: 'EXIT', trade })} 
                                className="bg-blue-600 text-white hover:bg-blue-500 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all shadow-lg"
                              >
                                Exit
                              </button>
                              <button 
                                onClick={() => setModalState({ type: 'ADD', trade })} 
                                className="bg-slate-700 text-slate-300 hover:text-white px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all border border-slate-600"
                              >
                                Add
                              </button>
                            </>
                          ) : null}
                          <div className="flex items-center gap-1 border-l border-slate-700 ml-1 pl-1">
                            <button onClick={() => setModalState({ type: 'LOG', trade })} className="text-slate-600 hover:text-emerald-400 p-2"><i className="fas fa-file-signature text-xs"></i></button>
                            <button onClick={() => setModalState({ type: 'EDIT', trade })} className="text-slate-600 hover:text-blue-400 p-2"><i className="fas fa-cog text-xs"></i></button>
                            <button onClick={() => { if(confirm("Delete trade?")) onDelete(trade.id); }} className="text-slate-700 hover:text-rose-500 p-2"><i className="fas fa-trash-alt text-xs"></i></button>
                          </div>
                        </div>
                      </td>
                    </tr>
                    
                    {/* Notes Row */}
                    <tr className={`${idx % 2 === 0 ? 'bg-transparent' : 'bg-slate-800/20'}`}>
                      <td colSpan={6} className="px-6 pb-5 pt-2">
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
                              <p className="text-[8px] text-slate-600 italic uppercase font-black opacity-25">Journal timeline is empty.</p>
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
    </div>
  );
};

export default TradeTable;
