import {
  AlertTriangle,
  LayoutGrid,
  Plus,
  RefreshCw,
  Shrink,
  Trash2,
  X,
} from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  addCloudConnection,
  removeCloudResource,
  resizeCloudResource,
  renameCloudResource,
  updateCloudResourceConfig,
} from '../../features/cloud/cloudSlice';
import {
  AWS_COMMERCIAL_REGIONS,
  getCatalogEntry,
  getFieldOptions,
  type CloudField,
} from '../../features/cloud/catalog';
import { useSessionQuery } from '../../features/auth/queries';
import { toTagSlug } from '../../features/cloud/engines/identity';
import { useCloudPriceMetaQuery } from '../../features/cloud/queries';
import {
  effectiveTags,
  INHERITED_TAGS,
  tagOverridePatch,
  usedTagValues,
  type InheritedTag,
} from '../../features/cloud/tags';
import { runIdGenerator } from '../../features/cloud/engines/ids';
import { subnetCapacity } from '../../features/cloud/engines/ip';
import { NACL_TYPE } from '../../features/cloud/engines/security';
import {
  canConnect,
  CONNECTABLE_TYPES,
} from '../../features/cloud/engines/connections';
import {
  regionZones,
  azsOf,
  regionCodeOf,
  vpcOf,
} from '../../features/cloud/network';
import {
  findResource,
  minContainerSize,
  sizeOf,
} from '../../features/cloud/tree';
import type {
  CloudConnection,
  CloudResource,
} from '../../features/cloud/types';
import type { AppLanguage } from '../../types/i18n';
import { getCloudIcon } from './awsIcons';
import { getCloudCopy } from './cloudCopy';
import ConnectionInspector from './ConnectionInspector';
import IamTemplatePicker from './IamTemplatePicker';
import ItemCost from './ItemCost';
import { readIdList } from '../../features/cloud/engines/addressing';
import {
  AssociationSelect,
  CheckList,
  InstanceSelect,
  RefsEditor,
} from './InspectorPickers';
import SubnetPlannerModal from './SubnetPlannerModal';

type CloudInspectorProps = {
  language: AppLanguage;
  onDeleted: () => void;
  onConnectionDeleted: () => void;
};

/**
 * Inspetor do elemento selecionado: nome + campos do catálogo, separados em
 * Configuração (como o elemento é) e Operação (como ele roda). O formulário
 * é montado pelo schema da entrada — nenhum elemento tem formulário próprio.
 */
