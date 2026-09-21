import { useState, type FormEvent } from 'react';
import type { ProjectsPageCopy } from '../i18n/types';
import Modal from './Modal';

type NewProjectModalProps = {
  onClose: () => void;
  onCreate: (name: string) => void;
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

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onCreate(name.trim() || defaultName);
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
