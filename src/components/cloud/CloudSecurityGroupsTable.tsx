import { AlertTriangle, Plus, Settings2, Trash2 } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  addCloudResource,
  selectCloudConnection,
  selectCloudResource,
  updateCloudConnection,
  updateCloudResourceConfig,
} from '../../features/cloud/cloudSlice';
import { derivedSgRules } from '../../features/cloud/engines/connections';
import {
  isRiskyRule,
  PROTOCOLS,
  readSgRules,
  ruleIssueText,
  PREFIX_LISTS,
  SG_PEER_PREFIX,
  SG_PRESETS,
  SG_TYPE,
  sgIssue,
  sgRuleIssue,
  usesPorts,
  type SgRule,
} from '../../features/cloud/engines/security';
import { cidrOf, VPC_TYPE } from '../../features/cloud/network';
import type { CloudResource } from '../../features/cloud/types';
import { makeServiceId } from '../../services/_core/id';
import type { AppLanguage } from '../../types/i18n';
import { getCloudCopy } from './cloudCopy';
import VpcFilter from './VpcFilter';
import { useVpcChoice } from './useVpcChoice';

/**
 * Aba "Security groups": os SGs da VPC escolhida, cada um com a tabela de
 * regras editável na linha (direção, protocolo, portas, origem CIDR ou
 * outro SG, descrição). Presets comuns; regra de entrada aberta para a
 * internet em SSH/RDP fica marcada. O SG em si (nome, descrição, tags) é
 * editado no inspetor.
 */
export default function CloudSecurityGroupsTable({
  language,
}: {
  language: AppLanguage;
}) {
  const dispatch = useAppDispatch();
  const copy = getCloudCopy(language);
  const resources = useAppSelector((state) => state.cloud.resources);
  const vpcs = resources.filter((r) => r.type === VPC_TYPE);
  const [vpcId, setVpcId] = useVpcChoice(vpcs);
  const groups = resources.filter(
    (r) => r.type === SG_TYPE && r.parentId === vpcId,
  );

  if (vpcs.length === 0)
    return (
      <p className="px-4 py-6 text-xs text-chalk-faint">
        {copy.security.needVpc}
      </p>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-2">
        <VpcFilter
          vpcs={vpcs}
          value={vpcId}
          onChange={setVpcId}
          language={language}
        />
        <button
          type="button"
          onClick={() =>
            dispatch(
              addCloudResource({ type: SG_TYPE, parentId: vpcId, language }),
            )
          }
          className="btn btn-secondary btn-sm"
        >
          <Plus size={13} aria-hidden="true" />
          {copy.security.newSg}
        </button>
      </div>
      {groups.length === 0 && (
        <p className="px-3 text-xs text-chalk-faint">{copy.security.sgEmpty}</p>
      )}
      {groups.map((sg) => (
        <SecurityGroupRules
          key={sg.id}
          sg={sg}
          vpc={resources.find((r) => r.id === vpcId)!}
          groups={groups}
          resources={resources}
          language={language}
        />
      ))}
    </div>
  );
}

