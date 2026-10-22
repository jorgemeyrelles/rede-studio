/**
 * Tema do canvas GoJS a partir dos tokens Planta.
 *
 * O GoJS desenha em <canvas> e não enxerga classes CSS, então lemos as
 * custom properties de `:root` (src/styles/global.css) e entregamos cores
 * prontas pros templates. É a mesma fonte da legenda, dos badges e das
 * tabelas — o diagrama não tem paleta própria.
 */

type Rgb = readonly [number, number, number];

export type DiagramTheme = {
  ink: string;
  raised: string;
  raised2: string;
  line: string;
  lineStrong: string;
  chalk: string;
  chalkDim: string;
  chalkFaint: string;
  accent: string;
  accentInk: string;
  signal: { up: string; down: string; warn: string };
  route: {
    direct: string;
    static: string;
    default: string;
    vpn: string;
    bgp: string;
  };
  tier: {
    edge: string;
    distribution: string;
    access: string;
    server: string;
    endpoint: string;
    dmz: string;
    management: string;
    custom: string;
  };
  /** Mesma cor com opacidade (preenchimentos translúcidos de site/camada). */
  alpha: (color: string, opacity: number) => string;
};

/** Valores de `global.css` — usados só se o CSS ainda não carregou (SSR/teste). */
const FALLBACK: Record<string, string> = {
  '--ink': '#0a1220',
  '--ink-raised': '#0f1b2e',
  '--ink-raised-2': '#13223a',
  '--line': '#24354f',
  '--line-strong': '#35507a',
  '--chalk': '#eaf1fb',
  '--chalk-dim': '#8fa3c4',
  '--chalk-faint': '#7a8fb3',
  '--accent': '#e8a33d',
  '--accent-ink': '#231404',
  '--signal-up-rgb': '61 220 132',
  '--signal-down-rgb': '255 84 112',
  '--signal-warn-rgb': '251 191 36',
  '--route-direct-rgb': '61 220 132',
  '--route-static-rgb': '251 191 36',
  '--route-default-rgb': '251 146 60',
  '--route-vpn-rgb': '167 139 250',
  '--route-bgp-rgb': '96 165 250',
  '--tier-edge-rgb': '96 165 250',
  '--tier-distribution-rgb': '251 191 36',
  '--tier-access-rgb': '61 220 132',
  '--tier-server-rgb': '232 121 249',
  '--tier-endpoint-rgb': '143 163 196',
  '--tier-dmz-rgb': '251 146 60',
  '--tier-management-rgb': '167 139 250',
  '--tier-custom-rgb': '122 143 179',
};

function readVar(styles: CSSStyleDeclaration | null, name: string): string {
  const value = styles?.getPropertyValue(name).trim();
  return value || FALLBACK[name];
}

/** Aceita `#rrggbb`, `#rgb` ou canais `r g b` (formato dos tokens `-rgb`). */
function toRgb(value: string): Rgb {
  const v = value.trim();
  if (v.startsWith('#')) {
    const hex =
      v.length === 4
        ? v
            .slice(1)
            .split('')
            .map((c) => c + c)
            .join('')
        : v.slice(1, 7);
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }
  const [r, g, b] = v.split(/[\s,]+/).map(Number);
  return [r, g, b];
}

const rgbString = ([r, g, b]: Rgb) => `rgb(${r}, ${g}, ${b})`;

let cached: DiagramTheme | null = null;

export function getDiagramTheme(): DiagramTheme {
  if (cached) return cached;

  const styles =
    typeof document !== 'undefined'
      ? getComputedStyle(document.documentElement)
      : null;
  const color = (name: string) => rgbString(toRgb(readVar(styles, name)));

  const theme: DiagramTheme = {
    ink: color('--ink'),
    raised: color('--ink-raised'),
    raised2: color('--ink-raised-2'),
    line: color('--line'),
    lineStrong: color('--line-strong'),
    chalk: color('--chalk'),
    chalkDim: color('--chalk-dim'),
    chalkFaint: color('--chalk-faint'),
    accent: color('--accent'),
    accentInk: color('--accent-ink'),
    signal: {
      up: color('--signal-up-rgb'),
      down: color('--signal-down-rgb'),
      warn: color('--signal-warn-rgb'),
    },
    route: {
      direct: color('--route-direct-rgb'),
      static: color('--route-static-rgb'),
      default: color('--route-default-rgb'),
      vpn: color('--route-vpn-rgb'),
      bgp: color('--route-bgp-rgb'),
    },
    tier: {
      edge: color('--tier-edge-rgb'),
      distribution: color('--tier-distribution-rgb'),
      access: color('--tier-access-rgb'),
      server: color('--tier-server-rgb'),
      endpoint: color('--tier-endpoint-rgb'),
      dmz: color('--tier-dmz-rgb'),
      management: color('--tier-management-rgb'),
      custom: color('--tier-custom-rgb'),
    },
    alpha: (value, opacity) => {
      const [r, g, b] = toRgb(value.replace(/^rgb\(|\)$/g, ''));
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    },
  };

  // Só cacheia quando os tokens reais foram lidos — antes do CSS carregar
  // o fallback é usado, mas a próxima chamada tenta de novo.
  if (styles?.getPropertyValue('--ink').trim()) cached = theme;
  return theme;
}

/** Finalidade da rede lógica → cor de identidade (mesma da legenda). */
export function networkPurposeColor(purpose: string): string {
  const { tier } = getDiagramTheme();
  const map: Record<string, string> = {
    principal: tier.edge,
    dmz: tier.dmz,
    gestao: tier.management,
    cliente: tier.access,
    backup: tier.distribution,
    custom: tier.custom,
  };
  return map[purpose] ?? tier.custom;
}

/** Até 4 sites: o primeiro carrega a cor da marca. */
export function sitePalette(): string[] {
  const t = getDiagramTheme();
  return [t.accent, t.tier.edge, t.tier.management, t.tier.access];
}
