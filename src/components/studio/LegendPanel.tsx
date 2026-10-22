import {
  ChevronDown,
  ChevronRight,
  Ellipsis,
  Info,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  addLayer,
  addNode,
  addSiteNetwork,
  removeLayer,
  removeNode,
  removeSite,
  removeSiteNetwork,
} from '../../features/network/networkSlice';
import {
  selectLegendTree,
  selectNetworkReadiness,
} from '../../features/network/selectors';
import type {
  AddressFamily,
  LayerTier,
  NetworkDnsPolicy,
  NetworkGatewayMode,
  NetworkPurpose,
  NetworkStackMode,
  NetworkTrafficPreference,
  NodeCategory,
  SiteNetwork,
} from '../../features/network/types';
import {
  buildNetworkAddress,
  cidrToHostCount,
} from '../../features/network/utils';
import Modal from '../Modal';
import {
  ENDPOINT_CATEGORIES,
  getLegendPanelCopy,
  getNodeIconSrc,
  getNodeVisual,
  getTierLabel,
  NODE_OPTION_CATEGORIES,
  RELATION_OPTION_CATEGORIES,
  roleFamilyOf,
  type DeviceRoleFamily,
  type StudioLanguage,
} from './catalog';
import { ui as studioUi } from './utils/studioUi';

/**
 * Painel "Estrutura" (antes "Legenda") — árvore Site → LAN → camada (tier)
 * → componente, que organiza e edita a topologia.
 *
 * - Ações por linha sob demanda (`+` adicionar filho, `⋯` menu), visíveis no
 *   hover/foco; destrutivo só dentro do menu (com "Desfazer" no Studio).
 * - Dentro de cada LAN, o "esqueleto" de tiers na ordem real do diagrama:
 *   tiers que faltam aparecem como linhas tracejadas e são criadas com 1
 *   clique (nome padrão, editável depois).
 * - Clicar num componente o localiza no diagrama (evento
 *   `rede:focus-node`); selecionar no diagrama destaca a linha aqui
 *   (`rede:diagram-selection`).
 */

type LegendPanelProps = {
  language: StudioLanguage;
};

const LAN_LIMIT_PER_SITE = 2;

/** Tiers únicos, na ordem do diagrama (`tierRules.ts`). */
const SKELETON_HEAD: LayerTier[] = ['edge', 'distribution', 'access', 'server'];
const SKELETON_TAIL: LayerTier[] = ['endpoint'];
/** Tiers livres — podem se repetir; oferecidos em "Outra camada". */
const FREE_TIERS: LayerTier[] = ['dmz', 'management', 'custom'];

const TIER_DOT: Record<LayerTier, string> = {
  edge: 'bg-tier-edge',
  distribution: 'bg-tier-distribution',
  access: 'bg-tier-access',
  server: 'bg-tier-server',
  endpoint: 'bg-tier-endpoint',
  dmz: 'bg-tier-dmz',
  management: 'bg-tier-management',
  custom: 'bg-tier-custom',
};

const FAMILY_DOT: Record<DeviceRoleFamily, string> = {
  perimeter: 'bg-tier-edge',
  switching: 'bg-tier-distribution',
  services: 'bg-tier-server',
  tunnels: 'bg-route-vpn',
  endpoints: 'bg-tier-endpoint',
};

const FAMILY_ORDER: DeviceRoleFamily[] = [
  'perimeter',
  'switching',
  'services',
  'endpoints',
  'tunnels',
];

/** Cor da borda/identidade da LAN por finalidade (mesma do diagrama). */
const PURPOSE_DOT: Record<NetworkPurpose, string> = {
  principal: 'bg-tier-edge',
  dmz: 'bg-tier-dmz',
  gestao: 'bg-tier-management',
  cliente: 'bg-tier-access',
  backup: 'bg-tier-distribution',
  custom: 'bg-tier-custom',
};

type NetworkDraft = {
  name: string;
  purpose: NetworkPurpose;
  addressFamily: AddressFamily;
  stackMode: NetworkStackMode;
  trafficPreference: NetworkTrafficPreference;
  gatewayMode: NetworkGatewayMode;
  dnsPolicy: NetworkDnsPolicy;
  ipv6Prefix: string;
  thirdOctet: string;
  cidr: string;
};

const DEFAULT_NETWORK_DRAFT: NetworkDraft = {
  name: '',
  purpose: 'principal',
  addressFamily: '200.x',
  stackMode: 'ipv4',
  trafficPreference: 'ipv4-preferred',
  gatewayMode: 'ipv4-only',
  dnsPolicy: 'a-only',
  ipv6Prefix: '',
  thirdOctet: '1',
  cidr: '24',
};

/** Calcula o próximo thirdOctet disponível para uma família no site */
function suggestNextThirdOctet(
  siteId: string,
  family: AddressFamily,
  existing: SiteNetwork[],
): number {
  const familyNets = existing.filter(
    (n) => n.siteId === siteId && n.addressFamily === family,
  );
  if (familyNets.length === 0) return 1;
  let maxEnd = 0;
  for (const net of familyNets) {
    // blocos /cidr < 24 consomem vários terceiros-octetos
    const octetsConsumed = net.cidr < 24 ? Math.pow(2, 24 - net.cidr) : 1;
    const end = net.thirdOctet + Math.ceil(octetsConsumed);
    if (end > maxEnd) maxEnd = end;
  }
  return Math.min(255, maxEnd);
}

