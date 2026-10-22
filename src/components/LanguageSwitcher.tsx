import { useLocation, useNavigate } from 'react-router-dom';
import { replaceLangSegment } from '../app/routing/replaceLangSegment';
import { servicesRoutes } from '../services';
import type { AppLanguage } from '../types/i18n';
import { STUDIO_LANGUAGE_OPTIONS } from './studio/catalog';

/**
 * Seletor de idioma do chrome do app (Landing e header logado). Troca o
 * segmento `:lang` da URL e grava a preferência local. Controle segmentado
 * compacto (PT/EN/ES) — cabe também no header mobile.
 */
export default function LanguageSwitcher({
  language,
  ariaLabel,
}: {
  language: AppLanguage;
  ariaLabel: string;
}) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleChange = (nextLang: AppLanguage) => {
    servicesRoutes.language.setStoredLanguage(nextLang);
    navigate(replaceLangSegment(location.pathname, nextLang));
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex h-8 items-center rounded-sm border border-line bg-ink p-0.5"
    >
      {STUDIO_LANGUAGE_OPTIONS.map((option) => {
        const isActive = option.value === language;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => handleChange(option.value)}
            aria-label={option.label}
            title={option.label}
            className={`flex h-full items-center rounded-[1px] px-2 font-mono text-2xs font-medium transition-colors ${
              isActive
                ? 'bg-accent text-accent-ink'
                : 'text-chalk-dim hover:bg-ink-raised-2 hover:text-chalk'
            }`}
          >
            {option.flag}
          </button>
        );
      })}
    </div>
  );
}
