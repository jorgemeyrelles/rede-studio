import * as go from 'gojs';
import {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
    addLink,
    removeLink,
    resizeLayer,
    setActiveLinkId,
    setZoom,
    toggleNodeVlanAssignment,
    updateNode,
    updateNodePosition,
    updateNodeTechField,
    updateSite,
} from '../../features/network/networkSlice';
import {
    ensureTechProfile,
    getTechProfileWarnings,
    getVisibleTechSchema,
} from '../../features/network/techProfiles';
import type { NodeItem } from '../../features/network/types';
import {
    buildNetworkAddress,
    cidrToHostCount,
    getAvailableVlanCapacityForNode,
    getNodeReservedRange,
    getSiteReserveRange,
} from '../../features/network/utils';
import {
    BASE_Y,
    CENTER_CHANNEL_WIDTH,
    DEFAULT_DIAGRAM_WIDTH,
    DIAGRAM_SIDE_PADDING,
    GRID_COLUMN_GAP,
    buildGridLayout,
    calculateTooltipPosition,
    colorByCategory,
    getLayerFallbackPosition,
    getNetworkDiagramCopy,
    getNodeIconSrc,
    getNodeVisual,
    getSiteHeaderIp,
    isInsideLayerBounds,
    parseCsvItems,
    parseTechValue,
    parseVlans,
    resolveLinkDescription,
    resolveLinkVisual,
    serializeCsvItems,
    type CreatableOption,
    type DiagramTooltip,
    type NetworkDiagramProps,
    type NetworkTooltip,
    type SiteTooltip,
} from './catalog';

