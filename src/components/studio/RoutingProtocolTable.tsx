import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { updateNodeTechField } from '../../features/network/networkSlice';
import { selectRoutingProtocolRows } from '../../features/network/selectors';
import type { RoutingProtocolRow } from '../../features/network/types';
import type { StudioLanguage } from './catalog';

// ── Mode badge ────────────────────────────────────────────────────────────────
const MODE_CLASS: Record<string, string> = {
  static: 'bg-slate-700 text-slate-300',
  ospf: 'bg-blue-900/60 text-blue-300',
  bgp: 'bg-violet-900/60 text-violet-300',
  mixed: 'bg-teal-900/60 text-teal-300',
};

const MODE_LABEL: Record<string, string> = {
  static: 'Static',
  ospf: 'OSPF',
  bgp: 'BGP',
  mixed: 'Mixed',
};

// ── Inline editable cell ──────────────────────────────────────────────────────
function EditableCell({
  nodeId,
  fieldKey,
  value,
  placeholder,
  numeric,
  layerOrder,
}: {
  nodeId: string;
  fieldKey: string;
  value: string | number;
  placeholder?: string;
  numeric?: boolean;
  layerOrder?: number;
}) {
  const dispatch = useAppDispatch();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  const commit = () => {
    const next = numeric ? Number(draft) : draft;
    dispatch(
      updateNodeTechField({
        id: nodeId,
        key: fieldKey,
        value: next,
      }),
    );
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        autoFocus
        type={numeric ? 'number' : 'text'}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {
            setDraft(String(value));
            setEditing(false);
          }
        }}
        placeholder={placeholder}
        className="w-full rounded border border-blue-500/50 bg-slate-900 px-1 py-0.5 font-mono text-[10px] text-slate-100 outline-none focus:border-blue-400"
        style={{ minWidth: 60 }}
      />
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      title="Clique para editar"
      onClick={() => {
        setDraft(String(value));
        setEditing(true);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          setDraft(String(value));
          setEditing(true);
        }
      }}
      className={`inline-block cursor-pointer rounded px-1 py-0.5 font-mono text-[10px] hover:bg-slate-700/60 ${
        String(value) ? 'text-slate-200' : 'text-slate-600 italic'
      }`}
    >
      {String(value) || placeholder || '—'}
    </span>
  );
}

// ── Boolean toggle cell ───────────────────────────────────────────────────────
function BooleanCell({
  nodeId,
  fieldKey,
  value,
}: {
  nodeId: string;
  fieldKey: string;
  value: boolean;
}) {
  const dispatch = useAppDispatch();
  return (
    <button
      type="button"
      title={value ? 'Habilitado — clique para desabilitar' : 'Desabilitado — clique para habilitar'}
      onClick={() =>
        dispatch(updateNodeTechField({ id: nodeId, key: fieldKey, value: !value }))
      }
      className={`rounded px-1.5 py-0.5 text-[9px] font-semibold transition ${
        value
          ? 'bg-emerald-900/60 text-emerald-300 hover:bg-red-900/40 hover:text-red-300'
          : 'bg-slate-700/60 text-slate-500 hover:bg-emerald-900/40 hover:text-emerald-300'
      }`}
    >
      {value ? 'ON' : 'OFF'}
    </button>
  );
}

