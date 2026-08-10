import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Props {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, totalPages, onPageChange }: Props) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i);
  const start = Math.max(0, page - 2);
  const end = Math.min(totalPages - 1, page + 2);
  const visible = pages.slice(start, end + 1);

  return (
    <nav className="flex items-center justify-center gap-1" aria-label="Pagination">
      <motion.button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 0}
        className="btn-premium-secondary h-10 px-3 disabled:opacity-40"
        aria-label="Previous page"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <ChevronLeft className="h-4 w-4" />
      </motion.button>

      {start > 0 && (
        <>
          <PageBtn n={0} current={page} onClick={onPageChange} />
          {start > 1 && <span className="px-1 text-slate-400">...</span>}
        </>
      )}

      {visible.map((n) => (
        <PageBtn key={n} n={n} current={page} onClick={onPageChange} />
      ))}

      {end < totalPages - 1 && (
        <>
          {end < totalPages - 2 && <span className="px-1 text-slate-400">...</span>}
          <PageBtn n={totalPages - 1} current={page} onClick={onPageChange} />
        </>
      )}

      <motion.button
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages - 1}
        className="btn-premium-secondary h-10 px-3 disabled:opacity-40"
        aria-label="Next page"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <ChevronRight className="h-4 w-4" />
      </motion.button>
    </nav>
  );
}

function PageBtn({
  n,
  current,
  onClick,
}: {
  n: number;
  current: number;
  onClick: (n: number) => void;
}) {
  const active = n === current;

  return (
    <motion.button
      onClick={() => onClick(n)}
      className={cn(
        'relative flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-colors',
        active
          ? 'text-white'
          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5'
      )}
      aria-current={active ? 'page' : undefined}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {active && (
        <motion.div
          layoutId="activePage"
          className="absolute inset-0 rounded-full bg-gradient-to-r from-accent-indigo to-accent-purple"
          transition={{ type: 'spring', damping: 24, stiffness: 320 }}
        />
      )}
      <span className="relative z-10">{n + 1}</span>
    </motion.button>
  );
}
