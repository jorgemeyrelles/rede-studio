import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  addNode,
  addLayer,
  removeLayer,
  removeNode,
  removeSite,
} from '../../features/network/networkSlice';
import type { NodeCategory } from '../../features/network/types';
import { selectLegendTree } from '../../features/network/selectors';
import {
  getNodeIconSrc,
  getNodeVisual,
  NODE_OPTION_CATEGORIES,
  RELATION_OPTION_CATEGORIES,
} from './catalog';

export default function LegendPanel() {
  const dispatch = useAppDispatch();
  const legendTree = useAppSelector(selectLegendTree);
  const { nodes, links } = useAppSelector((state) => state.network);
  const [categoryByLayer, setCategoryByLayer] = useState<
    Record<string, NodeCategory>
  >({});
  const [openPickerLayerId, setOpenPickerLayerId] = useState<string | null>(
    null,
  );
  const [searchByLayer, setSearchByLayer] = useState<Record<string, string>>(
    {},
  );

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
        Legenda
      </h2>

      <div className="space-y-2">
        {relationNodes.length > 0 && (
          <details
            open
            className="rounded border border-indigo-700/70 bg-indigo-950/20"
          >
            <summary className="cursor-pointer px-3 py-2 text-xs font-semibold uppercase tracking-wide text-indigo-200">
              Ligacoes Entre Sites
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
                        Excluir
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
          <p className="text-xs text-slate-400">
            Sem sites ainda. Use a barra superior para criar a rede.
          </p>
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
                    dispatch(addLayer({ siteId: site.id }));
                  }}
                  className="rounded bg-emerald-400 px-2 py-1 text-[10px] font-bold uppercase text-slate-950"
                >
                  + Camada
                </button>
                <button
                  onClick={(event) => {
                    event.preventDefault();
                    dispatch(removeSite(site.id));
                  }}
                  className="rounded bg-rose-500 px-2 py-1 text-[10px] font-bold uppercase"
                >
                  Excluir
                </button>
              </div>
            </summary>

            <div className="space-y-2 px-2 pb-2">
              {site.layers.map((layer) => (
                <details
                  key={layer.id}
                  open
                  className="rounded border border-slate-800 bg-slate-950/40"
                >
                  <summary className="flex cursor-pointer items-center justify-between px-2 py-2 text-xs text-slate-300">
                    <span>{layer.name}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setOpenPickerLayerId((prev) =>
                            prev === layer.id ? null : layer.id,
                          );
                        }}
                        className="rounded bg-amber-300 px-2 py-1 text-[10px] font-bold uppercase text-slate-950"
                      >
                        + Ícone
                      </button>
                      <button
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          dispatch(removeLayer(layer.id));
                        }}
                        className="rounded bg-rose-500 px-2 py-1 text-[10px] font-bold uppercase"
                      >
                        Excluir
                      </button>
                    </div>
                  </summary>

                  {openPickerLayerId === layer.id && (
                    <div
                      className="mx-2 mb-2 rounded border border-[#2f4f75] bg-[#081427] p-2"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-400">
                        <span>Adicionar Componente na Camada</span>
                        <span className="text-cyan-300">
                          Ultimo: [
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
                        placeholder="Buscar tipo (router, firewall, vpn...)"
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
                                  Padrão
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
                        Sem componentes
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
                              Excluir
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
