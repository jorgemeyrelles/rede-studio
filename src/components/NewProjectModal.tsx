import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { ProjectNetworkType } from '../features/projects/types';
import type { ProjectsPageCopy } from '../i18n/types';
import Modal from './Modal';
import NetworkTypeIcon from './NetworkTypeIcon';

/** Sprint tiers Fase 7 — só escolhida aqui, na criação; nenhum outro fluxo edita depois. */
const NETWORK_TYPE_OPTIONS: ProjectNetworkType[] = [
  'ON_PREMISE',
  'CLOUD',
  'MULTI_CLOUD',
  'HYBRID',
];

/**
 * Tipos ainda sem suporte no Studio — aparecem como "Em breve" (visíveis,
 * não selecionáveis) até a modelagem cloud existir. Remover daqui libera.
 */
const COMING_SOON_TYPES = new Set<ProjectNetworkType>([
  'MULTI_CLOUD',
  'HYBRID',
]);
const AVAILABLE_TYPES = NETWORK_TYPE_OPTIONS.filter(
  (type) => !COMING_SOON_TYPES.has(type),
);

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
    AVAILABLE_TYPES[0],
  );
  const optionRefs = useRef<
    Partial<Record<ProjectNetworkType, HTMLButtonElement | null>>
  >({});

  // Radiogroup: setas movem a seleção entre as opções disponíveis
  // (as "Em breve" são puladas), com roving tabindex.
  const handleRadioKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (!step || AVAILABLE_TYPES.length < 2) return;
    event.preventDefault();
    const index = AVAILABLE_TYPES.indexOf(networkType);
    const next =
      AVAILABLE_TYPES[
        (index + step + AVAILABLE_TYPES.length) % AVAILABLE_TYPES.length
      ];
    setNetworkType(next);
    optionRefs.current[next]?.focus();
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onCreate(name.trim() || defaultName, networkType);
  };

  return (
    <Modal
      onClose={onClose}
      title={copy.newProjectModalTitle}
      closeLabel={copy.cancelButton}
      dismissible={!isCreating}
      size="md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5 text-xs font-medium text-chalk-dim">
          {copy.projectNameLabel}
          <input
            type="text"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field"
          />
        </label>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-xs font-medium text-chalk-dim">
            {copy.networkTypeLabel}
          </legend>
          <div
            role="radiogroup"
            aria-describedby="network-type-hint"
            onKeyDown={handleRadioKeyDown}
            className="grid grid-cols-1 gap-2 sm:grid-cols-2"
          >
            {NETWORK_TYPE_OPTIONS.map((option) => {
              const comingSoon = COMING_SOON_TYPES.has(option);
              const selected = !comingSoon && networkType === option;
              return (
                <button
                  key={option}
                  ref={(el) => {
                    optionRefs.current[option] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-disabled={comingSoon || undefined}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => {
                    if (!comingSoon) setNetworkType(option);
                  }}
                  className={`flex h-10 items-center gap-2 rounded-sm border px-2.5 text-left text-sm transition-colors ${
                    comingSoon
                      ? 'cursor-not-allowed border-line text-chalk-faint'
                      : selected
                        ? 'border-accent bg-accent/10 text-chalk'
                        : 'border-line text-chalk-dim hover:border-chalk-faint hover:text-chalk'
                  }`}
                >
                  <NetworkTypeIcon
                    type={option}
                    size={16}
                    className={selected ? 'text-accent' : 'text-chalk-faint'}
                  />
                  <span className="flex-1 whitespace-nowrap">
                    {copy.networkTypeOptions[option]}
                  </span>
                  {comingSoon && (
                    <span className="shrink-0 rounded-sm bg-ink-raised-2 px-1 py-0.5 text-2xs text-chalk-dim">
                      {copy.comingSoon}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p id="network-type-hint" className="mt-2 text-xs text-chalk-faint">
            {copy.networkTypeComingSoonHint}
          </p>
        </fieldset>

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isCreating}
            className="btn btn-secondary btn-md"
          >
            {copy.cancelButton}
          </button>
          <button
            type="submit"
            disabled={isCreating}
            aria-busy={isCreating}
            className="btn btn-primary btn-md"
          >
            {isCreating ? copy.creating : copy.createButton}
          </button>
        </div>
      </form>
    </Modal>
  );
}
