import type { NodeItem, Site } from '../../../features/network/types';
import {
  BASE_Y,
  CENTER_CHANNEL_WIDTH,
  DIAGRAM_SIDE_PADDING,
  EMPTY_SITE_HEIGHT,
  GRID_COLUMN_GAP,
  GRID_ROW_GAP,
  LAYER_TOP_OFFSET,
  LAYER_VERTICAL_GAP,
  SITE_BOTTOM_PADDING,
  SITE_CONTAINER_WIDTH,
  WAN_Y,
} from '../constants';
import type { GridLayoutResult, TooltipPlacement } from '../types';

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
  layers: Array<{
    id: string;
    siteId: string;
    order: number;
    width: number;
    height: number;
  }>;
  diagramWidth: number;
}): GridLayoutResult {
  const limitedSites = sites.slice(0, 4);
  const siteWidths = new Map<string, number>();
  const siteHeights = new Map<string, number>();
  const siteMaxLayerWidths = new Map<string, number>();
  const layerPositions = new Map<string, { x: number; y: number }>();
  const sitePositions = new Map<string, { x: number; y: number }>();

  for (const site of limitedSites) {
    const siteLayers = layers
      .filter((layer) => layer.siteId === site.id)
      .sort((a, b) => a.order - b.order);

    const maxLayerWidth = siteLayers.reduce(
      (acc, layer) => Math.max(acc, layer.width),
      0,
    );
    siteMaxLayerWidths.set(site.id, maxLayerWidth);
    const width = Math.max(
      SITE_CONTAINER_WIDTH,
      Math.min(
        988,
        maxLayerWidth > 0 ? maxLayerWidth + 64 : SITE_CONTAINER_WIDTH,
      ),
    );

    let stackedHeight = LAYER_TOP_OFFSET;
    siteLayers.forEach((layer, index) => {
      stackedHeight += layer.height;
      if (index < siteLayers.length - 1) stackedHeight += LAYER_VERTICAL_GAP;
    });
    stackedHeight += SITE_BOTTOM_PADDING;

    siteWidths.set(site.id, width);
    siteHeights.set(site.id, Math.max(EMPTY_SITE_HEIGHT, stackedHeight));
  }

  const s1 = limitedSites[0];
  const s2 = limitedSites[1];
  const s3 = limitedSites[2];
  const s4 = limitedSites[3];

  const leftCandidates = [s1, s3].filter(Boolean) as Site[];
  const rightCandidates = [s2, s4].filter(Boolean) as Site[];

  const leftColWidth = Math.max(
    SITE_CONTAINER_WIDTH,
    ...leftCandidates.map(
      (site) => siteWidths.get(site.id) ?? SITE_CONTAINER_WIDTH,
    ),
  );
  const rightColWidth = Math.max(
    SITE_CONTAINER_WIDTH,
    ...rightCandidates.map(
      (site) => siteWidths.get(site.id) ?? SITE_CONTAINER_WIDTH,
    ),
  );

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

  const row3Sites = [s3, s4].filter(Boolean) as Site[];
  const row3Height =
    row3Sites.length > 0
      ? Math.max(
          ...row3Sites.map(
            (site) => siteHeights.get(site.id) ?? EMPTY_SITE_HEIGHT,
          ),
        )
      : 0;

  const row1Y = BASE_Y;
  const row2Y = row1Y + row1Height + GRID_ROW_GAP;
  const row3Y = row2Y + middleRowHeight + GRID_ROW_GAP;

  if (s1) {
    const width = siteWidths.get(s1.id) ?? SITE_CONTAINER_WIDTH;
    sitePositions.set(s1.id, {
      x: leftX + (effectiveLeftColWidth - width) / 2,
      y: row1Y,
    });
  }
  if (s2) {
    const width = siteWidths.get(s2.id) ?? SITE_CONTAINER_WIDTH;
    sitePositions.set(s2.id, {
      x: rightX + (effectiveRightColWidth - width) / 2,
      y: row1Y,
    });
  }
  if (s3 && !s4) {
    const width = siteWidths.get(s3.id) ?? SITE_CONTAINER_WIDTH;
    sitePositions.set(s3.id, {
      x: centerX + CENTER_CHANNEL_WIDTH / 2 - width / 2,
      y: row3Y,
    });
  }
  if (s3 && s4) {
    const width3 = siteWidths.get(s3.id) ?? SITE_CONTAINER_WIDTH;
    const width4 = siteWidths.get(s4.id) ?? SITE_CONTAINER_WIDTH;
    sitePositions.set(s3.id, {
      x: leftX + (effectiveLeftColWidth - width3) / 2,
      y: row3Y,
    });
    sitePositions.set(s4.id, {
      x: rightX + (effectiveRightColWidth - width4) / 2,
      y: row3Y,
    });
  }

  for (const site of limitedSites) {
    const sitePos = sitePositions.get(site.id);
    if (!sitePos) continue;
    const siteLayers = layers
      .filter((layer) => layer.siteId === site.id)
      .sort((a, b) => a.order - b.order);
    const siteWidth = siteWidths.get(site.id) ?? SITE_CONTAINER_WIDTH;
    const uniformLayerWidth = siteMaxLayerWidths.get(site.id) ?? 0;

    let cursorY = sitePos.y + LAYER_TOP_OFFSET;
    siteLayers.forEach((layer) => {
      const layerXOffset = Math.max(24, (siteWidth - uniformLayerWidth) / 2);
      layerPositions.set(layer.id, {
        x: sitePos.x + layerXOffset,
        y: cursorY,
      });
      cursorY += layer.height + LAYER_VERTICAL_GAP;
    });
  }

  const wanTop = hasMiddleRow ? Math.max(28, row1Y - 74) : WAN_Y;
  const wanPosition = {
    x: centerX + CENTER_CHANNEL_WIDTH / 2,
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
) {
  if (kind === 'wan' || fromCategory === 'wan' || toCategory === 'wan') {
    return `WAN uplink: ${fromLabel} -> ${toLabel}`;
  }
  if (kind === 'vpn' || kind === 'ipsec') {
    return `Tunel seguro: ${fromLabel} -> ${toLabel}`;
  }
  if (kind === 'lan') {
    return `LAN interna: ${fromLabel} -> ${toLabel}`;
  }
  return `${fromLabel} -> ${toLabel}`;
}

export function isInsideLayerBounds(
  x: number,
  y: number,
  layerX: number,
  layerY: number,
  layerWidth: number,
  layerHeight: number,
) {
  const margin = 28;
  return (
    x >= layerX + margin &&
    x <= layerX + layerWidth - margin &&
    y >= layerY + margin &&
    y <= layerY + layerHeight - margin
  );
}

export function getLayerFallbackPosition(
  layerX: number,
  layerY: number,
  layerWidth: number,
  layerHeight: number,
  index: number,
) {
  const cols = Math.max(1, Math.min(4, Math.floor((layerWidth - 40) / 105)));
  const col = index % cols;
  const row = Math.floor(index / cols);
  const x = layerX + 54 + col * 98;
  const y = layerY + 54 + row * 76;
  return {
    x: Math.max(layerX + 28, Math.min(layerX + layerWidth - 28, x)),
    y: Math.max(layerY + 28, Math.min(layerY + layerHeight - 28, y)),
  };
}
