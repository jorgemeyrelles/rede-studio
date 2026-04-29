import { useEffect, useState } from 'react';
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import {
  getStudioAppCopy,
  STUDIO_LANGUAGE_OPTIONS,
  type StudioLanguage,
} from './components/studio/catalog';
import SlidesPage from './pages/SlidesPage';
import StudioPage from './pages/StudioPage';

export default function App() {
  const location = useLocation();
  const [studioLanguage, setStudioLanguage] = useState<StudioLanguage>('pt');
  const isStudioRoute = location.pathname.startsWith('/studio');
  const appCopy = getStudioAppCopy(studioLanguage);

  // Bloqueia ↑/↓ em todos os inputs numéricos do app
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      const t = e.target as HTMLElement;
      if (t instanceof HTMLInputElement && t.type === 'number') {
        e.preventDefault();
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3">
          <h1 className="flex items-center gap-3 text-sm font-semibold tracking-[0.2em] text-cyan-300">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 64 64"
              fill="none"
              className="h-8 w-8 flex-shrink-0 drop-shadow-[0_0_6px_rgba(56,189,248,0.5)]"
              aria-hidden="true"
            >
              <rect width="64" height="64" rx="12" fill="#0f172a" />
              <line
                x1="32"
                y1="14"
                x2="12"
                y2="38"
                stroke="#38bdf8"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.7"
              />
              <line
                x1="32"
                y1="14"
                x2="52"
                y2="38"
                stroke="#38bdf8"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.7"
              />
              <line
                x1="12"
                y1="38"
                x2="32"
                y2="52"
                stroke="#38bdf8"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.7"
              />
              <line
                x1="52"
                y1="38"
                x2="32"
                y2="52"
                stroke="#38bdf8"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.7"
              />
              <line
                x1="12"
                y1="38"
                x2="52"
                y2="38"
                stroke="#64748b"
                strokeWidth="1.5"
                strokeLinecap="round"
                opacity="0.5"
              />
              <circle
                cx="32"
                cy="14"
                r="6"
                fill="#0ea5e9"
                stroke="#7dd3fc"
                strokeWidth="1.5"
              />
              <circle
                cx="12"
                cy="38"
                r="5"
                fill="#6366f1"
                stroke="#a5b4fc"
                strokeWidth="1.5"
              />
              <circle
                cx="52"
                cy="38"
                r="5"
                fill="#6366f1"
                stroke="#a5b4fc"
                strokeWidth="1.5"
              />
              <circle
                cx="32"
                cy="52"
                r="4"
                fill="#10b981"
                stroke="#6ee7b7"
                strokeWidth="1.5"
              />
            </svg>
            {appCopy.headerTitle}
          </h1>
          <nav className="flex items-center gap-2">
            <NavLink
              to="/slides"
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
                  isActive
                    ? 'bg-cyan-500 text-slate-950'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`
              }
            >
              {appCopy.slides}
            </NavLink>
            <NavLink
              to="/studio"
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
                  isActive
                    ? 'bg-emerald-400 text-slate-950'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`
              }
            >
              {appCopy.studio}
            </NavLink>
            {isStudioRoute && (
              <div
                className="flex items-center gap-1 rounded-md border border-cyan-500/40 bg-cyan-500/10 p-1"
                aria-label={appCopy.languageAriaLabel}
                title={appCopy.languageAriaLabel}
              >
                {STUDIO_LANGUAGE_OPTIONS.map((option) => {
                  const isActive = option.value === studioLanguage;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setStudioLanguage(option.value)}
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
            )}
          </nav>
        </div>
      </header>

      <Routes>
        <Route path="/slides" element={<SlidesPage />} />
        <Route
          path="/studio"
          element={<StudioPage language={studioLanguage} />}
        />
        <Route path="*" element={<Navigate to="/studio" replace />} />
      </Routes>
    </div>
  );
}
