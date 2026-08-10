import { QueryClient } from '@tanstack/react-query';

/**
 * Singleton QueryClient shared across the app.
 * Exported here so non-React modules (e.g. websocket.ts) can call
 * queryClient.invalidateQueries() without needing a hook.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60,      // 60 s — keeps the original behaviour
      refetchOnWindowFocus: false,
    },
  },
});
