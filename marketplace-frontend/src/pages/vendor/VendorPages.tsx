import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Clock, IndianRupee, Plus, Store, Trash2, TrendingUp, Upload, X } from 'lucide-react';
import { z } from 'zod';

import api from '@/lib/axios';
import { useCategories, useRequestCategory } from '@/lib/categories';
import type { OrderStatus, PagedResponse, PayoutRequest, Product, ReturnRequest, VendorStore } from '@/types';
import { Empty, Field, LoadingBlock, PortalPage, StatusBadge, dt, money, pageOf, unwrap } from '@/pages/pageShared';
import { fadeIn, fadeInUp, listItem, scaleIn, staggerContainer } from '@/lib/motion';

export function VendorDashboardPage() {
  const { data } = useQuery({
    queryKey: ['vendor-store'],
    queryFn: () => api.get('/vendor/store').then((r) => unwrap<VendorStore>(r)),
  });

  return (
    <PortalPage title="Vendor dashboard">
      <motion.div className="grid gap-4 md:grid-cols-3" variants={staggerContainer} initial="hidden" animate="visible">
        <Stat label="Store" value={data?.storeName || '-'} icon={<Store />} />
        <Stat label="Total earnings" value={money(data?.totalEarnings ?? 0)} icon={<IndianRupee />} trend />
        <Stat label="Pending payout" value={money(data?.pendingPayout ?? 0)} icon={<Clock />} />
      </motion.div>
    </PortalPage>
  );
}

function Stat({ label, value, icon, trend }: { label: string; value: string; icon: React.ReactNode; trend?: boolean }) {
  return (
    <motion.div className="card p-5" variants={scaleIn} viewport={{ once: true }} whileHover={{ y: -4 }}>
      <div className="mb-3 flex items-center justify-between text-primary-700 dark:text-primary-300">
        {icon}
        {trend && (
          <motion.span animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
            <TrendingUp className="h-4 w-4 text-success" />
          </motion.span>
        )}
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </motion.div>
  );
}

function StatusPill({ status }: { status: OrderStatus | string }) {
  const pending = String(status).includes('PENDING');
  return <StatusBadge tone={pending ? 'warning' : 'neutral'} label={String(status)} pulse={pending} />;
}

