import { useId } from 'react';
import { cidrOf } from '../../features/cloud/network';
import type { CloudResource } from '../../features/cloud/types';
import type { AppLanguage } from '../../types/i18n';
import { getCloudCopy } from './cloudCopy';

/** Seletor de VPC das abas do Studio Cloud; `allowAll` acrescenta "Todas as VPCs". */
export default function VpcFilter({
  vpcs,
  value,
  onChange,
  language,
  allowAll = false,
}: {
  vpcs: CloudResource[];
  value: string;
  onChange: (vpcId: string) => void;
  language: AppLanguage;
  allowAll?: boolean;
}) {
  const copy = getCloudCopy(language);
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="flex items-center gap-2 text-xs text-chalk-dim"
    >
      {copy.ipamVpcFilter}
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="field-sm w-auto"
      >
        {allowAll && <option value="">{copy.ipamAllVpcs}</option>}
        {vpcs.map((vpc) => (
          <option key={vpc.id} value={vpc.id}>
            {vpc.name} · {cidrOf(vpc)}
          </option>
        ))}
      </select>
    </label>
  );
}
