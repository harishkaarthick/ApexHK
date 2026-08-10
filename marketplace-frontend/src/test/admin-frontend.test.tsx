import React, { Suspense, lazy } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { AppErrorBoundary } from '@/App';
import { ProtectedRoute } from '@/router';
import api from '@/lib/axios';
import { useAuthStore } from '@/stores/authStore';
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage';
import { AdminVendorsPage } from '@/pages/admin/AdminVendorsPage';
import { AdminUsersPage } from '@/pages/admin/AdminUsersPage';
import { AdminOrdersPage } from '@/pages/admin/AdminOrdersPage';
import { AdminCouponsPage } from '@/pages/admin/AdminCouponsPage';
import { AdminBannersPage } from '@/pages/admin/AdminBannersPage';
import { AdminProductsPage } from '@/pages/admin/AdminPages';

vi.mock('@/lib/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/lib/websocket', () => ({
  connectWebSocket: vi.fn(),
  disconnectWebSocket: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
  Toaster: () => null,
}));

const adminUser = {
  id: 'admin-1',
  name: 'Admin',
  email: 'admin@example.com',
  role: 'ADMIN' as const,
  vendorId: null,
};

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={makeClient()}>
      {ui}
    </QueryClientProvider>,
  );
}

function mockAdminApi() {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/admin/stats') {
      return Promise.resolve({
        data: {
          success: true,
          data: {
            totalUsers: 10,
            totalVendors: 5,
            pendingVendors: 2,
            totalOrders: 20,
            totalRevenue: 5000,
            totalProducts: 50,
          },
        },
      });
    }

    if (url === '/admin/orders') {
      return Promise.resolve({
        data: {
          success: true,
          data: {
            content: [
              order('order-0001', 120, 'PENDING', '2026-06-01T10:00:00'),
              order('order-0002', 240, 'DELIVERED', '2026-06-02T10:00:00'),
              order('order-0003', 360, 'CANCELLED', '2026-06-03T10:00:00'),
            ],
            totalPages: 1,
            totalElements: 3,
            number: 0,
            size: 5,
          },
        },
      });
    }

    if (url === '/admin/users') {
      return Promise.resolve({ data: { success: true, data: { content: [], totalPages: 0, totalElements: 0, number: 0, size: 20 } } });
    }

    if (url === '/admin/products') {
      return Promise.resolve({ data: { success: true, data: { content: [], totalPages: 0, totalElements: 0, number: 0, size: 20 } } });
    }

    if (url === '/admin/coupons') {
      return Promise.resolve({ data: { success: true, data: [] } });
    }

    if (url === '/public/banners') {
      return Promise.resolve({ data: { success: true, data: [] } });
    }

    if (url === '/admin/vendors' || url === '/admin/vendors/pending') {
      return Promise.resolve({ data: { success: true, data: [] } });
    }

    return Promise.resolve({ data: { success: true, data: [] } });
  });
}

function order(id: string, total: number, status: string, placedAt: string) {
  return {
    id,
    items: [{ productId: 'p1', productName: 'Widget', quantity: 1, price: total, imageUrl: '', vendorName: 'Vendor', vendorId: 'v1' }],
    total,
    totalAmount: total,
    status,
    placedAt,
    createdAt: placedAt,
    updatedAt: placedAt,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useAuthStore.setState({ user: adminUser, accessToken: 'token', refreshToken: 'refresh' });
  mockAdminApi();
});