export default function CloudInspector({
  language,
  onDeleted,
  onConnectionDeleted,
}: CloudInspectorProps) {
  const dispatch = useAppDispatch();
  const copy = getCloudCopy(language);
  const { resources, connections, ui, meta } = useAppSelector(
    (state) => state.cloud,
  );
  const { data: user } = useSessionQuery();
  const resource = findResource(resources, ui.selectedResourceId);
  // Sugestões das tags herdáveis: o usuário logado / o projeto + o que já
  // foi usado no rascunho.
  const suggestions: Record<'Owner' | 'CostCenter', string[]> = {
    Owner: distinct([user?.email ?? '', ...usedTagValues(resources, 'Owner')]),
    CostCenter: distinct([
      toTagSlug(meta.projectName),
      ...usedTagValues(resources, 'CostCenter'),
    ]),
  };
  const entry = resource ? getCatalogEntry(resource.type) : undefined;
  const [plannerFor, setPlannerFor] = useState<string | null>(null);

  if (!resource && ui.selectedConnectionId) {
    return (
      <ConnectionInspector
        key={ui.selectedConnectionId}
        connectionId={ui.selectedConnectionId}
        language={language}
        onDeleted={onConnectionDeleted}
      />
    );
  }

  if (!resource || !entry) {
    return (
      <aside
        aria-label={copy.inspectorTitle}
        className="panel flex min-h-0 flex-col"
      >
        <div className="panel-header">
          <h2 className="panel-title">{copy.inspectorTitle}</h2>
        </div>
        <p className="p-4 text-xs text-chalk-faint">{copy.inspectorEmpty}</p>
      </aside>
    );
  }

  const icon = getCloudIcon(resource.type);
  const visible = entry.fields.filter(
    (field) => field.visibleWhen?.(resource.config) ?? true,
  );
  const sections = (['config', 'operation'] as const)
    .map((section) => ({
      section,
      fields: visible.filter((field) => field.section === section),
    }))
    .filter((group) => group.fields.length > 0);

  const issues = entry.validate?.(resource, resources, connections) ?? {};

  const setValue = (key: string, value: unknown) =>
    dispatch(
      updateCloudResourceConfig({ id: resource.id, patch: { [key]: value } }),
    );

  return (
    <aside
      aria-label={copy.inspectorTitle}
      className="panel flex min-h-0 flex-col"
    >
      <div className="panel-header justify-start">
        {icon && (
          <img src={icon} alt="" width={22} height={22} className="shrink-0" />
        )}
        <div className="min-w-0">
          <h2 className="panel-title truncate">{entry.label[language]}</h2>
          <p className="text-label text-chalk-faint">L{entry.layer}</p>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3">
        {issues['*'] && (
          <p
            role="alert"
            className="flex gap-2 rounded-sm border border-signal-warn/40 bg-signal-warn/10 px-2.5 py-2 text-2xs leading-4 text-chalk"
          >
            <AlertTriangle
              size={13}
              aria-hidden="true"
              className="mt-px shrink-0 text-signal-warn"
            />
            {issues['*'][language]}
          </p>
        )}
        {entry.inspectorHint && (
          <p className="-mb-2 text-2xs leading-4 text-chalk-faint">
            {entry.inspectorHint[language]}
          </p>
        )}
        <FieldRow label={copy.nameLabel}>
          {(id) => (
            <input
              id={id}
              value={resource.name}
              onChange={(event) =>
                dispatch(
                  renameCloudResource({
                    id: resource.id,
                    name: event.target.value,
                  }),
                )
              }
              className="field-sm"
            />
          )}
        </FieldRow>

        {sections.map(({ section, fields }) => (
          <fieldset key={section} className="space-y-3">
            <legend className="text-label mb-2 text-chalk-faint">
              {section === 'config'
                ? copy.sectionConfig
                : copy.sectionOperation}
            </legend>
            {fields.map((field) => (
              <FieldEditor
                key={field.key}
                field={field}
                value={resource.config[field.key]}
                resource={resource}
                resources={resources}
                error={issues[field.key]?.[language] ?? null}
                language={language}
                suggestions={
                  field.type === 'text' && field.suggest
                    ? suggestions[field.suggest]
                    : undefined
                }
                onChange={(value) => setValue(field.key, value)}
              />
            ))}
          </fieldset>
        ))}

        {resource.type === 'aws.vpc' && (
          <div>
            <button
              type="button"
              onClick={() => setPlannerFor(resource.id)}
              className="btn btn-secondary btn-sm w-full justify-center"
            >
              <LayoutGrid size={14} aria-hidden="true" />
              {copy.planSubnets}
            </button>
            <p className="mt-1 text-2xs leading-4 text-chalk-faint">
              {copy.planHint}
            </p>
          </div>
        )}

        {resource.type !== 'aws.account' && (
          <TagsSection
            resource={resource}
            resources={resources}
            suggestions={suggestions}
            language={language}
          />
        )}

        {CONNECTABLE_TYPES.includes(resource.type) && (
          <ConnectToField
            resource={resource}
            resources={resources}
            connections={connections}
            language={language}
          />
        )}

        <ItemCost resourceId={resource.id} language={language} />
      </div>

      <div className="space-y-1.5 border-t border-line p-3">
        {entry.kind === 'container' && entry.canvas !== false && (
          <FitToContentButton resourceId={resource.id} language={language} />
        )}
        <button
          type="button"
          onClick={() => {
            dispatch(removeCloudResource(resource.id));
            onDeleted();
          }}
          className="btn btn-ghost btn-sm w-full justify-center text-signal-down hover:bg-signal-down/10 hover:text-signal-down"
        >
          <Trash2 size={14} aria-hidden="true" />
          {copy.deleteResource}
        </button>
      </div>
      {plannerFor === resource.id && (
        <SubnetPlannerModal
          vpcId={resource.id}
          language={language}
          onClose={() => setPlannerFor(null)}
        />
      )}
    </aside>
  );
}

