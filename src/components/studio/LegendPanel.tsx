import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  addNode,
  addLayer,
  removeLayer,
  removeNode,
  removeSite,
  addSiteNetwork,
  removeSiteNetwork,
} from '../../features/network/networkSlice';
import type {
  AddressFamily,
  LayerTier,
  NetworkPurpose,
  NodeCategory,
  SiteNetwork,
} from '../../features/network/types';
import {
  buildNetworkAddress,
  cidrToHostCount,
} from '../../features/network/utils';
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

const NETWORK_PURPOSE_OPTIONS: { value: NetworkPurpose; label: string }[] = [
  { value: 'principal', label: 'Principal' },
  { value: 'dmz', label: 'DMZ' },
  { value: 'gestao', label: 'Gerência' },
  { value: 'cliente', label: 'Cliente' },
  { value: 'backup', label: 'Backup' },
  { value: 'custom', label: 'Livre' },
];

const NETWORK_FAMILY_OPTIONS: { value: AddressFamily; label: string }[] = [
  { value: '200.x', label: '200.x (legado)' },
  { value: '10.x', label: '10.x (privado)' },
  { value: '172.x', label: '172.16.x (privado)' },
  { value: '192.168.x', label: '192.168.x (privado)' },
];

/** Cor da borda do container de rede por finalidade */
const NETWORK_PURPOSE_BORDER: Record<NetworkPurpose, string> = {
  principal: 'border-blue-700/60',
  dmz: 'border-orange-700/60',
  gestao: 'border-violet-700/60',
  cliente: 'border-green-700/60',
  backup: 'border-amber-700/60',
  custom: 'border-slate-600/50',
};

const NETWORK_PURPOSE_BADGE: Record<NetworkPurpose, string> = {
  principal: 'bg-blue-800/60 text-blue-200',
  dmz: 'bg-orange-800/60 text-orange-200',
  gestao: 'bg-violet-800/60 text-violet-200',
  cliente: 'bg-green-800/60 text-green-200',
  backup: 'bg-amber-800/60 text-amber-200',
  custom: 'bg-slate-700/60 text-slate-300',
};

function getTierBadge(tier?: LayerTier) {
  if (!tier) return null;
  return TIER_PRESETS.find((p) => p.tier === tier) ?? null;
}

type NetworkDraft = {
  name: string;
  purpose: NetworkPurpose;
  addressFamily: AddressFamily;
  thirdOctet: string;
  cidr: string;
};

