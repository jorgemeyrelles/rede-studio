import { getSlidePagination } from "../pagination";

export default function S04TopologiaLogica() {
  return (
    <div className="slide" id="s4" style={{ minHeight: "600px" }}>
      <div className="slide-bar"></div>
      <div className="slide-number">{getSlidePagination("s4")}</div>
      <div className="slide-body row" style={{ paddingTop: "20px" }}>
        {/* MATRIZ SP */}
        <div className="topo-col">
          <div className="topo-site-header tsh-blue">
            🏢 Matriz — São Paulo · Bloco corporativo 10.10.0.0/16
          </div>

          <div className="layer-label ll-core">Camada 1 — Core / WAN</div>
          <div className="topo-layer tl-blue">
            <div
              className="topo-device"
              style={{ borderColor: "#7a3a10", background: "#130b04" }}
            >
              <div className="td-icon">🔴</div>
              <div className="td-info">
                <div className="td-name">Gateway WAN Matriz</div>
                <div className="td-role">MPLS primario · Internet backup</div>
              </div>
              <div>
                <div className="td-ip">MPLS: 203.0.113.1/30</div>
                <div className="td-ip-wan">Backup: 198.51.100.1/30</div>
              </div>
            </div>
            <div
              className="topo-device"
              style={{ borderColor: "#7a1010", background: "#1a0404" }}
            >
              <div className="td-icon">🛡️</div>
              <div className="td-info">
                <div className="td-name">FortiGate 600F (HA)</div>
                <div className="td-role">
                  Stateful · ACL · IDS/IPS · VPN Endpoint
                </div>
              </div>
              <div className="td-ip" style={{ color: "#ff6666" }}>
                ACL ativa
              </div>
            </div>
          </div>

          <div className="layer-label ll-dist">Camada 2 — Distribuição (Core L3)</div>
          <div className="topo-layer tl-blue">
            <div
              className="topo-device"
              style={{ borderColor: "#1a3a6a", background: "#060f1a" }}
            >
              <div className="td-icon">🔵</div>
              <div className="td-info">
                <div className="td-name">Core Catalyst 9500</div>
                <div className="td-role">Inter-VLAN L3 · Gateway das sub-redes</div>
              </div>
              <div className="td-ip">Gerencia: 10.10.99.2</div>
            </div>
          </div>

          <div className="layer-label ll-acc">Camada 3 — Acesso</div>
          <div className="topo-layer tl-blue">
            <div
              className="topo-device"
              style={{ borderColor: "#3a1a6a", background: "#0d0618" }}
            >
              <div className="td-icon">🖧</div>
              <div className="td-info">
                <div className="td-name">Servidores Matriz</div>
                <div className="td-role">
                  Producao + Dev/Homolog · ACLs corporativas
                </div>
              </div>
              <div className="td-ip">VLAN 10: 10.10.10.0/24</div>
            </div>
          </div>

          <div className="layer-label ll-end">Dominios de usuario (nao adiciona nova camada)</div>
          <div className="topo-layer tl-blue">
            <div className="topo-device">
              <div className="td-icon">🖥️</div>
              <div className="td-info">
                <div className="td-name">Desenvolvimento</div>
                <div className="td-role">Usuarios de engenharia</div>
              </div>
              <div className="td-ip">VLAN 40: 10.10.40.0/23</div>
            </div>
            <div className="topo-device">
              <div className="td-icon">🖨️</div>
              <div className="td-info">
                <div className="td-name">Administrativo</div>
                <div className="td-role">Backoffice e operacao interna</div>
              </div>
              <div className="td-ip">VLAN 50: 10.10.50.0/23</div>
            </div>
            <div className="topo-device">
              <div className="td-icon">📞</div>
              <div className="td-info">
                <div className="td-name">Comercial / Suporte</div>
                <div className="td-role">Atendimento e vendas</div>
              </div>
              <div className="td-ip">VLAN 60: 10.10.60.0/23</div>
            </div>
            <div
              className="topo-device"
              style={{ borderColor: "#2a1a40", background: "#0d0818" }}
            >
              <div className="td-icon">🔐</div>
              <div className="td-info">
                <div className="td-name">Wi-Fi e Gerencia</div>
                <div className="td-role">Corporativo, Visitantes e Rede de TI</div>
              </div>
              <div className="td-ip">VLAN 70/80/99</div>
            </div>
          </div>
        </div>

        {/* CENTER VPN */}
        <div className="vpn-center">
          <div className="vpn-inet">☁️</div>
          <div className="vpn-lbl">INTERNET</div>
          <div
            style={{
              height: "12px",
              width: "2px",
              background: "linear-gradient(to bottom,#22d3ee,#1a3060)",
              margin: "0 auto",
            }}
          ></div>
          <div className="vpn-badge-sm">
            🔒 Contingencia
            <br />
            IPsec/IKEv2
            <br />
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: "7px",
                color: "#338833",
              }}
            >
              198.51.100.5 ↔ 198.51.100.1
            </span>
          </div>
          <div
            style={{
              height: "12px",
              width: "2px",
              borderLeft: "2px dashed #1a6a1a",
              margin: "0 auto",
            }}
          ></div>
          <div className="vpn-badge-ssl">
            🔐 SSL-VPN
            <br />
            Remoto
            <br />
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: "7px",
                color: "#7755aa",
              }}
            >
              pool 10.10.1.0/28
            </span>
          </div>
        </div>

        {/* FILIAL CWB */}
        <div className="topo-col">
          <div className="topo-site-header tsh-green">
            🏭 Filial — Curitiba · VLANs dimensionadas por crescimento
          </div>

          <div className="layer-label ll-core">Camada 1 — Core / WAN</div>
          <div className="topo-layer tl-green">
            <div
              className="topo-device"
              style={{ borderColor: "#7a3a10", background: "#130b04" }}
            >
              <div className="td-icon">🔴</div>
              <div className="td-info">
                <div className="td-name">Gateway WAN Filial</div>
                <div className="td-role">MPLS primario · Internet backup</div>
              </div>
              <div>
                <div className="td-ip">MPLS: 203.0.113.5/30</div>
                <div className="td-ip-wan">Backup: 198.51.100.5/30</div>
              </div>
            </div>
            <div
              className="topo-device"
              style={{ borderColor: "#7a1010", background: "#1a0404" }}
            >
              <div className="td-icon">🛡️</div>
              <div className="td-info">
                <div className="td-name">Firewall Filial</div>
                <div className="td-role">
                  Stateful · ACL · IDS/IPS · VPN Endpoint
                </div>
              </div>
              <div className="td-ip" style={{ color: "#ff6666" }}>
                ACL ativa
              </div>
            </div>
          </div>

          <div className="layer-label ll-dist">Camada 2 — Distribuição (SVIs/VLANs)</div>
          <div className="topo-layer tl-green">
            <div
              className="topo-device"
              style={{ borderColor: "#0f3a22", background: "#061a0e" }}
            >
              <div className="td-icon">🟢</div>
              <div className="td-info">
                <div className="td-name">Switch de Distribuicao Filial</div>
                <div className="td-role">Segmentacao /24, /25, /26 e /28</div>
              </div>
              <div className="td-ip">SVIs por VLAN</div>
            </div>
          </div>

          <div className="layer-label ll-acc">Camada 3 — Acesso</div>
          <div className="topo-layer tl-green">
            <div
              className="topo-device"
              style={{ borderColor: "#3a1a6a", background: "#0d0618" }}
            >
              <div className="td-icon">🖧</div>
              <div className="td-info">
                <div className="td-name">Servidores CWB</div>
                <div className="td-role">
                  AD Replica · File · Print · Backup
                </div>
              </div>
              <div className="td-ip">VLAN Servidores: /28</div>
            </div>
            <div className="topo-device" style={{ borderColor: "#1a0a2a" }}>
              <div className="td-icon">📡</div>
              <div className="td-info">
                <div className="td-name">Wi-Fi Corporativo e Visitantes</div>
                <div className="td-role">SSID segregados e isolamento logico</div>
              </div>
              <div className="td-ip">VLAN dedicada + VLAN isolada</div>
            </div>
          </div>

          <div className="layer-label ll-end">Dominios de usuario (nao adiciona nova camada)</div>
          <div className="topo-layer tl-green">
            <div className="topo-device">
              <div className="td-icon">🖥️</div>
              <div className="td-info">
                <div className="td-name">Desenvolvimento</div>
                <div className="td-role">Crescimento + reserva operacional</div>
              </div>
              <div className="td-ip">/24 (144 hosts)</div>
            </div>
            <div className="topo-device">
              <div className="td-icon">💻</div>
              <div className="td-info">
                <div className="td-name">Suporte</div>
                <div className="td-role">Operacao de atendimento</div>
              </div>
              <div className="td-ip">/25 (108 hosts)</div>
            </div>
            <div className="topo-device">
              <div className="td-icon">🖨️</div>
              <div className="td-info">
                <div className="td-name">Administrativo</div>
                <div className="td-role">Backoffice da filial</div>
              </div>
              <div className="td-ip">/25 (72 hosts)</div>
            </div>
            <div className="topo-device">
              <div className="td-icon">📞</div>
              <div className="td-info">
                <div className="td-name">TI / Infra</div>
                <div className="td-role">Equipe tecnica e operacao</div>
              </div>
              <div className="td-ip">/26 (36 hosts)</div>
            </div>
            <div
              className="topo-device"
              style={{ borderColor: "#2a1a40", background: "#0d0818" }}
            >
              <div className="td-icon">🔐</div>
              <div className="td-info">
                <div className="td-name">Roteamento e failover</div>
                <div className="td-role">MPLS metrica 10 · VPN metrica 20</div>
              </div>
              <div className="td-ip">Convergencia: 15 a 30s</div>
            </div>
            <div
              className="topo-device"
              style={{
                borderColor: "#1a1a2a",
                borderStyle: "dashed",
                opacity: 0.65,
              }}
            >
              <div className="td-icon">📦</div>
              <div className="td-info">
                <div className="td-name">Capacidade alvo</div>
                <div className="td-role">360 usuarios totais planejados</div>
              </div>
              <div className="td-ip">3 anos + 20% de reserva</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
