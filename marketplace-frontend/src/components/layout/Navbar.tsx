import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell, ChevronDown, LayoutDashboard, LogOut, Moon, Package, RotateCcw,
  Search, ShoppingCart, Store, Sun, User, Wallet,
} from 'lucide-react';
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'framer-motion';
import { useAuthStore } from '@/stores/authStore';
import { useCartStore, useNotificationStore } from '@/stores';
import NotificationDropdown from '@/components/notifications/NotificationDropdown';
import { dropdownVariants } from '@/lib/motion';
import api from '@/lib/axios';
import { disconnectWebSocket } from '@/lib/websocket';
import { useTheme } from '@/App';
import { useCategories } from '@/lib/categories';
import type { PagedResponse, Product } from '@/types';

const unwrap = <T,>(res: { data: { data: T } }) => res.data.data;

export default function Navbar() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const itemCount = useCartStore((s) => s.itemCount);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const { theme, toggleTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestedProducts, setSuggestedProducts] = useState<Product[]>([]);
  const [showSearchMenu, setShowSearchMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { data: categories = [] } = useCategories();
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLFormElement>(null);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, 'change', (latest) => setScrolled(latest > 8));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setSuggestedProducts([]);
      setShowSearchMenu(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      api
        .get('/products/autocomplete', { params: { q }, signal: controller.signal })
        .then((res) => unwrap<PagedResponse<Product>>(res))
        .then((data) => {
          setSuggestions(data.suggestions ?? []);
          setSuggestedProducts(data.content ?? []);
          setShowSearchMenu(true);
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setSuggestions([]);
            setSuggestedProducts([]);
          }
        });
    }, 275);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    setShowSearchMenu(false);
    setSearchQuery('');
  };

  const runSearch = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
    setShowSearchMenu(false);
    setSearchQuery('');
  };

  const handleLogout = async () => {
    try {
      const rt = useAuthStore.getState().refreshToken;
      if (rt) await api.post('/auth/logout', { refreshToken: rt });
    } catch {
      // Local sign-out should still complete if the backend is unavailable.
    }
    disconnectWebSocket();
    logout();
    navigate('/login');
  };

  const portalLink =
    user?.role === 'VENDOR' ? '/vendor/dashboard' :
    user?.role === 'ADMIN' ? '/admin/dashboard' : null;

  return (
    <motion.header
      initial={{ y: -64, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className={`sticky top-0 z-40 border-b bg-white/80 backdrop-blur-md transition-shadow dark:bg-background-dark/80 ${
        scrolled ? 'border-border shadow-card dark:border-border-dark' : 'border-transparent'
      }`}
    >
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center gap-3 px-4 py-3 lg:flex-nowrap">
        <Link to="/" className="flex-shrink-0 text-foreground dark:text-white">
          <span className="font-brand text-2xl">Apex<span className="bg-gradient-to-r from-accent-indigo to-accent-purple bg-clip-text text-transparent">HK</span></span>
        </Link>

        <form ref={searchRef} onSubmit={handleSearch} className="order-3 flex w-full items-center lg:order-none lg:flex-1">
          <div className="relative w-full lg:mx-auto lg:max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (suggestions.length || suggestedProducts.length) setShowSearchMenu(true);
              }}
              className="input pl-9"
            />
            <AnimatePresence>
              {showSearchMenu && (suggestions.length > 0 || suggestedProducts.length > 0) && (
                <motion.div
                  variants={dropdownVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-lg border border-border bg-surface shadow-xl dark:border-border-dark dark:bg-surface-dark"
                >
                  {suggestions.slice(0, 5).map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => runSearch(suggestion)}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5"
                    >
                      <Search className="h-4 w-4 text-slate-400" />
                      <span className="truncate">{suggestion}</span>
                    </button>
                  ))}
                  {suggestedProducts.slice(0, 3).map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => runSearch(product.name)}
                      className="flex w-full items-center gap-3 border-t border-border/70 px-4 py-2 text-left hover:bg-slate-50 dark:border-border-dark dark:hover:bg-white/5"
                    >
                      <img
                        src={product.imageUrls?.[0] || 'https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?q=80&w=120&auto=format&fit=crop'}
                        alt=""
                        className="h-9 w-9 rounded-md object-cover"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">{product.name}</span>
                        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{product.brand || product.category}</span>
                      </span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </form>

        <div className="ml-auto flex items-center gap-2">
          <motion.button
            onClick={toggleTheme}
            className="btn-ghost rounded-full p-2"
            aria-label="Toggle theme"
            whileTap={{ scale: 0.85 }}
          >
            <motion.div animate={{ rotate: theme === 'dark' ? 180 : 0 }}>
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </motion.div>
          </motion.button>

          {(!user || user.role === 'CUSTOMER') && (
            <Link to="/cart" className="relative btn-premium rounded-full p-2" aria-label="Cart">
              <ShoppingCart className="h-5 w-5" />
              <AnimatePresence mode="wait">
                {itemCount > 0 && (
                  <motion.span
                    key={itemCount}
                    initial={{ y: 8, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -8, opacity: 0 }}
                    className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-bold text-accent-indigo"
                  >
                    {itemCount > 9 ? '9+' : itemCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          )}

          {user && (
            <div className="relative">
              <motion.button
                onClick={() => setShowNotifs((v) => !v)}
                className="relative btn-ghost rounded-full p-2"
                aria-label="Notifications"
                whileTap={{ scale: 0.94 }}
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <motion.span
                    className="absolute right-1 top-1 h-2 w-2 rounded-full bg-error"
                    animate={{ scale: [1, 1.4, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  />
                )}
              </motion.button>
              <AnimatePresence>
                {showNotifs && <NotificationDropdown onClose={() => setShowNotifs(false)} />}
              </AnimatePresence>
            </div>
          )}

          {user ? (
            <div className="relative" ref={userMenuRef}>
              <motion.button
                onClick={() => setShowUserMenu((v) => !v)}
                className="flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5"
                whileTap={{ scale: 0.96 }}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-r from-accent-indigo to-accent-purple text-xs font-semibold text-white">
                  {user.name.charAt(0).toUpperCase()}
                </span>
                <span className="hidden max-w-[100px] truncate sm:block">{user.name}</span>
                <ChevronDown className="h-3 w-3 text-slate-400" />
              </motion.button>

              <AnimatePresence>
                {showUserMenu && (
                  <motion.div
                    variants={dropdownVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="absolute right-0 mt-2 w-56 rounded-lg border border-border bg-surface py-1 shadow-xl dark:border-border-dark dark:bg-surface-dark"
                  >
                    <div className="border-b border-border px-4 py-3 dark:border-border-dark">
                      <p className="text-xs text-slate-500 dark:text-slate-400">{user.role}</p>
                      <p className="truncate text-sm font-semibold">{user.name}</p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                    </div>
                    {user.role === 'CUSTOMER' && (
                      <>
                        <MenuLink to="/account/profile" icon={User} label="Profile" />
                        <MenuLink to="/account/orders" icon={Package} label="My Orders" />
                        <MenuLink to="/account/wallet" icon={Wallet} label="Wallet" />
                        <MenuLink to="/account/returns" icon={RotateCcw} label="Returns" />
                      </>
                    )}
                    {portalLink && (
                      <MenuLink
                        to={portalLink}
                        icon={user.role === 'VENDOR' ? Store : LayoutDashboard}
                        label={user.role === 'VENDOR' ? 'Vendor Portal' : 'Admin Panel'}
                      />
                    )}
                    <div className="mt-1 border-t border-border pt-1 dark:border-border-dark">
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-error hover:bg-red-50 dark:hover:bg-red-500/10"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="btn-premium text-sm">Sign in</Link>
              <Link
                to="/login"
                state={{ adminQuickFill: true }}
                className="btn-premium text-sm flex items-center gap-1.5"
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[9px] font-bold text-white">
                  A
                </span>
                Admin
              </Link>
              <Link to="/register" className="btn-premium text-sm">Register</Link>
            </div>
          )}
        </div>
      </div>

      <nav className="border-t border-border/70 bg-white/60 dark:border-border-dark dark:bg-background-dark/60">
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-2 text-sm">
          {categories.map((cat) => (
            <motion.div key={cat.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}>
              <Link
                to={`/category/${encodeURIComponent(cat.name)}`}
                className="block whitespace-nowrap rounded-full px-3 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-primary-600 dark:text-slate-300 dark:hover:bg-white/5"
              >
                {cat.name}
              </Link>
            </motion.div>
          ))}
        </div>
      </nav>
    </motion.header>
  );
}

function MenuLink({ to, icon: Icon, label }: { to: string; icon: React.ElementType; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5"
    >
      <Icon className="h-4 w-4 text-slate-400" />
      {label}
    </Link>
  );
}
