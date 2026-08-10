import { Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import { useAuthStore } from '@/stores/authStore';
import { useCartStore, useNotificationStore } from '@/stores';
import api from '@/lib/axios';

export default function MainLayout() {
  const user = useAuthStore((s) => s.user);
  const setItemCount = useCartStore((s) => s.setItemCount);
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);

  useEffect(() => {
    if (!user) return;

    if (user.role === 'CUSTOMER') {
      api.get('/cart').then((res) => {
        const cart = res.data.data;
        const count = cart?.items?.reduce(
          (sum: number, item: { quantity: number }) => sum + item.quantity,
          0
        ) ?? 0;
        setItemCount(count);
      }).catch(() => {});
    }

    api.get('/notifications/unread-count').then((res) => {
      setUnreadCount(res.data.data?.count ?? 0);
    }).catch(() => {});
  }, [setItemCount, setUnreadCount, user]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground dark:bg-background-dark dark:text-foreground-dark">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
