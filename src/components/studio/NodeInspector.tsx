import { AlertTriangle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  DSCP_BY_QOSCLASS,
  QOSCLASS_LABEL,
} from '../../features/network/constants';
import {
  addActiveSession,
  addFwPolicy,
  addNatRule,
  addQosQueue,
  clearActiveSessions,
  removeFwPolicy,
  removeNatRule,
  removeQosQueue,
  setInspectorNodeId,
  updateFwPolicy,
  updateNatRule,
  updateNode,
  updateQosQueue,
} from '../../features/network/networkSlice';
import type {
  FwPolicyAction,
  NatType,
  SessionProto,
  SessionState,
} from '../../features/network/types';
import type { QosClass, QosQueue } from '../../features/network/types/entities';
import { getNodeVisual, parseVlans } from './catalog';
import RemoveButton from './RemoveButton';
import { ui as studioUi } from './utils/studioUi';

const FW_CATEGORIES = new Set(['firewall', 'ids', 'ips', 'proxy']);
const VPN_CATEGORIES = new Set([
  'vpn',
  'ipsec',
  'wireguard',
  'sdwan',
  'gre',
  'mpls',
]);

// ── Badge de segurança IPsec/VPN ──────────────────────────────────────────────
type SecurityGrade = 'strong' | 'ok' | 'weak';

function computeIpsecSecurityGrade(
  fields: Record<string, import('../../features/network/types').TechValue>,
): SecurityGrade {
  const enc = String(fields['encryptionSuite'] ?? '').toLowerCase();
  const hash = String(fields['integrity'] ?? '').toLowerCase();
  const dh = String(fields['dhGroup'] ?? '').toLowerCase();

  // Weak: 3DES, MD5, ou DH group-14 ou inferior
  if (
    enc.includes('3des') ||
    hash === 'md5' ||
    dh === 'group-5' ||
    dh === 'group-2' ||
    dh === 'group-1'
  ) {
    return 'weak';
  }
  // Strong: AES-256-GCM ou ChaCha + SHA-256+ + group-19+
  if (
    (enc.includes('256-gcm') || enc.includes('chacha20')) &&
    (hash === 'sha-256' || hash === 'sha-384' || hash === 'sha-512') &&
    (dh === 'group-19' || dh === 'group-20' || dh === 'group-21')
  ) {
    return 'strong';
  }
  return 'ok';
}

const GRADE_LABEL: Record<SecurityGrade, string> = {
  strong: 'Suite forte',
  ok: 'Suite aceitável',
  weak: 'Suite fraca',
};

const GRADE_CLASS: Record<SecurityGrade, string> = {
  strong: 'bg-signal-up/10 text-signal-up border border-signal-up/40',
  ok: 'bg-signal-warn/10 text-signal-warn border border-signal-warn/40',
  weak: 'bg-signal-down/10 text-signal-down border border-signal-down/40',
};

const SESSION_STATE_COLOR: Record<SessionState, string> = {
  ESTABLISHED: 'text-signal-up',
  SYN_SENT: 'text-signal-warn',
  TIME_WAIT: 'text-route-default',
  UDP: 'text-route-bgp',
  ICMP: 'text-chalk-dim',
};

