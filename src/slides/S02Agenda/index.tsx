import { getSlidePagination } from '../pagination';

export default function S02Agenda() {
  return (
    <div className="slide" id="s2">
      <div className="slide-bar"></div>
      <div className="slide-number">{getSlidePagination('s2')}</div>
      <div className="slide-body">
        <div className="slide-tag">Agenda Executiva</div>
        <div className="slide-title">
          Trilha da <span>apresentacao</span>
        </div>
        <div className="slide-subtitle">
          Da arquitetura ao plano operacional de sustentacao
        </div>
        <ul className="agenda-list">
          <li className="agenda-item" style={{ borderColor: '#1a3a6a' }}>
            <div className="agenda-num">01</div>
            <div>
              <div className="agenda-text">Contexto, escopo e metas</div>
              <div className="agenda-sub">
                Premissas, restricoes e objetivos tecnicos de negocio
              </div>
            </div>
          </li>
          <li className="agenda-item" style={{ borderColor: '#0f3a22' }}>
            <div className="agenda-num">02</div>
            <div>
              <div className="agenda-text">Arquitetura e topologias</div>
              <div className="agenda-sub">
                Visao logica, fisica, camadas e interligacoes por site
              </div>
            </div>
          </li>
          <li className="agenda-item" style={{ borderColor: '#2a2000' }}>
            <div className="agenda-num">03</div>
            <div>
              <div className="agenda-text">Enderecamento, VLAN e rotas</div>
              <div className="agenda-sub">
                Sub-redes RFC1918, segmentacao e estrategia de roteamento
              </div>
            </div>
          </li>
          <li className="agenda-item" style={{ borderColor: '#1a0a2a' }}>
            <div className="agenda-num">04</div>
            <div>
              <div className="agenda-text">VPN corporativa</div>
              <div className="agenda-sub">
                Site-to-Site IPsec e acesso remoto SSL com controles de acesso
              </div>
            </div>
          </li>
          <li className="agenda-item" style={{ borderColor: '#3a0000' }}>
            <div className="agenda-num">05</div>
            <div>
              <div className="agenda-text">Seguranca em camadas</div>
              <div className="agenda-sub">
                Firewall dedicado, ACL, hardening, monitoramento e resposta
              </div>
            </div>
          </li>
          <li className="agenda-item" style={{ borderColor: '#c97a0f' }}>
            <div className="agenda-num">06</div>
            <div>
              <div className="agenda-text">Plano de implantacao e aceite</div>
              <div className="agenda-sub">
                Cronograma por ondas, testes, criterios de homologacao e handoff
              </div>
            </div>
          </li>
          <li className="agenda-item" style={{ borderColor: '#1a3a6a' }}>
            <div className="agenda-num">07</div>
            <div>
              <div className="agenda-text">Matriz Sao Paulo detalhada</div>
              <div className="agenda-sub">
                Core, distribuicao, acesso, firewall HA e WAN redundante
              </div>
            </div>
          </li>
          <li className="agenda-item" style={{ borderColor: '#0f3a22' }}>
            <div className="agenda-num">08</div>
            <div>
              <div className="agenda-text">Filial e regras obrigatorias</div>
              <div className="agenda-sub">
                Dimensionamento, failover por metrica e metodologia de subnetting
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
}
