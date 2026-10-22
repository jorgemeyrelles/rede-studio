import { AlertTriangle, Plus, Settings2, Trash2 } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  addCloudResource,
  selectCloudResource,
  updateCloudResourceConfig,
} from '../../features/cloud/cloudSlice';
import {
  NACL_TYPE,
  naclIssue,
  naclRuleIssue,
  nextNaclNumber,
  PROTOCOLS,
  readNaclRules,
  ruleIssueText,
  usesPorts,
  type NaclRule,
  type RuleDirection,
} from '../../features/cloud/engines/security';
import { isSubnet, subnetsOfVpc, VPC_TYPE } from '../../features/cloud/network';
import type { CloudResource } from '../../features/cloud/types';
import { makeServiceId } from '../../services/_core/id';
import type { AppLanguage } from '../../types/i18n';
import { getCloudCopy } from './cloudCopy';
import { useVpcChoice } from './useVpcChoice';
import VpcFilter from './VpcFilter';

const DIRECTIONS: RuleDirection[] = ['ingress', 'egress'];

/**
 * Aba "NACLs": as NACLs personalizadas da VPC, com regras numeradas
 * (avaliadas da menor para a maior; a `*` final nega o resto e é fixa) e as
 * subnets associadas — a associação é feita no inspetor da subnet.
 */
export default function CloudNaclTable({
  language,
}: {
  language: AppLanguage;
}) {
  const dispatch = useAppDispatch();
  const copy = getCloudCopy(language);
  const resources = useAppSelector((state) => state.cloud.resources);
  const vpcs = resources.filter((r) => r.type === VPC_TYPE);
  const [vpcId, setVpcId] = useVpcChoice(vpcs);
  const nacls = resources.filter(
    (r) => r.type === NACL_TYPE && r.parentId === vpcId,
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
              addCloudResource({ type: NACL_TYPE, parentId: vpcId, language }),
            )
          }
          className="btn btn-secondary btn-sm"
        >
          <Plus size={13} aria-hidden="true" />
          {copy.security.newNacl}
        </button>
      </div>
      {nacls.length === 0 && (
        <p className="px-3 text-xs text-chalk-faint">
          {copy.security.naclEmpty}
        </p>
      )}
      {nacls.map((nacl) => (
        <NaclRules
          key={nacl.id}
          nacl={nacl}
          subnets={subnetsOfVpc(resources, vpcId).filter(
            (s) => isSubnet(s) && s.config.naclId === nacl.id,
          )}
          language={language}
        />
      ))}
    </div>
  );
}

