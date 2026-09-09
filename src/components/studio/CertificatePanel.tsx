import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  addCertificate,
  updateCertificate,
  removeCertificate,
} from '../../features/network/networkSlice';
import type { CertificateType } from '../../features/network/types';

const TYPE_LABEL: Record<CertificateType, string> = {
  local: 'Local',
  ca: 'CA',
  remote: 'Remoto',
  crl: 'CRL',
};

const TYPE_COLOR: Record<CertificateType, string> = {
  local: 'bg-sky-800/50 text-sky-300',
  ca: 'bg-emerald-800/50 text-emerald-300',
  remote: 'bg-purple-800/50 text-purple-300',
  crl: 'bg-slate-700/50 text-slate-300',
};

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

export default function CertificatePanel() {
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
    <div className="relative rounded-xl border border-[#315072] bg-[#0b172a]/80 px-3 py-2 shadow-[0_12px_24px_rgba(0,0,0,0.35)]">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          🔐 Certificados
        </span>
        <button
          type="button"
          onClick={openCreate}
          className="rounded border border-emerald-600/50 bg-emerald-900/30 px-2 py-0.5 text-[10px] text-emerald-300 hover:bg-emerald-800/40"
        >
          + Novo Certificado
        </button>
      </div>

      {certificates.length === 0 ? (
        <p className="text-[11px] text-slate-500">
          Nenhum certificado importado.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[10px] text-slate-300">
            <thead>
              <tr className="border-b border-slate-700/50 text-[9px] uppercase tracking-wider text-slate-500">
                <th className="py-1 pr-3 text-left">Nome</th>
                <th className="py-1 pr-3 text-left">Tipo</th>
                <th className="py-1 pr-3 text-left">CN</th>
                <th className="py-1 pr-3 text-left">Issuer</th>
                <th className="py-1 pr-3 text-left">Expira em</th>
                <th className="py-1 pr-3 text-left">Fingerprint</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {certificates.map((cert) => {
                const expStatus = isExpiredOrSoon(cert.expiresAt ?? '');
                return (
                  <tr
                    key={cert.id}
                    className="border-b border-slate-800/50 hover:bg-slate-800/20"
                  >
                    <td className="py-0.5 pr-3 font-semibold text-slate-200">
                      {cert.name}
                    </td>
                    <td className="py-0.5 pr-3">
                      <span
                        className={`rounded px-1 py-0.5 text-[9px] font-semibold ${TYPE_COLOR[cert.type]}`}
                      >
                        {TYPE_LABEL[cert.type]}
                      </span>
                    </td>
                    <td className="max-w-[100px] truncate py-0.5 pr-3 text-slate-400">
                      {cert.cn ?? '—'}
                    </td>
                    <td className="max-w-[100px] truncate py-0.5 pr-3 text-slate-400">
                      {cert.issuer ?? '—'}
                    </td>
                    <td
                      className={`py-0.5 pr-3 font-mono ${
                        expStatus === 'expired'
                          ? 'text-red-400'
                          : expStatus === 'soon'
                            ? 'text-yellow-400'
                            : 'text-slate-400'
                      }`}
                    >
                      {cert.expiresAt
                        ? new Date(cert.expiresAt).toLocaleDateString('pt-BR')
                        : '—'}
                      {expStatus === 'expired' && (
                        <span className="ml-1 text-red-400">⚠</span>
                      )}
                      {expStatus === 'soon' && (
                        <span className="ml-1 text-yellow-400">⏰</span>
                      )}
                    </td>
                    <td className="max-w-[80px] truncate py-0.5 pr-3 font-mono text-[9px] text-slate-500">
                      {cert.fingerprint
                        ? cert.fingerprint.slice(0, 20) + '…'
                        : '—'}
                    </td>
                    <td className="py-0.5 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(cert.id)}
                        className="mr-1 rounded px-1 text-sky-400 hover:bg-sky-900/30"
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          dispatch(removeCertificate({ id: cert.id }))
                        }
                        className="rounded px-1 text-red-400 hover:bg-red-900/30"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-[420px] rounded-xl border border-[#3a5b83] bg-[#09162a] p-4 shadow-2xl">
            <h3 className="mb-3 text-sm font-semibold text-sky-300">
              {editingId ? 'Editar Certificado' : 'Novo Certificado'}
            </h3>
            <div className="space-y-2 text-xs">
              <label className="block">
                <span className="mb-0.5 block text-slate-400">Nome *</span>
                <input
                  autoFocus
                  value={draft.name}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, name: e.target.value }))
                  }
                  className="w-full rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1.5 text-slate-100"
                  placeholder="ex: Cert-SSL-VPN"
                />
              </label>

              <div>
                <span className="mb-1 block text-slate-400">Tipo</span>
                <div className="flex gap-1">
                  {(Object.keys(TYPE_LABEL) as CertificateType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, type: t }))}
                      className={`rounded px-2 py-0.5 text-[9px] font-semibold transition ${
                        draft.type === t
                          ? TYPE_COLOR[t]
                          : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600/50'
                      }`}
                    >
                      {TYPE_LABEL[t]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-0.5 block text-slate-400">
                    Common Name (CN)
                  </span>
                  <input
                    value={draft.cn}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, cn: e.target.value }))
                    }
                    className="w-full rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1.5 font-mono text-slate-100"
                    placeholder="*.empresa.com"
                  />
                </label>
                <label className="block">
                  <span className="mb-0.5 block text-slate-400">Issuer</span>
                  <input
                    value={draft.issuer}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, issuer: e.target.value }))
                    }
                    className="w-full rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1.5 text-slate-100"
                    placeholder="Let's Encrypt"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-0.5 block text-slate-400">
                  Data de Expiração
                </span>
                <input
                  type="date"
                  value={draft.expiresAt}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, expiresAt: e.target.value }))
                  }
                  className="w-full rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1.5 text-slate-100"
                />
              </label>

              <label className="block">
                <span className="mb-0.5 block text-slate-400">
                  Fingerprint (SHA-256)
                </span>
                <input
                  value={draft.fingerprint}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, fingerprint: e.target.value }))
                  }
                  className="w-full rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1.5 font-mono text-[10px] text-slate-100"
                  placeholder="AA:BB:CC:..."
                />
              </label>

              <label className="block">
                <span className="mb-0.5 block text-slate-400">Descrição</span>
                <input
                  value={draft.description}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, description: e.target.value }))
                  }
                  className="w-full rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1.5 text-slate-100"
                  placeholder="Opcional"
                />
              </label>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-400 hover:border-slate-500 hover:text-slate-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!draft.name.trim()}
                onClick={handleSave}
                className="rounded bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-600 disabled:opacity-40"
              >
                {editingId ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
