import { getSlidePagination } from '../pagination';
import {
    MATRIX_LAYER_ROWS,
    MATRIX_VLAN_ROWS,
    MATRIX_WAN_ROWS,
} from './constants';

export default function S17Investimento() {
  return (
    <div className="slide" id="s17">
      <div className="slide-bar blue"></div>
      <div className="slide-number">{getSlidePagination('s17')}</div>
      <div className="slide-body">
        <div className="slide-tag">Matriz Sao Paulo</div>
        <div className="slide-title">
          Arquitetura e capacidade <span>da Matriz</span>
        </div>
        <div className="slide-subtitle">
          Estrutura de 3 camadas, WAN redundante e segmentacao corporativa IPv4.
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="rounded-lg border border-[#1a3a6a] bg-[#060f1a] p-3">
            <div className="section-title st-blue">Camadas e componentes</div>
            <table>
              <thead>
                <tr>
                  <th>Camada</th>
                  <th>Equipamento</th>
                  <th>Funcao</th>
                  <th>Escopo</th>
                </tr>
              </thead>
              <tbody>
                {MATRIX_LAYER_ROWS.map((row) => (
                  <tr key={row.layer}>
                    <td className="tc-device">{row.layer}</td>
                    <td style={{ fontSize: '8.3px' }}>{row.equipment}</td>
                    <td style={{ fontSize: '8.2px' }}>{row.role}</td>
                    <td className="tc-ip">{row.scope}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-[#0f3a22] bg-[#06140d] p-3">
            <div className="section-title st-green">WAN da Matriz</div>
            <table>
              <thead>
                <tr>
                  <th>Link</th>
                  <th>Tecnologia</th>
                  <th>Banda</th>
                  <th>SLA</th>
                  <th>IPv4</th>
                  <th>IPv6</th>
                </tr>
              </thead>
              <tbody>
                {MATRIX_WAN_ROWS.map((row) => (
                  <tr key={row.link}>
                    <td className="tc-device">{row.link}</td>
                    <td style={{ fontSize: '8.2px' }}>{row.technology}</td>
                    <td className="tc-mask">{row.speed}</td>
                    <td className="tc-site">{row.sla}</td>
                    <td className="tc-ip">{row.ipv4}</td>
                    <td style={{ fontSize: '8.1px' }}>{row.ipv6}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-2 rounded-md border border-[#1a4a1a] bg-[#061a0e] p-2 text-[8.4px] text-[var(--text)] leading-6">
              • Primario MPLS dual-stack para comunicacao com filiais.
              <br />• Secundario internet com VPN IPsec IKEv2 para contingencia.
              <br />• Convergencia estimada de failover: 15 a 30 segundos.
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-[#2a2000] bg-[#120e06] p-3">
          <div className="section-title st-yellow">Tabela oficial de VLANs - Matriz</div>
          <table>
            <thead>
              <tr>
                <th>VLAN</th>
                <th>Nome</th>
                <th>Sub-rede</th>
                <th>Prefixo</th>
                <th>Hosts</th>
              </tr>
            </thead>
            <tbody>
              {MATRIX_VLAN_ROWS.map((row) => (
                <tr key={row.vlan}>
                  <td className="tc-device">{row.vlan}</td>
                  <td style={{ fontSize: '8.3px' }}>{row.name}</td>
                  <td className="tc-ip">{row.subnet}</td>
                  <td className="tc-mask">{row.prefix}</td>
                  <td className="tc-site">{row.hosts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
