
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Trade } from '../types';

interface ChartsProps {
  trades: Trade[];
}

const Charts: React.FC<ChartsProps> = ({ trades }) => {
  const cumulativeData = trades.slice().reverse().reduce((acc: any[], trade, index) => {
    const prevPnl = index > 0 ? acc[index - 1].pnl : 0;
    acc.push({
      name: trade.date,
      pnl: parseFloat((prevPnl + trade.pnl).toFixed(2))
    });
    return acc;
  }, []);

  return (
    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl mb-8">
      <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
        <i className="fas fa-chart-line text-blue-400"></i> Krzywa Kapitału (Equity)
      </h2>
      <div className="h-[300px] w-full">
        {trades.length > 0 ? (
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
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
                itemStyle={{ color: '#10b981' }}
              />
              <Area type="monotone" dataKey="pnl" stroke="#10b981" fillOpacity={1} fill="url(#colorPnl)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-500 italic">
            Zbyt mało danych do wyświetlenia wykresu
          </div>
        )}
      </div>
    </div>
  );
};

export default Charts;
