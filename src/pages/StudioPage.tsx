import { useRef, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import CertificatePanel from '../components/studio/CertificatePanel';
import CustomServicePanel from '../components/studio/CustomServicePanel';
import EquipmentInventoryPanel from '../components/studio/EquipmentInventoryPanel';
import LegendPanel from '../components/studio/LegendPanel';
import type { NetworkDiagramHandle } from '../components/studio/NetworkDiagram';
import NetworkDiagram from '../components/studio/NetworkDiagram';
import RouteFirewallPanel from '../components/studio/RouteFirewallPanel';
import SiteVlanPanel from '../components/studio/SiteVlanPanel';
import StudioToolbar from '../components/studio/StudioToolbar';
import {
  generateStudioPdfReport,
  getStudioPageCopy,
  type StudioPageProps,
} from '../components/studio/catalog';
import { useEquipmentsQuery } from '../features/equipments/queries';
import { findEquipmentCatalogMatch } from '../features/equipments/utils';
import {
  resetNetworkState,
  setProjectName,
} from '../features/network/networkSlice';
import {
  selectEquipmentInventory,
  selectFirewallRules,
  selectRouteTable,
} from '../features/network/selectors';
import { useAutosave } from '../features/network/useAutosave';
import { useRenameProjectMutation } from '../features/projects/queries';

export default function StudioPage({ language }: StudioPageProps) {
  const dispatch = useAppDispatch();
  const { projectId } = useParams<{ projectId: string }>();
  const { ui, meta, sites, nodes, links, siteVlans } = useAppSelector(
    (state) => state.network,
  );
  const routes = useAppSelector(selectRouteTable);
  const firewallRules = useAppSelector(selectFirewallRules);
  const equipmentInventoryRows = useAppSelector(selectEquipmentInventory);
  const equipmentCatalogQuery = useEquipmentsQuery();
  const { forceSave } = useAutosave();
  const renameProjectMutation = useRenameProjectMutation();
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [printShowLinkDescriptions, setPrintShowLinkDescriptions] =
    useState(true);
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(meta.projectName);
  const diagramCaptureRef = useRef<HTMLDivElement | null>(null);
  const networkDiagramRef = useRef<NetworkDiagramHandle | null>(null);
  const copy = getStudioPageCopy(language);

  function startEditingTitle() {
    setTitleDraft(meta.projectName);
    setIsEditingTitle(true);
  }

  function commitTitle() {
    setIsEditingTitle(false);
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === meta.projectName) {
      setTitleDraft(meta.projectName);
      return;
    }
    dispatch(setProjectName(trimmed));
    if (projectId) {
      renameProjectMutation.mutate({ id: projectId, name: trimmed });
    }
    forceSave();
  }

  function handleTitleSubmit(event: FormEvent) {
    event.preventDefault();
    commitTitle();
  }

  function handleReset() {
    setIsResetModalOpen(true);
  }

  function confirmReset() {
    // O autosave (ver app/store.ts) grava esse estado resetado no slot
    // do projeto ativo sozinho — não precisa limpar storage aqui.
    dispatch(resetNetworkState());
    setIsResetModalOpen(false);
  }

  function handleOpenPrintModal() {
    setPrintShowLinkDescriptions(true);
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
      const diagramImageData = networkDiagramRef.current?.exportImageDataForPdf(
        {
          showLinkDescriptions: printShowLinkDescriptions,
        },
      );

      // Sprint equipamentos Fase 13 — cruza o inventário (já expandido por
      // unidade, Fase 12) com o catálogo (marca+modelo) para anexar preço
      // aproximado; sem correspondência no catálogo (ou catálogo sem preço),
      // os campos ficam `null` e a linha aparece como "—" no PDF.
      const equipmentCatalog = equipmentCatalogQuery.data ?? [];
      const equipmentInventory = equipmentInventoryRows.map((row) => {
        const match = findEquipmentCatalogMatch(
          equipmentCatalog,
          row.marca,
          row.modelo,
        );
        return {
          ...row,
          priceUsd: match?.price?.approxPriceUsd ?? null,
          priceBrl: match?.price?.approxPriceBrl ?? null,
          scannedAt: match?.price?.scannedAt ?? null,
        };
      });

      await generateStudioPdfReport({
        language,
        projectName: meta.projectName || 'Studio',
        documentVersion: `v${meta.schemaVersion}`,
        lastSavedAt: meta.lastSavedAt,
        sites,
        nodes,
        links,
        siteVlans,
        routes,
        firewallRules,
        equipmentInventory,
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
      <div className="relative">
        {/* ── Legend drawer overlay ─────────────────────────────────────── */}
        {isLegendOpen && (
          <div
            className="absolute inset-0 z-40 bg-black/30"
            onClick={() => setIsLegendOpen(false)}
          />
        )}
        <div
          className={`absolute left-0 top-0 z-50 h-full w-[390px] shadow-2xl transition-transform duration-200 ${
            isLegendOpen ? 'translate-x-0' : '-translate-x-[110%]'
          }`}
        >
          <LegendPanel language={language} />
        </div>

        <section className="space-y-3">
          <div className="rounded-lg border border-[#315072] bg-[#0b172a]/75 px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                {isEditingTitle ? (
                  <form onSubmit={handleTitleSubmit}>
                    <input
                      autoFocus
                      value={titleDraft}
                      onChange={(event) => setTitleDraft(event.target.value)}
                      onBlur={commitTitle}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          setTitleDraft(meta.projectName);
                          setIsEditingTitle(false);
                        }
                      }}
                      className="w-full max-w-md rounded border border-cyan-600 bg-slate-950 px-2 py-1 text-lg font-semibold text-slate-100 outline-none"
                    />
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={startEditingTitle}
                    aria-label={copy.renameProjectAriaLabel}
                    title={copy.renameProjectAriaLabel}
                    className="group flex min-w-0 max-w-full items-center gap-2 rounded px-1 py-1 -mx-1 text-left hover:bg-white/5"
                  >
                    <h2 className="truncate text-lg font-semibold text-slate-100">
                      {meta.projectName || copy.untitledProject}
                    </h2>
                    <span className="shrink-0 text-sm text-slate-500 opacity-0 transition group-hover:opacity-100">
                      ✎
                    </span>
                  </button>
                )}
                <p className="mt-1 text-xs text-slate-300">{copy.infoHint}</p>
              </div>

              <button
                type="button"
                onClick={forceSave}
                title={
                  meta.lastSavedAt
                    ? new Date(meta.lastSavedAt).toLocaleString(language)
                    : copy.notSavedYet
                }
                className={`flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition ${
                  meta.persistWarning
                    ? 'border-amber-500/60 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                    : meta.saveStatus === 'saving'
                      ? 'border-sky-500/60 bg-sky-500/10 text-sky-300'
                      : 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                }`}
              >
                {meta.persistWarning ? (
                  <span>⚠</span>
                ) : meta.saveStatus === 'saving' ? (
                  <span className="animate-spin">⟳</span>
                ) : (
                  <span>💾</span>
                )}
                {meta.persistWarning
                  ? copy.warning
                  : meta.saveStatus === 'saving'
                    ? copy.saving
                    : meta.lastSavedAt
                      ? `${copy.saved} ${new Date(meta.lastSavedAt).toLocaleTimeString(language)}`
                      : copy.notSavedYet}
              </button>
            </div>
          </div>

          <StudioToolbar
            language={language}
            isLegendOpen={isLegendOpen}
            onToggleLegend={() => setIsLegendOpen((v) => !v)}
          />

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
      </div>

      <RouteFirewallPanel language={language} />

      <SiteVlanPanel language={language} />

      <EquipmentInventoryPanel language={language} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CustomServicePanel />
        <CertificatePanel />
      </div>

      <div className="w-full rounded-lg border border-[#315072] bg-[#0b172a]/75 px-3 py-2 text-xs text-slate-300">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <div>
              {copy.localPersistence}:{' '}
              <span className="font-semibold text-emerald-300">JSON</span>
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

            <label className="mt-3 flex items-start gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={printShowLinkDescriptions}
                onChange={(event) =>
                  setPrintShowLinkDescriptions(event.target.checked)
                }
                disabled={isGeneratingPdf}
                className="mt-0.5 h-4 w-4 rounded border-slate-500 bg-slate-900 text-emerald-400 focus:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <span>{copy.printShowLinkDescriptions}</span>
            </label>

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
