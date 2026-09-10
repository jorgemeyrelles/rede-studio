import { useState } from "react";
import { Link } from "react-router-dom";
import type { NavItem } from "../types/nav";
import type { NavBarProps } from "./types/navbar.types";

const DEFAULT_ITEMS: NavItem[] = [
  { to: "?slide=s1", label: "01 · Capa" },
  { to: "?slide=s2", label: "02 · Agenda Executiva" },
  { to: "?slide=s3", label: "03 · Escopo e Objetivos" },
  { to: "?slide=s4", label: "04 · Arquitetura Logica" },
  { to: "?slide=s5", label: "05 · Topologia Fisica" },
  { to: "?slide=s6", label: "06 · Enderecamento IPv4" },
  { to: "?slide=s7", label: "07 · Segmentacao VLAN" },
  { to: "?slide=s8", label: "08 · Diagrama Integrado" },
  { to: "?slide=s9", label: "09 · Tabela de Rotas" },
  { to: "?slide=s10", label: "10 · VPN Corporativa" },
  { to: "?slide=s11", label: "11 · Firewall e ACL" },
  { to: "?slide=s12", label: "12 · Hardening e Defesa" },
  { to: "?slide=s13", label: "13 · Plano de Implantacao" },
  { to: "?slide=s14", label: "14 · Testes e Aceite" },
  { to: "?slide=s15", label: "15 · Diagrama GoJS" },
  { to: "?slide=s16", label: "16 · Equipamentos" },
  { to: "?slide=s17", label: "17 · Matriz Tecnica" },
  { to: "?slide=s18", label: "18 · Filial Requisitos" },
  { to: "?slide=s19", label: "19 · Failover e Subnetting" },
  { to: "?slide=s20", label: "20 · Encerramento" },
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
            <Link
              key={item.to}
              className="nav-btn"
              to={item.to}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
