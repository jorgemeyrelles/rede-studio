import { Navigate } from 'react-router-dom';
import { servicesRoutes } from '../../services';
import { DEFAULT_LANGUAGE, isAppLanguage } from '../../types/i18n';

function detectBrowserLanguage(): string {
  if (typeof navigator === 'undefined') return DEFAULT_LANGUAGE;
  return navigator.language.slice(0, 2).toLowerCase();
}

/** `/` sem idioma: usa a preferência salva, senão o idioma do navegador, senão o padrão. */
export default function RootRedirect() {
  const stored = servicesRoutes.language.getStoredLanguage();
  const browser = detectBrowserLanguage();
  const lang = stored ?? (isAppLanguage(browser) ? browser : DEFAULT_LANGUAGE);

  return <Navigate to={`/${lang}`} replace />;
}
