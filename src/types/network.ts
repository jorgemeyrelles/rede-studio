import type { NetworkLayer, Site } from "./slide";

export type { NetworkLayer, Site } from "./slide";

/** Linha da tabela de endereçamento IPv4 */
export interface AddressRow {
  site: Site;
  device: string;
  ip: string;
  mask: string;
  gateway: string;
  layer: NetworkLayer;
}

/** Card de VLAN na grade de segmentação */
export interface VlanCard {
  id: number;
  name: string;
  range: string;
  description: string;
}

/** Tipo de rota na tabela de roteamento */
export type RouteType = "Direta" | "Estática" | "Default";

/** Linha da tabela de rotas estáticas */
export interface RouteEntry {
  type: RouteType;
  destination: string;
  mask: string;
  gateway: string;
  metric: string;
  iface: string;
  ifaceColor: string;
}
