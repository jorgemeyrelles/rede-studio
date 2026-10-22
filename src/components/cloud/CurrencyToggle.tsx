import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { setCloudCurrency } from '../../features/cloud/cloudSlice';
import type { CloudCurrency } from '../../features/cloud/types';
import type { AppLanguage } from '../../types/i18n';
import { getCloudCopy } from './cloudCopy';

/** Alternância USD ⇄ BRL (também usada no inspetor): só muda a apresentação. */
export default function CurrencyToggle({
  language,
  compact = false,
}: {
  language: AppLanguage;
  compact?: boolean;
}) {
  const dispatch = useAppDispatch();
  const copy = getCloudCopy(language).cost;
  const currency = useAppSelector((state) => state.cloud.assumptions.currency);
  return (
    <div
      role="group"
      aria-label={copy.currency}
      className="inline-flex rounded-sm border border-line bg-ink p-0.5"
    >
      {(['USD', 'BRL'] as CloudCurrency[]).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={currency === option}
          onClick={() => dispatch(setCloudCurrency(option))}
          className={`rounded-[1px] font-mono font-medium transition-colors ${compact ? 'px-2 py-0.5 text-2xs' : 'px-2.5 py-1 text-xs'} ${
            currency === option
              ? 'bg-ink-raised-2 text-chalk'
              : 'text-chalk-dim hover:text-chalk'
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
