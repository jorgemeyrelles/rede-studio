export type TooltipPlacement = 'bottom' | 'right' | 'left' | 'top';

export type DiagramTooltip = {
  nodeId: string;
  x: number;
  y: number;
  preferredPlacement?: TooltipPlacement;
};

export type SiteTooltip = {
  siteId: string;
  x: number;
  y: number;
};

export type GridLayoutResult = {
  sitePositions: Map<string, { x: number; y: number }>;
  layerPositions: Map<string, { x: number; y: number }>;
  siteHeights: Map<string, number>;
  siteWidths: Map<string, number>;
  wanPosition: { x: number; y: number };
};
