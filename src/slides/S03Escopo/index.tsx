import { getSlidePagination } from "../pagination";

export default function S03Escopo() {
  return (
    <div className="slide" id="s3">
      <div className="slide-bar orange"></div>
      <div className="slide-number">{getSlidePagination("s3")}</div>
      <div className="slide-body">
        <div className="slide-tag">Documento de Escopo</div>
        <div className="slide-title">
          Escopo de <span>Trabalho</span>
        </div>
        <div className="slide-subtitle">
          Statement of Work — SOW · Rede Corporativa Matriz/Filial
        </div>
        <div className="scope-grid">
          <div className="scope-card" style={{ borderColor: "#1a3a6a" }}>
            <div className="sc-icon">🎯</div>
            <div className="sc-title" style={{ color: "var(--blue)" }}>
              Objetivo do Projeto
            </div>
            <ul className="sc-items">
              <li className="sc-item">
                Implantar infraestrutura de rede para Matriz SP e Filial CWB
              </li>
              <li className="sc-item">
                Garantir escalabilidade para +18 computadores + 20% reserva
              </li>
              <li className="sc-item">
                Interligação segura via VPN Site-to-Site IPsec/IKEv2
              </li>
              <li className="sc-item">
                Acesso remoto via SSL-VPN para usuários externos
              </li>
              <li className="sc-item">
                Controle de acesso assimétrico entre Matriz e Filial
              </li>
            </ul>
          </div>

          <div className="scope-card" style={{ borderColor: "#0f3a22" }}>
            <div className="sc-icon">📦</div>
            <div className="sc-title" style={{ color: "var(--green)" }}>
              Entregáveis
            </div>
            <ul className="sc-items">
              <li className="sc-item green">
                Diagrama de topologia lógica e física
              </li>
              <li className="sc-item green">
                Plano de endereçamento IPv4 completo
              </li>
              <li className="sc-item green">
                Configuração de VLANs e tabela de rotas
              </li>
              <li className="sc-item green">
                Política de firewall/ACL documentada
              </li>
              <li className="sc-item green">
                Configuração VPN Site-to-Site e SSL-VPN
              </li>
              <li className="sc-item green">
                Documento SOW e apresentação PowerPoint
              </li>
            </ul>
          </div>

          <div className="scope-card" style={{ borderColor: "#3a1a00" }}>
            <div className="sc-icon">⛔</div>
            <div className="sc-title" style={{ color: "var(--orange)" }}>
              Fora do Escopo
            </div>
            <ul className="sc-items">
              <li className="sc-item orange">
                Cabeamento estruturado físico (obra civil)
              </li>
              <li className="sc-item orange">
                Aquisição de equipamentos (orçamento separado)
              </li>
              <li className="sc-item orange">
                Sistemas de CFTV e controle de acesso físico
              </li>
              <li className="sc-item orange">
                Servidores de aplicação e bancos de dados
              </li>
            </ul>
          </div>

          <div className="scope-card" style={{ borderColor: "#2a2000" }}>
            <div className="sc-icon">✅</div>
            <div className="sc-title" style={{ color: "var(--yellow)" }}>
              Premissas e Requisitos
            </div>
            <ul className="sc-items">
              <li className="sc-item">
                Links de internet dedicados em SP e CWB
              </li>
              <li className="sc-item">
                IPs WAN fixos nos dois roteadores de borda
              </li>
              <li className="sc-item">
                Switches gerenciáveis Layer 3 em ambos os sites
              </li>
              <li className="sc-item">
                Firewalls dedicados (não embutidos no roteador)
              </li>
              <li className="sc-item">Suporte a VLANs 802.1Q nos switches</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
