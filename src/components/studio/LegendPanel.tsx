import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  addNode,
  addLayer,
  removeLayer,
  removeNode,
  removeSite,
} from '../../features/network/networkSlice';
import type { LayerTier, NodeCategory } from '../../features/network/types';
import { selectLegendTree } from '../../features/network/selectors';
import {
  getLegendPanelCopy,
  getNodeIconSrc,
  getNodeVisual,
  NODE_OPTION_CATEGORIES,
  RELATION_OPTION_CATEGORIES,
  type StudioLanguage,
} from './catalog';

type LegendPanelProps = {
  language: StudioLanguage;
};

// ── Tier presets ──────────────────────────────────────────────────────────────
const TIER_PRESETS: {
  tier: LayerTier;
  emoji: string;
  label: string;
  sub: string;
  color: string;
  badge: string;
}[] = [
  {
    tier: 'edge',
    emoji: '🔵',
    label: 'Edge',
    sub: 'RTR / FW',
    color: 'border-blue-600/70 bg-blue-950/30 hover:bg-blue-900/40',
    badge: 'bg-blue-700 text-blue-100',
  },
  {
    tier: 'distribution',
    emoji: '🟡',
    label: 'Distribuição',
    sub: 'SW L3 / LB',
    color: 'border-yellow-600/70 bg-yellow-950/30 hover:bg-yellow-900/40',
    badge: 'bg-yellow-700 text-yellow-100',
  },
  {
    tier: 'access',
    emoji: '🟢',
    label: 'Acesso',
    sub: 'SW L2 / AP',
    color: 'border-green-600/70 bg-green-950/30 hover:bg-green-900/40',
    badge: 'bg-green-800 text-green-100',
  },
  {
    tier: 'endpoint',
    emoji: '⚫',
    label: 'Endpoints',
    sub: 'PC / IP Phone',
    color: 'border-slate-500/70 bg-slate-800/30 hover:bg-slate-700/40',
    badge: 'bg-slate-700 text-slate-200',
  },
  {
    tier: 'dmz',
    emoji: '🟠',
    label: 'DMZ',
    sub: 'Serv. públicos',
    color: 'border-orange-600/70 bg-orange-950/30 hover:bg-orange-900/40',
    badge: 'bg-orange-700 text-orange-100',
  },
  {
    tier: 'management',
    emoji: '🔒',
    label: 'Gerência',
    sub: 'OOB / Mgmt',
    color: 'border-violet-600/70 bg-violet-950/30 hover:bg-violet-900/40',
    badge: 'bg-violet-800 text-violet-100',
  },
  {
    tier: 'custom',
    emoji: '✏',
    label: 'Livre',
    sub: '(sem papel)',
    color: 'border-slate-600/50 bg-slate-900/30 hover:bg-slate-800/40',
    badge: 'bg-slate-600 text-slate-300',
  },
];

const TIER_DEFAULT_NAMES: Record<LayerTier, string> = {
  edge: 'Borda / Edge',
  distribution: 'Distribuição',
  access: 'Acesso',
  endpoint: 'Endpoints',
  dmz: 'DMZ',
  management: 'Gerência',
  custom: '',
};

function getTierBadge(tier?: LayerTier) {
  if (!tier) return null;
  return TIER_PRESETS.find((p) => p.tier === tier) ?? null;
}

