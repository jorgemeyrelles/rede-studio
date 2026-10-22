import type { LocalizedText } from '../catalog/types';
import { closest, isSubnet } from '../network';
import type { CloudResource } from '../types';
import { cidrRange, intToIp, ipToInt, parseCidr } from './ip';

/**
 * Endereços dos recursos (F4 — decisão D6): EC2, NAT e RDS (primária) têm
 * IP privado FIXO, gravado em `config.privateIp` (sugerido pelo motor,
 * editável); ALB/NLB (um por subnet), ASG (máximo de instâncias) e o
 * standby do RDS Multi-AZ contam como IPs DINÂMICOS. A AWS reserva as 4
 * primeiras e a última de cada subnet, então o primeiro utilizável é `.4`.
 *
 * Puro: não importa o catálogo.
 */

/** Tipos com IP privado fixo em `config.privateIp`. */
export const FIXED_IP_TYPES = ['aws.ec2', 'aws.nat', 'aws.rds'];

export type SubnetAddress = {
  resourceId: string;
  subnetId: string;
  kind: 'fixed' | 'dynamic';
  /** IP fixo, ou `null` para dinâmico. */
  ip: string | null;
  /** Quantos IPs a entrada ocupa (fixo = 1). */
  count: number;
  role: 'primary' | 'standby' | 'node' | 'scaling';
};

const str = (value: unknown) => (typeof value === 'string' ? value : '');

export function readIdList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string')
    : [];
}

/** Subnet onde o recurso está (o pai, para nós dentro de subnet). */
export const subnetOf = (resources: CloudResource[], resource: CloudResource) =>
  closest(resources, resource.parentId, 'aws.subnet.public') ??
  closest(resources, resource.parentId, 'aws.subnet.private');

/** Todos os endereços ocupados no rascunho, por subnet. */
export function allAddresses(resources: CloudResource[]): SubnetAddress[] {
  const out: SubnetAddress[] = [];
  const subnetIds = new Set(resources.filter(isSubnet).map((s) => s.id));
  for (const resource of resources) {
    const parentSubnet =
      resource.parentId && subnetIds.has(resource.parentId)
        ? resource.parentId
        : null;
    if (FIXED_IP_TYPES.includes(resource.type) && parentSubnet) {
      out.push({
        resourceId: resource.id,
        subnetId: parentSubnet,
        kind: 'fixed',
        ip: str(resource.config.privateIp) || null,
        count: 1,
        role: 'primary',
      });
    }
    if (
      resource.type === 'aws.rds' &&
      resource.config.multiAz === true &&
      parentSubnet
    ) {
      const primaryAz = resources.find((r) => r.id === parentSubnet)?.parentId;
      const standby = readIdList(resource.config.subnetIds).find((id) => {
        const subnet = resources.find((r) => r.id === id);
        return subnet && subnet.parentId !== primaryAz;
      });
      if (standby)
        out.push({
          resourceId: resource.id,
          subnetId: standby,
          kind: 'dynamic',
          ip: null,
          count: 1,
          role: 'standby',
        });
    }
    if (resource.type === 'aws.alb' || resource.type === 'aws.nlb') {
      for (const id of readIdList(resource.config.subnetIds).filter((id) =>
        subnetIds.has(id),
      )) {
        out.push({
          resourceId: resource.id,
          subnetId: id,
          kind: 'dynamic',
          ip: null,
          count: 1,
          role: 'node',
        });
      }
    }
    if (resource.type === 'aws.asg') {
      const ids = readIdList(resource.config.subnetIds).filter((id) =>
        subnetIds.has(id),
      );
      const spread = ids.length ? ids : parentSubnet ? [parentSubnet] : [];
      const max =
        typeof resource.config.maxSize === 'number'
          ? resource.config.maxSize
          : 0;
      spread.forEach((id, index) => {
        // Distribui o máximo entre as subnets (o ASG equilibra por AZ).
        const count =
          Math.floor(max / spread.length) +
          (index < max % spread.length ? 1 : 0);
        if (count > 0)
          out.push({
            resourceId: resource.id,
            subnetId: id,
            kind: 'dynamic',
            ip: null,
            count,
            role: 'scaling',
          });
      });
    }
  }
  return out;
}

/** IPs usados numa subnet (fixos + dinâmicos). */
export function usedInSubnet(resources: CloudResource[], subnetId: string) {
  return allAddresses(resources)
    .filter((a) => a.subnetId === subnetId)
    .reduce((sum, a) => sum + a.count, 0);
}

/** Próximo IP livre da subnet (a partir de `.4`, sem o último), ou `null`. */
export function nextFreeIp(
  subnetCidr: string,
  takenIps: string[],
): string | null {
  const block = parseCidr(subnetCidr);
  if (!block) return null;
  const [start, end] = cidrRange(block);
  const taken = new Set(
    takenIps.map(ipToInt).filter((v): v is number => v !== null),
  );
  for (let value = start + 4; value <= end - 1; value++) {
    if (!taken.has(value)) return intToIp(value);
  }
  return null;
}

/** IP fixo sugerido para um recurso novo/existente na subnet, sem colidir com os outros. */
export function suggestIpInSubnet(
  resources: CloudResource[],
  subnetId: string,
  exceptId: string | null,
) {
  const subnet = resources.find((r) => r.id === subnetId);
  if (!subnet) return null;
  const taken = allAddresses(resources)
    .filter((a) => a.subnetId === subnetId && a.ip && a.resourceId !== exceptId)
    .map((a) => a.ip!);
  return nextFreeIp(str(subnet.config.cidr), taken);
}

/** Problema do IP fixo: fora da faixa utilizável da subnet ou repetido. */
export function privateIpIssue(
  resources: CloudResource[],
  resource: CloudResource,
): LocalizedText | null {
  const ip = str(resource.config.privateIp);
  if (!ip || !resource.parentId) return null;
  const subnet = resources.find((r) => r.id === resource.parentId);
  const block = parseCidr(str(subnet?.config.cidr));
  const value = ipToInt(ip);
  if (value === null) {
    return { pt: 'IP inválido.', en: 'Invalid IP.', es: 'IP inválida.' };
  }
  if (block) {
    const [start, end] = cidrRange(block);
    if (value < start + 4 || value > end - 1) {
      return {
        pt: `Fora da faixa utilizável da subnet (${intToIp(start + 4)} – ${intToIp(end - 1)}).`,
        en: `Outside the subnet usable range (${intToIp(start + 4)} – ${intToIp(end - 1)}).`,
        es: `Fuera del rango utilizable de la subnet (${intToIp(start + 4)} – ${intToIp(end - 1)}).`,
      };
    }
  }
  const clash = allAddresses(resources).find(
    (a) =>
      a.subnetId === resource.parentId &&
      a.ip === ip &&
      a.resourceId !== resource.id,
  );
  if (clash) {
    const other =
      resources.find((r) => r.id === clash.resourceId)?.name ??
      clash.resourceId;
    return {
      pt: `IP já usado por ${other}.`,
      en: `IP already used by ${other}.`,
      es: `IP ya usada por ${other}.`,
    };
  }
  return null;
}

/**
 * DNS interno no formato da AWS: `ip-10-0-1-10.<região>.compute.internal`
 * (em `us-east-1`, `ec2.internal`).
 */
export function ec2InternalDns(ip: string, region: string) {
  const host = `ip-${ip.split('.').join('-')}`;
  return region === 'us-east-1'
    ? `${host}.ec2.internal`
    : `${host}.${region}.compute.internal`;
}
