import type { Layer, LayerTier } from '../types/entities';

/**
 * Sprint tiers — regras de posicionamento por papel arquitetural.
 *
 * `order` (ver `types/entities.ts`) nunca é tocado por este módulo — ele
 * continua sendo a chave de criação/endereçamento consumida por
 * `utils/node.ts`/`utils/tech-profiles.ts`. Posição visual vive inteiramente
 * em `row`/`slot`, escritos só por `addLayer` (posição inicial) e pela ação
 * de reposicionamento via arrasto no quadro.
 */

/**
 * Shape mínimo que o motor de regras precisa — permite reaproveitar as
 * mesmas funções tanto com o `Layer` completo do Redux quanto com o shape
 * reduzido que `buildGridLayout` usa pro cálculo de layout do quadro.
 */
export type PositionableLayer = Pick<
  Layer,
  'id' | 'order' | 'tier' | 'row' | 'slot'
>;

/** Máximo de tiers que podem dividir a mesma linha, dentro de uma LAN. */
export const MAX_TIERS_PER_ROW = 2;

const FIXED_FIRST_TIERS: LayerTier[] = ['edge'];
const FIXED_LAST_TIERS: LayerTier[] = ['endpoint'];
const ROW_SHARED_PAIR: LayerTier[] = ['distribution', 'access'];

/** Linha reservada para o bloco distribution/access, logo após edge. */
const DIST_ACCESS_ROW = 10;
/** Linha reservada para server, logo após o bloco distribution/access. */
const SERVER_ROW = 20;
/** Primeira linha disponível para tiers livres (dmz/management/custom). */
const FREE_ROW_START = 30;

export function isFixedFirstTier(tier: LayerTier | undefined): boolean {
  return tier !== undefined && FIXED_FIRST_TIERS.includes(tier);
}

export function isFixedLastTier(tier: LayerTier | undefined): boolean {
  return tier !== undefined && FIXED_LAST_TIERS.includes(tier);
}

export function isRowSharedTier(tier: LayerTier | undefined): boolean {
  return tier !== undefined && ROW_SHARED_PAIR.includes(tier);
}

function pairTierOf(tier: LayerTier): LayerTier {
  return tier === 'distribution' ? 'access' : 'distribution';
}

/**
 * Rank canônico por tipo de tier — usado só pela legenda (`compareLayerForLegend`)
 * pra desempatar duas camadas que dividem linha no quadro, sem depender de
 * `slot` (que é só esquerda/direita visual, e pode mudar com o arrasto).
 */
const TIER_TYPE_RANK: Record<LayerTier, number> = {
  edge: 0,
  distribution: 1,
  access: 2,
  server: 3,
  dmz: 4,
  management: 5,
  custom: 6,
  endpoint: 7,
};

function tierTypeRank(tier: LayerTier | undefined): number {
  return tier === undefined ? TIER_TYPE_RANK.custom : TIER_TYPE_RANK[tier];
}

/**
 * Compara a posição visual de duas camadas da mesma LAN. Âncoras fixas
 * (`edge` primeiro, `endpoint` último) são impostas pelo tier em si — o
 * valor bruto de `row` armazenado nelas é irrelevante para a ordenação.
 * Entre as demais tiers, a ordem é dada por `row` e, dentro da mesma
 * linha, por `slot` (0 = esquerda, 1 = direita).
 */
export function compareLayerPosition<T extends PositionableLayer>(
  a: T,
  b: T,
): number {
  const rankOf = (tier: LayerTier | undefined) =>
    isFixedFirstTier(tier) ? -1 : isFixedLastTier(tier) ? 1 : 0;

  const rankA = rankOf(a.tier);
  const rankB = rankOf(b.tier);
  if (rankA !== rankB) return rankA - rankB;

  // Camadas legadas (criadas antes desta sprint) não têm `row` — cai de
  // volta pra `order`, que já era a chave de posição antes de `row`
  // existir, preservando o empilhamento de coluna única de sempre.
  const rowA = a.row ?? a.order;
  const rowB = b.row ?? b.order;
  if (rowA !== rowB) return rowA - rowB;

  return (a.slot ?? 0) - (b.slot ?? 0);
}

/**
 * Compara a ordem vertical de duas camadas **na legenda lateral** —
 * diferente de `compareLayerPosition`, que serve ao quadro: mesma âncora
 * fixa (edge primeiro, endpoint último) e mesma chave primária (`row`),
 * mas o desempate dentro da mesma linha ignora `slot` (esquerda/direita no
 * quadro, que pode mudar com o arrasto) e usa o rank canônico por tipo de
 * tier (`TIER_TYPE_RANK`) — ex.: `distribution` sempre antes de `access`,
 * não importa qual está visualmente à esquerda. Se o rank empatar (duas
 * tiers livres do mesmo tipo dividindo linha), cai pra `order` (criação).
 */
