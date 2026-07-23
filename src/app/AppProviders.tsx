import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type PropsWithChildren } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './AuthProvider';
import { ToastProvider } from '../components/ui/Toast';

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
  }));
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider><AuthProvider>{children}</AuthProvider></ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
