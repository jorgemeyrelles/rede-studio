import { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  addSiteVlan,
  removeSiteVlan,
  setPersistWarning,
  setVlanAssignmentMode,
  toggleNodeVlanAssignment,
} from '../../features/network/networkSlice';
import {
  CAPACITY_OPTIONS,
  createDefaultVlanDraft,
  formatCompactRange,
  getSiteVlanCopy,
  getNodeVisual,
  getSiteRadicalOptions,
  type SiteVlanDraft,
  type StudioLanguage,
} from './catalog';

type SiteVlanPanelProps = {
  language: StudioLanguage;
};

export default function SiteVlanPanel({ language }: SiteVlanPanelProps) {
  const dispatch = useAppDispatch();
  const { sites, nodes, links, siteVlans, ui, meta, siteNetworks } =
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

  return (
    <section className="w-full rounded-lg border border-[#315072] bg-[#0a1324]/80 p-3 shadow-[0_0_0_1px_rgba(27,49,77,0.35),0_12px_24px_rgba(0,0,0,0.28)]">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-300">
        Redes &amp; VLANs
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div
          ref={dropdownAreaRef}
          className="theme-scrollbar h-[400px] space-y-2 overflow-y-auto pr-1"
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
            const radicalOptions = getSiteRadicalOptions(
              site.id,
              site.ipOctet,
              siteVlans,
              nodes,
            );
            const draft =
              vlanDraftBySite[site.id] ??
              createDefaultVlanDraft(site.id, site.ipOctet, siteVlans, nodes);

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
                  {/* Seletor de rede — aparece somente se o site tiver redes cadastradas */}
                  {siteNets.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400">
                        Rede:
                      </span>
                      <select
                        value={selectedNetworkId ?? ''}
                        onChange={(e) =>
                          setSelectedNetworkBySite((prev) => ({
                            ...prev,
                            [site.id]: e.target.value || null,
                          }))
                        }
                        className="rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1 text-[11px] text-slate-100"
                      >
                        <option value="">— sem rede —</option>
                        {siteNets.map((net) => (
                          <option key={net.id} value={net.id}>
                            {net.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="grid gap-2 md:grid-cols-[76px_110px_120px_1fr_auto]">
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
                      className="w-full rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1.5 text-xs text-slate-100 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      placeholder={copy.vlanPlaceholder}
                    />
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setOpenCapacitySiteId((current) =>
                            current === site.id ? null : site.id,
                          );
                          setOpenRadicalSiteId(null);
                        }}
                        className="w-full rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1.5 text-left text-xs text-slate-100"
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
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setOpenRadicalSiteId((current) =>
                            current === site.id ? null : site.id,
                          );
                          setOpenCapacitySiteId(null);
                        }}
                        className="w-full rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1.5 text-left text-xs text-slate-100"
                      >
                        {draft.startRadical}
                      </button>
                      {openRadicalSiteId === site.id && (
                        <div className="theme-scrollbar absolute z-20 mt-1 max-h-[150px] w-full overflow-y-auto rounded border border-[#35567f] bg-[#0d1a2e] shadow-lg">
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
                    <input
                      value={draft.name}
                      onChange={(event) =>
                        setVlanDraft(site.id, site.ipOctet, (current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      className="rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1.5 text-xs text-slate-100"
                      placeholder={copy.vlanNamePlaceholder}
                    />
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
                          }),
                        );
                        setOpenRadicalSiteId(null);
                        setOpenCapacitySiteId(null);
                      }}
                      className="rounded-md bg-emerald-300 px-2 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-950"
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

                    return (
                      <div
                        key={vlan.id}
                        className="rounded border border-[#2f5279] bg-[#0a172b] p-2"
                      >
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="rounded bg-sky-300/20 px-2 py-0.5 font-mono text-[11px] text-sky-200">
                            VLAN {vlan.vlanId}
                          </span>
                          <span className="text-xs text-slate-200">
                            {vlan.name}
                          </span>
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
                            {ipRange}
                          </td>
                          <td className="border-b border-slate-700 px-2 py-1 text-slate-300">
                            VLAN
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

                              return (
                                <tr
                                  key={`${site.id}-${vlan.vlanId}-${node.id}`}
                                  className="hover:bg-slate-800/30"
                                >
                                  <td className="border-b border-slate-800 px-2 py-1 pl-4 text-slate-200">
                                    {node.label}
                                  </td>
                                  <td className="border-b border-slate-800 px-2 py-1 font-mono text-slate-300">
                                    {node.ip || '-'}
                                  </td>
                                  <td className="border-b border-slate-800 px-2 py-1 text-slate-300">
                                    {getNodeVisual(node.category).label}
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
