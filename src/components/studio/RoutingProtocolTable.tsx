import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { updateNodeTechField } from '../../features/network/networkSlice';
import { selectRoutingProtocolRows } from '../../features/network/selectors';
import type { RoutingProtocolRow } from '../../features/network/types';
import { buildNetworkAddress } from '../../features/network/utils';
import {
    MODE_CLASS,
    MODE_LABEL,
    parseNeighborDraft,
    serializeNeighborDraft,
    type NeighborDraftEntry,
    type RoutingProtocolTableProps,
} from './catalog';

// ── Inline editable cell ──────────────────────────────────────────────────────
function EditableCell({
  nodeId,
  fieldKey,
  value,
  placeholder,
  numeric,
}: {
  nodeId: string;
  fieldKey: string;
  value: string | number;
  placeholder?: string;
  numeric?: boolean;
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
      title={
        value
          ? 'Habilitado — clique para desabilitar'
          : 'Desabilitado — clique para habilitar'
      }
      onClick={() =>
        dispatch(
          updateNodeTechField({ id: nodeId, key: fieldKey, value: !value }),
        )
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
  const [draftNeighbors, setDraftNeighbors] = useState<NeighborDraftEntry[]>(
    parseNeighborDraft(row.bgpNeighborsRaw ?? ''),
  );
  const [candidateIp, setCandidateIp] = useState<string>('__custom__');
  const [customIp, setCustomIp] = useState('');
  const [draftRemoteAsn, setDraftRemoteAsn] = useState('');

  const count = row.bgpNeighborsParsed?.length ?? 0;
  const candidates = row.bgpNeighborCandidates ?? [];

  const commitRaw = () => {
    dispatch(
      updateNodeTechField({
        id: row.nodeId,
        key: 'bgpNeighbors',
        value: serializeNeighborDraft(draftNeighbors),
      }),
    );
    setEditingRaw(false);
  };

  const addNeighbor = () => {
    const selectedIp =
      candidateIp === '__custom__' ? customIp.trim() : candidateIp;
    const remoteAsn = draftRemoteAsn.trim();
    if (!selectedIp) return;

    setDraftNeighbors((prev) => {
      const idx = prev.findIndex((entry) => entry.ip === selectedIp);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          remoteAsn: remoteAsn || next[idx].remoteAsn,
        };
        return next;
      }

      return [...prev, { ip: selectedIp, remoteAsn }];
    });

    setDraftRemoteAsn('');
    if (candidateIp === '__custom__') {
      setCustomIp('');
    }
  };

  const removeNeighbor = (index: number) => {
    setDraftNeighbors((prev) => prev.filter((_, idx) => idx !== index));
  };

  if (editingRaw) {
    return (
      <div className="flex flex-col gap-1">
        <div className="grid grid-cols-[minmax(110px,1fr)_85px_auto] gap-1">
          <select
            value={candidateIp}
            onChange={(e) => {
              const nextIp = e.target.value;
              setCandidateIp(nextIp);
              if (nextIp !== '__custom__') {
                const selected = candidates.find((item) => item.ip === nextIp);
                setDraftRemoteAsn(selected?.remoteAsn ?? '');
              }
            }}
            className="rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-[10px] text-slate-100"
          >
            {candidates.map((candidate) => (
              <option key={`${row.nodeId}-${candidate.nodeId}`} value={candidate.ip}>
                {candidate.ip} - {candidate.nodeLabel}
              </option>
            ))}
            <option value="__custom__">Outro IP...</option>
          </select>
          <input
            type="text"
            value={draftRemoteAsn}
            onChange={(e) => setDraftRemoteAsn(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addNeighbor();
            }}
            placeholder="ASN"
            className="rounded border border-slate-700 bg-slate-900 px-1 py-0.5 font-mono text-[10px] text-slate-100 outline-none focus:border-violet-400"
          />
          <button
            type="button"
            onClick={addNeighbor}
            className="rounded border border-violet-600/60 bg-violet-900/40 px-1 py-0.5 text-[9px] font-semibold text-violet-200 hover:bg-violet-800/50"
          >
            + Peer
          </button>
        </div>

        {candidateIp === '__custom__' && (
          <input
            autoFocus
            type="text"
            value={customIp}
            onChange={(e) => setCustomIp(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addNeighbor();
            }}
            placeholder="IP do neighbor"
            className="w-full rounded border border-blue-500/50 bg-slate-900 px-1 py-0.5 font-mono text-[10px] text-slate-100 outline-none focus:border-blue-400"
          />
        )}

        <div className="max-h-20 space-y-0.5 overflow-y-auto rounded border border-slate-800/70 bg-slate-950/40 p-1">
          {draftNeighbors.length === 0 ? (
            <div className="text-[9px] italic text-slate-600">
              Sem peers adicionados.
            </div>
          ) : (
            draftNeighbors.map((entry, index) => (
              <div
                key={`${entry.ip}-${index}`}
                className="flex items-center justify-between gap-1 text-[10px]"
              >
                <span className="min-w-0 truncate font-mono text-slate-300">
                  {entry.ip}
                  <span className="text-violet-300">
                    {entry.remoteAsn ? ` / ${entry.remoteAsn}` : ''}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => removeNeighbor(index)}
                  className="rounded px-1 text-[9px] text-rose-300 hover:bg-rose-900/40"
                >
                  x
                </button>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={() => {
              setDraftNeighbors(parseNeighborDraft(row.bgpNeighborsRaw ?? ''));
              setEditingRaw(false);
            }}
            className="rounded border border-slate-700 px-1.5 py-0.5 text-[9px] text-slate-400 hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={commitRaw}
            className="rounded border border-emerald-700/60 bg-emerald-900/40 px-1.5 py-0.5 text-[9px] text-emerald-300 hover:bg-emerald-800/50"
          >
            Salvar
          </button>
        </div>
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
          <span
            className={
              count === 0 ? 'text-slate-600 italic' : 'text-violet-300'
            }
          >
            {count === 0 ? 'sem peers' : `${count} peer${count > 1 ? 's' : ''}`}
          </span>
        </button>
        <button
          type="button"
          title="Editar neighbors"
          onClick={() => {
            const initial = parseNeighborDraft(row.bgpNeighborsRaw ?? '');
            const firstCandidate = candidates[0];
            setDraftNeighbors(initial);
            setCandidateIp(firstCandidate?.ip ?? '__custom__');
            setCustomIp('');
            setDraftRemoteAsn(firstCandidate?.remoteAsn ?? '');
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
                <td className="font-mono text-violet-300">
                  {n.remoteAsn || '—'}
                </td>
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
        <span
          className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${MODE_CLASS[row.mode]}`}
        >
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
        <span
          className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${MODE_CLASS[row.mode]}`}
        >
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
      <td
        colSpan={3}
        className="border-b border-slate-800 px-2 py-1.5 text-[10px] text-slate-700"
      >
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
        <span
          className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${MODE_CLASS[row.mode]}`}
        >
          {MODE_LABEL[row.mode]}
        </span>
      </td>
      {/* OSPF colunas — vazio */}
      <td
        colSpan={3}
        className="border-b border-slate-800 px-2 py-1.5 text-[10px] text-slate-700"
      >
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
        <BooleanCell
          nodeId={row.nodeId}
          fieldKey="bgpMd5"
          value={row.bgpMd5 ?? false}
        />
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
        <span
          className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${MODE_CLASS[row.mode]}`}
        >
          {MODE_LABEL[row.mode]}
        </span>
      </td>
      {/* OSPF */}
      <td className="border-b border-slate-800 px-2 py-1.5">
        <EditableCell
          nodeId={row.nodeId}
          fieldKey="ospfArea"
          value={row.ospfArea ?? '0.0.0.0'}
          placeholder="0.0.0.0"
        />
      </td>
      <td className="border-b border-slate-800 px-2 py-1.5">
        <EditableCell
          nodeId={row.nodeId}
          fieldKey="ospfHello"
          value={row.ospfHello ?? 10}
          numeric
        />
      </td>
      <td className="border-b border-slate-800 px-2 py-1.5">
        <EditableCell
          nodeId={row.nodeId}
          fieldKey="ospfDead"
          value={row.ospfDead ?? 40}
          numeric
        />
      </td>
      {/* BGP */}
      <td className="border-b border-slate-800 px-2 py-1.5">
        <EditableCell
          nodeId={row.nodeId}
          fieldKey="bgpAsn"
          value={row.bgpAsn ?? ''}
          placeholder="65001"
        />
      </td>
      <td className="border-b border-slate-800 px-2 py-1.5">
        <NeighborsCell row={row} />
      </td>
      <td className="border-b border-slate-800 px-2 py-1.5">
        <BooleanCell
          nodeId={row.nodeId}
          fieldKey="bgpMd5"
          value={row.bgpMd5 ?? false}
        />
      </td>
    </tr>
  );
}

// ── Prefix-list expansion row ─────────────────────────────────────────────────
function PrefixRow({ row }: { row: RoutingProtocolRow }) {
  const dispatch = useAppDispatch();
  const { sites, siteNetworks } = useAppSelector((state) => state.network);
  const [open, setOpen] = useState(false);
  const [draftIn, setDraftIn] = useState('');
  const [draftOut, setDraftOut] = useState('');

  const suggestedInList = Array.from(
    new Set(
      (() => {
        const remoteNetworks = siteNetworks
          .filter((network) => network.siteId !== row.siteId)
          .map((network) => {
            const networkSite = sites.find((item) => item.id === network.siteId);
            const networkAddress = buildNetworkAddress(
              network.addressFamily,
              network.thirdOctet,
              networkSite?.ipOctet,
            );
            return `${networkAddress}/${network.cidr}`;
          });

        if (remoteNetworks.length > 0) {
          return remoteNetworks;
        }

        return (row.bgpNeighborCandidates ?? [])
          .map((peer) => peer.ip?.trim())
          .filter((ip): ip is string => Boolean(ip))
          .map((ip) => `${ip}/32`);
      })(),
    ),
  );

  const site = sites.find((item) => item.id === row.siteId);
  const suggestedOutList = Array.from(
    new Set(
      siteNetworks
        .filter((network) => network.siteId === row.siteId)
        .map((network) => {
          const networkAddress = buildNetworkAddress(
            network.addressFamily,
            network.thirdOctet,
            site?.ipOctet,
          );
          return `${networkAddress}/${network.cidr}`;
        }),
    ),
  );

  const suggestedInValue = suggestedInList.join(', ');
  const suggestedOutValue = suggestedOutList.join(', ');

  useEffect(() => {
    setDraftIn((row.bgpPrefixListIn ?? '').trim() || suggestedInValue);
  }, [row.bgpPrefixListIn, suggestedInValue]);

  useEffect(() => {
    setDraftOut((row.bgpPrefixListOut ?? '').trim() || suggestedOutValue);
  }, [row.bgpPrefixListOut, suggestedOutValue]);

  const prefixesIn = (row.bgpPrefixListIn ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');
  const prefixesOut = (row.bgpPrefixListOut ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');
  const hasConfiguredPrefixes = prefixesIn.length > 0 || prefixesOut.length > 0;
  const hasSuggestedPrefixes = suggestedInList.length > 0 || suggestedOutList.length > 0;

  const commitPrefix = (key: 'bgpPrefixListIn' | 'bgpPrefixListOut', raw: string) => {
    dispatch(
      updateNodeTechField({
        id: row.nodeId,
        key,
        value: raw.trim(),
      }),
    );
  };

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
              Prefix-Lists (opcional){' '}
              {hasConfiguredPrefixes ? (
                <span className="text-violet-400">configurados</span>
              ) : hasSuggestedPrefixes ? (
                <span className="text-cyan-300">sugeridos</span>
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
                  value={draftIn}
                  onChange={(event) => setDraftIn(event.target.value)}
                  onBlur={() => commitPrefix('bgpPrefixListIn', draftIn)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      commitPrefix('bgpPrefixListIn', draftIn);
                    }
                  }}
                  placeholder={suggestedInValue || 'Ex: 10.10.0.0/16, 172.16.20.0/24'}
                  className="w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-1 font-mono text-[10px] text-slate-100 placeholder-slate-600 outline-none focus:border-blue-500/50"
                />
                {suggestedInValue && !row.bgpPrefixListIn?.trim() && (
                  <p className="mt-0.5 text-[9px] text-cyan-300">
                    Sugestão inicial aplicada automaticamente.
                  </p>
                )}
              </div>
              <div>
                <label className="mb-0.5 block text-[9px] text-slate-500">
                  Prefixos anunciados (OUT)
                </label>
                <input
                  type="text"
                  value={draftOut}
                  onChange={(event) => setDraftOut(event.target.value)}
                  onBlur={() => commitPrefix('bgpPrefixListOut', draftOut)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      commitPrefix('bgpPrefixListOut', draftOut);
                    }
                  }}
                  placeholder={suggestedOutValue || 'Ex: 200.30.1.0/24'}
                  className="w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-1 font-mono text-[10px] text-slate-100 placeholder-slate-600 outline-none focus:border-blue-500/50"
                />
                {suggestedOutValue && !row.bgpPrefixListOut?.trim() && (
                  <p className="mt-0.5 text-[9px] text-cyan-300">
                    Sugestão inicial aplicada automaticamente.
                  </p>
                )}
              </div>
            </div>
            <p className="mt-1 text-[9px] text-slate-600">
              Prefix-list é opcional e aceita edição livre por lista CSV.
            </p>
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
                <th className="border-b border-slate-700 px-2 py-1 w-[100px]">
                  Site
                </th>
                <th className="border-b border-slate-700 px-2 py-1 w-[90px]">
                  Nó
                </th>
                <th className="border-b border-slate-700 px-2 py-1 w-[60px]">
                  Modo
                </th>
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
                  <td
                    colSpan={9}
                    className="px-2 py-2 text-[10px] text-slate-600 italic"
                  >
                    Nenhum roteador com modo "{filterMode}".
                  </td>
                </tr>
              )}
              {filtered.map((row) => (
                <>
                  {row.mode === 'static' && (
                    <StaticRow key={row.nodeId} row={row} />
                  )}
                  {row.mode === 'ospf' && (
                    <OspfRow key={row.nodeId} row={row} />
                  )}
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