function SecurityGroupRules({
  sg,
  vpc,
  groups,
  resources,
  language,
}: {
  sg: CloudResource;
  vpc: CloudResource;
  groups: CloudResource[];
  resources: CloudResource[];
  language: AppLanguage;
}) {
  const dispatch = useAppDispatch();
  const copy = getCloudCopy(language);
  const sec = copy.security;
  const rules = readSgRules(sg);
  const connections = useAppSelector((state) => state.cloud.connections);
  // Regras que as conexões geram neste SG (D4 da F4): a conexão é a fonte;
  // editar protocolo/porta aqui edita a conexão.
  const derived = derivedSgRules(resources, connections).filter(
    (d) => d.sgId === sg.id,
  );
  const issue = sgIssue(sg, resources);
  const description =
    typeof sg.config.description === 'string' ? sg.config.description : '';

  const setRules = (next: SgRule[]) =>
    dispatch(updateCloudResourceConfig({ id: sg.id, patch: { rules: next } }));
  const updateRule = (id: string, patch: Partial<SgRule>) =>
    setRules(
      rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)),
    );
  const addRule = (rule: Omit<SgRule, 'id'>) =>
    setRules([...rules, { id: makeServiceId('rule'), ...rule }]);

  return (
    <section aria-label={sg.name} className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2 px-3">
        <h3 className="font-mono text-xs font-semibold text-chalk">
          {sg.name}
        </h3>
        {description && (
          <span className="text-2xs text-chalk-dim">{description}</span>
        )}
        <span className="chip">
          {sec.rulesCount(rules.length + derived.length)}
        </span>
        {issue && (
          <span className="inline-flex items-center gap-1 text-2xs text-signal-warn">
            <AlertTriangle size={12} aria-hidden="true" />
            {issue[language]}
          </span>
        )}
        <button
          type="button"
          onClick={() => dispatch(selectCloudResource(sg.id))}
          className="btn btn-ghost btn-sm ml-auto"
        >
          <Settings2 size={13} aria-hidden="true" />
          {sec.configure}
        </button>
      </div>
      <div className="relative overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col" className="text-left">
                {sec.columns.direction}
              </th>
              <th scope="col" className="text-left">
                {sec.columns.protocol}
              </th>
              <th scope="col" className="text-left">
                {sec.columns.ports}
              </th>
              <th scope="col" className="text-left">
                {sec.columns.peer}
              </th>
              <th scope="col" className="text-left">
                {sec.columns.description}
              </th>
              <th scope="col" className="w-8">
                <span className="sr-only">{sec.removeRule}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => {
              const ruleIssue = sgRuleIssue(rule, resources);
              const peerIsSg = rule.peer.startsWith(SG_PEER_PREFIX);
              const risky = isRiskyRule(rule);
              const label = `${sg.name} · ${sec.directions[rule.direction]}`;
              return (
                <tr key={rule.id}>
                  <td>
                    <select
                      aria-label={`${label} · ${sec.columns.direction}`}
                      value={rule.direction}
                      onChange={(e) =>
                        updateRule(rule.id, {
                          direction: e.target.value as SgRule['direction'],
                        })
                      }
                      className="field-sm w-auto"
                    >
                      <option value="ingress">{sec.directions.ingress}</option>
                      <option value="egress">{sec.directions.egress}</option>
                    </select>
                  </td>
                  <td>
                    <select
                      aria-label={`${label} · ${sec.columns.protocol}`}
                      value={rule.protocol}
                      onChange={(e) => {
                        const protocol = e.target.value as SgRule['protocol'];
                        updateRule(rule.id, {
                          protocol,
                          ports: usesPorts(protocol) ? rule.ports || '443' : '',
                        });
                      }}
                      className="field-sm w-auto"
                    >
                      {PROTOCOLS.map((p) => (
                        <option key={p} value={p}>
                          {sec.protocols[p]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {usesPorts(rule.protocol) ? (
                      <input
                        aria-label={`${label} · ${sec.columns.ports}`}
                        value={rule.ports}
                        onChange={(e) =>
                          updateRule(rule.id, { ports: e.target.value })
                        }
                        aria-invalid={ruleIssue === 'ports' || undefined}
                        className={`field-sm w-28 font-mono tabular-nums ${ruleIssue === 'ports' ? 'border-signal-down' : ''}`}
                      />
                    ) : (
                      <span className="font-mono text-chalk-faint">
                        {sec.allPorts}
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <select
                        aria-label={`${label} · ${sec.columns.peer}`}
                        value={peerIsSg ? rule.peer : 'cidr'}
                        onChange={(e) =>
                          updateRule(rule.id, {
                            peer:
                              e.target.value === 'cidr'
                                ? cidrOf(vpc) || '0.0.0.0/0'
                                : e.target.value,
                          })
                        }
                        className="field-sm w-auto"
                      >
                        <option value="cidr">{sec.peerCidr}</option>
                        {groups
                          .filter(
                            (g) =>
                              g.id !== sg.id ||
                              rule.peer === `${SG_PEER_PREFIX}${g.id}`,
                          )
                          .map((g) => (
                            <option
                              key={g.id}
                              value={`${SG_PEER_PREFIX}${g.id}`}
                            >
                              {g.name}
                            </option>
                          ))}
                        {peerIsSg &&
                          !groups.some(
                            (g) => rule.peer === `${SG_PEER_PREFIX}${g.id}`,
                          ) && <option value={rule.peer}>—</option>}
                      </select>
                      {!peerIsSg && (
                        <input
                          aria-label={`${label} · CIDR`}
                          value={rule.peer}
                          onChange={(e) =>
                            updateRule(rule.id, { peer: e.target.value })
                          }
                          aria-invalid={ruleIssue === 'peer' || undefined}
                          className={`field-sm w-36 font-mono ${ruleIssue === 'peer' ? 'border-signal-down' : ''}`}
                        />
                      )}
                      {risky && (
                        <span className="inline-flex items-center gap-1 whitespace-nowrap text-2xs text-signal-warn">
                          <AlertTriangle size={12} aria-hidden="true" />
                          {sec.risky}
                        </span>
                      )}
                    </div>
                    {ruleIssue &&
                      ruleIssue !== 'ports' &&
                      ruleIssue !== 'peer' && (
                        <p className="mt-0.5 text-2xs text-signal-down">
                          {ruleIssueText(ruleIssue)[language]}
                        </p>
                      )}
                  </td>
                  <td>
                    <input
                      aria-label={`${label} · ${sec.columns.description}`}
                      value={rule.description}
                      onChange={(e) =>
                        updateRule(rule.id, { description: e.target.value })
                      }
                      className="field-sm w-40"
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() =>
                        setRules(rules.filter((r) => r.id !== rule.id))
                      }
                      aria-label={`${sec.removeRule}: ${label}`}
                      title={sec.removeRule}
                      className="rounded-[2px] p-1 text-chalk-faint hover:bg-signal-down/15 hover:text-signal-down"
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {derived.map(({ connectionId, rule }) => {
              const peerName = rule.peer.startsWith(SG_PEER_PREFIX)
                ? (resources.find(
                    (r) => r.id === rule.peer.slice(SG_PEER_PREFIX.length),
                  )?.name ?? rule.peer)
                : (PREFIX_LISTS[rule.peer]?.label ?? rule.peer);
              const label = `${sg.name} · ${rule.description}`;
              return (
                <tr key={rule.id} className="bg-ink-raised-2/30">
                  <td className="text-chalk-dim">{sec.directions.ingress}</td>
                  <td>
                    <select
                      aria-label={`${label} · ${sec.columns.protocol}`}
                      value={rule.protocol}
                      onChange={(e) =>
                        dispatch(
                          updateCloudConnection({
                            id: connectionId,
                            patch: { protocol: e.target.value },
                          }),
                        )
                      }
                      className="field-sm w-auto"
                    >
                      {PROTOCOLS.filter(usesPorts).map((p) => (
                        <option key={p} value={p}>
                          {sec.protocols[p]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      aria-label={`${label} · ${sec.columns.ports}`}
                      value={rule.ports}
                      onChange={(e) =>
                        dispatch(
                          updateCloudConnection({
                            id: connectionId,
                            patch: { ports: e.target.value },
                          }),
                        )
                      }
                      className="field-sm w-28 font-mono tabular-nums"
                    />
                  </td>
                  <td className="font-mono text-chalk">{peerName}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() =>
                        dispatch(selectCloudConnection(connectionId))
                      }
                      className="flex items-center gap-1.5 text-left underline-offset-2 hover:underline"
                    >
                      <span className="chip">{copy.fromConnection}</span>
                      <span className="text-chalk">{rule.description}</span>
                    </button>
                  </td>
                  <td />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-3">
        <button
          type="button"
          onClick={() =>
            addRule({
              direction: 'ingress',
              protocol: 'tcp',
              ports: '443',
              peer: cidrOf(vpc) || '0.0.0.0/0',
              description: '',
            })
          }
          className="btn btn-ghost btn-sm"
        >
          <Plus size={13} aria-hidden="true" />
          {sec.addRule}
        </button>
        <select
          aria-label={`${sg.name} · ${sec.preset}`}
          value=""
          onChange={(e) => {
            const preset = SG_PRESETS.find((p) => p.key === e.target.value);
            if (!preset) return;
            // Web aberto para a internet; administração e banco só de dentro da VPC.
            const fromInternet =
              preset.key === 'http' || preset.key === 'https';
            addRule({
              direction: 'ingress',
              protocol: preset.protocol,
              ports: preset.ports,
              peer: fromInternet ? '0.0.0.0/0' : cidrOf(vpc) || '0.0.0.0/0',
              description: preset.label,
            });
          }}
          className="field-sm w-auto"
        >
          <option value="">{sec.preset}</option>
          {SG_PRESETS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
