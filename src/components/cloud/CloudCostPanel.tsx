import { AlertTriangle, Download } from 'lucide-react';
import { useId } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { updateCloudAssumptions } from '../../features/cloud/cloudSlice';
import {
  costCsv,
  type CostLine,
  type CostTotals,
} from '../../features/cloud/engines/cost';
import { useCloudCost } from '../../features/cloud/useCloudCost';
import type { AppLanguage } from '../../types/i18n';
import { getCloudCopy } from './cloudCopy';
import CurrencyToggle from './CurrencyToggle';
import {
  formatDate,
  formatMoney,
  formatQuantity,
  formatUnitPrice,
  NUMBER_LOCALE,
} from './money';

/**
 * Aba "Custo estimado" (substitui a de equipamentos do on-prem): linhas do
 * motor de custo (`engines/cost.ts`) com a moeda escolhida, premissas
 * editáveis, subtotais por serviço, região e camada, itens sem preço
 * marcados, CSV com as duas moedas e o rodapé com data dos preços e PTAX.
 */
export default function CloudCostPanel({
  language,
}: {
  language: AppLanguage;
}) {
  const dispatch = useAppDispatch();
  const copy = getCloudCopy(language);
  const c = copy.cost;
  const { resources, assumptions, meta } = useAppSelector(
    (state) => state.cloud,
  );
  const { estimate, catalogs, regions, loading, failed } = useCloudCost();
  const currency = assumptions.currency;
  const pick = (t: CostTotals) => (currency === 'BRL' ? t.brl : t.usd);
  const money = (value: number) => formatMoney(value, currency, language);
  const name = (id: string | null) =>
    resources.find((r) => r.id === id)?.name ?? '—';
  const ids = { hours: useId(), egress: useId(), interAz: useId() };

  const setAssumption = (
    key: 'hoursPerMonth' | 'internetEgressGbMonth' | 'interAzGbMonth',
    value: string,
  ) => {
    const parsed = Number(value);
    if (value === '' || Number.isNaN(parsed) || parsed < 0) return;
    dispatch(
      updateCloudAssumptions({
        [key]: key === 'hoursPerMonth' ? Math.min(744, parsed) : parsed,
      }),
    );
  };

  function exportCsv() {
    const blob = new Blob([costCsv(estimate, resources, language)], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(meta.projectName || 'rede-studio').replace(/[^\w-]+/g, '-').toLowerCase()}-custo.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (estimate.lines.length === 0 && !loading) {
    return <p className="px-4 py-6 text-xs text-chalk-faint">{c.empty}</p>;
  }

  // Linhas do recurso juntas; transferências e premissas globais no fim.
  const order = new Map(resources.map((r, i) => [r.id, i]));
  const lines = [...estimate.lines].sort(
    (a, b) =>
      (order.get(a.resourceId ?? '') ?? 1e9) -
      (order.get(b.resourceId ?? '') ?? 1e9),
  );
  const loaded = regions
    .map((r) => catalogs[r])
    .filter((cat) => cat && cat.items.length > 0);
  const layerName = (key: string) =>
    key === 'transfer'
      ? c.transferLayer
      : `L${key} · ${copy.layers[Number(key)]}`;
  const freeNames = estimate.free.map(name);

  const summary = (title: string, entries: [string, CostTotals][]) => (
    <section aria-label={title} className="min-w-0">
      <h3 className="text-label mb-1.5 text-chalk-faint">{title}</h3>
      <ul className="space-y-1">
        {entries
          .filter(([, t]) => t.usd > 0)
          .sort((a, b) => pick(b[1]) - pick(a[1]))
          .map(([label, t]) => (
            <li
              key={label}
              className="flex items-baseline justify-between gap-3 text-xs"
            >
              <span className="truncate text-chalk-dim">{label}</span>
              <span className="font-mono tabular-nums text-chalk">
                {money(pick(t))}
              </span>
            </li>
          ))}
      </ul>
    </section>
  );

  return (
    <div className="space-y-4 px-3 pt-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-2xs text-chalk-dim">{c.currency}</span>
            <CurrencyToggle language={language} />
          </div>
          <fieldset className="flex flex-wrap items-end gap-3">
            <legend className="sr-only">{c.assumptions}</legend>
            {(
              [
                ['hoursPerMonth', ids.hours, c.hours],
                ['internetEgressGbMonth', ids.egress, c.egress],
                ['interAzGbMonth', ids.interAz, c.interAz],
              ] as const
            ).map(([key, id, label]) => (
              <label
                key={key}
                htmlFor={id}
                className="flex flex-col gap-1 text-2xs text-chalk-dim"
              >
                {label}
                <input
                  id={id}
                  type="number"
                  min={0}
                  value={assumptions[key]}
                  onChange={(e) => setAssumption(key, e.target.value)}
                  className="field-sm w-32 font-mono tabular-nums"
                />
              </label>
            ))}
            <label className="flex min-h-8 cursor-pointer items-center gap-2 text-2xs text-chalk-dim">
              <input
                type="checkbox"
                checked={assumptions.freeTierEgress !== false}
                onChange={(e) =>
                  dispatch(
                    updateCloudAssumptions({
                      freeTierEgress: e.target.checked,
                    }),
                  )
                }
                className="h-3.5 w-3.5 accent-accent"
              />
              {c.freeTier}
            </label>
          </fieldset>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="btn btn-secondary btn-sm"
        >
          <Download size={13} aria-hidden="true" />
          {c.exportCsv}
        </button>
      </div>

      <div className="grid gap-4 rounded-sm border border-line bg-ink p-3 md:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,1fr))]">
        <div>
          <p className="text-label text-chalk-faint">{c.total}</p>
          <p
            className="mt-1 font-mono text-title font-bold tabular-nums text-chalk"
            aria-live="polite"
          >
            {loading ? c.loading : `${money(pick(estimate.total))}`}
            {!loading && (
              <span className="ml-1 text-xs font-normal text-chalk-dim">
                {c.perMonth}
              </span>
            )}
          </p>
          {estimate.unpricedCount > 0 && (
            <p className="mt-1.5 flex items-start gap-1.5 text-2xs leading-4 text-signal-warn">
              <AlertTriangle
                size={12}
                aria-hidden="true"
                className="mt-0.5 shrink-0"
              />
              {c.unpricedWarning(estimate.unpricedCount)}
            </p>
          )}
          {failed && (
            <p className="mt-1.5 text-2xs text-signal-down">{c.failed}</p>
          )}
        </div>
        {summary(
          c.byService,
          Object.entries(estimate.byService).map(([k, t]) => [
            c.services[k as keyof typeof c.services],
            t,
          ]),
        )}
        {summary(c.byRegion, Object.entries(estimate.byRegion))}
        {summary(
          c.byLayer,
          Object.entries(estimate.byLayer).map(([k, t]) => [layerName(k), t]),
        )}
      </div>

      <div className="relative overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col" className="text-left">
                {c.columns.resource}
              </th>
              <th scope="col" className="text-left">
                {c.columns.region}
              </th>
              <th scope="col" className="text-left">
                {c.columns.service}
              </th>
              <th scope="col" className="text-left">
                {c.columns.item}
              </th>
              <th scope="col" className="text-left">
                {c.columns.unit}
              </th>
              <th scope="col" className="text-right">
                {c.columns.quantity}
              </th>
              <th scope="col" className="text-right">
                {c.columns.unitPrice}
              </th>
              <th scope="col" className="text-right">
                {c.columns.monthly}
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line: CostLine, i) => {
              const first =
                i === 0 || lines[i - 1].resourceId !== line.resourceId;
              const unit = currency === 'BRL' ? line.unitBrl : line.unitUsd;
              const monthly =
                currency === 'BRL' ? line.monthlyBrl : line.monthlyUsd;
              return (
                <tr
                  key={`${line.resourceId}-${i}`}
                  className={
                    line.status === 'unpriced' ? 'text-chalk-faint' : ''
                  }
                >
                  <td className="whitespace-nowrap text-chalk">
                    {first
                      ? line.resourceId
                        ? name(line.resourceId)
                        : c.shared
                      : ''}
                  </td>
                  <td className="whitespace-nowrap font-mono">{line.region}</td>
                  <td className="whitespace-nowrap">
                    {c.services[line.service]}
                  </td>
                  <td className="whitespace-nowrap">{line.item[language]}</td>
                  <td className="whitespace-nowrap font-mono">{line.unit}</td>
                  <td className="text-right font-mono tabular-nums">
                    {formatQuantity(line.quantity, language)}
                  </td>
                  <td className="whitespace-nowrap text-right font-mono tabular-nums">
                    {unit === null
                      ? '—'
                      : formatUnitPrice(unit, currency, language)}
                  </td>
                  <td className="whitespace-nowrap text-right font-mono tabular-nums text-chalk">
                    {monthly === null ? (
                      <span className="inline-flex items-center gap-1 text-signal-warn">
                        <AlertTriangle size={12} aria-hidden="true" />
                        {c.unpriced}
                      </span>
                    ) : (
                      money(monthly)
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th
                scope="row"
                colSpan={7}
                className="border-t border-line text-right"
              >
                {c.total}
              </th>
              <td className="border-t border-line text-right font-mono font-semibold tabular-nums text-chalk">
                {money(pick(estimate.total))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {freeNames.length > 0 && (
        <p className="text-2xs leading-4 text-chalk-dim">
          <span className="text-chalk">{c.free}:</span> {freeNames.join(', ')}.
        </p>
      )}
      <footer className="space-y-0.5 border-t border-line pt-2 text-2xs leading-4 text-chalk-faint">
        {loaded.length > 0 && (
          <p>
            {c.footerPrices(
              formatDate(loaded[0]!.updatedAt, language),
              loaded
                .map(
                  (cat) =>
                    `${cat!.region}${cat!.regionName ? `, ${cat!.regionName}` : ''}`,
                )
                .join(' · '),
            )}{' '}
            {loaded[0]!.fxRate !== null &&
              c.footerFx(
                new Intl.NumberFormat(NUMBER_LOCALE[language], {
                  minimumFractionDigits: 4,
                }).format(loaded[0]!.fxRate),
                formatDate(loaded[0]!.fxQuotedAt, language),
              )}
          </p>
        )}
        <p>{c.notIncluded}</p>
      </footer>
    </div>
  );
}