export function compareLayerForLegend<T extends PositionableLayer>(
  a: T,
  b: T,
): number {
  const rankOf = (tier: LayerTier | undefined) =>
    isFixedFirstTier(tier) ? -1 : isFixedLastTier(tier) ? 1 : 0;

  const rankA = rankOf(a.tier);
  const rankB = rankOf(b.tier);
  if (rankA !== rankB) return rankA - rankB;

  const rowA = a.row ?? a.order;
  const rowB = b.row ?? b.order;
  if (rowA !== rowB) return rowA - rowB;

  const typeRankA = tierTypeRank(a.tier);
  const typeRankB = tierTypeRank(b.tier);
  if (typeRankA !== typeRankB) return typeRankA - typeRankB;

  return a.order - b.order;
}

/**
 * Agrupa as camadas de uma LAN em linhas visuais, na ordem em que devem
 * ser desenhadas de cima pra baixo. Cada linha tem 1 ou 2 camadas (ver
 * `MAX_TIERS_PER_ROW`). Âncoras fixas (`edge`/`endpoint`) nunca dividem
 * linha com ninguém, mesmo que numericamente tenham o mesmo `row`.
 */
export function groupLayersByRow<T extends PositionableLayer>(
  layersInLan: T[],
): T[][] {
  const sorted = [...layersInLan].sort(compareLayerPosition);
  const rows: T[][] = [];

  for (const layer of sorted) {
    const currentRow = rows[rows.length - 1];
    const head = currentRow?.[0];
    const sharesRowWithHead =
      head !== undefined &&
      !isFixedFirstTier(head.tier) &&
      !isFixedFirstTier(layer.tier) &&
      !isFixedLastTier(head.tier) &&
      !isFixedLastTier(layer.tier) &&
      (head.row ?? head.order) === (layer.row ?? layer.order);

    if (sharesRowWithHead && currentRow.length < MAX_TIERS_PER_ROW) {
      currentRow.push(layer);
    } else {
      rows.push([layer]);
    }
  }

  return rows;
}

/**
 * Calcula `(row, slot)` para uma tier nova, considerando as demais
 * camadas já existentes na mesma LAN (mesmo site + mesma rede lógica, ou
 * mesmo site sem rede — o agrupamento que `buildGridLayout` já usa hoje).
 */
export function resolveNewLayerPosition(
  tier: LayerTier | undefined,
  existingLayersInLan: PositionableLayer[],
): { row: number; slot: 0 | 1 } {
  if (isFixedFirstTier(tier) || isFixedLastTier(tier)) {
    // Âncoras fixas — o valor armazenado não importa, `compareLayerPosition`
    // já as posiciona nos extremos independentemente dele.
    return { row: 0, slot: 0 };
  }

  if (isRowSharedTier(tier)) {
    const pair = existingLayersInLan.find((l) => l.tier === pairTierOf(tier!));
    if (pair) {
      return {
        row: pair.row ?? DIST_ACCESS_ROW,
        slot: pair.slot === 0 ? 1 : 0,
      };
    }
    return { row: DIST_ACCESS_ROW, slot: 0 };
  }

  if (tier === 'server') {
    return { row: SERVER_ROW, slot: 0 };
  }

  // Tiers livres (dmz/management/custom): tentam dividir a última linha
  // livre já usada (se ainda tiver vaga e não for uma linha reservada de
  // distribution/access ou server), senão abrem uma linha nova.
  const freeLayers = existingLayersInLan.filter(
    (l) =>
      !isFixedFirstTier(l.tier) &&
      !isFixedLastTier(l.tier) &&
      !isRowSharedTier(l.tier) &&
      l.tier !== 'server',
  );
  const maxFreeRow = freeLayers.reduce(
    (acc, l) => Math.max(acc, l.row ?? l.order),
    FREE_ROW_START - 1,
  );
  const lastRowLayers = freeLayers.filter(
    (l) => (l.row ?? l.order) === maxFreeRow,
  );

  if (lastRowLayers.length > 0 && lastRowLayers.length < MAX_TIERS_PER_ROW) {
    return { row: maxFreeRow, slot: 1 };
  }
  return { row: maxFreeRow + 1, slot: 0 };
}

/**
 * Valida se `layer` pode ser solta em `targetRow` dentro da mesma LAN —
 * usado pelo reposicionamento via arrasto no quadro (Fase 4).
 */
export function canPlaceLayerAt(
  layer: Pick<PositionableLayer, 'id' | 'tier'>,
  targetRow: number,
  existingLayersInLan: PositionableLayer[],
): boolean {
  if (isFixedFirstTier(layer.tier) || isFixedLastTier(layer.tier)) {
    return false; // edge/endpoint nunca podem ser movidas
  }

  const rowLayers = existingLayersInLan.filter(
    (l) => l.id !== layer.id && (l.row ?? l.order) === targetRow,
  );

  if (
    rowLayers.some((l) => isFixedFirstTier(l.tier) || isFixedLastTier(l.tier))
  ) {
    return false; // não pode entrar na linha do edge/endpoint
  }

  return rowLayers.length < MAX_TIERS_PER_ROW;
}
