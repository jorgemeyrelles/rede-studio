import { mutateStateDocument } from '../../_core';
import type { PatchCertificateDto, PatchCustomServiceDto } from '../Dto';

export function patchCustomService(id: string, changes: PatchCustomServiceDto) {
  return mutateStateDocument((document) => {
    const target = document.customServices.find((item) => item.id === id) ?? null;
    if (!target) return null;
    Object.assign(target, changes);
    return target;
  });
}

export function patchCertificate(id: string, changes: PatchCertificateDto) {
  return mutateStateDocument((document) => {
    const target = document.certificates.find((item) => item.id === id) ?? null;
    if (!target) return null;
    Object.assign(target, changes);
    return target;
  });
}
