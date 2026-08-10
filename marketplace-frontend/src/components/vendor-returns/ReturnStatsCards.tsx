import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { RotateCcw, Clock, CheckCircle2, Wallet } from 'lucide-react';
import { money } from '@/pages/pageShared';

export interface ReturnStat {
  key: string;
  label: string;
  value: number;
  isCurrency?: boolean;
  changePct?: number; // positive = up, negative = down
  icon: LucideIcon;
  iconBg: string;
  trend: number[]; // small sparkline series
  strokeColor: string;
}

function AnimatedNumber({ value, isCurrency }: { value: number; isCurrency?: boolean }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let raf: number;
    const duration = 800;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <>{isCurrency ? money(display) : display.toLocaleString('en-IN')}</>;
}

function Sparkline({ data, stroke }: { data: number[]; stroke: string }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = Math.max(max - min, 1);
  const w = 88;
  const h = 32;
  const step = w / Math.max(data.length - 1, 1);
  const points = data
    .map((d, i) => `${i * step},${h - ((d - min) / range) * h}`)
    .join(' ');

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ReturnStatsCards({ stats }: { stats: ReturnStat[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        const up = (stat.changePct ?? 0) >= 0;
        return (
          <motion.div
            key={stat.key}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.07, ease: 'easeOut' }}
            whileHover={{ y: -3 }}
            className="rounded-[20px] bg-white/95 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.08)] backdrop-blur-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${stat.iconBg}`}>
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <p className="truncate text-sm font-medium text-slate-500">{stat.label}</p>
                </div>
                <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
                  <AnimatedNumber value={stat.value} isCurrency={stat.isCurrency} />
                </p>
                {typeof stat.changePct === 'number' && (
                  <p className={`mt-1.5 text-xs font-semibold ${up ? 'text-emerald-600' : 'text-red-500'}`}>
                    {up ? '↑' : '↓'} {Math.abs(stat.changePct).toFixed(1)}% vs last month
                  </p>
                )}
              </div>
              <Sparkline data={stat.trend} stroke={stat.strokeColor} />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export const statIcons = { RotateCcw, Clock, CheckCircle2, Wallet };
