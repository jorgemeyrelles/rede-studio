import { cloudInitialState } from '../../features/cloud/cloudSlice';
import type { CloudState } from '../../features/cloud/types';
import { MAX_BYTES } from '../../features/network/constants';
import { networkInitialState } from '../../features/network/networkSlice';
import type { NetworkState } from '../../features/network/types';
import type {
  CreateProjectInput,
  ProjectNetworkType,
  ProjectRecord,
  ProjectsDocument,
  ProjectSummary,
} from '../../features/projects/types';
import type { StatePersistenceResult } from '../_core';
import {
  loadProjectsDocument,
  saveProjectsDocument,
} from '../_core/projectsPersistence';
import { loadStateDocument } from '../_core/statePersistence';
import {
  ApiError,
  httpDelete,
  httpGet,
  httpPatch,
  httpPost,
  httpPut,
} from '../_core/httpClient';

/** Corpo comum retornado pela rede-studio-api em POST/GET/PATCH/PUT de projeto. */
type ProjectSummaryResponse = {
  id: string;
  name: string;
  ownerId: string;
  networkType: ProjectNetworkType;
  createdAt: string;
  updatedAt: string;
};

type ProjectResponse = ProjectSummaryResponse & {
  networkState: NetworkState | null;
  cloudState?: CloudState | null;
};

const NETWORK_TYPES: readonly ProjectNetworkType[] = [
  'ON_PREMISE',
  'CLOUD',
  'MULTI_CLOUD',
  'HYBRID',
];

/**
 * Projetos criados antes do campo existir chegam com `networkType` nulo — a
 * API só faz o backfill (`ON_PREMISE`) quando o projeto é alterado (ver
 * `ProjectMutationConsumer.backfillNetworkTypeIfMissing` no rede-studio-api).
 * Normaliza aqui, na fronteira, com o mesmo default, pra UI nunca receber um
 * tipo fora da união.
 */
function normalizeNetworkType(value: unknown): ProjectNetworkType {
  return NETWORK_TYPES.includes(value as ProjectNetworkType)
    ? (value as ProjectNetworkType)
    : 'ON_PREMISE';
}

function withNetworkType<T extends { networkType: unknown }>(item: T): T {
  return { ...item, networkType: normalizeNetworkType(item.networkType) };
}

function toSummary(record: ProjectRecord): ProjectSummary {
  const { networkState: _networkState, cloudState: _cloudState, ...summary } = record;
  void _networkState;
  void _cloudState;
  return withNetworkType(summary);
}

/** Registro vindo da API ou de um cache antigo (sem `cloudState`) → forma atual. */
function toRecord(raw: ProjectResponse | ProjectRecord): ProjectRecord {
  const typed = withNetworkType({ ...raw });
  return {
    ...typed,
    networkState: typed.networkState ?? null,
    cloudState: typed.cloudState ?? null,
  };
}

/**
 * Grava no cache local sem nunca derrubar o dado que veio da API: o cache é
 * best-effort (cota cheia, storage bloqueado etc.). Antes, uma falha aqui
 * caía no `catch` do chamador, que tratava como "API fora" e devolvia o
 * cache vazio — o Studio não abria o projeto.
 */
function writeCacheSafely(mutate: (document: ProjectsDocument) => void) {
  try {
    const document = loadProjectsDocument();
    mutate(document);
    saveProjectsDocument(document);
  } catch (error) {
    console.warn('Cache local de projetos indisponível', error);
  }
}

/** Espelha um `ProjectResponse` da API no cache local (localStorage). */
function cacheProject(response: ProjectResponse): ProjectRecord {
  const record = toRecord(response);
  writeCacheSafely((document) => {
    document.projects[record.id] = record;
  });
  return record;
}

/** Espelha um `ProjectSummaryResponse` da API no cache local, preservando o `networkState` já salvo. */
function cacheSummary(raw: ProjectSummaryResponse): ProjectSummary {
  const response = withNetworkType(raw);
  writeCacheSafely((document) => {
    const existing = document.projects[response.id];
    document.projects[response.id] = existing
      ? { ...existing, ...response }
      : response.networkType === 'CLOUD'
        ? { ...response, networkState: null, cloudState: cloudInitialState }
        : { ...response, networkState: networkInitialState, cloudState: null };
  });
  return response;
}

