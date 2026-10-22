import { httpGet } from '../_core/httpClient';

/**
 * Catálogos de referência do Studio Cloud na `rede-studio-api`
 * (`GET /api/cloud-catalog/*`, ver `CloudCatalogController.java`). Só
 * leitura aqui — a carga é feita por `tools/cloud-catalog` no backend.
 */

export type CloudProviderFamilyCode = 'AWS' | 'AZURE' | 'GCP' | 'OCI';

export type IamTemplateKind = 'GROUP' | 'ROLE' | 'POLICY';

export type IamTemplate = {
  provider: CloudProviderFamilyCode;
  kind: IamTemplateKind;
  key: string;
  name: Partial<Record<'pt' | 'en' | 'es', string>>;
  description: Partial<Record<'pt' | 'en' | 'es', string>>;
  /** GROUP/ROLE: nome sugerido no provedor. */
  iamName: string | null;
  /** GROUP/ROLE: `key`s das POLICY trazidas por padrão. */
  policies: string[];
  /** ROLE: serviço que assume a role. */
  trustedService: string | null;
  /** POLICY: identificador no provedor (ARN na AWS). */
  policyArn: string | null;
  order: number | null;
};

export type IamCatalogResponse = {
  provider: CloudProviderFamilyCode;
  groups: IamTemplate[];
  roles: IamTemplate[];
  policies: IamTemplate[];
};

/** Catálogo IAM de uma família (modelos de grupo/role + políticas gerenciadas). */
export function getIamCatalog(provider: CloudProviderFamilyCode): Promise<IamCatalogResponse> {
  return httpGet<IamCatalogResponse>(`/api/cloud-catalog/iam?provider=${provider}`);
}

export const cloudCatalogRoutes = { getIamCatalog };
