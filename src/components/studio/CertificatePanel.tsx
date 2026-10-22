import { AlertTriangle, Clock, Pencil, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  addCertificate,
  updateCertificate,
  removeCertificate,
} from '../../features/network/networkSlice';
import type { CertificateType } from '../../features/network/types';

import Modal from '../Modal';
import type { ServicesCertificatesCopy, StudioLanguage } from './types';
import { getServicesCertificatesCopy } from './utils/i18n';

const CERT_TYPES: CertificateType[] = ['local', 'ca', 'remote', 'crl'];

function typeLabel(type: CertificateType, copy: ServicesCertificatesCopy) {
  if (type === 'remote') return copy.typeRemote;
  return type === 'local' ? 'Local' : type.toUpperCase();
}

type DraftCert = {
  name: string;
  type: CertificateType;
  cn: string;
  issuer: string;
  expiresAt: string;
  fingerprint: string;
  description: string;
};

const EMPTY_DRAFT: DraftCert = {
  name: '',
  type: 'local',
  cn: '',
  issuer: '',
  expiresAt: '',
  fingerprint: '',
  description: '',
};

function isExpiredOrSoon(dateStr: string) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  if (diff < 0) return 'expired';
  if (diff < 30 * 24 * 60 * 60 * 1000) return 'soon';
  return 'ok';
}

export default function CertificatePanel({
  language,
}: {
  language: StudioLanguage;
}) {
  const copy = getServicesCertificatesCopy(language);
  const dispatch = useAppDispatch();
  const certificates = useAppSelector((s) => s.network.certificates);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DraftCert>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);

  function openCreate() {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
    setOpen(true);
  }

  function openEdit(id: string) {
    const cert = certificates.find((c) => c.id === id);
    if (!cert) return;
    setDraft({
      name: cert.name,
      type: cert.type,
      cn: cert.cn ?? '',
      issuer: cert.issuer ?? '',
      expiresAt: cert.expiresAt ?? '',
      fingerprint: cert.fingerprint ?? '',
      description: cert.description ?? '',
    });
    setEditingId(id);
    setOpen(true);
  }

  function handleSave() {
    if (!draft.name.trim()) return;
    const changes = {
      name: draft.name.trim(),
      type: draft.type,
      cn: draft.cn.trim() || undefined,
      issuer: draft.issuer.trim() || undefined,
      expiresAt: draft.expiresAt || undefined,
      fingerprint: draft.fingerprint.trim() || undefined,
      description: draft.description.trim() || undefined,
    };
    if (editingId) {
      dispatch(updateCertificate({ id: editingId, changes }));
    } else {
      dispatch(addCertificate(changes));
    }
    setOpen(false);
  }

  return (
    <section className="panel">
      <header className="panel-header">
        <h3 className="panel-title">{copy.certificatesTitle}</h3>
        <button
          type="button"
          onClick={openCreate}
          className="btn btn-secondary btn-sm"
        >
          <Plus size={14} aria-hidden="true" />
          {copy.newCertificate}
        </button>
      </header>

      {certificates.length === 0 ? (
        <p className="px-3 py-4 text-xs text-chalk-faint">
          {copy.noCertificates}
        </p>
      ) : (
        <div className="theme-scrollbar overflow-x-auto px-1 pb-1">
          <table className="data-table">
            <thead>
              <tr>
                <th>{copy.name}</th>
                <th>{copy.type}</th>
                <th>CN</th>
                <th>{copy.issuer}</th>
                <th>{copy.expiresAt}</th>
                <th>Fingerprint</th>
                <th>
                  <span className="sr-only">{copy.edit}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {certificates.map((cert) => {
                const expStatus = isExpiredOrSoon(cert.expiresAt ?? '');
                return (
                  <tr key={cert.id}>
                    <td className="font-semibold text-chalk">{cert.name}</td>
                    <td>
                      <span className="chip">{typeLabel(cert.type, copy)}</span>
                    </td>
                    <td className="max-w-[120px] truncate font-mono">
                      {cert.cn ?? '—'}
                    </td>
                    <td className="max-w-[120px] truncate">
                      {cert.issuer ?? '—'}
                    </td>
                    <td
                      className={`whitespace-nowrap font-mono ${
                        expStatus === 'expired'
                          ? 'text-signal-down'
                          : expStatus === 'soon'
                            ? 'text-signal-warn'
                            : ''
                      }`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {cert.expiresAt
                          ? new Date(cert.expiresAt).toLocaleDateString(
                              language,
                            )
                          : '—'}
                        {expStatus === 'expired' && (
                          <AlertTriangle
                            size={13}
                            aria-label={copy.expired}
                            role="img"
                          />
                        )}
                        {expStatus === 'soon' && (
                          <Clock
                            size={13}
                            aria-label={copy.expiringSoon}
                            role="img"
                          />
                        )}
                      </span>
                    </td>
                    <td
                      className="max-w-[120px] truncate font-mono text-chalk-faint"
                      title={cert.fingerprint}
                    >
                      {cert.fingerprint
                        ? cert.fingerprint.slice(0, 20) + '…'
                        : '—'}
                    </td>
                    <td className="whitespace-nowrap text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(cert.id)}
                        aria-label={`${copy.edit} ${cert.name}`}
                        title={copy.edit}
                        className="btn btn-ghost btn-sm btn-icon"
                      >
                        <Pencil size={13} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          dispatch(removeCertificate({ id: cert.id }))
                        }
                        aria-label={`${copy.remove} ${cert.name}`}
                        title={copy.remove}
                        className="btn btn-ghost btn-sm btn-icon enabled:hover:text-signal-down"
                      >
                        <X size={14} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <Modal
          onClose={() => setOpen(false)}
          title={editingId ? copy.editCertificate : copy.newCertificate}
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
                placeholder="Cert-SSL-VPN"
              />
            </label>

            <fieldset>
              <legend className="mb-1.5 text-xs font-medium text-chalk-dim">
                {copy.type}
              </legend>
              <div role="radiogroup" className="flex flex-wrap gap-1.5">
                {CERT_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={draft.type === t}
                    onClick={() => setDraft((d) => ({ ...d, type: t }))}
                    className={`h-8 rounded-sm border px-2.5 text-xs transition-colors ${
                      draft.type === t
                        ? 'border-accent bg-accent/10 text-chalk'
                        : 'border-line text-chalk-dim hover:border-chalk-faint hover:text-chalk'
                    }`}
                  >
                    {typeLabel(t, copy)}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5 text-xs font-medium text-chalk-dim">
                {copy.commonName}
                <input
                  value={draft.cn}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, cn: e.target.value }))
                  }
                  className="field font-mono"
                  placeholder="*.empresa.com"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-medium text-chalk-dim">
                {copy.issuer}
                <input
                  value={draft.issuer}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, issuer: e.target.value }))
                  }
                  className="field"
                  placeholder="Let's Encrypt"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1.5 text-xs font-medium text-chalk-dim">
              {copy.expirationDate}
              <input
                type="date"
                value={draft.expiresAt}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, expiresAt: e.target.value }))
                }
                className="field [color-scheme:dark]"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-medium text-chalk-dim">
              {copy.fingerprint}
              <input
                value={draft.fingerprint}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, fingerprint: e.target.value }))
                }
                className="field font-mono text-xs"
                placeholder="AA:BB:CC:…"
              />
            </label>

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
