
import React, { useState } from 'react';
import { TradingStats, Transfer } from '../types';

interface DashboardProps {
  stats: TradingStats;
  transfers: Transfer[];
  onAdjustBalance: (newBalance: number) => void;
  onUpdateInitialBalance: (newInitial: number) => void;
  onAddTransfer: (t: Transfer) => void;
  onDeleteTransfer: (id: string) => void;
  isLive?: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({
  stats,
  transfers,
  onAdjustBalance,
  onUpdateInitialBalance,
  onAddTransfer,
  onDeleteTransfer,
  isLive
}) => {
  const [isEditingBalance, setIsEditingBalance] = useState(false);
  const [isEditingInitial, setIsEditingInitial] = useState(false);
  const [balanceInput, setBalanceInput] = useState(stats.currentBalance.toString());
  const [initialInput, setInitialInput] = useState(stats.initialBalance.toString());

  // Transfer form state
  const [transfersOpen, setTransfersOpen] = useState(false);
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [transferType, setTransferType] = useState<'DEPOSIT' | 'WITHDRAWAL'>('DEPOSIT');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  const [transferNote, setTransferNote] = useState('');

  const handleBalanceSubmit = () => {
    const val = parseFloat(balanceInput);
    if (!isNaN(val)) onAdjustBalance(val);
    setIsEditingBalance(false);
  };

  const handleInitialSubmit = () => {
    const val = parseFloat(initialInput);
    if (!isNaN(val)) onUpdateInitialBalance(val);
    setIsEditingInitial(false);
  };

  const handleAddTransfer = () => {
    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) return;
    onAddTransfer({
      id: crypto.randomUUID(),
      amount,
      date: transferDate,
      type: transferType,
      note: transferNote || undefined,
    });
    setTransferAmount('');
    setTransferNote('');
    setShowTransferForm(false);
  };

  const totalCosts = (Number(stats.totalTradingFees) || 0) + (Number(stats.totalFundingFees) || 0);
  const tradingPerformanceRoi = stats.totalPnlPercentage;

