import type { UnknownAction } from '@reduxjs/toolkit';
import { useEffect, useRef } from 'react';
import { shallowEqual } from 'react-redux';
import { useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import type { RootState } from '../../app/store';
import type { StatePersistenceResult } from '../../services/_core';

const DEBOUNCE_MS = 350;
// Duração mínima visível do estado "salvando" — sem isso, `setSaveStatus('saving')`
// seguido de `markSaved` no mesmo tick vira 1 render só (batching do React) e o
// usuário nunca vê o indicador.
const MIN_SAVING_VISIBLE_MS = 400;

/**
 * Flush registrado pelo autosave montado (só existe um Studio aberto por
 * vez — on-prem ou cloud). Permite que quem está FORA do Studio — o logout
 * no `UserBadgeMenu` — grave o save pendente e espere ele terminar ANTES de
 * derrubar a sessão. Sem isso, o flush do desmonte rodaria depois do token
 * já ter sido apagado e o save falharia com 401.
 */
let registeredFlush: (() => Promise<void>) | null = null;

export function flushPendingSave(): Promise<void> {
  return registeredFlush ? registeredFlush() : Promise.resolve();
}

type ProjectState = { meta: unknown };

type ProjectAutosaveConfig<S extends ProjectState> = {
  /** Slice do projeto aberto (`state.network` ou `state.cloud`). */
  selectState: (root: RootState) => S;
  /** Grava o snapshot (local primeiro, depois API). */
  save: (projectId: string, state: S) => Promise<StatePersistenceResult>;
  markSaved: (savedAt: string) => UnknownAction;
  setPersistWarning: (warning: string | null) => UnknownAction;
  setSavingStatus: () => UnknownAction;
};

/**
 * Autosave do projeto aberto no Studio. `projectId` vem da própria URL
 * (`useParams`, mesma rota de `StudioProjectLoader.tsx`).
 *
 * O gatilho do debounce observa o slice do projeto **exceto `meta`** com
 * `shallowEqual` — é exatamente o pedaço que `markSaved`/`setSaveStatus`/
 * `setPersistWarning` tocam, então ignorá-lo evita o loop "salvar → marca
 * salvo → dispara autosave de novo". A hidratação não precisa de
 * tratamento especial: `StudioProjectLoader` só monta o Studio (e este hook)
 * depois que ela terminou — só ignoramos a primeira leitura como "edição".
 */
export function useProjectAutosave<S extends ProjectState>(config: ProjectAutosaveConfig<S>) {
  const { projectId } = useParams<{ projectId: string }>();
  const dispatch = useAppDispatch();

  const configRef = useRef(config);
  configRef.current = config;

  const projectState = useAppSelector(config.selectState);
  const stateRef = useRef<S>(projectState);
  stateRef.current = projectState;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRunRef = useRef(true);

  const inFlightRef = useRef<Promise<unknown> | null>(null);

  function runSaveNow(targetProjectId: string, state: S) {
    const promise = configRef.current
      .save(targetProjectId, state)
      .then((result) => {
        if (result.ok) {
          dispatch(configRef.current.markSaved(new Date().toISOString()));
        } else {
          dispatch(configRef.current.setPersistWarning(result.warning));
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (inFlightRef.current === promise) inFlightRef.current = null;
      });
    inFlightRef.current = promise;
    return promise;
  }

  function scheduleSave(targetProjectId: string) {
    dispatch(configRef.current.setSavingStatus());
    if (savingTimerRef.current) clearTimeout(savingTimerRef.current);
    savingTimerRef.current = setTimeout(() => {
      savingTimerRef.current = null;
      runSaveNow(targetProjectId, stateRef.current);
    }, MIN_SAVING_VISIBLE_MS);
  }

  /** Botão "salvar agora". */
  function forceSave() {
    if (!projectId) return;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    scheduleSave(projectId);
  }

  // Registra o flush externo (ver `flushPendingSave`): grava já o que estiver
  // agendado e espera qualquer save em voo terminar.
  useEffect(() => {
    const flush = async () => {
      const hadPendingSave =
        debounceRef.current !== null || savingTimerRef.current !== null;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savingTimerRef.current) clearTimeout(savingTimerRef.current);
      debounceRef.current = null;
      savingTimerRef.current = null;
      if (hadPendingSave && projectId) {
        await runSaveNow(projectId, stateRef.current);
      } else if (inFlightRef.current) {
        await inFlightRef.current;
      }
    };
    registeredFlush = flush;
    return () => {
      if (registeredFlush === flush) registeredFlush = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const contentForTrigger = useAppSelector((root) => {
    const { meta: _meta, ...rest } = config.selectState(root);
    void _meta;
    return rest;
  }, shallowEqual);

  // Dispara o debounce quando o conteúdo muda de verdade.
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
  }, [contentForTrigger]);

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
        runSaveNow(projectId, stateRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return { forceSave };
}
