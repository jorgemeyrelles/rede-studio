import * as go from 'gojs';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  addLink,
  resizeLayer,
  setZoom,
  updateSite,
  updateNode,
  updateNodePosition,
} from '../../features/network/networkSlice';
import type { NodeItem, Site } from '../../features/network/types';
import { getNodeIconSrc, getNodeVisual } from './catalog';

const BASE_Y = 120;
const SITE_CONTAINER_WIDTH = 360;
const DEFAULT_DIAGRAM_WIDTH = 1240;
const WAN_Y = 46;
const DIAGRAM_SIDE_PADDING = 16;
const GRID_COLUMN_GAP = 26;
const GRID_ROW_GAP = 34;
const LAYER_TOP_OFFSET = 62;
const LAYER_VERTICAL_GAP = 22;
const SITE_BOTTOM_PADDING = 24;
const CENTER_CHANNEL_WIDTH = 140;
const EMPTY_SITE_HEIGHT = 190;

type TooltipPlacement = 'bottom' | 'right' | 'left' | 'top';

type DiagramTooltip = {
  nodeId: string;
  x: number;
  y: number;
  preferredPlacement?: TooltipPlacement;
};

type SiteTooltip = {
  siteId: string;
  x: number;
  y: number;
};

function parseVlans(raw: string) {
  return raw
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((num) => Number.isFinite(num) && num > 0 && num < 4095);
}

