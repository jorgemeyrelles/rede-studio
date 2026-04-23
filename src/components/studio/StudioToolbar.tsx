import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { addFloatingNode, addSite } from '../../features/network/networkSlice';
import type { NodeCategory } from '../../features/network/types';
import {
  getNodeIconSrc,
  getNodeVisual,
  RELATION_OPTION_CATEGORIES,
} from './catalog';

export default function StudioToolbar() {
  const dispatch = useAppDispatch();
  const { sites } = useAppSelector((state) => state.network);
  const isSiteLimitReached = sites.length >= 4;

  const [floatingCategory, setFloatingCategory] = useState<NodeCategory>('vpn');
  const [openFloatingPicker, setOpenFloatingPicker] = useState(false);
  const [floatingSearch, setFloatingSearch] = useState('');

  return (
    <section className="rounded-lg border border-[#315072] bg-[#0a1324]/80 p-3 shadow-[0_0_0_1px_rgba(27,49,77,0.35),0_12px_24px_rgba(0,0,0,0.28)]">
      <div className="grid gap-3 lg:grid-cols-[auto_1fr_auto] lg:items-center">
        <div className="flex items-center gap-2">
          <button
            onClick={() => dispatch(addSite())}
            disabled={isSiteLimitReached}
            className="rounded-md bg-cyan-300 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-950 hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
          >
            Novo Site
          </button>
          <span className="text-xs text-slate-300">Total: {sites.length}</span>
        </div>

        {/* <div className="flex items-end gap-2">
          <select
            value={selectedSite}
            onChange={(event) => {
              setSelectedSite(event.target.value);
            }}
            className="w-full rounded-md border border-[#2c4464] bg-[#0d1a2e] px-2 py-2 text-sm text-slate-100"
          >
            <option value="">Selecionar site</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
          <button
            onClick={() =>
              selectedSite && dispatch(addLayer({ siteId: selectedSite }))
            }
            disabled={!selectedSite}
            className="rounded-md bg-emerald-300 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-600"
          >
            Nova Camada
          </button>
        </div> */}

        <div className="relative flex items-center gap-2 justify-self-end">
          <button
            type="button"
            onClick={() => setOpenFloatingPicker((prev) => !prev)}
            className="rounded-md border border-[#2c4464] bg-[#0d1a2e] px-2 py-2 text-sm text-slate-100"
          >
            [{getNodeVisual(floatingCategory).short}]{' '}
            {getNodeVisual(floatingCategory).label}
          </button>

          {openFloatingPicker && (
            <div className="absolute right-0 top-full z-30 mt-1 w-72 rounded border border-[#2f4f75] bg-[#081427] p-2 shadow-lg">
              <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-400">
                <span>Relações Entre Sites</span>
                <span className="text-cyan-300">
                  Ativo: [{getNodeVisual(floatingCategory).short}]
                </span>
              </div>
              <input
                value={floatingSearch}
                onChange={(event) => setFloatingSearch(event.target.value)}
                placeholder="Buscar tipo (vpn, ipsec, mpls...)"
                className="mb-2 w-full rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1.5 text-[11px] text-slate-100"
              />
              <div className="theme-scrollbar grid max-h-36 grid-cols-1 gap-1 overflow-y-auto">
                {RELATION_OPTION_CATEGORIES.filter((category) => {
                  const visual = getNodeVisual(category);
                  const query = floatingSearch.trim().toLowerCase();
                  if (!query) return true;
                  return (
                    visual.label.toLowerCase().includes(query) ||
                    visual.short.toLowerCase().includes(query) ||
                    category.toLowerCase().includes(query)
                  );
                }).map((category) => {
                  const visual = getNodeVisual(category);
                  const isSelected = floatingCategory === category;
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => {
                        setFloatingCategory(category);
                        setOpenFloatingPicker(false);
                      }}
                      className={`flex items-center justify-between rounded px-2 py-1 text-left text-[11px] transition ${
                        isSelected
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
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button
            onClick={() =>
              dispatch(addFloatingNode({ category: floatingCategory }))
            }
            className="rounded-md bg-fuchsia-300 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-950"
          >
            + Relação Sites
          </button>
        </div>
      </div>
    </section>
  );
}
