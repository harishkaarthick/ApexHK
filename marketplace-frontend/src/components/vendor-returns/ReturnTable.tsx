import { motion } from 'framer-motion';
import { Search, ChevronDown, Download, Calendar, Package } from 'lucide-react';
import { dt, money } from '@/pages/pageShared';
import Pagination from '@/components/shared/Pagination';
import type { ReturnRequest, ReturnStatus } from '@/types';
import { statusOptions, getStatusMeta } from './statusMeta';
import EmptyReturnsState from './EmptyReturnsState';

interface ReturnTableProps {
  returns: ReturnRequest[];
  isLoading: boolean;
  page: number;
  totalPages: number;
  totalElements: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: ReturnStatus | '';
  onStatusChange: (value: ReturnStatus | '') => void;
  onExport: () => void;
  onRefresh: () => void;
  onOpenReturn: (returnId: string) => void;
}

export default function ReturnTable(props: ReturnTableProps) {
  const {
    returns, isLoading, page, totalPages, totalElements, pageSize, onPageChange,
    searchTerm, onSearchChange, statusFilter, onStatusChange, onExport, onRefresh, onOpenReturn,
  } = props;

  const from = totalElements === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(totalElements, page * pageSize + returns.length);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.25, ease: 'easeOut' }}
      className="rounded-[20px] bg-white p-6 shadow-[0_4px_24px_rgba(15,23,42,0.06)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-base font-semibold text-slate-900">Recent Return Requests</h2>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by Return ID or customer..."
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-700 placeholder-slate-400 outline-none transition focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100"
          />
        </div>

        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value as ReturnStatus | '')}
            className="h-11 cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50 pl-4 pr-9 text-sm font-medium text-slate-600 outline-none transition focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100"
          >
            <option value="">All Statuses</option>
            {statusOptions.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>

        <button
          type="button"
          className="hidden h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-100 sm:flex"
        >
          <Calendar className="h-4 w-4 text-slate-400" />
          Date Range
        </button>

        <button
          onClick={onExport}
          className="flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 px-4 text-sm font-semibold text-white shadow-md shadow-violet-500/20 transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>

      <div className="mt-6 overflow-x-auto">
        {isLoading ? (
          <div className="space-y-3 py-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 w-full animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : returns.length === 0 ? (
          <EmptyReturnsState onRefresh={onRefresh} />
        ) : (
          <table className="w-full min-w-[720px] border-separate border-spacing-y-1">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2">Return ID</th>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Refund Amount</th>
                <th className="px-3 py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((r, i) => (
                <Row key={r.id} r={r} index={i} onOpen={() => onOpenReturn(r.id)} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {returns.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-slate-400">
            Showing {from} to {to} of {totalElements} returns
          </p>
          <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
        </div>
      )}
    </motion.div>
  );
}

function Row({ r, index, onOpen }: { r: ReturnRequest; index: number; onOpen: () => void }) {
  const meta = getStatusMeta(r.status);
  const shortId = `#RET-${r.id.slice(-5).toUpperCase()}`;

  return (
    <motion.tr
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index, 8) * 0.03 }}
      onClick={onOpen}
      className="group cursor-pointer rounded-xl bg-white transition-colors hover:bg-slate-50"
    >
      <td className="rounded-l-xl px-3 py-3.5 align-middle">
        <p className="text-sm font-semibold text-slate-800">{shortId}</p>
        <p className="text-xs text-slate-400">Order: #{r.orderId.slice(-8).toUpperCase()}</p>
      </td>
      <td className="px-3 py-3.5 align-middle">
        <div className="flex items-center gap-3">
          {r.productImage ? (
            <img src={r.productImage} alt={r.productName} className="h-9 w-9 shrink-0 rounded-lg object-cover" />
          ) : (
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-400">
              <Package className="h-4 w-4" />
            </span>
          )}
          <p className="max-w-[220px] truncate text-sm font-medium text-slate-700">{r.productName}</p>
        </div>
      </td>
      <td className="px-3 py-3.5 align-middle">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.badge}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
      </td>
      <td className="px-3 py-3.5 align-middle text-sm font-semibold text-slate-800">{money(r.refundAmount || 0)}</td>
      <td className="rounded-r-xl px-3 py-3.5 align-middle text-sm text-slate-500">{dt(r.createdAt)}</td>
    </motion.tr>
  );
}
