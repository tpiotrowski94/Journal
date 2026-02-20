
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Trade, Transfer } from '../types';

interface ChartsProps {
  trades: Trade[];
  initialBalance: number;
  transfers?: Transfer[];
}

// Custom label for transfer reference lines
const TransferLabel = ({ viewBox, type, amount }: any) => {
  const { x, y } = viewBox;
  const isDeposit = type === 'DEPOSIT';
  const color = isDeposit ? '#10b981' : '#f43f5e';
  const icon = isDeposit ? '↑' : '↓';
  return (
    <g>
      <rect x={x - 28} y={y - 22} width={56} height={18} rx={6} fill="#0f172a" stroke={color} strokeWidth={1} opacity={0.95} />
      <text x={x} y={y - 9} textAnchor="middle" fill={color} fontSize={10} fontWeight="900">
        {icon} ${Math.abs(amount) >= 1000 ? (amount / 1000).toFixed(1) + 'k' : amount.toFixed(0)}
      </text>
    </g>
  );
};

const Charts: React.FC<ChartsProps> = ({ trades, initialBalance, transfers = [] }) => {
  // Sort closed trades by exit date
  const closedTrades = [...trades]
    .filter(t => t.status === 'CLOSED')
    .sort((a, b) => new Date(a.exitDate || a.date).getTime() - new Date(b.exitDate || b.date).getTime());

  // Build unified timeline of trades + transfers
  type ChartPoint = { timestamp: number; label: string; dateShort: string; equity: number; isTransfer?: boolean; transferType?: string; transferAmount?: number };
  const points: ChartPoint[] = [];

  // Merge all events sorted by time
  type Ev = { time: number; pnlDelta: number; capitalDelta: number; isTransfer: boolean; transferType?: string; transferAmount?: number; dateShort: string; label: string };
  const allEvents: Ev[] = [];

  closedTrades.forEach(trade => {
    const t = new Date(trade.exitDate || trade.date).getTime();
    const d = new Date(trade.exitDate || trade.date);
    allEvents.push({
      time: t,
      pnlDelta: Number(trade.pnl) || 0,
      capitalDelta: 0,
      isTransfer: false,
      dateShort: d.toLocaleDateString([], { day: '2-digit', month: '2-digit' }),
      label: d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  });

  transfers.forEach(tr => {
    const t = new Date(tr.date + 'T12:00:00').getTime();
    const d = new Date(tr.date + 'T12:00:00');
    allEvents.push({
      time: t,
      pnlDelta: 0,
      capitalDelta: tr.type === 'DEPOSIT' ? tr.amount : -tr.amount,
      isTransfer: true,
      transferType: tr.type,
      transferAmount: tr.amount,
      dateShort: d.toLocaleDateString([], { day: '2-digit', month: '2-digit' }),
      label: `${tr.type === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'} $${tr.amount}`
    });
  });

  allEvents.sort((a, b) => a.time - b.time);

  if (allEvents.length > 0) {
    const startTime = allEvents[0].time - 3600_000;
    const startDate = new Date(startTime);
    points.push({
      timestamp: startTime,
      label: 'START',
      dateShort: startDate.toLocaleDateString([], { day: '2-digit', month: '2-digit' }),
      equity: initialBalance
    });

    let runningEquity = initialBalance;
    allEvents.forEach(ev => {
      runningEquity += ev.pnlDelta + ev.capitalDelta;
      points.push({
        timestamp: ev.time,
        label: ev.label,
        dateShort: ev.dateShort,
        equity: parseFloat(runningEquity.toFixed(2)),
        isTransfer: ev.isTransfer,
        transferType: ev.transferType,
        transferAmount: ev.transferAmount
      });
    });
  }

  // Transfer reference lines — unique dateShort per transfer (avoid visual clutter)
  const transferPoints = points.filter(p => p.isTransfer);

  const minEquity = points.length > 0 ? Math.min(...points.map(d => d.equity)) : 0;
  const strokeColor = minEquity < 0 ? '#f43f5e' : '#3b82f6';
  const fillId = minEquity < 0 ? 'colorEquityRed' : 'colorEquity';

  return (
    <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-black text-white flex items-center gap-2 uppercase italic tracking-tighter">
          <i className="fas fa-chart-line text-blue-400"></i> Equity Evolution
        </h2>
        <div className="flex items-center gap-3">
          {transferPoints.length > 0 && (
            <div className="flex items-center gap-3 text-[9px] font-black uppercase">
              <span className="flex items-center gap-1 text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>Deposit</span>
              <span className="flex items-center gap-1 text-rose-400"><span className="w-2 h-2 rounded-full bg-rose-400 inline-block"></span>Withdrawal</span>
            </div>
          )}
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-900 px-3 py-1 rounded-full border border-slate-700">
            Historical Portfolio Balance
          </div>
        </div>
      </div>

      <div className="h-[350px] w-full">
        {points.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points}>
              <defs>
                <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorEquityRed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
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
              <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 4" />

              {/* Transfer markers – vertical dashed lines with label */}
              {transferPoints.map((tp, i) => (
                <ReferenceLine
                  key={`tr-${i}`}
                  x={tp.dateShort}
                  stroke={tp.transferType === 'DEPOSIT' ? '#10b981' : '#f43f5e'}
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                  opacity={0.7}
                  label={<TransferLabel type={tp.transferType} amount={tp.transferAmount ?? 0} />}
                />
              ))}

              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)' }}
                itemStyle={{ color: strokeColor, fontWeight: '900', fontSize: '14px' }}
                labelStyle={{ color: '#64748b', fontSize: '10px', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 'bold' }}
                formatter={(value: number, _: string, props: any) => {
                  const isTransfer = props?.payload?.isTransfer;
                  const desc = isTransfer
                    ? [`$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${props.payload.label})`, 'Equity after transfer']
                    : [`$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Equity'];
                  return desc;
                }}
              />
              <Area
                type="monotone"
                dataKey="equity"
                stroke={strokeColor}
                fillOpacity={1}
                fill={`url(#${fillId})`}
                strokeWidth={4}
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
            <i className="fas fa-chart-area text-4xl opacity-10"></i>
            <div className="uppercase text-[10px] font-black tracking-[0.3em] italic opacity-20">
              Equity curve requires closed positions
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Charts;
