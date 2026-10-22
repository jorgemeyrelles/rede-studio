import { createSlice, type Draft, type PayloadAction } from '@reduxjs/toolkit';
import { makeServiceId } from '../../services/_core/id';
import type { AppLanguage } from '../../types/i18n';
import { getCatalogEntry } from './catalog';
import { suggestIpInSubnet } from './engines/addressing';
import {
  canConnect,
  defaultConnection,
  removeConnection,
  reverseConnection,
  setConnectionMode,
  type ConnectionKind,
  type ConnectionMode,
} from './engines/connections';
import { runIdGenerator } from './engines/ids';
import { pruneDanglingRefs } from './references';
import type { SubnetTier } from './engines/ip';
import {
  clampToParent,
  fitAncestors,
  minContainerSize,
  nextChildPosition,
  pushFollowingSiblings,
  subtreeIds,
} from './tree';
import type {
  CloudAssumptions,
  CloudConnection,
  CloudCurrency,
  CloudDomainSnapshot,
  CloudPoint,
  CloudResource,
  CloudSize,
  CloudSaveStatus,
  CloudState,
  CloudStateInput,
} from './types';

/**
 * Estado do projeto CLOUD aberto no Studio Cloud — contraparte do
 * `networkSlice` (on-prem). Só um dos dois está em uso por vez; o
 * `StudioProjectLoader` decide pelo `networkType` do projeto.
 */

export const cloudInitialState: CloudState = {
  schemaVersion: 1,
  provider: 'AWS',
  resources: [],
  connections: [],
  assumptions: {
    currency: 'USD',
    hoursPerMonth: 730,
    internetEgressGbMonth: 100,
    interAzGbMonth: 50,
    natProcessedGbMonth: 100,
    freeTierEgress: true,
  },
  ui: { selectedResourceId: null, selectedConnectionId: null },
  meta: {
    projectName: '',
    persistWarning: null,
    lastSavedAt: null,
    saveStatus: 'idle',
  },
};

/**
 * Completa um rascunho vindo da API/cache com os defaults atuais — campos
 * novos de `assumptions`/`ui`/`meta` não quebram rascunhos salvos antes
 * deles existirem.
 */
export function normalizeCloudState(raw: CloudStateInput): CloudState {
  return {
    schemaVersion: 1,
    provider: 'AWS',
    resources: Array.isArray(raw.resources)
      ? pruneDanglingRefs(raw.resources)
      : [],
    connections: Array.isArray(raw.connections) ? raw.connections : [],
    assumptions: { ...cloudInitialState.assumptions, ...raw.assumptions },
    ui: { ...cloudInitialState.ui },
    meta: {
      ...cloudInitialState.meta,
      ...raw.meta,
      persistWarning: null,
      saveStatus: 'idle',
    },
  };
}

type InsertPayload = {
  id: string;
  type: string;
  parentId: string | null;
  language: AppLanguage;
  initialConfig: Record<string, unknown>;
  /** Nome explícito (ex.: "Pública a" do planejador); sem ele, prefixo numerado. */
  name?: string;
};

/**
 * Insere um recurso do catálogo: configuração = padrões + `derive` (o que
 * depende do rascunho: CIDR livre, letra da AZ) + `initialConfig`; próxima
 * posição livre; ancestrais crescem para caber. Depois cria os filhos
 * automáticos (`autoChildren`, ex.: as AZs da VPC), com ids derivados.
 */
function insertResource(state: Draft<CloudState>, payload: InsertPayload) {
  const { id, type, parentId, language, initialConfig, name } = payload;
  const entry = getCatalogEntry(type);
  if (!entry) return;
  const parent = state.resources.find((r) => r.id === parentId) ?? null;
  const derived =
    entry.derive?.({
      state: state as CloudState,
      parent: parent as CloudResource | null,
    }) ?? {};
  const sameType = state.resources.filter((r) => r.type === type).length;
  const resource: CloudResource = {
    id,
    type,
    parentId,
    name: name ?? `${entry.namePrefix[language]} ${sameType + 1}`,
    config: {
      ...structuredClone(entry.defaults),
      ...derived,
      ...initialConfig,
    },
    position: nextChildPosition(
      state.resources as CloudResource[],
      parentId,
      entry.kind,
      entry.rootPlacement,
    ),
    ...(entry.kind === 'container' && entry.defaultSize
      ? { size: { ...entry.defaultSize } }
      : {}),
  };
  state.resources = fitAncestors(
    [...(state.resources as CloudResource[]), resource],
    id,
  );
  const children =
    entry.autoChildren?.({ state: state as CloudState, resource }) ?? [];
  children.forEach((childType, index) =>
    insertResource(state, {
      id: `${id}-${index + 1}`,
      type: childType,
      parentId: id,
      language,
      initialConfig: {},
    }),
  );
}

