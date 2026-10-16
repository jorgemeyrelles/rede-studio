import type { NodeItem, Site } from '../../../features/network/types';
import {
  groupLayersByRow,
  isFixedFirstTier,
  isFixedLastTier,
  MAX_TIERS_PER_ROW,
  type PositionableLayer,
} from '../../../features/network/utils/tierRules';
import {
  BASE_Y,
  CENTER_CHANNEL_WIDTH,
  DIAGRAM_SIDE_PADDING,
  EMPTY_SITE_HEIGHT,
  GRID_COLUMN_GAP,
  GRID_ROW_GAP,
  INTER_NETWORK_GAP,
  LAYER_TOP_OFFSET,
  LAYER_VERTICAL_GAP,
  SITE_BOTTOM_PADDING,
  TIER_ROW_GAP,
  WAN_Y,
} from '../constants';
export {
  cellToPixel,
  computeLayerGridSize,
  deriveLayerGridFromLegacySize,
  findFirstFreeCell,
  pixelToCell,
} from '../../../features/network/utils/grid';
import type { GridLayoutResult, TooltipPlacement } from '../types';

type GridLayoutLayer = PositionableLayer & {
  siteId: string;
  width: number;
  height: number;
  networkId?: string;
};

function computeRowWidth(row: GridLayoutLayer[]): number {
  if (row.length === 0) return 0;
  return (
    row.reduce((sum, layer) => sum + layer.width, 0) +
    TIER_ROW_GAP * (row.length - 1)
  );
}

function computeRowHeight(row: GridLayoutLayer[]): number {
  return row.reduce((max, layer) => Math.max(max, layer.height), 0);
}

export type LayerReorderUpdate = { id: string; row: number; slot: 0 | 1 };

export type LayerDropResult =
  | {
      kind: 'merge';
      updates: LayerReorderUpdate[];
      mergedPairIds: [string, string];
    }
  | { kind: 'reindex'; updates: LayerReorderUpdate[] };

/**
 * Sprint tiers Fase 4 — resolve o alvo de um arrasto de tier no quadro:
 * decide se a camada arrastada funde numa linha já existente (formando um
 * par lado a lado) ou se abre uma linha nova entre as demais, e devolve a
 * lista de `(row, slot)` a aplicar. `null` quando o arrasto deve ser
 * rejeitado (âncora fixa, ou formaria um par mas nenhuma das duas camadas
 * tem como encolher 1 coluna de grid pra caber ao lado da outra).
 *
 * Função pura — não lê nem escreve Redux; quem chama decide o que fazer
 * com o resultado (inclusive desfazer visualmente uma rejeição).
 */
