/**
 * AdminOrdersPage.tsx
 * ─────────────────────────────────────────────────────────────
 * Paginated orders table with status filter + detail modal.
 * GET /admin/orders?page=0&size=20  →  PagedResponse<Order>
 * ─────────────────────────────────────────────────────────────
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

import api from '@/lib/axios';
import { fadeIn, listItem, staggerContainer } from '@/lib/motion';
import { Empty, PortalPage, StatusBadge, dt, money, unwrap } from '@/pages/pageShared';
import type { Order, OrderItem } from '@/types';
import { Pagination, SkeletonList, type PagedResponse } from './AdminPages';

// ─── Helpers ──────────────────────────────────────────────────

type StatusFilter =
  | 'ALL'
  | 'PENDING'
  | 'CONFIRMED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

function statusTone(
  s: string,
): 'success' | 'error' | 'warning' | 'neutral' {
  if (s === 'DELIVERED') return 'success';
  if (s === 'CANCELLED') return 'error';
  if (s === 'PENDING') return 'warning';
  return 'neutral';
}

// ─── Order detail modal ───────────────────────────────────────

function OrderDetailModal({
  order,
  onClose,
}: {
  order: Order | null;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {order && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          exit="hidden"
        >
          <motion.div
            className="card w-full max-w-lg space-y-4 p-5"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold">
                  Order #{order.id.slice(0, 8)}
                </h3>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  {dt(order.placedAt ?? order.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge
                  tone={statusTone(order.status)}
                  label={order.status}
                  pulse={order.status === 'PENDING'}
                />
                <button className="btn-ghost p-2" onClick={onClose}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Vendor breakdown — one order can span several vendors, each
                fulfilling and tracking their own portion independently. */}
            {(order.vendorOrders?.length ?? 0) > 0 ? (
              <div className="space-y-3">
                {order.vendorOrders.map((vo) => (
                  <div
                    key={vo.id}
                    className="rounded-lg border border-slate-100 p-3 dark:border-slate-700"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{vo.vendorName}</span>
                      <StatusBadge
                        tone={statusTone(vo.status)}
                        label={vo.status}
                        pulse={vo.status === 'PENDING'}
                      />
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-700">
                      {vo.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between py-1.5 text-sm"
                        >
                          <span className="flex-1 truncate">{item.name ?? item.productName}</span>
                          <span className="ml-4 text-slate-500 dark:text-slate-400">
                            × {item.quantity ?? item.qty}
                          </span>
                          <span className="ml-4 font-medium">
                            {money((item.price ?? 0) * (item.quantity ?? item.qty ?? 1))}
                          </span>
                        </div>
                      ))}
                    </div>
                    {(vo.courierName || vo.trackingId) && (
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        {vo.courierName ? `${vo.courierName} · ` : ''}
                        {vo.trackingId ? `Tracking: ${vo.trackingId}` : ''}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {(order.items ?? []).map((item: OrderItem, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <span className="flex-1 truncate">{item.name ?? item.productName}</span>
                    <span className="ml-4 text-slate-500 dark:text-slate-400">
                      × {item.quantity ?? item.qty}
                    </span>
                    <span className="ml-4 font-medium">
                      {money((item.price ?? 0) * (item.quantity ?? item.qty ?? 1))}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Total */}
            <div className="flex justify-between border-t border-slate-200 pt-3 dark:border-slate-700">
              <span className="font-semibold">Total</span>
              <span className="font-bold text-primary-700 dark:text-primary-300">
                {money(order.total)}
              </span>
            </div>

            <button className="btn-premium-secondary w-full" onClick={onClose}>
              Close
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Page ────────────────────────────────────────────────────

const STATUS_OPTIONS: StatusFilter[] = [
  'ALL',
  'PENDING',
  'CONFIRMED',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
];

export function AdminOrdersPage() {
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [selected, setSelected] = useState<Order | null>(null);

  const { data, isLoading, isError } = useQuery<PagedResponse<Order>>({
    queryKey: ['admin-orders', page, statusFilter],
    queryFn: () =>
      api
        .get('/admin/orders', {
          params: {
            page,
            size: 20,
            ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
          },
        })
        .then((r) => unwrap<PagedResponse<Order>>(r)),
  });

  const orders = data?.content ?? [];

  return (
    <PortalPage title="Orders">
      {/* Filter */}
      <div className="mb-4">
        <select
          className="input w-auto"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as StatusFilter);
            setPage(0);
          }}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === 'ALL' ? 'All statuses' : s}
            </option>
          ))}
        </select>
      </div>

      {isError && (
        <p className="text-error mb-3 text-sm">Failed to load orders.</p>
      )}

      {isLoading ? (
        <SkeletonList rows={8} />
      ) : orders.length === 0 ? (
        <Empty title="No orders found." />
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    <th className="px-5 py-3">Order ID</th>
                    <th className="px-5 py-3">Items</th>
                    <th className="px-5 py-3">Total</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Vendors</th>
                    <th className="px-5 py-3">Date</th>
                  </tr>
                </thead>
                <motion.tbody
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                >
                  {orders.map((o) => (
                    <motion.tr
                      key={o.id}
                      variants={listItem}
                      className="cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50 last:border-0 dark:border-slate-700 dark:hover:bg-slate-800/50"
                      onClick={() => setSelected(o)}
                    >
                      <td className="px-5 py-3 font-mono text-xs">
                        #{o.id.slice(0, 8)}
                      </td>
                      <td className="px-5 py-3">{o.items.length}</td>
                      <td className="px-5 py-3 font-medium">
                        {money(o.total)}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge
                          tone={statusTone(o.status)}
                          label={o.status}
                          pulse={o.status === 'PENDING'}
                        />
                      </td>
                      <td className="px-5 py-3">
                        {(o.vendorOrders?.length ?? 0) > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {o.vendorOrders.map((vo) => (
                              <span
                                key={vo.id}
                                title={`${vo.vendorName}: ${vo.status}`}
                                className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-white/5 dark:text-slate-300"
                              >
                                {vo.vendorName}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                        {dt(o.placedAt ?? o.createdAt)}
                      </td>
                    </motion.tr>
                  ))}
                </motion.tbody>
              </table>
            </div>
          </div>

          <Pagination
            page={page}
            totalPages={data?.totalPages ?? 1}
            onPageChange={setPage}
          />
        </>
      )}

      <OrderDetailModal order={selected} onClose={() => setSelected(null)} />
    </PortalPage>
  );
}
