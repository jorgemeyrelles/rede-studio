import { useState, type FormEvent } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { addPlannedSubnets } from '../../features/cloud/cloudSlice';
import {
  AWS_MAX_PREFIX,
  planSubnets,
  SUBNET_TIERS,
  subnetCapacity,
  type SubnetTier,
} from '../../features/cloud/engines/ip';
import {
  azsOf,
  cidrOf,
  subnetsOfVpc,
  subnetTier,
  vpcCidrIssue,
  zoneName,
} from '../../features/cloud/network';
import { findResource } from '../../features/cloud/tree';
import type { AppLanguage } from '../../types/i18n';
import Modal from '../Modal';
import { getCloudCopy } from './cloudCopy';

/** Tamanhos oferecidos no plano: de /20 (4 091 IPs) a /28 (11 IPs). */
const PREFIXES = [20, 21, 22, 23, 24, 25, 26, 27, AWS_MAX_PREFIX];

type SubnetPlannerModalProps = {
  vpcId: string;
  language: AppLanguage;
  onClose: () => void;
};

/**
 * "Planejar subnets" da VPC: camadas × AZs × tamanho, com prévia em tabela
 * antes de criar. Decisão D3 da F2: pública + privada marcadas, isolada
 * opcional, /24. Nunca apaga nem altera subnet existente — o plano só cria
 * o que falta, pulando os blocos ocupados (ver `planSubnets`).
 */
