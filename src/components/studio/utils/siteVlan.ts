import type { NodeItem, SiteNetwork, SiteVlan } from '../../../features/network/types';
import { CAPACITY_OPTIONS } from '../constants';
import type { SiteVlanDraft } from '../types';

/** Presets de nome para novas VLANs (P12) */
export const VLAN_NAME_PRESETS: string[] = [
  'Usuários',
  'Servidores',
  'Gerência',
  'VoIP',
  'DMZ',
  'Câmeras / CFTV',
  'Visitantes / Guest',
  'Impressoras',
  'IoT',
  'Backup',
  'Storage',
  'Produção',
  'Desenvolvimento',
  'Wireless',
];

export function getNextVlanId(siteId: string, siteVlans: SiteVlan[]) {
  const used = new Set(
    siteVlans
      .filter((item) => item.siteId === siteId)
      .map((item) => item.vlanId),
  );
  let cursor = 10;
  while (used.has(cursor) && cursor < 4094) cursor += 10;
  return Math.min(4094, cursor);
}

/** Converte IP string para número (retorna null se inválido) */
function simpleIpToNumber(ip: string): number | null {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255))
    return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/**
 * P12 — retorna radicais disponíveis filtrando os que causariam sobreposição
 * com VLANs existentes dado o siteOctet e a capacidade do draft atual.
 *
 * Quando `selectedNetwork` for fornecida (Fase 2), filtra adicionalmente
 * para exibir apenas radicais cujo IP final cabe dentro do CIDR da LAN.
 */
export function getSiteRadicalOptions(
  siteId: string,
  siteOctet: number,
  siteVlans: SiteVlan[],
  nodes: NodeItem[],
  draftCapacity = 64,
  selectedNetwork?: Pick<SiteNetwork, 'addressFamily' | 'thirdOctet' | 'cidr'> | null,
) {
  const existingFromNodes = nodes
    .filter((node) => node.siteId === siteId && node.category !== 'wan')
    .map((node) => node.ip.split('.'))
    .filter((parts) => parts.length === 4 && Number(parts[1]) === siteOctet)
    .map((parts) => `${parts[2]}.${parts[3]}`);

  const existingFromVlans = siteVlans
    .filter((item) => item.siteId === siteId)
    .map((item) => item.startRadical)
    .filter(
      (value): value is string => typeof value === 'string' && value.length > 0,
    );

  const presetOptions: string[] = [];
  for (let third = 1; third <= 10; third += 1) {
    for (let fourth = 10; fourth <= 250; fourth += 20) {
      presetOptions.push(`${third}.${fourth}`);
    }
  }

  // Ranges ocupados pelas VLANs existentes do site
  const occupiedRanges = siteVlans
    .filter((item) => item.siteId === siteId)
    .map((item) => {
      const start = simpleIpToNumber(item.startIp);
      const end = simpleIpToNumber(item.endIp);
      return start !== null && end !== null ? { start, end } : null;
    })
    .filter((r): r is { start: number; end: number } => r !== null);

  const capacity = Math.max(1, draftCapacity);

  const isConflicting = (radical: string): boolean => {
    const [thirdRaw, fourthRaw] = radical.split('.');
    const third = Number(thirdRaw);
    const fourth = Number(fourthRaw);
    if (isNaN(third) || isNaN(fourth)) return true;
    const candidateStart = simpleIpToNumber(
      `200.${siteOctet}.${third}.${fourth}`,
    );
    if (candidateStart === null) return true;
    const candidateEnd = candidateStart + capacity - 1;
    return occupiedRanges.some(
      (r) => !(candidateEnd < r.start || candidateStart > r.end),
    );
  };

  const sortRadical = (value: string) => {
    const [thirdRaw, fourthRaw] = value.split('.');
    const third = Number(thirdRaw);
    const fourth = Number(fourthRaw);
    return third * 1000 + fourth;
  };

  const allOptions = Array.from(
    new Set([...existingFromNodes, ...existingFromVlans, ...presetOptions]),
  ).sort((a, b) => sortRadical(a) - sortRadical(b));

  // Filtrar conflitantes — mas sempre manter o radical atual das VLANs existentes
  const filtered = allOptions.filter((opt) => !isConflicting(opt));

  // Quando há uma rede/LAN selecionada (200.x), restringe aos radicais que
  // ficam dentro do bloco CIDR da rede para evitar erro de bounds no reducer
  if (selectedNetwork && selectedNetwork.addressFamily === '200.x') {
    const netBaseNum = simpleIpToNumber(
      `200.${siteOctet}.${selectedNetwork.thirdOctet}.0`,
    );
    if (netBaseNum !== null) {
      const netBlockSize = 2 ** (32 - Math.max(1, Math.min(32, selectedNetwork.cidr)));
      const netMin = netBaseNum;
      const netMax = netBaseNum + netBlockSize - 1;

      return filtered.filter((opt) => {
        const [thirdRaw, fourthRaw] = opt.split('.');
        const third = Number(thirdRaw);
        const fourth = Number(fourthRaw);
        if (isNaN(third) || isNaN(fourth)) return false;
        const candidateStart = simpleIpToNumber(`200.${siteOctet}.${third}.${fourth}`);
        if (candidateStart === null) return true;
        const candidateEnd = candidateStart + capacity - 1;
        return candidateStart >= netMin && candidateEnd <= netMax;
      });
    }
  }

  return filtered;
}

export function createDefaultVlanDraft(
  siteId: string,
  siteOctet: number,
  siteVlans: SiteVlan[],
  nodes: NodeItem[],
  selectedNetwork?: Pick<
    SiteNetwork,
    'addressFamily' | 'thirdOctet' | 'cidr' | 'ipv6Prefix'
  > | null,
): SiteVlanDraft {
  const defaultCapacity = CAPACITY_OPTIONS[3]; // 64
  const radicalOptions = getSiteRadicalOptions(
    siteId,
    siteOctet,
    siteVlans,
    nodes,
    defaultCapacity,
    selectedNetwork,
  );

  const suggestedVlanId = getNextVlanId(siteId, siteVlans);
  const ipv6Prefix = (() => {
    const raw = selectedNetwork?.ipv6Prefix?.trim();
    if (raw) {
      const [base] = raw.split('/');
      if (base) {
        const compactBase = base.replace(/::+$/, '').replace(/:$/, '');
        const vlanHex = suggestedVlanId.toString(16);
        return `${compactBase}:${vlanHex}::/64`;
      }
    }

    const safeSite = Math.max(0, Math.min(255, siteOctet));
    const siteHex = safeSite.toString(16).padStart(2, '0');
    const vlanHex = Math.max(1, Math.min(4094, suggestedVlanId)).toString(16);
    return `2001:db8:${siteHex}:${vlanHex}::/64`;
  })();

  return {
    vlanId: String(suggestedVlanId),
    capacity: String(defaultCapacity),
    startRadical: radicalOptions[0] ?? '1.10',
    name: '',
    ipv6Prefix,
    addressAllocation: 'dhcpv4',
  };
}

export function formatCompactRange(startIp: string, endIp: string) {
  if (startIp === endIp) return startIp;

  const start = startIp.split('.');
  const end = endIp.split('.');
  if (start.length !== 4 || end.length !== 4) {
    return `${startIp} - ${endIp}`;
  }

  if (start[0] === end[0] && start[1] === end[1]) {
    return `${startIp} - .${end[2]}.${end[3]}`;
  }

  if (start[0] === end[0]) {
    return `${startIp} - .${end[1]}.${end[2]}.${end[3]}`;
  }

  return `${startIp} - ${endIp}`;
}
