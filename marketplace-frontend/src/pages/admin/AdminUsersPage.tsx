/**
 * AdminUsersPage.tsx
 * ─────────────────────────────────────────────────────────────
 * Paginated user list with client-side search and
 * enable/disable toggle.
 * GET /admin/users?page=0&size=20  →  PagedResponse<AdminUser>
 * PUT /admin/users/:id/toggle
 * ─────────────────────────────────────────────────────────────
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Search } from 'lucide-react';

import api from '@/lib/axios';
import { listItem, staggerContainer } from '@/lib/motion';
import { Empty, PortalPage, StatusBadge, dt, unwrap } from '@/pages/pageShared';
import type { AdminUser } from '@/types';
import { Pagination, SkeletonList, type PagedResponse } from './AdminPages';

export function AdminUsersPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');

  const { data, isLoading, isError } = useQuery<PagedResponse<AdminUser>>({
    queryKey: ['admin-users', page],
    queryFn: () =>
      api
        .get('/admin/users', { params: { page, size: 20 } })
        .then((r) => unwrap<PagedResponse<AdminUser>>(r)),
  });

  const toggle = useMutation({
    mutationFn: (id: string) => api.put(`/admin/users/${id}/toggle`),
    onSuccess: () => {
      toast.success('User updated');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: () => toast.error('Failed to update user'),
  });

  const allUsers = data?.content ?? [];
  const filtered = search.trim()
    ? allUsers.filter(
        (u) =>
          u.name.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase()),
      )
    : allUsers;

  return (
    <PortalPage title="Users">
      {/* Search */}
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className="input pl-9"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
      </div>

      {/* Error */}
      {isError && (
        <p className="text-error mb-3 text-sm">Failed to load users.</p>
      )}

      {/* Loading */}
      {isLoading ? (
        <SkeletonList rows={8} />
      ) : filtered.length === 0 ? (
        <Empty title="No users found." />
      ) : (
        <>
          {/* Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3">Role</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Joined</th>
                    <th className="px-5 py-3">Action</th>
                  </tr>
                </thead>
                <motion.tbody
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                >
                  {filtered.map((u) => (
                    <motion.tr
                      key={u.id}
                      variants={listItem}
                      className="border-b border-slate-100 last:border-0 dark:border-slate-700"
                    >
                      <td className="px-5 py-3 font-medium">{u.name}</td>
                      <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                        {u.email}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge
                          tone={u.role === 'ADMIN' ? 'warning' : 'neutral'}
                          label={u.role}
                        />
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge
                          tone={u.active ? 'success' : 'error'}
                          label={u.active ? 'Active' : 'Disabled'}
                        />
                      </td>
                      <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                        {dt(u.createdAt)}
                      </td>
                      <td className="px-5 py-3">
                        <button
                          className={u.active ? 'btn-premium-danger' : 'btn-premium-secondary'}
                          disabled={toggle.isPending}
                          onClick={() => toggle.mutate(u.id)}
                        >
                          {u.active ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </motion.tbody>
              </table>
            </div>
          </div>

          {/* Pagination (only when not searching — search is client-side over current page) */}
          {!search && (
            <Pagination
              page={page}
              totalPages={data?.totalPages ?? 1}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </PortalPage>
  );
}
