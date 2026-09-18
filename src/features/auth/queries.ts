import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { identifyClarityUser } from '../../services/observability/clarity';
import { authRoutes } from '../../services/routes/authRoutes';
import type {
    LoginInput,
    OAuthProvider,
    PublicUser,
    RegisterInput,
    UpdateUserProfileInput,
} from './types';

export const SESSION_QUERY_KEY = ['session'] as const;

/**
 * Sessão do usuário — fonte da verdade é `GET /api/users/me` (rede-studio-api),
 * validado contra o JWT em `authPersistence`. `staleTime: Infinity` porque a
 * sessão só muda via mutation explícita (login/registro/OAuth/logout/update
 * de perfil, que escrevem direto no cache abaixo) — não faz sentido refazer
 * essa checagem sozinha em background/refocus.
 */
export function useSessionQuery() {
  return useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: async () => {
      const user = await authRoutes.getPersistedSession();
      // Identifica a sessão do Clarity aqui (não em `onSuccess`, que o
      // `useQuery` não tem mais na v5) — roda 1x por carga de página
      // (React Query cacheia com `staleTime: Infinity` abaixo), igual ao
      // antigo `hydrateSession.fulfilled` do Redux.
      if (user) identifyClarityUser(user.email);
      return user;
    },
    staleTime: Infinity,
  });
}

function useApplySession() {
  const queryClient = useQueryClient();
  return (user: PublicUser) => {
    queryClient.setQueryData(SESSION_QUERY_KEY, user);
    identifyClarityUser(user.email);
  };
}

export function useRegisterMutation() {
  const applySession = useApplySession();
  return useMutation({
    mutationFn: (input: RegisterInput) => authRoutes.registerUser(input),
    onSuccess: (result) => {
      if (result.ok) applySession(result.user);
    },
  });
}

export function useLoginMutation() {
  const applySession = useApplySession();
  return useMutation({
    mutationFn: (input: LoginInput) => authRoutes.loginUser(input),
    onSuccess: (result) => {
      if (result.ok) applySession(result.user);
    },
  });
}

export function useOAuthLoginMutation() {
  const applySession = useApplySession();
  return useMutation({
    mutationFn: ({
      provider,
      idToken,
    }: {
      provider: OAuthProvider;
      idToken: string;
    }) => authRoutes.loginWithOAuth(provider, idToken),
    onSuccess: (result) => {
      if (result.ok) applySession(result.user);
    },
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authRoutes.logoutSession(),
    onSuccess: () => {
      queryClient.setQueryData(SESSION_QUERY_KEY, null);
    },
  });
}

export function useUpdateProfileMutation() {
  const applySession = useApplySession();
  return useMutation({
    mutationFn: (changes: UpdateUserProfileInput) =>
      authRoutes.updateUserProfile(changes),
    onSuccess: (result) => {
      if (result.ok) applySession(result.user);
    },
  });
}
