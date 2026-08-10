import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { Notification } from '@/types';
import { useNotificationStore } from '@/stores';
import { formatDateTime } from '@/lib/utils';
import { dropdownVariants, listItem, staggerContainer } from '@/lib/motion';
import api from '@/lib/axios';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

interface Props {
  onClose: () => void;
}

export default function NotificationDropdown({ onClose }: Props) {
  const qc = useQueryClient();
  const reset = useNotificationStore((s) => s.reset);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', { page: 0 }],
    queryFn: () =>
      api
        .get('/notifications', { params: { page: 0, size: 10 } })
        .then((r) => r.data.data),
  });

  const markAllRead = useMutation({
    mutationFn: () => api.put('/notifications/read-all'),
    onSuccess: () => {
      reset();
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
  const markAllReadRef = useRef(markAllRead.mutate);

  useEffect(() => {
    markAllReadRef.current = markAllRead.mutate;
  }, [markAllRead.mutate]);

  useEffect(() => {
    markAllReadRef.current();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const notifications: Notification[] = data?.content ?? [];

  return (
    <motion.div
      ref={dropdownRef}
      variants={dropdownVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-lg border border-border bg-surface shadow-xl dark:border-border-dark dark:bg-surface-dark"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-slate-500" />
          <h3 className="text-sm font-semibold">Notifications</h3>
        </div>
        <button
          onClick={() => markAllRead.mutate()}
          className="flex items-center gap-1 text-xs text-primary-600 hover:underline dark:text-primary-400"
        >
          <CheckCheck className="h-3 w-3" />
          Mark all read
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="sm" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            No notifications yet
          </div>
        ) : (
          <motion.div variants={staggerContainer} initial="hidden" animate="visible">
            {notifications.map((n) => (
              <motion.div
                key={n.id}
                variants={listItem}
                className={`border-b border-border/70 px-4 py-3 last:border-0 dark:border-border-dark ${
                  !n.read ? 'bg-primary-50/70 dark:bg-primary-500/10' : ''
                }`}
              >
                {!n.read && (
                  <motion.span
                    className="mb-1 inline-block h-1.5 w-1.5 rounded-full bg-primary-500"
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  />
                )}
                <p className="text-sm font-medium">{n.title}</p>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{n.message}</p>
                <p className="mt-1 text-[11px] text-slate-400">{formatDateTime(n.createdAt)}</p>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
