import { makeServiceId, mutateStateDocument } from '../../_core';
import type {
    CreateCertificateDto,
    CreateIpsecSaDto,
    CreateSslVpnProfileDto,
} from '../Dto';

export function createCertificate(input: CreateCertificateDto) {
  return mutateStateDocument((document) => {
    const certificate = { ...input, id: input.id ?? makeServiceId('cert') };
    document.certificates.push(certificate);
    return certificate;
  });
}

export function createIpsecSa(input: CreateIpsecSaDto) {
  return mutateStateDocument((document) => {
    const ipsecSa = { ...input, id: input.id ?? makeServiceId('sa') };
    document.ipsecSas.push(ipsecSa);
    return ipsecSa;
  });
}

export function createSslVpnProfile(input: CreateSslVpnProfileDto) {
  return mutateStateDocument((document) => {
    const sslVpnProfile = {
      ...input,
      id: input.id ?? makeServiceId('svpn'),
    };
    document.sslVpnProfiles.push(sslVpnProfile);
    return sslVpnProfile;
  });
}
