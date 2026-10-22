/**
 * Geometria das arestas do canvas cloud: rota ORTOGONAL (só segmentos
 * horizontais e verticais, com dobras) que sai e chega pelo lado mais
 * conveniente de cada elemento e desvia dos recursos e das faixas de título
 * dos containers; deslocamento paralelo para o par ida/volta; caminho com
 * cantos arredondados; pontas de seta; e posição dos rótulos sem colidir com
 * nós nem com outros rótulos (candidatos ao longo da rota, o primeiro livre
 * vence — mesma ideia do `linkLabelPlacement.ts` do on-prem). Puro.
 *
 * O roteador monta uma grade esparsa com as coordenadas "interessantes"
 * (bordas dos obstáculos com folga, saídas dos lados, eixos entre as
 * pontas) e roda Dijkstra com custo = comprimento + penalidade por dobra.
 */

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };

/** Distância entre as duas arestas de um par (cada uma vai metade para um lado). */
export const PAIR_OFFSET = 10;

/** Folga entre a linha e os elementos (e comprimento do toco de saída). */
const CLEARANCE = 14;
/** Penalidade por dobra: prefere menos curvas a um caminho um pouco mais curto. */
const BEND_COST = 28;
/** Quanto além das pontas a busca pode ir para contornar obstáculos. */
const SEARCH_MARGIN = 220;

type Dir = 0 | 1 | 2 | 3; // 0 direita, 1 baixo, 2 esquerda, 3 cima
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];

export const rectsOverlap = (a: Rect, b: Rect, gap = 2) =>
  a.x < b.x + b.width + gap &&
  b.x < a.x + a.width + gap &&
  a.y < b.y + b.height + gap &&
  b.y < a.y + a.height + gap;

const inflate = (r: Rect, by: number): Rect => ({
  x: r.x - by,
  y: r.y - by,
  width: r.width + 2 * by,
  height: r.height + 2 * by,
});

const strictlyInside = (p: Point, r: Rect) =>
  p.x > r.x && p.x < r.x + r.width && p.y > r.y && p.y < r.y + r.height;

type Port = { point: Point; stub: Point; dir: Dir };

/** Meio de cada lado, com o toco para fora (`dir` = direção de saída). */
function portsOf(r: Rect): Port[] {
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;
  return [
    {
      point: { x: r.x + r.width, y: cy },
      stub: { x: r.x + r.width + CLEARANCE, y: cy },
      dir: 0,
    },
    {
      point: { x: cx, y: r.y + r.height },
      stub: { x: cx, y: r.y + r.height + CLEARANCE },
      dir: 1,
    },
    { point: { x: r.x, y: cy }, stub: { x: r.x - CLEARANCE, y: cy }, dir: 2 },
    { point: { x: cx, y: r.y }, stub: { x: cx, y: r.y - CLEARANCE }, dir: 3 },
  ];
}

/** Segmento horizontal/vertical atravessa o interior de algum obstáculo? */
function segmentBlocked(a: Point, b: Point, blocks: Rect[]) {
  if (a.y === b.y) {
    const x1 = Math.min(a.x, b.x);
    const x2 = Math.max(a.x, b.x);
    return blocks.some(
      (o) =>
        a.y > o.y && a.y < o.y + o.height && x1 < o.x + o.width && x2 > o.x,
    );
  }
  const y1 = Math.min(a.y, b.y);
  const y2 = Math.max(a.y, b.y);
  return blocks.some(
    (o) => a.x > o.x && a.x < o.x + o.width && y1 < o.y + o.height && y2 > o.y,
  );
}

/** Heap binário mínimo (Dijkstra). */
class MinHeap<T> {
  private items: { key: number; value: T }[] = [];
  get size() {
    return this.items.length;
  }
  push(key: number, value: T) {
    const items = this.items;
    items.push({ key, value });
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (items[parent].key <= items[i].key) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }
  pop(): { key: number; value: T } | undefined {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length && last) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < items.length && items[l].key < items[m].key) m = l;
        if (r < items.length && items[r].key < items[m].key) m = r;
        if (m === i) break;
        [items[m], items[i]] = [items[i], items[m]];
        i = m;
      }
    }
    return top;
  }
}

