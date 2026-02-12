
import React, { useState } from 'react';
import { TradingStats } from '../types';

interface DashboardProps {
  stats: TradingStats;
  onAdjustBalance: (newBalance: number) => void;
  onUpdateInitialBalance: (newInitial: number) => void;
  isLive?: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ stats, onAdjustBalance, onUpdateInitialBalance, isLive }) => {
  const [isEditingBalance, setIsEditingBalance] = useState(false);
  const [isEditingInitial, setIsEditingInitial] = useState(false);
  const [balanceInput, setBalanceInput] = useState(stats.currentBalance.toString());
  const [initialInput, setInitialInput] = useState(stats.initialBalance.toString());

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

  const totalCosts = (Number(stats.totalTradingFees) || 0) + (Number(stats.totalFundingFees) || 0);
  const grossPnl = stats.totalPnl + totalCosts;
  
  // Floating PnL to różnica między tym co mamy na giełdzie a tym co jest zrealizowane
  const floatingPnL = isLive ? (stats.currentBalance - (stats.initialBalance + stats.totalPnl)) : 0;

  const tradingPerformanceRoi = stats.initialBalance > 0 
    ? (stats.totalPnl / stats.initialBalance) * 100 
    : 0;

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
      value: `${stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}$`, 
      sub: `Net Profit from History`,
      color: stats.totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400', 
      icon: 'fa-coins',
      bg: stats.totalPnl >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'
    },
    { 
      label: 'Floating PnL', 
      value: `${floatingPnL >= 0 ? '+' : ''}${floatingPnL.toFixed(2)}$`, 
      sub: 'Open Positions Unrealized',
      color: floatingPnL >= 0 ? 'text-blue-400' : 'text-rose-400', 
      icon: 'fa-wave-square',
      bg: 'bg-slate-800'
    },
    { 
      label: 'Portfolio Growth', 
      value: `${tradingPerformanceRoi >= 0 ? '+' : ''}${tradingPerformanceRoi.toFixed(2)}%`, 
      sub: 'Return on Initial Cap.',
      color: tradingPerformanceRoi >= 0 ? 'text-blue-400' : 'text-rose-400', 
      icon: 'fa-chart-line',
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

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
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
  );
};

export default Dashboard;
