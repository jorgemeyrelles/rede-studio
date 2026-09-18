// Grid de quadrantes — espaçamento/tamanho de célula para posicionamento de
// nós dentro de um layer. Vive em features/network (não em components/studio)
// porque a Layer.width/height derivada destes valores é estado de domínio,
// consumido tanto pelos reducers (networkSlice) quanto pelo renderer GoJS.
export const QUADRANT_ROW_GAP_PX = 24; // 1.5rem a 16px/rem
export const QUADRANT_COLUMN_GAP_PX = 16; // 1rem
export const QUADRANT_WIDTH_PX = 90; // largura do nó em repouso
export const QUADRANT_HEIGHT_PX = 77; // altura do nó em repouso

// Abaixo destes valores, o botão de remover linha/coluna não aparece.
export const MIN_LAYER_ROWS = 2;
export const MIN_LAYER_COLUMNS = 2;
