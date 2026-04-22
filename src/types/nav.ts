import type { SlideId } from "./slide";

/** Item individual da barra de navegação */
export interface NavItem {
  href: `#${SlideId}`;
  label: string;
}
