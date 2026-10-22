import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/base.css';
import { Maximize, Minus, Plus, Route } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  addCloudConnection,
  moveCloudResource,
  removeCloudConnection,
  removeCloudResource,
  selectCloudConnection,
  selectCloudResource,
} from '../../features/cloud/cloudSlice';
import { getCatalogEntry } from '../../features/cloud/catalog';
import {
  canConnect,
  CONNECTABLE_TYPES,
} from '../../features/cloud/engines/connections';
import {
  ancestorsOf,
  canvasChildrenOf,
  isOnCanvas,
  minContainerSize,
  sizeOf,
  sortParentsFirst,
  subtreeIds,
} from '../../features/cloud/tree';
import type { AppLanguage } from '../../types/i18n';
import { buildCanvasEdges, type RouteCache } from './canvasEdges';
import './cloudCanvas.css';
import { getCloudCopy } from './cloudCopy';
import { cloudEdgeTypes } from './CloudEdge';
import { CLOUD_FOCUS_EVENT, type CloudFocusDetail } from './focusOnCanvas';
import { cloudNodeTypes, type CloudNodeData } from './nodes';

type CloudCanvasProps = {
  language: AppLanguage;
  /** Avisa a página para oferecer "Desfazer" depois de uma exclusão. */
  onDeleted: () => void;
  /** Idem, para conexões. */
  onConnectionDeleted: () => void;
  /** Estado vazio: o CTA cria a conta (o primeiro passo). */
  onCreateAccount: () => void;
};

/** Preferência do visitante: mostrar as rotas implícitas (só conveniência local). */
const ROUTES_KEY = 'rede-sp-cwb-cloud-routes-v1';
const readShowRoutes = () => {
  try {
    return localStorage.getItem(ROUTES_KEY) !== 'off';
  } catch {
    return true;
  }
};

type Point = { x: number; y: number };
/** Ligação em andamento, em coordenadas do contêiner do canvas. */
type Linking = {
  sourceId: string;
  from: Point;
  to: Point;
  target: { id: string; rect: DOMRect; valid: boolean } | null;
};

/** Setas do teclado: passo do snap (4 px) e, com Shift, 16 px. */
const KEY_STEP = 4;
const KEY_STEP_LARGE = 16;
const ARROWS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

const nodeElement = (id: string) =>
  document.querySelector<HTMLElement>(
    `.react-flow__node[data-id="${CSS.escape(id)}"]`,
  );

