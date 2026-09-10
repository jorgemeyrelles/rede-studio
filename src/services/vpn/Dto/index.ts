import type {
    Certificate,
    IpsecSA,
    SslVpnProfile,
} from '../../../features/network/types';

export type VpnSnapshotDto = {
  certificates: Certificate[];
  ipsecSas: IpsecSA[];
  sslVpnProfiles: SslVpnProfile[];
};

export type CreateCertificateDto = Omit<Certificate, 'id'> & { id?: string };
export type CreateIpsecSaDto = Omit<IpsecSA, 'id'> & { id?: string };
export type CreateSslVpnProfileDto = Omit<SslVpnProfile, 'id'> & { id?: string };

export type PatchCertificateDto = Partial<Omit<Certificate, 'id'>>;
export type PatchIpsecSaDto = Partial<Omit<IpsecSA, 'id'>>;
export type PatchSslVpnProfileDto = Partial<Omit<SslVpnProfile, 'id'>>;
