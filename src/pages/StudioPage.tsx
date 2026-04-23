import { useRef, useState } from 'react';
import NetworkDiagram from '../components/studio/NetworkDiagram';
import type { NetworkDiagramHandle } from '../components/studio/NetworkDiagram';
import LegendPanel from '../components/studio/LegendPanel';
import RouteFirewallPanel from '../components/studio/RouteFirewallPanel';
import SiteVlanPanel from '../components/studio/SiteVlanPanel';
import StudioToolbar from '../components/studio/StudioToolbar';
import {
  generateStudioPdfReport,
  getStudioPageCopy,
  type StudioLanguage,
} from '../components/studio/catalog';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { resetNetworkState } from '../features/network/networkSlice';
import { clearNetworkState } from '../features/network/persistence';
import {
  selectFirewallRules,
  selectRouteTable,
} from '../features/network/selectors';

type StudioPageProps = {
  language: StudioLanguage;
};

export default function StudioPage({ language }: StudioPageProps) {
  const dispatch = useAppDispatch();
  const { ui, meta, sites, nodes, links, siteVlans } = useAppSelector(
    (state) => state.network,
  );
  const routes = useAppSelector(selectRouteTable);
  const firewallRules = useAppSelector(selectFirewallRules);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const diagramCaptureRef = useRef<HTMLDivElement | null>(null);
  const networkDiagramRef = useRef<NetworkDiagramHandle | null>(null);
  const copy = getStudioPageCopy(language);

  function handleReset() {
    setIsResetModalOpen(true);
  }

  function confirmReset() {
    clearNetworkState();
    dispatch(resetNetworkState());
    setIsResetModalOpen(false);
  }

  function handleOpenPrintModal() {
    setIsPrintModalOpen(true);
  }

  async function confirmPrint() {
    if (isGeneratingPdf) return;

    const targetWindow = window.open('', '_blank');
    if (!targetWindow) {
      setIsPrintModalOpen(false);
      return;
    }

    try {
      targetWindow.document.open();
      targetWindow.document.write(
        '<!doctype html><html><head><meta charset="utf-8" /><title>PDF</title><style>body{margin:0;display:grid;place-items:center;height:100vh;background:#0f172a;color:#e2e8f0;font-family:Arial,sans-serif;} .msg{font-size:14px;letter-spacing:.02em;}</style></head><body><div class="msg">Gerando PDF...</div></body></html>',
      );
      targetWindow.document.close();
    } catch {
      // Ignore initial loading render failures and rely on final fallback navigation.
    }

    setIsGeneratingPdf(true);

    try {
      const diagramImageData =
        networkDiagramRef.current?.exportImageDataForPdf();

      await generateStudioPdfReport({
        language,
        projectName: meta.projectName || 'Studio',
        sites,
        nodes,
        links,
        siteVlans,
        routes,
        firewallRules,
        diagramImageData,
        dashboardElement: diagramCaptureRef.current,
        targetWindow,
      });
      setIsPrintModalOpen(false);
    } catch (error) {
      // Keep simple browser feedback to avoid silent failure when popup/navigation is blocked.
      console.error('Falha ao gerar relatório PDF', error);
      window.alert('Nao foi possivel gerar o PDF. Tente novamente.');
      targetWindow.close();
    } finally {
      setIsGeneratingPdf(false);
    }
  }

  return (
    <main className="mx-auto max-w-[1600px] space-y-3 p-4">
      <section className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-[260px_1fr]">
        <div className="h-0 min-h-full overflow-hidden">
          <LegendPanel language={language} />
        </div>

        <section className="space-y-3">
          <div className="rounded-lg border border-[#315072] bg-[#0b172a]/75 px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">
              {copy.proposalTitle}
            </div>
            <h2 className="mt-1 text-lg font-semibold text-slate-100">
              {copy.diagramTitle}
              {/* <span className="ml-2 text-sm font-medium text-cyan-300">
                Matriz | Tunelamento | Filial
              </span> */}
            </h2>
            <p className="mt-1 text-xs text-slate-300">{copy.infoHint}</p>
          </div>

          <StudioToolbar language={language} />

          <div className="rounded-lg border border-[#315072] bg-[#091527]/80 p-2 shadow-[0_12px_24px_rgba(0,0,0,0.35)]">
            <div className="mb-2 flex items-center justify-between px-1 text-[11px] uppercase tracking-[0.16em] text-slate-400">
              <span>{copy.dashboardTitle}</span>
              <span>Zoom: {(ui.zoom * 100).toFixed(0)}%</span>
            </div>

            <div ref={diagramCaptureRef} className="relative">
              <NetworkDiagram ref={networkDiagramRef} language={language} />
            </div>
          </div>
        </section>
      </section>

      <RouteFirewallPanel language={language} />

      <SiteVlanPanel language={language} />

      <div className="w-full rounded-lg border border-[#315072] bg-[#0b172a]/75 px-3 py-2 text-xs text-slate-300">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <div>
              {copy.localPersistence}:{' '}
              <span className="font-semibold text-emerald-300">JSON</span>
            </div>
            <div>
              {copy.lastSave}:{' '}
              <span className="font-semibold text-cyan-300">
                {meta.lastSavedAt
                  ? new Date(meta.lastSavedAt).toLocaleString(language)
                  : copy.notSavedYet}
              </span>
            </div>
            {meta.persistWarning && (
              <div className="text-amber-300">
                {copy.warning}: {meta.persistWarning}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenPrintModal}
              className="rounded-md border border-emerald-400/60 bg-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-200 transition hover:bg-emerald-500/30"
            >
              {copy.printPdf}
            </button>
            <button
              onClick={handleReset}
              className="rounded-md border border-rose-400/60 bg-rose-500/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-rose-200 transition hover:bg-rose-500/30"
            >
              {copy.resetData}
            </button>
          </div>
        </div>
      </div>

      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4">
          <div className="w-full max-w-md rounded-xl border border-[#315072] bg-[#0b172a] p-4 shadow-[0_20px_40px_rgba(0,0,0,0.45)]">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-sky-300">
              {copy.confirmReset}
            </h3>
            <p className="mt-2 text-sm text-slate-200">{copy.resetQuestion}</p>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsResetModalOpen(false)}
                className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-200 transition hover:bg-slate-700"
              >
                {copy.cancel}
              </button>
              <button
                onClick={confirmReset}
                className="rounded-md border border-rose-400/60 bg-rose-500/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-rose-200 transition hover:bg-rose-500/30"
              >
                {copy.confirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4">
          <div className="w-full max-w-md rounded-xl border border-[#315072] bg-[#0b172a] p-4 shadow-[0_20px_40px_rgba(0,0,0,0.45)]">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-300">
              {copy.confirmPrint}
            </h3>
            <p className="mt-2 text-sm text-slate-200">{copy.printWarning}</p>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsPrintModalOpen(false)}
                disabled={isGeneratingPdf}
                className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-200 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {copy.exit}
              </button>
              <button
                onClick={confirmPrint}
                disabled={isGeneratingPdf}
                className="rounded-md border border-emerald-400/60 bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-200 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGeneratingPdf ? copy.generatingPdf : copy.print}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
