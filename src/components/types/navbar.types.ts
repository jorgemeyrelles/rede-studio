import type { NavItem } from "../../types/nav";

/** Props do componente NavBar.
 *  Quando `items` não é passado, usa a lista padrão interna. */
export interface NavBarProps {
  items?: NavItem[];
}
