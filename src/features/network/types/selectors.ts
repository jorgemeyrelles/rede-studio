export type RouteType = 'Direta' | 'Estática' | 'Default' | 'VPN';

export type RouteRow = {
  siteId: string;
  siteName: string;
  tipo: RouteType;
  vlan: string;
  redeDest: string;
  gateway: string;
  iface: string;
  reservedSiteRange?: string;
  reservedSiteCount?: number;
  reserveMarginPercent?: number;
};
