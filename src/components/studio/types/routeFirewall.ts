import type { RouteRow } from '../../../features/network/types';

export type TooltipPosition = {
  top: number;
  left: number;
};

export type RouteGroup = {
  siteId: string;
  siteName: string;
  rows: RouteRow[];
};
