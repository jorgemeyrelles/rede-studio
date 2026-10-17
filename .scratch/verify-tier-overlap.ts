// Regressão: nenhuma caixa de tier pode cruzar outra (render width real).
import { buildGridLayout } from '../src/components/studio/utils/networkDiagram';
import { computeLayerGridSize } from '../src/features/network/utils/grid';

type L = { id: string; siteId: string; order: number; tier: any; row: number; slot: 0 | 1; width: number; height: number; networkId?: string };
const mk = (id: string, siteId: string, tier: string, row: number, slot: 0 | 1, cols: number, rows: number, networkId?: string): L => {
  const s = computeLayerGridSize(cols, rows);
  return { id, siteId, order: row * 2 + slot, tier, row, slot, width: s.width, height: s.height, networkId };
};
const scenarios: Record<string, { sites: number; layers: L[] }> = {};
for (let n = 1; n <= 4; n++) {
  const layers: L[] = [];
  for (let i = 0; i < n; i++) {
    const s = `s${i}`;
    layers.push(mk(`${s}-edge`, s, 'edge', 0, 0, 3, 1));
    layers.push(mk(`${s}-dist`, s, 'distribution', 10, 0, 2 + i, 1));
    layers.push(mk(`${s}-acc`, s, 'access', 10, 1, 4, 2));
    layers.push(mk(`${s}-srv`, s, 'server', 20, 0, 2, 1));
    layers.push(mk(`${s}-end`, s, 'endpoint', 40, 0, 5, 1));
  }
  scenarios[`${n} site(s), dist|access`] = { sites: n, layers };
}
// multi-LAN
{
  const layers: L[] = [];
  for (const net of ['n1', 'n2']) {
    layers.push(mk(`${net}-edge`, 's0', 'edge', 0, 0, 3, 1, net));
    layers.push(mk(`${net}-dist`, 's0', 'distribution', 10, 0, 3, 1, net));
    layers.push(mk(`${net}-acc`, 's0', 'access', 10, 1, 2, 1, net));
  }
  scenarios['1 site, 2 LANs, dist|access'] = { sites: 1, layers };
}
let failures = 0;
for (const [name, sc] of Object.entries(scenarios)) {
  const sites = Array.from({ length: sc.sites }, (_, i) => ({ id: `s${i}`, name: `S${i}` })) as any;
  const r = buildGridLayout({ sites, layers: sc.layers as any, diagramWidth: 1400 });
  const rects = sc.layers.map((l) => {
    const p = r.layerPositions.get(l.id)!;
    return { id: l.id, x: p.x, y: p.y, w: r.layerRenderWidths.get(l.id)!, h: l.height };
  });
  let bad = 0;
  for (let i = 0; i < rects.length; i++)
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) {
        bad++; console.log(`  OVERLAP ${a.id} × ${b.id}`);
      }
    }
  // bordas externas alinhadas: linhas do mesmo site/LAN terminam no mesmo x
  console.log(`${bad ? 'FAIL' : 'ok  '} ${name}`);
  failures += bad;
}
process.exit(failures ? 1 : 0);