/** Remove pontos repetidos e colineares. */
export function simplify(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && last.x === p.x && last.y === p.y) continue;
    const prev = out[out.length - 2];
    if (
      prev &&
      last &&
      ((prev.x === last.x && last.x === p.x) ||
        (prev.y === last.y && last.y === p.y))
    ) {
      out[out.length - 1] = p;
      continue;
    }
    out.push(p);
  }
  return out;
}

/**
 * Rota ortogonal de `source` até `target` desviando de `obstacles` (que não
 * devem incluir as próprias pontas). Sem caminho livre, devolve um "Z"
 * simples entre os lados que se encaram.
 */
export function routeOrthogonal(
  source: Rect,
  target: Rect,
  obstacles: Rect[],
): Point[] {
  const box = {
    x1: Math.min(source.x, target.x) - SEARCH_MARGIN,
    y1: Math.min(source.y, target.y) - SEARCH_MARGIN,
    x2:
      Math.max(source.x + source.width, target.x + target.width) +
      SEARCH_MARGIN,
    y2:
      Math.max(source.y + source.height, target.y + target.height) +
      SEARCH_MARGIN,
  };
  const near = obstacles.filter(
    (o) =>
      o.x < box.x2 &&
      o.x + o.width > box.x1 &&
      o.y < box.y2 &&
      o.y + o.height > box.y1,
  );
  const blocks = [...near, source, target].map((o) =>
    inflate(o, CLEARANCE - 2),
  );
  const sourcePorts = portsOf(source).filter(
    (p) => !blocks.some((b) => strictlyInside(p.stub, b)),
  );
  const targetPorts = portsOf(target).filter(
    (p) => !blocks.some((b) => strictlyInside(p.stub, b)),
  );

  const xsSet = new Set<number>();
  const ysSet = new Set<number>();
  for (const o of [...near, source, target]) {
    xsSet.add(o.x - CLEARANCE).add(o.x + o.width + CLEARANCE);
    ysSet.add(o.y - CLEARANCE).add(o.y + o.height + CLEARANCE);
  }
  for (const p of [...sourcePorts, ...targetPorts]) {
    xsSet.add(p.stub.x);
    ysSet.add(p.stub.y);
  }
  // Eixos entre as pontas: rotas em "Z" e "L" centradas.
  xsSet.add(
    Math.round((source.x + source.width / 2 + target.x + target.width / 2) / 2),
  );
  ysSet.add(
    Math.round(
      (source.y + source.height / 2 + target.y + target.height / 2) / 2,
    ),
  );
  const xs = [...xsSet]
    .filter((x) => x >= box.x1 && x <= box.x2)
    .sort((a, b) => a - b);
  const ys = [...ysSet]
    .filter((y) => y >= box.y1 && y <= box.y2)
    .sort((a, b) => a - b);
  const xi = new Map(xs.map((x, i) => [x, i]));
  const yi = new Map(ys.map((y, i) => [y, i]));
  const W = xs.length;
  const H = ys.length;
  const free = (i: number, j: number) =>
    !blocks.some((b) => strictlyInside({ x: xs[i], y: ys[j] }, b));

  // Estado = (i, j, direção de chegada). Custo inicial = toco de saída.
  const size = W * H * 4;
  const dist = new Float64Array(size).fill(Infinity);
  const prev = new Int32Array(size).fill(-1);
  const heap = new MinHeap<number>();
  for (const port of sourcePorts) {
    const i = xi.get(port.stub.x);
    const j = yi.get(port.stub.y);
    if (i === undefined || j === undefined) continue;
    const state = (j * W + i) * 4 + port.dir;
    if (CLEARANCE < dist[state]) {
      dist[state] = CLEARANCE;
      heap.push(CLEARANCE, state);
    }
  }
  const goals = new Map<number, Port>();
  for (const port of targetPorts) {
    const i = xi.get(port.stub.x);
    const j = yi.get(port.stub.y);
    if (i !== undefined && j !== undefined) goals.set(j * W + i, port);
  }

  let best = { cost: Infinity, state: -1, port: null as Port | null };
  while (heap.size) {
    const { key, value: state } = heap.pop()!;
    if (key > dist[state] || key >= best.cost) continue;
    const dir = (state % 4) as Dir;
    const cell = (state - dir) / 4;
    const i = cell % W;
    const j = (cell - i) / W;
    const goal = goals.get(cell);
    if (goal) {
      // Último trecho: do toco até o lado, entrando contra a saída do lado.
      const inward = ((goal.dir + 2) % 4) as Dir;
      const total = key + CLEARANCE + (dir === inward ? 0 : BEND_COST);
      if (total < best.cost) best = { cost: total, state, port: goal };
    }
    for (let d = 0 as Dir; d < 4; d = (d + 1) as Dir) {
      if (d === (dir + 2) % 4) continue; // sem meia-volta
      const ni = i + DX[d];
      const nj = j + DY[d];
      if (ni < 0 || nj < 0 || ni >= W || nj >= H || !free(ni, nj)) continue;
      const a = { x: xs[i], y: ys[j] };
      const b = { x: xs[ni], y: ys[nj] };
      if (segmentBlocked(a, b, blocks)) continue;
      const next = (nj * W + ni) * 4 + d;
      const cost =
        key +
        Math.abs(b.x - a.x) +
        Math.abs(b.y - a.y) +
        (d === dir ? 0 : BEND_COST);
      if (cost < dist[next]) {
        dist[next] = cost;
        prev[next] = state;
        heap.push(cost, next);
      }
    }
  }

  if (best.state < 0 || !best.port) return fallbackRoute(source, target);
  const cells: Point[] = [];
  let state = best.state;
  let first = state;
  while (state >= 0) {
    const cell = (state - (state % 4)) / 4;
    const i = cell % W;
    cells.push({ x: xs[i], y: ys[(cell - i) / W] });
    first = state;
    state = prev[state];
  }
  cells.reverse();
  const startPort =
    sourcePorts.find(
      (p) =>
        p.stub.x === cells[0].x &&
        p.stub.y === cells[0].y &&
        p.dir === first % 4,
    ) ??
    sourcePorts.find(
      (p) => p.stub.x === cells[0].x && p.stub.y === cells[0].y,
    )!;
  return simplify([startPort.point, ...cells, best.port.point]);
}