function NaclRules({
  nacl,
  subnets,
  language,
}: {
  nacl: CloudResource;
  subnets: CloudResource[];
  language: AppLanguage;
}) {
  const dispatch = useAppDispatch();
  const sec = getCloudCopy(language).security;
  const rules = readNaclRules(nacl);
  const issue = naclIssue(nacl);
  const ordered = DIRECTIONS.flatMap((direction) =>
    rules
      .filter((r) => r.direction === direction)
      .sort((a, b) => a.number - b.number),
  );

  const setRules = (next: NaclRule[]) =>
    dispatch(
      updateCloudResourceConfig({ id: nacl.id, patch: { rules: next } }),
    );
  const updateRule = (id: string, patch: Partial<NaclRule>) =>
    setRules(
      rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)),
    );

  return (
    <section aria-label={nacl.name} className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2 px-3">
        <h3 className="font-mono text-xs font-semibold text-chalk">
          {nacl.name}
        </h3>
        <span className="text-2xs text-chalk-dim">
          {sec.naclSubnets}:{' '}
          {subnets.length ? (
            subnets.map((s, i) => (
              <span key={s.id}>
                {i > 0 && ', '}
                <button
                  type="button"
                  onClick={() => dispatch(selectCloudResource(s.id))}
                  className="text-chalk underline-offset-2 hover:underline"
                >
                  {s.name}
                </button>
              </span>
            ))
          ) : (
            <span className="text-chalk-faint">{sec.naclNoSubnets}</span>
          )}
        </span>
        {issue && (
          <span className="inline-flex items-center gap-1 text-2xs text-signal-warn">
            <AlertTriangle size={12} aria-hidden="true" />
            {issue[language]}
          </span>
        )}
        <button
          type="button"
          onClick={() => dispatch(selectCloudResource(nacl.id))}
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
                {sec.columns.number}
              </th>
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
                CIDR
              </th>
              <th scope="col" className="text-left">
                {sec.columns.action}
              </th>
              <th scope="col" className="w-8">
                <span className="sr-only">{sec.removeRule}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((rule) => {
              const ruleIssue = naclRuleIssue(rule, rules);
              const label = `${nacl.name} · ${rule.number}`;
              return (
                <tr key={rule.id}>
                  <td>
                    <input
                      type="number"
                      aria-label={`${label} · ${sec.columns.number}`}
                      value={rule.number}
                      min={1}
                      max={32766}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        if (e.target.value !== '' && !Number.isNaN(value))
                          updateRule(rule.id, { number: value });
                      }}
                      aria-invalid={
                        ruleIssue === 'number' ||
                        ruleIssue === 'duplicateNumber' ||
                        undefined
                      }
                      className={`field-sm w-20 font-mono tabular-nums ${
                        ruleIssue === 'number' ||
                        ruleIssue === 'duplicateNumber'
                          ? 'border-signal-down'
                          : ''
                      }`}
                    />
                    {(ruleIssue === 'number' ||
                      ruleIssue === 'duplicateNumber') && (
                      <p className="mt-0.5 text-2xs text-signal-down">
                        {ruleIssueText(ruleIssue)[language]}
                      </p>
                    )}
                  </td>
                  <td>
                    <select
                      aria-label={`${label} · ${sec.columns.direction}`}
                      value={rule.direction}
                      onChange={(e) =>
                        updateRule(rule.id, {
                          direction: e.target.value as RuleDirection,
                        })
                      }
                      className="field-sm w-auto"
                    >
                      {DIRECTIONS.map((d) => (
                        <option key={d} value={d}>
                          {sec.directions[d]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      aria-label={`${label} · ${sec.columns.protocol}`}
                      value={rule.protocol}
                      onChange={(e) => {
                        const protocol = e.target.value as NaclRule['protocol'];
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
                    <input
                      aria-label={`${label} · CIDR`}
                      value={rule.cidr}
                      onChange={(e) =>
                        updateRule(rule.id, { cidr: e.target.value })
                      }
                      aria-invalid={ruleIssue === 'peer' || undefined}
                      className={`field-sm w-36 font-mono ${ruleIssue === 'peer' ? 'border-signal-down' : ''}`}
                    />
                  </td>
                  <td>
                    <select
                      aria-label={`${label} · ${sec.columns.action}`}
                      value={rule.action}
                      onChange={(e) =>
                        updateRule(rule.id, {
                          action: e.target.value as NaclRule['action'],
                        })
                      }
                      className={`field-sm w-auto ${rule.action === 'deny' ? 'text-signal-down' : 'text-signal-up'}`}
                    >
                      <option value="allow">{sec.actions.allow}</option>
                      <option value="deny">{sec.actions.deny}</option>
                    </select>
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
            {DIRECTIONS.map((direction) => (
              <tr key={`deny-${direction}`} className="text-chalk-faint">
                <td className="font-mono">*</td>
                <td>{sec.directions[direction]}</td>
                <td>{sec.protocols.all}</td>
                <td className="font-mono">{sec.allPorts}</td>
                <td className="font-mono">0.0.0.0/0</td>
                <td>
                  {sec.actions.deny} · {sec.defaultDeny}
                </td>
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-3">
        <button
          type="button"
          onClick={() =>
            setRules([
              ...rules,
              {
                id: makeServiceId('rule'),
                number: nextNaclNumber(rules, 'ingress'),
                direction: 'ingress',
                protocol: 'tcp',
                ports: '443',
                cidr: '0.0.0.0/0',
                action: 'allow',
              },
            ])
          }
          className="btn btn-ghost btn-sm"
        >
          <Plus size={13} aria-hidden="true" />
          {sec.addRule}
        </button>
      </div>
    </section>
  );
}