function calculateTooltipPosition({
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

function getSiteHeaderIp(site: Site, nodes: NodeItem[]) {
  const siteNodes = nodes.filter((node) => node.siteId === site.id);
  const preferred =
    siteNodes.find((node) => node.category === 'router') ?? siteNodes[0];
  if (preferred) return `${preferred.ip}/${preferred.cidr}`;
  return `200.${site.ipOctet}.1.1/${site.cidr}`;
}

type GridLayoutResult = {
  sitePositions: Map<string, { x: number; y: number }>;
  layerPositions: Map<string, { x: number; y: number }>;
  siteHeights: Map<string, number>;
  siteWidths: Map<string, number>;
  wanPosition: { x: number; y: number };
};

function buildGridLayout({
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
    const width = Math.max(
      SITE_CONTAINER_WIDTH,
      Math.min(
        760,
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

    let cursorY = sitePos.y + LAYER_TOP_OFFSET;
    siteLayers.forEach((layer) => {
      const layerXOffset = Math.max(24, (siteWidth - layer.width) / 2);
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
    wanPosition,
  };
}

function figureByCategory(category: string) {
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

function colorByCategory(category: string) {
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
  if (category === 'voip') return '#fb7185';
  if (category === 'firewall') return '#fb7185';
  if (category === 'router') return '#22d3ee';
  if (category === 'switch') return '#60a5fa';
  if (category === 'pc') return '#facc15';
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

function isInsideLayerBounds(
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

function getLayerFallbackPosition(
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

export default function NetworkDiagram() {
  const dispatch = useAppDispatch();
  const diagramDivRef = useRef<HTMLDivElement | null>(null);
  const diagramRef = useRef<go.Diagram | null>(null);
  const [diagramWidth, setDiagramWidth] = useState(DEFAULT_DIAGRAM_WIDTH);
  const [activeTooltip, setActiveTooltip] = useState<DiagramTooltip | null>(
    null,
  );
  const [activeSiteTooltip, setActiveSiteTooltip] =
    useState<SiteTooltip | null>(null);

  const { sites, layers, nodes, links } = useAppSelector(
    (state) => state.network,
  );

  const layout = useMemo(
    () => buildGridLayout({ sites, layers, diagramWidth }),
    [diagramWidth, layers, sites],
  );

  const tooltipNode = useMemo(() => {
    if (!activeTooltip) return null;
    return nodes.find((node) => node.id === activeTooltip.nodeId) ?? null;
  }, [activeTooltip, nodes]);

  const tooltipSite = useMemo(() => {
    if (!activeSiteTooltip) return null;
    return sites.find((site) => site.id === activeSiteTooltip.siteId) ?? null;
  }, [activeSiteTooltip, sites]);

  const nodeData = useMemo(() => {
    const items: Array<Record<string, unknown>> = [];
    const limitedSites = sites.slice(0, 4);
    const layerRectById = new Map<
      string,
      { x: number; y: number; w: number; h: number }
    >();

    for (const layer of layers) {
      const pos = layout.layerPositions.get(layer.id);
      if (!pos) continue;
      layerRectById.set(layer.id, {
        x: pos.x,
        y: pos.y,
        w: layer.width,
        h: layer.height,
      });
    }

    const nodesByLayer = new Map<string, NodeItem[]>();
    for (const node of nodes) {
      if (!node.layerId) continue;
      const list = nodesByLayer.get(node.layerId) ?? [];
      list.push(node);
      nodesByLayer.set(node.layerId, list);
    }

    for (const site of limitedSites) {
      items.push({
        key: site.id,
        text: `${site.name} (${getSiteHeaderIp(site, nodes)})`,
        isGroup: true,
        category: 'site',
        loc: `${layout.sitePositions.get(site.id)?.x ?? 16} ${layout.sitePositions.get(site.id)?.y ?? BASE_Y}`,
      });

      const siteLayers = layers
        .filter((layer) => layer.siteId === site.id)
        .sort((a, b) => a.order - b.order);

      siteLayers.forEach((layer) => {
        const layerPos = layout.layerPositions.get(layer.id);
        items.push({
          key: layer.id,
          text: layer.name,
          group: site.id,
          isGroup: true,
          category: 'layer',
          size: `${layer.width} ${layer.height}`,
          loc: `${layerPos?.x ?? 20} ${layerPos?.y ?? BASE_Y + 62}`,
          layerId: layer.id,
        });
      });
    }

    for (const node of nodes) {
      const isWan = node.category === 'wan';
      const visual = getNodeVisual(node.category);
      let loc = `${node.x} ${node.y}`;

      if (!isWan && node.layerId) {
        const rect = layerRectById.get(node.layerId);
        if (rect) {
          const inBounds = isInsideLayerBounds(
            node.x,
            node.y,
            rect.x,
            rect.y,
            rect.w,
            rect.h,
          );
          if (!inBounds) {
            const indexInLayer = (
              nodesByLayer.get(node.layerId) ?? []
            ).findIndex((candidate) => candidate.id === node.id);
            const fallback = getLayerFallbackPosition(
              rect.x,
              rect.y,
              rect.w,
              rect.h,
              Math.max(0, indexInLayer),
            );
            loc = `${fallback.x} ${fallback.y}`;
          }
        }
      }

      items.push({
        key: node.id,
        group: node.layerId,
        text: node.label,
        marker: visual.short,
        category: node.category,
        iconSrc: getNodeIconSrc(node.category),
        loc: isWan ? `${layout.wanPosition.x} ${layout.wanPosition.y}` : loc,
        nodeId: node.id,
      });
    }

    return items;
  }, [
    layout.layerPositions,
    layout.sitePositions,
    layout.wanPosition,
    layers,
    nodes,
    sites,
  ]);

  const linkData = useMemo(
    () =>
      links.map((link) => ({
        key: link.id,
        from: link.from,
        to: link.to,
      })),
    [links],
  );

  useEffect(() => {
    const node = diagramDivRef.current;
    if (!node) return;

    setDiagramWidth(node.clientWidth || DEFAULT_DIAGRAM_WIDTH);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (width > 0) {
          setDiagramWidth(width);
        }
      }
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveTooltip(null);
        setActiveSiteTooltip(null);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  useEffect(() => {
    if (!diagramDivRef.current || diagramRef.current) return;

    const $ = go.GraphObject.make;

    const diagram = $(go.Diagram, diagramDivRef.current, {
      'undoManager.isEnabled': true,
      initialAutoScale: go.AutoScale.Uniform,
      contentAlignment: go.Spot.Center,
      allowZoom: true,
      'linkingTool.isEnabled': true,
      'relinkingTool.isEnabled': true,
      'linkingTool.direction': go.LinkingDirection.ForwardsOnly,
    });

    const openTooltipForNode = (node: go.Node, anchor?: go.GraphObject) => {
      const nodeId = node.data?.nodeId;
      if (typeof nodeId !== 'string') return;
      const diagramRefLocal = node.diagram;
      if (!diagramRefLocal) return;
      const anchorPoint = anchor
        ? anchor.getDocumentPoint(go.Spot.TopRight)
        : node.getDocumentPoint(go.Spot.TopRight);
      const viewPoint = diagramRefLocal.transformDocToView(anchorPoint);
      const isWan = node.data?.category === 'wan';
      setActiveTooltip({
        nodeId,
        x: viewPoint.x,
        y: viewPoint.y,
        preferredPlacement: isWan ? 'bottom' : undefined,
      });
      setActiveSiteTooltip(null);
    };

    const openTooltipForSite = (group: go.Group, anchor?: go.GraphObject) => {
      const siteId = group.data?.key;
      if (typeof siteId !== 'string') return;
      const diagramRefLocal = group.diagram;
      if (!diagramRefLocal) return;
      const anchorPoint = anchor
        ? anchor.getDocumentPoint(go.Spot.TopRight)
        : group.getDocumentPoint(go.Spot.TopRight);
      const viewPoint = diagramRefLocal.transformDocToView(anchorPoint);
      setActiveSiteTooltip({
        siteId,
        x: viewPoint.x,
        y: viewPoint.y,
      });
      setActiveTooltip(null);
    };

    diagram.groupTemplateMap.add(
      'site',
      $(
        go.Group,
        'Vertical',
        {
          movable: false,
          locationSpot: go.Spot.TopLeft,
          computesBoundsAfterDrag: true,
          computesBoundsIncludingLinks: false,
        },
        new go.Binding('location', 'loc', go.Point.parse),
        $(
          go.Panel,
          'Horizontal',
          {
            defaultAlignment: go.Spot.Center,
            margin: new go.Margin(0, 0, 6, 0),
          },
          $(
            go.TextBlock,
            {
              stroke: '#a5f3fc',
              font: '700 13px Barlow',
              margin: new go.Margin(0, 6, 0, 0),
            },
            new go.Binding('text', 'text'),
          ),
          $(
            go.Panel,
            'Auto',
            {
              name: 'SITEINFOBTN',
              width: 16,
              height: 16,
              cursor: 'pointer',
              click: (_event, obj) => {
                const group = obj.part as go.Group | null;
                if (!group) return;
                openTooltipForSite(group, obj);
              },
            },
            $(go.Shape, 'Circle', {
              fill: '#5a9fd4',
              stroke: '#2a6ba6',
              strokeWidth: 1,
            }),
            $(go.TextBlock, {
              text: 'i',
              font: 'bold 10px sans-serif',
              stroke: '#fff',
              textAlign: 'center',
            }),
          ),
        ),
        $(
          go.Panel,
          'Auto',
          $(go.Shape, 'RoundedRectangle', {
            fill: 'rgba(15, 23, 42, 0.35)',
            stroke: '#334155',
            strokeWidth: 1.5,
          }),
          $(go.Placeholder, { padding: 14 }),
        ),
      ),
    );

    diagram.groupTemplateMap.add(
      'layer',
      $(
        go.Group,
        'Vertical',
        {
          movable: false,
          resizable: true,
          locationSpot: go.Spot.TopLeft,
        },
        new go.Binding('location', 'loc', go.Point.parse),
        $(
          go.TextBlock,
          {
            stroke: '#f8fafc',
            font: '600 12px Barlow',
            margin: new go.Margin(0, 0, 4, 2),
          },
          new go.Binding('text', 'text'),
        ),
        $(
          go.Panel,
          'Auto',
          $(
            go.Shape,
            'RoundedRectangle',
            {
              fill: 'rgba(2, 6, 23, 0.55)',
              stroke: '#475569',
              strokeDashArray: [5, 4],
              minSize: new go.Size(220, 140),
            },
            new go.Binding('desiredSize', 'size', go.Size.parse).makeTwoWay(
              go.Size.stringify,
            ),
          ),
        ),
      ),
    );

    diagram.nodeTemplate = $(
      go.Node,
      'Spot',
      {
        locationSpot: go.Spot.Center,
        movable: true,
        click: (_event, obj) => {
          const node = obj as go.Node;
          openTooltipForNode(node);
        },
      },
      new go.Binding('movable', 'category', (category) => category !== 'wan'),
      new go.Binding('location', 'loc', go.Point.parse),
      $(
        go.Panel,
        'Auto',
        $(
          go.Shape,
          {
            name: 'BODY',
            figure: 'RoundedRectangle',
            fill: '#060d19',
            stroke: '#1d3353',
            strokeWidth: 1,
            width: 98,
            height: 84,
            portId: '',
            fromLinkable: true,
            toLinkable: true,
            fromSpot: go.Spot.AllSides,
            toSpot: go.Spot.AllSides,
            cursor: 'pointer',
          },
          new go.Binding('stroke', 'category', colorByCategory),
        ),
        $(
          go.Picture,
          {
            width: 38,
            height: 38,
            alignment: new go.Spot(0.5, 0.27, 0, 0),
            imageStretch: go.ImageStretch.Uniform,
            background: 'transparent',
          },
          new go.Binding('source', 'iconSrc'),
        ),
        $(
          go.TextBlock,
          {
            margin: new go.Margin(42, 6, 13, 6),
            stroke: '#d8e7fb',
            font: '700 10px Barlow',
            textAlign: 'center',
            maxSize: new go.Size(90, NaN),
          },
          new go.Binding('text', 'text'),
        ),
        $(
          go.TextBlock,
          {
            alignment: new go.Spot(0.5, 1, 0, -4),
            stroke: '#9ec9f2',
            font: '700 9px "Share Tech Mono"',
          },
          new go.Binding('text', 'marker', (marker) => `[${String(marker)}]`),
        ),
      ),
      $(
        go.Panel,
        'Auto',
        {
          name: 'INFOBTN',
          alignment: go.Spot.TopRight,
          alignmentFocus: go.Spot.TopRight,
          width: 18,
          height: 18,
          margin: new go.Margin(6, 6, 0, 0),
          cursor: 'pointer',
          click: (_event, obj) => {
            const node = obj.part as go.Node | null;
            if (!node) return;
            openTooltipForNode(node, obj);
          },
        },
        $(go.Shape, 'Circle', {
          fill: '#5a9fd4',
          stroke: '#2a6ba6',
          strokeWidth: 1,
        }),
        $(go.TextBlock, {
          text: 'i',
          font: 'bold 10px sans-serif',
          stroke: '#fff',
          textAlign: 'center',
          verticalAlignment: go.Spot.Center,
        }),
      ),
    );

    diagram.linkTemplate = $(
      go.Link,
      {
        routing: go.Routing.AvoidsNodes,
        curve: go.Curve.JumpGap,
        corner: 8,
      },
      $(go.Shape, { stroke: '#38bdf8', strokeWidth: 1.8 }),
      $(go.Shape, { toArrow: 'Standard', fill: '#38bdf8', stroke: null }),
    );

    diagram.addDiagramListener('LinkDrawn', (event) => {
      const link = event.subject as go.Link;
      const from = String(link.data.from ?? '');
      const to = String(link.data.to ?? '');
      if (!from || !to) return;
      dispatch(addLink({ from, to }));
    });

    diagram.addDiagramListener('SelectionMoved', (event) => {
      event.subject.each((part: go.Part) => {
        if (!(part instanceof go.Node)) return;
        const data = part.data as { nodeId?: string };
        if (!data?.nodeId) return;
        dispatch(
          updateNodePosition({
            id: data.nodeId,
            x: part.location.x,
            y: part.location.y,
          }),
        );
      });
    });

    diagram.addDiagramListener('PartResized', (event) => {
      const part = event.subject?.part as go.Part | undefined;
      if (!(part instanceof go.Group)) return;
      const data = part.data as { layerId?: string };
      if (!data?.layerId) return;
      const shape = part.resizeObject;
      if (!shape) return;
      dispatch(
        resizeLayer({
          layerId: data.layerId,
          width: shape.desiredSize.width,
          height: shape.desiredSize.height,
        }),
      );
    });

    diagram.addDiagramListener('ViewportBoundsChanged', () => {
      dispatch(setZoom(diagram.scale));
    });

    diagram.addDiagramListener('BackgroundSingleClicked', () => {
      setActiveTooltip(null);
      setActiveSiteTooltip(null);
    });

    diagramRef.current = diagram;

    return () => {
      diagram.div = null;
      diagramRef.current = null;
    };
  }, [dispatch]);

  useEffect(() => {
    const diagram = diagramRef.current;
    if (!diagram) return;

    const model = new go.GraphLinksModel(nodeData, linkData);
    model.linkKeyProperty = 'key';

    diagram.model = model;
  }, [linkData, nodeData]);

  useEffect(() => {
    const diagram = diagramRef.current;
    if (!diagram) return;
    diagram.zoomToFit();
  }, [diagramWidth, layers, sites]);

  useEffect(() => {
    if (!activeTooltip) return;
    if (!nodes.some((node) => node.id === activeTooltip.nodeId)) {
      setActiveTooltip(null);
    }
  }, [activeTooltip, nodes]);

  useEffect(() => {
    if (!activeSiteTooltip) return;
    if (!sites.some((site) => site.id === activeSiteTooltip.siteId)) {
      setActiveSiteTooltip(null);
    }
  }, [activeSiteTooltip, sites]);

  return (
    <div className="relative h-[660px] rounded-lg border border-slate-700 bg-slate-950/70">
      <div
        ref={diagramDivRef}
        className="h-full w-full"
        aria-label="Network Studio"
      />

      {activeTooltip &&
        tooltipNode &&
        diagramDivRef.current &&
        (() => {
          const rect = diagramDivRef.current!.getBoundingClientRect();
          const position = calculateTooltipPosition({
            iconX: activeTooltip.x,
            iconY: activeTooltip.y,
            containerWidth: rect.width,
            containerHeight: rect.height,
            tooltipWidth: 320,
            tooltipHeight: tooltipNode.category === 'wan' ? 210 : 300,
            preferredPlacement: activeTooltip.preferredPlacement,
          });

          const visual = getNodeVisual(tooltipNode.category);
          const isWan = tooltipNode.category === 'wan';

          return (
            <div
              className="gojs-tooltip-modal"
              style={{
                position: 'absolute',
                left: `${position.left}px`,
                top: `${position.top}px`,
                zIndex: 15,
              }}
            >
              <div className="gojs-tooltip-header">
                <div className="gojs-tooltip-head-main">
                  <img
                    src={getNodeIconSrc(tooltipNode.category)}
                    alt={visual.label}
                    className="gojs-tooltip-icon"
                  />
                  <div className="gojs-tooltip-title">{tooltipNode.label}</div>
                </div>
                <button
                  className="gojs-tooltip-close-btn"
                  onClick={() => setActiveTooltip(null)}
                  aria-label="Fechar"
                >
                  ✕
                </button>
              </div>

              <div className="gojs-tooltip-body">
                <div className="gojs-tooltip-row">
                  <span className="gojs-tooltip-label">ID:</span>
                  <span className="gojs-tooltip-value">{tooltipNode.id}</span>
                </div>

                <label className="gojs-tooltip-row">
                  <span className="gojs-tooltip-label">Nome:</span>
                  <input
                    value={tooltipNode.label}
                    onChange={(event) =>
                      dispatch(
                        updateNode({
                          id: tooltipNode.id,
                          changes: { label: event.target.value },
                        }),
                      )
                    }
                    className="w-full rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1 text-[11px] text-slate-100"
                  />
                </label>

                {!isWan && (
                  <>
                    <label className="gojs-tooltip-row">
                      <span className="gojs-tooltip-label">IPv4:</span>
                      <input
                        value={tooltipNode.ip}
                        onChange={(event) =>
                          dispatch(
                            updateNode({
                              id: tooltipNode.id,
                              changes: { ip: event.target.value },
                            }),
                          )
                        }
                        className="w-full rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1 text-[11px] text-slate-100"
                      />
                    </label>

                    <label className="gojs-tooltip-row">
                      <span className="gojs-tooltip-label">CIDR:</span>
                      <input
                        type="number"
                        min={1}
                        max={32}
                        value={tooltipNode.cidr}
                        onChange={(event) =>
                          dispatch(
                            updateNode({
                              id: tooltipNode.id,
                              changes: { cidr: Number(event.target.value) },
                            }),
                          )
                        }
                        className="w-full rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1 text-[11px] text-slate-100"
                      />
                    </label>

                    <label className="gojs-tooltip-row">
                      <span className="gojs-tooltip-label">VLANs:</span>
                      <input
                        value={tooltipNode.vlans.join(',')}
                        onChange={(event) =>
                          dispatch(
                            updateNode({
                              id: tooltipNode.id,
                              changes: {
                                vlans: parseVlans(event.target.value),
                              },
                            }),
                          )
                        }
                        className="w-full rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1 text-[11px] text-slate-100"
                      />
                    </label>
                  </>
                )}

                {isWan && (
                  <div className="gojs-tooltip-row">
                    <span className="gojs-tooltip-value">
                      WAN/Internet nao possui atribuicao de IP local no Studio.
                    </span>
                  </div>
                )}

                <label className="gojs-tooltip-row">
                  <span className="gojs-tooltip-label">Info:</span>
                  <textarea
                    value={tooltipNode.description}
                    onChange={(event) =>
                      dispatch(
                        updateNode({
                          id: tooltipNode.id,
                          changes: { description: event.target.value },
                        }),
                      )
                    }
                    className="h-16 w-full rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1 text-[11px] text-slate-100"
                  />
                </label>
              </div>
            </div>
          );
        })()}

      {activeSiteTooltip &&
        tooltipSite &&
        diagramDivRef.current &&
        (() => {
          const rect = diagramDivRef.current!.getBoundingClientRect();
          const position = calculateTooltipPosition({
            iconX: activeSiteTooltip.x,
            iconY: activeSiteTooltip.y,
            containerWidth: rect.width,
            containerHeight: rect.height,
            tooltipWidth: 320,
            tooltipHeight: 250,
          });

          return (
            <div
              className="gojs-tooltip-modal"
              style={{
                position: 'absolute',
                left: `${position.left}px`,
                top: `${position.top}px`,
                zIndex: 16,
              }}
            >
              <div className="gojs-tooltip-header">
                <div className="gojs-tooltip-head-main">
                  <div className="gojs-tooltip-title">Detalhes do Site</div>
                </div>
                <button
                  className="gojs-tooltip-close-btn"
                  onClick={() => setActiveSiteTooltip(null)}
                  aria-label="Fechar"
                >
                  ✕
                </button>
              </div>

              <div className="gojs-tooltip-body">
                <div className="gojs-tooltip-row">
                  <span className="gojs-tooltip-label">ID:</span>
                  <span className="gojs-tooltip-value">{tooltipSite.id}</span>
                </div>

                <label className="gojs-tooltip-row">
                  <span className="gojs-tooltip-label">Nome:</span>
                  <input
                    value={tooltipSite.name}
                    onChange={(event) =>
                      dispatch(
                        updateSite({
                          id: tooltipSite.id,
                          changes: { name: event.target.value },
                        }),
                      )
                    }
                    className="w-full rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1 text-[11px] text-slate-100"
                  />
                </label>

                <label className="gojs-tooltip-row">
                  <span className="gojs-tooltip-label">Octeto:</span>
                  <input
                    type="number"
                    min={1}
                    max={254}
                    value={tooltipSite.ipOctet}
                    onChange={(event) =>
                      dispatch(
                        updateSite({
                          id: tooltipSite.id,
                          changes: { ipOctet: Number(event.target.value) },
                        }),
                      )
                    }
                    className="w-full rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1 text-[11px] text-slate-100"
                  />
                </label>

                <label className="gojs-tooltip-row">
                  <span className="gojs-tooltip-label">CIDR:</span>
                  <input
                    type="number"
                    min={1}
                    max={32}
                    value={tooltipSite.cidr}
                    onChange={(event) =>
                      dispatch(
                        updateSite({
                          id: tooltipSite.id,
                          changes: { cidr: Number(event.target.value) },
                        }),
                      )
                    }
                    className="w-full rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1 text-[11px] text-slate-100"
                  />
                </label>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
