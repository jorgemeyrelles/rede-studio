import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { hydrateNetworkState } from '../features/network/networkSlice';
import { setActiveProjectId } from '../features/projects/projectsSlice';
import { servicesRoutes } from '../services';
import type { AppLanguage } from '../types/i18n';
import StudioPage from './StudioPage';

/**
 * Carrega o snapshot do projeto da rota (`:projectId`) pro slice
 * `network` antes de montar o Studio, e marca esse projeto como "ativo"
 * pro autosave (ver app/store.ts) saber em qual slot gravar. Projeto
 * inexistente ou de outro dono manda de volta pro dashboard.
 */
export default function StudioProjectLoader() {
  const { lang, projectId } = useParams<{
    lang: AppLanguage;
    projectId: string;
  }>();
  const language = lang ?? 'pt';
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const currentUser = useAppSelector((state) => state.auth.currentUser);
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId || !currentUser) return;
    let cancelled = false;

    servicesRoutes.projects.getProject(projectId).then((project) => {
      if (cancelled) return;

      // O 404 da API já garante posse no caminho normal — essa checagem de
      // ownerId só importa quando `getProject` cai pro fallback local (API
      // fora do ar), onde o cache do browser não é escopado por sessão.
      if (!project || project.ownerId !== currentUser.id) {
        navigate(`/${language}/projects`, { replace: true });
        return;
      }

      dispatch(setActiveProjectId(projectId));
      // meta.projectName do snapshot pode estar desatualizado se o projeto
      // foi renomeado pelo dashboard depois do último autosave — o nome
      // em ProjectSummary é sempre a fonte da verdade.
      dispatch(
        hydrateNetworkState({
          ...project.networkState,
          meta: { ...project.networkState.meta, projectName: project.name },
        }),
      );
      setLoadedProjectId(projectId);
    });

    return () => {
      cancelled = true;
      dispatch(setActiveProjectId(null));
    };
  }, [projectId, currentUser, dispatch, navigate, language]);

  if (loadedProjectId !== projectId) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        ...
      </div>
    );
  }

  return <StudioPage language={language} />;
}
