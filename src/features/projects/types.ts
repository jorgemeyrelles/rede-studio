import type { CloudState } from '../cloud/types';
import type { NetworkState } from '../network/types';

/**
 * Sprint tiers Fase 7 — categoria de topologia do projeto. Espelha o enum
 * `NetworkType` da rede-studio-api (mesma convenção de `AuthErrorCode`:
 * strings vindas do backend ficam em UPPER_SNAKE_CASE, sem tradução de
 * formato). Escolhida uma única vez na criação — nenhum fluxo permite
 * editar depois (nem rename, nem Settings).
 */
export type ProjectNetworkType =
  | 'ON_PREMISE'
  | 'CLOUD'
  | 'MULTI_CLOUD'
  | 'HYBRID';

export type ProjectSummary = {
  id: string;
  name: string;
  /** _id do Mongo do dono (JWT `uid` na rede-studio-api) — mesmo valor de `PublicUser.id`. */
  ownerId: string;
  networkType: ProjectNetworkType;
  createdAt: string;
  updatedAt: string;
};

/**
 * Projeto completo. Exatamente um dos dois estados vem preenchido, decidido
 * pelo `networkType`: `CLOUD` → `cloudState` (Studio Cloud); os demais →
 * `networkState` (Studio on-prem). Mesma regra da rede-studio-api.
 */
export type ProjectRecord = ProjectSummary & {
  networkState: NetworkState | null;
  cloudState: CloudState | null;
};

export type CreateProjectInput = {
  name: string;
  networkType: ProjectNetworkType;
};

export type ProjectsDocument = {
  /** chave = ProjectRecord.id */
  projects: Record<string, ProjectRecord>;
  /** true depois que o projeto legado (pré-contas) já foi migrado uma vez */
  legacyProjectMigrated: boolean;
};
