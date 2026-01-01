
import React, { useState, useMemo } from 'react';
import { Trade, TradeStatus } from '../types';

interface PnLCalendarProps {
  trades: Trade[];
}

const PnLCalendar: React.FC<PnLCalendarProps> = ({ trades }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const startDayOfMonth = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Start from Monday
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Obliczanie P&L per dzień
  const dailyPnL = useMemo(() => {
    const map: Record<string, number> = {};
    trades.filter(t => t.status === TradeStatus.CLOSED).forEach(t => {
      const d = new Date(t.date).toISOString().split('T')[0];
      map[d] = (map[d] || 0) + t.pnl;
    });
    return map;
  }, [trades]);

  // Znalezienie max wartości w miesiącu do skalowania słupków
  const maxAbsPnL = useMemo(() => {
    const values = Object.keys(dailyPnL)
      .filter(key => key.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`))
      .map(key => Math.abs(dailyPnL[key]));
    return values.length > 0 ? Math.max(...values) : 1;
  }, [dailyPnL, year, month]);

  const monthStats = useMemo(() => {
    const monthTrades = trades.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === month && d.getFullYear() === year && t.status === TradeStatus.CLOSED;
    });
    const pnl = monthTrades.reduce((sum, t) => sum + t.pnl, 0);
    const wins = monthTrades.filter(t => t.pnl > 0).length;
    return {
      pnl,
      winRate: monthTrades.length > 0 ? (wins / monthTrades.length) * 100 : 0
    };
  }, [trades, month, year]);

  const monthNames = [
    "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
    "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"
  ];

  const renderDays = () => {
    const days = [];
    const totalDays = daysInMonth(year, month);
    const startOffset = startDayOfMonth(year, month);

    for (let i = 0; i < startOffset; i++) {
      days.push(<div key={`empty-${i}`} className="h-20 md:h-28 bg-slate-900/10 border border-slate-800/30 rounded-xl opacity-10" />);
    }

    for (let d = 1; d <= totalDays; d++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const pnl = dailyPnL[dateKey];
      const isToday = new Date().toISOString().split('T')[0] === dateKey;
      
      // Obliczanie wysokości słupka (max 60% wysokości komórki)
      const barHeight = pnl ? (Math.abs(pnl) / maxAbsPnL) * 60 : 0;

      days.push(
        <div 
          key={d} 
          className={`h-20 md:h-28 p-1.5 border rounded-xl flex flex-col items-center justify-between transition-all relative overflow-hidden ${
            isToday ? 'border-blue-500/50 bg-blue-500/5' : 'border-slate-800 bg-slate-900/20'
          }`}
        >
          <span className={`text-[9px] font-black self-start ${isToday ? 'text-blue-400' : 'text-slate-600'}`}>{d}</span>
          
          {/* Wizualny słupek P&L (BingX Style) */}
          <div className="flex-1 w-full flex items-center justify-center relative">
            {pnl !== undefined && (
              <div 
                className={`w-2 md:w-3 rounded-t-sm transition-all duration-700 ${pnl >= 0 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)]'}`}
                style={{ height: `${Math.max(barHeight, 5)}%` }}
              />
            )}
          </div>

          {pnl !== undefined && (
            <div className={`text-[8px] md:text-[10px] font-black truncate ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {pnl >= 0 ? '+' : ''}{pnl.toFixed(0)}$
            </div>
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
          <h2 className="text-xl font-black text-white uppercase italic tracking-tighter flex items-center gap-2">
            <i className="fas fa-calendar-check text-emerald-500"></i> Visual Journal
          </h2>
          <div className="bg-slate-900 px-3 py-1 rounded-full border border-slate-700">
             <span className="text-[10px] font-black text-slate-300 uppercase">{monthNames[month]} {year}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex gap-4 border-r border-slate-700 pr-4">
            <div className="text-center">
              <div className="text-[8px] font-black text-slate-500 uppercase">Monthly P&L</div>
              <div className={`text-xs font-black ${monthStats.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {monthStats.pnl >= 0 ? '+' : ''}{monthStats.pnl.toFixed(2)}$
              </div>
            </div>
            <div className="text-center">
              <div className="text-[8px] font-black text-slate-500 uppercase">Win Rate</div>
              <div className="text-xs font-black text-blue-400">{monthStats.winRate.toFixed(1)}%</div>
            </div>
          </div>
          <div className="flex gap-1">
            <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all"><i className="fas fa-chevron-left text-xs"></i></button>
            <button onClick={() => setCurrentDate(new Date())} className="px-3 h-8 rounded-lg bg-slate-900 border border-slate-700 text-[9px] font-black text-slate-400 hover:text-white uppercase transition-all">Today</button>
            <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all"><i className="fas fa-chevron-right text-xs"></i></button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-2">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
          <div key={d} className="text-center text-[9px] font-black text-slate-600 uppercase tracking-widest py-2">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {renderDays()}
      </div>
    </div>
  );
};

export default PnLCalendar;
