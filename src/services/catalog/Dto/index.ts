import type { Certificate, CustomService } from '../../../features/network/types';

export type CatalogSnapshotDto = {
  customServices: CustomService[];
  certificates: Certificate[];
};

export type CreateCustomServiceDto = Omit<CustomService, 'id'> & { id?: string };
export type PatchCustomServiceDto = Partial<Omit<CustomService, 'id'>>;

export type CreateCertificateDto = Omit<Certificate, 'id'> & { id?: string };
export type PatchCertificateDto = Partial<Omit<Certificate, 'id'>>;
