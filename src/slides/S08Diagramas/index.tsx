import { getSlidePagination } from "../pagination";

export default function S08Diagramas() {
  return (
    <div className="slide slide-wide" id="s8">
      <div className="slide-bar"></div>
      <div className="slide-number">{getSlidePagination("s8")}</div>
      <div className="slide-body" style={{ padding: "0" }}>
        <div className="corpo">
          <h1>Diagrama - Relação entre LAN, VLAN e WAN</h1>
          <div className="subtitle">
            LAN = Rede Local · VLAN = Segmentação dentro da LAN · WAN = Conexão
            externa/ISP (Internet) · VPN roda sobre a WAN
          </div>

          <div className="wrap">
            {/* MATRIZ */}
            <div className="site">
              <div className="site-header sh-blue">Matriz - São Paulo</div>
              <div className="site-sub blue">
                LAN (site):{" "}
                <span style={{ color: "var(--yellow)" }}>10.0.1.0/24</span> ·
                Gateway:{" "}
                <span style={{ color: "var(--yellow)" }}>10.0.1.1</span>
              </div>
              <div className="zone blue">
                <div className="label-row">
                  <span className="pill wan">WAN</span>
                  <span className="pill lan">LAN</span>
                  <span className="pill vlan">VLANs (dentro da LAN)</span>
                </div>

                <div className="stack">
                  <div className="device router">
                    <div className="icon">🌐</div>
                    <div className="t">
                      <div className="name">Roteador Borda (SP)</div>
                      <div className="role">
                        <span
                          style={{ color: "var(--orange)", fontWeight: "800" }}
                        >
                          WAN
                        </span>{" "}
                        ISP / Internet ·{" "}
                        <span
                          style={{ color: "var(--cyan)", fontWeight: "800" }}
                        >
                          LAN
                        </span>{" "}
                        Rede interna
                      </div>
                    </div>
                    <div className="ip">
                      LAN: 10.0.1.1
                      <br />
                      <span className="muted">WAN: 200.10.1.1/30</span>
                    </div>
                  </div>
                  <div className="line-v lv-orange"></div>
                  <div className="device fw">
                    <div className="icon">🛡️</div>
                    <div className="t">
                      <div className="name">Firewall (SP)</div>
                      <div className="role">
                        Políticas · ACL · NAT (se aplicável) · VPN Endpoint
                      </div>
                    </div>
                    <div className="ip">
                      Inside: 10.0.1.1
                      <br />
                      <span className="muted">Zonas: WAN/DMZ/LAN</span>
                    </div>
                  </div>
                  <div className="line-v lv-blue"></div>
                  <div className="device sw">
                    <div className="icon">🔀</div>
                    <div className="t">
                      <div className="name">Switch L3 (Distribuição)</div>
                      <div className="role">
                        Trunk 802.1Q · Inter-VLAN · Gerência
                      </div>
                    </div>
                    <div className="ip">Mgmt: 10.0.1.2</div>
                  </div>
                </div>

                <div className="vlan-area">
                  <div className="vlan-title">
                    <div className="left">
                      VLANs (segmentação lógica dentro da LAN 10.0.1.0/24)
                    </div>
                    <div className="right">
                      As VLANs compartilham o mesmo "site LAN", mas isolam o
                      tráfego
                    </div>
                  </div>
                  <div className="vlan-grid">
                    <div className="vcard">
                      <div className="vh">
                        <div className="vid">VLAN 10</div>
                        <div className="vname">Dados</div>
                      </div>
                      <div className="vrange">Hosts: 10.0.1.10-.30</div>
                      <div className="vdesc">
                        PCs e uso geral (navegação, sistemas internos).
                      </div>
                    </div>
                    <div className="vcard">
                      <div className="vh">
                        <div className="vid">VLAN 20</div>
                        <div className="vname">Voz (VoIP)</div>
                      </div>
                      <div className="vrange">Hosts: 10.0.1.50-.55</div>
                      <div className="vdesc">
                        Qualidade e prioridade (QoS), evita disputa com
                        downloads.
                      </div>
                    </div>
                    <div className="vcard">
                      <div className="vh">
                        <div className="vid">VLAN 30</div>
                        <div className="vname">Servidores</div>
                      </div>
                      <div className="vrange">Hosts: 10.0.1.200-.202</div>
                      <div className="vdesc">
                        Serviços corporativos (AD/DNS/Files/App) com ACL
                        restrita.
                      </div>
                    </div>
                    <div className="vcard">
                      <div className="vh">
                        <div className="vid">VLAN 50</div>
                        <div className="vname">Gerência</div>
                      </div>
                      <div className="vrange">Infra: 10.0.1.2 (ex.)</div>
                      <div className="vdesc">
                        Acesso admin (SSH/HTTPS) apenas para TI.
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "10px",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "8px",
                  }}
                >
                  <div className="device end">
                    <div className="icon">💻</div>
                    <div className="t">
                      <div className="name">Endpoints (LAN)</div>
                      <div className="role">
                        PCs, impressoras, VoIP (em VLANs)
                      </div>
                    </div>
                    <div className="ip">
                      <span className="muted">Na LAN</span>
                    </div>
                  </div>
                  <div className="device srv">
                    <div className="icon">🗄️</div>
                    <div className="t">
                      <div className="name">Servidores (LAN)</div>
                      <div className="role">
                        Serviços internos acessados pela Matriz/Filial/VPN
                      </div>
                    </div>
                    <div className="ip">10.0.1.200+</div>
                  </div>
                </div>
              </div>
            </div>

            {/* CENTER */}
            <div className="center">
              <div className="cloud">
                <div className="lbl">WAN / INTERNET</div>
                <div className="sub">
                  <span className="o">WAN</span> é a rede externa (ISP)
                  <br />
                  onde trafega a comunicação entre sites.
                </div>
              </div>
              <div className="fork">
                <div className="h"></div>
                <div className="dot"></div>
                <div className="h r"></div>
              </div>
              <div className="vpn-box">
                <div className="t">VPN (sobre a WAN)</div>
                <div className="d">
                  Site-to-Site IPsec/IKEv2
                  <br />
                  <code>10.10.0.0/30</code> (túnel lógico)
                  <br />
                  Conecta <code>LAN SP</code> &lt;-&gt; <code>LAN CWB</code>
                </div>
              </div>
              <div
                className="line-v lv-red"
                style={{ height: "18px", marginTop: "14px" }}
              ></div>
              <div
                style={{ width: "100%", textAlign: "center", marginTop: "4px" }}
              >
                <span className="pill wan">WAN = fora do site</span>
              </div>
            </div>

            {/* FILIAL */}
            <div className="site">
              <div className="site-header sh-green">Filial - Curitiba</div>
              <div className="site-sub green">
                LAN (site):{" "}
                <span style={{ color: "var(--yellow)" }}>10.0.2.0/25</span> ·
                Gateway:{" "}
                <span style={{ color: "var(--yellow)" }}>10.0.2.1</span> ·
                Broadcast:{" "}
                <span style={{ color: "var(--yellow)" }}>10.0.2.127</span>
              </div>
              <div className="zone green">
                <div className="label-row">
                  <span className="pill wan">WAN</span>
                  <span className="pill lan">LAN</span>
                  <span className="pill vlan">VLANs (dentro da LAN)</span>
                </div>

                <div className="stack">
                  <div className="device router">
                    <div className="icon">🌐</div>
                    <div className="t">
                      <div className="name">Roteador Borda (CWB)</div>
                      <div className="role">
                        <span
                          style={{ color: "var(--orange)", fontWeight: "800" }}
                        >
                          WAN
                        </span>{" "}
                        ISP / Internet ·{" "}
                        <span
                          style={{ color: "var(--cyan)", fontWeight: "800" }}
                        >
                          LAN
                        </span>{" "}
                        Rede interna
                      </div>
                    </div>
                    <div className="ip">
                      LAN: 10.0.2.1
                      <br />
                      <span className="muted">WAN: 200.20.1.1/30</span>
                    </div>
                  </div>
                  <div className="line-v lv-orange"></div>
                  <div className="device fw">
                    <div className="icon">🛡️</div>
                    <div className="t">
                      <div className="name">Firewall (CWB)</div>
                      <div className="role">
                        Políticas · ACL · NAT (se aplicável) · VPN Endpoint
                      </div>
                    </div>
                    <div className="ip">
                      Inside: 10.0.2.1
                      <br />
                      <span className="muted">Zonas: WAN/DMZ/LAN</span>
                    </div>
                  </div>
                  <div className="line-v lv-green"></div>
                  <div
                    className="device sw"
                    style={{ borderColor: "#0f3a22", background: "#061a0e" }}
                  >
                    <div className="icon">🔀</div>
                    <div className="t">
                      <div className="name">Switch L3 (Distribuição)</div>
                      <div className="role">
                        Trunk 802.1Q · Inter-VLAN · Gerência
                      </div>
                    </div>
                    <div className="ip">Mgmt: 10.0.2.2</div>
                  </div>
                </div>

                <div className="vlan-area">
                  <div className="vlan-title">
                    <div className="left">
                      VLANs (segmentação lógica dentro da LAN 10.0.2.0/25)
                    </div>
                    <div className="right">
                      Broadcast fica dentro da VLAN/sub-rede (não atravessa o
                      roteador)
                    </div>
                  </div>
                  <div className="vlan-grid">
                    <div className="vcard">
                      <div className="vh">
                        <div className="vid">VLAN 10</div>
                        <div className="vname">Dados</div>
                      </div>
                      <div className="vrange">PCs: 10.0.2.10-.31</div>
                      <div className="vdesc">
                        PCs cabeados e uso geral da filial.
                      </div>
                    </div>
                    <div className="vcard">
                      <div className="vh">
                        <div className="vid">VLAN 20</div>
                        <div className="vname">Voz (VoIP)</div>
                      </div>
                      <div className="vrange">VoIP: 10.0.2.50-.57</div>
                      <div className="vdesc">
                        Prioridade de voz e isolamento de tráfego.
                      </div>
                    </div>
                    <div className="vcard">
                      <div className="vh">
                        <div className="vid">VLAN 30</div>
                        <div className="vname">Servidores</div>
                      </div>
                      <div className="vrange">Srv: 10.0.2.200-.201</div>
                      <div className="vdesc">
                        Servidores locais acessados pela Matriz via VPN.
                      </div>
                    </div>
                    <div className="vcard">
                      <div className="vh">
                        <div className="vid">VLAN 40</div>
                        <div className="vname">Wi-Fi</div>
                      </div>
                      <div className="vrange">Wi-Fi: 10.0.2.70-.85</div>
                      <div className="vdesc">
                        Clientes Wi-Fi em VLAN separada; APs conectados ao
                        switch via trunk.
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "10px",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "8px",
                  }}
                >
                  <div className="device ap">
                    <div className="icon">📡</div>
                    <div className="t">
                      <div className="name">Access Points (LAN)</div>
                      <div className="role">
                        Conecta Wi-Fi (VLAN 40) e gerência (VLAN 50)
                      </div>
                    </div>
                    <div className="ip">10.0.2.60-.63</div>
                  </div>
                  <div className="device end">
                    <div className="icon">📶</div>
                    <div className="t">
                      <div className="name">Clientes Wi-Fi (LAN)</div>
                      <div className="role">
                        Recebem IP do pool Wi-Fi (DHCP) na VLAN 40
                      </div>
                    </div>
                    <div className="ip">10.0.2.70-.85</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="notes">
            <strong>Como ler este diagrama:</strong>
            <br />
            <span className="k">LAN</span> = rede interna do site (ex.:{" "}
            <code>10.0.1.0/24</code> na Matriz e <code>10.0.2.0/25</code> na
            Filial).
            <br />
            <span className="p">VLAN</span> = sub-rede lógica dentro da LAN
            (separa tráfego por tipo: dados, voz, servidores, Wi-Fi). Em uma
            implementação ideal, cada VLAN teria sua <em>própria</em> sub-rede
            (ex.: /27, /28 etc.).
            <br />
            <span className="o">WAN</span> = rede externa (ISP/Internet) que
            conecta os sites a longas distâncias. É por onde passa o tráfego
            "fora" da empresa.
            <br />
            <strong>VPN</strong> = túnel criptografado que roda <em>sobre</em> a
            WAN para interligar as LANs com segurança. O túnel não substitui
            LAN/WAN; ele cria um "caminho seguro" por cima da internet.
            <br />
            <strong>Broadcast:</strong> na Filial <code>10.0.2.0/25</code> o
            broadcast é <code>10.0.2.127</code> porque é o último IP do bloco
            /25. Broadcast atua apenas dentro do domínio local (VLAN/sub-rede) e
            não atravessa o roteador.
          </div>
        </div>
      </div>
    </div>
  );
}
