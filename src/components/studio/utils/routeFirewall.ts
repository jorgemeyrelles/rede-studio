import type { RouteRow, Site } from '../../../features/network/types';
import type { SubnetRouteRow } from '../../../features/network/types/selectors';
import type { RouteGroup, SubnetRouteSiteGroup } from '../types';

export function groupRoutesBySite(rows: RouteRow[]): RouteGroup[] {
  const order: string[] = [];
  const map: Record<string, RouteGroup> = {};
  for (const row of rows) {
    if (!map[row.siteId]) {
      order.push(row.siteId);
      map[row.siteId] = {
        siteId: row.siteId,
        siteName: row.siteName,
        rows: [],
      };
    }
    map[row.siteId].rows.push(row);
  }
  return order.map((id) => map[id]);
}

export function getSiteOtherIps(
  siteId: string,
  siteRoutes: RouteRow[],
  sites: Site[],
) {
  const site = sites.find((item) => item.id === siteId);
  if (!site) return '-';

  const networkIp = `200.${site.ipOctet}.0.0`;
  const broadcastIp = `200.${site.ipOctet}.255.255`;
  const firstHostIp = `200.${site.ipOctet}.0.1`;
  const lastHostIp = `200.${site.ipOctet}.255.254`;
  const defaultRoute = '0.0.0.0/0';
  const defaultGateway =
    siteRoutes.find((route) => route.tipo === 'Default')?.gateway ?? '-';

  return `Rede: ${networkIp} | Broadcast: ${broadcastIp} | Host inicial: ${firstHostIp} | Host final: ${lastHostIp} | Default: ${defaultRoute} via ${defaultGateway}`;
}

export function groupSubnetRoutesBySiteAndVlan(
  rows: SubnetRouteRow[],
): SubnetRouteSiteGroup[] {
  const bySite = new Map<
    string,
    {
      siteName: string;
      byVlan: Map<
        string,
        {
          vlanId: number;
          vlanName: string;
          bySubnet: Map<string, { subnetName: string; rows: SubnetRouteRow[] }>;
        }
      >;
    }
  >();

  rows.forEach((row) => {
    if (!bySite.has(row.siteId)) {
      bySite.set(row.siteId, {
        siteName: row.siteName,
        byVlan: new Map(),
      });
    }

    const site = bySite.get(row.siteId);
    if (!site) return;

    const vlanKey = `${row.vlanId}::${row.vlanName}`;
    if (!site.byVlan.has(vlanKey)) {
      site.byVlan.set(vlanKey, {
        vlanId: row.vlanId,
        vlanName: row.vlanName,
        bySubnet: new Map(),
      });
    }

    const vlanGroup = site.byVlan.get(vlanKey);
    if (!vlanGroup) return;

    const subnetKey = row.subnetName || 'Sem sub-rede';
    if (!vlanGroup.bySubnet.has(subnetKey)) {
      vlanGroup.bySubnet.set(subnetKey, {
        subnetName: subnetKey,
        rows: [],
      });
    }

    const subnetGroup = vlanGroup.bySubnet.get(subnetKey);
    if (!subnetGroup) return;
    subnetGroup.rows.push(row);
  });

  return Array.from(bySite.entries())
    .map(([siteId, site]) => ({
      siteId,
      siteName: site.siteName,
      vlans: Array.from(site.byVlan.values())
        .sort((left, right) => left.vlanId - right.vlanId)
        .map((vlanGroup) => ({
          vlanId: vlanGroup.vlanId,
          vlanName: vlanGroup.vlanName,
          subnets: Array.from(vlanGroup.bySubnet.values()),
        })),
    }))
    .sort((left, right) => left.siteName.localeCompare(right.siteName));
}
