import { Check, ChevronDown, Search } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

export type ComboboxOption = {
  value: string;
  label: string;
  description?: string;
  /** Dado técnico em mono (ex.: política gerenciada). */
  meta?: string;
};

type CatalogComboboxProps = {
  options: ComboboxOption[];
  selected: ReadonlySet<string>;
  onToggle: (value: string) => void;
  triggerLabel: string;
  searchPlaceholder: string;
  emptyLabel: string;
  /** Múltipla escolha (fica aberto) ou escolha única (fecha ao escolher). */
  multiple?: boolean;
  disabled?: boolean;
};

/**
 * Lista suspensa com busca do Studio Cloud (padrão WAI-ARIA combobox +
 * listbox): setas movem, Enter/Espaço marca, Esc fecha, o foco volta ao
 * gatilho. Usada pelos catálogos (modelos IAM, políticas gerenciadas).
 */
export default function CatalogCombobox({
  options,
  selected,
  onToggle,
  triggerLabel,
  searchPlaceholder,
  emptyLabel,
  multiple = true,
  disabled = false,
}: CatalogComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listboxId = useId();
  const optionId = (index: number) => `${listboxId}-opt-${index}`;

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return options;
    return options.filter((option) =>
      [option.label, option.description, option.meta].some((text) =>
        text?.toLowerCase().includes(term),
      ),
    );
  }, [options, query]);

  useEffect(() => setActive(0), [query, open]);

  // Dentro do inspetor (que rola), a lista pode abrir abaixo da dobra.
  useEffect(() => {
    if (open) panelRef.current?.scrollIntoView({ block: 'nearest' });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document
      .getElementById(optionId(active))
      ?.scrollIntoView({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, open]);

  const close = () => {
    setOpen(false);
    setQuery('');
    triggerRef.current?.focus();
  };

  const choose = (value: string) => {
    onToggle(value);
    if (!multiple) close();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="field-sm flex items-center justify-between gap-2 text-left text-chalk-dim disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="truncate">{triggerLabel}</span>
        <ChevronDown size={13} aria-hidden="true" className="shrink-0" />
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 overflow-hidden rounded-md border border-line bg-ink-raised shadow-panel"
        >
          <div className="flex items-center gap-2 border-b border-line px-2">
            <Search
              size={13}
              aria-hidden="true"
              className="shrink-0 text-chalk-faint"
            />
            <input
              autoFocus
              role="combobox"
              aria-expanded="true"
              aria-controls={listboxId}
              aria-activedescendant={
                filtered.length ? optionId(active) : undefined
              }
              aria-autocomplete="list"
              value={query}
              placeholder={searchPlaceholder}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  setActive((index) =>
                    Math.min(filtered.length - 1, index + 1),
                  );
                } else if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  setActive((index) => Math.max(0, index - 1));
                } else if (
                  event.key === 'Enter' ||
                  (event.key === ' ' && !query)
                ) {
                  event.preventDefault();
                  const option = filtered[active];
                  if (option) choose(option.value);
                } else if (event.key === 'Escape') {
                  event.preventDefault();
                  event.stopPropagation();
                  close();
                } else if (event.key === 'Tab') {
                  setOpen(false);
                }
              }}
              className="h-8 w-full bg-transparent text-xs text-chalk outline-none placeholder:text-chalk-faint"
            />
          </div>
          <ul
            id={listboxId}
            role="listbox"
            aria-multiselectable={multiple || undefined}
            className="max-h-64 overflow-y-auto py-1"
          >
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-2xs text-chalk-faint">
                {emptyLabel}
              </li>
            )}
            {filtered.map((option, index) => {
              const isSelected = selected.has(option.value);
              return (
                <li
                  key={option.value}
                  id={optionId(index)}
                  role="option"
                  aria-selected={isSelected}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => choose(option.value)}
                  onMouseEnter={() => setActive(index)}
                  className={`flex cursor-pointer gap-2 px-3 py-1.5 ${index === active ? 'bg-ink-raised-2' : ''}`}
                >
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[2px] border ${
                      isSelected
                        ? 'border-accent bg-accent text-accent-ink'
                        : 'border-line-strong'
                    }`}
                  >
                    {isSelected && <Check size={10} strokeWidth={3} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs text-chalk">
                      {option.label}
                    </span>
                    {option.description && (
                      <span className="block text-2xs leading-4 text-chalk-dim">
                        {option.description}
                      </span>
                    )}
                    {option.meta && (
                      <span className="block truncate font-mono text-2xs text-chalk-faint">
                        {option.meta}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
