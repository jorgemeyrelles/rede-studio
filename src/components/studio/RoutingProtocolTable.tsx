import { AlertTriangle, ChevronDown, ChevronRight, Pencil } from 'lucide-react';
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
import { ui as studioUi } from './utils/studioUi';

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
        className="w-full rounded-sm border border-line-strong bg-ink px-1 py-0.5 font-mono text-2xs text-chalk outline-none focus:border-accent"
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
      className={`inline-block cursor-pointer rounded-sm px-1 py-0.5 font-mono text-2xs hover:bg-ink-raised-2 ${
        String(value) ? 'text-chalk' : 'text-chalk-faint italic'
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
      className={`rounded-sm px-1.5 py-0.5 text-2xs font-semibold transition ${
        value
          ? 'bg-signal-up/15 text-signal-up hover:bg-signal-down/15 hover:text-signal-down'
          : 'bg-ink-raised-2 text-chalk-faint hover:bg-signal-up/15 hover:text-signal-up'
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
            className="rounded-sm border border-line bg-ink px-1 py-0.5 text-2xs text-chalk"
          >
            {candidates.map((candidate) => (
              <option
                key={`${row.nodeId}-${candidate.nodeId}`}
                value={candidate.ip}
              >
                {candidate.ip} - {candidate.nodeLabel}
              </option>
            ))}
            <option value="__custom__">{studioUi().otherIp}</option>
          </select>
          <input
            type="text"
            value={draftRemoteAsn}
            onChange={(e) => setDraftRemoteAsn(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addNeighbor();
            }}
            placeholder="ASN"
            className="rounded-sm border border-line bg-ink px-1 py-0.5 font-mono text-2xs text-chalk outline-none focus:border-route-vpn/60"
          />
          <button
            type="button"
            onClick={addNeighbor}
            className="rounded-sm border border-route-vpn/60 bg-route-vpn/15 px-1 py-0.5 text-2xs font-semibold text-route-vpn hover:bg-route-vpn/15"
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
            className="w-full rounded-sm border border-line-strong bg-ink px-1 py-0.5 font-mono text-2xs text-chalk outline-none focus:border-accent"
          />
        )}

        <div className="max-h-20 space-y-0.5 overflow-y-auto rounded-sm border border-line bg-ink/40 p-1">
          {draftNeighbors.length === 0 ? (
            <div className="text-2xs italic text-chalk-faint">
              {studioUi().noPeers}
            </div>
          ) : (
            draftNeighbors.map((entry, index) => (
              <div
                key={`${entry.ip}-${index}`}
                className="flex items-center justify-between gap-1 text-2xs"
              >
                <span className="min-w-0 truncate font-mono text-chalk-dim">
                  {entry.ip}
                  <span className="text-route-vpn">
                    {entry.remoteAsn ? ` / ${entry.remoteAsn}` : ''}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => removeNeighbor(index)}
                  className="rounded-sm px-1 text-2xs text-signal-down hover:bg-signal-down/15"
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
            className="rounded-sm border border-line px-1.5 py-0.5 text-2xs text-chalk-dim hover:bg-ink-raised-2"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={commitRaw}
            className="rounded-sm border border-signal-up/40 bg-signal-up/15 px-1.5 py-0.5 text-2xs text-signal-up hover:bg-signal-up/15"
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
          className="text-2xs text-chalk-dim hover:text-chalk"
          title={expanded ? 'Recolher peers' : 'Expandir peers'}
        >
          {expanded ? (
            <ChevronDown
              size={12}
              aria-hidden="true"
              className="inline-block"
            />
          ) : (
            <ChevronRight
              size={12}
              aria-hidden="true"
              className="inline-block"
            />
          )}{' '}
          <span
            className={
              count === 0 ? 'text-chalk-faint italic' : 'text-route-vpn'
            }
          >
            {count === 0 ? 'sem peers' : `${count} peer${count > 1 ? 's' : ''}`}
          </span>
        </button>
        <button
          type="button"
          title={studioUi().editNeighbors}
          onClick={() => {
            const initial = parseNeighborDraft(row.bgpNeighborsRaw ?? '');
            const firstCandidate = candidates[0];
            setDraftNeighbors(initial);
            setCandidateIp(firstCandidate?.ip ?? '__custom__');
            setCustomIp('');
            setDraftRemoteAsn(firstCandidate?.remoteAsn ?? '');
            setEditingRaw(true);
          }}
          aria-label={studioUi().editNeighbors}
          className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-chalk-faint hover:text-accent"
        >
          <Pencil size={12} aria-hidden="true" />
        </button>
      </div>
      {expanded && (row.bgpNeighborsParsed?.length ?? 0) > 0 && (
        <table className="mt-0.5 border-collapse">
          <thead>
            <tr className="text-2xs text-chalk-faint">
              <th className="pr-2 text-left font-normal">Peer IP</th>
              <th className="text-left font-normal">ASN Remoto</th>
            </tr>
          </thead>
          <tbody>
            {row.bgpNeighborsParsed!.map((n, i) => (
              <tr key={i} className="text-2xs">
                <td className="pr-2 font-mono text-chalk-dim">{n.ip || '—'}</td>
                <td className="font-mono text-route-vpn">
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
    <tr className="hover:bg-ink-raised-2">
      <td className="border-b border-line px-2 py-1.5 text-2xs text-chalk">
        {row.siteName}
      </td>
      <td className="border-b border-line px-2 py-1.5 text-2xs text-chalk-dim">
        {row.nodeLabel}
      </td>
      <td className="border-b border-line px-2 py-1.5">
        <span
          className={`rounded-sm px-1.5 py-0.5 text-2xs font-semibold ${MODE_CLASS[row.mode]}`}
        >
          {MODE_LABEL[row.mode]}
        </span>
      </td>
      <td
        colSpan={6}
        className="border-b border-line px-2 py-1.5 text-2xs text-chalk-faint italic"
      >
        {studioUi().staticRoutesHint}
      </td>
    </tr>
  );
}

// ── OSPF row ──────────────────────────────────────────────────────────────────
function OspfRow({ row }: { row: RoutingProtocolRow }) {
  return (
    <tr className="hover:bg-ink-raised-2">
      <td className="border-b border-line px-2 py-1.5 text-2xs text-chalk">
        {row.siteName}
      </td>
      <td className="border-b border-line px-2 py-1.5 text-2xs text-chalk-dim">
        {row.nodeLabel}
      </td>
      <td className="border-b border-line px-2 py-1.5">
        <span
          className={`rounded-sm px-1.5 py-0.5 text-2xs font-semibold ${MODE_CLASS[row.mode]}`}
        >
          {MODE_LABEL[row.mode]}
        </span>
      </td>
      {/* Área */}
      <td className="border-b border-line px-2 py-1.5">
        <EditableCell
          nodeId={row.nodeId}
          fieldKey="ospfArea"
          value={row.ospfArea ?? '0.0.0.0'}
          placeholder="0.0.0.0"
        />
      </td>
      {/* Hello */}
      <td className="border-b border-line px-2 py-1.5">
        <EditableCell
          nodeId={row.nodeId}
          fieldKey="ospfHello"
          value={row.ospfHello ?? 10}
          numeric
        />
      </td>
      {/* Dead */}
      <td className="border-b border-line px-2 py-1.5">
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
        className="border-b border-line px-2 py-1.5 text-2xs text-chalk-faint"
      >
        —
      </td>
    </tr>
  );
}

// ── BGP row ───────────────────────────────────────────────────────────────────
function BgpRow({ row }: { row: RoutingProtocolRow }) {
  return (
    <tr className="hover:bg-ink-raised-2">
      <td className="border-b border-line px-2 py-1.5 text-2xs text-chalk">
        {row.siteName}
      </td>
      <td className="border-b border-line px-2 py-1.5 text-2xs text-chalk-dim">
        {row.nodeLabel}
      </td>
      <td className="border-b border-line px-2 py-1.5">
        <span
          className={`rounded-sm px-1.5 py-0.5 text-2xs font-semibold ${MODE_CLASS[row.mode]}`}
        >
          {MODE_LABEL[row.mode]}
        </span>
      </td>
      {/* OSPF colunas — vazio */}
      <td
        colSpan={3}
        className="border-b border-line px-2 py-1.5 text-2xs text-chalk-faint"
      >
        —
      </td>
      {/* ASN */}
      <td className="border-b border-line px-2 py-1.5">
        <EditableCell
          nodeId={row.nodeId}
          fieldKey="bgpAsn"
          value={row.bgpAsn ?? ''}
          placeholder="65001"
        />
      </td>
      {/* Neighbors */}
      <td className="border-b border-line px-2 py-1.5">
        <NeighborsCell row={row} />
      </td>
      {/* MD5 */}
      <td className="border-b border-line px-2 py-1.5">
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
    <tr className="hover:bg-ink-raised-2">
      <td className="border-b border-line px-2 py-1.5 text-2xs text-chalk">
        {row.siteName}
      </td>
      <td className="border-b border-line px-2 py-1.5 text-2xs text-chalk-dim">
        {row.nodeLabel}
      </td>
      <td className="border-b border-line px-2 py-1.5">
        <span
          className={`rounded-sm px-1.5 py-0.5 text-2xs font-semibold ${MODE_CLASS[row.mode]}`}
        >
          {MODE_LABEL[row.mode]}
        </span>
      </td>
      {/* OSPF */}
      <td className="border-b border-line px-2 py-1.5">
        <EditableCell
          nodeId={row.nodeId}
          fieldKey="ospfArea"
          value={row.ospfArea ?? '0.0.0.0'}
          placeholder="0.0.0.0"
        />
      </td>
      <td className="border-b border-line px-2 py-1.5">
        <EditableCell
          nodeId={row.nodeId}
          fieldKey="ospfHello"
          value={row.ospfHello ?? 10}
          numeric
        />
      </td>
      <td className="border-b border-line px-2 py-1.5">
        <EditableCell
          nodeId={row.nodeId}
          fieldKey="ospfDead"
          value={row.ospfDead ?? 40}
          numeric
        />
      </td>
      {/* BGP */}
      <td className="border-b border-line px-2 py-1.5">
        <EditableCell
          nodeId={row.nodeId}
          fieldKey="bgpAsn"
          value={row.bgpAsn ?? ''}
          placeholder="65001"
        />
      </td>
      <td className="border-b border-line px-2 py-1.5">
        <NeighborsCell row={row} />
      </td>
      <td className="border-b border-line px-2 py-1.5">
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
            const networkSite = sites.find(
              (item) => item.id === network.siteId,
            );
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
  const hasSuggestedPrefixes =
    suggestedInList.length > 0 || suggestedOutList.length > 0;

  const commitPrefix = (
    key: 'bgpPrefixListIn' | 'bgpPrefixListOut',
    raw: string,
  ) => {
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
        <td colSpan={9} className="border-b border-line p-0">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center gap-1 px-4 py-0.5 text-2xs text-chalk-faint hover:text-chalk-dim"
          >
            <span>
              {open ? (
                <ChevronDown size={12} aria-hidden="true" />
              ) : (
                <ChevronRight size={12} aria-hidden="true" />
              )}
            </span>
            <span>
              Prefix-Lists (opcional){' '}
              {hasConfiguredPrefixes ? (
                <span className="text-route-vpn">configurados</span>
              ) : hasSuggestedPrefixes ? (
                <span className="text-chalk">sugeridos</span>
              ) : (
                <span className="italic">{studioUi().notConfigured}</span>
              )}
            </span>
          </button>
        </td>
      </tr>
      {open && (
        <tr className="bg-ink-raised-2">
          <td colSpan={9} className="border-b border-line px-4 py-2">
            <div className="grid grid-cols-2 gap-3 text-2xs">
              <div>
                <label className="mb-0.5 block text-2xs text-chalk-faint">
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
                  placeholder={
                    suggestedInValue || 'Ex: 10.10.0.0/16, 172.16.20.0/24'
                  }
                  className="w-full rounded-sm border border-line bg-ink px-1.5 py-1 font-mono text-2xs text-chalk placeholder-chalk-faint outline-none focus:border-accent/60"
                />
                {suggestedInValue && !row.bgpPrefixListIn?.trim() && (
                  <p className="mt-0.5 text-2xs text-chalk">
                    {studioUi().initialSuggestionApplied}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-0.5 block text-2xs text-chalk-faint">
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
                  className="w-full rounded-sm border border-line bg-ink px-1.5 py-1 font-mono text-2xs text-chalk placeholder-chalk-faint outline-none focus:border-accent/60"
                />
                {suggestedOutValue && !row.bgpPrefixListOut?.trim() && (
                  <p className="mt-0.5 text-2xs text-chalk">
                    {studioUi().initialSuggestionApplied}
                  </p>
                )}
              </div>
            </div>
            <p className="mt-1 text-2xs text-chalk-faint">
              {studioUi().prefixListHint}
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
    <tr className="bg-signal-warn/10">
      <td colSpan={9} className="border-b border-signal-warn/40 px-4 py-0.5">
        {row.warnings.map((w) => (
          <span key={w} className="mr-3 text-2xs text-signal-warn">
            <AlertTriangle
              size={12}
              className="mr-1 inline-block -translate-y-px"
              aria-hidden="true"
            />
            {w}
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
    <div className="rounded-md border border-line bg-ink/70 p-3">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-display text-heading font-semibold text-chalk">
          Roteamento por Protocolo
        </h3>
        <div className="flex items-center gap-1">
          {(['all', 'static', 'ospf', 'bgp', 'mixed'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setFilterMode(m)}
              className={`rounded-sm px-2 py-0.5 text-2xs font-semibold transition ${
                filterMode === m
                  ? 'bg-accent/15 text-chalk'
                  : 'text-chalk-faint hover:text-chalk-dim'
              }`}
            >
              {m === 'all' ? 'Todos' : MODE_LABEL[m]}
            </button>
          ))}
        </div>
      </div>

      <div className="theme-scrollbar h-[280px] overflow-x-auto overflow-y-auto text-xs">
        {rows.length === 0 ? (
          <p className="px-1 py-3 text-2xs text-chalk-faint italic">
            Nenhum roteador configurado na topologia.
          </p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-2xs text-chalk-faint">
                <th className="border-b border-line px-2 py-1 w-[100px]">
                  Site
                </th>
                <th className="border-b border-line px-2 py-1 w-[90px]">Nó</th>
                <th className="border-b border-line px-2 py-1 w-[60px]">
                  Modo
                </th>
                {/* OSPF */}
                <th
                  className={`border-b border-line px-2 py-1 w-[80px] ${!hasOspf ? 'text-chalk-faint' : 'text-accent'}`}
                  title="OSPF — Área"
                >
                  Área OSPF
                </th>
                <th
                  className={`border-b border-line px-2 py-1 w-[60px] ${!hasOspf ? 'text-chalk-faint' : 'text-accent'}`}
                  title="OSPF — Intervalo Hello (s)"
                >
                  Hello(s)
                </th>
                <th
                  className={`border-b border-line px-2 py-1 w-[60px] ${!hasOspf ? 'text-chalk-faint' : 'text-accent'}`}
                  title="OSPF — Intervalo Dead (s)"
                >
                  Dead(s)
                </th>
                {/* BGP */}
                <th
                  className={`border-b border-line px-2 py-1 w-[70px] ${!hasBgp ? 'text-chalk-faint' : 'text-route-vpn'}`}
                  title="BGP — ASN Local"
                >
                  ASN Local
                </th>
                <th
                  className={`border-b border-line px-2 py-1 ${!hasBgp ? 'text-chalk-faint' : 'text-route-vpn'}`}
                  title="BGP — Peers / Neighbors"
                >
                  Neighbors
                </th>
                <th
                  className={`border-b border-line px-2 py-1 w-[50px] ${!hasBgp ? 'text-chalk-faint' : 'text-route-vpn'}`}
                  title={studioUi().bgpMd5Auth}
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
                    className="px-2 py-2 text-2xs text-chalk-faint italic"
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
