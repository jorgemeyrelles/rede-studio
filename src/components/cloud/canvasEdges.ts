import type { Node } from '@xyflow/react';
import {
  fallbackRoute,
  offsetPolyline,
  PAIR_OFFSET,
  placeLabels,
  routeOrthogonal,
  type Point,
  type Rect,
} from '../../features/cloud/edgeGeometry';
import {
  connectionIssue,
  connectionLabel,
  type ConnectionKind,
} from '../../features/cloud/engines/connections';
import { edgeAssociations } from '../../features/cloud/engines/edge';
import { deriveRouteTables } from '../../features/cloud/engines/routing';
import { VPC_TYPE } from '../../features/cloud/network';
import { ancestorsOf, CONTAINER_HEADER } from '../../features/cloud/tree';
import type {
  CloudConnection,
  CloudResource,
} from '../../features/cloud/types';
import type { AppLanguage } from '../../types/i18n';
import { getCloudCopy } from './cloudCopy';
import type { CloudEdgeKind, CloudEdgeType } from './CloudEdge';
import type { CloudNodeData } from './nodes';

/** Rotas já calculadas, por aresta (reaproveitadas durante o arrasto). */
export type RouteCache = Map<string, Point[]>;

/** Retângulo absoluto de cada nó (posição relativa somada à dos pais). */
function absoluteRects(nodes: Node<CloudNodeData>[]): Map<string, Rect> {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const out = new Map<string, Rect>();
  const resolve = (node: Node<CloudNodeData>): Rect => {
    const cached = out.get(node.id);
    if (cached) return cached;
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    const origin = parent ? resolve(parent) : { x: 0, y: 0 };
    const rect = {
      x: origin.x + node.position.x,
      y: origin.y + node.position.y,
      width: node.measured?.width ?? node.width ?? 0,
      height: node.measured?.height ?? node.height ?? 0,
    };
    out.set(node.id, rect);
    return rect;
  };
  nodes.forEach(resolve);
  return out;
}

type EdgeSpec = {
  id: string;
  source: string;
  target: string;
  kind: CloudEdgeKind;
  arrowStart: boolean;
  arrowEnd: boolean;
  derived: boolean;
  tone?: 'warn';
  connection?: CloudConnection;
  /** Par ida/volta: deslocamento lateral (a volta percorre a rota da ida ao contrário). */
  pair?: { forwardId: string; offset: number; reversed: boolean };
};

/**
 * Rotas implícitas (sugestão do usuário para IGW, NAT e endpoints): saem das
 * route tables derivadas (F3) — IGW ↔ subnets públicas, subnets privadas →
 * NAT da rota padrão e, só com o endpoint selecionado, subnets → endpoint.
 */
function routeEdges(
  resources: CloudResource[],
  selectedId: string | null,
): EdgeSpec[] {
  const out: EdgeSpec[] = [];
  for (const vpc of resources.filter((r) => r.type === VPC_TYPE)) {
    for (const table of deriveRouteTables(resources, vpc.id)) {
      for (const route of table.routes) {
        const targetId = route.target.id;
        if (!targetId || route.origin !== 'auto') continue;
        const isEndpoint = route.target.kind === 'vpce';
        if (isEndpoint && selectedId !== targetId) continue;
        if (!['igw', 'nat', 'vpce'].includes(route.target.kind)) continue;
        for (const subnetId of table.subnetIds) {
          out.push({
            id: `route:${route.target.kind}:${targetId}:${subnetId}`,
            source: subnetId,
            target: targetId,
            kind: 'route',
            // IGW: tráfego nos dois sentidos; NAT e endpoint: a subnet sai por eles.
            arrowStart: route.target.kind === 'igw',
            arrowEnd: true,
            derived: true,
            tone: route.crossAz ? 'warn' : undefined,
          });
        }
      }
    }
  }
  return out;
}

/**
 * Associações de configuração (WAF → protegido, certificado → quem usa, zona
 * DNS → alvo do registro): só aparecem com uma das pontas selecionada, para
 * não virar teia.
 */
function associationEdges(
  resources: CloudResource[],
  selectedId: string | null,
): EdgeSpec[] {
  if (!selectedId) return [];
  return edgeAssociations(resources)
    .filter((a) => a.from === selectedId || a.to === selectedId)
    .map((a) => ({
      id: `link:${a.kind}:${a.from}:${a.to}`,
      source: a.from,
      target: a.to,
      kind: 'link',
      arrowStart: false,
      arrowEnd: true,
      derived: true,
    }));
}

function connectionEdges(connections: CloudConnection[]): EdgeSpec[] {
  return connections.map((connection) => {
    const partner = connection.pairId
      ? connections.find((c) => c.id === connection.pairId)
      : undefined;
    const forward =
      partner && partner.id < connection.id ? partner : connection;
    const both = connection.direction === 'both' && !connection.pairId;
    return {
      id: connection.id,
      source: forward.source,
      target: forward.target,
      kind: connection.kind as ConnectionKind,
      // A volta do par percorre a rota da ida ao contrário: a seta fica no fim dela também.
      arrowStart: both,
      arrowEnd: true,
      derived: false,
      connection,
      pair: partner
        ? {
            forwardId: forward.id,
            offset: forward === connection ? PAIR_OFFSET / 2 : -PAIR_OFFSET / 2,
            reversed: forward !== connection,
          }
        : undefined,
    };
  });
}

