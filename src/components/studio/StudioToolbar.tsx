import {
  Cable,
  ChevronDown,
  PanelLeft,
  Plus,
  Redo2,
  Undo2,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { redo, undo } from '../../features/network/history';
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
import { ui as studioUi } from './utils/studioUi';

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
  const { canUndo, canRedo } = useAppSelector((state) => state.history);

  const inspectorAnchorRef = useRef<HTMLSpanElement>(null);
  const [floatingCategory, setFloatingCategory] = useState<NodeCategory>('vpn');
  const [openFloatingPicker, setOpenFloatingPicker] = useState(false);
  const [floatingSearch, setFloatingSearch] = useState('');
  const copy = getStudioToolbarCopy(language);

  return (
    <section className="rounded-md border border-line bg-ink-raised p-3">
      <div className="grid gap-3 lg:grid-cols-[auto_1fr_auto] lg:items-center">
        <div className="flex items-center gap-2">
          {/* Âncora do inspetor de conexão: indicador visual (não é botão).
              Acende quando há um link selecionado no diagrama. */}
          <span
            ref={inspectorAnchorRef}
            aria-hidden="true"
            title={studioUi().connectionInspector}
            className={`flex h-7 w-7 shrink-0 items-center justify-center transition-colors ${
              activeLinkId && !isLegendOpen ? 'text-accent' : 'text-chalk-faint'
            }`}
          >
            <Cable size={15} />
          </span>

          {/* Hamburguer — abre/fecha legenda */}
          {onToggleLegend && (
            <button
              type="button"
              onClick={onToggleLegend}
              aria-label={isLegendOpen ? copy.closeLegend : copy.openLegend}
              aria-expanded={isLegendOpen}
              aria-controls="studio-structure-drawer"
              title={isLegendOpen ? copy.closeLegend : copy.openLegend}
              className={`btn btn-sm btn-icon border ${
                isLegendOpen
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-line text-chalk-dim enabled:hover:bg-ink-raised-2 enabled:hover:text-chalk'
              }`}
            >
              <PanelLeft size={15} aria-hidden="true" />
            </button>
          )}
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => dispatch(undo())}
              disabled={!canUndo}
              aria-label={copy.undo}
              title={copy.undo}
              className="btn btn-ghost btn-sm btn-icon"
            >
              <Undo2 size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => dispatch(redo())}
              disabled={!canRedo}
              aria-label={copy.redo}
              title={copy.redo}
              className="btn btn-ghost btn-sm btn-icon"
            >
              <Redo2 size={15} aria-hidden="true" />
            </button>
          </div>
          <span className="h-5 w-px bg-line" aria-hidden="true" />
          <button
            onClick={() => dispatch(addSite())}
            disabled={isSiteLimitReached}
            className="btn btn-primary btn-sm"
          >
            <Plus size={14} aria-hidden="true" />
            {copy.newSite}
          </button>
          <span className="text-xs tabular-nums text-chalk-faint">
            {sites.length}/4 {copy.sitesCount}
          </span>
        </div>

        <div className="relative flex items-center gap-2 justify-self-end">
          <button
            type="button"
            onClick={() => setOpenFloatingPicker((prev) => !prev)}
            aria-expanded={openFloatingPicker}
            aria-haspopup="listbox"
            className="btn btn-secondary btn-sm"
          >
            <img
              src={getNodeIconSrc(floatingCategory)}
              alt=""
              className="h-4 w-4 object-contain"
            />
            {getNodeVisual(floatingCategory).label}
            <ChevronDown
              size={13}
              aria-hidden="true"
              className="text-chalk-faint"
            />
          </button>

          {openFloatingPicker && (
            <div className="absolute right-0 top-full z-30 mt-1 w-72 rounded-md border border-line bg-ink-raised p-2 shadow-panel">
              <div className="text-label mb-2 flex items-center justify-between text-chalk-faint">
                <span>{copy.relationsTitle}</span>
                <span className="text-accent">
                  {copy.active}: [{getNodeVisual(floatingCategory).short}]
                </span>
              </div>
              <input
                value={floatingSearch}
                onChange={(event) => setFloatingSearch(event.target.value)}
                placeholder={copy.searchPlaceholder}
                className="field-sm mb-2"
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
                      className={`flex items-center justify-between rounded-sm px-2 py-1.5 text-left text-xs transition-colors ${
                        isSelected
                          ? 'bg-accent/15 text-accent'
                          : 'text-chalk-dim hover:bg-ink-raised-2 hover:text-chalk'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <img
                          src={getNodeIconSrc(category)}
                          alt=""
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
            className="btn btn-secondary btn-sm"
          >
            <Plus size={14} aria-hidden="true" />
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
