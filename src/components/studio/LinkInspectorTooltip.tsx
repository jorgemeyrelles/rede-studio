import { ArrowLeftRight, ArrowRight } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { QOSCLASS_LABEL } from '../../features/network/constants';
import {
  addIpsecSa,
  addSslVpnProfile,
  removeIpsecSa,
  removeSslVpnProfile,
  setActiveLinkId,
  updateIpsecSa,
  updateLink,
  updateLinkWanQos,
  updateSslVpnProfile,
} from '../../features/network/networkSlice';
import type { QosClass } from '../../features/network/types/entities';
import {
  getDefaultAclService,
  resolveGateway,
  resolveRouteType,
} from '../../features/network/utils';
import RemoveButton from './RemoveButton';
import { getDiagramTheme } from './utils/diagramTheme';
import { ui as studioUi } from './utils/studioUi';

// ── Metadados visuais por tipo de link ─────────────────────────────────────────
// Mesma cor da linha no diagrama (ver `resolveLinkVisual`) — tokens via tema.
function getKindMeta(kind: string): { label: string; color: string } {
  const { route, chalkDim } = getDiagramTheme();
  const map: Record<string, { label: string; color: string }> = {
    lan: { label: 'LAN', color: route.bgp },
    wan: { label: 'WAN', color: route.default },
    vpn: { label: 'VPN', color: route.vpn },
    ipsec: { label: 'IPSec', color: route.vpn },
    'inter-lan': { label: 'Inter-LAN', color: chalkDim },
    other: { label: 'Outro', color: chalkDim },
  };
  return map[kind] ?? map.other;
}

type Props = {
  /** Quando a legenda está aberta, o inspector fica suprimido */
  isLegendOpen: boolean;
  /** Ref do botão-âncora que serve de ponto de ancoragem do tooltip */
  anchorRef: React.RefObject<HTMLElement | null>;
};