export function resolveLayerDrop({
  movedLayerId,
  dropPoint,
  layersInLan,
  getRect,
  canShrinkColumn,
}: {
  movedLayerId: string;
  dropPoint: { x: number; y: number };
  /** Todas as camadas da mesma LAN (mesmo site + mesma rede lógica), incluindo a arrastada. */
  layersInLan: GridLayoutLayer[];
  /** Posição canônica atual (pré-arrasto) de uma camada, pelo id. */
  getRect: (layerId: string) => { x: number; y: number } | undefined;
  /** Se a camada ainda pode perder 1 coluna de grid sem cortar um nó. */
  canShrinkColumn: (layerId: string) => boolean;
}): LayerDropResult | null {
  const moved = layersInLan.find((l) => l.id === movedLayerId);
  if (!moved) return null;
  if (isFixedFirstTier(moved.tier) || isFixedLastTier(moved.tier)) return null;

  const middleOthers = layersInLan.filter(
    (l) =>
      l.id !== movedLayerId &&
      !isFixedFirstTier(l.tier) &&
      !isFixedLastTier(l.tier),
  );
  const existingRows = groupLayersByRow(middleOthers);

  if (existingRows.length === 0) {
    return { kind: 'reindex', updates: [{ id: moved.id, row: 10, slot: 0 }] };
  }

  // Linha existente mais próxima do ponto solto, por distância vertical.
  let nearestIndex = 0;
  let nearestDist = Infinity;
  existingRows.forEach((row, index) => {
    const pos = getRect(row[0].id);
    if (!pos) return;
    const dist = Math.abs(pos.y - dropPoint.y);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestIndex = index;
    }
  });

  const targetRow = existingRows[nearestIndex];
  const targetPos = getRect(targetRow[0].id);
  const targetRowValue = targetRow[0].row ?? targetRow[0].order;

  const MERGE_THRESHOLD_PX = 40;
  const canMerge = targetRow.length < MAX_TIERS_PER_ROW;
  const shouldMerge =
    canMerge && targetPos !== undefined && nearestDist <= MERGE_THRESHOLD_PX;

  if (shouldMerge && targetPos) {
    const existing = targetRow[0];
    const canShrinkMoved = canShrinkColumn(moved.id);
    const canShrinkExisting = canShrinkColumn(existing.id);
    if (!canShrinkMoved && !canShrinkExisting) {
      // Nenhuma das duas tem como encolher — bloqueia o reposicionamento.
      return null;
    }
    const slotForMoved: 0 | 1 = dropPoint.x < targetPos.x ? 0 : 1;
    const slotForExisting: 0 | 1 = slotForMoved === 0 ? 1 : 0;
    return {
      kind: 'merge',
      mergedPairIds: [moved.id, existing.id],
      updates: [
        { id: moved.id, row: targetRowValue, slot: slotForMoved },
        { id: existing.id, row: targetRowValue, slot: slotForExisting },
      ],
    };
  }

  // Insere como linha nova — reindexa todas as linhas do meio na ordem
  // resultante (acima ou abaixo da linha mais próxima, conforme o y
  // solto), preservando a composição de cada linha existente.
  const insertBeforeTarget = targetPos ? dropPoint.y < targetPos.y : true;
  const insertAt = insertBeforeTarget ? nearestIndex : nearestIndex + 1;
  const newRowsOrder = existingRows.slice();
  newRowsOrder.splice(insertAt, 0, [moved]);

  const updates: LayerReorderUpdate[] = [];
  newRowsOrder.forEach((row, index) => {
    const rowValue = (index + 1) * 10;
    row.forEach((layer, slot) => {
      updates.push({ id: layer.id, row: rowValue, slot: slot as 0 | 1 });
    });
  });
  return { kind: 'reindex', updates };
}

export function parseCsvItems(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item !== ''),
    ),
  );
}

export function serializeCsvItems(items: string[]): string {
  return items.join(', ');
}

export function calculateTooltipPosition({
  iconX,
  iconY,
  containerWidth,
  containerHeight,
  tooltipWidth = 310,
  tooltipHeight = 245,
  preferredPlacement,
  triggerSize = 18,
}: {
  iconX: number;
  iconY: number;
  containerWidth: number;
  containerHeight: number;
  tooltipWidth?: number;
  tooltipHeight?: number;
  preferredPlacement?: TooltipPlacement;
  triggerSize?: number;
}) {
  let left = iconX;
  let top = iconY;

  if (preferredPlacement === 'bottom') {
    left = Math.max(
      8,
      Math.min(iconX - tooltipWidth / 2, containerWidth - tooltipWidth - 8),
    );
    top = Math.max(
      8,
      Math.min(iconY + triggerSize, containerHeight - tooltipHeight - 8),
    );
    return { left, top };
  }

  if (iconX + triggerSize + tooltipWidth <= containerWidth) {
    left = iconX + triggerSize;
  } else if (iconX - tooltipWidth >= 0) {
    left = iconX - tooltipWidth;
  } else {
    left = Math.max(8, Math.min(iconX, containerWidth - tooltipWidth - 8));
  }

  if (iconY + tooltipHeight <= containerHeight) {
    top = iconY;
  } else if (iconY - tooltipHeight >= 0) {
    top = iconY - tooltipHeight;
  } else {
    top = Math.max(8, containerHeight - tooltipHeight - 8);
  }

  return { left, top };
}

export function getSiteHeaderIp(site: Site, nodes: NodeItem[]) {
  const siteNodes = nodes.filter((node) => node.siteId === site.id);
  const preferred =
    siteNodes.find((node) => node.category === 'router') ?? siteNodes[0];
  if (preferred) return `${preferred.ip}/${preferred.cidr}`;
  return `200.${site.ipOctet}.1.1/${site.cidr}`;
}

