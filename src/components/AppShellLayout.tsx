import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
    getStudioAppCopy,
    STUDIO_LANGUAGE_OPTIONS,
    type StudioLanguage,
} from './studio/catalog';
import { replaceLangSegment } from '../app/routing/replaceLangSegment';
import BrandMark from './BrandMark';
import UserBadgeMenu from './UserBadgeMenu';
import { servicesRoutes } from '../services';

/**
 * Shell visual do app logado: header com título, nav e seletor de
 * idioma (agora navega trocando o segmento `:lang` da URL, em vez de só
 * trocar um estado local). Envolve as rotas autenticadas (dashboard,
 * Studio, Slides enquanto ainda existir).
 */
export default function AppShellLayout() {
  const { lang } = useParams<{ lang: StudioLanguage }>();
  const language = lang ?? 'pt';
  const location = useLocation();
  const navigate = useNavigate();
  const appCopy = getStudioAppCopy(language);

  const handleLanguageChange = (nextLang: StudioLanguage) => {
    servicesRoutes.language.setStoredLanguage(nextLang);
    navigate(replaceLangSegment(location.pathname, nextLang));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3">
          <h1 className="flex items-center gap-3 text-sm font-semibold tracking-[0.2em] text-cyan-300">
            <BrandMark className="h-8 w-8" />
            {appCopy.headerTitle}
          </h1>
          <nav className="flex items-center gap-2">
            <div
              className="flex items-center gap-1 rounded-md border border-cyan-500/40 bg-cyan-500/10 p-1"
              aria-label={appCopy.languageAriaLabel}
              title={appCopy.languageAriaLabel}
            >
              {STUDIO_LANGUAGE_OPTIONS.map((option) => {
                const isActive = option.value === language;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleLanguageChange(option.value)}
                    aria-label={option.label}
                    title={option.label}
                    className={`flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-bold tracking-wide transition ${
                      isActive
                        ? 'bg-cyan-400/90 text-slate-950'
                        : 'bg-slate-800/80 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    <img
                      src={option.flagSrc}
                      width={20}
                      height={15}
                      alt={option.label}
                      className="rounded-[1px] object-cover"
                    />
                    {option.flag}
                  </button>
                );
              })}
            </div>
            <UserBadgeMenu language={language} />
          </nav>
        </div>
      </header>

      <Outlet />
    </div>
  );
}
