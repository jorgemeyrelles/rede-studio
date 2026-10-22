import { httpGet } from '../_core/httpClient';

/**
 * Banco cloud de preços da `rede-studio-api` (`GET /api/cloud-prices/*`,
 * ver `CloudPriceController.java`). Só leitura aqui — a carga é feita por
 * `tools/cloud-pricing` no backend. Cada preço traz USD e BRL.
 */

export type CloudPriceRegionSummary = {
  provider: 'AWS' | 'AZURE' | 'GCP' | 'OCI';
  region: string;
  regionName: string | null;
  itemCount: number;
  updatedAt: string | null;
  fxRate: number | null;
  fxQuotedAt: string | null;
};

export type CloudPriceMetaResponse = { regions: CloudPriceRegionSummary[] };

export type CloudPriceCatalogItem = {
  resourceType: string;
  sku: string;
  rateCode: string;
  description: string | null;
  attributes: Record<string, unknown>;
  unit: string;
  usd: number;
  brl: number;
  tierBegin: number | null;
  tierEnd: number | null;
};

export type CloudPriceCatalogResponse = {
  provider: 'AWS' | 'AZURE' | 'GCP' | 'OCI';
  region: string;
  regionName: string | null;
  updatedAt: string | null;
  fxRate: number | null;
  fxQuotedAt: string | null;
  items: CloudPriceCatalogItem[];
};

/** Regiões com preço carregado, por família de provedor. */
export function getCloudPriceMeta(): Promise<CloudPriceMetaResponse> {
  return httpGet<CloudPriceMetaResponse>('/api/cloud-prices/meta');
}

/** Catálogo compacto de uma região (motor de custo). Região sem preço → `items` vazio. */
export function getCloudPriceCatalog(
  provider: CloudPriceCatalogResponse['provider'],
  region: string,
): Promise<CloudPriceCatalogResponse> {
  const query = new URLSearchParams({ provider, region });
  return httpGet<CloudPriceCatalogResponse>(`/api/cloud-prices/catalog?${query}`);
}

export const cloudPricesRoutes = {
  getCloudPriceMeta,
  getCloudPriceCatalog,
};
