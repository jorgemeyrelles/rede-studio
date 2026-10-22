import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAppSelector } from '../../app/hooks';
import { cloudPricesRoutes } from '../../services/routes/cloudPricesRoutes';
import { estimateCost } from './engines/cost';
import { GLOBAL_PRICE_REGION, GLOBAL_TYPE } from './engines/edge';

/** Mesma chave/cache do `useCloudPriceCatalogQuery` (preços mudam só com recarga do ADMIN). */
const STALE_TIME_MS = 30 * 60 * 1000;

/**
 * Custo estimado do rascunho aberto: busca o catálogo de cada região usada
 * (uma requisição por região, em cache) e roda o motor puro. Trocar USD ⇄
 * BRL não chama nada: as linhas já têm as duas moedas.
 */
export function useCloudCost() {
  const { resources, connections, assumptions } = useAppSelector(
    (state) => state.cloud,
  );
  // Regiões usadas + `global` (Serviços globais e Shield Advanced).
  const regions = useMemo(
    () => [
      ...new Set([
        ...resources
          .filter((r) => r.type === 'aws.region')
          .map((r) => String(r.config.region ?? ''))
          .filter(Boolean),
        ...(resources.some(
          (r) =>
            r.type === GLOBAL_TYPE ||
            (r.type === 'aws.account' && r.config.shieldAdvanced === true),
        )
          ? [GLOBAL_PRICE_REGION]
          : []),
      ]),
    ],
    [resources],
  );
  const queries = useQueries({
    queries: regions.map((region) => ({
      queryKey: ['cloud-prices', 'catalog', 'AWS', region] as const,
      queryFn: () => cloudPricesRoutes.getCloudPriceCatalog('AWS', region),
      staleTime: STALE_TIME_MS,
    })),
  });
  const catalogs = Object.fromEntries(
    regions.map((region, i) => [region, queries[i]?.data ?? null]),
  );
  const dataKey = queries.map((q) => q.dataUpdatedAt).join('|');
  const estimate = useMemo(
    () => estimateCost({ resources, connections, assumptions, catalogs }),
    // `catalogs` é recriado a cada render; `dataKey` muda quando algum catálogo chega.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resources, connections, assumptions, dataKey],
  );
  return {
    estimate,
    catalogs,
    regions,
    loading: queries.some((q) => q.isLoading),
    failed: queries.some((q) => q.isError),
  };
}
