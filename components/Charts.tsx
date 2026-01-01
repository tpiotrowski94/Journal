
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { Trade } from '../types';

interface ChartsProps {
  trades: Trade[];
}

const Charts: React.FC<ChartsProps> = ({ trades }) => {
  const closedTrades = trades.filter(t => t.status === 'CLOSED').slice().reverse();

  const cumulativeData = closedTrades.reduce((acc: any[], trade, index) => {
    const prevPnl = index > 0 ? acc[index - 1].pnl : 0;
    acc.push({
      name: trade.date,
      pnl: parseFloat((prevPnl + trade.pnl).toFixed(2))
    });
    return acc;
  }, []);

  // Data for Heatmap (Day of Week Performance)
  const dayPerformance = closedTrades.reduce((acc: any, trade) => {
    const day = new Date(trade.date).getDay(); // 0-6
    const days = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So'];
    const dayName = days[day];
    if (!acc[dayName]) acc[dayName] = 0;
    acc[dayName] += trade.pnl;
    return acc;
  }, {});

  const heatmapData = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'].map(day => ({
    day,
    pnl: dayPerformance[day] || 0
  }));

  return (
    <div className="space-y-8">
      <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl">
        <h2 className="text-xl font-black mb-6 text-white flex items-center gap-2 uppercase italic tracking-tighter">
          <i className="fas fa-chart-line text-blue-400"></i> Equity Curve
        </h2>
        <div className="h-[250px] w-full">
          {cumulativeData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cumulativeData}>
                <defs>
                  <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
                  itemStyle={{ color: '#10b981' }}
                />
                <Area type="monotone" dataKey="pnl" stroke="#10b981" fillOpacity={1} fill="url(#colorPnl)" strokeWidth={4} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 uppercase text-[10px] font-black tracking-widest opacity-20">
              Need more data
            </div>
          )}
        </div>
      </div>

      <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl">
        <h2 className="text-xl font-black mb-6 text-white flex items-center gap-2 uppercase italic tracking-tighter">
          <i className="fas fa-calendar-days text-purple-400"></i> Performance by Day
        </h2>
        <div className="h-[200px] w-full">
          {closedTrades.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={heatmapData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                <XAxis dataKey="day" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  {heatmapData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#f43f5e'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
             <div className="h-full flex items-center justify-center text-slate-500 uppercase text-[10px] font-black tracking-widest opacity-20">
              Waiting for closed trades
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Charts;