describe('lazy import resolution', () => {
  const modules = [
    () => import('@/pages/admin/AdminDashboardPage'),
    () => import('@/pages/admin/AdminVendorsPage'),
    () => import('@/pages/admin/AdminUsersPage'),
    () => import('@/pages/admin/AdminOrdersPage'),
    () => import('@/pages/admin/AdminCouponsPage'),
    () => import('@/pages/admin/AdminBannersPage'),
    () => import('@/pages/admin/AdminProductPage'),
    () => import('@/pages/admin/AdminPages'),
  ];

  it('dynamically imports every admin page module', async () => {
    await expect(Promise.all(modules.map((load) => load()))).resolves.toHaveLength(modules.length);
  });

  it('renders each lazy admin component inside Suspense without a fetch-module failure', async () => {
    const components = [
      lazy(() => import('@/pages/admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage }))),
      lazy(() => import('@/pages/admin/AdminVendorsPage').then((m) => ({ default: m.AdminVendorsPage }))),
      lazy(() => import('@/pages/admin/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage }))),
      lazy(() => import('@/pages/admin/AdminOrdersPage').then((m) => ({ default: m.AdminOrdersPage }))),
      lazy(() => import('@/pages/admin/AdminCouponsPage').then((m) => ({ default: m.AdminCouponsPage }))),
      lazy(() => import('@/pages/admin/AdminBannersPage').then((m) => ({ default: m.AdminBannersPage }))),
      lazy(() => import('@/pages/admin/AdminPages').then((m) => ({ default: m.AdminProductsPage }))),
    ];

    renderWithProviders(
      <>
        {components.map((Component, index) => (
          <Suspense key={index} fallback={<span>Loading</span>}>
            <Component />
          </Suspense>
        ))}
      </>,
    );

    await waitFor(() => expect(screen.queryByText(/Failed to fetch dynamically imported module/i)).not.toBeInTheDocument());
  });
});

describe('router navigation', () => {
  const routes = [
    ['/admin/dashboard', 'Dashboard'],
    ['/admin/vendors', 'Vendors'],
    ['/admin/users', 'Users'],
    ['/admin/orders', 'Orders'],
    ['/admin/coupons', 'Coupons'],
    ['/admin/banners', 'Banners'],
    ['/admin/products', 'Products'],
  ] as const;

  function AdminRoutes({ initialPath }: { initialPath: string }) {
    return (
      <QueryClientProvider client={makeClient()}>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route element={<ProtectedRoute role="ADMIN" />}>
              <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
              <Route path="/admin/vendors" element={<AdminVendorsPage />} />
              <Route path="/admin/users" element={<AdminUsersPage />} />
              <Route path="/admin/orders" element={<AdminOrdersPage />} />
              <Route path="/admin/coupons" element={<AdminCouponsPage />} />
              <Route path="/admin/banners" element={<AdminBannersPage />} />
              <Route path="/admin/products" element={<AdminProductsPage />} />
            </Route>
            <Route path="/login" element={<h1>Login</h1>} />
            <Route path="/" element={<h1>Home</h1>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  it.each(routes)('renders %s for an admin user', async (path, title) => {
    render(
      <Suspense fallback={<span>Loading</span>}>
        <AdminRoutes initialPath={path} />
      </Suspense>,
    );

    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.queryByText(/Failed to fetch/i)).not.toBeInTheDocument();
  });

  it('redirects an unauthenticated user to login', async () => {
    useAuthStore.setState({ user: null, accessToken: null, refreshToken: null });
    render(<AdminRoutes initialPath="/admin/dashboard" />);
    expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument();
  });

  it('redirects a customer user to home', async () => {
    useAuthStore.setState({ user: { ...adminUser, role: 'CUSTOMER' }, accessToken: 'token', refreshToken: 'refresh' });
    render(<AdminRoutes initialPath="/admin/dashboard" />);
    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
  });
});

describe('suspense and error boundary', () => {
  it('renders the app error fallback when a lazy import rejects', async () => {
    const Broken = lazy(() => Promise.reject(new Error('network failure')));

    render(
      <AppErrorBoundary>
        <Suspense fallback={<span>Loading</span>}>
          <Broken />
        </Suspense>
      </AppErrorBoundary>,
    );

    expect(await screen.findByText('The app could not start')).toBeInTheDocument();
  });
});

describe('admin dashboard page', () => {
  it('renders the six stat cards with values from GET /admin/stats', async () => {
    const { AdminDashboardPage } = await import('@/pages/admin/AdminDashboardPage');
    renderWithProviders(<AdminDashboardPage />);

    expect(await screen.findByText('Total users')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('Total vendors')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Pending vendors')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Total orders')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('Total revenue')).toBeInTheDocument();
    expect(screen.getByText(/5,000/)).toBeInTheDocument();
    expect(screen.getByText('Total products')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it('shows the stats error message when GET /admin/stats fails', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/admin/stats') return Promise.reject(new Error('network'));
      return Promise.resolve({ data: { success: true, data: { content: [], totalPages: 0, totalElements: 0, number: 0, size: 5 } } });
    });
    const { AdminDashboardPage } = await import('@/pages/admin/AdminDashboardPage');
    renderWithProviders(<AdminDashboardPage />);

    expect(await screen.findByText('Failed to load stats.')).toBeInTheDocument();
  });

  it('renders three recent order rows with id, total, status, and date', async () => {
    const { AdminDashboardPage } = await import('@/pages/admin/AdminDashboardPage');
    renderWithProviders(<AdminDashboardPage />);

    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(4);
    expect(screen.getAllByText('#order-00')).toHaveLength(3);
    expect(screen.getByText(/120/)).toBeInTheDocument();
    expect(screen.getByText('PENDING')).toBeInTheDocument();
    expect(screen.getAllByText(/Jun 2026/)).toHaveLength(3);
  });

  it('shows the empty state when GET /admin/orders returns no content', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/admin/orders') {
        return Promise.resolve({ data: { success: true, data: { content: [], totalPages: 0, totalElements: 0, number: 0, size: 5 } } });
      }
      return Promise.resolve({ data: { success: true, data: { totalUsers: 0, totalVendors: 0, pendingVendors: 0, totalOrders: 0, totalRevenue: 0, totalProducts: 0 } } });
    });
    const { AdminDashboardPage } = await import('@/pages/admin/AdminDashboardPage');
    renderWithProviders(<AdminDashboardPage />);

    expect(await screen.findByText('No orders yet.')).toBeInTheDocument();
  });
});

describe('protected route unit', () => {
  function Harness({ initialPath = '/admin/dashboard' }: { initialPath?: string }) {
    return (
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route element={<ProtectedRoute role="ADMIN" />}>
            <Route path="/admin/dashboard" element={<h1>Admin child</h1>} />
          </Route>
          <Route path="/login" element={<h1>Login</h1>} />
          <Route path="/" element={<h1>Home</h1>} />
        </Routes>
      </MemoryRouter>
    );
  }

  it('renders children when user.role is ADMIN', async () => {
    render(<Harness />);
    expect(await screen.findByRole('heading', { name: 'Admin child' })).toBeInTheDocument();
  });

  it('redirects to home when user.role is CUSTOMER', async () => {
    useAuthStore.setState({ user: { ...adminUser, role: 'CUSTOMER' }, accessToken: 'token', refreshToken: 'refresh' });
    render(<Harness />);
    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
  });

  it('redirects to login when user is null', async () => {
    useAuthStore.setState({ user: null, accessToken: null, refreshToken: null });
    render(<Harness />);
    expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument();
  });
});
