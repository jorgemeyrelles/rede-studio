/**
 * TreePicker — Site → VLAN → IP tree with checkboxes
 * Computes AclEndpointScope based on selection breadth.
 */
import { useEffect, useRef, useState } from 'react';
import type {
  NodeItem,
  Site,
  SiteNetwork,
  SiteVlan,
  Subnet,
} from '../../features/network/types/entities';
import type { AclEndpointScope } from '../../features/network/types/entities';

export type TreePickerValue = {
  scope: AclEndpointScope;
  nodeId?: string;
  vlanId?: number;
  siteId?: string;
  ip?: string;
  ipList?: string[];
  subnetId?: string;
  zone?: string;
};

interface TreePickerProps {
  nodes: NodeItem[];
  siteVlans: SiteVlan[];
  sites: Site[];
  siteNetworks?: SiteNetwork[];
  subnets?: Subnet[];
  value: string; // nodeId or 'any' or 'subnet:id' or 'zone:name'
  onChange: (nodeId: string) => void;
  placeholder?: string;
  excludeNodeId?: string;
}

/** Checkbox that supports indeterminate state */
function IndeterminateCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: (checked: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="h-3 w-3 cursor-pointer accent-sky-500"
    />
  );
}

export function TreePicker({
  nodes,
  siteVlans,
  sites,
  siteNetworks: _siteNetworks = [],
  subnets = [],
  value,
  onChange,
  placeholder = 'Selecionar nó…',
  excludeNodeId,
}: TreePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set());

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const eligibleNodes = nodes.filter((n) => n.id !== excludeNodeId);
  const selectedNode = eligibleNodes.find((n) => n.id === value);

  const toggleSite = (siteId: string) =>
    setExpandedSites((prev) => {
      const next = new Set(prev);
      if (next.has(siteId)) next.delete(siteId);
      else next.add(siteId);
      return next;
    });

  // Group nodes by site
  const nodeBySite = eligibleNodes.reduce<Record<string, NodeItem[]>>(
    (acc, n) => {
      const key = n.siteId ?? '__nossite__';
      acc[key] = acc[key] ?? [];
      acc[key].push(n);
      return acc;
    },
    {},
  );

  // Sites that have nodes
  const activeSiteIds = Object.keys(nodeBySite);

  const getVlansForSite = (siteId: string) =>
    siteVlans
      .filter((v) => v.siteId === siteId)
      .sort((a, b) => a.vlanId - b.vlanId);

  const getSiteName = (siteId: string) =>
    sites.find((s) => s.id === siteId)?.name ?? siteId;

  const getNodesForVlan = (siteId: string, vlanId: number) =>
    (nodeBySite[siteId] ?? []).filter((n) => n.vlans.includes(vlanId));

  const getNodesWithoutVlan = (siteId: string) => {
    const siteNodes = nodeBySite[siteId] ?? [];
    const vlans = getVlansForSite(siteId);
    return siteNodes.filter(
      (n) => !vlans.some((v) => n.vlans.includes(v.vlanId)),
    );
  };

  const selectNode = (nodeId: string) => {
    onChange(nodeId);
    setOpen(false);
  };

  const displayLabel = (() => {
    if (value === 'any') return 'Qualquer (ANY)';
    if (value.startsWith('subnet:')) {
      const sub = subnets.find((s) => s.id === value.slice(7));
      return sub
        ? `Sub-rede: ${sub.name} (${sub.networkAddress}/${sub.cidr})`
        : value;
    }
    if (value.startsWith('zone:')) {
      return `Zona: ${value.slice(5)}`;
    }
    return selectedNode
      ? `${selectedNode.label} (${selectedNode.ip})`
      : placeholder;
  })();

  // Zonas únicas presentes nos nós
  const uniqueZones = [
    ...new Set(nodes.filter((n) => n.zone).map((n) => n.zone as string)),
  ].sort();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-left text-[10px] text-slate-200 hover:border-slate-400"
      >
        <span className="block truncate">{displayLabel}</span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-64 rounded border border-slate-600 bg-slate-900 shadow-xl">
          <div className="max-h-64 overflow-y-auto">
            {/* Any option */}
            <button
              type="button"
              onClick={() => {
                onChange('any');
                setOpen(false);
              }}
              className={`w-full px-2 py-1 text-left text-[10px] hover:bg-slate-700 ${value === 'any' ? 'text-sky-400' : 'text-slate-300'}`}
            >
              ☐ Qualquer (ANY)
            </button>

            {activeSiteIds.map((siteId) => {
              const isExpanded = expandedSites.has(siteId);
              const vlans = getVlansForSite(siteId);
              const siteNodes = nodeBySite[siteId] ?? [];
              const nodesWithoutVlan = getNodesWithoutVlan(siteId);
              const hasChildren = siteNodes.length > 0;

              return (
                <div key={siteId}>
                  {/* Site row */}
                  <button
                    type="button"
                    onClick={() => toggleSite(siteId)}
                    className="flex w-full items-center gap-1 bg-slate-800/70 px-2 py-1 text-left text-[10px] font-semibold text-slate-300 hover:text-slate-100"
                  >
                    {hasChildren ? (isExpanded ? '▼' : '▶') : '–'}
                    <span>{getSiteName(siteId)}</span>
                  </button>

                  {isExpanded && (
                    <div className="pl-3">
                      {/* VLANs */}
                      {vlans.map((vlan) => {
                        const vlanNodes = getNodesForVlan(siteId, vlan.vlanId);
                        if (vlanNodes.length === 0) return null;
                        return (
                          <div key={vlan.id}>
                            <div className="px-1 py-0.5 text-[9px] font-semibold uppercase text-slate-500">
                              VLAN {vlan.vlanId} — {vlan.name}
                            </div>
                            {vlanNodes.map((n) => (
                              <button
                                key={n.id}
                                type="button"
                                onClick={() => selectNode(n.id)}
                                className={`w-full px-2 py-0.5 text-left text-[10px] hover:bg-slate-700 ${value === n.id ? 'text-sky-400' : 'text-slate-300'}`}
                              >
                                {value === n.id ? '✓ ' : ''}
                                {n.label}
                                <span className="ml-1 text-[9px] text-slate-500">
                                  {n.ip}
                                </span>
                              </button>
                            ))}
                          </div>
                        );
                      })}

                      {/* Nodes without VLAN */}
                      {nodesWithoutVlan.length > 0 && (
                        <div>
                          {vlans.length > 0 && (
                            <div className="px-1 py-0.5 text-[9px] font-semibold uppercase text-slate-500">
                              Outros
                            </div>
                          )}
                          {nodesWithoutVlan.map((n) => (
                            <button
                              key={n.id}
                              type="button"
                              onClick={() => selectNode(n.id)}
                              className={`w-full px-2 py-0.5 text-left text-[10px] hover:bg-slate-700 ${value === n.id ? 'text-sky-400' : 'text-slate-300'}`}
                            >
                              {value === n.id ? '✓ ' : ''}
                              {n.label}
                              <span className="ml-1 text-[9px] text-slate-500">
                                {n.ip}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Nodes without site */}
            {nodeBySite['__nossite__'] && (
              <div>
                <div className="bg-slate-800/70 px-2 py-1 text-[10px] font-semibold text-slate-400">
                  Sem site
                </div>
                {nodeBySite['__nossite__'].map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => selectNode(n.id)}
                    className={`w-full px-3 py-0.5 text-left text-[10px] hover:bg-slate-700 ${value === n.id ? 'text-sky-400' : 'text-slate-300'}`}
                  >
                    {value === n.id ? '✓ ' : ''}
                    {n.label}
                    <span className="ml-1 text-[9px] text-slate-500">
                      {n.ip}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* ── Subnets (Fase 2) ─────────────────────────────────── */}
            {subnets.length > 0 && (
              <div>
                <div className="bg-slate-800/70 px-2 py-1 text-[10px] font-semibold text-slate-400">
                  Sub-redes
                </div>
                {subnets.map((sub) => {
                  const key = `subnet:${sub.id}`;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => {
                        onChange(key);
                        setOpen(false);
                      }}
                      className={`w-full px-3 py-0.5 text-left text-[10px] hover:bg-slate-700 ${value === key ? 'text-sky-400' : 'text-slate-300'}`}
                    >
                      {value === key ? '✓ ' : ''}
                      {sub.name}
                      <span className="ml-1 font-mono text-[9px] text-slate-500">
                        {sub.networkAddress}/{sub.cidr}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Zonas (Fase 2) ───────────────────────────────────── */}
            {uniqueZones.length > 0 && (
              <div>
                <div className="bg-slate-800/70 px-2 py-1 text-[10px] font-semibold text-slate-400">
                  Zonas
                </div>
                {uniqueZones.map((zone) => {
                  const key = `zone:${zone}`;
                  return (
                    <button
                      key={zone}
                      type="button"
                      onClick={() => {
                        onChange(key);
                        setOpen(false);
                      }}
                      className={`w-full px-3 py-0.5 text-left text-[10px] hover:bg-slate-700 ${value === key ? 'text-sky-400' : 'text-slate-300'}`}
                    >
                      {value === key ? '✓ ' : ''}
                      <span className="capitalize">{zone}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default TreePicker;
