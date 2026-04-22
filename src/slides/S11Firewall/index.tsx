import { getSlidePagination } from "../pagination";
import { ACL_RULES, ACTION_CLASS, ACTION_LABEL } from './constants'

export default function S11Firewall() {
  return (
    <div className="slide" id="s11">
      <div className="slide-bar red"></div>
      <div className="slide-number">{getSlidePagination("s11")}</div>
      <div className="slide-body">
        <div className="slide-tag">Política de Acesso</div>
        <div className="slide-title">
          Firewall &amp; <span>Regras ACL</span>
        </div>
        <div className="slide-subtitle">
          Controle de acesso assimétrico entre Matriz e Filial · stateful
          inspection
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
            marginBottom: "12px",
          }}
        >
          <div
            style={{
              background: "#0a0404",
              border: "1px solid #3a0000",
              borderRadius: "8px",
              padding: "10px 14px",
            }}
          >
            <div
              style={{
                fontSize: "9px",
                fontWeight: "700",
                color: "var(--red)",
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginBottom: "6px",
              }}
            >
              🛡️ Zonas de Segurança — Matriz SP
            </div>
            <div
              style={{
                fontSize: "8.5px",
                color: "var(--text)",
                lineHeight: "1.8",
              }}
            >
              <span style={{ color: "var(--orange)" }}>■ WAN</span> → Internet
              pública (untrusted)
              <br />
              <span style={{ color: "var(--yellow)" }}>■ DMZ</span> → Entre
              roteador e firewall
              <br />
              <span style={{ color: "var(--blue)" }}>■ LAN</span> → Rede interna
              10.0.1.0/24 (trusted)
              <br />
              <span style={{ color: "#aa88ff" }}>■ SVR</span> → VLAN servidores
              10.0.1.200–.202
            </div>
          </div>
          <div
            style={{
              background: "#0a0404",
              border: "1px solid #3a0000",
              borderRadius: "8px",
              padding: "10px 14px",
            }}
          >
            <div
              style={{
                fontSize: "9px",
                fontWeight: "700",
                color: "var(--red)",
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginBottom: "6px",
              }}
            >
              🛡️ Zonas de Segurança — Filial CWB
            </div>
            <div
              style={{
                fontSize: "8.5px",
                color: "var(--text)",
                lineHeight: "1.8",
              }}
            >
              <span style={{ color: "var(--orange)" }}>■ WAN</span> → Internet
              pública (untrusted)
              <br />
              <span style={{ color: "var(--yellow)" }}>■ DMZ</span> → Entre
              roteador e firewall
              <br />
              <span style={{ color: "var(--green)" }}>■ LAN</span> → Rede
              interna 10.0.2.0/25 (trusted)
              <br />
              <span style={{ color: "#aa88ff" }}>■ SVR</span> → VLAN servidores
              10.0.2.200–.201
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Origem</th>
              <th>Destino</th>
              <th>Porta / Serviço</th>
              <th>Ação</th>
              <th>Descrição</th>
            </tr>
          </thead>
          <tbody>
            {ACL_RULES.map((rule) => (
              <tr key={rule.id}>
                <td style={{ color: "var(--dim)" }}>{rule.id}</td>
                <td className="fw-src">{rule.source}</td>
                <td className="fw-dst">{rule.destination}</td>
                <td className="fw-port">{rule.port}</td>
                <td className={ACTION_CLASS[rule.action]}>
                  {ACTION_LABEL[rule.action]}
                </td>
                <td style={{ fontSize: "8px" }}>{rule.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
