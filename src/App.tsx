import { useState } from 'react';
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3">
          <h1 className="text-sm font-semibold tracking-[0.2em] text-cyan-300">
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
                      className={`rounded px-2 py-1 text-sm transition ${
                        isActive
                          ? 'bg-cyan-400/90 text-slate-950'
                          : 'bg-slate-800/80 text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      <span aria-hidden="true">{option.flag}</span>
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
        <Route path="*" element={<Navigate to="/slides" replace />} />
      </Routes>
    </div>
  );
}
