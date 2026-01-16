
import React, { useState } from 'react';
import { TradingStats } from '../types';

interface DashboardProps {
  stats: TradingStats;
  onAdjustBalance: (newBalance: number) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ stats, onAdjustBalance }) => {
  const [isEditingBalance, setIsEditingBalance] = useState(false);
  const [balanceInput, setBalanceInput] = useState(stats.currentBalance.toString());

  const handleBalanceSubmit = () => {
    const val = parseFloat(balanceInput);
    if (!isNaN(val)) {
      onAdjustBalance(val);
    }
    setIsEditingBalance(false);
  };

  const totalCosts = stats.totalTradingFees + stats.totalFundingFees;

  const cards = [
    { 
      label: 'Portfolio Equity', 
      value: `$${stats.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 
      sub: `Initial: $${stats.initialBalance.toFixed(0)}`,
      color: 'text-white', 
      icon: 'fa-vault',
      bg: 'bg-slate-800',
      isAdjustable: true
    },
    { 
      label: 'Realized P&L & ROE', 
      value: `${stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl.toFixed(2)}$`, 
      sub: `${stats.totalPnlPercentage >= 0 ? '+' : ''}${stats.totalPnlPercentage.toFixed(2)}% ROE`,
      color: stats.totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400', 
      icon: 'fa-chart-line',
      bg: stats.totalPnl >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'
    },
    { 
      label: 'Cumulative Trade ROI', 
      value: `${stats.totalTradeReturn >= 0 ? '+' : ''}${stats.totalTradeReturn.toFixed(1)}%`, 
      sub: `Sum of trade returns`,
      color: stats.totalTradeReturn >= 0 ? 'text-emerald-500' : 'text-rose-500', 
      icon: 'fa-percentage',
      bg: 'bg-slate-800/50'
    },
    { 
      label: 'Operational Costs', 
      value: `-$${totalCosts.toFixed(2)}`, 
      sub: `Fund: ${stats.totalFundingFees >= 0 ? '+' : ''}${stats.totalFundingFees.toFixed(1)} | Trade: ${stats.totalTradingFees.toFixed(1)}`,
      color: totalCosts > 0 ? 'text-amber-500' : 'text-emerald-400', 
      icon: 'fa-money-bill-transfer',
      bg: 'bg-amber-500/5'
    },
    { 
      label: 'Performance', 
      value: `${stats.winRate.toFixed(1)}% WR`, 
      sub: `${stats.openTrades} Active Positions`,
      color: 'text-blue-400', 
      icon: 'fa-trophy',
      bg: 'bg-blue-500/10'
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
      {cards.map((card, idx) => (
        <div key={idx} className={`${card.bg} p-5 rounded-3xl border border-slate-700/50 shadow-xl flex flex-col justify-between transition-transform hover:scale-[1.02] relative overflow-hidden group min-h-[125px]`}>
          <div className="absolute -right-2 -top-2 opacity-5 group-hover:opacity-10 transition-opacity">
            <i className={`fas ${card.icon} text-6xl`}></i>
          </div>
          
          <div className="flex justify-between items-start mb-2 relative z-10">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{card.label}</span>
            {card.isAdjustable ? (
              <button 
                onClick={() => { setIsEditingBalance(true); setBalanceInput(stats.currentBalance.toFixed(2)); }}
                className="text-slate-500 hover:text-blue-400 transition-colors p-1"
                title="Dostosuj saldo rzeczywiste"
              >
                <i className="fas fa-pencil-alt text-[10px]"></i>
              </button>
            ) : (
              <i className={`fas ${card.icon} ${card.color} text-[10px] opacity-70`}></i>
            )}
          </div>

          <div className="relative z-10">
            {card.isAdjustable && isEditingBalance ? (
              <div className="flex gap-2">
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
            ) : (
              <p className={`text-xl font-black ${card.color} tracking-tighter uppercase italic leading-none`}>{card.value}</p>
            )}
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tight truncate mt-2">{card.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Dashboard;
