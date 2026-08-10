import { motion } from 'framer-motion';

interface InsightsData {
  pendingCount: number;
  pendingPct: number;
  avgProcessingDays: number;
  approvalRate: number;
  approvalDeltaPct: number;
  refundSuccessRate: number;
  refundDeltaPct: number;
}

function Bar({ pct, gradient }: { pct: number; gradient: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
        className={`h-full rounded-full ${gradient}`}
      />
    </div>
  );
}

function Metric({
  label,
  value,
  suffix,
  delta,
  pct,
  gradient,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  delta?: { value: number; positive: boolean; tag?: string };
  pct: number;
  gradient: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-sm text-slate-500">{label}</p>
        {delta && (
          <span className={`text-xs font-semibold ${delta.positive ? 'text-emerald-600' : 'text-red-500'}`}>
            {delta.tag ?? (delta.positive ? `↑ ${delta.value.toFixed(1)}%` : `↓ ${Math.abs(delta.value).toFixed(1)}%`)}
          </span>
        )}
      </div>
      <p className="mt-1 text-2xl font-bold text-slate-900">
        {value}
        {suffix && <span className="ml-0.5 text-base font-semibold text-slate-400">{suffix}</span>}
      </p>
      <div className="mt-2.5">
        <Bar pct={pct} gradient={gradient} />
      </div>
    </div>
  );
}

export default function ReturnInsights({ data }: { data: InsightsData }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.15, ease: 'easeOut' }}
      className="flex h-full flex-col rounded-[20px] bg-white p-6 shadow-[0_4px_24px_rgba(15,23,42,0.06)]"
    >
      <div>
        <h2 className="text-base font-semibold text-slate-900">Return Insights</h2>
        <p className="mt-0.5 text-sm text-slate-400">Key performance metrics</p>
      </div>

      <div className="mt-6 space-y-6">
        <Metric
          label="Pending Returns"
          value={data.pendingCount}
          suffix={`(${data.pendingPct.toFixed(0)}%)`}
          pct={data.pendingPct}
          gradient="bg-gradient-to-r from-amber-400 to-orange-400"
        />
        <Metric
          label="Avg. Processing Time"
          value={data.avgProcessingDays.toFixed(1)}
          suffix="Days"
          delta={{ value: 0, positive: true, tag: data.avgProcessingDays <= 3 ? 'Good' : 'Watch' }}
          pct={Math.max(0, 100 - data.avgProcessingDays * 12)}
          gradient="bg-gradient-to-r from-sky-400 to-blue-500"
        />
        <Metric
          label="Approval Rate"
          value={data.approvalRate.toFixed(1)}
          suffix="%"
          delta={{ value: data.approvalDeltaPct, positive: data.approvalDeltaPct >= 0 }}
          pct={data.approvalRate}
          gradient="bg-gradient-to-r from-emerald-400 to-green-500"
        />
        <Metric
          label="Refund Success Rate"
          value={data.refundSuccessRate.toFixed(1)}
          suffix="%"
          delta={{ value: data.refundDeltaPct, positive: data.refundDeltaPct >= 0 }}
          pct={data.refundSuccessRate}
          gradient="bg-gradient-to-r from-cyan-400 to-sky-500"
        />
      </div>
    </motion.div>
  );
}
