
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Trade } from '../types';

interface ChartsProps {
  trades: Trade[];
  initialBalance: number;
}

const Charts: React.FC<ChartsProps> = ({ trades, initialBalance }) => {
  // Sortujemy po dacie wyjścia, bo to ona decyduje o momencie wpłynięcia PnL do portfela
  const closedTrades = trades
    .filter(t => t.status === 'CLOSED')
    .sort((a, b) => {
      const dateA = new Date(a.exitDate || a.date).getTime();
      const dateB = new Date(b.exitDate || b.date).getTime();
      return dateA - dateB;
    });

  const cumulativeData = [];
  
  // Punkt startowy (przed pierwszym trejdem)
  if (closedTrades.length > 0) {
    const firstTradeTime = new Date(closedTrades[0].exitDate || closedTrades[0].date);
    const startPointDate = new Date(firstTradeTime.getTime() - 1000 * 60 * 60); // 1h wcześniej
    cumulativeData.push({
      timestamp: startPointDate.getTime(),
      label: 'START',
      dateShort: startPointDate.toLocaleDateString([], { day: '2-digit', month: '2-digit' }),
      equity: initialBalance
    });
  }

  let runningEquity = initialBalance;
  closedTrades.forEach((trade) => {
    runningEquity += (Number(trade.pnl) || 0);
    const date = new Date(trade.exitDate || trade.date);
    cumulativeData.push({
      timestamp: date.getTime(),
      label: `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`,
      dateShort: date.toLocaleDateString([], { day: '2-digit', month: '2-digit' }),
      equity: parseFloat(runningEquity.toFixed(2))
    });
  });

  return (
    <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-black text-white flex items-center gap-2 uppercase italic tracking-tighter">
          <i className="fas fa-chart-line text-blue-400"></i> Equity Evolution
        </h2>
        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-900 px-3 py-1 rounded-full border border-slate-700">
          Historyczny Balans Portfela
        </div>
      </div>
      
      <div className="h-[350px] w-full">
        {cumulativeData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cumulativeData}>
              <defs>
                <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.5} />
              <XAxis 
                dataKey="dateShort" 
                stroke="#64748b" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
                padding={{ left: 10, right: 10 }}
                interval="preserveStart"
                minTickGap={30}
              />
              <YAxis 
                stroke="#64748b" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false} 
                domain={['auto', 'auto']}
                tickFormatter={(val) => `$${val.toLocaleString()}`} 
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)' }}
                itemStyle={{ color: '#3b82f6', fontWeight: '900', fontSize: '14px' }}
                labelStyle={{ color: '#64748b', fontSize: '10px', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 'bold' }}
                formatter={(value: number) => [`$${value.toLocaleString()}`, 'Kapitał']}
              />
              <Area 
                type="monotone" 
                dataKey="equity" 
                stroke="#3b82f6" 
                fillOpacity={1} 
                fill="url(#colorEquity)" 
                strokeWidth={4} 
                animationDuration={1500} 
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
            <i className="fas fa-chart-area text-4xl opacity-10"></i>
            <div className="uppercase text-[10px] font-black tracking-[0.3em] italic opacity-20">
              Krzywa kapitału wymaga zamkniętych pozycji
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Charts;
