import { isAppLanguage, type AppLanguage } from '../../types/i18n';

const LANGUAGE_STORAGE_KEY = 'rede-sp-cwb-language-v1';

export function loadStoredLanguage(): AppLanguage | null {
  try {
    const raw = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return raw && isAppLanguage(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function saveStoredLanguage(language: AppLanguage): void {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
}
