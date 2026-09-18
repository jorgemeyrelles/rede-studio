import { QueryClient } from '@tanstack/react-query';

/**
 * A maioria das rotas de serviço (`services/routes/*.ts`) já tem fallback
 * local próprio via `ApiError` (offline-first) — não faz sentido o React
 * Query insistir por cima disso com o retry padrão (3 tentativas).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});
