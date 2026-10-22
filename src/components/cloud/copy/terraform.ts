import type { AppLanguage } from '../../../types/i18n';

/** Textos de `terraform` no Studio Cloud (parte de `cloudCopy.ts`). */
export type TerraformCopy = {
  tab: string;
  hint: string;
  files: string;
  lines: (count: number) => string;
  todos: (count: number) => string;
  todosEmpty: string;
  onlySelected: string;
  noBlocks: string;
  copy: string;
  copied: string;
  download: string;
  catalogMissing: string;
};

export const terraformCopy: Record<AppLanguage, TerraformCopy> = {
  pt: {
    tab: 'Terraform',
    hint: 'Código gerado do rascunho (AWS provider 6). Elementos incompletos viram TODO, nunca recurso inválido.',
    files: 'Arquivos',
    lines: (count) => `${count} linhas`,
    todos: (count) =>
      count === 1 ? '1 TODO do rascunho' : `${count} TODOs do rascunho`,
    todosEmpty: 'Nenhum TODO: o rascunho gera código completo.',
    onlySelected: 'Só o elemento selecionado',
    noBlocks: 'Nenhum bloco deste elemento neste arquivo.',
    copy: 'Copiar arquivo',
    copied: 'Copiado',
    download: 'Baixar .zip',
    catalogMissing: 'Catálogo IAM indisponível: anexos de políticas omitidos.',
  },
  en: {
    tab: 'Terraform',
    hint: 'Code generated from the draft (AWS provider 6). Incomplete elements become TODOs, never invalid resources.',
    files: 'Files',
    lines: (count) => `${count} lines`,
    todos: (count) => (count === 1 ? '1 draft TODO' : `${count} draft TODOs`),
    todosEmpty: 'No TODOs: the draft generates complete code.',
    onlySelected: 'Only the selected element',
    noBlocks: 'No blocks for this element in this file.',
    copy: 'Copy file',
    copied: 'Copied',
    download: 'Download .zip',
    catalogMissing: 'IAM catalog unavailable: policy attachments omitted.',
  },
  es: {
    tab: 'Terraform',
    hint: 'Código generado del borrador (AWS provider 6). Los elementos incompletos son TODO, nunca recursos inválidos.',
    files: 'Archivos',
    lines: (count) => `${count} líneas`,
    todos: (count) =>
      count === 1 ? '1 TODO del borrador' : `${count} TODO del borrador`,
    todosEmpty: 'Ningún TODO: el borrador genera código completo.',
    onlySelected: 'Solo el elemento seleccionado',
    noBlocks: 'Ningún bloque de este elemento en este archivo.',
    copy: 'Copiar archivo',
    copied: 'Copiado',
    download: 'Descargar .zip',
    catalogMissing:
      'Catálogo IAM no disponible: adjuntos de políticas omitidos.',
  },
};
