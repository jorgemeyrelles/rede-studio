import type { AuthErrorCode } from '../features/auth/types';
import type { AppLanguage } from '../types/i18n';
import {
    AUTH_ERROR_COPY,
    LANDING_PAGE_COPY,
    LOGIN_PAGE_COPY,
    PROJECTS_PAGE_COPY,
    REGISTER_PAGE_COPY,
    SETTINGS_MODAL_COPY,
    USER_MENU_COPY,
} from './constants';

export function getLandingPageCopy(language: AppLanguage) {
  return LANDING_PAGE_COPY[language];
}

export function getLoginPageCopy(language: AppLanguage) {
  return LOGIN_PAGE_COPY[language];
}

export function getRegisterPageCopy(language: AppLanguage) {
  return REGISTER_PAGE_COPY[language];
}

export function getProjectsPageCopy(language: AppLanguage) {
  return PROJECTS_PAGE_COPY[language];
}

export function getUserMenuCopy(language: AppLanguage) {
  return USER_MENU_COPY[language];
}

export function getSettingsModalCopy(language: AppLanguage) {
  return SETTINGS_MODAL_COPY[language];
}

export function getAuthErrorMessage(
  code: AuthErrorCode,
  language: AppLanguage,
): string {
  return AUTH_ERROR_COPY[language][code];
}
