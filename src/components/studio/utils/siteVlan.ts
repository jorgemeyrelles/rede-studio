import type { NodeItem, SiteVlan } from '../../../features/network/types';
import { CAPACITY_OPTIONS } from '../constants';
import type { SiteVlanDraft } from '../types';

export function getNextVlanId(siteId: string, siteVlans: SiteVlan[]) {
  const used = new Set(
    siteVlans
      .filter((item) => item.siteId === siteId)
      .map((item) => item.vlanId),
  );
  let cursor = 10;
  while (used.has(cursor) && cursor < 4094) cursor += 10;
  return Math.min(4094, cursor);
}

export function getSiteRadicalOptions(
  siteId: string,
  siteOctet: number,
  nodes: NodeItem[],
) {
  const existingFromNodes = nodes
    .filter((node) => node.siteId === siteId && node.category !== 'wan')
    .map((node) => node.ip.split('.'))
    .filter((parts) => parts.length === 4 && Number(parts[1]) === siteOctet)
    .map((parts) => `${parts[2]}.${parts[3]}`);

  const presetOptions: string[] = [];
  for (let third = 1; third <= 10; third += 1) {
    for (let fourth = 10; fourth <= 250; fourth += 20) {
      presetOptions.push(`${third}.${fourth}`);
    }
  }

  const sortRadical = (value: string) => {
    const [thirdRaw, fourthRaw] = value.split('.');
    const third = Number(thirdRaw);
    const fourth = Number(fourthRaw);
    return third * 1000 + fourth;
  };

  return Array.from(new Set([...existingFromNodes, ...presetOptions])).sort(
    (a, b) => sortRadical(a) - sortRadical(b),
  );
}

export function createDefaultVlanDraft(
  siteId: string,
  siteOctet: number,
  siteVlans: SiteVlan[],
  nodes: NodeItem[],
): SiteVlanDraft {
  const radicalOptions = getSiteRadicalOptions(siteId, siteOctet, nodes);

  return {
    vlanId: String(getNextVlanId(siteId, siteVlans)),
    capacity: String(CAPACITY_OPTIONS[3]),
    startRadical: radicalOptions[0] ?? '1.10',
    name: '',
  };
}

export function formatCompactRange(startIp: string, endIp: string) {
  if (startIp === endIp) return startIp;

  const start = startIp.split('.');
  const end = endIp.split('.');
  if (start.length !== 4 || end.length !== 4) {
    return `${startIp} - ${endIp}`;
  }

  if (start[0] === end[0] && start[1] === end[1]) {
    return `${startIp} - .${end[2]}.${end[3]}`;
  }

  if (start[0] === end[0]) {
    return `${startIp} - .${end[1]}.${end[2]}.${end[3]}`;
  }

  return `${startIp} - ${endIp}`;
}
