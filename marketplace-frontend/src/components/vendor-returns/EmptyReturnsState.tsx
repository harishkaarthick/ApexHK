import { motion } from 'framer-motion';
import { PackageOpen, RefreshCw } from 'lucide-react';

export default function EmptyReturnsState({ onRefresh }: { onRefresh?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center px-6 py-20 text-center"
    >
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
        className="grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-violet-50 to-indigo-50"
      >
        <PackageOpen className="h-9 w-9 text-violet-400" />
      </motion.div>
      <h3 className="mt-5 text-lg font-semibold text-slate-900">No Return Requests Yet</h3>
      <p className="mt-1.5 max-w-sm text-sm text-slate-500">
        Customer return requests will appear here once submitted.
      </p>
      <button
        onClick={onRefresh}
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-transform hover:scale-[1.02] active:scale-[0.98]"
      >
        <RefreshCw className="h-4 w-4" />
        Refresh
      </button>
    </motion.div>
  );
}
