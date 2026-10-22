import { useQuery } from '@tanstack/react-query';
import {
  cloudCatalogRoutes,
  type CloudProviderFamilyCode,
} from '../../services/routes/cloudCatalogRoutes';
import { cloudPricesRoutes } from '../../services/routes/cloudPricesRoutes';

/** Preços mudam só quando o ADMIN recarrega o banco — cache longo. */
const CLOUD_PRICES_STALE_TIME_MS = 30 * 60 * 1000;

/** Regiões com preço carregado (seletor de região, rodapé "preços de dd/mm"). */
export function useCloudPriceMetaQuery() {
  return useQuery({
    queryKey: ['cloud-prices', 'meta'] as const,
    queryFn: () => cloudPricesRoutes.getCloudPriceMeta(),
    staleTime: CLOUD_PRICES_STALE_TIME_MS,
  });
}

/** Catálogo de preços de uma região AWS (motor de custo). */
export function useCloudPriceCatalogQuery(region: string | null | undefined) {
  return useQuery({
    queryKey: ['cloud-prices', 'catalog', 'AWS', region ?? ''] as const,
    queryFn: () =>
      cloudPricesRoutes.getCloudPriceCatalog('AWS', region as string),
    enabled: Boolean(region),
    staleTime: CLOUD_PRICES_STALE_TIME_MS,
  });
}

/** Catálogo IAM da família (grupos, roles e políticas gerenciadas). Muda só com recarga do ADMIN. */
export function useIamCatalogQuery(provider: CloudProviderFamilyCode = 'AWS') {
  return useQuery({
    queryKey: ['cloud-catalog', 'iam', provider] as const,
    queryFn: () => cloudCatalogRoutes.getIamCatalog(provider),
    staleTime: CLOUD_PRICES_STALE_TIME_MS,
  });
}
