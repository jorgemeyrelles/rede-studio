import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import NewProjectModal from '../components/NewProjectModal';
import { useSessionQuery } from '../features/auth/queries';
import {
    useCreateProjectMutation,
    useProjectsQuery,
    useRenameProjectMutation,
} from '../features/projects/queries';
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
    <div className="relative flex flex-col items-start gap-2 border border-line bg-ink-raised-2 p-5 pl-6 transition hover:border-accent">
      <span
        className="absolute left-0 top-0 h-full w-[3px] bg-accent"
        aria-hidden="true"
      />
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
          className="w-full rounded-sm border border-accent bg-ink px-2 py-1 text-sm text-chalk outline-none"
        />
      ) : (
        <div className="flex w-full items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-sm font-semibold text-chalk">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-signal-up shadow-[0_0_5px_var(--signal-up)]"
              aria-hidden="true"
            />
            {project.name}
          </span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={copy.renameAriaLabel}
            title={copy.renameAriaLabel}
            className="shrink-0 text-chalk-faint transition hover:text-accent"
          >
            ✎
          </button>
        </div>
      )}

      <span className="font-mono text-xs text-chalk-faint">
        {copy.lastEditedLabel}{' '}
        {new Date(project.updatedAt).toLocaleString(language)}
      </span>

      <button
        type="button"
        onClick={onOpen}
        className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-accent hover:underline"
      >
        {copy.openProject} →
      </button>
    </div>
  );
}

export default function ProjectsPage() {
  const { lang } = useParams<{ lang: AppLanguage }>();
  const language = lang ?? 'pt';
  const navigate = useNavigate();
  const copy = getProjectsPageCopy(language);

  const { data: currentUser } = useSessionQuery();
  const { data: items = [], isLoading } = useProjectsQuery(currentUser?.id);
  const createProjectMutation = useCreateProjectMutation();
  const renameProjectMutation = useRenameProjectMutation();
  const [isModalOpen, setModalOpen] = useState(false);
  const [isCreating, setCreating] = useState(false);

  const handleCreate = async (name: string) => {
    if (!currentUser) return;
    setCreating(true);
    try {
      const record = await createProjectMutation.mutateAsync({ name });
      navigate(`/${language}/studio/${record.id}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 text-chalk sm:px-6">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-chalk">{copy.title}</h1>
          <p className="text-sm text-chalk-dim">{copy.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="btn-planta-solid rounded-sm px-4 py-2 text-xs font-semibold uppercase tracking-wider"
          >
            {copy.newProjectButton}
          </button>
        </div>
      </div>

      {!isLoading && items.length === 0 && (
        <div className="rounded-sm border border-dashed border-line py-16 text-center">
          <p className="text-sm font-semibold text-chalk-dim">
            {copy.emptyStateTitle}
          </p>
          <p className="mt-1 text-xs text-chalk-faint">
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
            onRename={(name) =>
              renameProjectMutation.mutate({ id: project.id, name })
            }
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
