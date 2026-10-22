/**
 * Rascunho de arquitetura cloud (Studio Cloud — sprint-cloud-aws).
 *
 * Mesma forma top-level que a rede-studio-api persiste em `cloud_states`
 * (`CloudStatePayload`): `schemaVersion`, `provider`, `resources`,
 * `connections`, `assumptions`, `ui`, `meta`. O conteúdo de cada item é
 * nosso — a API trata como opaco.
 *
 * A árvore (Conta → Região → VPC → AZ → Subnet → recurso) é uma lista plana
 * ligada por `parentId`: é o que o React Flow espera (sub-flows) e mantém
 * cada edição como uma troca de um item só.
 */

export type CloudProviderFamily = 'AWS';

export type CloudCurrency = 'USD' | 'BRL';

/** Chave do catálogo (`features/cloud/catalog`), ex.: `aws.account`, `aws.vpc`. */
export type CloudResourceType = string;

export type CloudPoint = { x: number; y: number };

export type CloudSize = { width: number; height: number };

export type CloudResource = {
  id: string;
  type: CloudResourceType;
  /** Container pai; `null` só na raiz (conta). */
  parentId: string | null;
  name: string;
  /** Configuração do elemento, no formato do schema do catálogo para `type`. */
  config: Record<string, unknown>;
  /** Posição relativa ao pai (convenção do React Flow para sub-flows). */
  position: CloudPoint;
  /** Só containers guardam tamanho; nós folha usam o tamanho padrão do catálogo. */
  size?: CloudSize;
};

/**
 * Direção de uma conexão:
 * - `one-way`: seta só no destino;
 * - `both`: ida e volta com as mesmas características — uma aresta, seta nas duas pontas.
 * Ida e volta diferentes viram DUAS conexões `one-way` ligadas por `pairId`.
 */
export type CloudConnectionDirection = 'one-way' | 'both';

export type CloudConnection = {
  id: string;
  source: string;
  target: string;
  /** Tipo do catálogo de conexões: `traffic`, `association`, `data`... */
  kind: string;
  direction: CloudConnectionDirection;
  /** Par ida/volta quando as características diferem; `null` caso contrário. */
  pairId: string | null;
  config: Record<string, unknown>;
};

export type CloudAssumptions = {
  currency: CloudCurrency;
  hoursPerMonth: number;
  internetEgressGbMonth: number;
  interAzGbMonth: number;
  natProcessedGbMonth: number;
  /** Desconta a franquia de 100 GB/mês de saída para a internet (padrão: sim). */
  freeTierEgress: boolean;
};

export type CloudUi = {
  selectedResourceId: string | null;
  selectedConnectionId: string | null;
};

export type CloudSaveStatus = 'idle' | 'saving' | 'saved';

export type CloudMeta = {
  projectName: string;
  persistWarning: string | null;
  lastSavedAt: string | null;
  saveStatus: CloudSaveStatus;
};

export type CloudState = {
  schemaVersion: 1;
  provider: CloudProviderFamily;
  resources: CloudResource[];
  connections: CloudConnection[];
  assumptions: CloudAssumptions;
  ui: CloudUi;
  meta: CloudMeta;
};

/** Rascunho como chega da API/cache: qualquer campo pode faltar (versões antigas). */
export type CloudStateInput = Partial<
  Omit<CloudState, 'meta' | 'assumptions'>
> & {
  meta?: Partial<CloudMeta>;
  assumptions?: Partial<CloudAssumptions>;
};

/** O que o undo/redo grava: tudo menos `ui` e `meta`. */
export type CloudDomainSnapshot = Omit<CloudState, 'ui' | 'meta'>;
