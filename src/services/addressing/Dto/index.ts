import type {
  DhcpScope,
  NodeVlanInterface,
  SiteNetwork,
  SiteVlan,
  Subnet,
} from '../../../features/network/types';

export type AddressingSnapshotDto = {
  siteNetworks: SiteNetwork[];
  siteVlans: SiteVlan[];
  subnets: Subnet[];
  nodeVlanInterfaces: NodeVlanInterface[];
  dhcpScopes: DhcpScope[];
};

export type CreateSiteNetworkDto = Omit<SiteNetwork, 'id'> & { id?: string };
export type CreateSiteVlanDto = Omit<SiteVlan, 'id'> & { id?: string };
export type CreateSubnetDto = Omit<Subnet, 'id'> & { id?: string };
export type CreateNodeVlanInterfaceDto =
  Omit<NodeVlanInterface, 'id'> & { id?: string };
export type CreateDhcpScopeDto = Omit<DhcpScope, 'id'> & { id?: string };

export type PatchSiteNetworkDto = Partial<Omit<SiteNetwork, 'id'>>;
export type PatchSiteVlanDto = Partial<Omit<SiteVlan, 'id'>>;
export type PatchSubnetDto = Partial<Omit<Subnet, 'id'>>;
export type PatchNodeVlanInterfaceDto = Partial<Omit<NodeVlanInterface, 'id'>>;
export type PatchDhcpScopeDto = Partial<Omit<DhcpScope, 'id'>>;
