export interface MatrixLayerRow {
  layer: string;
  equipment: string;
  role: string;
  scope: string;
}

export interface MatrixWanRow {
  link: string;
  technology: string;
  speed: string;
  sla: string;
  ipv4: string;
  ipv6: string;
  usage: string;
}

export interface MatrixVlanRow {
  vlan: string;
  name: string;
  subnet: string;
  prefix: string;
  hosts: string;
}
