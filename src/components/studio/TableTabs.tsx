import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

export type TableTabDescriptor = {
  id: string;
  label: string;
  content: ReactNode;
};

/** Domínio de primeiro nível: agrupa sub-abas por id. */
export type TableTabGroup = {
  id: string;
  label: string;
  tabIds: string[];
};

type TableTabsProps = {
  tabs: TableTabDescriptor[];
  /** Domínios (1º nível). Sem grupos, vira uma barra única de abas. */
  groups?: TableTabGroup[];
  /** id da aba visível inicialmente — por padrão, a primeira. */
  defaultTabId?: string;
  /**
   * Chave de `sessionStorage` pra lembrar a aba ativa (ex.: por projeto).
   * Só conveniência — some com a aba do navegador.
   */
  storageKey?: string;
};

function readStored(key?: string): string | null {
  if (!key) return null;
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string | undefined, value: string) {
  if (!key) return;
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // storage indisponível (modo privado etc.) — só não lembra a aba.
  }
}

/** Padrão WAI-ARIA de abas: setas movem e ativam, Home/End vão às pontas. */
function nextIndexForKey(key: string, index: number, length: number) {
  if (key === 'ArrowRight') return (index + 1) % length;
  if (key === 'ArrowLeft') return (index - 1 + length) % length;
  if (key === 'Home') return 0;
  if (key === 'End') return length - 1;
  return -1;
}

/**
 * Abas dos painéis/tabelas do Studio, em até 2 níveis: domínio (seletor
 * segmentado) → sub-abas (sublinhado). Nenhum nível passa de 3 itens, então
 * a barra nunca transborda.
 *
 * API de descritores (`{ id, label, content }`) em vez de compound
 * component — permite combinar conteúdo de hooks/componentes diferentes
 * (`useRouteFirewallTabs` + `<SiteVlanPanel/>` + ...).
 *
 * Cada painel fica sempre montado (`hidden` em vez de desmontar), então
 * nenhum estado local do conteúdo (formulários, filtros, drag-and-drop) é
 * perdido ao trocar de aba.
 */
export default function TableTabs({
  tabs,
  groups,
  defaultTabId,
  storageKey,
}: TableTabsProps) {
  const baseId = useId();
  const [activeId, setActiveId] = useState(
    () => readStored(storageKey) ?? defaultTabId ?? tabs[0]?.id,
  );
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const groupRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const resolvedActiveId = tabs.some((tab) => tab.id === activeId)
    ? activeId
    : tabs[0]?.id;

  const resolvedGroups: TableTabGroup[] = groups?.length
    ? groups
    : [{ id: 'all', label: '', tabIds: tabs.map((tab) => tab.id) }];
  const activeGroup =
    resolvedGroups.find((group) =>
      group.tabIds.includes(resolvedActiveId ?? ''),
    ) ?? resolvedGroups[0];
  const groupTabs = activeGroup.tabIds
    .map((id) => tabs.find((tab) => tab.id === id))
    .filter((tab): tab is TableTabDescriptor => Boolean(tab));

  // Lembra a última sub-aba de cada domínio ao voltar pra ele.
  const lastTabByGroup = useRef<Record<string, string>>({});
  if (resolvedActiveId)
    lastTabByGroup.current[activeGroup.id] = resolvedActiveId;

  const selectTab = (id: string) => {
    setActiveId(id);
    writeStored(storageKey, id);
  };

  const selectGroup = (group: TableTabGroup) => {
    const target = lastTabByGroup.current[group.id] ?? group.tabIds[0];
    if (target) selectTab(target);
  };

  const handleGroupKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = resolvedGroups.indexOf(activeGroup);
    const next = nextIndexForKey(event.key, index, resolvedGroups.length);
    if (next < 0) return;
    event.preventDefault();
    const group = resolvedGroups[next];
    selectGroup(group);
    groupRefs.current[group.id]?.focus();
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = groupTabs.findIndex((tab) => tab.id === resolvedActiveId);
    const next = nextIndexForKey(event.key, index, groupTabs.length);
    if (next < 0) return;
    event.preventDefault();
    const nextId = groupTabs[next].id;
    selectTab(nextId);
    tabRefs.current[nextId]?.focus();
  };

  const hasGroups = Boolean(groups?.length);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-w-0 flex-wrap items-end gap-x-6 gap-y-2 border-b border-line">
        {hasGroups && (
          <div
            role="tablist"
            aria-orientation="horizontal"
            onKeyDown={handleGroupKeyDown}
            className="mb-2 flex h-9 max-w-full items-center overflow-x-auto overflow-y-hidden rounded-sm border border-line bg-ink p-0.5"
          >
            {resolvedGroups.map((group) => {
              const isActive = group.id === activeGroup.id;
              return (
                <button
                  key={group.id}
                  ref={(el) => {
                    groupRefs.current[group.id] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`${baseId}-group-${group.id}`}
                  aria-selected={isActive}
                  aria-controls={`${baseId}-group-panel`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => selectGroup(group)}
                  className={`flex h-full items-center whitespace-nowrap rounded-[1px] px-3 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-ink-raised-2 text-chalk'
                      : 'text-chalk-dim hover:text-chalk'
                  }`}
                >
                  {group.label}
                </button>
              );
            })}
          </div>
        )}

        <div
          role="tablist"
          id={hasGroups ? `${baseId}-group-panel` : undefined}
          aria-labelledby={
            hasGroups ? `${baseId}-group-${activeGroup.id}` : undefined
          }
          onKeyDown={handleTabKeyDown}
          className="theme-scrollbar flex min-w-0 max-w-full gap-1 overflow-x-auto overflow-y-hidden"
        >
          {groupTabs.map((tab) => {
            const isActive = tab.id === resolvedActiveId;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabRefs.current[tab.id] = el;
                }}
                type="button"
                role="tab"
                id={`${baseId}-tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`${baseId}-panel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => selectTab(tab.id)}
                className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-accent text-chalk'
                    : 'border-transparent text-chalk-dim hover:border-line-strong hover:text-chalk'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${baseId}-panel-${tab.id}`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          hidden={tab.id !== resolvedActiveId}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
