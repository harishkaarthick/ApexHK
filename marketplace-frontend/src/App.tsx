import { Component, ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'react-hot-toast';

import { router } from '@/router';
import { useAuthStore } from '@/stores/authStore';
import { connectWebSocket, disconnectWebSocket } from '@/lib/websocket';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const savedTheme = window.localStorage.getItem('theme');
  return savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : 'dark';
}

function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem('theme', theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export default function App() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (user && accessToken) {
      connectWebSocket(accessToken);
    } else {
      disconnectWebSocket();
    }
  }, [user, accessToken]);

  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <RouterProvider router={router} />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              className:
                'border border-border bg-surface text-foreground shadow-card dark:border-border-dark dark:bg-surface-dark dark:text-foreground-dark',
              style: {
                borderRadius: '12px',
                fontSize: '14px',
                background: '#12121a',
                color: '#e2e8f0',
                border: '1px solid #1e1e2e',
              },
            }}
          />
        </ThemeProvider>
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('App error boundary caught an error', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground dark:bg-background-dark dark:text-foreground-dark">
        <div className="max-w-md rounded-lg border border-red-200 bg-surface p-6 shadow-card dark:border-red-900/60 dark:bg-surface-dark">
          <h1 className="text-lg font-semibold text-error">The app could not start</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Clear browser storage for this local site and refresh. The most likely cause is stale saved auth data.
          </p>
          <button
            className="btn-premium mt-4"
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
          >
            Clear local data and reload
          </button>
        </div>
      </main>
    );
  }
}
