import { Fragment, useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { useEquipmentsQuery } from '../../features/equipments/queries';
import {
  filterCatalogByNodeCategory,
  withSelectedOption,
} from '../../features/equipments/utils';
import {
  updateHostAllocationEquipment,
  updateNode,
} from '../../features/network/networkSlice';
import { selectEquipmentInventory } from '../../features/network/selectors';
import type { EquipmentResponse } from '../../services/routes/equipmentsRoutes';
import type {
  EquipmentInventoryRow,
  LayerTier,
} from '../../features/network/types';
import type { StudioLanguage } from './types';
import { getEquipmentInventoryCopy, getTierLabel } from './utils/i18n';

type EquipmentInventoryPanelProps = {
  language: StudioLanguage;
};

type SortKey = keyof EquipmentInventoryRow;
type SortDir = 'asc' | 'desc';

// Sprint equipamentos Fase 12 — +1 pela coluna de chevron/accordion.
const TOTAL_COLUMN_COUNT = 9;

// Bug fix i18n — sentinela distinto de `''` (usado pelo option "Todos os
// tiers") para representar, no filtro, as linhas cujo `tier` bruto é
// `undefined` (nó sem camada associada) — evita colidir com "sem filtro".
const NONE_TIER_VALUE = '__none__';

function tierFilterValue(tier: LayerTier | undefined): string {
  return tier ?? NONE_TIER_VALUE;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function modelsForBrand(catalog: EquipmentResponse[], brand: string): string[] {
  return uniqueSorted(
    catalog.filter((item) => item.brand === brand).map((item) => item.model),
  );
}

// Sprint equipamentos Fase 12 — mesmo padrão de agrupamento pai/filhos usado
// por `RouteFirewallPanel.tsx` (`sortedGroupedRows`): `selectEquipmentInventory`
// já emite a linha pai imediatamente seguida de suas linhas derivadas.
type EquipmentGroup = {
  parent: EquipmentInventoryRow;
  children: EquipmentInventoryRow[];
};

function groupEquipmentRows(rows: EquipmentInventoryRow[]): EquipmentGroup[] {
  const groups: EquipmentGroup[] = [];
  for (const row of rows) {
    if (!row.isDerivedAllocation) {
      groups.push({ parent: row, children: [] });
    } else if (groups.length > 0) {
      groups[groups.length - 1].children.push(row);
    }
  }
  return groups;
}

export default function EquipmentInventoryPanel({
  language,
}: EquipmentInventoryPanelProps) {
  const dispatch = useAppDispatch();
  const copy = getEquipmentInventoryCopy(language);
  const rows = useAppSelector(selectEquipmentInventory);
  // Sprint equipamentos Fase 8 — marca/modelo em cascata na própria linha da
  // tabela; `rows.marca/modelo` já vêm formatados pro display ("—" quando
  // vazio), então buscamos o valor bruto do nó pra alimentar os <select>.
  const nodes = useAppSelector((state) => state.network.nodes);
  const nodeById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  );
  const equipmentsQuery = useEquipmentsQuery();
  const equipmentCatalog = equipmentsQuery.data ?? [];
  const catalogReady = equipmentsQuery.isSuccess;

  // Bug fix i18n — 8 cabeçalhos de coluna traduzidos por `copy`; a mesma
  // lista é reaproveitada pela tabela filha do accordion (ID/Nome/Marca/
  // Modelo), ver abaixo.
  const COLUMNS: { key: SortKey; label: string }[] = [
    { key: 'id', label: copy.colId },
    { key: 'nome', label: copy.colName },
    { key: 'marca', label: copy.colBrand },
    { key: 'modelo', label: copy.colModel },
    { key: 'funcao', label: copy.colFunction },
    { key: 'site', label: copy.colSite },
    { key: 'lan', label: copy.colLan },
    { key: 'tier', label: copy.colTier },
  ];

  const [siteFilter, setSiteFilter] = useState('');
  const [lanFilter, setLanFilter] = useState('');
  // Bug fix i18n — guarda o valor BRUTO do tier (`LayerTier` ou o sentinela
  // `NONE_TIER_VALUE`), não o rótulo traduzido: assim o filtro sobrevive a
  // troca de idioma em vez de "perder" a seleção porque o texto mudou.
  const [tierFilter, setTierFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('nome');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  // Sprint equipamentos Fase 12 — accordion de unidades (hostAllocations).
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const siteOptions = useMemo(
    () => uniqueSorted(rows.map((row) => row.site)),
    [rows],
  );
  const lanOptions = useMemo(
    () => uniqueSorted(rows.map((row) => row.lan)),
    [rows],
  );
  // Bug fix i18n — cada opção guarda o valor bruto (pra filtrar,
  // estável entre idiomas) e o rótulo já traduzido (pra exibir).
  const tierOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of rows) {
      const value = tierFilterValue(row.tier);
      if (!seen.has(value)) {
        seen.set(value, getTierLabel(row.tier, language, row.lan));
      }
    }
    return Array.from(seen.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows, language]);

  function getSortValue(row: EquipmentInventoryRow, key: SortKey): string {
    if (key === 'tier') return getTierLabel(row.tier, language, row.lan);
    return String(row[key]);
  }

  // Filtro/ordenação incidem só sobre a linha "pai" (1 por equipamento);
  // as linhas derivadas (unidades extras) herdam site/lan/tier do pai, então
  // seguem o grupo automaticamente e só aparecem quando o accordion abre.
  const visibleGroups = useMemo(() => {
    const groups = groupEquipmentRows(rows);
    const filtered = groups.filter(
      ({ parent }) =>
        (!siteFilter || parent.site === siteFilter) &&
        (!lanFilter || parent.lan === lanFilter) &&
        (!tierFilter || tierFilterValue(parent.tier) === tierFilter),
    );

    const sorted = [...filtered].sort((a, b) => {
      const result = getSortValue(a.parent, sortKey).localeCompare(
        getSortValue(b.parent, sortKey),
      );
      return sortDir === 'asc' ? result : -result;
    });

    return sorted;
  }, [rows, siteFilter, lanFilter, tierFilter, sortKey, sortDir, language]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir('asc');
  }

  return (
    <section className="w-full rounded-lg border border-line bg-ink-raised p-3 shadow-[0_0_0_1px_rgba(27,49,77,0.35),0_12px_24px_rgba(0,0,0,0.28)]">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-300">
        {copy.title}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          value={siteFilter}
          onChange={(event) => setSiteFilter(event.target.value)}
          className="rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1 text-[11px] text-slate-100"
        >
          <option value="">{copy.filterAllSites}</option>
          {siteOptions.map((site) => (
            <option key={site} value={site}>
              {site}
            </option>
          ))}
        </select>
        <select
          value={lanFilter}
          onChange={(event) => setLanFilter(event.target.value)}
          className="rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1 text-[11px] text-slate-100"
        >
          <option value="">{copy.filterAllLans}</option>
          {lanOptions.map((lan) => (
            <option key={lan} value={lan}>
              {lan}
            </option>
          ))}
        </select>
        <select
          value={tierFilter}
          onChange={(event) => setTierFilter(event.target.value)}
          className="rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1 text-[11px] text-slate-100"
        >
          <option value="">{copy.filterAllTiers}</option>
          {tierOptions.map((tier) => (
            <option key={tier.value} value={tier.value}>
              {tier.label}
            </option>
          ))}
        </select>
        <span className="text-[10px] text-slate-500">
          {visibleGroups.length}{' '}
          {visibleGroups.length !== 1 ? copy.countPlural : copy.countSingular}
        </span>
      </div>

      <div className="theme-scrollbar max-h-[420px] overflow-y-auto overflow-x-auto">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="text-left text-slate-400">
              <th className="border-b border-[#35567f] px-1 py-1" />
              {COLUMNS.map((column) => (
                <th
                  key={column.key}
                  className="cursor-pointer select-none border-b border-[#35567f] px-2 py-1 hover:text-slate-200"
                  onClick={() => handleSort(column.key)}
                >
                  {column.label}
                  {sortKey === column.key && (
                    <span className="ml-1 text-cyan-300">
                      {sortDir === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleGroups.length === 0 && (
              <tr>
                <td
                  colSpan={TOTAL_COLUMN_COUNT}
                  className="border-b border-slate-800 px-2 py-3 text-center text-slate-500"
                >
                  {copy.emptyState}
                </td>
              </tr>
            )}
            {visibleGroups.map(({ parent: row, children }) => {
              const node = nodeById.get(row.id);
              const currentBrand = node?.equipmentBrand ?? '';
              const currentModel = node?.equipmentModel ?? '';
              // Só marcas/modelos que atendem à categoria deste nó (chave
              // `function` do catálogo) — antes, todo tipo de nó via o
              // catálogo inteiro.
              const categoryCatalog = filterCatalogByNodeCategory(
                equipmentCatalog,
                node?.category,
              );
              const categoryBrands = uniqueSorted(
                categoryCatalog.map((item) => item.brand),
              );
              const noEquipmentForType =
                catalogReady && categoryBrands.length === 0;
              const brandOptions = withSelectedOption(
                categoryBrands,
                currentBrand,
              );
              const availableModels = withSelectedOption(
                currentBrand
                  ? modelsForBrand(categoryCatalog, currentBrand)
                  : [],
                currentModel,
              );
              const isExpandable = children.length > 0;
              const isOpen = expandedIds.has(row.id);

              return (
                <Fragment key={row.id}>
                  <tr className="hover:bg-slate-800/30">
                    <td className="border-b border-slate-800 px-1 py-1">
                      <button
                        type="button"
                        aria-label={
                          isOpen ? copy.collapseAriaLabel : copy.expandAriaLabel
                        }
                        onClick={() => isExpandable && toggleExpand(row.id)}
                        disabled={!isExpandable}
                        className={`flex h-5 w-5 items-center justify-center rounded transition-all duration-150 ${
                          isExpandable
                            ? 'cursor-pointer text-amber-400 hover:bg-slate-700 hover:text-amber-300'
                            : 'cursor-not-allowed text-slate-600 opacity-40'
                        }`}
                      >
                        <svg
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className={`h-3 w-3 transition-transform duration-200 ${isOpen ? 'rotate-90' : 'rotate-0'}`}
                        >
                          <path
                            fillRule="evenodd"
                            d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </td>
                    <td className="border-b border-slate-800 px-2 py-1 font-mono text-[10px] text-slate-400">
                      {row.id}
                      {isExpandable && (
                        <span className="ml-1 text-slate-600">
                          (×{children.length + 1})
                        </span>
                      )}
                    </td>
                    <td className="border-b border-slate-800 px-2 py-1 text-slate-200">
                      {row.nome}
                    </td>
                    <td className="border-b border-slate-800 px-2 py-1 text-slate-300">
                      <select
                        value={currentBrand}
                        disabled={noEquipmentForType && !currentBrand}
                        onChange={(event) =>
                          dispatch(
                            updateNode({
                              id: row.id,
                              changes: {
                                equipmentBrand: event.target.value,
                                equipmentModel: '',
                              },
                            }),
                          )
                        }
                        className="w-full rounded border border-[#35567f] bg-[#0d1a2e] px-1.5 py-1 text-[11px] text-slate-100 disabled:opacity-50"
                      >
                        <option value="">
                          {noEquipmentForType
                            ? copy.noEquipmentForType
                            : copy.brandPlaceholder}
                        </option>
                        {brandOptions.map((brand) => (
                          <option key={brand} value={brand}>
                            {brand}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border-b border-slate-800 px-2 py-1 text-slate-300">
                      <select
                        value={currentModel}
                        disabled={!currentBrand}
                        onChange={(event) =>
                          dispatch(
                            updateNode({
                              id: row.id,
                              changes: { equipmentModel: event.target.value },
                            }),
                          )
                        }
                        className="w-full rounded border border-[#35567f] bg-[#0d1a2e] px-1.5 py-1 text-[11px] text-slate-100 disabled:opacity-50"
                      >
                        <option value="">{copy.modelPlaceholder}</option>
                        {availableModels.map((model) => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border-b border-slate-800 px-2 py-1 text-slate-300">
                      {row.funcao}
                    </td>
                    <td className="border-b border-slate-800 px-2 py-1 text-slate-300">
                      {row.site}
                    </td>
                    <td className="border-b border-slate-800 px-2 py-1 text-slate-300">
                      {row.lan}
                    </td>
                    <td className="border-b border-slate-800 px-2 py-1 text-slate-300">
                      {getTierLabel(row.tier, language, row.lan)}
                    </td>
                  </tr>

                  {isExpandable && (
                    <tr>
                      <td colSpan={TOTAL_COLUMN_COUNT} className="p-0">
                        <div
                          className={`overflow-hidden transition-all duration-200 ${isOpen ? 'max-h-[600px]' : 'max-h-0'}`}
                        >
                          <div className="ml-7 border-l-2 border-amber-500/40 bg-slate-800/50">
                            <table className="w-full border-collapse">
                              <thead>
                                <tr className="text-left text-[10px] text-slate-500">
                                  <th className="px-2 py-0.5">{copy.colId}</th>
                                  <th className="px-2 py-0.5">
                                    {copy.colName}
                                  </th>
                                  <th className="px-2 py-0.5">
                                    {copy.colBrand}
                                  </th>
                                  <th className="px-2 py-0.5">
                                    {copy.colModel}
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {children.map((child) => {
                                  // Sprint equipamentos Fase 12 (correção) —
                                  // cada unidade extra tem sua própria marca/
                                  // modelo, independente das outras e do nó
                                  // pai; valor bruto vem de hostAllocations,
                                  // não do row já formatado ("—" p/ display).
                                  const allocation = node?.hostAllocations.find(
                                    (item) => item.id === child.id,
                                  );
                                  const childBrand =
                                    allocation?.equipmentBrand ?? '';
                                  const childModel =
                                    allocation?.equipmentModel ?? '';
                                  const childBrandOptions = withSelectedOption(
                                    categoryBrands,
                                    childBrand,
                                  );
                                  const childModels = withSelectedOption(
                                    childBrand
                                      ? modelsForBrand(
                                          categoryCatalog,
                                          childBrand,
                                        )
                                      : [],
                                    childModel,
                                  );

                                  return (
                                    <tr
                                      key={child.id}
                                      className="hover:bg-slate-700/30"
                                    >
                                      <td className="px-2 py-0.5 font-mono text-[10px] text-slate-400">
                                        {child.id}
                                      </td>
                                      <td className="px-2 py-0.5 text-slate-300">
                                        {child.nome}
                                      </td>
                                      <td className="px-2 py-0.5">
                                        <select
                                          value={childBrand}
                                          onChange={(event) =>
                                            dispatch(
                                              updateHostAllocationEquipment({
                                                nodeId: row.id,
                                                allocationId: child.id,
                                                equipmentBrand:
                                                  event.target.value,
                                                equipmentModel: '',
                                              }),
                                            )
                                          }
                                          disabled={
                                            noEquipmentForType && !childBrand
                                          }
                                          className="w-full rounded border border-[#35567f] bg-[#0d1a2e] px-1.5 py-0.5 text-[11px] text-slate-100 disabled:opacity-50"
                                        >
                                          <option value="">
                                            {noEquipmentForType
                                              ? copy.noEquipmentForType
                                              : copy.brandPlaceholder}
                                          </option>
                                          {childBrandOptions.map((brand) => (
                                            <option key={brand} value={brand}>
                                              {brand}
                                            </option>
                                          ))}
                                        </select>
                                      </td>
                                      <td className="px-2 py-0.5">
                                        <select
                                          value={childModel}
                                          disabled={!childBrand}
                                          onChange={(event) =>
                                            dispatch(
                                              updateHostAllocationEquipment({
                                                nodeId: row.id,
                                                allocationId: child.id,
                                                equipmentModel:
                                                  event.target.value,
                                              }),
                                            )
                                          }
                                          className="w-full rounded border border-[#35567f] bg-[#0d1a2e] px-1.5 py-0.5 text-[11px] text-slate-100 disabled:opacity-50"
                                        >
                                          <option value="">
                                            {copy.modelPlaceholder}
                                          </option>
                                          {childModels.map((model) => (
                                            <option key={model} value={model}>
                                              {model}
                                            </option>
                                          ))}
                                        </select>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
