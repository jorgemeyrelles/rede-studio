import { getSlidePagination } from "../pagination";
import { FIREWALL_DEDICATED_ITEMS, VPN_CRYPTO_ITEMS } from './constants';

export default function S12Seguranca() {
  return (
    <div className="slide" id="s12">
      <div className="slide-bar red"></div>
      <div className="slide-number">{getSlidePagination("s12")}</div>
      <div className="slide-body">
        <div className="slide-tag">Boas Práticas e Hardening</div>
        <div className="slide-title">
          Política de <span>Segurança</span>
        </div>
        <div className="slide-subtitle">
          Camadas de proteção · Hardening · Monitoramento
        </div>
        <div className="security-grid">
          <div className="sec-card" style={{ borderColor: "#3a0000" }}>
            <div className="sec-icon">🛡️</div>
            <div className="sec-title" style={{ color: "var(--red)" }}>
              Firewalls Dedicados
            </div>
            <ul className="sec-list">
              {FIREWALL_DEDICATED_ITEMS.map((item) => (
                <li key={item} className="sec-item">
                  <span className="bullet g">✔</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="sec-card" style={{ borderColor: "#0f3a22" }}>
            <div className="sec-icon">🔒</div>
            <div className="sec-title" style={{ color: "var(--green)" }}>
              VPN &amp; Criptografia
            </div>
            <ul className="sec-list">
              {VPN_CRYPTO_ITEMS.map((item) => (
                <li key={item} className="sec-item">
                  <span className="bullet g">✔</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="sec-card" style={{ borderColor: "#2a1a00" }}>
            <div className="sec-icon">📡</div>
            <div className="sec-title" style={{ color: "var(--yellow)" }}>
              Segurança Wi-Fi
            </div>
            <ul className="sec-list">
              <li className="sec-item">
                <span className="bullet g">✔</span>WPA3-Enterprise com
                autenticação RADIUS
              </li>
              <li className="sec-item">
                <span className="bullet g">✔</span>SSID corporativo oculto (SSID
                broadcast off)
              </li>
              <li className="sec-item">
                <span className="bullet g">✔</span>Isolamento de clientes Wi-Fi
                por VLAN 40
              </li>
              <li className="sec-item">
                <span className="bullet y">⚠</span>Revisar senhas Wi-Fi a cada
                90 dias
              </li>
            </ul>
          </div>

          <div className="sec-card" style={{ borderColor: "#1a0a2a" }}>
            <div className="sec-icon">🔧</div>
            <div className="sec-title" style={{ color: "var(--purple)" }}>
              Hardening de Dispositivos
            </div>
            <ul className="sec-list">
              <li className="sec-item">
                <span className="bullet g">✔</span>Acesso admin via SSH/HTTPS
                somente — HTTP/Telnet desabilitados
              </li>
              <li className="sec-item">
                <span className="bullet g">✔</span>VLAN 99 nativa (não VLAN 1) —
                previne VLAN hopping
              </li>
              <li className="sec-item">
                <span className="bullet g">✔</span>Portas não utilizadas do
                switch em shutdown
              </li>
              <li className="sec-item">
                <span className="bullet g">✔</span>Firmware atualizado em todos
                os equipamentos
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
