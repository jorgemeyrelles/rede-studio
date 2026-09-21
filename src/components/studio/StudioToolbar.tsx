import { useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { addFloatingNode, addSite } from '../../features/network/networkSlice';
import type { NodeCategory } from '../../features/network/types';
import {
  getStudioToolbarCopy,
  getNodeIconSrc,
  getNodeVisual,
  RELATION_OPTION_CATEGORIES,
  type StudioLanguage,
} from './catalog';
import LinkInspectorTooltip from './LinkInspectorTooltip';

type StudioToolbarProps = {
  language: StudioLanguage;
  isLegendOpen?: boolean;
  onToggleLegend?: () => void;
};

export default function StudioToolbar({
  language,
  isLegendOpen,
  onToggleLegend,
}: StudioToolbarProps) {
  const dispatch = useAppDispatch();
  const { sites } = useAppSelector((state) => state.network);
  const isSiteLimitReached = sites.length >= 4;
  const activeLinkId = useAppSelector((state) => state.network.ui.activeLinkId);

  const inspectorAnchorRef = useRef<HTMLButtonElement>(null);
  const [floatingCategory, setFloatingCategory] = useState<NodeCategory>('vpn');
  const [openFloatingPicker, setOpenFloatingPicker] = useState(false);
  const [floatingSearch, setFloatingSearch] = useState('');
  const copy = getStudioToolbarCopy(language);

  return (
    <section className="rounded-lg border border-line bg-ink-raised p-3 shadow-[0_0_0_1px_rgba(27,49,77,0.35),0_12px_24px_rgba(0,0,0,0.28)]">
      <div className="grid gap-3 lg:grid-cols-[auto_1fr_auto] lg:items-center">
        <div className="flex items-center gap-2">
          {/* Âncora do inspector de link — não clicável, apenas ponto de referência visual */}
          <button
            ref={inspectorAnchorRef}
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            title="Inspector de conexão"
            className={`flex shrink-0 cursor-default items-center justify-center rounded border px-2 py-1.5 transition-colors ${
              activeLinkId && !isLegendOpen
                ? 'border-accent/60 bg-accent/20 text-accent'
                : 'border-line bg-ink-raised-2 text-chalk-faint'
            }`}
          >
            {/* Ícone: dois nós ligados por uma linha */}
            <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
              <circle cx="2" cy="5" r="2" fill="currentColor" />
              <line
                x1="4"
                y1="5"
                x2="12"
                y2="5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <circle cx="14" cy="5" r="2" fill="currentColor" />
            </svg>
          </button>

          {/* Hamburguer — abre/fecha legenda */}
          {onToggleLegend && (
            <button
              type="button"
              onClick={onToggleLegend}
              aria-label={isLegendOpen ? 'Fechar legenda' : 'Abrir legenda'}
              title={isLegendOpen ? 'Fechar legenda' : 'Abrir legenda'}
              className={`flex shrink-0 flex-col items-center justify-center gap-[5px] rounded border px-2 py-1.5 transition ${
                isLegendOpen
                  ? 'border-accent bg-accent/20 text-accent'
                  : 'border-line bg-ink-raised-2 text-chalk-dim hover:bg-ink-raised'
              }`}
            >
              <span className="block h-[2px] w-4 rounded-full bg-current" />
              <span className="block h-[2px] w-4 rounded-full bg-current" />
              <span className="block h-[2px] w-4 rounded-full bg-current" />
            </button>
          )}
          <button
            onClick={() => dispatch(addSite())}
            disabled={isSiteLimitReached}
            className="btn-planta-solid rounded-md px-3 py-2 text-xs font-bold uppercase tracking-wider"
          >
            {copy.newSite}
          </button>
          <span className="text-xs text-chalk-dim">
            {copy.total}: {sites.length}
          </span>
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
            className="flex items-center gap-2 rounded-md border border-line bg-ink-raised-2 px-2 py-2 text-sm text-chalk"
          >
            <img
              src={getNodeIconSrc(floatingCategory)}
              alt=""
              className="h-4 w-4 object-contain"
            />
            {getNodeVisual(floatingCategory).label}
          </button>

          {openFloatingPicker && (
            <div className="absolute right-0 top-full z-30 mt-1 w-72 rounded border border-line bg-ink-raised-2 p-2 shadow-lg">
              <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-chalk-faint">
                <span>{copy.relationsTitle}</span>
                <span className="text-accent">
                  {copy.active}: [{getNodeVisual(floatingCategory).short}]
                </span>
              </div>
              <input
                value={floatingSearch}
                onChange={(event) => setFloatingSearch(event.target.value)}
                placeholder={copy.searchPlaceholder}
                className="mb-2 w-full rounded border border-line bg-ink-raised-2 px-2 py-1.5 text-[11px] text-chalk outline-none focus:border-accent"
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
                          ? 'border border-accent/60 bg-accent/20 text-accent'
                          : 'border border-line bg-ink-raised-2 text-chalk-dim hover:bg-ink-raised'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <img
                          src={getNodeIconSrc(category)}
                          alt={visual.label}
                          className="h-4 w-4 object-contain"
                        />
                        <span>{visual.label}</span>
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
            className="btn-planta-solid rounded-md px-3 py-2 text-xs font-bold uppercase tracking-wider"
          >
            {copy.addRelationSite}
          </button>
        </div>
      </div>

      <LinkInspectorTooltip
        isLegendOpen={isLegendOpen ?? false}
        anchorRef={inspectorAnchorRef}
      />
    </section>
  );
}
