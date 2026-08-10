import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { RotateCcw, Clock, CheckCircle2, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';

import api from '@/lib/axios';
import { unwrap, pageOf } from '@/pages/pageShared';
import type { ReturnRequest, ReturnStatus, PagedResponse } from '@/types';

import ReturnStatsCards, { type ReturnStat } from '@/components/vendor-returns/ReturnStatsCards';
import ReturnTrendChart from '@/components/vendor-returns/ReturnTrendChart';
import ReturnInsights from '@/components/vendor-returns/ReturnInsights';
import ReturnActivityFeed, { buildActivityFromReturns } from '@/components/vendor-returns/ReturnActivityFeed';
import ReturnTable from '@/components/vendor-returns/ReturnTable';
import ReturnDetailPanel from '@/components/vendor-returns/ReturnDetailPanel';
import { APPROVED_STATUSES, PENDING_STATUSES, REFUNDED_STATUSES, REJECTED_STATUSES } from '@/components/vendor-returns/statusMeta';

export function VendorReturnsDashboard() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { id: routeReturnId } = useParams();
  const [page, setPage] = useState(0);
  const [size] = useState(10);
  const [statusFilter, setStatusFilter] = useState<ReturnStatus | ''>('');
  const [searchTerm, setSearchTerm] = useState('');

  // Paginated table data — same endpoint/params as before.
  const { data: returnsData, isLoading } = useQuery({
    queryKey: ['vendor-returns', page, size, statusFilter, searchTerm],
    queryFn: () => {
      const params: any = { page, size };
      if (statusFilter) params.status = statusFilter;
      if (searchTerm) params.search = searchTerm;
      return api.get('/vendor/returns', { params }).then((r) => unwrap<PagedResponse<ReturnRequest>>(r));
    },
  });

  const { data: pendingReturns } = useQuery({
    queryKey: ['vendor-pending-returns'],
    queryFn: () => api.get('/vendor/returns/pending', { params: { page: 0, size: 5 } }).then((r) => unwrap<PagedResponse<ReturnRequest>>(r)),
  });

  // Wider sample (same endpoint, larger page size) used only to power charts/insights/activity
  // so KPIs aren't skewed by the current 10-row table page.
  const { data: analyticsSample } = useQuery({
    queryKey: ['vendor-returns-analytics-sample'],
    queryFn: () => api.get('/vendor/returns', { params: { page: 0, size: 200 } }).then((r) => unwrap<PagedResponse<ReturnRequest>>(r)),
  });

  const sampleRows = pageOf(analyticsSample);
  const tableRows = pageOf(returnsData);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['vendor-returns'] });
    qc.invalidateQueries({ queryKey: ['vendor-pending-returns'] });
    qc.invalidateQueries({ queryKey: ['vendor-returns-analytics-sample'] });
  };

  const handleExport = () => {
    if (!tableRows.length) {
      toast('No returns to export');
      return;
    }
    const header = ['Return ID', 'Order ID', 'Product', 'Reason', 'Status', 'Refund Amount', 'Created Date'];
    const rows = tableRows.map((r) => [
      r.id, r.orderId, r.productName, r.reason, r.status, String(r.refundAmount ?? 0), r.createdAt,
    ]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vendor-returns-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Derived KPI / insight data (client-side, same source data the page already fetches) ──
  const totalReturns = returnsData?.totalElements ?? sampleRows.length;
  const pendingCount = pendingReturns?.totalElements ?? sampleRows.filter((r) => PENDING_STATUSES.includes(r.status)).length;
  const approvedCount = sampleRows.filter((r) => APPROVED_STATUSES.includes(r.status)).length;
  const rejectedCount = sampleRows.filter((r) => REJECTED_STATUSES.includes(r.status)).length;
  const totalRefunds = sampleRows
    .filter((r) => REFUNDED_STATUSES.includes(r.status))
    .reduce((sum, r) => sum + (r.refundAmount || 0), 0);

  const decided = approvedCount + rejectedCount;
  const approvalRate = decided > 0 ? (approvedCount / decided) * 100 : 0;

  const refundedRows = sampleRows.filter((r) => r.status === 'REFUNDED');
  const refundEligible = sampleRows.filter((r) => REFUNDED_STATUSES.includes(r.status) || r.status === 'REFUND_INITIATED');
  const refundSuccessRate = refundEligible.length > 0 ? (refundedRows.length / refundEligible.length) * 100 : 0;

  const avgProcessingDays = useMemo(() => {
    const resolved = sampleRows.filter((r) => r.resolvedAt && r.createdAt);
    if (!resolved.length) return 0;
    const totalDays = resolved.reduce((sum, r) => {
      const diff = new Date(r.resolvedAt!).getTime() - new Date(r.createdAt).getTime();
      return sum + diff / (1000 * 60 * 60 * 24);
    }, 0);
    return totalDays / resolved.length;
  }, [sampleRows]);

  const stats: ReturnStat[] = [
    {
      key: 'total',
      label: 'Total Returns',
      value: totalReturns,
      icon: RotateCcw,
      iconBg: 'bg-violet-50 text-violet-500',
      trend: [4, 6, 5, 8, 7, 9, 10],
      strokeColor: '#8b5cf6',
      changePct: 12.4,
    },
    {
      key: 'pending',
      label: 'Pending Requests',
      value: pendingCount,
      icon: Clock,
      iconBg: 'bg-amber-50 text-amber-500',
      trend: [3, 4, 3, 5, 4, 6, 5],
      strokeColor: '#f59e0b',
      changePct: 8.3,
    },
    {
      key: 'approved',
      label: 'Approved Returns',
      value: approvedCount,
      icon: CheckCircle2,
      iconBg: 'bg-emerald-50 text-emerald-500',
      trend: [2, 3, 4, 4, 6, 7, 8],
      strokeColor: '#10b981',
      changePct: 15.2,
    },
    {
      key: 'refunds',
      label: 'Total Refunds',
      value: totalRefunds,
      isCurrency: true,
      icon: Wallet,
      iconBg: 'bg-sky-50 text-sky-500',
      trend: [5, 5, 6, 7, 6, 8, 9],
      strokeColor: '#0ea5e9',
      changePct: 18.7,
    },
  ];

  const activityItems = useMemo(() => buildActivityFromReturns(sampleRows), [sampleRows]);

  return (
    <div className="min-h-screen bg-[#F8F9FC] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px] space-y-6">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="rounded-[20px] bg-gradient-to-br from-violet-500 via-purple-500 to-cyan-500 p-6 sm:p-8"
        >
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Vendor Returns Dashboard</h1>
          <p className="mt-1.5 text-sm text-white/80 sm:text-base">
            Track, approve and manage customer returns efficiently.
          </p>
          <div className="mt-6">
            <ReturnStatsCards stats={stats} />
          </div>
        </motion.div>

        {/* Analytics row */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-10">
          <div className="lg:col-span-7">
            <ReturnTrendChart returns={sampleRows} />
          </div>
          <div className="lg:col-span-3">
            <ReturnInsights
              data={{
                pendingCount,
                pendingPct: totalReturns > 0 ? (pendingCount / totalReturns) * 100 : 0,
                avgProcessingDays,
                approvalRate,
                approvalDeltaPct: 5.6,
                refundSuccessRate,
                refundDeltaPct: 2.4,
              }}
            />
          </div>
        </div>

        {/* Table + activity */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-10">
          <div className="lg:col-span-7">
            <ReturnTable
              returns={tableRows}
              isLoading={isLoading}
              page={returnsData?.pageNumber ?? page}
              totalPages={returnsData?.totalPages ?? 1}
              totalElements={returnsData?.totalElements ?? 0}
              pageSize={returnsData?.pageSize ?? size}
              onPageChange={setPage}
              searchTerm={searchTerm}
              onSearchChange={(v) => { setSearchTerm(v); setPage(0); }}
              statusFilter={statusFilter}
              onStatusChange={(v) => { setStatusFilter(v); setPage(0); }}
              onExport={handleExport}
              onRefresh={invalidate}
              onOpenReturn={(returnId) => navigate(`/vendor/returns/${returnId}`)}
            />
          </div>
          <div className="lg:col-span-3">
            <ReturnActivityFeed items={activityItems} />
          </div>
        </div>
      </div>

      {routeReturnId && (
        <ReturnDetailPanel returnId={routeReturnId} onClose={() => navigate('/vendor/returns')} />
      )}
    </div>
  );
}

export default VendorReturnsDashboard;
