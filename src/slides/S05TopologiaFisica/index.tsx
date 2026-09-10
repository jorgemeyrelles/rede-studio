import { getSlidePagination } from "../pagination";

export default function S05TopologiaFisica() {
  return (
    <div className="slide" id="s5" style={{ minHeight: "600px" }}>
      <div className="slide-bar green"></div>
      <div className="slide-number">{getSlidePagination("s5")}</div>
      <div className="slide-body">
        <div className="slide-tag">Topologia Física</div>
        <div className="slide-title">
          Ligações <span>Físicas</span> entre Dispositivos
        </div>
        <div className="slide-subtitle">
          Enlaces fisicos com MPLS primario, internet de backup e VPN IPsec
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 60px 1fr",
            gap: "0",
            marginTop: "10px",
          }}
        >
          {/* FÍSICO SP */}
          <div
            style={{
              background: "#060e18",
              border: "1px solid #1a3a6a",
              borderRadius: "10px",
              padding: "14px 16px",
            }}
          >
            <div className="section-title st-blue">🏢 Física — Matriz SP</div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                fontSize: "9px",
              }}
            >
              <div
                style={{
                  background: "#0d1a2a",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  borderLeft: "3px solid var(--orange)",
                }}
              >
                <strong style={{ color: "var(--orange)" }}>
                  ISP → Roteador
                </strong>
                <br />
                <span style={{ color: "var(--dim)" }}>
                  MPLS 100 Mbps · SLA 99,9% · WAN primario 203.0.113.1/30
                </span>
              </div>
              <div
                style={{
                  background: "#0d1a2a",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  borderLeft: "3px solid var(--cyan)",
                }}
              >
                <strong style={{ color: "var(--cyan)" }}>
                  Internet Backup
                </strong>
                <br />
                <span style={{ color: "var(--dim)" }}>
                  Link dedicado 50 Mbps · IPv4 only · 198.51.100.1/30
                </span>
              </div>
              <div
                style={{
                  background: "#0d1a2a",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  borderLeft: "3px solid var(--red)",
                }}
              >
                <strong style={{ color: "var(--red)" }}>
                  Roteador → Firewall
                </strong>
                <br />
                <span style={{ color: "var(--dim)" }}>
                  Par trançado Cat6 · 1Gbps · link dedicado · zona DMZ/WAN
                </span>
              </div>
              <div
                style={{
                  background: "#0d1a2a",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  borderLeft: "3px solid var(--blue)",
                }}
              >
                <strong style={{ color: "var(--blue)" }}>
                  Firewall → Switch L3
                </strong>
                <br />
                <span style={{ color: "var(--dim)" }}>
                  Par trançado Cat6A · 1Gbps · trunk 802.1Q · uplink principal
                </span>
              </div>
              <div
                style={{
                  background: "#0d1a2a",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  borderLeft: "3px solid #3a1a6a",
                }}
              >
                <strong style={{ color: "#aa88ff" }}>
                  Switch → Servidores (~20)
                </strong>
                <br />
                <span style={{ color: "var(--dim)" }}>
                  Cat6A · 1Gbps por servidor · IPs estáticos · rack corporativo
                </span>
              </div>
              <div
                style={{
                  background: "#0d1a2a",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  borderLeft: "3px solid #1a2a40",
                }}
              >
                <strong style={{ color: "var(--text)" }}>
                  Switch → PCs Admin (21)
                </strong>
                <br />
                <span style={{ color: "var(--dim)" }}>
                  Cat6 · 100/1000Mbps · patch panel · DHCP automático
                </span>
              </div>
              <div
                style={{
                  background: "#0d1a2a",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  borderLeft: "3px solid #2a2000",
                }}
              >
                <strong style={{ color: "var(--yellow)" }}>
                  Switch → Impressoras (3) · VoIP (6)
                </strong>
                <br />
                <span style={{ color: "var(--dim)" }}>
                  Cat6 · 100Mbps · IPs estáticos · VoIP via VLAN de voz
                </span>
              </div>
            </div>
          </div>

          {/* CENTER PHYSICAL */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "0 8px",
            }}
          >
            <div style={{ fontSize: "22px" }}>☁️</div>
            <div
              style={{
                fontSize: "8px",
                color: "var(--cyan)",
                letterSpacing: "1px",
                textAlign: "center",
              }}
            >
              INTERNET
            </div>
            <div
              style={{
                width: "2px",
                height: "30px",
                borderLeft: "3px dashed #1a6a1a",
              }}
            ></div>
            <div
              style={{
                fontSize: "8px",
                color: "#55cc55",
                textAlign: "center",
                background: "#040c04",
                border: "1px solid #1a4a1a",
                borderRadius: "5px",
                padding: "3px 6px",
              }}
            >
              VPN Backup
              <br />
              IPsec/IKEv2
            </div>
            <div
              style={{
                width: "2px",
                height: "30px",
                borderLeft: "3px dashed #1a6a1a",
              }}
            ></div>
            <div
              style={{
                width: "2px",
                height: "20px",
                background: "var(--cyan)",
              }}
            ></div>
          </div>

          {/* FÍSICO CWB */}
          <div
            style={{
              background: "#060e10",
              border: "1px solid #0f3a22",
              borderRadius: "10px",
              padding: "14px 16px",
            }}
          >
            <div className="section-title st-green">🏭 Física — Filial CWB</div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                fontSize: "9px",
              }}
            >
              <div
                style={{
                  background: "#071408",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  borderLeft: "3px solid var(--orange)",
                }}
              >
                <strong style={{ color: "var(--orange)" }}>
                  ISP → Roteador
                </strong>
                <br />
                <span style={{ color: "var(--dim)" }}>
                  MPLS 100 Mbps · SLA 99,9% · WAN primario 203.0.113.5/30
                </span>
              </div>
              <div
                style={{
                  background: "#071408",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  borderLeft: "3px solid var(--cyan)",
                }}
              >
                <strong style={{ color: "var(--cyan)" }}>
                  Internet Backup
                </strong>
                <br />
                <span style={{ color: "var(--dim)" }}>
                  Link dedicado 50 Mbps · IPv4 only · 198.51.100.5/30
                </span>
              </div>
              <div
                style={{
                  background: "#071408",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  borderLeft: "3px solid var(--red)",
                }}
              >
                <strong style={{ color: "var(--red)" }}>
                  Roteador → Firewall
                </strong>
                <br />
                <span style={{ color: "var(--dim)" }}>
                  Par trançado Cat6 · 1Gbps · link dedicado · zona DMZ/WAN
                </span>
              </div>
              <div
                style={{
                  background: "#071408",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  borderLeft: "3px solid var(--green)",
                }}
              >
                <strong style={{ color: "var(--green)" }}>
                  Firewall → Switch L3
                </strong>
                <br />
                <span style={{ color: "var(--dim)" }}>
                  Par trançado Cat6A · 1Gbps · trunk 802.1Q · uplink principal
                </span>
              </div>
              <div
                style={{
                  background: "#071408",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  borderLeft: "3px solid #3a1a6a",
                }}
              >
                <strong style={{ color: "#aa88ff" }}>
                  Switch → Servidores (4 iniciais)
                </strong>
                <br />
                <span style={{ color: "var(--dim)" }}>
                  Cat6A · 1Gbps por servidor · IPs estáticos · rack local · expansao 6-8
                </span>
              </div>
              <div
                style={{
                  background: "#071408",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  borderLeft: "3px solid #1a2a40",
                }}
              >
                <strong style={{ color: "var(--text)" }}>
                  Switch → PCs (22) · Impressoras (4) · VoIP (8)
                </strong>
                <br />
                <span style={{ color: "var(--dim)" }}>
                  Cat6 · 100/1000Mbps · patch panel · DHCP / IPs estáticos
                </span>
              </div>
              <div
                style={{
                  background: "#071408",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  borderLeft: "3px solid #1a0a2a",
                }}
              >
                <strong style={{ color: "var(--purple)" }}>
                  Switch → Access Points (4)
                </strong>
                <br />
                <span style={{ color: "var(--dim)" }}>
                  Cat6 · 1Gbps · PoE 802.3af · APs gerenciados · SSID
                  corporativo
                </span>
              </div>
              <div
                style={{
                  background: "#071408",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  borderLeft: "3px solid #1a3a22",
                }}
              >
                <strong style={{ color: "#44ffaa" }}>
                  APs → Dispositivos Wi-Fi
                </strong>
                <br />
                <span style={{ color: "var(--dim)" }}>
                  📶 802.11ac (Wi-Fi 5) · 5GHz · WPA3-Enterprise · pool DHCP
                  Wi-Fi
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
