import { getSlidePagination } from "../pagination";

export default function S01Capa() {
  return (
    <div className="slide" id="s1">
      <div className="slide-bar"></div>
      <div className="slide-number">{getSlidePagination("s1")}</div>
      <div
        className="slide-body center-all"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%,#0d1f3a 0%,#0a0e1a 70%)",
        }}
      >
        <div className="cover-logo">🌐</div>
        <div className="cover-title">
          Projeto de Rede Corporativa
          <br />
          <span>Matriz &amp; Filial</span>
        </div>
        <div className="cover-sub">
          São Paulo · SP &nbsp;·&nbsp; Curitiba · PR &nbsp;·&nbsp; IPv4 RFC-1918
          &nbsp;·&nbsp; VPN IPsec/IKEv2
        </div>
        <div className="cover-badges">
          <span className="cbadge cb-blue">🏢 Matriz SP</span>
          <span className="cbadge cb-green">🏭 Filial CWB</span>
          <span className="cbadge cb-orange">🛡️ Firewalls Dedicados</span>
          <span className="cbadge cb-cyan">🔒 VPN Site-to-Site</span>
          <span className="cbadge cb-yellow">📡 Wi-Fi 802.11ac</span>
        </div>
        <div
          style={{
            marginTop: "28px",
            fontSize: "9px",
            color: "var(--dim)",
            letterSpacing: "2px",
          }}
        >
          ARQUITETURA HIERÁRQUICA 4 CAMADAS &nbsp;·&nbsp; ESCALÁVEL
          &nbsp;·&nbsp; SEGURA &nbsp;·&nbsp; DOCUMENTADA
        </div>
      </div>
    </div>
  );
}
