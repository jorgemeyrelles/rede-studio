/**
 * Seleções IAM da conta (grupos e roles), cada uma ligada a um modelo do
 * catálogo IAM (`/api/cloud-catalog/iam`) e às políticas em uso.
 *
 * Ao escolher um modelo, as políticas dele entram como ponto de partida;
 * depois, o inspetor adiciona/remove políticas por seleção. O valor
 * guardado é só a `key` (o rótulo vem do catálogo), então renomear um
 * modelo no catálogo não quebra rascunhos.
 */
export type IamSelection = {
  key: string;
  policies: string[];
};

/**
 * Lê `config.iamGroups`/`config.iamRoles` tolerando o formato antigo do
 * rascunho (lista de nomes livres, antes do catálogo): cada nome vira uma
 * seleção sem políticas, e o inspetor mostra como "fora do catálogo".
 */
export function readIamSelections(value: unknown): IamSelection[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): IamSelection[] => {
    if (typeof item === 'string')
      return item ? [{ key: item, policies: [] }] : [];
    if (
      item &&
      typeof item === 'object' &&
      typeof (item as IamSelection).key === 'string'
    ) {
      const policies = (item as IamSelection).policies;
      return [
        {
          key: (item as IamSelection).key,
          policies: Array.isArray(policies)
            ? policies.filter((p) => typeof p === 'string')
            : [],
        },
      ];
    }
    return [];
  });
}
