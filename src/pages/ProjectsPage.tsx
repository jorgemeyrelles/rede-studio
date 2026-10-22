import { ArrowRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Modal from '../components/Modal';
import NetworkTypeIcon from '../components/NetworkTypeIcon';
import NewProjectModal from '../components/NewProjectModal';
import { useSessionQuery } from '../features/auth/queries';
import {
  useCreateProjectMutation,
  useDeleteProjectMutation,
  useProjectsQuery,
  useRenameProjectMutation,
} from '../features/projects/queries';
import type {
  ProjectNetworkType,
  ProjectSummary,
} from '../features/projects/types';
import type { ProjectsPageCopy } from '../i18n/types';
import { getProjectsPageCopy } from '../i18n/utils';
import type { AppLanguage } from '../types/i18n';

function ProjectCard({
  project,
  language,
  copy,
  onOpen,
  onRename,
  onDelete,
}: {
  project: ProjectSummary;
  language: AppLanguage;
  copy: ProjectsPageCopy;
  onOpen: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
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
    <article className="group flex flex-col rounded-md border border-line bg-ink-raised transition-colors hover:border-line-strong">
      <div className="flex flex-1 flex-col gap-3 p-5">
        {isEditing ? (
          <input
            autoFocus
            aria-label={copy.renameAriaLabel}
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
            className="field font-display text-heading font-semibold"
          />
        ) : (
          <h2 className="font-display text-heading font-semibold text-chalk [overflow-wrap:anywhere]">
            <button
              type="button"
              onClick={onOpen}
              className="rounded-sm text-left hover:text-accent"
            >
              {project.name}
            </button>
          </h2>
        )}

        <div className="mt-auto flex flex-col items-start gap-2">
          <span className="chip">
            <NetworkTypeIcon type={project.networkType} size={12} />
            {copy.networkTypeOptions[project.networkType]}
          </span>
          <p className="text-xs text-chalk-faint">
            {copy.lastEditedLabel}{' '}
            <time dateTime={project.updatedAt} className="tabular-nums">
              {new Date(project.updatedAt).toLocaleString(language, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </time>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 border-t border-line px-3 py-2">
        <button
          type="button"
          onClick={onOpen}
          className="btn btn-ghost btn-sm text-accent enabled:hover:text-accent"
        >
          {copy.openProject}
          <ArrowRight size={14} aria-hidden="true" />
        </button>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={copy.renameAriaLabel}
          title={copy.renameAriaLabel}
          className="btn btn-ghost btn-sm btn-icon"
        >
          <Pencil size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={copy.deleteAriaLabel}
          title={copy.deleteAriaLabel}
          className="btn btn-ghost btn-sm btn-icon enabled:hover:text-signal-down"
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

function DeleteProjectModal({
  project,
  copy,
  onClose,
}: {
  project: ProjectSummary;
  copy: ProjectsPageCopy;
  onClose: () => void;
}) {
  const deleteMutation = useDeleteProjectMutation();
  const [typedName, setTypedName] = useState('');
  const matches = typedName.trim() === project.name.trim();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!matches) return;
    deleteMutation.mutate(project.id, { onSuccess: onClose });
  };

  return (
    <Modal
      onClose={onClose}
      title={copy.deleteModalTitle}
      closeLabel={copy.cancelButton}
      size="md"
      dismissible={!deleteMutation.isPending}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2 text-sm text-chalk-dim">
          <p className="font-semibold text-chalk [overflow-wrap:anywhere]">
            {project.name}
          </p>
          <p>{copy.deleteModalBody}</p>
        </div>

        <label className="flex flex-col gap-1.5 text-xs font-medium text-chalk-dim">
          {copy.deleteConfirmLabel}
          <input
            type="text"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            aria-describedby="delete-confirm-hint"
            className="field"
          />
          <span
            id="delete-confirm-hint"
            className="font-normal text-chalk-faint [overflow-wrap:anywhere]"
          >
            {copy.deleteConfirmHint}{' '}
            <span className="font-mono text-chalk-dim">{project.name}</span>
          </span>
        </label>

        {deleteMutation.isError && (
          <p role="alert" className="text-xs text-signal-down">
            {copy.deleteError}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={deleteMutation.isPending}
            className="btn btn-secondary btn-md"
          >
            {copy.cancelButton}
          </button>
          <button
            type="submit"
            disabled={!matches || deleteMutation.isPending}
            aria-busy={deleteMutation.isPending}
            className="btn btn-danger btn-md"
          >
            {deleteMutation.isPending ? copy.deleting : copy.deleteButton}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ProjectCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex h-[150px] flex-col gap-3 rounded-md border border-line bg-ink-raised p-5"
    >
      <span className="h-3 w-20 animate-pulse rounded-sm bg-ink-raised-2" />
      <span className="h-4 w-2/3 animate-pulse rounded-sm bg-ink-raised-2" />
      <span className="mt-auto h-3 w-1/2 animate-pulse rounded-sm bg-ink-raised-2" />
    </div>
  );
}

export default function ProjectsPage() {
  const { lang } = useParams<{ lang: AppLanguage }>();
  const language = lang ?? 'pt';
  const navigate = useNavigate();
  const copy = getProjectsPageCopy(language);

  const { data: currentUser } = useSessionQuery();
  const {
    data: items = [],
    isLoading,
    isError,
    refetch,
  } = useProjectsQuery(currentUser?.id);
  const createProjectMutation = useCreateProjectMutation();
  const renameProjectMutation = useRenameProjectMutation();
  const [isModalOpen, setModalOpen] = useState(false);
  const [isCreating, setCreating] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<ProjectSummary | null>(
    null,
  );

  const handleCreate = async (
    name: string,
    networkType: ProjectNetworkType,
  ) => {
    if (!currentUser) return;
    setCreating(true);
    try {
      const record = await createProjectMutation.mutateAsync({
        name,
        networkType,
      });
      navigate(`/${language}/studio/${record.id}`);
    } finally {
      setCreating(false);
    }
  };

  const showEmpty = !isLoading && !isError && items.length === 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 text-chalk sm:px-6">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-title font-bold text-chalk">
            {copy.title}
          </h1>
          <p className="text-sm text-chalk-dim">{copy.subtitle}</p>
        </div>
        {!showEmpty && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="btn btn-primary btn-md"
          >
            <Plus size={16} aria-hidden="true" />
            {copy.newProjectButton}
          </button>
        )}
      </header>

      {isError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-signal-down/40 bg-signal-down/5 px-4 py-3 text-sm text-chalk"
        >
          {copy.loadError}
          <button
            type="button"
            onClick={() => refetch()}
            className="btn btn-secondary btn-sm"
          >
            {copy.retry}
          </button>
        </div>
      )}

      {showEmpty && (
        <div className="flex flex-col items-center gap-4 rounded-md border border-dashed border-line px-6 py-16 text-center">
          <div className="flex flex-col gap-1">
            <p className="font-display text-heading font-semibold text-chalk">
              {copy.emptyStateTitle}
            </p>
            <p className="text-sm text-chalk-dim">{copy.emptyStateSubtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="btn btn-primary btn-md"
          >
            <Plus size={16} aria-hidden="true" />
            {copy.emptyStateCta}
          </button>
        </div>
      )}

      <div
        aria-busy={isLoading}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {isLoading && (
          <>
            <span className="sr-only">{copy.loading}</span>
            <ProjectCardSkeleton />
            <ProjectCardSkeleton />
            <ProjectCardSkeleton />
          </>
        )}
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
            onDelete={() => setProjectToDelete(project)}
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

      {projectToDelete && (
        <DeleteProjectModal
          project={projectToDelete}
          copy={copy}
          onClose={() => setProjectToDelete(null)}
        />
      )}
    </div>
  );
}
