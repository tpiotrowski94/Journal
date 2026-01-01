
import React from 'react';
import { TradingStats } from '../types';

interface DashboardProps {
  stats: TradingStats;
}

const Dashboard: React.FC<DashboardProps> = ({ stats }) => {
  const cards = [
    { 
      label: 'Balance / Initial', 
      value: `${stats.currentBalance.toFixed(2)} / ${stats.initialBalance.toFixed(0)}`, 
      sub: 'Account Value (USDT)',
      color: 'text-white', 
      icon: 'fa-vault',
      bg: 'bg-slate-800'
    },
    { 
      label: 'Total P&L ($)', 
      value: `${stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl.toFixed(2)}`, 
      sub: 'Realized Profit/Loss',
      color: stats.totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400', 
      icon: 'fa-money-bill-trend-up',
      bg: stats.totalPnl >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'
    },
    { 
      label: 'Total P&L (%)', 
      value: `${stats.totalPnlPercentage >= 0 ? '+' : ''}${stats.totalPnlPercentage.toFixed(2)}%`, 
      sub: 'Cumulative Return',
      color: stats.totalPnlPercentage >= 0 ? 'text-emerald-400' : 'text-rose-400', 
      icon: 'fa-percent',
      bg: stats.totalPnlPercentage >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'
    },
    { 
      label: 'Performance', 
      value: `${stats.winRate.toFixed(1)}% WR`, 
      sub: `${stats.openTrades} Active Positions`,
      color: 'text-blue-400', 
      icon: 'fa-chart-line',
      bg: 'bg-blue-500/10'
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {cards.map((card, idx) => (
        <div key={idx} className={`${card.bg} p-5 rounded-2xl border border-slate-700/50 shadow-xl flex flex-col justify-between transition-transform hover:scale-[1.02]`}>
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{card.label}</span>
            <i className={`fas ${card.icon} ${card.color} opacity-50`}></i>
          </div>
          <div>
            <p className={`text-xl font-black ${card.color} tracking-tight`}>{card.value}</p>
            <p className="text-[10px] text-slate-500 font-medium">{card.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Dashboard;
