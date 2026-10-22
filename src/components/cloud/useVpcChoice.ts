import { useState } from 'react';
import type { CloudResource } from '../../features/cloud/types';

/** VPC escolhida numa aba que exige uma (cai na primeira se a escolhida sumir). */
export function useVpcChoice(vpcs: CloudResource[]) {
  const [chosen, setChosen] = useState('');
  const vpcId = vpcs.some((v) => v.id === chosen)
    ? chosen
    : (vpcs[0]?.id ?? '');
  return [vpcId, setChosen] as const;
}
