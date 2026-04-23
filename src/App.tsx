import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import SlidesPage from './pages/SlidesPage';
import StudioPage from './pages/StudioPage';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3">
          <h1 className="text-sm font-semibold tracking-[0.2em] text-cyan-300">
            REDE SP-CWB STUDIO
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
              Slides
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
              Studio
            </NavLink>
          </nav>
        </div>
      </header>

      <Routes>
        <Route path="/slides" element={<SlidesPage />} />
        <Route path="/studio" element={<StudioPage />} />
        <Route path="*" element={<Navigate to="/slides" replace />} />
      </Routes>
    </div>
  );
}
