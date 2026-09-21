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

/** CTA cheia — ver .btn-planta-solid em src/styles/global.css. */
const CTA_SOLID_CLASS = 'btn-planta-solid rounded-sm';

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
    <div className="bg-blueprint min-h-screen text-chalk">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5 text-xs font-semibold tracking-[0.2em] text-accent sm:text-sm">
            <BrandMark className="h-7 w-7" />
            {copy.brand}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-1 rounded-sm border border-line bg-ink-raised p-1 sm:flex">
              {STUDIO_LANGUAGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleLanguageChange(option.value)}
                  aria-label={option.label}
                  title={option.label}
                  className={`rounded-sm px-2 py-1 text-[11px] font-bold tracking-wide transition ${
                    option.value === language
                      ? 'bg-accent text-accent-ink'
                      : 'bg-ink-raised-2 text-chalk-dim hover:bg-ink-raised'
                  }`}
                >
                  {option.flag}
                </button>
              ))}
            </div>
            <Link
              to={`/${language}/login`}
              className="rounded-sm px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-chalk-dim transition hover:bg-ink-raised hover:text-chalk"
            >
              {copy.ctaLogin}
            </Link>
            <Link
              to={`/${language}/register`}
              className={`${CTA_SOLID_CLASS} px-3 py-1.5 text-xs font-semibold uppercase tracking-wider`}
            >
              {copy.ctaRegister}
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 pb-16 pt-16 text-center sm:pt-24">
          <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-chalk-faint">
            {copy.tagline}
          </span>
          <h1 className="text-3xl font-bold leading-tight text-chalk sm:text-4xl md:text-5xl">
            {copy.heroTitle}{' '}
            <span className="bg-[linear-gradient(120deg,var(--accent),var(--accent-2))] bg-clip-text text-transparent">
              {copy.heroTitleHighlight}
            </span>
          </h1>
          <p className="max-w-2xl text-sm text-chalk-dim sm:text-base">
            {copy.heroSubtitle}
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              to={`/${language}/register`}
              className={`${CTA_SOLID_CLASS} px-6 py-3 text-xs font-semibold uppercase tracking-wider`}
            >
              {copy.ctaRegister}
            </Link>
            <Link
              to={`/${language}/login`}
              className="rounded-sm border border-line px-6 py-3 text-xs font-semibold uppercase tracking-wider text-chalk-dim transition hover:bg-ink-raised hover:text-chalk"
            >
              {copy.ctaLogin}
            </Link>
          </div>
        </section>

        <section className="border-t border-line bg-ink-raised">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h2 className="mb-8 text-center text-xs font-semibold uppercase tracking-[0.25em] text-chalk-faint">
              {copy.featuresTitle}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {copy.features.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-sm border border-line bg-ink-raised-2 p-5 transition hover:border-accent"
                >
                  <div className="mb-3 text-2xl">{feature.icon}</div>
                  <h3 className="mb-1.5 text-sm font-semibold text-chalk">
                    {feature.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-chalk-dim">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line px-4 py-8 text-center text-xs text-chalk-faint">
        {copy.footerNote}
      </footer>

      {/* /login e /register renderizam aqui como modal, sem trocar de página */}
      <Outlet />
    </div>
  );
}
