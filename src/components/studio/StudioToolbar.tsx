import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  addFloatingNode,
  addSite,
} from '../../features/network/networkSlice';
import type { NodeCategory } from '../../features/network/types';
import { getNodeVisual, RELATION_OPTION_CATEGORIES } from './catalog';

export default function StudioToolbar() {
  const dispatch = useAppDispatch();
  const { sites } = useAppSelector((state) => state.network);
  const isSiteLimitReached = sites.length >= 4;

  const [floatingCategory, setFloatingCategory] = useState<NodeCategory>('vpn');

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

        <div className="flex items-center gap-2 justify-self-end">
          <select
            value={floatingCategory}
            onChange={(event) =>
              setFloatingCategory(event.target.value as NodeCategory)
            }
            className="rounded-md border border-[#2c4464] bg-[#0d1a2e] px-2 py-2 text-sm text-slate-100"
          >
            {RELATION_OPTION_CATEGORIES.map((option) => {
              const visual = getNodeVisual(option);
              return (
                <option key={option} value={option}>
                  [{visual.short}] {visual.label}
                </option>
              );
            })}
          </select>
          <button
            onClick={() =>
              dispatch(addFloatingNode({ category: floatingCategory }))
            }
            className="rounded-md bg-fuchsia-300 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-950"
          >
            Ícone relação sites
          </button>
        </div>
      </div>
    </section>
  );
}
