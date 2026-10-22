import {
  getCatalogEntry,
  type CloudCatalogEntry,
  type LocalizedText,
} from './catalog';
import type { CloudPoint, CloudResource, CloudSize, CloudState } from './types';

/**
 * Árvore e layout do rascunho cloud — funções puras sobre a lista plana de
 * recursos (ligada por `parentId`). Usadas pelo slice (adicionar/mover/
 * remover), pela paleta (o que pode ser criado agora e onde) e pelo canvas.
 */

/** Altura da faixa de título de um container (ícone + nome). */
export const CONTAINER_HEADER = 44;
export const CONTAINER_PADDING = 20;
export const CHILD_GAP = 20;
export const NODE_SIZE: CloudSize = { width: 112, height: 92 };
const FALLBACK_CONTAINER: CloudSize = { width: 480, height: 280 };

export function childrenOf(
  resources: CloudResource[],
  parentId: string | null,
) {
  return resources.filter((resource) => resource.parentId === parentId);
}

/** Vira nó no canvas? Itens de configuração (SG, NACL) têm `canvas: false`. */
export function isOnCanvas(resource: CloudResource) {
  return getCatalogEntry(resource.type)?.canvas !== false;
}

/** Filhos que ocupam espaço no canvas — o layout só considera estes. */
export function canvasChildrenOf(
  resources: CloudResource[],
  parentId: string | null,
) {
  return childrenOf(resources, parentId).filter(isOnCanvas);
}

export function findResource(
  resources: CloudResource[],
  id: string | null | undefined,
) {
  return id ? resources.find((resource) => resource.id === id) : undefined;
}

/** Ancestrais do mais próximo ao mais distante. */
export function ancestorsOf(
  resources: CloudResource[],
  id: string,
): CloudResource[] {
  const chain: CloudResource[] = [];
  let current = findResource(resources, findResource(resources, id)?.parentId);
  while (current) {
    chain.push(current);
    current = findResource(resources, current.parentId);
  }
  return chain;
}

/** O próprio id e todos os descendentes. */
export function subtreeIds(
  resources: CloudResource[],
  id: string,
): Set<string> {
  const ids = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const resource of resources) {
      if (
        resource.parentId &&
        ids.has(resource.parentId) &&
        !ids.has(resource.id)
      ) {
        ids.add(resource.id);
        grew = true;
      }
    }
  }
  return ids;
}

/** Pais antes dos filhos — ordem exigida pelo React Flow para sub-flows. */
export function sortParentsFirst(resources: CloudResource[]): CloudResource[] {
  const depth = (resource: CloudResource) =>
    ancestorsOf(resources, resource.id).length;
  return [...resources].sort((a, b) => depth(a) - depth(b));
}

export function sizeOf(resource: CloudResource): CloudSize {
  if (resource.size) return resource.size;
  const entry = getCatalogEntry(resource.type);
  return entry?.kind === 'container'
    ? (entry.defaultSize ?? FALLBACK_CONTAINER)
    : NODE_SIZE;
}

/**
 * Próxima posição livre para um filho novo dentro de `parentId`, conforme o
 * catálogo do pai: containers lado a lado (`childLayout: 'row'`, padrão) ou
 * empilhados (`'column'`, subnets dentro da AZ); nós folha em grade abaixo
 * dos containers — ou numa faixa acima deles (`nodeBand: 'top'`, IGW e
 * endpoints na VPC, fora das AZs).
 */
export function nextChildPosition(
  resources: CloudResource[],
  parentId: string | null,
  kind: CloudCatalogEntry['kind'],
  rootPlacement?: CloudCatalogEntry['rootPlacement'],
): CloudPoint {
  const siblings = canvasChildrenOf(resources, parentId);
  // Internet / usuários: à esquerda do que já está na raiz, na altura do título.
  if (parentId === null && rootPlacement === 'left') {
    const minX = siblings.reduce(
      (min, s) => Math.min(min, s.position.x),
      Infinity,
    );
    const topY = siblings.reduce(
      (min, s) => Math.min(min, s.position.y),
      Infinity,
    );
    return Number.isFinite(minX)
      ? {
          x: minX - NODE_SIZE.width - 4 * CHILD_GAP,
          y: topY + CONTAINER_HEADER + 2 * CHILD_GAP,
        }
      : { x: 0, y: 0 };
  }
  const parent = findResource(resources, parentId);
  const parentEntry = parent ? getCatalogEntry(parent.type) : undefined;
  const top = parentId ? CONTAINER_HEADER : 0;
  const left = parentId ? CONTAINER_PADDING : 0;
  const nodeBandTop = parentEntry?.nodeBand === 'top';
  const containers = siblings.filter(
    (s) => getCatalogEntry(s.type)?.kind === 'container',
  );
  const nodes = siblings.filter(
    (s) => getCatalogEntry(s.type)?.kind !== 'container',
  );

  if (kind === 'container') {
    const containersTop = nodeBandTop
      ? top + NODE_SIZE.height + CHILD_GAP
      : top;
    if (parentEntry?.childLayout === 'column') {
      const bottom = containers.reduce(
        (max, s) => Math.max(max, s.position.y + sizeOf(s).height),
        -Infinity,
      );
      return {
        x: left,
        y: Number.isFinite(bottom) ? bottom + CHILD_GAP : containersTop,
      };
    }
    const right = containers.reduce(
      (max, s) => Math.max(max, s.position.x + sizeOf(s).width),
      -Infinity,
    );
    return {
      x: Number.isFinite(right) ? right + CHILD_GAP : left,
      y: containersTop,
    };
  }

  const usableWidth = parent
    ? sizeOf(parent).width - 2 * CONTAINER_PADDING
    : 4 * NODE_SIZE.width;
  const perRow = Math.max(
    1,
    Math.floor((usableWidth + CHILD_GAP) / (NODE_SIZE.width + CHILD_GAP)),
  );
  const index = nodes.length;
  const x = left + (index % perRow) * (NODE_SIZE.width + CHILD_GAP);
  if (nodeBandTop) return { x, y: top };
  const containersBottom = containers.reduce(
    (max, s) => Math.max(max, s.position.y + sizeOf(s).height + CHILD_GAP),
    top,
  );
  return {
    x,
    y:
      containersBottom +
      Math.floor(index / perRow) * (NODE_SIZE.height + CHILD_GAP),
  };
}

