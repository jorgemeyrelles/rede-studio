import { lazy, Suspense, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppDispatch } from '../app/hooks';
import { useSessionQuery } from '../features/auth/queries';
import { hydrateCloudState } from '../features/cloud/cloudSlice';
import { hydrateNetworkState } from '../features/network/networkSlice';
import type { ProjectNetworkType } from '../features/projects/types';
import { servicesRoutes } from '../services';
import type { AppLanguage } from '../types/i18n';
import { getStudioPageCopy } from '../components/studio/catalog';

// Cada Studio num chunk próprio: quem abre um projeto cloud não baixa o
// GoJS, e quem abre um on-prem não baixa o React Flow.
const StudioPage = lazy(() => import('./StudioPage'));
const CloudStudioPage = lazy(() => import('./CloudStudioPage'));

/**
 * Carrega o snapshot do projeto da rota (`:projectId`) antes de montar o
 * Studio certo pro tipo: `CLOUD` → slice `cloud` + `CloudStudioPage`; os
 * demais → slice `network` + `StudioPage`. Projeto inexistente ou de outro dono manda de
 * volta pro dashboard. O autosave (`features/network/useAutosave.ts`, dentro
 * de `StudioPage`) lê o `:projectId` direto da URL — não precisa de nenhum
 * estado "projeto ativo" espelhado aqui.
 */
export default function StudioProjectLoader() {
  const { lang, projectId } = useParams<{
    lang: AppLanguage;
    projectId: string;
  }>();
  const language = lang ?? 'pt';
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { data: currentUser } = useSessionQuery();
  const [loaded, setLoaded] = useState<{
    projectId: string;
    networkType: ProjectNetworkType;
  } | null>(null);

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

      // meta.projectName do snapshot pode estar desatualizado se o projeto
      // foi renomeado pelo dashboard depois do último autosave — o nome
      // em ProjectSummary é sempre a fonte da verdade.
      if (project.networkType === 'CLOUD') {
        dispatch(
          hydrateCloudState({
            ...project.cloudState,
            meta: { ...project.cloudState?.meta, projectName: project.name },
          }),
        );
      } else if (project.networkState) {
        dispatch(
          hydrateNetworkState({
            ...project.networkState,
            meta: { ...project.networkState.meta, projectName: project.name },
          }),
        );
      } else {
        navigate(`/${language}/projects`, { replace: true });
        return;
      }
      setLoaded({ projectId, networkType: project.networkType });
    });

    return () => {
      cancelled = true;
    };
  }, [projectId, currentUser, dispatch, navigate, language]);

  const spinner = (
    <div
      role="status"
      className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-sm text-chalk-dim"
    >
      <span
        className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-accent"
        aria-hidden="true"
      />
      {getStudioPageCopy(language).loadingProject}
    </div>
  );

  if (!loaded || loaded.projectId !== projectId) return spinner;

  return (
    <Suspense fallback={spinner}>
      {loaded.networkType === 'CLOUD' ? (
        <CloudStudioPage language={language} />
      ) : (
        <StudioPage language={language} />
      )}
    </Suspense>
  );
}
