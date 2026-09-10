import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import NewProjectModal from '../components/NewProjectModal';
import {
    createProject,
    fetchProjects,
    renameProject,
} from '../features/projects/projectsSlice';
import type { ProjectSummary } from '../features/projects/types';
import type { ProjectsPageCopy } from '../i18n/types';
import { getProjectsPageCopy } from '../i18n/utils';
import type { AppLanguage } from '../types/i18n';

function ProjectCard({
  project,
  language,
  copy,
  onOpen,
  onRename,
}: {
  project: ProjectSummary;
  language: AppLanguage;
  copy: ProjectsPageCopy;
  onOpen: () => void;
  onRename: (name: string) => void;
}) {
  const [isEditing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(project.name);

  const commit = () => {
    const trimmed = draftName.trim();
    setEditing(false);
    if (trimmed && trimmed !== project.name) {
      onRename(trimmed);
    } else {
      setDraftName(project.name);
    }
  };

  return (
    <div className="flex flex-col items-start gap-2 rounded-lg border border-slate-800 bg-slate-900 p-5 transition hover:border-cyan-700/60">
      {isEditing ? (
        <input
          autoFocus
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setDraftName(project.name);
              setEditing(false);
            }
          }}
          className="w-full rounded border border-cyan-600 bg-slate-950 px-2 py-1 text-sm text-slate-100 outline-none"
        />
      ) : (
        <div className="flex w-full items-center justify-between gap-2">
          <span className="text-sm font-semibold text-slate-100">
            {project.name}
          </span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={copy.renameAriaLabel}
            title={copy.renameAriaLabel}
            className="shrink-0 text-slate-500 transition hover:text-cyan-300"
          >
            ✎
          </button>
        </div>
      )}

      <span className="text-xs text-slate-500">
        {copy.lastEditedLabel}{' '}
        {new Date(project.updatedAt).toLocaleString(language)}
      </span>

      <button
        type="button"
        onClick={onOpen}
        className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-cyan-400 hover:underline"
      >
        {copy.openProject} →
      </button>
    </div>
  );
}

export default function ProjectsPage() {
  const { lang } = useParams<{ lang: AppLanguage }>();
  const language = lang ?? 'pt';
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const copy = getProjectsPageCopy(language);

  const currentUser = useAppSelector((state) => state.auth.currentUser);
  const { items, status } = useAppSelector((state) => state.projects);
  const [isModalOpen, setModalOpen] = useState(false);
  const [isCreating, setCreating] = useState(false);

  useEffect(() => {
    if (currentUser) dispatch(fetchProjects(currentUser.id));
  }, [currentUser, dispatch]);

  const handleCreate = async (name: string) => {
    if (!currentUser) return;
    setCreating(true);
    const result = await dispatch(createProject({ name }));
    setCreating(false);
    if (createProject.fulfilled.match(result)) {
      navigate(`/${language}/studio/${result.payload.id}`);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 text-slate-100 sm:px-6">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-white">{copy.title}</h1>
          <p className="text-sm text-slate-400">{copy.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="rounded-md bg-cyan-500 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-950 transition hover:bg-cyan-400"
          >
            {copy.newProjectButton}
          </button>
        </div>
      </div>

      {status === 'idle' && items.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-800 py-16 text-center">
          <p className="text-sm font-semibold text-slate-300">
            {copy.emptyStateTitle}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {copy.emptyStateSubtitle}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            language={language}
            copy={copy}
            onOpen={() => navigate(`/${language}/studio/${project.id}`)}
            onRename={(name) => dispatch(renameProject({ id: project.id, name }))}
          />
        ))}
      </div>

      {isModalOpen && (
        <NewProjectModal
          onClose={() => setModalOpen(false)}
          onCreate={handleCreate}
          defaultName={`${copy.defaultProjectNamePrefix} ${items.length + 1}`}
          isCreating={isCreating}
          copy={copy}
        />
      )}
    </div>
  );
}
