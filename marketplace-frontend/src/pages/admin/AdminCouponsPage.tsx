/**
 * AdminCouponsPage.tsx
 * ─────────────────────────────────────────────────────────────
 * Coupon list with creation form, active toggle, usage
 * progress bar, and expiry date warning.
 * GET  /admin/coupons
 * POST /admin/coupons
 * PUT  /admin/coupons/:id/toggle
 * ─────────────────────────────────────────────────────────────
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Trash2 } from 'lucide-react';

import api from '@/lib/axios';
import { useCategories } from '@/lib/categories';
import { fadeInUp, listItem, staggerContainer } from '@/lib/motion';
import { Empty, PortalPage, StatusBadge, dt, money, pageOf, unwrap } from '@/pages/pageShared';
import type { AdminCoupon, CouponUserSegment, PagedResponse } from '@/types';
import { SkeletonList, ToggleSwitch } from './AdminPages';

// ─── Usage progress bar ───────────────────────────────────────

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
      <div
        className="h-full rounded-full bg-primary-500 transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ─── Coupon row ───────────────────────────────────────────────

function CouponRow({
  coupon,
  onToggle,
  onDelete,
  isToggling,
  isDeleting,
}: {
  coupon: AdminCoupon;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  isToggling: boolean;
  isDeleting: boolean;
}) {
  const expired = new Date(coupon.expiresAt) < new Date();

  return (
    <motion.div
      className={`card p-4 ${expired ? 'border-error/30 bg-red-50/30 dark:bg-red-950/20' : ''}`}
      variants={listItem}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        {/* Left */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold tracking-wide">
              {coupon.code}
            </span>
            <StatusBadge
              tone={coupon.active ? 'success' : 'neutral'}
              label={coupon.active ? 'Active' : 'Inactive'}
            />
            {expired && (
              <StatusBadge tone="error" label="Expired" />
            )}
          </div>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {coupon.description}
          </p>
          <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-500 dark:text-slate-400">
            <span>
              {coupon.discountType === 'PERCENTAGE'
                ? `${coupon.discountValue}% off`
                : `${money(coupon.discountValue)} off`}
              {coupon.maxDiscount
                ? ` (max ${money(coupon.maxDiscount)})`
                : ''}
            </span>
            <span>Min order: {money(coupon.minimumOrderValue)}</span>
            {!!coupon.applicableCategories?.length && (
              <span>Categories: {coupon.applicableCategories.join(', ')}</span>
            )}
            {coupon.firstOrderOnly && <span className="font-medium text-primary-600 dark:text-primary-400">First order only</span>}
            {coupon.userSegment && coupon.userSegment !== 'ALL' && (
              <span className="font-medium text-primary-600 dark:text-primary-400">
                {coupon.userSegment === 'NEW' ? 'New users only' : 'Returning users only'}
              </span>
            )}
            <span
              className={
                expired
                  ? 'text-error font-medium'
                  : ''
              }
            >
              Expires: {dt(coupon.expiresAt)}
            </span>
          </div>

          {/* Usage progress */}
          <div className="mt-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Used {coupon.usageCount} / {coupon.usageLimit}
            </p>
            <ProgressBar value={coupon.usageCount} max={coupon.usageLimit} />
          </div>
        </div>

        {/* Toggle */}
        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {coupon.active ? 'On' : 'Off'}
          </span>
          <ToggleSwitch
            enabled={coupon.active}
            onChange={() => onToggle(coupon.id)}
            isPending={isToggling}
          />
          <button
            className="btn-premium-danger px-3"
            disabled={isDeleting}
            onClick={() => onDelete(coupon.id)}
            title="Delete coupon"
            type="button"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Page ────────────────────────────────────────────────────

