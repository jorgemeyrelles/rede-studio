// Regressão: a caixa da tier contém todas as colunas da grade, inclusive
// para projetos salvos com o espaçamento antigo (width gravado menor).
import reducer, { hydrateNetworkState } from '../src/features/network/networkSlice';
import { cellToPixel } from '../src/features/network/utils/grid';
import { QUADRANT_WIDTH_PX, QUADRANT_HEIGHT_PX } from '../src/features/network/constants';

const base = reducer(undefined, { type: '@@init' }) as any;
// Largura/altura no formato antigo (col gap 16, row gap 24): 108 + (c-1)*106.
const staleLayers = [2, 3, 4, 6].map((cols, i) => ({
  ...(base.layers[0] ?? {}),
  id: `S1.C${i + 1}`,
  siteId: 'S1',
  tier: 'access',
  columns: cols,
  rows: 2,
  width: 108 + (cols - 1) * 106,
  height: 108 + 1 * 101,
  row: i,
  slot: 0,
}));
const snapshot = { ...base, sites: base.sites.length ? base.sites : [{ id: 'S1', name: 'S1' }], layers: staleLayers };
const state = reducer(base, hydrateNetworkState(snapshot)) as any;
let failures = 0;
for (const layer of state.layers) {
  const last = cellToPixel(layer.rows - 1, layer.columns - 1);
  const right = last.x + QUADRANT_WIDTH_PX / 2;
  const bottom = last.y + QUADRANT_HEIGHT_PX / 2;
  const ok = right <= layer.width && bottom <= layer.height;
  if (!ok) failures++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${layer.columns}x${layer.rows}: grade até x=${right}, y=${bottom} · caixa ${layer.width}x${layer.height}`);
}
process.exit(failures ? 1 : 0);
