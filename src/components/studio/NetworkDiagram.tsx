import { Crosshair, Maximize, Plus, X } from 'lucide-react';
import {
  getDiagramTheme,
  networkPurposeColor,
  sitePalette,
} from './utils/diagramTheme';
import * as go from 'gojs';
import { AvoidsLinksRouter } from './vendor/gojs/AvoidsLinksRouter';
import {
  placeLinkLabelsStable,
  restoreLinkLabelTexts,
  type LinkLabelOverflow,
} from './utils/linkLabelPlacement';
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
  addLayerColumn,
  addLayerRow,
  addLink,
  removeLayerColumn,
  removeLayerRow,
  removeLink,
  removeNode,
  reorderLayer,
  setActiveLinkId,
  setNodeOriginSite,
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
import {
  MIN_LAYER_COLUMNS,
  MIN_LAYER_ROWS,
} from '../../features/network/constants';
import type { NodeItem } from '../../features/network/types';
import {
  buildNetworkAddress,
  cidrToHostCount,
  getAvailableVlanCapacityForNode,
  getNodeReservedRange,
  getSiteReserveRange,
  isFixedFirstTier,
  isFixedLastTier,
  pixelToCellStrict,
} from '../../features/network/utils';
import {
  BASE_Y,
  DEFAULT_DIAGRAM_WIDTH,
  buildGridLayout,
  calculateTooltipPosition,
  cellToPixel,
  colorByCategory,
  getNetworkDiagramCopy,
  getNodeIconSrc,
  getNodeVisual,
  getSiteHeaderIp,
  parseCsvItems,
  parseTechValue,
  parseVlans,
  RELATION_OPTION_CATEGORIES,
  resolveLayerDrop,
  resolveLinkDescription,
  resolveLinkVisual,
  serializeCsvItems,
  type CreatableOption,
  type DiagramTooltip,
  type NetworkDiagramProps,
  type NetworkTooltip,
  type SiteTooltip,
} from './catalog';
import { ui as studioUi } from './utils/studioUi';

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
          className="w-full rounded-sm border border-line bg-ink-raised-2 px-2 py-1 text-2xs text-chalk outline-none focus:border-accent"
        >
          <option value="">{studioUi().selectOption}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={addSelected}
          aria-label={studioUi().addSelected}
          title={studioUi().addSelected}
          className="inline-flex items-center justify-center rounded-sm border border-line-strong bg-ink-raised-2 px-2 py-1 text-chalk hover:bg-accent/15"
        >
          <Plus size={12} aria-hidden="true" />
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
          className="w-full rounded-sm border border-line bg-ink px-2 py-1 font-mono text-2xs text-chalk"
        />
        <button
          type="button"
          onClick={() => addValue(customValue)}
          className="rounded-sm border border-signal-up/40 bg-signal-up/15 px-2 py-1 text-2xs font-semibold text-signal-up hover:bg-signal-up/15"
        >
          Add
        </button>
      </div>

      <div className="max-h-[88px] overflow-y-auto rounded-sm border border-line bg-ink-raised p-1">
        {values.length === 0 ? (
          <div className="text-2xs italic text-chalk-faint">
            {studioUi().noItems}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {values.map((value) => (
              <span
                key={value}
                className="inline-flex max-w-full items-center gap-1 rounded-sm border border-route-vpn/40 bg-route-vpn/15 px-1.5 py-0.5 text-2xs text-route-vpn"
              >
                <span className="truncate font-mono">{value}</span>
                <button
                  type="button"
                  onClick={() => removeValue(value)}
                  className="rounded-sm px-1 text-2xs text-signal-down hover:bg-signal-down/15"
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

export type DiagramConnectionNote = {
  marker: string;
  from: string;
  to: string;
  description: string;
};

export type NetworkDiagramHandle = {
  exportImageDataForPdf: (options?: {
    showLinkDescriptions?: boolean;
  }) => { imageData: string; connectionNotes: DiagramConnectionNote[] } | null;
};

/** Fonte dos rótulos de conexão (mono, tamanho estável). */
const LINK_LABEL_FONT_PX = 11;
const PDF_LINK_LABEL_FONT_PX = 10;

/**
 * Sprint equipamentos Fase 1 — empurra um nó remoto para fora do retângulo
 * de qualquer site com o qual esteja sobreposto, pela borda mais próxima
 * (heurística de vetor de translação mínimo). Muta `part.location` em GoJS
 * a cada ajuste para que `actualBounds` reflita a nova posição na próxima
 * iteração, e retorna a posição final (mesmo sistema de coordenadas de
 * `part.location`) para ser persistida no Redux.
 */
function pushRemoteNodeOutsideSites(
  part: go.Node,
  diagram: go.Diagram,
  sites: Array<{ id: string }>,
): { x: number; y: number } {
  const margin = 16;
  const maxPasses = 6;

  for (let pass = 0; pass < maxPasses; pass++) {
    let adjusted = false;

    for (const site of sites) {
      const siteGroup = diagram.findPartForKey(site.id);
      if (!siteGroup) continue;
      const siteBounds = siteGroup.actualBounds;
      const nodeBounds = part.actualBounds;
      if (!nodeBounds.intersectsRect(siteBounds)) continue;

      const toLeft = nodeBounds.right - siteBounds.left + margin;
      const toRight = siteBounds.right - nodeBounds.left + margin;
      const toTop = nodeBounds.bottom - siteBounds.top + margin;
      const toBottom = siteBounds.bottom - nodeBounds.top + margin;
      const min = Math.min(toLeft, toRight, toTop, toBottom);

      let dx = 0;
      let dy = 0;
      if (min === toLeft) dx = -toLeft;
      else if (min === toRight) dx = toRight;
      else if (min === toTop) dy = -toTop;
      else dy = toBottom;

      part.location = new go.Point(part.location.x + dx, part.location.y + dy);
      adjusted = true;
    }

    if (!adjusted) break;
  }

  return { x: part.location.x, y: part.location.y };
}

// Sprint equipamentos Fase 7 — folga entre a borda direita do site e o
// primeiro endpoint remoto, e passo vertical entre remotos empilhados do
// mesmo site.
const REMOTE_NODE_SITE_MARGIN = 60;
const REMOTE_NODE_STACK_STEP = 90;

/**
 * Feedback visual de arrasto inválido (nó fora da grade da própria tier):
 * borda do nó em `signal-down`. Volta à cor do papel do equipamento quando
 * o arrasto volta pra dentro ou termina.
 */
function setDragInvalid(part: go.Part, invalid: boolean, category?: string) {
  const body = part.findObject('BODY') as go.Shape | null;
  if (!body) return;
  const theme = getDiagramTheme();
  body.stroke = invalid
    ? theme.signal.down
    : colorByCategory(String(category ?? ''));
  body.strokeWidth = invalid ? 2 : 1;
  if (part.diagram) part.diagram.currentCursor = invalid ? 'not-allowed' : '';
}

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
    const sitesRef = useRef<typeof sites>([]);
    const layerRectByIdRef = useRef<
      Map<string, { x: number; y: number; w: number; h: number }>
    >(new Map());
    const activeLinkIdRef = useRef<string | null>(null);
    // Sprint equipamentos Fase 7 — ids de nós isRemote já vistos, pra
    // detectar quais são recém-criados e posicioná-los ao lado do site de
    // origem só uma vez (não a cada render).
    const previousRemoteNodeIdsRef = useRef<Set<string>>(new Set());
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

    const layerRectById = useMemo(() => {
      const map = new Map<
        string,
        { x: number; y: number; w: number; h: number }
      >();
      for (const layer of layers) {
        const pos = layout.layerPositions.get(layer.id);
        if (!pos) continue;
        // O box (LAYER_BG) às vezes renderiza mais largo que a grade deste
        // layer precisa (esticado pra bater com o tier mais largo do site —
        // ver `uniformLayerWidth` mais abaixo). `x` aqui é a origem usada
        // pro cálculo de célula (render/arrasto/drop), não a posição do
        // box em si — deslocá-la pela metade da folga centraliza a grade
        // dentro do box esticado, em vez de deixá-la ancorada à esquerda.
        const renderedWidth =
          layout.layerRenderWidths.get(layer.id) ?? layer.width;
        const centeringOffsetX = Math.max(0, (renderedWidth - layer.width) / 2);
        map.set(layer.id, {
          x: pos.x + centeringOffsetX,
          y: pos.y,
          w: renderedWidth,
          h: layer.height,
        });
      }
      return map;
    }, [layers, layout.layerPositions, layout.layerRenderWidths]);

    const nodeData = useMemo(() => {
      const items: Array<Record<string, unknown>> = [];
      const limitedSites = sites.slice(0, 4);
      const palette = sitePalette();
      const siteVisualById = new Map<
        string,
        { stroke: string; siteFill: string; layerFill: string }
      >();

      limitedSites.forEach((site, index) => {
        const stroke = palette[index % palette.length];
        siteVisualById.set(site.id, {
          stroke,
          siteFill: getDiagramTheme().alpha(stroke, 0.13),
          layerFill: getDiagramTheme().alpha(stroke, 0.07),
        });
      });

      for (const site of limitedSites) {
        const visual = siteVisualById.get(site.id) ?? {
          stroke: getDiagramTheme().accent,
          siteFill: getDiagramTheme().alpha(getDiagramTheme().accent, 0.13),
          layerFill: getDiagramTheme().alpha(getDiagramTheme().accent, 0.07),
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
              networkColor: networkPurposeColor(net.purpose),
            });
          });

        const siteLayers = layers
          .filter((layer) => layer.siteId === site.id)
          .sort((a, b) => a.order - b.order);

        siteLayers.forEach((layer) => {
          const layerPos = layout.layerPositions.get(layer.id);
          const renderWidth =
            layout.layerRenderWidths.get(layer.id) ?? layer.width;
          const layerNodes = nodes.filter((node) => node.layerId === layer.id);
          const canRemoveRow =
            layer.rows > MIN_LAYER_ROWS &&
            !layerNodes.some((node) => node.row === layer.rows - 1);
          const canRemoveColumn =
            layer.columns > MIN_LAYER_COLUMNS &&
            !layerNodes.some((node) => node.col === layer.columns - 1);
          items.push({
            key: layer.id,
            text: layer.name,
            group: layer.networkId ?? site.id,
            isGroup: true,
            category: 'layer',
            layerStroke: visual.stroke,
            layerFill: visual.layerFill,
            size: `${renderWidth} ${layer.height}`,
            loc: `${layerPos?.x ?? 20} ${layerPos?.y ?? BASE_Y + 62}`,
            layerId: layer.id,
            minHeight: layer.minHeight,
            maxHeight: layer.maxHeight,
            columns: layer.columns,
            rows: layer.rows,
            canRemoveRow,
            canRemoveColumn,
            // Sprint tiers Fase 4 — só pra `movable` saber se é âncora fixa.
            tier: layer.tier,
          });
        });
      }

      for (const node of nodes) {
        const isWan = node.category === 'wan';
        const visual = getNodeVisual(node.category);
        let loc = `${node.x} ${node.y}`;

        // Sprint equipamentos Fase 7 — endpoint remoto tem layerId "de
        // verdade" pros dados (VLAN/IP/tech profile), mas continua solto na
        // camada visual: não é recolocado na grade do layer nem contido
        // visualmente pelo grupo GoJS do layer (ver `group` abaixo).
        if (!isWan && node.layerId && !node.isRemote) {
          const rect = layerRectById.get(node.layerId);
          if (rect) {
            // Posição sempre recalculada a partir da célula (row/col) — a
            // grade é a fonte da verdade, não o x/y absoluto salvo, que
            // fica desatualizado sempre que o layout do site é recalculado
            // (janela redimensionada, site adicionado/removido, etc.).
            const cellPos = cellToPixel(node.row, node.col);
            loc = `${rect.x + cellPos.x} ${rect.y + cellPos.y}`;
          }
        }

        items.push({
          key: node.id,
          group: node.isRemote ? undefined : node.layerId,
          text: node.label,
          marker: visual.short,
          category: node.category,
          iconSrc: getNodeIconSrc(node.category),
          loc: isWan ? `${layout.wanPosition.x} ${layout.wanPosition.y}` : loc,
          nodeId: node.id,
          isRemote: Boolean(node.isRemote),
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
      layerRectById,
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
      sitesRef.current = sites;
    }, [sites]);

    useEffect(() => {
      layerRectByIdRef.current = layerRectById;
    }, [layerRectById]);

    // Sprint equipamentos Fase 7 — posiciona um endpoint remoto recém-criado
    // ao lado do site de origem (não precisa esperar os bounds reais do
    // GoJS; `layout.sitePositions`/`siteWidths` já dão posição suficiente).
    // Remotos existentes que o usuário já arrastou não são reposicionados.
    useEffect(() => {
      const currentRemoteIds = new Set(
        nodes.filter((node) => node.isRemote).map((node) => node.id),
      );
      const previousRemoteIds = previousRemoteNodeIdsRef.current;
      const newRemoteNodes = nodes.filter(
        (node) => node.isRemote && !previousRemoteIds.has(node.id),
      );
      previousRemoteNodeIdsRef.current = currentRemoteIds;

      if (newRemoteNodes.length === 0) return;

      newRemoteNodes.forEach((remoteNode) => {
        if (!remoteNode.siteId) return;
        const sitePos = layout.sitePositions.get(remoteNode.siteId);
        const siteWidth = layout.siteWidths.get(remoteNode.siteId);
        if (!sitePos || siteWidth === undefined) return;

        const stackIndex = nodes
          .filter((node) => node.isRemote && node.siteId === remoteNode.siteId)
          .findIndex((node) => node.id === remoteNode.id);

        dispatch(
          updateNodePosition({
            id: remoteNode.id,
            x: sitePos.x + siteWidth + REMOTE_NODE_SITE_MARGIN,
            y: sitePos.y + Math.max(0, stackIndex) * REMOTE_NODE_STACK_STEP,
          }),
        );
      });
    }, [nodes, layout.sitePositions, layout.siteWidths, dispatch]);

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
        // Desfazer é do Redux (features/network/history.ts) — o model do
        // GoJS é trocado inteiro a cada update, então o undo dele não serve.
        'undoManager.isEnabled': false,
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

      // Espaça segmentos de links que dividem o mesmo corredor (extensão
      // oficial do GoJS 3, vendorizada em ./vendor/gojs) — links paralelos
      // nunca ficam um em cima do outro.
      const linksRouter = new AvoidsLinksRouter();
      linksRouter.linkSpacing = 6;
      diagram.routers.add(linksRouter);

      diagram.groupTemplateMap.add(
        'network',
        $(
          go.Group,
          'Vertical',
          {
            movable: false,
            // Contêiner (rede/site) não bloqueia rota: o link atravessa a
            // caixa e desvia só dos nós.
            avoidable: false,
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
                name: 'NETWORK_TITLE',
                stroke: getDiagramTheme().chalkDim,
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
                fill: getDiagramTheme().raised2,
                stroke: getDiagramTheme().lineStrong,
                strokeWidth: 1,
              }),
              $(go.TextBlock, {
                text: 'i',
                font: 'bold 9px sans-serif',
                stroke: getDiagramTheme().accent,
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
                fill: getDiagramTheme().alpha(getDiagramTheme().raised2, 0.35),
                stroke: getDiagramTheme().line,
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
            avoidable: false,
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
                name: 'SITE_TITLE',
                stroke: getDiagramTheme().chalk,
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
                fill: getDiagramTheme().raised2,
                stroke: getDiagramTheme().lineStrong,
                strokeWidth: 1,
              }),
              $(go.TextBlock, {
                text: 'i',
                font: 'bold 10px sans-serif',
                stroke: getDiagramTheme().accent,
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
                fill: getDiagramTheme().alpha(getDiagramTheme().ink, 0.35),
                stroke: getDiagramTheme().line,
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
          'Spot',
          {
            avoidable: false,
            // Sprint tiers Fase 4 — arrastável (exceto edge/endpoint, ver
            // binding abaixo); o reposicionamento real (row/slot) só é
            // decidido no drop, pelo listener `SelectionMoved` mais abaixo
            // (`resolveLayerDrop`), nunca durante o arrasto em si.
            movable: true,
            selectable: true,
            locationSpot: go.Spot.TopLeft,
            // O `loc` (abaixo) precisa mapear exatamente pro topo-esquerda do
            // box (LAYER_BG), não pro bounding box do grupo inteiro — que
            // agora inclui o label e as zonas de hover, ambos "vazando" pra
            // fora da área do box. Sem isso, todo o cálculo de célula
            // (relativo a `loc`) fica deslocado pela altura do label, e o
            // padding de cima acaba menor que o de baixo.
            locationObjectName: 'LAYER_BG',
          },
          new go.Binding('location', 'loc', go.Point.parse),
          new go.Binding(
            'movable',
            'tier',
            (tier) => !isFixedFirstTier(tier) && !isFixedLastTier(tier),
          ),
          $(
            go.Panel,
            'Auto',
            $(
              go.Shape,
              'RoundedRectangle',
              {
                name: 'LAYER_BG',
                fill: getDiagramTheme().alpha(getDiagramTheme().ink, 0.55),
                stroke: getDiagramTheme().lineStrong,
                strokeDashArray: [5, 4],
              },
              new go.Binding('fill', 'layerFill'),
              new go.Binding('stroke', 'layerStroke'),
              new go.Binding('desiredSize', 'size', go.Size.parse),
            ),
          ),
          // Nome do tier — sobreposto acima do box (não empilhado antes dele
          // num painel Vertical), pra não deslocar o `loc`/referência de
          // célula usada acima.
          $(
            go.TextBlock,
            {
              name: 'TIER_TITLE',
              stroke: getDiagramTheme().chalk,
              font: '600 12px Barlow',
              alignment: new go.Spot(0, 0, 2, -4),
              alignmentFocus: go.Spot.BottomLeft,
              pickable: false,
            },
            new go.Binding('text', 'text'),
          ),
          // Zona de hover na borda inferior — +/-linha, escondidos até o mouse
          // passar por cima (o retângulo quase-transparente é o alvo de hover
          // persistente; os botões só aparecem/desaparecem por cima dele).
          $(
            go.Panel,
            'Spot',
            {
              alignment: new go.Spot(0.5, 1, 0, 7),
              alignmentFocus: go.Spot.Center,
              mouseEnter: (_event, obj) => {
                const panel = obj as go.Panel;
                const canRemoveRow = Boolean(
                  (panel.part?.data as { canRemoveRow?: boolean } | undefined)
                    ?.canRemoveRow,
                );
                const addBtn = panel.findObject('LAYERADDROWBTN');
                const removeBtn = panel.findObject('LAYERREMOVEROWBTN');
                if (addBtn) addBtn.visible = true;
                if (removeBtn) removeBtn.visible = canRemoveRow;
              },
              mouseLeave: (_event, obj) => {
                const panel = obj as go.Panel;
                const addBtn = panel.findObject('LAYERADDROWBTN');
                const removeBtn = panel.findObject('LAYERREMOVEROWBTN');
                if (addBtn) addBtn.visible = false;
                if (removeBtn) removeBtn.visible = false;
              },
            },
            $(
              go.Shape,
              'Rectangle',
              { height: 14, fill: 'transparent', stroke: null },
              new go.Binding(
                'desiredSize',
                'size',
                (sizeStr: string) =>
                  new go.Size(go.Size.parse(sizeStr).width, 14),
              ),
            ),
            $(
              go.Panel,
              'Horizontal',
              { alignment: go.Spot.Center },
              $(
                go.Panel,
                'Auto',
                {
                  name: 'LAYERADDROWBTN',
                  visible: false,
                  width: 14,
                  height: 14,
                  cursor: 'pointer',
                  click: (_event, obj) => {
                    const layerId = String(obj.part?.data?.layerId ?? '');
                    if (!layerId) return;
                    dispatch(addLayerRow({ layerId }));
                  },
                },
                $(go.Shape, 'Circle', {
                  fill: getDiagramTheme().raised2,
                  stroke: getDiagramTheme().lineStrong,
                  strokeWidth: 1,
                }),
                $(go.TextBlock, {
                  text: '+',
                  font: 'bold 10px sans-serif',
                  stroke: getDiagramTheme().chalk,
                  textAlign: 'center',
                  verticalAlignment: go.Spot.Center,
                }),
              ),
              $(
                go.Panel,
                'Auto',
                {
                  name: 'LAYERREMOVEROWBTN',
                  visible: false,
                  width: 14,
                  height: 14,
                  cursor: 'pointer',
                  margin: new go.Margin(0, 0, 0, 3),
                  click: (_event, obj) => {
                    const layerId = String(obj.part?.data?.layerId ?? '');
                    if (!layerId) return;
                    dispatch(removeLayerRow({ layerId }));
                  },
                },
                $(go.Shape, 'Circle', {
                  fill: getDiagramTheme().raised2,
                  stroke: getDiagramTheme().lineStrong,
                  strokeWidth: 1,
                }),
                $(go.TextBlock, {
                  text: '−',
                  font: 'bold 10px sans-serif',
                  stroke: getDiagramTheme().chalk,
                  textAlign: 'center',
                  verticalAlignment: go.Spot.Center,
                }),
              ),
            ),
          ),
          // Zona de hover na borda direita — +/-coluna, mesmo padrão acima.
          $(
            go.Panel,
            'Spot',
            {
              alignment: new go.Spot(1, 0.5, 7, 0),
              alignmentFocus: go.Spot.Center,
              mouseEnter: (_event, obj) => {
                const panel = obj as go.Panel;
                const canRemoveColumn = Boolean(
                  (
                    panel.part?.data as
                      | { canRemoveColumn?: boolean }
                      | undefined
                  )?.canRemoveColumn,
                );
                const addBtn = panel.findObject('LAYERADDCOLBTN');
                const removeBtn = panel.findObject('LAYERREMOVECOLBTN');
                if (addBtn) addBtn.visible = true;
                if (removeBtn) removeBtn.visible = canRemoveColumn;
              },
              mouseLeave: (_event, obj) => {
                const panel = obj as go.Panel;
                const addBtn = panel.findObject('LAYERADDCOLBTN');
                const removeBtn = panel.findObject('LAYERREMOVECOLBTN');
                if (addBtn) addBtn.visible = false;
                if (removeBtn) removeBtn.visible = false;
              },
            },
            $(
              go.Shape,
              'Rectangle',
              { width: 14, fill: 'transparent', stroke: null },
              new go.Binding(
                'desiredSize',
                'size',
                (sizeStr: string) =>
                  new go.Size(14, go.Size.parse(sizeStr).height),
              ),
            ),
            $(
              go.Panel,
              'Vertical',
              { alignment: go.Spot.Center },
              $(
                go.Panel,
                'Auto',
                {
                  name: 'LAYERADDCOLBTN',
                  visible: false,
                  width: 14,
                  height: 14,
                  cursor: 'pointer',
                  click: (_event, obj) => {
                    const layerId = String(obj.part?.data?.layerId ?? '');
                    if (!layerId) return;
                    dispatch(addLayerColumn({ layerId }));
                  },
                },
                $(go.Shape, 'Circle', {
                  fill: getDiagramTheme().raised2,
                  stroke: getDiagramTheme().lineStrong,
                  strokeWidth: 1,
                }),
                $(go.TextBlock, {
                  text: '+',
                  font: 'bold 10px sans-serif',
                  stroke: getDiagramTheme().chalk,
                  textAlign: 'center',
                  verticalAlignment: go.Spot.Center,
                }),
              ),
              $(
                go.Panel,
                'Auto',
                {
                  name: 'LAYERREMOVECOLBTN',
                  visible: false,
                  width: 14,
                  height: 14,
                  cursor: 'pointer',
                  margin: new go.Margin(3, 0, 0, 0),
                  click: (_event, obj) => {
                    const layerId = String(obj.part?.data?.layerId ?? '');
                    if (!layerId) return;
                    dispatch(removeLayerColumn({ layerId }));
                  },
                },
                $(go.Shape, 'Circle', {
                  fill: getDiagramTheme().raised2,
                  stroke: getDiagramTheme().lineStrong,
                  strokeWidth: 1,
                }),
                $(go.TextBlock, {
                  text: '−',
                  font: 'bold 10px sans-serif',
                  stroke: getDiagramTheme().chalk,
                  textAlign: 'center',
                  verticalAlignment: go.Spot.Center,
                }),
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
          avoidable: true,
          // Folga de desvio do roteamento (`AvoidsNodes`). Precisa caber no
          // espaço entre nós da grade (32px, ver constants/grid.ts) junto com
          // o botão "i", que sai pra fora da caixa do nó e alarga o
          // `actualBounds`. Com folga maior, as zonas de vizinhos se
          // sobrepõem, não sobra corredor e o roteador desiste, desenhando
          // por cima dos nós (medido: 8px → 8 cruzamentos; 4px → 0).
          avoidableMargin: new go.Margin(4, 4, 4, 4),
          movable: true,
          // Snap em tempo real durante o arrasto — o nó "pula" de célula em
          // célula da grade do seu layer, nunca aparece solto entre elas
          // (o handler `SelectionMoved`, mais abaixo, só confirma no Redux a
          // célula onde o nó já apareceu visualmente aqui).
          //
          // Fora da grade da PRÓPRIA tier o nó acompanha o cursor livre, com
          // a borda em `signal-down` sinalizando "soltar aqui não vale" — ao
          // soltar, `SelectionMoved` devolve o nó à célula de origem.
          dragComputation: (part, pt) => {
            const data = part.data as
              | { layerId?: string; isRemote?: boolean; category?: string }
              | undefined;
            if (!data?.layerId || data.isRemote) return pt;
            const layer = layersRef.current.find((l) => l.id === data.layerId);
            const rect = layerRectByIdRef.current.get(data.layerId);
            if (!layer || !rect) return pt;
            const cellAtPoint = pixelToCellStrict(
              pt.x - rect.x,
              pt.y - rect.y,
              layer.columns,
              layer.rows,
            );
            setDragInvalid(part, !cellAtPoint, data.category);
            if (!cellAtPoint) return pt;
            const cell = cellToPixel(cellAtPoint.row, cellAtPoint.col);
            return new go.Point(rect.x + cell.x, rect.y + cell.y);
          },
          mouseEnter: (_event, obj) => {
            const node = obj as go.Node;
            node.isHighlighted = true;
            node.findLinksConnected().each((link) => {
              link.isHighlighted = true;
            });
            if (node.diagram) {
              placeLinkLabelsStable(node.diagram, {
                include: (link) => link.isHighlighted,
                fontSizePx: LINK_LABEL_FONT_PX,
              });
            }
          },
          mouseLeave: (_event, obj) => {
            const node = obj as go.Node;
            node.isHighlighted = false;
            node.findLinksConnected().each((link) => {
              link.isHighlighted = false;
            });
            if (node.diagram) restoreLinkLabelTexts(node.diagram);
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
        // WAN é único e sempre presente — não deve ser removível pelo Del
        // agora que a exclusão de nó é persistida de verdade (ver listener
        // de nodeDataArray mais abaixo).
        new go.Binding(
          'deletable',
          'category',
          (category) => category !== 'wan',
        ),
        new go.Binding('location', 'loc', go.Point.parse),
        $(
          go.Panel,
          'Auto',
          $(
            go.Shape,
            {
              name: 'BODY',
              figure: 'RoundedRectangle',
              fill: getDiagramTheme().raised,
              stroke: getDiagramTheme().line,
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
              stroke: getDiagramTheme().chalk,
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
              stroke: getDiagramTheme().chalkDim,
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
          new go.Binding(
            'visible',
            'vlanColors',
            (colors: string[]) => Array.isArray(colors) && colors.length >= 1,
          ),
          $(
            go.Shape,
            'Circle',
            {
              width: 8,
              height: 8,
              margin: 0,
              stroke: null,
              fill: 'transparent',
            },
            new go.Binding(
              'fill',
              'vlanColors',
              (colors: string[]) => colors[0] ?? 'transparent',
            ),
          ),
          $(
            go.Shape,
            'Circle',
            {
              width: 8,
              height: 8,
              margin: 0,
              stroke: null,
              fill: 'transparent',
              visible: false,
            },
            new go.Binding(
              'fill',
              'vlanColors',
              (colors: string[]) => colors[1] ?? 'transparent',
            ),
            new go.Binding(
              'visible',
              'vlanColors',
              (colors: string[]) => Array.isArray(colors) && colors.length >= 2,
            ),
          ),
          $(
            go.Shape,
            'Circle',
            {
              width: 8,
              height: 8,
              margin: 0,
              stroke: null,
              fill: 'transparent',
              visible: false,
            },
            new go.Binding(
              'fill',
              'vlanColors',
              (colors: string[]) => colors[2] ?? 'transparent',
            ),
            new go.Binding(
              'visible',
              'vlanColors',
              (colors: string[]) => Array.isArray(colors) && colors.length >= 3,
            ),
          ),
          $(
            go.Shape,
            'Circle',
            {
              width: 8,
              height: 8,
              margin: 0,
              stroke: null,
              fill: 'transparent',
              visible: false,
            },
            new go.Binding(
              'fill',
              'vlanColors',
              (colors: string[]) => colors[3] ?? 'transparent',
            ),
            new go.Binding(
              'visible',
              'vlanColors',
              (colors: string[]) => Array.isArray(colors) && colors.length >= 4,
            ),
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
            fill: getDiagramTheme().raised2,
            stroke: getDiagramTheme().lineStrong,
            strokeWidth: 1,
          }),
          $(go.TextBlock, {
            text: 'i',
            font: 'bold 10px sans-serif',
            stroke: getDiagramTheme().accent,
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
          corner: 6,
          fromSpot: go.Spot.AllSides,
          toSpot: go.Spot.AllSides,
          fromEndSegmentLength: 12,
          toEndSegmentLength: 12,
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
            stroke: getDiagramTheme().accent,
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
            stroke: getDiagramTheme().accent,
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
            fill: getDiagramTheme().accent,
            scale: 0.9,
          },
          new go.Binding('fill', 'stroke'),
        ),
        $(
          go.Shape,
          {
            toArrow: 'Circle',
            stroke: null,
            fill: getDiagramTheme().accent,
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
            fill: getDiagramTheme().ink,
            stroke: getDiagramTheme().lineStrong,
          }),
          $(
            go.TextBlock,
            {
              name: 'LINK_LABEL_TEXT',
              margin: new go.Margin(2, 5, 2, 5),
              stroke: getDiagramTheme().chalk,
              // Tamanho estável (o hover não muda a fonte) — a estimativa de
              // largura do posicionamento (linkLabelPlacement) conta com isso.
              font: `500 ${LINK_LABEL_FONT_PX}px "IBM Plex Mono"`,
            },
            new go.Binding('text', 'label'),
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
          // Sprint tiers Fase 4 — reposicionamento de tier via arrasto no
          // quadro. `go.Group` é subtipo de `go.Node` no GoJS, então esse
          // branch precisa vir antes do `data.nodeId` abaixo (camadas não
          // têm `nodeId`, só `layerId`).
          if (part instanceof go.Group) {
            const groupData = part.data as
              | { layerId?: string; category?: string }
              | undefined;
            if (groupData?.category !== 'layer' || !groupData.layerId) return;
            const layerId = groupData.layerId;
            const layer = layersRef.current.find((l) => l.id === layerId);
            if (!layer) return;

            const snapBackToCanonicalPosition = () => {
              const rect = layerRectByIdRef.current.get(layerId);
              if (rect) part.location = new go.Point(rect.x, rect.y);
            };

            if (isFixedFirstTier(layer.tier) || isFixedLastTier(layer.tier)) {
              snapBackToCanonicalPosition(); // edge/endpoint nunca movem
              return;
            }

            const layersInLan = layersRef.current.filter(
              (l) =>
                l.siteId === layer.siteId &&
                (l.networkId ?? null) === (layer.networkId ?? null),
            );

            const result = resolveLayerDrop({
              movedLayerId: layerId,
              dropPoint: { x: part.location.x, y: part.location.y },
              layersInLan,
              getRect: (id) => layerRectByIdRef.current.get(id),
              canShrinkColumn: (id) => {
                const target = layersRef.current.find((l) => l.id === id);
                if (!target || target.columns <= MIN_LAYER_COLUMNS) {
                  return false;
                }
                const lastColumn = target.columns - 1;
                return !Array.from(nodesByIdRef.current.values()).some(
                  (n) => n.layerId === id && n.col === lastColumn,
                );
              },
            });

            if (!result) {
              snapBackToCanonicalPosition(); // sem espaço pra encolher — bloqueia
              return;
            }

            dispatch(reorderLayer(result));
            return;
          }

          if (!(part instanceof go.Node)) return;
          const data = part.data as { nodeId?: string };
          if (!data?.nodeId) return;
          const node = nodesByIdRef.current.get(data.nodeId);
          if (!node) return;

          // Nó solto (sem layer — ex.: elemento de relação entre sites) ou
          // endpoint remoto (tem layerId "de verdade" pros dados, mas segue
          // solto na camada visual): posição livre por pixel, sem grade.
          if (!node.layerId || node.isRemote) {
            // Endpoint remoto: nunca pode ficar visualmente sobreposto ao
            // retângulo de um site, mesmo se o usuário arrastar pra cima.
            const finalPosition = node.isRemote
              ? pushRemoteNodeOutsideSites(
                  part,
                  event.diagram,
                  sitesRef.current,
                )
              : { x: part.location.x, y: part.location.y };

            dispatch(
              updateNodePosition({
                id: data.nodeId,
                x: finalPosition.x,
                y: finalPosition.y,
              }),
            );
            return;
          }

          const layer = layersRef.current.find((l) => l.id === node.layerId);
          const rect = layerRectByIdRef.current.get(node.layerId);
          setDragInvalid(part, false, node.category);
          if (!layer || !rect) return;

          const target = pixelToCellStrict(
            part.location.x - rect.x,
            part.location.y - rect.y,
            layer.columns,
            layer.rows,
          );
          if (!target) {
            // Soltou fora da própria tier: volta pra célula de onde saiu,
            // sem tocar no Redux (nem no histórico de desfazer).
            const origin = cellToPixel(node.row ?? 0, node.col ?? 0);
            part.location = new go.Point(rect.x + origin.x, rect.y + origin.y);
            return;
          }
          if (target.row === node.row && target.col === node.col) return;
          dispatch(
            updateNodePosition({
              id: data.nodeId,
              row: target.row,
              col: target.col,
            }),
          );
        });
      });

      diagram.addDiagramListener('ViewportBoundsChanged', () => {
        dispatch(setZoom(diagram.scale));
      });

      diagram.addDiagramListener('BackgroundSingleClicked', () => {
        setActiveTooltip(null);
        setActiveSiteTooltip(null);
      });

      // Seleção sincronizada com o painel Estrutura (LegendPanel):
      // diagrama → painel via `rede:diagram-selection`; painel → diagrama via
      // `rede:focus-node` (seleciona e centraliza o nó na área visível).
      diagram.addDiagramListener('ChangedSelection', () => {
        const selected = diagram.selection.first();
        const nodeId =
          selected instanceof go.Node && !(selected instanceof go.Group)
            ? String((selected.data as { nodeId?: string })?.nodeId ?? '')
            : '';
        window.dispatchEvent(
          new CustomEvent('rede:diagram-selection', {
            detail: { nodeId: nodeId || null },
          }),
        );
      });
      const handleFocusNode = (event: Event) => {
        const nodeId = (event as CustomEvent<{ nodeId: string }>).detail
          ?.nodeId;
        if (!nodeId) return;
        let target: go.Node | null = null;
        diagram.nodes.each((node) => {
          if (
            !target &&
            !(node instanceof go.Group) &&
            (node.data as { nodeId?: string })?.nodeId === nodeId
          ) {
            target = node;
          }
        });
        if (!target) return;
        const node: go.Node = target;
        diagram.select(node);
        // A gaveta Estrutura (360px) cobre a esquerda do diagrama: centraliza
        // o nó na área visível à direita dela.
        // Folga de rolagem à esquerda do tamanho da gaveta — sem ela o GoJS
        // limita a rolagem aos limites do documento e um nó perto da borda
        // esquerda continuaria embaixo da gaveta.
        diagram.scrollMargin = new go.Margin(0, 0, 0, 380);
        const viewport = diagram.viewportBounds;
        const drawerDoc = 380 / diagram.scale;
        diagram.position = new go.Point(
          node.location.x - drawerDoc - (viewport.width - drawerDoc) / 2,
          node.location.y - viewport.height / 2,
        );
        node.isHighlighted = true;
        window.setTimeout(() => {
          node.isHighlighted = false;
        }, 1200);
      };
      window.addEventListener('rede:focus-node', handleFocusNode);

      diagramRef.current = diagram;

      return () => {
        window.removeEventListener('rede:focus-node', handleFocusNode);
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
        // Deletar um nó pelo teclado (Del) só removia do model efêmero do
        // GoJS — nada avisava o Redux, então o nó reaparecia na próxima
        // reconstrução do diagrama. Grupos (site/layer/network) também
        // passam por `nodeDataArray`, mas não têm `nodeId` — só equipamentos
        // de verdade (incl. o elemento de relação entre sites) têm.
        if (
          evt.change === go.ChangeType.Remove &&
          evt.modelChange === 'nodeDataArray'
        ) {
          const oldNode = evt.oldValue as {
            nodeId?: string;
            isGroup?: boolean;
          } | null;
          if (oldNode?.nodeId && !oldNode.isGroup) {
            dispatch(removeNode(oldNode.nodeId));
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
              textBlock.font = `500 ${PDF_LINK_LABEL_FONT_PX}px "IBM Plex Mono"`;
            }
          });
        }, 'prepare-pdf-export');

        // Rótulos sem colisão; os que não cabem viram ①②… e voltam como
        // notas pra tabela "Descrição das conexões" do PDF.
        const overflow: LinkLabelOverflow[] = showLinkDescriptions
          ? placeLinkLabelsStable(diagram, {
              include: (link) =>
                Boolean(
                  (link.findObject('LINK_LABEL_PANEL') as go.Panel | null)
                    ?.visible,
                ),
              fontSizePx: PDF_LINK_LABEL_FONT_PX,
            })
          : [];
        const connectionNotes = overflow.map((item) => ({
          marker: item.marker,
          from: String(item.link.fromNode?.data?.text ?? ''),
          to: String(item.link.toNode?.data?.text ?? ''),
          description: item.text,
        }));

        const bounds = diagram.documentBounds;
        const margin = 10;
        const imageData = diagram.makeImageData({
          returnType: 'string',
          type: 'image/png',
          background: getDiagramTheme().ink,
          scale: 1,
          position: new go.Point(bounds.x - margin, bounds.y - margin),
          size: new go.Size(
            bounds.width + margin * 2,
            bounds.height + margin * 2,
          ),
        }) as string;

        diagram.commit((d) => {
          for (const state of panelStates) {
            state.panel.visible = state.visible;
            if (state.textBlock && state.font) {
              state.textBlock.font = state.font;
            }
          }
          restoreLinkLabelTexts(d);
        }, 'restore-pdf-export');

        return { imageData, connectionNotes };
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
      <div className="relative h-[660px] rounded-sm border border-line bg-ink">
        <div
          ref={diagramDivRef}
          className="h-full w-full"
          aria-label="Network Studio"
        />

        {/* Botão Enquadrar */}
        <button
          type="button"
          onClick={fitDiagram}
          aria-label={studioUi().fitDiagram}
          title={studioUi().fitDiagram}
          className="absolute bottom-3 right-12 z-10 flex h-8 w-8 items-center justify-center rounded-sm border border-line bg-ink-raised text-chalk-dim opacity-60 transition-[opacity,color,background-color] duration-150 hover:bg-ink-raised-2 hover:text-chalk hover:opacity-100 focus-visible:opacity-100"
        >
          <Maximize size={16} aria-hidden="true" />
        </button>

        {/* Botão Centralizar */}
        <button
          type="button"
          onClick={centerDiagram}
          aria-label={studioUi().centerDiagram}
          title={studioUi().centerDiagram}
          className="absolute bottom-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-sm border border-line bg-ink-raised text-chalk-dim opacity-60 transition-[opacity,color,background-color] duration-150 hover:bg-ink-raised-2 hover:text-chalk hover:opacity-100 focus-visible:opacity-100"
        >
          <Crosshair size={16} aria-hidden="true" />
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
            const routingMode = String(
              techProfile.fields.routingMode ?? 'static',
            );
            const isBgpMode = routingMode === 'bgp' || routingMode === 'mixed';

            const bgpNeighborOptions: CreatableOption[] = isBgpMode
              ? Array.from(
                  new Map(
                    nodes
                      .filter((candidate) => {
                        if (candidate.id === tooltipNode.id) return false;
                        if (candidate.category !== 'router') return false;
                        if (
                          !candidate.siteId ||
                          candidate.siteId === tooltipNode.siteId
                        ) {
                          return false;
                        }
                        const candidateMode = String(
                          candidate.techProfile?.fields?.routingMode ??
                            'static',
                        );
                        if (
                          candidateMode !== 'bgp' &&
                          candidateMode !== 'mixed'
                        ) {
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

            const localNetworkPrefixOptions: CreatableOption[] =
              tooltipNode.siteId
                ? siteNetworks
                    .filter((network) => network.siteId === tooltipNode.siteId)
                    .map((network) => {
                      const siteRef = sites.find(
                        (site) => site.id === network.siteId,
                      );
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

            const remoteNetworkPrefixOptions: CreatableOption[] =
              tooltipNode.siteId
                ? siteNetworks
                    .filter((network) => network.siteId !== tooltipNode.siteId)
                    .map((network) => {
                      const siteRef = sites.find(
                        (site) => site.id === network.siteId,
                      );
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
                    <X size={14} aria-hidden="true" />
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
                      className="w-full rounded-sm border border-line bg-ink-raised-2 px-2 py-1 text-2xs text-chalk outline-none focus:border-accent"
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
                          className="w-full rounded-sm border border-line bg-ink-raised-2 px-2 py-1 text-2xs text-chalk outline-none focus:border-accent"
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
                          className="w-full rounded-sm border border-line bg-ink-raised-2 px-2 py-1 text-2xs text-chalk outline-none focus:border-accent"
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
                          className="w-full rounded-sm border border-line bg-ink-raised-2 px-2 py-1 text-2xs text-chalk outline-none focus:border-accent"
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
                          className="w-full rounded-sm border border-line bg-ink-raised-2 px-2 py-1 text-2xs text-chalk outline-none focus:border-accent"
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
                              className="w-full rounded-sm border border-line bg-ink-raised-2 px-2 py-1 text-2xs text-chalk outline-none focus:border-accent"
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

                  {/* Sprint equipamentos Fase 8 — site de origem, só pra elementos de conexão inter-site (vpn/ipsec/wireguard/sdwan/mpls/gre) */}
                  {RELATION_OPTION_CATEGORIES.includes(
                    tooltipNode.category,
                  ) && (
                    <label className="gojs-tooltip-row">
                      <span className="gojs-tooltip-label">
                        {studioUi().originSite}
                      </span>
                      <select
                        value={tooltipNode.originSiteId ?? ''}
                        onChange={(event) => {
                          const originSiteId = event.target.value;
                          if (!originSiteId) return;
                          dispatch(
                            setNodeOriginSite({
                              id: tooltipNode.id,
                              originSiteId,
                            }),
                          );
                        }}
                        className="w-full rounded-sm border border-line bg-ink-raised-2 px-2 py-1 text-2xs text-chalk outline-none focus:border-accent"
                      >
                        <option value="">{studioUi().notDefinedOption}</option>
                        {sites.map((site) => (
                          <option key={site.id} value={site.id}>
                            {site.name}
                          </option>
                        ))}
                      </select>
                    </label>
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
                      className="h-16 w-full rounded-sm border border-line bg-ink-raised-2 px-2 py-1 text-2xs text-chalk outline-none focus:border-accent"
                    />
                  </label>

                  {techWarnings.length > 0 && (
                    <div className="rounded-sm border border-signal-warn/40 bg-signal-warn/10 px-2 py-2 text-2xs text-signal-warn">
                      <div className="mb-1 font-semibold uppercase tracking-[0.06em] text-signal-warn">
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

                            const currentValues = parseCsvItems(
                              String(value ?? ''),
                            );

                            return (
                              <label
                                key={field.key}
                                className="gojs-tooltip-row"
                              >
                                <span className="gojs-tooltip-label">
                                  {fieldLabel}:
                                </span>
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
                                  className="w-full rounded-sm border border-line bg-ink-raised-2 px-2 py-1 text-2xs text-chalk outline-none focus:border-accent"
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
                                  className="w-full rounded-sm border border-line bg-ink-raised-2 px-2 py-1 text-2xs text-chalk outline-none focus:border-accent"
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
                                className="w-full rounded-sm border border-line bg-ink-raised-2 px-2 py-1 text-2xs text-chalk outline-none focus:border-accent"
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
                    <X size={14} aria-hidden="true" />
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
                      className="w-full rounded-sm border border-line bg-ink-raised-2 px-2 py-1 text-2xs text-chalk outline-none focus:border-accent"
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
                      className="w-full rounded-sm border border-line bg-ink-raised-2 px-2 py-1 text-2xs text-chalk outline-none focus:border-accent"
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
                      className="w-full rounded-sm border border-line bg-ink-raised-2 px-2 py-1 text-2xs text-chalk outline-none focus:border-accent"
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
                      className="w-full rounded-sm border border-line bg-ink-raised-2 px-2 py-1 text-2xs text-chalk outline-none focus:border-accent"
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
                    <X size={14} aria-hidden="true" />
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