export default function SubnetPlannerModal({
  vpcId,
  language,
  onClose,
}: SubnetPlannerModalProps) {
  const dispatch = useAppDispatch();
  const copy = getCloudCopy(language);
  const resources = useAppSelector((state) => state.cloud.resources);
  const vpc = findResource(resources, vpcId);
  const azs = azsOf(resources, vpcId);

  const [tiers, setTiers] = useState<SubnetTier[]>(['public', 'private']);
  const [prefix, setPrefix] = useState(24);
  const [azIds, setAzIds] = useState<string[]>(() => azs.map((az) => az.id));

  if (!vpc) return null;

  const cidrProblem = vpcCidrIssue(resources, vpc) !== null;
  const chosenAzs = azs.filter((az) => azIds.includes(az.id));
  const plan = cidrProblem
    ? []
    : planSubnets({
        vpcCidr: cidrOf(vpc),
        azs: chosenAzs.map((az) => ({
          id: az.id,
          label: zoneName(resources, az),
        })),
        tiers,
        prefix,
        existing: subnetsOfVpc(resources, vpcId).map((subnet) => ({
          azId: subnet.parentId ?? '',
          tier: subnetTier(subnet),
          cidr: cidrOf(subnet),
        })),
      });
  const toCreate = plan.filter((item) => item.status === 'create' && item.cidr);
  const azById = new Map(azs.map((az) => [az.id, az]));

  const toggle = <T,>(list: T[], value: T) =>
    list.includes(value)
      ? list.filter((item) => item !== value)
      : [...list, value];

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (toCreate.length === 0) return;
    dispatch(
      addPlannedSubnets({
        language,
        items: toCreate.map((item) => {
          const az = azById.get(item.azId);
          const letter =
            typeof az?.config.zone === 'string' ? az.config.zone : '';
          return {
            azId: item.azId,
            tier: item.tier,
            cidr: item.cidr!,
            name: `${copy.tiers[item.tier]} ${letter}`.trim(),
          };
        }),
      }),
    );
    onClose();
  }

  const blocker = cidrProblem
    ? copy.planNeedsCidr
    : azs.length === 0
      ? copy.planNeedsAz
      : null;

  return (
    <Modal
      onClose={onClose}
      title={`${copy.planSubnets} · ${vpc.name}`}
      closeLabel={copy.cancel}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <p className="-mt-2 text-xs text-chalk-dim">
          {copy.planHint}{' '}
          <span className="font-mono text-chalk">{cidrOf(vpc)}</span>
        </p>

        {blocker ? (
          <p
            role="alert"
            className="rounded-sm border border-signal-warn/40 bg-signal-warn/10 px-3 py-2 text-xs text-chalk"
          >
            {blocker}
          </p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <fieldset>
                <legend className="mb-1.5 text-xs font-medium text-chalk-dim">
                  {copy.planTiersLabel}
                </legend>
                <div className="space-y-1.5">
                  {SUBNET_TIERS.map((tier) => (
                    <label
                      key={tier}
                      className="flex cursor-pointer items-center gap-2 text-xs text-chalk"
                    >
                      <input
                        type="checkbox"
                        checked={tiers.includes(tier)}
                        onChange={() =>
                          setTiers((current) => toggle(current, tier))
                        }
                        className="h-3.5 w-3.5 accent-accent"
                      />
                      {copy.tiers[tier]}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-1.5 text-xs font-medium text-chalk-dim">
                  {copy.planAzsLabel}
                </legend>
                <div className="space-y-1.5">
                  {azs.map((az) => (
                    <label
                      key={az.id}
                      className="flex cursor-pointer items-center gap-2 font-mono text-xs text-chalk"
                    >
                      <input
                        type="checkbox"
                        checked={azIds.includes(az.id)}
                        onChange={() =>
                          setAzIds((current) => toggle(current, az.id))
                        }
                        className="h-3.5 w-3.5 accent-accent"
                      />
                      {zoneName(resources, az)}
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="flex flex-col gap-1.5 text-xs font-medium text-chalk-dim">
                {copy.planPrefixLabel}
                <select
                  value={prefix}
                  onChange={(event) => setPrefix(Number(event.target.value))}
                  className="field-sm font-mono"
                >
                  {PREFIXES.map((value) => (
                    <option key={value} value={value}>
                      /{value} · {subnetCapacity(`10.0.0.0/${value}`)?.usable}{' '}
                      IPs
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <section aria-label={copy.planPreview}>
              <h3 className="text-label mb-1.5 text-chalk-faint">
                {copy.planPreview}
              </h3>
              {plan.length === 0 ? (
                <p className="text-xs text-chalk-faint">{copy.planNothing}</p>
              ) : (
                <div className="max-h-64 overflow-auto rounded-sm border border-line">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col" className="text-left">
                          {copy.ipamColumns.az}
                        </th>
                        <th scope="col" className="text-left">
                          {copy.ipamColumns.tier}
                        </th>
                        <th scope="col" className="text-left">
                          {copy.ipamColumns.cidr}
                        </th>
                        <th scope="col" className="text-right">
                          {copy.ipamColumns.usable}
                        </th>
                        <th scope="col" className="text-left">
                          {copy.planStatusColumn}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {plan.map((item) => {
                        const az = azById.get(item.azId);
                        return (
                          <tr
                            key={`${item.azId}-${item.tier}`}
                            className={
                              item.status === 'exists' ? 'text-chalk-faint' : ''
                            }
                          >
                            <td className="font-mono">
                              {az ? zoneName(resources, az) : '—'}
                            </td>
                            <td>{copy.tiers[item.tier]}</td>
                            <td className="font-mono tabular-nums text-chalk">
                              {item.cidr ?? '—'}
                            </td>
                            <td className="text-right font-mono tabular-nums">
                              {item.cidr
                                ? subnetCapacity(item.cidr)?.usable
                                : '—'}
                            </td>
                            <td
                              className={
                                item.status === 'create'
                                  ? 'text-signal-up'
                                  : item.status === 'noSpace'
                                    ? 'text-signal-down'
                                    : ''
                              }
                            >
                              {copy.planStatus[item.status]}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary btn-md"
          >
            {copy.cancel}
          </button>
          <button
            type="submit"
            disabled={toCreate.length === 0}
            className="btn btn-primary btn-md"
          >
            {copy.planCreate(toCreate.length)}
          </button>
        </div>
      </form>
    </Modal>
  );
}