  const cards = [
    {
      label: 'Account Value (Net)',
      value: `$${stats.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sub: `Equity + Unrealized PnL`,
      color: 'text-white',
      icon: 'fa-vault',
      bg: isLive ? 'bg-blue-600/10' : 'bg-slate-800',
      isAdjustable: 'equity',
      badge: isLive ? 'HL LIVE' : null
    },
    {
      label: 'Realized PnL',
      value: `${stats.totalPnl > 0 ? '+' : ''}${stats.totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}$`,
      sub: `Net Profit from History`,
      color: stats.totalPnl > 0 ? 'text-emerald-400' : (stats.totalPnl < 0 ? 'text-rose-400' : 'text-slate-400'),
      icon: 'fa-coins',
      bg: stats.totalPnl > 0 ? 'bg-emerald-500/10' : (stats.totalPnl < 0 ? 'bg-rose-500/10' : 'bg-slate-800')
    },
    {
      label: 'Portfolio Growth',
      value: `${tradingPerformanceRoi >= 0 ? '+' : ''}${tradingPerformanceRoi.toFixed(2)}%`,
      sub: 'Return on Capital Base',
      color: tradingPerformanceRoi >= 0 ? 'text-blue-400' : 'text-rose-400',
      icon: 'fa-chart-line',
      bg: 'bg-slate-800'
    },
    {
      label: 'Win Rate',
      value: `${stats.winRate.toFixed(1)}%`,
      sub: `${stats.totalTrades} Trades`,
      color: stats.winRate >= 50 ? 'text-emerald-400' : 'text-amber-400',
      icon: 'fa-chart-pie',
      bg: 'bg-slate-800'
    },
    {
      label: 'Total Fees/Fund',
      value: `-$${Math.abs(totalCosts).toFixed(2)}`,
      sub: `Cumulative Costs`,
      color: 'text-amber-500',
      icon: 'fa-money-bill-transfer',
      bg: 'bg-amber-500/5'
    }
  ];

  const recentTransfers = [...(transfers || [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 4);
  // Calculate net from the (already date-filtered) transfers prop, not from stats.totalTransfers
  const netTransfers = (transfers || []).reduce((sum, t) => t.type === 'DEPOSIT' ? sum + t.amount : sum - t.amount, 0);


  return (
    <div className="space-y-3 mb-8">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map((card, idx) => (
          <div key={idx} className={`${card.bg} p-5 rounded-3xl border border-slate-700/50 shadow-xl flex flex-col justify-between transition-transform hover:scale-[1.02] relative overflow-hidden group min-h-[125px]`}>
            <div className="absolute -right-2 -top-2 opacity-5 group-hover:opacity-10 transition-opacity">
              <i className={`fas ${card.icon} text-6xl`}></i>
            </div>

            <div className="flex justify-between items-start mb-2 relative z-10">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{card.label}</span>
                {card.badge && (
                  <span className="text-[7px] font-black bg-blue-500 text-white px-1.5 py-0.5 rounded-sm animate-pulse">{card.badge}</span>
                )}
              </div>
              <div className="flex gap-1.5">
                {card.isAdjustable === 'equity' && (
                  <>
                    <button
                      onClick={() => { setIsEditingInitial(true); setInitialInput(stats.initialBalance.toFixed(0)); }}
                      className="text-slate-600 hover:text-emerald-400 transition-colors p-1"
                      title="Change Initial Balance"
                    >
                      <i className="fas fa-plus text-[9px]"></i>
                    </button>
                    <button
                      onClick={() => { setIsEditingBalance(true); setBalanceInput(stats.currentBalance.toFixed(2)); }}
                      className="text-slate-600 hover:text-blue-400 transition-colors p-1"
                      title="Manual Balance Override"
                    >
                      <i className="fas fa-pencil-alt text-[9px]"></i>
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="relative z-10">
              {isEditingBalance && card.isAdjustable === 'equity' ? (
                <div className="flex flex-col gap-1">
                  <span className="text-[7px] font-black text-blue-400 uppercase">Set Real Equity</span>
                  <input
                    autoFocus
                    type="number"
                    step="any"
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-black w-full outline-none text-base"
                    value={balanceInput}
                    onChange={(e) => setBalanceInput(e.target.value)}
                    onBlur={handleBalanceSubmit}
                    onKeyDown={(e) => e.key === 'Enter' && handleBalanceSubmit()}
                  />
                </div>
              ) : isEditingInitial && card.isAdjustable === 'equity' ? (
                <div className="flex flex-col gap-1">
                  <span className="text-[7px] font-black text-emerald-400 uppercase">Set Initial Base</span>
                  <input
                    autoFocus
                    type="number"
                    step="any"
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-black w-full outline-none text-base"
                    value={initialInput}
                    onChange={(e) => setInitialInput(e.target.value)}
                    onBlur={handleInitialSubmit}
                    onKeyDown={(e) => e.key === 'Enter' && handleInitialSubmit()}
                  />
                </div>
              ) : (
                <p className={`text-xl font-black ${card.color} tracking-tighter uppercase italic leading-none truncate`}>{card.value}</p>
              )}
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tight truncate mt-2">{card.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Transfers – collapsible, dyskretny footer */}
      <div className="border border-slate-700/30 rounded-2xl overflow-hidden">
        <button
          onClick={() => setTransfersOpen(o => !o)}
          className="w-full flex items-center justify-between px-5 py-3 text-slate-600 hover:text-slate-400 hover:bg-slate-800/40 transition-all"
        >
          <div className="flex items-center gap-2">
            <i className="fas fa-arrow-right-arrow-left text-[10px]"></i>
            <span className="text-[9px] font-black uppercase tracking-widest">Capital Transfers</span>
            {transfers.length > 0 && (
              <span className={`text-[9px] font-black ${netTransfers >= 0 ? 'text-emerald-500/70' : 'text-rose-500/70'}`}>
                net {netTransfers >= 0 ? '+' : ''}${netTransfers.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            )}
          </div>
          <i className={`fas fa-chevron-${transfersOpen ? 'up' : 'down'} text-[9px]`}></i>
        </button>

        {transfersOpen && (
          <div className="px-5 pb-4 pt-1 bg-slate-900/30">
            {/* Add Transfer Button */}
            <div className="flex justify-end mb-3">
              <button
                onClick={() => setShowTransferForm(f => !f)}
                className="flex items-center gap-1.5 text-[9px] font-black uppercase text-violet-400 hover:text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 px-3 py-1.5 rounded-xl transition-all"
              >
                <i className={`fas ${showTransferForm ? 'fa-times' : 'fa-plus'} text-[8px]`}></i>
                {showTransferForm ? 'Cancel' : 'Record Transfer'}
              </button>
            </div>

            {/* Inline Transfer Form */}
            {showTransferForm && (
              <div className="bg-slate-900/60 border border-slate-700/40 rounded-2xl p-4 mb-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Type</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setTransferType('DEPOSIT')}
                        className={`flex-1 text-[9px] font-black uppercase px-2 py-1.5 rounded-lg border transition-all ${transferType === 'DEPOSIT' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'}`}
                      >
                        <i className="fas fa-arrow-down mr-1"></i>Deposit
                      </button>
                      <button
                        onClick={() => setTransferType('WITHDRAWAL')}
                        className={`flex-1 text-[9px] font-black uppercase px-2 py-1.5 rounded-lg border transition-all ${transferType === 'WITHDRAWAL' ? 'bg-rose-500/20 border-rose-500/40 text-rose-400' : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'}`}
                      >
                        <i className="fas fa-arrow-up mr-1"></i>Withdraw
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Amount (USDC)</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0.00"
                      className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-bold text-sm outline-none focus:border-violet-500/50 transition-colors"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Date</span>
                    <input
                      type="date"
                      className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-bold text-sm outline-none focus:border-violet-500/50 transition-colors"
                      value={transferDate}
                      onChange={(e) => setTransferDate(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Note (optional)</span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. top-up"
                        className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-violet-500/50 transition-colors min-w-0"
                        value={transferNote}
                        onChange={(e) => setTransferNote(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddTransfer()}
                      />
                      <button
                        onClick={handleAddTransfer}
                        disabled={!transferAmount || parseFloat(transferAmount) <= 0}
                        className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-black text-[10px] uppercase rounded-lg transition-all"
                      >
                        <i className="fas fa-check"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Transfer History */}
            {recentTransfers.length > 0 ? (
              <div className="space-y-1">
                {recentTransfers.map(t => (
                  <div key={t.id} className="flex items-center justify-between rounded-xl px-3 py-1.5 group hover:bg-slate-800/30 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] ${t.type === 'DEPOSIT' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-rose-500/15 text-rose-500'}`}>
                        <i className={`fas ${t.type === 'DEPOSIT' ? 'fa-arrow-down' : 'fa-arrow-up'}`}></i>
                      </div>
                      <span className={`text-xs font-black ${t.type === 'DEPOSIT' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {t.type === 'DEPOSIT' ? '+' : '-'}${t.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      {t.note && <span className="text-[10px] text-slate-600">— {t.note}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-700">{new Date(t.date).toLocaleDateString()}</span>
                      <button
                        onClick={() => onDeleteTransfer(t.id)}
                        className="text-slate-700 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100 text-[9px] ml-1"
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  </div>
                ))}
                {(transfers || []).length > 4 && (
                  <p className="text-[9px] text-slate-700 text-center pt-1">+{(transfers || []).length - 4} more</p>
                )}
              </div>
            ) : (
              <p className="text-[9px] text-slate-700 italic text-center py-1">No transfers recorded</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
