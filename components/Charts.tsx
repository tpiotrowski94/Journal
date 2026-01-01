
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Trade } from '../types';

interface ChartsProps {
  trades: Trade[];
}

const Charts: React.FC<ChartsProps> = ({ trades }) => {
  // Sort trades by exact date and time ASC for high precision equity curve
  const closedTrades = trades
    .filter(t => t.status === 'CLOSED')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const cumulativeData = closedTrades.reduce((acc: any[], trade, index) => {
    const prevPnl = index > 0 ? acc[index - 1].pnl : 0;
    const date = new Date(trade.date);
    acc.push({
      timestamp: date.getTime(),
      label: `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`,
      pnl: parseFloat((prevPnl + trade.pnl).toFixed(2))
    });
    return acc;
  }, []);

  return (
    <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl overflow-hidden">
      <h2 className="text-xl font-black mb-6 text-white flex items-center gap-2 uppercase italic tracking-tighter">
        <i className="fas fa-chart-line text-blue-400"></i> Equity Evolution
      </h2>
      <div className="h-[300px] w-full">
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
              <XAxis 
                dataKey="label" 
                stroke="#64748b" 
                fontSize={9} 
                tickLine={false} 
                axisLine={false}
                hide={true} // Cleaner look, labels in tooltip
              />
              <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
                itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                labelStyle={{ color: '#64748b', fontSize: '10px', marginBottom: '4px', textTransform: 'uppercase' }}
              />
              <Area type="monotone" dataKey="pnl" stroke="#10b981" fillOpacity={1} fill="url(#colorPnl)" strokeWidth={3} animationDuration={1500} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-500 uppercase text-[10px] font-black tracking-widest opacity-20">
            Krzywa kapitału wymaga zamkniętych pozycji
          </div>
        )}
      </div>
    </div>
  );
};

export default Charts;
