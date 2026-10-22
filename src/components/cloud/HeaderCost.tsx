import { AlertTriangle } from 'lucide-react';
import { useAppSelector } from '../../app/hooks';
import { useCloudCost } from '../../features/cloud/useCloudCost';
import type { AppLanguage } from '../../types/i18n';
import { getCloudCopy } from './cloudCopy';
import { formatMoney } from './money';

/** Total mensal estimado no cabeçalho do Studio Cloud (detalhe na aba "Custo estimado"). */
export default function HeaderCost({ language }: { language: AppLanguage }) {
  const c = getCloudCopy(language).cost;
  const currency = useAppSelector((state) => state.cloud.assumptions.currency);
  const { estimate, loading } = useCloudCost();
  if (estimate.lines.length === 0) return null;
  const total = currency === 'BRL' ? estimate.total.brl : estimate.total.usd;
  return (
    <p
      className="flex items-baseline gap-1.5 rounded-sm border border-line px-2.5 py-1 text-xs"
      title={
        estimate.unpricedCount
          ? c.unpricedWarning(estimate.unpricedCount)
          : c.total
      }
    >
      <span className="text-chalk-dim">{c.headerEstimate}</span>
      <span className="font-mono font-semibold tabular-nums text-chalk">
        {loading ? '…' : formatMoney(total, currency, language)}
      </span>
      <span className="text-2xs text-chalk-faint">{c.perMonth}</span>
      {estimate.unpricedCount > 0 && (
        <AlertTriangle
          size={12}
          aria-label={c.unpricedWarning(estimate.unpricedCount)}
          className="self-center text-signal-warn"
        />
      )}
    </p>
  );
}
