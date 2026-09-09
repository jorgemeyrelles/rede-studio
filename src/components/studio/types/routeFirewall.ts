import type { RouteRow } from '../../../features/network/types';
import type { SubnetRouteRow } from '../../../features/network/types/selectors';
import type { StudioLanguage } from './i18n';

export type TooltipPosition = {
  top: number;
  left: number;
};

export type RouteGroup = {
  siteId: string;
  siteName: string;
  rows: RouteRow[];
};

export type RouteFirewallPanelProps = {
  language: StudioLanguage;
};

export type SubnetRouteSubnetGroup = {
  subnetName: string;
  rows: SubnetRouteRow[];
};

export type SubnetRouteVlanGroup = {
  vlanId: number;
  vlanName: string;
  subnets: SubnetRouteSubnetGroup[];
};

export type SubnetRouteSiteGroup = {
  siteId: string;
  siteName: string;
  vlans: SubnetRouteVlanGroup[];
};