export function AdminCouponsPage() {
  const qc = useQueryClient();
  const [discountType, setDiscountType] = useState<AdminCoupon['discountType']>('PERCENTAGE');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [firstOrderOnly, setFirstOrderOnly] = useState(false);
  const [userSegment, setUserSegment] = useState<CouponUserSegment>('ALL');
  const { data: categories } = useCategories();

  const toggleCategory = (name: string) => {
    setSelectedCategories((prev) => (prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]));
  };

  const { data, isLoading, isError } = useQuery<PagedResponse<AdminCoupon>>({
    queryKey: ['admin-coupons'],
    queryFn: () =>
      api.get('/admin/coupons').then((r) => unwrap<PagedResponse<AdminCoupon>>(r)),
  });

  const create = useMutation({
    mutationFn: (body: Omit<AdminCoupon, 'id' | 'usageCount' | 'active'>) =>
      api.post('/admin/coupons', body),
    onSuccess: () => {
      toast.success('Coupon created');
      qc.invalidateQueries({ queryKey: ['admin-coupons'] });
    },
    onError: (err: any) => {
      if (!err?.response?.data?.message) toast.error('Failed to create coupon');
    },
  });

  const toggle = useMutation({
    mutationFn: (id: string) => api.put(`/admin/coupons/${id}/toggle`),
    onSuccess: () => {
      toast.success('Coupon updated');
      qc.invalidateQueries({ queryKey: ['admin-coupons'] });
    },
    onError: (err: any) => {
      if (!err?.response?.data?.message) toast.error('Failed to update coupon');
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/coupons/${id}`),
    onSuccess: () => {
      toast.success('Coupon deleted');
      qc.invalidateQueries({ queryKey: ['admin-coupons'] });
    },
    onError: (err: any) => {
      if (!err?.response?.data?.message) toast.error('Failed to delete coupon');
    },
  });

  return (
    <PortalPage title="Coupons">
      {/* Create form */}
      <motion.form
        className="card mb-6 grid gap-3 p-4 sm:grid-cols-2 md:grid-cols-4"
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          create.mutate({
            code: String(fd.get('code') ?? '').trim().toUpperCase(),
            description: String(fd.get('description') ?? '').trim(),
            discountType: fd.get('discountType') as AdminCoupon['discountType'],
            discountValue: Number(fd.get('discountValue') ?? 0),
            maxDiscount: fd.get('maxDiscount')
              ? Number(fd.get('maxDiscount'))
              : undefined,
            minimumOrderValue: Number(fd.get('minimumOrderValue') ?? 0),
            usageLimit: Number(fd.get('usageLimit') ?? 0),
            expiresAt: String(fd.get('expiresAt') ?? ''),
            applicableCategories: selectedCategories.length ? selectedCategories : undefined,
            firstOrderOnly,
            userSegment,
          });
          e.currentTarget.reset();
          setDiscountType('PERCENTAGE');
          setSelectedCategories([]);
          setFirstOrderOnly(false);
          setUserSegment('ALL');
        }}
      >
        <input className="input" name="code" placeholder="Code" required />
        <input
          className="input sm:col-span-2 md:col-span-1"
          name="description"
          placeholder="Description"
          required
        />
        <select
          className="input"
          name="discountType"
          value={discountType}
          onChange={(e) => setDiscountType(e.target.value as AdminCoupon['discountType'])}
        >
          <option value="PERCENTAGE">Percentage</option>
          <option value="FLAT">Fixed amount</option>
        </select>
        <input
          className="input"
          name="discountValue"
          type="number"
          min={1}
          max={discountType === 'PERCENTAGE' ? 100 : undefined}
          placeholder={discountType === 'PERCENTAGE' ? 'Discount % (max 100)' : 'Discount amount (₹)'}
          required
        />
        <input
          className="input"
          name="maxDiscount"
          type="number"
          min={0}
          placeholder="Max discount (optional)"
        />
        <input
          className="input"
          name="minimumOrderValue"
          type="number"
          min={0}
          placeholder="Min order value"
          required
        />
        <input
          className="input"
          name="usageLimit"
          type="number"
          min={0}
          placeholder="Usage limit (blank/0 = unlimited)"
        />
        <input
          className="input"
          name="expiresAt"
          type="datetime-local"
          required
        />

        {/* Category multiselect */}
        <div className="sm:col-span-2 md:col-span-2">
          <p className="mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            Applicable categories (leave empty for all)
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {categories?.map((cat) => (
              <label
                key={cat.id}
                className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300"
              >
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(cat.name)}
                  onChange={() => toggleCategory(cat.name)}
                />
                {cat.name}
              </label>
            ))}
          </div>
        </div>

        {/* First order only */}
        <label className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={firstOrderOnly}
            onChange={(e) => setFirstOrderOnly(e.target.checked)}
          />
          New users only (first order)
        </label>

        {/* User segment */}
        <select
          className="input"
          name="userSegment"
          value={userSegment}
          onChange={(e) => setUserSegment(e.target.value as CouponUserSegment)}
        >
          <option value="ALL">All users</option>
          <option value="NEW">New users</option>
          <option value="RETURNING">Returning users</option>
        </select>

        <button
          className="btn-premium sm:col-span-2 md:col-span-4"
          disabled={create.isPending}
        >
          {create.isPending ? 'Creating…' : 'Create coupon'}
        </button>
      </motion.form>

      {/* Error */}
      {isError && (
        <p className="text-error mb-3 text-sm">Failed to load coupons.</p>
      )}

      {/* List */}
      {isLoading ? (
        <SkeletonList rows={5} />
      ) : pageOf(data).length === 0 ? (
        <Empty title="No coupons yet." />
      ) : (
        <motion.div
          className="space-y-3"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {pageOf(data).map((c) => (
            <CouponRow
              key={c.id}
              coupon={c}
              onToggle={(id) => toggle.mutate(id)}
              onDelete={(id) => remove.mutate(id)}
              isToggling={toggle.isPending}
              isDeleting={remove.isPending}
            />
          ))}
        </motion.div>
      )}
    </PortalPage>
  );
}