const DEFAULT_NETWORK_DRAFT: NetworkDraft = {
  name: '',
  purpose: 'principal',
  addressFamily: '200.x',
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

export default function LegendPanel({ language }: LegendPanelProps) {
  const dispatch = useAppDispatch();
  const legendTree = useAppSelector(selectLegendTree);
  const { nodes, links, sites, siteVlans, layers, siteNetworks } =
    useAppSelector((state) => state.network);
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
  const [tierPickerFor, setTierPickerFor] = useState<{
    siteId: string;
    networkId?: string;
  } | null>(null);
  const [pendingTier, setPendingTier] = useState<LayerTier | null>(null);
  const [pendingLayerName, setPendingLayerName] = useState('');

  // ── Network picker state ────────────────────────────────────────────────────
  const [networkPickerSiteId, setNetworkPickerSiteId] = useState<string | null>(
    null,
  );
  const [networkDraft, setNetworkDraft] = useState<NetworkDraft>(
    DEFAULT_NETWORK_DRAFT,
  );
  const [networkInfoId, setNetworkInfoId] = useState<string | null>(null);

  function openTierPicker(siteId: string, networkId?: string) {
    setTierPickerFor({ siteId, networkId });
    setPendingTier(null);
    setPendingLayerName('');
  }

  function closeTierPicker() {
    setTierPickerFor(null);
    setPendingTier(null);
    setPendingLayerName('');
  }

  function selectTierPreset(tier: LayerTier) {
    setPendingTier(tier);
    const defaultName = TIER_DEFAULT_NAMES[tier];
    setPendingLayerName(defaultName);
  }

  function handleConfirmAddLayer() {
    if (!tierPickerFor) return;
    dispatch(
      addLayer({
        siteId: tierPickerFor.siteId,
        tier: pendingTier ?? undefined,
        name: pendingLayerName || undefined,
        networkId: tierPickerFor.networkId,
      }),
    );
    closeTierPicker();
  }

  function openNetworkPicker(siteId: string) {
    const suggested = suggestNextThirdOctet(
      siteId,
      DEFAULT_NETWORK_DRAFT.addressFamily,
      siteNetworks ?? [],
    );
    setNetworkPickerSiteId(siteId);
    setNetworkDraft({
      ...DEFAULT_NETWORK_DRAFT,
      thirdOctet: String(suggested),
    });
  }

  function closeNetworkPicker() {
    setNetworkPickerSiteId(null);
  }

  function handleConfirmAddNetwork(siteId: string) {
    const thirdOctet = Number(networkDraft.thirdOctet);
    const cidr = Number(networkDraft.cidr);
    if (!Number.isFinite(thirdOctet) || !Number.isFinite(cidr)) return;
    dispatch(
      addSiteNetwork({
        siteId,
        name: networkDraft.name.trim() || 'Rede',
        purpose: networkDraft.purpose,
        addressFamily: networkDraft.addressFamily,
        thirdOctet,
        cidr,
      }),
    );
    closeNetworkPicker();
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

  // ── Layer renderer (reutilizável para camadas soltas e camadas de rede) ─────
  function renderLayer(
    layer: (typeof legendTree)[0]['layers'][0],
    siteId: string,
  ) {
    return (
      <details
        key={layer.id}
        open
        className="rounded border border-slate-800 bg-slate-950/40"
      >
        <summary className="flex cursor-pointer items-center justify-between px-2 py-2 text-xs text-slate-300">
          <span className="flex min-w-0 items-center gap-1.5">
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
                const query = getLayerSearch(layer.id).trim().toLowerCase();
                if (!query) return true;
                return (
                  visual.label.toLowerCase().includes(query) ||
                  visual.short.toLowerCase().includes(query) ||
                  category.toLowerCase().includes(query)
                );
              }).map((category) => {
                const visual = getNodeVisual(category);
                const isLast = getCategoryForLayer(layer.id) === category;
                return (
                  <button
                    key={`${layer.id}-${category}`}
                    onClick={() => handleAddNode(siteId, layer.id, category)}
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
            <li className="text-[11px] text-slate-500">{copy.noComponents}</li>
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
                    <span className="mr-1 text-sky-300">[{visual.short}]</span>
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
    );
  }

  // ── TierPicker inline (reutilizável) ─────────────────────────────────────────
  function renderTierPicker(siteId: string, networkId?: string) {
    const isOpen =
      tierPickerFor?.siteId === siteId &&
      tierPickerFor?.networkId === networkId;
    if (!isOpen) return null;
    return (
      <div
        className="mx-2 mb-2 mt-1 rounded border border-emerald-700/50 bg-emerald-950/20 p-2"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
          Papel da camada <span className="text-slate-500">(opcional)</span>
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
            {copy.networkCancel}
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
    );
  }

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
              <div className="flex gap-1">
                <button
                  onClick={(event) => {
                    event.preventDefault();
                    openNetworkPicker(site.id);
                  }}
                  className="rounded bg-sky-600 px-2 py-1 text-[10px] font-bold uppercase text-white hover:bg-sky-500"
                >
                  {copy.addNetwork}
                </button>
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

            {/* ── Network picker modal inline ──────────────────────────────── */}
            {networkPickerSiteId === site.id && (
              <div
                className="mx-2 mb-2 mt-1 rounded border border-sky-700/50 bg-sky-950/20 p-2"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-sky-300">
                  Nova Rede Lógica
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  <label className="col-span-2 flex flex-col gap-0.5">
                    <span className="text-[10px] text-slate-400">Nome</span>
                    <input
                      value={networkDraft.name}
                      onChange={(e) =>
                        setNetworkDraft((d) => ({ ...d, name: e.target.value }))
                      }
                      placeholder={copy.networkNamePlaceholder}
                      className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 placeholder:text-slate-600"
                    />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-slate-400">
                      {copy.networkPurposeLabel}
                    </span>
                    <select
                      value={networkDraft.purpose}
                      onChange={(e) =>
                        setNetworkDraft((d) => ({
                          ...d,
                          purpose: e.target.value as NetworkPurpose,
                        }))
                      }
                      className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-[11px] text-slate-100"
                    >
                      {NETWORK_PURPOSE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-slate-400">
                      {copy.networkFamilyLabel}
                    </span>
                    <select
                      value={networkDraft.addressFamily}
                      onChange={(e) => {
                        const newFamily = e.target.value as AddressFamily;
                        const suggested = suggestNextThirdOctet(
                          site.id,
                          newFamily,
                          siteNetworks ?? [],
                        );
                        setNetworkDraft((d) => ({
                          ...d,
                          addressFamily: newFamily,
                          thirdOctet: String(suggested),
                        }));
                      }}
                      className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-[11px] text-slate-100"
                    >
                      {NETWORK_FAMILY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-slate-400">
                      {copy.networkOctetLabel}
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={255}
                      value={networkDraft.thirdOctet}
                      onChange={(e) =>
                        setNetworkDraft((d) => ({
                          ...d,
                          thirdOctet: e.target.value,
                        }))
                      }
                      className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 [appearance:textfield]"
                    />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-slate-400">
                      /{copy.networkCidrLabel}
                    </span>
                    <input
                      type="number"
                      min={8}
                      max={30}
                      value={networkDraft.cidr}
                      onChange={(e) =>
                        setNetworkDraft((d) => ({
                          ...d,
                          cidr: e.target.value,
                        }))
                      }
                      className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 [appearance:textfield]"
                    />
                  </label>
                </div>
                {/* Preview do bloco calculado */}
                {(() => {
                  const oct = Number(networkDraft.thirdOctet);
                  const cidr = Number(networkDraft.cidr);
                  const siteOctet =
                    sites.find((s) => s.id === site.id)?.ipOctet ?? 0;
                  if (!Number.isFinite(oct) || !Number.isFinite(cidr))
                    return null;
                  const addr = buildNetworkAddress(
                    networkDraft.addressFamily,
                    oct,
                    siteOctet,
                  );
                  const hosts = cidrToHostCount(cidr);
                  return (
                    <div className="mt-1 rounded border border-sky-800/40 bg-sky-950/20 px-2 py-1 font-mono text-[10px] text-sky-300">
                      {addr}/{cidr}
                      <span className="ml-2 font-sans text-[9px] text-slate-400">
                        ({hosts.toLocaleString('pt-BR')} hosts)
                      </span>
                    </div>
                  );
                })()}
                <div className="mt-2 flex justify-end gap-1">
                  <button
                    type="button"
                    onClick={closeNetworkPicker}
                    className="rounded border border-slate-600 px-2 py-1 text-[10px] text-slate-400 hover:bg-slate-800"
                  >
                    {copy.networkCancel}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConfirmAddNetwork(site.id)}
                    className="rounded bg-sky-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-sky-500"
                  >
                    {copy.networkConfirm}
                  </button>
                </div>
              </div>
            )}

            {/* ── TierPicker para camada solta (sem rede) ───────────────── */}
            {renderTierPicker(site.id, undefined)}

            <div className="space-y-2 px-2 pb-2">
              {/* ── Redes do site ──────────────────────────────────────────── */}
              {site.networks.map((network) => (
                <details
                  key={network.id}
                  open
                  className={`rounded border bg-[#060e1a] ${NETWORK_PURPOSE_BORDER[network.purpose as NetworkPurpose] ?? 'border-slate-600/50'}`}
                >
                  <summary className="flex cursor-pointer items-center justify-between px-2 py-1.5 text-[11px] text-slate-200">
                    <span className="flex items-center gap-1.5">
                      <span
                        className={`rounded px-1 py-0.5 text-[9px] font-bold uppercase ${NETWORK_PURPOSE_BADGE[network.purpose as NetworkPurpose] ?? 'bg-slate-700 text-slate-300'}`}
                      >
                        {network.purpose}
                      </span>
                      <span className="font-semibold text-sky-200">
                        {network.name}
                      </span>
                    </span>
                    <div className="flex gap-1">
                      {/* Botão info ─────────────────────── */}
                      <button
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setNetworkInfoId((prev) =>
                            prev === network.id ? null : network.id,
                          );
                        }}
                        title="Informações da rede"
                        className="rounded border border-sky-700/50 bg-sky-950/40 px-1.5 py-0.5 text-[10px] font-bold text-sky-300 hover:bg-sky-900/50"
                      >
                        i
                      </button>
                      <button
                        onClick={(event) => {
                          event.preventDefault();
                          openTierPicker(site.id, network.id);
                        }}
                        className="rounded bg-emerald-700/70 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-100 hover:bg-emerald-600/70"
                      >
                        {copy.addLayer}
                      </button>
                      <button
                        onClick={(event) => {
                          event.preventDefault();
                          dispatch(removeSiteNetwork({ id: network.id }));
                        }}
                        className="rounded bg-rose-500 px-2 py-0.5 text-[10px] font-bold uppercase"
                      >
                        {copy.delete}
                      </button>
                    </div>
                  </summary>

                  {/* Tooltip info da rede */}
                  {networkInfoId === network.id &&
                    (() => {
                      const siteItem = sites.find((s) => s.id === site.id);
                      const siteOctet = siteItem?.ipOctet ?? 0;
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
                      return (
                        <div
                          className="mx-2 mb-1 mt-0.5 rounded border border-sky-700/40 bg-sky-950/30 p-2 text-[10px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="mb-1 font-semibold text-sky-300">
                            Informações da Rede
                          </div>
                          <div className="space-y-0.5 text-slate-300">
                            <div className="flex justify-between gap-2">
                              <span className="text-slate-500">Bloco</span>
                              <span className="font-mono text-sky-200">
                                {baseAddr}/{network.cidr}
                              </span>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-slate-500">Família</span>
                              <span>{network.addressFamily}</span>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-slate-500">Hosts</span>
                              <span>{hosts.toLocaleString('pt-BR')}</span>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-slate-500">VLANs</span>
                              <span>{vlanCount}</span>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-slate-500">Camadas</span>
                              <span>{layerCount}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                  {/* TierPicker para camada dentro desta rede */}
                  {renderTierPicker(site.id, network.id)}

                  <div className="space-y-1.5 px-1.5 pb-1.5 pt-0.5">
                    {network.layers.length === 0 && (
                      <p className="px-1 text-[11px] text-slate-500">
                        {copy.noComponents}
                      </p>
                    )}
                    {network.layers.map((layer) => renderLayer(layer, site.id))}
                  </div>
                </details>
              ))}

              {/* ── Camadas sem rede (legado / não agrupadas) ──────────────── */}
              {site.layers.map((layer) => renderLayer(layer, site.id))}
            </div>
          </details>
        ))}
      </div>
    </aside>
  );
}