function CreatableMultiSelectField({
  values,
  options,
  placeholder,
  onChange,
}: {
  values: string[];
  options: CreatableOption[];
  placeholder: string;
  onChange: (next: string[]) => void;
}) {
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [customValue, setCustomValue] = useState('');

  const exists = (value: string) =>
    values.some((item) => item.toLowerCase() === value.toLowerCase());

  const addValue = (raw: string) => {
    const value = raw.trim();
    if (!value || exists(value)) return;
    onChange([...values, value]);
    setCustomValue('');
  };

  const addSelected = () => {
    if (!selectedOption) return;
    addValue(selectedOption);
  };

  const removeValue = (target: string) => {
    onChange(values.filter((value) => value !== target));
  };

  return (
    <div className="w-full space-y-1">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-1">
        <select
          value={selectedOption}
          onChange={(event) => setSelectedOption(event.target.value)}
          className="w-full rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1 text-[11px] text-slate-100"
        >
          <option value="">Selecionar opção...</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={addSelected}
          className="rounded border border-cyan-700/60 bg-cyan-900/30 px-2 py-1 text-[10px] font-semibold text-cyan-200 hover:bg-cyan-800/40"
        >
          +
        </button>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-1">
        <input
          value={customValue}
          onChange={(event) => setCustomValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addValue(customValue);
            }
          }}
          placeholder={placeholder}
          className="w-full rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1 font-mono text-[11px] text-slate-100"
        />
        <button
          type="button"
          onClick={() => addValue(customValue)}
          className="rounded border border-emerald-700/60 bg-emerald-900/30 px-2 py-1 text-[10px] font-semibold text-emerald-200 hover:bg-emerald-800/40"
        >
          Add
        </button>
      </div>

      <div className="max-h-[88px] overflow-y-auto rounded border border-[#2a4565] bg-[#091527]/75 p-1">
        {values.length === 0 ? (
          <div className="text-[10px] italic text-slate-500">Sem itens.</div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {values.map((value) => (
              <span
                key={value}
                className="inline-flex max-w-full items-center gap-1 rounded border border-violet-700/50 bg-violet-900/25 px-1.5 py-0.5 text-[10px] text-violet-100"
              >
                <span className="truncate font-mono">{value}</span>
                <button
                  type="button"
                  onClick={() => removeValue(value)}
                  className="rounded px-1 text-[9px] text-rose-300 hover:bg-rose-900/40"
                  aria-label={`Remover ${value}`}
                >
                  x
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export type NetworkDiagramHandle = {
  exportImageDataForPdf: (options?: {
    showLinkDescriptions?: boolean;
  }) => string | null;
};

const NetworkDiagram = forwardRef<NetworkDiagramHandle, NetworkDiagramProps>(
  function NetworkDiagram({ language }, ref) {
    const dispatch = useAppDispatch();
    const diagramDivRef = useRef<HTMLDivElement | null>(null);
    const diagramRef = useRef<go.Diagram | null>(null);
    const lastFitCenterRequestHandledRef = useRef(0);
    const nodesByIdRef = useRef<Map<string, NodeItem>>(new Map());
    const vlanAssignmentRef = useRef<{ siteId: string; vlanId: number } | null>(
      null,
    );
    const layersRef = useRef<typeof layers>([]);
    const activeLinkIdRef = useRef<string | null>(null);
    const [diagramWidth, setDiagramWidth] = useState(DEFAULT_DIAGRAM_WIDTH);
    const [activeTooltip, setActiveTooltip] = useState<DiagramTooltip | null>(
      null,
    );
    const [activeSiteTooltip, setActiveSiteTooltip] =
      useState<SiteTooltip | null>(null);
    const [activeNetworkTooltip, setActiveNetworkTooltip] =
      useState<NetworkTooltip | null>(null);
    const [fitCenterRequest, setFitCenterRequest] = useState(0);

    const { sites, layers, nodes, links, siteVlans, ui, siteNetworks } =
      useAppSelector((state) => state.network);
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

    const tooltipNetwork = useMemo(() => {
      if (!activeNetworkTooltip) return null;
      return (
        siteNetworks.find((n) => n.id === activeNetworkTooltip.networkId) ??
        null
      );
    }, [activeNetworkTooltip, siteNetworks]);

    const nodeData = useMemo(() => {
      const NETWORK_PURPOSE_COLORS: Record<string, string> = {
        principal: '#3b82f6',
        dmz: '#f97316',
        gestao: '#8b5cf6',
        cliente: '#22c55e',
        backup: '#f59e0b',
        custom: '#64748b',
      };

      const items: Array<Record<string, unknown>> = [];
      const limitedSites = sites.slice(0, 4);
      const sitePalette = ['#38bdf8', '#22c55e', '#f59e0b', '#f43f5e'];
      const siteVisualById = new Map<
        string,
        { stroke: string; siteFill: string; layerFill: string }
      >();
      const layerRectById = new Map<
        string,
        { x: number; y: number; w: number; h: number }
      >();

      limitedSites.forEach((site, index) => {
        const stroke = sitePalette[index % sitePalette.length];
        siteVisualById.set(site.id, {
          stroke,
          siteFill: `${stroke}22`,
          layerFill: `${stroke}12`,
        });
      });

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
        const visual = siteVisualById.get(site.id) ?? {
          stroke: '#38bdf8',
          siteFill: '#38bdf822',
          layerFill: '#38bdf812',
        };

        items.push({
          key: site.id,
          text: `${site.name} (${getSiteHeaderIp(site, nodes)})`,
          isGroup: true,
          category: 'site',
          siteStroke: visual.stroke,
          siteFill: visual.siteFill,
          siteMinSize: `${Math.max(1, layout.siteWidths.get(site.id) ?? 1)} 0`,
          loc: `${layout.sitePositions.get(site.id)?.x ?? 16} ${layout.sitePositions.get(site.id)?.y ?? BASE_Y}`,
        });

        // Fase 2: sub-containers de rede dentro do site
        (siteNetworks ?? [])
          .filter((n) => n.siteId === site.id)
          .forEach((net) => {
            const baseAddr = buildNetworkAddress(
              net.addressFamily,
              net.thirdOctet,
              site.ipOctet,
            );
            items.push({
              key: net.id,
              text: `${net.name} — ${baseAddr}/${net.cidr}`,
              group: site.id,
              isGroup: true,
              category: 'network',
              networkColor: NETWORK_PURPOSE_COLORS[net.purpose] ?? '#64748b',
            });
          });

        const siteLayers = layers
          .filter((layer) => layer.siteId === site.id)
          .sort((a, b) => a.order - b.order);

        siteLayers.forEach((layer) => {
          const layerPos = layout.layerPositions.get(layer.id);
          const uniformLayerWidth =
            layout.siteMaxLayerWidths.get(site.id) ?? layer.width;
          items.push({
            key: layer.id,
            text: layer.name,
            group: layer.networkId ?? site.id,
            isGroup: true,
            category: 'layer',
            layerStroke: visual.stroke,
            layerFill: visual.layerFill,
            size: `${uniformLayerWidth} ${layer.height}`,
            loc: `${layerPos?.x ?? 20} ${layerPos?.y ?? BASE_Y + 62}`,
            layerId: layer.id,
            minHeight: layer.minHeight,
            maxHeight: layer.maxHeight,
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
          // P3 — cores das VLANs às quais o nó pertence
          vlanColors: (node.vlans ?? [])
            .map((vlanId) => {
              const vlan = siteVlans.find(
                (v) => v.siteId === node.siteId && v.vlanId === vlanId,
              );
              return vlan?.color ?? null;
            })
            .filter(Boolean) as string[],
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
      siteNetworks,
      siteVlans,
    ]);

    const linkData = useMemo(() => {
      const nodeById = new Map(nodes.map((node) => [node.id, node]));

      return links.map((link) => {
        const fromNode = nodeById.get(link.from);
        const toNode = nodeById.get(link.to);

        // Compute stateful/passthrough for visual
        const fwNode = [fromNode, toNode].find(
          (n) => n?.category === 'firewall',
        );
        const stateMode = String(
          fwNode?.techProfile?.fields?.stateMode ?? 'stateful',
        );
        const isStateful =
          link.statefulOverride === 'force-stateful'
            ? true
            : link.statefulOverride === 'force-stateless'
              ? false
              : stateMode !== 'stateless';
        const hasFw =
          fromNode?.category === 'firewall' || toNode?.category === 'firewall';
        const isPassthrough =
          !hasFw &&
          link.kind !== 'vpn' &&
          link.kind !== 'ipsec' &&
          link.kind !== 'wan';

        const visual = resolveLinkVisual(
          link.kind,
          fromNode?.category,
          toNode?.category,
          { stateful: isStateful, passthrough: isPassthrough },
        );
        const description = resolveLinkDescription(
          link.kind,
          fromNode?.label ?? link.from,
          toNode?.label ?? link.to,
          fromNode?.category,
          toNode?.category,
          link.bidirectional ?? true,
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
      layersRef.current = layers;
    }, [layers]);

    useEffect(() => {
      activeLinkIdRef.current = ui.activeLinkId;
    }, [ui.activeLinkId]);

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
          setActiveNetworkTooltip(null);
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
        initialAutoScale: go.AutoScale.None,
        contentAlignment: go.Spot.Default,
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
        setActiveNetworkTooltip(null);
      };

      const openTooltipForNetwork = (
        group: go.Group,
        anchor?: go.GraphObject,
      ) => {
        const networkId = group.data?.key;
        if (typeof networkId !== 'string') return;
        const diagramRefLocal = group.diagram;
        if (!diagramRefLocal) return;
        const anchorPoint = anchor
          ? anchor.getDocumentPoint(go.Spot.TopRight)
          : group.getDocumentPoint(go.Spot.TopRight);
        const viewPoint = diagramRefLocal.transformDocToView(anchorPoint);
        setActiveNetworkTooltip({
          networkId,
          x: viewPoint.x,
          y: viewPoint.y,
        });
        setActiveTooltip(null);
        setActiveSiteTooltip(null);
      };

      diagram.groupTemplateMap.add(
        'network',
        $(
          go.Group,
          'Vertical',
          {
            movable: false,
            locationSpot: go.Spot.TopLeft,
            computesBoundsAfterDrag: true,
            computesBoundsIncludingLinks: false,
          },
          $(
            go.Panel,
            'Horizontal',
            {
              defaultAlignment: go.Spot.Center,
              margin: new go.Margin(0, 0, 2, 0),
            },
            $(
              go.TextBlock,
              {
                stroke: '#7dd3fc',
                font: '600 11px Barlow',
                margin: new go.Margin(0, 4, 0, 6),
              },
              new go.Binding('text', 'text'),
            ),
            $(
              go.Panel,
              'Auto',
              {
                name: 'NETWORKINFOBTN',
                width: 14,
                height: 14,
                cursor: 'pointer',
                click: (_event, obj) => {
                  const group = obj.part as go.Group | null;
                  if (!group) return;
                  openTooltipForNetwork(group, obj);
                },
              },
              $(go.Shape, 'Circle', {
                fill: '#3b82f6',
                stroke: '#1d4ed8',
                strokeWidth: 1,
              }),
              $(go.TextBlock, {
                text: 'i',
                font: 'bold 9px sans-serif',
                stroke: '#fff',
                textAlign: 'center',
                verticalAlignment: go.Spot.Center,
              }),
            ),
          ),
          $(
            go.Panel,
            'Auto',
            $(
              go.Shape,
              'RoundedRectangle',
              {
                fill: 'rgba(30,60,100,0.15)',
                stroke: '#1e3a5f',
                strokeWidth: 1,
                strokeDashArray: [6, 3],
              },
              new go.Binding('stroke', 'networkColor'),
            ),
            $(go.Placeholder, { padding: 10 }),
          ),
        ),
      );

      diagram.groupTemplateMap.add(
        'site',
        $(
          go.Group,
          'Vertical',
          {
            movable: false,
            locationSpot: go.Spot.TopLeft,
            locationObjectName: 'SITE_BODY',
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
            {
              name: 'SITE_BODY',
            },
            $(
              go.Shape,
              'RoundedRectangle',
              {
                fill: 'rgba(15, 23, 42, 0.35)',
                stroke: '#334155',
                strokeWidth: 1.5,
              },
              new go.Binding('fill', 'siteFill'),
              new go.Binding('stroke', 'siteStroke'),
            ),
            $(
              go.Placeholder,
              { padding: 14 },
              new go.Binding('minSize', 'siteMinSize', go.Size.parse),
            ),
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
            selectable: true,
            resizeObjectName: 'LAYER_BG',
            locationSpot: go.Spot.TopLeft,
            mouseEnter: (_event, obj) => {
              (obj as go.Group).isHighlighted = true;
            },
            mouseLeave: (_event, obj) => {
              (obj as go.Group).isHighlighted = false;
            },
          },
          new go.Binding('location', 'loc', go.Point.parse),
          $(
            go.TextBlock,
            {
              stroke: '#f8fafc',
              font: '600 12px Barlow',
              margin: new go.Margin(0, 0, 4, 2),
              pickable: false,
            },
            new go.Binding('text', 'text'),
          ),
          $(
            go.Panel,
            'Spot',
            $(
              go.Panel,
              'Auto',
              $(
                go.Shape,
                'RoundedRectangle',
                {
                  name: 'LAYER_BG',
                  fill: 'rgba(2, 6, 23, 0.55)',
                  stroke: '#475569',
                  strokeDashArray: [5, 4],
                },
                new go.Binding('fill', 'layerFill'),
                new go.Binding('stroke', 'layerStroke'),
                new go.Binding('desiredSize', 'size', go.Size.parse).makeTwoWay(
                  go.Size.stringify,
                ),
                // Mínimo = altura na criação; máximo = ~3 nós empilhados
                new go.Binding(
                  'minSize',
                  'minHeight',
                  (h) => new go.Size(286, Number(h) || 180),
                ),
                new go.Binding(
                  'maxSize',
                  'maxHeight',
                  (h) => new go.Size(NaN, Number(h) || 300),
                ),
              ),
            ),
            // ▶ Indicador de resize — borda direita
            $(
              go.Shape,
              'TriangleRight',
              {
                alignment: new go.Spot(1, 0.5, -3, 0),
                alignmentFocus: go.Spot.Right,
                width: 7,
                height: 13,
                fill: '#94a3b8',
                stroke: null,
                cursor: 'e-resize',
                pickable: false,
                visible: false,
              },
              new go.Binding('visible', 'isHighlighted').ofObject(),
            ),
            // ▼ Indicador de resize — borda inferior
            $(
              go.Shape,
              'TriangleDown',
              {
                alignment: new go.Spot(0.5, 1, 0, -3),
                alignmentFocus: go.Spot.Bottom,
                width: 13,
                height: 7,
                fill: '#94a3b8',
                stroke: null,
                cursor: 's-resize',
                pickable: false,
                visible: false,
              },
              new go.Binding('visible', 'isHighlighted').ofObject(),
            ),
          ),
        ),
      );

      diagram.nodeTemplate = $(
        go.Node,
        'Spot',
        {
          locationSpot: go.Spot.Center,
          avoidable: true,
          avoidableMargin: new go.Margin(14, 18, 14, 18),
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
              width: 90,
              height: 77,
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
              h ? 98 : 90,
            ).ofObject(),
            new go.Binding('height', 'isHighlighted', (h) =>
              h ? 85 : 77,
            ).ofObject(),
          ),
          $(
            go.Picture,
            {
              name: 'ICON',
              width: 35,
              height: 35,
              alignment: new go.Spot(0.5, 0.28, 0, 0),
              imageStretch: go.ImageStretch.Uniform,
              background: 'transparent',
            },
            new go.Binding('source', 'iconSrc'),
            new go.Binding('width', 'isHighlighted', (h) =>
              h ? 42 : 35,
            ).ofObject(),
            new go.Binding('height', 'isHighlighted', (h) =>
              h ? 42 : 35,
            ).ofObject(),
          ),
          $(
            go.TextBlock,
            {
              margin: new go.Margin(42, 6, 11, 6),
              stroke: '#d8e7fb',
              font: '700 12px Barlow',
              textAlign: 'center',
              maxSize: new go.Size(83, NaN),
            },
            new go.Binding('text', 'text'),
          ),
          $(
            go.TextBlock,
            {
              alignment: new go.Spot(0.5, 1, 0, -5),
              stroke: '#9ec9f2',
              font: '700 11px "Share Tech Mono"',
            },
            new go.Binding('text', 'marker', (marker) => `[${String(marker)}]`),
          ),
        ),
        // P3 — dots de VLAN na quina superior esquerda (até 4 VLANs, lado a lado)
        $(
          go.Panel,
          'Horizontal',
          {
            alignment: new go.Spot(0, 0, 5, 5),
            alignmentFocus: go.Spot.TopLeft,
            visible: false,
          },
          new go.Binding('visible', 'vlanColors', (colors: string[]) =>
            Array.isArray(colors) && colors.length >= 1,
          ),
          $(
            go.Shape,
            'Circle',
            { width: 8, height: 8, margin: 0, stroke: null, fill: 'transparent' },
            new go.Binding('fill', 'vlanColors', (colors: string[]) => colors[0] ?? 'transparent'),
          ),
          $(
            go.Shape,
            'Circle',
            { width: 8, height: 8, margin: 0, stroke: null, fill: 'transparent', visible: false },
            new go.Binding('fill', 'vlanColors', (colors: string[]) => colors[1] ?? 'transparent'),
            new go.Binding('visible', 'vlanColors', (colors: string[]) => Array.isArray(colors) && colors.length >= 2),
          ),
          $(
            go.Shape,
            'Circle',
            { width: 8, height: 8, margin: 0, stroke: null, fill: 'transparent', visible: false },
            new go.Binding('fill', 'vlanColors', (colors: string[]) => colors[2] ?? 'transparent'),
            new go.Binding('visible', 'vlanColors', (colors: string[]) => Array.isArray(colors) && colors.length >= 3),
          ),
          $(
            go.Shape,
            'Circle',
            { width: 8, height: 8, margin: 0, stroke: null, fill: 'transparent', visible: false },
            new go.Binding('fill', 'vlanColors', (colors: string[]) => colors[3] ?? 'transparent'),
            new go.Binding('visible', 'vlanColors', (colors: string[]) => Array.isArray(colors) && colors.length >= 4),
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
          // Camada Foreground — links sempre acima de Groups/Nodes no hit-test
          layerName: 'Foreground',
          routing: go.Routing.AvoidsNodes,
          curve: go.Curve.JumpGap,
          corner: 8,
          fromSpot: go.Spot.AllSides,
          toSpot: go.Spot.AllSides,
          fromEndSegmentLength: 14,
          toEndSegmentLength: 14,
        },
        // Área de hit invisível — facilita clicar em linhas finas
        $(go.Shape, {
          isPanelMain: true,
          strokeWidth: 14,
          stroke: 'transparent',
          opacity: 0,
          pickable: true,
        }),
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
          go.Shape,
          {
            fromArrow: 'Circle',
            stroke: null,
            fill: '#38bdf8',
            scale: 0.9,
          },
          new go.Binding('fill', 'stroke'),
        ),
        $(
          go.Shape,
          {
            toArrow: 'Circle',
            stroke: null,
            fill: '#38bdf8',
            scale: 0.9,
          },
          new go.Binding('fill', 'stroke'),
        ),
        $(
          go.Panel,
          'Auto',
          { name: 'LINK_LABEL_PANEL', segmentFraction: 0.5, visible: false },
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
              name: 'LINK_LABEL_TEXT',
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

      diagram.addDiagramListener('ObjectSingleClicked', (event) => {
        // Tenta o objeto clicado diretamente; caso um Group (camada) tenha
        // interceptado o clique, faz fallback via findObjectsAt para encontrar
        // qualquer link exatamente na posição do clique.
        let link: go.Link | null = null;

        const subjectPart = (event.subject as go.GraphObject).part;
        if (subjectPart instanceof go.Link) {
          link = subjectPart;
        } else {
          const clickPt = event.diagram.lastInput.documentPoint;
          event.diagram.findObjectsAt(clickPt).each((obj: go.GraphObject) => {
            if (!link && obj.part instanceof go.Link) {
              link = obj.part as go.Link;
            }
          });
        }

        if (!link) return;

        event.diagram.clearSelection();
        const linkId = String(
          ((link as go.Link).data as Record<string, unknown>)?.key ?? '',
        );
        if (!linkId) return;
        const current = activeLinkIdRef.current;
        dispatch(setActiveLinkId(current === linkId ? null : linkId));
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
        const newWidth = shape.desiredSize.width;
        const newHeight = shape.desiredSize.height;

        const resizedLayer = layersRef.current.find(
          (l) => l.id === data.layerId,
        );
        if (!resizedLayer) return;

        const uniqueSiteCount = new Set(
          layersRef.current.map((layer) => layer.siteId),
        ).size;
        const columns = uniqueSiteCount <= 1 ? 1 : 2;
        const canvasWidth = Math.max(
          1,
          diagramDivRef.current?.clientWidth ?? DEFAULT_DIAGRAM_WIDTH,
        );
        const availableWidth = Math.max(
          resizedLayer.minWidth,
          columns === 1
            ? canvasWidth - DIAGRAM_SIDE_PADDING * 2
            : canvasWidth -
                DIAGRAM_SIDE_PADDING * 2 -
                  CENTER_CHANNEL_WIDTH -
                  GRID_COLUMN_GAP * 2,
        );
        const dynamicMaxWidth = Math.max(
          resizedLayer.minWidth,
          Math.floor(availableWidth / columns),
        );

        // Propaga mesma largura para todas as camadas do mesmo site
        const siblings = layersRef.current.filter(
          (l) => l.siteId === resizedLayer.siteId,
        );
        for (const sibling of siblings) {
          dispatch(
            resizeLayer({
              layerId: sibling.id,
              width: newWidth,
              maxWidth: dynamicMaxWidth,
              height: sibling.id === data.layerId ? newHeight : sibling.height,
            }),
          );
        }
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

      const previousScale = diagram.scale;
      const previousCenter = new go.Point(
        diagram.viewportBounds.centerX,
        diagram.viewportBounds.centerY,
      );

      const restoreViewport = () => {
        diagram.scale = previousScale;
        const viewport = diagram.viewportBounds;
        diagram.position = new go.Point(
          previousCenter.x - viewport.width / 2,
          previousCenter.y - viewport.height / 2,
        );
      };

      const model = new go.GraphLinksModel(nodeData, linkData);
      model.linkKeyProperty = 'key';
      model.addChangedListener((evt: go.ChangedEvent) => {
        if (
          evt.change === go.ChangeType.Remove &&
          evt.modelChange === 'linkDataArray'
        ) {
          const oldLink = evt.oldValue as { key?: string } | null;
          const linkId = String(oldLink?.key ?? '');
          if (linkId) {
            dispatch(removeLink(linkId));
          }
        }
      });

      // Evita animações na troca de model para reduzir flicker visual.
      const previousAnimationState = diagram.animationManager.isEnabled;
      diagram.animationManager.isEnabled = false;
      diagram.model = model;
      diagram.animationManager.isEnabled = previousAnimationState;

      const fitAndCenter = () => {
        diagram.zoomToFit();
        const bounds = diagram.documentBounds;
        const viewport = diagram.viewportBounds;
        diagram.position = new go.Point(
          bounds.centerX - viewport.width / 2,
          bounds.centerY - viewport.height / 2,
        );
      };

      const shouldApplyFitCenter =
        fitCenterRequest !== lastFitCenterRequestHandledRef.current;

      if (shouldApplyFitCenter) {
        fitAndCenter();
        lastFitCenterRequestHandledRef.current = fitCenterRequest;
      } else {
        // Mantém o viewport do usuário quando o modelo é recriado.
        restoreViewport();
      }

      // Segunda passada após o layout interno do GoJS evita salto visual residual.
      const rafId = window.requestAnimationFrame(() => {
        if (diagramRef.current !== diagram) return;
        if (shouldApplyFitCenter) {
          fitAndCenter();
        } else {
          restoreViewport();
        }
      });

      return () => {
        window.cancelAnimationFrame(rafId);
      };
    }, [dispatch, fitCenterRequest, linkData, nodeData]);

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

    useImperativeHandle(ref, () => ({
      exportImageDataForPdf: (options) => {
        const diagram = diagramRef.current;
        if (!diagram) return null;
        const showLinkDescriptions = options?.showLinkDescriptions ?? true;

        const panelStates: Array<{
          panel: go.Panel;
          visible: boolean;
          textBlock: go.TextBlock | null;
          font: string | null;
        }> = [];

        diagram.commit(() => {
          diagram.links.each((link) => {
            const panel = link.findObject(
              'LINK_LABEL_PANEL',
            ) as go.Panel | null;
            const textBlock = link.findObject(
              'LINK_LABEL_TEXT',
            ) as go.TextBlock | null;
            if (!panel) return;

            panelStates.push({
              panel,
              visible: panel.visible,
              textBlock,
              font: textBlock?.font ?? null,
            });

            panel.visible = showLinkDescriptions;
            if (showLinkDescriptions && textBlock) {
              textBlock.font = '700 10px "Share Tech Mono"';
            }
          });
        }, 'prepare-pdf-export');

        const bounds = diagram.documentBounds;
        const margin = 10;
        const imageData = diagram.makeImageData({
          returnType: 'string',
          type: 'image/png',
          background: '#0b172a',
          scale: 1,
          position: new go.Point(bounds.x - margin, bounds.y - margin),
          size: new go.Size(
            bounds.width + margin * 2,
            bounds.height + margin * 2,
          ),
        }) as string;

        diagram.commit(() => {
          for (const state of panelStates) {
            state.panel.visible = state.visible;
            if (state.textBlock && state.font) {
              state.textBlock.font = state.font;
            }
          }
        }, 'restore-pdf-export');

        return imageData;
      },
    }));

    const fitDiagram = () => {
      setFitCenterRequest((prev) => prev + 1);
    };

    const centerDiagram = () => {
      const diagram = diagramRef.current;
      if (!diagram) return;

      const bounds = diagram.documentBounds;
      const viewport = diagram.viewportBounds;

      const targetX = bounds.centerX - viewport.width / 2;
      const targetY = bounds.centerY - viewport.height / 2;
      diagram.position = new go.Point(targetX, targetY);
    };

    return (
      <div className="relative h-[660px] rounded-lg border border-slate-700 bg-slate-950/70">
        <div
          ref={diagramDivRef}
          className="h-full w-full"
          aria-label="Network Studio"
        />

        {/* Botão Enquadrar */}
        <button
          onClick={fitDiagram}
          title="Enquadrar diagrama"
          className="absolute bottom-3 right-12 z-10 flex h-8 w-8 items-center justify-center rounded-md border border-slate-600 bg-slate-900/40 text-slate-400 opacity-30 transition-all duration-200 hover:border-slate-400 hover:bg-slate-800/80 hover:text-slate-100 hover:opacity-100"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
          >
            <path d="M3 3h4v2H5v2H3V3zm14 0v4h-2V5h-2V3h4zM3 17v-4h2v2h2v2H3zm12 0v-2h2v-2h2v4h-4z" />
          </svg>
        </button>

        {/* Botão Centralizar */}
        <button
          onClick={centerDiagram}
          title="Centralizar diagrama"
          className="absolute bottom-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-md border border-slate-600 bg-slate-900/40 text-slate-400 opacity-30 transition-all duration-200 hover:border-slate-400 hover:bg-slate-800/80 hover:text-slate-100 hover:opacity-100"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
          >
            <circle cx="10" cy="10" r="2" />
            <path
              d="M10 3v2M10 15v2M3 10h2M15 10h2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <circle
              cx="10"
              cy="10"
              r="5.5"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
            />
          </svg>
        </button>

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
              tooltipWidth: 461,
              tooltipHeight: tooltipNode.category === 'wan' ? 230 : 360,
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
              ? nodes.filter((node) => node.siteId === tooltipNode.siteId)
                  .length
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
            const primaryVlan =
              tooltipNode.siteId && tooltipNode.vlans.length > 0
                ? (siteVlans.find(
                    (item) =>
                      item.siteId === tooltipNode.siteId &&
                      item.vlanId === tooltipNode.vlans[0],
                  ) ?? null)
                : null;
            const hostCapacity = primaryVlan
              ? getAvailableVlanCapacityForNode(
                  { nodes, siteVlans },
                  tooltipNode,
                  primaryVlan,
                )
              : 1;
            const reservedRange = getNodeReservedRange(tooltipNode);
            const techWarnings = getTechProfileWarnings(
              tooltipNode.category,
              techProfile,
              {
                layerOrder,
                shouldBeGateway,
                siteNodeCount,
              },
            );
            const routingMode = String(techProfile.fields.routingMode ?? 'static');
            const isBgpMode = routingMode === 'bgp' || routingMode === 'mixed';

            const bgpNeighborOptions: CreatableOption[] = isBgpMode
              ? Array.from(
                  new Map(
                    nodes
                      .filter((candidate) => {
                        if (candidate.id === tooltipNode.id) return false;
                        if (candidate.category !== 'router') return false;
                        if (!candidate.siteId || candidate.siteId === tooltipNode.siteId) {
                          return false;
                        }
                        const candidateMode = String(
                          candidate.techProfile?.fields?.routingMode ?? 'static',
                        );
                        if (candidateMode !== 'bgp' && candidateMode !== 'mixed') {
                          return false;
                        }
                        return Boolean(candidate.ip?.trim());
                      })
                      .map((candidate) => {
                        const candidateSite = sites.find(
                          (site) => site.id === candidate.siteId,
                        );
                        const value = candidate.ip?.trim() ?? '';
                        const label = `${value} - ${candidate.label} (${candidateSite?.name ?? candidate.siteId})`;
                        return [value, { value, label }] as const;
                      }),
                  ).values(),
                )
              : [];

            const localNetworkPrefixOptions: CreatableOption[] = tooltipNode.siteId
              ? siteNetworks
                  .filter((network) => network.siteId === tooltipNode.siteId)
                  .map((network) => {
                    const siteRef = sites.find((site) => site.id === network.siteId);
                    const address = buildNetworkAddress(
                      network.addressFamily,
                      network.thirdOctet,
                      siteRef?.ipOctet,
                    );
                    const value = `${address}/${network.cidr}`;
                    return {
                      value,
                      label: `${value} - ${network.name}`,
                    };
                  })
              : [];

            const remoteNetworkPrefixOptions: CreatableOption[] = tooltipNode.siteId
              ? siteNetworks
                  .filter((network) => network.siteId !== tooltipNode.siteId)
                  .map((network) => {
                    const siteRef = sites.find((site) => site.id === network.siteId);
                    const address = buildNetworkAddress(
                      network.addressFamily,
                      network.thirdOctet,
                      siteRef?.ipOctet,
                    );
                    const value = `${address}/${network.cidr}`;
                    return {
                      value,
                      label: `${value} - ${network.name} (${siteRef?.name ?? network.siteId})`,
                    };
                  })
              : [];

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
                    <div className="gojs-tooltip-title">
                      {tooltipNode.label}
                    </div>
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
                        <span className="gojs-tooltip-label">IPv6:</span>
                        <input
                          value={tooltipNode.ipv6 ?? ''}
                          onChange={(event) =>
                            dispatch(
                              updateNode({
                                id: tooltipNode.id,
                                changes: { ipv6: event.target.value },
                              }),
                            )
                          }
                          className="w-full rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1 text-[11px] text-slate-100"
                          placeholder="2001:db8::10"
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
                        <span className="gojs-tooltip-label">
                          {copy.vlans}:
                        </span>
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

                      {primaryVlan && (
                        <>
                          <label className="gojs-tooltip-row">
                            <span className="gojs-tooltip-label">
                              {copy.quantity}:
                            </span>
                            <input
                              type="number"
                              min={1}
                              max={hostCapacity}
                              value={tooltipNode.hostCount}
                              onChange={(event) =>
                                dispatch(
                                  updateNode({
                                    id: tooltipNode.id,
                                    changes: {
                                      hostCount: Number(event.target.value),
                                    },
                                  }),
                                )
                              }
                              className="w-full rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1 text-[11px] text-slate-100"
                            />
                          </label>

                          <div className="gojs-tooltip-row">
                            <span className="gojs-tooltip-label">
                              {copy.maxHostsInVlan}:
                            </span>
                            <span className="gojs-tooltip-value">
                              {hostCapacity}
                            </span>
                          </div>

                          {reservedRange && tooltipNode.hostCount > 1 && (
                            <div className="gojs-tooltip-row">
                              <span className="gojs-tooltip-label">
                                {copy.reservedRange}:
                              </span>
                              <span className="gojs-tooltip-value">
                                {reservedRange.startIp} - {reservedRange.endIp}
                              </span>
                            </div>
                          )}
                        </>
                      )}
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
                      <div className="gojs-tooltip-label">
                        {copy.technicalProfile}:
                      </div>
                      <div className="space-y-2">
                        {techFields.map((field) => {
                          const value = techProfile.fields[field.key];
                          const fieldLabel =
                            field.labels?.[language] ?? field.label;

                          if (
                            tooltipNode.category === 'router' &&
                            isBgpMode &&
                            (field.key === 'bgpNeighbors' ||
                              field.key === 'bgpPrefixListIn' ||
                              field.key === 'bgpPrefixListOut')
                          ) {
                            const options =
                              field.key === 'bgpNeighbors'
                                ? bgpNeighborOptions
                                : field.key === 'bgpPrefixListIn'
                                  ? remoteNetworkPrefixOptions
                                  : localNetworkPrefixOptions;

                            const currentValues = parseCsvItems(String(value ?? ''));

                            return (
                              <label key={field.key} className="gojs-tooltip-row">
                                <span className="gojs-tooltip-label">{fieldLabel}:</span>
                                <CreatableMultiSelectField
                                  values={currentValues}
                                  options={options}
                                  placeholder={
                                    field.key === 'bgpNeighbors'
                                      ? 'Ex: 200.40.1.10'
                                      : 'Ex: 200.40.1.0/24'
                                  }
                                  onChange={(nextValues) =>
                                    dispatch(
                                      updateNodeTechField({
                                        id: tooltipNode.id,
                                        key: field.key,
                                        value: serializeCsvItems(nextValues),
                                      }),
                                    )
                                  }
                                />
                              </label>
                            );
                          }

                          if (field.type === 'boolean') {
                            return (
                              <label
                                key={field.key}
                                className="gojs-tooltip-row"
                              >
                                <span className="gojs-tooltip-label">
                                  {fieldLabel}:
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
                            // Resolve opções: se optionsWhen definido, filtra pelo valor do campo-dependência
                            let options = field.options ?? [];
                            if (field.optionsWhen) {
                              for (const [depKey, mapping] of Object.entries(
                                field.optionsWhen,
                              )) {
                                const depValue = String(
                                  techProfile.fields[depKey] ?? '',
                                );
                                if (mapping[depValue]) {
                                  options = mapping[depValue];
                                  break;
                                }
                              }
                            }
                            // Se o valor atual não está nas opções filtradas, usa o primeiro da lista
                            const currentStr =
                              typeof value === 'string' && value.length > 0
                                ? value
                                : '';
                            const selected = options.includes(currentStr)
                              ? currentStr
                              : (options[0] ?? '');
                            return (
                              <label
                                key={field.key}
                                className="gojs-tooltip-row"
                              >
                                <span className="gojs-tooltip-label">
                                  {fieldLabel}:
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
                                {fieldLabel}:
                              </span>
                              <input
                                type={
                                  field.type === 'number' ? 'number' : 'text'
                                }
                                min={
                                  field.type === 'number'
                                    ? field.min
                                    : undefined
                                }
                                max={
                                  field.type === 'number'
                                    ? field.max
                                    : undefined
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
              tooltipWidth: 461,
              tooltipHeight: 310,
            });
            const siteReserveRange = getSiteReserveRange(tooltipSite);

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

                  <label className="gojs-tooltip-row">
                    <span className="gojs-tooltip-label">
                      {copy.reserveMargin}:
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={tooltipSite.reserveMarginPercent}
                      onChange={(event) =>
                        dispatch(
                          updateSite({
                            id: tooltipSite.id,
                            changes: {
                              reserveMarginPercent: Number(event.target.value),
                            },
                          }),
                        )
                      }
                      className="w-full rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1 text-[11px] text-slate-100"
                    />
                  </label>

                  <div className="gojs-tooltip-row">
                    <span className="gojs-tooltip-label">
                      {copy.reserveRange}:
                    </span>
                    <span className="gojs-tooltip-value">
                      {siteReserveRange.count > 0
                        ? `${siteReserveRange.startIp} - ${siteReserveRange.endIp} (${siteReserveRange.count})`
                        : '0'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

        {activeNetworkTooltip &&
          tooltipNetwork &&
          diagramDivRef.current &&
          (() => {
            const rect = diagramDivRef.current!.getBoundingClientRect();
            const position = calculateTooltipPosition({
              iconX: activeNetworkTooltip.x,
              iconY: activeNetworkTooltip.y,
              containerWidth: rect.width,
              containerHeight: rect.height,
              tooltipWidth: 374,
              tooltipHeight: 180,
            });
            const netSite = sites.find((s) => s.id === tooltipNetwork.siteId);
            const baseAddr = netSite
              ? buildNetworkAddress(
                  tooltipNetwork.addressFamily,
                  tooltipNetwork.thirdOctet,
                  netSite.ipOctet,
                )
              : '—';
            const hostCount = cidrToHostCount(tooltipNetwork.cidr);
            const vlanCount = siteVlans.filter(
              (v) => v.networkId === tooltipNetwork.id,
            ).length;
            const layerCount = layers.filter(
              (l) => l.networkId === tooltipNetwork.id,
            ).length;

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
                    <div className="gojs-tooltip-title">
                      {copy.networkDetails}
                    </div>
                  </div>
                  <button
                    className="gojs-tooltip-close-btn"
                    onClick={() => setActiveNetworkTooltip(null)}
                    aria-label={copy.close}
                  >
                    ✕
                  </button>
                </div>

                <div className="gojs-tooltip-body">
                  <div className="gojs-tooltip-row">
                    <span className="gojs-tooltip-label">{copy.name}:</span>
                    <span className="gojs-tooltip-value">
                      {tooltipNetwork.name}
                    </span>
                  </div>

                  <div className="gojs-tooltip-row">
                    <span className="gojs-tooltip-label">
                      {copy.addressBlock}:
                    </span>
                    <span className="gojs-tooltip-value">
                      {baseAddr}/{tooltipNetwork.cidr}
                    </span>
                  </div>

                  <div className="gojs-tooltip-row">
                    <span className="gojs-tooltip-label">
                      {copy.addressFamily}:
                    </span>
                    <span className="gojs-tooltip-value">
                      {tooltipNetwork.addressFamily}
                    </span>
                  </div>

                  <div className="gojs-tooltip-row">
                    <span className="gojs-tooltip-label">{copy.hosts}:</span>
                    <span className="gojs-tooltip-value">{hostCount}</span>
                  </div>

                  <div className="gojs-tooltip-row">
                    <span className="gojs-tooltip-label">{copy.vlans}:</span>
                    <span className="gojs-tooltip-value">{vlanCount}</span>
                  </div>

                  <div className="gojs-tooltip-row">
                    <span className="gojs-tooltip-label">{copy.layers}:</span>
                    <span className="gojs-tooltip-value">{layerCount}</span>
                  </div>
                </div>
              </div>
            );
          })()}
      </div>
    );
  },
);

export default NetworkDiagram;
