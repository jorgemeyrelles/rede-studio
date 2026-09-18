import type { NetworkState } from '../network/types';

export type ProjectSummary = {
  id: string;
  name: string;
  /** _id do Mongo do dono (JWT `uid` na rede-studio-api) — mesmo valor de `PublicUser.id`. */
  ownerId: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectRecord = ProjectSummary & {
  networkState: NetworkState;
};

export type CreateProjectInput = {
  name: string;
};

export type ProjectsDocument = {
  /** chave = ProjectRecord.id */
  projects: Record<string, ProjectRecord>;
  /** true depois que o projeto legado (pré-contas) já foi migrado uma vez */
  legacyProjectMigrated: boolean;
};

