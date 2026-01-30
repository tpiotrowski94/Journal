
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
  const [price, setPrice] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [leverage, setLeverage] = useState<number>(trade.leverage);
  const [fees, setFees] = useState<string>('0');
  const [fundingFees, setFundingFees] = useState<string>('0');
  const [logText, setLogText] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

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
      if (!isNaN(p)) onConfirm({ price: p, fees: f, fundingFees: ff, notes });
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
  const isClosed = trade.status === TradeStatus.CLOSED;

  const currentFundingInput = parseFloat(fundingFees) || 0;
  const confidenceLabels = ["Gambling", "Speculation", "Neutral", "Solid Setup", "Strong Signal"];

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`bg-slate-800 border border-slate-700 w-full ${isEdit ? 'max-w-md' : 'max-w-sm'} rounded-3xl p-6 shadow-2xl shadow-black/50 overflow-y-auto max-h-[90vh]`}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">
            {isExit && <><i className="fas fa-door-open text-blue-400 mr-2"></i> Zamknij Pozycję</>}
            {isAdd && <><i className="fas fa-plus-circle text-emerald-400 mr-2"></i> Dokup (Scale-In)</>}
            {isEdit && <><i className="fas fa-cog text-amber-400 mr-2"></i> Parametry Globalne</>}
            {type === 'LOG' && <><i className="fas fa-file-pen text-emerald-400 mr-2"></i> Dodaj Wpis</>}
            {type === 'EDIT_NOTE' && <><i className="fas fa-pen-to-square text-emerald-400 mr-2"></i> Edytuj Wpis</>}
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <i className="fas fa-times text-lg"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isLog ? (
            <div>
              <label className="block text-[9px] font-black text-slate-500 mb-2 uppercase tracking-widest">
                {type === 'LOG' ? 'Nowy wpis w dzienniku' : 'Aktualizuj wpis'}
              </label>
              <textarea
                autoFocus
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white outline-none font-medium text-xs h-40 resize-none focus:ring-2 focus:ring-emerald-500/50 shadow-inner"
                value={logText}
                onChange={(e) => setLogText(e.target.value)}
                placeholder="Napisz co się zmieniło..."
                required
              ></textarea>
            </div>
          ) : isEdit ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Aktywo</label>
                  <input
                    type="text"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white font-bold outline-none uppercase"
                    value={editData.symbol}
                    onChange={(e) => setEditData({ ...editData, symbol: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest text-emerald-400">Avg Entry Price</label>
                  <input
                    type="text"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-emerald-400 font-bold outline-none"
                    value={editData.entryPrice}
                    onChange={(e) => setEditData({ ...editData, entryPrice: cleanNumericInput(e.target.value) })}
                    required
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
                  <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Typ</label>
                  <select 
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white font-bold outline-none"
                    value={editData.type}
                    onChange={(e) => setEditData({ ...editData, type: e.target.value as TradeType })}
                  >
                    <option value={TradeType.LONG}>LONG</option>
                    <option value={TradeType.SHORT}>SHORT</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Margin</label>
                  <select 
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white font-bold outline-none"
                    value={editData.marginMode}
                    onChange={(e) => setEditData({ ...editData, marginMode: e.target.value as MarginMode })}
                  >
                    <option value={MarginMode.ISOLATED}>ISOLATED</option>
                    <option value={MarginMode.CROSS}>CROSS</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Dźwignia</label>
                  <input
                    type="number"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white font-bold outline-none"
                    value={editData.leverage}
                    onChange={(e) => setEditData({ ...editData, leverage: Number(e.target.value) })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Total Amount (Units)</label>
                  <input
                    type="text"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white font-bold outline-none"
                    value={editData.amount}
                    onChange={(e) => setEditData({ ...editData, amount: cleanNumericInput(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Total Fees Paid</label>
                  <input
                    type="number"
                    step="any"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-slate-300 font-bold outline-none"
                    value={editData.fees}
                    onChange={(e) => setEditData({ ...editData, fees: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-amber-500 mb-1 uppercase tracking-widest">Total Funding Paid</label>
                  <input
                    type="number"
                    step="any"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-amber-500 font-bold outline-none"
                    value={editData.fundingFees}
                    onChange={(e) => setEditData({ ...editData, fundingFees: e.target.value })}
                    required
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">
                  {isExit ? 'Cena Wykonania (USDT)' : 'Cena Nowej Partii'}
                </label>
                <input
                  type="text"
                  autoFocus
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  value={price}
                  onChange={(e) => setPrice(cleanNumericInput(e.target.value))}
                  placeholder="0.00"
                  required
                />
              </div>

              {isAdd && (
                <div>
                  <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">
                    Dodatkowa Ilość (Units)
                  </label>
                  <input
                    type="text"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                    value={amount}
                    onChange={(e) => setAmount(cleanNumericInput(e.target.value))}
                    placeholder="0.00"
                    required
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">
                    Prowizja (TYLKO dla tej partii)
                  </label>
                  <input
                    type="number"
                    step="any"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-slate-300 font-bold outline-none"
                    value={fees}
                    onChange={(e) => setFees(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className={`block text-[9px] font-black mb-1 uppercase tracking-widest ${currentFundingInput > 0 ? 'text-amber-500' : currentFundingInput < 0 ? 'text-emerald-500' : 'text-slate-500'}`}>
                    Funding (TYLKO dla tej partii)
                  </label>
                  <input
                    type="number"
                    step="any"
                    className={`w-full bg-slate-900 border rounded-xl p-3 font-bold outline-none transition-all ${currentFundingInput > 0 ? 'border-amber-500/40 text-amber-500' : currentFundingInput < 0 ? 'border-emerald-500/40 text-emerald-500' : 'border-slate-700 text-slate-400'}`}
                    value={fundingFees}
                    onChange={(e) => setFundingFees(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="bg-slate-900/50 p-2 rounded-xl border border-slate-700/50">
                <p className="text-[7px] text-slate-500 font-black uppercase leading-tight">
                  <i className="fas fa-info-circle mr-1 text-blue-400"></i> Wpisane koszty zostaną <b>dodane</b> do aktualnej sumy kosztów tej pozycji.
                </p>
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
              Zatwierdź Operację
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TradeActionModal;
