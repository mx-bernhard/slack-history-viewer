import { QueryClient } from '@tanstack/react-query';

/**
 * Creates a new QueryClient instance with appropriate settings
 * Should be called for each request in SSR and once in the client
 */
export const createQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // SSR-friendly defaults
        staleTime: 1000 * 60, // 1 minute
        gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
        retry: 1,
      },
    },
  });
};
