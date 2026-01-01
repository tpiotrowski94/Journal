
import React, { useState, useEffect } from 'react';
import { Trade, TradeType, MarginMode } from '../types';

interface TradeActionModalProps {
  trade: Trade;
  type: 'ADD' | 'EXIT' | 'EDIT';
  onClose: () => void;
  onConfirm: (data: any) => void;
}

const TradeActionModal: React.FC<TradeActionModalProps> = ({ trade, type, onClose, onConfirm }) => {
  const [price, setPrice] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [leverage, setLeverage] = useState<number>(trade.leverage);
  const [fees, setFees] = useState<string>('0');

  const [editData, setEditData] = useState({
    symbol: trade.symbol,
    type: trade.type,
    marginMode: trade.marginMode,
    leverage: trade.leverage,
    entryPrice: trade.entryPrice.toString(),
    stopLoss: trade.stopLoss?.toString() || '',
    amount: trade.amount.toString(),
    fees: trade.fees.toString(),
  });

  useEffect(() => {
    if (type === 'EDIT') {
      setEditData({
        symbol: trade.symbol,
        type: trade.type,
        marginMode: trade.marginMode,
        leverage: trade.leverage,
        entryPrice: trade.entryPrice.toString(),
        stopLoss: trade.stopLoss?.toString() || '',
        amount: trade.amount.toString(),
        fees: trade.fees.toString(),
      });
    }
  }, [type, trade]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (type === 'EXIT') {
      const p = parseFloat(price);
      const f = parseFloat(fees) || 0;
      if (!isNaN(p)) onConfirm({ price: p, fees: f });
    } else if (type === 'ADD') {
      const p = parseFloat(price);
      const a = parseFloat(amount);
      const f = parseFloat(fees) || 0;
      if (!isNaN(p) && !isNaN(a)) onConfirm({ price: p, amount: a, fees: f, leverage });
    } else if (type === 'EDIT') {
      onConfirm({
        ...editData,
        leverage: Number(editData.leverage),
        entryPrice: parseFloat(editData.entryPrice),
        stopLoss: editData.stopLoss ? parseFloat(editData.stopLoss) : null,
        amount: parseFloat(editData.amount),
        fees: parseFloat(editData.fees) || 0,
      });
    }
  };

  const isEdit = type === 'EDIT';
  const isAdd = type === 'ADD';
  const isExit = type === 'EXIT';

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`bg-slate-800 border border-slate-700 w-full ${isEdit ? 'max-w-md' : 'max-w-sm'} rounded-3xl p-6 shadow-2xl shadow-black/50 overflow-y-auto max-h-[90vh]`}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">
            {isExit && <><i className="fas fa-door-open text-blue-400 mr-2"></i> Close Position</>}
            {isAdd && <><i className="fas fa-plus-circle text-emerald-400 mr-2"></i> Add to Position</>}
            {isEdit && <><i className="fas fa-edit text-amber-400 mr-2"></i> Edit Trade</>}
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <i className="fas fa-times text-lg"></i>
          </button>
        </div>

        {!isEdit && (
          <div className="mb-6 p-3 bg-slate-900/50 rounded-xl border border-slate-700/50">
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
              <span>Asset</span>
              <span>Current Size</span>
            </div>
            <div className="flex justify-between items-end">
              <span className="text-white font-black">{trade.symbol}</span>
              <span className="text-slate-300 font-mono text-sm">{trade.amount} units</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isEdit ? (
            <>
              <div>
                <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Asset Name</label>
                <input
                  type="text"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white font-bold outline-none uppercase"
                  value={editData.symbol}
                  onChange={(e) => setEditData({ ...editData, symbol: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Side</label>
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
                  <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Margin Mode</label>
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
                  <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Leverage</label>
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
                    type="number"
                    step="any"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white font-bold outline-none"
                    value={editData.amount}
                    onChange={(e) => setEditData({ ...editData, amount: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Avg Entry Price</label>
                  <input
                    type="number"
                    step="any"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white font-bold outline-none"
                    value={editData.entryPrice}
                    onChange={(e) => setEditData({ ...editData, entryPrice: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Stop Loss</label>
                  <input
                    type="number"
                    step="any"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-rose-500 font-bold outline-none"
                    value={editData.stopLoss}
                    onChange={(e) => setEditData({ ...editData, stopLoss: e.target.value })}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">
                  {isExit ? 'Exit Execution Price (USDT)' : 'Entry Price of New Batch'}
                </label>
                <input
                  type="number"
                  step="any"
                  autoFocus
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">
                  {isExit ? 'Realized Fees (Trading + Funding)' : 'Fees for this addition'}
                </label>
                <input
                  type="number"
                  step="any"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-slate-300 font-bold outline-none focus:ring-2 focus:ring-slate-500"
                  value={fees}
                  onChange={(e) => setFees(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              {isAdd && (
                <>
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">Additional Units (Size)</label>
                    <input
                      type="number"
                      step="any"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-widest">New Leverage (Global)</label>
                    <input
                      type="number"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white font-bold outline-none"
                      value={leverage}
                      onChange={(e) => setLeverage(Number(e.target.value))}
                      required
                    />
                  </div>
                </>
              )}
            </>
          )}

          <div className="pt-2">
            <button
              type="submit"
              className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg ${
                isExit ? 'bg-blue-600 hover:bg-blue-500 text-white' : 
                isAdd ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 
                'bg-amber-600 hover:bg-amber-500 text-white'
              }`}
            >
              {isExit ? 'Confirm Close Position' : isAdd ? 'Confirm Position Increase' : 'Save Trade Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TradeActionModal;
