/**
 * AdminProductsPage.tsx  (NEW)
 * ─────────────────────────────────────────────────────────────
 * Product management: paginated table, thumbnail, visibility
 * toggle, and delete with confirm dialog.
 * GET    /admin/products?page=0&size=20
 * PUT    /admin/products/:id/toggle-visibility
 * DELETE /admin/products/:id
 * ─────────────────────────────────────────────────────────────
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Search, Trash2 } from 'lucide-react';

import api from '@/lib/axios';
import { listItem, staggerContainer } from '@/lib/motion';
import { Empty, PortalPage, StatusBadge, money, unwrap } from '@/pages/pageShared';
import type { Product } from '@/types';
import { ConfirmDialog, Pagination, SkeletonList, type PagedResponse } from './AdminPages';

// ─── Page ────────────────────────────────────────────────────

export function AdminProductsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<PagedResponse<Product>>({
    queryKey: ['admin-products', page],
    queryFn: () =>
      api
        .get('/admin/products', { params: { page, size: 20 } })
        .then((r) => unwrap<PagedResponse<Product>>(r)),
  });

  const toggleVisibility = useMutation({
    mutationFn: (id: string) =>
      api.put(`/admin/products/${id}/toggle-visibility`),
    onSuccess: () => {
      toast.success('Visibility updated');
      qc.invalidateQueries({ queryKey: ['admin-products'] });
    },
    onError: () => toast.error('Failed to update visibility'),
  });

  const deleteProduct = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/products/${id}`),
    onSuccess: () => {
      toast.success('Product deleted');
      setDeletingId(null);
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: () => toast.error('Failed to delete product'),
  });

  const allProducts = data?.content ?? [];
  const filtered = search.trim()
    ? allProducts.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()),
      )
    : allProducts;

  const deletingProduct = allProducts.find((p) => p.id === deletingId);

  return (
    <PortalPage title="Products">
      {/* Search */}
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className="input pl-9"
          placeholder="Search by product name…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
      </div>

      {isError && (
        <p className="text-error mb-3 text-sm">Failed to load products.</p>
      )}

      {isLoading ? (
        <SkeletonList rows={8} />
      ) : filtered.length === 0 ? (
        <Empty title="No products found." />
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    <th className="px-5 py-3">Product</th>
                    <th className="px-5 py-3">Vendor</th>
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3">Price</th>
                    <th className="px-5 py-3">Stock</th>
                    <th className="px-5 py-3">Visible</th>
                    <th className="px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <motion.tbody
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                >
                  {filtered.map((p) => (
                    <motion.tr
                      key={p.id}
                      variants={listItem}
                      className="border-b border-slate-100 last:border-0 dark:border-slate-700"
                    >
                      {/* Thumbnail + name */}
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {p.imageUrls?.[0] ? (
                            <img
                              src={p.imageUrls[0]}
                              alt={p.name}
                              className="h-10 w-10 flex-shrink-0 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="h-10 w-10 flex-shrink-0 rounded-lg bg-slate-200 dark:bg-slate-700" />
                          )}
                          <span className="max-w-[180px] truncate font-medium">
                            {p.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                        {p.vendorName}
                      </td>
                      <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                        {p.category}
                      </td>
                      <td className="px-5 py-3 font-medium">
                        {money(p.price)}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={
                            p.stock === 0
                              ? 'text-error font-medium'
                              : p.stock < 5
                              ? 'text-warning font-medium'
                              : ''
                          }
                        >
                          {p.stock}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge
                          tone={p.active ? 'success' : 'neutral'}
                          label={p.active ? 'Visible' : 'Hidden'}
                        />
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            className="btn-ghost p-1.5"
                            title={p.active ? 'Hide product' : 'Show product'}
                            disabled={toggleVisibility.isPending}
                            onClick={() => toggleVisibility.mutate(p.id)}
                          >
                            {p.active ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            className="btn-premium-danger h-9 px-3"
                            title="Delete product"
                            onClick={() => setDeletingId(p.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </motion.tbody>
              </table>
            </div>
          </div>

          {!search && (
            <Pagination
              page={page}
              totalPages={data?.totalPages ?? 1}
              onPageChange={setPage}
            />
          )}
        </>
      )}

      <ConfirmDialog
        open={Boolean(deletingId)}
        title="Delete product?"
        message={
          deletingProduct
            ? `"${deletingProduct.name}" will be permanently removed.`
            : 'This action cannot be undone.'
        }
        confirmLabel="Delete"
        isPending={deleteProduct.isPending}
        onConfirm={() => deletingId && deleteProduct.mutate(deletingId)}
        onClose={() => setDeletingId(null)}
      />
    </PortalPage>
  );
}
