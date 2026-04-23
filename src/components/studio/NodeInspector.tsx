import { useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  setInspectorNodeId,
  updateNode,
} from '../../features/network/networkSlice';
import { getNodeVisual, parseVlans } from './catalog';

export default function NodeInspector() {
  const dispatch = useAppDispatch();
  const { nodes, ui } = useAppSelector((state) => state.network);
  const node = useMemo(
    () => nodes.find((item) => item.id === ui.inspectorNodeId) ?? null,
    [nodes, ui.inspectorNodeId],
  );

  if (!node) return null;

  const isWan = node.category === 'wan';
  const visual = getNodeVisual(node.category);

  return (
    <div className="absolute right-4 top-4 z-10 w-[340px] rounded-xl border border-[#3a5b83] bg-[#09162a]/95 p-3 shadow-[0_20px_40px_rgba(0,0,0,0.45)] backdrop-blur">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">
            Detalhes do Ícone
          </div>
          <h3 className="mt-1 text-sm font-semibold text-slate-100">
            [{visual.short}] {visual.label}
          </h3>
        </div>
        <button
          onClick={() => dispatch(setInspectorNodeId(null))}
          className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-[10px] font-bold uppercase"
        >
          Fechar
        </button>
      </div>

      <div className="mb-3 rounded-md border border-[#2a4565] bg-[#0c1c33] px-2 py-1 text-[11px] text-slate-300">
        <span className="mr-2 text-sky-300">ID:</span>
        {node.id}
      </div>

      <div className="space-y-2 text-xs">
        <label className="block">
          <span className="mb-1 block text-slate-400">Nome do dispositivo</span>
          <input
            value={node.label}
            onChange={(event) =>
              dispatch(
                updateNode({
                  id: node.id,
                  changes: { label: event.target.value },
                }),
              )
            }
            className="w-full rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1.5 text-slate-100"
          />
        </label>

        {!isWan && (
          <>
            <label className="block">
              <span className="mb-1 block text-slate-400">IPv4</span>
              <input
                value={node.ip}
                onChange={(event) =>
                  dispatch(
                    updateNode({
                      id: node.id,
                      changes: { ip: event.target.value },
                    }),
                  )
                }
                className="w-full rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1.5 text-slate-100"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-slate-400">CIDR</span>
              <input
                type="number"
                min={1}
                max={32}
                value={node.cidr}
                onChange={(event) =>
                  dispatch(
                    updateNode({
                      id: node.id,
                      changes: { cidr: Number(event.target.value) },
                    }),
                  )
                }
                className="w-full rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1.5 text-slate-100"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-slate-400">VLANs (csv)</span>
              <input
                value={node.vlans.join(',')}
                placeholder="Sem VLAN atribuida"
                onChange={(event) =>
                  dispatch(
                    updateNode({
                      id: node.id,
                      changes: { vlans: parseVlans(event.target.value) },
                    }),
                  )
                }
                className="w-full rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1.5 text-slate-100"
              />
              {node.vlans.length === 0 && (
                <span className="mt-1 block text-[11px] text-slate-400">
                  Sem VLAN atribuida ao objeto.
                </span>
              )}
            </label>
          </>
        )}

        {isWan && (
          <div className="rounded-md border border-[#35567f] bg-[#0d1a2e] px-2 py-2 text-[11px] text-slate-300">
            WAN/Internet nao possui atribuicao de IP local no Studio.
          </div>
        )}

        <label className="block">
          <span className="mb-1 block text-slate-400">Descrição/Função</span>
          <textarea
            value={node.description}
            onChange={(event) =>
              dispatch(
                updateNode({
                  id: node.id,
                  changes: { description: event.target.value },
                }),
              )
            }
            className="h-20 w-full rounded border border-[#35567f] bg-[#0d1a2e] px-2 py-1.5 text-slate-100"
          />
        </label>
      </div>
    </div>
  );
}