/**
 * Depois que `grownId` cresceu, empurra os containers irmãos que vêm depois
 * dele no eixo do layout do pai (para baixo em `column`, para a direita em
 * `row`) e que agora ficariam sobrepostos — ex.: a NAT faz a subnet pública
 * crescer e a privada abaixo dela desce junto.
 */
export function pushFollowingSiblings(
  resources: CloudResource[],
  grownId: string,
): CloudResource[] {
  const grown = findResource(resources, grownId);
  if (!grown?.parentId) return resources;
  const parent = findResource(resources, grown.parentId);
  const axis =
    parent && getCatalogEntry(parent.type)?.childLayout === 'column'
      ? 'y'
      : 'x';
  const cross = axis === 'y' ? 'x' : 'y';
  const extent = (r: CloudResource, a: 'x' | 'y') =>
    a === 'x' ? sizeOf(r).width : sizeOf(r).height;
  const overlapsCross = (a: CloudResource, b: CloudResource) =>
    a.position[cross] < b.position[cross] + extent(b, cross) &&
    b.position[cross] < a.position[cross] + extent(a, cross);

  const followers = canvasChildrenOf(resources, grown.parentId)
    .filter(
      (s) => s.id !== grown.id && getCatalogEntry(s.type)?.kind === 'container',
    )
    .filter(
      (s) => s.position[axis] > grown.position[axis] && overlapsCross(s, grown),
    )
    .sort((a, b) => a.position[axis] - b.position[axis]);

  let cursor = grown.position[axis] + extent(grown, axis);
  const moved = new Map<string, number>();
  for (const sibling of followers) {
    const start = Math.max(sibling.position[axis], cursor + CHILD_GAP);
    if (start !== sibling.position[axis]) moved.set(sibling.id, start);
    cursor = start + extent(sibling, axis);
  }
  if (moved.size === 0) return resources;
  return resources.map((r) =>
    moved.has(r.id)
      ? { ...r, position: { ...r.position, [axis]: moved.get(r.id)! } }
      : r,
  );
}

/**
 * Cresce cada ancestral de `id` (de dentro pra fora) até caber todos os
 * filhos com folga, empurrando os irmãos seguintes do que cresceu. Nunca
 * encolhe sozinho — encolher é ação do usuário.
 */
export function fitAncestors(
  resources: CloudResource[],
  id: string,
): CloudResource[] {
  let next = resources;
  let current = findResource(next, id);
  while (current?.parentId) {
    const parent = findResource(next, current.parentId);
    if (!parent) break;
    const size = sizeOf(parent);
    const children = canvasChildrenOf(next, parent.id);
    const neededWidth = children.reduce(
      (max, child) =>
        Math.max(
          max,
          child.position.x + sizeOf(child).width + CONTAINER_PADDING,
        ),
      size.width,
    );
    const neededHeight = children.reduce(
      (max, child) =>
        Math.max(
          max,
          child.position.y + sizeOf(child).height + CONTAINER_PADDING,
        ),
      size.height,
    );
    if (neededWidth !== size.width || neededHeight !== size.height) {
      next = next.map((r) =>
        r.id === parent.id
          ? { ...r, size: { width: neededWidth, height: neededHeight } }
          : r,
      );
      next = pushFollowingSiblings(next, parent.id);
    }
    current = findResource(next, parent.id);
  }
  return next;
}

/**
 * Limita a posição de `id` ao interior do pai (abaixo da faixa de título,
 * respeitando o padding). Arrastar nunca tira um elemento do container nem
 * faz o container crescer — pra ganhar espaço, o usuário redimensiona o pai.
 */
