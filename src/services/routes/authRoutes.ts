import type {
    AuthErrorCode,
    LoginInput,
    OAuthProvider,
    PublicUser,
    RegisterInput,
    UpdateUserProfileInput,
} from '../../features/auth/types';
import type { AppLanguage } from '../../types/i18n';
import { DEFAULT_LANGUAGE } from '../../types/i18n';
import {
    clearAuthToken,
    getAuthToken,
    saveAuthToken,
} from '../_core/authPersistence';
import { ApiError, httpGet, httpPatch, httpPost } from '../_core/httpClient';

type AuthResult =
  | { ok: true; user: PublicUser }
  | { ok: false; error: AuthErrorCode };

/**
 * Corpo retornado por POST /api/auth/register e /api/auth/login. Já traz
 * id/preferredLanguage/createdAt — o suficiente pra montar o PublicUser
 * sem um GET /me logo em seguida, que no caso do registro correria contra
 * o consumer assíncrono da fila (o documento pode ainda não existir no
 * Mongo nesse instante — ver AuthService#register no backend) e voltaria
 * 404. Um e-mail próprio não vem aqui (o token já é o suficiente pra tudo
 * mais), mas guardamos ele à parte pra montar o PublicUser mesmo assim.
 */
type AuthTokenResponse = {
  token: string;
  tokenType: string;
  expiresIn: number;
  id: string;
  username: string;
  roles: string[];
  preferredLanguage: string;
  createdAt: string;
};

/** Corpo retornado por GET/PATCH /api/users/me. */
type UserProfileResponse = {
  id: string;
  username: string;
  email: string;
  roles: string[];
  active: boolean;
  preferredLanguage: string;
  createdAt: string;
  updatedAt: string;
};

function toPublicUser(user: UserProfileResponse): PublicUser {
  return {
    id: user.id,
    name: user.username,
    email: user.email,
    preferredLanguage: (user.preferredLanguage as AppLanguage) || DEFAULT_LANGUAGE,
    createdAt: user.createdAt,
  };
}

function authResponseToPublicUser(auth: AuthTokenResponse, email: string): PublicUser {
  return {
    id: auth.id,
    name: auth.username,
    email,
    preferredLanguage: (auth.preferredLanguage as AppLanguage) || DEFAULT_LANGUAGE,
    createdAt: auth.createdAt,
  };
}

/** Mapeia o `ApiError` (status HTTP da rede-studio-api) pro AuthErrorCode já usado na UI. */
function mapAuthError(err: unknown, fallback: AuthErrorCode): AuthErrorCode {
  if (err instanceof ApiError) {
    if (err.status === 409) return 'EMAIL_TAKEN';
    if (err.status === 401) return 'INVALID_CREDENTIALS';
    if (err.status === 404) return 'USER_NOT_FOUND';
    if (err.status === 400) return 'VALIDATION_ERROR';
  }
  return fallback;
}

/** Busca o perfil completo do usuário autenticado — usado logo após login/registro. */
function fetchCurrentUser(): Promise<PublicUser> {
  return httpGet<UserProfileResponse>('/api/users/me').then(toPublicUser);
}

export async function getPersistedSession(): Promise<PublicUser | null> {
  if (!getAuthToken()) return null;

  try {
    return await fetchCurrentUser();
  } catch (err) {
    if (err instanceof ApiError && err.isUnauthorized) {
      clearAuthToken();
    }
    return null;
  }
}

export async function registerUser(input: RegisterInput): Promise<AuthResult> {
  try {
    const email = input.email.trim().toLowerCase();
    const auth = await httpPost<AuthTokenResponse>('/api/auth/register', {
      body: {
        username: input.name.trim(),
        email,
        password: input.password,
      },
    });
    saveAuthToken(auth.token);
    return { ok: true, user: authResponseToPublicUser(auth, email) };
  } catch (err) {
    return { ok: false, error: mapAuthError(err, 'EMAIL_TAKEN') };
  }
}

export async function loginUser(input: LoginInput): Promise<AuthResult> {
  try {
    const email = input.email.trim().toLowerCase();
    const auth = await httpPost<AuthTokenResponse>('/api/auth/login', {
      body: {
        email,
        password: input.password,
      },
    });
    saveAuthToken(auth.token);
    return { ok: true, user: authResponseToPublicUser(auth, email) };
  } catch (err) {
    return { ok: false, error: mapAuthError(err, 'INVALID_CREDENTIALS') };
  }
}

/**
 * Decodifica (sem verificar assinatura) o payload de um JWT pra extrair um
 * email de exibição imediata — a fonte da verdade é sempre o backend, que
 * valida o token de verdade; isso só evita mais um round-trip antes de
 * montar o `PublicUser` (mesmo espírito do `email` que login/registro já
 * recebem do próprio input do formulário).
 */
function decodeEmailFromIdToken(idToken: string): string {
  try {
    const payload = idToken.split('.')[1] ?? '';
    const decoded = JSON.parse(
      atob(payload.replace(/-/g, '+').replace(/_/g, '/')),
    ) as { email?: string; preferred_username?: string };
    return decoded.email ?? decoded.preferred_username ?? '';
  } catch {
    return '';
  }
}

export async function loginWithOAuth(
  provider: OAuthProvider,
  idToken: string,
): Promise<AuthResult> {
  try {
    const auth = await httpPost<AuthTokenResponse>(`/api/auth/oauth/${provider}`, {
      body: { idToken },
    });
    saveAuthToken(auth.token);
    return { ok: true, user: authResponseToPublicUser(auth, decodeEmailFromIdToken(idToken)) };
  } catch (err) {
    // 409 = alguém já está registrando esse e-mail agora (corrida rara);
    // qualquer outra falha (token inválido, provider fora do ar) é genérica.
    const code: AuthErrorCode =
      err instanceof ApiError && err.status === 409 ? 'EMAIL_TAKEN' : 'OAUTH_FAILED';
    return { ok: false, error: code };
  }
}

export async function logoutSession(): Promise<void> {
  // JWT é stateless — não existe endpoint de logout no backend, só limpa localmente.
  clearAuthToken();
}

export async function updateUserProfile(
  changes: UpdateUserProfileInput,
): Promise<AuthResult> {
  try {
    const updated = await httpPatch<UserProfileResponse>('/api/users/me', {
      body: {
        username: changes.name?.trim(),
        preferredLanguage: changes.preferredLanguage,
      },
    });
    return { ok: true, user: toPublicUser(updated) };
  } catch (err) {
    return { ok: false, error: mapAuthError(err, 'GENERIC') };
  }
}

export const authRoutes = {
  getPersistedSession,
  registerUser,
  loginUser,
  loginWithOAuth,
  logoutSession,
  updateUserProfile,
};
