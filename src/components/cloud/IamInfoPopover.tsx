import { Info, X } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppDispatch } from '../../app/hooks';
import { selectCloudResource } from '../../features/cloud/cloudSlice';
import { readIamSelections } from '../../features/cloud/iam';
import { useIamCatalogQuery } from '../../features/cloud/queries';
import type { CloudResource } from '../../features/cloud/types';
import type { AppLanguage } from '../../types/i18n';
import { getCloudCopy } from './cloudCopy';
import { templateLabel } from './IamTemplatePicker';

const PANEL_WIDTH = 360;

/**
 * ⓘ do card da conta no canvas: consulta, só leitura, de usuários, grupos e
 * roles IAM com as políticas de cada um. Abre num portal (fora do pane do
 * React Flow, então não escala com o zoom). Editar é no inspetor — o link
 * seleciona a conta.
 */
export default function IamInfoPopover({
  account,
  language,
}: {
  account: CloudResource;
  language: AppLanguage;
}) {
  const dispatch = useAppDispatch();
  const copy = getCloudCopy(language);
  const { data: catalog } = useIamCatalogQuery('AWS');
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const left = Math.min(
      Math.max(8, rect.right - PANEL_WIDTH),
      window.innerWidth - PANEL_WIDTH - 8,
    );
    setPosition({ top: rect.bottom + 6, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !panelRef.current?.contains(target) &&
        !buttonRef.current?.contains(target)
      )
        setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  const users = Array.isArray(account.config.iamUsers)
    ? account.config.iamUsers.filter((u): u is string => typeof u === 'string')
    : [];
  const policyName = (key: string) =>
    catalog?.policies
      .find((p) => p.key === key)
      ?.policyArn?.split('/')
      .pop() ?? key;

  const section = (title: string, kind: 'GROUP' | 'ROLE') => {
    const selections = readIamSelections(
      kind === 'GROUP' ? account.config.iamGroups : account.config.iamRoles,
    );
    const templates =
      (kind === 'GROUP' ? catalog?.groups : catalog?.roles) ?? [];
    return (
      <section>
        <h3 className="text-label mb-1 text-chalk-faint">{title}</h3>
        {selections.length === 0 ? (
          <p className="text-2xs text-chalk-faint">{copy.none}</p>
        ) : (
          <ul className="space-y-1.5">
            {selections.map((selection) => {
              const template = templates.find((t) => t.key === selection.key);
              return (
                <li key={selection.key}>
                  <p className="text-xs text-chalk">
                    {templateLabel(template, language, selection.key)}
                    {template?.iamName && (
                      <span className="ml-1.5 font-mono text-2xs text-chalk-faint">
                        {template.iamName}
                      </span>
                    )}
                  </p>
                  <p className="font-mono text-2xs leading-4 text-chalk-dim">
                    {selection.policies.length
                      ? selection.policies.map(policyName).join(' · ')
                      : copy.noPolicies}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    );
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={copy.iamInfo}
        title={copy.iamInfo}
        className="nodrag rounded-[2px] p-1 text-chalk-dim hover:bg-ink-raised-2 hover:text-chalk"
      >
        <Info size={14} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-labelledby={titleId}
            style={{
              top: position.top,
              left: position.left,
              width: PANEL_WIDTH,
            }}
            className="fixed z-50 max-h-[60vh] overflow-y-auto rounded-md border border-line bg-ink-raised shadow-panel"
          >
            <div className="panel-header">
              <h2 id={titleId} className="panel-title">
                {copy.iamInfo}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={copy.dismiss}
                title={copy.dismiss}
                className="btn btn-ghost btn-sm btn-icon"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-3 p-3">
              <section>
                <h3 className="text-label mb-1 text-chalk-faint">
                  {copy.iamUsersTitle}
                </h3>
                {users.length === 0 ? (
                  <p className="text-2xs text-chalk-faint">{copy.none}</p>
                ) : (
                  <ul className="flex flex-wrap gap-1">
                    {users.map((user) => (
                      <li key={user} className="chip">
                        {user}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              {section(copy.iamGroupsTitle, 'GROUP')}
              {section(copy.iamRolesTitle, 'ROLE')}
            </div>
            <div className="border-t border-line p-2">
              <button
                type="button"
                onClick={() => {
                  dispatch(selectCloudResource(account.id));
                  setOpen(false);
                }}
                className="btn btn-ghost btn-sm w-full justify-center"
              >
                {copy.editInInspector}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
