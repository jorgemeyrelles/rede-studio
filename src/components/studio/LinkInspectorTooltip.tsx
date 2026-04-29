import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  setActiveLinkId,
  updateLink,
  addIpsecSa,
  updateIpsecSa,
  removeIpsecSa,
  addSslVpnProfile,
  updateSslVpnProfile,
  removeSslVpnProfile,
} from '../../features/network/networkSlice';

// ── Metadados visuais por tipo de link ─────────────────────────────────────────
const KIND_META: Record<string, { label: string; color: string }> = {
  lan: { label: 'LAN', color: '#60a5fa' },
  wan: { label: 'WAN', color: '#fb923c' },
  vpn: { label: 'VPN', color: '#22d3ee' },
  ipsec: { label: 'IPSec', color: '#22d3ee' },
  'inter-lan': { label: 'Inter-LAN', color: '#fbbf24' },
  other: { label: 'Outro', color: '#94a3b8' },
};

type Props = {
  /** Quando a legenda está aberta, o inspector fica suprimido */
  isLegendOpen: boolean;
  /** Ref do botão-âncora que serve de ponto de ancoragem do tooltip */
  anchorRef: React.RefObject<HTMLButtonElement | null>;
};

export default function LinkInspectorTooltip({
  isLegendOpen,
  anchorRef,
}: Props) {
  const dispatch = useAppDispatch();
  const activeLinkId = useAppSelector((state) => state.network.ui.activeLinkId);
  const links = useAppSelector((state) => state.network.links);
  const nodes = useAppSelector((state) => state.network.nodes);
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

  const kindMeta = KIND_META[activeLink.kind] ?? KIND_META.other;
  const isVpnish = activeLink.kind === 'ipsec' || activeLink.kind === 'vpn';
  const linkIpsecSas = ipsecSas.filter((s) => s.linkId === activeLinkId);
  const linkSslProfiles = sslVpnProfiles.filter(
    (p) => p.linkId === activeLinkId,
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
      <div className="flex max-h-[70vh] w-[300px] flex-col rounded-lg border border-[#2a4a6e] bg-[#060d19] shadow-[0_8px_28px_rgba(0,0,0,0.65)]">
        {/* ── Cabeçalho ─────────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 px-3 py-2">
          <div className="flex items-center gap-1.5">
            <svg
              width="14"
              height="9"
              viewBox="0 0 14 9"
              className="shrink-0 text-slate-400"
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
            <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">
              Inspector de Conexão
            </span>
            <span
              className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
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
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-slate-500 transition hover:bg-slate-800 hover:text-slate-200"
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
              <div className="h-px flex-1 bg-slate-700/70" />
              <svg
                width="11"
                height="7"
                viewBox="0 0 11 7"
                className="shrink-0 text-slate-600"
                fill="none"
              >
                <path
                  d="M0 3.5h9M6.5 1l3 2.5-3 2.5"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="h-px flex-1 bg-slate-700/70" />
            </div>
            <EndpointRow
              direction="Para"
              label={toNode?.label ?? activeLink.to}
              ip={toNode?.ip}
              color={kindMeta.color}
            />
          </div>

          {/* ── Controles de edição ──────────────────────────────────────── */}
          <div className="space-y-2.5 border-t border-slate-800 pt-2.5 text-[11px]">
            {/* Modo stateful */}
            <label className="flex flex-col gap-1">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                Modo stateful
              </span>
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
                className="rounded border border-slate-700 bg-slate-800/80 px-2 py-1 text-[10px] text-slate-200"
              >
                <option value="inherited">Herdado do FW</option>
                <option value="force-stateful">Forçar stateful</option>
                <option value="force-stateless">Forçar stateless</option>
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
                className="h-3 w-3 accent-blue-500"
              />
              <span className="text-[10px] text-slate-300">
                Gerar regras ACL
              </span>
            </label>

            {/* Descrição */}
            <label className="flex flex-col gap-1">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                Descrição
              </span>
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
                placeholder="Descrição do link..."
                className="rounded border border-slate-700 bg-slate-800/80 px-2 py-1 text-[10px] text-slate-200 placeholder-slate-600"
              />
            </label>

            {/* ── IPsec SAs ────────────────────────────────────────────── */}
            {isVpnish && (
              <details
                className="rounded border border-indigo-700/40 bg-indigo-950/20"
                open
              >
                <summary className="flex cursor-pointer select-none items-center justify-between px-2 py-1.5 text-[9px] font-semibold uppercase tracking-widest text-indigo-300">
                  <span>🔒 IPsec SAs</span>
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
                    className="rounded bg-indigo-700/30 px-1.5 py-0.5 text-[9px] text-indigo-300 hover:bg-indigo-600/40"
                  >
                    + SA
                  </button>
                </summary>
                <div className="space-y-2 px-2 pb-2 pt-1">
                  {linkIpsecSas.length === 0 && (
                    <p className="text-[10px] text-slate-500">
                      Nenhuma SA configurada.
                    </p>
                  )}
                  {linkIpsecSas.map((sa) => (
                    <div
                      key={sa.id}
                      className="rounded border border-slate-700/50 bg-slate-800/30 p-2 text-[10px]"
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-semibold text-slate-200">
                          {sa.name}
                        </span>
                        <div className="flex items-center gap-1">
                          <span
                            className={`rounded px-1 py-0.5 text-[9px] font-semibold ${
                              sa.state === 'established'
                                ? 'bg-green-800/50 text-green-300'
                                : sa.state === 'rekeying'
                                  ? 'bg-yellow-800/50 text-yellow-300'
                                  : sa.state === 'connecting'
                                    ? 'bg-blue-800/50 text-blue-300'
                                    : 'bg-red-800/50 text-red-300'
                            }`}
                          >
                            {sa.state}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              dispatch(removeIpsecSa({ id: sa.id }))
                            }
                            className="rounded px-1 text-red-400 hover:bg-red-900/30"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px] text-slate-400">
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
                          className="flex-1 rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-[9px] text-slate-200"
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
                          className="rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-[9px] text-slate-200"
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
                          className="rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-[9px] text-slate-200 placeholder-slate-600"
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
                          className="rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-[9px] text-slate-200 placeholder-slate-600"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* ── SSL-VPN Profiles ─────────────────────────────────────── */}
            {activeLink.kind === 'vpn' && (
              <details className="rounded border border-cyan-700/40 bg-cyan-950/20">
                <summary className="flex cursor-pointer select-none items-center justify-between px-2 py-1.5 text-[9px] font-semibold uppercase tracking-widest text-cyan-300">
                  <span>🌐 SSL-VPN</span>
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
                    className="rounded bg-cyan-700/30 px-1.5 py-0.5 text-[9px] text-cyan-300 hover:bg-cyan-600/40"
                  >
                    + Perfil
                  </button>
                </summary>
                <div className="space-y-2 px-2 pb-2 pt-1">
                  {linkSslProfiles.length === 0 && (
                    <p className="text-[10px] text-slate-500">
                      Nenhum perfil configurado.
                    </p>
                  )}
                  {linkSslProfiles.map((profile) => (
                    <div
                      key={profile.id}
                      className="rounded border border-slate-700/50 bg-slate-800/30 p-2 text-[10px]"
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
                          className="flex-1 rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-[10px] font-semibold text-slate-200"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            dispatch(removeSslVpnProfile({ id: profile.id }))
                          }
                          className="ml-1 rounded px-1 text-red-400 hover:bg-red-900/30"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <label className="w-14 shrink-0 text-[9px] text-slate-500">
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
                            className="flex-1 rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-[9px] text-slate-200"
                          >
                            <option value="password">Password</option>
                            <option value="certificate">Certificate</option>
                            <option value="ldap">LDAP</option>
                            <option value="radius">RADIUS</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="w-14 shrink-0 text-[9px] text-slate-500">
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
                            className="flex-1 rounded border border-slate-700 bg-slate-800 px-1 py-0.5 font-mono text-[9px] text-slate-200"
                            placeholder="10.0.50.0/24"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="w-14 shrink-0 text-[9px] text-slate-500">
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
                            className="flex-1 rounded border border-slate-700 bg-slate-800 px-1 py-0.5 font-mono text-[9px] text-slate-200 placeholder-slate-600"
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
                            className="flex-1 rounded border border-slate-700 bg-slate-800 px-1 py-0.5 font-mono text-[9px] text-slate-200 placeholder-slate-600"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="w-14 shrink-0 text-[9px] text-slate-500">
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
                            className="flex-1 rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-[9px] text-slate-200"
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
                            className="h-3 w-3 accent-cyan-500"
                          />
                          <span className="text-[9px] text-slate-400">
                            MFA habilitado
                          </span>
                        </label>
                        <div>
                          <label className="text-[9px] text-slate-500">
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
                            className="mt-0.5 w-full rounded border border-slate-700 bg-slate-800 px-1 py-0.5 font-mono text-[9px] text-slate-200 placeholder-slate-600"
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
      <span className="mt-0.5 w-7 shrink-0 text-[8px] font-bold uppercase tracking-widest text-slate-500">
        {direction}
      </span>
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span
          className="text-[11px] font-semibold"
          style={{ color: '#e2e8f0' }}
        >
          {label}
        </span>
        {ip && (
          <span className="font-mono text-[10px]" style={{ color }}>
            {ip}
          </span>
        )}
      </div>
    </div>
  );
}
