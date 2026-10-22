import { Pencil, Redo2, Undo2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import NetworkTypeIcon from '../components/NetworkTypeIcon';
import Toast from '../components/Toast';
import CloudCanvas from '../components/cloud/CloudCanvas';
import CloudInspector from '../components/cloud/CloudInspector';
import CloudConnectionsTable from '../components/cloud/CloudConnectionsTable';
import CloudCostPanel from '../components/cloud/CloudCostPanel';
import HeaderCost from '../components/cloud/HeaderCost';
import CloudIpamTable from '../components/cloud/CloudIpamTable';
import CloudOperationTable from '../components/cloud/CloudOperationTable';
import CloudResourcesTable from '../components/cloud/CloudResourcesTable';
import CloudNaclTable from '../components/cloud/CloudNaclTable';
import CloudRoutesTable from '../components/cloud/CloudRoutesTable';
import CloudTerraformPanel from '../components/cloud/CloudTerraformPanel';
import CloudValidationPanel from '../components/cloud/CloudValidationPanel';
import CloudSecurityGroupsTable from '../components/cloud/CloudSecurityGroupsTable';
import CloudPalette from '../components/cloud/CloudPalette';
import { getCloudCopy } from '../components/cloud/cloudCopy';
import SaveStatusButton from '../components/studio/SaveStatusButton';
import TableTabs from '../components/studio/TableTabs';
import {
  getStudioPageCopy,
  type StudioPageProps,
} from '../components/studio/catalog';
import { cloudRedo, cloudUndo } from '../features/cloud/cloudHistory';
import { setCloudProjectName } from '../features/cloud/cloudSlice';
import { useCreateCloudResource } from '../components/cloud/useCreateCloudResource';
import { useCloudAutosave } from '../features/cloud/useCloudAutosave';
import { useCloudValidation } from '../features/cloud/useCloudValidation';
import { useRenameProjectMutation } from '../features/projects/queries';
import { getProjectsPageCopy } from '../i18n/utils';

/**
 * Studio Cloud (projetos `CLOUD`): rascunho de arquitetura AWS em camadas.
 * Paleta à esquerda (ordem de crescimento), canvas React Flow no centro
 * (containers aninhados), inspetor à direita. Mesmo cabeçalho do Studio
 * on-prem: nome editável, tipo de rede, medidor de save, desfazer/refazer.
 */
export default function CloudStudioPage({ language }: StudioPageProps) {
  const dispatch = useAppDispatch();
  const { projectId } = useParams<{ projectId: string }>();
  const { meta } = useAppSelector((state) => state.cloud);
  const { canUndo, canRedo } = useAppSelector((state) => state.cloudHistory);
  const { forceSave } = useCloudAutosave();
  const renameProjectMutation = useRenameProjectMutation();
  const createResource = useCreateCloudResource(language);
  const validation = useCloudValidation(language);
  const copy = getCloudCopy(language);
  const studioCopy = getStudioPageCopy(language);
  const projectsCopy = getProjectsPageCopy(language);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(meta.projectName);
  // Mensagem do toast "Desfazer" após excluir (elemento ou conexão).
  const [deletedToast, setDeletedToast] = useState<string | null>(null);

  // Ctrl/Cmd+Z desfaz, Ctrl/Cmd+Shift+Z ou Ctrl+Y refaz — fora de campos de texto.
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
        dispatch(cloudUndo());
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault();
        dispatch(cloudRedo());
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [dispatch]);

  function commitTitle() {
    setIsEditingTitle(false);
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === meta.projectName) {
      setTitleDraft(meta.projectName);
      return;
    }
    dispatch(setCloudProjectName(trimmed));
    if (projectId)
      renameProjectMutation.mutate({ id: projectId, name: trimmed });
  }

  function handleTitleSubmit(event: FormEvent) {
    event.preventDefault();
    commitTitle();
  }

  return (
    <main className="mx-auto max-w-[1600px] space-y-3 p-4">
      <header className="rounded-md border border-line bg-ink-raised px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            {isEditingTitle ? (
              <form onSubmit={handleTitleSubmit}>
                <input
                  autoFocus
                  aria-label={studioCopy.renameProjectAriaLabel}
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
                  {meta.projectName || studioCopy.untitledProject}
                </h1>
                <button
                  type="button"
                  onClick={() => {
                    setTitleDraft(meta.projectName);
                    setIsEditingTitle(true);
                  }}
                  aria-label={studioCopy.renameProjectAriaLabel}
                  title={studioCopy.renameProjectAriaLabel}
                  className="btn btn-ghost btn-sm btn-icon"
                >
                  <Pencil size={14} aria-hidden="true" />
                </button>
                <span className="chip">
                  <NetworkTypeIcon type="CLOUD" size={12} />
                  {projectsCopy.networkTypeOptions.CLOUD} · AWS
                </span>
              </div>
            )}
            <p className="text-xs text-chalk-dim">{copy.studioHint}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <HeaderCost language={language} />
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => dispatch(cloudUndo())}
                disabled={!canUndo}
                aria-label={copy.undo}
                title={copy.undo}
                className="btn btn-ghost btn-sm btn-icon"
              >
                <Undo2 size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => dispatch(cloudRedo())}
                disabled={!canRedo}
                aria-label={copy.redo}
                title={copy.redo}
                className="btn btn-ghost btn-sm btn-icon"
              >
                <Redo2 size={15} aria-hidden="true" />
              </button>
            </div>
            <span className="h-5 w-px bg-line" aria-hidden="true" />
            <SaveStatusButton
              saveStatus={meta.saveStatus}
              persistWarning={meta.persistWarning}
              lastSavedAt={meta.lastSavedAt}
              language={language}
              copy={studioCopy}
              onClick={forceSave}
            />
          </div>
        </div>
      </header>

      <div className="grid gap-3 lg:h-[min(76vh,820px)] lg:grid-cols-[264px_minmax(0,1fr)_320px]">
        <CloudPalette language={language} />
        <section className="h-[60vh] overflow-hidden rounded-md border border-line lg:h-auto">
          <CloudCanvas
            language={language}
            onDeleted={() => setDeletedToast(copy.deletedToast)}
            onConnectionDeleted={() => setDeletedToast(copy.connection.removed)}
            onCreateAccount={() => createResource('aws.account', null)}
          />
        </section>
        {/* `nokey`: Delete/Backspace com o foco aqui não exclui o selecionado no canvas. */}
        <div className="nokey contents">
          <CloudInspector
            language={language}
            onDeleted={() => setDeletedToast(copy.deletedToast)}
            onConnectionDeleted={() => setDeletedToast(copy.connection.removed)}
          />
        </div>
      </div>

      {/* Tabelas da arquitetura, por domínio. */}
      <section aria-label={copy.tablesLabel} className="nokey">
        <TableTabs
          tabs={[
            {
              id: 'ipam',
              label: copy.ipamTab,
              content: <CloudIpamTable language={language} />,
            },
            {
              id: 'resources',
              label: copy.resourcesTab,
              content: <CloudResourcesTable language={language} />,
            },
            {
              id: 'routes',
              label: copy.routes.tab,
              content: <CloudRoutesTable language={language} />,
            },
            {
              id: 'connections',
              label: copy.connectionsTab,
              content: <CloudConnectionsTable language={language} />,
            },
            {
              id: 'sg',
              label: copy.security.sgTab,
              content: <CloudSecurityGroupsTable language={language} />,
            },
            {
              id: 'nacl',
              label: copy.security.naclTab,
              content: <CloudNaclTable language={language} />,
            },
            {
              id: 'operation',
              label: copy.operationTab,
              content: <CloudOperationTable language={language} />,
            },
            {
              id: 'cost',
              label: copy.cost.tab,
              content: <CloudCostPanel language={language} />,
            },
            {
              id: 'terraform',
              label: copy.terraform.tab,
              content: <CloudTerraformPanel language={language} />,
            },
            {
              id: 'validation',
              label: copy.validation.tab,
              content: (
                <CloudValidationPanel
                  language={language}
                  items={validation.items}
                  counts={validation.counts}
                  pricesPending={validation.pricesPending}
                />
              ),
            },
          ]}
          groups={[
            {
              id: 'addressing',
              label: copy.tabGroups.addressing,
              tabIds: ['ipam', 'resources'],
            },
            {
              id: 'traffic',
              label: copy.tabGroups.traffic,
              tabIds: ['routes', 'connections'],
            },
            {
              id: 'security',
              label: copy.tabGroups.security,
              tabIds: ['sg', 'nacl'],
            },
            {
              id: 'operation',
              label: copy.tabGroups.operation,
              tabIds: ['operation'],
            },
            {
              id: 'cost',
              label: copy.tabGroups.cost,
              tabIds: ['cost'],
            },
            {
              id: 'terraform',
              label: copy.tabGroups.terraform,
              tabIds: ['terraform'],
            },
            {
              id: 'validation',
              label: copy.validation.groupLabel(
                validation.counts.error + validation.counts.warning,
              ),
              tabIds: ['validation'],
            },
          ]}
          defaultTabId="ipam"
          storageKey={
            projectId ? `rede-sp-cwb-cloud-tab:${projectId}` : undefined
          }
        />
      </section>

      {deletedToast && (
        <Toast
          message={deletedToast}
          actionLabel={copy.undo}
          onAction={() => {
            dispatch(cloudUndo());
            setDeletedToast(null);
          }}
          dismissLabel={copy.dismiss}
          onDismiss={() => setDeletedToast(null)}
        />
      )}
    </main>
  );
}