// ── Neighbors expandable cell ─────────────────────────────────────────────────
function NeighborsCell({ row }: { row: RoutingProtocolRow }) {
  const dispatch = useAppDispatch();
  const [expanded, setExpanded] = useState(false);
  const [editingRaw, setEditingRaw] = useState(false);
  const [draft, setDraft] = useState(row.bgpNeighborsRaw ?? '');

  const count = row.bgpNeighborsParsed?.length ?? 0;

  const commitRaw = () => {
    dispatch(
      updateNodeTechField({ id: row.nodeId, key: 'bgpNeighbors', value: draft }),
    );
    setEditingRaw(false);
  };

  if (editingRaw) {
    return (
      <div className="flex flex-col gap-1">
        <input
          autoFocus
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRaw}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRaw();
            if (e.key === 'Escape') {
              setDraft(row.bgpNeighborsRaw ?? '');
              setEditingRaw(false);
            }
          }}
          placeholder="10.0.0.1/65002, 10.0.0.2/65003"
          className="w-full rounded border border-blue-500/50 bg-slate-900 px-1 py-0.5 font-mono text-[10px] text-slate-100 outline-none focus:border-blue-400"
        />
        <span className="text-[9px] text-slate-500">
          Formato: ip/ASN-remoto, separados por vírgula
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[10px] text-slate-400 hover:text-slate-200"
          title={expanded ? 'Recolher peers' : 'Expandir peers'}
        >
          {expanded ? '▼' : '▶'}{' '}
          <span className={count === 0 ? 'text-slate-600 italic' : 'text-violet-300'}>
            {count === 0 ? 'sem peers' : `${count} peer${count > 1 ? 's' : ''}`}
          </span>
        </button>
        <button
          type="button"
          title="Editar neighbors"
          onClick={() => {
            setDraft(row.bgpNeighborsRaw ?? '');
            setEditingRaw(true);
          }}
          className="text-[9px] text-slate-600 hover:text-blue-400"
        >
          ✎
        </button>
      </div>
      {expanded && (row.bgpNeighborsParsed?.length ?? 0) > 0 && (
        <table className="mt-0.5 border-collapse">
          <thead>
            <tr className="text-[9px] text-slate-500">
              <th className="pr-2 text-left font-normal">Peer IP</th>
              <th className="text-left font-normal">ASN Remoto</th>
            </tr>
          </thead>
          <tbody>
            {row.bgpNeighborsParsed!.map((n, i) => (
              <tr key={i} className="text-[10px]">
                <td className="pr-2 font-mono text-slate-300">{n.ip || '—'}</td>
                <td className="font-mono text-violet-300">{n.remoteAsn || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Static row ────────────────────────────────────────────────────────────────
function StaticRow({ row }: { row: RoutingProtocolRow }) {
  return (
    <tr className="hover:bg-slate-800/40">
      <td className="border-b border-slate-800 px-2 py-1.5 text-[10px] text-sky-300">
        {row.siteName}
      </td>
      <td className="border-b border-slate-800 px-2 py-1.5 text-[10px] text-slate-300">
        {row.nodeLabel}
      </td>
      <td className="border-b border-slate-800 px-2 py-1.5">
        <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${MODE_CLASS[row.mode]}`}>
          {MODE_LABEL[row.mode]}
        </span>
      </td>
      <td
        colSpan={6}
        className="border-b border-slate-800 px-2 py-1.5 text-[10px] text-slate-600 italic"
      >
        Rotas configuradas manualmente — sem protocolo dinâmico
      </td>
    </tr>
  );
}

// ── OSPF row ──────────────────────────────────────────────────────────────────
function OspfRow({ row }: { row: RoutingProtocolRow }) {
  return (
    <tr className="hover:bg-slate-800/40">
      <td className="border-b border-slate-800 px-2 py-1.5 text-[10px] text-sky-300">
        {row.siteName}
      </td>
      <td className="border-b border-slate-800 px-2 py-1.5 text-[10px] text-slate-300">
        {row.nodeLabel}
      </td>
      <td className="border-b border-slate-800 px-2 py-1.5">
        <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${MODE_CLASS[row.mode]}`}>
          {MODE_LABEL[row.mode]}
        </span>
      </td>
      {/* Área */}
      <td className="border-b border-slate-800 px-2 py-1.5">
        <EditableCell
          nodeId={row.nodeId}
          fieldKey="ospfArea"
          value={row.ospfArea ?? '0.0.0.0'}
          placeholder="0.0.0.0"
        />
      </td>
      {/* Hello */}
      <td className="border-b border-slate-800 px-2 py-1.5">
        <EditableCell
          nodeId={row.nodeId}
          fieldKey="ospfHello"
          value={row.ospfHello ?? 10}
          numeric
        />
      </td>
      {/* Dead */}
      <td className="border-b border-slate-800 px-2 py-1.5">
        <EditableCell
          nodeId={row.nodeId}
          fieldKey="ospfDead"
          value={row.ospfDead ?? 40}
          numeric
        />
      </td>
      {/* BGP colunas — vazio */}
      <td colSpan={3} className="border-b border-slate-800 px-2 py-1.5 text-[10px] text-slate-700">
        —
      </td>
    </tr>
  );
}

// ── BGP row ───────────────────────────────────────────────────────────────────
function BgpRow({ row }: { row: RoutingProtocolRow }) {
  return (
    <tr className="hover:bg-slate-800/40">
      <td className="border-b border-slate-800 px-2 py-1.5 text-[10px] text-sky-300">
        {row.siteName}
      </td>
      <td className="border-b border-slate-800 px-2 py-1.5 text-[10px] text-slate-300">
        {row.nodeLabel}
      </td>
      <td className="border-b border-slate-800 px-2 py-1.5">
        <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${MODE_CLASS[row.mode]}`}>
          {MODE_LABEL[row.mode]}
        </span>
      </td>
      {/* OSPF colunas — vazio */}
      <td colSpan={3} className="border-b border-slate-800 px-2 py-1.5 text-[10px] text-slate-700">
        —
      </td>
      {/* ASN */}
      <td className="border-b border-slate-800 px-2 py-1.5">
        <EditableCell
          nodeId={row.nodeId}
          fieldKey="bgpAsn"
          value={row.bgpAsn ?? ''}
          placeholder="65001"
        />
      </td>
      {/* Neighbors */}
      <td className="border-b border-slate-800 px-2 py-1.5">
        <NeighborsCell row={row} />
      </td>
      {/* MD5 */}
      <td className="border-b border-slate-800 px-2 py-1.5">
        <BooleanCell nodeId={row.nodeId} fieldKey="bgpMd5" value={row.bgpMd5 ?? false} />
      </td>
    </tr>
  );
}

// ── Mixed row ─────────────────────────────────────────────────────────────────
function MixedRow({ row }: { row: RoutingProtocolRow }) {
  return (
    <tr className="hover:bg-slate-800/40">
      <td className="border-b border-slate-800 px-2 py-1.5 text-[10px] text-sky-300">
        {row.siteName}
      </td>
      <td className="border-b border-slate-800 px-2 py-1.5 text-[10px] text-slate-300">
        {row.nodeLabel}
      </td>
      <td className="border-b border-slate-800 px-2 py-1.5">
        <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${MODE_CLASS[row.mode]}`}>
          {MODE_LABEL[row.mode]}
        </span>
      </td>
      {/* OSPF */}
      <td className="border-b border-slate-800 px-2 py-1.5">
        <EditableCell nodeId={row.nodeId} fieldKey="ospfArea" value={row.ospfArea ?? '0.0.0.0'} placeholder="0.0.0.0" />
      </td>
      <td className="border-b border-slate-800 px-2 py-1.5">
        <EditableCell nodeId={row.nodeId} fieldKey="ospfHello" value={row.ospfHello ?? 10} numeric />
      </td>
      <td className="border-b border-slate-800 px-2 py-1.5">
        <EditableCell nodeId={row.nodeId} fieldKey="ospfDead" value={row.ospfDead ?? 40} numeric />
      </td>
      {/* BGP */}
      <td className="border-b border-slate-800 px-2 py-1.5">
        <EditableCell nodeId={row.nodeId} fieldKey="bgpAsn" value={row.bgpAsn ?? ''} placeholder="65001" />
      </td>
      <td className="border-b border-slate-800 px-2 py-1.5">
        <NeighborsCell row={row} />
      </td>
      <td className="border-b border-slate-800 px-2 py-1.5">
        <BooleanCell nodeId={row.nodeId} fieldKey="bgpMd5" value={row.bgpMd5 ?? false} />
      </td>
    </tr>
  );
}

// ── Prefix-list expansion row ─────────────────────────────────────────────────
function PrefixRow({ row }: { row: RoutingProtocolRow }) {
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);

  if (row.mode !== 'bgp' && row.mode !== 'mixed') return null;

  const hasPrefixes = !!(row.bgpPrefixListIn || row.bgpPrefixListOut);

  return (
    <>
      <tr>
        <td colSpan={9} className="border-b border-slate-800/60 p-0">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center gap-1 px-4 py-0.5 text-[9px] text-slate-600 hover:text-slate-400"
          >
            <span>{open ? '▼' : '▶'}</span>
            <span>
              Prefix-Lists{' '}
              {hasPrefixes ? (
                <span className="text-violet-400">configurados</span>
              ) : (
                <span className="italic">(não configurados)</span>
              )}
            </span>
          </button>
        </td>
      </tr>
      {open && (
        <tr className="bg-slate-800/20">
          <td colSpan={9} className="border-b border-slate-800 px-4 py-2">
            <div className="grid grid-cols-2 gap-3 text-[10px]">
              <div>
                <label className="mb-0.5 block text-[9px] text-slate-500">
                  Prefixos aceitos (IN)
                </label>
                <input
                  type="text"
                  defaultValue={row.bgpPrefixListIn ?? ''}
                  onBlur={(e) =>
                    dispatch(
                      updateNodeTechField({
                        id: row.nodeId,
                        key: 'bgpPrefixListIn',
                        value: e.target.value,
                      }),
                    )
                  }
                  placeholder="Ex: 10.100.0.0/16, 192.168.0.0/24"
                  className="w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-1 font-mono text-[10px] text-slate-100 placeholder-slate-600 outline-none focus:border-blue-500/50"
                />
              </div>
              <div>
                <label className="mb-0.5 block text-[9px] text-slate-500">
                  Prefixos anunciados (OUT)
                </label>
                <input
                  type="text"
                  defaultValue={row.bgpPrefixListOut ?? ''}
                  onBlur={(e) =>
                    dispatch(
                      updateNodeTechField({
                        id: row.nodeId,
                        key: 'bgpPrefixListOut',
                        value: e.target.value,
                      }),
                    )
                  }
                  placeholder="Ex: 172.16.0.0/16"
                  className="w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-1 font-mono text-[10px] text-slate-100 placeholder-slate-600 outline-none focus:border-blue-500/50"
                />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Warning row ───────────────────────────────────────────────────────────────
function WarningRow({ row }: { row: RoutingProtocolRow }) {
  if (row.warnings.length === 0) return null;
  return (
    <tr className="bg-amber-950/20">
      <td colSpan={9} className="border-b border-amber-900/30 px-4 py-0.5">
        {row.warnings.map((w) => (
          <span key={w} className="mr-3 text-[9px] text-amber-400">
            ⚠ {w}
          </span>
        ))}
      </td>
    </tr>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
type RoutingProtocolTableProps = {
  language: StudioLanguage;
};

export default function RoutingProtocolTable({
  language: _language,
}: RoutingProtocolTableProps) {
  const rows = useAppSelector(selectRoutingProtocolRows);
  const [filterMode, setFilterMode] = useState<string>('all');

  const filtered =
    filterMode === 'all' ? rows : rows.filter((r) => r.mode === filterMode);

  const hasOspf = rows.some((r) => r.mode === 'ospf' || r.mode === 'mixed');
  const hasBgp = rows.some((r) => r.mode === 'bgp' || r.mode === 'mixed');

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-300">
          Roteamento por Protocolo
        </h3>
        <div className="flex items-center gap-1">
          {(['all', 'static', 'ospf', 'bgp', 'mixed'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setFilterMode(m)}
              className={`rounded px-2 py-0.5 text-[9px] font-semibold transition ${
                filterMode === m
                  ? 'bg-teal-800/60 text-teal-200'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {m === 'all' ? 'Todos' : MODE_LABEL[m]}
            </button>
          ))}
        </div>
      </div>

      <div className="theme-scrollbar h-[280px] overflow-x-auto overflow-y-auto text-xs">
        {rows.length === 0 ? (
          <p className="px-1 py-3 text-[11px] text-slate-600 italic">
            Nenhum roteador configurado na topologia.
          </p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-[10px] text-slate-500">
                <th className="border-b border-slate-700 px-2 py-1 w-[100px]">Site</th>
                <th className="border-b border-slate-700 px-2 py-1 w-[90px]">Nó</th>
                <th className="border-b border-slate-700 px-2 py-1 w-[60px]">Modo</th>
                {/* OSPF */}
                <th
                  className={`border-b border-slate-700 px-2 py-1 w-[80px] ${!hasOspf ? 'text-slate-700' : 'text-blue-400/70'}`}
                  title="OSPF — Área"
                >
                  Área OSPF
                </th>
                <th
                  className={`border-b border-slate-700 px-2 py-1 w-[60px] ${!hasOspf ? 'text-slate-700' : 'text-blue-400/70'}`}
                  title="OSPF — Intervalo Hello (s)"
                >
                  Hello(s)
                </th>
                <th
                  className={`border-b border-slate-700 px-2 py-1 w-[60px] ${!hasOspf ? 'text-slate-700' : 'text-blue-400/70'}`}
                  title="OSPF — Intervalo Dead (s)"
                >
                  Dead(s)
                </th>
                {/* BGP */}
                <th
                  className={`border-b border-slate-700 px-2 py-1 w-[70px] ${!hasBgp ? 'text-slate-700' : 'text-violet-400/70'}`}
                  title="BGP — ASN Local"
                >
                  ASN Local
                </th>
                <th
                  className={`border-b border-slate-700 px-2 py-1 ${!hasBgp ? 'text-slate-700' : 'text-violet-400/70'}`}
                  title="BGP — Peers / Neighbors"
                >
                  Neighbors
                </th>
                <th
                  className={`border-b border-slate-700 px-2 py-1 w-[50px] ${!hasBgp ? 'text-slate-700' : 'text-violet-400/70'}`}
                  title="BGP — Autenticação MD5"
                >
                  MD5
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-2 py-2 text-[10px] text-slate-600 italic">
                    Nenhum roteador com modo "{filterMode}".
                  </td>
                </tr>
              )}
              {filtered.map((row) => (
                <>
                  {row.mode === 'static' && <StaticRow key={row.nodeId} row={row} />}
                  {row.mode === 'ospf' && <OspfRow key={row.nodeId} row={row} />}
                  {row.mode === 'bgp' && (
                    <>
                      <BgpRow key={row.nodeId} row={row} />
                      <PrefixRow key={`${row.nodeId}-pfx`} row={row} />
                    </>
                  )}
                  {row.mode === 'mixed' && (
                    <>
                      <MixedRow key={row.nodeId} row={row} />
                      <PrefixRow key={`${row.nodeId}-pfx`} row={row} />
                    </>
                  )}
                  <WarningRow key={`${row.nodeId}-warn`} row={row} />
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
