import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  ChevronRight, CreditCard, DollarSign, HandCoins, Image, LayoutDashboard, List, LogOut, Menu,
  FolderTree, Package, RotateCcw, ShoppingBag, Store, Tag, Users, X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { drawerVariants, listItem, staggerContainer } from '@/lib/motion';
import { UserRole } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { disconnectWebSocket } from '@/lib/websocket';
import api from '@/lib/axios';

const VENDOR_LINKS = [
  { to: '/vendor/dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/vendor/products',     icon: Package,         label: 'Products' },
  { to: '/vendor/orders',       icon: ShoppingBag,     label: 'Orders' },
  { to: '/vendor/returns',      icon: RotateCcw,       label: 'Returns' },
  { to: '/vendor/earnings',     icon: DollarSign,      label: 'Earnings' },
  { to: '/vendor/subscription', icon: CreditCard,      label: 'Subscription' }, // NEW
];

const ADMIN_LINKS = [
  { to: '/admin/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/vendors',    icon: Store,           label: 'Vendors' },
  { to: '/admin/users',      icon: Users,           label: 'Users' },
  { to: '/admin/orders',     icon: List,            label: 'Orders' },
  { to: '/admin/payouts',    icon: HandCoins,       label: 'Payouts' },
  { to: '/admin/coupons',    icon: Tag,             label: 'Coupons' },
  { to: '/admin/banners',    icon: Image,           label: 'Banners' },
  { to: '/admin/products',   icon: Package,         label: 'Products' },
  { to: '/admin/categories', icon: FolderTree,      label: 'Categories' },
];

export default function PortalLayout({ role }: { role: UserRole }) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const links = role === 'VENDOR' ? VENDOR_LINKS : ADMIN_LINKS;

  const handleLogout = async () => {
    try {
      const rt = useAuthStore.getState().refreshToken;
      if (rt) await api.post('/auth/logout', { refreshToken: rt });
    } catch {
      // Keep logout resilient.
    }
    disconnectWebSocket();
    logout();
    navigate('/login');
  };

  const sidebar = (
    <SidebarContent
      role={role}
      user={user}
      links={links}
      onLogout={handleLogout}
      onNavigate={() => setMobileOpen(false)}
    />
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground dark:bg-background-dark dark:text-foreground-dark">
      <motion.aside
        className="hidden w-64 flex-shrink-0 border-r border-border bg-surface dark:border-border-dark dark:bg-surface-dark lg:flex"
        initial={{ x: -280 }}
        animate={{ x: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      >
        {sidebar}
      </motion.aside>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 flex w-72 border-r border-border bg-surface dark:border-border-dark dark:bg-surface-dark lg:hidden"
              variants={drawerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <button
                className="absolute right-3 top-3 rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" />
              </button>
              {sidebar}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface/80 px-4 backdrop-blur-md dark:border-border-dark dark:bg-surface-dark/80 lg:hidden">
          <button className="btn-ghost p-2" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold capitalize">{role.toLowerCase()} portal</span>
        </header>
        <main className="min-h-screen">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  role,
  user,
  links,
  onLogout,
  onNavigate,
}: {
  role: UserRole;
  user: ReturnType<typeof useAuthStore.getState>['user'];
  links: Array<{ to: string; icon: React.ElementType; label: string }>;
  onLogout: () => void;
  onNavigate: () => void;
}) {
  return (
    <div className="flex min-h-0 w-full flex-col">
      <div className="border-b border-border px-5 py-5 dark:border-border-dark">
        <span className="text-lg font-extrabold">
          <span className="font-brand text-xl">Apex<span className="bg-gradient-to-r from-accent-indigo to-accent-purple bg-clip-text text-transparent">HK</span></span>
        </span>
        <p className="mt-1 text-xs capitalize text-slate-500 dark:text-slate-400">{role.toLowerCase()} portal</p>
      </div>

      <motion.nav
        className="flex-1 space-y-1 overflow-y-auto px-3 py-4"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {links.map(({ to, icon: Icon, label }) => (
          <motion.div variants={listItem} key={to}>
            <NavLink
              to={to}
              end={to.endsWith('dashboard')}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'text-primary-700 dark:text-primary-300'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white'
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.div
                      layoutId="activeNavItem"
                      className="absolute inset-0 rounded-lg bg-primary-50 dark:bg-primary-500/10"
                      transition={{ type: 'spring', damping: 24, stiffness: 320 }}
                    />
                  )}
                  <Icon className={cn('relative h-4 w-4', isActive ? 'text-primary-600' : 'text-slate-400')} />
                  <span className="relative">{label}</span>
                  {isActive && <ChevronRight className="relative ml-auto h-3 w-3 text-primary-400" />}
                </>
              )}
            </NavLink>
          </motion.div>
        ))}
      </motion.nav>

      <div className="border-t border-border px-3 py-3 dark:border-border-dark">
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-2 dark:bg-white/5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-accent-indigo to-accent-purple text-xs font-semibold text-white">
            {user?.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user?.name}</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-error hover:bg-red-50 dark:hover:bg-red-500/10"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}
