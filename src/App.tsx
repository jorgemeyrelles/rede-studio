import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import LanguageLayout from './app/routing/LanguageLayout';
import RequireAuth from './app/routing/RequireAuth';
import RequireGuest from './app/routing/RequireGuest';
import RootRedirect from './app/routing/RootRedirect';
import AppShellLayout from './components/AppShellLayout';
import LandingPage from './pages/LandingPage';
import LoginModal from './pages/LoginModal';
import ProjectsPage from './pages/ProjectsPage';
import RegisterModal from './pages/RegisterModal';
// Fase 8 (sprint contas/projetos): acesso à apresentação de slides
// desativado — o app agora é só o Studio, logado. Código de
// SlidesPage/NavBar/SlideArrows permanece no repo, só sem rota.
// import SlidesPage from './pages/SlidesPage';
import StudioProjectLoader from './pages/StudioProjectLoader';

export default function App() {
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
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path=":lang" element={<LanguageLayout />}>
        <Route element={<RequireGuest />}>
          <Route element={<LandingPage />}>
            {/* login/register renderizam como modal sobre a Landing (ver LandingPage's Outlet) */}
            <Route index element={null} />
            <Route path="login" element={<LoginModal />} />
            <Route path="register" element={<RegisterModal />} />
          </Route>
        </Route>
        <Route element={<RequireAuth />}>
          <Route element={<AppShellLayout />}>
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="studio/:projectId" element={<StudioProjectLoader />} />
            {/* <Route path="slides" element={<SlidesPage />} /> */}
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="." replace />} />
      </Route>
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}
