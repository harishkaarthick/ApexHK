/**
 * AdminPages.tsx
 * ─────────────────────────────────────────────────────────────
 * Re-export hub for all admin pages + shared primitives used
 * across the admin section.
 * ─────────────────────────────────────────────────────────────
 */

export { AdminDashboardPage } from './AdminDashboardPage';
export { AdminVendorsPage }   from './AdminVendorsPage';
export { AdminUsersPage }     from './AdminUsersPage';
export { AdminOrdersPage }    from './AdminOrdersPage';
export { AdminCouponsPage }   from './AdminCouponsPage';
export { AdminBannersPage }   from './AdminBannersPage';
export { AdminProductsPage }  from './AdminProductPage';
export { AdminCategoriesPage } from './AdminCategoriesPage';
export { AdminPayoutsPage } from './AdminPayoutsPage';

// ─── Shared primitives (consumed by sibling files) ──────────

import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Field } from '@/pages/pageShared';
import { fadeIn } from '@/lib/motion';

// Re-export so sibling page files can import fadeIn from one place
export { fadeIn };

// Skeleton block — mimics a card row while data is loading
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700 ${className}`}
    />
  );
}

// Reusable column-skeleton list
export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

// Generic "are you sure?" confirm dialog
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  isPending = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  isPending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          exit="hidden"
        >
          <motion.div
            className="card w-full max-w-sm space-y-4 p-5"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold">{title}</h3>
                {message && (
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {message}
                  </p>
                )}
              </div>
              <button type="button" className="btn-ghost p-2" onClick={onClose}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-premium-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                className="btn-premium-danger"
                disabled={isPending}
                onClick={onConfirm}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Reject-reason textarea modal (used by Vendors + can be reused elsewhere)
export function RejectReasonModal({
  open,
  title,
  description,
  isPending,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  description: string;
  isPending?: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          exit="hidden"
        >
          <motion.form
            className="card w-full max-w-md space-y-4 p-5"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onSubmit={(e) => {
              e.preventDefault();
              if (!reason.trim()) return toast.error('Rejection reason is required');
              onSubmit(reason.trim());
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {description}
                </p>
              </div>
              <button type="button" className="btn-ghost p-2" onClick={onClose}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <Field label="Rejection reason">
              <textarea
                className="input min-h-28"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-premium-secondary" onClick={onClose}>
                Cancel
              </button>
              <button className="btn-premium-danger" disabled={isPending}>
                Reject
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Pagination bar
export function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-center gap-3">
      <button
        className="btn-premium-secondary"
        disabled={page === 0}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </button>
      <span className="text-sm text-slate-500 dark:text-slate-400">
        Page {page + 1} of {totalPages}
      </span>
      <button
        className="btn-premium-secondary"
        disabled={page >= totalPages - 1}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </button>
    </div>
  );
}

// Toggle switch
export function ToggleSwitch({
  enabled,
  onChange,
  isPending = false,
}: {
  enabled: boolean;
  onChange: () => void;
  isPending?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={enabled}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
        enabled
          ? 'bg-primary-600'
          : 'bg-slate-300 dark:bg-slate-600'
      }`}
      onClick={onChange}
      disabled={isPending}
    >
      <span
        className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform ${
          enabled ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

// Paginated response shape (Spring Boot Page)
export interface PagedResponse<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
  number: number;
  size: number;
}