export type PlannedSubnetInput = {
  azId: string;
  tier: SubnetTier;
  cidr: string;
  name: string;
};

const cloudSlice = createSlice({
  name: 'cloud',
  initialState: cloudInitialState,
  reducers: {
    hydrateCloudState: (_state, action: PayloadAction<CloudStateInput>) =>
      normalizeCloudState(action.payload),

    /** Desfazer/refazer (ver `cloudHistory.ts`): aplica um snapshot do domínio, limpando seleções órfãs. */
    restoreCloudDomain: (state, action: PayloadAction<CloudDomainSnapshot>) => {
      const domain = action.payload;
      const resourceIds = new Set(domain.resources.map((r) => r.id));
      const connectionIds = new Set(domain.connections.map((c) => c.id));
      return {
        ...domain,
        meta: state.meta,
        ui: {
          selectedResourceId:
            state.ui.selectedResourceId &&
            resourceIds.has(state.ui.selectedResourceId)
              ? state.ui.selectedResourceId
              : null,
          selectedConnectionId:
            state.ui.selectedConnectionId &&
            connectionIds.has(state.ui.selectedConnectionId)
              ? state.ui.selectedConnectionId
              : null,
        },
      };
    },

    /**
     * Cria um recurso do catálogo dentro de `parentId` (a paleta já
     * resolveu o pai válido — ver `paletteAvailability`): nome padrão
     * numerado, configuração padrão, próxima posição livre, e os
     * ancestrais crescem para caber. O novo recurso fica selecionado.
     */
    addCloudResource: {
      reducer: (
        state,
        action: PayloadAction<{
          id: string;
          type: string;
          parentId: string | null;
          language: AppLanguage;
          initialConfig: Record<string, unknown>;
        }>,
      ) => {
        insertResource(state, action.payload);
        const { id } = action.payload;
        state.ui.selectedResourceId = id;
        state.ui.selectedConnectionId = null;
      },
      /**
       * Aleatoriedade fica aqui (não no reducer): id do recurso e valores dos
       * campos com `generator` (ex.: ID da conta AWS). `initialConfig` traz
       * padrões que dependem da sessão (usuário IAM, responsável) — o catálogo
       * não conhece a sessão. Os gerados ficam gravados: aparecem no campo.
       */
      prepare: (payload: {
        type: string;
        parentId: string | null;
        language: AppLanguage;
        initialConfig?: Record<string, unknown>;
      }) => {
        const generated: Record<string, unknown> = {};
        for (const field of getCatalogEntry(payload.type)?.fields ?? []) {
          if (field.type === 'text' && field.generator) {
            generated[field.key] = runIdGenerator(field.generator);
          }
        }
        return {
          payload: {
            ...payload,
            id: makeServiceId('res'),
            initialConfig: { ...generated, ...payload.initialConfig },
          },
        };
      },
    },
    /**
     * "Planejar subnets": cria de uma vez (um passo de desfazer) as subnets
     * do plano — o plano já pulou as existentes e os blocos ocupados.
     */
    addPlannedSubnets: {
      reducer: (
        state,
        action: PayloadAction<{
          items: (PlannedSubnetInput & { id: string })[];
          language: AppLanguage;
        }>,
      ) => {
        const { items, language } = action.payload;
        for (const item of items) {
          insertResource(state, {
            id: item.id,
            type:
              item.tier === 'public'
                ? 'aws.subnet.public'
                : 'aws.subnet.private',
            parentId: item.azId,
            language,
            name: item.name,
            initialConfig:
              item.tier === 'public'
                ? { cidr: item.cidr }
                : { cidr: item.cidr, isolated: item.tier === 'isolated' },
          });
        }
      },
      prepare: (payload: {
        items: PlannedSubnetInput[];
        language: AppLanguage;
      }) => ({
        payload: {
          language: payload.language,
          items: payload.items.map((item) => ({
            ...item,
            id: makeServiceId('res'),
          })),
        },
      }),
    },
    renameCloudResource: (
      state,
      action: PayloadAction<{ id: string; name: string }>,
    ) => {
      const resource = state.resources.find((r) => r.id === action.payload.id);
      if (resource) resource.name = action.payload.name;
    },
    updateCloudResourceConfig: (
      state,
      action: PayloadAction<{ id: string; patch: Record<string, unknown> }>,
    ) => {
      const resource = state.resources.find((r) => r.id === action.payload.id);
      if (resource)
        resource.config = { ...resource.config, ...action.payload.patch };
    },
    /** Posição relativa ao pai, sempre dentro dele (ver `clampToParent`). */
    moveCloudResource: (
      state,
      action: PayloadAction<{ id: string; position: CloudPoint }>,
    ) => {
      const { id, position } = action.payload;
      const clamped = clampToParent(state.resources, id, position);
      state.resources = state.resources.map((r) =>
        r.id === id ? { ...r, position: clamped } : r,
      );
    },
    /** Redimensiona um container sem cortar os filhos. */
    resizeCloudResource: (
      state,
      action: PayloadAction<{ id: string; size: CloudSize }>,
    ) => {
      const { id, size } = action.payload;
      const min = minContainerSize(state.resources, id);
      state.resources = fitAncestors(
        pushFollowingSiblings(
          state.resources.map((r) =>
            r.id === id
              ? {
                  ...r,
                  size: {
                    width: Math.max(min.width, Math.round(size.width)),
                    height: Math.max(min.height, Math.round(size.height)),
                  },
                }
              : r,
          ),
          id,
        ),
        id,
      );
    },
    /** Remove o recurso, tudo que está dentro dele e as conexões que tocam qualquer um deles. */
    removeCloudResource: (state, action: PayloadAction<string>) => {
      const removed = subtreeIds(state.resources, action.payload);
      // Quem apontava para o excluído (SGs, subnets, NACL, rotas) é limpo no mesmo passo.
      state.resources = pruneDanglingRefs(
        state.resources.filter((r) => !removed.has(r.id)),
      );
      const kept = state.connections.filter(
        (c) => !removed.has(c.source) && !removed.has(c.target),
      );
      // A volta de um par cujo parceiro sumiu vira uma conexão simples.
      const keptIds = new Set(kept.map((c) => c.id));
      state.connections = kept.map((c) =>
        c.pairId && !keptIds.has(c.pairId) ? { ...c, pairId: null } : c,
      );
      if (
        state.ui.selectedConnectionId &&
        !keptIds.has(state.ui.selectedConnectionId)
      ) {
        state.ui.selectedConnectionId = null;
      }
      if (
        state.ui.selectedResourceId &&
        removed.has(state.ui.selectedResourceId)
      ) {
        state.ui.selectedResourceId = null;
      }
    },

    /**
     * Troca o recurso de container (ex.: EC2 para outra subnet): vai para a
     * próxima posição livre do novo pai, que cresce para caber, e o IP fixo
     * é refeito na nova subnet.
     */
    reparentCloudResource: (
      state,
      action: PayloadAction<{ id: string; parentId: string }>,
    ) => {
      const { id, parentId } = action.payload;
      const resource = state.resources.find((r) => r.id === id);
      const entry = resource ? getCatalogEntry(resource.type) : undefined;
      if (!resource || !entry || resource.parentId === parentId) return;
      const others = state.resources.filter(
        (r) => r.id !== id,
      ) as CloudResource[];
      const moved: CloudResource = {
        ...(resource as CloudResource),
        parentId,
        position: nextChildPosition(others, parentId, entry.kind),
      };
      let next = [...others, moved];
      if (typeof moved.config.privateIp === 'string') {
        const ip = suggestIpInSubnet(next, parentId, id);
        next = next.map((r) =>
          r.id === id
            ? { ...r, config: { ...r.config, privateIp: ip ?? '' } }
            : r,
        );
      }
      state.resources = fitAncestors(next, id);
    },

    /** Liga dois recursos (alça da direita → alça da esquerda) com o tipo/porta padrão. */
    addCloudConnection: {
      reducer: (
        state,
        action: PayloadAction<{ id: string; source: string; target: string }>,
      ) => {
        const { id, source, target } = action.payload;
        const resources = state.resources as CloudResource[];
        if (
          !canConnect(
            resources,
            state.connections as CloudConnection[],
            source,
            target,
          )
        )
          return;
        const { kind, config } = defaultConnection(resources, source, target);
        state.connections.push({
          id,
          source,
          target,
          kind,
          direction: 'one-way',
          pairId: null,
          config,
        });
        state.ui.selectedConnectionId = id;
        state.ui.selectedResourceId = null;
      },
      prepare: (payload: { source: string; target: string }) => ({
        payload: { ...payload, id: makeServiceId('conn') },
      }),
    },
    updateCloudConnection: (
      state,
      action: PayloadAction<{
        id: string;
        kind?: ConnectionKind;
        patch?: Record<string, unknown>;
      }>,
    ) => {
      const connection = state.connections.find(
        (c) => c.id === action.payload.id,
      );
      if (!connection) return;
      if (action.payload.kind) connection.kind = action.payload.kind;
      if (action.payload.patch)
        connection.config = { ...connection.config, ...action.payload.patch };
    },
    /** Ida / ida e volta iguais / ida e volta diferentes (par com `pairId`). */
    setCloudConnectionMode: {
      reducer: (
        state,
        action: PayloadAction<{
          id: string;
          mode: ConnectionMode;
          newId: string;
        }>,
      ) => {
        const { id, mode, newId } = action.payload;
        state.connections = setConnectionMode(
          state.connections as CloudConnection[],
          id,
          mode,
          newId,
        );
      },
      prepare: (payload: { id: string; mode: ConnectionMode }) => ({
        payload: { ...payload, newId: makeServiceId('conn') },
      }),
    },
    reverseCloudConnection: (state, action: PayloadAction<string>) => {
      state.connections = reverseConnection(
        state.connections as CloudConnection[],
        action.payload,
      );
    },
    removeCloudConnection: (state, action: PayloadAction<string>) => {
      state.connections = removeConnection(
        state.connections as CloudConnection[],
        action.payload,
      );
      if (
        !state.connections.some((c) => c.id === state.ui.selectedConnectionId)
      ) {
        state.ui.selectedConnectionId = null;
      }
    },

    setCloudCurrency: (state, action: PayloadAction<CloudCurrency>) => {
      state.assumptions.currency = action.payload;
    },
    updateCloudAssumptions: (
      state,
      action: PayloadAction<Partial<CloudAssumptions>>,
    ) => {
      state.assumptions = { ...state.assumptions, ...action.payload };
    },

    selectCloudResource: (state, action: PayloadAction<string | null>) => {
      state.ui.selectedResourceId = action.payload;
      state.ui.selectedConnectionId = null;
    },
    selectCloudConnection: (state, action: PayloadAction<string | null>) => {
      state.ui.selectedConnectionId = action.payload;
      state.ui.selectedResourceId = null;
    },

    setCloudProjectName: (state, action: PayloadAction<string>) => {
      state.meta.projectName = action.payload;
    },
    setCloudPersistWarning: (state, action: PayloadAction<string | null>) => {
      state.meta.persistWarning = action.payload;
      state.meta.saveStatus = 'idle';
    },
    setCloudSaveStatus: (state, action: PayloadAction<CloudSaveStatus>) => {
      state.meta.saveStatus = action.payload;
    },
    markCloudSaved: (state, action: PayloadAction<string>) => {
      state.meta.lastSavedAt = action.payload;
      state.meta.persistWarning = null;
      state.meta.saveStatus = 'saved';
    },
  },
});

export const {
  addCloudResource,
  addPlannedSubnets,
  renameCloudResource,
  updateCloudResourceConfig,
  moveCloudResource,
  resizeCloudResource,
  removeCloudResource,
  reparentCloudResource,
  addCloudConnection,
  updateCloudConnection,
  setCloudConnectionMode,
  reverseCloudConnection,
  removeCloudConnection,
  hydrateCloudState,
  restoreCloudDomain,
  setCloudCurrency,
  updateCloudAssumptions,
  selectCloudResource,
  selectCloudConnection,
  setCloudProjectName,
  setCloudPersistWarning,
  setCloudSaveStatus,
  markCloudSaved,
} = cloudSlice.actions;

export default cloudSlice.reducer;
