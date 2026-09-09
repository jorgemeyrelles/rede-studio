/** Idiomas suportados pelo app inteiro (rotas, Studio, auth). */
export type AppLanguage = 'pt' | 'en' | 'es';

export const SUPPORTED_LANGUAGES: AppLanguage[] = ['pt', 'en', 'es'];

export const DEFAULT_LANGUAGE: AppLanguage = 'pt';

export function isAppLanguage(value: string): value is AppLanguage {
  return SUPPORTED_LANGUAGES.includes(value as AppLanguage);
}
