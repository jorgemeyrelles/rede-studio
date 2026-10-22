import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import { getStudioAppCopy, type StudioLanguage } from './studio/catalog';
import BrandMark from './BrandMark';
import LanguageSwitcher from './LanguageSwitcher';
import UserBadgeMenu from './UserBadgeMenu';

/**
 * Shell visual do app logado: header com a marca (leva a "Meus projetos"),
 * seletor de idioma e menu do usuário. Envolve as rotas autenticadas
 * (dashboard e Studio).
 */
export default function AppShellLayout() {
  const { lang } = useParams<{ lang: StudioLanguage }>();
  const language = lang ?? 'pt';
  const appCopy = getStudioAppCopy(language);
  // O header alinha com a coluna de conteúdo da rota: dashboard usa o
  // container de 6xl; o Studio usa a largura cheia (1600px).
  const isStudio = useLocation().pathname.includes('/studio/');

  return (
    <div className="bg-blueprint min-h-screen text-chalk">
      <header className="sticky top-0 z-20 border-b border-line bg-ink">
        <div
          className={`mx-auto flex h-14 items-center justify-between gap-4 px-4 ${
            isStudio ? 'max-w-[1600px]' : 'max-w-6xl sm:px-6'
          }`}
        >
          <Link
            to={`/${language}/projects`}
            className="flex items-center gap-2.5 rounded-sm font-display text-sm font-bold uppercase tracking-[0.16em] text-accent"
          >
            <BrandMark className="h-7 w-7" />
            {appCopy.headerTitle}
          </Link>
          <nav className="flex items-center gap-3">
            <LanguageSwitcher
              language={language}
              ariaLabel={appCopy.languageAriaLabel}
            />
            <UserBadgeMenu language={language} />
          </nav>
        </div>
      </header>

      <Outlet />
    </div>
  );
}
