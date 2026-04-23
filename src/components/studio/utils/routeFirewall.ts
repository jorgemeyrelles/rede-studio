import type { RouteRow, Site } from '../../../features/network/types';
import type { RouteGroup } from '../types';

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