/**
 * Arestas do canvas: rota ortogonal desviando dos recursos e das faixas de
 * título dos containers que a linha não "entra" (os ancestrais das pontas
 * podem ser cruzados). Durante o arrasto (`moving`), as arestas ligadas ao
 * que se move usam a rota em "Z" (instantânea) e as demais reaproveitam o
 * `cache`; ao soltar, tudo é roteado de novo.
 */
export function buildCanvasEdges(params: {
  nodes: Node<CloudNodeData>[];
  resources: CloudResource[];
  connections: CloudConnection[];
  selectedConnectionId: string | null;
  selectedResourceId: string | null;
  language: AppLanguage;
  showRoutes: boolean;
  moving: Set<string> | null;
  cache: RouteCache;
}): CloudEdgeType[] {
  const { nodes, resources, connections, language, moving, cache } = params;
  const rects = absoluteRects(nodes);
  const specs = [
    ...(params.showRoutes
      ? routeEdges(resources, params.selectedResourceId)
      : []),
    ...associationEdges(resources, params.selectedResourceId),
    ...connectionEdges(connections),
  ].filter((spec) => rects.has(spec.source) && rects.has(spec.target));

  const leafRects = nodes
    .filter((n) => n.type === 'cloudResource')
    .map((n) => ({ id: n.id, rect: rects.get(n.id)! }));
  const headers = nodes
    .filter((n) => n.type === 'cloudContainer')
    .map((n) => ({
      id: n.id,
      rect: { ...rects.get(n.id)!, height: CONTAINER_HEADER },
    }));
  const lineage = (id: string) =>
    new Set([id, ...ancestorsOf(resources, id).map((r) => r.id)]);

  const routeFor = (spec: EdgeSpec): Point[] => {
    const key = spec.pair ? `pair:${spec.pair.forwardId}` : spec.id;
    const source = rects.get(spec.source)!;
    const target = rects.get(spec.target)!;
    const touchesMoving =
      moving && (moving.has(spec.source) || moving.has(spec.target));
    if (moving) {
      if (touchesMoving) return fallbackRoute(source, target);
      const cached = cache.get(key);
      if (cached) return cached;
    }
    const open = new Set([...lineage(spec.source), ...lineage(spec.target)]);
    const obstacles = [
      ...leafRects
        .filter((l) => l.id !== spec.source && l.id !== spec.target)
        .map((l) => l.rect),
      ...headers.filter((h) => !open.has(h.id)).map((h) => h.rect),
    ];
    const route = routeOrthogonal(source, target, obstacles);
    cache.set(key, route);
    return route;
  };

  const points = new Map<string, Point[]>();
  for (const spec of specs) {
    let route = routeFor(spec);
    if (spec.pair) {
      route = offsetPolyline(route, spec.pair.offset);
      if (spec.pair.reversed) route = [...route].reverse();
    }
    points.set(spec.id, route);
  }

  // Rótulos só nas conexões do usuário; obstáculos = recursos e títulos.
  const labelObstacles = [
    ...leafRects.map((l) => l.rect),
    ...headers.map((h) => h.rect),
  ];
  const userSpecs = specs
    .filter((s) => s.connection)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  const labels = placeLabels(
    userSpecs.map((s) => ({
      id: s.id,
      points: points.get(s.id)!,
      text: connectionLabel(s.connection!),
    })),
    labelObstacles,
  );

  const nameOf = (id: string) => resources.find((r) => r.id === id)?.name ?? id;
  return specs.map((spec) => {
    const selected = spec.id === params.selectedConnectionId;
    const label = labels.get(spec.id);
    return {
      id: spec.id,
      source: spec.source,
      target: spec.target,
      type: 'cloudEdge' as const,
      selected,
      selectable: !spec.derived,
      deletable: !spec.derived,
      focusable: !spec.derived,
      // Derivadas são só leitura e fora do Tab: escondidas do leitor de tela
      // (o rótulo padrão do React Flow seria em inglês).
      ...(spec.connection
        ? {
            ariaLabel: getCloudCopy(language).a11y.edge(
              nameOf(spec.connection.source),
              nameOf(spec.connection.target),
              connectionLabel(spec.connection),
            ),
          }
        : { domAttributes: { 'aria-hidden': true } }),
      zIndex: spec.derived ? 900 : 1000,
      data: {
        points: points.get(spec.id)!,
        kind: spec.kind,
        arrowStart: spec.arrowStart,
        arrowEnd: spec.arrowEnd,
        derived: spec.derived,
        tone: spec.tone,
        label:
          label && spec.connection
            ? { ...label, text: connectionLabel(spec.connection) }
            : null,
        issue: spec.connection
          ? (connectionIssue(resources, spec.connection, connections)?.[
              language
            ] ?? null)
          : null,
      },
    };
  });
}
