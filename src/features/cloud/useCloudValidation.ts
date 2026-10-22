import { useMemo } from 'react';
import { useAppSelector } from '../../app/hooks';
import type { AppLanguage } from '../../types/i18n';
import { validateCloud, validationCounts } from './engines/validation';
import { useCloudCost } from './useCloudCost';
import { useCloudTerraform } from './useCloudTerraform';

/**
 * Itens da aba Validação: o motor puro sobre o rascunho, o custo (só depois
 * que os preços chegam — antes disso tudo pareceria "sem preço") e os TODOs
 * do Terraform.
 */
export function useCloudValidation(language: AppLanguage) {
  const { resources, connections } = useAppSelector((state) => state.cloud);
  const { estimate, loading, failed } = useCloudCost();
  const { output } = useCloudTerraform(language);
  const pricesReady = !loading && !failed;
  const items = useMemo(
    () =>
      validateCloud({
        resources,
        connections,
        cost: pricesReady ? estimate : null,
        todos: output.todos,
      }),
    [resources, connections, pricesReady, estimate, output.todos],
  );
  return {
    items,
    counts: useMemo(() => validationCounts(items), [items]),
    pricesPending: !pricesReady,
  };
}
