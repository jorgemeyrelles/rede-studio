import { Ellipsis, Eraser, FileText, Pencil } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import Modal from '../components/Modal';
import NetworkTypeIcon from '../components/NetworkTypeIcon';
import SaveStatusButton from '../components/studio/SaveStatusButton';
import Toast from '../components/Toast';
import { ui as studioUi } from '../components/studio/utils/studioUi';
import CertificatePanel from '../components/studio/CertificatePanel';
import CustomServicePanel from '../components/studio/CustomServicePanel';
import EquipmentInventoryPanel from '../components/studio/EquipmentInventoryPanel';
import LegendPanel from '../components/studio/LegendPanel';
import type { NetworkDiagramHandle } from '../components/studio/NetworkDiagram';
import NetworkDiagram from '../components/studio/NetworkDiagram';
import { useRouteFirewallTabs } from '../components/studio/RouteFirewallPanel';
import SiteVlanPanel from '../components/studio/SiteVlanPanel';
import StudioToolbar from '../components/studio/StudioToolbar';
import TableTabs, {
  type TableTabDescriptor,
} from '../components/studio/TableTabs';
import {
  generateStudioPdfReport,
  getStudioPageCopy,
  type StudioPageProps,
} from '../components/studio/catalog';
import {
  getEquipmentInventoryCopy,
  getSiteVlanCopy,
} from '../components/studio/utils/i18n';
import { useSessionQuery } from '../features/auth/queries';
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
import { redo, undo } from '../features/network/history';
import { useAutosave } from '../features/network/useAutosave';
import {
  useProjectsQuery,
  useRenameProjectMutation,
} from '../features/projects/queries';
import { getProjectsPageCopy } from '../i18n/utils';

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
  // Sprint tiers Fase 7 — networkType vive em ProjectSummary, não no slice
  // `network` (é metadado do projeto, não estado de domínio da topologia).
  const { data: currentUser } = useSessionQuery();
  const { data: projects = [] } = useProjectsQuery(currentUser?.id);
  const activeProject = projects.find((project) => project.id === projectId);
  const projectsCopy = getProjectsPageCopy(language);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const [printShowLinkDescriptions, setPrintShowLinkDescriptions] =
    useState(true);
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [showErasedToast, setShowErasedToast] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(meta.projectName);
  const diagramCaptureRef = useRef<HTMLDivElement | null>(null);
  const networkDiagramRef = useRef<NetworkDiagramHandle | null>(null);
  const copy = getStudioPageCopy(language);

  // Barra única de abas do Studio (Fase 4 do redesign Planta) — combina as 6
  // seções de rotas/firewall com os demais painéis que hoje eram cards
  // empilhados à parte.
  const routeFirewallTabs = useRouteFirewallTabs({ language });
  const studioTabs: TableTabDescriptor[] = [
    ...routeFirewallTabs,
    {
      id: 'vlans-site',
      label: getSiteVlanCopy(language).title,
      content: <SiteVlanPanel language={language} />,
    },
    {
      id: 'inventario',
      label: getEquipmentInventoryCopy(language).title,
      content: <EquipmentInventoryPanel language={language} />,
    },
    {
      id: 'servicos-certificados',
      label: copy.servicesAndCertificatesTab,
      content: (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CustomServicePanel language={language} />
          <CertificatePanel language={language} />
        </div>
      ),
    },
  ];

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
    // O autosave (`useAutosave`) grava esse estado resetado no slot do
    // projeto ativo sozinho — não precisa limpar storage aqui. O reset entra
    // no histórico como passo próprio, então o toast pode desfazê-lo.
    dispatch(resetNetworkState());
    setIsResetModalOpen(false);
    setShowErasedToast(true);
  }

  // Ctrl/Cmd+Z desfaz, Ctrl/Cmd+Shift+Z ou Ctrl+Y refaz. Dentro de campos de
  // texto o desfazer nativo do campo continua valendo.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        dispatch(undo());
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault();
        dispatch(redo());
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [dispatch]);

  // Gaveta Estrutura: Esc fecha e devolve o foco ao botão da toolbar.
  useEffect(() => {
    if (!isLegendOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (document.querySelector('[role="dialog"]')) return; // modal aberto
      setIsLegendOpen(false);
      document
        .querySelector<HTMLElement>('[aria-controls="studio-structure-drawer"]')
        ?.focus();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isLegendOpen]);

  // Menu "⋯": fecha com clique fora ou Esc.
  useEffect(() => {
    if (!isMoreMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (!moreMenuRef.current?.contains(event.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMoreMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isMoreMenuOpen]);


  function handleOpenPrintModal() {
    setPrintShowLinkDescriptions(true);
    setPdfError(false);
    setIsPrintModalOpen(true);
  }

  async function confirmPrint() {
    if (isGeneratingPdf) return;

    setPdfError(false);
    const targetWindow = window.open('', '_blank');
    if (!targetWindow) {
      // Popup bloqueado: mantém o modal aberto com a mensagem de erro.
      setPdfError(true);
      return;
    }

    try {
      targetWindow.document.open();
      targetWindow.document.write(
        `<!doctype html><html><head><meta charset="utf-8" /><title>PDF</title><style>body{margin:0;display:grid;place-items:center;height:100vh;background:#0a1220;color:#8fa3c4;font:14px 'Public Sans',system-ui,sans-serif;}</style></head><body><div>${copy.generatingPdf}</div></body></html>`,
      );
      targetWindow.document.close();
    } catch {
      // Ignore initial loading render failures and rely on final fallback navigation.
    }

    setIsGeneratingPdf(true);

    try {
      const diagramExport = networkDiagramRef.current?.exportImageDataForPdf({
        showLinkDescriptions: printShowLinkDescriptions,
      });

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
        diagramImageData: diagramExport?.imageData ?? null,
        connectionNotes: diagramExport?.connectionNotes ?? [],
        dashboardElement: diagramCaptureRef.current,
        targetWindow,
      });
      setIsPrintModalOpen(false);
    } catch (error) {
      // Erro fica visível dentro do próprio modal (que continua aberto),
      // localizado, com o botão de gerar servindo de "tentar novamente".
      console.error('Falha ao gerar relatório PDF', error);
      setPdfError(true);
      targetWindow.close();
    } finally {
      setIsGeneratingPdf(false);
    }
  }

  return (
    <main className="mx-auto max-w-[1600px] space-y-3 p-4">
      <div className="relative">
        {/* ── Gaveta "Estrutura" (sobreposta ao diagrama) ─────────────── */}
        {isLegendOpen && (
          <div
            className="absolute inset-0 z-40 bg-ink/40"
            onClick={() => setIsLegendOpen(false)}
          />
        )}
        <div
          id="studio-structure-drawer"
          inert={!isLegendOpen}
          aria-hidden={!isLegendOpen}
          className={`absolute left-0 top-0 z-50 h-full w-[360px] transition-transform duration-200 ${
            isLegendOpen ? 'translate-x-0' : '-translate-x-[110%]'
          }`}
        >
          <LegendPanel language={language} />
        </div>

        <section className="space-y-3">
          <header className="rounded-md border border-line bg-ink-raised px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                {isEditingTitle ? (
                  <form onSubmit={handleTitleSubmit}>
                    <input
                      autoFocus
                      aria-label={copy.renameProjectAriaLabel}
                      value={titleDraft}
                      onChange={(event) => setTitleDraft(event.target.value)}
                      onBlur={commitTitle}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          setTitleDraft(meta.projectName);
                          setIsEditingTitle(false);
                        }
                      }}
                      className="field max-w-md font-display text-title font-bold"
                    />
                  </form>
                ) : (
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <h1 className="truncate font-display text-title font-bold text-chalk">
                      {meta.projectName || copy.untitledProject}
                    </h1>
                    <button
                      type="button"
                      onClick={startEditingTitle}
                      aria-label={copy.renameProjectAriaLabel}
                      title={copy.renameProjectAriaLabel}
                      className="btn btn-ghost btn-sm btn-icon"
                    >
                      <Pencil size={14} aria-hidden="true" />
                    </button>
                    {activeProject && (
                      <span className="chip">
                        <NetworkTypeIcon
                          type={activeProject.networkType}
                          size={12}
                        />
                        {
                          projectsCopy.networkTypeOptions[
                            activeProject.networkType
                          ]
                        }
                      </span>
                    )}
                  </div>
                )}
                <p className="text-xs text-chalk-dim">{copy.infoHint}</p>
              </div>

              <div className="flex items-center gap-2">
                <SaveStatusButton
                  saveStatus={meta.saveStatus}
                  persistWarning={meta.persistWarning}
                  lastSavedAt={meta.lastSavedAt}
                  language={language}
                  copy={copy}
                  onClick={forceSave}
                />

                <button
                  type="button"
                  onClick={handleOpenPrintModal}
                  className="btn btn-secondary btn-sm"
                >
                  <FileText size={14} aria-hidden="true" />
                  {copy.printPdf}
                </button>

                <div className="relative" ref={moreMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsMoreMenuOpen((open) => !open)}
                    aria-haspopup="menu"
                    aria-expanded={isMoreMenuOpen}
                    aria-label={copy.moreActions}
                    title={copy.moreActions}
                    className="btn btn-ghost btn-sm btn-icon"
                  >
                    <Ellipsis size={16} aria-hidden="true" />
                  </button>
                  {isMoreMenuOpen && (
                    <div
                      role="menu"
                      aria-label={copy.moreActions}
                      className="absolute right-0 top-[calc(100%+6px)] z-30 w-64 overflow-hidden rounded-md border border-line bg-ink-raised py-1 shadow-panel"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        autoFocus
                        onClick={() => {
                          setIsMoreMenuOpen(false);
                          handleReset();
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-signal-down transition-colors hover:bg-signal-down/10 focus-visible:bg-signal-down/10"
                      >
                        <Eraser size={15} aria-hidden="true" />
                        {copy.eraseContent}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {meta.persistWarning && (
              <p role="alert" className="mt-2 text-xs text-signal-warn">
                {copy.warning}: {meta.persistWarning}
              </p>
            )}
          </header>

          <StudioToolbar
            language={language}
            isLegendOpen={isLegendOpen}
            onToggleLegend={() => setIsLegendOpen((v) => !v)}
          />

          <div className="rounded-md border border-line bg-ink-raised p-2">
            <div className="text-label mb-2 flex items-center justify-between px-1 text-chalk-faint">
              <h2>{copy.dashboardTitle}</h2>
              <span className="tabular-nums">
                {studioUi().zoom} {(ui.zoom * 100).toFixed(0)}%
              </span>
            </div>

            <div ref={diagramCaptureRef} className="relative">
              <NetworkDiagram ref={networkDiagramRef} language={language} />
            </div>
          </div>
        </section>
      </div>

      <TableTabs
        tabs={studioTabs}
        groups={[
          {
            id: 'routing',
            label: copy.groupRouting,
            tabIds: ['rotas', 'vlan-subnet', 'protocolo'],
          },
          {
            id: 'security',
            label: copy.groupSecurity,
            tabIds: ['firewall', 'qos', 'servicos-certificados'],
          },
          {
            id: 'addressing',
            label: copy.groupAddressing,
            tabIds: ['vlans-site', 'dhcp', 'inventario'],
          },
        ]}
        defaultTabId="rotas"
        storageKey={
          projectId ? `rede-sp-cwb-studio-tab:${projectId}` : undefined
        }
      />

      {isResetModalOpen && (
        <Modal
          onClose={() => setIsResetModalOpen(false)}
          title={copy.eraseTitle}
          closeLabel={copy.cancel}
          size="md"
        >
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2 text-sm text-chalk-dim">
              <p className="font-semibold text-chalk [overflow-wrap:anywhere]">
                {meta.projectName || copy.untitledProject}
              </p>
              <p>{copy.eraseQuestion}</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <button
                type="button"
                autoFocus
                onClick={() => setIsResetModalOpen(false)}
                className="btn btn-secondary btn-md"
              >
                {copy.cancel}
              </button>
              <button
                type="button"
                onClick={confirmReset}
                className="btn btn-danger btn-md"
              >
                {copy.eraseConfirm}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {isPrintModalOpen && (
        <Modal
          onClose={() => setIsPrintModalOpen(false)}
          title={copy.confirmPrint}
          closeLabel={copy.cancel}
          size="md"
          dismissible={!isGeneratingPdf}
        >
          <div className="flex flex-col gap-5">
            <p className="text-sm text-chalk-dim">{copy.printWarning}</p>

            <label className="flex items-start gap-2.5 text-sm text-chalk">
              <input
                type="checkbox"
                checked={printShowLinkDescriptions}
                onChange={(event) =>
                  setPrintShowLinkDescriptions(event.target.checked)
                }
                disabled={isGeneratingPdf}
                className="mt-0.5 h-4 w-4 accent-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
              />
              <span>{copy.printShowLinkDescriptions}</span>
            </label>

            {pdfError && (
              <p role="alert" className="text-xs text-signal-down">
                {copy.pdfError}
              </p>
            )}

            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(false)}
                disabled={isGeneratingPdf}
                className="btn btn-secondary btn-md"
              >
                {copy.cancel}
              </button>
              <button
                type="button"
                autoFocus
                onClick={confirmPrint}
                disabled={isGeneratingPdf}
                aria-busy={isGeneratingPdf}
                className="btn btn-primary btn-md"
              >
                <FileText size={16} aria-hidden="true" />
                {isGeneratingPdf ? copy.generatingPdf : copy.print}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {showErasedToast && (
        <Toast
          message={copy.contentErased}
          actionLabel={copy.undo}
          onAction={() => dispatch(undo())}
          dismissLabel={copy.dismiss}
          onDismiss={() => setShowErasedToast(false)}
        />
      )}
    </main>
  );
}
