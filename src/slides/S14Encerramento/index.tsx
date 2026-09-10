import { getSlidePagination } from "../pagination";

export default function S14Encerramento() {
  return (
    <div className="slide" id="s14">
      <div className="slide-bar green"></div>
      <div className="slide-number">{getSlidePagination("s14")}</div>
      <div className="slide-body">
        <div className="slide-tag">Qualidade e Transicao</div>
        <div className="slide-title">
          Testes, aceite e <span>handoff operacional</span>
        </div>
        <div className="slide-subtitle">
          Plano de validacao ponta a ponta com criterios objetivos de aprovacao
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="rounded-lg border border-[#1a3a6a] bg-[#060e18] p-3">
            <div className="section-title st-blue">1) Testes tecnicos</div>
            <ul className="text-[9px] leading-6 text-[#c8d8f0]">
              <li>• End-to-end LAN Matriz e Filial (latencia e perda)</li>
              <li>• Inter-VLAN com verificacao de ACL por perfil</li>
              <li>• Site-to-Site IPsec com fail/reconnect controlado</li>
              <li>• SSL VPN com MFA e perfil de permissao minimo</li>
              <li>• Simulacao de indisponibilidade de enlace WAN</li>
            </ul>
          </div>

          <div className="rounded-lg border border-[#0f3a22] bg-[#06140d] p-3">
            <div className="section-title st-green">2) Criterios de aceite</div>
            <ul className="text-[9px] leading-6 text-[#c8d8f0]">
              <li>• Disponibilidade minima de 99.5% na janela de validacao</li>
              <li>• 100% dos servicos criticos respondendo em ate 200 ms</li>
              <li>• Zero falha critica nas regras de seguranca</li>
              <li>• Documentacao tecnica entregue e revisada</li>
              <li>• Assinatura de aceite por TI e responsavel de negocio</li>
            </ul>
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-[#2a2000] bg-[#120e06] p-3">
          <div className="section-title st-yellow">3) Entrega operacional</div>
          <div className="grid grid-cols-3 gap-3 text-[8.5px] text-[#c8d8f0] leading-6">
            <div>
              <div className="font-bold text-[var(--yellow)] uppercase tracking-[1px] mb-1">Runbook</div>
              <div>• Procedimento de incidentes L1-L3</div>
              <div>• Checklist de mudanca e rollback</div>
              <div>• Matriz de escalonamento</div>
            </div>
            <div>
              <div className="font-bold text-[var(--cyan)] uppercase tracking-[1px] mb-1">Monitoracao</div>
              <div>• Baseline de trafego por VLAN</div>
              <div>• Alertas para CPU, link e VPN</div>
              <div>• Dashboards para NOC e gestores</div>
            </div>
            <div>
              <div className="font-bold text-[var(--green)] uppercase tracking-[1px] mb-1">Treinamento</div>
              <div>• Operacao diaria e troubleshooting</div>
              <div>• Administracao de firewall e VPN</div>
              <div>• Politica de seguranca e conformidade</div>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2">
          <div className="rounded-md border border-[#1a2a40] bg-[#0a121f] p-2 text-center">
            <div className="text-[13px] font-black text-[var(--cyan)]">7 dias</div>
            <div className="text-[8px] uppercase tracking-[1px] text-[var(--dim)]">Janela de estabilizacao</div>
          </div>
          <div className="rounded-md border border-[#1a2a40] bg-[#0a121f] p-2 text-center">
            <div className="text-[13px] font-black text-[var(--green)]">100%</div>
            <div className="text-[8px] uppercase tracking-[1px] text-[var(--dim)]">Casos de teste validos</div>
          </div>
          <div className="rounded-md border border-[#1a2a40] bg-[#0a121f] p-2 text-center">
            <div className="text-[13px] font-black text-[var(--yellow)]">0</div>
            <div className="text-[8px] uppercase tracking-[1px] text-[var(--dim)]">Pendencia critica aberta</div>
          </div>
          <div className="rounded-md border border-[#1a2a40] bg-[#0a121f] p-2 text-center">
            <div className="text-[13px] font-black text-[var(--blue)]">3 niveis</div>
            <div className="text-[8px] uppercase tracking-[1px] text-[var(--dim)]">Suporte e escalacao</div>
          </div>
        </div>
      </div>
    </div>
  );
}
