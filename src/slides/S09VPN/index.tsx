import { getSlidePagination } from "../pagination";
import type { SslVpnStep, VpnSummaryRow } from "../types/vpn.types";

const sslSteps: SslVpnStep[] = [
  {
    num: 1,
    text: "Usuário remoto abre cliente VPN no PC pessoal ou corporativo",
  },
  {
    num: 2,
    text: "Autenticação com usuário + senha + certificado digital (MFA)",
  },
  { num: 3, text: "Firewall valida e atribui IP do pool 10.10.1.0/28" },
  {
    num: 4,
    text: "Usuário acessa rede interna como se estivesse no escritório",
  },
  { num: 5, text: "ACL determina o que cada usuário remoto pode acessar" },
];

const summaryRows: VpnSummaryRow[] = [
  { item: "Protocolo", siteToSite: "IPsec/IKEv2", sslRemote: "SSL/TLS" },
  { item: "Cifra", siteToSite: "AES-256-GCM", sslRemote: "AES-256-GCM" },
  { item: "Autenticação", siteToSite: "Cert X.509", sslRemote: "Cert + MFA" },
  { item: "Rede túnel", siteToSite: "10.10.0.0/30", sslRemote: "10.10.1.0/28" },
  { item: "Endpoints", siteToSite: "SP ↔ CWB", sslRemote: "Usuário remoto" },
  {
    item: "Status",
    siteToSite: "✅ ATIVA",
    sslRemote: "✅ ATIVA",
    highlight: true,
  },
];

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
          IPsec/IKEv2 · SSL-VPN · Autenticação por certificados digitais
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
              IP WAN: 200.10.1.1
            </div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: "8.5px",
                color: "var(--dim)",
              }}
            >
              Túnel local: 10.10.0.1
            </div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: "8.5px",
                color: "var(--dim)",
              }}
            >
              Rede local: 10.0.1.0/24
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
              DH Group:{" "}
              <strong style={{ color: "var(--purple)" }}>
                Group 14 (2048-bit)
              </strong>
            </div>
          </div>
          <div className="vpn-arrow-col">
            <div style={{ fontSize: "18px" }}>↔️</div>
            <div className="vpn-flow-label">
              Túnel Criptografado
              <br />
              <span style={{ fontFamily: "var(--mono)", fontSize: "7px" }}>
                10.10.0.0/30
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
              IP WAN: 200.20.1.1
            </div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: "8.5px",
                color: "var(--dim)",
              }}
            >
              Túnel local: 10.10.0.2
            </div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: "8.5px",
                color: "var(--dim)",
              }}
            >
              Rede local: 10.0.2.0/25
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
              DH Group:{" "}
              <strong style={{ color: "var(--purple)" }}>
                Group 14 (2048-bit)
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
            {sslSteps.map((step) => (
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
                {summaryRows.map((row) => (
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
