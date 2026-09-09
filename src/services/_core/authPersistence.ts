import type { AuthDocument } from '../../features/auth/types';

const AUTH_STORAGE_KEY = 'rede-sp-cwb-auth-v1';

const EMPTY_DOCUMENT: AuthDocument = {
  token: null,
};

function loadAuthDocument(): AuthDocument {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return { ...EMPTY_DOCUMENT };
    const parsed = JSON.parse(raw) as Partial<AuthDocument>;
    return { token: typeof parsed.token === 'string' ? parsed.token : null };
  } catch {
    return { ...EMPTY_DOCUMENT };
  }
}

/** Lê o JWT persistido, se houver sessão salva. */
export function getAuthToken(): string | null {
  return loadAuthDocument().token;
}

export function saveAuthToken(token: string): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token } satisfies AuthDocument));
}

export function clearAuthToken(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}
