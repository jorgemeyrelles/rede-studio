import { useState } from "react";
import type { NavItem } from "../types/nav";
import type { NavBarProps } from "./types/navbar.types";

const DEFAULT_ITEMS: NavItem[] = [
  { href: "#s1", label: "01 · Capa" },
  { href: "#s2", label: "02 · Agenda" },
  { href: "#s3", label: "03 · Escopo" },
  { href: "#s4", label: "04 · Topologia Lógica" },
  { href: "#s5", label: "05 · Topologia Física" },
  { href: "#s6", label: "06 · Endereçamento IP" },
  { href: "#s7", label: "07 · VLANs" },
  { href: "#s8", label: "08 · Diagramas" },
  { href: "#s9", label: "09 · Tabela de Rotas" },
  { href: "#s10", label: "10 · VPN" },
  { href: "#s11", label: "11 · Firewall/ACL" },
  { href: "#s12", label: "12 · Segurança" },
  { href: "#s13", label: "13 · SOW" },
  { href: "#s14", label: "14 · Encerramento" },
  { href: "#s15", label: "15 · Proposta GoJS" },
];

export default function NavBar({ items = DEFAULT_ITEMS }: NavBarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className={`nav-toggle ${open ? "open" : ""}`}
        aria-label="Abrir índice de slides"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      <nav className={`nav-panel ${open ? "open" : ""}`}>
        <div className="nav-panel-title">Índice dos Slides</div>
        <div className="nav-grid">
          {items.map((item) => (
            <a
              key={item.href}
              className="nav-btn"
              href={item.href}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </a>
          ))}
        </div>
      </nav>
    </>
  );
}
