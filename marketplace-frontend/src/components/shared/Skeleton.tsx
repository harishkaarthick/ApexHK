import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export default function Skeleton({ className }: SkeletonProps) {
  return (
    <motion.div
      className={cn('rounded-lg', className)}
      style={{
        background:
          'linear-gradient(90deg, var(--skeleton-from) 25%, var(--skeleton-mid) 50%, var(--skeleton-from) 75%)',
        backgroundSize: '200% 100%',
      }}
      animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
      aria-hidden
    />
  );
}