/** "Ajustar ao conteúdo" do container (o mesmo do cabeçalho no canvas). */
function FitToContentButton({
  resourceId,
  language,
}: {
  resourceId: string;
  language: AppLanguage;
}) {
  const dispatch = useAppDispatch();
  const copy = getCloudCopy(language);
  const resources = useAppSelector((state) => state.cloud.resources);
  const resource = findResource(resources, resourceId);
  if (!resource) return null;
  const min = minContainerSize(resources, resourceId);
  const size = sizeOf(resource);
  const fitted = size.width === min.width && size.height === min.height;
  return (
    <button
      type="button"
      disabled={fitted}
      onClick={() =>
        dispatch(resizeCloudResource({ id: resourceId, size: min }))
      }
      className="btn btn-secondary btn-sm w-full justify-center"
    >
      <Shrink size={14} aria-hidden="true" />
      {fitted ? copy.fitDone : copy.fitToContent}
    </button>
  );
}

function distinct(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

/**
 * Tags herdáveis de um elemento interno: valor efetivo com a origem
 * ("herdado de Conta 1"), sobrescrita só para este elemento e "Voltar a
 * herdar". Ver `features/cloud/tags.ts`.
 */
function TagsSection({
  resource,
  resources,
  suggestions,
  language,
}: {
  resource: CloudResource;
  resources: CloudResource[];
  suggestions: Record<'Owner' | 'CostCenter', string[]>;
  language: AppLanguage;
}) {
  const dispatch = useAppDispatch();
  const copy = getCloudCopy(language);
  const own = effectiveTags(resources, resource.id);
  const fromParent = resource.parentId
    ? effectiveTags(resources, resource.parentId)
    : [];
  const environmentOptions = getFieldOptions('aws.account', 'environment');

  const setTag = (tag: InheritedTag, value: string) =>
    dispatch(
      updateCloudResourceConfig({
        id: resource.id,
        patch: tagOverridePatch(resource, tag, value),
      }),
    );

  return (
    <fieldset className="space-y-3">
      <legend className="text-label mb-1 text-chalk-faint">
        {copy.tagsSection}
      </legend>
      <p className="-mt-1 text-2xs leading-4 text-chalk-faint">
        {copy.tagsHint}
      </p>
      {INHERITED_TAGS.map((tag) => {
        const effective = own.find((t) => t.tag === tag);
        const inherited = fromParent.find((t) => t.tag === tag);
        const overridden = Boolean(
          effective && !effective.inherited && effective.value,
        );
        const source = findResource(resources, effective?.sourceId);
        const envLabel = (value: string) =>
          environmentOptions.find((o) => o.value === value)?.label[language] ??
          value;
        return (
          <FieldRow key={tag} label={tag}>
            {(id) => (
              <div>
                {tag === 'Environment' ? (
                  <select
                    id={id}
                    value={overridden ? effective!.value : ''}
                    onChange={(event) => setTag(tag, event.target.value)}
                    className="field-sm"
                  >
                    <option value="">
                      {copy.inheritOption(
                        inherited?.value ? envLabel(inherited.value) : '—',
                      )}
                    </option>
                    {environmentOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label[language]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <>
                    <input
                      id={id}
                      value={overridden ? effective!.value : ''}
                      placeholder={inherited?.value || undefined}
                      list={`${id}-suggestions`}
                      onChange={(event) => setTag(tag, event.target.value)}
                      className="field-sm"
                    />
                    <datalist id={`${id}-suggestions`}>
                      {suggestions[tag as 'Owner' | 'CostCenter'].map(
                        (value) => (
                          <option key={value} value={value} />
                        ),
                      )}
                    </datalist>
                  </>
                )}
                <div className="mt-1 flex items-center justify-between gap-2">
                  {effective?.inherited && source ? (
                    <span className="chip">
                      {copy.inheritedFrom(source.name)}
                    </span>
                  ) : (
                    <span />
                  )}
                  {overridden && (
                    <button
                      type="button"
                      onClick={() => setTag(tag, '')}
                      className="text-2xs text-chalk-dim underline-offset-2 hover:text-chalk hover:underline"
                    >
                      {copy.resetInherit}
                    </button>
                  )}
                </div>
              </div>
            )}
          </FieldRow>
        );
      })}
    </fieldset>
  );
}

/**
 * "Conectar a": o mesmo que arrastar a partir do recurso no canvas, para
 * quem usa o teclado. Só lista destinos que aceitam a conexão; escolher cria
 * a conexão e abre o inspetor dela.
 */
function ConnectToField({
  resource,
  resources,
  connections,
  language,
}: {
  resource: CloudResource;
  resources: CloudResource[];
  connections: CloudConnection[];
  language: AppLanguage;
}) {
  const dispatch = useAppDispatch();
  const copy = getCloudCopy(language).connectTo;
  const targets = resources.filter(
    (target) =>
      target.id !== resource.id &&
      canConnect(resources, connections, resource.id, target.id),
  );
  return (
    <FieldRow label={copy.label} help={copy.help}>
      {(id, describedBy) => (
        <select
          id={id}
          value=""
          aria-describedby={describedBy}
          disabled={targets.length === 0}
          onChange={(event) => {
            const target = event.target.value;
            if (target)
              dispatch(addCloudConnection({ source: resource.id, target }));
          }}
          className="field-sm"
        >
          <option value="">
            {targets.length > 0 ? copy.placeholder : copy.none}
          </option>
          {targets.map((target) => (
            <option key={target.id} value={target.id}>
              {target.name} ·{' '}
              {getCatalogEntry(target.type)?.label[language] ?? target.type}
            </option>
          ))}
        </select>
      )}
    </FieldRow>
  );
}

function FieldRow({
  label,
  help,
  error,
  children,
}: {
  label: string;
  help?: string;
  error?: string | null;
  children: (id: string, describedBy: string | undefined) => ReactNode;
}) {
  const id = useId();
  const helpId = help || error ? `${id}-help` : undefined;
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-xs font-medium text-chalk-dim"
      >
        {label}
      </label>
      {children(id, helpId)}
      {(error || help) && (
        <p
          id={helpId}
          role={error ? 'alert' : undefined}
          className={`mt-1 text-2xs leading-4 ${error ? 'text-signal-down' : 'text-chalk-faint'}`}
        >
          {error ?? help}
        </p>
      )}
    </div>
  );
}

function BooleanField({
  label,
  help,
  error,
  checked,
  onChange,
}: {
  label: string;
  help?: string;
  error?: string | null;
  checked: boolean;
  onChange: (value: unknown) => void;
}) {
  const helpId = useId();
  const note = error ?? help;
  return (
    <div>
      <label className="flex cursor-pointer items-center gap-2 text-xs text-chalk">
        <input
          type="checkbox"
          checked={checked}
          aria-describedby={note ? helpId : undefined}
          onChange={(event) => onChange(event.target.checked)}
          className="h-3.5 w-3.5 accent-accent"
        />
        {label}
      </label>
      {note && (
        <p
          id={helpId}
          role={error ? 'alert' : undefined}
          className={`mt-1 text-2xs leading-4 ${error ? 'text-signal-warn' : 'text-chalk-faint'}`}
        >
          {note}
        </p>
      )}
    </div>
  );
}

function FieldEditor({
  field,
  value,
  resource,
  resources,
  error,
  language,
  suggestions,
  onChange,
}: {
  field: CloudField;
  value: unknown;
  resource: CloudResource;
  resources: CloudResource[];
  /** Problema apontado pelo `validate` do catálogo para este campo. */
  error: string | null;
  language: AppLanguage;
  suggestions?: string[];
  onChange: (value: unknown) => void;
}) {
  const copy = getCloudCopy(language);
  const label = field.label[language];
  const help = field.help?.[language];

  switch (field.type) {
    case 'text': {
      const text = typeof value === 'string' ? value : '';
      const patternError =
        Boolean(text) && field.pattern && !field.pattern.test(text)
          ? copy.invalidFormat
          : null;
      const fieldError = patternError ?? (text ? error : null);
      const invalid = Boolean(fieldError);
      const capacity =
        field.capacity && !fieldError ? subnetCapacity(text) : null;
      const shownHelp =
        capacity && capacity.firstUsable && capacity.lastUsable
          ? copy.capacity(
              capacity.usable,
              capacity.firstUsable,
              capacity.lastUsable,
            )
          : help;
      return (
        <FieldRow label={label} help={shownHelp} error={fieldError}>
          {(id, describedBy) => {
            const input = (
              <input
                id={id}
                value={text}
                list={suggestions?.length ? `${id}-suggestions` : undefined}
                placeholder={field.placeholder}
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
                onChange={(event) => onChange(event.target.value)}
                className={`field-sm ${field.mono ? 'font-mono tabular-nums' : ''} ${invalid ? 'border-signal-down' : ''}`}
              />
            );
            if (suggestions?.length) {
              return (
                <>
                  {input}
                  <datalist id={`${id}-suggestions`}>
                    {suggestions.map((option) => (
                      <option key={option} value={option} />
                    ))}
                  </datalist>
                </>
              );
            }
            if (field.autofill) {
              const autofill = field.autofill;
              const suggestion = autofill(resources, resource);
              return (
                <div className="flex gap-1.5">
                  {input}
                  <button
                    type="button"
                    disabled={!suggestion || suggestion === text}
                    onClick={() => suggestion && onChange(suggestion)}
                    className="btn btn-secondary btn-sm shrink-0"
                    aria-label={`${copy.suggest}: ${label}${suggestion ? ` (${suggestion})` : ''}`}
                    title={suggestion ?? undefined}
                  >
                    <RefreshCw size={13} aria-hidden="true" />
                    {copy.suggest}
                  </button>
                </div>
              );
            }
            if (!field.generator) return input;
            const generator = field.generator;
            return (
              <div className="flex gap-1.5">
                {input}
                <button
                  type="button"
                  onClick={() => onChange(runIdGenerator(generator))}
                  className="btn btn-secondary btn-sm btn-icon shrink-0"
                  aria-label={`${copy.regenerate}: ${label}`}
                  title={copy.regenerate}
                >
                  <RefreshCw size={13} aria-hidden="true" />
                </button>
              </div>
            );
          }}
        </FieldRow>
      );
    }
    case 'number':
      return (
        <FieldRow label={label} help={help} error={error}>
          {(id, describedBy) => (
            <div className="flex items-center gap-2">
              <input
                id={id}
                type="number"
                value={typeof value === 'number' ? value : ''}
                min={field.min}
                max={field.max}
                step={field.step}
                aria-describedby={describedBy}
                onChange={(event) => {
                  const parsed = Number(event.target.value);
                  if (event.target.value === '' || Number.isNaN(parsed)) return;
                  const clamped = Math.min(
                    field.max ?? Infinity,
                    Math.max(field.min ?? -Infinity, parsed),
                  );
                  onChange(clamped);
                }}
                className="field-sm font-mono tabular-nums"
              />
              {field.unit && (
                <span className="font-mono text-2xs text-chalk-faint">
                  {field.unit}
                </span>
              )}
            </div>
          )}
        </FieldRow>
      );
    case 'boolean':
      return (
        <BooleanField
          label={label}
          help={help}
          error={error}
          checked={value === true}
          onChange={onChange}
        />
      );
    case 'select':
      return (
        <FieldRow label={label} help={help} error={error}>
          {(id, describedBy) =>
            field.optionsSource === 'awsRegions' ? (
              <RegionSelect
                id={id}
                describedBy={describedBy}
                value={value}
                language={language}
                onChange={onChange}
              />
            ) : field.optionsSource === 'ec2InstanceTypes' ||
              field.optionsSource === 'rdsInstanceClasses' ||
              field.optionsSource === 'auroraInstanceClasses' ||
              field.optionsSource === 'cacheNodeTypes' ? (
              <InstanceSelect
                id={id}
                describedBy={describedBy}
                value={value}
                source={field.optionsSource}
                resource={resource}
                resources={resources}
                language={language}
                onChange={onChange}
              />
            ) : field.optionsSource === 'vpcNacls' ? (
              <select
                id={id}
                value={typeof value === 'string' ? value : ''}
                aria-describedby={describedBy}
                onChange={(event) => onChange(event.target.value)}
                className="field-sm"
              >
                <option value="">{copy.naclDefault}</option>
                {resources
                  .filter(
                    (r) =>
                      r.type === NACL_TYPE &&
                      r.parentId === vpcOf(resources, resource.id)?.id,
                  )
                  .map((nacl) => (
                    <option key={nacl.id} value={nacl.id}>
                      {nacl.name}
                    </option>
                  ))}
              </select>
            ) : field.optionsSource === 'route53Zones' ||
              field.optionsSource === 'acmCertificates' ||
              field.optionsSource === 'wafAcls' ||
              field.optionsSource === 'kmsKeys' ||
              field.optionsSource === 'cognitoPools' ||
              field.optionsSource === 'clusters' ||
              field.optionsSource === 'ecrRepositories' ||
              field.optionsSource === 'sqsQueues' ||
              field.optionsSource === 'logGroups' ||
              field.optionsSource === 'snsTopics' ||
              field.optionsSource === 'projectBuckets' ? (
              <AssociationSelect
                id={id}
                describedBy={describedBy}
                value={value}
                source={field.optionsSource}
                resource={resource}
                resources={resources}
                language={language}
                onChange={onChange}
              />
            ) : field.optionsSource === 'awsZones' ? (
              <ZoneSelect
                id={id}
                describedBy={describedBy}
                value={value}
                resource={resource}
                resources={resources}
                language={language}
                onChange={onChange}
              />
            ) : (
              <select
                id={id}
                value={typeof value === 'string' ? value : ''}
                aria-describedby={describedBy}
                onChange={(event) => onChange(event.target.value)}
                className="field-sm"
              >
                {(field.options ?? []).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label[language]}
                  </option>
                ))}
              </select>
            )
          }
        </FieldRow>
      );
    case 'multi':
      return (
        <CheckList
          label={label}
          help={help}
          error={error}
          options={field.options.map((option) => ({
            id: option.value,
            label: option.label[language],
          }))}
          selected={readIdList(value)}
          onChange={onChange}
        />
      );
    case 'refs':
      return (
        <RefsEditor
          field={field}
          label={label}
          help={help}
          error={error}
          value={value}
          resource={resource}
          resources={resources}
          language={language}
          onChange={onChange}
        />
      );
    case 'iamTemplates':
      return (
        <IamTemplatePicker
          kind={field.kind}
          label={label}
          help={help}
          value={value}
          language={language}
          onChange={onChange}
        />
      );
    case 'list':
      return (
        <ListEditor
          label={label}
          items={
            Array.isArray(value)
              ? value.filter((v): v is string => typeof v === 'string')
              : []
          }
          placeholder={field.itemPlaceholder[language]}
          language={language}
          onChange={onChange}
        />
      );
  }
}

