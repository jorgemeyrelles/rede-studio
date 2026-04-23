import { useState } from 'react';
import NetworkDiagram from '../components/studio/NetworkDiagram';
import LegendPanel from '../components/studio/LegendPanel';
import RouteFirewallPanel from '../components/studio/RouteFirewallPanel';
import SiteVlanPanel from '../components/studio/SiteVlanPanel';
import StudioToolbar from '../components/studio/StudioToolbar';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { resetNetworkState } from '../features/network/networkSlice';
import { clearNetworkState } from '../features/network/persistence';

export default function StudioPage() {
  const dispatch = useAppDispatch();
  const { ui, meta } = useAppSelector((state) => state.network);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  function handleReset() {
    setIsResetModalOpen(true);
  }

  function confirmReset() {
    clearNetworkState();
    dispatch(resetNetworkState());
    setIsResetModalOpen(false);
  }

  return (
    <main className="mx-auto max-w-[1600px] space-y-3 p-4">
      <section className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-[260px_1fr]">
        <div className="h-0 min-h-full overflow-hidden">
          <LegendPanel />
        </div>

        <section className="space-y-3">
          <div className="rounded-lg border border-[#315072] bg-[#0b172a]/75 px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">
              Proposta DEV - Studio
            </div>
            <h2 className="mt-1 text-lg font-semibold text-slate-100">
              Diagrama lógico interativo
              {/* <span className="ml-2 text-sm font-medium text-cyan-300">
                Matriz | Tunelamento | Filial
              </span> */}
            </h2>
            <p className="mt-1 text-xs text-slate-300">
              Clique no botão de informação de cada componente para abrir o
              tooltip técnico com edição de dados.
            </p>
          </div>

          <StudioToolbar />

          <div className="rounded-lg border border-[#315072] bg-[#091527]/80 p-2 shadow-[0_12px_24px_rgba(0,0,0,0.35)]">
            <div className="mb-2 flex items-center justify-between px-1 text-[11px] uppercase tracking-[0.16em] text-slate-400">
              <span>Dashboard Interativo</span>
              <span>Zoom: {(ui.zoom * 100).toFixed(0)}%</span>
            </div>

            <div className="relative">
              <NetworkDiagram />
            </div>
          </div>
        </section>
      </section>

      <RouteFirewallPanel />

      <SiteVlanPanel />

      <div className="w-full rounded-lg border border-[#315072] bg-[#0b172a]/75 px-3 py-2 text-xs text-slate-300">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <div>
            Persistência local:{' '}
            <span className="font-semibold text-emerald-300">JSON</span>
            </div>
            <div>
              Último salvamento:{' '}
              <span className="font-semibold text-cyan-300">
                {meta.lastSavedAt
                  ? new Date(meta.lastSavedAt).toLocaleString()
                  : 'ainda nao salvo'}
              </span>
            </div>
            {meta.persistWarning && (
              <div className="text-amber-300">Aviso: {meta.persistWarning}</div>
            )}
          </div>
          <button
            onClick={handleReset}
            className="rounded-md border border-rose-400/60 bg-rose-500/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-rose-200 transition hover:bg-rose-500/30"
          >
            Resetar Dados
          </button>
        </div>
      </div>

      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4">
          <div className="w-full max-w-md rounded-xl border border-[#315072] bg-[#0b172a] p-4 shadow-[0_20px_40px_rgba(0,0,0,0.45)]">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-sky-300">
              Confirmar Reset
            </h3>
            <p className="mt-2 text-sm text-slate-200">
              Deseja resetar o Studio e excluir todos os dados persistidos?
            </p>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsResetModalOpen(false)}
                className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-200 transition hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={confirmReset}
                className="rounded-md border border-rose-400/60 bg-rose-500/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-rose-200 transition hover:bg-rose-500/30"
              >
                Confirmar Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
