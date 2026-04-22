import { getSlidePagination } from "../pagination";
import { ADDRESSES, LAYER_CLASS, SITE_LABEL } from './constants';

export default function S06Enderecamento() {
  return (
    <div className="slide" id="s6" style={{ minHeight: "620px" }}>
      <div className="slide-bar orange"></div>
      <div className="slide-number">{getSlidePagination("s6")}</div>
      <div className="slide-body">
        <div className="slide-tag">Plano de Endereçamento</div>
        <div className="slide-title">
          IPv4 — <span>Cálculo e Atribuição</span>
        </div>

        <div style={{ display: "flex", gap: "10px", marginBottom: "14px" }}>
          <div
            style={{
              background: "#060c18",
              border: "1px solid #1a2a40",
              borderRadius: "8px",
              padding: "10px 14px",
              flex: "1",
            }}
          >
            <div
              style={{
                fontSize: "9px",
                fontWeight: "700",
                color: "var(--cyan)",
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginBottom: "6px",
              }}
            >
              Por que IPv4?
            </div>
            <div
              style={{
                fontSize: "8.5px",
                color: "var(--text)",
                lineHeight: "1.7",
              }}
            >
              ▸ Ambiente &lt;500 hosts — IPv4 RFC-1918 suficiente
              <br />
              ▸ Compatibilidade total com todos os equipamentos atuais
              <br />
              ▸ NAT nas bordas protege os endereços internos
              <br />▸ IPv6 recomendado em expansão futura ou acesso público
            </div>
          </div>
          <div
            style={{
              background: "#060c18",
              border: "1px solid #1a2a40",
              borderRadius: "8px",
              padding: "10px 14px",
              flex: "1",
            }}
          >
            <div
              style={{
                fontSize: "9px",
                fontWeight: "700",
                color: "var(--yellow)",
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginBottom: "6px",
              }}
            >
              Cálculo — Filial /25
            </div>
            <div
              style={{
                fontSize: "8.5px",
                fontFamily: "var(--mono)",
                color: "var(--text)",
                lineHeight: "1.8",
              }}
            >
              18 PCs + 4 impressoras + 8 VoIP
              <br />
              + 4 APs + 2 Servidores + infra = ~40
              <br />
              40 × 1,20 (reserva 20%) = 48 hosts mín
              <br />→ /25 ={" "}
              <strong style={{ color: "var(--green)" }}>126 hosts</strong> ✅
              escalável
            </div>
          </div>
          <div
            style={{
              background: "#060c18",
              border: "1px solid #1a2a40",
              borderRadius: "8px",
              padding: "10px 14px",
              flex: "1",
            }}
          >
            <div
              style={{
                fontSize: "9px",
                fontWeight: "700",
                color: "var(--orange)",
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginBottom: "6px",
              }}
            >
              Cálculo — Matriz /24
            </div>
            <div
              style={{
                fontSize: "8.5px",
                fontFamily: "var(--mono)",
                color: "var(--text)",
                lineHeight: "1.8",
              }}
            >
              21 PCs + 3 impressoras + 6 VoIP
              <br />
              + 3 Servidores + infra = ~35 hosts
              <br />
              35 × 1,20 = 42 hosts mínimo
              <br />→ /24 ={" "}
              <strong style={{ color: "var(--green)" }}>254 hosts</strong> ✅
              folga ampla
            </div>
          </div>
        </div>

        <div className="s6-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Site</th>
                <th>Dispositivo</th>
                <th>IP / Range</th>
                <th>Máscara</th>
                <th>Gateway</th>
                <th>Camada</th>
              </tr>
            </thead>
            <tbody>
              {ADDRESSES.map((row, i) => (
                <tr key={i}>
                  <td className="tc-site">{SITE_LABEL[row.site]}</td>
                  <td className="tc-device">{row.device}</td>
                  <td className="tc-ip">{row.ip}</td>
                  <td className="tc-mask">{row.mask}</td>
                  <td className="tc-gw">{row.gateway}</td>
                  <td className={LAYER_CLASS[row.layer]}>{row.layer}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
