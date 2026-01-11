
import React from 'react';
import { TradingStats } from '../types';

interface DashboardProps {
  stats: TradingStats;
}

const Dashboard: React.FC<DashboardProps> = ({ stats }) => {
  const cards = [
    { 
      label: 'Portfolio Equity', 
      value: `$${stats.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 
      sub: `Initial: $${stats.initialBalance.toFixed(0)}`,
      color: 'text-white', 
      icon: 'fa-vault',
      bg: 'bg-slate-800'
    },
    { 
      label: 'Realized P&L & Growth', 
      value: `${stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl.toFixed(2)}$`, 
      sub: `${stats.totalPnlPercentage >= 0 ? '+' : ''}${stats.totalPnlPercentage.toFixed(2)}% ROE`,
      color: stats.totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400', 
      icon: 'fa-chart-line',
      bg: stats.totalPnl >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'
    },
    { 
      label: 'Cumulative Trade ROI', 
      value: `${stats.totalTradeReturn >= 0 ? '+' : ''}${stats.totalTradeReturn.toFixed(1)}%`, 
      sub: 'Sum of Margin Returns',
      color: stats.totalTradeReturn >= 0 ? 'text-blue-400' : 'text-rose-400', 
      icon: 'fa-percent',
      bg: 'bg-blue-500/10'
    },
    { 
      label: 'Performance', 
      value: `${stats.winRate.toFixed(1)}% WR`, 
      sub: `${stats.openTrades} Active Positions`,
      color: 'text-amber-400', 
      icon: 'fa-trophy',
      bg: 'bg-amber-500/10'
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {cards.map((card, idx) => (
        <div key={idx} className={`${card.bg} p-5 rounded-3xl border border-slate-700/50 shadow-xl flex flex-col justify-between transition-transform hover:scale-[1.02] relative overflow-hidden group`}>
          <div className="absolute -right-2 -top-2 opacity-5 group-hover:opacity-10 transition-opacity">
            <i className={`fas ${card.icon} text-6xl`}></i>
          </div>
          <div className="flex justify-between items-start mb-2 relative z-10">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{card.label}</span>
            <i className={`fas ${card.icon} ${card.color} text-xs opacity-70`}></i>
          </div>
          <div className="relative z-10">
            <p className={`text-xl font-black ${card.color} tracking-tighter uppercase italic`}>{card.value}</p>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">{card.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Dashboard;
