
import React from 'react';
import { TradingStats } from '../types';

interface DashboardProps {
  stats: TradingStats;
}

const Dashboard: React.FC<DashboardProps> = ({ stats }) => {
  const cards = [
    { label: 'Całkowity P&L', value: `${stats.totalPnl.toFixed(2)} USDT`, color: stats.totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400', icon: 'fa-wallet' },
    { label: 'Win Rate', value: `${stats.winRate.toFixed(1)}%`, color: 'text-blue-400', icon: 'fa-chart-pie' },
    { label: 'Najlepszy Trade', value: `+${stats.bestTrade.toFixed(2)}`, color: 'text-emerald-500', icon: 'fa-arrow-trend-up' },
    { label: 'Suma Transakcji', value: stats.totalTrades, color: 'text-slate-300', icon: 'fa-hashtag' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {cards.map((card, idx) => (
        <div key={idx} className="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-lg flex items-center gap-4">
          <div className={`w-12 h-12 rounded-lg bg-slate-900 flex items-center justify-center text-xl ${card.color}`}>
            <i className={`fas ${card.icon}`}></i>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{card.label}</p>
            <p className={`text-lg font-bold ${card.color}`}>{card.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Dashboard;
