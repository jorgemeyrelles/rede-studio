import type { AppLanguage } from '../../types/i18n';

/**
 * Perfil do usuário autenticado, montado a partir de `GET /api/users/me`
 * (rede-studio-api) — nunca inclui senha/hash.
 */
export type PublicUser = {
  id: string;
  name: string;
  email: string;
  preferredLanguage: AppLanguage;
  createdAt: string;
};

export type RegisterInput = {
  name: string;
  email: string;
  password: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type UpdateUserProfileInput = {
  name?: string;
  preferredLanguage?: AppLanguage;
};

export type AuthErrorCode =
  | 'EMAIL_TAKEN'
  | 'INVALID_CREDENTIALS'
  | 'USER_NOT_FOUND'
  | 'NOT_AUTHENTICATED'
  | 'VALIDATION_ERROR'
  | 'GENERIC';

/** Persistido em localStorage — só o JWT, nada de dados de usuário. */
export type AuthDocument = {
  token: string | null;
};

export type AuthState = {
  currentUser: PublicUser | null;
  status: 'idle' | 'loading';
  /** Código de erro, não texto — a tela traduz via getAuthErrorMessage(). */
  error: AuthErrorCode | null;
  /** Já tentamos hidratar a sessão do localStorage nesta carga de app? */
  initialized: boolean;
};
