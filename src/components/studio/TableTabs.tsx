import { useState, type ReactNode } from 'react';

export type TableTabDescriptor = {
  id: string;
  label: string;
  content: ReactNode;
};

type TableTabsProps = {
  tabs: TableTabDescriptor[];
  /** id da aba visível inicialmente — por padrão, a primeira. */
  defaultTabId?: string;
};

/**
 * Abas para agrupar painéis/tabelas relacionados do Studio (rotas,
 * firewall/ACL, VLANs por site, inventário de equipamentos, serviços e
 * certificados...) que hoje ficam empilhados — ver seção "08" do protótipo
 * e a Fase 4 em .claude/plans/redesign-planta-e-sessao-jwt.md.
 *
 * API é uma lista de descritores (`{ id, label, content }`) em vez de
 * compound component — permite montar uma única barra de abas combinando
 * conteúdo vindo de hooks/componentes diferentes (ex.: `useRouteFirewallTabs`
 * + `<SiteVlanPanel/>` + `<EquipmentInventoryPanel/>`), sem exigir que tudo
 * seja escrito como filho JSX direto de `TableTabs` (React não "acha" o que
 * um componente aninhado renderiza por dentro, só o que está escrito ali).
 *
 * Cada painel fica sempre montado (`hidden` em vez de desmontar), então
 * nenhum estado local do conteúdo (formulários, drag-and-drop, filtros,
 * tooltips abertos) é perdido ao trocar de aba.
 */
export default function TableTabs({ tabs, defaultTabId }: TableTabsProps) {
  const [activeId, setActiveId] = useState(defaultTabId ?? tabs[0]?.id);
  const resolvedActiveId = tabs.some((tab) => tab.id === activeId)
    ? activeId
    : tabs[0]?.id;

  return (
    <div className="flex flex-col gap-3">
      <div
        role="tablist"
        className="inline-flex flex-wrap gap-1 self-start rounded-sm border border-line bg-ink-raised p-1"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === resolvedActiveId;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveId(tab.id)}
              className={`rounded-sm px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition ${
                isActive
                  ? 'bg-accent text-accent-ink'
                  : 'text-chalk-dim hover:bg-ink-raised-2 hover:text-chalk'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {tabs.map((tab) => (
        <div key={tab.id} hidden={tab.id !== resolvedActiveId}>
          {tab.content}
        </div>
      ))}
    </div>
  );
}
