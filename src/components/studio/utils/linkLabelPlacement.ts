import * as go from 'gojs';

/**
 * Posicionamento sem colisão dos rótulos de conexão (LINK_LABEL_PANEL).
 *
 * Para cada rótulo visível, testa candidatos ao longo da rota — frações do
 * comprimento total × deslocamento perpendicular — e fica com o primeiro
 * cujo retângulo (medido de verdade, via `ensureBounds`) não cruza nós,
 * títulos de contêiner nem rótulos já posicionados.
 *
 * Quando nenhum candidato cabe, o rótulo vira um marcador numerado curto
 * (`①`, `②`…); quem chamou recebe a lista desses casos (o PDF imprime a
 * tabela "Descrição das conexões" com eles).
 */

const FRACTIONS = [0.5, 0.35, 0.65, 0.2, 0.8, 0.1, 0.9];
const OFFSETS = [0, -14, 14, -26, 26];
/** Marcador (①) é pequeno: pode se afastar mais da linha antes de desistir. */
const MARKER_OFFSETS = [0, -12, 12, -24, 24, -38, 38, -54, 54, -72, 72];
const MARKER_FRACTIONS = [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8, 0.1, 0.9, 0.05, 0.95];
const PADDING = 3;
/** Rótulos de contêiner (site/LAN/tier) também são obstáculos. */
export const CONTAINER_TITLE_NAMES = [
  'SITE_TITLE',
  'NETWORK_TITLE',
  'TIER_TITLE',
] as const;

export type LinkLabelOverflow = {
  marker: string;
  link: go.Link;
  text: string;
};

type PlacementOptions = {
  /** Quais links participam (ex.: só os destacados no hover). */
  include: (link: go.Link) => boolean;
  /** Tamanho da fonte do rótulo, em px (mono). */
  fontSizePx: number;
};

const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';

export function markerFor(index: number): string {
  return index < CIRCLED.length ? CIRCLED[index] : `(${index + 1})`;
}

function routeLength(points: go.Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].y - points[i - 1].y,
    );
  }
  return total;
}

function intersects(a: go.Rect, b: go.Rect) {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

function collectObstacles(diagram: go.Diagram): go.Rect[] {
  const obstacles: go.Rect[] = [];
  diagram.nodes.each((node) => {
    if (!node.isVisible()) return;
    if (node instanceof go.Group) {
      for (const name of CONTAINER_TITLE_NAMES) {
        const title = node.findObject(name);
        if (title && title.isVisibleObject()) {
          const tl = title.getDocumentPoint(go.Spot.TopLeft);
          const br = title.getDocumentPoint(go.Spot.BottomRight);
          obstacles.push(new go.Rect(tl, br).inflate(PADDING, PADDING));
        }
      }
      return;
    }
    obstacles.push(node.actualBounds.copy().inflate(PADDING, PADDING));
  });
  return obstacles;
}

/**
 * Posiciona os rótulos dos links selecionados por `include`. Devolve os que
 * não couberam em lugar nenhum (já trocados por marcador numerado).
 * Chamar dentro de uma transação do diagrama.
 */
export function placeLinkLabels(
  diagram: go.Diagram,
  { include }: PlacementOptions,
): LinkLabelOverflow[] {
  const obstacles = collectObstacles(diagram);
  const placed: go.Rect[] = [];
  const overflow: LinkLabelOverflow[] = [];

  const links: go.Link[] = [];
  diagram.links.each((link) => {
    if (include(link)) links.push(link);
  });
  // Rotas curtas primeiro: têm menos espaço livre, escolhem antes.
  links.sort(
    (a, b) => routeLength(a.points.toArray()) - routeLength(b.points.toArray()),
  );

  for (const link of links) {
    const panel = link.findObject('LINK_LABEL_PANEL') as go.Panel | null;
    const textBlock = link.findObject('LINK_LABEL_TEXT') as go.TextBlock | null;
    if (!panel || !textBlock) continue;
    const fullText = String(link.data?.label ?? textBlock.text ?? '');
    if (!fullText) continue;
    textBlock.text = fullText;

    if (link.points.count < 2) continue;
    panel.segmentIndex = NaN;

    // Mede de verdade: aplica o candidato, re-arranja o link e lê os bounds
    // reais do painel (a estimativa pela fonte erra o suficiente pra deixar
    // rótulos encostando).
    const measure = (fraction: number, offset: number): go.Rect => {
      panel.segmentFraction = fraction;
      panel.segmentOffset = new go.Point(0, offset);
      link.ensureBounds();
      return panel.getDocumentBounds();
    };
    const isFree = (rect: go.Rect, checkObstacles: boolean) =>
      !(checkObstacles && obstacles.some((o) => intersects(o, rect))) &&
      !placed.some((p) => intersects(p, rect));

    let chosen: go.Rect | null = null;
    search: for (const fraction of FRACTIONS) {
      for (const offset of OFFSETS) {
        const rect = measure(fraction, offset);
        if (isFree(rect, true)) {
          chosen = rect;
          break search;
        }
      }
    }

    if (chosen) {
      placed.push(chosen.copy().inflate(PADDING, PADDING));
      continue;
    }

    // Nada coube: marcador numerado curto, no ponto mais livre possível.
    const marker = markerFor(overflow.length);
    textBlock.text = marker;
    let markerRect: go.Rect | null = null;
    marker: for (const fraction of MARKER_FRACTIONS) {
      for (const offset of MARKER_OFFSETS) {
        const rect = measure(fraction, offset);
        if (isFree(rect, true)) {
          markerRect = rect;
          break marker;
        }
      }
    }
    if (!markerRect) {
      // Último recurso: ignora nós (o marcador é minúsculo), nunca outro rótulo.
      for (const fraction of FRACTIONS) {
        const rect = measure(fraction, 0);
        if (isFree(rect, false)) {
          markerRect = rect;
          break;
        }
      }
    }
    if (!markerRect) markerRect = measure(0.5, 0);
    placed.push(markerRect.copy().inflate(PADDING, PADDING));
    overflow.push({ marker, link, text: fullText });
  }

  return overflow;
}

/** Restaura o texto completo dos rótulos (depois de um passe que pôs marcadores). */
export function restoreLinkLabelTexts(diagram: go.Diagram) {
  diagram.links.each((link) => {
    const textBlock = link.findObject('LINK_LABEL_TEXT') as go.TextBlock | null;
    if (textBlock && link.data?.label) textBlock.text = String(link.data.label);
  });
}

/**
 * Roda `placeLinkLabels` em transações sucessivas até as rotas pararem de
 * mudar (máx. 3 passes). Necessário porque os routers (AvoidsNodes +
 * AvoidsLinksRouter) reajustam rotas no fim de cada transação — um rótulo
 * validado como livre no passe 1 pode ser deslocado junto com a rota.
 */
export function placeLinkLabelsStable(
  diagram: go.Diagram,
  options: PlacementOptions,
): LinkLabelOverflow[] {
  let overflow: LinkLabelOverflow[] = [];
  let previous = '';
  for (let pass = 0; pass < 3; pass++) {
    diagram.commit((d) => {
      overflow = placeLinkLabels(d, options);
    }, null);
    const snapshot: string[] = [];
    diagram.links.each((link) => {
      if (!options.include(link)) return;
      snapshot.push(
        link.points
          .toArray()
          .map((p) => `${Math.round(p.x)},${Math.round(p.y)}`)
          .join(' '),
      );
    });
    const current = snapshot.join('|');
    if (current === previous) break;
    previous = current;
  }
  return overflow;
}
