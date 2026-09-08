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
        className="relative flex w-full flex-col gap-4 rounded-lg border border-slate-800 bg-slate-900 p-6"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={copy.cancelButton}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-800 hover:text-slate-200"
        >
          ✕
        </button>

        <h2 className="text-sm font-semibold text-white">
          {copy.newProjectModalTitle}
        </h2>

        <label className="flex flex-col gap-1.5 text-xs text-slate-400">
          {copy.projectNameLabel}
          <input
            type="text"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-600"
          />
        </label>

        <div className="mt-1 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-700 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-300 hover:bg-slate-800"
          >
            {copy.cancelButton}
          </button>
          <button
            type="submit"
            disabled={isCreating}
            className="rounded-md bg-cyan-500 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCreating ? copy.creating : copy.createButton}
          </button>
        </div>
      </form>
    </Modal>
  );
}
