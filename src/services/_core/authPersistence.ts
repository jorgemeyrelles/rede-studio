import type { AuthDocument } from '../../features/auth/types';
import { decodeFromStorage, encodeForStorage } from './obfuscation';

const AUTH_STORAGE_KEY = 'rede-sp-cwb-auth-v1';

const EMPTY_DOCUMENT: AuthDocument = {
  token: null,
};

/**
 * Decodifica o formato ofuscado (Fase 5); se falhar, tenta o JSON em texto
 * plano de antes dessa mudança — migração transparente (o próximo
 * `saveAuthToken` já regrava já ofuscado).
 */
function parseStoredDocument(raw: string): Partial<AuthDocument> | null {
  try {
    return decodeFromStorage<Partial<AuthDocument>>(raw);
  } catch {
    try {
      return JSON.parse(raw) as Partial<AuthDocument>;
    } catch {
      return null;
    }
  }
}

function loadAuthDocument(): AuthDocument {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return { ...EMPTY_DOCUMENT };
    const parsed = parseStoredDocument(raw);
    return {
      token: typeof parsed?.token === 'string' ? parsed.token : null,
    };
  } catch {
    return { ...EMPTY_DOCUMENT };
  }
}

/** Lê o JWT persistido, se houver sessão salva. */
export function getAuthToken(): string | null {
  return loadAuthDocument().token;
}

export function saveAuthToken(token: string): void {
  localStorage.setItem(AUTH_STORAGE_KEY, encodeForStorage({ token } satisfies AuthDocument));
}

export function clearAuthToken(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}
