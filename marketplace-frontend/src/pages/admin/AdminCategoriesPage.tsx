import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Check, X } from 'lucide-react';
import { motion } from 'framer-motion';

import api from '@/lib/axios';
import type { Category } from '@/types';
import { Empty, PortalPage, StatusBadge, dt, unwrap } from '@/pages/pageShared';
import { listItem, staggerContainer } from '@/lib/motion';
import { SkeletonList } from './AdminPages';

export function AdminCategoriesPage() {
  const qc = useQueryClient();
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['admin-categories', 'PENDING'],
    queryFn: () => api.get('/admin/categories', { params: { status: 'PENDING' } }).then((r) => unwrap<Category[]>(r)),
  });
  const approve = useMutation({
    mutationFn: (id: string) => api.put(`/admin/categories/${id}/approve`),
    onSuccess: () => {
      toast.success('Category approved');
      qc.invalidateQueries({ queryKey: ['admin-categories'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });
  const reject = useMutation({
    mutationFn: (id: string) => api.put(`/admin/categories/${id}/reject`),
    onSuccess: () => {
      toast.success('Category rejected');
      qc.invalidateQueries({ queryKey: ['admin-categories'] });
    },
  });

  return (
    <PortalPage title="Category requests">
      {isLoading ? (
        <SkeletonList rows={5} />
      ) : (
        <motion.div className="space-y-3" variants={staggerContainer} initial="hidden" animate="visible">
          {categories.map((category) => (
            <motion.div key={category.id} className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between" variants={listItem}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{category.name}</p>
                  <StatusBadge tone="warning" label={category.status} />
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Requested by vendor {category.requestedByVendorId || '-'} · {dt(category.createdAt)}
                </p>
              </div>
              <div className="flex gap-2">
                <button className="btn-premium" disabled={approve.isPending} onClick={() => approve.mutate(category.id)}>
                  <Check className="h-4 w-4" /> Approve
                </button>
                <button className="btn-premium-danger" disabled={reject.isPending} onClick={() => reject.mutate(category.id)}>
                  <X className="h-4 w-4" /> Reject
                </button>
              </div>
            </motion.div>
          ))}
          {!categories.length && <Empty title="No pending category requests." />}
        </motion.div>
      )}
    </PortalPage>
  );
}
