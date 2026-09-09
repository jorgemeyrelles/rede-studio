import { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { QOSCLASS_LABEL } from '../../features/network/constants';
import {
    addSiteVlan,
    addSubnet,
    removeSiteVlan,
    removeSubnet,
    setPersistWarning,
    setVlanAssignmentMode,
    toggleNodeVlanAssignment,
    updateSiteVlanQos,
} from '../../features/network/networkSlice';
import type {
    AddressAllocationMode,
    QosClass,
} from '../../features/network/types/entities';
import {
    getNodeReservedRange,
    getVlanRange,
    ipToNumber,
} from '../../features/network/utils';
import {
    CAPACITY_OPTIONS,
    createDefaultVlanDraft,
    formatCompactRange,
    getNodeVisual,
    getSiteRadicalOptions,
    getSiteVlanCopy,
    VLAN_NAME_PRESETS,
    type SiteVlanDraft,
    type StudioLanguage,
} from './catalog';

type SiteVlanPanelProps = {
  language: StudioLanguage;
};

export default function SiteVlanPanel({ language }: SiteVlanPanelProps) {
  const dispatch = useAppDispatch();
  const { sites, nodes, links, siteVlans, ui, meta, siteNetworks, subnets, nodeVlanInterfaces } =
    useAppSelector((state) => state.network);
  const copy = getSiteVlanCopy(language);
  const [vlanDraftBySite, setVlanDraftBySite] = useState<
    Record<string, SiteVlanDraft>
  >({});
  const [openRadicalSiteId, setOpenRadicalSiteId] = useState<string | null>(
    null,
  );
  const [openCapacitySiteId, setOpenCapacitySiteId] = useState<string | null>(
    null,
  );
  const [selectedNetworkBySite, setSelectedNetworkBySite] = useState<
    Record<string, string | null>
  >({});
  // P6 — forma de sub-rede por VLAN (key = `${siteId}-${vlanId}`)
  const [subnetFormByVlan, setSubnetFormByVlan] = useState<
    Record<string, { name: string; cidr: string; ipv6Prefix: string } | null>
  >({});
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({
    open: false,
    message: '',
  });
  const dropdownAreaRef = useRef<HTMLDivElement | null>(null);
  const previousVlanCountBySiteRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const handleDocumentPointerDown = (event: MouseEvent) => {
      const container = dropdownAreaRef.current;
      if (!container) return;

      const target = event.target;
      if (target instanceof Node && container.contains(target)) return;

      setOpenCapacitySiteId(null);
      setOpenRadicalSiteId(null);
    };

    document.addEventListener('mousedown', handleDocumentPointerDown);
    return () => {
      document.removeEventListener('mousedown', handleDocumentPointerDown);
    };
  }, []);

  useEffect(() => {
    const nextCounts = sites.reduce<Record<string, number>>((acc, site) => {
      acc[site.id] = siteVlans.filter((item) => item.siteId === site.id).length;
      return acc;
    }, {});

    const previousCounts = previousVlanCountBySiteRef.current;
    const changedSiteIds = sites
      .map((site) => site.id)
      .filter((siteId) => previousCounts[siteId] !== nextCounts[siteId]);

    if (changedSiteIds.length > 0) {
      setVlanDraftBySite((prev) => {
        const updated = { ...prev };

        changedSiteIds.forEach((siteId) => {
          const site = sites.find((item) => item.id === siteId);
          if (!site) return;

          updated[siteId] = createDefaultVlanDraft(
            siteId,
            site.ipOctet,
            siteVlans,
            nodes,
          );
        });

        return updated;
      });
    }

    previousVlanCountBySiteRef.current = nextCounts;
  }, [nodes, siteVlans, sites]);

  useEffect(() => {
    if (!meta.persistWarning) {
      return;
    }

    setSnackbar({
      open: true,
      message: meta.persistWarning,
    });
    dispatch(setPersistWarning(null));
  }, [dispatch, meta.persistWarning]);

  useEffect(() => {
    if (!snackbar.open) return;

    const timer = window.setTimeout(() => {
      setSnackbar((prev) => ({ ...prev, open: false }));
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [snackbar.open]);

  const setVlanDraft = (
    siteId: string,
    siteOctet: number,
    updater: (current: SiteVlanDraft) => SiteVlanDraft,
  ) => {
    setVlanDraftBySite((prev) => {
      const current =
        prev[siteId] ??
        createDefaultVlanDraft(siteId, siteOctet, siteVlans, nodes);
      return {
        ...prev,
        [siteId]: updater(current),
      };
    });
  };

  const allocationLabels: Record<AddressAllocationMode, string> = {
    dhcpv4: copy.addressAllocationDhcpv4,
    dhcpv6: copy.addressAllocationDhcpv6,
    slaac: copy.addressAllocationSlaac,
    'dual-dhcp-slaac': copy.addressAllocationDual,
    'static-ipv4': copy.addressAllocationStaticIpv4,
    'static-ipv6': copy.addressAllocationStaticIpv6,
    'static-dual': copy.addressAllocationStaticDual,
  };

  const allocationProfileLabels: Record<AddressAllocationMode, string> = {
    dhcpv4: copy.addressAllocationProfileDynamic,
    dhcpv6: copy.addressAllocationProfileDynamic,
    slaac: copy.addressAllocationProfileDynamic,
    'dual-dhcp-slaac': copy.addressAllocationProfileMixed,
    'static-ipv4': copy.addressAllocationProfileStatic,
    'static-ipv6': copy.addressAllocationProfileStatic,
    'static-dual': copy.addressAllocationProfileStatic,
  };

  return (
    <section className="w-full rounded-lg border border-[#315072] bg-[#0a1324]/80 p-3 shadow-[0_0_0_1px_rgba(27,49,77,0.35),0_12px_24px_rgba(0,0,0,0.28)]">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-300">
        {copy.title}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div
          ref={dropdownAreaRef}
          className="theme-scrollbar space-y-2 overflow-y-auto pr-1"
          style={{ height: '450px' }}
        >
          {sites.length === 0 && (
            <div className="rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-2 text-xs text-slate-300">
              {copy.createSiteFirst}
            </div>
          )}

          {sites.map((site) => {
            const siteNodes = nodes.filter(
              (node) => node.siteId === site.id && node.category !== 'wan',
            );
            const siteVlanItems = siteVlans
              .filter((item) => item.siteId === site.id)
              .sort((a, b) => a.vlanId - b.vlanId);
            const siteNets = (siteNetworks ?? []).filter(
              (n) => n.siteId === site.id,
            );
            const selectedNetworkId = selectedNetworkBySite[site.id] ?? null;
            const selectedNetwork =
              siteNets.find((n) => n.id === selectedNetworkId) ?? null;
            const draft =
              vlanDraftBySite[site.id] ??
              createDefaultVlanDraft(site.id, site.ipOctet, siteVlans, nodes);
            const radicalOptions = getSiteRadicalOptions(
              site.id,
              site.ipOctet,
              siteVlans,
              nodes,
              Number(draft.capacity) || 64,
              selectedNetwork,
            );

            const draftRadicalOptions = draft.startRadical
              ? Array.from(new Set([draft.startRadical, ...radicalOptions]))
              : radicalOptions;

            return (
              <details
                key={site.id}
                className="rounded border border-[#35567f] bg-[#0d1a2e]"
                open
              >
                <summary className="cursor-pointer select-none px-2 py-1.5 text-xs font-semibold text-slate-100">
                  {site.name}
                </summary>

                <div className="space-y-2 px-2 pb-2">
                  {/* Seletor de LAN — aparece somente se o site tiver LANs cadastradas */}
                  {siteNets.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400">
                        LAN:
                      </span>
                      <select
                        value={selectedNetworkId ?? ''}
                        onChange={(e) => {
                          const netId = e.target.value || null;
                          setSelectedNetworkBySite((prev) => ({
                            ...prev,
                            [site.id]: netId,
                          }));
                          // Regenera o draft com radical compatível com a LAN selecionada
                          const net = siteNets.find((n) => n.id === netId) ?? null;
                          setVlanDraftBySite((prev) => ({
                            ...prev,
                            [site.id]: createDefaultVlanDraft(
                              site.id,
                              site.ipOctet,
                              siteVlans,
                              nodes,
                              net,
                            ),
                          }));
                        }}
                        className="rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1 text-[11px] text-slate-100"
                      >
                        <option value="">— sem LAN —</option>
                        {siteNets.map((net) => (
                          <option key={net.id} value={net.id}>
                            {net.name}
                            {net.addressFamily === '200.x'
                              ? ` · 200.${site.ipOctet}.${net.thirdOctet}.0/${net.cidr}`
                              : ` · /${net.cidr}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="flex flex-wrap items-stretch gap-2">
                    <input
                      type="number"
                      min={1}
                      max={4094}
                      value={draft.vlanId}
                      onKeyDown={(event) => {
                        if (
                          event.key === 'ArrowUp' ||
                          event.key === 'ArrowDown'
                        ) {
                          event.preventDefault();
                        }
                      }}
                      onChange={(event) =>
                        setVlanDraft(site.id, site.ipOctet, (current) => ({
                          ...current,
                          vlanId: event.target.value,
                        }))
                      }
                      className="w-[72px] shrink-0 rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1.5 text-xs text-slate-100 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      placeholder={copy.vlanPlaceholder}
                    />
                    <div className="relative w-[86px] shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setOpenCapacitySiteId((current) =>
                            current === site.id ? null : site.id,
                          );
                          setOpenRadicalSiteId(null);
                        }}
                        className="min-w-0 w-full truncate rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1.5 text-left text-xs text-slate-100"
                      >
                        {draft.capacity} IPs
                      </button>
                      {openCapacitySiteId === site.id && (
                        <div className="theme-scrollbar absolute z-20 mt-1 max-h-[150px] w-full overflow-y-auto rounded border border-[#35567f] bg-[#0d1a2e] shadow-lg">
                          {CAPACITY_OPTIONS.map((option) => (
                            <button
                              key={`${site.id}-cap-${option}`}
                              type="button"
                              onClick={() => {
                                setVlanDraft(
                                  site.id,
                                  site.ipOctet,
                                  (current) => ({
                                    ...current,
                                    capacity: String(option),
                                  }),
                                );
                                setOpenCapacitySiteId(null);
                              }}
                              className="block w-full px-2 py-1 text-left text-xs text-slate-100 hover:bg-[#16304f]"
                            >
                              {option} IPs
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="relative w-[92px] shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setOpenRadicalSiteId((current) =>
                            current === site.id ? null : site.id,
                          );
                          setOpenCapacitySiteId(null);
                        }}
                        className="min-w-0 w-full truncate rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1.5 text-left text-xs text-slate-100"
                      >
                        {draft.startRadical}
                      </button>
                      {openRadicalSiteId === site.id && (
                        <div className="theme-scrollbar absolute z-20 mt-1 max-h-[150px] w-full overflow-y-auto rounded border border-[#35567f] bg-[#0d1a2e] shadow-lg">
                          {draftRadicalOptions.length === 0 && (
                            <div className="px-2 py-1 text-[10px] text-amber-300">
                              Todos os radicais conflitam com VLANs existentes.
                            </div>
                          )}
                          {draftRadicalOptions.map((option) => (
                            <button
                              key={`${site.id}-rad-${option}`}
                              type="button"
                              onClick={() => {
                                setVlanDraft(
                                  site.id,
                                  site.ipOctet,
                                  (current) => ({
                                    ...current,
                                    startRadical: option,
                                  }),
                                );
                                setOpenRadicalSiteId(null);
                              }}
                              className="block w-full px-2 py-1 text-left text-xs text-slate-100 hover:bg-[#16304f]"
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* P12 — combobox de nome com presets */}
                    <div className="min-w-[160px] flex-1">
                      {draft.nameCustom ? (
                        <input
                          value={draft.name}
                          onChange={(event) =>
                            setVlanDraft(site.id, site.ipOctet, (current) => ({
                              ...current,
                              name: event.target.value,
                            }))
                          }
                          className="w-full rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1.5 text-xs text-slate-100"
                          placeholder={copy.vlanNamePlaceholder}
                          autoFocus
                        />
                      ) : (
                        <select
                          value={draft.name}
                          onChange={(event) => {
                            const val = event.target.value;
                            if (val === '__custom__') {
                              setVlanDraft(
                                site.id,
                                site.ipOctet,
                                (current) => ({
                                  ...current,
                                  name: '',
                                  nameCustom: true,
                                }),
                              );
                            } else {
                              setVlanDraft(
                                site.id,
                                site.ipOctet,
                                (current) => ({
                                  ...current,
                                  name: val,
                                  nameCustom: false,
                                }),
                              );
                            }
                          }}
                          className="w-full rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1.5 text-xs text-slate-100"
                        >
                          <option value="">{copy.vlanNamePreset}</option>
                          {VLAN_NAME_PRESETS.map((preset) => (
                            <option key={preset} value={preset}>
                              {preset}
                            </option>
                          ))}
                          <option value="__custom__">
                            {copy.vlanNameCustomOption}
                          </option>
                        </select>
                      )}
                    </div>
                    <input
                      value={draft.ipv6Prefix}
                      onChange={(event) =>
                        setVlanDraft(site.id, site.ipOctet, (current) => ({
                          ...current,
                          ipv6Prefix: event.target.value,
                        }))
                      }
                      className="min-w-[170px] flex-1 rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1.5 text-xs text-slate-100"
                      placeholder={copy.ipv6Prefix}
                    />
                    <select
                      value={draft.addressAllocation}
                      onChange={(event) =>
                        setVlanDraft(site.id, site.ipOctet, (current) => ({
                          ...current,
                          addressAllocation:
                            event.target.value as AddressAllocationMode,
                        }))
                      }
                      className="min-w-[150px] flex-1 rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1.5 text-xs text-slate-100"
                    >
                      <option value="dhcpv4">{copy.addressAllocationDhcpv4}</option>
                      <option value="dhcpv6">{copy.addressAllocationDhcpv6}</option>
                      <option value="slaac">{copy.addressAllocationSlaac}</option>
                      <option value="dual-dhcp-slaac">
                        {copy.addressAllocationDual}
                      </option>
                      <option value="static-ipv4">
                        {copy.addressAllocationStaticIpv4}
                      </option>
                      <option value="static-ipv6">
                        {copy.addressAllocationStaticIpv6}
                      </option>
                      <option value="static-dual">
                        {copy.addressAllocationStaticDual}
                      </option>
                    </select>
                    <button
                      onClick={() => {
                        const vlanId = Number(draft.vlanId);
                        const capacity = Number(draft.capacity);
                        if (!Number.isFinite(vlanId) || vlanId <= 0) return;
                        if (!Number.isFinite(capacity) || capacity <= 0) return;
                        dispatch(
                          addSiteVlan({
                            siteId: site.id,
                            vlanId,
                            capacity,
                            startRadical: draft.startRadical,
                            name: draft.name,
                            networkId: selectedNetworkId ?? undefined,
                            ipv6Prefix: draft.ipv6Prefix.trim() || undefined,
                            addressAllocation: draft.addressAllocation,
                          }),
                        );
                        setOpenRadicalSiteId(null);
                        setOpenCapacitySiteId(null);
                      }}
                      className="shrink-0 rounded-md bg-emerald-300 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-950"
                    >
                      {copy.addVlan}
                    </button>
                  </div>

                  {siteVlanItems.length === 0 && (
                    <div className="rounded border border-dashed border-[#35567f] px-2 py-2 text-xs text-slate-400">
                      {copy.noVlanSite}
                    </div>
                  )}

                  {siteVlanItems.map((vlan) => {
                    const isModeActive =
                      ui.vlanAssignment?.siteId === site.id &&
                      ui.vlanAssignment?.vlanId === vlan.vlanId;
                    const selectedCount = siteNodes.filter((node) =>
                      (node.vlans ?? []).includes(vlan.vlanId),
                    ).length;
                    const vlanKey = `${site.id}-${vlan.vlanId}`;
                    const vlanSubnets = (subnets ?? []).filter(
                      (s) =>
                        s.siteId === site.id && s.vlanId === vlan.vlanId,
                    );
                    const subnetForm = subnetFormByVlan[vlanKey];

                    return (
                      <div
                        key={vlan.id}
                        className="rounded border bg-[#0a172b] p-2"
                        style={{
                          borderColor: vlan.color ?? '#2f5279',
                          boxShadow: vlan.color
                            ? `inset 0 0 0 1px ${vlan.color}22`
                            : undefined,
                        }}
                      >
                        {/* Header */}
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span
                            className="rounded px-2 py-0.5 font-mono text-[11px] font-bold"
                            style={{
                              background: vlan.color
                                ? `${vlan.color}22`
                                : 'rgba(56,189,248,0.12)',
                              color: vlan.color ?? '#7dd3fc',
                            }}
                          >
                            VLAN {vlan.vlanId}
                          </span>
                          <span className="text-xs text-slate-200">
                            {vlan.name}
                          </span>
                          {/* P13 — QoS class badge */}
                          <select
                            value={vlan.qosClass ?? ''}
                            onChange={(e) =>
                              dispatch(
                                updateSiteVlanQos({
                                  siteId: site.id,
                                  vlanId: vlan.vlanId,
                                  qosClass: (e.target.value as QosClass) || undefined,
                                }),
                              )
                            }
                            title="QoS Class"
                            className="rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-[10px] text-slate-300"
                          >
                            <option value="">— QoS —</option>
                            {(Object.keys(QOSCLASS_LABEL) as QosClass[]).map((c) => (
                              <option key={c} value={c}>
                                {QOSCLASS_LABEL[c]}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() =>
                              dispatch(
                                setVlanAssignmentMode(
                                  isModeActive
                                    ? null
                                    : {
                                        siteId: site.id,
                                        vlanId: vlan.vlanId,
                                      },
                                ),
                              )
                            }
                            className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                              isModeActive
                                ? 'bg-cyan-300 text-slate-950'
                                : 'bg-slate-700 text-slate-200'
                            }`}
                          >
                            {isModeActive
                              ? copy.diagramModeOn
                              : copy.selectDiagram}
                          </button>
                          {/* P6 — botão sub-rede (só aparece se VLAN tem networkId) */}
                          {vlan.networkId && (
                            <button
                              onClick={() =>
                                setSubnetFormByVlan((prev) => ({
                                  ...prev,
                                  [vlanKey]:
                                    prev[vlanKey] === null ||
                                    prev[vlanKey] === undefined
                                      ? {
                                          name: '',
                                          cidr: '26',
                                          ipv6Prefix: vlan.ipv6Prefix ?? '',
                                        }
                                      : null,
                                }))
                              }
                              className="rounded border border-violet-500/60 bg-violet-900/30 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-200"
                            >
                              {copy.addSubnet}
                            </button>
                          )}
                          <button
                            onClick={() =>
                              dispatch(
                                removeSiteVlan({
                                  siteId: site.id,
                                  vlanId: vlan.vlanId,
                                }),
                              )
                            }
                            className="rounded bg-rose-400/80 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-950"
                          >
                            {copy.remove}
                          </button>
                        </div>

                        {/* P6 — formulário inline de sub-rede */}
                        {subnetForm && vlan.networkId && (
                          <div className="mb-2 rounded border border-violet-700/40 bg-violet-950/20 p-2">
                            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-violet-300">
                              {copy.addSubnet}
                            </div>
                            <div className="flex gap-1">
                              <input
                                value={subnetForm.name}
                                onChange={(e) =>
                                  setSubnetFormByVlan((prev) => ({
                                    ...prev,
                                    [vlanKey]: { ...subnetForm, name: e.target.value },
                                  }))
                                }
                                placeholder="Nome..."
                                className="min-w-0 flex-1 rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1 text-xs text-slate-100"
                              />
                              <input
                                type="number"
                                min={8}
                                max={30}
                                value={subnetForm.cidr}
                                onChange={(e) =>
                                  setSubnetFormByVlan((prev) => ({
                                    ...prev,
                                    [vlanKey]: { ...subnetForm, cidr: e.target.value },
                                  }))
                                }
                                className="w-14 rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1 text-xs text-slate-100 [appearance:textfield]"
                                placeholder="CIDR"
                              />
                              <input
                                value={subnetForm.ipv6Prefix}
                                onChange={(e) =>
                                  setSubnetFormByVlan((prev) => ({
                                    ...prev,
                                    [vlanKey]: {
                                      ...subnetForm,
                                      ipv6Prefix: e.target.value,
                                    },
                                  }))
                                }
                                className="min-w-0 flex-1 rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1 text-xs text-slate-100"
                                placeholder={copy.ipv6Prefix}
                              />
                              <button
                                onClick={() => {
                                  if (!vlan.networkId) return;
                                  const cidr = Number(subnetForm.cidr);
                                  if (!Number.isFinite(cidr)) return;
                                  dispatch(
                                    addSubnet({
                                      siteId: site.id,
                                      networkId: vlan.networkId,
                                      vlanId: vlan.vlanId,
                                      name: subnetForm.name || `Sub-rede ${vlan.vlanId}`,
                                      cidr,
                                      networkAddress: vlan.startIp,
                                      ipv6Prefix:
                                        subnetForm.ipv6Prefix.trim() || undefined,
                                    }),
                                  );
                                  setSubnetFormByVlan((prev) => ({
                                    ...prev,
                                    [vlanKey]: null,
                                  }));
                                }}
                                className="rounded bg-violet-500 px-2 py-1 text-[10px] font-bold text-white"
                              >
                                OK
                              </button>
                              <button
                                onClick={() =>
                                  setSubnetFormByVlan((prev) => ({
                                    ...prev,
                                    [vlanKey]: null,
                                  }))
                                }
                                className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-[10px] text-slate-300"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        )}

                        {/* P7 — Seção L2: Elementos */}
                        <div className="mb-1.5">
                          <div className="mb-1 flex items-center gap-1.5">
                            <span className="rounded bg-sky-900/50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-400">
                              {copy.l2label}
                            </span>
                          </div>
                          <details className="rounded border border-[#2a4565] bg-[#0c1a30]">
                            <summary className="cursor-pointer select-none px-2 py-1 text-[11px] text-slate-200">
                              {copy.elementsSelected} ({selectedCount}{' '}
                              selecionados)
                            </summary>
                            <div className="theme-scrollbar max-h-32 space-y-1 overflow-y-auto px-2 pb-2">
                              {siteNodes.length === 0 && (
                                <div className="text-[11px] text-slate-400">
                                  {copy.noElementsSite}
                                </div>
                              )}
                              {siteNodes.map((node) => {
                                const checked = (node.vlans ?? []).includes(
                                  vlan.vlanId,
                                );
                                return (
                                  <label
                                    key={`${vlan.id}-${node.id}`}
                                    className="flex items-center gap-2 rounded border border-[#2a4565] px-2 py-1 text-[11px] text-slate-200"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() =>
                                        dispatch(
                                          toggleNodeVlanAssignment({
                                            nodeId: node.id,
                                            siteId: site.id,
                                            vlanId: vlan.vlanId,
                                          }),
                                        )
                                      }
                                    />
                                    <span>{node.label}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </details>
                        </div>

                        {/* P7 — Seção L3: Sub-redes */}
                        {vlanSubnets.length > 0 && (
                          <div>
                            <div className="mb-1 flex items-center gap-1.5">
                              <span className="rounded bg-violet-900/50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-400">
                                {copy.l3label}
                              </span>
                            </div>
                            <div className="space-y-1">
                              {vlanSubnets.map((subnet) => (
                                <div
                                  key={subnet.id}
                                  className="flex items-center justify-between rounded border border-violet-800/40 bg-violet-950/20 px-2 py-1 text-[11px]"
                                >
                                  <div className="min-w-0">
                                    <span className="text-violet-200">
                                      {subnet.name}
                                    </span>
                                    <div className="font-mono text-[10px] text-violet-300">
                                      {subnet.networkAddress}/{subnet.cidr}
                                    </div>
                                    {subnet.ipv6Prefix && (
                                      <div className="font-mono text-[10px] text-violet-400">
                                        {subnet.ipv6Prefix}
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    onClick={() =>
                                      dispatch(removeSubnet({ id: subnet.id }))
                                    }
                                    className="rounded bg-rose-500/70 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </details>
            );
          })}
        </div>

        <div className="rounded border border-[#35567f] bg-[#0d1a2e] p-2">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-300">
            {copy.vlanTableBySite}
          </div>
          <div className="theme-scrollbar h-[400px] overflow-y-auto overflow-x-auto">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="border-b border-[#35567f] px-2 py-1">
                    {copy.item}
                  </th>
                  <th className="border-b border-[#35567f] px-2 py-1">
                    {copy.ipRange}
                  </th>
                  <th className="border-b border-[#35567f] px-2 py-1">
                    {copy.type}
                  </th>
                  <th className="border-b border-[#35567f] px-2 py-1">
                    {copy.connections}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sites.map((site) => {
                  const siteVlanItems = siteVlans
                    .filter((item) => item.siteId === site.id)
                    .sort((a, b) => a.vlanId - b.vlanId);

                  if (siteVlanItems.length === 0) return null;

                  return [
                    <tr key={`group-${site.id}`}>
                      <td
                        colSpan={4}
                        className="border-b border-t border-slate-600 bg-slate-800/70 px-2 py-1 font-semibold text-sky-300"
                      >
                        📍 {site.name}
                      </td>
                    </tr>,
                    ...siteVlanItems.flatMap((vlan) => {
                      const vlanRange = getVlanRange(vlan);
                      const vlanNodes = nodes.filter(
                        (node) =>
                          node.siteId === site.id &&
                          node.category !== 'wan' &&
                          (node.vlans ?? []).includes(vlan.vlanId),
                      );
                      const ipRange = formatCompactRange(
                        vlan.startIp,
                        vlan.endIp,
                      );
                      const vlanTotalPossibleIps = vlan.capacity;

                      const vlanHeaderRow = (
                        <tr
                          key={`${site.id}-${vlan.vlanId}-header`}
                          className="bg-slate-900/60"
                        >
                          <td className="border-b border-slate-700 px-2 py-1 font-semibold text-cyan-300">
                            VLAN {vlan.vlanId} - {vlan.name}
                          </td>
                          <td className="border-b border-slate-700 px-2 py-1 text-slate-200">
                            <div>{ipRange}</div>
                            {vlan.ipv6Prefix && (
                              <div className="font-mono text-[10px] text-sky-300">
                                {vlan.ipv6Prefix}
                              </div>
                            )}
                          </td>
                          <td className="border-b border-slate-700 px-2 py-1 text-slate-300">
                            VLAN
                            <div className="text-[10px] text-slate-500">
                              {copy.addressAllocation}:{' '}
                              {allocationLabels[vlan.addressAllocation ?? 'dhcpv4']}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {copy.addressAllocationProfile}:{' '}
                              {
                                allocationProfileLabels[
                                  vlan.addressAllocation ?? 'dhcpv4'
                                ]
                              }
                            </div>
                          </td>
                          <td className="border-b border-slate-700 px-2 py-1 text-slate-300">
                            {vlanTotalPossibleIps.toLocaleString('pt-BR')}
                          </td>
                        </tr>
                      );

                      const nodeRows =
                        vlanNodes.length > 0
                          ? vlanNodes.map((node) => {
                              const nodeConnectionCount = links.filter(
                                (link) =>
                                  link.from === node.id || link.to === node.id,
                              ).length;

                              // Para routing devices em múltiplas VLANs, exibe o IP
                              // do NodeVlanInterface desta VLAN (gateway IP)
                              const nvIface = nodeVlanInterfaces?.find(
                                (i) =>
                                  i.nodeId === node.id &&
                                  i.vlanId === vlan.vlanId,
                              );
                              const apInterfaceMode =
                                node.category === 'access-point'
                                  ? String(
                                      node.techProfile?.fields?.apInterfaceMode ??
                                        'l2-bridge',
                                    )
                                  : null;
                              const isAccessPointL3 =
                                apInterfaceMode === 'l3-routed';
                              const rawManagementVlan =
                                node.category === 'access-point'
                                  ? String(
                                      node.techProfile?.fields
                                        ?.apManagementVlanId ?? '',
                                    ).trim()
                                  : '';
                              const parsedManagementVlan = Number(rawManagementVlan);
                              const apManagementVlanId =
                                Number.isFinite(parsedManagementVlan) &&
                                parsedManagementVlan >= 1 &&
                                parsedManagementVlan <= 4094
                                  ? Math.trunc(parsedManagementVlan)
                                  : null;
                              const isManagementVlan =
                                node.category === 'access-point' &&
                                !isAccessPointL3 &&
                                apManagementVlanId === vlan.vlanId;
                              const reservedRange = getNodeReservedRange(node);
                              const allocationIps =
                                (node.hostAllocations ?? []).length > 0
                                  ? node.hostAllocations.map(
                                      (allocation) => allocation.ip,
                                    )
                                  : [node.ip];
                              const hasIpInThisVlan =
                                !vlanRange ||
                                allocationIps.some((ip) => {
                                  const value = ipToNumber(ip);
                                  return (
                                    value !== null &&
                                    value >= vlanRange.start &&
                                    value <= vlanRange.end
                                  );
                                });
                              const displayIp =
                                node.category === 'access-point'
                                  ? isAccessPointL3
                                    ? (nvIface?.gatewayIp ?? '-')
                                    : isManagementVlan
                                      ? node.ip
                                      : '-'
                                  : nvIface?.gatewayIp
                                    ? nvIface.gatewayIp
                                    : hasIpInThisVlan &&
                                        reservedRange &&
                                        node.hostCount > 1
                                      ? formatCompactRange(
                                          reservedRange.startIp,
                                          reservedRange.endIp,
                                        )
                                      : hasIpInThisVlan
                                        ? node.ip
                                        : '-';
                              const displayIpv6 =
                                node.category === 'access-point'
                                  ? isAccessPointL3
                                    ? (nvIface?.gatewayIpv6 ?? '')
                                    : ''
                                  : (nvIface?.gatewayIpv6 ?? '');
                              const typeDetail =
                                node.category === 'access-point'
                                  ? isAccessPointL3
                                    ? 'L3 VLAN-IF'
                                    : isManagementVlan
                                      ? 'L2 MGMT'
                                      : 'L2 MEMBER'
                                  : null;

                              return (
                                <tr
                                  key={`${site.id}-${vlan.vlanId}-${node.id}`}
                                  className="hover:bg-slate-800/30"
                                >
                                  <td className="border-b border-slate-800 px-2 py-1 pl-4 text-slate-200">
                                    {node.label}
                                  </td>
                                  <td className="border-b border-slate-800 px-2 py-1 font-mono text-slate-300">
                                    <div>{displayIp || '-'}</div>
                                    {displayIpv6 && (
                                      <div className="text-[10px] text-sky-300">
                                        {displayIpv6}
                                      </div>
                                    )}
                                  </td>
                                  <td className="border-b border-slate-800 px-2 py-1 text-slate-300">
                                    <div>{getNodeVisual(node.category).label}</div>
                                    {typeDetail && (
                                      <div className="text-[10px] text-cyan-300">
                                        {typeDetail}
                                      </div>
                                    )}
                                  </td>
                                  <td className="border-b border-slate-800 px-2 py-1 text-slate-300">
                                    {nodeConnectionCount}
                                  </td>
                                </tr>
                              );
                            })
                          : [
                              <tr key={`${site.id}-${vlan.vlanId}-empty`}>
                                <td
                                  colSpan={4}
                                  className="border-b border-slate-800 px-2 py-1 pl-4 text-slate-500"
                                >
                                  {copy.noElementsInVlan}
                                </td>
                              </tr>,
                            ];

                      return [vlanHeaderRow, ...nodeRows];
                    }),
                  ];
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-[10px] text-slate-500">{copy.footer}</div>
        </div>
      </div>

      <div
        className={`pointer-events-none fixed bottom-5 right-5 z-[1200] transition-all duration-300 ${
          snackbar.open
            ? 'translate-y-0 opacity-100'
            : 'translate-y-2 opacity-0'
        }`}
      >
        <div className="pointer-events-auto flex min-w-[320px] max-w-[440px] items-start gap-3 rounded-md border border-amber-400/35 bg-slate-900 px-3 py-2 shadow-[0_12px_28px_rgba(0,0,0,0.45)]">
          <div className="mt-0.5 text-amber-300">!</div>
          <div className="flex-1 text-xs leading-relaxed text-slate-100">
            {snackbar.message}
          </div>
          <button
            type="button"
            onClick={() => setSnackbar((prev) => ({ ...prev, open: false }))}
            className="rounded px-1 py-0.5 text-[11px] font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-slate-100"
          >
            Fechar
          </button>
        </div>
      </div>
    </section>
  );
}
