/**
 * AdminDashboardPage.tsx
 * ─────────────────────────────────────────────────────────────
 * Stats grid (6 cards) + recent orders table.
 * GET /admin/stats  →  AdminStats
 * GET /admin/orders?page=0&size=5  →  PagedResponse<Order>
 * ─────────────────────────────────────────────────────────────
 */

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Clock,
  CheckCircle2,
  DollarSign,
  Package,
  ReceiptText,
  ShoppingBag,
  Store,
  Users,
} from 'lucide-react';

import api from '@/lib/axios';
import { fadeInUp, scaleIn, staggerContainer } from '@/lib/motion';
import { Empty, PortalPage, StatusBadge, dt, money, unwrap } from '@/pages/pageShared';
import type { AdminStats, Order } from '@/types';
import { Skeleton, type PagedResponse } from './AdminPages';

// ─── Stat card ───────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  pulse = false,
  isLoading = false,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  pulse?: boolean;
  isLoading?: boolean;
}) {
  if (isLoading) return <Skeleton className="h-28 w-full" />;
  return (
    <motion.div
      className="card p-5"
      variants={scaleIn}
      viewport={{ once: true }}
      whileHover={{ y: -3 }}
    >
      <div className="mb-3 flex items-center justify-between text-primary-700 dark:text-primary-300">
        {icon}
        {pulse && (
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-warning" />
          </span>
        )}
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-0.5 text-2xl font-bold">{value}</p>
    </motion.div>
  );
}

// ─── Recent orders table ─────────────────────────────────────

function RecentOrdersTable({
  orders,
  isLoading,
}: {
  orders: Order[];
  isLoading: boolean;
}) {
  return (
    <motion.section
      className="card overflow-hidden"
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
    >
      <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-700">
        <h2 className="font-semibold">Recent orders</h2>
      </div>

      {isLoading ? (
        <div className="space-y-3 p-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="p-5">
          <Empty title="No orders yet." />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <th className="px-5 py-3">Order ID</th>
                <th className="px-5 py-3">Items</th>
                <th className="px-5 py-3">Total</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr
                  key={o.id}
                  className="border-b border-slate-100 last:border-0 dark:border-slate-700"
                >
                  <td className="px-5 py-3 font-mono text-xs">
                    #{o.id.slice(0, 8)}
                  </td>
                  <td className="px-5 py-3">{o.items.length}</td>
                  <td className="px-5 py-3 font-medium">{money(o.total)}</td>
                  <td className="px-5 py-3">
                    <StatusBadge
                      tone={
                        o.status === 'DELIVERED'
                          ? 'success'
                          : o.status === 'CANCELLED'
                          ? 'error'
                          : o.status === 'PENDING'
                          ? 'warning'
                          : 'neutral'
                      }
                      label={o.status}
                      pulse={o.status === 'PENDING'}
                    />
                  </td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                    {dt(o.placedAt ?? o.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.section>
  );
}

// ─── Page ────────────────────────────────────────────────────

export function AdminDashboardPage() {
  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
  } = useQuery<AdminStats>({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin/stats').then((r) => unwrap<AdminStats>(r)),
  });

  const { data: ordersPage, isLoading: ordersLoading } = useQuery<
    PagedResponse<Order>
  >({
    queryKey: ['admin-orders', 0, 5],
    queryFn: () =>
      api
        .get('/admin/orders', { params: { page: 0, size: 5 } })
        .then((r) => unwrap<PagedResponse<Order>>(r)),
  });

  const cards = [
    {
      label: 'Total users',
      value: statsLoading ? '…' : String(stats?.totalUsers ?? 0),
      icon: <Users className="h-5 w-5" />,
    },
    {
      label: 'Total vendors',
      value: statsLoading ? '…' : String(stats?.totalVendors ?? 0),
      icon: <Store className="h-5 w-5" />,
    },
    {
      label: 'Pending vendors',
      value: statsLoading ? '…' : String(stats?.pendingVendors ?? 0),
      icon: <Clock className="h-5 w-5" />,
      pulse: (stats?.pendingVendors ?? 0) > 0,
    },
    {
      label: 'Pending payouts',
      value: statsLoading ? '...' : String(stats?.pendingPayouts ?? 0),
      icon: <ReceiptText className="h-5 w-5" />,
      pulse: (stats?.pendingPayouts ?? 0) > 0,
    },
    {
      // Issue 2 (frontend): DashboardStats.java renamed approvedPayouts → paidPayouts
      // because approvePayout() transitions PENDING → PAID directly; APPROVED is never
      // written, so the old "approvedPayouts" count (APPROVED + PAID) was always just PAID.
      label: 'Paid payouts',
      value: statsLoading ? '...' : String(stats?.paidPayouts ?? 0),
      icon: <CheckCircle2 className="h-5 w-5" />,
    },
    {
      label: 'Total payout amount',
      value: statsLoading ? '...' : money(stats?.totalPayoutAmount ?? 0),
      icon: <DollarSign className="h-5 w-5" />,
    },
    {
      label: 'Total orders',
      value: statsLoading ? '…' : String(stats?.totalOrders ?? 0),
      icon: <ShoppingBag className="h-5 w-5" />,
    },
    {
      label: 'Total revenue',
      value: statsLoading ? '…' : money(stats?.totalRevenue ?? 0),
      icon: <DollarSign className="h-5 w-5" />,
    },
    {
      label: 'Total products',
      value: statsLoading ? '…' : String(stats?.totalProducts ?? 0),
      icon: <Package className="h-5 w-5" />,
    },
  ];

  return (
    <PortalPage title="Dashboard">
      {statsError && (
        <p className="text-error mb-4 text-sm">Failed to load stats.</p>
      )}

      <motion.div
        className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {cards.map((c) => (
          <StatCard
            key={c.label}
            label={c.label}
            value={c.value}
            icon={c.icon}
            pulse={c.pulse}
            isLoading={statsLoading}
          />
        ))}
      </motion.div>

      <RecentOrdersTable
        orders={ordersPage?.content ?? []}
        isLoading={ordersLoading}
      />
    </PortalPage>
  );
}