/** Zonas da região da AZ (`sa-east-1a`...); as usadas por outra AZ da mesma VPC vêm marcadas. */
function ZoneSelect({
  id,
  describedBy,
  value,
  resource,
  resources,
  language,
  onChange,
}: {
  id: string;
  describedBy: string | undefined;
  value: unknown;
  resource: CloudResource;
  resources: CloudResource[];
  language: AppLanguage;
  onChange: (value: unknown) => void;
}) {
  const copy = getCloudCopy(language);
  const region = regionCodeOf(resources, resource.id);
  const used = new Set(
    azsOf(resources, resource.parentId ?? '')
      .filter((az) => az.id !== resource.id)
      .map((az) => az.config.zone),
  );
  return (
    <select
      id={id}
      value={typeof value === 'string' ? value : ''}
      aria-describedby={describedBy}
      onChange={(event) => onChange(event.target.value)}
      className="field-sm font-mono"
    >
      {[
        ...(typeof value === 'string' &&
        value &&
        !regionZones(resources, resource.id).includes(value)
          ? [value]
          : []),
        ...regionZones(resources, resource.id),
      ].map((letter) => (
        <option key={letter} value={letter}>
          {region}
          {letter}
          {used.has(letter) ? ` (${copy.zoneInUse})` : ''}
        </option>
      ))}
    </select>
  );
}

