import { getSlidePagination } from '../pagination';

export default function S02Agenda() {
  return (
    <div className="slide" id="s2">
      <div className="slide-bar"></div>
      <div className="slide-number">{getSlidePagination('s2')}</div>
      <div className="slide-body">
        <div className="slide-tag">Sumário</div>
        <div className="slide-title">
          O que será <span>apresentado</span>
        </div>
        <div className="slide-subtitle">
          Roteiro completo da apresentação técnica
        </div>
        <ul className="agenda-list">
          <li className="agenda-item" style={{ borderColor: '#1a3a6a' }}>
            <div className="agenda-num">01</div>
            <div>
              <div className="agenda-text">Escopo de Trabalho (SOW)</div>
              <div className="agenda-sub">
                Objetivos, entregáveis, fases e cronograma
              </div>
            </div>
          </li>
          <li className="agenda-item" style={{ borderColor: '#0f3a22' }}>
            <div className="agenda-num">02</div>
            <div>
              <div className="agenda-text">Topologia Lógica e Física</div>
              <div className="agenda-sub">
                Hierarquia 4 camadas · ligações entre dispositivos · sites SP e
                CWB
              </div>
            </div>
          </li>
          <li className="agenda-item" style={{ borderColor: '#2a2000' }}>
            <div className="agenda-num">03</div>
            <div>
              <div className="agenda-text">
                Endereçamento IPv4 · VLANs · Tabela de Rotas
              </div>
              <div className="agenda-sub">
                Cálculo de sub-redes · plano completo · IPs de cada dispositivo
              </div>
            </div>
          </li>
          <li className="agenda-item" style={{ borderColor: '#1a0a2a' }}>
            <div className="agenda-num">04</div>
            <div>
              <div className="agenda-text">
                VPN Site-to-Site &amp; Acesso Remoto
              </div>
              <div className="agenda-sub">
                IPsec/IKEv2 · SSL-VPN · túneis · autenticação
              </div>
            </div>
          </li>
          <li className="agenda-item" style={{ borderColor: '#3a0000' }}>
            <div className="agenda-num">05</div>
            <div>
              <div className="agenda-text">
                Política de Segurança · Firewalls · ACL
              </div>
              <div className="agenda-sub">
                Regras de acesso assimétrico · IDS/IPS · zonas de segurança
              </div>
            </div>
          </li>
          <li className="agenda-item" style={{ borderColor: '#c97a0f' }}>
            <div className="agenda-num">06</div>
            <div>
              <div className="agenda-text">Equipamentos Recomendados</div>
              <div className="agenda-sub">
                Cisco e Fortinet · roteadores · firewalls · switches · access
                points
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
}