/** "Z" entre os lados que se encaram (quando não há caminho livre). */
export function fallbackRoute(source: Rect, target: Rect): Point[] {
  const sc = {
    x: source.x + source.width / 2,
    y: source.y + source.height / 2,
  };
  const tc = {
    x: target.x + target.width / 2,
    y: target.y + target.height / 2,
  };
  if (Math.abs(tc.x - sc.x) >= Math.abs(tc.y - sc.y)) {
    const right = tc.x >= sc.x;
    const a = { x: right ? source.x + source.width : source.x, y: sc.y };
    const b = { x: right ? target.x : target.x + target.width, y: tc.y };
    const mx = (a.x + b.x) / 2;
    return simplify([a, { x: mx, y: a.y }, { x: mx, y: b.y }, b]);
  }
  const down = tc.y >= sc.y;
  const a = { x: sc.x, y: down ? source.y + source.height : source.y };
  const b = { x: tc.x, y: down ? target.y : target.y + target.height };
  const my = (a.y + b.y) / 2;
  return simplify([a, { x: a.x, y: my }, { x: b.x, y: my }, b]);
}

/** Desloca uma rota ortogonal `d` px para o lado (o par ida/volta corre em paralelo). */
export function offsetPolyline(points: Point[], d: number): Point[] {
  if (points.length < 2 || d === 0) return points;
  const segs = points.slice(1).map((b, k) => {
    const a = points[k];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = (-(b.y - a.y) / len) * d;
    const ny = ((b.x - a.x) / len) * d;
    return {
      a: { x: a.x + nx, y: a.y + ny },
      b: { x: b.x + nx, y: b.y + ny },
      horizontal: a.y === b.y,
    };
  });
  const out: Point[] = [segs[0].a];
  for (let k = 0; k < segs.length - 1; k++) {
    const s = segs[k];
    const t = segs[k + 1];
    out.push(s.horizontal ? { x: t.a.x, y: s.a.y } : { x: s.a.x, y: t.a.y });
  }
  out.push(segs[segs.length - 1].b);
  return out;
}

/** Caminho SVG com cantos arredondados (raio até 8px). */
export function polylinePath(points: Point[], radius = 8): string {
  if (points.length < 2) return '';
  let d = `M ${points[0].x},${points[0].y}`;
  for (let k = 1; k < points.length - 1; k++) {
    const p = points[k];
    const a = points[k - 1];
    const b = points[k + 1];
    const r = Math.min(
      radius,
      Math.hypot(p.x - a.x, p.y - a.y) / 2,
      Math.hypot(b.x - p.x, b.y - p.y) / 2,
    );
    const inX = p.x - Math.sign(p.x - a.x) * r;
    const inY = p.y - Math.sign(p.y - a.y) * r;
    const outX = p.x + Math.sign(b.x - p.x) * r;
    const outY = p.y + Math.sign(b.y - p.y) * r;
    d += ` L ${inX},${inY} Q ${p.x},${p.y} ${outX},${outY}`;
  }
  const last = points[points.length - 1];
  return `${d} L ${last.x},${last.y}`;
}

