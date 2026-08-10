import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Filter, CheckCircle, XCircle, CreditCard, BarChart3, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/axios';
import { unwrap, Page, StatusBadge, dt, money, pageOf } from '@/pages/pageShared';
import { fadeInUp, staggerContainer, listItem } from '@/lib/motion';
import type { ReturnRequest, ReturnStatus, PagedResponse } from '@/types';

const statusOptions: { value: ReturnStatus; label: string }[] = [
  { value: 'RETURN_REQUESTED', label: 'Return Requested' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'PICKUP_SCHEDULED', label: 'Pickup Scheduled' },
  { value: 'PICKED_UP', label: 'Picked Up' },
  { value: 'RECEIVED_AT_WAREHOUSE', label: 'Received at Warehouse' },
  { value: 'QUALITY_CHECK', label: 'Quality Check' },
  { value: 'REFUND_INITIATED', label: 'Refund Initiated' },
  { value: 'REFUNDED', label: 'Refunded' },
  { value: 'APPEAL_REQUESTED', label: 'Appeal Requested' },
  { value: 'ADMIN_REVIEW', label: 'Admin Review' },
  { value: 'FINAL_APPROVED', label: 'Final Approved' },
  { value: 'FINAL_REJECTED', label: 'Final Rejected' },
];

export function AdminReturnsDashboard() {
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [size] = useState(10);
  // Issue 7: statusFilter is now correctly forwarded to /admin/returns which
  // accepts a `status` query param — no extra wiring needed beyond Issue 6's fix.
  const [statusFilter, setStatusFilter] = useState<ReturnStatus | ''>('');

  // Issue 6: Corrected endpoint from /returns/admin/all → /admin/returns.
  // Issue 8: Removed searchTerm state and search input — the backend has no
  //          search capability for returns, so the UI was giving false confidence.
  const { data: returnsData, isLoading } = useQuery({
    queryKey: ['admin-returns', page, size, statusFilter],
    queryFn: () => {
      const params: Record<string, unknown> = { page, size };
      if (statusFilter) params.status = statusFilter;
      // Issue 6: was '/returns/admin/all' — now '/admin/returns'
      return api.get('/admin/returns', { params }).then((r) => unwrap<PagedResponse<ReturnRequest>>(r));
    },
  });

  // Issue 6: Corrected endpoint from /returns/analytics → /admin/returns/analytics.
  const { data: analytics } = useQuery({
    queryKey: ['returns-analytics'],
    queryFn: () =>
      // Issue 6: was '/returns/analytics' — now '/admin/returns/analytics'
      api.get('/admin/returns/analytics').then((r) => unwrap<any>(r)),
  });

  const handleStatusChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(event.target.value as ReturnStatus | '');
    setPage(0);
  };

  // Issues 9 & 10: Replaced raw api.put() (no error handling, no loading state)
  // with a useMutation that:
  //   - calls the correct AdminController endpoint PUT /admin/returns/{id}/appeal/resolve
  //   - sends { status } in the request body and resolutionReason as a query param
  //   - invalidates caches and shows success/error toasts on completion
  const resolveAppealMutation = useMutation({
    mutationFn: ({
      id,
      newStatus,
      resolutionReason,
    }: {
      id: string;
      newStatus: ReturnStatus;
      resolutionReason: string;
    }) =>
      // Issue 10: was PUT /returns/{id}/admin/resolve (ReturnController, weaker)
      //           now PUT /admin/returns/{id}/appeal/resolve (AdminController, correct)
      api.put(
        `/admin/returns/${id}/appeal/resolve`,
        { status: newStatus },          // body: ReturnRequestDto.UpdateStatus
        { params: { resolutionReason } } // query param
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-returns'] });
      qc.invalidateQueries({ queryKey: ['returns-analytics'] });
      toast.success('Appeal resolved successfully');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Failed to resolve appeal');
    },
  });

  return (
    <Page title="Admin Returns Dashboard">
      <div className="space-y-6">
        <motion.div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" variants={staggerContainer} initial="hidden" animate="visible">
          <motion.div className="card p-5" variants={fadeInUp}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Total Returns</p>
                <p className="text-2xl font-bold">{analytics?.totalReturns || 0}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-primary-500" />
            </div>
          </motion.div>

          <motion.div className="card p-5" variants={fadeInUp}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Approved Returns</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{analytics?.approvedReturns || 0}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </motion.div>

          <motion.div className="card p-5" variants={fadeInUp}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Rejected Returns</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{analytics?.rejectedReturns || 0}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </motion.div>

          <motion.div className="card p-5" variants={fadeInUp}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Refund Amount</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{money(analytics?.refundAmount || 0)}</p>
              </div>
              <CreditCard className="h-8 w-8 text-blue-500" />
            </div>
          </motion.div>
        </motion.div>

        <motion.div className="card p-6" variants={fadeInUp} initial="hidden" animate="visible">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Returns Management</h2>
            {/* Issue 8: Removed non-functional search input — backend has no search support */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select
                  value={statusFilter}
                  onChange={handleStatusChange}
                  className="input pl-10 appearance-none"
                >
                  <option value="">All Statuses</option>
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            {isLoading ? (
              <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">Loading...</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border dark:border-border-dark">
                    <th className="px-4 py-3 text-left text-sm font-semibold">Return ID</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Customer</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Product</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Reason</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Refund Amount</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Created</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageOf(returnsData)?.map((r) => (
                    <motion.tr key={r.id} className="border-b border-border dark:border-border-dark hover:bg-slate-50 dark:hover:bg-white/5" variants={listItem}>
                      <td className="px-4 py-4 text-sm font-medium">{r.id.substring(0, 8)}...</td>
                      {/* Fix C: was r.productName (wrong — that's the product, not the customer) */}
                      <td className="px-4 py-4 text-sm font-mono">{r.customerId.substring(0, 8)}...</td>
                      {/* Fix C: was r.reason (wrong — reason belongs in the Reason column) */}
                      <td className="px-4 py-4 text-sm">{r.productName}</td>
                      <td className="px-4 py-4">
                        <StatusBadge tone="neutral" label={r.status.replace(/_/g, ' ')} />
                      </td>
                      {/* Fix C: was r.description (wrong — description is the customer note, not the return reason) */}
                      <td className="px-4 py-4 text-sm">{r.reason?.toString().replace(/_/g, ' ')}</td>
                      <td className="px-4 py-4 text-sm font-medium text-green-600 dark:text-green-400">{money(r.refundAmount || 0)}</td>
                      <td className="px-4 py-4 text-sm">{dt(r.createdAt)}</td>
                      <td className="px-4 py-4">
                        {r.status === 'APPEAL_REQUESTED' && (
                          // Issue 9: Pass mutation down so the modal can use isPending + onResolve
                          <ResolveAppealModal
                            returnId={r.id}
                            isPending={resolveAppealMutation.isPending}
                            onResolve={(id, newStatus, resolutionReason) =>
                              resolveAppealMutation.mutate({ id, newStatus, resolutionReason })
                            }
                          />
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Showing {(returnsData?.pageNumber || 0) * (returnsData?.pageSize || 0) + 1} to{' '}
              {(returnsData?.pageNumber || 0) * (returnsData?.pageSize || 0) + (returnsData?.pageSize || 0)} of{' '}
              {returnsData?.totalElements} returns
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="btn-premium-secondary px-4 py-2 text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= (returnsData?.totalPages || 1) - 1}
                className="btn-premium px-4 py-2 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </Page>
  );
}

// Issue 9: onResolve now fires the useMutation; isPending disables the submit button.
function ResolveAppealModal({
  returnId,
  isPending,
  onResolve,
}: {
  returnId: string;
  isPending: boolean;
  onResolve: (returnId: string, newStatus: ReturnStatus, resolutionReason: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<ReturnStatus>('FINAL_APPROVED');
  const [resolutionReason, setResolutionReason] = useState('');

  const handleSubmit = () => {
    if (!resolutionReason.trim()) return;
    onResolve(returnId, newStatus, resolutionReason);
    setOpen(false);
    setResolutionReason('');
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-premium-secondary px-3 py-1 text-xs"
      >
        Resolve Appeal
      </button>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="card w-full max-w-md space-y-4 p-5"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold">Resolve Appeal</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Choose a final status and provide a resolution reason.
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="btn-ghost p-2">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Final Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as ReturnStatus)}
                  className="input mt-1 w-full"
                >
                  <option value="FINAL_APPROVED">Final Approved</option>
                  <option value="FINAL_REJECTED">Final Rejected</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Resolution Reason</label>
                <textarea
                  value={resolutionReason}
                  onChange={(e) => setResolutionReason(e.target.value)}
                  className="input mt-1 min-h-24 w-full"
                  placeholder="Enter resolution reason..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="btn-premium-secondary">
                Cancel
              </button>
              {/* Issue 9: disabled while mutation is in-flight */}
              <button
                onClick={handleSubmit}
                disabled={!resolutionReason.trim() || isPending}
                className="btn-premium disabled:opacity-50"
              >
                {isPending ? 'Resolving…' : 'Resolve Appeal'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </>
  );
}