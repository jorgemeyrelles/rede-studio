import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NetworkState } from '../network/types';
import { projectsRoutes } from '../../services/routes/projectsRoutes';
import type { CreateProjectInput } from './types';

export function projectsQueryKey(ownerId: string) {
  return ['projects', ownerId] as const;
}

/** Lista de projetos do dono logado — API é a fonte da verdade (ver projectsRoutes.ts). */
export function useProjectsQuery(ownerId: string | undefined) {
  return useQuery({
    queryKey: projectsQueryKey(ownerId ?? ''),
    queryFn: () => projectsRoutes.listProjectsByOwner(ownerId as string),
    enabled: Boolean(ownerId),
  });
}

/** Invalida qualquer `['projects', *]` em cache — mais simples que reconciliar item a item. */
function useInvalidateProjects() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['projects'] });
}

export function useCreateProjectMutation() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => projectsRoutes.createProject(input),
    onSuccess: invalidate,
  });
}

export function useRenameProjectMutation() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      projectsRoutes.renameProject(id, name),
    onSuccess: invalidate,
  });
}

export function useDeleteProjectMutation() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (id: string) => projectsRoutes.deleteProject(id),
    onSuccess: invalidate,
  });
}

export function useMigrateLegacyProjectMutation() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: () => projectsRoutes.migrateLegacyProjectIfNeeded(),
    onSuccess: (result) => {
      if (result) invalidate();
    },
  });
}

/**
 * Autosave (ver `features/network/useAutosave.ts`) — salva o snapshot da
 * topologia. Invalida `['projects']` só quando a API confirmou (`ok:
 * true`) pra manter o `updatedAt` do dashboard em dia sem refetch manual.
 */
export function useSaveProjectSnapshotMutation() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: ({
      id,
      networkState,
    }: {
      id: string;
      networkState: NetworkState;
    }) => projectsRoutes.saveProjectSnapshot(id, networkState),
    onSuccess: (result) => {
      if (result.ok) invalidate();
    },
  });
}
