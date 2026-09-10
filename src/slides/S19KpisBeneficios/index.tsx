import { getSlidePagination } from '../pagination';
import {
    DEFAULT_ROUTE_ROWS,
    FAILOVER_METRIC_ROWS,
    FAILOVER_STEPS,
    PREFIX_REFERENCE_ROWS,
} from './constants';

export default function S19KpisBeneficios() {
  return (
    <div className="slide" id="s19">
      <div className="slide-bar orange"></div>
      <div className="slide-number">{getSlidePagination('s19')}</div>
      <div className="slide-body">
        <div className="slide-tag">Roteamento e Subnetting</div>
        <div className="slide-title">
          Failover, metricas e <span>metodologia IP</span>
        </div>
        <div className="slide-subtitle">
          Regras obrigatorias para operacao WAN e planejamento de sub-redes.
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="rounded-lg border border-[#1a3a6a] bg-[#060f1a] p-3">
            <div className="section-title st-blue">Failover por metrica</div>
            <table>
              <thead>
                <tr>
                  <th>Situacao</th>
                  <th>Metrica</th>
                  <th>Comportamento</th>
                </tr>
              </thead>
              <tbody>
                {FAILOVER_METRIC_ROWS.map((row) => (
                  <tr key={row.situation}>
                    <td style={{ fontSize: '8.3px' }}>{row.situation}</td>
                    <td className="tc-mask">{row.metric}</td>
                    <td style={{ fontSize: '8.2px' }}>{row.behavior}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-2 text-[8.3px] text-[var(--text)] leading-6">
              {FAILOVER_STEPS.map((step) => (
                <div key={step}>• {step}</div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-[#0f3a22] bg-[#06140d] p-3">
            <div className="section-title st-green">Metodologia de subnetting</div>
            <div className="text-[8.4px] text-[var(--text)] leading-6">
              <strong>Formula base:</strong>
              <br />Hosts = 2^(32 - prefixo) - 2
              <br />
              <br />1) Quantificar hosts atuais.
              <br />2) Aplicar crescimento (+50%).
              <br />3) Aplicar reserva (+20%).
              <br />4) Escolher proxima potencia de 2.
              <br />5) Definir prefixo final.
            </div>

            <div className="mt-2 rounded-md border border-[#1a4a1a] bg-[#061a0e] p-2 text-[8px] text-[var(--text)] leading-6">
              Exemplo (Desenvolvimento): 80 {'->'} 120 {'->'} 144 {'->'} /24 (254 hosts uteis).
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="rounded-lg border border-[#2a2000] bg-[#120e06] p-3">
            <div className="section-title st-yellow">Referencia de prefixos IPv4</div>
            <table>
              <thead>
                <tr>
                  <th>Prefixo</th>
                  <th>Mascara</th>
                  <th>Hosts</th>
                  <th>Uso tipico</th>
                </tr>
              </thead>
              <tbody>
                {PREFIX_REFERENCE_ROWS.map((row) => (
                  <tr key={row.prefix}>
                    <td className="tc-mask">{row.prefix}</td>
                    <td className="tc-ip">{row.mask}</td>
                    <td className="tc-site">{row.hosts}</td>
                    <td style={{ fontSize: '8.1px' }}>{row.usage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-[#3a0000] bg-[#120707] p-3">
            <div className="section-title" style={{ color: 'var(--red)' }}>
              Rotas padrao obrigatorias
            </div>
            <table>
              <thead>
                <tr>
                  <th>Protocolo</th>
                  <th>Rota</th>
                  <th>Primario</th>
                  <th>Backup</th>
                </tr>
              </thead>
              <tbody>
                {DEFAULT_ROUTE_ROWS.map((row) => (
                  <tr key={row.protocol}>
                    <td className="tc-device">{row.protocol}</td>
                    <td className="tc-ip">{row.route}</td>
                    <td style={{ fontSize: '8.1px' }}>{row.primary}</td>
                    <td style={{ fontSize: '8.1px' }}>{row.backup}</td>
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
