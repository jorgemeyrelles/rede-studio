import { MAX_BYTES } from '../../features/network/constants';
import { networkInitialState } from '../../features/network/networkSlice';
import type { NetworkState } from '../../features/network/types';
import type {
    CreateProjectInput,
    ProjectRecord,
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
  createdAt: string;
  updatedAt: string;
};

type ProjectResponse = ProjectSummaryResponse & {
  networkState: NetworkState;
};

function toSummary(record: ProjectRecord): ProjectSummary {
  const { networkState: _networkState, ...summary } = record;
  void _networkState;
  return summary;
}

/** Espelha um `ProjectResponse` da API no cache local (localStorage). */
function cacheProject(response: ProjectResponse): ProjectRecord {
  const document = loadProjectsDocument();
  const record: ProjectRecord = { ...response };
  document.projects[record.id] = record;
  saveProjectsDocument(document);
  return record;
}

/** Espelha um `ProjectSummaryResponse` da API no cache local, preservando o `networkState` já salvo. */
function cacheSummary(response: ProjectSummaryResponse): ProjectSummary {
  const document = loadProjectsDocument();
  const existing = document.projects[response.id];
  document.projects[response.id] = existing
    ? { ...existing, ...response }
    : { ...response, networkState: networkInitialState };
  saveProjectsDocument(document);
  return response;
}

/**
 * Lista os projetos do usuário autenticado. Fonte da verdade é a API — o
 * cache local só entra em cena se a API estiver inacessível (rede fora,
 * backend fora do ar), pra não travar a navegação do usuário.
 */
export async function listProjectsByOwner(
  ownerId: string,
): Promise<ProjectSummary[]> {
  try {
    return await httpGet<ProjectSummaryResponse[]>('/api/projects');
  } catch {
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
    if (err instanceof ApiError && err.status === 404) {
      return null;
    }
    return getProject.local(id);
  }
}
getProject.local = function getProjectLocal(id: string): ProjectRecord | null {
  const document = loadProjectsDocument();
  return document.projects[id] ?? null;
};

export async function createProject(
  input: CreateProjectInput,
): Promise<ProjectRecord> {
  const networkState: NetworkState = JSON.parse(
    JSON.stringify(networkInitialState),
  );
  const response = await httpPost<ProjectResponse>('/api/projects', {
    body: { name: input.name.trim() || 'Novo Projeto', networkState },
  });
  return cacheProject(response);
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
  } catch {
    const document = loadProjectsDocument();
    const record = document.projects[id];
    if (!record) return null;
    record.name = trimmed || record.name;
    record.updatedAt = new Date().toISOString();
    saveProjectsDocument(document);
    return toSummary(record);
  }
}

/** Deleta um projeto. Remove do cache local mesmo se a chamada à API falhar. */
export async function deleteProject(id: string): Promise<void> {
  try {
    await httpDelete(`/api/projects/${id}`);
  } catch {
    // offline-first: segue removendo local mesmo se a API não confirmou
  } finally {
    const document = loadProjectsDocument();
    delete document.projects[id];
    saveProjectsDocument(document);
  }
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
  } catch {
    return {
      ok: false,
      warning: 'Salvo localmente, mas não foi possível sincronizar com o servidor.',
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
      body: { name: 'Projeto migrado', networkState: legacyState },
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
  migrateLegacyProjectIfNeeded,
};