export default function LinkInspectorTooltip({
  isLegendOpen,
  anchorRef,
}: Props) {
  const dispatch = useAppDispatch();
  const activeLinkId = useAppSelector((state) => state.network.ui.activeLinkId);
  const links = useAppSelector((state) => state.network.links);
  const nodes = useAppSelector((state) => state.network.nodes);
  const sites = useAppSelector((state) => state.network.sites);
  const aclRules = useAppSelector((state) => state.network.aclRules);
  const ipsecSas = useAppSelector((state) => state.network.ipsecSas);
  const sslVpnProfiles = useAppSelector(
    (state) => state.network.sslVpnProfiles,
  );
  const certificates = useAppSelector((state) => state.network.certificates);

  const tooltipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const visible = !isLegendOpen && !!activeLinkId;
  const activeLink = activeLinkId
    ? (links.find((l) => l.id === activeLinkId) ?? null)
    : null;
  const fromNode = activeLink
    ? (nodes.find((n) => n.id === activeLink.from) ?? null)
    : null;
  const toNode = activeLink
    ? (nodes.find((n) => n.id === activeLink.to) ?? null)
    : null;

  // Calcula posição: top-left do tooltip toca a quina bottom-right do botão
  const updatePos = () => {
    if (!anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    setPos({ top: r.bottom, left: r.right });
  };

  // Recalcula quando o tooltip se torna visível
  useLayoutEffect(() => {
    if (!visible) return;
    updatePos();
  }, [visible, anchorRef]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mantém ancorado durante scroll e resize
  useEffect(() => {
    if (!visible) return;
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [visible, anchorRef]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fecha ao clicar fora
  useEffect(() => {
    if (!visible) return;
    function onMouseDown(e: MouseEvent) {
      if (tooltipRef.current?.contains(e.target as Node)) return;
      if (anchorRef.current?.contains(e.target as Node)) return;
      dispatch(setActiveLinkId(null));
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [visible, dispatch, anchorRef]);

  if (!visible || !activeLink || !pos) return null;

  const kindMeta = getKindMeta(activeLink.kind);
  const isBidirectional = activeLink.bidirectional ?? true;
  const isVpnish = activeLink.kind === 'ipsec' || activeLink.kind === 'vpn';
  const isWanLink = activeLink.kind === 'wan';
  const linkIpsecSas = ipsecSas.filter((s) => s.linkId === activeLinkId);
  const linkSslProfiles = sslVpnProfiles.filter(
    (p) => p.linkId === activeLinkId,
  );
  const wanPolicy = activeLink.wanQosPolicy;
  const allQosClasses = Object.keys(QOSCLASS_LABEL) as QosClass[];

  // Nó da ponta deste link que não é a WAN (o roteador/FW do site) — pode ser
  // um nó diferente do que participa do túnel (ex.: FW liga na WAN, roteador
  // do mesmo site liga no elemento VPN/IPsec) — por isso o casamento abaixo
  // é por SITE, não só pelo nó exato.
  const wanEdgeNode =
    fromNode?.category === 'wan'
      ? toNode
      : toNode?.category === 'wan'
        ? fromNode
        : null;

  const linkedTunnelExists = isWanLink
    ? links.some((link) => {
        if (link.id === activeLink.id) return false;
        if (link.kind !== 'ipsec' && link.kind !== 'vpn') return false;
        const tFrom = nodes.find((n) => n.id === link.from);
        const tTo = nodes.find((n) => n.id === link.to);
        if (!tFrom || !tTo) return false;

        if (wanEdgeNode) {
          // Mesmo nó já participa diretamente do túnel.
          if (link.from === wanEdgeNode.id || link.to === wanEdgeNode.id) {
            return true;
          }
          // Ou outro nó do MESMO SITE participa (ex.: FW na WAN, roteador no túnel).
          return Boolean(
            wanEdgeNode.siteId &&
            (tFrom.siteId === wanEdgeNode.siteId ||
              tTo.siteId === wanEdgeNode.siteId),
          );
        }

        // Nenhum dos lados deste link é WAN — casa por par de sites.
        if (fromNode?.siteId && toNode?.siteId) {
          return (
            (tFrom.siteId === fromNode.siteId &&
              tTo.siteId === toNode.siteId) ||
            (tFrom.siteId === toNode.siteId && tTo.siteId === fromNode.siteId)
          );
        }
        return false;
      })
    : false;

  const fromRoutingMode = String(
    fromNode?.techProfile?.fields?.routingMode ?? 'static',
  );
  const routeType = resolveRouteType(
    activeLink.kind,
    fromNode?.siteId,
    toNode?.siteId,
    fromNode?.category,
    toNode?.category,
    fromRoutingMode,
  );
  const routeOwnerSiteId = fromNode?.siteId ?? toNode?.siteId ?? 'global';
  const routeOwnerSiteName =
    sites.find((s) => s.id === routeOwnerSiteId)?.name ?? 'Global / Inter-site';
  const inferredGateway = resolveGateway(routeType, fromNode?.ip, toNode?.ip);

  const linkedManagedAcl = aclRules.find(
    (rule) =>
      rule.linkId === activeLink.id &&
      rule.managed &&
      !rule.natExempt &&
      !rule.isReturnRule,
  );
  const effectiveSrcNode = linkedManagedAcl
    ? (nodes.find((n) => n.id === linkedManagedAcl.sourceNodeId) ?? null)
    : fromNode;
  const effectiveDstNode = linkedManagedAcl
    ? (nodes.find((n) => n.id === linkedManagedAcl.destinationNodeId) ?? null)
    : toNode;
  const derivedDefaultService = linkedManagedAcl?.service
    ? linkedManagedAcl.service
    : getDefaultAclService(
        activeLink.kind,
        fromNode?.category,
        toNode?.category,
      );

  return createPortal(
    <div
      ref={tooltipRef}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        zIndex: 9999,
      }}
    >
      <div className="flex max-h-[70vh] w-[300px] flex-col rounded-md border border-line bg-ink shadow-panel">
        {/* ── Cabeçalho ─────────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-3 py-2">
          <div className="flex items-center gap-1.5">
            <svg
              width="14"
              height="9"
              viewBox="0 0 14 9"
              className="shrink-0 text-chalk-dim"
            >
              <circle cx="1.5" cy="4.5" r="1.5" fill="currentColor" />
              <line
                x1="3"
                y1="4.5"
                x2="11"
                y2="4.5"
                stroke="currentColor"
                strokeWidth="1.3"
              />
              <circle cx="12.5" cy="4.5" r="1.5" fill="currentColor" />
            </svg>
            <span className="text-label text-chalk-dim">
              {studioUi().connectionInspector}
            </span>
            <span
              className="rounded-sm px-1.5 py-0.5 text-label"
              style={{
                backgroundColor: kindMeta.color + '1e',
                color: kindMeta.color,
                border: `1px solid ${kindMeta.color}50`,
              }}
            >
              {kindMeta.label}
            </span>
          </div>
          <button
            type="button"
            onClick={() => dispatch(setActiveLinkId(null))}
            title="Fechar inspector"
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-chalk-faint transition hover:bg-ink-raised-2 hover:text-chalk"
          >
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path
                d="M1 1l6 6M7 1L1 7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* ── Conteúdo scrollável ────────────────────────────────────────── */}
        <div className="theme-scrollbar flex-1 overflow-y-auto p-3">
          {/* Endpoints */}
          <div className="mb-3 space-y-1.5">
            <EndpointRow
              direction="De"
              label={fromNode?.label ?? activeLink.from}
              ip={fromNode?.ip}
              color={kindMeta.color}
            />
            <div className="flex items-center gap-1 px-8">
              <div className="h-px flex-1 bg-ink-raised-2" />
              <span className="text-chalk-faint">
                {isBidirectional ? (
                  <ArrowLeftRight size={13} aria-hidden="true" />
                ) : (
                  <ArrowRight size={13} aria-hidden="true" />
                )}
              </span>
              <div className="h-px flex-1 bg-ink-raised-2" />
            </div>
            <EndpointRow
              direction="Para"
              label={toNode?.label ?? activeLink.to}
              ip={toNode?.ip}
              color={kindMeta.color}
            />
          </div>

          {/* ── Controles de edição ──────────────────────────────────────── */}
          <div className="space-y-2.5 border-t border-line pt-2.5 text-2xs">
            {/* Modo stateful */}
            <label className="flex flex-col gap-1">
              <span className="text-label text-chalk-faint">Modo stateful</span>
              <select
                value={activeLink.statefulOverride ?? 'inherited'}
                onChange={(e) =>
                  dispatch(
                    updateLink({
                      id: activeLinkId!,
                      changes: {
                        statefulOverride: e.target.value as
                          | 'inherited'
                          | 'force-stateful'
                          | 'force-stateless',
                      },
                    }),
                  )
                }
                className="rounded-sm border border-line bg-ink-raised-2 px-2 py-1 text-2xs text-chalk"
              >
                <option value="inherited">Herdado do FW</option>
                <option value="force-stateful">
                  {studioUi().forceStateful}
                </option>
                <option value="force-stateless">
                  {studioUi().forceStateless}
                </option>
              </select>
            </label>

            {/* Gerar ACL */}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={activeLink.generateAcl ?? true}
                onChange={(e) =>
                  dispatch(
                    updateLink({
                      id: activeLinkId!,
                      changes: { generateAcl: e.target.checked },
                    }),
                  )
                }
                className="h-3 w-3 accent-[var(--accent)]"
              />
              <span className="text-2xs text-chalk-dim">Gerar regras ACL</span>
            </label>

            {/* Direção do link */}
            <label
              className="flex items-center gap-2"
              title={studioUi().bidirectionalLinkHint}
            >
              <input
                type="checkbox"
                checked={activeLink.bidirectional ?? true}
                onChange={(e) =>
                  dispatch(
                    updateLink({
                      id: activeLinkId!,
                      changes: { bidirectional: e.target.checked },
                    }),
                  )
                }
                className="h-3 w-3 accent-[var(--accent)]"
              />
              <span className="text-2xs text-chalk-dim">Link bidirecional</span>
            </label>

            {/* Duplex físico */}
            <label className="flex flex-col gap-1">
              <span className="text-label text-chalk-faint">Modo duplex</span>
              <select
                value={activeLink.duplexMode ?? 'full'}
                onChange={(e) =>
                  dispatch(
                    updateLink({
                      id: activeLinkId!,
                      changes: {
                        duplexMode: e.target.value as 'full' | 'half',
                      },
                    }),
                  )
                }
                className="rounded-sm border border-line bg-ink-raised-2 px-2 py-1 text-2xs text-chalk"
              >
                <option value="full">Full-duplex</option>
                <option value="half">Half-duplex</option>
              </select>
            </label>

            {/* Descrição */}
            <label className="flex flex-col gap-1">
              <span className="text-label text-chalk-faint">Descrição</span>
              <input
                type="text"
                value={activeLink.description ?? ''}
                onChange={(e) =>
                  dispatch(
                    updateLink({
                      id: activeLinkId!,
                      changes: { description: e.target.value },
                    }),
                  )
                }
                placeholder={studioUi().linkDescriptionPlaceholder}
                className="rounded-sm border border-line bg-ink-raised-2 px-2 py-1 text-2xs text-chalk placeholder-chalk-faint"
              />
            </label>

            {/* ── Perfil WAN do link ───────────────────────────────────── */}
            {isWanLink && (
              <details
                className="rounded-sm border border-line-strong bg-ink-raised-2"
                open
              >
                <summary className="flex cursor-pointer select-none items-center justify-between px-2 py-1.5 text-label text-chalk">
                  <span>{studioUi().wanLinkProfile}</span>
                  <span className="text-chalk-faint">QoS</span>
                </summary>
                <div className="space-y-2 px-2 pb-2 pt-1">
                  <label className="flex flex-col gap-1">
                    <span className="text-2xs text-chalk-faint">
                      Banda total (kbps)
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={wanPolicy?.totalBandwidthKbps ?? ''}
                      onChange={(e) =>
                        dispatch(
                          updateLinkWanQos({
                            linkId: activeLink.id,
                            policy: {
                              totalBandwidthKbps:
                                e.target.value !== ''
                                  ? Number(e.target.value)
                                  : undefined,
                            },
                          }),
                        )
                      }
                      placeholder="Ex: 100000"
                      className="rounded-sm border border-line bg-ink-raised-2 px-2 py-1 text-2xs text-chalk placeholder-chalk-faint"
                    />
                  </label>

                  <div className="space-y-1">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={linkedTunnelExists}
                        disabled
                        className="h-3 w-3 accent-[var(--accent)]"
                      />
                      <span className="text-2xs text-chalk-dim">
                        {studioUi().vpnTunnel}
                      </span>
                    </label>
                    <label
                      className={`flex items-center gap-2 ${
                        !linkedTunnelExists ? 'opacity-40' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={!linkedTunnelExists}
                        checked={wanPolicy?.dscpCopyToOuter ?? true}
                        onChange={(e) =>
                          dispatch(
                            updateLinkWanQos({
                              linkId: activeLink.id,
                              policy: { dscpCopyToOuter: e.target.checked },
                            }),
                          )
                        }
                        className="h-3 w-3 accent-[var(--accent)]"
                      />
                      <span className="text-2xs text-chalk-dim">
                        {studioUi().preserveDscp}
                      </span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    <div>
                      <p className="mb-1 text-2xs text-chalk-faint">
                        Classes garantidas
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {allQosClasses.map((cls) => {
                          const current = wanPolicy?.guaranteedClasses ?? [];
                          const selected = current.includes(cls);
                          return (
                            <button
                              key={`g-${cls}`}
                              type="button"
                              onClick={() => {
                                const next = selected
                                  ? current.filter((c) => c !== cls)
                                  : [...current, cls];
                                dispatch(
                                  updateLinkWanQos({
                                    linkId: activeLink.id,
                                    policy: { guaranteedClasses: next },
                                  }),
                                );
                              }}
                              className={`rounded-sm px-1.5 py-0.5 text-2xs font-bold transition ${
                                selected
                                  ? 'border border-signal-up/60 bg-signal-up/15 text-signal-up'
                                  : 'border border-line text-chalk-faint hover:text-chalk-dim'
                              }`}
                            >
                              {QOSCLASS_LABEL[cls]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <p className="mb-1 text-2xs text-chalk-faint">
                        Classes suprimidas
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {allQosClasses.map((cls) => {
                          const current = wanPolicy?.suppressedClasses ?? [];
                          const selected = current.includes(cls);
                          return (
                            <button
                              key={`s-${cls}`}
                              type="button"
                              onClick={() => {
                                const next = selected
                                  ? current.filter((c) => c !== cls)
                                  : [...current, cls];
                                dispatch(
                                  updateLinkWanQos({
                                    linkId: activeLink.id,
                                    policy: { suppressedClasses: next },
                                  }),
                                );
                              }}
                              className={`rounded-sm px-1.5 py-0.5 text-2xs font-bold transition ${
                                selected
                                  ? 'border border-signal-down/60 bg-signal-down/15 text-signal-down'
                                  : 'border border-line text-chalk-faint hover:text-chalk-dim'
                              }`}
                            >
                              {QOSCLASS_LABEL[cls]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </details>
            )}

            {/* ── Metadados de rota derivados ──────────────────────────── */}
            {isWanLink && (
              <details
                className="rounded-sm border border-line-strong bg-ink-raised-2"
                open
              >
                <summary className="flex cursor-pointer select-none items-center justify-between px-2 py-1.5 text-label text-chalk">
                  <span>{studioUi().derivedRouteMeta}</span>
                  <span className="text-chalk-faint">Read-only</span>
                </summary>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 px-2 pb-2 pt-1 text-2xs">
                  <span className="text-chalk-faint">
                    {studioUi().siteOwner}
                  </span>
                  <span className="text-chalk">{routeOwnerSiteName}</span>

                  <span className="text-chalk-faint">Tipo</span>
                  <span className="text-chalk">{routeType}</span>

                  <span className="text-chalk-faint">
                    {studioUi().inferredGateway}
                  </span>
                  <span className="font-mono text-chalk">
                    {inferredGateway}
                  </span>

                  <span className="text-chalk-faint">
                    {studioUi().inferredDestination}
                  </span>
                  <span className="font-mono text-chalk">
                    {routeType === 'Default'
                      ? '0.0.0.0/0'
                      : `${toNode?.ip ?? '0.0.0.0'}/${toNode?.cidr ?? 0}`}
                  </span>
                </div>
              </details>
            )}

            {/* ── Resumo ACL derivado do link ──────────────────────────── */}
            {isWanLink && (
              <details
                className="rounded-sm border border-signal-warn/40 bg-signal-warn/10"
                open
              >
                <summary className="flex cursor-pointer select-none items-center justify-between px-2 py-1.5 text-label text-signal-warn">
                  <span>{studioUi().derivedAclSummary}</span>
                  <span className="text-chalk-faint">Topologia</span>
                </summary>
                <div className="space-y-1 px-2 pb-2 pt-1 text-2xs">
                  {!linkedManagedAcl && (
                    <p className="text-chalk-faint">
                      {studioUi().noManagedAcl}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    <span className="text-chalk-faint">
                      {studioUi().effectiveSource}
                    </span>
                    <span className="text-chalk">
                      {effectiveSrcNode?.label ??
                        linkedManagedAcl?.sourceNodeId ??
                        activeLink.from}
                    </span>

                    <span className="text-chalk-faint">
                      {studioUi().effectiveDestination}
                    </span>
                    <span className="text-chalk">
                      {effectiveDstNode?.label ??
                        linkedManagedAcl?.destinationNodeId ??
                        activeLink.to}
                    </span>

                    <span className="text-chalk-faint">
                      {studioUi().defaultService}
                    </span>
                    <span className="text-chalk">{derivedDefaultService}</span>

                    <span className="text-chalk-faint">Gerar ACL</span>
                    <span className="text-chalk">
                      {(activeLink.generateAcl ?? true) ? 'Sim' : 'Não'}
                    </span>

                    <span className="text-chalk-faint">Bidirecional</span>
                    <span className="text-chalk">
                      {(activeLink.bidirectional ?? true)
                        ? 'Sim — 1 linha cobre os dois sentidos'
                        : studioUi().returnExceptionNo}
                    </span>

                    <span className="text-chalk-faint">Duplex</span>
                    <span className="text-chalk">
                      {(activeLink.duplexMode ?? 'full') === 'half'
                        ? 'Half-duplex'
                        : 'Full-duplex'}
                    </span>
                  </div>
                </div>
              </details>
            )}

            {/* ── IPsec SAs ────────────────────────────────────────────── */}
            {isVpnish && (
              <details
                className="rounded-sm border border-route-vpn/40 bg-route-vpn/10"
                open
              >
                <summary className="flex cursor-pointer select-none items-center justify-between px-2 py-1.5 text-label text-route-vpn">
                  <span>IPsec SAs</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      dispatch(
                        addIpsecSa({
                          linkId: activeLinkId!,
                          name: `SA-${linkIpsecSas.length + 1}`,
                          phase: 1,
                          state: 'down',
                          encAlg: 'aes256',
                          hashAlg: 'sha256',
                          dhGroup: 14,
                          lifetimeSec: 86400,
                        }),
                      );
                    }}
                    className="rounded-sm bg-route-vpn/15 px-1.5 py-0.5 text-2xs text-route-vpn hover:bg-route-vpn/40"
                  >
                    + SA
                  </button>
                </summary>
                <div className="space-y-2 px-2 pb-2 pt-1">
                  {linkIpsecSas.length === 0 && (
                    <p className="text-2xs text-chalk-faint">
                      Nenhuma SA configurada.
                    </p>
                  )}
                  {linkIpsecSas.map((sa) => (
                    <div
                      key={sa.id}
                      className="rounded-sm border border-line bg-ink-raised-2 p-2 text-2xs"
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-semibold text-chalk">
                          {sa.name}
                        </span>
                        <div className="flex items-center gap-1">
                          <span
                            className={`rounded-sm px-1 py-0.5 text-2xs font-semibold ${
                              sa.state === 'established'
                                ? 'bg-signal-up/15 text-signal-up'
                                : sa.state === 'rekeying'
                                  ? 'bg-signal-warn/15 text-signal-warn'
                                  : sa.state === 'connecting'
                                    ? 'bg-accent/15 text-chalk'
                                    : 'bg-signal-down/15 text-signal-down'
                            }`}
                          >
                            {sa.state}
                          </span>
                          <RemoveButton
                            onClick={() =>
                              dispatch(removeIpsecSa({ id: sa.id }))
                            }
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-2xs text-chalk-dim">
                        <span>Fase {sa.phase}</span>
                        <span>DH: {sa.dhGroup ?? '—'}</span>
                        <span>Cifra: {sa.encAlg ?? '—'}</span>
                        <span>Hash: {sa.hashAlg ?? '—'}</span>
                        <span>
                          Lifetime:{' '}
                          {sa.lifetimeSec ? `${sa.lifetimeSec}s` : '—'}
                        </span>
                      </div>
                      <div className="mt-1 flex gap-1">
                        <select
                          value={sa.state}
                          onChange={(e) =>
                            dispatch(
                              updateIpsecSa({
                                id: sa.id,
                                changes: {
                                  state: e.target.value as typeof sa.state,
                                },
                              }),
                            )
                          }
                          className="flex-1 rounded-sm border border-line bg-ink-raised-2 px-1 py-0.5 text-2xs text-chalk"
                        >
                          <option value="established">established</option>
                          <option value="rekeying">rekeying</option>
                          <option value="connecting">connecting</option>
                          <option value="down">down</option>
                        </select>
                        <select
                          value={sa.phase}
                          onChange={(e) =>
                            dispatch(
                              updateIpsecSa({
                                id: sa.id,
                                changes: {
                                  phase: Number(e.target.value) as 1 | 2,
                                },
                              }),
                            )
                          }
                          className="rounded-sm border border-line bg-ink-raised-2 px-1 py-0.5 text-2xs text-chalk"
                        >
                          <option value={1}>Phase 1</option>
                          <option value={2}>Phase 2</option>
                        </select>
                      </div>
                      <div className="mt-1 grid grid-cols-2 gap-1">
                        <input
                          type="text"
                          placeholder="Local ID"
                          value={sa.localId ?? ''}
                          onChange={(e) =>
                            dispatch(
                              updateIpsecSa({
                                id: sa.id,
                                changes: { localId: e.target.value },
                              }),
                            )
                          }
                          className="rounded-sm border border-line bg-ink-raised-2 px-1 py-0.5 text-2xs text-chalk placeholder-chalk-faint"
                        />
                        <input
                          type="text"
                          placeholder="Remote ID"
                          value={sa.remoteId ?? ''}
                          onChange={(e) =>
                            dispatch(
                              updateIpsecSa({
                                id: sa.id,
                                changes: { remoteId: e.target.value },
                              }),
                            )
                          }
                          className="rounded-sm border border-line bg-ink-raised-2 px-1 py-0.5 text-2xs text-chalk placeholder-chalk-faint"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* ── SSL-VPN Profiles ─────────────────────────────────────── */}
            {activeLink.kind === 'vpn' && (
              <details className="rounded-sm border border-line-strong bg-ink-raised-2">
                <summary className="flex cursor-pointer select-none items-center justify-between px-2 py-1.5 text-label text-chalk">
                  <span>SSL-VPN</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      dispatch(
                        addSslVpnProfile({
                          linkId: activeLinkId!,
                          name: `VPN-Profile-${linkSslProfiles.length + 1}`,
                          authMode: 'password',
                          ipPool: '10.0.50.0/24',
                          mfaEnabled: false,
                        }),
                      );
                    }}
                    className="rounded-sm bg-accent/15 px-1.5 py-0.5 text-2xs text-chalk hover:bg-accent/15"
                  >
                    + Perfil
                  </button>
                </summary>
                <div className="space-y-2 px-2 pb-2 pt-1">
                  {linkSslProfiles.length === 0 && (
                    <p className="text-2xs text-chalk-faint">
                      Nenhum perfil configurado.
                    </p>
                  )}
                  {linkSslProfiles.map((profile) => (
                    <div
                      key={profile.id}
                      className="rounded-sm border border-line bg-ink-raised-2 p-2 text-2xs"
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <input
                          type="text"
                          value={profile.name}
                          onChange={(e) =>
                            dispatch(
                              updateSslVpnProfile({
                                id: profile.id,
                                changes: { name: e.target.value },
                              }),
                            )
                          }
                          className="flex-1 rounded-sm border border-line bg-ink-raised-2 px-1 py-0.5 text-2xs font-semibold text-chalk"
                        />
                        <RemoveButton
                          onClick={() =>
                            dispatch(removeSslVpnProfile({ id: profile.id }))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <label className="w-14 shrink-0 text-2xs text-chalk-faint">
                            Auth
                          </label>
                          <select
                            value={profile.authMode}
                            onChange={(e) =>
                              dispatch(
                                updateSslVpnProfile({
                                  id: profile.id,
                                  changes: {
                                    authMode: e.target
                                      .value as typeof profile.authMode,
                                  },
                                }),
                              )
                            }
                            className="flex-1 rounded-sm border border-line bg-ink-raised-2 px-1 py-0.5 text-2xs text-chalk"
                          >
                            <option value="password">Password</option>
                            <option value="certificate">Certificate</option>
                            <option value="ldap">LDAP</option>
                            <option value="radius">RADIUS</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="w-14 shrink-0 text-2xs text-chalk-faint">
                            IP Pool
                          </label>
                          <input
                            type="text"
                            value={profile.ipPool ?? ''}
                            onChange={(e) =>
                              dispatch(
                                updateSslVpnProfile({
                                  id: profile.id,
                                  changes: { ipPool: e.target.value },
                                }),
                              )
                            }
                            className="flex-1 rounded-sm border border-line bg-ink-raised-2 px-1 py-0.5 font-mono text-2xs text-chalk"
                            placeholder="10.0.50.0/24"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="w-14 shrink-0 text-2xs text-chalk-faint">
                            DNS
                          </label>
                          <input
                            type="text"
                            value={profile.dns1 ?? ''}
                            onChange={(e) =>
                              dispatch(
                                updateSslVpnProfile({
                                  id: profile.id,
                                  changes: { dns1: e.target.value },
                                }),
                              )
                            }
                            placeholder="DNS 1"
                            className="flex-1 rounded-sm border border-line bg-ink-raised-2 px-1 py-0.5 font-mono text-2xs text-chalk placeholder-chalk-faint"
                          />
                          <input
                            type="text"
                            value={profile.dns2 ?? ''}
                            onChange={(e) =>
                              dispatch(
                                updateSslVpnProfile({
                                  id: profile.id,
                                  changes: { dns2: e.target.value },
                                }),
                              )
                            }
                            placeholder="DNS 2"
                            className="flex-1 rounded-sm border border-line bg-ink-raised-2 px-1 py-0.5 font-mono text-2xs text-chalk placeholder-chalk-faint"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="w-14 shrink-0 text-2xs text-chalk-faint">
                            Cert.
                          </label>
                          <select
                            value={profile.serverCertId ?? ''}
                            onChange={(e) =>
                              dispatch(
                                updateSslVpnProfile({
                                  id: profile.id,
                                  changes: {
                                    serverCertId: e.target.value || undefined,
                                  },
                                }),
                              )
                            }
                            className="flex-1 rounded-sm border border-line bg-ink-raised-2 px-1 py-0.5 text-2xs text-chalk"
                          >
                            <option value="">— nenhum —</option>
                            {certificates
                              .filter(
                                (c) => c.type === 'local' || c.type === 'ca',
                              )
                              .map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                          </select>
                        </div>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={profile.mfaEnabled ?? false}
                            onChange={(e) =>
                              dispatch(
                                updateSslVpnProfile({
                                  id: profile.id,
                                  changes: { mfaEnabled: e.target.checked },
                                }),
                              )
                            }
                            className="h-3 w-3 accent-[var(--accent)]"
                          />
                          <span className="text-2xs text-chalk-dim">
                            MFA habilitado
                          </span>
                        </label>
                        <div>
                          <label className="text-2xs text-chalk-faint">
                            Split Tunnel (uma rota por linha)
                          </label>
                          <textarea
                            value={(profile.splitTunnelRoutes ?? []).join('\n')}
                            onChange={(e) =>
                              dispatch(
                                updateSslVpnProfile({
                                  id: profile.id,
                                  changes: {
                                    splitTunnelRoutes: e.target.value
                                      .split('\n')
                                      .filter(Boolean),
                                  },
                                }),
                              )
                            }
                            rows={2}
                            placeholder="10.0.0.0/8"
                            className="mt-0.5 w-full rounded-sm border border-line bg-ink-raised-2 px-1 py-0.5 font-mono text-2xs text-chalk placeholder-chalk-faint"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Sub-componente de linha de endpoint ────────────────────────────────────────
function EndpointRow({
  direction,
  label,
  ip,
  color,
}: {
  direction: string;
  label: string;
  ip?: string;
  color: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 w-7 shrink-0 text-label text-chalk-faint">
        {direction}
      </span>
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span className="text-2xs font-semibold text-chalk">{label}</span>
        {ip && (
          <span className="font-mono text-2xs" style={{ color }}>
            {ip}
          </span>
        )}
      </div>
    </div>
  );
}
