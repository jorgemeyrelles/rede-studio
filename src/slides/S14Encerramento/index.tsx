import { getSlidePagination } from "../pagination";

export default function S14Encerramento() {
  return (
    <div className="slide" id="s14">
      <div className="slide-bar"></div>
      <div className="slide-number">{getSlidePagination("s14")}</div>
      <div
        className="slide-body center-all"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%,#0d1f3a 0%,#0a0e1a 70%)",
        }}
      >
        <div style={{ fontSize: "44px", marginBottom: "16px" }}>✅</div>
        <div className="cover-title" style={{ fontSize: "28px" }}>
          Projeto Aprovado para <span>Implantação</span>
        </div>
        <div className="cover-sub">
          Infraestrutura escalável · segura · documentada
        </div>
        <div className="closing-grid" style={{ marginTop: "24px" }}>
          <div className="closing-card" style={{ borderColor: "#1a3a6a" }}>
            <div className="cc-title" style={{ color: "var(--blue)" }}>
              🏢 Matriz SP
            </div>
            <div className="cc-item">Sub-rede 10.0.1.0/24 (254 hosts)</div>
            <div className="cc-item">21 PCs · 3 Impressoras · 6 VoIP</div>
            <div className="cc-item">3 Servidores (File/AD/App)</div>
            <div className="cc-item">Firewall dedicado + ACL</div>
          </div>

          <div className="closing-card" style={{ borderColor: "#0f3a22" }}>
            <div className="cc-title" style={{ color: "var(--green)" }}>
              🏭 Filial CWB
            </div>
            <div className="cc-item">Sub-rede 10.0.2.0/25 (126 hosts)</div>
            <div className="cc-item">22 PCs · 4 Impr · 8 VoIP · 4 APs</div>
            <div className="cc-item">2 Servidores + reserva 20%+</div>
            <div className="cc-item">Firewall dedicado + ACL</div>
          </div>

          <div className="closing-card" style={{ borderColor: "#1a4a1a" }}>
            <div className="cc-title" style={{ color: "var(--cyan)" }}>
              🔒 VPN
            </div>
            <div className="cc-item">Site-to-Site IPsec/IKEv2 ATIVA</div>
            <div className="cc-item">SSL-VPN para acesso remoto</div>
            <div className="cc-item">AES-256-GCM + Cert X.509 + MFA</div>
            <div className="cc-item">Pool remoto: 10.10.1.0/28</div>
          </div>

          <div className="closing-card" style={{ borderColor: "#2a1a00" }}>
            <div className="cc-title" style={{ color: "var(--yellow)" }}>
              📋 Documentação
            </div>
            <div className="cc-item">Diagrama lógico e físico</div>
            <div className="cc-item">Plano de endereçamento IPv4</div>
            <div className="cc-item">Tabela de rotas + VLANs</div>
            <div className="cc-item">Regras de firewall/ACL + SOW</div>
          </div>
        </div>
        <div
          style={{
            marginTop: "22px",
            fontSize: "9px",
            color: "var(--dim)",
            letterSpacing: "2px",
          }}
        >
          OBRIGADO · PERGUNTAS E CONSIDERAÇÕES
        </div>
      </div>
    </div>
  );
}
