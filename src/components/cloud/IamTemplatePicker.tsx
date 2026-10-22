import { ChevronRight, X } from 'lucide-react';
import { useId, useState } from 'react';
import { readIamSelections, type IamSelection } from '../../features/cloud/iam';
import { useIamCatalogQuery } from '../../features/cloud/queries';
import type { IamTemplate } from '../../services/routes/cloudCatalogRoutes';
import type { AppLanguage } from '../../types/i18n';
import CatalogCombobox, { type ComboboxOption } from './CatalogCombobox';
import { getCloudCopy } from './cloudCopy';

type IamTemplatePickerProps = {
  kind: 'GROUP' | 'ROLE';
  label: string;
  help?: string;
  value: unknown;
  language: AppLanguage;
  onChange: (value: IamSelection[]) => void;
};

export function templateLabel(
  template: IamTemplate | undefined,
  language: AppLanguage,
  fallback: string,
) {
  return template?.name[language] ?? template?.name.en ?? fallback;
}

/**
 * Grupos ou roles IAM da conta, escolhidos do catálogo (múltipla escolha).
 * Escolher um modelo traz as políticas gerenciadas dele; cada seleção abre
 * a lista das políticas em uso, com remover e "adicionar política".
 */
export default function IamTemplatePicker({
  kind,
  label,
  help,
  value,
  language,
  onChange,
}: IamTemplatePickerProps) {
  const copy = getCloudCopy(language);
  const { data: catalog, isLoading, isError } = useIamCatalogQuery('AWS');
  const selections = readIamSelections(value);
  const [expanded, setExpanded] = useState<string | null>(null);
  const labelId = useId();

  const templates = (kind === 'GROUP' ? catalog?.groups : catalog?.roles) ?? [];
  const byKey = new Map(templates.map((t) => [t.key, t]));
  const policyByKey = new Map((catalog?.policies ?? []).map((p) => [p.key, p]));
  const selectedKeys = new Set(selections.map((s) => s.key));

  const policyShortName = (key: string) =>
    policyByKey.get(key)?.policyArn?.split('/').pop() ?? key;

  const templateOptions: ComboboxOption[] = templates.map((template) => ({
    value: template.key,
    label: templateLabel(template, language, template.key),
    description: template.description[language] ?? template.description.en,
    meta: template.policies.map(policyShortName).join(' · '),
  }));

  const toggleTemplate = (key: string) => {
    if (selectedKeys.has(key)) {
      onChange(selections.filter((s) => s.key !== key));
      return;
    }
    onChange([
      ...selections,
      { key, policies: [...(byKey.get(key)?.policies ?? [])] },
    ]);
  };

  const setPolicies = (key: string, policies: string[]) =>
    onChange(selections.map((s) => (s.key === key ? { ...s, policies } : s)));

  return (
    <div role="group" aria-labelledby={labelId}>
      <p id={labelId} className="mb-1 text-xs font-medium text-chalk-dim">
        {label}
      </p>

      {selections.length > 0 && (
        <ul className="mb-1.5 divide-y divide-line/60 rounded-sm border border-line">
          {selections.map((selection) => {
            const template = byKey.get(selection.key);
            const isOpen = expanded === selection.key;
            const panelId = `${labelId}-${selection.key}`;
            const policyOptions: ComboboxOption[] = (catalog?.policies ?? [])
              .filter((p) => !selection.policies.includes(p.key))
              .map((p) => ({
                value: p.key,
                label: templateLabel(p, language, p.key),
                description: p.description[language] ?? p.description.en,
                meta: p.policyArn ?? undefined,
              }));
            return (
              <li key={selection.key}>
                <div className="flex items-center gap-1 px-1.5 py-1">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setExpanded(isOpen ? null : selection.key)}
                    className="flex min-w-0 flex-1 items-center gap-1.5 rounded-[2px] px-1 py-0.5 text-left hover:bg-ink-raised-2"
                  >
                    <ChevronRight
                      size={12}
                      aria-hidden="true"
                      className={`shrink-0 text-chalk-faint transition-transform ${isOpen ? 'rotate-90' : ''}`}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-xs text-chalk">
                        {templateLabel(template, language, selection.key)}
                      </span>
                      <span className="block truncate font-mono text-2xs text-chalk-faint">
                        {template?.iamName ?? copy.outsideCatalog}
                        {' · '}
                        {copy.policyCount(selection.policies.length)}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleTemplate(selection.key)}
                    aria-label={`${copy.listRemove} ${templateLabel(template, language, selection.key)}`}
                    title={copy.listRemove}
                    className="rounded-[2px] p-1 text-chalk-faint hover:bg-signal-down/15 hover:text-signal-down"
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                </div>
                {isOpen && (
                  <div id={panelId} className="space-y-1.5 px-3 pb-2.5 pt-0.5">
                    {template?.trustedService && (
                      <p className="text-2xs text-chalk-dim">
                        {copy.trustedBy}{' '}
                        <span className="font-mono text-chalk">
                          {template.trustedService}
                        </span>
                      </p>
                    )}
                    {selection.policies.length === 0 ? (
                      <p className="text-2xs text-signal-warn">
                        {copy.noPolicies}
                      </p>
                    ) : (
                      <ul className="flex flex-wrap gap-1">
                        {selection.policies.map((policyKey) => (
                          <li
                            key={policyKey}
                            className="chip"
                            title={
                              policyByKey.get(policyKey)?.policyArn ?? policyKey
                            }
                          >
                            {policyShortName(policyKey)}
                            <button
                              type="button"
                              onClick={() =>
                                setPolicies(
                                  selection.key,
                                  selection.policies.filter(
                                    (p) => p !== policyKey,
                                  ),
                                )
                              }
                              aria-label={`${copy.listRemove} ${policyShortName(policyKey)}`}
                              title={copy.listRemove}
                              className="-mr-0.5 rounded-[2px] p-0.5 text-chalk-faint hover:bg-signal-down/15 hover:text-signal-down"
                            >
                              <X size={11} aria-hidden="true" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <CatalogCombobox
                      options={policyOptions}
                      selected={new Set()}
                      multiple={false}
                      disabled={!catalog}
                      onToggle={(policyKey) =>
                        setPolicies(selection.key, [
                          ...selection.policies,
                          policyKey,
                        ])
                      }
                      triggerLabel={copy.addPolicy}
                      searchPlaceholder={copy.searchPolicies}
                      emptyLabel={copy.noMatches}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <CatalogCombobox
        options={templateOptions}
        selected={selectedKeys}
        onToggle={toggleTemplate}
        disabled={!catalog}
        triggerLabel={
          isLoading
            ? copy.catalogLoading
            : isError || !catalog
              ? copy.catalogUnavailable
              : kind === 'GROUP'
                ? copy.chooseGroups
                : copy.chooseRoles
        }
        searchPlaceholder={copy.searchCatalog}
        emptyLabel={copy.noMatches}
      />
      {help && (
        <p className="mt-1 text-2xs leading-4 text-chalk-faint">{help}</p>
      )}
    </div>
  );
}
