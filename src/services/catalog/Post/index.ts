import { makeServiceId, mutateStateDocument } from '../../_core';
import type { CreateCertificateDto, CreateCustomServiceDto } from '../Dto';

export function createCustomService(input: CreateCustomServiceDto) {
  return mutateStateDocument((document) => {
    const customService = {
      ...input,
      id: input.id ?? makeServiceId('svc'),
    };
    document.customServices.push(customService);
    return customService;
  });
}

export function createCertificate(input: CreateCertificateDto) {
  return mutateStateDocument((document) => {
    const certificate = {
      ...input,
      id: input.id ?? makeServiceId('cert'),
    };
    document.certificates.push(certificate);
    return certificate;
  });
}
