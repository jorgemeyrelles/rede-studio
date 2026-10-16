import { useState, type FormEvent } from 'react';
import type { ProjectNetworkType } from '../features/projects/types';
import type { ProjectsPageCopy } from '../i18n/types';
import Modal from './Modal';

/** Sprint tiers Fase 7 — só escolhida aqui, na criação; nenhum outro fluxo edita depois. */
const NETWORK_TYPE_OPTIONS: ProjectNetworkType[] = [
  'ON_PREMISE',
  'CLOUD',
  'MULTI_CLOUD',
  'HYBRID',
];

type NewProjectModalProps = {
  onClose: () => void;
  onCreate: (name: string, networkType: ProjectNetworkType) => void;
  defaultName: string;
  isCreating: boolean;
  copy: ProjectsPageCopy;
};

export default function NewProjectModal({
  onClose,
  onCreate,
  defaultName,
  isCreating,
  copy,
}: NewProjectModalProps) {
  const [name, setName] = useState(defaultName);
  const [networkType, setNetworkType] = useState<ProjectNetworkType>(
    NETWORK_TYPE_OPTIONS[0],
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onCreate(name.trim() || defaultName, networkType);
  };

  return (
    <Modal onClose={onClose}>
      <form
        onSubmit={handleSubmit}
        className="relative flex w-full flex-col gap-4 rounded-sm border border-line bg-ink-raised p-6"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={copy.cancelButton}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-sm text-chalk-faint hover:bg-ink-raised-2 hover:text-chalk"
        >
          ✕
        </button>

        <h2 className="text-sm font-semibold text-chalk">
          {copy.newProjectModalTitle}
        </h2>

        <label className="flex flex-col gap-1.5 text-xs text-chalk-dim">
          {copy.projectNameLabel}
          <input
            type="text"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-sm border border-line bg-ink px-3 py-2 text-sm text-chalk outline-none focus:border-accent"
          />
        </label>

        <div className="flex flex-col gap-1.5 text-xs text-chalk-dim">
          {copy.networkTypeLabel}
          <div className="flex flex-wrap gap-1.5">
            {NETWORK_TYPE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setNetworkType(option)}
                className={`rounded-sm px-2.5 py-1.5 text-[11px] font-bold tracking-wide transition ${
                  networkType === option
                    ? 'bg-accent text-accent-ink'
                    : 'bg-ink-raised-2 text-chalk-dim hover:bg-ink-raised'
                }`}
              >
                {copy.networkTypeOptions[option]}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-1 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm border border-line px-4 py-2 text-xs font-semibold uppercase tracking-wider text-chalk-dim hover:bg-ink-raised-2 hover:text-chalk"
          >
            {copy.cancelButton}
          </button>
          <button
            type="submit"
            disabled={isCreating}
            className="btn-planta-solid rounded-sm px-4 py-2 text-xs font-semibold uppercase tracking-wider"
          >
            {isCreating ? copy.creating : copy.createButton}
          </button>
        </div>
      </form>
    </Modal>
  );
}