export function buildGridLayout({
  sites,
  layers,
  diagramWidth,
}: {
  sites: Site[];
  layers: GridLayoutLayer[];
  diagramWidth: number;
}): GridLayoutResult {
  const limitedSites = sites.slice(0, 4);
  const siteWidths = new Map<string, number>();
  const siteHeights = new Map<string, number>();
  const siteMaxLayerWidths = new Map<string, number>();
  const layerPositions = new Map<string, { x: number; y: number }>();
  const sitePositions = new Map<string, { x: number; y: number }>();
  // Linhas (já resolvidas por `groupLayersByRow`) de cada site, indexadas
  // por grupo de rede (`null` = camadas soltas) — computadas no 1º passe e
  // reaproveitadas no 2º, pra não duplicar o agrupamento.
  const siteRowGroups = new Map<
    string,
    Map<string | null, GridLayoutLayer[][]>
  >();

  // Default site width adapts to how many sites exist:
  //  • 1 site  → fills ~80% of the canvas (maximum breathing room)
  //  • 2+ sites → fills each column so both sites occupy the available space
  const numSites = limitedSites.length;
  const dynamicDefaultWidth =
    numSites <= 1
      ? Math.floor(diagramWidth * 0.8)
      : Math.floor(
          (diagramWidth -
            CENTER_CHANNEL_WIDTH -
            GRID_COLUMN_GAP * 2 -
            DIAGRAM_SIDE_PADDING * 2) /
            2,
        );

  const SITE_H_PADDING = 32; // padding horizontal interno do site (16 cada lado)

  for (const site of limitedSites) {
    const siteLayers = layers.filter((layer) => layer.siteId === site.id);

    // Agrupar camadas por rede para determinar layout
    const netGroups = new Map<string | null, GridLayoutLayer[]>();
    siteLayers.forEach((layer) => {
      const key = layer.networkId ?? null;
      if (!netGroups.has(key)) netGroups.set(key, []);
      netGroups.get(key)!.push(layer);
    });
    // Remover grupo vazio de camadas sem rede
    if ((netGroups.get(null) ?? []).length === 0) netGroups.delete(null);

    // Linhas de cada rede — camadas ancoradas (edge/endpoint) isoladas,
    // distribution+access (e tiers livres) já resolvidas lado a lado.
    const rowsByGroup = new Map<string | null, GridLayoutLayer[][]>();
    let maxLayerWidth = 0;
    for (const [key, groupLayers] of netGroups) {
      const rows = groupLayersByRow(groupLayers);
      rowsByGroup.set(key, rows);
      for (const row of rows) {
        maxLayerWidth = Math.max(maxLayerWidth, computeRowWidth(row));
      }
    }
    siteMaxLayerWidths.set(site.id, maxLayerWidth);
    siteRowGroups.set(site.id, rowsByGroup);

    const isMultiNetwork =
      netGroups.size > 1 || (netGroups.size === 1 && !netGroups.has(null));

    let width: number;
    let computedHeight: number;

    if (isMultiNetwork) {
      // Redes lado a lado: largura = soma das colunas + gaps
      const netCount = netGroups.size;
      width =
        netCount * maxLayerWidth +
        (netCount - 1) * INTER_NETWORK_GAP +
        SITE_H_PADDING;
      // Altura = coluna mais alta
      let maxNetHeight = 0;
      for (const [, rows] of rowsByGroup) {
        let netH = 0;
        rows.forEach((row, i) => {
          netH +=
            computeRowHeight(row) +
            (i < rows.length - 1 ? LAYER_VERTICAL_GAP : 0);
        });
        maxNetHeight = Math.max(maxNetHeight, netH);
      }
      computedHeight = Math.max(
        EMPTY_SITE_HEIGHT,
        LAYER_TOP_OFFSET + maxNetHeight + SITE_BOTTOM_PADDING,
      );
    } else {
      // Coluna única — comportamento legado, agora com linhas (que podem
      // ter 1 ou 2 camadas lado a lado) em vez de camadas isoladas.
      width = maxLayerWidth > 0 ? maxLayerWidth + 64 : dynamicDefaultWidth;
      const rows = rowsByGroup.get(null) ?? [];
      let stackedHeight = LAYER_TOP_OFFSET;
      rows.forEach((row, index) => {
        stackedHeight += computeRowHeight(row);
        if (index < rows.length - 1) stackedHeight += LAYER_VERTICAL_GAP;
      });
      stackedHeight += SITE_BOTTOM_PADDING;
      computedHeight = Math.max(EMPTY_SITE_HEIGHT, stackedHeight);
    }

    siteWidths.set(site.id, width);
    siteHeights.set(site.id, computedHeight);
  }

  const s1 = limitedSites[0];
  const s2 = limitedSites[1];
  const s3 = limitedSites[2];
  const s4 = limitedSites[3];

  const leftCandidates = [s1, s3].filter(Boolean) as Site[];
  const rightCandidates = [s2, s4].filter(Boolean) as Site[];

  const getSiteWidth = (siteId: string) =>
    siteWidths.get(siteId) ?? dynamicDefaultWidth;

  const leftColWidth =
    leftCandidates.length > 0
      ? Math.max(...leftCandidates.map((site) => getSiteWidth(site.id)))
      : 0;
  const rightColWidth =
    rightCandidates.length > 0
      ? Math.max(...rightCandidates.map((site) => getSiteWidth(site.id)))
      : 0;

  const useSymmetricEdgeColumns = limitedSites.length >= 2;
  const edgeColWidth = useSymmetricEdgeColumns
    ? Math.max(leftColWidth, rightColWidth)
    : leftColWidth;

  const effectiveLeftColWidth = useSymmetricEdgeColumns
    ? edgeColWidth
    : leftColWidth;
  const effectiveRightColWidth = useSymmetricEdgeColumns
    ? edgeColWidth
    : rightColWidth;

  const totalGridWidth =
    effectiveLeftColWidth +
    CENTER_CHANNEL_WIDTH +
    effectiveRightColWidth +
    GRID_COLUMN_GAP * 2;
  const startX = Math.max(
    DIAGRAM_SIDE_PADDING,
    (diagramWidth - totalGridWidth) / 2,
  );

  const leftX = startX;
  const centerX = leftX + effectiveLeftColWidth + GRID_COLUMN_GAP;
  const rightX = centerX + CENTER_CHANNEL_WIDTH + GRID_COLUMN_GAP;

  const row1Sites = [s1, s2].filter(Boolean) as Site[];
  const row1Height =
    row1Sites.length > 0
      ? Math.max(
          ...row1Sites.map(
            (site) => siteHeights.get(site.id) ?? EMPTY_SITE_HEIGHT,
          ),
        )
      : EMPTY_SITE_HEIGHT;

  const hasMiddleRow = limitedSites.length >= 3;
  const middleRowHeight = hasMiddleRow ? CENTER_CHANNEL_WIDTH : 0;

  const row1Y = BASE_Y;
  const row2Y = row1Y + row1Height + GRID_ROW_GAP;
  const row3Y = row2Y + middleRowHeight + GRID_ROW_GAP;

  // Simetria do vao central baseada no eixo da WAN e nas bordas internas
  // dos containers (shape do site), nao no centro de cada coluna.
  const wanAxisX = centerX + CENTER_CHANNEL_WIDTH / 2;
  const leftInnerBorderX =
    wanAxisX - (CENTER_CHANNEL_WIDTH / 2 + GRID_COLUMN_GAP);
  const rightInnerBorderX =
    wanAxisX + (CENTER_CHANNEL_WIDTH / 2 + GRID_COLUMN_GAP);
  const SITE_FRAME_PADDING = 14;

  if (s1) {
    const width = getSiteWidth(s1.id);
    const visualWidth = width + SITE_FRAME_PADDING * 2;
    sitePositions.set(s1.id, {
      x: leftInnerBorderX - visualWidth,
      y: row1Y,
    });
  }
  if (s2) {
    sitePositions.set(s2.id, {
      x: rightInnerBorderX,
      y: row1Y,
    });
  }
  if (s3 && !s4) {
    const width = getSiteWidth(s3.id);
    sitePositions.set(s3.id, {
      x: centerX + CENTER_CHANNEL_WIDTH / 2 - width / 2,
      y: row3Y,
    });
  }
  if (s3 && s4) {
    const width3 = getSiteWidth(s3.id);
    const visualWidth3 = width3 + SITE_FRAME_PADDING * 2;
    sitePositions.set(s3.id, {
      x: leftInnerBorderX - visualWidth3,
      y: row3Y,
    });
    sitePositions.set(s4.id, {
      x: rightInnerBorderX,
      y: row3Y,
    });
  }

  const SITE_H_PADDING_POS = 24; // recuo horizontal interno para posicionamento
  const leftColumnSiteIdsInFourSiteLayout =
    s3 && s4
      ? new Set(
          [s1?.id, s3?.id].filter(
            (siteId): siteId is string => typeof siteId === 'string',
          ),
        )
      : null;

  for (const site of limitedSites) {
    const sitePos = sitePositions.get(site.id);
    if (!sitePos) continue;
    const siteWidth = getSiteWidth(site.id);
    const uniformLayerWidth = siteMaxLayerWidths.get(site.id) ?? 0;
    const rowsByGroup = siteRowGroups.get(site.id) ?? new Map();

    const netGroupKeys = Array.from(rowsByGroup.keys());
    const isMultiNetworkPos =
      netGroupKeys.length > 1 ||
      (netGroupKeys.length === 1 && netGroupKeys[0] !== null);

    // Posiciona uma linha (1 ou 2 camadas lado a lado) centralizada dentro
    // de `columnWidth`, a partir de `originX` (nunca com offset menor que
    // `minOffset`); devolve a altura usada.
    const placeRow = (
      row: GridLayoutLayer[],
      originX: number,
      columnWidth: number,
      y: number,
      minOffset = 0,
    ) => {
      const rowWidth = computeRowWidth(row);
      const rowXOffset = Math.max(minOffset, (columnWidth - rowWidth) / 2);
      let cursorX = originX + rowXOffset;
      for (const layer of row) {
        layerPositions.set(layer.id, { x: cursorX, y });
        cursorX += layer.width + TIER_ROW_GAP;
      }
      return computeRowHeight(row);
    };

    if (!isMultiNetworkPos) {
      // Coluna única — comportamento legado (centralizado)
      const rows = rowsByGroup.get(null) ?? [];
      let cursorY = sitePos.y + LAYER_TOP_OFFSET;
      for (const row of rows) {
        const rowHeight = placeRow(row, sitePos.x, siteWidth, cursorY, 24);
        cursorY += rowHeight + LAYER_VERTICAL_GAP;
      }
    } else {
      // Redes lado a lado — cada rede ocupa uma coluna
      const netColumnCount = netGroupKeys.length;
      const occupiedWidth =
        netColumnCount * uniformLayerWidth +
        (netColumnCount - 1) * INTER_NETWORK_GAP;
      const leftAlignedStart = sitePos.x + SITE_H_PADDING_POS;
      const rightAlignedStart =
        sitePos.x +
        Math.max(
          SITE_H_PADDING_POS,
          siteWidth - SITE_H_PADDING_POS - occupiedWidth,
        );

      const shouldRightAlignInsideSite = Boolean(
        leftColumnSiteIdsInFourSiteLayout?.has(site.id),
      );

      let colX = shouldRightAlignInsideSite
        ? rightAlignedStart
        : leftAlignedStart;
      for (const [, rows] of rowsByGroup) {
        if (rows.length === 0) continue;
        let cursorY = sitePos.y + LAYER_TOP_OFFSET;
        for (const row of rows) {
          const rowHeight = placeRow(row, colX, uniformLayerWidth, cursorY);
          cursorY += rowHeight + LAYER_VERTICAL_GAP;
        }
        colX += uniformLayerWidth + INTER_NETWORK_GAP;
      }
    }
  }

  const wanTop = hasMiddleRow ? Math.max(28, row1Y - 74) : WAN_Y;
  const wanPosition = {
    x: wanAxisX,
    y: wanTop,
  };

  return {
    sitePositions,
    layerPositions,
    siteHeights,
    siteWidths,
    siteMaxLayerWidths,
    wanPosition,
  };
}

