import type { ProjectsDocument } from '../../features/projects/types';
import { decodeFromStorage, encodeForStorage } from './obfuscation';

const PROJECTS_STORAGE_KEY = 'rede-sp-cwb-projects-v1';

const EMPTY_DOCUMENT: ProjectsDocument = {
  projects: {},
  legacyProjectMigrated: false,
};

/**
 * Decodifica o formato ofuscado (Fase 5); se falhar, tenta o JSON em texto
 * plano de antes dessa mudança — migração transparente, sem exigir nada do
 * usuário (o próximo `saveProjectsDocument` já regrava já ofuscado).
 */
function parseStoredDocument(raw: string): ProjectsDocument | null {
  try {
    return decodeFromStorage<ProjectsDocument>(raw);
  } catch {
    try {
      return JSON.parse(raw) as ProjectsDocument;
    } catch {
      return null;
    }
  }
}

export function loadProjectsDocument(): ProjectsDocument {
  try {
    const raw = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (!raw) return { ...EMPTY_DOCUMENT, projects: {} };
    const parsed = parseStoredDocument(raw);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.projects !== 'object') {
      return { ...EMPTY_DOCUMENT, projects: {} };
    }
    return {
      ...parsed,
      legacyProjectMigrated: parsed.legacyProjectMigrated ?? false,
    };
  } catch {
    return { ...EMPTY_DOCUMENT, projects: {} };
  }
}

export function saveProjectsDocument(document: ProjectsDocument): void {
  localStorage.setItem(PROJECTS_STORAGE_KEY, encodeForStorage(document));
}
