import type { SlideId } from "./slide";

/** Item individual da barra de navegação */
export interface NavItem {
  /** Relativo (sem prefixo de rota) — resolve dentro de onde o NavBar for renderizado. */
  to: `?slide=${SlideId}`;
  label: string;
}
