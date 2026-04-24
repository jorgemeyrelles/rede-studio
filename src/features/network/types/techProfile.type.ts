import type { NodeCategory } from './primitives';

export type TechValue = string | number | boolean;

export type NodeTechProfile = {
  kind: string;
  version: number;
  fields: Record<string, TechValue>;
};

export type TechFieldSchema = {
  key: string;
  label: string;
  labels?: Record<string, string>;
  type: 'text' | 'number' | 'boolean' | 'select';
  options?: string[];
  min?: number;
  max?: number;
  visibleWhen?: Partial<Record<string, TechValue | TechValue[]>>;
};

export type TechProfileContext = {
  category: NodeCategory;
  layerOrder: number;
  shouldBeGateway: boolean;
  siteNodeCount?: number;
};

export type TechKind =
  | 'router'
  | 'firewall'
  | 'vpn'
  | 'ids'
  | 'access-point'
  | 'printer'
  | 'generic';
