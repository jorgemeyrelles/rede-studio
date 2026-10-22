import { useMemo } from 'react';
import { useAppSelector } from '../../app/hooks';
import type { AppLanguage } from '../../types/i18n';
import { generateTerraform } from './engines/terraform';
import { useIamCatalogQuery } from './queries';

/**
 * Terraform do rascunho aberto (aba Terraform e TODOs da aba Validação):
 * o motor puro sobre o estado, com o catálogo IAM quando ele já chegou.
 */
export function useCloudTerraform(language: AppLanguage) {
  const { resources, connections, meta } = useAppSelector(
    (state) => state.cloud,
  );
  const { data: catalog, isError } = useIamCatalogQuery('AWS');
  const output = useMemo(
    () =>
      generateTerraform({
        resources,
        connections,
        projectName: meta.projectName,
        language,
        iamCatalog: catalog
          ? {
              groups: catalog.groups,
              roles: catalog.roles,
              policies: catalog.policies,
            }
          : null,
      }),
    [resources, connections, meta.projectName, language, catalog],
  );
  return { output, iamCatalogFailed: isError };
}
