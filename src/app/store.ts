import {
    configureStore,
    createAction,
    type Dispatch,
    type Middleware,
    type UnknownAction,
} from '@reduxjs/toolkit';
import authReducer, {
    hydrateSession,
    loginUser,
    registerUser,
} from '../features/auth/authSlice';
import networkReducer, {
    markSaved,
    setPersistWarning,
    setSaveStatus,
} from '../features/network/networkSlice';
import type { NetworkState } from '../features/network/types';
import projectsReducer from '../features/projects/projectsSlice';
import { servicesRoutes } from '../services';
import { identifyClarityUser } from '../services/observability/clarity';

/** Dispara o save do projeto ativo imediatamente, sem esperar o debounce. */
export const requestImmediateSave = createAction('network/requestImmediateSave');

// Ações que o próprio ciclo de save dispara — reagir a elas de novo
// causaria um loop (salvar → marca salvo → dispara save de novo → ...).
// hydrateNetworkState também é ignorada: é carga inicial, não edição do
// usuário, não faz sentido re-salvar o que acabou de ser lido.
const AUTOSAVE_IGNORED_ACTIONS = new Set([
  'network/markSaved',
  'network/setPersistWarning',
  'network/setSaveStatus',
  'network/hydrateNetworkState',
]);

const DEBOUNCE_MS = 350;
// Duração mínima visível do estado "salvando" — sem isso, dispatch de
// setSaveStatus('saving') seguido de markSaved no mesmo tick vira 1 render
// só (batching do React 18) e o usuário nunca vê o indicador.
const MIN_SAVING_VISIBLE_MS = 400;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let savingTimer: ReturnType<typeof setTimeout> | null = null;

function performSave(
  getState: () => { network: NetworkState },
  dispatch: Dispatch<UnknownAction>,
  activeProjectId: string,
) {
  dispatch(setSaveStatus('saving'));
  if (savingTimer) clearTimeout(savingTimer);
  savingTimer = setTimeout(() => {
    savingTimer = null;
    const state = getState().network;
    servicesRoutes.projects
      .saveProjectSnapshot(activeProjectId, state)
      .then((result) => {
        if (!result.ok) {
          dispatch(setPersistWarning(result.warning));
          return;
        }
        dispatch(markSaved(new Date().toISOString()));
      });
  }, MIN_SAVING_VISIBLE_MS);
}

// Autosave por projeto: middleware (não store.subscribe) porque precisa
// saber o TIPO da action pra não reagir às suas próprias actions de save
// (senão markSaved dispara o autosave de novo, que dispara markSaved de
// novo, em loop). Só grava quando há projeto ativo (Studio aberto via
// /:lang/studio/:projectId — ver StudioProjectLoader).
const autosaveMiddleware: Middleware =
  (storeApi) => (next) => (action) => {
    const actionType = (action as { type?: string } | undefined)?.type;

    // G — trocar/sair do projeto ativo precisa descartar (ou gravar
    // AGORA, no projeto certo) qualquer save pendente do projeto
    // anterior. Sem isso, um debounce/setTimeout já agendado fecha sobre
    // o `activeProjectId` de quando foi criado, mas lê `state.network`
    // só quando dispara — se por lá o projeto já tiver trocado (usuário
    // navegou rápido: editou A, foi pro dashboard, abriu B em menos de
    // ~750ms), ele gravaria o estado de B dentro do slot de A.
    if (actionType === 'projects/setActiveProjectId') {
      const previousProjectId = (
        storeApi.getState() as { projects: { activeProjectId: string | null } }
      ).projects.activeProjectId;
      const hadPendingSave = debounceTimer !== null || savingTimer !== null;

      if (debounceTimer) clearTimeout(debounceTimer);
      if (savingTimer) clearTimeout(savingTimer);
      debounceTimer = null;
      savingTimer = null;

      if (hadPendingSave && previousProjectId) {
        const state = storeApi.getState() as { network: NetworkState };
        void servicesRoutes.projects.saveProjectSnapshot(
          previousProjectId,
          state.network,
        );
      }

      return next(action);
    }

    const result = next(action);
    if (!actionType) return result;

    const activeProjectId = (
      storeApi.getState() as { projects: { activeProjectId: string | null } }
    ).projects.activeProjectId;

    if (actionType === requestImmediateSave.type) {
      if (activeProjectId) {
        if (debounceTimer) clearTimeout(debounceTimer);
        performSave(
          () => storeApi.getState() as { network: NetworkState },
          storeApi.dispatch,
          activeProjectId,
        );
      }
      return result;
    }

    if (
      !actionType.startsWith('network/') ||
      AUTOSAVE_IGNORED_ACTIONS.has(actionType) ||
      !activeProjectId
    ) {
      return result;
    }

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      performSave(
        () => storeApi.getState() as { network: NetworkState },
        storeApi.dispatch,
        activeProjectId,
      );
    }, DEBOUNCE_MS);

    return result;
  };

// Correlaciona gravações de sessão do Clarity com o usuário autenticado.
// Middleware (não lógica dentro do authSlice) pelo mesmo motivo do
// autosave: side-effect de rede/browser não pertence a um reducer puro.
const CLARITY_IDENTIFY_ACTIONS = new Set([
  loginUser.fulfilled.type,
  registerUser.fulfilled.type,
  hydrateSession.fulfilled.type,
]);

const clarityMiddleware: Middleware = () => (next) => (action) => {
  const result = next(action);
  const typedAction = action as { type?: string; payload?: { email?: string } | null };
  if (
    typedAction.type &&
    CLARITY_IDENTIFY_ACTIONS.has(typedAction.type) &&
    typedAction.payload?.email
  ) {
    identifyClarityUser(typedAction.payload.email);
  }
  return result;
};

export const store = configureStore({
  reducer: {
    network: networkReducer,
    auth: authReducer,
    projects: projectsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(autosaveMiddleware, clarityMiddleware),
});

store.dispatch(hydrateSession());

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
