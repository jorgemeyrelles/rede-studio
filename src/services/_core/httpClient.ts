import { getAuthToken } from './authPersistence';

/**
 * Wrapper fino sobre `fetch` — camada de conexão HTTP com a
 * `rede-studio-api`, usada por `authRoutes.ts`/`projectsRoutes.ts`.
 */

/** Corpo de erro padronizado retornado pela API em toda resposta não-ok. */
export type ErrorResponse = {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  path: string;
};

/**
 * Erro tipado lançado quando a resposta HTTP não é ok. As camadas de rota
 * (auth/projects, ainda mockadas nesta fase) vão mapear `status`/`error`
 * pros `AuthErrorCode`/erros de projeto já existentes.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly error: string;
  readonly path: string;
  readonly timestamp: string;
  /** Atalho pra 401 — quem chamar decide o que fazer (logout, etc). */
  readonly isUnauthorized: boolean;

  constructor(response: ErrorResponse) {
    super(response.message || response.error || 'Erro na comunicação com a API.');
    this.name = 'ApiError';
    this.status = response.status;
    this.error = response.error;
    this.path = response.path;
    this.timestamp = response.timestamp;
    this.isUnauthorized = response.status === 401;
  }
}

async function toErrorResponse(response: Response): Promise<ErrorResponse> {
  try {
    const data = (await response.json()) as Partial<ErrorResponse>;
    if (
      data &&
      typeof data === 'object' &&
      typeof data.status === 'number' &&
      typeof data.message === 'string'
    ) {
      return {
        timestamp: data.timestamp ?? new Date().toISOString(),
        status: data.status,
        error: data.error ?? response.statusText ?? 'ERROR',
        message: data.message,
        path: data.path ?? response.url,
      };
    }
  } catch {
    // corpo ausente ou não-JSON — cai no fallback abaixo
  }

  return {
    timestamp: new Date().toISOString(),
    status: response.status,
    error: response.statusText || 'ERROR',
    message: 'Não foi possível interpretar a resposta de erro da API.',
    path: response.url,
  };
}

export type RequestOptions = {
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

async function request<T>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { ...options.headers };

  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}${path}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  if (!response.ok) {
    throw new ApiError(await toErrorResponse(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function httpGet<T>(path: string, options?: RequestOptions): Promise<T> {
  return request<T>('GET', path, options);
}

export function httpPost<T>(path: string, options?: RequestOptions): Promise<T> {
  return request<T>('POST', path, options);
}

export function httpPatch<T>(path: string, options?: RequestOptions): Promise<T> {
  return request<T>('PATCH', path, options);
}

export function httpPut<T>(path: string, options?: RequestOptions): Promise<T> {
  return request<T>('PUT', path, options);
}

export function httpDelete<T>(path: string, options?: RequestOptions): Promise<T> {
  return request<T>('DELETE', path, options);
}
