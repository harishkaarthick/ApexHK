import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

import api from '@/lib/axios';
import { dt, Empty, money, PortalPage, StatusBadge, unwrap } from '@/pages/pageShared';
import type { PagedResponse, PayoutRequest } from '@/types';
import { ConfirmDialog, Pagination, RejectReasonModal, SkeletonList } from './AdminPages';

function payoutTone(status: PayoutRequest['status']) {
  if (status === 'PAID' || status === 'APPROVED') return 'success';
  if (status === 'REJECTED') return 'error';
  return 'warning';
}

export function AdminPayoutsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [approving, setApproving] = useState<PayoutRequest | null>(null);
  const [rejecting, setRejecting] = useState<PayoutRequest | null>(null);

  const { data, isLoading } = useQuery<PagedResponse<PayoutRequest>>({
    queryKey: ['admin-payouts', page],
    queryFn: () =>
      api
        .get('/admin/payouts', { params: { page, size: 20 } })
        .then((r) => unwrap<PagedResponse<PayoutRequest>>(r)),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-payouts'] });
    qc.invalidateQueries({ queryKey: ['admin-stats'] });
  };

  const approve = useMutation({
    mutationFn: (id: string) => api.post(`/admin/payouts/${id}/approve`),
    onSuccess: () => {
      toast.success('Payout approved');
      setApproving(null);
      invalidate();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to approve payout'),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/admin/payouts/${id}/reject`, { reason }),
    onSuccess: () => {
      toast.success('Payout rejected');
      setRejecting(null);
      invalidate();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to reject payout'),
  });

  const payouts = data?.content ?? [];

  return (
    <PortalPage title="Payout Management">
      {isLoading ? (
        <SkeletonList rows={6} />
      ) : payouts.length === 0 ? (
        <Empty title="No payout requests found." />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <th className="px-5 py-3">Vendor</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((payout) => {
                  const isPending = payout.status === 'PENDING';
                  return (
                    <tr key={payout.id} className="border-b border-slate-100 last:border-0 dark:border-slate-700">
                      <td className="px-5 py-3">
                        <p className="font-medium">{payout.vendorName || 'Unknown vendor'}</p>
                        <p className="font-mono text-xs text-slate-500">{payout.vendorId.slice(0, 8)}</p>
                      </td>
                      <td className="px-5 py-3 font-semibold">{money(payout.amount)}</td>
                      <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{dt(payout.requestedAt)}</td>
                      <td className="px-5 py-3">
                        <StatusBadge tone={payoutTone(payout.status)} label={payout.status} pulse={isPending} />
                        {payout.rejectionReason && (
                          <p className="mt-1 max-w-xs text-xs text-slate-500">{payout.rejectionReason}</p>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            className="btn-premium"
                            disabled={!isPending || approve.isPending || reject.isPending}
                            onClick={() => setApproving(payout)}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Approve
                          </button>
                          <button
                            className="btn-premium-danger"
                            disabled={!isPending || approve.isPending || reject.isPending}
                            onClick={() => setRejecting(payout)}
                          >
                            <XCircle className="h-4 w-4" />
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />

      <ConfirmDialog
        open={Boolean(approving)}
        title="Approve payout?"
        message={approving ? `${approving.vendorName} will be paid ${money(approving.amount)}.` : undefined}
        confirmLabel="Approve"
        isPending={approve.isPending}
        onClose={() => setApproving(null)}
        onConfirm={() => approving && approve.mutate(approving.id)}
      />

      <RejectReasonModal
        open={Boolean(rejecting)}
        title="Reject payout"
        description={rejecting ? `${rejecting.vendorName} - ${money(rejecting.amount)}` : ''}
        isPending={reject.isPending}
        onClose={() => setRejecting(null)}
        onSubmit={(reason) => rejecting && reject.mutate({ id: rejecting.id, reason })}
      />
    </PortalPage>
  );
}
