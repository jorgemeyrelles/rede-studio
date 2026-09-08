import {
    Link,
    Outlet,
    useLocation,
    useNavigate,
    useParams,
} from 'react-router-dom';
import {
    STUDIO_LANGUAGE_OPTIONS,
    type StudioLanguage,
} from '../components/studio/catalog';
import { replaceLangSegment } from '../app/routing/replaceLangSegment';
import BrandMark from '../components/BrandMark';
import { getLandingPageCopy } from '../i18n/utils';
import { servicesRoutes } from '../services';

export default function LandingPage() {
  const { lang } = useParams<{ lang: StudioLanguage }>();
  const language = lang ?? 'pt';
  const location = useLocation();
  const navigate = useNavigate();
  const copy = getLandingPageCopy(language);

  const handleLanguageChange = (nextLang: StudioLanguage) => {
    servicesRoutes.language.setStoredLanguage(nextLang);
    navigate(replaceLangSegment(location.pathname, nextLang));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5 text-xs font-semibold tracking-[0.2em] text-cyan-300 sm:text-sm">
            <BrandMark className="h-7 w-7" />
            {copy.brand}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-1 rounded-md border border-cyan-500/40 bg-cyan-500/10 p-1 sm:flex">
              {STUDIO_LANGUAGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleLanguageChange(option.value)}
                  aria-label={option.label}
                  title={option.label}
                  className={`rounded px-2 py-1 text-[11px] font-bold tracking-wide transition ${
                    option.value === language
                      ? 'bg-cyan-400/90 text-slate-950'
                      : 'bg-slate-800/80 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  {option.flag}
                </button>
              ))}
            </div>
            <Link
              to={`/${language}/login`}
              className="rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-200 transition hover:bg-slate-800"
            >
              {copy.ctaLogin}
            </Link>
            <Link
              to={`/${language}/register`}
              className="rounded-md bg-cyan-500 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-950 transition hover:bg-cyan-400"
            >
              {copy.ctaRegister}
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 pb-16 pt-16 text-center sm:pt-24">
          <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">
            {copy.tagline}
          </span>
          <h1 className="text-3xl font-bold leading-tight text-white sm:text-4xl md:text-5xl">
            {copy.heroTitle}{' '}
            <span className="text-cyan-300">{copy.heroTitleHighlight}</span>
          </h1>
          <p className="max-w-2xl text-sm text-slate-400 sm:text-base">
            {copy.heroSubtitle}
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              to={`/${language}/register`}
              className="rounded-md bg-cyan-500 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-950 transition hover:bg-cyan-400"
            >
              {copy.ctaRegister}
            </Link>
            <Link
              to={`/${language}/login`}
              className="rounded-md border border-slate-700 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-200 transition hover:bg-slate-800"
            >
              {copy.ctaLogin}
            </Link>
          </div>
        </section>

        <section className="border-t border-slate-800/80 bg-slate-900/40">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h2 className="mb-8 text-center text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              {copy.featuresTitle}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {copy.features.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-lg border border-slate-800 bg-slate-900 p-5 transition hover:border-cyan-700/60"
                >
                  <div className="mb-3 text-2xl">{feature.icon}</div>
                  <h3 className="mb-1.5 text-sm font-semibold text-slate-100">
                    {feature.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-slate-400">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800/80 px-4 py-8 text-center text-xs text-slate-500">
        {copy.footerNote}
      </footer>

      {/* /login e /register renderizam aqui como modal, sem trocar de página */}
      <Outlet />
    </div>
  );
}
