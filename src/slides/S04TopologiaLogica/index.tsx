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
            🏢 Matriz — São Paulo · 10.0.1.0/24
          </div>

          <div className="layer-label ll-core">Camada 1 — Core / WAN</div>
          <div className="topo-layer tl-blue">
            <div
              className="topo-device"
              style={{ borderColor: "#7a3a10", background: "#130b04" }}
            >
              <div className="td-icon">🔴</div>
              <div className="td-info">
                <div className="td-name">Roteador Matriz SP</div>
                <div className="td-role">Gateway · NAT · BGP/OSPF · WAN</div>
              </div>
              <div>
                <div className="td-ip">LAN: 10.0.1.1</div>
                <div className="td-ip-wan">WAN: 200.10.1.1/30</div>
              </div>
            </div>
            <div
              className="topo-device"
              style={{ borderColor: "#7a1010", background: "#1a0404" }}
            >
              <div className="td-icon">🛡️</div>
              <div className="td-info">
                <div className="td-name">Firewall Matriz SP</div>
                <div className="td-role">
                  Stateful · ACL · IDS/IPS · VPN Endpoint
                </div>
              </div>
              <div className="td-ip" style={{ color: "#ff6666" }}>
                ACL ativa
              </div>
            </div>
          </div>

          <div className="layer-label ll-dist">Camada 2 — Distribuição</div>
          <div className="topo-layer tl-blue">
            <div
              className="topo-device"
              style={{ borderColor: "#1a3a6a", background: "#060f1a" }}
            >
              <div className="td-icon">🔵</div>
              <div className="td-info">
                <div className="td-name">Switch L3 Matriz</div>
                <div className="td-role">VLANs · Trunk · Gerenciamento</div>
              </div>
              <div className="td-ip">10.0.1.2</div>
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
                <div className="td-name">Servidores SP (3)</div>
                <div className="td-role">
                  File · AD/DNS · App · 🔒 ACL filial parcial
                </div>
              </div>
              <div className="td-ip">10.0.1.200–.202</div>
            </div>
          </div>

          <div className="layer-label ll-end">Camada 4 — Endpoints</div>
          <div className="topo-layer tl-blue">
            <div className="topo-device">
              <div className="td-icon">🖥️</div>
              <div className="td-info">
                <div className="td-name">PCs Admin (21)</div>
                <div className="td-role">Estações cabeadas</div>
              </div>
              <div className="td-ip">10.0.1.10–.30</div>
            </div>
            <div className="topo-device">
              <div className="td-icon">🖨️</div>
              <div className="td-info">
                <div className="td-name">Impressoras (3)</div>
                <div className="td-role">TCP/IP · switch direto</div>
              </div>
              <div className="td-ip">10.0.1.40–.42</div>
            </div>
            <div className="topo-device">
              <div className="td-icon">📞</div>
              <div className="td-info">
                <div className="td-name">Telefones VoIP (6)</div>
                <div className="td-role">SIP · VLAN voz</div>
              </div>
              <div className="td-ip">10.0.1.50–.55</div>
            </div>
            <div
              className="topo-device"
              style={{ borderColor: "#2a1a40", background: "#0d0818" }}
            >
              <div className="td-icon">🔐</div>
              <div className="td-info">
                <div className="td-name">PCs VPN Remoto (2)</div>
                <div className="td-role">SSL-VPN · acesso externo</div>
              </div>
              <div className="td-ip">10.0.1.100–.101</div>
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
            🔒 VPN
            <br />
            Site-to-Site
            <br />
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: "7px",
                color: "#338833",
              }}
            >
              IPsec/IKEv2
              <br />
              10.10.0.0/30
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
            🏭 Filial — Curitiba · 10.0.2.0/25
          </div>

          <div className="layer-label ll-core">Camada 1 — Core / WAN</div>
          <div className="topo-layer tl-green">
            <div
              className="topo-device"
              style={{ borderColor: "#7a3a10", background: "#130b04" }}
            >
              <div className="td-icon">🔴</div>
              <div className="td-info">
                <div className="td-name">Roteador Filial CWB</div>
                <div className="td-role">Gateway · NAT · OSPF · WAN</div>
              </div>
              <div>
                <div className="td-ip">LAN: 10.0.2.1</div>
                <div className="td-ip-wan">WAN: 200.20.1.1/30</div>
              </div>
            </div>
            <div
              className="topo-device"
              style={{ borderColor: "#7a1010", background: "#1a0404" }}
            >
              <div className="td-icon">🛡️</div>
              <div className="td-info">
                <div className="td-name">Firewall Filial CWB</div>
                <div className="td-role">
                  Stateful · ACL · IDS/IPS · VPN Endpoint
                </div>
              </div>
              <div className="td-ip" style={{ color: "#ff6666" }}>
                ACL ativa
              </div>
            </div>
          </div>

          <div className="layer-label ll-dist">Camada 2 — Distribuição</div>
          <div className="topo-layer tl-green">
            <div
              className="topo-device"
              style={{ borderColor: "#0f3a22", background: "#061a0e" }}
            >
              <div className="td-icon">🟢</div>
              <div className="td-info">
                <div className="td-name">Switch L3 Filial</div>
                <div className="td-role">VLANs · Trunk · Gerenciamento</div>
              </div>
              <div className="td-ip">10.0.2.2</div>
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
                <div className="td-name">Servidores CWB (2)</div>
                <div className="td-role">
                  File · App · ✅ Matriz: acesso total
                </div>
              </div>
              <div className="td-ip">10.0.2.200–.201</div>
            </div>
            <div className="topo-device" style={{ borderColor: "#1a0a2a" }}>
              <div className="td-icon">📡</div>
              <div className="td-info">
                <div className="td-name">Access Points (4)</div>
                <div className="td-role">802.11ac · PoE · cabeado</div>
              </div>
              <div className="td-ip">10.0.2.60–.63</div>
            </div>
          </div>

          <div className="layer-label ll-end">Camada 4 — Endpoints</div>
          <div className="topo-layer tl-green">
            <div className="topo-device">
              <div className="td-icon">🖥️</div>
              <div className="td-info">
                <div className="td-name">Computadores (22)</div>
                <div className="td-role">Cabeados · 18 mín + crescimento</div>
              </div>
              <div className="td-ip">10.0.2.10–.31</div>
            </div>
            <div className="topo-device">
              <div className="td-icon">💻</div>
              <div className="td-info">
                <div className="td-name">Dispositivos Wi-Fi</div>
                <div className="td-role">📶 AP → Switch → Roteador</div>
              </div>
              <div className="td-ip">10.0.2.70–.85</div>
            </div>
            <div className="topo-device">
              <div className="td-icon">🖨️</div>
              <div className="td-info">
                <div className="td-name">Impressoras (4)</div>
                <div className="td-role">TCP/IP · switch direto</div>
              </div>
              <div className="td-ip">10.0.2.40–.43</div>
            </div>
            <div className="topo-device">
              <div className="td-icon">📞</div>
              <div className="td-info">
                <div className="td-name">Telefones VoIP (8)</div>
                <div className="td-role">SIP · VLAN voz</div>
              </div>
              <div className="td-ip">10.0.2.50–.57</div>
            </div>
            <div
              className="topo-device"
              style={{ borderColor: "#2a1a40", background: "#0d0818" }}
            >
              <div className="td-icon">🔐</div>
              <div className="td-info">
                <div className="td-name">PCs VPN Remoto (2)</div>
                <div className="td-role">SSL-VPN · acesso externo</div>
              </div>
              <div className="td-ip">10.0.2.100–.101</div>
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
                <div className="td-name">Reserva (~30 hosts)</div>
                <div className="td-role">Expansão futura · 20% mínimo</div>
              </div>
              <div className="td-ip">10.0.2.110–.126</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
