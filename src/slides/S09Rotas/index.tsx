import { getSlidePagination } from "../pagination";
import { CWB_ROUTES, SP_ROUTES } from './constants';
import { RouteTable } from './utils';

export default function S09Rotas() {
  return (
    <div className="slide" id="s9">
      <div className="slide-bar"></div>
      <div className="slide-number">{getSlidePagination("s9")}</div>
      <div className="slide-body">
        <div className="slide-tag">Roteamento</div>
        <div className="slide-title">
          Tabela de <span>Rotas</span>
        </div>
        <div className="slide-subtitle">
          Rotas estáticas e diretas em cada roteador de borda
        </div>
        <div className="route-cols">
          <div className="route-block">
            <div className="route-header rh-blue">
              🏢 Roteador Matriz — São Paulo
            </div>
            <RouteTable rows={SP_ROUTES} />
          </div>
          <div className="route-block">
            <div className="route-header rh-green">
              🏭 Roteador Filial — Curitiba
            </div>
            <RouteTable rows={CWB_ROUTES} />
          </div>
        </div>
        <div className="spacer"></div>
        <div
          style={{
            background: "#060a12",
            border: "1px solid #111c2e",
            borderRadius: "8px",
            padding: "10px 16px",
            fontSize: "8.5px",
            color: "#4a6080",
            lineHeight: "2",
          }}
        >
          <strong style={{ color: "#6a90b8" }}>Legenda de tipos:</strong>
          &nbsp;<span style={{ color: "var(--green)" }}>■ Direta</span> = rede
          conectada diretamente à interface &nbsp;|&nbsp;
          <span style={{ color: "var(--yellow)" }}>■ Estática</span> = rota
          configurada manualmente pelo administrador &nbsp;|&nbsp;
          <span style={{ color: "var(--orange)" }}>■ Default</span> = rota
          padrão para todo tráfego não correspondido (next hop = ISP)
        </div>
      </div>
    </div>
  );
}
