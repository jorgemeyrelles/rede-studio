import {
  FileText,
  Hash,
  Radio,
  Route,
  ShieldCheck,
  Waypoints,
  type LucideIcon,
} from 'lucide-react';
import { Link, Outlet, useParams } from 'react-router-dom';
import BrandMark from '../components/BrandMark';
import LanguageSwitcher from '../components/LanguageSwitcher';
import {
  getStudioAppCopy,
  type StudioLanguage,
} from '../components/studio/catalog';
import type { LandingFeatureIcon } from '../i18n/types';
import { getLandingPageCopy } from '../i18n/utils';

const FEATURE_ICONS: Record<LandingFeatureIcon, LucideIcon> = {
  diagram: Waypoints,
  routes: Route,
  firewall: ShieldCheck,
  addressing: Hash,
  protocols: Radio,
  report: FileText,
};

export default function LandingPage() {
  const { lang } = useParams<{ lang: StudioLanguage }>();
  const language = lang ?? 'pt';
  const copy = getLandingPageCopy(language);
  const appCopy = getStudioAppCopy(language);

  return (
    <div className="bg-blueprint flex min-h-screen flex-col text-chalk">
      <header className="border-b border-line bg-ink">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <span className="flex items-center gap-2.5 font-display text-xs font-bold uppercase tracking-[0.16em] text-accent sm:text-sm">
            <BrandMark className="h-7 w-7" />
            {copy.brand}
          </span>
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSwitcher
              language={language}
              ariaLabel={appCopy.languageAriaLabel}
            />
            <Link
              to={`/${language}/login`}
              className="btn btn-ghost btn-md hidden sm:inline-flex"
            >
              {copy.ctaLogin}
            </Link>
            <Link
              to={`/${language}/register`}
              className="btn btn-primary btn-md hidden sm:inline-flex"
            >
              {copy.ctaRegister}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <section className="mx-auto flex max-w-4xl flex-col items-center px-4 pb-16 pt-16 text-center sm:px-6 sm:pb-24 sm:pt-24">
          <h1 className="max-w-3xl text-balance font-display text-display font-extrabold text-chalk">
            {copy.heroTitle}{' '}
            <span className="text-accent">{copy.heroTitleHighlight}</span>
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-base leading-relaxed text-chalk-dim sm:text-lg">
            {copy.heroSubtitle}
          </p>
          <div className="mt-8 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
            <Link
              to={`/${language}/register`}
              className="btn btn-primary btn-md h-11 px-6 text-sm"
            >
              {copy.ctaRegister}
            </Link>
            <Link
              to={`/${language}/login`}
              className="btn btn-secondary btn-md h-11 px-6 text-sm"
            >
              {copy.ctaLogin}
            </Link>
          </div>
          <p className="mt-6 text-sm text-chalk-faint">{copy.tagline}</p>
        </section>

        <section className="flex-1 border-t border-line bg-ink">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="font-display text-title font-bold text-chalk">
              {copy.featuresTitle}
            </h2>
            <ul className="mt-8 grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {copy.features.map((feature) => {
                const Icon = FEATURE_ICONS[feature.icon];
                return (
                  <li key={feature.title} className="flex gap-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-line text-accent">
                      <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <div className="flex flex-col gap-1">
                      <h3 className="font-display text-heading font-semibold text-chalk">
                        {feature.title}
                      </h3>
                      <p className="text-sm leading-relaxed text-chalk-dim">
                        {feature.description}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-ink">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-chalk-faint sm:px-6">
          <span className="flex items-center gap-2">
            <BrandMark className="h-5 w-5" />
            {copy.brand}
          </span>
          <span>{copy.footerNote}</span>
        </div>
      </footer>

      {/* /login e /register renderizam aqui como modal, sem trocar de página */}
      <Outlet />
    </div>
  );
}
