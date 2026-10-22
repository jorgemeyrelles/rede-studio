import type { AppLanguage } from '../../../types/i18n';

/** Textos de `validation` no Studio Cloud (parte de `cloudCopy.ts`). */
export type ValidationCopy = {
  tab: string;
  /** Rótulo do grupo com a contagem de erros + avisos. */
  groupLabel: (count: number) => string;
  hint: string;
  filterLabel: string;
  all: string;
  severities: Record<'error' | 'warning' | 'tip', string>;
  columns: { severity: string; rule: string; element: string; fix: string };
  project: string;
  empty: string;
  emptyFiltered: string;
  pricesPending: string;
};

export const validationCopy: Record<AppLanguage, ValidationCopy> = {
  pt: {
    tab: 'Validação',
    groupLabel: (count) => (count > 0 ? `Validação · ${count}` : 'Validação'),
    hint: 'Tudo o que o rascunho precisa resolver, num lugar só. Erros impedem gerar o recurso no Terraform; avisos merecem revisão; dicas são boas práticas.',
    filterLabel: 'Filtrar por severidade',
    all: 'Todos',
    severities: { error: 'Erro', warning: 'Aviso', tip: 'Dica' },
    columns: {
      severity: 'Severidade',
      rule: 'Regra',
      element: 'Elemento',
      fix: 'Como corrigir',
    },
    project: 'Projeto',
    empty: 'Nada a corrigir no rascunho.',
    emptyFiltered: 'Nada nesta severidade.',
    pricesPending:
      'Os preços ainda não carregaram: itens sem preço na Região aparecem aqui quando chegarem.',
  },
  en: {
    tab: 'Validation',
    groupLabel: (count) => (count > 0 ? `Validation · ${count}` : 'Validation'),
    hint: 'Everything the draft needs to fix, in one place. Errors keep the resource out of Terraform; warnings deserve a review; tips are best practices.',
    filterLabel: 'Filter by severity',
    all: 'All',
    severities: { error: 'Error', warning: 'Warning', tip: 'Tip' },
    columns: {
      severity: 'Severity',
      rule: 'Rule',
      element: 'Element',
      fix: 'How to fix',
    },
    project: 'Project',
    empty: 'Nothing to fix in the draft.',
    emptyFiltered: 'Nothing at this severity.',
    pricesPending:
      'Prices have not loaded yet: items without a price in the Region show up here once they arrive.',
  },
  es: {
    tab: 'Validación',
    groupLabel: (count) => (count > 0 ? `Validación · ${count}` : 'Validación'),
    hint: 'Todo lo que el borrador necesita resolver, en un solo lugar. Los errores impiden generar el recurso en Terraform; los avisos merecen revisión; las sugerencias son buenas prácticas.',
    filterLabel: 'Filtrar por severidad',
    all: 'Todos',
    severities: { error: 'Error', warning: 'Aviso', tip: 'Sugerencia' },
    columns: {
      severity: 'Severidad',
      rule: 'Regla',
      element: 'Elemento',
      fix: 'Cómo corregir',
    },
    project: 'Proyecto',
    empty: 'Nada que corregir en el borrador.',
    emptyFiltered: 'Nada en esta severidad.',
    pricesPending:
      'Los precios aún no cargaron: los ítems sin precio en la Región aparecen aquí cuando lleguen.',
  },
};
