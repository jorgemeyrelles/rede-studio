import type { AddressAllocationMode } from '../../../features/network/types';

export type SiteVlanDraft = {
  vlanId: string;
  capacity: string;
  startRadical: string;
  name: string;
  ipv6Prefix: string;
  addressAllocation: AddressAllocationMode;
  /** P12 — true quando o usuário selecionou "Outro..." no combobox de nome */
  nameCustom?: boolean;
};