/** Regiões comerciais; as que ainda não têm preço no banco cloud vêm marcadas. */
function RegionSelect({
  id,
  describedBy,
  value,
  language,
  onChange,
}: {
  id: string;
  describedBy: string | undefined;
  value: unknown;
  language: AppLanguage;
  onChange: (value: unknown) => void;
}) {
  const copy = getCloudCopy(language);
  const { data: meta } = useCloudPriceMetaQuery();
  const priced = new Set(
    (meta?.regions ?? [])
      .filter((r) => r.provider === 'AWS')
      .map((r) => r.region),
  );
  return (
    <select
      id={id}
      value={typeof value === 'string' ? value : ''}
      aria-describedby={describedBy}
      onChange={(event) => onChange(event.target.value)}
      className="field-sm font-mono"
    >
      {AWS_COMMERCIAL_REGIONS.map((region) => (
        <option key={region.code} value={region.code}>
          {region.code} — {region.name}
          {meta && !priced.has(region.code) ? ` (${copy.regionNoPrices})` : ''}
        </option>
      ))}
    </select>
  );
}

function ListEditor({
  label,
  items,
  placeholder,
  language,
  onChange,
}: {
  label: string;
  items: string[];
  placeholder: string;
  language: AppLanguage;
  onChange: (value: unknown) => void;
}) {
  const copy = getCloudCopy(language);
  const [draft, setDraft] = useState('');
  const inputId = useId();
  const add = () => {
    const value = draft.trim();
    if (!value || items.includes(value)) return;
    onChange([...items, value]);
    setDraft('');
  };
  return (
    <div>
      <label
        htmlFor={inputId}
        className="mb-1 block text-xs font-medium text-chalk-dim"
      >
        {label}
      </label>
      {items.length === 0 ? (
        <p className="mb-1.5 text-2xs text-chalk-faint">{copy.listEmpty}</p>
      ) : (
        <ul className="mb-1.5 flex flex-wrap gap-1">
          {items.map((item) => (
            <li key={item} className="chip">
              {item}
              <button
                type="button"
                onClick={() =>
                  onChange(items.filter((other) => other !== item))
                }
                aria-label={`${copy.listRemove} ${item}`}
                title={copy.listRemove}
                className="-mr-0.5 rounded-[2px] p-0.5 text-chalk-faint hover:bg-signal-down/15 hover:text-signal-down"
              >
                <X size={11} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-1.5">
        <input
          id={inputId}
          value={draft}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add();
            }
          }}
          className="field-sm"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="btn btn-secondary btn-sm btn-icon shrink-0"
          aria-label={`${copy.listAdd}: ${label}`}
          title={copy.listAdd}
        >
          <Plus size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
