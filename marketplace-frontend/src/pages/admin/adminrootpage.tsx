/**
 * ═══════════════════════════════════════════════════════════
 *  router-additions.tsx
 *  Paste this route into the admin children array in
 *  src/router/index.tsx
 * ═══════════════════════════════════════════════════════════
 */

// 1. Add the import near the other admin lazy imports:
//
//    const AdminProductsPage = lazy(
//      () => import('@/pages/admin/AdminProductsPage')
//        .then(m => ({ default: m.AdminProductsPage }))
//    );
//
//    — or if AdminPages.tsx re-exports it, use:
//
//    const AdminProductsPage = lazy(
//      () => import('@/pages/admin/AdminPages')
//        .then(m => ({ default: m.AdminProductsPage }))
//    );
//
// 2. Add the route inside the admin children array:
//
//    { path: '/admin/products', element: lazyElement(AdminProductsPage) },
//
// The complete admin children block becomes:
//
//  {
//    element: <ProtectedRoute role="ADMIN" />,
//    children: [
//      {
//        element: <PortalLayout role="ADMIN" />,
//        children: [
//          { path: '/admin/dashboard',  element: lazyElement(AdminDashboardPage) },
//          { path: '/admin/vendors',    element: lazyElement(AdminVendorsPage) },
//          { path: '/admin/users',      element: lazyElement(AdminUsersPage) },
//          { path: '/admin/coupons',    element: lazyElement(AdminCouponsPage) },
//          { path: '/admin/banners',    element: lazyElement(AdminBannersPage) },
//          { path: '/admin/orders',     element: lazyElement(AdminOrdersPage) },
//          { path: '/admin/products',   element: lazyElement(AdminProductsPage) },  // ← NEW
//        ],
//      },
//    ],
//  }


/**
 * ═══════════════════════════════════════════════════════════
 *  PortalLayout additions
 *  In src/components/PortalLayout.tsx (or wherever
 *  PortalLayout is defined), add the Products nav item
 *  to the ADMIN navItems array.
 * ═══════════════════════════════════════════════════════════
 */

// Find the ADMIN nav items array (usually looks like):
//
//  const adminNav = [
//    { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
//    { to: '/admin/vendors',   label: 'Vendors',   icon: Store           },
//    { to: '/admin/users',     label: 'Users',     icon: Users           },
//    { to: '/admin/orders',    label: 'Orders',    icon: ShoppingBag     },
//    { to: '/admin/coupons',   label: 'Coupons',   icon: Tag             },
//    { to: '/admin/banners',   label: 'Banners',   icon: Image           },
//  ];
//
// Add after the Banners entry:
//
//    { to: '/admin/products', label: 'Products', icon: Package },
//
// Make sure `Package` is imported from 'lucide-react'.

export {};  // keeps TypeScript happy — this file is instructions only