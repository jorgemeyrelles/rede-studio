import type { NodeCategory } from '../../../features/network/types';
import { NODE_VISUALS } from '../constants';

function getPublicAssetPath(path: string) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
}

export function getNodeVisual(category: NodeCategory) {
  return (
    NODE_VISUALS.find((item) => item.category === category) ?? {
      category,
      label: category,
      short: category.toUpperCase(),
    }
  );
}

export function getNodeIconName(category: NodeCategory): string {
  if (category === 'wan') return 'cloud';
  if (category === 'router') return 'router';
  if (category === 'switch') return 'switch';
  if (category === 'firewall') return 'firewall';
  if (category === 'pc') return 'pc';
  if (category === 'server' || category === 'nas') return 'server';
  if (category === 'printer') return 'printer';
  if (category === 'printer-3d') return 'printer3d';
  if (category === 'access-point') return 'ap';
  if (category === 'voip') return 'phone';
  if (category === 'smartphone') return 'mobile';
  if (
    category === 'vpn' ||
    category === 'ipsec' ||
    category === 'wireguard' ||
    category === 'mpls' ||
    category === 'gre' ||
    category === 'sdwan'
  ) {
    return 'vpn';
  }
  return 'policy';
}

export function getNodeIconSrc(category: NodeCategory): string {
  return getPublicAssetPath(`images/network/${getNodeIconName(category)}.svg`);
}
