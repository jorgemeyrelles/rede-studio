import { mutateStateDocument } from '../../_core';
import type {
    PatchCertificateDto,
    PatchIpsecSaDto,
    PatchSslVpnProfileDto,
} from '../Dto';

export function patchCertificate(id: string, changes: PatchCertificateDto) {
  return mutateStateDocument((document) => {
    const target = document.certificates.find((item) => item.id === id) ?? null;
    if (!target) return null;
    Object.assign(target, changes);
    return target;
  });
}

export function patchIpsecSa(id: string, changes: PatchIpsecSaDto) {
  return mutateStateDocument((document) => {
    const target = document.ipsecSas.find((item) => item.id === id) ?? null;
    if (!target) return null;
    Object.assign(target, changes);
    return target;
  });
}

export function patchSslVpnProfile(
  id: string,
  changes: PatchSslVpnProfileDto,
) {
  return mutateStateDocument((document) => {
    const target = document.sslVpnProfiles.find((item) => item.id === id) ?? null;
    if (!target) return null;
    Object.assign(target, changes);
    return target;
  });
}
