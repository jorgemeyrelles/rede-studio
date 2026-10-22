import { Pencil, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  addCustomService,
  updateCustomService,
  removeCustomService,
} from '../../features/network/networkSlice';
import type { CustomServiceProto } from '../../features/network/types';

import Modal from '../Modal';
import type { StudioLanguage } from './types';
import { getServicesCertificatesCopy } from './utils/i18n';

const PROTOCOLS: CustomServiceProto[] = [
  'tcp',
  'udp',
  'tcp-udp',
  'icmp',
  'gre',
  'esp',
  'other',
];

function protoLabel(proto: CustomServiceProto, otherLabel: string) {
  if (proto === 'other') return otherLabel;
  return proto === 'tcp-udp' ? 'TCP/UDP' : proto.toUpperCase();
}

type DraftService = {
  name: string;
  protocol: CustomServiceProto;
  dstPort: string;
  srcPort: string;
  icmpType: string;
  // icmpType só é usado quando protocol === 'icmp'
  description: string;
};

const EMPTY_DRAFT: DraftService = {
  name: '',
  protocol: 'tcp',
  dstPort: '',
  srcPort: '',
  icmpType: '',
  description: '',
};

export default function CustomServicePanel({
  language,
}: {
  language: StudioLanguage;
}) {
  const copy = getServicesCertificatesCopy(language);
  const dispatch = useAppDispatch();
  const customServices = useAppSelector((s) => s.network.customServices);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DraftService>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);

  function openCreate() {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
    setOpen(true);
  }

  function openEdit(id: string) {
    const svc = customServices.find((s) => s.id === id);
    if (!svc) return;
    setDraft({
      name: svc.name,
      protocol: svc.protocol,
      dstPort: svc.dstPort ?? '',
      srcPort: svc.srcPort ?? '',
      icmpType: svc.icmpType !== undefined ? String(svc.icmpType) : '',
      description: svc.description ?? '',
    });
    setEditingId(id);
    setOpen(true);
  }

  function handleSave() {
    if (!draft.name.trim()) return;
    const changes = {
      name: draft.name.trim(),
      protocol: draft.protocol,
      dstPort: draft.dstPort.trim() || undefined,
      srcPort: draft.srcPort.trim() || undefined,
      icmpType: draft.icmpType.trim() ? Number(draft.icmpType) : undefined,
      description: draft.description.trim() || undefined,
    };
    if (editingId) {
      dispatch(updateCustomService({ id: editingId, changes }));
    } else {
      dispatch(addCustomService(changes));
    }
    setOpen(false);
  }

  const showPorts = ['tcp', 'udp', 'tcp-udp'].includes(draft.protocol);
  const showIcmp = draft.protocol === 'icmp';

  return (
    <section className="panel">
      <header className="panel-header">
        <h3 className="panel-title">{copy.servicesTitle}</h3>
        <button
          type="button"
          onClick={openCreate}
          className="btn btn-secondary btn-sm"
        >
          <Plus size={14} aria-hidden="true" />
          {copy.newService}
        </button>
      </header>

      {customServices.length === 0 ? (
        <p className="px-3 py-4 text-xs text-chalk-faint">{copy.noServices}</p>
      ) : (
        <div className="theme-scrollbar overflow-x-auto px-1 pb-1">
          <table className="data-table">
            <thead>
              <tr>
                <th>{copy.name}</th>
                <th>{copy.protocol}</th>
                <th>{copy.dstPort}</th>
                <th>{copy.srcPort}</th>
                <th>{copy.icmpType}</th>
                <th>{copy.description}</th>
                <th>
                  <span className="sr-only">{copy.edit}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {customServices.map((svc) => (
                <tr key={svc.id}>
                  <td className="font-semibold text-chalk">{svc.name}</td>
                  <td>
                    <span className="chip">
                      {protoLabel(svc.protocol, copy.protocolOther)}
                    </span>
                  </td>
                  <td className="font-mono">{svc.dstPort ?? '—'}</td>
                  <td className="font-mono">{svc.srcPort ?? '—'}</td>
                  <td className="font-mono">
                    {svc.icmpType !== undefined ? svc.icmpType : '—'}
                  </td>
                  <td className="max-w-[160px] truncate text-chalk-faint">
                    {svc.description ?? '—'}
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(svc.id)}
                      aria-label={`${copy.edit} ${svc.name}`}
                      title={copy.edit}
                      className="btn btn-ghost btn-sm btn-icon"
                    >
                      <Pencil size={13} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        dispatch(removeCustomService({ id: svc.id }))
                      }
                      aria-label={`${copy.remove} ${svc.name}`}
                      title={copy.remove}
                      className="btn btn-ghost btn-sm btn-icon enabled:hover:text-signal-down"
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <Modal
          onClose={() => setOpen(false)}
          title={editingId ? copy.editService : copy.newService}
          closeLabel={copy.cancel}
          size="md"
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleSave();
            }}
            className="flex flex-col gap-4"
          >
            <label className="flex flex-col gap-1.5 text-xs font-medium text-chalk-dim">
              {copy.name} *
              <input
                autoFocus
                required
                value={draft.name}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, name: e.target.value }))
                }
                className="field"
                placeholder="HTTP-ALT"
              />
            </label>

            <fieldset>
              <legend className="mb-1.5 text-xs font-medium text-chalk-dim">
                {copy.protocol}
              </legend>
              <div role="radiogroup" className="flex flex-wrap gap-1.5">
                {PROTOCOLS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={draft.protocol === p}
                    onClick={() => setDraft((d) => ({ ...d, protocol: p }))}
                    className={`h-8 rounded-sm border px-2.5 font-mono text-xs transition-colors ${
                      draft.protocol === p
                        ? 'border-accent bg-accent/10 text-chalk'
                        : 'border-line text-chalk-dim hover:border-chalk-faint hover:text-chalk'
                    }`}
                  >
                    {protoLabel(p, copy.protocolOther)}
                  </button>
                ))}
              </div>
            </fieldset>

            {showPorts && (
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5 text-xs font-medium text-chalk-dim">
                  {copy.dstPortRange}
                  <input
                    value={draft.dstPort}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, dstPort: e.target.value }))
                    }
                    placeholder={copy.dstPortPlaceholder}
                    className="field font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-medium text-chalk-dim">
                  {copy.srcPortRange}
                  <input
                    value={draft.srcPort}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, srcPort: e.target.value }))
                    }
                    placeholder="1024-65535"
                    className="field font-mono"
                  />
                </label>
              </div>
            )}

            {showIcmp && (
              <label className="flex flex-col gap-1.5 text-xs font-medium text-chalk-dim">
                {copy.icmpType}
                <input
                  type="number"
                  min={0}
                  max={255}
                  value={draft.icmpType}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, icmpType: e.target.value }))
                  }
                  placeholder={copy.icmpPlaceholder}
                  className="field font-mono"
                />
              </label>
            )}

            <label className="flex flex-col gap-1.5 text-xs font-medium text-chalk-dim">
              {copy.description}
              <input
                value={draft.description}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, description: e.target.value }))
                }
                className="field"
                placeholder={copy.optional}
              />
            </label>

            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn btn-secondary btn-md"
              >
                {copy.cancel}
              </button>
              <button
                type="submit"
                disabled={!draft.name.trim()}
                className="btn btn-primary btn-md"
              >
                {editingId ? copy.save : copy.create}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
