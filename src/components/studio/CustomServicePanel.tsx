import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  addCustomService,
  updateCustomService,
  removeCustomService,
} from '../../features/network/networkSlice';
import type { CustomServiceProto } from '../../features/network/types';

const PROTO_LABEL: Record<CustomServiceProto, string> = {
  tcp: 'TCP',
  udp: 'UDP',
  'tcp-udp': 'TCP/UDP',
  icmp: 'ICMP',
  gre: 'GRE',
  esp: 'ESP',
  other: 'Outro',
};

const PROTO_COLOR: Record<CustomServiceProto, string> = {
  tcp: 'bg-blue-800/50 text-blue-300',
  udp: 'bg-cyan-800/50 text-cyan-300',
  'tcp-udp': 'bg-sky-800/50 text-sky-300',
  icmp: 'bg-yellow-800/50 text-yellow-300',
  gre: 'bg-orange-800/50 text-orange-300',
  esp: 'bg-rose-800/50 text-rose-300',
  other: 'bg-slate-700/50 text-slate-300',
};

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

export default function CustomServicePanel() {
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
    <div className="relative rounded-xl border border-[#315072] bg-[#0b172a]/80 px-3 py-2 shadow-[0_12px_24px_rgba(0,0,0,0.35)]">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          🔧 Serviços Customizados
        </span>
        <button
          type="button"
          onClick={openCreate}
          className="rounded border border-emerald-600/50 bg-emerald-900/30 px-2 py-0.5 text-[10px] text-emerald-300 hover:bg-emerald-800/40"
        >
          + Novo Serviço
        </button>
      </div>

      {/* Table */}
      {customServices.length === 0 ? (
        <p className="text-[11px] text-slate-500">Nenhum serviço definido.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[10px] text-slate-300">
            <thead>
              <tr className="border-b border-slate-700/50 text-[9px] uppercase tracking-wider text-slate-500">
                <th className="py-1 pr-3 text-left">Nome</th>
                <th className="py-1 pr-3 text-left">Proto</th>
                <th className="py-1 pr-3 text-left">Dst Port</th>
                <th className="py-1 pr-3 text-left">Src Port</th>
                <th className="py-1 pr-3 text-left">ICMP Type</th>
                <th className="py-1 text-left">Descrição</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {customServices.map((svc) => (
                <tr
                  key={svc.id}
                  className="border-b border-slate-800/50 hover:bg-slate-800/20"
                >
                  <td className="py-0.5 pr-3 font-semibold text-slate-200">
                    {svc.name}
                  </td>
                  <td className="py-0.5 pr-3">
                    <span
                      className={`rounded px-1 py-0.5 text-[9px] font-semibold ${PROTO_COLOR[svc.protocol]}`}
                    >
                      {PROTO_LABEL[svc.protocol]}
                    </span>
                  </td>
                  <td className="py-0.5 pr-3 font-mono text-slate-400">
                    {svc.dstPort ?? '—'}
                  </td>
                  <td className="py-0.5 pr-3 font-mono text-slate-400">
                    {svc.srcPort ?? '—'}
                  </td>
                  <td className="py-0.5 pr-3 text-slate-400">
                    {svc.icmpType !== undefined ? svc.icmpType : '—'}
                  </td>
                  <td className="max-w-[140px] truncate py-0.5 text-slate-500">
                    {svc.description ?? '—'}
                  </td>
                  <td className="py-0.5 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(svc.id)}
                      className="mr-1 rounded px-1 text-sky-400 hover:bg-sky-900/30"
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        dispatch(removeCustomService({ id: svc.id }))
                      }
                      className="rounded px-1 text-red-400 hover:bg-red-900/30"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-[380px] rounded-xl border border-[#3a5b83] bg-[#09162a] p-4 shadow-2xl">
            <h3 className="mb-3 text-sm font-semibold text-sky-300">
              {editingId ? 'Editar Serviço' : 'Novo Serviço Customizado'}
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
                  placeholder="ex: HTTP-ALT"
                />
              </label>

              <div>
                <span className="mb-1 block text-slate-400">Protocolo</span>
                <div className="flex flex-wrap gap-1">
                  {(Object.keys(PROTO_LABEL) as CustomServiceProto[]).map(
                    (p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setDraft((d) => ({ ...d, protocol: p }))}
                        className={`rounded px-1.5 py-0.5 text-[9px] font-semibold transition ${
                          draft.protocol === p
                            ? PROTO_COLOR[p]
                            : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600/50'
                        }`}
                      >
                        {PROTO_LABEL[p]}
                      </button>
                    ),
                  )}
                </div>
              </div>

              {showPorts && (
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-0.5 block text-slate-400">
                      Dst Port / Range
                    </span>
                    <input
                      value={draft.dstPort}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, dstPort: e.target.value }))
                      }
                      placeholder="ex: 8080 ou 8080-8090"
                      className="w-full rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1.5 font-mono text-slate-100"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-0.5 block text-slate-400">
                      Src Port / Range
                    </span>
                    <input
                      value={draft.srcPort}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, srcPort: e.target.value }))
                      }
                      placeholder="ex: 1024-65535"
                      className="w-full rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1.5 font-mono text-slate-100"
                    />
                  </label>
                </div>
              )}

              {showIcmp && (
                <label className="block">
                  <span className="mb-0.5 block text-slate-400">ICMP Type</span>
                  <input
                    type="number"
                    min={0}
                    max={255}
                    value={draft.icmpType}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, icmpType: e.target.value }))
                    }
                    placeholder="ex: 8 (echo request)"
                    className="w-full rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1.5 text-slate-100"
                  />
                </label>
              )}

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
