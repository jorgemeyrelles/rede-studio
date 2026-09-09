import type { ProjectsDocument } from '../../features/projects/types';

const PROJECTS_STORAGE_KEY = 'rede-sp-cwb-projects-v1';

const EMPTY_DOCUMENT: ProjectsDocument = {
  projects: {},
  legacyProjectMigrated: false,
};

export function loadProjectsDocument(): ProjectsDocument {
  try {
    const raw = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (!raw) return { ...EMPTY_DOCUMENT, projects: {} };
    const parsed = JSON.parse(raw) as ProjectsDocument;
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
  localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(document));
}
