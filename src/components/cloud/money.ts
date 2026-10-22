import type { CloudCurrency } from '../../features/cloud/types';
import type { AppLanguage } from '../../types/i18n';

export const NUMBER_LOCALE: Record<AppLanguage, string> = {
  pt: 'pt-BR',
  en: 'en-US',
  es: 'es',
};

/** Valor mensal: 2 casas. */
export function formatMoney(
  value: number,
  currency: CloudCurrency,
  language: AppLanguage,
) {
  return new Intl.NumberFormat(NUMBER_LOCALE[language], {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Preço unitário: até 8 casas (a requisição GET do S3 custa US$ 0,00000056). */
export function formatUnitPrice(
  value: number,
  currency: CloudCurrency,
  language: AppLanguage,
) {
  return new Intl.NumberFormat(NUMBER_LOCALE[language], {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  }).format(value);
}

export function formatQuantity(value: number, language: AppLanguage) {
  return new Intl.NumberFormat(NUMBER_LOCALE[language], {
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(
  iso: string | null | undefined,
  language: AppLanguage,
) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat(NUMBER_LOCALE[language], {
    dateStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(iso));
}