function suggestNetworkIpv6Prefix(
  siteOctet: number,
  thirdOctet: number,
): string {
  const safeSite = Math.max(0, Math.min(255, siteOctet));
  const safeThird = Math.max(0, Math.min(255, thirdOctet));
  const siteHex = safeSite.toString(16).padStart(2, '0');
  const thirdHex = safeThird.toString(16).padStart(2, '0');
  return `2001:db8:${siteHex}:${thirdHex}::/56`;
}

/** Entradas do seletor de componente: categorias + "remoto" dos endpoints. */
const NODE_PICKER_ENTRIES: { category: NodeCategory; isRemote: boolean }[] = [
  ...NODE_OPTION_CATEGORIES.map((category) => ({ category, isRemote: false })),
  ...ENDPOINT_CATEGORIES.map((category) => ({ category, isRemote: true })),
];

// ── Primitivos da árvore ─────────────────────────────────────────────────────

type RowMenuItem = {
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  danger?: boolean;
};

function RowMenu({ label, items }: { label: string; items: RowMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey, true);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey, true);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        className="flex h-6 w-6 items-center justify-center rounded-sm text-chalk-faint transition-colors hover:bg-ink-raised-2 hover:text-chalk"
      >
        <Ellipsis size={14} aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+4px)] z-20 w-52 overflow-hidden rounded-md border border-line bg-ink-raised py-1 shadow-panel"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
                item.onSelect();
              }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
                item.danger
                  ? 'text-signal-down hover:bg-signal-down/10'
                  : 'text-chalk-dim hover:bg-ink-raised-2 hover:text-chalk'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type TreeRowProps = {
  level: number;
  label: ReactNode;
  meta?: ReactNode;
  leading?: ReactNode;
  expanded?: boolean;
  onToggle?: () => void;
  onActivate?: () => void;
  selected?: boolean;
  actions?: ReactNode;
  rowId?: string;
};

/** Linha da árvore: 32px, recuo de 16px por nível, ações no hover/foco. */
function TreeRow({
  level,
  label,
  meta,
  leading,
  expanded,
  onToggle,
  onActivate,
  selected,
  actions,
  rowId,
}: TreeRowProps) {
  const hasChildren = onToggle !== undefined;
  return (
    <div
      role="treeitem"
      aria-level={level}
      aria-expanded={hasChildren ? expanded : undefined}
      aria-selected={selected || undefined}
      tabIndex={-1}
      data-tree-row=""
      data-row-id={rowId}
      onClick={() => (onActivate ? onActivate() : onToggle?.())}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          if (onActivate) onActivate();
          else onToggle?.();
        } else if (event.key === 'ArrowRight' && hasChildren && !expanded) {
          event.preventDefault();
          onToggle?.();
        } else if (event.key === 'ArrowLeft' && hasChildren && expanded) {
          event.preventDefault();
          onToggle?.();
        }
      }}
      style={{ paddingLeft: `${(level - 1) * 16 + 4}px` }}
      className={`group flex h-8 cursor-pointer items-center gap-1.5 rounded-sm pr-1 text-sm outline-none transition-colors focus-visible:outline-1 focus-visible:-outline-offset-1 ${
        selected
          ? 'bg-accent/10 text-chalk'
          : 'text-chalk-dim hover:bg-ink-raised-2 hover:text-chalk'
      }`}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-chalk-faint">
        {hasChildren &&
          (expanded ? (
            <ChevronDown size={13} aria-hidden="true" />
          ) : (
            <ChevronRight size={13} aria-hidden="true" />
          ))}
      </span>
      {leading}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {meta && (
        <span className="shrink-0 font-mono text-2xs text-chalk-faint">
          {meta}
        </span>
      )}
      {actions && (
        <span
          className={`flex shrink-0 items-center gap-0.5 transition-opacity ${
            selected
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 group-focus:opacity-100'
          }`}
          onClick={(event) => event.stopPropagation()}
        >
          {actions}
        </span>
      )}
    </div>
  );
}

function IconAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      aria-label={label}
      title={label}
      className="flex h-6 w-6 items-center justify-center rounded-sm text-chalk-faint transition-colors hover:bg-ink-raised-2 hover:text-accent"
    >
      {children}
    </button>
  );
}

/** Linha "fantasma" (tracejada) que cria algo com 1 clique. */
function GhostRow({
  level,
  label,
  dot,
  onClick,
}: {
  level: number;
  label: string;
  dot?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        marginLeft: `${(level - 1) * 16 + 24}px`,
        width: `calc(100% - ${(level - 1) * 16 + 28}px)`,
      }}
      className="flex h-7 items-center gap-2 rounded-sm border border-dashed border-line px-2 text-left text-xs text-chalk-faint transition-colors hover:border-accent/60 hover:text-chalk"
    >
      <Plus size={12} aria-hidden="true" />
      {dot && (
        <span
          className={`h-2 w-2 shrink-0 rounded-full opacity-60 ${dot}`}
          aria-hidden="true"
        />
      )}
      {label}
    </button>
  );
}

