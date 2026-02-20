
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Trade, Transfer } from '../types';

interface ChartsProps {
  trades: Trade[];
  initialBalance: number;
  transfers?: Transfer[];
  historyStartDate?: string;
}

// Custom label rendered inside the SVG for transfer reference lines
const TransferLabel = ({ viewBox, type, amount }: any) => {
  const { x, y } = viewBox;
  const isDeposit = type === 'DEPOSIT';
  const color = isDeposit ? '#10b981' : '#f43f5e';
  const icon = isDeposit ? '↑' : '↓';
  const label = `${icon} $${amount >= 1000 ? (amount / 1000).toFixed(1) + 'k' : amount.toFixed(0)}`;
  return (
    <g>
      <rect x={x - 30} y={y - 24} width={60} height={18} rx={5} fill="#0f172a" stroke={color} strokeWidth={1} opacity={0.95} />
      <text x={x} y={y - 11} textAnchor="middle" fill={color} fontSize={10} fontWeight="900">{label}</text>
    </g>
  );
};

const Charts: React.FC<ChartsProps> = ({ trades, initialBalance, transfers = [], historyStartDate }) => {
  // Determine the cutoff timestamp – same logic as syncService
  const cutoffMs = historyStartDate ? new Date(historyStartDate).getTime() : 0;

  // Sort closed trades by exit date, respecting historyStartDate
  const closedTrades = [...trades]
    .filter(t => {
      if (t.status !== 'CLOSED') return false;
      if (cutoffMs <= 0) return true;
      const tradeTime = new Date(t.exitDate || t.date).getTime();
      return tradeTime >= cutoffMs;
    })
    .sort((a, b) => new Date(a.exitDate || a.date).getTime() - new Date(b.exitDate || b.date).getTime());

  // Filter transfers to history window too
  const visibleTransfers = transfers.filter(tr => {
    if (cutoffMs <= 0) return true;
    return new Date(tr.date + 'T00:00:00').getTime() >= cutoffMs;
  });

  // Build unified timeline
  type Ev = {
    time: number;
    pnlDelta: number;
    capitalDelta: number;
    isTransfer: boolean;
    transferType?: string;
    transferAmount?: number;
    dateShort: string;
    label: string;
  };

  const allEvents: Ev[] = [];

  closedTrades.forEach(trade => {
    const d = new Date(trade.exitDate || trade.date);
    allEvents.push({
      time: d.getTime(),
      pnlDelta: Number(trade.pnl) || 0,
      capitalDelta: 0,
      isTransfer: false,
      dateShort: d.toLocaleDateString([], { day: '2-digit', month: '2-digit' }),
      label: d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  });

  visibleTransfers.forEach(tr => {
    // Use noon so it sorts sensibly relative to same-day trades
    const d = new Date(tr.date + 'T12:00:00');
    allEvents.push({
      time: d.getTime(),
      pnlDelta: 0,
      capitalDelta: tr.type === 'DEPOSIT' ? tr.amount : -tr.amount,
      isTransfer: true,
      transferType: tr.type,
      transferAmount: tr.amount,
      dateShort: d.toLocaleDateString([], { day: '2-digit', month: '2-digit' }),
      label: `${tr.type === 'DEPOSIT' ? 'Wpłata' : 'Wypłata'} $${tr.amount}`
    });
  });

  allEvents.sort((a, b) => a.time - b.time);

  // Build chart data
  type Point = {
    timestamp: number;
    label: string;
    dateShort: string;
    equity: number;
    isTransfer?: boolean;
    transferType?: string;
    transferAmount?: number;
  };

  const points: Point[] = [];

  if (allEvents.length > 0) {
    const startTime = allEvents[0].time - 3_600_000;
    const startDate = new Date(startTime);
    points.push({
      timestamp: startTime,
      label: 'START',
      dateShort: startDate.toLocaleDateString([], { day: '2-digit', month: '2-digit' }),
      equity: Math.max(0, initialBalance) // start at least at 0
    });

    let runningEquity = Math.max(0, initialBalance);
    allEvents.forEach(ev => {
      runningEquity += ev.pnlDelta + ev.capitalDelta;
      // Equity = portfolio value: cannot go below 0 (all capital liquidated)
      const equity = Math.max(0, parseFloat(runningEquity.toFixed(2)));
      points.push({
        timestamp: ev.time,
        label: ev.label,
        dateShort: ev.dateShort,
        equity,
        isTransfer: ev.isTransfer,
        transferType: ev.transferType,
        transferAmount: ev.transferAmount
      });
    });
  }

  const transferPoints = points.filter(p => p.isTransfer);
  const strokeColor = '#3b82f6';
  const fillId = 'colorEquity';

  return (
    <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-black text-white flex items-center gap-2 uppercase italic tracking-tighter">
          <i className="fas fa-chart-line text-blue-400"></i> Equity Evolution
        </h2>
        <div className="flex items-center gap-3">
          {transferPoints.length > 0 && (
            <div className="flex items-center gap-3 text-[9px] font-black uppercase tracking-wider">
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>Deposit
              </span>
              <span className="flex items-center gap-1 text-rose-400">
                <span className="w-2 h-2 rounded-full bg-rose-400 inline-block"></span>Withdrawal
              </span>
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
                domain={[0, 'auto']}
                tickFormatter={(val) => `$${val.toLocaleString()}`}
              />

              {/* Transfer markers */}
              {transferPoints.map((tp, i) => (
                <ReferenceLine
                  key={`tr-${i}`}
                  x={tp.dateShort}
                  stroke={tp.transferType === 'DEPOSIT' ? '#10b981' : '#f43f5e'}
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                  opacity={0.75}
                  label={<TransferLabel type={tp.transferType} amount={tp.transferAmount ?? 0} />}
                />
              ))}

              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)' }}
                itemStyle={{ color: strokeColor, fontWeight: '900', fontSize: '14px' }}
                labelStyle={{ color: '#64748b', fontSize: '10px', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 'bold' }}
                formatter={(value: number, _: string, props: any) => {
                  const p = props?.payload;
                  if (p?.isTransfer) {
                    const dir = p.transferType === 'DEPOSIT' ? '↑ Wpłata' : '↓ Wypłata';
                    return [`$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${dir} $${p.transferAmount})`, 'Equity'];
                  }
                  return [`$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Equity'];
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
