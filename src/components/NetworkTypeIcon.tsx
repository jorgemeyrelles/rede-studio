import { Cloud, Cloudy, Combine, Server, type LucideProps } from 'lucide-react';
import type { ProjectNetworkType } from '../features/projects/types';

const ICONS: Record<ProjectNetworkType, typeof Server> = {
  ON_PREMISE: Server,
  CLOUD: Cloud,
  MULTI_CLOUD: Cloudy,
  HYBRID: Combine,
};

/** Ícone por tipo de rede do projeto — usado no card do dashboard, no
 *  seletor do "Novo projeto" e no header do Studio. Decorativo: o nome do
 *  tipo sempre aparece em texto ao lado. */
export default function NetworkTypeIcon({
  type,
  size = 14,
  ...rest
}: { type: ProjectNetworkType } & LucideProps) {
  // Fallback defensivo: um tipo desconhecido não pode derrubar a tela.
  const Icon = ICONS[type] ?? Server;
  return <Icon size={size} strokeWidth={1.75} aria-hidden="true" {...rest} />;
}