/**
 * Lista os projetos do usuário autenticado. Fonte da verdade é a API — o
 * cache local só entra em cena se a API estiver inacessível (rede fora,
 * backend fora do ar), pra não travar a navegação do usuário. Um 401
 * (token expirado/inválido) não é "API fora do ar" — sobe pro chamador pra
 * disparar o logout global (ver `app/queryClient.ts`), em vez de mascarar
 * com dado local obsoleto.
 */
export async function listProjectsByOwner(
  ownerId: string,
): Promise<ProjectSummary[]> {
  try {
    const projects = await httpGet<ProjectSummaryResponse[]>('/api/projects');
    return projects.map(withNetworkType);
  } catch (err) {
    if (err instanceof ApiError && err.isUnauthorized) throw err;
    const document = loadProjectsDocument();
    return Object.values(document.projects)
      .filter((project) => project.ownerId === ownerId)
      .map(toSummary)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}

/**
 * Busca um projeto específico. Um 404 da API é definitivo (projeto não
 * existe ou não é do usuário) e nunca cai pro cache local — só falhas de
 * rede/API fora do ar usam o registro local como fallback.
 */
export async function getProject(id: string): Promise<ProjectRecord | null> {
  try {
    const response = await httpGet<ProjectResponse>(`/api/projects/${id}`);
    return cacheProject(response);
  } catch (err) {
    if (err instanceof ApiError && err.isUnauthorized) {
      throw err;
    }
    if (err instanceof ApiError && err.status === 404) {
      return null;
    }
    return getProject.local(id);
  }
}
getProject.local = function getProjectLocal(id: string): ProjectRecord | null {
  const document = loadProjectsDocument();
  const record = document.projects[id];
  return record ? toRecord(record) : null;
};

/**
 * Cria o projeto com o estado inicial do Studio certo pro tipo: `CLOUD`
 * nasce com um rascunho cloud vazio, os demais com a topologia on-prem
 * inicial (a API recusa o estado trocado — ver `CreateProjectRequest`).
 */
export async function createProject(
  input: CreateProjectInput,
): Promise<ProjectRecord> {
  const name = input.name.trim() || 'Novo Projeto';
  const initialState =
    input.networkType === 'CLOUD'
      ? { cloudState: { ...cloneJson(cloudInitialState), meta: { ...cloudInitialState.meta, projectName: name } } }
      : { networkState: cloneJson(networkInitialState) };
  const response = await httpPost<ProjectResponse>('/api/projects', {
    body: { name, networkType: input.networkType, ...initialState },
  });
  return cacheProject(response);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Renomeia um projeto. Se a API estiver inacessível, o rename ainda é
 * aplicado localmente (offline-first) — fica pendente de sincronizar no
 * próximo autosave/leitura bem-sucedida.
 */
export async function renameProject(
  id: string,
  name: string,
): Promise<ProjectSummary | null> {
  const trimmed = name.trim();
  try {
    const response = await httpPatch<ProjectSummaryResponse>(
      `/api/projects/${id}`,
      { body: { name: trimmed || undefined } },
    );
    return cacheSummary(response);
  } catch (err) {
    if (err instanceof ApiError && err.isUnauthorized) throw err;
    const document = loadProjectsDocument();
    const record = document.projects[id];
    if (!record) return null;
    record.name = trimmed || record.name;
    record.updatedAt = new Date().toISOString();
    saveProjectsDocument(document);
    return toSummary(record);
  }
}

/**
 * Deleta um projeto. O servidor é quem decide: o cache local só é limpo
 * quando a API confirma a exclusão (2xx) ou responde 404 (já não existe —
 * o resultado final é o mesmo). Qualquer outra falha, inclusive sem
 * conexão, é repassada pra UI mostrar o erro e o projeto continua na lista
 * — sem fila de sincronização, apagar só localmente faria o projeto
 * "voltar" no próximo `listProjects`.
 */
export async function deleteProject(id: string): Promise<void> {
  try {
    await httpDelete(`/api/projects/${id}`);
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) throw error;
  }
  const document = loadProjectsDocument();
  delete document.projects[id];
  saveProjectsDocument(document);
}

/**
 * Salva o snapshot completo do projeto (autosave). Grava local primeiro,
 * de forma síncrona em relação à chamada — o usuário nunca perde trabalho
 * por causa da rede — e só depois tenta sincronizar com a API.
 */
export async function saveProjectSnapshot(
  id: string,
  networkState: NetworkState,
): Promise<StatePersistenceResult> {
  const document = loadProjectsDocument();
  const record = document.projects[id];

  const bytes = new TextEncoder().encode(JSON.stringify(networkState)).length;
  if (bytes > MAX_BYTES) {
    return {
      ok: false,
      warning:
        'Projeto excedeu limite seguro de persistencia local. Considere exportar JSON.',
    };
  }

  if (record) {
    record.networkState = networkState;
    record.updatedAt = new Date().toISOString();
    saveProjectsDocument(document);
  }

  try {
    await httpPut(`/api/projects/${id}/snapshot`, { body: { networkState } });
    return { ok: true, warning: null };
  } catch (err) {
    if (err instanceof ApiError && err.isUnauthorized) throw err;
    return {
      ok: false,
      warning:
        'Salvo localmente, mas não foi possível sincronizar com o servidor.',
    };
  }
}

/**
 * Autosave do Studio Cloud — mesma política do `saveProjectSnapshot`
 * (grava local primeiro, depois sincroniza), na rota própria
 * `PUT /api/projects/{id}/cloud-snapshot`.
 */
export async function saveCloudSnapshot(
  id: string,
  cloudState: CloudState,
): Promise<StatePersistenceResult> {
  const bytes = new TextEncoder().encode(JSON.stringify(cloudState)).length;
  if (bytes > MAX_BYTES) {
    return {
      ok: false,
      warning:
        'Projeto excedeu limite seguro de persistencia local. Considere exportar JSON.',
    };
  }

  writeCacheSafely((document) => {
    const record = document.projects[id];
    if (record) {
      record.cloudState = cloudState;
      record.updatedAt = new Date().toISOString();
    }
  });

  try {
    await httpPut(`/api/projects/${id}/cloud-snapshot`, { body: { cloudState } });
    return { ok: true, warning: null };
  } catch (err) {
    if (err instanceof ApiError && err.isUnauthorized) throw err;
    return {
      ok: false,
      warning:
        'Salvo localmente, mas não foi possível sincronizar com o servidor.',
    };
  }
}

/**
 * Migra o projeto único legado (localStorage de antes das contas de
 * usuário) pra um projeto novo anexado ao usuário que acabou de logar ou
 * se registrar. Roda uma única vez por navegador.
 *
 * Precisa criar o projeto de fato via API (não só localmente) porque o id
 * de um projeto agora é atribuído pelo backend — não dá pra "empurrar
 * depois" um registro que nasceu só local, ele nunca teria um id válido
 * pra sincronizar. Se a API estiver fora nesse momento, a migração fica
 * pendente e é tentada de novo no próximo login/registro.
 */
export async function migrateLegacyProjectIfNeeded(): Promise<ProjectSummary | null> {
  const document = loadProjectsDocument();
  if (document.legacyProjectMigrated) return null;

  const legacyState = loadStateDocument();
  if (!legacyState) {
    document.legacyProjectMigrated = true;
    saveProjectsDocument(document);
    return null;
  }

  try {
    const response = await httpPost<ProjectResponse>('/api/projects', {
      // Projeto pré-contas só existia local, no navegador — sempre on-premise.
      body: {
        name: 'Projeto migrado',
        networkType: 'ON_PREMISE' satisfies ProjectNetworkType,
        networkState: legacyState,
      },
    });
    const record = cacheProject(response);
    const latestDocument = loadProjectsDocument();
    latestDocument.legacyProjectMigrated = true;
    saveProjectsDocument(latestDocument);
    return toSummary(record);
  } catch {
    return null;
  }
}

export const projectsRoutes = {
  listProjectsByOwner,
  getProject,
  createProject,
  renameProject,
  deleteProject,
  saveProjectSnapshot,
  saveCloudSnapshot,
  migrateLegacyProjectIfNeeded,
};