export function VendorProductsPage() {
  const qc = useQueryClient();
  const [deleting, setDeleting] = useState<Product | null>(null);
  const { data } = useQuery({
    queryKey: ['vendor-products', { page: 0 }],
    queryFn: () => api.get('/vendor/products', { params: { page: 0, size: 20 } }).then((r) => unwrap<PagedResponse<Product>>(r)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => {
      toast.success('Product deleted');
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ['vendor-products'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to delete product'),
  });

  return (
    <PortalPage title="Products" action={<Link className="btn-premium" to="/vendor/products/new"><Plus className="h-4 w-4" /> Add product</Link>}>
      <motion.div className="space-y-3" variants={staggerContainer} initial="hidden" animate="visible">
        {pageOf(data).map((p, index) => {
          const stockPct = Math.min(100, Math.max(0, p.stock));
          const imageUrl = p.imageUrls?.[0];
          return (
            <motion.div className="card p-4" key={p.id} variants={listItem}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 gap-4">
                  {imageUrl ? (
                    <img src={imageUrl} alt={p.name} className="h-24 w-24 flex-none rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-24 w-24 flex-none items-center justify-center rounded-lg bg-slate-200 text-xs font-medium text-slate-500 dark:bg-white/10 dark:text-slate-400">
                      No Image
                    </div>
                  )}
                  <div className="min-w-0 py-1">
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{money(p.discountedPrice ?? p.price)}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Stock: {p.stock}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Category: {p.category}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link className="btn-premium-secondary" to={`/vendor/products/${p.id}/edit`}>Edit</Link>
                  <button className="btn-premium-danger" type="button" onClick={() => setDeleting(p)}>
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-accent-indigo to-accent-purple"
                  initial={{ width: 0 }}
                  animate={{ width: `${stockPct}%` }}
                  transition={{ duration: 0.8, delay: index * 0.05 }}
                />
              </div>
            </motion.div>
          );
        })}
        {!pageOf(data).length && <Empty title="No products found." />}
      </motion.div>
      <ConfirmDeleteModal
        open={Boolean(deleting)}
        title="Delete product?"
        description={deleting?.name || ''}
        isPending={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </PortalPage>
  );
}

export function VendorProductNewPage() {
  return <PortalPage title="Add product"><ProductForm /></PortalPage>;
}

export function VendorProductEditPage() {
  const { id = '' } = useParams();
  const { data } = useQuery({
    queryKey: ['product', id],
    queryFn: () => api.get(`/products/${id}`).then((r) => unwrap<Product>(r)),
  });
  return <PortalPage title="Edit product"><ProductForm product={data} /></PortalPage>;
}

function ProductForm({ product }: { product?: Product }) {
  const navigate = useNavigate();
  const [requestOpen, setRequestOpen] = useState(false);
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();
  const schema = z.object({
    name: z.string().min(2).max(200),
    price: z.number().positive(),
    discountedPrice: z.number().positive().optional(),
    stock: z.number().int().min(0),
  }).refine((v) => !v.discountedPrice || v.discountedPrice < v.price, {
    message: 'Discounted price must be less than original price',
  });
  const mutation = useMutation({
    mutationFn: (fd: FormData) => {
      return product
        ? api.put(`/products/${product.id}`, fd)
        : api.post('/products', fd);
    },
    onSuccess: () => {
      toast.success('Product saved');
      navigate('/vendor/products');
    },
  });
  const requestCategory = useRequestCategory();
  const selectedCategory = product?.category || categories[0]?.name || '';

  return (
    <>
    <motion.form className="card grid gap-4 p-5 md:grid-cols-2" variants={staggerContainer} initial="hidden" animate="visible" onSubmit={(e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const raw = new FormData(form);

      const parsed = schema.safeParse({
        name: raw.get('name'),
        price: Number(raw.get('price')),
        discountedPrice: raw.get('discountedPrice') ? Number(raw.get('discountedPrice')) : undefined,
        stock: Number(raw.get('stock')),
      });
      if (!parsed.success) return toast.error(parsed.error.errors[0].message);

      // Build the JSON payload expected by ProductRequest.Create/Update
      const payload: Record<string, unknown> = {
        name: raw.get('name'),
        description: raw.get('description') || '',
        category: raw.get('category') || '',
        brand: raw.get('brand') || undefined,
        price: parsed.data.price,
        discountedPrice: parsed.data.discountedPrice ?? 0,
        stock: parsed.data.stock,
        featured: raw.get('featured') === 'on',
      };

      // Backend expects a multipart request with a "data" JSON part and
      // optional "images" file parts (see ProductController.create/update).
      const fd = new FormData();
      fd.append('data', JSON.stringify(payload));

      const imageInput = form.elements.namedItem('imageFiles') as HTMLInputElement | null;
      if (imageInput?.files) {
        Array.from(imageInput.files).forEach((file) => fd.append('images', file));
      }

      mutation.mutate(fd);
    }}>
      {['name', 'brand'].map((n) => (
        <motion.div key={n} variants={fadeInUp}>
          <Field label={n}><input className="input" name={n} defaultValue={(product as any)?.[n]} /></Field>
        </motion.div>
      ))}
      <motion.div variants={fadeInUp}>
        <Field label="category">
          <div className="space-y-2">
            <select className="input" name="category" defaultValue={selectedCategory} disabled={categoriesLoading || !categories.length}>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
            <button type="button" className="btn-premium-secondary text-xs" onClick={() => setRequestOpen(true)}>
              <Plus className="h-4 w-4" /> Request New Category
            </button>
          </div>
        </Field>
      </motion.div>
      <motion.div variants={fadeInUp}><Field label="Price"><input className="input" name="price" type="number" defaultValue={product?.price} /></Field></motion.div>
      <motion.div variants={fadeInUp}><Field label="Discounted price"><input className="input" name="discountedPrice" type="number" defaultValue={product?.discountedPrice} /></Field></motion.div>
      <motion.div variants={fadeInUp}><Field label="Stock"><input className="input" name="stock" type="number" defaultValue={product?.stock ?? 0} /></Field></motion.div>
      <motion.div variants={fadeInUp}><Field label="Description"><textarea className="input min-h-28" name="description" defaultValue={product?.description} /></Field></motion.div>
      <motion.div variants={fadeInUp} className="md:col-span-2">
        <Field label={product ? 'Add more images' : 'Images'}>
          <div className="space-y-3">
            {product?.imageUrls?.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {product.imageUrls.map((url) => (
                  <img key={url} src={url} alt={product.name} className="aspect-square w-full rounded-lg object-cover" />
                ))}
              </div>
            ) : product ? (
              <div className="flex h-24 w-24 items-center justify-center rounded-lg bg-slate-200 text-xs font-medium text-slate-500 dark:bg-white/10 dark:text-slate-400">
                No Image
              </div>
            ) : null}
            <input className="input" name="imageFiles" type="file" accept="image/*" multiple />
          </div>
        </Field>
      </motion.div>
      <motion.label variants={fadeInUp} className="flex items-center gap-2 text-sm"><input type="checkbox" name="featured" defaultChecked={product?.featured} /> Featured</motion.label>
      <motion.button className="btn-premium md:col-span-2" disabled={mutation.isPending || !categories.length} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
        <Upload className="h-4 w-4" /> Save product
      </motion.button>
    </motion.form>
    <CategoryRequestModal
      open={requestOpen}
      isPending={requestCategory.isPending}
      onClose={() => setRequestOpen(false)}
      onSubmit={(name) => requestCategory.mutate(name, {
        onSuccess: () => {
          toast.success('Category request submitted for admin approval.');
          setRequestOpen(false);
        },
      })}
    />
    </>
  );
}

function CategoryRequestModal({
  open,
  isPending,
  onClose,
  onSubmit,
}: {
  open: boolean;
  isPending?: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState('');

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm" variants={fadeIn} initial="hidden" animate="visible" exit="hidden">
          <motion.form
            className="card w-full max-w-md space-y-4 p-5"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onSubmit={(e) => {
              e.preventDefault();
              const nextName = name.trim();
              if (!nextName) return toast.error('Category name is required');
              onSubmit(nextName);
              setName('');
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold">Request new category</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Admin approval is required before vendors can use it.</p>
              </div>
              <button type="button" className="btn-ghost p-2" onClick={onClose}><X className="h-4 w-4" /></button>
            </div>
            <Field label="Category name">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-premium-secondary" onClick={onClose}>Cancel</button>
              <button className="btn-premium" disabled={isPending}>Submit request</button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export { VendorOrdersPage as default } from './VendorOrdersPage';

function VendorOrderAction({ order, onTransition }: { order: any; onTransition: (next: OrderStatus) => void }) {
  const [tracking, setTracking] = useState(false);
  const qc = useQueryClient();
  const track = useMutation({
    mutationFn: (trackingId: string) => api.put(`/orders/${order.id}/tracking`, { trackingId }),
    onSuccess: () => {
      setTracking(false);
      qc.invalidateQueries({ queryKey: ['vendor-orders'] });
    },
  });
  if (order.status === 'CONFIRMED') return <button className="btn-premium" onClick={() => onTransition('PROCESSING')}>Start processing</button>;
  if (order.status === 'PROCESSING') {
    return (
      <>
        <button className="btn-premium" onClick={() => setTracking(true)}>Mark shipped</button>
        <AnimatePresence>
          {tracking && (
            <motion.div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm" variants={fadeIn} initial="hidden" animate="visible" exit="hidden">
              <motion.form className="card w-full max-w-sm space-y-3 p-5" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onSubmit={(e) => {
                e.preventDefault();
                track.mutate(String(new FormData(e.currentTarget).get('trackingId') || ''));
              }}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Tracking ID</h3>
                  <button type="button" className="btn-ghost p-2" onClick={() => setTracking(false)}><X className="h-4 w-4" /></button>
                </div>
                <input className="input" name="trackingId" />
                <div className="flex justify-end gap-2">
                  <button type="button" className="btn-premium-secondary" onClick={() => setTracking(false)}>Close</button>
                  <button className="btn-premium">Save</button>
                </div>
              </motion.form>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }
  return <StatusPill status={order.status} />;
}

export function VendorReturnsPage() {
  const qc = useQueryClient();
  const [rejecting, setRejecting] = useState<ReturnRequest | null>(null);
  const { data } = useQuery({
    queryKey: ['vendor-returns'],
    queryFn: () => api.get('/vendor/returns', { params: { page: 0 } }).then((r) => unwrap<PagedResponse<ReturnRequest>>(r)),
  });
  const approve = useMutation({
    mutationFn: (id: string) => api.post(`/vendor/returns/${id}/approve`),
    onSuccess: () => {
      toast.success('Return approved');
      qc.invalidateQueries({ queryKey: ['vendor-returns'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to approve return');
      qc.invalidateQueries({ queryKey: ['vendor-returns'] });
    },
  });
  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.post(`/vendor/returns/${id}/reject`, { reason }),
    onSuccess: () => {
      toast.success('Return rejected');
      setRejecting(null);
      qc.invalidateQueries({ queryKey: ['vendor-returns'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to reject return');
      qc.invalidateQueries({ queryKey: ['vendor-returns'] });
    },
  });

  return (
    <PortalPage title="Return requests">
      <motion.div className="space-y-3" variants={staggerContainer} initial="hidden" animate="visible">
        {pageOf(data).map((r) => (
          <motion.div className="card flex flex-col gap-4 p-4 sm:flex-row sm:justify-between" key={r.id} variants={listItem}>
            <div>
              <p className="font-semibold">{r.productName}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{r.reason}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={r.status} />
              {(r.status === 'RETURN_REQUESTED' || r.status === 'UNDER_REVIEW') && (
                <>
                  <button className="btn-premium" disabled={approve.isPending} onClick={() => approve.mutate(r.id)}>Approve</button>
                  <button className="btn-premium-danger" disabled={reject.isPending} onClick={() => setRejecting(r)}>Reject</button>
                </>
              )}
            </div>
          </motion.div>
        ))}
        {!pageOf(data).length && <Empty title="No return requests." />}
      </motion.div>
      <RejectReasonModal
        open={Boolean(rejecting)}
        title="Reject return request"
        description={rejecting?.productName || ''}
        isPending={reject.isPending}
        onClose={() => setRejecting(null)}
        onSubmit={(reason) => rejecting && reject.mutate({ id: rejecting.id, reason })}
      />
    </PortalPage>
  );
}

export function VendorEarningsPage() {
  const qc = useQueryClient();
  const [historyPage, setHistoryPage] = useState(0);

  const { data: store, isLoading } = useQuery({
    queryKey: ['vendor-store'],
    queryFn: () => api.get('/vendor/store').then((r) => unwrap<VendorStore>(r)),
  });

  const { data: history, isLoading: histLoading } = useQuery({
    queryKey: ['vendor-payout-history', historyPage],
    queryFn: () =>
      api
        .get('/vendor/payout/history', { params: { page: historyPage, size: 8 } })
        .then((r) => unwrap<PagedResponse<PayoutRequest>>(r)),
  });

  const requestPayout = useMutation({
    mutationFn: () => api.post('/vendor/payout/request'),
    onSuccess: () => {
      toast.success('Payout request submitted! We will review it shortly.');
      qc.invalidateQueries({ queryKey: ['vendor-store'] });
      qc.invalidateQueries({ queryKey: ['vendor-payout-history'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to submit payout request'),
  });

  const nextPayoutDate = store?.nextPayoutDate ? new Date(store.nextPayoutDate) : null;
  const cooldownActive = nextPayoutDate !== null && nextPayoutDate > new Date();
  const noPayout = (store?.pendingPayout ?? 0) <= 0;
  const hasPendingRequest = history?.content?.some((p) => p.status === 'PENDING') ?? false;
  const canRequest = !noPayout && !cooldownActive && !hasPendingRequest;

  function payoutTone(status: PayoutRequest['status']) {
    if (status === 'PAID' || status === 'APPROVED') return 'success' as const;
    if (status === 'REJECTED') return 'error' as const;
    return 'warning' as const;
  }

  return (
    <PortalPage title="Earnings">
      {isLoading ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          {/* ── Stats row ── */}
          <motion.div className="grid gap-4 md:grid-cols-3" variants={staggerContainer} initial="hidden" animate="visible">
            <Stat label="Total earnings" value={money(store?.totalEarnings ?? 0)} icon={<IndianRupee />} trend />
            <Stat label="Pending payout" value={money(store?.pendingPayout ?? 0)} icon={<Clock />} />
            <Stat label="Commission" value={`${store?.commissionRate ?? 0}%`} icon={<Store />} />
          </motion.div>

          <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
            {/* ── Payout History Table ── */}
            <motion.div className="card overflow-hidden" variants={fadeInUp} initial="hidden" animate="visible">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-700">
                <h2 className="font-semibold">Payout History</h2>
              </div>
              {histLoading ? (
                <div className="p-5"><LoadingBlock /></div>
              ) : !history?.content?.length ? (
                <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  No payout requests yet.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500 dark:border-slate-700 dark:text-slate-400">
                          <th className="px-5 py-3">Amount</th>
                          <th className="px-5 py-3">Requested</th>
                          <th className="px-5 py-3">Processed</th>
                          <th className="px-5 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.content.map((payout) => (
                          <motion.tr
                            key={payout.id}
                            variants={listItem}
                            className="border-b border-slate-100 last:border-0 dark:border-slate-700"
                          >
                            <td className="px-5 py-3 font-semibold">{money(payout.amount)}</td>
                            <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{dt(payout.requestedAt)}</td>
                            <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                              {payout.processedAt ? dt(payout.processedAt) : '—'}
                            </td>
                            <td className="px-5 py-3">
                              <StatusBadge
                                tone={payoutTone(payout.status)}
                                label={payout.status}
                                pulse={payout.status === 'PENDING'}
                              />
                              {payout.rejectionReason && (
                                <p className="mt-1 text-xs text-slate-500">{payout.rejectionReason}</p>
                              )}
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {(history?.totalPages ?? 1) > 1 && (
                    <div className="border-t border-slate-100 px-5 py-3 dark:border-slate-700">
                      <PayoutPagination
                        page={historyPage}
                        totalPages={history?.totalPages ?? 1}
                        onPageChange={setHistoryPage}
                      />
                    </div>
                  )}
                </>
              )}
            </motion.div>

            {/* ── Request Panel ── */}
            <motion.aside className="card h-fit p-5" variants={fadeInUp} initial="hidden" animate="visible">
              <h2 className="font-semibold">Request Payout</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Earnings are calculated from delivered orders after marketplace commission.
              </p>

              {/* Next payout date banner */}
              {cooldownActive && nextPayoutDate && (
                <div className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm dark:bg-amber-900/20">
                  <p className="font-medium text-amber-700 dark:text-amber-300">Cooldown active</p>
                  <p className="mt-0.5 text-amber-600 dark:text-amber-400">
                    Next payout available on{' '}
                    <span className="font-semibold">
                      {nextPayoutDate.toLocaleDateString(undefined, {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </p>
                </div>
              )}

              {/* Pending request notice */}
              {hasPendingRequest && !cooldownActive && (
                <div className="mt-4 rounded-lg bg-blue-50 px-4 py-3 text-sm dark:bg-blue-900/20">
                  <p className="font-medium text-blue-700 dark:text-blue-300">Request under review</p>
                  <p className="mt-0.5 text-blue-600 dark:text-blue-400">
                    Your payout request is pending admin approval.
                  </p>
                </div>
              )}

              <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 dark:bg-slate-800">
                <p className="text-xs text-slate-500 dark:text-slate-400">Available balance</p>
                <p className="text-2xl font-bold">{money(store?.pendingPayout ?? 0)}</p>
              </div>

              <button
                className="btn-premium mt-4 w-full"
                disabled={!canRequest || requestPayout.isPending}
                onClick={() => requestPayout.mutate()}
              >
                {requestPayout.isPending ? 'Submitting…' : 'Request Payout'}
              </button>

              {noPayout && !cooldownActive && !hasPendingRequest && (
                <p className="mt-2 text-center text-xs text-slate-400">No balance to withdraw</p>
              )}
            </motion.aside>
          </div>
        </div>
      )}
    </PortalPage>
  );
}

function PayoutPagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <button
        className="rounded px-3 py-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-700"
        disabled={page === 0}
        onClick={() => onPageChange(page - 1)}
      >
        ← Prev
      </button>
      <span className="text-slate-400">
        Page {page + 1} of {totalPages}
      </span>
      <button
        className="rounded px-3 py-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-700"
        disabled={page >= totalPages - 1}
        onClick={() => onPageChange(page + 1)}
      >
        Next →
      </button>
    </div>
  );
}

function RejectReasonModal({
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
        <motion.div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm" variants={fadeIn} initial="hidden" animate="visible" exit="hidden">
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
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
              </div>
              <button type="button" className="btn-ghost p-2" onClick={onClose}><X className="h-4 w-4" /></button>
            </div>
            <Field label="Rejection reason">
              <textarea className="input min-h-28" value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-premium-secondary" onClick={onClose}>Close</button>
              <button className="btn-premium-danger" disabled={isPending}>Reject</button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ConfirmDeleteModal({
  open,
  title,
  description,
  isPending,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  isPending?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm" variants={fadeIn} initial="hidden" animate="visible" exit="hidden">
          <motion.div
            className="card w-full max-w-md space-y-4 p-5"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
              </div>
              <button type="button" className="btn-ghost p-2" onClick={onClose}><X className="h-4 w-4" /></button>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-premium-secondary" onClick={onClose}>Cancel</button>
              <button type="button" className="btn-premium-danger" disabled={isPending} onClick={onConfirm}>Delete</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}