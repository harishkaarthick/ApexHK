import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShoppingCart, Star } from 'lucide-react';
import { motion } from 'framer-motion';

import api from '@/lib/axios';
import { getEffectivePrice } from '@/lib/utils';
import { cardHover, fadeInUp, scaleIn, staggerContainer } from '@/lib/motion';
import type { PagedResponse, Product } from '@/types';
import Skeleton from '@/components/shared/Skeleton';
import Pagination from '@/components/shared/Pagination';

export const money = (n = 0) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export const dt = (value?: string) =>
  value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

export const unwrap = <T,>(res: { data: { data: T } }) => res.data.data;

export const pageOf = <T,>(data?: PagedResponse<T>) => data?.content ?? [];

export function Page({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <motion.section
      className="mx-auto max-w-7xl px-4 py-8"
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground dark:text-foreground-dark">{title}</h1>
        {action}
      </div>
      {children}
    </motion.section>
  );
}

export function PortalPage({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <motion.section
      className="p-4 sm:p-6"
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground dark:text-foreground-dark">{title}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Live workspace controls</p>
        </div>
        {action}
      </div>
      {children}
    </motion.section>
  );
}

export function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      {children}
      {error && (
        <motion.span
          className="mt-1 block text-xs text-error"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
        >
          {error}
        </motion.span>
      )}
    </label>
  );
}

export function LoadingBlock() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="card overflow-hidden p-3">
          <Skeleton className="aspect-[4/3] w-full" />
          <Skeleton className="mt-4 h-4 w-3/4" />
          <Skeleton className="mt-2 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function Empty({ title }: { title: string }) {
  return (
    <motion.div
      className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-slate-500 dark:border-border-dark dark:bg-surface-dark dark:text-slate-400"
      animate={{ y: [0, -10, 0] }}
      transition={{ repeat: Infinity, duration: 3 }}
    >
      {title}
    </motion.div>
  );
}

export function RatingStars({ value = 0 }: { value?: number }) {
  return (
    <div className="flex items-center gap-0.5 text-warning">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`h-4 w-4 ${i < Math.round(value) ? 'fill-current' : ''}`} />
      ))}
    </div>
  );
}

export function StockBadge({ stock }: { stock: number }) {
  if (stock === 0) return <StatusBadge tone="error" label="Out of stock" />;
  if (stock < 5) return <StatusBadge tone="warning" label="Low stock" pulse />;
  return <StatusBadge tone="success" label="In stock" />;
}

export function StatusBadge({ tone, label, pulse }: { tone: 'success' | 'warning' | 'error' | 'neutral'; label: string; pulse?: boolean }) {
  const color = {
    success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    error: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300',
    neutral: 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200',
  }[tone];

  return (
    <motion.span whileHover={{ scale: 1.1 }} className={`badge gap-1 ${color}`}>
      {pulse && (
        <motion.span
          className="h-1.5 w-1.5 rounded-full bg-current"
          animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        />
      )}
      {label}
    </motion.span>
  );
}

export function ProductCard({ product }: { product: Product }) {
  const price = getEffectivePrice(product);
  const image = product.imageUrls?.[0] || 'https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?q=80&w=900&auto=format&fit=crop';
  return (
    <motion.div variants={scaleIn}>
      <motion.div variants={cardHover} initial="rest" whileHover="hover" className="h-full">
        <Link to={`/products/${product.id}`} className="group card flex h-full flex-col overflow-hidden">
          <div className="relative overflow-hidden">
            <motion.img
              src={image}
              alt={product.name}
              className="aspect-[4/3] w-full object-cover"
              whileHover={{ scale: 1.07 }}
              transition={{ duration: 0.4 }}
            />
            <motion.div
              className="absolute inset-x-3 bottom-3"
              initial={{ y: 40, opacity: 0 }}
              whileHover={{ y: 0, opacity: 1 }}
            >
              <span className="btn-premium w-full text-xs">
                <ShoppingCart className="h-4 w-4" />
                View details
              </span>
            </motion.div>
          </div>
          <div className="flex flex-1 flex-col space-y-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="line-clamp-2 text-sm font-semibold text-foreground dark:text-foreground-dark">{product.name}</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{product.vendorName || 'Marketplace vendor'}</p>
              </div>
              <StockBadge stock={product.stock} />
            </div>
            <div className="mt-auto flex items-center gap-2">
              <span className="font-bold">{money(price)}</span>
              {price < product.price && <span className="text-xs text-slate-400 line-through">{money(product.price)}</span>}
            </div>
            <div className="flex items-center justify-between">
              <RatingStars value={product.averageRating} />
              <span className="text-xs text-slate-500 dark:text-slate-400">{product.totalReviews ?? 0} reviews</span>
            </div>
          </div>
        </Link>
      </motion.div>
    </motion.div>
  );
}

export function ProductGrid({ endpoint, queryKey, emptyTitle }: { endpoint: string; queryKey: unknown[]; emptyTitle?: string }) {
  const [page, setPage] = useState(0);
  const { data, isLoading } = useQuery({
    queryKey: [...queryKey, { page }],
    queryFn: () => api.get(endpoint, { params: { page, size: 12 } }).then((r) => unwrap<PagedResponse<Product>>(r)),
  });

  if (isLoading) return <LoadingBlock />;
  if (!pageOf(data).length) {
    const hint = data?.suggestions?.length ? ` Did you mean: ${data.suggestions.join(', ')}?` : '';
    return <Empty title={`${emptyTitle || 'No products found.'}${hint}`} />;
  }

  return (
    <>
      {(data?.correctedQuery || data?.suggestions?.length) && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          {data.correctedQuery && <span>Showing closest matches for {data.correctedQuery}</span>}
          {data.suggestions?.slice(0, 4).map((suggestion) => (
            <span key={suggestion} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-white/10 dark:text-slate-200">
              {suggestion}
            </span>
          ))}
        </div>
      )}
      <motion.div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-80px' }}
      >
        {pageOf(data).map((p) => <ProductCard key={p.id} product={p} />)}
      </motion.div>
      <div className="mt-6">
        <Pagination page={page} totalPages={data?.totalPages || 1} onPageChange={setPage} />
      </div>
    </>
  );
}