
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
    const map: Record<string, { pnl: number, roiSum: number, wins: number, losses: number, count: number }> = {};
    trades.filter(t => t.status === TradeStatus.CLOSED).forEach(t => {
      const dateObj = new Date(t.exitDate || t.date);
      // Use local date string in YYYY-MM-DD format manually to avoid timezone shifts
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const d = `${year}-${month}-${day}`;
      if (!map[d]) map[d] = { pnl: 0, roiSum: 0, wins: 0, losses: 0, count: 0 };
      map[d].pnl += t.pnl;
      map[d].roiSum += (t.pnlPercentage || 0); // Accumulate Trade Return %
      map[d].count += 1;

      // Count wins/losses based on PnL sign
      if (t.pnl > 0) map[d].wins += 1;
      if (t.pnl < 0) map[d].losses += 1;
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
      days.push(<div key={`empty-${i}`} className="h-40 bg-slate-800/20 rounded-xl" />);
    }

    for (let d = 1; d <= totalDays; d++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const stats = dailyStats[dateKey];
      const isToday = new Date().toISOString().split('T')[0] === dateKey;

      // Calculate Portfolio ROI for the day (PnL / Current Equity)
      // Note: Equity changes daily, but here we use current equity as approximation for the view
      const portRoi = stats && portfolioEquity > 0 ? (stats.pnl / portfolioEquity) * 100 : 0;

      const roiPrecision = Math.abs(portRoi) > 0 && Math.abs(portRoi) < 0.01 ? 4 : 2;

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
          className={`h-40 p-2 border rounded-xl flex flex-col justify-between transition-all relative overflow-hidden group ${bgClass} ${borderClass}`}
        >
          {/* Header: Date & Count */}
          <div className="flex justify-between items-start">
            <span className={`text-xs font-black ${isToday ? 'text-blue-400' : 'text-slate-500'}`}>{d}</span>
            {stats && (
              <div className="bg-slate-900/50 px-1.5 rounded text-[8px] font-bold text-slate-400">
                {stats.count}
              </div>
            )}
          </div>

          {/* Middle: ROI %, PnL $, Portfolio Eq % */}
          <div className="flex-1 flex flex-col items-center justify-center py-0.5 gap-1">
            {stats ? (
              <>
                {/* 1. Portfolio Impact (Equity %) */}
                <div className="flex items-center gap-1">
                  <span className="text-[9px] font-black uppercase text-slate-500">Eq:</span>
                  <span className={`text-xs font-black tracking-tight ${portRoi >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {portRoi >= 0 ? '+' : ''}{portRoi.toFixed(roiPrecision)}%
                  </span>
                </div>

                {/* 2. Sum of Trade ROIs (Accumulated %) */}
                <div className="flex items-center gap-1">
                  <span className="text-[9px] font-black uppercase text-slate-500">Roi:</span>
                  <span className={`text-xs font-black tracking-tight ${stats.roiSum >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {stats.roiSum >= 0 ? '+' : ''}{stats.roiSum.toFixed(2)}%
                  </span>
                </div>

                {/* 3. PnL Dollars */}
                <div className="flex items-center gap-1">
                  <span className={`text-xs font-black tracking-tight ${stats.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {stats.pnl >= 0 ? '+' : ''}{Math.round(stats.pnl)}$
                  </span>
                </div>
              </>
            ) : (
              <span className="text-slate-700 text-xl font-black opacity-20">-</span>
            )}
          </div>

          {/* Footer: Win/Loss Ratio */}
          {stats ? (
            <div className="flex justify-center items-center gap-2 border-t border-slate-700/30 pt-1 mt-0.5">
              {stats.wins > 0 && (
                <span className="text-[8px] font-black text-emerald-500 uppercase flex items-center gap-0.5">
                  <i className="fas fa-check text-[6px]"></i> {stats.wins}
                </span>
              )}
              {stats.losses > 0 && (
                <span className="text-[8px] font-black text-rose-500 uppercase flex items-center gap-0.5">
                  <i className="fas fa-times text-[6px]"></i> {stats.losses}
                </span>
              )}
              {stats.wins === 0 && stats.losses === 0 && (
                <span className="text-[7px] text-slate-600 font-bold uppercase">Break</span>
              )}
            </div>
          ) : (
            <div className="h-3"></div>
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
