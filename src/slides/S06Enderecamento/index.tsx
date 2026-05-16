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
              ▸ Bloco privado corporativo da Matriz: 10.10.0.0/16
              <br />
              ▸ WAN primaria em dual-stack no MPLS (IPv4 + IPv6)
              <br />
              ▸ Contingencia via VPN IPsec em link IPv4-only
              <br />▸ Segmentacao por VLAN reduz broadcast e facilita governanca
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
              Cálculo — Filial (exemplo Desenvolvimento /24)
            </div>
            <div
              style={{
                fontSize: "8.5px",
                fontFamily: "var(--mono)",
                color: "var(--text)",
                lineHeight: "1.8",
              }}
            >
              Usuarios atuais: 200
              <br />
              Projecao em 3 anos: 300 (+50%)
              <br />
              Reserva operacional: +20% (alvo 360)
              <br />Desenvolvimento: 80 → 120 → 144
              <br />→ /24 = <strong style={{ color: "var(--green)" }}>254 hosts</strong> ✅
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
              Capacidade projetada: ~1.000 usuarios
              <br />
              Core L3 Catalyst 9500 + distribuicao 9300
              <br />
              VLANs oficiais: 10,20,30,40,50,60,70,80,99
              <br />Bloco base: <strong style={{ color: "var(--green)" }}>10.10.0.0/16</strong> ✅
              segmentado por perfil
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
