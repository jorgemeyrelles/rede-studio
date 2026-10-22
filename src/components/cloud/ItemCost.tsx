import { AlertTriangle } from 'lucide-react';
import { useAppSelector } from '../../app/hooks';
import { useCloudCost } from '../../features/cloud/useCloudCost';
import type { AppLanguage } from '../../types/i18n';
import { getCloudCopy } from './cloudCopy';
import CurrencyToggle from './CurrencyToggle';
import { formatMoney } from './money';

/** "Custo do item" no inspetor: as linhas e o total mensal do elemento selecionado. */
export default function ItemCost({
  resourceId,
  language,
}: {
  resourceId: string;
  language: AppLanguage;
}) {
  const c = getCloudCopy(language).cost;
  const currency = useAppSelector((state) => state.cloud.assumptions.currency);
  const { estimate, loading } = useCloudCost();
  const lines = estimate.lines.filter((line) => line.resourceId === resourceId);
  const free = estimate.free.includes(resourceId);
  const value = (usd: number | null, brl: number | null) =>
    currency === 'BRL' ? brl : usd;
  const total = lines.reduce(
    (sum, line) => sum + (value(line.monthlyUsd, line.monthlyBrl) ?? 0),
    0,
  );

  return (
    <section aria-label={c.itemCost} className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-label text-chalk-faint">{c.itemCost}</h3>
        {!free && lines.length > 0 && (
          <CurrencyToggle language={language} compact />
        )}
      </div>
      {free ? (
        <p className="text-2xs leading-4 text-chalk-faint">{c.itemFree}</p>
      ) : loading ? (
        <p className="text-2xs text-chalk-faint">{c.loading}</p>
      ) : lines.length === 0 ? (
        <p className="text-2xs text-chalk-faint">{c.itemNone}</p>
      ) : (
        <dl className="space-y-1 text-xs">
          {lines.map((line, i) => {
            const monthly = value(line.monthlyUsd, line.monthlyBrl);
            return (
              <div
                key={i}
                className="flex items-baseline justify-between gap-3"
              >
                <dt
                  className="min-w-0 truncate text-chalk-dim"
                  title={line.item[language]}
                >
                  {line.item[language]}
                </dt>
                <dd className="shrink-0 font-mono tabular-nums text-chalk">
                  {monthly === null ? (
                    <span className="inline-flex items-center gap-1 text-signal-warn">
                      <AlertTriangle size={11} aria-hidden="true" />
                      {c.unpriced}
                    </span>
                  ) : (
                    formatMoney(monthly, currency, language)
                  )}
                </dd>
              </div>
            );
          })}
          <div className="flex items-baseline justify-between gap-3 border-t border-line pt-1">
            <dt className="font-medium text-chalk">{c.itemTotal}</dt>
            <dd className="font-mono font-semibold tabular-nums text-chalk">
              {formatMoney(total, currency, language)}
              <span className="ml-0.5 text-2xs font-normal text-chalk-dim">
                {c.perMonth}
              </span>
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}
