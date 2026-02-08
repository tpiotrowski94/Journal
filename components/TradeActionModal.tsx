
import React, { useState, useEffect } from 'react';
import { Trade, TradeType, MarginMode, TradeStatus, NoteEntry } from '../types';

interface TradeActionModalProps {
  trade: Trade;
  type: 'ADD' | 'EXIT' | 'EDIT' | 'LOG' | 'EDIT_NOTE';
  extra?: { note?: NoteEntry };
  onClose: () => void;
  onConfirm: (data: any) => void;
}

const TradeActionModal: React.FC<TradeActionModalProps> = ({ trade, type, extra, onClose, onConfirm }) => {
  const getNowISO = () => {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - tzOffset).toISOString().slice(0, 19);
  };

  const [price, setPrice] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [leverage, setLeverage] = useState<number>(trade.leverage);
  const [fees, setFees] = useState<string>('0');
  const [fundingFees, setFundingFees] = useState<string>('0');
  const [logText, setLogText] = useState<string>('');
  const [exitDate, setExitDate] = useState<string>(getNowISO());
  
  const [isTotalMode, setIsTotalMode] = useState(false);

  const [editData, setEditData] = useState({
    symbol: trade.symbol,
    type: trade.type,
    marginMode: trade.marginMode,
    leverage: trade.leverage,
    entryPrice: trade.entryPrice.toString(),
    exitPrice: trade.exitPrice?.toString() || '',
    stopLoss: trade.stopLoss?.toString() || '',
    amount: trade.amount.toString(),
    fees: trade.fees.toString(),
    fundingFees: (trade.fundingFees || 0).toString(),
    confidence: trade.confidence || 3
  });

  const cleanNumericInput = (val: string) => {
    return val.replace(/,/g, '').replace(/\s/g, '');
  };

  useEffect(() => {
    if (type === 'EDIT') {
      setEditData({
        symbol: trade.symbol,
        type: trade.type,
        marginMode: trade.marginMode,
        leverage: trade.leverage,
        entryPrice: trade.entryPrice.toString(),
        exitPrice: trade.exitPrice?.toString() || '',
        stopLoss: trade.stopLoss?.toString() || '',
        amount: trade.amount.toString(),
        fees: trade.fees.toString(),
        fundingFees: (trade.fundingFees || 0).toString(),
        confidence: trade.confidence || 3
      });
    } else if (type === 'EDIT_NOTE' && extra?.note) {
      setLogText(extra.note.text);
    }
  }, [type, trade, extra]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (type === 'EXIT') {
      const p = parseFloat(price);
      const f = parseFloat(fees) || 0;
      const ff = parseFloat(fundingFees) || 0;
      if (!isNaN(p)) onConfirm({ price: p, fees: f, fundingFees: ff, exitDate, isTotalFees: isTotalMode });
    } else if (type === 'ADD') {
      const p = parseFloat(price);
      const a = parseFloat(amount);
      const f = parseFloat(fees) || 0;
      const ff = parseFloat(fundingFees) || 0;
      if (!isNaN(p) && !isNaN(a)) onConfirm({ price: p, amount: a, fees: f, fundingFees: ff, leverage });
    } else if (type === 'EDIT') {
      onConfirm({
        ...editData,
        leverage: Number(editData.leverage),
        entryPrice: parseFloat(editData.entryPrice),
        exitPrice: editData.exitPrice ? parseFloat(editData.exitPrice) : null,
        stopLoss: editData.stopLoss ? parseFloat(editData.stopLoss) : null,
        amount: parseFloat(editData.amount),
        fees: parseFloat(editData.fees) || 0,
        fundingFees: parseFloat(editData.fundingFees) || 0,
        confidence: editData.confidence
      });
    } else if (type === 'LOG' || type === 'EDIT_NOTE') {
      if (logText.trim()) onConfirm({ text: logText.trim() });
    }
  };

  const isEdit = type === 'EDIT';
  const isAdd = type === 'ADD';
  const isExit = type === 'EXIT';
  const isLog = type === 'LOG' || type === 'EDIT_NOTE';

  const confidenceLabels = ["Gambling", "Speculation", "Neutral", "Solid Setup", "Strong Signal"];

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`bg-slate-800 border border-slate-700 w-full ${isEdit ? 'max-w-md' : 'max-w-sm'} rounded-3xl p-6 shadow-2xl shadow-black/50 overflow-y-auto max-h-[90vh]`}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-black text-white uppercase italic tracking-tighter leading-none">
            {isExit && <><i className="fas fa-door-open text-blue-400 mr-2"></i> Close Position</>}
            {isAdd && <><i className="fas fa-plus-circle text-emerald-400 mr-2"></i> Scale-In Position</>}
            {isEdit && <><i className="fas fa-cog text-amber-400 mr-2"></i> Global Parameters</>}
            {type === 'LOG' && <><i className="fas fa-file-pen text-emerald-400 mr-2"></i> New Log Entry</>}
            {type === 'EDIT_NOTE' && <><i className="fas fa-pen-to-square text-emerald-400 mr-2"></i> Edit Note</>}
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <i className="fas fa-times text-lg"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isLog ? (
            <div>
              <textarea
                autoFocus
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white outline-none font-medium text-xs h-40 resize-none shadow-inner"
                value={logText}
                onChange={(e) => setLogText(e.target.value)}
                placeholder="Journal entry..."
                required
              ></textarea>
            </div>
          ) : isEdit ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Ticker</label>
                  <input
                    type="text"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white font-bold outline-none uppercase"
                    value={editData.symbol}
                    onChange={(e) => setEditData({ ...editData, symbol: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest text-emerald-400">Entry Price</label>
                  <input
                    type="text"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-emerald-400 font-bold outline-none"
                    value={editData.entryPrice}
                    onChange={(e) => setEditData({ ...editData, entryPrice: cleanNumericInput(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-500 mb-2 uppercase tracking-widest flex justify-between">
                  <span>Confidence Level</span>
                  <span className="text-emerald-500 font-black">{confidenceLabels[editData.confidence - 1]}</span>
                </label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setEditData({ ...editData, confidence: level })}
                      className={`flex-1 h-2 rounded-full transition-all ${
                        editData.confidence >= level 
                          ? (editData.confidence <= 2 ? 'bg-rose-500' : editData.confidence === 3 ? 'bg-amber-500' : 'bg-emerald-500')
                          : 'bg-slate-700'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Amount</label>
                  <input
                    type="text"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white font-bold outline-none"
                    value={editData.amount}
                    onChange={(e) => setEditData({ ...editData, amount: cleanNumericInput(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Leverage</label>
                  <input
                    type="number"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white font-bold outline-none"
                    value={editData.leverage}
                    onChange={(e) => setEditData({ ...editData, leverage: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                   <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Fees ($)</label>
                   <input
                    type="number"
                    step="any"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-slate-300 font-bold outline-none"
                    value={editData.fees}
                    onChange={(e) => setEditData({ ...editData, fees: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-amber-500 mb-1 uppercase tracking-widest">Funding ($)</label>
                  <input
                    type="number"
                    step="any"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-amber-500 font-bold outline-none"
                    value={editData.fundingFees}
                    onChange={(e) => setEditData({ ...editData, fundingFees: e.target.value })}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              {isExit && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Exit Timestamp</label>
                    <input
                      type="datetime-local"
                      step="1"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none font-bold text-[10px] uppercase"
                      value={exitDate}
                      onChange={(e) => setExitDate(e.target.value)}
                    />
                  </div>
                  <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-700">
                    <button type="button" onClick={() => setIsTotalMode(false)} className={`flex-1 py-2 text-[9px] font-black rounded-lg transition-all ${!isTotalMode ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}>Add Fees</button>
                    <button type="button" onClick={() => setIsTotalMode(true)} className={`flex-1 py-2 text-[9px] font-black rounded-lg transition-all ${isTotalMode ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-500'}`}>Total Reset</button>
                  </div>
                </div>
              )}
              
              <div>
                <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">
                  {isExit ? 'Settlement Price' : 'Batch Entry Price'}
                </label>
                <input
                  type="text"
                  autoFocus
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  value={price}
                  onChange={(e) => setPrice(cleanNumericInput(e.target.value))}
                  placeholder="0.00"
                />
              </div>

              {isAdd && (
                <div>
                  <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Units Added</label>
                  <input
                    type="text"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                    value={amount}
                    onChange={(e) => setAmount(cleanNumericInput(e.target.value))}
                    placeholder="0.00"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                   <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Op. Fees</label>
                   <input
                    type="number"
                    step="any"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-slate-300 font-bold outline-none"
                    value={fees}
                    onChange={(e) => setFees(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Op. Funding</label>
                  <input
                    type="number"
                    step="any"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-slate-400 font-bold outline-none"
                    value={fundingFees}
                    onChange={(e) => setFundingFees(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          <div className="pt-2">
            <button
              type="submit"
              className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg ${
                isExit ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20' : 
                isAdd ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20' : 
                isLog ? 'bg-emerald-600 hover:bg-emerald-500 text-white' :
                'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20'
              }`}
            >
              Commit Change
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TradeActionModal;
