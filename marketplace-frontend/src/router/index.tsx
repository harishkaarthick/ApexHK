import { lazy, Suspense, useEffect, type ComponentType, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types';
import toast from 'react-hot-toast';
import { pageVariants } from '@/lib/motion';

// ─── Layouts ─────────────────────────────────────────────────────────────────
import MainLayout    from '@/components/layout/MainLayout';
import PortalLayout  from '@/components/layout/PortalLayout';

// ─── Public pages ─────────────────────────────────────────────────────────────
const HomePage          = lazy(() => import('@/pages/public/HomePage'));
const ProductsPage      = lazy(() => import('@/pages/public/ProductsPage'));
const ProductDetailPage = lazy(() => import('@/pages/public/ProductDetailPage'));
const SearchPage        = lazy(() => import('@/pages/public/SearchPage'));
const CategoryPage      = lazy(() => import('@/pages/public/CategoryPage'));

// ─── Auth pages ───────────────────────────────────────────────────────────────
const LoginPage       = lazy(() => import('@/pages/auth/LoginPage'));
const RegisterPage    = lazy(() => import('@/pages/auth/RegisterPage'));
const VerifyEmailPage = lazy(() => import('@/pages/auth/VerifyEmailPage'));

// ─── Customer pages ───────────────────────────────────────────────────────────
const CartPage        = lazy(() => import('@/pages/customer/CartPage'));
const CheckoutPage    = lazy(() => import('@/pages/customer/CheckoutPage'));
const OrdersPage      = lazy(() => import('@/pages/customer/OrdersPage'));
const OrderDetailPage = lazy(() => import('@/pages/customer/OrderDetailPage'));
const WalletPage      = lazy(() => import('@/pages/customer/WalletPage'));
const ProfilePage     = lazy(() => import('@/pages/customer/ProfilePage'));
const ReturnsPage     = lazy(() => import('@/pages/customer/ReturnsPage'));
const ReturnDetailsPage = lazy(() =>
  import('@/pages/customer/ReturnDetailsPage').then(m => ({ default: m.ReturnDetailsPage }))
);

// ─── Vendor pages ─────────────────────────────────────────────────────────────
const VendorDashboardPage    = lazy(() => import('@/pages/vendor/VendorDashboardPage'));
const VendorProductsPage     = lazy(() => import('@/pages/vendor/VendorProductsPage'));
const VendorProductNewPage   = lazy(() => import('@/pages/vendor/VendorProductNewPage'));
const VendorProductEditPage  = lazy(() => import('@/pages/vendor/VendorProductEditPage'));
const VendorOrdersPage       = lazy(() => import('@/pages/vendor/VendorOrdersPage'));
const VendorReturnsPage      = lazy(() => import('@/pages/vendor/VendorReturnsPage'));
const VendorEarningsPage     = lazy(() => import('@/pages/vendor/VendorEarningsPage'));
// NEW ↓
const VendorSubscriptionPage = lazy(() => import('@/pages/vendor/VendorSubscriptionPage'));

// ─── Admin pages ──────────────────────────────────────────────────────────────
const AdminDashboardPage = lazy(() =>
  import('@/pages/admin/AdminDashboardPage').then(m => ({ default: m.AdminDashboardPage }))
);
const AdminVendorsPage   = lazy(() =>
  import('@/pages/admin/AdminVendorsPage').then(m => ({ default: m.AdminVendorsPage }))
);
const AdminUsersPage     = lazy(() =>
  import('@/pages/admin/AdminUsersPage').then(m => ({ default: m.AdminUsersPage }))
);
const AdminCouponsPage   = lazy(() =>
  import('@/pages/admin/AdminCouponsPage').then(m => ({ default: m.AdminCouponsPage }))
);
const AdminBannersPage   = lazy(() =>
  import('@/pages/admin/AdminBannersPage').then(m => ({ default: m.AdminBannersPage }))
);
const AdminOrdersPage    = lazy(() =>
  import('@/pages/admin/AdminOrdersPage').then(m => ({ default: m.AdminOrdersPage }))
);
const AdminPayoutsPage   = lazy(() =>
  import('@/pages/admin/AdminPayoutsPage').then(m => ({ default: m.AdminPayoutsPage }))
);
const AdminProductsPage  = lazy(() =>
  import('@/pages/admin/AdminPages').then(m => ({ default: m.AdminProductsPage }))
);
const AdminCategoriesPage  = lazy(() =>
  import('@/pages/admin/AdminPages').then(m => ({ default: m.AdminCategoriesPage }))
);
const AdminReturnsDashboard = lazy(() =>
  import('@/pages/admin/AdminReturnsDashboard').then(m => ({ default: m.AdminReturnsDashboard }))
);

export function lazyElement(Component: ComponentType) {
  return (
    <PageTransition>
      <Suspense fallback={<div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">Loading...</div>}>
        <Component />
      </Suspense>
    </PageTransition>
  );
}

function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ProtectedRoute
// ─────────────────────────────────────────────────────────────────────────────
export function ProtectedRoute({ role }: { role?: UserRole }) {
  const user = useAuthStore((s) => s.user);
  const denied = Boolean(role && user && user.role !== role);

  useEffect(() => {
    if (denied) {
      toast.error("You don't have permission to access that page.");
    }
  }, [denied]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (denied) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────────────────────────
export const router = createBrowserRouter([
  // ── Public (with main layout) ──────────────────────────────────────────────
  {
    element: <MainLayout />,
    children: [
      { path: '/',                element: lazyElement(HomePage) },
      { path: '/products',        element: lazyElement(ProductsPage) },
      { path: '/products/:id',    element: lazyElement(ProductDetailPage) },
      { path: '/search',          element: lazyElement(SearchPage) },
      { path: '/category/:category', element: lazyElement(CategoryPage) },
    ],
  },

  // ── Auth (no layout chrome) ────────────────────────────────────────────────
  { path: '/login',        element: lazyElement(LoginPage) },
  { path: '/register',     element: lazyElement(RegisterPage) },
  { path: '/verify-email', element: lazyElement(VerifyEmailPage) },

  // ── Customer (protected) ──────────────────────────────────────────────────
  {
    element: <MainLayout />,
    children: [
      {
        element: <ProtectedRoute role="CUSTOMER" />,
        children: [
          { path: '/cart',                  element: lazyElement(CartPage) },
          { path: '/checkout',              element: lazyElement(CheckoutPage) },
          { path: '/account/orders',        element: lazyElement(OrdersPage) },
          { path: '/account/orders/:id',    element: lazyElement(OrderDetailPage) },
          { path: '/account/wallet',        element: lazyElement(WalletPage) },
          { path: '/account/profile',       element: lazyElement(ProfilePage) },
          { path: '/account/returns',       element: lazyElement(ReturnsPage) },
          { path: '/account/returns/:id',   element: lazyElement(ReturnDetailsPage) },
        ],
      },
    ],
  },

  // ── Vendor portal (protected + sidebar) ───────────────────────────────────
  {
    element: <ProtectedRoute role="VENDOR" />,
    children: [
      {
        element: <PortalLayout role="VENDOR" />,
        children: [
          { path: '/vendor/dashboard',          element: lazyElement(VendorDashboardPage) },
          { path: '/vendor/products',           element: lazyElement(VendorProductsPage) },
          { path: '/vendor/products/new',       element: lazyElement(VendorProductNewPage) },
          { path: '/vendor/products/:id/edit',  element: lazyElement(VendorProductEditPage) },
          { path: '/vendor/orders',             element: lazyElement(VendorOrdersPage) },
          { path: '/vendor/returns',            element: lazyElement(VendorReturnsPage) },
          { path: '/vendor/returns/:id',        element: lazyElement(VendorReturnsPage) },
          { path: '/vendor/earnings',           element: lazyElement(VendorEarningsPage) },
          // NEW ↓
          { path: '/vendor/subscription',       element: lazyElement(VendorSubscriptionPage) },
        ],
      },
    ],
  },

  // ── Admin portal (protected + sidebar) ────────────────────────────────────
  {
    element: <ProtectedRoute role="ADMIN" />,
    children: [
      {
        element: <PortalLayout role="ADMIN" />,
        children: [
          { path: '/admin/dashboard', element: lazyElement(AdminDashboardPage) },
          { path: '/admin/vendors',   element: lazyElement(AdminVendorsPage) },
          { path: '/admin/users',     element: lazyElement(AdminUsersPage) },
          { path: '/admin/coupons',   element: lazyElement(AdminCouponsPage) },
          { path: '/admin/banners',   element: lazyElement(AdminBannersPage) },
          { path: '/admin/orders',    element: lazyElement(AdminOrdersPage) },
          { path: '/admin/payouts',   element: lazyElement(AdminPayoutsPage) },
          { path: '/admin/products',  element: lazyElement(AdminProductsPage) },
          { path: '/admin/categories', element: lazyElement(AdminCategoriesPage) },
          { path: '/admin/returns',   element: lazyElement(AdminReturnsDashboard) },
        ],
      },
    ],
  },

  // ── Catch-all ─────────────────────────────────────────────────────────────
  { path: '*', element: <Navigate to="/" replace /> },
]);
