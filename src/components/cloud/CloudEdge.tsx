import {
  BaseEdge,
  EdgeLabelRenderer,
  type Edge,
  type EdgeProps,
} from '@xyflow/react';
import { useAppDispatch } from '../../app/hooks';
import { selectCloudConnection } from '../../features/cloud/cloudSlice';
import type { ConnectionKind } from '../../features/cloud/engines/connections';
import {
  arrowHead,
  polylinePath,
  type LabelPlacement,
  type Point,
} from '../../features/cloud/edgeGeometry';

/**
 * Tipo visual: as conexões do usuário, uma rota implícita (IGW, NAT,
 * endpoint) ou uma associação de configuração (WAF, certificado, DNS).
 */
export type CloudEdgeKind = ConnectionKind | 'route' | 'link';

export type CloudEdgeData = {
  /** Rota ortogonal já calculada pelo canvas (ver `canvasEdges.ts`). */
  points: Point[];
  kind: CloudEdgeKind;
  arrowStart: boolean;
  arrowEnd: boolean;
  /** Rota implícita: só leitura, não seleciona nem exclui. */
  derived: boolean;
  tone?: 'warn';
  label: (LabelPlacement & { text: string }) | null;
  /** Problema da conexão (porta inválida, destino sem SG). */
  issue: string | null;
};

export type CloudEdgeType = Edge<CloudEdgeData, 'cloudEdge'>;

/**
 * Aresta do canvas cloud: rota ortogonal com cantos arredondados e pontas de
 * seta desenhadas aqui (não pelos marcadores do React Flow), então ida e
 * volta mostram as duas pontas em qualquer cor. Rótulo é botão: seleciona a
 * conexão (alvo de clique maior que a linha).
 */
export default function CloudEdge({
  id,
  data,
  selected,
}: EdgeProps<CloudEdgeType>) {
  const dispatch = useAppDispatch();
  if (!data || data.points.length < 2) return null;
  const { points, label } = data;
  const n = points.length;
  const tone = `cloud-edge-${data.kind} ${selected ? 'is-selected' : ''} ${data.issue || data.tone === 'warn' ? 'has-issue' : ''}`;
  return (
    <>
      <BaseEdge
        id={id}
        path={polylinePath(points)}
        interactionWidth={data.derived ? 0 : 14}
        className={`cloud-edge ${tone} ${data.derived ? 'is-derived' : ''}`}
      />
      {data.arrowEnd && (
        <polygon
          points={arrowHead(points[n - 2], points[n - 1])}
          className={`cloud-edge-arrow ${tone}`}
        />
      )}
      {data.arrowStart && (
        <polygon
          points={arrowHead(points[1], points[0])}
          className={`cloud-edge-arrow ${tone}`}
        />
      )}
      {label && (
        <EdgeLabelRenderer>
          <button
            type="button"
            onClick={() => dispatch(selectCloudConnection(id))}
            title={data.issue ?? undefined}
            className={`cloud-edge-label nodrag nopan ${selected ? 'is-selected' : ''} ${data.issue ? 'has-issue' : ''} ${
              label.collides ? 'is-crowded' : ''
            }`}
            style={{
              transform: `translate(-50%, -50%) translate(${label.x}px, ${label.y}px)`,
            }}
          >
            {label.text}
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const cloudEdgeTypes = { cloudEdge: CloudEdge };
