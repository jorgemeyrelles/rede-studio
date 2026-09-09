export interface FailoverMetricRow {
  situation: string;
  metric: string;
  behavior: string;
}

export interface PrefixReferenceRow {
  prefix: string;
  mask: string;
  hosts: string;
  usage: string;
}

export interface DefaultRouteRow {
  protocol: string;
  route: string;
  primary: string;
  backup: string;
}
