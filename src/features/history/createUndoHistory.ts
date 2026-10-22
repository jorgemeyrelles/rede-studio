import {
  createAction,
  createSlice,
  type Middleware,
  type PayloadAction,
  type UnknownAction,
} from '@reduxjs/toolkit';

/**
 * Desfazer/refazer genérico de um slice de projeto (on-prem `network`,
 * cloud `cloud`) — cada um ganha suas próprias pilhas e ações.
 *
 * As pilhas ficam no fechamento do middleware (snapshots grandes não
 * entram no estado Redux nem passam pelo serializability check); o slice
 * `<name>` guarda só `canUndo`/`canRedo` pra UI re-renderizar.
 *
 * O que entra no histórico: qualquer action `<actionPrefix>*` que mude o
 * DOMÍNIO (tudo menos `ui` e `meta`), detectado por referência — zoom,
 * seleção e o ciclo de save ficam de fora sem precisar de lista de actions.
 * Edições em rajada (digitação) viram um passo só (janela de 500ms).
 * Abrir/trocar de projeto (`isHydrate`) zera o histórico.
 */

type ProjectState = { ui: unknown; meta: unknown };

export type HistoryFlags = { canUndo: boolean; canRedo: boolean };

type UndoHistoryConfig<S extends ProjectState> = {
  /** Nome do slice de flags (e prefixo das ações undo/redo), ex.: `history`. */
  name: string;
  /** Chave do slice de projeto no store, ex.: `network`. */
  stateKey: string;
  /** Prefixo das actions do slice de projeto, ex.: `network/`. */
  actionPrefix: string;
  isHydrate: (action: unknown) => boolean;
  /** Actions que sempre abrem um passo próprio (ex.: apagar tudo). */
  isForcedStep?: (action: unknown) => boolean;
  restore: (snapshot: Omit<S, 'ui' | 'meta'>) => UnknownAction;
};

const LIMIT = 50;
const COALESCE_MS = 500;

export function createUndoHistory<S extends ProjectState>(config: UndoHistoryConfig<S>) {
  type DomainSnapshot = Omit<S, 'ui' | 'meta'>;

  const undo = createAction(`${config.name}/undo`);
  const redo = createAction(`${config.name}/redo`);

  const slice = createSlice({
    name: config.name,
    initialState: { canUndo: false, canRedo: false } as HistoryFlags,
    reducers: {
      setHistoryFlags: (_state, action: PayloadAction<HistoryFlags>) => action.payload,
    },
  });
  const { setHistoryFlags } = slice.actions;

  const toDomain = (state: S): DomainSnapshot => {
    const { ui: _ui, meta: _meta, ...domain } = state;
    void _ui;
    void _meta;
    return domain as DomainSnapshot;
  };

  const domainChanged = (before: S, after: S): boolean => {
    for (const key of Object.keys(after) as (keyof S)[]) {
      if (key === 'ui' || key === 'meta') continue;
      if (before[key] !== after[key]) return true;
    }
    return false;
  };

  const middleware: Middleware = (api) => {
    let past: DomainSnapshot[] = [];
    let future: DomainSnapshot[] = [];
    let lastPushAt = 0;
    let applying = false;

    const project = () => (api.getState() as Record<string, unknown>)[config.stateKey] as S;
    const flags = () => (api.getState() as Record<string, unknown>)[config.name] as HistoryFlags;

    const syncFlags = () => {
      const { canUndo, canRedo } = flags();
      const next = { canUndo: past.length > 0, canRedo: future.length > 0 };
      if (next.canUndo !== canUndo || next.canRedo !== canRedo) {
        api.dispatch(setHistoryFlags(next));
      }
    };

    const apply = (snapshot: DomainSnapshot) => {
      applying = true;
      try {
        api.dispatch(config.restore(snapshot));
      } finally {
        applying = false;
      }
      // Um passo novo depois de desfazer não deve ser fundido com o anterior.
      lastPushAt = 0;
    };

    return (next) => (action) => {
      if (undo.match(action)) {
        const previous = past.pop();
        if (previous) {
          future.push(toDomain(project()));
          apply(previous);
        }
        syncFlags();
        return action;
      }
      if (redo.match(action)) {
        const following = future.pop();
        if (following) {
          past.push(toDomain(project()));
          apply(following);
        }
        syncFlags();
        return action;
      }

      const before = project();
      const result = next(action);

      if (config.isHydrate(action)) {
        past = [];
        future = [];
        lastPushAt = 0;
        syncFlags();
        return result;
      }

      const type = (action as { type?: unknown }).type;
      if (applying || typeof type !== 'string' || !type.startsWith(config.actionPrefix)) {
        return result;
      }

      const after = project();
      if (!domainChanged(before, after)) return result;

      const now = Date.now();
      const forceNewStep = config.isForcedStep?.(action) ?? false;
      if (forceNewStep || now - lastPushAt > COALESCE_MS || past.length === 0) {
        past.push(toDomain(before));
        if (past.length > LIMIT) past.shift();
      }
      lastPushAt = forceNewStep ? 0 : now;
      future = [];
      syncFlags();
      return result;
    };
  };

  return { undo, redo, reducer: slice.reducer, middleware };
}
