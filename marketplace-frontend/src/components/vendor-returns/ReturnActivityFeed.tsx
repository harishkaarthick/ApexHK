import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, RotateCw, UploadCloud, Clock3, Headphones } from 'lucide-react';
import type { ReturnRequest } from '@/types';

export interface ActivityItem {
  id: string;
  title: string;
  subtitle: string;
  time: string;
  tone: 'success' | 'error' | 'info' | 'warning';
}

const toneStyles: Record<ActivityItem['tone'], { bg: string; fg: string; Icon: typeof CheckCircle2 }> = {
  success: { bg: 'bg-emerald-50', fg: 'text-emerald-600', Icon: CheckCircle2 },
  error: { bg: 'bg-red-50', fg: 'text-red-500', Icon: XCircle },
  info: { bg: 'bg-blue-50', fg: 'text-blue-500', Icon: RotateCw },
  warning: { bg: 'bg-amber-50', fg: 'text-amber-500', Icon: Clock3 },
};

function timeAgo(dateStr?: string) {
  if (!dateStr) return '';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.max(1, Math.floor(diffMs / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function buildActivityFromReturns(returns: ReturnRequest[]): ActivityItem[] {
  const events: ActivityItem[] = [];

  returns.forEach((r) => {
    const shortId = `#RET-${r.id.slice(-5).toUpperCase()}`;
    if (r.status === 'APPROVED' || r.status === 'FINAL_APPROVED') {
      events.push({ id: `${r.id}-approved`, title: 'Return approved', subtitle: `${shortId} approved`, time: r.resolvedAt || r.createdAt, tone: 'success' });
    } else if (r.status === 'REJECTED' || r.status === 'FINAL_REJECTED') {
      events.push({ id: `${r.id}-rejected`, title: 'Return rejected', subtitle: `${shortId} rejected`, time: r.resolvedAt || r.createdAt, tone: 'error' });
    } else if (r.status === 'REFUND_INITIATED') {
      events.push({ id: `${r.id}-refund`, title: 'Refund initiated', subtitle: `Refund of ${r.refundAmount ? `₹${r.refundAmount.toLocaleString('en-IN')}` : ''} initiated`, time: r.createdAt, tone: 'info' });
    } else if (r.status === 'REFUNDED') {
      events.push({ id: `${r.id}-refunded`, title: 'Refund completed', subtitle: `${shortId} refunded`, time: r.resolvedAt || r.createdAt, tone: 'success' });
    } else if (r.status === 'RETURN_REQUESTED') {
      events.push({ id: `${r.id}-requested`, title: 'New return request', subtitle: `${shortId} submitted`, time: r.createdAt, tone: 'warning' });
    }
  });

  return events
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 6);
}

export default function ReturnActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.2, ease: 'easeOut' }}
      className="rounded-[20px] bg-white p-6 shadow-[0_4px_24px_rgba(15,23,42,0.06)]"
    >
      <h2 className="text-base font-semibold text-slate-900">Recent Activity</h2>
      <p className="mt-0.5 text-sm text-slate-400">Latest return activities</p>

      <div className="mt-5 space-y-1">
        {items.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-400">No recent activity yet.</p>
        )}
        {items.map((item, i) => {
          const { bg, fg, Icon } = toneStyles[item.tone];
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.05 * i }}
              className="flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-slate-50"
            >
              <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${bg} ${fg}`}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                <p className="truncate text-xs text-slate-400">{item.subtitle}</p>
              </div>
              <span className="shrink-0 text-xs text-slate-400">{timeAgo(item.time)}</span>
            </motion.div>
          );
        })}
      </div>

      <button className="mt-4 w-full rounded-xl py-2 text-center text-sm font-semibold text-violet-600 transition-colors hover:bg-violet-50">
        View all activity
      </button>

      <div className="mt-6 rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 p-5 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white shadow-sm">
          <Headphones className="h-5 w-5 text-violet-500" />
        </span>
        <p className="mt-3 text-sm font-semibold text-slate-800">Need Help?</p>
        <p className="mt-1 text-xs text-slate-500">Our support team is here to help</p>
        <button className="mt-4 w-full rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 py-2 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02] active:scale-[0.98]">
          Contact Support
        </button>
      </div>
    </motion.div>
  );
}
