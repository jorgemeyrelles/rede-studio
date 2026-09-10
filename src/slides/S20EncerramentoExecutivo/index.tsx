import { getSlidePagination } from "../pagination";

export default function S20EncerramentoExecutivo() {
  return (
    <div className="slide" id="s20">
      <div className="slide-bar"></div>
      <div className="slide-number">{getSlidePagination("s20")}</div>
      <div
        className="slide-body center-all"
        style={{
          background:
            "radial-gradient(ellipse at 50% 38%,#14305a 0%,#0a0e1a 68%)",
        }}
      >
        <div style={{ fontSize: "42px", marginBottom: "12px" }}>🚀</div>
        <div className="cover-title" style={{ fontSize: "30px" }}>
          Rede Matriz/Filial pronta para <span>execucao</span>
        </div>
        <div className="cover-sub">
          Arquitetura validada, controles definidos e plano operacional estabelecido
        </div>

        <div className="grid grid-cols-3 gap-3 mt-6 w-full max-w-[860px]">
          <div className="rounded-lg border border-[#1a3a6a] bg-[#060f1a] p-3 text-left">
            <div className="text-[10px] font-bold uppercase tracking-[1px] text-[var(--blue)] mb-2">
              Resultado tecnico
            </div>
            <div className="text-[8.5px] text-[var(--text)] leading-6">
              • Topologia padronizada e segmentada
              <br />• Seguranca multicamada com VPN resiliente
              <br />• Capacidade para crescimento controlado
            </div>
          </div>
          <div className="rounded-lg border border-[#0f3a22] bg-[#06140d] p-3 text-left">
            <div className="text-[10px] font-bold uppercase tracking-[1px] text-[var(--green)] mb-2">
              Resultado operacional
            </div>
            <div className="text-[8.5px] text-[var(--text)] leading-6">
              • Runbook, governanca e SLA definidos
              <br />• Indicadores para acompanhamento continuo
              <br />• Handoff formal para sustentacao
            </div>
          </div>
          <div className="rounded-lg border border-[#2a2000] bg-[#120e06] p-3 text-left">
            <div className="text-[10px] font-bold uppercase tracking-[1px] text-[var(--yellow)] mb-2">
              Proximos passos
            </div>
            <div className="text-[8.5px] text-[var(--text)] leading-6">
              • Aprovar budget e janela final
              <br />• Executar onda 1 com monitoracao reforcada
              <br />• Consolidar baseline apos estabilizacao
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: "26px",
            fontSize: "9px",
            color: "var(--dim)",
            letterSpacing: "2px",
          }}
        >
          OBRIGADO · ABERTO PARA PERGUNTAS E AJUSTES FINAIS
        </div>
      </div>
    </div>
  );
}
