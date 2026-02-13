
import React, { useState, useMemo } from 'react';
import { Trade, TradeStatus } from '../types';

interface PnLCalendarProps {
  trades: Trade[];
  portfolioEquity: number;
}

const PnLCalendar: React.FC<PnLCalendarProps> = ({ trades, portfolioEquity }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const startDayOfMonth = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Start from Monday
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const dailyStats = useMemo(() => {
    const map: Record<string, { pnl: number, roeSum: number, count: number }> = {};
    trades.filter(t => t.status === TradeStatus.CLOSED).forEach(t => {
      const d = new Date(t.exitDate || t.date).toISOString().split('T')[0];
      if (!map[d]) map[d] = { pnl: 0, roeSum: 0, count: 0 };
      map[d].pnl += t.pnl;
      map[d].roeSum += t.pnlPercentage;
      map[d].count += 1;
    });
    return map;
  }, [trades]);

  const monthStats = useMemo(() => {
    const monthTrades = trades.filter(t => {
      const d = new Date(t.exitDate || t.date);
      return d.getMonth() === month && d.getFullYear() === year && t.status === TradeStatus.CLOSED;
    });
    const pnl = monthTrades.reduce((sum, t) => sum + t.pnl, 0);
    const wins = monthTrades.filter(t => t.pnl > 0).length;
    return {
      pnl,
      winRate: monthTrades.length > 0 ? (wins / monthTrades.length) * 100 : 0,
      tradesCount: monthTrades.length
    };
  }, [trades, month, year]);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const renderDays = () => {
    const days = [];
    const totalDays = daysInMonth(year, month);
    const startOffset = startDayOfMonth(year, month);

    for (let i = 0; i < startOffset; i++) {
      days.push(<div key={`empty-${i}`} className="h-32 bg-slate-800/20 rounded-xl" />);
    }

    for (let d = 1; d <= totalDays; d++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const stats = dailyStats[dateKey];
      const isToday = new Date().toISOString().split('T')[0] === dateKey;
      
      // Calculate Portfolio ROI for the day (PnL / Equity)
      // Note: Using current equity for simplicity, ideally should be equity at start of day
      const portRoi = stats && portfolioEquity > 0 ? (stats.pnl / portfolioEquity) * 100 : 0;
      
      // Determine background color based on PnL
      let bgClass = 'bg-slate-800 hover:bg-slate-700';
      let borderClass = 'border-slate-700';
      
      if (stats) {
        if (stats.pnl > 0) {
            bgClass = 'bg-emerald-900/20 hover:bg-emerald-900/30';
            borderClass = 'border-emerald-500/30';
        } else if (stats.pnl < 0) {
            bgClass = 'bg-rose-900/10 hover:bg-rose-900/20';
            borderClass = 'border-rose-500/30';
        }
      }
      if (isToday) borderClass = 'border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]';

      days.push(
        <div 
          key={d} 
          className={`h-32 p-3 border rounded-xl flex flex-col justify-between transition-all relative overflow-hidden group ${bgClass} ${borderClass}`}
        >
          {/* Header: Date & Count */}
          <div className="flex justify-between items-start">
             <span className={`text-sm font-black ${isToday ? 'text-blue-400' : 'text-slate-500'}`}>{d}</span>
             {stats && (
               <div className="bg-slate-900/50 px-1.5 rounded text-[9px] font-bold text-slate-400">
                 {stats.count} trd
               </div>
             )}
          </div>
          
          {/* Middle: Big PnL */}
          <div className="flex-1 flex flex-col items-center justify-center py-1">
            {stats ? (
              <>
                 <span className={`text-lg md:text-xl font-black tracking-tight ${stats.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                   {stats.pnl >= 0 ? '+' : ''}{Math.round(stats.pnl)}$
                 </span>
                 {/* Main Trade Result as Portfolio Growth % */}
                 <span className={`text-[11px] font-black uppercase mt-0.5 ${portRoi >= 0 ? 'text-emerald-500/70' : 'text-rose-500/70'}`}>
                   {portRoi >= 0 ? '+' : ''}{portRoi.toFixed(2)}% ROI
                 </span>
              </>
            ) : (
              <span className="text-slate-700 text-2xl font-black opacity-20">-</span>
            )}
          </div>

          {/* Footer: ROE Sum (Secondary info) */}
          {stats ? (
            <div className="flex justify-center border-t border-slate-700/30 pt-1.5 mt-1">
               <span className="text-[8px] font-bold uppercase text-slate-500">
                 Sum ROE: {stats.roeSum >= 0 ? '+' : ''}{Math.round(stats.roeSum)}%
               </span>
            </div>
          ) : (
            <div className="h-4"></div>
          )}
        </div>
      );
    }
    return days;
  };

  return (
    <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center">
             <i className="fas fa-calendar-alt text-emerald-500"></i>
          </div>
          <div>
            <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">PnL Calendar</h2>
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{monthNames[month]} {year}</div>
          </div>
        </div>

        <div className="flex items-center gap-6 bg-slate-900/50 p-2 rounded-2xl border border-slate-700/50">
          <div className="px-4 border-r border-slate-700/50">
             <div className="text-[9px] text-slate-500 font-bold uppercase">Net PnL</div>
             <div className={`text-lg font-black ${monthStats.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
               {monthStats.pnl >= 0 ? '+' : ''}${monthStats.pnl.toFixed(0)}
             </div>
          </div>
          <div className="px-4">
             <div className="text-[9px] text-slate-500 font-bold uppercase">Win Rate</div>
             <div className="text-lg font-black text-blue-400">
               {monthStats.winRate.toFixed(0)}%
             </div>
          </div>
          <div className="flex gap-1 ml-2">
            <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-600 text-slate-400 hover:text-white hover:bg-slate-700 transition-all"><i className="fas fa-chevron-left text-[10px]"></i></button>
            <button onClick={() => setCurrentDate(new Date())} className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-600 text-slate-400 hover:text-white hover:bg-slate-700 transition-all"><i className="fas fa-calendar-day text-[10px]"></i></button>
            <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-600 text-slate-400 hover:text-white hover:bg-slate-700 transition-all"><i className="fas fa-chevron-right text-[10px]"></i></button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-3 mb-2">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
          <div key={d} className="text-center text-[10px] font-black text-slate-500 uppercase tracking-widest py-2">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-3">
        {renderDays()}
      </div>
    </div>
  );
};

export default PnLCalendar;
