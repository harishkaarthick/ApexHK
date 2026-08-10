/**
 * AdminVendorsPage.tsx
 * ─────────────────────────────────────────────────────────────
 * Three tabs: Pending / Approved / Rejected
 * Each tab hits its own endpoint.  All mutations show toasts.
 * ─────────────────────────────────────────────────────────────
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { CheckCircle2, Edit2, X, XCircle } from 'lucide-react';

import api from '@/lib/axios';
import { fadeInUp, staggerContainer } from '@/lib/motion';
import { Empty, Field, PortalPage, StatusBadge, dt, pageOf, unwrap } from '@/pages/pageShared';
import type { PagedResponse, VendorStore } from '@/types';
import { RejectReasonModal, Skeleton, fadeIn } from './AdminPages';

// ─── Commission edit modal ────────────────────────────────────

function CommissionModal({
  vendor,
  onClose,
}: {
  vendor: VendorStore | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [rate, setRate] = useState(String(vendor?.commissionRate ?? ''));

  const save = useMutation({
    mutationFn: ({ id, commissionRate }: { id: string; commissionRate: number }) =>
      api.put(`/admin/vendors/${id}/commission`, { commissionRate }),
    onSuccess: () => {
      toast.success('Commission rate updated');
      qc.invalidateQueries({ queryKey: ['admin-vendors', 'approved'] });
      onClose();
    },
    onError: () => toast.error('Failed to update commission'),
  });

  return (
    <AnimatePresence>
      {vendor && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          exit="hidden"
        >
          <motion.form
            className="card w-full max-w-sm space-y-4 p-5"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onSubmit={(e) => {
              e.preventDefault();
              const n = Number(rate);
              if (isNaN(n) || n < 0 || n > 100)
                return toast.error('Rate must be 0–100');
              save.mutate({ id: vendor.id, commissionRate: n });
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold">Edit commission</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {vendor.storeName}
                </p>
              </div>
              <button type="button" className="btn-ghost p-2" onClick={onClose}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <Field label="Commission rate (%)">
              <input
                className="input"
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                required
              />
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-premium-secondary" onClick={onClose}>
                Cancel
              </button>
              <button className="btn-premium" disabled={save.isPending}>
                Save
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Tab definitions ──────────────────────────────────────────

type Tab = 'PENDING' | 'APPROVED' | 'REJECTED';

const TABS: { id: Tab; label: string }[] = [
  { id: 'PENDING', label: 'Pending' },
  { id: 'APPROVED', label: 'Approved' },
  { id: 'REJECTED', label: 'Rejected' },
];

const endpoint: Record<Tab, string> = {
  PENDING: '/admin/vendors/pending',
  APPROVED: '/admin/vendors?status=APPROVED',
  REJECTED: '/admin/vendors?status=REJECTED',
};

// ─── Vendor card ──────────────────────────────────────────────

function VendorCard({
  vendor,
  tab,
  onApprove,
  onReject,
  onEditCommission,
  isActing,
}: {
  vendor: VendorStore;
  tab: Tab;
  onApprove: (v: VendorStore) => void;
  onReject: (v: VendorStore) => void;
  onEditCommission: (v: VendorStore) => void;
  isActing: boolean;
}) {
  const tonemap: Record<string, 'success' | 'error' | 'warning' | 'neutral'> = {
    APPROVED: 'success',
    REJECTED: 'error',
    PENDING: 'warning',
  };

  return (
    <motion.div className="card p-5" variants={fadeInUp}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{vendor.storeName}</h3>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
            {vendor.storeDescription}
          </p>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            {vendor.ownerEmail} · Applied {dt(vendor.createdAt)}
          </p>
          {tab === 'APPROVED' && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Commission: <span className="font-medium">{vendor.commissionRate}%</span>
            </p>
          )}
          {tab === 'REJECTED' && vendor.rejectionReason && (
            <p className="mt-1 rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Reason: {vendor.rejectionReason}
            </p>
          )}
        </div>
        <StatusBadge tone={tonemap[vendor.status] ?? 'neutral'} label={vendor.status} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {tab === 'PENDING' && (
          <>
            <button
              className="btn-premium"
              disabled={isActing}
              onClick={() => onApprove(vendor)}
            >
              <CheckCircle2 className="h-4 w-4" /> Approve
            </button>
            <button
              className="btn-premium-danger"
              disabled={isActing}
              onClick={() => onReject(vendor)}
            >
              <XCircle className="h-4 w-4" /> Reject
            </button>
          </>
        )}
        {tab === 'APPROVED' && (
          <button
            className="btn-premium-secondary"
            onClick={() => onEditCommission(vendor)}
          >
            <Edit2 className="h-4 w-4" /> Edit commission
          </button>
        )}
        {tab === 'REJECTED' && (
          <button
            className="btn-premium"
            disabled={isActing}
            onClick={() => onApprove(vendor)}
          >
            <CheckCircle2 className="h-4 w-4" /> Re-approve
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ─── Page ────────────────────────────────────────────────────

export function AdminVendorsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('PENDING');
  const [rejecting, setRejecting] = useState<VendorStore | null>(null);
  const [editingCommission, setEditingCommission] = useState<VendorStore | null>(null);

  const { data, isLoading, isError } = useQuery<PagedResponse<VendorStore>>({
    queryKey: ['admin-vendors', tab],
    queryFn: () =>
      api.get(endpoint[tab]).then((r) => unwrap<PagedResponse<VendorStore>>(r)),
  });

  const approve = useMutation({
    mutationFn: (id: string) => api.put(`/admin/vendors/${id}/approve`),
    onSuccess: () => {
      toast.success('Vendor approved');
      qc.invalidateQueries({ queryKey: ['admin-vendors'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: () => toast.error('Failed to approve vendor'),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.put(`/admin/vendors/${id}/reject`, { reason }),
    onSuccess: () => {
      toast.success('Vendor rejected');
      setRejecting(null);
      qc.invalidateQueries({ queryKey: ['admin-vendors'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: () => toast.error('Failed to reject vendor'),
  });

  const vendors = pageOf(data);
  const isActing = approve.isPending || reject.isPending;

  return (
    <PortalPage title="Vendors">
      {/* Tab bar */}
      <div className="mb-5 flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800/50 sm:w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-white shadow dark:bg-slate-700'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isError && (
        <p className="text-error text-sm">Failed to load vendors.</p>
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : vendors.length === 0 ? (
        <Empty title={`No ${tab.toLowerCase()} vendors.`} />
      ) : (
        <motion.div
          className="grid gap-4 md:grid-cols-2"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {vendors.map((v) => (
            <VendorCard
              key={v.id}
              vendor={v}
              tab={tab}
              onApprove={(vendor) => approve.mutate(vendor.id)}
              onReject={setRejecting}
              onEditCommission={setEditingCommission}
              isActing={isActing}
            />
          ))}
        </motion.div>
      )}

      {/* Modals */}
      <RejectReasonModal
        open={Boolean(rejecting)}
        title="Reject vendor"
        description={rejecting?.storeName ?? ''}
        isPending={reject.isPending}
        onClose={() => setRejecting(null)}
        onSubmit={(reason) =>
          rejecting && reject.mutate({ id: rejecting.id, reason })
        }
      />
      <CommissionModal
        vendor={editingCommission}
        onClose={() => setEditingCommission(null)}
      />
    </PortalPage>
  );
}
