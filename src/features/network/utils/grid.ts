import {
  QUADRANT_COLUMN_GAP_PX,
  QUADRANT_HEIGHT_PX,
  QUADRANT_ROW_GAP_PX,
  QUADRANT_WIDTH_PX,
} from '../constants';

// Distância do canto superior-esquerdo do layer até o centro do primeiro
// quadrante (linha 0, coluna 0) — mesma margem interna usada nos dois eixos.
const QUADRANT_ORIGIN_OFFSET_PX = 54;
const QUADRANT_COL_STEP_PX = QUADRANT_WIDTH_PX + QUADRANT_COLUMN_GAP_PX;
const QUADRANT_ROW_STEP_PX = QUADRANT_HEIGHT_PX + QUADRANT_ROW_GAP_PX;

/**
 * Célula (row, col) → posição do centro do nó, relativa ao canto
 * superior-esquerdo do seu layer (não é coordenada absoluta do diagrama —
 * quem renderiza soma o x/y absoluto do layer a este resultado).
 */
export function cellToPixel(row: number, col: number) {
  return {
    x: QUADRANT_ORIGIN_OFFSET_PX + col * QUADRANT_COL_STEP_PX,
    y: QUADRANT_ORIGIN_OFFSET_PX + row * QUADRANT_ROW_STEP_PX,
  };
}

/**
 * Posição relativa ao layer (ver `cellToPixel`) → célula (row, col) mais
 * próxima, sempre dentro dos limites [0, columns) x [0, rows) do layer.
 */
export function pixelToCell(
  x: number,
  y: number,
  columns: number,
  rows: number,
) {
  const rawCol = Math.round(
    (x - QUADRANT_ORIGIN_OFFSET_PX) / QUADRANT_COL_STEP_PX,
  );
  const rawRow = Math.round(
    (y - QUADRANT_ORIGIN_OFFSET_PX) / QUADRANT_ROW_STEP_PX,
  );
  return {
    col: Math.min(Math.max(rawCol, 0), Math.max(0, columns - 1)),
    row: Math.min(Math.max(rawRow, 0), Math.max(0, rows - 1)),
  };
}

/** Tamanho (em pixel) do container do layer para caber `columns` x `rows` quadrantes. */
export function computeLayerGridSize(columns: number, rows: number) {
  const cols = Math.max(1, columns);
  const rws = Math.max(1, rows);
  return {
    width: 2 * QUADRANT_ORIGIN_OFFSET_PX + (cols - 1) * QUADRANT_COL_STEP_PX,
    height: 2 * QUADRANT_ORIGIN_OFFSET_PX + (rws - 1) * QUADRANT_ROW_STEP_PX,
  };
}

/** Primeira célula livre em ordem de leitura (linha, depois coluna); `null` se a grade estiver cheia. */
export function findFirstFreeCell(
  occupied: Array<{ row: number; col: number }>,
  columns: number,
  rows: number,
) {
  const taken = new Set(occupied.map(({ row, col }) => `${row}:${col}`));
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      if (!taken.has(`${row}:${col}`)) return { row, col };
    }
  }
  return null;
}

/**
 * Deriva columns/rows de um layer a partir do width/height salvo (formato
 * pré-grade), garantindo espaço para pelo menos `nodeCount` nós.
 */
export function deriveLayerGridFromLegacySize(
  width: number,
  height: number,
  nodeCount: number,
) {
  const columns = Math.max(1, Math.round(width / QUADRANT_COL_STEP_PX));
  const minRowsForNodes = Math.max(1, Math.ceil(nodeCount / columns));
  const rows = Math.max(
    1,
    Math.round(height / QUADRANT_ROW_STEP_PX),
    minRowsForNodes,
  );
  return { columns, rows };
}