// ── Painel ──────────────────────────────────────────────────────────────────

export default function LegendPanel({ language }: LegendPanelProps) {
  const dispatch = useAppDispatch();
  const legendTree = useAppSelector(selectLegendTree);
  const readinessRows = useAppSelector(selectNetworkReadiness);
  const { nodes, links, sites, siteVlans, layers, siteNetworks } =
    useAppSelector((state) => state.network);
  const copy = getLegendPanelCopy(language);
  const ui = studioUi();

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [pickerLayerId, setPickerLayerId] = useState<string | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerRemote, setPickerRemote] = useState(false);
  const [lastUsedByLayer, setLastUsedByLayer] = useState<
    Record<string, { category: NodeCategory; isRemote: boolean }>
  >({});
  const [freeTierMenuFor, setFreeTierMenuFor] = useState<string | null>(null);
  const [networkInfoId, setNetworkInfoId] = useState<string | null>(null);
  const [networkFormSiteId, setNetworkFormSiteId] = useState<string | null>(
    null,
  );
  const [networkDraft, setNetworkDraft] = useState<NetworkDraft>(
    DEFAULT_NETWORK_DRAFT,
  );
  const treeRef = useRef<HTMLDivElement | null>(null);

  const isExpanded = (id: string) => !collapsed[id];
  const toggle = (id: string) =>
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

  // Diagrama → árvore: destaca e rola até o componente selecionado lá.
  useEffect(() => {
    const handler = (event: Event) => {
      const nodeId = (event as CustomEvent<{ nodeId: string | null }>).detail
        ?.nodeId;
      setSelectedNodeId(nodeId ?? null);
      if (!nodeId) return;
      requestAnimationFrame(() => {
        treeRef.current
          ?.querySelector(`[data-row-id="${CSS.escape(nodeId)}"]`)
          ?.scrollIntoView({ block: 'nearest' });
      });
    };
    window.addEventListener('rede:diagram-selection', handler);
    return () => window.removeEventListener('rede:diagram-selection', handler);
  }, []);

  // Árvore → diagrama.
  const focusNodeInDiagram = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    window.dispatchEvent(
      new CustomEvent('rede:focus-node', { detail: { nodeId } }),
    );
  };

  // Setas ↑/↓ percorrem as linhas visíveis da árvore (Home/End nas pontas).
  const handleTreeKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const rows = Array.from(
      treeRef.current?.querySelectorAll<HTMLElement>('[data-tree-row]') ?? [],
    );
    if (rows.length === 0) return;
    event.preventDefault();
    const index = rows.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? rows.length - 1
          : event.key === 'ArrowDown'
            ? Math.min(rows.length - 1, index + 1)
            : Math.max(0, index - 1);
    rows[next]?.focus();
  };

  const purposeLabel = (purpose: string) =>
    ({
      principal: ui.purposePrincipal,
      dmz: ui.purposeDmz,
      gestao: ui.purposeGestao,
      cliente: ui.purposeCliente,
      backup: ui.purposeBackup,
      custom: ui.purposeCustom,
    })[purpose] ?? purpose;

  const familyLabel: Record<DeviceRoleFamily, string> = {
    perimeter: ui.familyPerimeter,
    switching: ui.familySwitching,
    services: ui.familyServices,
    endpoints: ui.familyEndpoints,
    tunnels: ui.familyTunnels,
  };

  const relationNodes = nodes.filter(
    (node) =>
      !node.siteId &&
      !node.layerId &&
      node.category !== 'wan' &&
      RELATION_OPTION_CATEGORIES.includes(node.category),
  );

  // ── Ações ──────────────────────────────────────────────────────────────────

  function createTier(
    siteId: string,
    networkId: string | undefined,
    tier: LayerTier,
  ) {
    dispatch(addLayer({ siteId, networkId, tier }));
    setFreeTierMenuFor(null);
  }

  function openNetworkForm(siteId: string) {
    const suggested = suggestNextThirdOctet(
      siteId,
      DEFAULT_NETWORK_DRAFT.addressFamily,
      siteNetworks ?? [],
    );
    const siteOctet = sites.find((s) => s.id === siteId)?.ipOctet ?? 0;
    setNetworkDraft({
      ...DEFAULT_NETWORK_DRAFT,
      thirdOctet: String(suggested),
      ipv6Prefix: suggestNetworkIpv6Prefix(siteOctet, suggested),
    });
    setNetworkFormSiteId(siteId);
  }

  function confirmNetwork() {
    if (!networkFormSiteId) return;
    const thirdOctet = Number(networkDraft.thirdOctet);
    const cidr = Number(networkDraft.cidr);
    if (!Number.isFinite(thirdOctet) || !Number.isFinite(cidr)) return;
    dispatch(
      addSiteNetwork({
        siteId: networkFormSiteId,
        name: networkDraft.name.trim() || 'LAN',
        purpose: networkDraft.purpose,
        addressFamily: networkDraft.addressFamily,
        stackMode: networkDraft.stackMode,
        trafficPreference: networkDraft.trafficPreference,
        gatewayMode: networkDraft.gatewayMode,
        dnsPolicy: networkDraft.dnsPolicy,
        ipv6Prefix: networkDraft.ipv6Prefix.trim() || undefined,
        ipv6VlanPrefixLength: 64,
        thirdOctet,
        cidr,
      }),
    );
    setNetworkFormSiteId(null);
  }

  function addComponent(
    siteId: string,
    layerId: string,
    category: NodeCategory,
    isRemote: boolean,
  ) {
    setLastUsedByLayer((prev) => ({
      ...prev,
      [layerId]: { category, isRemote },
    }));
    dispatch(addNode({ siteId, layerId, category, isRemote }));
    setPickerLayerId(null);
    setPickerSearch('');
  }

  // ── Renderização ───────────────────────────────────────────────────────────

  type LayerEntry = (typeof legendTree)[number]['layers'][number];

  function renderComponentPicker(layer: LayerEntry, siteId: string) {
    const query = pickerSearch.trim().toLowerCase();
    const lastUsed = lastUsedByLayer[layer.id];
    const entries = NODE_PICKER_ENTRIES.filter(
      (entry) => entry.isRemote === pickerRemote,
    ).filter(({ category }) => {
      if (!query) return true;
      const visual = getNodeVisual(category);
      return (
        visual.label.toLowerCase().includes(query) ||
        visual.short.toLowerCase().includes(query) ||
        category.toLowerCase().includes(query)
      );
    });
    const byFamily = FAMILY_ORDER.map((family) => ({
      family,
      items: entries.filter(
        ({ category }) => roleFamilyOf(category) === family,
      ),
    })).filter((group) => group.items.length > 0);

    return (
      <div
        className="mb-1 ml-10 mr-1 rounded-md border border-line bg-ink p-2"
        onClick={(event) => event.stopPropagation()}
      >
        <label className="relative mb-2 block">
          <Search
            size={13}
            aria-hidden="true"
            className="absolute left-2 top-1/2 -translate-y-1/2 text-chalk-faint"
          />
          <input
            autoFocus
            value={pickerSearch}
            onChange={(event) => setPickerSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setPickerLayerId(null);
            }}
            placeholder={copy.searchTypePlaceholder}
            aria-label={ui.addComponent}
            className="field-sm pl-7"
          />
        </label>
        <label className="mb-2 flex items-center gap-2 text-xs text-chalk-dim">
          <input
            type="checkbox"
            checked={pickerRemote}
            onChange={(event) => setPickerRemote(event.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--accent)]"
          />
          {ui.remoteToggle}
        </label>
        <div className="theme-scrollbar max-h-56 space-y-2 overflow-y-auto pr-1">
          {byFamily.length === 0 && (
            <p className="px-1 py-2 text-xs text-chalk-faint">
              {ui.noTypeMatch}
            </p>
          )}
          {byFamily.map(({ family, items }) => (
            <div key={family}>
              <p className="text-label mb-1 flex items-center gap-1.5 px-1 text-chalk-faint">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${FAMILY_DOT[family]}`}
                  aria-hidden="true"
                />
                {familyLabel[family]}
              </p>
              <div className="grid grid-cols-2 gap-1">
                {items.map(({ category, isRemote }) => {
                  const visual = getNodeVisual(category);
                  const isLast =
                    lastUsed?.category === category &&
                    lastUsed?.isRemote === isRemote;
                  return (
                    <button
                      key={`${category}-${isRemote}`}
                      type="button"
                      onClick={() =>
                        addComponent(siteId, layer.id, category, isRemote)
                      }
                      title={isLast ? ui.lastUsed : undefined}
                      className={`flex h-8 items-center gap-2 rounded-sm border px-2 text-left text-xs transition-colors ${
                        isLast
                          ? 'border-accent/60 text-chalk'
                          : 'border-transparent text-chalk-dim hover:border-line hover:bg-ink-raised-2 hover:text-chalk'
                      }`}
                    >
                      <img
                        src={getNodeIconSrc(category)}
                        alt=""
                        className="h-4 w-4 shrink-0 object-contain"
                      />
                      <span className="truncate">{visual.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderLayer(layer: LayerEntry, siteId: string, level: number) {
    const tier = (layer.tier ?? 'custom') as LayerTier;
    const expanded = isExpanded(layer.id);
    return (
      <div key={layer.id} role="group">
        <TreeRow
          level={level}
          rowId={layer.id}
          expanded={expanded}
          onToggle={() => toggle(layer.id)}
          leading={
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${TIER_DOT[tier]}`}
              aria-hidden="true"
            />
          }
          label={layer.name}
          meta={layer.nodes.length > 0 ? String(layer.nodes.length) : undefined}
          actions={
            <>
              <IconAction
                label={ui.addComponent}
                onClick={() => {
                  setPickerSearch('');
                  setPickerRemote(lastUsedByLayer[layer.id]?.isRemote ?? false);
                  setPickerLayerId((prev) =>
                    prev === layer.id ? null : layer.id,
                  );
                  setCollapsed((prev) => ({ ...prev, [layer.id]: false }));
                }}
              >
                <Plus size={14} aria-hidden="true" />
              </IconAction>
              <RowMenu
                label={ui.rowActions}
                items={[
                  {
                    label: ui.deleteTier,
                    icon: <Trash2 size={13} aria-hidden="true" />,
                    danger: true,
                    onSelect: () => dispatch(removeLayer(layer.id)),
                  },
                ]}
              />
            </>
          }
        />
        {pickerLayerId === layer.id && renderComponentPicker(layer, siteId)}
        {expanded && (
          <div
            role="group"
            className="ml-[calc(var(--indent)+11px)] border-l border-line"
            style={{ ['--indent' as string]: `${(level - 1) * 16}px` }}
          >
            {layer.nodes.length === 0 && pickerLayerId !== layer.id && (
              <p className="py-1 pl-6 text-xs text-chalk-faint">
                {copy.noComponents}
              </p>
            )}
            {layer.nodes.map((node) => {
              const family = roleFamilyOf(node.category);
              return (
                <TreeRow
                  key={node.id}
                  level={level + 1}
                  rowId={node.id}
                  selected={selectedNodeId === node.id}
                  onActivate={() => focusNodeInDiagram(node.id)}
                  leading={
                    <span className="relative flex shrink-0">
                      <img
                        src={getNodeIconSrc(node.category)}
                        alt=""
                        className="h-4 w-4 object-contain"
                      />
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full ring-1 ring-ink-raised ${FAMILY_DOT[family]}`}
                        aria-hidden="true"
                      />
                    </span>
                  }
                  label={
                    <span className="font-mono text-xs">{node.label}</span>
                  }
                  meta={
                    node.children.length > 0
                      ? `↔ ${node.children.length}`
                      : undefined
                  }
                  actions={
                    <RowMenu
                      label={ui.rowActions}
                      items={[
                        {
                          label: ui.deleteComponent,
                          icon: <Trash2 size={13} aria-hidden="true" />,
                          danger: true,
                          onSelect: () => dispatch(removeNode(node.id)),
                        },
                      ]}
                    />
                  }
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }

  /** Esqueleto da LAN: tiers existentes na ordem do diagrama + fantasmas. */
  function renderLanTiers(
    siteId: string,
    networkId: string,
    lanLayers: LayerEntry[],
    level: number,
  ) {
    const byTier = (tier: LayerTier) =>
      lanLayers.filter((layer) => (layer.tier ?? 'custom') === tier);
    const freeLayers = lanLayers.filter((layer) =>
      FREE_TIERS.includes((layer.tier ?? 'custom') as LayerTier),
    );
    const menuKey = `${siteId}:${networkId}`;

    const renderSlot = (tier: LayerTier) => {
      const existing = byTier(tier);
      if (existing.length > 0) {
        return existing.map((layer) => renderLayer(layer, siteId, level));
      }
      return (
        <GhostRow
          key={`ghost-${tier}`}
          level={level}
          dot={TIER_DOT[tier]}
          label={`${ui.addTierNamed} ${getTierLabel(tier, language, '')}`}
          onClick={() => createTier(siteId, networkId, tier)}
        />
      );
    };

    return (
      <div className="space-y-0.5 py-0.5">
        {SKELETON_HEAD.map((tier) => renderSlot(tier))}
        {freeLayers.map((layer) => renderLayer(layer, siteId, level))}
        {freeTierMenuFor === menuKey ? (
          <div
            className="flex flex-wrap gap-1 py-0.5"
            style={{ marginLeft: `${(level - 1) * 16 + 24}px` }}
          >
            {FREE_TIERS.map((tier) => (
              <button
                key={tier}
                type="button"
                autoFocus={tier === FREE_TIERS[0]}
                onClick={() => createTier(siteId, networkId, tier)}
                className="flex h-7 items-center gap-1.5 rounded-sm border border-line px-2 text-xs text-chalk-dim transition-colors hover:border-accent/60 hover:text-chalk"
              >
                <span
                  className={`h-2 w-2 rounded-full ${TIER_DOT[tier]}`}
                  aria-hidden="true"
                />
                {tier === 'custom'
                  ? ui.tierFree
                  : getTierLabel(tier, language, '')}
              </button>
            ))}
          </div>
        ) : (
          <GhostRow
            level={level}
            label={ui.otherTier}
            onClick={() => setFreeTierMenuFor(menuKey)}
          />
        )}
        {SKELETON_TAIL.map((tier) => renderSlot(tier))}
      </div>
    );
  }

  function renderNetworkInfo(network: SiteNetwork, siteOctet: number) {
    const baseAddr = buildNetworkAddress(
      network.addressFamily as AddressFamily,
      network.thirdOctet,
      siteOctet,
    );
    const hosts = cidrToHostCount(network.cidr);
    const vlanCount = (siteVlans ?? []).filter(
      (v) => v.networkId === network.id,
    ).length;
    const layerCount = (layers ?? []).filter(
      (l) => l.networkId === network.id,
    ).length;
    const readiness = readinessRows.find(
      (item) => item.networkId === network.id,
    );
    const readinessLabel =
      readiness?.level === 'critical'
        ? copy.networkReadinessCritical
        : readiness?.level === 'warning'
          ? copy.networkReadinessWarning
          : copy.networkReadinessReady;
    const rows: [string, ReactNode][] = [
      [
        ui.networkBlock,
        <span className="font-mono text-chalk">
          {baseAddr}/{network.cidr}
        </span>,
      ],
      [ui.networkFamily, network.addressFamily],
      ['Stack', network.stackMode ?? 'ipv4'],
      [
        copy.networkTrafficPreferenceLabel,
        network.trafficPreference ?? 'ipv4-preferred',
      ],
      ['Gateway', network.gatewayMode ?? 'ipv4-only'],
      ['DNS', network.dnsPolicy ?? 'a-only'],
      ['IPv6', network.ipv6Prefix || '—'],
      [ui.networkHosts, hosts.toLocaleString(language)],
      [ui.networkVlans, vlanCount],
      [ui.networkLayers, layerCount],
    ];
    return (
      <div
        className="mb-1 ml-10 mr-1 rounded-md border border-line bg-ink p-2 text-xs"
        onClick={(event) => event.stopPropagation()}
      >
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-chalk-faint">{label}</dt>
              <dd className="truncate text-right text-chalk-dim">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
          <span className="text-chalk-faint">{copy.networkReadinessLabel}</span>
          <span
            className={`font-semibold ${
              readiness?.level === 'critical'
                ? 'text-signal-down'
                : readiness?.level === 'warning'
                  ? 'text-signal-warn'
                  : 'text-signal-up'
            }`}
          >
            {readinessLabel}
          </span>
        </div>
        {(readiness?.issues.length ?? 0) > 0 && (
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-signal-warn">
            {readiness?.issues.slice(0, 4).map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const NETWORK_PURPOSE_OPTIONS: NetworkPurpose[] = [
    'principal',
    'dmz',
    'gestao',
    'cliente',
    'backup',
    'custom',
  ];
  const NETWORK_FAMILY_OPTIONS: { value: AddressFamily; label: string }[] = [
    { value: '200.x', label: ui.familyLegacy },
    { value: '10.x', label: `10.x (${ui.familyPrivate})` },
    { value: '172.x', label: `172.16.x (${ui.familyPrivate})` },
    { value: '192.168.x', label: `192.168.x (${ui.familyPrivate})` },
  ];
  const NETWORK_STACK_OPTIONS: { value: NetworkStackMode; label: string }[] = [
    { value: 'ipv4', label: 'IPv4 only' },
    { value: 'dual-stack', label: 'Dual-stack' },
    { value: 'ipv6-ready', label: 'IPv6 ready' },
  ];
  const NETWORK_TRAFFIC_OPTIONS: {
    value: NetworkTrafficPreference;
    label: string;
  }[] = [
    { value: 'ipv4-preferred', label: copy.networkTrafficIpv4Preferred },
    { value: 'balanced', label: copy.networkTrafficBalanced },
    { value: 'ipv6-preferred', label: copy.networkTrafficIpv6Preferred },
    { value: 'ipv6-strict', label: copy.networkTrafficIpv6Strict },
  ];
  const NETWORK_GATEWAY_OPTIONS: {
    value: NetworkGatewayMode;
    label: string;
  }[] = [
    { value: 'ipv4-only', label: 'IPv4 only' },
    { value: 'dual-gateway', label: 'Dual gateway (v4+v6)' },
  ];
  const NETWORK_DNS_OPTIONS: { value: NetworkDnsPolicy; label: string }[] = [
    { value: 'a-only', label: 'A only' },
    { value: 'a-aaaa', label: 'A + AAAA' },
  ];

  const formSite = useMemo(
    () => sites.find((s) => s.id === networkFormSiteId) ?? null,
    [sites, networkFormSiteId],
  );

  const selectField = (
    label: string,
    value: string,
    options: { value: string; label: string }[],
    onChange: (value: string) => void,
  ) => (
    <label className="flex flex-col gap-1.5 text-xs font-medium text-chalk-dim">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="field"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <aside className="theme-scrollbar flex h-full min-h-0 flex-col overflow-y-auto rounded-md border border-line bg-ink-raised shadow-overlay">
      <header className="sticky top-0 z-10 border-b border-line bg-ink-raised px-3 py-3">
        <h2 className="panel-title">{copy.title}</h2>
        <p className="mt-0.5 text-xs text-chalk-faint">{ui.structureHint}</p>
      </header>

      <div
        ref={treeRef}
        role="tree"
        aria-label={copy.title}
        onKeyDown={handleTreeKeyDown}
        className="flex-1 space-y-3 p-2"
      >
        {relationNodes.length > 0 && (
          <section>
            <p className="text-label px-1 pb-1 text-chalk-faint">
              {copy.relationBetweenSites}
            </p>
            {relationNodes.map((node) => {
              const relatedCount = links.filter(
                (link) => link.from === node.id || link.to === node.id,
              ).length;
              return (
                <TreeRow
                  key={node.id}
                  level={1}
                  rowId={node.id}
                  selected={selectedNodeId === node.id}
                  onActivate={() => focusNodeInDiagram(node.id)}
                  leading={
                    <img
                      src={getNodeIconSrc(node.category)}
                      alt=""
                      className="h-4 w-4 shrink-0 object-contain"
                    />
                  }
                  label={
                    <span className="font-mono text-xs">{node.label}</span>
                  }
                  meta={relatedCount > 0 ? `↔ ${relatedCount}` : undefined}
                  actions={
                    <RowMenu
                      label={ui.rowActions}
                      items={[
                        {
                          label: ui.deleteComponent,
                          icon: <Trash2 size={13} aria-hidden="true" />,
                          danger: true,
                          onSelect: () => dispatch(removeNode(node.id)),
                        },
                      ]}
                    />
                  }
                />
              );
            })}
          </section>
        )}

        {legendTree.length === 0 && (
          <p className="px-2 py-6 text-center text-sm text-chalk-dim">
            {copy.emptySites}
          </p>
        )}

        {legendTree.map((site) => {
          const siteLanCount = (siteNetworks ?? []).filter(
            (n) => n.siteId === site.id,
          ).length;
          const canAddLan = siteLanCount < LAN_LIMIT_PER_SITE;
          const siteExpanded = isExpanded(site.id);
          return (
            <section key={site.id} className="rounded-md border border-line">
              <TreeRow
                level={1}
                rowId={site.id}
                expanded={siteExpanded}
                onToggle={() => toggle(site.id)}
                label={
                  <span className="font-display text-sm font-semibold text-chalk">
                    {site.name}
                  </span>
                }
                meta={`${siteLanCount}/${LAN_LIMIT_PER_SITE} LAN`}
                actions={
                  <>
                    {canAddLan && (
                      <IconAction
                        label={ui.newLan}
                        onClick={() => openNetworkForm(site.id)}
                      >
                        <Plus size={14} aria-hidden="true" />
                      </IconAction>
                    )}
                    <RowMenu
                      label={ui.rowActions}
                      items={[
                        {
                          label: ui.deleteSite,
                          icon: <Trash2 size={13} aria-hidden="true" />,
                          danger: true,
                          onSelect: () => dispatch(removeSite(site.id)),
                        },
                      ]}
                    />
                  </>
                }
              />

              {siteExpanded && (
                <div className="space-y-1 px-1 pb-2" role="group">
                  {site.networks.map((network) => {
                    const lanExpanded = isExpanded(network.id);
                    const purpose = network.purpose as NetworkPurpose;
                    return (
                      <div key={network.id} role="group">
                        <TreeRow
                          level={2}
                          rowId={network.id}
                          expanded={lanExpanded}
                          onToggle={() => toggle(network.id)}
                          leading={
                            <span
                              className={`h-2.5 w-2.5 shrink-0 rounded-sm ${PURPOSE_DOT[purpose] ?? 'bg-tier-custom'}`}
                              aria-hidden="true"
                            />
                          }
                          label={
                            <span className="text-chalk">
                              {network.name}{' '}
                              <span className="text-xs text-chalk-faint">
                                · {purposeLabel(network.purpose)}
                              </span>
                            </span>
                          }
                          meta={`/${network.cidr}`}
                          actions={
                            <>
                              <IconAction
                                label={ui.networkInfo}
                                onClick={() =>
                                  setNetworkInfoId((prev) =>
                                    prev === network.id ? null : network.id,
                                  )
                                }
                              >
                                <Info size={14} aria-hidden="true" />
                              </IconAction>
                              <RowMenu
                                label={ui.rowActions}
                                items={[
                                  {
                                    label: ui.deleteLan,
                                    icon: (
                                      <Trash2 size={13} aria-hidden="true" />
                                    ),
                                    danger: true,
                                    onSelect: () =>
                                      dispatch(
                                        removeSiteNetwork({ id: network.id }),
                                      ),
                                  },
                                ]}
                              />
                            </>
                          }
                        />
                        {networkInfoId === network.id &&
                          renderNetworkInfo(network, site.ipOctet ?? 0)}
                        {lanExpanded &&
                          renderLanTiers(
                            site.id,
                            network.id,
                            network.layers,
                            3,
                          )}
                      </div>
                    );
                  })}

                  {canAddLan && (
                    <GhostRow
                      level={2}
                      label={ui.newLan}
                      onClick={() => openNetworkForm(site.id)}
                    />
                  )}

                  {site.layers.length > 0 && (
                    <div role="group">
                      <p className="text-label px-2 pb-0.5 pt-2 text-chalk-faint">
                        {ui.ungroupedLayers}
                      </p>
                      {site.layers.map((layer) =>
                        renderLayer(layer, site.id, 2),
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {formSite && (
        <Modal
          onClose={() => setNetworkFormSiteId(null)}
          title={ui.newLanTitle}
          closeLabel={copy.networkCancel}
          size="md"
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              confirmNetwork();
            }}
            className="flex flex-col gap-4"
          >
            <label className="flex flex-col gap-1.5 text-xs font-medium text-chalk-dim">
              {ui.lanName}
              <input
                autoFocus
                value={networkDraft.name}
                onChange={(e) =>
                  setNetworkDraft((d) => ({ ...d, name: e.target.value }))
                }
                placeholder={copy.networkNamePlaceholder}
                className="field"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              {selectField(
                copy.networkPurposeLabel,
                networkDraft.purpose,
                NETWORK_PURPOSE_OPTIONS.map((value) => ({
                  value,
                  label: purposeLabel(value),
                })),
                (value) =>
                  setNetworkDraft((d) => ({
                    ...d,
                    purpose: value as NetworkPurpose,
                  })),
              )}
              {selectField(
                copy.networkFamilyLabel,
                networkDraft.addressFamily,
                NETWORK_FAMILY_OPTIONS,
                (value) => {
                  const newFamily = value as AddressFamily;
                  const suggested = suggestNextThirdOctet(
                    formSite.id,
                    newFamily,
                    siteNetworks ?? [],
                  );
                  setNetworkDraft((d) => ({
                    ...d,
                    addressFamily: newFamily,
                    thirdOctet: String(suggested),
                  }));
                },
              )}
              <label className="flex flex-col gap-1.5 text-xs font-medium text-chalk-dim">
                {copy.networkOctetLabel}
                <input
                  type="number"
                  min={0}
                  max={255}
                  value={networkDraft.thirdOctet}
                  onChange={(e) =>
                    setNetworkDraft((d) => {
                      const nextThirdRaw = e.target.value;
                      const nextThird = Number(nextThirdRaw);
                      const prevThird = Number(d.thirdOctet);
                      const prevSuggested = Number.isFinite(prevThird)
                        ? suggestNetworkIpv6Prefix(formSite.ipOctet, prevThird)
                        : '';
                      const nextSuggested = Number.isFinite(nextThird)
                        ? suggestNetworkIpv6Prefix(formSite.ipOctet, nextThird)
                        : d.ipv6Prefix;
                      const shouldAutoUpdatePrefix =
                        d.ipv6Prefix.trim() === '' ||
                        d.ipv6Prefix === prevSuggested;
                      return {
                        ...d,
                        thirdOctet: nextThirdRaw,
                        ipv6Prefix: shouldAutoUpdatePrefix
                          ? nextSuggested
                          : d.ipv6Prefix,
                      };
                    })
                  }
                  className="field font-mono"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-medium text-chalk-dim">
                /{copy.networkCidrLabel}
                <input
                  type="number"
                  min={8}
                  max={30}
                  value={networkDraft.cidr}
                  onChange={(e) =>
                    setNetworkDraft((d) => ({ ...d, cidr: e.target.value }))
                  }
                  className="field font-mono"
                />
              </label>
              {selectField(
                copy.networkStackLabel,
                networkDraft.stackMode,
                NETWORK_STACK_OPTIONS,
                (value) => {
                  const nextStack = value as NetworkStackMode;
                  const suggestedPreference: NetworkTrafficPreference =
                    nextStack === 'dual-stack'
                      ? 'balanced'
                      : nextStack === 'ipv6-ready'
                        ? 'ipv6-preferred'
                        : 'ipv4-preferred';
                  setNetworkDraft((d) => ({
                    ...d,
                    stackMode: nextStack,
                    trafficPreference: suggestedPreference,
                  }));
                },
              )}
              {selectField(
                copy.networkTrafficPreferenceLabel,
                networkDraft.trafficPreference,
                NETWORK_TRAFFIC_OPTIONS,
                (value) =>
                  setNetworkDraft((d) => ({
                    ...d,
                    trafficPreference: value as NetworkTrafficPreference,
                  })),
              )}
              {selectField(
                copy.networkGatewayModeLabel,
                networkDraft.gatewayMode,
                NETWORK_GATEWAY_OPTIONS,
                (value) =>
                  setNetworkDraft((d) => ({
                    ...d,
                    gatewayMode: value as NetworkGatewayMode,
                  })),
              )}
              {selectField(
                copy.networkDnsPolicyLabel,
                networkDraft.dnsPolicy,
                NETWORK_DNS_OPTIONS,
                (value) =>
                  setNetworkDraft((d) => ({
                    ...d,
                    dnsPolicy: value as NetworkDnsPolicy,
                  })),
              )}
              <label className="col-span-2 flex flex-col gap-1.5 text-xs font-medium text-chalk-dim">
                {copy.networkIpv6PrefixLabel}
                <input
                  type="text"
                  value={networkDraft.ipv6Prefix}
                  onChange={(e) =>
                    setNetworkDraft((d) => ({
                      ...d,
                      ipv6Prefix: e.target.value,
                    }))
                  }
                  placeholder={copy.networkIpv6PrefixPlaceholder}
                  className="field font-mono"
                />
              </label>
            </div>

            {(() => {
              const oct = Number(networkDraft.thirdOctet);
              const cidr = Number(networkDraft.cidr);
              if (!Number.isFinite(oct) || !Number.isFinite(cidr)) return null;
              const addr = buildNetworkAddress(
                networkDraft.addressFamily,
                oct,
                formSite.ipOctet ?? 0,
              );
              return (
                <p className="rounded-sm border border-line bg-ink px-3 py-2 text-xs text-chalk-dim">
                  <span className="font-mono text-sm text-chalk">
                    {addr}/{cidr}
                  </span>
                  <span className="ml-2 text-chalk-faint">
                    {cidrToHostCount(cidr).toLocaleString(language)}{' '}
                    {ui.networkHosts.toLowerCase()}
                  </span>
                </p>
              );
            })()}

            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <button
                type="button"
                onClick={() => setNetworkFormSiteId(null)}
                className="btn btn-secondary btn-md"
              >
                {copy.networkCancel}
              </button>
              <button type="submit" className="btn btn-primary btn-md">
                {copy.networkConfirm}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </aside>
  );
}
