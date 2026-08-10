import { X } from 'lucide-react';
import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { overlayVariants } from '@/lib/motion';

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onCancel}
            aria-hidden
          />
          <motion.div
            className="relative z-10 w-full max-w-sm rounded-lg border border-border bg-surface p-6 text-foreground shadow-xl dark:border-border-dark dark:bg-surface-dark dark:text-foreground-dark"
            role="dialog"
            aria-modal
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 300 }}
          >
            <button
              onClick={onCancel}
              className="absolute right-3 top-3 rounded p-1 text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <h2 className="mb-2 text-base font-semibold">{title}</h2>
            <p className="mb-6 text-sm text-slate-600 dark:text-slate-300">{message}</p>

            <div className="flex justify-end gap-3">
              <motion.button
                onClick={onCancel}
                className="btn-premium-secondary"
                disabled={loading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {cancelLabel}
              </motion.button>
              <motion.button
                onClick={onConfirm}
                disabled={loading}
                className={danger ? 'btn-premium-danger' : 'btn-premium'}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {loading ? 'Loading...' : confirmLabel}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