export function figureByCategory(category: string) {
  if (category === 'load-balancer') return 'Trapezoid';
  if (category === 'access-point') return 'BpmnActivityLoop';
  if (category === 'ids' || category === 'ips') return 'Hexagon';
  if (category === 'proxy' || category === 'modem') return 'Parallelogram1';
  if (category === 'dns' || category === 'dhcp') return 'Database';
  if (category === 'nas') return 'Cylinder1';
  if (category === 'printer') return 'Card';
  if (category === 'voip') return 'ManualOperation';
  if (category === 'firewall') return 'Diamond';
  if (category === 'router') return 'Circle';
  if (category === 'switch') return 'Rectangle';
  if (category === 'pc') return 'RoundedRectangle';
  if (category === 'server') return 'File';
  if (category === 'wan') return 'Cloud';
  if (
    category === 'vpn' ||
    category === 'ipsec' ||
    category === 'wireguard' ||
    category === 'mpls' ||
    category === 'gre' ||
    category === 'sdwan'
  ) {
    return 'Hexagon';
  }
  return 'Triangle';
}

export function colorByCategory(category: string) {
  if (category === 'load-balancer') return '#f59e0b';
  if (category === 'access-point') return '#06b6d4';
  if (category === 'ids') return '#f97316';
  if (category === 'ips') return '#ef4444';
  if (category === 'proxy') return '#14b8a6';
  if (category === 'modem') return '#eab308';
  if (category === 'dns') return '#10b981';
  if (category === 'dhcp') return '#84cc16';
  if (category === 'nas') return '#6366f1';
  if (category === 'printer') return '#94a3b8';
  if (category === 'printer-3d') return '#f0abfc';
  if (category === 'voip') return '#fb7185';
  if (category === 'firewall') return '#fb7185';
  if (category === 'router') return '#22d3ee';
  if (category === 'switch') return '#60a5fa';
  if (category === 'pc') return '#facc15';
  if (category === 'smartphone') return '#34d399';
  if (category === 'server') return '#a78bfa';
  if (category === 'wan') return '#4ade80';
  if (
    category === 'vpn' ||
    category === 'ipsec' ||
    category === 'wireguard' ||
    category === 'mpls' ||
    category === 'gre' ||
    category === 'sdwan'
  ) {
    return '#f472b6';
  }
  return '#94a3b8';
}

