import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { SESSION_QUERY_KEY } from '../features/auth/queries';
import { clearAuthToken } from '../services/_core/authPersistence';
import { ApiError } from '../services/_core/httpClient';

/**
 * Handler global de sessão: só reage a 401 (token ausente ou expirado/
 * inválido pra API — a única coisa que `ApiError.isUnauthorized`
 * representa). Qualquer outro erro (rede fora, backend fora do ar, 404,
 * validação) segue o fallback local já existente em cada rota de serviço,
 * sem deslogar ninguém. Ao disparar: apaga o token de `localStorage` e
 * zera a sessão em cache — o que faz `RequireAuth`/`RequireGuest`
 * (`app/routing/`) reagirem na próxima renderização e mandarem o usuário
 * pra `/:lang/login` (a `LandingPage` com o modal de login por cima).
 */
function handleUnauthorized(error: unknown) {
  if (!(error instanceof ApiError) || !error.isUnauthorized) return;
  clearAuthToken();
  queryClient.setQueryData(SESSION_QUERY_KEY, null);
}

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
  queryCache: new QueryCache({ onError: handleUnauthorized }),
  mutationCache: new MutationCache({ onError: handleUnauthorized }),
});
