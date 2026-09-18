import { useEffect, useRef } from 'react';
import { shallowEqual } from 'react-redux';
import { useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { useSaveProjectSnapshotMutation } from '../projects/queries';
import { markSaved, setPersistWarning, setSaveStatus } from './networkSlice';
import type { NetworkState } from './types';

const DEBOUNCE_MS = 350;
// Duração mínima visível do estado "salvando" — sem isso, `setSaveStatus('saving')`
// seguido de `markSaved` no mesmo tick vira 1 render só (batching do React) e o
// usuário nunca vê o indicador.
const MIN_SAVING_VISIBLE_MS = 400;

/**
 * Autosave do projeto aberto no Studio — substitui o antigo `autosaveMiddleware`
 * (Redux). `projectId` vem da própria URL (`useParams`, mesma rota de
 * `StudioProjectLoader.tsx`), não de um espelho em Redux: esse valor nunca teve
 * nenhum consumidor em componente, só existia pra dar ao middleware acesso a
 * algo que a URL já tinha.
 *
 * O gatilho do debounce observa `state.network` **exceto `meta`** com
 * `shallowEqual` — é exatamente o pedaço que `markSaved`/`setSaveStatus`/
 * `setPersistWarning` tocam, então ignorá-lo evita o loop "salvar → marca
 * salvo → dispara autosave de novo" sem precisar filtrar por tipo de action
 * (que um hook não consegue ver, só o middleware conseguia). `hydrateNetworkState`
 * (carga do projeto) não precisa de tratamento especial: `StudioProjectLoader`
 * só monta o Studio (e este hook) depois que a hidratação já terminou, então a
 * 1ª renderização deste hook já reflete o projeto carregado — só ignoramos essa
 * primeira leitura como "edição".
 */
export function useAutosave() {
  const { projectId } = useParams<{ projectId: string }>();
  const dispatch = useAppDispatch();
  const saveMutation = useSaveProjectSnapshotMutation();

  const networkState = useAppSelector((state) => state.network);
  const networkStateRef = useRef<NetworkState>(networkState);
  networkStateRef.current = networkState;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRunRef = useRef(true);

  function runSaveNow(targetProjectId: string, state: NetworkState) {
    saveMutation.mutate(
      { id: targetProjectId, networkState: state },
      {
        onSuccess: (result) => {
          if (result.ok) {
            dispatch(markSaved(new Date().toISOString()));
          } else {
            dispatch(setPersistWarning(result.warning));
          }
        },
      },
    );
  }

  function scheduleSave(targetProjectId: string) {
    dispatch(setSaveStatus('saving'));
    if (savingTimerRef.current) clearTimeout(savingTimerRef.current);
    savingTimerRef.current = setTimeout(() => {
      savingTimerRef.current = null;
      runSaveNow(targetProjectId, networkStateRef.current);
    }, MIN_SAVING_VISIBLE_MS);
  }

  /** Botão "salvar agora" (substitui a antiga action `requestImmediateSave`). */
  function forceSave() {
    if (!projectId) return;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    scheduleSave(projectId);
  }

  const topologyForTrigger = useAppSelector((state) => {
    const { meta: _meta, ...rest } = state.network;
    return rest;
  }, shallowEqual);

  // Dispara o debounce quando a topologia muda de verdade.
  useEffect(() => {
    if (!projectId) return;
    if (isFirstRunRef.current) {
      isFirstRunRef.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      scheduleSave(projectId);
    }, DEBOUNCE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topologyForTrigger]);

  // Trocar de projeto (ou sair do Studio) precisa descartar timers
  // pendentes e gravar AGORA, no projeto ANTIGO — sem isso, um save
  // agendado pra A enquanto o usuário já navegou pra B gravaria o estado
  // de B dentro do slot de A. A limpeza abaixo roda tanto na troca de
  // `projectId` quanto no desmonte (Studio inteiro fechado).
  useEffect(() => {
    return () => {
      const hadPendingSave =
        debounceRef.current !== null || savingTimerRef.current !== null;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (savingTimerRef.current) {
        clearTimeout(savingTimerRef.current);
        savingTimerRef.current = null;
      }
      if (hadPendingSave && projectId) {
        runSaveNow(projectId, networkStateRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return { forceSave };
}
