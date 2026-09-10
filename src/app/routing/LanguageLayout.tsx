import { useEffect } from 'react';
import { Navigate, Outlet, useParams } from 'react-router-dom';
import { servicesRoutes } from '../../services';
import { DEFAULT_LANGUAGE, isAppLanguage } from '../../types/i18n';

/**
 * Valida o segmento `:lang` da URL. Idioma inválido/ausente redireciona
 * pro idioma padrão. Idioma válido é lembrado (localStorage) pra próxima
 * visita via `/` (ver RootRedirect).
 */
export default function LanguageLayout() {
  const { lang } = useParams<{ lang: string }>();
  const validLang = lang && isAppLanguage(lang) ? lang : null;

  useEffect(() => {
    if (validLang) {
      servicesRoutes.language.setStoredLanguage(validLang);
    }
  }, [validLang]);

  if (!validLang) {
    return <Navigate to={`/${DEFAULT_LANGUAGE}`} replace />;
  }

  return <Outlet />;
}
