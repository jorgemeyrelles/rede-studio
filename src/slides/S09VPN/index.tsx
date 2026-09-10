import { getSlidePagination } from "../pagination";
import { SSL_STEPS, VPN_SUMMARY_ROWS } from "../S10VPN/constants";

export default function S09VPN() {
  return (
    <div className="slide" id="s9">
      <div className="slide-bar purple"></div>
      <div className="slide-number">{getSlidePagination("s9")}</div>
      <div className="slide-body">
        <div className="slide-tag">Conectividade Segura</div>
        <div className="slide-title">
          VPN — <span>Site-to-Site &amp; Acesso Remoto</span>
        </div>
        <div className="slide-subtitle">
          MPLS primario + VPN IPsec/IKEv2 de contingencia · SSL-VPN para acesso remoto
        </div>

        <div className="vpn-flow" style={{ marginBottom: "16px" }}>
          <div className="vpn-site-box" style={{ borderColor: "#1a3a6a" }}>
            <div
              style={{
                fontSize: "10px",
                fontWeight: "700",
                color: "var(--blue)",
                marginBottom: "8px",
              }}
            >
              🏢 Firewall Matriz SP
            </div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: "8.5px",
                color: "var(--yellow)",
              }}
            >
              MPLS: 203.0.113.1 · Backup: 198.51.100.1
            </div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: "8.5px",
                color: "var(--dim)",
              }}
            >
              Peer VPN backup: 198.51.100.5
            </div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: "8.5px",
                color: "var(--dim)",
              }}
            >
              Rede local: 10.10.0.0/16
            </div>
            <hr style={{ borderColor: "#1a3a6a", margin: "8px 0" }} />
            <div
              style={{
                fontSize: "8px",
                color: "var(--text)",
                lineHeight: "1.7",
              }}
            >
              Protocolo:{" "}
              <strong style={{ color: "var(--cyan)" }}>IPsec IKEv2</strong>
              <br />
              Cifra:{" "}
              <strong style={{ color: "var(--yellow)" }}>AES-256-GCM</strong>
              <br />
              Auth:{" "}
              <strong style={{ color: "var(--green)" }}>
                Certificado X.509
              </strong>
              <br />
              Hash:{" "}
              <strong style={{ color: "var(--orange)" }}>SHA-384</strong>
              <br />
              DH Group:{" "}
              <strong style={{ color: "var(--purple)" }}>
                Group 20
              </strong>
            </div>
          </div>
          <div className="vpn-arrow-col">
            <div style={{ fontSize: "18px" }}>↔️</div>
            <div className="vpn-flow-label">
              IPsec de Contingencia
              <br />
              <span style={{ fontFamily: "var(--mono)", fontSize: "7px" }}>
                198.51.100.0/30
              </span>
            </div>
          </div>
          <div className="vpn-site-box" style={{ borderColor: "#0f3a22" }}>
            <div
              style={{
                fontSize: "10px",
                fontWeight: "700",
                color: "var(--green)",
                marginBottom: "8px",
              }}
            >
              🏭 Firewall Filial CWB
            </div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: "8.5px",
                color: "var(--yellow)",
              }}
            >
              MPLS: 203.0.113.5 · Backup: 198.51.100.5
            </div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: "8.5px",
                color: "var(--dim)",
              }}
            >
              Peer VPN backup: 198.51.100.1
            </div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: "8.5px",
                color: "var(--dim)",
              }}
            >
              Rede local: /24, /25, /26 e /28 (dimensionadas)
            </div>
            <hr style={{ borderColor: "#0f3a22", margin: "8px 0" }} />
            <div
              style={{
                fontSize: "8px",
                color: "var(--text)",
                lineHeight: "1.7",
              }}
            >
              Protocolo:{" "}
              <strong style={{ color: "var(--cyan)" }}>IPsec IKEv2</strong>
              <br />
              Cifra:{" "}
              <strong style={{ color: "var(--yellow)" }}>AES-256-GCM</strong>
              <br />
              Auth:{" "}
              <strong style={{ color: "var(--green)" }}>
                Certificado X.509
              </strong>
              <br />
              Hash:{" "}
              <strong style={{ color: "var(--orange)" }}>SHA-384</strong>
              <br />
              DH Group:{" "}
              <strong style={{ color: "var(--purple)" }}>
                Group 20
              </strong>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "14px",
          }}
        >
          <div>
            <div className="section-title st-purple">
              🔐 SSL-VPN — Acesso Remoto
            </div>
            {SSL_STEPS.map((step) => (
              <div key={step.num} className="vpn-step">
                <div className="vpn-step-num">{step.num}</div>
                <div className="vpn-step-text">{step.text}</div>
              </div>
            ))}
          </div>
          <div>
            <div className="section-title st-cyan">📊 Resumo das VPNs</div>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Site-to-Site</th>
                  <th>SSL Remoto</th>
                </tr>
              </thead>
              <tbody>
                {VPN_SUMMARY_ROWS.map((row) => (
                  <tr key={row.item}>
                    <td className="tc-device">{row.item}</td>
                    <td
                      className="tc-ip"
                      style={
                        row.highlight ? { color: "var(--green)" } : undefined
                      }
                    >
                      {row.siteToSite}
                    </td>
                    <td
                      className="tc-ip"
                      style={
                        row.highlight ? { color: "var(--green)" } : undefined
                      }
                    >
                      {row.sslRemote}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