export default function NodeInspector() {
  const dispatch = useAppDispatch();
  const { nodes, ui, fwPolicies, natRules, activeSessions, nodeQosProfiles } =
    useAppSelector((state) => state.network);
  const node = useMemo(
    () => nodes.find((item) => item.id === ui.inspectorNodeId) ?? null,
    [nodes, ui.inspectorNodeId],
  );

  // P16 — QoS Profile form state
  const [qosFormName, setQosFormName] = useState('');
  const [qosFormClass, setQosFormClass] = useState<QosClass>('default');
  const [qosFormPriority, setQosFormPriority] =
    useState<QosQueue['priority']>('best-effort');
  const [qosFormMinBw, setQosFormMinBw] = useState<number | ''>('');

  // Estado local para novo formulário de sessão simulada
  const [sessForm, setSessForm] = useState({
    srcIp: '',
    srcPort: '',
    dstIp: '',
    dstPort: '',
    protocol: 'tcp' as SessionProto,
    state: 'ESTABLISHED' as SessionState,
    ttlSec: '300',
  });

  if (!node) return null;

  const isWan = node.category === 'wan';
  const isFw = FW_CATEGORIES.has(node.category);
  const isVpn = VPN_CATEGORIES.has(node.category);
  const visual = getNodeVisual(node.category);

  const nodePolicies = fwPolicies.filter((p) => p.nodeId === node.id);
  const nodeNatRules = natRules.filter((r) => r.nodeId === node.id);
  const nodeSessions = activeSessions.filter((s) => s.nodeId === node.id);

  return (
    <div className="absolute right-4 top-4 z-10 w-[360px] max-h-[90vh] overflow-y-auto rounded-md border border-line-strong bg-ink-raised p-3 shadow-panel">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-label text-chalk">Detalhes do Ícone</div>
          <h3 className="mt-1 text-sm font-semibold text-chalk">
            [{visual.short}] {visual.label}
          </h3>
        </div>
        <button
          onClick={() => dispatch(setInspectorNodeId(null))}
          className="rounded-sm border border-line-strong bg-ink-raised-2 px-2 py-1 text-2xs font-bold uppercase"
        >
          Fechar
        </button>
      </div>

      <div className="mb-3 rounded-md border border-line bg-ink px-2 py-1 text-2xs text-chalk-dim">
        <span className="mr-2 text-chalk">ID:</span>
        {node.id}
      </div>

      <div className="space-y-2 text-xs">
        <label className="block">
          <span className="mb-1 block text-chalk-dim">
            {studioUi().deviceName}
          </span>
          <input
            value={node.label}
            onChange={(event) =>
              dispatch(
                updateNode({
                  id: node.id,
                  changes: { label: event.target.value },
                }),
              )
            }
            className="w-full rounded-sm border border-line bg-ink px-2 py-1.5 text-chalk"
          />
        </label>

        {!isWan && (
          <>
            <label className="block">
              <span className="mb-1 block text-chalk-dim">IPv4</span>
              <input
                value={node.ip}
                onChange={(event) =>
                  dispatch(
                    updateNode({
                      id: node.id,
                      changes: { ip: event.target.value },
                    }),
                  )
                }
                className="w-full rounded-sm border border-line bg-ink px-2 py-1.5 text-chalk"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-chalk-dim">IPv6</span>
              <input
                value={node.ipv6 ?? ''}
                onChange={(event) =>
                  dispatch(
                    updateNode({
                      id: node.id,
                      changes: { ipv6: event.target.value },
                    }),
                  )
                }
                className="w-full rounded-sm border border-line bg-ink px-2 py-1.5 text-chalk"
                placeholder="2001:db8::10"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-chalk-dim">CIDR</span>
              <input
                type="number"
                min={1}
                max={32}
                value={node.cidr}
                onChange={(event) =>
                  dispatch(
                    updateNode({
                      id: node.id,
                      changes: { cidr: Number(event.target.value) },
                    }),
                  )
                }
                className="w-full rounded-sm border border-line bg-ink px-2 py-1.5 text-chalk"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-chalk-dim">VLANs (csv)</span>
              <input
                value={node.vlans.join(',')}
                placeholder={studioUi().noVlanAssigned}
                onChange={(event) =>
                  dispatch(
                    updateNode({
                      id: node.id,
                      changes: { vlans: parseVlans(event.target.value) },
                    }),
                  )
                }
                className="w-full rounded-sm border border-line bg-ink px-2 py-1.5 text-chalk"
              />
              {node.vlans.length === 0 && (
                <span className="mt-1 block text-2xs text-chalk-dim">
                  {studioUi().noVlanAssignedToObject}
                </span>
              )}
            </label>
          </>
        )}

        {isWan && (
          <div className="rounded-md border border-line bg-ink px-2 py-2 text-2xs text-chalk-dim">
            WAN/Internet nao possui atribuicao de IP local no Studio.
          </div>
        )}

        <label className="block">
          <span className="mb-1 block text-chalk-dim">Descrição/Função</span>
          <textarea
            value={node.description}
            onChange={(event) =>
              dispatch(
                updateNode({
                  id: node.id,
                  changes: { description: event.target.value },
                }),
              )
            }
            className="h-20 w-full rounded-sm border border-line bg-ink px-2 py-1.5 text-chalk"
          />
        </label>

        {/* ── Badge de Segurança IPsec/VPN ──────────────────────────────────── */}
        {isVpn &&
          node.techProfile &&
          (() => {
            const fields = node.techProfile.fields;
            const tunnelType = String(fields['tunnelType'] ?? '');
            const isIpsec = tunnelType === 'ipsec-site-to-site';
            const isSslVpn = tunnelType === 'ssl-remote';
            const grade = isIpsec ? computeIpsecSecurityGrade(fields) : null;

            return (
              <details
                className="rounded-sm border border-route-vpn/40 bg-route-vpn/10"
                open
              >
                <summary className="cursor-pointer select-none px-2 py-1 text-label text-route-vpn">
                  {studioUi().cryptoProfile}
                </summary>
                <div className="space-y-1.5 px-2 pb-2 pt-1">
                  {/* Badge de segurança */}
                  {grade && (
                    <div
                      className={`rounded-sm px-2 py-1.5 text-2xs font-semibold ${GRADE_CLASS[grade]}`}
                    >
                      {GRADE_LABEL[grade]}
                    </div>
                  )}

                  {/* Campos IPsec */}
                  {isIpsec && (
                    <div className="grid grid-cols-2 gap-1 text-2xs">
                      {[
                        { key: 'encryptionSuite', label: 'Cifragem' },
                        { key: 'integrity', label: 'Integridade' },
                        { key: 'dhGroup', label: 'Grupo DH' },
                        { key: 'prf', label: 'PRF' },
                        { key: 'ikeVersion', label: 'IKE' },
                        { key: 'authMethod', label: 'Auth' },
                        { key: 'ikeLifetime', label: 'IKE Life (s)' },
                        { key: 'saLifetime', label: 'SA Life (s)' },
                        { key: 'rekeyMargin', label: 'Rekey (%)' },
                        { key: 'dpdInterval', label: 'DPD Int. (s)' },
                        { key: 'dpdRetries', label: 'DPD Ret.' },
                        { key: 'compression', label: 'Compressão' },
                      ].map(({ key, label }) => {
                        const val = fields[key];
                        if (val === undefined || val === '') return null;
                        return (
                          <div key={key} className="flex flex-col">
                            <span className="text-2xs text-chalk-faint">
                              {label}
                            </span>
                            <span className="font-mono text-chalk">
                              {String(val)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Campos SSL-VPN */}
                  {isSslVpn && (
                    <div className="grid grid-cols-2 gap-1 text-2xs">
                      {[
                        { key: 'tlsVersion', label: 'TLS' },
                        {
                          key: 'sessionResumption',
                          label: 'Session Resumption',
                        },
                        { key: 'idleTimeout', label: 'Idle Timeout (s)' },
                        { key: 'maxSessions', label: studioUi().maxSessions },
                      ].map(({ key, label }) => {
                        const val = fields[key];
                        if (val === undefined) return null;
                        return (
                          <div key={key} className="flex flex-col">
                            <span className="text-2xs text-chalk-faint">
                              {label}
                            </span>
                            <span className="font-mono text-chalk">
                              {String(val)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {!isIpsec && !isSslVpn && (
                    <p className="text-2xs text-chalk-faint">
                      Tipo de túnel{' '}
                      <span className="font-mono text-chalk-dim">
                        {tunnelType || studioUi().notDefined}
                      </span>{' '}
                      — sem parâmetros criptográficos detalhados.
                    </p>
                  )}
                </div>
              </details>
            );
          })()}

        {/* ── Fase 3 — Políticas de Firewall ────────────────────────── */}
        {isFw && (
          <details className="rounded-sm border border-signal-down/40 bg-signal-down/10">
            <summary className="flex cursor-pointer select-none items-center justify-between px-2 py-1 text-label text-signal-down">
              <span>Políticas</span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  dispatch(
                    addFwPolicy({
                      nodeId: node.id,
                      name: `Pol-${nodePolicies.length + 1}`,
                      action: 'accept',
                      srcZone: 'lan',
                      dstZone: 'wan',
                      service: 'ANY',
                      logTraffic: true,
                      natEnabled: false,
                    }),
                  );
                }}
                className="rounded-sm bg-signal-down/15 px-1.5 py-0.5 text-2xs text-signal-down hover:bg-signal-down/40"
              >
                + Política
              </button>
            </summary>
            <div className="space-y-1.5 px-2 pb-2 pt-1">
              {nodePolicies.length === 0 && (
                <p className="text-2xs text-chalk-faint">
                  {studioUi().noPolicies}
                </p>
              )}
              {nodePolicies.map((pol) => (
                <div
                  key={pol.id}
                  className="rounded-sm border border-line bg-ink-raised-2 p-1.5 text-2xs"
                >
                  <div className="mb-1 flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={pol.enabled}
                      onChange={(e) =>
                        dispatch(
                          updateFwPolicy({
                            id: pol.id,
                            changes: { enabled: e.target.checked },
                          }),
                        )
                      }
                      className="h-3 w-3 accent-[var(--signal-down)]"
                    />
                    <input
                      type="text"
                      value={pol.name}
                      onChange={(e) =>
                        dispatch(
                          updateFwPolicy({
                            id: pol.id,
                            changes: { name: e.target.value },
                          }),
                        )
                      }
                      className="flex-1 rounded-sm border border-line bg-ink-raised-2 px-1 py-0.5 text-2xs font-semibold text-chalk"
                    />
                    <select
                      value={pol.action}
                      onChange={(e) =>
                        dispatch(
                          updateFwPolicy({
                            id: pol.id,
                            changes: {
                              action: e.target.value as FwPolicyAction,
                            },
                          }),
                        )
                      }
                      className="rounded-sm border border-line bg-ink-raised-2 px-1 py-0.5 text-2xs text-chalk"
                    >
                      <option value="accept">ACCEPT</option>
                      <option value="deny">DENY</option>
                      <option value="ipsec">IPSEC</option>
                    </select>
                    <RemoveButton
                      onClick={() => dispatch(removeFwPolicy({ id: pol.id }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      {
                        key: 'srcZone',
                        label: 'Src Zone',
                        value: pol.srcZone ?? '',
                      },
                      {
                        key: 'dstZone',
                        label: 'Dst Zone',
                        value: pol.dstZone ?? '',
                      },
                      {
                        key: 'srcAddress',
                        label: 'Src Addr',
                        value: pol.srcAddress ?? '',
                      },
                      {
                        key: 'dstAddress',
                        label: 'Dst Addr',
                        value: pol.dstAddress ?? '',
                      },
                      {
                        key: 'service',
                        label: 'Serviço',
                        value: pol.service ?? '',
                      },
                      {
                        key: 'srcInterface',
                        label: 'Src Iface',
                        value: pol.srcInterface ?? '',
                      },
                    ].map(({ key, label, value }) => (
                      <div key={key}>
                        <label className="text-2xs text-chalk-faint">
                          {label}
                        </label>
                        <input
                          type="text"
                          value={value}
                          onChange={(e) =>
                            dispatch(
                              updateFwPolicy({
                                id: pol.id,
                                changes: { [key]: e.target.value },
                              }),
                            )
                          }
                          className="w-full rounded-sm border border-line bg-ink-raised-2 px-1 py-0.5 text-2xs text-chalk"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-1 flex gap-2">
                    <label className="flex items-center gap-1 text-2xs text-chalk-dim">
                      <input
                        type="checkbox"
                        checked={pol.logTraffic ?? false}
                        onChange={(e) =>
                          dispatch(
                            updateFwPolicy({
                              id: pol.id,
                              changes: { logTraffic: e.target.checked },
                            }),
                          )
                        }
                        className="accent-[var(--signal-down)] h-3 w-3"
                      />
                      Log
                    </label>
                    <label className="flex items-center gap-1 text-2xs text-chalk-dim">
                      <input
                        type="checkbox"
                        checked={pol.natEnabled ?? false}
                        onChange={(e) =>
                          dispatch(
                            updateFwPolicy({
                              id: pol.id,
                              changes: { natEnabled: e.target.checked },
                            }),
                          )
                        }
                        className="accent-[var(--signal-down)] h-3 w-3"
                      />
                      NAT
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* ── Fase 3 — Regras de NAT ────────────────────────────────── */}
        {isFw && (
          <details className="rounded-sm border border-signal-warn/40 bg-signal-warn/10">
            <summary className="flex cursor-pointer select-none items-center justify-between px-2 py-1 text-label text-signal-warn">
              <span>NAT</span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  dispatch(
                    addNatRule({
                      nodeId: node.id,
                      name: `NAT-${nodeNatRules.length + 1}`,
                      type: 'snat',
                      originalAddr: '',
                      translatedAddr: '',
                    }),
                  );
                }}
                className="rounded-sm bg-signal-warn/15 px-1.5 py-0.5 text-2xs text-signal-warn hover:bg-signal-warn/40"
              >
                + Regra
              </button>
            </summary>
            <div className="space-y-1.5 px-2 pb-2 pt-1">
              {nodeNatRules.length === 0 && (
                <p className="text-2xs text-chalk-faint">
                  {studioUi().noNatRules}
                </p>
              )}
              {nodeNatRules.map((rule) => (
                <div
                  key={rule.id}
                  className="rounded-sm border border-line bg-ink-raised-2 p-1.5 text-2xs"
                >
                  <div className="mb-1 flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={(e) =>
                        dispatch(
                          updateNatRule({
                            id: rule.id,
                            changes: { enabled: e.target.checked },
                          }),
                        )
                      }
                      className="h-3 w-3 accent-[var(--signal-warn)]"
                    />
                    <input
                      type="text"
                      value={rule.name}
                      onChange={(e) =>
                        dispatch(
                          updateNatRule({
                            id: rule.id,
                            changes: { name: e.target.value },
                          }),
                        )
                      }
                      className="flex-1 rounded-sm border border-line bg-ink-raised-2 px-1 py-0.5 text-2xs font-semibold text-chalk"
                    />
                    <select
                      value={rule.type}
                      onChange={(e) =>
                        dispatch(
                          updateNatRule({
                            id: rule.id,
                            changes: { type: e.target.value as NatType },
                          }),
                        )
                      }
                      className="rounded-sm border border-line bg-ink-raised-2 px-1 py-0.5 text-2xs text-chalk"
                    >
                      <option value="snat">SNAT</option>
                      <option value="dnat">DNAT</option>
                      <option value="pat">PAT</option>
                    </select>
                    <RemoveButton
                      onClick={() => dispatch(removeNatRule({ id: rule.id }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      {
                        key: 'originalAddr',
                        label: 'Original IP',
                        value: rule.originalAddr,
                      },
                      {
                        key: 'translatedAddr',
                        label: 'Traduzido IP',
                        value: rule.translatedAddr,
                      },
                      {
                        key: 'originalPort',
                        label: 'Porta orig.',
                        value: rule.originalPort ?? '',
                      },
                      {
                        key: 'translatedPort',
                        label: 'Porta trad.',
                        value: rule.translatedPort ?? '',
                      },
                    ].map(({ key, label, value }) => (
                      <div key={key}>
                        <label className="text-2xs text-chalk-faint">
                          {label}
                        </label>
                        <input
                          type="text"
                          value={value}
                          onChange={(e) =>
                            dispatch(
                              updateNatRule({
                                id: rule.id,
                                changes: { [key]: e.target.value },
                              }),
                            )
                          }
                          className="w-full rounded-sm border border-line bg-ink-raised-2 px-1 py-0.5 font-mono text-2xs text-chalk"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* ── P16 — QoS Profile (router / firewall / switch) ───────── */}
        {(node.category === 'router' ||
          node.category === 'firewall' ||
          node.category === 'switch') &&
          (() => {
            const profile = nodeQosProfiles.find((p) => p.nodeId === node.id);
            const queues = profile?.queues ?? [];
            const sumBw = queues.reduce(
              (acc, q) => acc + (q.minBandwidthPercent ?? 0),
              0,
            );
            const strictCount = queues.filter(
              (q) => q.priority === 'strict',
            ).length;
            const hasBestEffort = queues.some(
              (q) => q.priority === 'best-effort',
            );

            return (
              <details className="rounded-sm border border-route-default/40 bg-route-default/10">
                <summary className="flex cursor-pointer select-none items-center justify-between px-2 py-1 text-label text-route-default">
                  <span>QoS profile — filas</span>
                  <span className="text-chalk-faint">
                    {queues.length} fila{queues.length !== 1 ? 's' : ''}
                  </span>
                </summary>
                <div className="px-2 pb-2 pt-1">
                  {/* Warnings */}
                  {sumBw > 100 && (
                    <p className="mb-1 rounded-sm bg-signal-down/15 px-1.5 py-0.5 text-2xs text-signal-down">
                      <AlertTriangle
                        size={12}
                        className="mr-1 inline-block -translate-y-px"
                        aria-hidden="true"
                      />
                      Soma de % mínima ({sumBw}%) excede 100%.
                    </p>
                  )}
                  {strictCount > 1 && (
                    <p className="mb-1 rounded-sm bg-signal-warn/15 px-1.5 py-0.5 text-2xs text-signal-warn">
                      <AlertTriangle
                        size={12}
                        className="mr-1 inline-block -translate-y-px"
                        aria-hidden="true"
                      />
                      {studioUi().multipleStrictQueues}
                    </p>
                  )}
                  {queues.length > 0 && !hasBestEffort && (
                    <p className="mb-1 rounded-sm bg-ink-raised-2 px-1.5 py-0.5 text-2xs text-chalk-faint">
                      {studioUi().addBestEffortQueue}
                    </p>
                  )}

                  {/* Lista de filas */}
                  {queues.length === 0 && (
                    <p className="mb-1.5 text-2xs italic text-chalk-faint">
                      {studioUi().noQueues}
                    </p>
                  )}
                  <div className="mb-2 space-y-1">
                    {queues.map((q) => (
                      <div
                        key={q.id}
                        className="rounded-sm border border-line bg-ink-raised-2 px-1.5 py-1"
                      >
                        <div className="flex items-center gap-1">
                          <span className="flex-1 font-mono text-2xs text-chalk">
                            {q.name}
                          </span>
                          <span className="rounded-sm bg-route-default/15 px-1 text-2xs text-route-default">
                            {QOSCLASS_LABEL[q.trafficClass]}
                          </span>
                          <span className="text-2xs text-chalk-faint">
                            DSCP {DSCP_BY_QOSCLASS[q.trafficClass]}
                          </span>
                          <RemoveButton
                            onClick={() =>
                              dispatch(
                                removeQosQueue({
                                  nodeId: node.id,
                                  queueId: q.id,
                                }),
                              )
                            }
                          />
                        </div>
                        <div className="mt-1 grid grid-cols-2 gap-1">
                          <div>
                            <label className="text-2xs text-chalk-faint">
                              % mín
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={q.minBandwidthPercent ?? ''}
                              onChange={(e) =>
                                dispatch(
                                  updateQosQueue({
                                    nodeId: node.id,
                                    queueId: q.id,
                                    changes: {
                                      minBandwidthPercent:
                                        e.target.value !== ''
                                          ? Number(e.target.value)
                                          : undefined,
                                    },
                                  }),
                                )
                              }
                              placeholder="—"
                              className="w-full rounded-sm border border-line bg-ink px-1 py-0.5 font-mono text-2xs text-chalk placeholder-chalk-faint"
                            />
                          </div>
                          <div>
                            <label className="text-2xs text-chalk-faint">
                              Disciplina
                            </label>
                            <select
                              value={q.priority}
                              onChange={(e) =>
                                dispatch(
                                  updateQosQueue({
                                    nodeId: node.id,
                                    queueId: q.id,
                                    changes: {
                                      priority: e.target
                                        .value as QosQueue['priority'],
                                    },
                                  }),
                                )
                              }
                              className="w-full rounded-sm border border-line bg-ink px-1 py-0.5 text-2xs text-chalk"
                            >
                              <option value="strict">strict</option>
                              <option value="weighted">weighted</option>
                              <option value="best-effort">best-effort</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Formulário nova fila */}
                  <div className="border-t border-line pt-1.5">
                    <p className="mb-1 text-label text-chalk-faint">
                      + Nova fila
                    </p>
                    <div className="grid grid-cols-2 gap-1">
                      <div>
                        <label className="text-2xs text-chalk-faint">
                          Nome
                        </label>
                        <input
                          value={qosFormName}
                          onChange={(e) => setQosFormName(e.target.value)}
                          placeholder="ex: q0"
                          className="w-full rounded-sm border border-line bg-ink px-1 py-0.5 text-2xs text-chalk placeholder-chalk-faint"
                        />
                      </div>
                      <div>
                        <label className="text-2xs text-chalk-faint">
                          Classe
                        </label>
                        <select
                          value={qosFormClass}
                          onChange={(e) =>
                            setQosFormClass(e.target.value as QosClass)
                          }
                          className="w-full rounded-sm border border-line bg-ink px-1 py-0.5 text-2xs text-chalk"
                        >
                          {(Object.keys(QOSCLASS_LABEL) as QosClass[]).map(
                            (c) => (
                              <option key={c} value={c}>
                                {QOSCLASS_LABEL[c]}
                              </option>
                            ),
                          )}
                        </select>
                      </div>
                      <div>
                        <label className="text-2xs text-chalk-faint">
                          Disciplina
                        </label>
                        <select
                          value={qosFormPriority}
                          onChange={(e) =>
                            setQosFormPriority(
                              e.target.value as QosQueue['priority'],
                            )
                          }
                          className="w-full rounded-sm border border-line bg-ink px-1 py-0.5 text-2xs text-chalk"
                        >
                          <option value="strict">strict</option>
                          <option value="weighted">weighted</option>
                          <option value="best-effort">best-effort</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-2xs text-chalk-faint">
                          % mín
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={qosFormMinBw}
                          onChange={(e) =>
                            setQosFormMinBw(
                              e.target.value !== ''
                                ? Number(e.target.value)
                                : '',
                            )
                          }
                          placeholder="—"
                          className="w-full rounded-sm border border-line bg-ink px-1 py-0.5 font-mono text-2xs text-chalk placeholder-chalk-faint"
                        />
                      </div>
                    </div>
                    <div className="mt-1 flex justify-end">
                      <button
                        type="button"
                        disabled={!qosFormName.trim()}
                        onClick={() => {
                          if (!qosFormName.trim()) return;
                          dispatch(
                            addQosQueue({
                              nodeId: node.id,
                              queue: {
                                name: qosFormName.trim(),
                                trafficClass: qosFormClass,
                                priority: qosFormPriority,
                                minBandwidthPercent:
                                  qosFormMinBw !== ''
                                    ? qosFormMinBw
                                    : undefined,
                              },
                            }),
                          );
                          setQosFormName('');
                          setQosFormMinBw('');
                          setQosFormPriority('best-effort');
                          setQosFormClass('default');
                        }}
                        className="rounded-sm border border-route-default/50 bg-route-default/15 px-2 py-0.5 text-2xs text-route-default hover:bg-route-default/15 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        + Fila
                      </button>
                    </div>
                  </div>
                </div>
              </details>
            );
          })()}

        {/* ── Fase 3 — Sessões Ativas ───────────────────────────────── */}
        {isFw && (
          <details className="rounded-sm border border-line-strong bg-ink-raised-2">
            <summary className="flex cursor-pointer select-none items-center justify-between px-2 py-1 text-label text-chalk">
              <span>Sessões ativas ({nodeSessions.length})</span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  dispatch(clearActiveSessions({ nodeId: node.id }));
                }}
                className="rounded-sm bg-ink-raised-2 px-1.5 py-0.5 text-2xs text-accent hover:bg-accent/15"
              >
                Limpar
              </button>
            </summary>
            <div className="px-2 pb-2 pt-1">
              {/* Formulário de sessão simulada */}
              <div className="mb-2 space-y-1 rounded-sm border border-line bg-ink-raised-2 p-1.5">
                <p className="text-2xs font-semibold uppercase text-chalk-faint">
                  {studioUi().simulateSession}
                </p>
                <div className="grid grid-cols-2 gap-1">
                  <input
                    type="text"
                    placeholder="Src IP"
                    value={sessForm.srcIp}
                    onChange={(e) =>
                      setSessForm((f) => ({ ...f, srcIp: e.target.value }))
                    }
                    className="rounded-sm border border-line bg-ink-raised-2 px-1 py-0.5 font-mono text-2xs text-chalk placeholder-chalk-faint"
                  />
                  <input
                    type="text"
                    placeholder="Dst IP"
                    value={sessForm.dstIp}
                    onChange={(e) =>
                      setSessForm((f) => ({ ...f, dstIp: e.target.value }))
                    }
                    className="rounded-sm border border-line bg-ink-raised-2 px-1 py-0.5 font-mono text-2xs text-chalk placeholder-chalk-faint"
                  />
                  <input
                    type="number"
                    placeholder="Src Port"
                    value={sessForm.srcPort}
                    onChange={(e) =>
                      setSessForm((f) => ({ ...f, srcPort: e.target.value }))
                    }
                    className="rounded-sm border border-line bg-ink-raised-2 px-1 py-0.5 text-2xs text-chalk placeholder-chalk-faint"
                  />
                  <input
                    type="number"
                    placeholder="Dst Port"
                    value={sessForm.dstPort}
                    onChange={(e) =>
                      setSessForm((f) => ({ ...f, dstPort: e.target.value }))
                    }
                    className="rounded-sm border border-line bg-ink-raised-2 px-1 py-0.5 text-2xs text-chalk placeholder-chalk-faint"
                  />
                </div>
                <div className="flex gap-1">
                  <select
                    value={sessForm.protocol}
                    onChange={(e) =>
                      setSessForm((f) => ({
                        ...f,
                        protocol: e.target.value as SessionProto,
                      }))
                    }
                    className="flex-1 rounded-sm border border-line bg-ink-raised-2 px-1 py-0.5 text-2xs text-chalk"
                  >
                    <option value="tcp">TCP</option>
                    <option value="udp">UDP</option>
                    <option value="icmp">ICMP</option>
                  </select>
                  <select
                    value={sessForm.state}
                    onChange={(e) =>
                      setSessForm((f) => ({
                        ...f,
                        state: e.target.value as SessionState,
                      }))
                    }
                    className="flex-1 rounded-sm border border-line bg-ink-raised-2 px-1 py-0.5 text-2xs text-chalk"
                  >
                    <option value="ESTABLISHED">ESTABLISHED</option>
                    <option value="SYN_SENT">SYN_SENT</option>
                    <option value="TIME_WAIT">TIME_WAIT</option>
                    <option value="UDP">UDP</option>
                    <option value="ICMP">ICMP</option>
                  </select>
                  <input
                    type="number"
                    placeholder="TTL"
                    value={sessForm.ttlSec}
                    onChange={(e) =>
                      setSessForm((f) => ({ ...f, ttlSec: e.target.value }))
                    }
                    className="w-14 rounded-sm border border-line bg-ink-raised-2 px-1 py-0.5 text-2xs text-chalk"
                  />
                </div>
                <button
                  type="button"
                  disabled={!sessForm.srcIp || !sessForm.dstIp}
                  onClick={() => {
                    dispatch(
                      addActiveSession({
                        nodeId: node.id,
                        srcIp: sessForm.srcIp,
                        srcPort: sessForm.srcPort
                          ? Number(sessForm.srcPort)
                          : undefined,
                        dstIp: sessForm.dstIp,
                        dstPort: sessForm.dstPort
                          ? Number(sessForm.dstPort)
                          : undefined,
                        protocol: sessForm.protocol,
                        state: sessForm.state,
                        ttlSec: sessForm.ttlSec ? Number(sessForm.ttlSec) : 300,
                      }),
                    );
                    setSessForm((f) => ({
                      ...f,
                      srcIp: '',
                      srcPort: '',
                      dstIp: '',
                      dstPort: '',
                    }));
                  }}
                  className="w-full rounded-sm bg-accent/15 py-0.5 text-2xs font-semibold text-chalk transition hover:bg-accent/15 disabled:opacity-40"
                >
                  + Adicionar Sessão
                </button>
              </div>

              {/* Tabela de sessões */}
              {nodeSessions.length === 0 && (
                <p className="text-2xs text-chalk-faint">
                  {studioUi().noActiveSessions}
                </p>
              )}
              <div className="space-y-0.5 max-h-48 overflow-y-auto">
                {nodeSessions.map((sess) => (
                  <div
                    key={sess.id}
                    className="flex items-center gap-1 rounded-sm bg-ink-raised-2 px-1.5 py-0.5 text-2xs"
                  >
                    <span
                      className={`w-20 shrink-0 font-semibold ${SESSION_STATE_COLOR[sess.state]}`}
                    >
                      {sess.state}
                    </span>
                    <span className="shrink-0 rounded-sm bg-ink-raised-2 px-1 text-chalk-dim">
                      {sess.protocol.toUpperCase()}
                    </span>
                    <span className="flex-1 font-mono text-chalk-dim truncate">
                      {sess.srcIp}
                      {sess.srcPort ? `:${sess.srcPort}` : ''} → {sess.dstIp}
                      {sess.dstPort ? `:${sess.dstPort}` : ''}
                    </span>
                    {sess.ttlSec && (
                      <span className="shrink-0 text-chalk-faint">
                        {sess.ttlSec}s
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
