import { create } from 'zustand';

// ─────────────────────────────────────────────
// Re-export authStore so that `import { useAuthStore } from '@/stores'` also works
// ─────────────────────────────────────────────
export { useAuthStore } from './authStore';

// ─────────────────────────────────────────────
// Cart store — only tracks item count for the nav badge
// Full cart data lives in TanStack Query cache
// ─────────────────────────────────────────────
interface CartState {
  itemCount: number;
  setItemCount: (n: number) => void;
}

export const useCartStore = create<CartState>((set) => ({
  itemCount: 0,
  setItemCount: (n) => set({ itemCount: n }),
}));

// ─────────────────────────────────────────────
// Notification store — tracks unread count for bell badge
// ─────────────────────────────────────────────
interface NotificationState {
  unreadCount: number;
  setUnreadCount: (n: number) => void;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  unreadCount: 0,
  setUnreadCount: (n) => set({ unreadCount: n }),
  increment:    () => set({ unreadCount: get().unreadCount + 1 }),
  decrement:    () => set({ unreadCount: Math.max(0, get().unreadCount - 1) }),
  reset:        () => set({ unreadCount: 0 }),
}));
