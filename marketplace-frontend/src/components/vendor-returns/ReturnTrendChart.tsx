import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { ReturnRequest } from '@/types';

type RangeKey = '7d' | '30d' | '1y';

const ranges: { key: RangeKey; label: string }[] = [
  { key: '7d', label: 'Last 7 Days' },
  { key: '30d', label: 'Last 30 Days' },
  { key: '1y', label: 'Last Year' },
];

function buildSeries(returns: ReturnRequest[], range: RangeKey) {
  const now = new Date();
  const buckets: { key: string; label: string; date: Date }[] = [];

  if (range === '1y') {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('en-IN', { month: 'short' }), date: d });
    }
  } else {
    const days = range === '7d' ? 7 : 30;
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      buckets.push({ key: d.toISOString().slice(0, 10), label: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }), date: d });
    }
  }

  const counts = new Map(buckets.map((b) => [b.key, 0]));

  returns.forEach((r) => {
    if (!r.createdAt) return;
    const d = new Date(r.createdAt);
    const key = range === '1y' ? `${d.getFullYear()}-${d.getMonth()}` : d.toISOString().slice(0, 10);
    if (counts.has(key)) counts.set(key, (counts.get(key) || 0) + 1);
  });

  return buckets.map((b) => ({ label: b.label, returns: counts.get(b.key) || 0 }));
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-xl">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
        <span className="h-2 w-2 rounded-full bg-violet-500" /> Returns&nbsp;
        <span className="text-violet-600">{payload[0].value}</span>
      </p>
    </div>
  );
}

export default function ReturnTrendChart({ returns }: { returns: ReturnRequest[] }) {
  const [range, setRange] = useState<RangeKey>('30d');
  const data = useMemo(() => buildSeries(returns, range), [returns, range]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.1, ease: 'easeOut' }}
      className="rounded-[20px] bg-white p-6 shadow-[0_4px_24px_rgba(15,23,42,0.06)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Return Trends</h2>
          <p className="mt-0.5 text-sm text-slate-400">Overview of returns received over time</p>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-slate-100 p-1">
          {ranges.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`relative rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                range === r.key ? 'text-white' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {range === r.key && (
                <motion.span
                  layoutId="trend-range-pill"
                  className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-500 to-purple-500"
                  transition={{ type: 'spring', damping: 24, stiffness: 320 }}
                />
              )}
              <span className="relative z-10">{r.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="returnsFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              interval={range === '30d' ? 4 : 0}
            />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} width={32} />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#c4b5fd', strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="returns"
              stroke="#8b5cf6"
              strokeWidth={2.5}
              fill="url(#returnsFill)"
              dot={false}
              activeDot={{ r: 5, fill: '#8b5cf6', stroke: '#fff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