export function resolveLinkVisual(
  kind: string,
  fromCategory?: string,
  toCategory?: string,
  opts?: { stateful?: boolean; passthrough?: boolean },
) {
  const stateful = opts?.stateful ?? true;
  const passthrough = opts?.passthrough ?? false;

  if (passthrough) {
    return { stroke: '#64748b', dash: undefined, width: 1.2 };
  }

  const edge = [fromCategory, toCategory].filter(Boolean);
  const hasSecurity = edge.some((cat) =>
    ['firewall', 'ids', 'ips', 'proxy'].includes(String(cat)),
  );
  const hasVpnEdge = edge.some((cat) =>
    ['vpn', 'ipsec', 'wireguard', 'mpls', 'gre', 'sdwan'].includes(String(cat)),
  );

  if (kind === 'vpn' || kind === 'ipsec' || hasVpnEdge) {
    return { stroke: '#22d3ee', dash: [9, 5], width: 2.2 };
  }
  if (kind === 'wan' || fromCategory === 'wan' || toCategory === 'wan') {
    if (!stateful) return { stroke: '#f59e0b', dash: [4, 3], width: 2.0 };
    return { stroke: '#fb923c', dash: undefined, width: 2.6 };
  }
  if (hasSecurity) {
    if (!stateful) return { stroke: '#f59e0b', dash: [4, 3], width: 2.0 };
    return { stroke: '#f97316', dash: [2, 4], width: 2.1 };
  }
  if (kind === 'lan') {
    return { stroke: '#60a5fa', dash: undefined, width: 1.8 };
  }
  return { stroke: '#fbbf24', dash: [10, 6], width: 1.8 };
}

export function resolveLinkDescription(
  kind: string,
  fromLabel: string,
  toLabel: string,
  fromCategory?: string,
  toCategory?: string,
  bidirectional = false,
) {
  const arrow = bidirectional ? '<->' : '->';
  if (kind === 'wan' || fromCategory === 'wan' || toCategory === 'wan') {
    return `WAN uplink: ${fromLabel} ${arrow} ${toLabel}`;
  }
  if (kind === 'vpn' || kind === 'ipsec') {
    return `Tunel seguro: ${fromLabel} ${arrow} ${toLabel}`;
  }
  if (kind === 'lan') {
    return `LAN interna: ${fromLabel} ${arrow} ${toLabel}`;
  }
  return `${fromLabel} ${arrow} ${toLabel}`;
}