export default function LegendPanel({ language }: LegendPanelProps) {
  const dispatch = useAppDispatch();
  const legendTree = useAppSelector(selectLegendTree);
  const { nodes, links } = useAppSelector((state) => state.network);
  const copy = getLegendPanelCopy(language);
  const [categoryByLayer, setCategoryByLayer] = useState<
    Record<string, NodeCategory>
  >({});
  const [openPickerLayerId, setOpenPickerLayerId] = useState<string | null>(
    null,
  );
  const [searchByLayer, setSearchByLayer] = useState<Record<string, string>>(
    {},
  );

  // ── Tier picker state ───────────────────────────────────────────────────────
  const [tierPickerSiteId, setTierPickerSiteId] = useState<string | null>(null);
  const [pendingTier, setPendingTier] = useState<LayerTier | null>(null);
  const [pendingLayerName, setPendingLayerName] = useState('');

  function openTierPicker(siteId: string) {
    setTierPickerSiteId(siteId);
    setPendingTier(null);
    setPendingLayerName('');
  }

  function closeTierPicker() {
    setTierPickerSiteId(null);
    setPendingTier(null);
    setPendingLayerName('');
  }

  function selectTierPreset(tier: LayerTier) {
    setPendingTier(tier);
    const defaultName = TIER_DEFAULT_NAMES[tier];
    setPendingLayerName(defaultName);
  }

  function handleConfirmAddLayer() {
    if (!tierPickerSiteId) return;
    dispatch(
      addLayer({
        siteId: tierPickerSiteId,
        tier: pendingTier ?? undefined,
        name: pendingLayerName || undefined,
      }),
    );
    closeTierPicker();
  }

  function getCategoryForLayer(layerId: string): NodeCategory {
    return categoryByLayer[layerId] ?? 'router';
  }

  function getLayerSearch(layerId: string): string {
    return searchByLayer[layerId] ?? '';
  }

  function handleAddNode(
    siteId: string,
    layerId: string,
    category: NodeCategory,
  ) {
    setCategoryByLayer((prev) => ({ ...prev, [layerId]: category }));
    dispatch(addNode({ siteId, layerId, category }));
    setOpenPickerLayerId(null);
  }

  const relationNodes = nodes.filter(
    (node) =>
      !node.siteId &&
      !node.layerId &&
      node.category !== 'wan' &&
      RELATION_OPTION_CATEGORIES.includes(node.category),
  );

  return (
    <aside className="theme-scrollbar h-full min-h-0 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900/70 p-3">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-cyan-300">
        {copy.title}
      </h2>

      <div className="space-y-2">
        {relationNodes.length > 0 && (
          <details
            open
            className="rounded border border-indigo-700/70 bg-indigo-950/20"
          >
            <summary className="cursor-pointer px-3 py-2 text-xs font-semibold uppercase tracking-wide text-indigo-200">
              {copy.relationBetweenSites}
            </summary>
            <ul className="space-y-1 px-2 pb-2">
              {relationNodes.map((node) => {
                const visual = getNodeVisual(node.category);
                const relatedLinks = links.filter(
                  (link) => link.from === node.id || link.to === node.id,
                );
                return (
                  <li
                    key={node.id}
                    className="rounded border border-indigo-800/60 bg-slate-900/50 px-2 py-1"
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-200">
                      <span className="flex items-center gap-2">
                        <img
                          src={getNodeIconSrc(node.category)}
                          alt={visual.label}
                          className="h-4 w-4 object-contain"
                        />
                        <span>
                          <span className="mr-1 text-sky-300">
                            [{visual.short}]
                          </span>
                          {node.label}
                        </span>
                      </span>
                      <button
                        onClick={() => dispatch(removeNode(node.id))}
                        className="rounded bg-rose-500 px-2 py-1 text-[10px] font-bold uppercase"
                      >
                        {copy.delete}
                      </button>
                    </div>
                    {relatedLinks.length > 0 && (
                      <div className="mt-1 space-y-1 text-[10px] text-slate-400">
                        {relatedLinks.map((link) => {
                          const otherId =
                            link.from === node.id ? link.to : link.from;
                          const otherNode = nodes.find(
                            (item) => item.id === otherId,
                          );
                          return (
                            <div key={`${node.id}-${link.id}`}>
                              ↳ {otherNode?.label ?? otherId}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </details>
        )}

        {legendTree.length === 0 && (
          <p className="text-xs text-slate-400">{copy.emptySites}</p>
        )}

        {legendTree.map((site) => (
          <details
            key={site.id}
            open
            className="rounded border border-slate-700"
          >
            <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm text-slate-200">
              <span>{site.name}</span>
              <div className="flex gap-2">
                <button
                  onClick={(event) => {
                    event.preventDefault();
                    openTierPicker(site.id);
                  }}
                  className="rounded bg-emerald-400 px-2 py-1 text-[10px] font-bold uppercase text-slate-950"
                >
                  {copy.addLayer}
                </button>
                <button
                  onClick={(event) => {
                    event.preventDefault();
                    dispatch(removeSite(site.id));
                  }}
                  className="rounded bg-rose-500 px-2 py-1 text-[10px] font-bold uppercase"
                >
                  {copy.delete}
                </button>
              </div>
            </summary>

            {/* ── Tier Picker modal inline ────────────────────────────────── */}
            {tierPickerSiteId === site.id && (
              <div
                className="mx-2 mb-2 mt-1 rounded border border-emerald-700/50 bg-emerald-950/20 p-2"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                  Papel da camada{' '}
                  <span className="text-slate-500">(opcional)</span>
                </p>
                <div className="mb-2 grid grid-cols-2 gap-1">
                  {TIER_PRESETS.map((preset) => (
                    <button
                      key={preset.tier}
                      type="button"
                      onClick={() => selectTierPreset(preset.tier)}
                      className={`flex flex-col items-start rounded border px-2 py-1.5 text-left text-[10px] transition ${preset.color} ${pendingTier === preset.tier ? 'ring-1 ring-emerald-400' : ''}`}
                    >
                      <span className="font-semibold">
                        {preset.emoji} {preset.label}
                      </span>
                      <span className="text-slate-400">{preset.sub}</span>
                    </button>
                  ))}
                </div>
                <label className="mb-2 flex flex-col gap-0.5">
                  <span className="text-[10px] text-slate-400">Nome</span>
                  <input
                    value={pendingLayerName}
                    onChange={(e) => setPendingLayerName(e.target.value)}
                    placeholder="Camada..."
                    className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 placeholder:text-slate-600"
                  />
                </label>
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    onClick={closeTierPicker}
                    className="rounded border border-slate-600 px-2 py-1 text-[10px] text-slate-400 hover:bg-slate-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmAddLayer}
                    className="rounded bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-emerald-500"
                  >
                    + Adicionar Camada
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2 px-2 pb-2">
              {site.layers.map((layer) => (
                <details
                  key={layer.id}
                  open
                  className="rounded border border-slate-800 bg-slate-950/40"
                >
                  <summary className="flex cursor-pointer items-center justify-between px-2 py-2 text-xs text-slate-300">
                    <span className="flex items-center gap-1.5 min-w-0">
                      {(() => {
                        const badge = getTierBadge(layer.tier);
                        return badge ? (
                          <span
                            className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-bold ${badge.badge}`}
                            title={badge.label}
                          >
                            {badge.emoji}
                          </span>
                        ) : null;
                      })()}
                      <span className="truncate">{layer.name}</span>
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setOpenPickerLayerId((prev) =>
                            prev === layer.id ? null : layer.id,
                          );
                        }}
                        className={`rounded border px-2 py-1 text-[10px] font-bold uppercase transition ${
                          openPickerLayerId === layer.id
                            ? 'border-cyan-600 bg-cyan-900/40 text-cyan-300'
                            : 'border-[#2c4464] bg-[#0d1a2e] text-slate-100 hover:bg-slate-800'
                        }`}
                      >
                        [{getNodeVisual(getCategoryForLayer(layer.id)).short}]{' '}
                        {copy.addIcon}
                      </button>
                      <button
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          dispatch(removeLayer(layer.id));
                        }}
                        className="rounded bg-rose-500 px-2 py-1 text-[10px] font-bold uppercase"
                      >
                        {copy.delete}
                      </button>
                    </div>
                  </summary>

                  {openPickerLayerId === layer.id && (
                    <div
                      className="mx-2 mb-2 rounded border border-[#2f4f75] bg-[#081427] p-2"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-400">
                        <span>{copy.addComponentLayer}</span>
                        <span className="text-cyan-300">
                          {copy.last}: [
                          {getNodeVisual(getCategoryForLayer(layer.id)).short}]
                        </span>
                      </div>
                      <input
                        value={getLayerSearch(layer.id)}
                        onChange={(event) =>
                          setSearchByLayer((prev) => ({
                            ...prev,
                            [layer.id]: event.target.value,
                          }))
                        }
                        placeholder={copy.searchTypePlaceholder}
                        className="mb-2 w-full rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1.5 text-[11px] text-slate-100"
                      />
                      <div className="theme-scrollbar grid max-h-36 grid-cols-1 gap-1 overflow-y-auto">
                        {NODE_OPTION_CATEGORIES.filter((category) => {
                          const visual = getNodeVisual(category);
                          const query = getLayerSearch(layer.id)
                            .trim()
                            .toLowerCase();
                          if (!query) return true;
                          return (
                            visual.label.toLowerCase().includes(query) ||
                            visual.short.toLowerCase().includes(query) ||
                            category.toLowerCase().includes(query)
                          );
                        }).map((category) => {
                          const visual = getNodeVisual(category);
                          const isLast =
                            getCategoryForLayer(layer.id) === category;
                          return (
                            <button
                              key={`${layer.id}-${category}`}
                              onClick={() =>
                                handleAddNode(site.id, layer.id, category)
                              }
                              className={`flex items-center justify-between rounded px-2 py-1 text-left text-[11px] transition ${
                                isLast
                                  ? 'border border-cyan-500/60 bg-cyan-500/20 text-cyan-100'
                                  : 'border border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800'
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                <img
                                  src={getNodeIconSrc(category)}
                                  alt={visual.label}
                                  className="h-4 w-4 object-contain"
                                />
                                <span>
                                  [{visual.short}] {visual.label}
                                </span>
                              </span>
                              {isLast && (
                                <span className="text-[10px] uppercase">
                                  {copy.default}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <ul className="space-y-1 px-2 pb-2">
                    {layer.nodes.length === 0 && (
                      <li className="text-[11px] text-slate-500">
                        {copy.noComponents}
                      </li>
                    )}
                    {layer.nodes.map((node) => {
                      const visual = getNodeVisual(node.category);
                      return (
                        <li
                          key={node.id}
                          className="rounded border border-slate-800 bg-slate-900/50 px-2 py-1"
                        >
                          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-200">
                            <span>
                              <span className="mr-1 text-sky-300">
                                [{visual.short}]
                              </span>
                              {node.label}
                            </span>
                            <button
                              onClick={() => dispatch(removeNode(node.id))}
                              className="rounded bg-rose-500 px-2 py-1 text-[10px] font-bold uppercase"
                            >
                              {copy.delete}
                            </button>
                          </div>
                          {node.children.length > 0 && (
                            <div className="mt-1 space-y-1 text-[10px] text-slate-400">
                              {node.children.map((child) => (
                                <div key={`${node.id}-${child.linkId}`}>
                                  ↳ {child.label}
                                </div>
                              ))}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </details>
              ))}
            </div>
          </details>
        ))}
      </div>
    </aside>
  );
}