function CanvasInner({
  language,
  onDeleted,
  onConnectionDeleted,
  onCreateAccount,
}: CloudCanvasProps) {
  const dispatch = useAppDispatch();
  const copy = getCloudCopy(language);
  const { resources, connections, ui } = useAppSelector((state) => state.cloud);
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [linking, setLinking] = useState<Linking | null>(null);
  const [moving, setMoving] = useState<Set<string> | null>(null);
  const [showRoutes, setShowRoutes] = useState(readShowRoutes);
  const routeCache = useRef<RouteCache>(new Map());
  // Depois de soltar uma ligação, o clique que o React Flow dispara no nó de
  // destino não deve roubar a seleção da conexão recém-criada.
  const ignoreNextNodeClick = useRef(false);
  const latest = useRef({ resources, connections });
  latest.current = { resources, connections };

  /** Começa a ligação: de um ponto lateral (na hora) ou segurando o clique sobre o recurso. */
  const startConnect = useCallback(
    (sourceId: string, clientX: number, clientY: number) => {
      const wrapper = wrapperRef.current?.getBoundingClientRect();
      const source = nodeElement(sourceId)?.getBoundingClientRect();
      if (!wrapper || !source) return;
      setLinking({
        sourceId,
        from: {
          x: source.left + source.width / 2 - wrapper.left,
          y: source.top + source.height / 2 - wrapper.top,
        },
        to: { x: clientX - wrapper.left, y: clientY - wrapper.top },
        target: null,
      });
    },
    [],
  );

  // Nós derivados do Redux (fonte da verdade). O estado local só existe pra
  // o arrasto ficar fluido — no fim do arrasto a posição vai pro Redux.
  const linkingSource = linking?.sourceId ?? null;
  const derived = useMemo<Node<CloudNodeData>[]>(
    () =>
      sortParentsFirst(resources.filter(isOnCanvas)).map((resource) => {
        const entry = getCatalogEntry(resource.type);
        const isContainer = entry?.kind === 'container';
        const size = sizeOf(resource);
        return {
          id: resource.id,
          type: isContainer ? 'cloudContainer' : 'cloudResource',
          position: resource.position,
          ...(resource.parentId
            ? { parentId: resource.parentId, extent: 'parent' as const }
            : {}),
          width: size.width,
          height: size.height,
          // Tamanho já conhecido (vem do estado): sem `measured` o React
          // Flow não sabe o limite do pai e o `extent: 'parent'` não prende.
          measured: { width: size.width, height: size.height },
          selected: ui.selectedResourceId === resource.id,
          ariaLabel: copy.a11y.node(
            entry?.label[language] ?? resource.type,
            resource.name,
          ),
          // O recurso que está ligando não arrasta enquanto o ponteiro se move.
          draggable: resource.id !== linkingSource,
          // `zIndexMode="manual"`: containers pela profundidade (o filho
          // sobre o pai), arestas em 900/1000, rótulos em 1500 (CSS),
          // recursos em 2000 — a linha nunca passa sobre um rótulo nem nó.
          zIndex: isContainer
            ? ancestorsOf(resources, resource.id).length
            : 2000,
          data: {
            resource,
            language,
            childCount: canvasChildrenOf(resources, resource.id).length,
            minSize: isContainer
              ? minContainerSize(resources, resource.id)
              : undefined,
            onStartConnect: startConnect,
          },
        };
      }),
    [
      resources,
      ui.selectedResourceId,
      language,
      copy,
      linkingSource,
      startConnect,
    ],
  );

  const [nodes, setNodes] = useState(derived);
  useEffect(() => setNodes(derived), [derived]);

  const onNodesChange = useCallback(
    (changes: NodeChange<Node<CloudNodeData>>[]) =>
      // Seleção e remoção são do Redux; aqui só o arrasto e o
      // redimensionamento em curso (gravados no Redux ao soltar).
      setNodes((current) =>
        applyNodeChanges(
          changes.filter(
            (change) =>
              change.type === 'position' || change.type === 'dimensions',
          ),
          current,
        ),
      ),
    [],
  );

  const edges = useMemo(
    () =>
      buildCanvasEdges({
        nodes,
        resources,
        connections,
        selectedConnectionId: ui.selectedConnectionId,
        selectedResourceId: ui.selectedResourceId,
        language,
        showRoutes,
        moving,
        cache: routeCache.current,
      }),
    [
      nodes,
      resources,
      connections,
      ui.selectedConnectionId,
      ui.selectedResourceId,
      language,
      showRoutes,
      moving,
    ],
  );

  // Ligação em andamento: segue o ponteiro, destaca o destino (válido ou
  // não) e cria a conexão ao soltar sobre um recurso que aceita. Esc cancela.
  useEffect(() => {
    if (!linkingSource) return;
    const locate = (clientX: number, clientY: number) => {
      const wrapper = wrapperRef.current?.getBoundingClientRect();
      if (!wrapper) return null;
      const element = document
        .elementsFromPoint(clientX, clientY)
        .map((el) => el.closest<HTMLElement>('.react-flow__node-cloudResource'))
        .find((el): el is HTMLElement =>
          Boolean(el && el.dataset.id !== linkingSource),
        );
      const id = element?.dataset.id;
      const { resources: rs, connections: cs } = latest.current;
      return {
        to: { x: clientX - wrapper.left, y: clientY - wrapper.top },
        target: id
          ? {
              id,
              rect: element!.getBoundingClientRect(),
              valid: canConnect(rs, cs, linkingSource, id),
            }
          : null,
      };
    };
    const onMove = (event: PointerEvent) => {
      const found = locate(event.clientX, event.clientY);
      if (found)
        setLinking((current) => (current ? { ...current, ...found } : current));
    };
    const onUp = (event: PointerEvent) => {
      const found = locate(event.clientX, event.clientY);
      if (found?.target?.valid) {
        dispatch(
          addCloudConnection({
            source: linkingSource,
            target: found.target.id,
          }),
        );
        ignoreNextNodeClick.current = true;
        window.setTimeout(() => (ignoreNextNodeClick.current = false), 200);
      }
      setLinking(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLinking(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKey);
    };
  }, [linkingSource, dispatch]);

  // "Localizar" das tabelas: enquadra os elementos pedidos.
  useEffect(() => {
    const onFocus = (event: Event) => {
      const { ids } = (event as CustomEvent<CloudFocusDetail>).detail;
      fitView({
        nodes: ids.map((id) => ({ id })),
        padding: 0.5,
        duration: 300,
        maxZoom: 1.25,
      });
    };
    window.addEventListener(CLOUD_FOCUS_EVENT, onFocus);
    return () => window.removeEventListener(CLOUD_FOCUS_EVENT, onFocus);
  }, [fitView]);

  // Teclado (o foco está no próprio nó ou na própria aresta): Enter/Espaço
  // seleciona, Esc limpa, setas movem o selecionado dentro do pai. Passa
  // pelo Redux — o movimento por setas do React Flow ficaria só local.
  // Delete/Backspace continua com o `deleteKeyCode` do React Flow.
  const onKeyDownCapture = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const isNode = target.classList.contains('react-flow__node');
    const isEdge = target.classList.contains('react-flow__edge');
    const id = target.dataset.id;
    if ((!isNode && !isEdge) || !id) return;
    const handled = () => {
      event.preventDefault();
      event.stopPropagation();
    };
    if (event.key === 'Enter' || event.key === ' ') {
      handled();
      if (isNode) dispatch(selectCloudResource(id));
      else if (connections.some((c) => c.id === id))
        dispatch(selectCloudConnection(id));
      return;
    }
    if (event.key === 'Escape') {
      handled();
      dispatch(selectCloudResource(null));
      return;
    }
    const arrow = ARROWS[event.key];
    if (!arrow || !isNode) return;
    handled();
    const resource = resources.find((r) => r.id === id);
    if (!resource || ui.selectedResourceId !== id) return;
    const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
    dispatch(
      moveCloudResource({
        id,
        position: {
          x: resource.position.x + arrow[0] * step,
          y: resource.position.y + arrow[1] * step,
        },
      }),
    );
  };

  const ariaLabelConfig = useMemo(
    () => ({
      'node.a11yDescription.default': copy.a11y.nodeDescription,
      'node.a11yDescription.keyboardDisabled': copy.a11y.nodeDescription,
      'edge.a11yDescription.default': copy.a11y.edgeDescription,
    }),
    [copy],
  );

  const toggleRoutes = () =>
    setShowRoutes((value) => {
      try {
        localStorage.setItem(ROUTES_KEY, value ? 'off' : 'on');
      } catch {
        // armazenamento indisponível: só não lembra a escolha
      }
      return !value;
    });

  // Dica de como conectar: aparece quando já dá para ligar dois recursos.
  const showConnectHint =
    connections.length === 0 &&
    resources.filter((r) => CONNECTABLE_TYPES.includes(r.type)).length >= 2;

  // Enquadra quando o primeiro elemento aparece (canvas vazio → conta criada).
  const isEmpty = resources.length === 0;
  useEffect(() => {
    if (!isEmpty)
      requestAnimationFrame(() => fitView({ padding: 0.15, duration: 200 }));
  }, [isEmpty, fitView]);

  const wrapper = linking
    ? wrapperRef.current?.getBoundingClientRect()
    : undefined;

  return (
    <div
      ref={wrapperRef}
      onKeyDownCapture={onKeyDownCapture}
      className="relative h-full w-full"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={cloudNodeTypes}
        edgeTypes={cloudEdgeTypes}
        zIndexMode="manual"
        nodesConnectable={false}
        onNodesChange={onNodesChange}
        onNodeDragStart={(_event, node) =>
          setMoving(subtreeIds(resources, node.id))
        }
        onNodeDragStop={(_event, node) => {
          setMoving(null);
          dispatch(moveCloudResource({ id: node.id, position: node.position }));
        }}
        onNodeClick={(_event, node) => {
          if (ignoreNextNodeClick.current) return;
          dispatch(selectCloudResource(node.id));
        }}
        onPaneClick={() => dispatch(selectCloudResource(null))}
        onEdgeClick={(_event, edge) => {
          if (edge.selectable !== false)
            dispatch(selectCloudConnection(edge.id));
        }}
        onEdgesDelete={(deleted) => {
          const own = deleted.filter((edge) => edge.deletable !== false);
          own.forEach((edge) => dispatch(removeCloudConnection(edge.id)));
          if (own.length > 0) onConnectionDeleted();
        }}
        onNodesDelete={(deleted) => {
          const ids = new Set(deleted.map((node) => node.id));
          // Só as raízes da seleção — o reducer já remove os descendentes.
          deleted
            .filter((node) => !node.parentId || !ids.has(node.parentId))
            .forEach((node) => dispatch(removeCloudResource(node.id)));
          if (deleted.length > 0) onDeleted();
        }}
        deleteKeyCode={['Delete', 'Backspace']}
        snapToGrid
        snapGrid={[4, 4]}
        minZoom={0.2}
        maxZoom={2}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        aria-label={copy.canvasLabel}
        ariaLabelConfig={ariaLabelConfig}
        className={`cloud-canvas ${linking ? 'is-connecting' : ''}`}
      >
        <Background
          variant={BackgroundVariant.Lines}
          gap={42}
          className="cloud-canvas-grid"
        />
      </ReactFlow>

      {linking && wrapper && (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 h-full w-full"
        >
          {linking.target && (
            <rect
              x={linking.target.rect.left - wrapper.left - 3}
              y={linking.target.rect.top - wrapper.top - 3}
              width={linking.target.rect.width + 6}
              height={linking.target.rect.height + 6}
              rx={7}
              className={`cloud-connect-target ${linking.target.valid ? '' : 'is-invalid'}`}
            />
          )}
          <line
            x1={linking.from.x}
            y1={linking.from.y}
            x2={linking.to.x}
            y2={linking.to.y}
            className="cloud-connect-line"
          />
          <circle
            cx={linking.to.x}
            cy={linking.to.y}
            r={4}
            className="fill-accent"
          />
        </svg>
      )}

      <div className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-[2px] border border-line bg-ink-raised p-0.5">
        <button
          type="button"
          onClick={() => zoomOut({ duration: 150 })}
          className="btn btn-ghost btn-sm btn-icon"
          aria-label={copy.zoomOut}
          title={copy.zoomOut}
        >
          <Minus size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => zoomIn({ duration: 150 })}
          className="btn btn-ghost btn-sm btn-icon"
          aria-label={copy.zoomIn}
          title={copy.zoomIn}
        >
          <Plus size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => fitView({ padding: 0.15, duration: 200 })}
          className="btn btn-ghost btn-sm"
        >
          <Maximize size={13} aria-hidden="true" />
          {copy.fitView}
        </button>
        <span className="mx-0.5 h-4 w-px bg-line" aria-hidden="true" />
        <button
          type="button"
          onClick={toggleRoutes}
          aria-pressed={showRoutes}
          title={copy.routesToggleHint}
          className={`btn btn-ghost btn-sm ${showRoutes ? 'text-chalk' : 'text-chalk-faint'}`}
        >
          <Route size={13} aria-hidden="true" />
          {copy.routesToggle}
        </button>
      </div>

      {showConnectHint && (
        <p className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-xs rounded-[2px] border border-line bg-ink-raised px-2.5 py-1.5 text-2xs leading-4 text-chalk-dim">
          {copy.connection.canvasHint}
        </p>
      )}

      {isEmpty && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
          <div className="pointer-events-auto max-w-sm rounded-[6px] border border-line bg-ink-raised p-6 text-center">
            <h2 className="font-display text-heading font-semibold text-chalk">
              {copy.emptyTitle}
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-chalk-dim">
              {copy.emptyBody}
            </p>
            <button
              type="button"
              onClick={onCreateAccount}
              className="btn btn-primary btn-md mt-5"
            >
              <Plus size={15} aria-hidden="true" />
              {copy.emptyCta}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Canvas do Studio Cloud (React Flow) — a hierarquia AWS como sub-flows aninhados. */
export default function CloudCanvas(props: CloudCanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
