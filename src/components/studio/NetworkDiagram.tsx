import * as go from 'gojs';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  addLink,
  resizeLayer,
  setZoom,
  toggleNodeVlanAssignment,
  updateNodeTechField,
  updateSite,
  updateNode,
  updateNodePosition,
} from '../../features/network/networkSlice';
import type { NodeItem } from '../../features/network/types';
import {
  ensureTechProfile,
  getTechProfileWarnings,
  getVisibleTechSchema,
} from '../../features/network/techProfiles';
import {
  BASE_Y,
  DEFAULT_DIAGRAM_WIDTH,
  buildGridLayout,
  calculateTooltipPosition,
  colorByCategory,
  getNetworkDiagramCopy,
  getLayerFallbackPosition,
  getNodeIconSrc,
  getNodeVisual,
  getSiteHeaderIp,
  isInsideLayerBounds,
  parseTechValue,
  parseVlans,
  resolveLinkDescription,
  resolveLinkVisual,
  type DiagramTooltip,
  type SiteTooltip,
  type StudioLanguage,
} from './catalog';

type NetworkDiagramProps = {
  language: StudioLanguage;
};

export default function NetworkDiagram({ language }: NetworkDiagramProps) {
  const dispatch = useAppDispatch();
  const diagramDivRef = useRef<HTMLDivElement | null>(null);
  const diagramRef = useRef<go.Diagram | null>(null);
  const nodesByIdRef = useRef<Map<string, NodeItem>>(new Map());
  const vlanAssignmentRef = useRef<{ siteId: string; vlanId: number } | null>(
    null,
  );
  const [diagramWidth, setDiagramWidth] = useState(DEFAULT_DIAGRAM_WIDTH);
  const [activeTooltip, setActiveTooltip] = useState<DiagramTooltip | null>(
    null,
  );
  const [activeSiteTooltip, setActiveSiteTooltip] =
    useState<SiteTooltip | null>(null);

  const { sites, layers, nodes, links, ui } = useAppSelector(
    (state) => state.network,
  );
  const copy = getNetworkDiagramCopy(language);

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

  const linkData = useMemo(() => {
    const nodeById = new Map(nodes.map((node) => [node.id, node]));

    return links.map((link) => {
      const fromNode = nodeById.get(link.from);
      const toNode = nodeById.get(link.to);
      const visual = resolveLinkVisual(
        link.kind,
        fromNode?.category,
        toNode?.category,
      );
      const description = resolveLinkDescription(
        link.kind,
        fromNode?.label ?? link.from,
        toNode?.label ?? link.to,
        fromNode?.category,
        toNode?.category,
      );

      return {
        key: link.id,
        from: link.from,
        to: link.to,
        label: description,
        stroke: visual.stroke,
        dash: visual.dash,
        baseWidth: visual.width,
      };
    });
  }, [links, nodes]);

  useEffect(() => {
    nodesByIdRef.current = new Map(nodes.map((node) => [node.id, node]));
  }, [nodes]);

  useEffect(() => {
    vlanAssignmentRef.current = ui.vlanAssignment;
  }, [ui.vlanAssignment]);

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

    const existingDiagram = go.Diagram.fromDiv(diagramDivRef.current);
    if (existingDiagram) {
      existingDiagram.div = null;
    }

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
        mouseEnter: (_event, obj) => {
          const node = obj as go.Node;
          node.isHighlighted = true;
          node.findLinksConnected().each((link) => {
            link.isHighlighted = true;
          });
        },
        mouseLeave: (_event, obj) => {
          const node = obj as go.Node;
          node.isHighlighted = false;
          node.findLinksConnected().each((link) => {
            link.isHighlighted = false;
          });
        },
        click: (_event, obj) => {
          const node = obj as go.Node;

          const activeAssignment = vlanAssignmentRef.current;
          if (activeAssignment) {
            const nodeId = String(node.data?.nodeId ?? '');
            const nodeState = nodesByIdRef.current.get(nodeId);
            if (nodeState && nodeState.siteId === activeAssignment.siteId) {
              dispatch(
                toggleNodeVlanAssignment({
                  nodeId,
                  siteId: activeAssignment.siteId,
                  vlanId: activeAssignment.vlanId,
                }),
              );
              return;
            }
          }

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
          new go.Binding('strokeWidth', 'isHighlighted', (h) =>
            h ? 2.4 : 1,
          ).ofObject(),
          new go.Binding('width', 'isHighlighted', (h) =>
            h ? 108 : 98,
          ).ofObject(),
          new go.Binding('height', 'isHighlighted', (h) =>
            h ? 92 : 84,
          ).ofObject(),
        ),
        $(
          go.Picture,
          {
            name: 'ICON',
            width: 38,
            height: 38,
            alignment: new go.Spot(0.5, 0.27, 0, 0),
            imageStretch: go.ImageStretch.Uniform,
            background: 'transparent',
          },
          new go.Binding('source', 'iconSrc'),
          new go.Binding('width', 'isHighlighted', (h) =>
            h ? 44 : 38,
          ).ofObject(),
          new go.Binding('height', 'isHighlighted', (h) =>
            h ? 44 : 38,
          ).ofObject(),
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
        fromSpot: go.Spot.AllSides,
        toSpot: go.Spot.AllSides,
        fromEndSegmentLength: 14,
        toEndSegmentLength: 14,
      },
      new go.Binding('layerName', 'isHighlighted', (h) =>
        h ? 'Foreground' : '',
      ).ofObject(),
      $(
        go.Shape,
        {
          isPanelMain: true,
          strokeWidth: 0,
          stroke: '#38bdf8',
          opacity: 0,
        },
        new go.Binding('stroke', 'stroke'),
        new go.Binding('strokeDashArray', 'dash'),
        new go.Binding('strokeWidth', 'isHighlighted', (h) =>
          h ? 9 : 0,
        ).ofObject(),
        new go.Binding('opacity', 'isHighlighted', (h) =>
          h ? 0.28 : 0,
        ).ofObject(),
      ),
      $(
        go.Shape,
        {
          isPanelMain: true,
          stroke: '#38bdf8',
          strokeWidth: 1.8,
        },
        new go.Binding('stroke', 'stroke'),
        new go.Binding('strokeDashArray', 'dash'),
        new go.Binding('strokeWidth', 'baseWidth'),
        new go.Binding('strokeWidth', 'isHighlighted', (h, obj) => {
          const base = Number((obj.part as go.Link).data?.baseWidth ?? 1.8);
          return h ? base + 2.2 : base;
        }).ofObject(),
      ),
      $(
        go.Panel,
        'Auto',
        { segmentFraction: 0.5, visible: false },
        new go.Binding('visible', 'isHighlighted', (h) =>
          Boolean(h),
        ).ofObject(),
        $(go.Shape, 'RoundedRectangle', {
          fill: '#060d19',
          stroke: '#1d3353',
        }),
        $(
          go.TextBlock,
          {
            margin: new go.Margin(2, 5, 2, 5),
            stroke: '#b9d6f6',
            font: '700 7px "Share Tech Mono"',
          },
          new go.Binding('text', 'label'),
          new go.Binding('font', 'isHighlighted', (h) =>
            h ? '700 15px "Share Tech Mono"' : '700 7px "Share Tech Mono"',
          ).ofObject(),
        ),
      ),
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
          const layerOrder = tooltipNode.layerId
            ? (layers.find((layer) => layer.id === tooltipNode.layerId)
                ?.order ?? 1)
            : 0;
          const shouldBeGateway =
            Boolean(tooltipNode.siteId) &&
            (tooltipNode.category === 'router' ||
              tooltipNode.category === 'firewall') &&
            layerOrder === 1;
          const siteNodeCount = tooltipNode.siteId
            ? nodes.filter((node) => node.siteId === tooltipNode.siteId).length
            : 0;
          const techProfile = ensureTechProfile(
            tooltipNode.category,
            tooltipNode.techProfile,
            {
              layerOrder,
              shouldBeGateway,
              siteNodeCount,
            },
          );
          const techFields = getVisibleTechSchema(
            techProfile.kind,
            techProfile.fields,
          );
          const techWarnings = getTechProfileWarnings(
            tooltipNode.category,
            techProfile,
            {
              layerOrder,
              shouldBeGateway,
              siteNodeCount,
            },
          );

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
                  aria-label={copy.close}
                >
                  ✕
                </button>
              </div>

              <div className="gojs-tooltip-body">
                <div className="gojs-tooltip-row">
                  <span className="gojs-tooltip-label">{copy.id}:</span>
                  <span className="gojs-tooltip-value">{tooltipNode.id}</span>
                </div>

                <label className="gojs-tooltip-row">
                  <span className="gojs-tooltip-label">{copy.name}:</span>
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
                      <span className="gojs-tooltip-label">{copy.vlans}:</span>
                      <input
                        value={tooltipNode.vlans.join(',')}
                        placeholder={copy.noVlanAssigned}
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
                      {copy.wanNoLocalIp}
                    </span>
                  </div>
                )}

                <label className="gojs-tooltip-row">
                  <span className="gojs-tooltip-label">{copy.info}:</span>
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

                {techWarnings.length > 0 && (
                  <div className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-2 text-[11px] text-amber-200">
                    <div className="mb-1 font-semibold uppercase tracking-wide text-amber-300">
                      {copy.validations}
                    </div>
                    <div className="space-y-1">
                      {techWarnings.map((warning) => (
                        <div key={warning}>- {warning}</div>
                      ))}
                    </div>
                  </div>
                )}

                {techFields.length > 0 && (
                  <div className="gojs-tooltip-section">
                    <div className="gojs-tooltip-label">{copy.technicalProfile}:</div>
                    <div className="space-y-2">
                      {techFields.map((field) => {
                        const value = techProfile.fields[field.key];

                        if (field.type === 'boolean') {
                          return (
                            <label key={field.key} className="gojs-tooltip-row">
                              <span className="gojs-tooltip-label">
                                {field.label}:
                              </span>
                              <select
                                value={String(Boolean(value))}
                                onChange={(event) =>
                                  dispatch(
                                    updateNodeTechField({
                                      id: tooltipNode.id,
                                      key: field.key,
                                      value: event.target.value === 'true',
                                    }),
                                  )
                                }
                                className="w-full rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1 text-[11px] text-slate-100"
                              >
                                <option value="true">{copy.yes}</option>
                                <option value="false">{copy.no}</option>
                              </select>
                            </label>
                          );
                        }

                        if (field.type === 'select') {
                          const options = field.options ?? [];
                          const selected =
                            typeof value === 'string' && value.length > 0
                              ? value
                              : (options[0] ?? '');
                          return (
                            <label key={field.key} className="gojs-tooltip-row">
                              <span className="gojs-tooltip-label">
                                {field.label}:
                              </span>
                              <select
                                value={selected}
                                onChange={(event) =>
                                  dispatch(
                                    updateNodeTechField({
                                      id: tooltipNode.id,
                                      key: field.key,
                                      value: event.target.value,
                                    }),
                                  )
                                }
                                className="w-full rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1 text-[11px] text-slate-100"
                              >
                                {options.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            </label>
                          );
                        }

                        return (
                          <label key={field.key} className="gojs-tooltip-row">
                            <span className="gojs-tooltip-label">
                              {field.label}:
                            </span>
                            <input
                              type={field.type === 'number' ? 'number' : 'text'}
                              min={
                                field.type === 'number' ? field.min : undefined
                              }
                              max={
                                field.type === 'number' ? field.max : undefined
                              }
                              value={String(value ?? '')}
                              onChange={(event) =>
                                dispatch(
                                  updateNodeTechField({
                                    id: tooltipNode.id,
                                    key: field.key,
                                    value: parseTechValue(
                                      field,
                                      event.target.value,
                                    ),
                                  }),
                                )
                              }
                              className="w-full rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1 text-[11px] text-slate-100"
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
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
                  <div className="gojs-tooltip-title">{copy.siteDetails}</div>
                </div>
                <button
                  className="gojs-tooltip-close-btn"
                  onClick={() => setActiveSiteTooltip(null)}
                  aria-label={copy.close}
                >
                  ✕
                </button>
              </div>

              <div className="gojs-tooltip-body">
                <div className="gojs-tooltip-row">
                  <span className="gojs-tooltip-label">{copy.id}:</span>
                  <span className="gojs-tooltip-value">{tooltipSite.id}</span>
                </div>

                <label className="gojs-tooltip-row">
                  <span className="gojs-tooltip-label">{copy.name}:</span>
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
                  <span className="gojs-tooltip-label">{copy.octet}:</span>
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