export function clampToParent(
  resources: CloudResource[],
  id: string,
  position: CloudPoint,
): CloudPoint {
  const resource = findResource(resources, id);
  const parent = findResource(resources, resource?.parentId);
  const round = { x: Math.round(position.x), y: Math.round(position.y) };
  // Na raiz não há limite (a Internet fica à esquerda da conta).
  if (!resource || !parent) return round;
  const size = sizeOf(resource);
  const parentSize = sizeOf(parent);
  const maxX = Math.max(
    CONTAINER_PADDING,
    parentSize.width - size.width - CONTAINER_PADDING,
  );
  const maxY = Math.max(
    CONTAINER_HEADER,
    parentSize.height - size.height - CONTAINER_PADDING,
  );
  return {
    x: Math.min(maxX, Math.max(CONTAINER_PADDING, round.x)),
    y: Math.min(maxY, Math.max(CONTAINER_HEADER, round.y)),
  };
}

/** Menor tamanho possível de um container sem cortar os filhos. */
export function minContainerSize(
  resources: CloudResource[],
  id: string,
): CloudSize {
  return canvasChildrenOf(resources, id).reduce(
    (min, child) => ({
      width: Math.max(
        min.width,
        child.position.x + sizeOf(child).width + CONTAINER_PADDING,
      ),
      height: Math.max(
        min.height,
        child.position.y + sizeOf(child).height + CONTAINER_PADDING,
      ),
    }),
    { width: 240, height: CONTAINER_HEADER + 80 },
  );
}

// ---------------------------------------------------------------------------
//  Paleta: o que pode ser criado agora, e onde
// ---------------------------------------------------------------------------

export type PaletteAvailability =
  | { enabled: true; parentId: string | null }
  | { enabled: false; reason: LocalizedText };

function labelList(types: string[]): LocalizedText {
  const pick = (lang: 'pt' | 'en' | 'es') =>
    types.map((t) => getCatalogEntry(t)?.label[lang] ?? t).join(' / ');
  return { pt: pick('pt'), en: pick('en'), es: pick('es') };
}

/**
 * Pode criar `entry` agora? O pai alvo é o selecionado (ou o ancestral mais
 * próximo do selecionado) quando ele aceita o tipo; senão, o primeiro
 * candidato do rascunho. Sem pai possível → bloqueado com o motivo.
 */
export function paletteAvailability(
  state: CloudState,
  entry: CloudCatalogEntry,
  selectedId: string | null,
): PaletteAvailability {
  const { resources } = state;

  if (entry.parents.length === 0) {
    const atRoot = childrenOf(resources, null).filter(
      (r) => r.type === entry.type,
    ).length;
    if (entry.maxPerParent !== undefined && atRoot >= entry.maxPerParent) {
      return {
        enabled: false,
        reason: {
          pt: `Já existe (limite de ${entry.maxPerParent} por projeto).`,
          en: `Already exists (limit of ${entry.maxPerParent} per project).`,
          es: `Ya existe (límite de ${entry.maxPerParent} por proyecto).`,
        },
      };
    }
    const blocked = entry.requires?.({ state, parent: null });
    return blocked
      ? { enabled: false, reason: blocked }
      : { enabled: true, parentId: null };
  }

  const candidates = resources.filter((r) => entry.parents.includes(r.type));
  if (candidates.length === 0) {
    const needed = labelList(entry.parents);
    return {
      enabled: false,
      reason: {
        pt: `Crie antes: ${needed.pt}.`,
        en: `Create first: ${needed.en}.`,
        es: `Crea antes: ${needed.es}.`,
      },
    };
  }

  const selected = findResource(resources, selectedId);
  const fromSelection = selected
    ? [selected, ...ancestorsOf(resources, selected.id)].find((r) =>
        entry.parents.includes(r.type),
      )
    : undefined;
  const ordered = fromSelection
    ? [fromSelection, ...candidates.filter((c) => c.id !== fromSelection.id)]
    : candidates;

  let lastReason: LocalizedText | null = null;
  for (const parent of ordered) {
    const count = childrenOf(resources, parent.id).filter(
      (r) => r.type === entry.type,
    ).length;
    if (entry.maxPerParent !== undefined && count >= entry.maxPerParent) {
      lastReason = {
        pt: `Limite de ${entry.maxPerParent} por ${getCatalogEntry(parent.type)?.label.pt ?? parent.type}.`,
        en: `Limit of ${entry.maxPerParent} per ${getCatalogEntry(parent.type)?.label.en ?? parent.type}.`,
        es: `Límite de ${entry.maxPerParent} por ${getCatalogEntry(parent.type)?.label.es ?? parent.type}.`,
      };
      continue;
    }
    const blocked = entry.requires?.({ state, parent });
    if (blocked) {
      lastReason = blocked;
      continue;
    }
    return { enabled: true, parentId: parent.id };
  }
  return { enabled: false, reason: lastReason ?? labelList(entry.parents) };
}