/** Triângulo da ponta de seta em `tip`, apontando de `from` para `tip`. */
export function arrowHead(from: Point, tip: Point, size = 9): string {
  const len = Math.hypot(tip.x - from.x, tip.y - from.y) || 1;
  const ux = (tip.x - from.x) / len;
  const uy = (tip.y - from.y) / len;
  const bx = tip.x - ux * size;
  const by = tip.y - uy * size;
  const w = size * 0.55;
  return `${tip.x},${tip.y} ${bx - uy * w},${by + ux * w} ${bx + uy * w},${by - ux * w}`;
}

/** Ponto a uma fração `t` do comprimento da rota, com a direção do trecho. */
export function pointAlong(
  points: Point[],
  t: number,
): { point: Point; dx: number; dy: number } {
  const lengths = points
    .slice(1)
    .map((b, k) => Math.hypot(b.x - points[k].x, b.y - points[k].y));
  const total = lengths.reduce((s, l) => s + l, 0);
  let left = total * t;
  for (let k = 0; k < lengths.length; k++) {
    if (left <= lengths[k] || k === lengths.length - 1) {
      const a = points[k];
      const b = points[k + 1];
      const f = lengths[k] ? Math.min(1, left / lengths[k]) : 0;
      return {
        point: { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f },
        dx: b.x - a.x,
        dy: b.y - a.y,
      };
    }
    left -= lengths[k];
  }
  return { point: points[0], dx: 1, dy: 0 };
}

/** Tamanho estimado do rótulo (fonte mono 11px). */
export function labelSize(text: string) {
  return { width: Math.ceil(text.length * 6.7) + 12, height: 18 };
}

const T_CANDIDATES = [0.5, 0.4, 0.6, 0.3, 0.7, 0.22, 0.78];
// Até ±64px: numa ligação curta entre nós vizinhos, o rótulo sobe acima
// (ou desce abaixo) dos nós de 92px.
const NORMAL_SHIFTS = [0, -14, 14, -26, 26, -40, 40, -56, 56, -64, 64];

export type LabelRequest = { id: string; points: Point[]; text: string };
export type LabelPlacement = {
  x: number;
  y: number;
  width: number;
  height: number;
  collides: boolean;
};

/**
 * Coloca os rótulos em ordem: para cada um, tenta pontos ao longo da rota
 * (e deslocados para os lados); o primeiro sem colisão vence. Sem lugar
 * livre, fica no meio marcado `collides` (o canvas reduz a opacidade).
 */
export function placeLabels(
  requests: LabelRequest[],
  obstacles: Rect[],
): Map<string, LabelPlacement> {
  const placed: Rect[] = [];
  const out = new Map<string, LabelPlacement>();
  for (const request of requests) {
    const size = labelSize(request.text);
    let chosen: LabelPlacement | null = null;
    search: for (const t of T_CANDIDATES) {
      const { point, dx, dy } = pointAlong(request.points, t);
      const length = Math.hypot(dx, dy) || 1;
      for (const shift of NORMAL_SHIFTS) {
        const center = {
          x: point.x + (-dy / length) * shift,
          y: point.y + (dx / length) * shift,
        };
        const rect = {
          x: center.x - size.width / 2,
          y: center.y - size.height / 2,
          ...size,
        };
        if (
          !obstacles.some((o) => rectsOverlap(rect, o)) &&
          !placed.some((p) => rectsOverlap(rect, p))
        ) {
          chosen = { x: center.x, y: center.y, ...size, collides: false };
          break search;
        }
      }
    }
    if (!chosen) {
      const { point } = pointAlong(request.points, 0.5);
      chosen = { x: point.x, y: point.y, ...size, collides: true };
    }
    placed.push({
      x: chosen.x - chosen.width / 2,
      y: chosen.y - chosen.height / 2,
      width: chosen.width,
      height: chosen.height,
    });
    out.set(request.id, chosen);
  }
  return out;
}
