import { getSlidePagination } from '../pagination';
import {
    FILIAL_DEPARTMENT_ROWS,
    FILIAL_FUNCTIONAL_REQUIREMENTS,
    FILIAL_USER_GROWTH_ROWS,
    FILIAL_WAN_ROWS,
} from './constants';

export default function S18OperacaoGovernanca() {
  return (
    <div className="slide" id="s18">
      <div className="slide-bar green"></div>
      <div className="slide-number">{getSlidePagination('s18')}</div>
      <div className="slide-body">
        <div className="slide-tag">Filial Curitiba</div>
        <div className="slide-title">
          Requisitos obrigatorios <span>de dimensionamento</span>
        </div>
        <div className="slide-subtitle">
          Crescimento de 3 anos, reserva operacional e integracao com a Matriz.
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="rounded-lg border border-[#1a3a6a] bg-[#060f1a] p-3">
            <div className="section-title st-blue">Usuarios e crescimento</div>
            <table>
              <thead>
                <tr>
                  <th>Cenario</th>
                  <th>Quantidade</th>
                </tr>
              </thead>
              <tbody>
                {FILIAL_USER_GROWTH_ROWS.map((row) => (
                  <tr key={row.scenario}>
                    <td style={{ fontSize: '8.4px' }}>{row.scenario}</td>
                    <td className="tc-mask">{row.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-2 rounded-md border border-[#1a2a40] bg-[#0a121f] p-2 text-[8.3px] text-[var(--text)] leading-6">
              A filial deve suportar crescimento previsto +20% de reserva sem
              redesenho estrutural.
            </div>
          </div>

          <div className="rounded-lg border border-[#0f3a22] bg-[#06140d] p-3">
            <div className="section-title st-green">WAN da Filial</div>
            <table>
              <thead>
                <tr>
                  <th>Link</th>
                  <th>Tecnologia</th>
                  <th>Banda</th>
                  <th>SLA</th>
                  <th>Protocolo</th>
                  <th>Enderecamento</th>
                  <th>Observacoes</th>
                </tr>
              </thead>
              <tbody>
                {FILIAL_WAN_ROWS.map((row) => (
                  <tr key={row.link}>
                    <td className="tc-device">{row.link}</td>
                    <td style={{ fontSize: '8.1px' }}>{row.technology}</td>
                    <td className="tc-mask">{row.bandwidth}</td>
                    <td className="tc-site">{row.sla}</td>
                    <td style={{ fontSize: '8px' }}>{row.protocol}</td>
                    <td className="tc-ip">{row.addressing}</td>
                    <td style={{ fontSize: '8px' }}>{row.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 rounded-md border border-[#1a4a1a] bg-[#061a0e] p-2 text-[8.1px] text-[var(--text)] leading-6">
              Restricao: em contingencia pela VPN (IPv4 only), servicos IPv6
              ficam indisponiveis.
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-[#2a2000] bg-[#120e06] p-3">
          <div className="section-title st-yellow">Departamentos e subnetting</div>
          <table>
            <thead>
              <tr>
                <th>Departamento</th>
                <th>Atual</th>
                <th>+50%</th>
                <th>+20%</th>
                <th>Prefixo recomendado</th>
              </tr>
            </thead>
            <tbody>
              {FILIAL_DEPARTMENT_ROWS.map((row) => (
                <tr key={row.department}>
                  <td style={{ fontSize: '8.2px' }}>{row.department}</td>
                  <td className="tc-site">{row.current}</td>
                  <td className="tc-site">{row.projected}</td>
                  <td className="tc-mask">{row.withReserve}</td>
                  <td className="tc-ip">{row.recommendedPrefix}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="rounded-lg border border-[#3a0000] bg-[#120707] p-3 text-[8.3px] text-[var(--text)] leading-6">
            <div className="section-title" style={{ color: 'var(--red)' }}>
              Requisitos funcionais
            </div>
            {FILIAL_FUNCTIONAL_REQUIREMENTS.map((item) => (
              <div key={item}>• {item}</div>
            ))}
          </div>
          <div className="rounded-lg border border-[#1a0a2a] bg-[#130a1b] p-3 text-[8.3px] text-[var(--text)] leading-6">
            <div className="section-title" style={{ color: 'var(--purple)' }}>
              Servidores da filial
            </div>
            • Inicial: AD Replica, File, Print e Backup (4 servidores).
            <br />• Expansao prevista: 6 a 8 servidores.
            <br />• VLAN dedicada para servidores com capacidade de crescimento.
          </div>
        </div>
      </div>
    </div>
  );
}
