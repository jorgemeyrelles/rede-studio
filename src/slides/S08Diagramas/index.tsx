import { getSlidePagination } from "../pagination";

export default function S08Diagramas() {
  return (
    <div className="slide slide-wide" id="s8">
      <div className="slide-bar"></div>
      <div className="slide-number">{getSlidePagination("s8")}</div>
      <div className="slide-body">
        <div className="slide-tag">Diagrama Integrado</div>
        <div className="slide-title">
          Relacao entre <span>LAN, VLAN e WAN</span>
        </div>
        <div className="slide-subtitle">
          Matriz com bloco 10.10.0.0/16, filial dimensionada por demanda e WAN
          com MPLS primario + IPsec de contingencia.
        </div>

        <div className="grid grid-cols-3 gap-3 mt-3">
          <div className="rounded-lg border border-[#1a3a6a] bg-[#060f1a] p-3">
            <div className="section-title st-blue">Matriz Sao Paulo</div>
            <div className="text-[8.3px] text-[var(--text)] leading-6">
              <strong>Fluxo LAN:</strong>
              <br />Internet/MPLS {'->'} FortiGate 600F (HA) {'->'} Core Catalyst 9500 {'->'}
              Distribuicao 9300 {'->'} Acesso 9200
              <br />
              <br />
              <strong>VLANs oficiais:</strong>
              <br />10 (10.10.10.0/24) - 20 (10.10.20.0/24)
              <br />30 (10.10.30.0/24) - 40/50/60 (/23)
              <br />70 (Wi-Fi Corp) - 80 (Visitantes)
              <br />99 (Gerencia /27)
              <br />
              <br />
              <strong>WAN:</strong>
              <br />MPLS 203.0.113.1/30 + IPv6 /126
              <br />Internet backup 198.51.100.1/30
            </div>
          </div>

          <div className="rounded-lg border border-[#2a2000] bg-[#120e06] p-3">
            <div className="section-title st-yellow">WAN e VPN</div>
            <div className="text-[8.3px] text-[var(--text)] leading-6">
              <strong>Caminho primario:</strong>
              <br />MPLS dual-stack com metrica 10
              <br />
              <br />
              <strong>Contingencia:</strong>
              <br />VPN IPsec IKEv2 sobre internet
              <br />198.51.100.5 {'<->'} 198.51.100.1
              <br />AES-256-GCM - SHA-384 - DH Group 20
              <br />Metrica 20
              <br />
              <br />
              <strong>Comportamento:</strong>
              <br />Failover estimado entre 15 e 30 segundos.
              <br />Durante backup, servicos IPv6 ficam indisponiveis.
            </div>
          </div>

          <div className="rounded-lg border border-[#0f3a22] bg-[#06140d] p-3">
            <div className="section-title st-green">Filial Curitiba</div>
            <div className="text-[8.3px] text-[var(--text)] leading-6">
              <strong>Dimensionamento:</strong>
              <br />200 atuais {'->'} 300 em 3 anos {'->'} 360 com reserva
              <br />
              <br />
              <strong>Sub-redes por perfil:</strong>
              <br />Desenvolvimento /24 (144 hosts)
              <br />Suporte /25 (108 hosts)
              <br />Administrativo /25 (72 hosts)
              <br />TI/Infra /26 (36 hosts)
              <br />Servidores /28 (6-8)
              <br />
              <br />
              <strong>Requisitos funcionais:</strong>
              <br />Wi-Fi corporativo, visitantes isolado e VLAN de gerencia.
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-[#1a2a40] bg-[#0a121f] p-3 text-[8.2px] text-[var(--text)] leading-6">
          <strong>Leitura do diagrama:</strong> LAN representa o dominio interno
          de cada site; VLAN segmenta seguranca, operacao e performance dentro da
          LAN; WAN conecta matriz e filial. A VPN nao substitui a WAN: ela cria um
          canal seguro de contingencia sobre o enlace de internet.
        </div>
      </div>
    </div>
  );
}
